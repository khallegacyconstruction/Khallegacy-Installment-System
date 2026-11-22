import { Fragment, useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { supabase } from '../lib/supabase';

type ClaimBatch = {
  id: string;
  batch_reference: string;
  sale_submission_id: string;
  jcl_batch_reference: string | null;
  received_date: string;
  remarks: string;
  created_at: string;
};

type ClaimRecord = {
  id: string;
  application_id: number | null;
  case_id: string;
  ic_number: string;
  customer_name: string;
  item: string;
  finance_amount: number | string;
  deposit: number | string;
  stamp_duty_fee: number | string;
  processing_fee: number | string;
  sst_amount: number | string;
  actual_cash_payment: number | string;
  claim_status: string;
  investigation_status: string;
  remarks: string;
};

type Submission = { submission_list_id: string; submission_date: string; agreement_count: number };
type ClaimHistory = { id: number; event_type: string; old_value: string | null; new_value: string | null; notes: string; created_at: string; changed_by_staff_id: string | null };
type FeeCase = { application_id: number; total_financing_amount: number | string; deposit: number | string; processing_fee: number | string; sst_amount: number | string; stamp_duty: number | string; agreement_fee: number | string; actual_cash_payment: number | string; applications: { case_id: string; customer_name: string; ic_number: string } | null };

type EntryForm = {
  caseId: string;
  icNumber: string;
  customerName: string;
  item: string;
  financeAmount: string;
  deposit: string;
  stampDutyFee: string;
  processingFee: string;
  sstAmount: string;
  agreementFee: string;
  actualCashPayment: string;
  branch: string;
  invoiceNumber: string;
  staff1: string;
  staff2: string;
  claimDate: string;
  remarks: string;
};

const emptyEntry: EntryForm = {
  caseId: '', icNumber: '', customerName: '', item: '',
  financeAmount: '', deposit: '0', stampDutyFee: '0',
  processingFee: '50', sstAmount: '4', agreementFee: '88', actualCashPayment: '',
  branch: '', invoiceNumber: '', staff1: '', staff2: '',
  claimDate: new Date().toISOString().slice(0, 10), remarks: '',
};

const money = (value: number | string) => `RM ${Number(value || 0).toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function SalesClaimUatPage({ onBack }: { onBack: () => void }) {
  const [batches, setBatches] = useState<ClaimBatch[]>([]);
  const [records, setRecords] = useState<ClaimRecord[]>([]);
  const [historyByRecord, setHistoryByRecord] = useState<Record<string, ClaimHistory[]>>({});
  const [openHistoryId, setOpenHistoryId] = useState('');
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [feeCases, setFeeCases] = useState<FeeCase[]>([]);
  const [feeEdits, setFeeEdits] = useState<Record<number, { processing: string; sst: string; stamp: string }>>({});
  const [deliveredIds, setDeliveredIds] = useState<string[]>([]);
  const [selectedBatchId, setSelectedBatchId] = useState('');
  const [selectedSubmissionId, setSelectedSubmissionId] = useState('');
  const [receivedDate, setReceivedDate] = useState(new Date().toISOString().slice(0, 10));
  const [jclReference, setJclReference] = useState('');
  const [batchRemarks, setBatchRemarks] = useState('');
  const [entry, setEntry] = useState<EntryForm>(emptyEntry);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [search, setSearch] = useState('');

  const loadBatches = useCallback(async () => {
    setLoading(true);
    setError('');
    const [batchResult, submissionResult, postageResult, feeResult] = await Promise.all([
      supabase.from('sales_claim_batches').select('*').order('created_at', { ascending: false }),
      supabase.from('sale_submissions').select('submission_list_id,submission_date,agreement_count').order('created_at', { ascending: false }),
      supabase.from('postage_trackings').select('sale_submission_id,status,updated_at').not('sale_submission_id', 'is', null).order('updated_at', { ascending: false }),
      supabase.from('application_financing').select('application_id,total_financing_amount,deposit,processing_fee,sst_amount,stamp_duty,agreement_fee,actual_cash_payment,applications!inner(case_id,customer_name,ic_number)').order('updated_at', { ascending: false }).limit(100),
    ]);
    const loadError = batchResult.error || submissionResult.error || postageResult.error || feeResult.error;
    if (loadError) {
      setError(loadError.message);
      setBatches([]);
      setSubmissions([]);
      setDeliveredIds([]);
      setFeeCases([]);
    } else {
      setBatches((batchResult.data ?? []) as ClaimBatch[]);
      setSubmissions((submissionResult.data ?? []) as Submission[]);
      const latestStatus = new Map<string, string>();
      for (const row of postageResult.data ?? []) {
        if (row.sale_submission_id && !latestStatus.has(row.sale_submission_id)) latestStatus.set(row.sale_submission_id, row.status);
      }
      setDeliveredIds([...latestStatus.entries()].filter(([, status]) => status === 'DELIVERED').map(([id]) => id));
      setFeeCases((feeResult.data ?? []) as unknown as FeeCase[]);
    }
    setLoading(false);
  }, []);

  const loadRecords = useCallback(async (batchId: string) => {
    if (!batchId) {
      setRecords([]);
      return;
    }
    const { data, error: loadError } = await supabase
      .from('sales_claim_records')
      .select('*')
      .eq('batch_id', batchId)
      .order('case_id', { ascending: true });
    if (loadError) {
      setError(loadError.message);
      setRecords([]);
    } else {
      setRecords((data ?? []) as ClaimRecord[]);
    }
  }, []);

  useEffect(() => { void loadBatches(); }, [loadBatches]);
  useEffect(() => { void loadRecords(selectedBatchId); }, [loadRecords, selectedBatchId]);

  const eligibleSubmissions = useMemo(
    () => submissions.filter((submission) => deliveredIds.includes(submission.submission_list_id)),
    [submissions, deliveredIds],
  );
  const filteredRecords = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return records;
    return records.filter((record) =>
      [record.case_id, record.ic_number, record.customer_name, record.item, record.claim_status, record.investigation_status]
        .join(' ').toLowerCase().includes(term),
    );
  }, [records, search]);

  const createBatch = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedSubmissionId || !receivedDate) return;
    setSaving(true); setError(''); setSuccess('');
    const { data, error: saveError } = await supabase.rpc('create_sales_claim_batch', {
      p_sale_submission_id: selectedSubmissionId,
      p_received_date: receivedDate,
      p_jcl_batch_reference: jclReference,
      p_remarks: batchRemarks,
    });
    if (saveError) {
      setError(saveError.message);
    } else {
      const created = Array.isArray(data) ? data[0] : data;
      setSuccess(`Claim Batch ${created.batch_reference} diwujudkan dengan ${created.record_count} rekod.`);
      setSelectedBatchId(created.batch_id);
      setSelectedSubmissionId('');
      setJclReference('');
      setBatchRemarks('');
      await loadBatches();
    }
    setSaving(false);
  };

  const saveEntry = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedBatchId) return;
    setSaving(true); setError(''); setSuccess('');
    const payload = {
      caseId: entry.caseId, icNumber: entry.icNumber, customerName: entry.customerName,
      item: entry.item, financeAmount: Number(entry.financeAmount || 0),
      deposit: Number(entry.deposit || 0), stampDutyFee: Number(entry.stampDutyFee || 0),
      processingFee: Number(entry.processingFee || 0), sstAmount: Number(entry.sstAmount || 0),
      actualCashPayment: Number(entry.actualCashPayment || 0), branch: entry.branch,
      invoiceNumber: entry.invoiceNumber, staff1: entry.staff1, staff2: entry.staff2,
      claimDate: entry.claimDate, remarks: entry.remarks,
    };
    const { data, error: saveError } = await supabase.rpc('record_sales_claim_entry', {
      p_batch_id: selectedBatchId, p_payload: payload,
    });
    if (saveError) {
      setError(saveError.message);
    } else {
      const result = Array.isArray(data) ? data[0] : data;
      setSuccess(`Rekod ${entry.caseId} disimpan: ${result.claim_status}.`);
      setEntry(emptyEntry);
      await loadRecords(selectedBatchId);
    }
    setSaving(false);
  };

  const saveFees = async (row: FeeCase) => {
    const edit = feeEdits[row.application_id] ?? {
      processing: String(row.processing_fee), sst: String(row.sst_amount), stamp: String(row.stamp_duty), agreement: String(row.agreement_fee),
    };
    setError(''); setSuccess('');
    const { data, error: saveError } = await supabase.rpc('update_sales_claim_fees', {
      p_application_id: row.application_id,
      p_processing_fee: Number(edit.processing),
      p_sst_amount: Number(edit.sst),
      p_stamp_duty_fee: Number(edit.stamp),
      p_agreement_fee: Number(edit.agreement),
    });
    if (saveError) setError(saveError.message);
    else {
      setSuccess(`Caj ${row.applications?.case_id ?? row.application_id} dikemas kini. Actual Cash Payment: ${money(data)}.`);
      await loadBatches();
    }
  };

  const toggleHistory = async (record: ClaimRecord) => {
    if (openHistoryId === record.id) { setOpenHistoryId(''); return; }
    setOpenHistoryId(record.id);
    if (historyByRecord[record.id]) return;
    const { data, error: historyError } = await supabase.from('sales_claim_history')
      .select('id,event_type,old_value,new_value,notes,created_at,changed_by_staff_id')
      .eq('sales_claim_record_id', record.id).order('created_at', { ascending: false });
    if (historyError) setError(historyError.message);
    else setHistoryByRecord((old) => ({ ...old, [record.id]: (data ?? []) as ClaimHistory[] }));
  };
  const updateInvestigation = async (record: ClaimRecord, status: string) => {
    setError(''); setSuccess('');
    const { error: updateError } = await supabase.rpc('update_sales_claim_investigation', {
      p_record_id: record.id, p_status: status, p_notes: '',
    });
    if (updateError) setError(updateError.message);
    else { setSuccess(`Investigation ${record.case_id} dikemas kini.`); await loadRecords(selectedBatchId); }
  };

  const updateClaimStatus = async (record: ClaimRecord, status: string) => {
    setError(''); setSuccess('');
    const { error: updateError } = await supabase.rpc('update_sales_claim_status', {
      p_record_id: record.id, p_status: status, p_reason: 'Status dikemas kini melalui Sales Claim Management.',
    });
    if (updateError) setError(updateError.message);
    else { setSuccess(`Claim status ${record.case_id} dikemas kini.`); await loadRecords(selectedBatchId); }
  };

  const selectedBatch = batches.find((batch) => batch.id === selectedBatchId);

  return (
    <section className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">Supabase UAT</p>
          <h2 className="mt-1 text-xl font-bold">Sales Claim Management</h2>
          <p className="mt-1 text-sm text-slate-500">Rekod Claim Submission List JCL secara manual dan padankan menggunakan CASE ID + IC Number.</p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => void loadBatches()} disabled={loading} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold hover:bg-slate-50">Refresh</button>
          <button type="button" onClick={onBack} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold hover:bg-slate-50">Kembali</button>
        </div>
      </div>

      {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      {success && <div role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{success}</div>}

      <details className="rounded-xl border border-slate-200 p-4">
        <summary className="cursor-pointer font-semibold">Sales Claim Fees · Processing Fee, SST & Stamp Duty</summary>
        <p className="mt-1 text-sm text-slate-500">Actual Cash Payment dikira automatik oleh database dan tidak boleh diedit. Senarai memaparkan 100 rekod pembiayaan terkini.</p>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-[850px] w-full text-left text-xs">
            <thead className="bg-slate-50 uppercase text-slate-500"><tr><th className="p-2">CASE ID / Customer</th><th className="p-2 text-right">Financing</th><th className="p-2">Processing Fee</th><th className="p-2">SST</th><th className="p-2">Stamp Duty</th><th className="p-2">Agreement Fee</th><th className="p-2 text-right">Actual Cash</th><th className="p-2"></th></tr></thead>
            <tbody>
              {feeCases.map((row) => {
                const edit = feeEdits[row.application_id] ?? { processing: String(row.processing_fee), sst: String(row.sst_amount), stamp: String(row.stamp_duty), agreement: String(row.agreement_fee) };
                return <tr key={row.application_id} className="border-t border-slate-100">
                  <td className="p-2"><strong>{row.applications?.case_id ?? row.application_id}</strong><span className="block text-slate-500">{row.applications?.customer_name ?? ''}</span></td>
                  <td className="p-2 text-right">{money(row.total_financing_amount)}</td>
                  <td className="p-2"><input aria-label="Processing Fee" type="number" min="0" step="0.01" value={edit.processing} onChange={(event) => setFeeEdits((old) => ({ ...old, [row.application_id]: { ...edit, processing: event.target.value } }))} className="w-24 rounded border border-slate-300 p-1" /></td>
                  <td className="p-2"><input aria-label="SST Amount" type="number" min="0" step="0.01" value={edit.sst} onChange={(event) => setFeeEdits((old) => ({ ...old, [row.application_id]: { ...edit, sst: event.target.value } }))} className="w-20 rounded border border-slate-300 p-1" /></td>
                  <td className="p-2"><input aria-label="Stamp Duty Fee" type="number" min="0" step="0.01" value={edit.stamp} onChange={(event) => setFeeEdits((old) => ({ ...old, [row.application_id]: { ...edit, stamp: event.target.value } }))} className="w-20 rounded border border-slate-300 p-1" /></td>
                  <td className="p-2"><input aria-label="Agreement Fee" type="number" min="0" step="0.01" value={edit.agreement} onChange={(event) => setFeeEdits((old) => ({ ...old, [row.application_id]: { ...edit, agreement: event.target.value } }))} className="w-20 rounded border border-slate-300 p-1" /></td>
                  <td className="p-2 text-right font-semibold">{money(row.actual_cash_payment)}</td>
                  <td className="p-2"><button type="button" onClick={() => void saveFees(row)} className="rounded bg-blue-600 px-3 py-1.5 font-semibold text-white">Save</button></td>
                </tr>;
              })}
            </tbody>
          </table>
        </div>
      </details>

      <div className="rounded-xl border border-slate-200 p-4">
        <h3 className="font-semibold">Terima Claim Submission List daripada JCL</h3>
        <p className="mt-1 text-sm text-slate-500">Hanya Sale Submission yang sudah DELIVERED dalam Postage Management boleh dibuka sebagai Claim Batch.</p>
        <form onSubmit={createBatch} className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="text-sm font-medium">Sale Submission ID
            <select required value={selectedSubmissionId} onChange={(event) => setSelectedSubmissionId(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2">
              <option value="">Pilih batch delivered</option>
              {eligibleSubmissions.map((submission) => <option key={submission.submission_list_id} value={submission.submission_list_id}>{submission.submission_list_id} · {submission.agreement_count} agreement</option>)}
            </select>
          </label>
          <label className="text-sm font-medium">Tarikh terima senarai JCL
            <input type="date" required value={receivedDate} onChange={(event) => setReceivedDate(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" />
          </label>
          <label className="text-sm font-medium">Rujukan Claim Batch JCL
            <input value={jclReference} onChange={(event) => setJclReference(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" placeholder="Rujukan pada senarai JCL (jika ada)" />
          </label>
          <label className="text-sm font-medium">Remark
            <input value={batchRemarks} onChange={(event) => setBatchRemarks(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" />
          </label>
          <div className="sm:col-span-2">
            <button disabled={saving || !selectedSubmissionId} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{saving ? 'Menyimpan...' : 'Create Claim Batch'}</button>
          </div>
        </form>
      </div>

      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <div className="rounded-xl border border-slate-200 p-4">
          <h3 className="font-semibold">Claim Batch History ({batches.length})</h3>
          <div className="mt-3 space-y-2">
            {batches.map((batch) => (
              <button key={batch.id} type="button" onClick={() => setSelectedBatchId(batch.id)} className={`w-full rounded-lg border p-3 text-left text-sm ${selectedBatchId === batch.id ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:bg-slate-50'}`}>
                <span className="block font-semibold">{batch.batch_reference}</span>
                <span className="mt-1 block text-xs text-slate-500">{batch.sale_submission_id} · {batch.received_date}</span>
                {batch.jcl_batch_reference && <span className="block text-xs text-slate-500">JCL: {batch.jcl_batch_reference}</span>}
              </button>
            ))}
            {!loading && batches.length === 0 && <p className="text-sm text-slate-500">Belum ada Claim Batch.</p>}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 p-4">
          <h3 className="font-semibold">{selectedBatch ? selectedBatch.batch_reference : 'Pilih Claim Batch'}</h3>
          {selectedBatch && <>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              <div className="rounded-lg bg-slate-50 p-3"><p className="text-xs text-slate-500">Jumlah kes dalam batch</p><p className="text-xl font-bold">{records.length}</p></div>
              <div className="rounded-lg bg-slate-50 p-3"><p className="text-xs text-slate-500">Claimed</p><p className="text-xl font-bold text-emerald-700">{records.filter((r) => r.claim_status === 'CLAIMED').length}</p></div>
              <div className="rounded-lg bg-slate-50 p-3"><p className="text-xs text-slate-500">Belum / perlu semakan</p><p className="text-xl font-bold text-amber-700">{records.filter((r) => r.claim_status !== 'CLAIMED').length}</p></div>
            </div>
            <label className="mt-4 block text-sm font-medium">Carian rekod
              <input value={search} onChange={(event) => setSearch(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" placeholder="CASE ID / IC / nama / status" />
            </label>
            <div className="mt-3 overflow-x-auto rounded-lg border border-slate-200">
              <table className="min-w-[850px] w-full text-left text-xs">
                <thead className="bg-slate-50 uppercase text-slate-500"><tr><th className="p-2">CASE ID / Nama</th><th className="p-2">IC</th><th className="p-2 text-right">Finance</th><th className="p-2 text-right">Actual Cash</th><th className="p-2">Claim Status</th><th className="p-2">Investigation</th><th className="p-2">History</th></tr></thead>
                <tbody>
                  {filteredRecords.map((record) => <Fragment key={record.id}><tr className="border-t border-slate-100">
                    <td className="p-2"><strong>{record.case_id}</strong><span className="block text-slate-500">{record.customer_name}</span></td>
                    <td className="p-2">{record.ic_number}</td>
                    <td className="p-2 text-right">{money(record.finance_amount)}</td>
                    <td className="p-2 text-right">{money(record.actual_cash_payment)}</td>
                    <td className="p-2">
                      <select value={record.claim_status} onChange={(event) => void updateClaimStatus(record, event.target.value)} className="rounded border border-slate-300 p-1">
                        {['CLAIMED','NOT YET CLAIMED','DISCREPANCY','PENDING VERIFICATION','CANCELLED'].map((status) => <option key={status}>{status}</option>)}
                      </select>
                    </td>
                    <td className="p-2">
                      <select value={record.investigation_status} onChange={(event) => void updateInvestigation(record, event.target.value)} className="rounded border border-slate-300 p-1">
                        {['NOT REVIEWED','UNDER REVIEW','WAITING JCL','RESOLVED','FOLLOW UP'].map((status) => <option key={status}>{status}</option>)}
                      </select>
                    </td>
                    <td className="p-2"><button type="button" onClick={() => void toggleHistory(record)} className="rounded border border-slate-300 px-2 py-1">History</button></td>
                  </tr>
                  {openHistoryId === record.id && <tr className="bg-slate-50"><td colSpan={7} className="p-3">
                    {(historyByRecord[record.id] ?? []).map((item) => <div key={item.id} className="mb-2 rounded border border-slate-200 bg-white p-2">
                      <strong>{item.event_type}: {item.old_value ?? '—'} → {item.new_value ?? '—'}</strong>
                      <p className="text-slate-500">{new Date(item.created_at).toLocaleString('en-MY')} · {item.changed_by_staff_id ?? 'System'}</p>
                      {item.notes && <p>{item.notes}</p>}
                    </div>)}
                    {(historyByRecord[record.id] ?? []).length === 0 && <p className="text-slate-500">Belum ada sejarah perubahan.</p>}
                  </td></tr>}
                  </Fragment>)}
                  {filteredRecords.length === 0 && <tr><td colSpan={7} className="p-6 text-center text-slate-500">Tiada rekod dalam carian ini.</td></tr>}
                </tbody>
              </table>
            </div>
            <details className="mt-4 rounded-lg border border-slate-200 p-3">
              <summary className="cursor-pointer text-sm font-semibold">Key in satu rekod daripada Claim Submission List JCL</summary>
              <form onSubmit={saveEntry} className="mt-3 grid gap-3 sm:grid-cols-2">
                {([
                  ['caseId','CASE ID'],['icNumber','IC Number'],['customerName','Customer Name'],['item','Item'],
                  ['financeAmount','Finance Amount'],['deposit','Deposit'],['stampDutyFee','Stamp Duty Fee'],
                  ['processingFee','Processing Fee'],['sstAmount','SST Amount'],['agreementFee','Agreement Fee'],['actualCashPayment','Actual Cash Payment'],
                  ['branch','Cawangan'],['invoiceNumber','Invoice'],['staff1','Staff 1'],['staff2','Staff 2'],
                  ['claimDate','Claim Date'],['remarks','Remarks'],
                ] as [keyof EntryForm,string][]).map(([key,label]) => (
                  <label key={key} className="text-sm font-medium">{label}
                    <input required={['caseId','icNumber','financeAmount','deposit','stampDutyFee','processingFee','sstAmount','agreementFee','actualCashPayment','claimDate'].includes(key)} type={key === 'claimDate' ? 'date' : 'text'} inputMode={['financeAmount','deposit','stampDutyFee','processingFee','sstAmount','agreementFee','actualCashPayment'].includes(key) ? 'decimal' : undefined}
                      value={entry[key]} onChange={(event) => setEntry((previous) => ({ ...previous, [key]: event.target.value }))}
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" />
                  </label>
                ))}
                <div className="sm:col-span-2"><button disabled={saving} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{saving ? 'Menyimpan...' : 'Simpan & Padankan Rekod'}</button></div>
              </form>
              <p className="mt-2 text-xs text-slate-500">Padanan automatik menggunakan CASE ID dan IC Number serentak. Jika maklumat tidak sepadan atau kes tiada dalam batch, rekod masuk PENDING VERIFICATION untuk semakan manual.</p>
            </details>
          </>}
        </div>
      </div>
    </section>
  );
}
