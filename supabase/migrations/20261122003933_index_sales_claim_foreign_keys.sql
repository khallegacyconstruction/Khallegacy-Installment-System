create index if not exists sales_claim_batches_created_by_staff_idx on public.sales_claim_batches(created_by_staff_id);
create index if not exists sales_claim_batches_submission_idx on public.sales_claim_batches(sale_submission_id);
create index if not exists sales_claim_records_application_idx on public.sales_claim_records(application_id);
create index if not exists sales_claim_records_entered_by_staff_idx on public.sales_claim_records(entered_by_staff_id);
create index if not exists sales_claim_records_batch_idx on public.sales_claim_records(batch_id);
create index if not exists sales_claim_history_record_idx on public.sales_claim_history(sales_claim_record_id);
create index if not exists sales_claim_history_changed_by_staff_idx on public.sales_claim_history(changed_by_staff_id);
