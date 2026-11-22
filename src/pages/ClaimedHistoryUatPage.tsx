import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';

type ClaimedProduct = {
  product_name: string;
  model: string | null;
  quantity: number;
  product_price: number | string;
};

type ClaimedFinancing = {
  total_financing_amount: number | string;
  actual_cash_payment: number | string;
  processing_fee: number | string;
  sst_amount: number | string;
  stamp_duty: number | string;
};

type ClaimedTracking = {
  status: string;
  tracking_number: string | null;
  courier: string | null;
  tracking_date: string | null;
  updated_at: string | null;
};

type ClaimedHistoryRecord = {
  id: number;
  application_id: number;
  agreement_number: string | null;
  claimed_date: string;
  claimed_by: string | null;
  sale_submission_id: string | null;
  applications: {
    case_id: string;
    customer_name: string;
    ic_number: string | null;
    phone: string | null;
    application_products: ClaimedProduct[];
    application_financing: ClaimedFinancing | null;
  } | null;
  sale_submissions: {
    submission_list_id: string;
    submission_date: string | null;
    postage_trackings: ClaimedTracking[];
  } | null;
};

function formatDate(value: string | null): string {
  return value ? new Date(`${value}T00:00:00`).toLocaleDateString('en-MY', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
}

function formatRM(value: number | string | null | undefined): string {
  return `RM ${Number(value || 0).toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function latestTracking(record: ClaimedHistoryRecord): ClaimedTracking | null {
  return [...(record.sale_submissions?.postage_trackings ?? [])].sort((a, b) =>
    (b.updated_at ?? b.tracking_date ?? '').localeCompare(a.updated_at ?? a.tracking_date ?? ''),
  )[0] ?? null;
}

function financing(record: ClaimedHistoryRecord): ClaimedFinancing | null {
  return record.applications?.application_financing ?? null;
}

export function ClaimedHistoryUatPage({ onBack }: { onBack: () => void }) {
  const [records, setRecords] = useState<ClaimedHistoryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [selected, setSelected] = useState<ClaimedHistoryRecord | null>(null);

  const loadRecords = useCallback(async () => {
    setLoading(true);
    setError('');
    const { data, error: queryError } = await supabase
      .from('application_agreements')
      .select('id,application_id,agreement_number,claimed_date,claimed_by,sale_submission_id,applications!inner(case_id,customer_name,ic_number,phone,application_products(product_name,model,quantity,product_price),application_financing(total_financing_amount,actual_cash_payment,processing_fee,sst_amount,stamp_duty)),sale_submissions!application_agreements_sale_submission_id_fkey(submission_list_id,submission_date,postage_trackings(status,tracking_number,courier,tracking_date,updated_at))')
      .not('claimed_date', 'is', null)
      .order('claimed_date', { ascending: false })
      .limit(1000);

    if (queryError) {
      setError(queryError.message);
      setRecords([]);
    } else {
      setRecords((data ?? []) as unknown as ClaimedHistoryRecord[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => { void loadRecords(); }, [loadRecords]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return records.filter((record) => {
      if (fromDate && record.claimed_date < fromDate) return false;
      if (toDate && record.claimed_date > toDate) return false;
      if (!term) return true;
      const app = record.applications;
      return [
        app?.case_id ?? '', app?.customer_name ?? '', app?.ic_number ?? '',
        app?.phone ?? '', record.agreement_number ?? '', record.sale_submission_id ?? '',
        record.claimed_by ?? '', latestTracking(record)?.tracking_number ?? '',
        ...(app?.application_products ?? []).flatMap((product) => [product.product_name, product.model ?? '']),
      ].join(' ').toLowerCase().includes(term);
    });
  }, [records, search, fromDate, toDate]);

  const totalCash = filtered.reduce((sum, record) => sum + Number(financing(record)?.actual_cash_payment ?? 0), 0);
  const uniqueBatches = new Set(filtered.map((record) => record.sale_submission_id).filter(Boolean)).size;

  return (
    <section className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-blue-700">Supabase UAT · Read Only</p>
          <h2 className="mt-1 text-xl font-bold">Claimed History &amp; Data</h2>
          <p className="mt-1 text-sm text-slate-500">Rekod agreement yang telah ditandakan CLAIMED selepas batch Postage Management berstatus DELIVERED.</p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => void loadRecords()} disabled={loading} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold disabled:opacity-50">Refresh</button>
          <button type="button" onClick={onBack} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold">Kembali</button>
        </div>
      </header>

      {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border bg-slate-50 p-4"><p className="text-xs text-slate-500">Jumlah Agreement Claimed</p><p className="mt-1 text-2xl font-bold tabular-nums">{filtered.length}</p></div>
        <div className="rounded-xl border bg-slate-50 p-4"><p className="text-xs text-slate-500">Jumlah Batch</p><p className="mt-1 text-2xl font-bold tabular-nums">{uniqueBatches}</p></div>
        <div className="rounded-xl border bg-slate-50 p-4"><p className="text-xs text-slate-500">Total Actual Cash Payment</p><p className="mt-1 text-2xl font-bold tabular-nums">{formatRM(totalCash)}</p></div>
      </div>

      <div className="grid gap-3 lg:grid-cols-[minmax(240px,1fr)_180px_180px]">
        <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Cari CASE ID, nama, IC, telefon, batch, tracking atau produk..." className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-600" />
        <label className="text-xs font-medium text-slate-600">Claimed From<input type="date" value={fromDate} max={toDate || undefined} onChange={(event) => setFromDate(event.target.value)} className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" /></label>
        <label className="text-xs font-medium text-slate-600">Claimed To<input type="date" value={toDate} min={fromDate || undefined} onChange={(event) => setToDate(event.target.value)} className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" /></label>
      </div>

      {loading ? <p className="py-10 text-center text-sm text-slate-500">Memuatkan Claimed History...</p> :
        filtered.length === 0 ? <div className="rounded-xl border border-dashed p-8 text-center text-sm text-slate-500">Tiada rekod claimed yang sepadan dengan carian atau tarikh dipilih.</div> :
        <div className="overflow-x-auto rounded-xl border">
          <table className="min-w-[1050px] w-full text-left text-xs">
            <thead className="bg-slate-50 uppercase tracking-wide text-slate-500"><tr>
              <th className="p-3">CASE ID / Customer</th><th className="p-3">Product</th><th className="p-3 text-right">Financing</th><th className="p-3">Sale Submission Batch</th><th className="p-3">Postage Status</th><th className="p-3">Claimed Date / By</th><th className="p-3 text-right">Details</th>
            </tr></thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((record) => {
                const finance = financing(record);
                const tracking = latestTracking(record);
                return <tr key={record.id} className="align-top hover:bg-slate-50">
                  <td className="p-3"><p className="font-semibold text-slate-900">{record.applications?.case_id ?? '—'}</p><p className="mt-1 text-slate-600">{record.applications?.customer_name ?? '—'}</p><p className="mt-1 text-slate-400">{record.applications?.phone ?? '—'}</p></td>
                  <td className="p-3">{(record.applications?.application_products ?? []).map((product, index) => <p key={index}>{product.product_name}{product.model ? ` · ${product.model}` : ''}{Number(product.quantity) > 1 ? ` ×${product.quantity}` : ''}</p>)}</td>
                  <td className="p-3 text-right tabular-nums">{formatRM(finance?.total_financing_amount)}</td>
                  <td className="p-3"><p className="font-medium">{record.sale_submission_id ?? '—'}</p><p className="mt-1 text-slate-400">{formatDate(record.sale_submissions?.submission_date ?? null)}</p></td>
                  <td className="p-3"><p className="font-medium">{tracking?.status ?? '—'}</p><p className="mt-1 text-slate-400">{tracking?.courier ?? '—'} · {tracking?.tracking_number ?? '—'}</p></td>
                  <td className="p-3"><p className="font-medium">{formatDate(record.claimed_date)}</p><p className="mt-1 text-slate-400">{record.claimed_by ?? '—'}</p></td>
                  <td className="p-3 text-right"><button type="button" onClick={() => setSelected(record)} className="rounded-lg border border-blue-200 px-3 py-2 font-semibold text-blue-700 hover:bg-blue-50">View</button></td>
                </tr>;
              })}
            </tbody>
          </table>
          <p className="border-t bg-slate-50 px-3 py-2 text-xs text-slate-500">Memaparkan sehingga 1,000 rekod claimed terkini. Jumlah ringkasan mengikut carian dan julat tarikh semasa.</p>
        </div>}

      {selected && <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/50 p-4">
        <div role="dialog" aria-modal="true" className="my-6 w-full max-w-2xl rounded-2xl bg-white p-5 shadow-xl">
          <div className="flex items-start justify-between gap-3"><div><h3 className="text-lg font-bold">Claimed Record Details</h3><p className="mt-1 text-sm text-slate-500">{selected.applications?.case_id} · {selected.applications?.customer_name}</p></div><button type="button" onClick={() => setSelected(null)} className="rounded-lg border px-3 py-1.5 text-sm">Tutup</button></div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {[
              ['Agreement Number', selected.agreement_number],
              ['Customer IC', selected.applications?.ic_number],
              ['Phone Number', selected.applications?.phone],
              ['Claimed Date', formatDate(selected.claimed_date)],
              ['Claimed By', selected.claimed_by],
              ['Sale Submission Batch', selected.sale_submission_id],
              ['Batch Submission Date', formatDate(selected.sale_submissions?.submission_date ?? null)],
              ['Postage Status', latestTracking(selected)?.status],
              ['Courier / Tracking', [latestTracking(selected)?.courier, latestTracking(selected)?.tracking_number].filter(Boolean).join(' · ')],
              ['Total Financing Amount', formatRM(financing(selected)?.total_financing_amount)],
              ['Actual Cash Payment', formatRM(financing(selected)?.actual_cash_payment)],
              ['Processing Fee', formatRM(financing(selected)?.processing_fee)],
              ['SST', formatRM(financing(selected)?.sst_amount)],
              ['Stamp Duty', formatRM(financing(selected)?.stamp_duty)],
            ].map(([label, value]) => <div key={label} className="rounded-lg border p-3"><p className="text-xs text-slate-500">{label}</p><p className="mt-1 break-words text-sm font-semibold text-slate-800">{value || '—'}</p></div>)}
          </div>
          <div className="mt-4 rounded-lg border p-3"><p className="text-xs font-semibold text-slate-500">Products</p>{(selected.applications?.application_products ?? []).map((product, index) => <p key={index} className="mt-1 text-sm">{product.product_name}{product.model ? ` · ${product.model}` : ''} · Qty {product.quantity} · {formatRM(product.product_price)}</p>)}</div>
        </div>
      </div>}
    </section>
  );
}
