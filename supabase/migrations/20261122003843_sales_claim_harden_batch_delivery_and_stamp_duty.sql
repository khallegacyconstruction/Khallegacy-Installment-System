create or replace function private.apply_stamp_duty_from_financing_amount()
returns trigger language plpgsql set search_path = ''
as $function$
begin
  new.stamp_duty := greatest(ceil(coalesce(new.total_financing_amount,0)/1000.0),1)*5;
  return new;
end;
$function$;

drop trigger if exists application_financing_00_stamp_duty_auto on public.application_financing;
create trigger application_financing_00_stamp_duty_auto
before insert or update of total_financing_amount on public.application_financing
for each row execute function private.apply_stamp_duty_from_financing_amount();

create or replace function public.create_sales_claim_batch(
  p_sale_submission_id text,p_received_date date,
  p_jcl_batch_reference text default '',p_remarks text default ''
)
returns table(batch_id uuid,batch_reference text,record_count integer)
language plpgsql security definer set search_path = ''
as $function$
declare v_staff_id text; v_batch_id uuid; v_batch_reference text; v_count integer;
begin
  if auth.uid() is null or not private.is_active_staff() or not private.has_permission('sales_claim') then
    raise exception 'Akaun ini tidak mempunyai permission sales_claim.';
  end if;
  if nullif(btrim(p_sale_submission_id),'') is null or p_received_date is null then
    raise exception 'Sale Submission dan tarikh penerimaan JCL wajib diisi.';
  end if;
  if not exists (
    select 1 from public.sale_submissions ss
    join lateral (
      select pt.status from public.postage_trackings pt
      where pt.sale_submission_id=ss.submission_list_id order by pt.updated_at desc limit 1
    ) latest_tracking on true
    where ss.submission_list_id=p_sale_submission_id and latest_tracking.status='DELIVERED'
  ) then
    raise exception 'Batch Sale Submission mesti mempunyai status terkini DELIVERED dalam Postage Management.';
  end if;
  v_staff_id:=private.current_staff_id();
  v_batch_id:=gen_random_uuid();
  v_batch_reference:='SC-'||to_char(p_received_date,'YYYYMMDD')||'-'||upper(substr(replace(v_batch_id::text,'-',''),1,6));
  insert into public.sales_claim_batches(id,batch_reference,sale_submission_id,jcl_batch_reference,received_date,remarks,created_by_staff_id)
  values(v_batch_id,v_batch_reference,p_sale_submission_id,nullif(btrim(coalesce(p_jcl_batch_reference,'')),''),p_received_date,coalesce(btrim(p_remarks),''),v_staff_id);
  insert into public.sales_claim_records(
    batch_id,application_id,case_id,ic_number,customer_name,item,finance_amount,deposit,
    stamp_duty_fee,processing_fee,sst_amount,actual_cash_payment,branch,invoice_number,staff_1,staff_2
  )
  select v_batch_id,a.id,a.case_id,a.ic_number,a.customer_name,
    coalesce((select string_agg(ap.product_name||case when nullif(ap.model,'') is not null then ' '||ap.model else '' end||' x'||ap.quantity::text,', ' order by ap.id)
      from public.application_products ap where ap.application_id=a.id),''),
    f.total_financing_amount,f.deposit,f.stamp_duty,f.processing_fee,f.sst_amount,f.actual_cash_payment,
    coalesce(b.name,''),coalesce(aa.invoice_number,''),coalesce(aa.checking_staff1,''),coalesce(aa.checking_staff2,'')
  from public.sale_submission_applications ssa
  join public.applications a on a.id=ssa.application_id
  join public.application_financing f on f.application_id=a.id
  left join public.application_agreements aa on aa.application_id=a.id
  left join public.branches b on b.id=a.customer_from_branch_id
  join public.sale_submissions ss on ss.id=ssa.sale_submission_id
  where ss.submission_list_id=p_sale_submission_id and a.approval_status='Approved';
  get diagnostics v_count=row_count;
  if v_count=0 then raise exception 'Tiada permohonan yang layak dalam Sale Submission ini.'; end if;
  return query select v_batch_id,v_batch_reference,v_count;
end;
$function$;
revoke all on function public.create_sales_claim_batch(text,date,text,text) from public,anon;
grant execute on function public.create_sales_claim_batch(text,date,text,text) to authenticated;
