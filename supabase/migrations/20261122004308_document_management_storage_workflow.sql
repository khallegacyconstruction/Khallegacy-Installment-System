insert into public.permissions(permission_key,description)
values('manage_documents','Upload and manage customer application documents')
on conflict(permission_key) do update set description=excluded.description;
insert into public.role_permissions(role_id,permission_key)
select id,'manage_documents' from public.roles where name='Management'
on conflict do nothing;

grant select on public.application_documents to authenticated;
create policy application_documents_insert_manage_documents
on public.application_documents for insert to authenticated
with check(private.is_active_staff() and private.has_permission('manage_documents'));

create policy application_documents_storage_insert_manage_documents
on storage.objects for insert to authenticated
with check(bucket_id='application-documents' and private.is_active_staff() and private.has_permission('manage_documents'));
create policy application_documents_storage_update_manage_documents
on storage.objects for update to authenticated
using(bucket_id='application-documents' and private.is_active_staff() and private.has_permission('manage_documents'))
with check(bucket_id='application-documents' and private.is_active_staff() and private.has_permission('manage_documents'));
create policy application_documents_storage_delete_manage_documents
on storage.objects for delete to authenticated
using(bucket_id='application-documents' and private.is_active_staff() and private.has_permission('manage_documents'));

create or replace function public.register_application_document(
  p_application_id bigint,p_document_type text,p_file_name text,p_storage_path text,
  p_file_size text,p_file_type text,p_remarks text default '',p_summary text default ''
)
returns bigint language plpgsql security definer set search_path = ''
as $function$
declare v_staff_id text; v_document_id bigint;
begin
  if auth.uid() is null or not private.is_active_staff() or not private.has_permission('manage_documents') then
    raise exception 'Akaun ini tidak mempunyai permission manage_documents.';
  end if;
  if p_application_id is null or not exists(select 1 from public.applications where id=p_application_id) then
    raise exception 'Permohonan tidak ditemui.';
  end if;
  if nullif(btrim(p_document_type),'') is null or nullif(btrim(p_file_name),'') is null or nullif(btrim(p_storage_path),'') is null then
    raise exception 'Document Type, File Name dan Storage Path wajib diisi.';
  end if;
  if p_storage_path not like p_application_id::text||'/%' then
    raise exception 'Storage Path tidak sepadan dengan Application ID.';
  end if;
  if p_file_type is null or p_file_type not in ('application/pdf','image/jpeg','image/png') then
    raise exception 'Jenis fail tidak dibenarkan.';
  end if;
  v_staff_id:=private.current_staff_id();
  insert into public.application_documents(
    application_id,document_type,file_name,storage_path,uploaded_by_staff_id,remarks,file_size,file_type,summary
  ) values(
    p_application_id,btrim(p_document_type),btrim(p_file_name),btrim(p_storage_path),v_staff_id,
    coalesce(btrim(p_remarks),''),p_file_size,p_file_type,coalesce(btrim(p_summary),'')
  ) returning id into v_document_id;
  insert into public.application_timeline(application_id,activity_type,activity_title,activity_description,new_status,performed_by_staff_id)
  values(p_application_id,'Document Uploaded','Application Document Uploaded',
    'Uploaded document: '||btrim(p_file_name)||' ('||btrim(p_document_type)||').','UPLOADED',v_staff_id);
  return v_document_id;
end;
$function$;
revoke all on function public.register_application_document(bigint,text,text,text,text,text,text,text) from public,anon;
grant execute on function public.register_application_document(bigint,text,text,text,text,text,text,text) to authenticated;
