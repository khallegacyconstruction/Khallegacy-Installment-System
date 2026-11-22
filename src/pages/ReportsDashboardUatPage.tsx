import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Branch } from '../types/khallegacy';
import { supabase } from '../lib/supabase';

type ApplicationRow = {
  id: number; case_id: string; customer_name: string; ic_number: string; phone: string;
  customer_from_branch_id: string; application_date: string; approval_status: string;
};
type FinanceRow = { application_id: number; total_financing_amount: number | string; actual_cash_payment: number | string };
type TaskRow = { application_id: number; stock_status: string; passed_stock: string; agreement_received: string; agreement_checking: string; agreement_submission: string; agreement_claimed: string };
type AgreementRow = { application_id: number; checking_status: string; claimed_date: string | null; sale_submission_id: string | null };
type ReportRow = ApplicationRow & {
  branch_name: string; financing: number; actual_cash: number; stock_status: string;
  agreement_checking: string; submission_status: string; claim_status: string; claimed_date: string | null;
};

const today = () => new Date().toLocaleDateString('en-CA');
const monthStart = () => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toLocaleDateString('en-CA');
};
const money = (value: number) => `RM ${value.toLocaleString('en-MY',{minimumFractionDigits:2,maximumFractionDigits:2})}`;
const csvCell = (value: unknown) => `"${String(value ?? '').replace(/"/g,'""')}"`;

export function ReportsDashboardUatPage({ branches, canExport, onBack }: { branches: Branch[]; canExport: boolean; onBack: () => void }) {
  const [startDate,setStartDate]=useState(monthStart);
  const [endDate,setEndDate]=useState(today);
  const [branchId,setBranchId]=useState('');
  const [rows,setRows]=useState<ReportRow[]>([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');

  const load=useCallback(async()=>{
    setLoading(true);setError('');setNotice('');
    let appQuery=supabase.from('applications')
      .select('id,case_id,customer_name,ic_number,phone,customer_from_branch_id,application_date,approval_status')
      .gte('application_date',startDate).lte('application_date',endDate)
      .order('application_date',{ascending:false}).limit(1000);
    if(branchId) appQuery=appQuery.eq('customer_from_branch_id',branchId);
    const {data:apps,error:appError}=await appQuery;
    if(appError){setError(appError.message);setRows([]);setLoading(false);return;}
    const ids=(apps??[]).map((item)=>item.id);
    if(!ids.length){setRows([]);setLoading(false);return;}
    const [financeResult,taskResult,agreementResult]=await Promise.all([
      supabase.from('application_financing').select('application_id,total_financing_amount,actual_cash_payment').in('application_id',ids),
      supabase.from('application_task_status').select('application_id,stock_status,passed_stock,agreement_received,agreement_checking,agreement_submission,agreement_claimed').in('application_id',ids),
      supabase.from('application_agreements').select('application_id,checking_status,claimed_date,sale_submission_id').in('application_id',ids),
    ]);
    const relatedError=financeResult.error||taskResult.error||agreementResult.error;
    if(relatedError){setError(relatedError.message);setRows([]);setLoading(false);return;}
    const financeMap=new Map((financeResult.data??[]).map((row)=>[row.application_id,row] as const));
    const taskMap=new Map((taskResult.data??[]).map((row)=>[row.application_id,row] as const));
    const agreementMap=new Map((agreementResult.data??[]).map((row)=>[row.application_id,row] as const));
    setRows((apps??[]).map((app)=>{
      const f=financeMap.get(app.id);const t=taskMap.get(app.id);const a=agreementMap.get(app.id);
      return {
        ...app,
        branch_name:branches.find((b)=>b.id===app.customer_from_branch_id)?.name??app.customer_from_branch_id,
        financing:Number(f?.total_financing_amount??0),actual_cash:Number(f?.actual_cash_payment??0),
        stock_status:t?.passed_stock==='PASSED'?'PASSED':t?.stock_status??'—',
        agreement_checking:a?.checking_status??t?.agreement_checking??'—',
        submission_status:t?.agreement_submission??'PENDING',
        claim_status:a?.claimed_date||t?.agreement_claimed==='CLAIMED'?'CLAIMED':'NOT YET CLAIMED',
        claimed_date:a?.claimed_date??null,
      };
    }));
    setLoading(false);
  },[startDate,endDate,branchId,branches]);

  useEffect(()=>{void load();},[load]);

  const totalFinance=useMemo(()=>rows.reduce((sum,row)=>sum+row.financing,0),[rows]);
  const totalCash=useMemo(()=>rows.reduce((sum,row)=>sum+row.actual_cash,0),[rows]);
  const claimed=useMemo(()=>rows.filter((row)=>row.claim_status==='CLAIMED').length,[rows]);
  const pendingChecking=useMemo(()=>rows.filter((row)=>row.agreement_checking!=='PASSED' && row.agreement_checking!=='Checking Passed').length,[rows]);
  const branchSummary=useMemo(()=>{
    const map=new Map<string,{count:number;finance:number;cash:number}>();
    for(const row of rows){const item=map.get(row.branch_name)??{count:0,finance:0,cash:0};item.count+=1;item.finance+=row.financing;item.cash+=row.actual_cash;map.set(row.branch_name,item);}
    return [...map.entries()].sort((a,b)=>b[1].count-a[1].count);
  },[rows]);

  const exportCsv=()=>{
    const header=['Application Date','CASE ID','Customer Name','IC Number','Phone','Branch','Approval Status','Financing Amount','Actual Cash Payment','Stock','Agreement Checking','Submission','Claim Status','Claimed Date'];
    const body=rows.map((r)=>[r.application_date,r.case_id,r.customer_name,r.ic_number,r.phone,r.branch_name,r.approval_status,r.financing.toFixed(2),r.actual_cash.toFixed(2),r.stock_status,r.agreement_checking,r.submission_status,r.claim_status,r.claimed_date??'']);
    const csv=[header,...body].map((line)=>line.map(csvCell).join(',')).join('\r\n');
    const blob=new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8;'});
    const url=URL.createObjectURL(blob);const anchor=document.createElement('a');
    anchor.href=url;anchor.download=`khallegacy-report-${startDate}-to-${endDate}.csv`;
    document.body.appendChild(anchor);anchor.click();anchor.remove();URL.revokeObjectURL(url);
    setNotice('Laporan CSV berjaya dijana.');
  };

  return <section className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
    <header className="flex flex-wrap items-start justify-between gap-3">
      <div><p className="text-xs font-semibold uppercase tracking-widest text-blue-700">Supabase UAT · Live Data</p><h2 className="mt-1 text-xl font-bold">Reports & Dashboard</h2><p className="mt-1 text-sm text-slate-500">Ringkasan operasi dan kewangan berdasarkan rekod Supabase sebenar.</p></div>
      <div className="flex gap-2"><button type="button" onClick={()=>void load()} disabled={loading} className="rounded-lg border px-3 py-2 text-sm font-semibold">Refresh</button><button type="button" onClick={onBack} className="rounded-lg border px-3 py-2 text-sm font-semibold">Kembali</button></div>
    </header>
    {error&&<p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    {notice&&<p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p>}
    <div className="grid gap-3 sm:grid-cols-3">
      <label className="text-sm font-medium">From Date<input type="date" value={startDate} onChange={(e)=>setStartDate(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"/></label>
      <label className="text-sm font-medium">To Date<input type="date" value={endDate} onChange={(e)=>setEndDate(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"/></label>
      <label className="text-sm font-medium">Branch<select value={branchId} onChange={(e)=>setBranchId(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"><option value="">All Branches</option>{branches.map((b)=><option key={b.id} value={b.id}>{b.name}</option>)}</select></label>
    </div>
    <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm text-slate-500">{loading?'Memuatkan data...':`Menunjukkan ${rows.length} permohonan bagi ${startDate} hingga ${endDate}.`}</p>{canExport&&<button type="button" onClick={exportCsv} disabled={loading||rows.length===0} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Export CSV</button>}</div>
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4"><p className="text-xs text-slate-500">Applications</p><p className="mt-1 text-2xl font-bold">{rows.length}</p></div>
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4"><p className="text-xs text-slate-500">Total Financing</p><p className="mt-1 text-xl font-bold">{money(totalFinance)}</p></div>
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4"><p className="text-xs text-slate-500">Actual Cash Payment</p><p className="mt-1 text-xl font-bold">{money(totalCash)}</p></div>
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4"><p className="text-xs text-slate-500">Claimed / Pending Checking</p><p className="mt-1 text-2xl font-bold">{claimed} / {pendingChecking}</p></div>
    </div>
    <div className="rounded-xl border border-slate-200 p-4">
      <h3 className="font-semibold">Branch Performance</h3>
      <div className="mt-3 overflow-x-auto"><table className="min-w-[550px] w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="p-3">Branch</th><th className="p-3 text-right">Applications</th><th className="p-3 text-right">Financing</th><th className="p-3 text-right">Actual Cash</th></tr></thead><tbody>{branchSummary.map(([name,value])=><tr key={name} className="border-t"><td className="p-3">{name}</td><td className="p-3 text-right">{value.count}</td><td className="p-3 text-right">{money(value.finance)}</td><td className="p-3 text-right">{money(value.cash)}</td></tr>)}{branchSummary.length===0&&<tr><td colSpan={4} className="p-5 text-center text-slate-500">Tiada data.</td></tr>}</tbody></table></div>
    </div>
    <div className="rounded-xl border border-slate-200 p-4">
      <h3 className="font-semibold">Application Report</h3>
      <div className="mt-3 overflow-x-auto"><table className="min-w-[1100px] w-full text-left text-xs"><thead className="bg-slate-50 uppercase text-slate-500"><tr><th className="p-3">Date / CASE ID</th><th className="p-3">Customer</th><th className="p-3">Branch</th><th className="p-3">Financing</th><th className="p-3">Actual Cash</th><th className="p-3">Stock</th><th className="p-3">Checking</th><th className="p-3">Submission</th><th className="p-3">Claim</th></tr></thead><tbody>{rows.map((row)=><tr key={row.id} className="border-t"><td className="p-3">{row.application_date}<strong className="block">{row.case_id}</strong></td><td className="p-3">{row.customer_name}<span className="block text-slate-500">{row.ic_number}</span></td><td className="p-3">{row.branch_name}</td><td className="p-3 text-right">{money(row.financing)}</td><td className="p-3 text-right">{money(row.actual_cash)}</td><td className="p-3">{row.stock_status}</td><td className="p-3">{row.agreement_checking}</td><td className="p-3">{row.submission_status}</td><td className="p-3">{row.claim_status}</td></tr>)}{rows.length===0&&<tr><td colSpan={9} className="p-6 text-center text-slate-500">Tiada rekod untuk tempoh ini.</td></tr>}</tbody></table></div>
    </div>
  </section>;
}
