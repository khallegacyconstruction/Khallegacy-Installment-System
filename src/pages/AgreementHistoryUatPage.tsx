import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';

type AgreementHistoryRecord = {
  id: number;
  application_id: number;
  agreement_number: string | null;
  received_at: string | null;
  received_by: string | null;
  checking_status: string | null;
  checked_at: string | null;
  checked_by: string | null;
  invoice_number: string | null;
  checking_remarks: string | null;
  sale_submission_id: string | null;
  sale_submitted_at: string | null;
  claimed_date: string | null;
  claimed_by: string | null;
  applications: { case_id: string; customer_name: string; phone: string | null } | null;
  sale_submissions: { submission_list_id: string; submission_date: string | null; postage_trackings: Array<{ status: string; tracking_number: string | null; courier: string | null; tracking_date: string | null; updated_at: string | null }> } | null;
};

type HistoryFilter = 'ALL' | 'RECEIVED' | 'CHECKING' | 'SUBMITTED' | 'DISPATCHED' | 'JCL_RECEIVED' | 'CLAIMED';

const filters: Array<{ value: HistoryFilter; label: string }> = [
  { value: 'ALL', label: 'Semua Rekod' },
  { value: 'RECEIVED', label: 'Agreement Diterima' },
  { value: 'CHECKING', label: 'Checking' },
  { value: 'SUBMITTED', label: 'Sale Submission' },
  { value: 'IN_POSTAGE', label: 'Dalam Penghantaran' },
  { value: 'DELIVERED', label: 'Delivered ke JCL' },
  { value: 'CLAIMED', label: 'Claimed' },
];

function formatDate(value: string | null): string {
  return value ? new Date(value).toLocaleDateString('en-MY', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
}

function latestTracking(record: AgreementHistoryRecord) {
  return [...(record.sale_submissions?.postage_trackings ?? [])].sort((a, b) =>
    (b.updated_at ?? b.tracking_date ?? '').localeCompare(a.updated_at ?? a.tracking_date ?? ''),
  )[0] ?? null;
}

function stage(record: AgreementHistoryRecord): string {
  if (record.claimed_date) return 'CLAIMED';
  const tracking = latestTracking(record);
  if (tracking?.status?.toUpperCase() === 'DELIVERED') return 'DELIVERED TO JCL';
  if (tracking?.status) return tracking.status.toUpperCase();
  if (record.sale_submission_id) return 'SALE SUBMITTED';
  if (record.checking_status === 'Checking Passed') return 'CHECKING PASSED';
  if (record.checking_status) return record.checking_status.toUpperCase();
  if (record.received_at) return 'RECEIVED';
  return 'AGREEMENT CREATED';
}

function matchesFilter(record: AgreementHistoryRecord, filter: HistoryFilter): boolean {
  switch (filter) {
    case 'RECEIVED': return Boolean(record.received_at);
    case 'CHECKING': return Boolean(record.checking_status);
    case 'SUBMITTED': return Boolean(record.sale_submission_id);
    case 'IN_POSTAGE': { const status = latestTracking(record)?.status?.toUpperCase(); return Boolean(status && status !== 'DELIVERED' && status !== 'FAILED / RETURNED'); }
    case 'DELIVERED': return latestTracking(record)?.status?.toUpperCase() === 'DELIVERED';
    case 'CLAIMED': return Boolean(record.claimed_date);
    default: return true;
  }
}

export function AgreementHistoryUatPage({ onBack }: { onBack: () => void }) {
  const [records, setRecords] = useState<AgreementHistoryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<HistoryFilter>('ALL');
  const [selected, setSelected] = useState<AgreementHistoryRecord | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const { data, error: queryError } = await supabase
      .from('application_agreements')
      .select('id,application_id,agreement_number,received_at,received_by,checking_status,checked_at,checked_by,invoice_number,checking_remarks,sale_submission_id,sale_submitted_at,claimed_date,claimed_by,applications!inner(case_id,customer_name,phone),sale_submissions!application_agreements_sale_submission_id_fkey(submission_list_id,submission_date,postage_trackings(status,tracking_number,courier,tracking_date,updated_at))')
      .order('updated_at', { ascending: false })
      .limit(500);

    if (queryError) {
      setError(queryError.message);
      setRecords([]);
    } else {
      setRecords((data ?? []) as unknown as AgreementHistoryRecord[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return records.filter((record) => {
      if (!matchesFilter(record, filter)) return false;
      if (!term) return true;
      const app = record.applications;
      return [
        app?.case_id ?? '', app?.customer_name ?? '', app?.phone ?? '',
        record.agreement_number ?? '', record.invoice_number ?? '',
        record.sale_submission_id ?? '', record.tracking_number ?? '',
        record.courier_name ?? '', record.received_by ?? '', record.checked_by ?? '',
        record.dispatched_by ?? '', record.jcl_confirmed_by ?? '', record.claimed_by ?? '',
      ].join(' ').toLowerCase().includes(term);
    });
  }, [records, search, filter]);

  const claimedCount = records.filter((record) => Boolean(record.claimed_date)).length;
  const deliveredCount = records.filter((record) => latestTracking(record)?.status?.toUpperCase() === 'DELIVERED').length;
  const submittedCount = records.filter((record) => Boolean(record.sale_submission_id)).length;

  return (
    <section className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-blue-700">Supabase UAT · Read Only</p>
          <h2 className="mt-1 text-xl font-bold">Agreement History</h2>
          <p className="mt-1 text-sm text-slate-500">Sejarah penerimaan, checking, Sale Submission, penghantaran dan penerimaan JCL serta tuntutan agreement.</p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => void load()} disabled={loading} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold disabled:opacity-50">Refresh</button>
          <button type="button" onClick={onBack} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold">Kembali</button>
        </div>
      </header>

      {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border bg-slate-50 p-4"><p className="text-xs text-slate-500">Jumlah Agreement</p><p className="mt-1 text-2xl font-bold tabular-nums">{records.length}</p></div>
        <div className="rounded-xl border bg-slate-50 p-4"><p className="text-xs text-slate-500">Sale Submission</p><p className="mt-1 text-2xl font-bold tabular-nums">{submittedCount}</p></div>
        <div className="rounded-xl border bg-slate-50 p-4"><p className="text-xs text-slate-500">Delivered ke JCL / Claimed</p><p className="mt-1 text-2xl font-bold tabular-nums">{deliveredCount} / {claimedCount}</p></div>
      </div>

      <div className="grid gap-3 sm:grid-cols-[1fr_230px]">
        <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Cari CASE ID, nama, telefon, invoice, batch atau tracking..." className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-600" />
        <select value={filter} onChange={(event) => setFilter(event.target.value as HistoryFilter)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
          {filters.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
        </select>
      </div>

      {loading ? <p className="py-10 text-center text-sm text-slate-500">Memuatkan Agreement History...</p> :
        filtered.length === 0 ? <div className="rounded-xl border border-dashed p-8 text-center text-sm text-slate-500">Tiada rekod yang sepadan dengan carian atau penapis.</div> :
        <div className="overflow-x-auto rounded-xl border">
          <table className="min-w-[1120px] w-full text-left text-xs">
            <thead className="bg-slate-50 uppercase tracking-wide text-slate-500"><tr>
              <th className="p-3">CASE ID / Customer</th><th className="p-3">Received</th><th className="p-3">Checking</th><th className="p-3">Sale Submission</th><th className="p-3">Postage Batch / Status</th><th className="p-3">Claimed</th><th className="p-3">Current Stage</th><th className="p-3 text-right">Details</th>
            </tr></thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((record) => <tr key={record.id} className="align-top hover:bg-slate-50">
                <td className="p-3"><p className="font-semibold text-slate-900">{record.applications?.case_id ?? '—'}</p><p className="mt-1 text-slate-600">{record.applications?.customer_name ?? '—'}</p><p className="mt-1 text-slate-400">{record.agreement_number ?? 'No agreement no.'}</p></td>
                <td className="p-3">{formatDate(record.received_at)}<p className="mt-1 text-slate-400">{record.received_by ?? '—'}</p></td>
                <td className="p-3">{record.checking_status ?? '—'}<p className="mt-1 text-slate-400">{formatDate(record.checked_at)}</p></td>
                <td className="p-3">{record.sale_submission_id ?? '—'}<p className="mt-1 text-slate-400">{formatDate(record.sale_submitted_at)}</p></td>
                <td className="p-3">{latestTracking(record)?.status ?? 'Awaiting postage'}<p className="mt-1 text-slate-400">{latestTracking(record)?.courier ?? '—'} · {latestTracking(record)?.tracking_number ?? '—'}</p></td>
                <td className="p-3">{record.claimed_date ? formatDate(record.claimed_date) : '—'}<p className="mt-1 text-slate-400">{record.claimed_by ?? ''}</p></td>
                <td className="p-3"><span className="inline-flex rounded-full bg-slate-100 px-2 py-1 font-semibold text-slate-700">{stage(record)}</span></td>
                <td className="p-3 text-right"><button type="button" onClick={() => setSelected(record)} className="rounded-lg border border-blue-200 px-3 py-2 font-semibold text-blue-700 hover:bg-blue-50">View</button></td>
              </tr>)}
            </tbody>
          </table>
          <p className="border-t bg-slate-50 px-3 py-2 text-xs text-slate-500">Memaparkan sehingga 500 rekod terkini. Gunakan carian dan penapis untuk menyemak rekod.</p>
        </div>}

      {selected && <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/50 p-4">
        <div role="dialog" aria-modal="true" className="my-6 w-full max-w-2xl rounded-2xl bg-white p-5 shadow-xl">
          <div className="flex items-start justify-between gap-3"><div><h3 className="text-lg font-bold">Agreement History Details</h3><p className="mt-1 text-sm text-slate-500">{selected.applications?.case_id} · {selected.applications?.customer_name}</p></div><button type="button" onClick={() => setSelected(null)} className="rounded-lg border px-3 py-1.5 text-sm">Tutup</button></div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {[
              ['Agreement Number', selected.agreement_number], ['Current Stage', stage(selected)],
              ['Received By / Date', [selected.received_by, formatDate(selected.received_at)].filter(Boolean).join(' · ')],
              ['Checked By / Date', [selected.checked_by, formatDate(selected.checked_at)].filter(Boolean).join(' · ')],
              ['Invoice Number', selected.invoice_number], ['Checking Status', selected.checking_status],
              ['Sale Submission ID', selected.sale_submission_id], ['Sale Submitted At', formatDate(selected.sale_submitted_at)],
              ['Postage Status', latestTracking(selected)?.status ?? 'Awaiting postage'],
              ['Courier / Tracking', [latestTracking(selected)?.courier, latestTracking(selected)?.tracking_number].filter(Boolean).join(' · ')],
              ['Postage Tracking Date', formatDate(latestTracking(selected)?.tracking_date ?? null)], ['Claimed By / Date', [selected.claimed_by, formatDate(selected.claimed_date)].filter(Boolean).join(' · ')],
            ].map(([label, value]) => <div key={label} className="rounded-lg border p-3"><p className="text-xs text-slate-500">{label}</p><p className="mt-1 break-words text-sm font-semibold text-slate-800">{value || '—'}</p></div>)}
          </div>
          {selected.checking_remarks && <div className="mt-3 rounded-lg border p-3"><p className="text-xs text-slate-500">Checking Remarks</p><p className="mt-1 whitespace-pre-wrap text-sm">{selected.checking_remarks}</p></div>}
        </div>
      </div>}
    </section>
  );
}
