import type { UpdateApplicationDetailsPayload } from '../utils/businessRules';
import { supabase } from './supabase';

type DbError = { message?: string } | null;

function throwIfError(error: DbError, action: string): void {
  if (error) throw new Error(`${action}: ${error.message || 'Ralat Supabase tidak diketahui.'}`);
}

/** Saves Approval Details to the Supabase UAT database. Each table remains protected by RLS. */
export async function updateSupabaseApprovalApplication(
  applicationId: string,
  payload: UpdateApplicationDetailsPayload,
  staffId: string,
  staffName: string,
): Promise<void> {
  const id = Number(applicationId);
  if (!Number.isSafeInteger(id) || id <= 0) throw new Error('ID permohonan tidak sah.');

  const { data: current, error: currentError } = await supabase
    .from('applications')
    .select('approval_date, approval_status')
    .eq('id', id)
    .maybeSingle();
  throwIfError(currentError, 'Gagal membaca permohonan');

  if (!current) throw new Error('Rekod permohonan tidak ditemui atau tiada akses.');

  const { data: existingProducts, error: productsReadError } = await supabase
    .from('application_products')
    .select('id')
    .eq('application_id', id);
  throwIfError(productsReadError, 'Gagal membaca senarai produk');

  const updateApplication = await supabase
    .from('applications')
    .update({
      case_id: payload.caseId.trim(),
      customer_name: payload.customerName.trim(),
      ic_number: payload.icNumber.trim(),
      phone: payload.phone.trim(),
      ref1_id: payload.ref1Id.trim() || null,
      application_date: payload.applicationDate,
      customer_from_branch_id: payload.customerFromBranchId,
      pickup_branch_id: payload.pickupBranchId || null,
      bank_name: payload.bankName.trim() || null,
      bank_account_number: payload.bankAccountNumber.trim() || null,
      application_remarks: payload.applicationRemarks.trim() || null,
      approval_status: payload.approvalStatus,
      approval_date: payload.approvalDate || current.approval_date,
      staff_in_charge_id: payload.staffInChargeId || null,
      internal_notes: payload.internalNotes.trim() || null,
      category: payload.category,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select('id')
    .maybeSingle();
  throwIfError(updateApplication.error, 'Gagal mengemas kini maklumat permohonan');
  if (!updateApplication.data) throw new Error('Permohonan tidak dikemas kini. Semak kebenaran akaun.');

  const existingIds = new Set((existingProducts ?? []).map((row) => String(row.id)));
  const retainedIds = new Set<string>();

  for (const product of payload.products.filter((item) => item.productName.trim())) {
    const productId = product.id ? String(product.id) : '';
    const productValues = {
      product_name: product.productName.trim(),
      category: payload.category,
      model: product.model.trim() || 'Standard Spec',
      specification: product.model.trim() || 'Standard Spec',
      quantity: Math.max(1, Number(product.quantity) || 1),
      product_price: Math.max(0, Number(product.unitPrice) || 0),
    };

    if (productId && existingIds.has(productId)) {
      retainedIds.add(productId);
      const result = await supabase
        .from('application_products')
        .update(productValues)
        .eq('application_id', id)
        .eq('id', Number(productId));
      throwIfError(result.error, 'Gagal mengemas kini produk');
    } else {
      const result = await supabase.from('application_products').insert({
        application_id: id,
        ...productValues,
        stock_status: 'Pending Stock',
      });
      throwIfError(result.error, 'Gagal menambah produk baharu');
    }
  }

  for (const row of existingProducts ?? []) {
    const productId = String(row.id);
    if (!retainedIds.has(productId)) {
      const result = await supabase
        .from('application_products')
        .delete()
        .eq('application_id', id)
        .eq('id', Number(productId));
      throwIfError(result.error, 'Gagal membuang produk');
    }
  }

  const financingValues = {
    application_id: id,
    total_product_price: payload.products
      .filter((item) => item.productName.trim())
      .reduce((sum, item) => sum + Math.max(1, Number(item.quantity) || 1) * Math.max(0, Number(item.unitPrice) || 0), 0),
    deposit: payload.deposit,
    total_financing_amount: Math.max(0, payload.products
      .filter((item) => item.productName.trim())
      .reduce((sum, item) => sum + Math.max(1, Number(item.quantity) || 1) * Math.max(0, Number(item.unitPrice) || 0), 0) - payload.deposit),
    agreement_fee: payload.agreementFee,
    processing_fee: payload.processingFee,
    sst_amount: payload.sstAmount,
    stamp_duty: payload.stampDutyFee,
    actual_cash_payment: payload.actualCashPayment,
    installment_duration: payload.installmentDuration,
    monthly_installment: payload.monthlyInstallment,
    updated_at: new Date().toISOString(),
  };
  const financingRead = await supabase
    .from('application_financing')
    .select('application_id')
    .eq('application_id', id)
    .maybeSingle();
  throwIfError(financingRead.error, 'Gagal membaca maklumat pembiayaan');
  const financingWrite = financingRead.data
    ? await supabase.from('application_financing').update(financingValues).eq('application_id', id)
    : await supabase.from('application_financing').insert(financingValues);
  throwIfError(financingWrite.error, 'Gagal menyimpan maklumat pembiayaan');

  if (payload.taskStatus) {
    const status = payload.taskStatus;
    const taskWrite = await supabase.from('application_task_status').upsert({
      application_id: id,
      stock_status: status.stockStatus,
      customer_decision: status.customerDecision,
      collection_confirmation: status.collectionConfirmation,
      passed_stock: status.passedStock,
      agreement_received: status.agreementReceived,
      agreement_checking: status.agreementChecking,
      agreement_submission: status.agreementSubmission,
      agreement_claimed: status.agreementClaimed,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'application_id' });
    throwIfError(taskWrite.error, 'Gagal menyimpan status tugasan');
  }

  const agreementWrite = await supabase.from('application_agreements').upsert({
    application_id: id,
    checking_staff1: payload.checkingStaff1?.trim() || null,
    checking_staff2: payload.checkingStaff2?.trim() || null,
    invoice_number: payload.invoiceNumber?.trim() || null,
    checking_status: 'Not Received',
    checking_checklist: {
      signAndChopPages: false,
      customerSignatureComplete: false,
      invoiceDetails: false,
      cafDetails: false,
    },
    checking_remarks: '',
    dispatch_status: 'Not Ready',
    destination: 'JCL Credit',
    dispatch_remarks: '',
    jcl_receipt_status: 'Not Dispatched',
    jcl_remarks: '',
    claim_remarks: '',
    updated_at: new Date().toISOString(),
  }, { onConflict: 'application_id', ignoreDuplicates: false });
  throwIfError(agreementWrite.error, 'Gagal menyimpan maklumat agreement');

  const timelineWrite = await supabase.from('application_timeline').insert({
    application_id: id,
    activity_type: 'Application Updated',
    activity_title: 'Application Details Updated',
    activity_description: `Maklumat permohonan dikemas kini oleh ${staffName}.`,
    old_status: current.approval_status,
    new_status: payload.approvalStatus,
    performed_by_staff_id: staffId,
  });
  throwIfError(timelineWrite.error, 'Gagal merekodkan Activity Timeline');
}

/** Deletes only when the database RLS policy permits it; submitted batch records remain protected by FK restrictions. */
export async function deleteSupabaseApprovalApplication(applicationId: string): Promise<void> {
  const id = Number(applicationId);
  if (!Number.isSafeInteger(id) || id <= 0) throw new Error('ID permohonan tidak sah.');

  const { data, error } = await supabase
    .from('applications')
    .delete()
    .eq('id', id)
    .select('id')
    .maybeSingle();

  if (error) {
    if (error.message.includes('sale_submission_applications')) {
      throw new Error('Permohonan ini sudah dimasukkan ke Sale Submission. Rekod tidak boleh dipadam.');
    }
    throw new Error(`Gagal memadam permohonan: ${error.message}`);
  }
  if (!data) throw new Error('Tiada kebenaran untuk memadam rekod ini atau rekod tidak ditemui.');
}
