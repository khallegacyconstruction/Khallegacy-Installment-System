alter table public.sales_claim_records
  add column agreement_fee numeric(12,2) not null default 88,
  add column jcl_agreement_fee numeric(12,2);

drop function public.update_sales_claim_fees(bigint,numeric,numeric,numeric);
create or replace function public.update_sales_claim_fees(
  p_application_id bigint,p_processing_fee numeric,p_sst_amount numeric,
  p_stamp_duty_fee numeric,p_agreement_fee numeric
)
returns numeric language plpgsql security definer set search_path = ''
as $function$
declare v_actual numeric;
begin
  if auth.uid() is null or not private.is_active_staff() or not private.has_permission('sales_claim') then
    raise exception 'Akaun ini tidak mempunyai permission sales_claim.';
  end if;
  if p_application_id is null or p_processing_fee is null or p_sst_amount is null or p_stamp_duty_fee is null or p_agreement_fee is null
     or p_processing_fee<0 or p_sst_amount<0 or p_stamp_duty_fee<0 or p_agreement_fee<0 then
    raise exception 'Maklumat caj tidak sah.';
  end if;
  update public.application_financing set processing_fee=p_processing_fee,sst_amount=p_sst_amount,
    stamp_duty=p_stamp_duty_fee,agreement_fee=p_agreement_fee,updated_at=now()
  where application_id=p_application_id returning actual_cash_payment into v_actual;
  if not found then raise exception 'Maklumat pembiayaan tidak ditemui.'; end if;
  insert into public.application_timeline(application_id,activity_type,activity_title,activity_description,new_status,performed_by_staff_id)
  values(p_application_id,'Sales Claim Fees Updated','Sales Claim Fees Updated',
    'Processing Fee RM'||to_char(p_processing_fee,'FM999999990.00')||
    '; SST RM'||to_char(p_sst_amount,'FM999999990.00')||
    '; Stamp Duty RM'||to_char(p_stamp_duty_fee,'FM999999990.00')||
    '; Agreement Fee RM'||to_char(p_agreement_fee,'FM999999990.00')||
    '; Actual Cash Payment RM'||to_char(v_actual,'FM999999990.00'),
    'UPDATED',private.current_staff_id());
  return v_actual;
end;
$function$;
revoke all on function public.update_sales_claim_fees(bigint,numeric,numeric,numeric,numeric) from public,anon;
grant execute on function public.update_sales_claim_fees(bigint,numeric,numeric,numeric,numeric) to authenticated;

create or replace function public.create_sales_claim_batch(
  p_sale_submission_id text,p_received_date date,p_jcl_batch_reference text default '',p_remarks text default ''
)
returns table(batch_id uuid,batch_reference text,record_count integer)
language plpgsql security definer set search_path = ''
as $function$
declare v_staff_id text;v_batch_id uuid;v_batch_reference text;v_count integer;
begin
  if auth.uid() is null or not private.is_active_staff() or not private.has_permission('sales_claim') then raise exception 'Akaun ini tidak mempunyai permission sales_claim.'; end if;
  if nullif(btrim(p_sale_submission_id),'') is null or p_received_date is null then raise exception 'Sale Submission dan tarikh penerimaan JCL wajib diisi.'; end if;
  if not exists(select 1 from public.sale_submissions ss join lateral(
    select pt.status from public.postage_trackings pt where pt.sale_submission_id=ss.submission_list_id order by pt.updated_at desc limit 1
  ) latest_tracking on true where ss.submission_list_id=p_sale_submission_id and latest_tracking.status='DELIVERED') then
    raise exception 'Batch Sale Submission mesti mempunyai status terkini DELIVERED dalam Postage Management.';
  end if;
  v_staff_id:=private.current_staff_id();v_batch_id:=gen_random_uuid();
  v_batch_reference:='SC-'||to_char(p_received_date,'YYYYMMDD')||'-'||upper(substr(replace(v_batch_id::text,'-',''),1,6));
  insert into public.sales_claim_batches(id,batch_reference,sale_submission_id,jcl_batch_reference,received_date,remarks,created_by_staff_id)
  values(v_batch_id,v_batch_reference,p_sale_submission_id,nullif(btrim(coalesce(p_jcl_batch_reference,'')),''),p_received_date,coalesce(btrim(p_remarks),''),v_staff_id);
  insert into public.sales_claim_records(batch_id,application_id,case_id,ic_number,customer_name,item,finance_amount,deposit,stamp_duty_fee,processing_fee,sst_amount,actual_cash_payment,branch,invoice_number,staff_1,staff_2,agreement_fee)
  select v_batch_id,a.id,a.case_id,a.ic_number,a.customer_name,
    coalesce((select string_agg(ap.product_name||case when nullif(ap.model,'') is not null then ' '||ap.model else '' end||' x'||ap.quantity::text,', ' order by ap.id)
      from public.application_products ap where ap.application_id=a.id),''),
    f.total_financing_amount,f.deposit,f.stamp_duty,f.processing_fee,f.sst_amount,f.actual_cash_payment,
    coalesce(b.name,''),coalesce(aa.invoice_number,''),coalesce(aa.checking_staff1,''),coalesce(aa.checking_staff2,''),f.agreement_fee
  from public.sale_submission_applications ssa join public.applications a on a.id=ssa.application_id
  join public.application_financing f on f.application_id=a.id
  left join public.application_agreements aa on aa.application_id=a.id
  left join public.branches b on b.id=a.customer_from_branch_id
  join public.sale_submissions ss on ss.id=ssa.sale_submission_id
  where ss.submission_list_id=p_sale_submission_id and a.approval_status='Approved';
  get diagnostics v_count=row_count;if v_count=0 then raise exception 'Tiada permohonan yang layak dalam Sale Submission ini.';end if;
  return query select v_batch_id,v_batch_reference,v_count;
end;
$function$;
revoke all on function public.create_sales_claim_batch(text,date,text,text) from public,anon;
grant execute on function public.create_sales_claim_batch(text,date,text,text) to authenticated;

create or replace function public.record_sales_claim_entry(p_batch_id uuid,p_payload jsonb)
returns table(record_id uuid,claim_status text,investigation_status text)
language plpgsql security definer set search_path = ''
as $function$
declare
  v_case_id text;v_ic text;v_record public.sales_claim_records%rowtype;v_new_status text;v_new_id uuid;v_matched boolean:=false;
  v_finance numeric(12,2);v_deposit numeric(12,2);v_stamp numeric(12,2);v_processing numeric(12,2);v_sst numeric(12,2);v_cash numeric(12,2);v_agreement numeric(12,2);
begin
  if auth.uid() is null or not private.is_active_staff() or not private.has_permission('sales_claim') then raise exception 'Akaun ini tidak mempunyai permission sales_claim.'; end if;
  v_case_id:=nullif(btrim(coalesce(p_payload->>'caseId','')),'');v_ic:=nullif(regexp_replace(coalesce(p_payload->>'icNumber',''),'\s','','g'),'');
  if p_batch_id is null or v_case_id is null or v_ic is null then raise exception 'Batch, CASE ID dan IC Number wajib diisi.';end if;
  if not exists(select 1 from public.sales_claim_batches where id=p_batch_id) then raise exception 'Claim Batch tidak ditemui.';end if;
  v_finance:=coalesce((p_payload->>'financeAmount')::numeric,0);v_deposit:=coalesce((p_payload->>'deposit')::numeric,0);
  v_stamp:=coalesce((p_payload->>'stampDutyFee')::numeric,0);v_processing:=coalesce((p_payload->>'processingFee')::numeric,50);
  v_sst:=coalesce((p_payload->>'sstAmount')::numeric,4);v_cash:=coalesce((p_payload->>'actualCashPayment')::numeric,v_finance-v_processing-v_sst-v_stamp);
  v_agreement:=coalesce((p_payload->>'agreementFee')::numeric,88);
  select * into v_record from public.sales_claim_records r where r.batch_id=p_batch_id and r.case_id=v_case_id and r.application_id is not null for update;
  if found and regexp_replace(v_record.ic_number,'\s','','g')=v_ic then
    v_matched:=true;
    v_new_status:=case when round(v_record.finance_amount,2)<>round(v_finance,2)
      or round(v_record.deposit,2)<>round(v_deposit,2) or round(v_record.stamp_duty_fee,2)<>round(v_stamp,2)
      or round(v_record.processing_fee,2)<>round(v_processing,2) or round(v_record.sst_amount,2)<>round(v_sst,2)
      or round(v_record.actual_cash_payment,2)<>round(v_cash,2) or round(v_record.agreement_fee,2)<>round(v_agreement,2)
      or (nullif(btrim(p_payload->>'customerName'),'') is not null and lower(btrim(v_record.customer_name))<>lower(btrim(p_payload->>'customerName')))
      or (nullif(btrim(p_payload->>'item'),'') is not null and lower(btrim(v_record.item))<>lower(btrim(p_payload->>'item')))
      or (nullif(btrim(p_payload->>'branch'),'') is not null and lower(btrim(v_record.branch))<>lower(btrim(p_payload->>'branch')))
      or (nullif(btrim(p_payload->>'invoiceNumber'),'') is not null and lower(btrim(v_record.invoice_number))<>lower(btrim(p_payload->>'invoiceNumber')))
      or (nullif(btrim(p_payload->>'staff1'),'') is not null and lower(btrim(v_record.staff_1))<>lower(btrim(p_payload->>'staff1')))
      or (nullif(btrim(p_payload->>'staff2'),'') is not null and lower(btrim(v_record.staff_2))<>lower(btrim(p_payload->>'staff2')))
      then 'DISCREPANCY' else 'CLAIMED' end;
    update public.sales_claim_records set
      jcl_customer_name=nullif(btrim(p_payload->>'customerName'),''),jcl_item=nullif(btrim(p_payload->>'item'),''),
      jcl_finance_amount=v_finance,jcl_deposit=v_deposit,jcl_stamp_duty_fee=v_stamp,jcl_processing_fee=v_processing,
      jcl_sst_amount=v_sst,jcl_actual_cash_payment=v_cash,jcl_agreement_fee=v_agreement,
      jcl_branch=nullif(btrim(p_payload->>'branch'),''),jcl_invoice_number=nullif(btrim(p_payload->>'invoiceNumber'),''),
      jcl_staff_1=nullif(btrim(p_payload->>'staff1'),''),jcl_staff_2=nullif(btrim(p_payload->>'staff2'),''),
      claim_date=nullif(p_payload->>'claimDate','')::date,claim_status=v_new_status,
      entered_by_staff_id=private.current_staff_id(),entered_at=now(),remarks=coalesce(btrim(p_payload->>'remarks'),''),updated_at=now()
    where id=v_record.id returning id into v_new_id;
  else
    insert into public.sales_claim_records(batch_id,case_id,ic_number,customer_name,item,finance_amount,deposit,stamp_duty_fee,processing_fee,sst_amount,actual_cash_payment,agreement_fee,branch,invoice_number,staff_1,staff_2,claim_date,claim_status,investigation_status,remarks,entered_by_staff_id,entered_at,jcl_customer_name,jcl_item,jcl_finance_amount,jcl_deposit,jcl_stamp_duty_fee,jcl_processing_fee,jcl_sst_amount,jcl_actual_cash_payment,jcl_agreement_fee,jcl_branch,jcl_invoice_number,jcl_staff_1,jcl_staff_2)
    values(p_batch_id,v_case_id,v_ic,coalesce(p_payload->>'customerName',''),coalesce(p_payload->>'item',''),v_finance,v_deposit,v_stamp,v_processing,v_sst,v_cash,v_agreement,coalesce(p_payload->>'branch',''),coalesce(p_payload->>'invoiceNumber',''),coalesce(p_payload->>'staff1',''),coalesce(p_payload->>'staff2',''),nullif(p_payload->>'claimDate','')::date,'PENDING VERIFICATION','NOT REVIEWED',coalesce(p_payload->>'remarks',''),private.current_staff_id(),now(),coalesce(p_payload->>'customerName',''),coalesce(p_payload->>'item',''),v_finance,v_deposit,v_stamp,v_processing,v_sst,v_cash,v_agreement,coalesce(p_payload->>'branch',''),coalesce(p_payload->>'invoiceNumber',''),coalesce(p_payload->>'staff1',''),coalesce(p_payload->>'staff2',''))
    returning id into v_new_id;v_new_status:='PENDING VERIFICATION';
  end if;
  insert into public.sales_claim_history(sales_claim_record_id,event_type,old_value,new_value,notes,changed_by_staff_id)
  values(v_new_id,'CLAIM ENTRY',case when v_matched then v_record.claim_status else null end,v_new_status,coalesce(p_payload->>'remarks',''),private.current_staff_id());
  return query select r.id,r.claim_status,r.investigation_status from public.sales_claim_records r where r.id=v_new_id;
end;
$function$;
revoke all on function public.record_sales_claim_entry(uuid,jsonb) from public,anon;
grant execute on function public.record_sales_claim_entry(uuid,jsonb) to authenticated;
