import type {
  ActivityEvent,
  ApprovalStatus,
  InstallmentApplication,
  ProductCategory,
  ProductItem,
  StockFollowUpState,
  TaskStatusState,
} from '../types/khallegacy';
import { supabase } from './supabase';

type DbRow = Record<string, unknown>;

const textValue = (value: unknown, fallback = ''): string =>
  value === null || value === undefined ? fallback : String(value);
const numberValue = (value: unknown, fallback = 0): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};
const objectValue = (value: unknown): DbRow =>
  value && typeof value === 'object' && !Array.isArray(value) ? value as DbRow : {};
function mapTaskStatus(row: DbRow | undefined): TaskStatusState {
  return {
    stockStatus: textValue(row?.stock_status, 'NOT YET CHECKING') as TaskStatusState['stockStatus'],
    customerDecision: textValue(row?.customer_decision, 'PENDING') as TaskStatusState['customerDecision'],
    collectionConfirmation: textValue(row?.collection_confirmation, 'PENDING') as TaskStatusState['collectionConfirmation'],
    passedStock: textValue(row?.passed_stock, 'NOT YET') as TaskStatusState['passedStock'],
    agreementReceived: textValue(row?.agreement_received, 'PENDING') as TaskStatusState['agreementReceived'],
    agreementChecking: textValue(row?.agreement_checking, 'PENDING') as TaskStatusState['agreementChecking'],
    agreementSubmission: textValue(row?.agreement_submission, 'PENDING') as TaskStatusState['agreementSubmission'],
    agreementClaimed: textValue(row?.agreement_claimed, 'PENDING') as TaskStatusState['agreementClaimed'],
  };
}

function mapActivityType(type: string, newStatus: string): ActivityEvent['actionType'] {
  if (type === 'Application Created') return 'Application Created';
  if (type === 'Stock Updated') return 'Stock Updated';
  if (type === 'Stock Passed') return 'Stock Passed';
  if (type === 'Agreement Received') return 'Agreement Received';
  if (type === 'Agreement Checking') {
    if (newStatus === 'Checking Passed') return 'Checking Passed';
    if (newStatus === 'Checking Failed') return 'Checking Failed';
    return 'Checking Started';
  }
  if (type === 'Agreement Claimed') return 'Agreement Claimed';
  if (type === 'Batch Delivered' || type === 'Tracking Updated') return 'Tracking Updated';
  if (type === 'Sale Submission Created') return 'Sale Submission Created';
  return 'Information Updated';
}

function mapApplication(
  row: DbRow,
  productsByApplication: Map<number, DbRow[]>,
  financingByApplication: Map<number, DbRow>,
  taskByApplication: Map<number, DbRow>,
  agreementByApplication: Map<number, DbRow>,
  timelineByApplication: Map<number, DbRow[]>,
  stockHistoryByApplication: Map<number, DbRow[]>,
  staffNames: Map<string, string>,
): InstallmentApplication {
  const id = numberValue(row.id);
  const taskRow = taskByApplication.get(id);
  const taskStatus = mapTaskStatus(taskRow);
  const productRows = productsByApplication.get(id) ?? [];
  const products: ProductItem[] = productRows.map((product) => ({
    id: textValue(product.id),
    productName: textValue(product.product_name, '—'),
    model: textValue(product.model, textValue(product.specification, 'Standard Spec')),
    quantity: numberValue(product.quantity, 1),
    productPrice: numberValue(product.product_price),
    stockStatus: textValue(product.stock_status, 'Pending Stock') as ProductItem['stockStatus'],
    datePassStock: product.date_pass_stock ? textValue(product.date_pass_stock) : null,
  }));
  const finance = financingByApplication.get(id) ?? {};
  const agreementRow = agreementByApplication.get(id) ?? {};
  const history = stockHistoryByApplication.get(id) ?? [];
  const timelineRows = timelineByApplication.get(id) ?? [];
  const timeline: ActivityEvent[] = timelineRows.map((event) => {
    const staffId = textValue(event.performed_by_staff_id);
    const activityType = textValue(event.activity_type);
    const newStatus = textValue(event.new_status);
    return {
      id: textValue(event.id),
      caseId: textValue(row.case_id),
      customerName: textValue(row.customer_name),
      actionType: mapActivityType(activityType, newStatus),
      description: textValue(event.activity_description, textValue(event.activity_title)),
      staffName: staffNames.get(staffId) ?? '—',
      timestamp: textValue(event.created_at),
    };
  });
  const approvalStatus = textValue(row.approval_status, 'Approved') as ApprovalStatus;
  const category = textValue(row.category, textValue(productRows[0]?.category, 'Apple')) as ProductCategory;
  const stockFollowUp: StockFollowUpState = {
    colour: '',
    stockStage: taskStatus.stockStatus,
    customerDecision: taskStatus.customerDecision === 'PENDING' ? 'PENDING DECISION' : taskStatus.customerDecision,
    collectionConfirmation: taskStatus.collectionConfirmation,
    remark: '',
    changes: history.map((entry) => ({
      id: textValue(entry.id),
      field: textValue(entry.field),
      before: textValue(entry.before_value),
      after: textValue(entry.after_value),
      timestamp: textValue(entry.changed_at),
      staffName: textValue(entry.staff_name, '—'),
    })),
  };
  const checklist = objectValue(agreementRow.checking_checklist);
  return {
    id: textValue(row.id),
    caseId: textValue(row.case_id),
    applicationDate: textValue(row.application_date),
    customerName: textValue(row.customer_name),
    icNumber: textValue(row.ic_number),
    phone: textValue(row.phone),
    address: textValue(row.address),
    ref1Id: textValue(row.ref1_id, '—'),
    bankName: textValue(row.bank_name),
    bankAccountNumber: textValue(row.bank_account_number),
    applicationRemarks: textValue(row.application_remarks),
    internalNotes: textValue(row.internal_notes),
    customerFromBranchId: textValue(row.customer_from_branch_id),
    pickupBranchId: row.pickup_branch_id ? textValue(row.pickup_branch_id) : null,
    staffInChargeId: textValue(row.staff_in_charge_id, textValue(row.created_by_staff_id)),
    approvalStatus,
    approvalDate: row.approval_date ? textValue(row.approval_date) : null,
    approvedBy: row.approved_by ? textValue(row.approved_by) : null,
    approvalRemarks: textValue(row.approval_remarks),
    category,
    products,
    financing: {
      totalProductPrice: numberValue(finance.total_product_price, products.reduce((sum, item) => sum + item.quantity * item.productPrice, 0)),
      deposit: numberValue(finance.deposit),
      financingAmount: numberValue(finance.total_financing_amount),
      agreementFee: numberValue(finance.agreement_fee),
      processingFee: numberValue(finance.processing_fee),
      sstAmount: numberValue(finance.sst_amount),
      stampDutyFee: numberValue(finance.stamp_duty),
      actualCashPayment: numberValue(finance.actual_cash_payment),
      installmentDuration: numberValue(finance.installment_duration, 24),
      monthlyInstallment: numberValue(finance.monthly_installment),
    },
    documents: [],
    agreement: {
      agreementNumber: agreementRow.agreement_number ? textValue(agreementRow.agreement_number) : null,
      receivedAt: agreementRow.received_at ? textValue(agreementRow.received_at) : null,
      receivedBy: agreementRow.received_by ? textValue(agreementRow.received_by) : null,
      checkingStatus: textValue(agreementRow.checking_status, 'Not Received') as InstallmentApplication['agreement']['checkingStatus'],
      checkedAt: agreementRow.checked_at ? textValue(agreementRow.checked_at) : null,
      checkedBy: agreementRow.checked_by ? textValue(agreementRow.checked_by) : null,
      checkingChecklist: {
        signAndChopPages: Boolean(checklist.signAndChopPages),
        customerSignatureComplete: Boolean(checklist.customerSignatureComplete),
        invoiceDetails: Boolean(checklist.invoiceDetails),
        cafDetails: Boolean(checklist.cafDetails),
      },
      checkingStaff1: textValue(agreementRow.checking_staff1),
      checkingStaff2: textValue(agreementRow.checking_staff2),
      invoiceNumber: textValue(agreementRow.invoice_number),
      checkingRemarks: textValue(agreementRow.checking_remarks),
      saleSubmissionId: agreementRow.sale_submission_id ? textValue(agreementRow.sale_submission_id) : null,
      saleSubmittedAt: agreementRow.sale_submitted_at ? textValue(agreementRow.sale_submitted_at) : null,
      dispatchStatus: textValue(agreementRow.dispatch_status, 'Not Ready') as InstallmentApplication['agreement']['dispatchStatus'],
      destination: 'JCL Credit',
      courierId: agreementRow.courier_id ? textValue(agreementRow.courier_id) : null,
      courierName: agreementRow.courier_name ? textValue(agreementRow.courier_name) : null,
      trackingNumber: agreementRow.tracking_number ? textValue(agreementRow.tracking_number) : null,
      dispatchDate: agreementRow.dispatch_date ? textValue(agreementRow.dispatch_date) : null,
      dispatchedBy: agreementRow.dispatched_by ? textValue(agreementRow.dispatched_by) : null,
      dispatchRemarks: textValue(agreementRow.dispatch_remarks),
      jclReceiptStatus: textValue(agreementRow.jcl_receipt_status, 'Not Dispatched') as InstallmentApplication['agreement']['jclReceiptStatus'],
      jclReceivedDate: agreementRow.jcl_received_date ? textValue(agreementRow.jcl_received_date) : null,
      jclConfirmedBy: agreementRow.jcl_confirmed_by ? textValue(agreementRow.jcl_confirmed_by) : null,
      jclRemarks: textValue(agreementRow.jcl_remarks),
      claimedDate: agreementRow.claimed_date ? textValue(agreementRow.claimed_date) : null,
      claimedBy: agreementRow.claimed_by ? textValue(agreementRow.claimed_by) : null,
      claimRemarks: textValue(agreementRow.claim_remarks),
    },
    stockFollowUp,
    taskStatus,
    timeline,
  };
}

/** Loads Approval List and CASE ID detail records from the Supabase UAT schema. */
export async function loadSupabaseApprovalApplications(): Promise<InstallmentApplication[]> {
  const queries = await Promise.all([
    supabase.from('applications').select('*').order('created_at', { ascending: false }),
    supabase.from('application_products').select('*').order('id'),
    supabase.from('application_financing').select('*'),
    supabase.from('application_task_status').select('*'),
    supabase.from('application_agreements').select('*'),
    supabase.from('application_timeline').select('*').order('created_at', { ascending: false }),
    supabase.from('application_stock_change_history').select('*').order('changed_at', { ascending: false }),
    supabase.from('staff_users').select('id,name'),
  ]);
  const errorResult = queries.find((result) => result.error);
  if (errorResult?.error) {
    throw new Error('Data Approval List daripada Supabase gagal dimuatkan. Sila semak akses jadual UAT.');
  }
  const [applications, products, financing, tasks, agreements, timeline, stockHistory, staff] = queries;
  const groupByApplication = (rows: DbRow[]): Map<number, DbRow[]> => {
    const grouped = new Map<number, DbRow[]>();
    rows.forEach((row) => {
      const key = numberValue(row.application_id);
      grouped.set(key, [...(grouped.get(key) ?? []), row]);
    });
    return grouped;
  };
  const oneByApplication = (rows: DbRow[]): Map<number, DbRow> =>
    new Map(rows.map((row) => [numberValue(row.application_id), row]));
  const staffNames = new Map<string, string>(
    ((staff.data ?? []) as DbRow[]).map((row) => [textValue(row.id), textValue(row.name)]),
  );
  return ((applications.data ?? []) as DbRow[]).map((row) =>
    mapApplication(
      row,
      groupByApplication((products.data ?? []) as DbRow[]),
      oneByApplication((financing.data ?? []) as DbRow[]),
      oneByApplication((tasks.data ?? []) as DbRow[]),
      oneByApplication((agreements.data ?? []) as DbRow[]),
      groupByApplication((timeline.data ?? []) as DbRow[]),
      groupByApplication((stockHistory.data ?? []) as DbRow[]),
      staffNames,
    ),
  );
}
