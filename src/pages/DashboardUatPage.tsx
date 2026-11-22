import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';

type TaskRow = {
  application_id: number;
  stock_status: string | null;
  customer_decision: string | null;
  collection_confirmation: string | null;
  passed_stock: string | null;
  agreement_received: string | null;
  agreement_checking: string | null;
  agreement_submission: string | null;
  agreement_claimed: string | null;
};
type AgreementRow = {
  application_id: number;
  received_at: string | null;
  checking_status: string | null;
  sale_submission_id: string | null;
  claimed_date: string | null;
};
type ApplicationRow = {
  id: number;
  case_id: string;
  customer_name: string;
  application_date: string;
  approval_status: string | null;
  created_at: string;
};
type SubmissionRow = {
  id: string;
  submission_list_id: string;
  submission_date: string;
  agreement_count: number;
  total_product_amount: number;
  created_at: string;
};
type TrackingRow = {
  id: string;
  sale_submission_id: string | null;
  status: string;
  updated_at: string;
  tracking_number: string | null;
  courier: string | null;
};

const money = (value: number) => new Intl.NumberFormat('en-MY', {
  style: 'currency', currency: 'MYR', maximumFractionDigits: 0,
}).format(value);
const dateLabel = (value: string) => value
  ? new Date(value + (value.length === 10 ? 'T00:00:00' : '')).toLocaleDateString('en-MY', { day: '2-digit', month: 'short', year: 'numeric' })
  : '—';

interface Props {
  staffName: string;
  onNavigate: (page: 'approval-list' | 'stock-management' | 'agreement-management' | 'agreement-checking' | 'sale-submission' | 'postage-management' | 'to-be-claimed' | 'reports-analytics') => void;
}

export function DashboardUatPage({ staffName, onNavigate }: Props) {
  const [applications, setApplications] = useState<ApplicationRow[]>([]);
  const [applicationCount, setApplicationCount] = useState(0);
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [agreements, setAgreements] = useState<AgreementRow[]>([]);
  const [submissions, setSubmissions] = useState<SubmissionRow[]>([]);
  const [tracking, setTracking] = useState<TrackingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const [countResult, appsResult, taskResult, agreementResult, submissionResult, trackingResult] = await Promise.all([
      supabase.from('applications').select('id', { count: 'exact', head: true }),
      supabase.from('applications').select('id,case_id,customer_name,application_date,approval_status,created_at').order('created_at', { ascending: false }).limit(7),
      supabase.from('application_task_status').select('application_id,stock_status,customer_decision,collection_confirmation,passed_stock,agreement_received,agreement_checking,agreement_submission,agreement_claimed'),
      supabase.from('application_agreements').select('application_id,received_at,checking_status,sale_submission_id,claimed_date'),
      supabase.from('sale_submissions').select('id,submission_list_id,submission_date,agreement_count,total_product_amount,created_at').order('created_at', { ascending: false }).limit(5),
      supabase.from('postage_trackings').select('id,sale_submission_id,status,updated_at,tracking_number,courier').order('updated_at', { ascending: false }),
    ]);
    const firstError = countResult.error || appsResult.error || taskResult.error || agreementResult.error || submissionResult.error || trackingResult.error;
    if (firstError) {
      setError(firstError.message);
      setApplications([]);
      setApplicationCount(0);
      setTasks([]);
      setAgreements([]);
      setSubmissions([]);
      setTracking([]);
    } else {
      setApplicationCount(countResult.count ?? 0);
      setApplications((appsResult.data ?? []) as ApplicationRow[]);
      setTasks((taskResult.data ?? []) as TaskRow[]);
      setAgreements((agreementResult.data ?? []) as AgreementRow[]);
      setSubmissions((submissionResult.data ?? []) as SubmissionRow[]);
      setTracking((trackingResult.data ?? []) as TrackingRow[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const metrics = useMemo(() => {
    const taskById = new Map(tasks.map(row => [row.application_id, row]));
    const agreementById = new Map(agreements.map(row => [row.application_id, row]));
    const approvedIds = new Set(applications.filter(row => row.approval_status === 'Approved').map(row => row.id));
    const passedStock = tasks.filter(row => row.passed_stock === 'PASSED').length;
    const awaitingReceive = tasks.filter(row => row.passed_stock === 'PASSED' && row.agreement_received !== 'RECEIVED').length;
    const checking = tasks.filter(row => row.agreement_received === 'RECEIVED' && row.agreement_checking !== 'PASSED').length;
    const readySubmission = agreements.filter(row => row.checking_status === 'Checking Passed' && !row.sale_submission_id).length;
    const latestTracking = new Map<string, TrackingRow>();
    for (const row of tracking) {
      if (row.sale_submission_id && !latestTracking.has(row.sale_submission_id)) latestTracking.set(row.sale_submission_id, row);
    }
    const activePostage = [...latestTracking.values()].filter(row => ['PENDING', 'IN TRANSIT', 'OUT FOR DELIVERY'].includes(row.status)).length;
    const deliveredIds = new Set([...latestTracking.values()].filter(row => row.status === 'DELIVERED').map(row => row.sale_submission_id));
    const toBeClaimed = agreements.filter(row => row.sale_submission_id && deliveredIds.has(row.sale_submission_id) && !row.claimed_date).length;
    const claimed = agreements.filter(row => !!row.claimed_date).length;
    const approvedTotal = tasks.filter(row => row.passed_stock === 'PASSED').length;
    return { awaitingReceive, checking, readySubmission, activePostage, toBeClaimed, claimed, passedStock, approvedTotal, taskById, agreementById, approvedIds };
  }, [tasks, agreements, tracking, applications]);

  const cards = [
    { label: 'Total Applications', value: applicationCount, note: 'Semua permohonan direkodkan', target: 'approval-list' as const, color: 'blue' },
    { label: 'Awaiting Agreement Receive', value: metrics.awaitingReceive, note: 'Stock passed · belum RECEIVE', target: 'agreement-management' as const, color: 'amber' },
    { label: 'Agreement Checking', value: metrics.checking, note: 'Menunggu checking selesai', target: 'agreement-checking' as const, color: 'indigo' },
    { label: 'Ready Sale Submission', value: metrics.readySubmission, note: 'Checking Passed', target: 'sale-submission' as const, color: 'emerald' },
    { label: 'In Postage', value: metrics.activePostage, note: 'Batch belum DELIVERED', target: 'postage-management' as const, color: 'violet' },
    { label: 'To Be Claimed', value: metrics.toBeClaimed, note: 'Batch DELIVERED · belum CLAIMED', target: 'to-be-claimed' as const, color: 'orange' },
  ];

  return (
    <section className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-blue-700">Supabase UAT · Live Data</p>
          <h1 className="mt-1 text-2xl font-bold text-slate-900">Dashboard</h1>
          <p className="mt-1 text-sm text-slate-500">Selamat datang, {staffName}. Berikut ringkasan operasi Khallegacy.</p>
        </div>
        <button type="button" onClick={() => void load()} disabled={loading} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
          {loading ? 'Memuatkan...' : 'Refresh Data'}
        </button>
      </header>

      {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">Gagal memuatkan Dashboard: {error}</div>}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map(card => (
          <button key={card.label} type="button" onClick={() => onNavigate(card.target)} className="rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-blue-300 hover:shadow-md">
            <p className="text-sm font-medium text-slate-500">{card.label}</p>
            <p className="mt-2 text-3xl font-bold tabular-nums text-slate-900">{loading ? '—' : card.value}</p>
            <p className="mt-2 text-xs text-slate-500">{card.note}</p>
          </button>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 p-4">
            <div><h2 className="font-semibold text-slate-900">Recent Applications</h2><p className="mt-0.5 text-xs text-slate-500">7 permohonan terkini</p></div>
            <button type="button" onClick={() => onNavigate('approval-list')} className="text-xs font-semibold text-blue-700">Lihat semua →</button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="p-3">CASE ID / Customer</th><th className="p-3">Date</th><th className="p-3">Approval</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {applications.map(row => <tr key={row.id}><td className="p-3"><span className="font-semibold text-slate-800">{row.case_id}</span><span className="mt-0.5 block text-xs text-slate-500">{row.customer_name}</span></td><td className="whitespace-nowrap p-3 text-xs text-slate-600">{dateLabel(row.application_date)}</td><td className="p-3"><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">{row.approval_status ?? 'Pending'}</span></td></tr>)}
                {!loading && applications.length === 0 && <tr><td colSpan={3} className="p-6 text-center text-sm text-slate-500">Belum ada permohonan.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 p-4">
            <div><h2 className="font-semibold text-slate-900">Recent Sale Submission</h2><p className="mt-0.5 text-xs text-slate-500">5 batch terkini</p></div>
            <button type="button" onClick={() => onNavigate('sale-submission')} className="text-xs font-semibold text-blue-700">Lihat semua →</button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[460px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="p-3">Batch ID</th><th className="p-3">Date</th><th className="p-3 text-right">Cases</th><th className="p-3 text-right">Product Amount</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {submissions.map(row => <tr key={row.id}><td className="p-3 font-semibold text-slate-800">{row.submission_list_id}</td><td className="whitespace-nowrap p-3 text-xs text-slate-600">{dateLabel(row.submission_date)}</td><td className="p-3 text-right tabular-nums">{row.agreement_count}</td><td className="p-3 text-right tabular-nums">{money(Number(row.total_product_amount ?? 0))}</td></tr>)}
                {!loading && submissions.length === 0 && <tr><td colSpan={4} className="p-6 text-center text-sm text-slate-500">Belum ada batch submission.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div><h2 className="font-semibold text-slate-900">Workflow Snapshot</h2><p className="mt-0.5 text-xs text-slate-500">Status ringkas daripada rekod operasi semasa.</p></div>
          <button type="button" onClick={() => onNavigate('reports-analytics')} className="text-xs font-semibold text-blue-700">Reports & Analytics →</button>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg bg-slate-50 p-3"><p className="text-xs text-slate-500">Stock Passed</p><p className="mt-1 text-xl font-bold tabular-nums">{loading ? '—' : metrics.passedStock}</p></div>
          <div className="rounded-lg bg-slate-50 p-3"><p className="text-xs text-slate-500">Claimed</p><p className="mt-1 text-xl font-bold tabular-nums">{loading ? '—' : metrics.claimed}</p></div>
          <div className="rounded-lg bg-slate-50 p-3"><p className="text-xs text-slate-500">Sale Submission Batches</p><p className="mt-1 text-xl font-bold tabular-nums">{loading ? '—' : submissions.length}</p></div>
        </div>
      </div>
    </section>
  );
}
