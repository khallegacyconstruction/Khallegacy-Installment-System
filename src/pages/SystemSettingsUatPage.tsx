import { useState, type FormEvent } from 'react';
import { Lock, RefreshCw, Settings2, Store, Truck, Bell } from 'lucide-react';
import type { Branch, Courier, SystemPreferences, NotificationPreferences } from '../types/khallegacy';

type NotificationToggleKey = Exclude<keyof NotificationPreferences, 'dailyDigestEnabled' | 'dailyDigestTime'>;
const notificationLabels: Array<[NotificationToggleKey, string]> = [
  ['notifyOnNewApplication','New Application'], ['notifyOnApprovalDecision','Approval Decision'],
  ['notifyOnStockStatusChange','Stock Status Change'], ['notifyOnActionPassedStock','Stock Passed'],
  ['notifyOnAgreementReceived','Agreement Received'], ['notifyOnCheckingPassed','Agreement Checking Passed'],
  ['notifyOnCheckingFailed','Agreement Checking Failed'], ['notifyOnSaleSubmissionCreated','Sale Submission Created'],
  ['notifyOnPostageTrackingUpdate','Postage Tracking Update'], ['notifyOnReadyToBeClaimed','Ready To Be Claimed'],
  ['notifyOnAgreementClaimed','Agreement Claimed'],
];

interface Props { branches: Branch[]; couriers: Courier[]; onBack: () => void; }

const defaultPreferences: SystemPreferences = {
  systemName: 'Khallegacy Installment System', companyName: 'Khal Legacy',
  defaultCurrency: 'MYR (RM)', defaultPageSize: 10,
  fixedDispatchDestination: 'JCL Credit', autoArchiveDays: 90,
};
const defaultNotifications: NotificationPreferences = {
  notifyOnNewApplication: true, notifyOnApprovalDecision: true,
  notifyOnStockStatusChange: true, notifyOnActionPassedStock: true,
  notifyOnAgreementReceived: true, notifyOnCheckingPassed: true,
  notifyOnCheckingFailed: true, notifyOnSaleSubmissionCreated: true,
  notifyOnPostageTrackingUpdate: true, notifyOnReadyToBeClaimed: true,
  notifyOnAgreementClaimed: true, dailyDigestEnabled: false, dailyDigestTime: '18:00',
};

export function SystemSettingsUatPage({ branches: initialBranches, couriers: initialCouriers, onBack }: Props) {
  const [branches, setBranches] = useState<Branch[]>(initialBranches.map(item => ({ ...item })));
  const [couriers, setCouriers] = useState<Courier[]>(initialCouriers.map(item => ({ ...item })));
  const [prefs, setPrefs] = useState<SystemPreferences>({ ...defaultPreferences });
  const [notifications, setNotifications] = useState<NotificationPreferences>({ ...defaultNotifications });
  const [branchForm, setBranchForm] = useState({ code: '', name: '', state: 'JOHOR', branchType: 'PHYSICAL' as 'PHYSICAL' | 'AGENT' });
  const [courierForm, setCourierForm] = useState({ code: '', name: '', trackingUrl: '' });
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  const setPref = <K extends keyof SystemPreferences>(key: K, value: SystemPreferences[K]) => setPrefs(old => ({ ...old, [key]: value }));
  const setNotification = <K extends keyof NotificationPreferences>(key: K, value: NotificationPreferences[K]) => setNotifications(old => ({ ...old, [key]: value }));

  const savePreview = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setError('');
    setNotice('Perubahan tetapan disimpan dalam paparan sementara sahaja. Database tidak diubah.');
  };
  const addBranch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setError(''); setNotice('');
    const code = branchForm.code.trim().toUpperCase();
    if (branches.some(item => item.code.toUpperCase() === code)) { setError('Kod cawangan sudah wujud.'); return; }
    setBranches(old => [...old, { id: `preview-${code.toLowerCase()}`, code, name: branchForm.name.trim(), state: branchForm.state.trim().toUpperCase(), branchType: branchForm.branchType, active: true }]);
    setBranchForm({ code: '', name: '', state: 'JOHOR', branchType: 'PHYSICAL' });
    setNotice('Cawangan ditambah dalam paparan sementara.');
  };
  const toggleBranch = (row: Branch) => {
    if (row.branchType === 'POSTAGE' || row.branchType === 'WEB') return;
    setBranches(old => old.map(item => item.id === row.id ? { ...item, active: !item.active } : item));
    setNotice(`Status ${row.name} dikemas kini dalam paparan sementara.`);
  };
  const addCourier = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setError(''); setNotice('');
    const code = courierForm.code.trim().toUpperCase();
    if (couriers.some(item => item.code.toUpperCase() === code)) { setError('Kod courier sudah wujud.'); return; }
    setCouriers(old => [...old, { id: `preview-${code.toLowerCase()}`, code, name: courierForm.name.trim(), trackingUrl: courierForm.trackingUrl.trim(), active: true }]);
    setCourierForm({ code: '', name: '', trackingUrl: '' });
    setNotice('Courier ditambah dalam paparan sementara.');
  };
  const toggleCourier = (row: Courier) => {
    setCouriers(old => old.map(item => item.id === row.id ? { ...item, active: !item.active } : item));
    setNotice(`Status ${row.name} dikemas kini dalam paparan sementara.`);
  };

  return <section className="space-y-5">
    <header className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-widest text-blue-700">Supabase UAT · UI Preview</p><h1 className="mt-1 text-2xl font-bold">System Settings</h1><p className="mt-1 text-sm text-slate-500">Tetapan umum, notifikasi, direktori cawangan dan courier.</p></div><div className="flex gap-2"><button type="button" onClick={() => { setBranches(initialBranches.map(item => ({ ...item }))); setCouriers(initialCouriers.map(item => ({ ...item }))); setPrefs({ ...defaultPreferences }); setNotifications({ ...defaultNotifications }); setNotice('Paparan sementara dipulihkan kepada nilai asal.'); setError(''); }} className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold"><RefreshCw className="h-4 w-4" /> Reset Preview</button><button type="button" onClick={onBack} className="rounded-lg border px-3 py-2 text-sm font-semibold">Kembali</button></div></header>
    <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-900"><Lock className="mt-0.5 h-4 w-4 shrink-0"/><div><p className="text-sm font-semibold">Mod paparan sahaja · Tiada database write</p><p className="mt-0.5 text-xs leading-5">Semua perubahan di halaman ini hanya disimpan dalam state sementara browser. Tiada rekod Supabase ditambah, dikemas kini atau dinyahaktifkan.</p></div></div>
    {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    {notice && <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p>}
    <form onSubmit={savePreview} className="space-y-4 rounded-xl border border-slate-200 bg-white p-4">
      <h2 className="flex items-center gap-2 font-semibold"><Settings2 className="h-4 w-4 text-blue-700"/> General Preferences</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <label className="text-sm font-medium">System Name<input value={prefs.systemName} onChange={e => setPref('systemName', e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2"/></label>
        <label className="text-sm font-medium">Company Name<input value={prefs.companyName} onChange={e => setPref('companyName', e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2"/></label>
        <label className="text-sm font-medium">Auto Archive Days<input type="number" min="0" value={prefs.autoArchiveDays} onChange={e => setPref('autoArchiveDays', Number(e.target.value))} className="mt-1 w-full rounded-lg border px-3 py-2"/></label>
        <label className="text-sm font-medium">Default Page Size<input type="number" min="5" max="200" value={prefs.defaultPageSize} onChange={e => setPref('defaultPageSize', Number(e.target.value))} className="mt-1 w-full rounded-lg border px-3 py-2"/></label>
        <label className="text-sm font-medium">Default Currency<input value={prefs.defaultCurrency} onChange={e => setPref('defaultCurrency', e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2"/></label>
        <label className="text-sm font-medium">Fixed Agreement Destination<input value="JCL Credit" readOnly className="mt-1 w-full rounded-lg border bg-slate-50 px-3 py-2 text-slate-500"/></label>
      </div>
      <h3 className="flex items-center gap-2 font-semibold"><Bell className="h-4 w-4 text-blue-700"/> Notification Preferences</h3>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {notificationLabels.map(([key,label]) => <label key={key} className="flex items-center gap-2 rounded-lg bg-slate-50 p-3 text-sm"><input type="checkbox" checked={notifications[key]} onChange={e => setNotification(key, e.target.checked)}/>{label}</label>)}
        <label className="flex items-center gap-2 rounded-lg bg-slate-50 p-3 text-sm"><input type="checkbox" checked={notifications.dailyDigestEnabled} onChange={e => setNotification('dailyDigestEnabled', e.target.checked)}/>Daily Digest</label>
        <label className="flex items-center gap-2 rounded-lg bg-slate-50 p-3 text-sm">Daily Digest Time<input type="time" value={notifications.dailyDigestTime} onChange={e => setNotification('dailyDigestTime', e.target.value)} className="ml-auto rounded border p-1"/></label>
      </div>
      <button className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white">Save Preview</button>
    </form>
    <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-4">
      <div><h2 className="flex items-center gap-2 font-semibold"><Store className="h-4 w-4 text-blue-700"/> Branch Management ({branches.length})</h2><p className="mt-1 text-xs leading-5 text-slate-500">POSTAGE hanya untuk Branch Pickup. WEB hanya untuk Customer From Branch. Kedua-dua branch virtual ini dikekalkan dan tidak boleh dinyahaktifkan.</p></div>
      <div className="overflow-x-auto"><table className="min-w-[680px] w-full text-left text-xs"><thead className="bg-slate-50 uppercase text-slate-500"><tr><th className="p-3">Code</th><th className="p-3">Branch</th><th className="p-3">State</th><th className="p-3">Type / Usage</th><th className="p-3">Status</th><th className="p-3"></th></tr></thead><tbody>{branches.map(row => <tr key={row.id} className="border-t"><td className="p-3">{row.code}</td><td className="p-3 font-semibold">{row.name}</td><td className="p-3">{row.state}</td><td className="p-3">{row.branchType ?? 'PHYSICAL'}{row.branchType === 'POSTAGE' ? ' · Pickup only' : row.branchType === 'WEB' ? ' · Customer From only' : ''}</td><td className="p-3">{row.active ? 'ACTIVE' : 'INACTIVE'}</td><td className="p-3"><button type="button" disabled={row.branchType === 'POSTAGE' || row.branchType === 'WEB'} onClick={() => toggleBranch(row)} className="rounded border px-2 py-1 disabled:opacity-40">{row.active ? 'Deactivate' : 'Activate'}</button></td></tr>)}</tbody></table></div>
      <form onSubmit={addBranch} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="text-sm font-medium">Code<input required value={branchForm.code} onChange={e => setBranchForm(old => ({...old,code:e.target.value}))} className="mt-1 w-full rounded-lg border px-3 py-2"/></label>
        <label className="text-sm font-medium">Branch Name<input required value={branchForm.name} onChange={e => setBranchForm(old => ({...old,name:e.target.value}))} className="mt-1 w-full rounded-lg border px-3 py-2"/></label>
        <label className="text-sm font-medium">State / Region<input required value={branchForm.state} onChange={e => setBranchForm(old => ({...old,state:e.target.value}))} className="mt-1 w-full rounded-lg border px-3 py-2"/></label>
        <label className="text-sm font-medium">Branch Type<select value={branchForm.branchType} onChange={e => setBranchForm(old => ({...old,branchType:e.target.value as 'PHYSICAL'|'AGENT'}))} className="mt-1 w-full rounded-lg border bg-white px-3 py-2"><option value="PHYSICAL">PHYSICAL</option><option value="AGENT">AGENT</option></select></label>
        <div className="sm:col-span-2 lg:col-span-4"><button className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white">Add Branch Preview</button></div>
      </form>
    </section>
    <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-4">
      <div><h2 className="flex items-center gap-2 font-semibold"><Truck className="h-4 w-4 text-blue-700"/> Courier Management ({couriers.length})</h2><p className="mt-1 text-xs text-slate-500">Courier dinyahaktifkan, bukan dipadam, supaya rekod postage lama kekal.</p></div>
      <div className="overflow-x-auto"><table className="min-w-[560px] w-full text-left text-xs"><thead className="bg-slate-50 uppercase text-slate-500"><tr><th className="p-3">Code</th><th className="p-3">Courier</th><th className="p-3">Tracking URL</th><th className="p-3">Status</th><th className="p-3"></th></tr></thead><tbody>{couriers.map(row => <tr key={row.id} className="border-t"><td className="p-3">{row.code}</td><td className="p-3 font-semibold">{row.name}</td><td className="p-3">{row.trackingUrl || '—'}</td><td className="p-3">{row.active ? 'ACTIVE' : 'INACTIVE'}</td><td className="p-3"><button type="button" onClick={() => toggleCourier(row)} className="rounded border px-2 py-1">{row.active ? 'Deactivate' : 'Activate'}</button></td></tr>)}</tbody></table></div>
      <form onSubmit={addCourier} className="grid gap-3 sm:grid-cols-3">
        <label className="text-sm font-medium">Code<input required value={courierForm.code} onChange={e => setCourierForm(old => ({...old,code:e.target.value}))} className="mt-1 w-full rounded-lg border px-3 py-2"/></label>
        <label className="text-sm font-medium">Courier Name<input required value={courierForm.name} onChange={e => setCourierForm(old => ({...old,name:e.target.value}))} className="mt-1 w-full rounded-lg border px-3 py-2"/></label>
        <label className="text-sm font-medium">Tracking URL<input type="url" value={courierForm.trackingUrl} onChange={e => setCourierForm(old => ({...old,trackingUrl:e.target.value}))} className="mt-1 w-full rounded-lg border px-3 py-2"/></label>
        <div className="sm:col-span-3"><button className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white">Add Courier Preview</button></div>
      </form>
    </section>
  </section>;
}
