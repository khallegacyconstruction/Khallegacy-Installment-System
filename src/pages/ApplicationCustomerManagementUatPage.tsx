import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import type { Branch } from '../types/khallegacy';
import { supabase } from '../lib/supabase';

type ApplicationRow = {
  id: number;
  case_id: string;
  customer_name: string;
  ic_number: string;
  phone: string;
  address: string;
  ref1_id: string | null;
  customer_from_branch_id: string;
  pickup_branch_id: string | null;
  application_date: string;
  approval_date: string;
  approval_status: string;
  bank_name: string | null;
  bank_account_number: string | null;
  application_remarks: string | null;
  internal_notes: string | null;
  staff_in_charge_id: string | null;
  category: string | null;
  created_at: string;
};

type DetailData = {
  financing: {
    deposit: number | string;
    agreement_fee: number | string;
    processing_fee: number | string;
    sst_amount: number | string;
    stamp_duty: number | string;
    total_product_price: number | string;
    total_financing_amount: number | string;
    monthly_installment: number | string;
    installment_duration: number | null;
    actual_cash_payment: number | string;
  } | null;
  products: Array<{ id: number; product_name: string; category: string; model: string | null; quantity: number; product_price: number | string; stock_status: string }>;
  agreement: { checking_status: string; invoice_number: string | null; sale_submission_id: string | null; claimed_date: string | null } | null;
};

type EditForm = {
  customerName: string;
  icNumber: string;
  phone: string;
  address: string;
  ref1Id: string;
  customerFromBranchId: string;
  pickupBranchId: string;
  bankName: string;
  bankAccountNumber: string;
  applicationRemarks: string;
  internalNotes: string;
  staffInChargeId: string;
};

const emptyDetail: DetailData = { financing: null, products: [], agreement: null };
const money = (value: number | string) => `RM ${Number(value || 0).toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function ApplicationCustomerManagementUatPage({ branches, onBack }: { branches: Branch[]; onBack: () => void }) {
  const [rows, setRows] = useState<ApplicationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<ApplicationRow | null>(null);
  const [detail, setDetail] = useState<DetailData>(emptyDetail);
  const [form, setForm] = useState<EditForm | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    const { data, error: loadError } = await supabase.from('applications')
      .select('id,case_id,customer_name,ic_number,phone,address,ref1_id,customer_from_branch_id,pickup_branch_id,application_date,approval_date,approval_status,bank_name,bank_account_number,application_remarks,internal_notes,staff_in_charge_id,category,created_at')
      .order('created_at', { ascending: false }).limit(300);
    if (loadError) { setError(loadError.message); setRows([]); }
    else setRows((data ?? []) as ApplicationRow[]);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) => [row.case_id,row.customer_name,row.ic_number,row.phone,row.ref1_id ?? '',row.approval_status]
      .join(' ').toLowerCase().includes(q));
  }, [rows, search]);

  const branchName = (id: string | null) => branches.find((branch) => branch.id === id)?.name ?? id ?? '—';

  const open = async (row: ApplicationRow) => {
    setSelected(row);
    setError('');
    setForm({
      customerName: row.customer_name, icNumber: row.ic_number, phone: row.phone,
      address: row.address ?? '', ref1Id: row.ref1_id ?? '',
      customerFromBranchId: row.customer_from_branch_id, pickupBranchId: row.pickup_branch_id ?? '',
      bankName: row.bank_name ?? '', bankAccountNumber: row.bank_account_number ?? '',
      applicationRemarks: row.application_remarks ?? '', internalNotes: row.internal_notes ?? '',
      staffInChargeId: row.staff_in_charge_id ?? '',
    });
    setDetail(emptyDetail);
    const [financeResult, productResult, agreementResult] = await Promise.all([
      supabase.from('application_financing').select('deposit,agreement_fee,processing_fee,sst_amount,stamp_duty,total_product_price,total_financing_amount,monthly_installment,installment_duration,actual_cash_payment').eq('application_id', row.id).maybeSingle(),
      supabase.from('application_products').select('id,product_name,category,model,quantity,product_price,stock_status').eq('application_id', row.id).order('id'),
      supabase.from('application_agreements').select('checking_status,invoice_number,sale_submission_id,claimed_date').eq('application_id', row.id).maybeSingle(),
    ]);
    const detailError = financeResult.error || productResult.error || agreementResult.error;
    if (detailError) setError(detailError.message);
    else setDetail({
      financing: financeResult.data,
      products: productResult.data ?? [],
      agreement: agreementResult.data,
    } as DetailData);
  };

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selected || !form) return;
    setSaving(true); setError(''); setNotice('');
    const { error: saveError } = await supabase.rpc('update_application_customer_details', {
      p_application_id: selected.id,
      p_payload: form,
    });
    if (saveError) setError(saveError.message);
    else {
      setNotice(`Maklumat ${selected.case_id} berjaya dikemas kini. Perubahan direkodkan dalam Application Timeline.`);
      await load();
      const refreshed = rows.find((row) => row.id === selected.id);
      if (refreshed) await open({ ...refreshed, ...formToRow(form) });
      else setSelected(null);
    }
    setSaving(false);
  };

  const formToRow = (value: EditForm): Partial<ApplicationRow> => ({
    customer_name: value.customerName, ic_number: value.icNumber, phone: value.phone,
    address: value.address, ref1_id: value.ref1Id || null,
    customer_from_branch_id: value.customerFromBranchId, pickup_branch_id: value.pickupBranchId || null,
    bank_name: value.bankName || null, bank_account_number: value.bankAccountNumber || null,
    application_remarks: value.applicationRemarks || null, internal_notes: value.internalNotes || null,
    staff_in_charge_id: value.staffInChargeId || null,
  });

  const update = (key: keyof EditForm, value: string) => setForm((previous) => previous ? { ...previous, [key]: value } : previous);
  const physicalBranches = branches.filter((branch) => branch.id !== 'POSTAGE');
  const pickupBranches = branches.filter((branch) => branch.id !== 'WEB');

  return (
    <section className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div><p className="text-xs font-semibold uppercase tracking-widest text-blue-700">Supabase UAT</p><h2 className="mt-1 text-xl font-bold">Application & Customer Management</h2><p className="mt-1 text-sm text-slate-500">Carian rekod, semak butiran permohonan dan kemas kini maklumat pelanggan.</p></div>
        <div className="flex gap-2"><button type="button" onClick={() => void load()} disabled={loading} className="rounded-lg border px-3 py-2 text-sm font-semibold">Refresh</button><button type="button" onClick={onBack} className="rounded-lg border px-3 py-2 text-sm font-semibold">Kembali</button></div>
      </header>
      {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {notice && <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p>}
      <label className="block text-sm font-medium">Carian CASE ID, nama, IC, telefon atau REF1 ID
        <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Taip untuk mencari..." className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" />
      </label>
      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="min-w-[850px] w-full text-left text-xs">
          <thead className="bg-slate-50 uppercase text-slate-500"><tr><th className="p-3">CASE ID / Customer</th><th className="p-3">IC / Phone</th><th className="p-3">Customer From</th><th className="p-3">Application Date</th><th className="p-3">Approval</th><th className="p-3"></th></tr></thead>
          <tbody>
            {filtered.map((row) => <tr key={row.id} className="border-t border-slate-100">
              <td className="p-3"><strong>{row.case_id}</strong><span className="block text-slate-500">{row.customer_name}</span></td>
              <td className="p-3">{row.ic_number}<span className="block text-slate-500">{row.phone}</span></td>
              <td className="p-3">{branchName(row.customer_from_branch_id)}</td>
              <td className="p-3">{row.application_date}</td>
              <td className="p-3">{row.approval_status}</td>
              <td className="p-3"><button type="button" onClick={() => void open(row)} className="rounded-lg border border-blue-200 px-3 py-1.5 font-semibold text-blue-700">View / Edit</button></td>
            </tr>)}
            {!loading && filtered.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-slate-500">Tiada rekod dijumpai.</td></tr>}
            {loading && <tr><td colSpan={6} className="p-8 text-center text-slate-500">Memuatkan permohonan...</td></tr>}
          </tbody>
        </table>
      </div>

      {selected && form && <div className="rounded-xl border border-slate-200 p-4">
        <div className="flex flex-wrap items-start justify-between gap-2"><div><h3 className="text-lg font-bold">{selected.case_id} · {selected.customer_name}</h3><p className="text-sm text-slate-500">Application ID: {selected.id} · Status: {selected.approval_status}</p></div><button type="button" onClick={() => { setSelected(null); setForm(null); }} className="rounded-lg border px-3 py-2 text-sm">Tutup</button></div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-lg bg-slate-50 p-3"><p className="text-xs text-slate-500">Total Financing</p><p className="font-bold">{detail.financing ? money(detail.financing.total_financing_amount) : '—'}</p></div>
          <div className="rounded-lg bg-slate-50 p-3"><p className="text-xs text-slate-500">Actual Cash Payment</p><p className="font-bold">{detail.financing ? money(detail.financing.actual_cash_payment) : '—'}</p></div>
          <div className="rounded-lg bg-slate-50 p-3"><p className="text-xs text-slate-500">Agreement Checking</p><p className="font-bold">{detail.agreement?.checking_status ?? '—'}</p></div>
        </div>
        <div className="mt-3 rounded-lg border border-slate-200 p-3"><h4 className="font-semibold">Product List</h4>{detail.products.length ? detail.products.map((product) => <div key={product.id} className="flex flex-wrap justify-between gap-2 border-t py-2 text-sm"><span>{product.product_name} {product.model ?? ''} × {product.quantity}</span><span>{money(product.product_price)} · {product.stock_status}</span></div>) : <p className="mt-2 text-sm text-slate-500">Tiada produk.</p>}</div>
        <form onSubmit={save} className="mt-4 space-y-4">
          <h4 className="font-semibold">Customer & Application Details</h4>
          <div className="grid gap-3 sm:grid-cols-2">
            {([
              ['customerName','Customer Name'],['icNumber','IC Number'],['phone','Phone'],['ref1Id','REF1 ID (Optional)'],
              ['bankName','Bank Name'],['bankAccountNumber','Bank Account Number'],['staffInChargeId','Staff In Charge ID (Optional)'],
            ] as [keyof EditForm,string][]).map(([key,label]) => <label key={key} className="text-sm font-medium">{label}<input value={form[key]} onChange={(event) => update(key,event.target.value)} required={['customerName','icNumber','phone'].includes(key)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" /></label>)}
            <label className="text-sm font-medium">Customer From Branch<select value={form.customerFromBranchId} onChange={(event) => update('customerFromBranchId',event.target.value)} required className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"><option value="">Pilih cawangan</option>{physicalBranches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select></label>
            <label className="text-sm font-medium">Pickup Branch<select value={form.pickupBranchId} onChange={(event) => update('pickupBranchId',event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"><option value="">— Tiada —</option>{pickupBranches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select></label>
            <label className="text-sm font-medium sm:col-span-2">Address<textarea value={form.address} onChange={(event) => update('address',event.target.value)} rows={2} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" /></label>
            <label className="text-sm font-medium sm:col-span-2">Application Remarks<textarea value={form.applicationRemarks} onChange={(event) => update('applicationRemarks',event.target.value)} rows={2} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" /></label>
            <label className="text-sm font-medium sm:col-span-2">Internal Notes<textarea value={form.internalNotes} onChange={(event) => update('internalNotes',event.target.value)} rows={2} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" /></label>
          </div>
          <p className="text-xs text-slate-500">Maklumat financing, produk, approval dan workflow agreement tidak diubah melalui borang ini. Semua perubahan pelanggan direkodkan dalam Application Timeline.</p>
          <div className="flex flex-wrap gap-2"><button disabled={saving} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{saving ? 'Menyimpan...' : 'Simpan Perubahan'}</button><button type="button" onClick={() => void open(selected)} className="rounded-lg border px-4 py-2 text-sm font-semibold">Reset</button></div>
        </form>
      </div>}
    </section>
  );
}
