-- Tighten the reconciliation comparison and ensure history reflects whether an existing case was actually matched.
create or replace function public.record_sales_claim_entry(p_batch_id uuid, p_payload jsonb)
returns table(record_id uuid, claim_status text, investigation_status text)
language plpgsql security definer set search_path = ''
as $function$
declare
  v_case_id text; v_ic text; v_record public.sales_claim_records%rowtype;
  v_new_status text; v_new_id uuid; v_matched boolean := false;
  v_finance numeric(12,2); v_deposit numeric(12,2); v_stamp numeric(12,2);
  v_processing numeric(12,2); v_sst numeric(12,2); v_cash numeric(12,2);
begin
  if auth.uid() is null or not private.is_active_staff() or not private.has_permission('sales_claim') then
    raise exception 'Akaun ini tidak mempunyai permission sales_claim.';
  end if;
  v_case_id := nullif(btrim(coalesce(p_payload->>'caseId','')), '');
  v_ic := nullif(regexp_replace(coalesce(p_payload->>'icNumber',''), '\s', '', 'g'), '');
  if p_batch_id is null or v_case_id is null or v_ic is null then raise exception 'Batch, CASE ID dan IC Number wajib diisi.'; end if;
  if not exists (select 1 from public.sales_claim_batches where id=p_batch_id) then raise exception 'Claim Batch tidak ditemui.'; end if;
  v_finance := coalesce((p_payload->>'financeAmount')::numeric,0);
  v_deposit := coalesce((p_payload->>'deposit')::numeric,0);
  v_stamp := coalesce((p_payload->>'stampDutyFee')::numeric,0);
  v_processing := coalesce((p_payload->>'processingFee')::numeric,50);
  v_sst := coalesce((p_payload->>'sstAmount')::numeric,4);
  v_cash := coalesce((p_payload->>'actualCashPayment')::numeric,v_finance-v_processing-v_sst-v_stamp);

  select * into v_record from public.sales_claim_records r
  where r.batch_id=p_batch_id and r.case_id=v_case_id and r.application_id is not null for update;

  if found and regexp_replace(v_record.ic_number, '\s', '', 'g')=v_ic then
    v_matched := true;
    v_new_status := case
      when round(v_record.finance_amount,2)<>round(v_finance,2)
        or round(v_record.deposit,2)<>round(v_deposit,2)
        or round(v_record.stamp_duty_fee,2)<>round(v_stamp,2)
        or round(v_record.processing_fee,2)<>round(v_processing,2)
        or round(v_record.sst_amount,2)<>round(v_sst,2)
        or round(v_record.actual_cash_payment,2)<>round(v_cash,2)
        or (nullif(btrim(p_payload->>'customerName'),'') is not null and lower(btrim(v_record.customer_name))<>lower(btrim(p_payload->>'customerName')))
        or (nullif(btrim(p_payload->>'item'),'') is not null and lower(btrim(v_record.item))<>lower(btrim(p_payload->>'item')))
        or (nullif(btrim(p_payload->>'branch'),'') is not null and lower(btrim(v_record.branch))<>lower(btrim(p_payload->>'branch')))
        or (nullif(btrim(p_payload->>'invoiceNumber'),'') is not null and lower(btrim(v_record.invoice_number))<>lower(btrim(p_payload->>'invoiceNumber')))
        or (nullif(btrim(p_payload->>'staff1'),'') is not null and lower(btrim(v_record.staff_1))<>lower(btrim(p_payload->>'staff1')))
        or (nullif(btrim(p_payload->>'staff2'),'') is not null and lower(btrim(v_record.staff_2))<>lower(btrim(p_payload->>'staff2')))
      then 'DISCREPANCY' else 'CLAIMED' end;
    update public.sales_claim_records set
      jcl_customer_name=nullif(btrim(p_payload->>'customerName'),''),
      jcl_item=nullif(btrim(p_payload->>'item'),''),
      jcl_finance_amount=v_finance,jcl_deposit=v_deposit,jcl_stamp_duty_fee=v_stamp,
      jcl_processing_fee=v_processing,jcl_sst_amount=v_sst,jcl_actual_cash_payment=v_cash,
      jcl_branch=nullif(btrim(p_payload->>'branch'),''),jcl_invoice_number=nullif(btrim(p_payload->>'invoiceNumber'),''),
      jcl_staff_1=nullif(btrim(p_payload->>'staff1'),''),jcl_staff_2=nullif(btrim(p_payload->>'staff2'),''),
      claim_date=nullif(p_payload->>'claimDate','')::date,claim_status=v_new_status,
      entered_by_staff_id=private.current_staff_id(),entered_at=now(),
      remarks=coalesce(btrim(p_payload->>'remarks'),''),updated_at=now()
    where id=v_record.id returning id into v_new_id;
  else
    insert into public.sales_claim_records (
      batch_id,case_id,ic_number,customer_name,item,finance_amount,deposit,stamp_duty_fee,
      processing_fee,sst_amount,actual_cash_payment,branch,invoice_number,staff_1,staff_2,
      claim_date,claim_status,investigation_status,remarks,entered_by_staff_id,entered_at,
      jcl_customer_name,jcl_item,jcl_finance_amount,jcl_deposit,jcl_stamp_duty_fee,
      jcl_processing_fee,jcl_sst_amount,jcl_actual_cash_payment,jcl_branch,jcl_invoice_number,jcl_staff_1,jcl_staff_2
    ) values (
      p_batch_id,v_case_id,v_ic,coalesce(p_payload->>'customerName',''),coalesce(p_payload->>'item',''),
      v_finance,v_deposit,v_stamp,v_processing,v_sst,v_cash,coalesce(p_payload->>'branch',''),
      coalesce(p_payload->>'invoiceNumber',''),coalesce(p_payload->>'staff1',''),coalesce(p_payload->>'staff2',''),
      nullif(p_payload->>'claimDate','')::date,'PENDING VERIFICATION','NOT REVIEWED',
      coalesce(p_payload->>'remarks',''),private.current_staff_id(),now(),
      coalesce(p_payload->>'customerName',''),coalesce(p_payload->>'item',''),v_finance,v_deposit,
      v_stamp,v_processing,v_sst,v_cash,coalesce(p_payload->>'branch',''),
      coalesce(p_payload->>'invoiceNumber',''),coalesce(p_payload->>'staff1',''),coalesce(p_payload->>'staff2','')
    ) returning id into v_new_id;
    v_new_status := 'PENDING VERIFICATION';
  end if;

  insert into public.sales_claim_history(sales_claim_record_id,event_type,old_value,new_value,notes,changed_by_staff_id)
  values (v_new_id,'CLAIM ENTRY',case when v_matched then v_record.claim_status else null end,
    v_new_status,coalesce(p_payload->>'remarks',''),private.current_staff_id());
  return query select r.id,r.claim_status,r.investigation_status from public.sales_claim_records r where r.id=v_new_id;
end;
$function$;
revoke all on function public.record_sales_claim_entry(uuid,jsonb) from public,anon;
grant execute on function public.record_sales_claim_entry(uuid,jsonb) to authenticated;
