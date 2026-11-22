import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Download,
  FileText,
  Pencil,
  Plus,
  Save,
  Trash2,
  X,
  XCircle,
} from 'lucide-react';
import type {
  ApprovalStatus,
  Branch,
  InstallmentApplication,
  PostageTrackingRecord,
  ProductCategory,
  StaffUser,
  TaskStatusState,
} from '../types/khallegacy';
import {
  calculateFinancingSummary,
  deriveTaskStatus,
  formatDateShort,
  formatDateTime,
  formatRM,
  PRODUCT_CATEGORIES,
  resolveApplicationCategory,
  type UpdateApplicationDetailsPayload,
} from '../utils/businessRules';
import { resolveStatusTone, StatusBadge } from '../components/StatusBadge';
import { Modal } from '../components/Modal';

interface ApprovalDetailsPageProps {
  application: InstallmentApplication;
  existingCaseIds?: { id: string; caseId: string }[];
  branches: Branch[];
  users?: StaffUser[];
  postageTrackings?: PostageTrackingRecord[];
  currentUserName: string;
  onBack: () => void;
  onUpdateDetails: (appId: string, payload: UpdateApplicationDetailsPayload) => boolean | Promise<boolean>;
  onDeleteApplication: (appId: string) => void | Promise<void>;
  canDelete?: boolean;
  onDownloadCoverPage: (app: InstallmentApplication) => void;
  readOnly?: boolean;
}

interface EditableProductRow {
  id: string;
  productName: string;
  model: string;
  quantity: number;
  unitPrice: string;
}

export const ApprovalDetailsPage: React.FC<ApprovalDetailsPageProps> = ({
  application,
  existingCaseIds = [],
  branches,
  users = [],
  postageTrackings = [],
  onBack,
  onUpdateDetails,
  onDeleteApplication,
  onDownloadCoverPage,
  readOnly = false,
  canDelete = true,
}) => {
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  // Edit mode state
  const [isEditing, setIsEditing] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const [caseIdInput, setCaseIdInput] = useState(application.caseId);
  const [ref1Input, setRef1Input] = useState(application.ref1Id === '—' ? '' : application.ref1Id);
  const [customerNameInput, setCustomerNameInput] = useState(application.customerName);
  const [icInput, setIcInput] = useState(application.icNumber);
  const [phoneInput, setPhoneInput] = useState(application.phone);
  const [appDateInput, setAppDateInput] = useState(application.applicationDate);
  const [fromBranchInput, setFromBranchInput] = useState(application.customerFromBranchId);
  const [pickupBranchInput, setPickupBranchInput] = useState(application.pickupBranchId || '');
  const [bankNameInput, setBankNameInput] = useState(application.bankName || '');
  const [bankAccountInput, setBankAccountInput] = useState(application.bankAccountNumber || '');
  const [appRemarksInput, setAppRemarksInput] = useState(application.applicationRemarks || '');

  const [approvalStatusInput, setApprovalStatusInput] = useState<ApprovalStatus>(
    application.approvalStatus,
  );
  const [staffInChargeInput, setStaffInChargeInput] = useState(application.staffInChargeId);
  const [approvalDateInput, setApprovalDateInput] = useState(application.approvalDate || '');
  const [internalNotesInput, setInternalNotesInput] = useState(application.internalNotes || '');

  const [categoryInput, setCategoryInput] = useState<ProductCategory>(
    resolveApplicationCategory(application),
  );
  const [productRows, setProductRows] = useState<EditableProductRow[]>(() =>
    application.products.map((p) => ({
      id: p.id,
      productName: p.productName,
      model: p.model,
      quantity: p.quantity,
      unitPrice: String(p.productPrice),
    })),
  );

  const [depositStr, setDepositStr] = useState(String(application.financing.deposit));
  const [agreementFeeStr, setAgreementFeeStr] = useState(
    String(application.financing.agreementFee),
  );
  const [processingFeeStr, setProcessingFeeStr] = useState(
    String(application.financing.processingFee),
  );
  const [sstAmountStr, setSstAmountStr] = useState(String(application.financing.sstAmount));
  const [stampDutyEdited, setStampDutyEdited] = useState(false);
  const [stampDutyManualStr, setStampDutyManualStr] = useState(
    String(application.financing.stampDutyFee),
  );
  const [durationStr, setDurationStr] = useState(
    String(application.financing.installmentDuration),
  );
  const [monthlyEdited, setMonthlyEdited] = useState(false);
  const [monthlyManualStr, setMonthlyManualStr] = useState(
    String(application.financing.monthlyInstallment),
  );
  const [taskStatusInput, setTaskStatusInput] = useState<TaskStatusState>(() =>
    deriveTaskStatus(application, postageTrackings),
  );
  const [checkingStaff1Input, setCheckingStaff1Input] = useState(
    application.agreement.checkingStaff1 || '',
  );
  const [checkingStaff2Input, setCheckingStaff2Input] = useState(
    application.agreement.checkingStaff2 || '',
  );
  const [invoiceNumberInput, setInvoiceNumberInput] = useState(
    application.agreement.invoiceNumber || '',
  );

  const syncFormFromApplication = (app: InstallmentApplication) => {
    setCaseIdInput(app.caseId);
    setRef1Input(app.ref1Id === '—' ? '' : app.ref1Id);
    setCustomerNameInput(app.customerName);
    setIcInput(app.icNumber);
    setPhoneInput(app.phone);
    setAppDateInput(app.applicationDate);
    setFromBranchInput(app.customerFromBranchId);
    setPickupBranchInput(app.pickupBranchId || '');
    setBankNameInput(app.bankName || '');
    setBankAccountInput(app.bankAccountNumber || '');
    setAppRemarksInput(app.applicationRemarks || '');
    setApprovalStatusInput(app.approvalStatus);
    setStaffInChargeInput(app.staffInChargeId);
    setApprovalDateInput(app.approvalDate || '');
    setInternalNotesInput(app.internalNotes || '');
    setCategoryInput(resolveApplicationCategory(app));
    setProductRows(
      app.products.map((p) => ({
        id: p.id,
        productName: p.productName,
        model: p.model,
        quantity: p.quantity,
        unitPrice: String(p.productPrice),
      })),
    );
    setDepositStr(String(app.financing.deposit));
    setAgreementFeeStr(String(app.financing.agreementFee));
    setProcessingFeeStr(String(app.financing.processingFee));
    setSstAmountStr(String(app.financing.sstAmount));
    setStampDutyEdited(true);
    setStampDutyManualStr(String(app.financing.stampDutyFee));
    setDurationStr(String(app.financing.installmentDuration));
    setMonthlyEdited(true);
    setMonthlyManualStr(String(app.financing.monthlyInstallment));
    setTaskStatusInput(deriveTaskStatus(app, postageTrackings));
    setCheckingStaff1Input(app.agreement.checkingStaff1 || '');
    setCheckingStaff2Input(app.agreement.checkingStaff2 || '');
    setInvoiceNumberInput(app.agreement.invoiceNumber || '');
    setEditError(null);
  };

  useEffect(() => {
    setIsEditing(false);
    setDeleteConfirmOpen(false);
    syncFormFromApplication(application);
  }, [application.id]);

  const branchName = (id: string | null) => {
    if (!id) return 'Belum Ditentukan';
    if (id === 'POSTAGE') return 'POSTAGE';
    if (id === 'WEB') return 'WEB';
    return branches.find((b) => b.id === id)?.name ?? id;
  };

  const duplicateCaseId = useMemo(() => {
    const trimmed = caseIdInput.trim().toLowerCase();
    if (!trimmed) return false;
    return existingCaseIds.some(
      (item) => item.id !== application.id && item.caseId.trim().toLowerCase() === trimmed,
    );
  }, [caseIdInput, existingCaseIds, application.id]);

  const liveFinancing = useMemo(() => {
    const duration = Math.max(1, Math.round(Number(durationStr) || 24));
    const calc = calculateFinancingSummary({
      products: productRows.map((p) => ({
        quantity: Number(p.quantity) || 0,
        unitPrice: Number(p.unitPrice) || 0,
      })),
      deposit: Number(depositStr) || 0,
      agreementFee: Number(agreementFeeStr) || 0,
      processingFee: Number(processingFeeStr) || 0,
      sstAmount: Number(sstAmountStr) || 0,
      stampDutyOverride: stampDutyEdited ? Number(stampDutyManualStr) || 0 : null,
      installmentDuration: duration,
    });
    return {
      ...calc,
      monthlyInstallment: monthlyEdited
        ? Math.max(0, Number(monthlyManualStr) || 0)
        : calc.monthlyInstallment,
    };
  }, [
    productRows,
    depositStr,
    agreementFeeStr,
    processingFeeStr,
    sstAmountStr,
    stampDutyEdited,
    stampDutyManualStr,
    durationStr,
    monthlyEdited,
    monthlyManualStr,
  ]);

  const taskStatus = useMemo(
    () => deriveTaskStatus(application, postageTrackings),
    [application, postageTrackings],
  );
  const category = resolveApplicationCategory(application);
  const totalProductUnits = (isEditing ? productRows : application.products).reduce(
    (sum, p) => sum + (Number(p.quantity) || 0),
    0,
  );
  const enteredByName =
    users.find((u) => u.id === application.staffInChargeId)?.name ??
    application.timeline[application.timeline.length - 1]?.staffName ??
    '—';
  const actualCashPayment = Math.max(
    0,
    Number((
      application.financing.financingAmount -
      application.financing.processingFee -
      application.financing.sstAmount -
      application.financing.stampDutyFee
    ).toFixed(2)),
  );

  const handleStartEdit = () => {
    syncFormFromApplication(application);
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    syncFormFromApplication(application);
    setIsEditing(false);
  };

  const handleAddProductRow = () => {
    setProductRows((prev) => [
      ...prev,
      {
        id: `prd-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
        productName: '',
        model: '',
        quantity: 1,
        unitPrice: '',
      },
    ]);
  };

  const handleRemoveProductRow = (rowId: string) => {
    if (productRows.length <= 1) {
      setEditError('At least one product row is required.');
      return;
    }
    setEditError(null);
    setProductRows((prev) => prev.filter((p) => p.id !== rowId));
  };

  const handleSaveEdit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setEditError(null);

    if (!caseIdInput.trim()) {
      setEditError('CASE ID is required.');
      return;
    }
    if (duplicateCaseId) {
      setEditError(`CASE ID "${caseIdInput.trim()}" already exists. Each CASE ID must be unique.`);
      return;
    }
    if (!customerNameInput.trim() || !icInput.trim() || !phoneInput.trim() || !fromBranchInput) {
      setEditError('Please complete Customer Name, IC Number, Phone Number, and Original Branch.');
      return;
    }
    const validProducts = productRows.filter((p) => p.productName.trim().length > 0);
    if (validProducts.length === 0) {
      setEditError('Please enter at least one product name.');
      return;
    }
    if (liveFinancing.totalProductPrice <= 0) {
      setEditError('Total Product Price must be greater than RM 0.00.');
      return;
    }
    if (liveFinancing.deposit > liveFinancing.totalProductPrice) {
      setEditError('Deposit cannot exceed Total Product Price.');
      return;
    }

    const ok = await onUpdateDetails(application.id, {
      caseId: caseIdInput.trim(),
      customerName: customerNameInput.trim(),
      icNumber: icInput.trim(),
      phone: phoneInput.trim(),
      ref1Id: ref1Input.trim(),
      applicationDate: appDateInput,
      customerFromBranchId: fromBranchInput,
      pickupBranchId: pickupBranchInput || null,
      bankName: bankNameInput.trim(),
      bankAccountNumber: bankAccountInput.trim(),
      applicationRemarks: appRemarksInput.trim(),
      approvalStatus: approvalStatusInput,
      approvalDate: approvalDateInput.trim() || null,
      staffInChargeId: staffInChargeInput,
      internalNotes: internalNotesInput.trim(),
      category: categoryInput,
      products: validProducts.map((p) => ({
        id: p.id,
        productName: p.productName.trim(),
        model: p.model.trim() || 'Standard Spec',
        quantity: Math.max(1, Number(p.quantity) || 1),
        unitPrice: Math.max(0, Number(p.unitPrice) || 0),
      })),
      deposit: liveFinancing.deposit,
      agreementFee: liveFinancing.agreementFee,
      processingFee: liveFinancing.processingFee,
      sstAmount: liveFinancing.sstAmount,
      stampDutyFee: liveFinancing.stampDutyFee,
      actualCashPayment: liveFinancing.actualCashPayment,
      installmentDuration: liveFinancing.installmentDuration,
      monthlyInstallment: liveFinancing.monthlyInstallment,
      taskStatus: taskStatusInput,
      checkingStaff1: checkingStaff1Input.trim(),
      checkingStaff2: checkingStaff2Input.trim(),
      invoiceNumber: invoiceNumberInput.trim(),
    });

    if (ok) {
      setIsEditing(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Top Action Strip */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white border border-slate-200 rounded-xl px-4 py-3">
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to Last Page
          </button>
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono-tabular text-sm font-semibold text-slate-900">
              {application.caseId}
            </span>
            <StatusBadge status={application.approvalStatus} />
            <StatusBadge status={category} compact />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {!readOnly && isEditing ? (
            <>
              <button
                key="btn-cancel-edit"
                type="button"
                onClick={handleCancelEdit}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors"
              >
                <X className="w-3.5 h-3.5" />
                Cancel
              </button>
              <button
                key="btn-save-edit"
                type="button"
                onClick={() => handleSaveEdit()}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
              >
                <Save className="w-3.5 h-3.5" />
                Save Changes
              </button>
            </>
          ) : !readOnly ? (
            <>
              <button
                key="btn-start-edit"
                type="button"
                onClick={handleStartEdit}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
              >
                <Pencil className="w-3.5 h-3.5" />
                EDIT
              </button>
              {canDelete && <button
                key="btn-delete"
                type="button"
                onClick={() => setDeleteConfirmOpen(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                DELETE
              </button>}
            </>
          ) : null}
        </div>
      </div>

      <form onSubmit={handleSaveEdit} noValidate className="space-y-5">

        {isEditing && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-blue-900">
            <span>
              <strong>Edit Mode Active:</strong> Update any fields below and click{' '}
              <strong>Save Changes</strong>. All modified details will be recorded in the Activity
              Timeline.
            </span>
          </div>
        )}

        {editError && (
          <div
            role="alert"
            className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-center gap-2.5 text-xs text-red-800"
          >
            <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{editError}</span>
          </div>
        )}

        {/* Section A + (Section D & Section E stacked) Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* Section A – Customer Information (Address removed) */}
          <section className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-5">
            <h2 className="text-sm font-semibold text-slate-900 pb-3 border-b border-slate-100">
              Section A — Customer Information
            </h2>

            {isEditing ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4 text-xs">
                <div>
                  <label htmlFor="edit-case-id" className="block text-slate-600 font-medium mb-1">
                    CASE ID <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="edit-case-id"
                    type="text"
                    value={caseIdInput}
                    onChange={(e) => setCaseIdInput(e.target.value)}
                    className={`w-full px-3 py-1.5 text-xs font-mono-tabular border rounded-lg bg-white text-slate-900 focus:outline-none ${
                      duplicateCaseId
                        ? 'border-red-400 focus:border-red-500'
                        : 'border-slate-200 focus:border-blue-500'
                    }`}
                  />
                  {duplicateCaseId && (
                    <p className="text-[11px] text-red-600 mt-1">CASE ID already exists.</p>
                  )}
                </div>

                <div>
                  <label htmlFor="edit-ref1" className="block text-slate-600 font-medium mb-1">
                    REF1 ID
                  </label>
                  <input
                    id="edit-ref1"
                    type="text"
                    value={ref1Input}
                    onChange={(e) => setRef1Input(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs font-mono-tabular border border-slate-200 rounded-lg bg-white text-slate-900 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label htmlFor="edit-name" className="block text-slate-600 font-medium mb-1">
                    Customer Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="edit-name"
                    type="text"
                    value={customerNameInput}
                    onChange={(e) => setCustomerNameInput(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg bg-white text-slate-900 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label htmlFor="edit-ic" className="block text-slate-600 font-medium mb-1">
                    IC Number <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="edit-ic"
                    type="text"
                    value={icInput}
                    onChange={(e) => setIcInput(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs font-mono-tabular border border-slate-200 rounded-lg bg-white text-slate-900 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label htmlFor="edit-phone" className="block text-slate-600 font-medium mb-1">
                    Phone Number <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="edit-phone"
                    type="text"
                    value={phoneInput}
                    onChange={(e) => setPhoneInput(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs font-mono-tabular border border-slate-200 rounded-lg bg-white text-slate-900 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label htmlFor="edit-app-date" className="block text-slate-600 font-medium mb-1">
                    Application Date
                  </label>
                  <input
                    id="edit-app-date"
                    type="date"
                    value={appDateInput}
                    onChange={(e) => setAppDateInput(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs tabular-nums border border-slate-200 rounded-lg bg-white text-slate-900 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label htmlFor="edit-from-branch" className="block text-slate-600 font-medium mb-1">
                    Original Branch (customer_from_branch)
                  </label>
                  <select
                    id="edit-from-branch"
                    value={fromBranchInput}
                    onChange={(e) => setFromBranchInput(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg bg-white text-slate-900 focus:outline-none focus:border-blue-500"
                  >
                    {branches
                      .filter(
                        (b) =>
                          (b.code !== 'POS' && b.name.toUpperCase() !== 'POSTAGE') ||
                          fromBranchInput === b.id,
                      )
                      .map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name}
                        </option>
                      ))}
                    {(fromBranchInput === 'WEB' ||
                      !branches.some((b) => b.code === 'WEB' || b.id === 'WEB')) && (
                      <option value="WEB">WEB</option>
                    )}
                  </select>
                </div>

                <div>
                  <label htmlFor="edit-pickup-branch" className="block text-slate-600 font-medium mb-1">
                    Pickup Branch (pickup_branch)
                  </label>
                  <select
                    id="edit-pickup-branch"
                    value={pickupBranchInput}
                    onChange={(e) => setPickupBranchInput(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg bg-white text-slate-900 focus:outline-none focus:border-blue-500"
                  >
                    <option value="">Belum Ditentukan</option>
                    {branches
                      .filter(
                        (b) =>
                          (b.code !== 'WEB' &&
                            b.name.toUpperCase() !== 'WEBSITE' &&
                            b.name.toUpperCase() !== 'WEB') ||
                          pickupBranchInput === b.id,
                      )
                      .map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name}
                        </option>
                      ))}
                    {(pickupBranchInput === 'POSTAGE' ||
                      !branches.some(
                        (b) => b.code === 'POS' || b.name.toUpperCase() === 'POSTAGE',
                      )) && <option value="POSTAGE">POSTAGE</option>}
                  </select>
                </div>

                <div>
                  <label htmlFor="edit-bank-name" className="block text-slate-600 font-medium mb-1">
                    Bank Name (Nama Bank)
                  </label>
                  <input
                    id="edit-bank-name"
                    type="text"
                    value={bankNameInput}
                    onChange={(e) => setBankNameInput(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg bg-white text-slate-900 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label htmlFor="edit-bank-acc" className="block text-slate-600 font-medium mb-1">
                    Bank Account No. (No Akaun Bank)
                  </label>
                  <input
                    id="edit-bank-acc"
                    type="text"
                    value={bankAccountInput}
                    onChange={(e) => setBankAccountInput(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs font-mono-tabular border border-slate-200 rounded-lg bg-white text-slate-900 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label htmlFor="edit-app-remarks" className="block text-slate-600 font-medium mb-1">
                    Application Remarks
                  </label>
                  <textarea
                    id="edit-app-remarks"
                    rows={2}
                    value={appRemarksInput}
                    onChange={(e) => setAppRemarksInput(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg bg-white text-slate-900 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>
            ) : (
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 mt-4 text-xs">
                <div>
                  <dt className="text-slate-500">CASE ID</dt>
                  <dd className="font-mono-tabular font-semibold text-slate-900 mt-0.5">
                    {application.caseId}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">REF1 ID</dt>
                  <dd className="font-mono-tabular font-medium text-slate-900 mt-0.5">
                    {application.ref1Id}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">Customer Name</dt>
                  <dd className="font-semibold text-slate-900 mt-0.5">{application.customerName}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">IC Number</dt>
                  <dd className="font-mono-tabular font-medium text-slate-900 mt-0.5">
                    {application.icNumber}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">Phone Number</dt>
                  <dd className="font-mono-tabular font-medium text-slate-900 mt-0.5">
                    {application.phone}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">Application Date</dt>
                  <dd className="tabular-nums font-medium text-slate-900 mt-0.5">
                    {formatDateShort(application.applicationDate)}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">Original Branch (customer_from_branch)</dt>
                  <dd className="font-medium text-slate-900 mt-0.5">
                    {branchName(application.customerFromBranchId)}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">Pickup Branch (pickup_branch)</dt>
                  <dd className="font-medium text-slate-900 mt-0.5">
                    {branchName(application.pickupBranchId)}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">Bank Name (Nama Bank)</dt>
                  <dd className="font-medium text-slate-900 mt-0.5">
                    {application.bankName || '—'}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">Bank Account No. (No Akaun Bank)</dt>
                  <dd className="font-mono-tabular font-medium text-slate-900 mt-0.5">
                    {application.bankAccountNumber || '—'}
                  </dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-slate-500">Application Remarks</dt>
                  <dd className="font-medium text-slate-900 mt-0.5 leading-relaxed whitespace-pre-wrap">
                    {application.applicationRemarks || '—'}
                  </dd>
                </div>
              </dl>
            )}
          </section>

          {/* Right Column: Section D + Section E below Section D */}
          <div className="lg:col-span-5 space-y-5">
            {/* Section D – Approval & Collection Information */}
            <section className="bg-white border border-slate-200 rounded-xl p-5">
              <h2 className="text-sm font-semibold text-slate-900 pb-3 border-b border-slate-100">
                Section D — Approval &amp; Collection Information
              </h2>

              {isEditing ? (
                <div className="space-y-3.5 mt-4 text-xs">
                  <div>
                    <label
                      htmlFor="edit-approval-status"
                      className="block text-slate-600 font-medium mb-1"
                    >
                      Current Approval Status
                    </label>
                    <select
                      id="edit-approval-status"
                      value={approvalStatusInput}
                      onChange={(e) => setApprovalStatusInput(e.target.value as ApprovalStatus)}
                      className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg bg-white text-slate-900 focus:outline-none focus:border-blue-500"
                    >
                      <option value="Pending">Pending</option>
                      <option value="Approved">Approved</option>
                      <option value="Rejected">Rejected</option>
                    </select>
                  </div>

                  <div>
                    <label
                      htmlFor="edit-entered-by"
                      className="block text-slate-600 font-medium mb-1"
                    >
                      Entered By
                    </label>
                    <select
                      id="edit-entered-by"
                      value={staffInChargeInput}
                      onChange={(e) => setStaffInChargeInput(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg bg-white text-slate-900 focus:outline-none focus:border-blue-500"
                    >
                      {users.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label
                      htmlFor="edit-approval-date"
                      className="block text-slate-600 font-medium mb-1"
                    >
                      Approval Date
                    </label>
                    <input
                      id="edit-approval-date"
                      type="date"
                      value={approvalDateInput}
                      onChange={(e) => setApprovalDateInput(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs tabular-nums border border-slate-200 rounded-lg bg-white text-slate-900 focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="edit-internal-notes"
                      className="block text-slate-600 font-medium mb-1"
                    >
                      Internal Notes
                    </label>
                    <textarea
                      id="edit-internal-notes"
                      rows={3}
                      value={internalNotesInput}
                      onChange={(e) => setInternalNotesInput(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg bg-white text-slate-900 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>
              ) : (
                <dl className="space-y-3.5 mt-4 text-xs">
                  <div className="flex items-center justify-between">
                    <dt className="text-slate-500">Current Approval Status</dt>
                    <dd>
                      <StatusBadge status={application.approvalStatus} />
                    </dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt className="text-slate-500">Entered By</dt>
                    <dd className="font-medium text-slate-900">{enteredByName}</dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt className="text-slate-500">Approval Date</dt>
                    <dd className="tabular-nums font-medium text-slate-900">
                      {formatDateShort(application.approvalDate)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-500 mb-1">Internal Notes</dt>
                    <dd className="p-3 bg-slate-50 border border-slate-200/80 rounded-lg text-slate-700 leading-relaxed whitespace-pre-wrap">
                      {application.internalNotes || 'No internal notes recorded.'}
                    </dd>
                  </div>
                </dl>
              )}
            </section>

            {/* Section E – Cover Page (below Section D) */}
            <section className="bg-white border border-slate-200 rounded-xl p-5">
              <h2 className="text-sm font-semibold text-slate-900 pb-3 border-b border-slate-100">
                Section E — Cover Page
              </h2>
              <div className="mt-3 flex items-center justify-between gap-3 py-3 px-3.5 bg-slate-50 border border-slate-200/80 rounded-lg text-xs">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-lg bg-red-50 border border-red-200/80 text-red-600 flex items-center justify-center shrink-0">
                    <FileText className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-900 truncate">COVER PAGE.pdf</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {application.caseId} · Application Cover Summary (PDF)
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onDownloadCoverPage(application)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100 transition-colors shrink-0"
                >
                  <Download className="w-3.5 h-3.5" />
                  Download
                </button>
              </div>
            </section>
          </div>
        </div>

        {/* Section B – Product Information (STOCK STATUS & DATE PASS STOCK removed) */}
        <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">
                Section B — Product Information
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Product specifications, quantities, and subtotal pricing for this CASE ID.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 shrink-0 text-xs">
              {isEditing ? (
                <>
                  <label htmlFor="edit-category" className="text-slate-600 font-medium">
                    Category:
                  </label>
                  <select
                    id="edit-category"
                    value={categoryInput}
                    onChange={(e) => setCategoryInput(e.target.value as ProductCategory)}
                    className="px-2.5 py-1 text-xs border border-slate-200 rounded-md bg-white text-slate-900 focus:outline-none focus:border-blue-500"
                  >
                    {PRODUCT_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={handleAddProductRow}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add Product
                  </button>
                </>
              ) : (
                <StatusBadge status={category} compact />
              )}
              <span className="px-2.5 py-1 bg-slate-100 border border-slate-200 rounded-md font-medium text-slate-700 tabular-nums">
                Total Products: {totalProductUnits} unit
              </span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4">Product Name</th>
                  <th className="py-3 px-4">Spec / Colour (Model)</th>
                  <th className="py-3 px-4 text-right">Quantity</th>
                  <th className="py-3 px-4 text-right">Unit Price (RM)</th>
                  <th className="py-3 px-4 text-right">Subtotal</th>
                  {isEditing && <th className="py-3 px-3 text-center w-12"></th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {isEditing
                  ? productRows.map((row, idx) => {
                      const rowSubtotal =
                        (Number(row.quantity) || 0) * (Number(row.unitPrice) || 0);
                      return (
                        <tr key={row.id} className="align-middle">
                          <td className="py-2.5 px-4">
                            <input
                              type="text"
                              aria-label={`Edit product name ${idx + 1}`}
                              value={row.productName}
                              onChange={(e) => {
                                const val = e.target.value;
                                setProductRows((prev) =>
                                  prev.map((p) => (p.id === row.id ? { ...p, productName: val } : p)),
                                );
                              }}
                              className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-md bg-white text-slate-900 focus:outline-none focus:border-blue-500"
                            />
                          </td>
                          <td className="py-2.5 px-4">
                            <input
                              type="text"
                              aria-label={`Edit product model ${idx + 1}`}
                              value={row.model}
                              onChange={(e) => {
                                const val = e.target.value;
                                setProductRows((prev) =>
                                  prev.map((p) => (p.id === row.id ? { ...p, model: val } : p)),
                                );
                              }}
                              className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-md bg-white text-slate-900 focus:outline-none focus:border-blue-500"
                            />
                          </td>
                          <td className="py-2.5 px-4">
                            <input
                              type="number"
                              min={1}
                              aria-label={`Edit product quantity ${idx + 1}`}
                              value={row.quantity}
                              onChange={(e) => {
                                const val = Math.max(1, Number(e.target.value) || 1);
                                setProductRows((prev) =>
                                  prev.map((p) => (p.id === row.id ? { ...p, quantity: val } : p)),
                                );
                              }}
                              className="w-24 ml-auto block text-right px-2.5 py-1.5 text-xs tabular-nums border border-slate-200 rounded-md bg-white text-slate-900 focus:outline-none focus:border-blue-500"
                            />
                          </td>
                          <td className="py-2.5 px-4">
                            <input
                              type="number"
                              min={0}
                              step="0.01"
                              aria-label={`Edit product unit price ${idx + 1}`}
                              value={row.unitPrice}
                              onChange={(e) => {
                                const val = e.target.value;
                                setProductRows((prev) =>
                                  prev.map((p) => (p.id === row.id ? { ...p, unitPrice: val } : p)),
                                );
                              }}
                              className="w-32 ml-auto block text-right px-2.5 py-1.5 text-xs font-mono-tabular border border-slate-200 rounded-md bg-white text-slate-900 focus:outline-none focus:border-blue-500"
                            />
                          </td>
                          <td className="py-2.5 px-4 text-right font-mono-tabular font-semibold text-slate-900 whitespace-nowrap">
                            {formatRM(rowSubtotal)}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <button
                              type="button"
                              onClick={() => handleRemoveProductRow(row.id)}
                              aria-label={`Remove product ${idx + 1}`}
                              className="p-1.5 text-red-600 hover:bg-red-50 rounded-md transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  : application.products.map((prod) => (
                      <tr key={prod.id} className="hover:bg-slate-50/70">
                        <td className="py-3 px-4 font-medium text-slate-900">{prod.productName}</td>
                        <td className="py-3 px-4 text-slate-600">{prod.model}</td>
                        <td className="py-3 px-4 text-right tabular-nums font-medium text-slate-900">
                          {prod.quantity}
                        </td>
                        <td className="py-3 px-4 text-right font-mono-tabular font-medium text-slate-900">
                          {formatRM(prod.productPrice)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono-tabular font-semibold text-slate-900">
                          {formatRM(
                            (Number(prod.quantity) || 0) * (Number(prod.productPrice) || 0),
                          )}
                        </td>
                      </tr>
                    ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Section C – Financing Information */}
        <section className="bg-white border border-slate-200 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-slate-900 pb-3 border-b border-slate-100">
            Section C — Financing Information
          </h2>

          {isEditing ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mt-4 text-xs">
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200/70">
                <div className="text-slate-500">Total Product Price</div>
                <div className="font-mono-tabular text-sm font-semibold text-slate-900 mt-1">
                  {formatRM(liveFinancing.totalProductPrice)}
                </div>
              </div>

              <div className="p-3 bg-white rounded-lg border border-slate-200">
                <label htmlFor="edit-deposit" className="block text-slate-500 mb-1">
                  Deposit (RM)
                </label>
                <input
                  id="edit-deposit"
                  type="number"
                  min={0}
                  step="0.01"
                  value={depositStr}
                  onChange={(e) => setDepositStr(e.target.value)}
                  className="w-full px-2 py-1 text-xs font-mono-tabular border border-slate-200 rounded bg-white text-slate-900 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="p-3 bg-blue-50/70 rounded-lg border border-blue-200/80">
                <div className="text-blue-700">Financing Amount</div>
                <div className="font-mono-tabular text-sm font-semibold text-blue-900 mt-1">
                  {formatRM(liveFinancing.financingAmount)}
                </div>
              </div>

              <div className="p-3 bg-white rounded-lg border border-slate-200">
                <label htmlFor="edit-agreement-fee" className="block text-slate-500 mb-1">
                  Agreement Fee (RM)
                </label>
                <input
                  id="edit-agreement-fee"
                  type="number"
                  min={0}
                  step="0.01"
                  value={agreementFeeStr}
                  onChange={(e) => setAgreementFeeStr(e.target.value)}
                  className="w-full px-2 py-1 text-xs font-mono-tabular border border-slate-200 rounded bg-white text-slate-900 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="p-3 bg-white rounded-lg border border-slate-200">
                <label htmlFor="edit-processing-fee" className="block text-slate-500 mb-1">
                  Processing Fee (RM)
                </label>
                <input
                  id="edit-processing-fee"
                  type="number"
                  min={0}
                  step="0.01"
                  value={processingFeeStr}
                  onChange={(e) => setProcessingFeeStr(e.target.value)}
                  className="w-full px-2 py-1 text-xs font-mono-tabular border border-slate-200 rounded bg-white text-slate-900 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="p-3 bg-white rounded-lg border border-slate-200">
                <label htmlFor="edit-sst-amount" className="block text-slate-500 mb-1">
                  SST Amount (RM)
                </label>
                <input
                  id="edit-sst-amount"
                  type="number"
                  min={0}
                  step="0.01"
                  value={sstAmountStr}
                  onChange={(e) => setSstAmountStr(e.target.value)}
                  className="w-full px-2 py-1 text-xs font-mono-tabular border border-slate-200 rounded bg-white text-slate-900 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="p-3 bg-white rounded-lg border border-slate-200">
                <div className="flex items-center justify-between mb-1">
                  <label htmlFor="edit-stamp-duty" className="text-slate-500">
                    Stamp Duty (RM)
                  </label>
                  {stampDutyEdited && (
                    <button
                      type="button"
                      onClick={() => setStampDutyEdited(false)}
                      className="text-[10.5px] text-blue-600 hover:underline"
                    >
                      Auto
                    </button>
                  )}
                </div>
                <input
                  id="edit-stamp-duty"
                  type="number"
                  min={0}
                  step="0.01"
                  value={
                    stampDutyEdited ? stampDutyManualStr : liveFinancing.stampDutyFee.toFixed(2)
                  }
                  onChange={(e) => {
                    setStampDutyEdited(true);
                    setStampDutyManualStr(e.target.value);
                  }}
                  className="w-full px-2 py-1 text-xs font-mono-tabular border border-slate-200 rounded bg-white text-slate-900 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="p-3 bg-white rounded-lg border border-slate-200">
                <label htmlFor="edit-duration" className="block text-slate-500 mb-1">
                  Duration (Months)
                </label>
                <input
                  id="edit-duration"
                  type="number"
                  min={1}
                  value={durationStr}
                  onChange={(e) => setDurationStr(e.target.value)}
                  className="w-full px-2 py-1 text-xs tabular-nums border border-slate-200 rounded bg-white text-slate-900 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="p-3 bg-emerald-50/70 rounded-lg border border-emerald-200/80">
                <label htmlFor="edit-actual-cash" className="block text-emerald-700 mb-1">
                  Actual Cash Payment (RM)
                </label>
                <input
                  id="edit-actual-cash"
                  type="number"
                  value={liveFinancing.actualCashPayment.toFixed(2)}
                  readOnly
                  aria-readonly="true"
                  className="w-full px-2 py-1 text-xs font-mono-tabular font-semibold border border-emerald-200 rounded bg-emerald-50 text-emerald-900"
                />
                <p className="mt-1 text-[10px] text-emerald-700">Auto formula; tidak boleh diedit manual.</p>
              </div>

              <div className="p-3 bg-emerald-50/70 rounded-lg border border-emerald-200/80">
                <div className="flex items-center justify-between mb-1">
                  <label htmlFor="edit-monthly" className="text-emerald-700">
                    Monthly (RM)
                  </label>
                  {monthlyEdited && (
                    <button
                      type="button"
                      onClick={() => setMonthlyEdited(false)}
                      className="text-[10.5px] text-blue-600 hover:underline"
                    >
                      Auto
                    </button>
                  )}
                </div>
                <input
                  id="edit-monthly"
                  type="number"
                  min={0}
                  step="0.01"
                  value={
                    monthlyEdited
                      ? monthlyManualStr
                      : liveFinancing.monthlyInstallment.toFixed(2)
                  }
                  onChange={(e) => {
                    setMonthlyEdited(true);
                    setMonthlyManualStr(e.target.value);
                  }}
                  className="w-full px-2 py-1 text-xs font-mono-tabular font-semibold border border-emerald-200 rounded bg-white text-emerald-900 focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mt-4 text-xs">
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200/70">
                <div className="text-slate-500">Total Product Price</div>
                <div className="font-mono-tabular text-sm font-semibold text-slate-900 mt-1">
                  {formatRM(application.financing.totalProductPrice)}
                </div>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200/70">
                <div className="text-slate-500">Deposit</div>
                <div className="font-mono-tabular text-sm font-semibold text-slate-900 mt-1">
                  {formatRM(application.financing.deposit)}
                </div>
              </div>
              <div className="p-3 bg-blue-50/70 rounded-lg border border-blue-200/80">
                <div className="text-blue-700">Financing Amount</div>
                <div className="font-mono-tabular text-sm font-semibold text-blue-900 mt-1">
                  {formatRM(application.financing.financingAmount)}
                </div>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200/70">
                <div className="text-slate-500">Agreement Fee</div>
                <div className="font-mono-tabular text-sm font-semibold text-slate-900 mt-1">
                  {formatRM(application.financing.agreementFee)}
                </div>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200/70">
                <div className="text-slate-500">Processing Fee</div>
                <div className="font-mono-tabular text-sm font-semibold text-slate-900 mt-1">
                  {formatRM(application.financing.processingFee)}
                </div>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200/70">
                <div className="text-slate-500">SST Amount</div>
                <div className="font-mono-tabular text-sm font-semibold text-slate-900 mt-1">
                  {formatRM(application.financing.sstAmount)}
                </div>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200/70">
                <div className="text-slate-500">Stamp Duty Fee</div>
                <div className="font-mono-tabular text-sm font-semibold text-slate-900 mt-1">
                  {formatRM(application.financing.stampDutyFee)}
                </div>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200/70">
                <div className="text-slate-500">Installment Duration</div>
                <div className="tabular-nums text-sm font-semibold text-slate-900 mt-1">
                  {application.financing.installmentDuration} Months
                </div>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200/70">
                <div className="text-slate-500">Actual Cash Payment</div>
                <div className="font-mono-tabular text-sm font-semibold text-slate-900 mt-1">
                  {formatRM(actualCashPayment)}
                </div>
              </div>
              <div className="p-3 bg-emerald-50/70 rounded-lg border border-emerald-200/80 sm:col-span-2 lg:col-span-2">
                <div className="text-emerald-700">Monthly Installment</div>
                <div className="font-mono-tabular text-base font-bold text-emerald-900 mt-1">
                  {formatRM(application.financing.monthlyInstallment)} / month
                </div>
              </div>
            </div>
          )}
        </section>

        {/* Section G (Left - Vertical Downward Process) + Section F (Right - Activity Timeline) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* Section G – Task Status (Left, downward vertical process style) */}
          <section className="lg:col-span-6 bg-white border border-slate-200 rounded-xl p-5">
            <div className="pb-3 border-b border-slate-100">
              <h2 className="text-sm font-semibold text-slate-900">
                Section G — Task Status
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Vertical workflow process from stock checking through JCL agreement claim.
              </p>
            </div>

            {(() => {
              const processSteps: {
                key: keyof TaskStatusState;
                inputId: string;
                label: string;
                value: string;
                options: string[];
              }[] = [
                {
                  key: 'stockStatus',
                  inputId: 'edit-task-stock-status',
                  label: 'Stock Status',
                  value: isEditing ? taskStatusInput.stockStatus : taskStatus.stockStatus,
                  options: ['NOT YET CHECKING', 'READY', 'NO STOCK', 'IN TRANSIT', 'STOK OTW'],
                },
                {
                  key: 'customerDecision',
                  inputId: 'edit-task-customer-decision',
                  label: 'Customer Decision',
                  value: isEditing ? taskStatusInput.customerDecision : taskStatus.customerDecision,
                  options: [
                    'PENDING',
                    'ACCEPT',
                    'WAIT ORIGINAL COLOUR',
                    'WAIT ALTERNATIVE COLOUR',
                    'CANCELLED',
                  ],
                },
                {
                  key: 'collectionConfirmation',
                  inputId: 'edit-task-collection-confirmation',
                  label: 'Collection Confirmation',
                  value: isEditing
                    ? taskStatusInput.collectionConfirmation
                    : taskStatus.collectionConfirmation,
                  options: ['PENDING', 'CONFIRMED'],
                },
                {
                  key: 'passedStock',
                  inputId: 'edit-task-passed-stock',
                  label: 'Passed Stock',
                  value: isEditing ? taskStatusInput.passedStock : taskStatus.passedStock,
                  options: ['NOT YET', 'PASSED'],
                },
                {
                  key: 'agreementReceived',
                  inputId: 'edit-task-agreement-received',
                  label: 'Agreement Received',
                  value: isEditing
                    ? taskStatusInput.agreementReceived
                    : taskStatus.agreementReceived,
                  options: ['PENDING', 'RECEIVED'],
                },
                {
                  key: 'agreementChecking',
                  inputId: 'edit-task-agreement-checking',
                  label: 'Agreement Checking',
                  value: isEditing
                    ? taskStatusInput.agreementChecking
                    : taskStatus.agreementChecking,
                  options: ['PENDING', 'IN PROGRESS', 'PASSED', 'FAILED'],
                },
                {
                  key: 'agreementSubmission',
                  inputId: 'edit-task-agreement-submission',
                  label: 'Agreement Submission',
                  value: isEditing
                    ? taskStatusInput.agreementSubmission
                    : taskStatus.agreementSubmission,
                  options: [
                    'PENDING',
                    'IN TRANSIT',
                    'OUT FOR DELIVERY',
                    'DELIVERED',
                    'FAILED/RETURNED',
                  ],
                },
                {
                  key: 'agreementClaimed',
                  inputId: 'edit-task-agreement-claimed',
                  label: 'Agreement Claimed',
                  value: isEditing ? taskStatusInput.agreementClaimed : taskStatus.agreementClaimed,
                  options: ['PENDING', 'PENDING JCL', 'CLAIMED'],
                },
              ];

              const nodeToneClasses = {
                green: 'bg-emerald-50 border-emerald-300 text-emerald-700',
                blue: 'bg-blue-50 border-blue-300 text-blue-700',
                orange: 'bg-amber-50 border-amber-300 text-amber-700',
                red: 'bg-red-50 border-red-300 text-red-700',
                slate: 'bg-slate-50 border-slate-200 text-slate-500',
              };

              return (
                <ol className="mt-4">
                  {processSteps.map((step, idx) => {
                    const isLast = idx === processSteps.length - 1;
                    const tone = resolveStatusTone(step.value);
                    const lineClass =
                      tone === 'green'
                        ? 'bg-emerald-200'
                        : tone === 'blue'
                          ? 'bg-blue-200'
                          : 'bg-slate-200';

                    return (
                      <li key={step.key} className="flex gap-3.5 text-xs">
                        {/* Vertical downward stepper track */}
                        <div className="flex flex-col items-center shrink-0">
                          <div
                            className={`w-7 h-7 rounded-full border flex items-center justify-center font-semibold text-[11px] tabular-nums shrink-0 ${nodeToneClasses[tone]}`}
                          >
                            {tone === 'green' ? (
                              <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                            ) : tone === 'red' ? (
                              <XCircle className="w-3.5 h-3.5" aria-hidden="true" />
                            ) : (
                              idx + 1
                            )}
                          </div>
                          {!isLast && <div className={`w-0.5 flex-1 min-h-[20px] my-1 ${lineClass}`} />}
                        </div>

                        {/* Step card / row */}
                        <div className={`flex-1 min-w-0 ${isLast ? 'pb-0' : 'pb-3.5'}`}>
                          <div
                            className={`px-3.5 py-2.5 rounded-lg border transition-colors ${
                              isEditing
                                ? 'bg-white border-slate-200 space-y-2'
                                : 'bg-slate-50/80 border-slate-200/80'
                            }`}
                          >
                            {isEditing ? (
                              <>
                                <label
                                  htmlFor={step.inputId}
                                  className="block text-slate-700 font-medium"
                                >
                                  Step {idx + 1} · {step.label}
                                </label>
                                <select
                                  id={step.inputId}
                                  value={step.value}
                                  onChange={(e) =>
                                    setTaskStatusInput((prev) => ({
                                      ...prev,
                                      [step.key]: e.target.value,
                                    }))
                                  }
                                  className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-md bg-white text-slate-900 focus:outline-none focus:border-blue-500"
                                >
                                  {step.options.map((opt) => (
                                    <option key={opt} value={opt}>
                                      {opt}
                                    </option>
                                  ))}
                                </select>
                                {step.key === 'agreementChecking' && (
                                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2 border-t border-slate-100">
                                    <div>
                                      <label
                                        htmlFor="edit-checking-staff-1"
                                        className="block text-[10.5px] font-semibold text-slate-600 uppercase tracking-wider mb-1"
                                      >
                                        STAFF 1
                                      </label>
                                      <input
                                        id="edit-checking-staff-1"
                                        type="text"
                                        value={checkingStaff1Input}
                                        onChange={(e) => setCheckingStaff1Input(e.target.value)}
                                        placeholder="Nama Staff 1"
                                        className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-md bg-white text-slate-900 focus:outline-none focus:border-blue-500"
                                      />
                                    </div>
                                    <div>
                                      <label
                                        htmlFor="edit-checking-staff-2"
                                        className="block text-[10.5px] font-semibold text-slate-600 uppercase tracking-wider mb-1"
                                      >
                                        STAFF 2
                                      </label>
                                      <input
                                        id="edit-checking-staff-2"
                                        type="text"
                                        value={checkingStaff2Input}
                                        onChange={(e) => setCheckingStaff2Input(e.target.value)}
                                        placeholder="Nama Staff 2"
                                        className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-md bg-white text-slate-900 focus:outline-none focus:border-blue-500"
                                      />
                                    </div>
                                    <div>
                                      <label
                                        htmlFor="edit-checking-invoice"
                                        className="block text-[10.5px] font-semibold text-slate-600 uppercase tracking-wider mb-1"
                                      >
                                        NO INVOICE
                                      </label>
                                      <input
                                        id="edit-checking-invoice"
                                        type="text"
                                        value={invoiceNumberInput}
                                        onChange={(e) => setInvoiceNumberInput(e.target.value)}
                                        placeholder="e.g. INV-2026-0001"
                                        className="w-full px-2.5 py-1.5 text-xs font-mono-tabular border border-slate-200 rounded-md bg-white text-slate-900 focus:outline-none focus:border-blue-500"
                                      />
                                    </div>
                                  </div>
                                )}
                              </>
                            ) : (
                              <>
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <div className="min-w-0">
                                    <span className="text-[10.5px] font-medium text-slate-400 uppercase tracking-wider block">
                                      Step {idx + 1}
                                    </span>
                                    <span className="font-medium text-slate-900">{step.label}</span>
                                  </div>
                                  <StatusBadge status={step.value} />
                                </div>
                                {step.key === 'agreementChecking' && (
                                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2.5 mt-2.5 border-t border-slate-200/70">
                                    <div className="min-w-0">
                                      <span className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                                        STAFF 1
                                      </span>
                                      <span className="block text-xs font-medium text-slate-800 truncate mt-0.5">
                                        {application.agreement.checkingStaff1?.trim() || '—'}
                                      </span>
                                    </div>
                                    <div className="min-w-0">
                                      <span className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                                        STAFF 2
                                      </span>
                                      <span className="block text-xs font-medium text-slate-800 truncate mt-0.5">
                                        {application.agreement.checkingStaff2?.trim() || '—'}
                                      </span>
                                    </div>
                                    <div className="min-w-0">
                                      <span className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                                        NO INVOICE
                                      </span>
                                      <span className="block text-xs font-mono-tabular font-medium text-slate-800 truncate mt-0.5">
                                        {application.agreement.invoiceNumber?.trim() || '—'}
                                      </span>
                                    </div>
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              );
            })()}
          </section>

          {/* Section F – Activity Timeline (Right) */}
          <section className="lg:col-span-6 bg-white border border-slate-200 rounded-xl p-5">
            <h2 className="text-sm font-semibold text-slate-900 pb-3 border-b border-slate-100">
              Section F — Activity Timeline
            </h2>
            <ol className="mt-4 space-y-4">
              {application.timeline.map((evt) => (
                <li key={evt.id} className="flex gap-3 text-xs">
                  <div className="w-2 h-2 rounded-full bg-blue-600 mt-1.5 shrink-0" />
                  <div className="flex-1 pb-3 border-b border-slate-100 last:border-none">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-semibold text-slate-900">{evt.actionType}</span>
                      <span className="tabular-nums text-[11px] text-slate-500">
                        {formatDateTime(evt.timestamp)}
                      </span>
                    </div>
                    <p className="text-slate-600 mt-0.5 break-words">{evt.description}</p>
                    <p className="text-[11px] text-slate-400 mt-1">Staff: {evt.staffName}</p>
                  </div>
                </li>
              ))}
            </ol>
          </section>
        </div>
      </form>

      {/* Confirm Delete Modal */}
      <Modal
        open={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
        title="Confirm Delete?"
        subtitle={`${application.caseId} · ${application.customerName}`}
        maxWidthClass="max-w-md"
        footer={
          <>
            <button
              type="button"
              onClick={() => setDeleteConfirmOpen(false)}
              className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50"
            >
              NO
            </button>
            <button
              type="button"
              onClick={() => {
                setDeleteConfirmOpen(false);
                onDeleteApplication(application.id);
              }}
              className="px-4 py-2 text-xs font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg"
            >
              YES
            </button>
          </>
        }
      >
        <div className="flex items-start gap-3 text-xs text-slate-600">
          <div className="w-8 h-8 rounded-lg bg-red-50 text-red-600 flex items-center justify-center shrink-0">
            <Trash2 className="w-4 h-4" />
          </div>
          <p className="leading-relaxed">
            Are you sure you want to permanently delete application{' '}
            <strong className="font-mono-tabular text-slate-900">{application.caseId}</strong> (
            <strong className="text-slate-900">{application.customerName}</strong>)? This action
            cannot be undone.
          </p>
        </div>
      </Modal>
    </div>
  );
};
