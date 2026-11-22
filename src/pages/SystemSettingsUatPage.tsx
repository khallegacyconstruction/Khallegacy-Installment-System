import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { supabase } from '../lib/supabase';

type BranchRow = { id: string; code: string; name: string; state: string; branch_type: string; active: boolean };
type CourierRow = { id: string; code: string; name: string; tracking_url: string | null; active: boolean };
type SettingsRow = { id: string; notifications: Record<string, unknown>; system_prefs: Record<string, unknown>; updated_at: string; updated_by_staff_id: string | null };

const notificationLabels: Array<[string,string]> = [
  ['notifyOnNewApplication','New Application'],
  ['notifyOnApprovalDecision','Approval Decision'],
  ['notifyOnStockStatusChange','Stock Status Change'],
  ['notifyOnActionPassedStock','Stock Passed'],
  ['notifyOnAgreementReceived','Agreement Received'],
  ['notifyOnCheckingPassed','Agreement Checking Passed'],
  ['notifyOnCheckingFailed','Agreement Checking Failed'],
  ['notifyOnSaleSubmissionCreated','Sale Submission Created'],
  ['notifyOnPostageTrackingUpdate','Postage Tracking Update'],
  ['notifyOnReadyToBeClaimed','Ready To Be Claimed'],
  ['notifyOnAgreementClaimed','Agreement Claimed'],
];

export function SystemSettingsUatPage({ staffId, onBack }: { staffId: string; onBack: () => void }) {
  const [branches,setBranches]=useState<BranchRow[]>([]);
  const [couriers,setCouriers]=useState<CourierRow[]>([]);
  const [settings,setSettings]=useState<SettingsRow|null>(null);
  const [notifications,setNotifications]=useState<Record<string,unknown>>({});
  const [prefs,setPrefs]=useState<Record<string,unknown>>({});
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');
  const [branchForm,setBranchForm]=useState({code:'',name:'',state:'JOHOR',branch_type:'PHYSICAL'});
  const [courierForm,setCourierForm]=useState({code:'',name:'',tracking_url:''});

  const load=useCallback(async()=>{
    setLoading(true);setError('');
    const [branchResult,courierResult,settingsResult]=await Promise.all([
      supabase.from('branches').select('*').order('name'),
      supabase.from('couriers').select('*').order('name'),
      supabase.from('system_settings').select('*').eq('id','default-settings').maybeSingle(),
    ]);
    const loadError=branchResult.error||courierResult.error||settingsResult.error;
    if(loadError)setError(loadError.message);
    setBranches((branchResult.data??[]) as BranchRow[]);
    setCouriers((courierResult.data??[]) as CourierRow[]);
    if(settingsResult.data){
      const row=settingsResult.data as SettingsRow;
      setSettings(row);setNotifications(row.notifications??{});setPrefs(row.system_prefs??{});
    }
    setLoading(false);
  },[]);

  useEffect(()=>{void load();},[load]);

  const saveSettings=async(event:FormEvent<HTMLFormElement>)=>{
    event.preventDefault();if(!settings)return;
    setSaving(true);setError('');setNotice('');
    const {error:saveError}=await supabase.from('system_settings').update({
      notifications,system_prefs:prefs,updated_at:new Date().toISOString(),updated_by_staff_id:staffId,
    }).eq('id','default-settings');
    if(saveError)setError(saveError.message);
    else{setNotice('System Settings berjaya disimpan.');await load();}
    setSaving(false);
  };

  const addBranch=async(event:FormEvent<HTMLFormElement>)=>{
    event.preventDefault();setSaving(true);setError('');setNotice('');
    const code=branchForm.code.trim().toUpperCase();
    const id='br-'+code.toLowerCase();
    const {error:saveError}=await supabase.from('branches').insert({
      id,code,name:branchForm.name.trim(),state:branchForm.state.trim().toUpperCase(),
      branch_type:branchForm.branch_type,active:true,
    });
    if(saveError)setError(saveError.message);
    else{setNotice('Cawangan berjaya ditambah.');setBranchForm({code:'',name:'',state:'JOHOR',branch_type:'PHYSICAL'});await load();}
    setSaving(false);
  };

  const toggleBranch=async(row:BranchRow)=>{
    if(row.branch_type==='POSTAGE'||row.branch_type==='WEB'){setError('POSTAGE dan WEB ialah branch virtual khas dan tidak boleh dinyahaktifkan.');return;}
    setSaving(true);setError('');setNotice('');
    const {error:saveError}=await supabase.from('branches').update({active:!row.active,updated_at:new Date().toISOString()}).eq('id',row.id);
    if(saveError)setError(saveError.message);
    else{setNotice(`Status ${row.name} dikemas kini.`);await load();}
    setSaving(false);
  };

  const addCourier=async(event:FormEvent<HTMLFormElement>)=>{
    event.preventDefault();setSaving(true);setError('');setNotice('');
    const code=courierForm.code.trim().toUpperCase();
    const id='cur-'+code.toLowerCase();
    const {error:saveError}=await supabase.from('couriers').insert({
      id,code,name:courierForm.name.trim(),tracking_url:courierForm.tracking_url.trim()||null,active:true,
    });
    if(saveError)setError(saveError.message);
    else{setNotice('Courier berjaya ditambah.');setCourierForm({code:'',name:'',tracking_url:''});await load();}
    setSaving(false);
  };

  const toggleCourier=async(row:CourierRow)=>{
    setSaving(true);setError('');setNotice('');
    const {error:saveError}=await supabase.from('couriers').update({active:!row.active,updated_at:new Date().toISOString()}).eq('id',row.id);
    if(saveError)setError(saveError.message);
    else{setNotice(`Status ${row.name} dikemas kini.`);await load();}
    setSaving(false);
  };

  const setPref=(key:string,value:unknown)=>setPrefs((old)=>({...old,[key]:value}));
  const setNotification=(key:string,value:boolean)=>setNotifications((old)=>({...old,[key]:value}));

  return <section className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
    <header className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-widest text-blue-700">Supabase UAT</p><h2 className="mt-1 text-xl font-bold">System Settings</h2><p className="mt-1 text-sm text-slate-500">Tetapan sistem, direktori cawangan dan courier yang disimpan dalam database.</p></div><div className="flex gap-2"><button type="button" onClick={()=>void load()} disabled={loading} className="rounded-lg border px-3 py-2 text-sm font-semibold">Refresh</button><button type="button" onClick={onBack} className="rounded-lg border px-3 py-2 text-sm font-semibold">Kembali</button></div></header>
    {error&&<p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    {notice&&<p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p>}
    {loading?<p className="py-8 text-center text-sm text-slate-500">Memuatkan tetapan...</p>:<>
      <form onSubmit={saveSettings} className="rounded-xl border border-slate-200 p-4 space-y-4">
        <h3 className="font-semibold">General Preferences</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm font-medium">System Name<input value={String(prefs.systemName??'')} onChange={(e)=>setPref('systemName',e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"/></label>
          <label className="text-sm font-medium">Company Name<input value={String(prefs.companyName??'')} onChange={(e)=>setPref('companyName',e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"/></label>
          <label className="text-sm font-medium">Auto Archive Days<input type="number" min="0" value={String(prefs.autoArchiveDays??90)} onChange={(e)=>setPref('autoArchiveDays',Number(e.target.value))} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"/></label>
          <label className="text-sm font-medium">Default Page Size<input type="number" min="5" max="200" value={String(prefs.defaultPageSize??10)} onChange={(e)=>setPref('defaultPageSize',Number(e.target.value))} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"/></label>
          <label className="text-sm font-medium">Default Currency<input value={String(prefs.defaultCurrency??'MYR (RM)')} onChange={(e)=>setPref('defaultCurrency',e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"/></label>
          <label className="text-sm font-medium">Fixed Agreement Destination<input value={String(prefs.fixedDispatchDestination??'JCL Credit')} readOnly className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-slate-500"/></label>
        </div>
        <h4 className="font-semibold">Notification Preferences</h4>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {notificationLabels.map(([key,label])=><label key={key} className="flex items-center gap-2 rounded-lg bg-slate-50 p-3 text-sm"><input type="checkbox" checked={Boolean(notifications[key])} onChange={(e)=>setNotification(key,e.target.checked)}/>{label}</label>)}
          <label className="flex items-center gap-2 rounded-lg bg-slate-50 p-3 text-sm"><input type="checkbox" checked={Boolean(notifications.dailyDigestEnabled)} onChange={(e)=>setNotification('dailyDigestEnabled',e.target.checked)}/>Daily Digest</label>
          <label className="flex items-center gap-2 rounded-lg bg-slate-50 p-3 text-sm">Daily Digest Time<input type="time" value={String(notifications.dailyDigestTime??'18:00')} onChange={(e)=>setNotification('dailyDigestTime',e.target.value)} className="ml-auto rounded border border-slate-300 p-1"/></label>
        </div>
        <button disabled={saving} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{saving?'Menyimpan...':'Save System Settings'}</button>
        <p className="text-xs text-slate-500">Fixed Agreement Destination dikunci kepada JCL Credit mengikut workflow semasa.</p>
      </form>

      <div className="rounded-xl border border-slate-200 p-4">
        <h3 className="font-semibold">Branch Management ({branches.length})</h3>
        <p className="mt-1 text-sm text-slate-500">POSTAGE hanya untuk Branch Pickup. WEB hanya untuk Customer From Branch. Rekod cawangan dinyahaktifkan, bukan dipadam, bagi mengekalkan sejarah.</p>
        <div className="mt-3 overflow-x-auto"><table className="min-w-[650px] w-full text-left text-xs"><thead className="bg-slate-50 uppercase text-slate-500"><tr><th className="p-3">Code</th><th className="p-3">Branch</th><th className="p-3">State</th><th className="p-3">Type / Usage</th><th className="p-3">Status</th><th className="p-3"></th></tr></thead><tbody>{branches.map((row)=><tr key={row.id} className="border-t"><td className="p-3">{row.code}</td><td className="p-3 font-semibold">{row.name}</td><td className="p-3">{row.state}</td><td className="p-3">{row.branch_type}{row.branch_type==='POSTAGE'?' · Pickup only':row.branch_type==='WEB'?' · Customer From only':''}</td><td className="p-3">{row.active?'ACTIVE':'INACTIVE'}</td><td className="p-3"><button type="button" disabled={saving||row.branch_type==='POSTAGE'||row.branch_type==='WEB'} onClick={()=>void toggleBranch(row)} className="rounded border px-2 py-1">{row.active?'Deactivate':'Activate'}</button></td></tr>)}</tbody></table></div>
        <form onSubmit={addBranch} className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="text-sm font-medium">Code<input required value={branchForm.code} onChange={(e)=>setBranchForm((v)=>({...v,code:e.target.value}))} className="mt-1 w-full rounded-lg border px-3 py-2"/></label>
          <label className="text-sm font-medium">Branch Name<input required value={branchForm.name} onChange={(e)=>setBranchForm((v)=>({...v,name:e.target.value}))} className="mt-1 w-full rounded-lg border px-3 py-2"/></label>
          <label className="text-sm font-medium">State / Region<input required value={branchForm.state} onChange={(e)=>setBranchForm((v)=>({...v,state:e.target.value}))} className="mt-1 w-full rounded-lg border px-3 py-2"/></label>
          <label className="text-sm font-medium">Branch Type<select value={branchForm.branch_type} onChange={(e)=>setBranchForm((v)=>({...v,branch_type:e.target.value}))} className="mt-1 w-full rounded-lg border px-3 py-2"><option value="PHYSICAL">PHYSICAL</option><option value="AGENT">AGENT</option></select></label>
          <div className="sm:col-span-2 lg:col-span-4"><button disabled={saving} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Add Branch</button></div>
        </form>
      </div>

      <div className="rounded-xl border border-slate-200 p-4">
        <h3 className="font-semibold">Courier Management ({couriers.length})</h3>
        <p className="mt-1 text-sm text-slate-500">Courier dinyahaktifkan dan bukan dipadam supaya rekod postage lama kekal.</p>
        <div className="mt-3 overflow-x-auto"><table className="min-w-[550px] w-full text-left text-xs"><thead className="bg-slate-50 uppercase text-slate-500"><tr><th className="p-3">Code</th><th className="p-3">Courier</th><th className="p-3">Tracking URL</th><th className="p-3">Status</th><th className="p-3"></th></tr></thead><tbody>{couriers.map((row)=><tr key={row.id} className="border-t"><td className="p-3">{row.code}</td><td className="p-3 font-semibold">{row.name}</td><td className="p-3">{row.tracking_url??'—'}</td><td className="p-3">{row.active?'ACTIVE':'INACTIVE'}</td><td className="p-3"><button type="button" disabled={saving} onClick={()=>void toggleCourier(row)} className="rounded border px-2 py-1">{row.active?'Deactivate':'Activate'}</button></td></tr>)}</tbody></table></div>
        <form onSubmit={addCourier} className="mt-4 grid gap-3 sm:grid-cols-3">
          <label className="text-sm font-medium">Code<input required value={courierForm.code} onChange={(e)=>setCourierForm((v)=>({...v,code:e.target.value}))} className="mt-1 w-full rounded-lg border px-3 py-2"/></label>
          <label className="text-sm font-medium">Courier Name<input required value={courierForm.name} onChange={(e)=>setCourierForm((v)=>({...v,name:e.target.value}))} className="mt-1 w-full rounded-lg border px-3 py-2"/></label>
          <label className="text-sm font-medium">Tracking URL<input value={courierForm.tracking_url} onChange={(e)=>setCourierForm((v)=>({...v,tracking_url:e.target.value}))} className="mt-1 w-full rounded-lg border px-3 py-2"/></label>
          <div className="sm:col-span-3"><button disabled={saving} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Add Courier</button></div>
        </form>
      </div>
      {settings&&<p className="text-xs text-slate-400">Last updated: {new Date(settings.updated_at).toLocaleString('en-MY')} · Staff ID: {settings.updated_by_staff_id??'—'}</p>}
    </>}
  </section>;
}
