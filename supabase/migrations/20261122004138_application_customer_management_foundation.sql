insert into public.permissions(permission_key,description)
values('manage_applications','View and update application and customer details')
on conflict(permission_key) do update set description=excluded.description;

insert into public.role_permissions(role_id,permission_key)
select id,'manage_applications' from public.roles where name='Management'
on conflict do nothing;

create or replace function public.update_application_customer_details(p_application_id bigint,p_payload jsonb)
returns void language plpgsql security definer set search_path = ''
as $function$
declare
  v_staff_id text;
  v_old public.applications%rowtype;
  v_name text; v_ic text; v_phone text;
  v_from_branch text; v_pickup_branch text; v_staff_in_charge text;
  v_changed text[] := array[]::text[];
begin
  if auth.uid() is null or not private.is_active_staff() or not private.has_permission('manage_applications') then
    raise exception 'Akaun ini tidak mempunyai permission manage_applications.';
  end if;
  if p_application_id is null then raise exception 'Application ID diperlukan.'; end if;
  select * into v_old from public.applications where id=p_application_id for update;
  if not found then raise exception 'Permohonan tidak ditemui.'; end if;

  v_name:=nullif(btrim(coalesce(p_payload->>'customerName','')),'');
  v_ic:=nullif(btrim(coalesce(p_payload->>'icNumber','')),'');
  v_phone:=nullif(btrim(coalesce(p_payload->>'phone','')),'');
  v_from_branch:=nullif(btrim(coalesce(p_payload->>'customerFromBranchId','')),'');
  v_pickup_branch:=nullif(btrim(coalesce(p_payload->>'pickupBranchId','')),'');
  v_staff_in_charge:=nullif(btrim(coalesce(p_payload->>'staffInChargeId','')),'');
  if v_name is null or v_ic is null or v_phone is null then raise exception 'Nama pelanggan, IC Number dan telefon wajib diisi.'; end if;
  if v_from_branch is null or not exists(select 1 from public.branches b where b.id=v_from_branch and b.active=true and b.branch_type<>'POSTAGE') then
    raise exception 'Customer From Branch tidak sah atau tidak aktif.';
  end if;
  if v_pickup_branch is not null and not exists(select 1 from public.branches b where b.id=v_pickup_branch and b.active=true and b.branch_type<>'WEB') then
    raise exception 'Pickup Branch tidak sah atau tidak aktif.';
  end if;
  if v_staff_in_charge is not null and not exists(select 1 from public.staff_users s where s.id=v_staff_in_charge and s.status='Active') then
    raise exception 'Staff In Charge tidak sah atau tidak aktif.';
  end if;

  if v_old.customer_name is distinct from v_name then v_changed:=array_append(v_changed,'Customer Name'); end if;
  if v_old.ic_number is distinct from v_ic then v_changed:=array_append(v_changed,'IC Number'); end if;
  if v_old.phone is distinct from v_phone then v_changed:=array_append(v_changed,'Phone'); end if;
  if v_old.address is distinct from coalesce(p_payload->>'address','') then v_changed:=array_append(v_changed,'Address'); end if;
  if v_old.ref1_id is distinct from nullif(btrim(coalesce(p_payload->>'ref1Id','')),'') then v_changed:=array_append(v_changed,'REF1 ID'); end if;
  if v_old.customer_from_branch_id is distinct from v_from_branch then v_changed:=array_append(v_changed,'Customer From Branch'); end if;
  if v_old.pickup_branch_id is distinct from v_pickup_branch then v_changed:=array_append(v_changed,'Pickup Branch'); end if;
  if v_old.bank_name is distinct from nullif(btrim(coalesce(p_payload->>'bankName','')),'') then v_changed:=array_append(v_changed,'Bank Name'); end if;
  if v_old.bank_account_number is distinct from nullif(btrim(coalesce(p_payload->>'bankAccountNumber','')),'') then v_changed:=array_append(v_changed,'Bank Account Number'); end if;
  if v_old.application_remarks is distinct from nullif(btrim(coalesce(p_payload->>'applicationRemarks','')),'') then v_changed:=array_append(v_changed,'Application Remarks'); end if;
  if v_old.internal_notes is distinct from nullif(btrim(coalesce(p_payload->>'internalNotes','')),'') then v_changed:=array_append(v_changed,'Internal Notes'); end if;
  if v_old.staff_in_charge_id is distinct from v_staff_in_charge then v_changed:=array_append(v_changed,'Staff In Charge'); end if;
  if cardinality(v_changed)=0 then return; end if;
  v_staff_id:=private.current_staff_id();

  update public.applications set
    customer_name=v_name,ic_number=v_ic,phone=v_phone,address=coalesce(p_payload->>'address',''),
    ref1_id=nullif(btrim(coalesce(p_payload->>'ref1Id','')),''),
    customer_from_branch_id=v_from_branch,pickup_branch_id=v_pickup_branch,
    bank_name=nullif(btrim(coalesce(p_payload->>'bankName','')),''),
    bank_account_number=nullif(btrim(coalesce(p_payload->>'bankAccountNumber','')),''),
    application_remarks=nullif(btrim(coalesce(p_payload->>'applicationRemarks','')),''),
    internal_notes=nullif(btrim(coalesce(p_payload->>'internalNotes','')),''),
    staff_in_charge_id=v_staff_in_charge,updated_at=now()
  where id=p_application_id;

  insert into public.application_timeline(application_id,activity_type,activity_title,activity_description,new_status,performed_by_staff_id)
  values(p_application_id,'Application Details Updated','Customer/Application Details Updated',
    'Updated fields: '||array_to_string(v_changed,', '),'UPDATED',v_staff_id);
end;
$function$;

revoke all on function public.update_application_customer_details(bigint,jsonb) from public,anon;
grant execute on function public.update_application_customer_details(bigint,jsonb) to authenticated;
