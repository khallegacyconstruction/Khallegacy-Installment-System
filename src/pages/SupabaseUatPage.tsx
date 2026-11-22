import { useState, type FormEvent } from 'react';
import { loginWithSupabase, logoutFromSupabase, type SupabaseStaffSession } from '../lib/supabaseAuth';
import { loadSupabaseWorkspaceDirectory, type SupabaseWorkspaceDirectory } from '../lib/supabaseWorkspace';
import { supabase } from '../lib/supabase';
import { ManagerPermissionOverrides } from './ManagerPermissionOverrides';
import { NewApplicationPage } from './NewApplicationPage';
import { ToBeClaimedUatPage } from './ToBeClaimedUatPage';
import { PostageTrackingUatPage } from './PostageTrackingUatPage';
import { SaleSubmissionUatPage } from './SaleSubmissionUatPage';
import { AgreementReceiveUatPage } from './AgreementReceiveUatPage';
import { AgreementCheckingUatPage } from './AgreementCheckingUatPage';
import { StockManagementUatPage } from './StockManagementUatPage';
import { SalesClaimUatPage } from './SalesClaimUatPage';
import { ApplicationCustomerManagementUatPage } from './ApplicationCustomerManagementUatPage';
import { DocumentManagementUatPage } from './DocumentManagementUatPage';
import { ReportsDashboardUatPage } from './ReportsDashboardUatPage';
import { SystemSettingsUatPage } from './SystemSettingsUatPage';
import { createSupabaseApplication, loadSupabaseApplicationCaseIds } from '../lib/supabaseApplications';
import { createNewApplicationTransition, type NewApplicationPayload } from '../utils/businessRules';
import { buildCoverPagePdfBlob } from '../utils/coverPagePdf';

export function SupabaseUatPage() {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [session, setSession] = useState<SupabaseStaffSession | null>(null);
  const [workspace, setWorkspace] = useState<SupabaseWorkspaceDirectory | null>(null);
  const [applicationCaseIds, setApplicationCaseIds] = useState<string[]>([]);
  const [applicationError, setApplicationError] = useState('');
  const [applicationSaving, setApplicationSaving] = useState(false);
  const [activeUatModule, setActiveUatModule] = useState<'home' | 'to-be-claimed' | 'postage' | 'sale-submission' | 'agreement-receive' | 'agreement-checking' | 'stock-management' | 'sales-claim' | 'application-management' | 'documents' | 'reports' | 'system-settings'>('home');

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    setSession(null);
    setWorkspace(null);
    try {
      const signedIn = await loginWithSupabase(identifier, password);
      setSession(signedIn);
      setActiveUatModule('home');
      const [directory, caseIds] = await Promise.all([
        loadSupabaseWorkspaceDirectory(),
        loadSupabaseApplicationCaseIds(),
      ]);
      setWorkspace(directory);
      setApplicationCaseIds(caseIds);
      setPassword('');
    } catch (err) {
      await supabase.auth.signOut().catch(() => undefined);
      setSession(null);
      setWorkspace(null);
      setError(err instanceof Error ? err.message : 'Ujian Supabase gagal.');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateApplication = async (payload: NewApplicationPayload, downloadCoverPage: boolean): Promise<boolean> => {
    setApplicationError('');
    setApplicationSaving(true);
    try {
      if (!session) throw new Error('Sesi Supabase tiada. Sila log masuk semula.');
      const localApplication = createNewApplicationTransition(
        [],
        payload,
        session.user,
        new Date().toISOString(),
      );
      const pdfBlob = downloadCoverPage
        ? await buildCoverPagePdfBlob(localApplication, session.branches, [session.user])
        : null;

      await createSupabaseApplication(payload);
      setApplicationCaseIds((previous) => [payload.caseId, ...previous]);

      if (pdfBlob) {
        const url = URL.createObjectURL(pdfBlob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = `${payload.caseId}-COVER-PAGE.pdf`;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
      return true;
    } catch (err) {
      setApplicationError(err instanceof Error ? err.message : 'Permohonan gagal disimpan.');
      return false;
    } finally {
      setApplicationSaving(false);
    }
  };

  const handleLogout = async () => {
    setLoading(true);
    try {
      await logoutFromSupabase();
      setSession(null);
      setWorkspace(null);
      setActiveUatModule('home');
      setIdentifier('');
      setPassword('');
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Log keluar gagal.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-8 text-slate-900">
      <div className="mx-auto max-w-4xl space-y-6">
        <header className="rounded-2xl bg-slate-900 p-6 text-white">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-300">Khallegacy Installment System</p>
          <h1 className="mt-2 text-2xl font-bold">Supabase UAT Test</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-300">Mod ujian sambungan Supabase. Firebase kekal sebagai sistem operasi asal dan tidak disentuh oleh halaman ujian ini.</p>
          <span className="mt-4 inline-flex rounded-full border border-amber-400/40 bg-amber-400/10 px-3 py-1 text-xs font-semibold text-amber-200">UAT · CONTROLLED WRITE</span>
        </header>

        {!session ? (
          <form onSubmit={handleLogin} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold">1. Uji login Supabase</h2>
            <p className="mt-1 text-sm text-slate-500">Gunakan akaun staf yang sudah mempunyai akaun Supabase Auth. Tiada akaun demo atau kata laluan lalai digunakan.</p>
            {error && <div role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <label className="text-sm font-medium">Username atau email
                <input value={identifier} onChange={(e) => setIdentifier(e.target.value)} autoComplete="username" required className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-blue-600" placeholder="Username / email" />
              </label>
              <label className="text-sm font-medium">Password
                <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" autoComplete="current-password" required className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-blue-600" placeholder="Password Supabase" />
              </label>
            </div>
            <button disabled={loading} className="mt-5 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">{loading ? 'Sedang menguji...' : 'Login & Uji Sambungan'}</button>
          </form>
        ) : (
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div><h2 className="text-lg font-semibold">2. Identiti dan permission</h2><p className="mt-1 text-sm text-slate-500">Sesi Supabase berjaya diwujudkan.</p></div>
              <button onClick={handleLogout} disabled={loading} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold hover:bg-slate-50 disabled:opacity-50">Log keluar</button>
            </div>
            <dl className="mt-5 grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg bg-slate-50 p-3"><dt className="text-xs text-slate-500">Nama staf</dt><dd className="mt-1 font-semibold">{session.user.name}</dd></div>
              <div className="rounded-lg bg-slate-50 p-3"><dt className="text-xs text-slate-500">Username</dt><dd className="mt-1 font-semibold">{session.user.username}</dd></div>
              <div className="rounded-lg bg-slate-50 p-3"><dt className="text-xs text-slate-500">Role</dt><dd className="mt-1 font-semibold">{session.roles.find((r) => r.id === session.user.roleId)?.name ?? session.user.roleId}</dd></div>
              <div className="rounded-lg bg-slate-50 p-3"><dt className="text-xs text-slate-500">Status</dt><dd className="mt-1 font-semibold">{session.user.status}</dd></div>
            </dl>
            <h3 className="mt-5 text-sm font-semibold">Effective permissions ({session.roles.find((r) => r.id === session.user.roleId)?.permissions.length ?? 0})</h3>
            <div className="mt-2 flex flex-wrap gap-2">{(session.roles.find((r) => r.id === session.user.roleId)?.permissions ?? []).map((permission) => <span key={permission} className="rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-800">{permission}</span>)}</div>
            <div className="mt-5 flex flex-wrap gap-2">
              {session.roles.find((r) => r.id === session.user.roleId)?.permissions.includes('create_application') && (
                <button type="button" onClick={() => setActiveUatModule('home')} className={`rounded-lg px-4 py-2 text-sm font-semibold ${activeUatModule === 'home' ? 'bg-blue-600 text-white' : 'border border-slate-300 hover:bg-slate-50'}`}>New Application</button>
              )}
              {(session.roles.find((r) => r.id === session.user.roleId)?.permissions.some((permission) => permission === 'manage_to_be_claimed' || permission === 'manage_agreement')) && (
                <button type="button" onClick={() => setActiveUatModule('to-be-claimed')} className={`rounded-lg px-4 py-2 text-sm font-semibold ${activeUatModule === 'to-be-claimed' ? 'bg-emerald-600 text-white' : 'border border-slate-300 hover:bg-slate-50'}`}>To Be Claimed</button>
              )}
              {session.roles.find((r) => r.id === session.user.roleId)?.permissions.includes('sale_submission') && (
                <button type="button" onClick={() => setActiveUatModule('sale-submission')} className={`rounded-lg px-4 py-2 text-sm font-semibold ${activeUatModule === 'sale-submission' ? 'bg-violet-600 text-white' : 'border border-slate-300 hover:bg-slate-50'}`}>Sale Submission</button>
              )}
              {session.roles.find((r) => r.id === session.user.roleId)?.permissions.includes('manage_stock') && (
                <button type="button" onClick={() => setActiveUatModule('stock-management')} className={`rounded-lg px-4 py-2 text-sm font-semibold ${activeUatModule === 'stock-management' ? 'bg-emerald-600 text-white' : 'border border-slate-300 hover:bg-slate-50'}`}>Stock Management</button>
              )}
              {session.roles.find((r) => r.id === session.user.roleId)?.permissions.includes('receive_agreement') && (
                <button type="button" onClick={() => setActiveUatModule('agreement-receive')} className={`rounded-lg px-4 py-2 text-sm font-semibold ${activeUatModule === 'agreement-receive' ? 'bg-blue-600 text-white' : 'border border-slate-300 hover:bg-slate-50'}`}>Agreement Receive</button>
              )}
              {session.roles.find((r) => r.id === session.user.roleId)?.permissions.includes('manage_agreement') && (
                <button type="button" onClick={() => setActiveUatModule('agreement-checking')} className={`rounded-lg px-4 py-2 text-sm font-semibold ${activeUatModule === 'agreement-checking' ? 'bg-emerald-600 text-white' : 'border border-slate-300 hover:bg-slate-50'}`}>Agreement Checking</button>
              )}
              {session.roles.find((r) => r.id === session.user.roleId)?.permissions.includes('manage_settings') && (
                <button type="button" onClick={() => setActiveUatModule('system-settings')} className={`rounded-lg px-4 py-2 text-sm font-semibold ${activeUatModule === 'system-settings' ? 'bg-slate-700 text-white' : 'border border-slate-300 hover:bg-slate-50'}`}>System Settings</button>
              )}
              {session.roles.find((r) => r.id === session.user.roleId)?.permissions.some((permission) => permission === 'view_dashboard' || permission === 'view_reports') && (
                <button type="button" onClick={() => setActiveUatModule('reports')} className={`rounded-lg px-4 py-2 text-sm font-semibold ${activeUatModule === 'reports' ? 'bg-sky-600 text-white' : 'border border-slate-300 hover:bg-slate-50'}`}>Reports & Dashboard</button>
              )}
              {session.roles.find((r) => r.id === session.user.roleId)?.permissions.includes('manage_documents') && (
                <button type="button" onClick={() => setActiveUatModule('documents')} className={`rounded-lg px-4 py-2 text-sm font-semibold ${activeUatModule === 'documents' ? 'bg-cyan-600 text-white' : 'border border-slate-300 hover:bg-slate-50'}`}>Document Management</button>
              )}
              {session.roles.find((r) => r.id === session.user.roleId)?.permissions.includes('manage_applications') && (
                <button type="button" onClick={() => setActiveUatModule('application-management')} className={`rounded-lg px-4 py-2 text-sm font-semibold ${activeUatModule === 'application-management' ? 'bg-indigo-600 text-white' : 'border border-slate-300 hover:bg-slate-50'}`}>Application & Customer Management</button>
              )}
              {session.roles.find((r) => r.id === session.user.roleId)?.permissions.includes('sales_claim') && (
                <button type="button" onClick={() => setActiveUatModule('sales-claim')} className={`rounded-lg px-4 py-2 text-sm font-semibold ${activeUatModule === 'sales-claim' ? 'bg-amber-600 text-white' : 'border border-slate-300 hover:bg-slate-50'}`}>Sales Claim Management</button>
              )}
              {session.roles.find((r) => r.id === session.user.roleId)?.permissions.includes('manage_postage') && (
                <button type="button" onClick={() => setActiveUatModule('postage')} className={`rounded-lg px-4 py-2 text-sm font-semibold ${activeUatModule === 'postage' ? 'bg-blue-600 text-white' : 'border border-slate-300 hover:bg-slate-50'}`}>Postage Management</button>
              )}
            </div>
          </section>
        )}

        {session && activeUatModule === 'home' && <ManagerPermissionOverrides session={session} />}

        {session && activeUatModule === 'system-settings' && session.roles.find((role) => role.id === session.user.roleId)?.permissions.includes('manage_settings') && (
          <SystemSettingsUatPage staffId={session.user.id} onBack={() => setActiveUatModule('home')} />
        )}

        {session && activeUatModule === 'reports' && session.roles.find((role) => role.id === session.user.roleId)?.permissions.some((permission) => permission === 'view_dashboard' || permission === 'view_reports') && (
          <ReportsDashboardUatPage branches={session.branches} canExport={session.roles.find((role) => role.id === session.user.roleId)?.permissions.includes('export_reports') ?? false} onBack={() => setActiveUatModule('home')} />
        )}

        {session && activeUatModule === 'documents' && session.roles.find((role) => role.id === session.user.roleId)?.permissions.includes('manage_documents') && (
          <DocumentManagementUatPage onBack={() => setActiveUatModule('home')} />
        )}

        {session && activeUatModule === 'application-management' && session.roles.find((role) => role.id === session.user.roleId)?.permissions.includes('manage_applications') && (
          <ApplicationCustomerManagementUatPage branches={session.branches} onBack={() => setActiveUatModule('home')} />
        )}

        {session && activeUatModule === 'sales-claim' && session.roles.find((role) => role.id === session.user.roleId)?.permissions.includes('sales_claim') && (
          <SalesClaimUatPage onBack={() => setActiveUatModule('home')} />
        )}

        {session && activeUatModule === 'to-be-claimed' && (
          <ToBeClaimedUatPage onBack={() => setActiveUatModule('home')} />
        )}

        {session && activeUatModule === 'sale-submission' && session.roles.find((role) => role.id === session.user.roleId)?.permissions.includes('sale_submission') && (
          <SaleSubmissionUatPage onBack={() => setActiveUatModule('home')} />
        )}

        {session && activeUatModule === 'stock-management' && session.roles.find((role) => role.id === session.user.roleId)?.permissions.includes('manage_stock') && (
          <StockManagementUatPage branches={session.branches} onBack={() => setActiveUatModule('home')} />
        )}

        {session && activeUatModule === 'agreement-receive' && session.roles.find((role) => role.id === session.user.roleId)?.permissions.includes('receive_agreement') && (
          <AgreementReceiveUatPage onBack={() => setActiveUatModule('home')} />
        )}

        {session && activeUatModule === 'agreement-checking' && session.roles.find((role) => role.id === session.user.roleId)?.permissions.includes('manage_agreement') && (
          <AgreementCheckingUatPage onBack={() => setActiveUatModule('home')} />
        )}

        {session && workspace && activeUatModule === 'postage' && session.roles.find((role) => role.id === session.user.roleId)?.permissions.includes('manage_postage') && (
          <PostageTrackingUatPage
            currentUser={session.user}
            couriers={workspace.couriers}
            onBack={() => setActiveUatModule('home')}
          />
        )}

        {session && activeUatModule === 'home' && workspace && session.roles.find((role) => role.id === session.user.roleId)?.permissions.includes('create_application') && (
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">6. New Application · Supabase UAT</h2>
                <p className="mt-1 text-sm text-slate-500">Simpanan terus ke Supabase UAT. Firebase Production tidak digunakan oleh borang ini.</p>
              </div>
              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">WRITE ENABLED · UAT ONLY</span>
            </div>
            {applicationError && <div role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{applicationError}</div>}
            {applicationSaving && <p role="status" className="mb-3 text-sm text-blue-700">Sedang menyimpan permohonan dan menyediakan Cover Page...</p>}
            <NewApplicationPage
              existingCaseIds={applicationCaseIds}
              branches={session.branches}
              currentUser={session.user}
              onCreateApplication={handleCreateApplication}
              onNavigateApprovalList={() => setApplicationError('Permohonan telah disimpan. Modul Approval List belum disambungkan dalam UAT.')}
              isSaving={applicationSaving}
            />
          </section>
        )}

        {session && activeUatModule === 'home' && !session.roles.find((role) => role.id === session.user.roleId)?.permissions.includes('create_application') && (
          <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            Akaun ini tidak mempunyai permission create_application. Borang New Application tidak dibuka.
          </section>
        )}

        {workspace && activeUatModule === 'home' && (
          <section className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="font-semibold">3. Direktori cawangan ({workspace.branches.length})</h2>
              <ul className="mt-3 divide-y divide-slate-100">{workspace.branches.map((branch) => <li key={branch.id} className="flex items-center justify-between gap-3 py-2 text-sm"><span>{branch.name} <span className="text-slate-400">({branch.code})</span></span><span className="text-xs text-slate-500">{branch.branchType ?? branch.state}</span></li>)}</ul>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="font-semibold">4. Courier ({workspace.couriers.length})</h2>
              <ul className="mt-3 divide-y divide-slate-100">{workspace.couriers.map((courier) => <li key={courier.id} className="flex items-center justify-between gap-3 py-2 text-sm"><span>{courier.name} <span className="text-slate-400">({courier.code})</span></span><span className="text-xs text-slate-500">{courier.active ? 'Active' : 'Inactive'}</span></li>)}</ul>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:col-span-2">
              <h2 className="font-semibold">5. Tetapan sistem</h2>
              <dl className="mt-3 grid gap-3 sm:grid-cols-3">
                <div><dt className="text-xs text-slate-500">Nama sistem</dt><dd className="text-sm font-medium">{workspace.systemPrefs.systemName}</dd></div>
                <div><dt className="text-xs text-slate-500">Syarikat</dt><dd className="text-sm font-medium">{workspace.systemPrefs.companyName}</dd></div>
                <div><dt className="text-xs text-slate-500">Destinasi batch postage</dt><dd className="text-sm font-medium">{workspace.systemPrefs.fixedDispatchDestination}</dd></div>
              </dl>
            </div>
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900 md:col-span-2">LULUS: Login Supabase, pemetaan staf/role/permission dan bacaan direktori serta tetapan berjaya.</div>
          </section>
        )}

        <footer className="text-xs leading-5 text-slate-500">Workflow UAT: Stock Management → Agreement Receive → Agreement Checking → Sale Submission Batch → Postage Management → DELIVERED → To Be Claimed → CLAIMED. Firebase Production tidak digunakan oleh halaman ujian ini.</footer>
      </div>
    </main>
  );
}
