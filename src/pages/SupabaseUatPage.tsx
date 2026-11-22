import { useState, type FormEvent } from 'react';
import { Sidebar } from '../components/Sidebar';
import { TopBar } from '../components/TopBar';
import { loginWithSupabase, logoutFromSupabase, type SupabaseStaffSession } from '../lib/supabaseAuth';
import { loadSupabaseWorkspaceDirectory, type SupabaseWorkspaceDirectory } from '../lib/supabaseWorkspace';
import { supabase } from '../lib/supabase';
import { NewApplicationPage } from './NewApplicationPage';
import { ApprovalListPage } from './ApprovalListPage';
import { ApprovalDetailsPage } from './ApprovalDetailsPage';
import { loadSupabaseApprovalApplications } from '../lib/supabaseApprovalApplications';
import { deleteSupabaseApprovalApplication, updateSupabaseApprovalApplication } from '../lib/supabaseApprovalMutations';
import type { UpdateApplicationDetailsPayload } from '../utils/businessRules';
import type { InstallmentApplication } from '../types/khallegacy';
import { ToBeClaimedUatPage } from './ToBeClaimedUatPage';
import { PostageTrackingUatPage } from './PostageTrackingUatPage';
import { SaleSubmissionUatPage } from './SaleSubmissionUatPage';
import { AgreementReceiveUatPage } from './AgreementReceiveUatPage';
import { AgreementCheckingUatPage } from './AgreementCheckingUatPage';
import { StockManagementUatPage } from './StockManagementUatPage';
import { ReportsDashboardUatPage } from './ReportsDashboardUatPage';
import { SystemSettingsUatPage } from './SystemSettingsUatPage';
import { UserManagementUatPage } from './UserManagementUatPage';
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
  const [approvalApplications, setApprovalApplications] = useState<InstallmentApplication[]>([]);
  const [selectedApprovalApplicationId, setSelectedApprovalApplicationId] = useState<string | null>(null);
  const [lastPageBeforeDetails, setLastPageBeforeDetails] = useState<import('../types/khallegacy').PageId>('approval-list');
  const [approvalLoading, setApprovalLoading] = useState(false);
  const [approvalError, setApprovalError] = useState('');

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    setSession(null);
    setWorkspace(null);
    try {
      const signedIn = await loginWithSupabase(identifier, password);
      setSession(signedIn);
      const [directory, caseIds, applications] = await Promise.all([
        loadSupabaseWorkspaceDirectory(),
        loadSupabaseApplicationCaseIds(),
        loadSupabaseApprovalApplications(),
      ]);
      setWorkspace(directory);
      setApplicationCaseIds(caseIds);
      setApprovalApplications(applications);
      setPassword('');
    } catch (err) {
      await supabase.auth.signOut().catch(() => undefined);
      setSession(null);
      setWorkspace(null);
      setApprovalApplications([]);
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
      const refreshedApplications = await loadSupabaseApprovalApplications();
      setApprovalApplications(refreshedApplications);

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

  const handleDownloadApprovalCoverPage = async (application: InstallmentApplication) => {
    try {
      const pdfBlob = await buildCoverPagePdfBlob(application, session?.branches ?? [], session ? [session.user] : []);
      const url = URL.createObjectURL(pdfBlob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `${application.caseId}-COVER-PAGE.pdf`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      setApprovalError(err instanceof Error ? err.message : 'Cover Page PDF gagal dijana.');
    }
  };

  const handleLogout = async () => {
    setLoading(true);
    try {
      await logoutFromSupabase();
      setSession(null);
      setWorkspace(null);
      setApprovalApplications([]);
      setSelectedApprovalApplicationId(null);
      setIdentifier('');
      setPassword('');
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Log keluar gagal.');
    } finally {
      setLoading(false);
    }
  };

  const currentRole = session?.roles.find((role) => role.id === session.user.roleId) ?? session?.roles[0];
  const hasPermission = (permission: import('../types/khallegacy').PermissionKey) =>
    currentRole?.permissions.includes(permission) ?? false;
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [activePage, setActivePage] = useState<import('../types/khallegacy').PageId>('dashboard');

  const navigateTo = (page: import('../types/khallegacy').PageId) => {
    setActivePage(page);
    setMobileSidebarOpen(false);
    if (page !== 'approval-details') setSelectedApprovalApplicationId(null);
    if (page === 'approval-list') void refreshApprovalApplications();
  };

  const openApprovalDetails = (applicationId: string) => {
    setLastPageBeforeDetails(activePage === 'approval-details' ? 'approval-list' : activePage);
    setSelectedApprovalApplicationId(applicationId);
    setActivePage('approval-details');
    setMobileSidebarOpen(false);
  };

  const selectedApprovalApplication = approvalApplications.find((item) => item.id === selectedApprovalApplicationId) ?? null;

  const refreshApprovalApplications = async (): Promise<boolean> => {
    setApprovalLoading(true);
    setApprovalError('');
    try {
      setApprovalApplications(await loadSupabaseApprovalApplications());
      return true;
    } catch (err) {
      setApprovalError(err instanceof Error ? err.message : 'Senarai Approval gagal dimuatkan.');
      return false;
    } finally {
      setApprovalLoading(false);
    }
  };

  const handleUpdateApprovalDetails = async (appId: string, payload: UpdateApplicationDetailsPayload): Promise<boolean> => {
    setApprovalError('');
    try {
      await updateSupabaseApprovalApplication(appId, payload, session?.user.id ?? '', session?.user.name ?? '');
      return await refreshApprovalApplications();
    } catch (err) {
      setApprovalError(err instanceof Error ? err.message : 'Perubahan Approval Details gagal disimpan.');
      return false;
    }
  };

  const handleDeleteApprovalApplication = async (appId: string): Promise<void> => {
    setApprovalError('');
    try {
      await deleteSupabaseApprovalApplication(appId);
      setSelectedApprovalApplicationId(null);
      setActivePage('approval-list');
      await refreshApprovalApplications();
    } catch (err) {
      setApprovalError(err instanceof Error ? err.message : 'Permohonan gagal dipadam.');
    }
  };

  return !session ? (
    <main className="min-h-screen bg-slate-100 px-4 py-8 text-slate-900">
      <div className="mx-auto max-w-4xl space-y-6">
        <header className="rounded-2xl bg-slate-900 p-6 text-white">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-300">Khallegacy Installment System</p>
          <h1 className="mt-2 text-2xl font-bold">Supabase UAT</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-300">Mod ujian Supabase. Reka bentuk asal Khallegacy dikekalkan; Firebase Production tidak disentuh.</p>
          <span className="mt-4 inline-flex rounded-full border border-amber-400/40 bg-amber-400/10 px-3 py-1 text-xs font-semibold text-amber-200">UAT · CONTROLLED WRITE</span>
        </header>
        <form onSubmit={handleLogin} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold">Login Supabase UAT</h2>
          <p className="mt-1 text-sm text-slate-500">Gunakan akaun staf Supabase yang telah disediakan.</p>
          {error && <div role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-medium">Username atau email
              <input value={identifier} onChange={(e) => setIdentifier(e.target.value)} autoComplete="username" required className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-blue-600" placeholder="Username / email" />
            </label>
            <label className="text-sm font-medium">Password
              <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" autoComplete="current-password" required className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-blue-600" placeholder="Password Supabase" />
            </label>
          </div>
          <button disabled={loading} className="mt-5 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">{loading ? 'Sedang menguji...' : 'Login'}</button>
        </form>
      </div>
    </main>
  ) : (
    <div className="min-h-screen flex bg-slate-100 text-slate-900">
      <Sidebar
        activePage={activePage}
        onNavigate={navigateTo}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed((value) => !value)}
        mobileOpen={mobileSidebarOpen}
        onCloseMobile={() => setMobileSidebarOpen(false)}
        hasPermission={hasPermission}
        onLogout={() => void handleLogout()}
        counts={{ todayNewApplications: 0, stockPending: 0, toBeReceived: 0, pendingChecking: 0, toBeSubmitted: 0, pendingPostage: 0, toBeClaimed: 0 }}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar
          activePage={activePage}
          onNavigate={navigateTo}
          onOpenMobileSidebar={() => setMobileSidebarOpen(true)}
          applications={approvalApplications}
          onSelectApplication={openApprovalDetails}
          recentActivities={[]}
          currentUser={session.user}
          currentRole={currentRole ?? session.roles[0]!}
          allUsers={[session.user]}
          allRoles={session.roles}
          branches={session.branches}
          onSwitchUser={() => undefined}
          onLogout={() => void handleLogout()}
        />
        <main className="mx-auto w-full max-w-[1600px] flex-1 p-4 sm:p-6">
          {activePage === 'new-application' && (
            <section className="space-y-4">
              {applicationError && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{applicationError}</div>}
              {applicationSaving && <p role="status" className="text-sm text-blue-700">Sedang menyimpan permohonan...</p>}
              <NewApplicationPage
                existingCaseIds={applicationCaseIds}
                branches={session.branches}
                currentUser={session.user}
                onCreateApplication={handleCreateApplication}
                onNavigateApprovalList={() => navigateTo('approval-list')}
                isSaving={applicationSaving}
              />
            </section>
          )}
          {activePage === 'approval-list' && (
            <section className="space-y-3">
              {approvalError && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{approvalError}</div>}
              {approvalLoading && <p role="status" className="text-sm text-blue-700">Memuatkan Approval List...</p>}
              <ApprovalListPage
                applications={approvalApplications}
                branches={session.branches}
                users={[session.user]}
                defaultPageSize={10}
                onViewDetails={openApprovalDetails}
              />
            </section>
          )}
          {activePage === 'approval-details' && (
            selectedApprovalApplication ? (
              <>
                {approvalError && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{approvalError}</div>}
                <ApprovalDetailsPage
                  application={selectedApprovalApplication}
                  existingCaseIds={approvalApplications.map((item) => ({ id: item.id, caseId: item.caseId }))}
                  branches={session.branches}
                  users={[session.user]}
                  currentUserName={session.user.name}
                  canDelete={hasPermission('manage_settings')}
                  onBack={() => { setActivePage(lastPageBeforeDetails); setSelectedApprovalApplicationId(null); }}
                  onUpdateDetails={handleUpdateApprovalDetails}
                  onDeleteApplication={handleDeleteApprovalApplication}
                  onDownloadCoverPage={handleDownloadApprovalCoverPage}
                />
              </>
            ) : (
              <div className="rounded-xl border border-slate-200 bg-white p-6">
                <h2 className="text-base font-semibold">Approval Details</h2>
                <p className="mt-1 text-sm text-slate-500">CASE ID tidak ditemui. Kembali ke Approval List dan pilih rekod yang sah.</p>
                <button type="button" onClick={() => navigateTo('approval-list')} className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white">Back to Approval List</button>
              </div>
            )
          )}
          {activePage === 'stock-management' && <StockManagementUatPage branches={session.branches} onBack={() => navigateTo('dashboard')} />}
          {activePage === 'agreement-management' && <AgreementReceiveUatPage onBack={() => navigateTo('dashboard')} />}
          {activePage === 'agreement-checking' && <AgreementCheckingUatPage onBack={() => navigateTo('dashboard')} />}
          {activePage === 'sale-submission' && <SaleSubmissionUatPage onBack={() => navigateTo('dashboard')} />}
          {activePage === 'postage-management' && workspace && <PostageTrackingUatPage currentUser={session.user} couriers={workspace.couriers} onBack={() => navigateTo('dashboard')} />}
          {activePage === 'to-be-claimed' && <ToBeClaimedUatPage onBack={() => navigateTo('dashboard')} />}
          {activePage === 'reports-analytics' && <ReportsDashboardUatPage branches={session.branches} canExport={hasPermission('export_reports')} onBack={() => navigateTo('dashboard')} />}
          {activePage === 'system-settings' && <SystemSettingsUatPage branches={session.branches} couriers={workspace?.couriers ?? []} onBack={() => navigateTo('dashboard')} />}
          {activePage === 'dashboard' && (
            <div className="space-y-5">
              <div className="rounded-xl border border-slate-200 bg-white p-5">
                <h2 className="text-base font-semibold text-slate-900">Dashboard</h2>
                <p className="mt-1 text-sm text-slate-500">Paparan dashboard menggunakan susun atur asal. Data dan kad metrik akan disambungkan semasa semakan fungsi.</p>
                <div className="mt-4 flex flex-wrap gap-2 text-xs">
                  <span className="rounded-full bg-emerald-50 px-3 py-1 font-semibold text-emerald-700">Supabase UAT</span>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-600">{session.user.name} · {currentRole?.name ?? session.user.roleId}</span>
                </div>
              </div>
              {workspace && <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-xl border border-slate-200 bg-white p-5"><h3 className="font-semibold">Branches</h3><p className="mt-1 text-sm text-slate-500">{workspace.branches.length} cawangan dalam direktori</p></div>
                <div className="rounded-xl border border-slate-200 bg-white p-5"><h3 className="font-semibold">Couriers</h3><p className="mt-1 text-sm text-slate-500">{workspace.couriers.length} courier dalam direktori</p></div>
              </div>}
            </div>
          )}
          {activePage === 'user-permissions' && <UserManagementUatPage currentUser={session.user} roles={session.roles} branches={session.branches} />}
          {['agreement-history','claimed-history','backup-data'].includes(activePage) && (
            <div className="rounded-xl border border-slate-200 bg-white p-6">
              <h2 className="text-base font-semibold">{activePage === 'agreement-history' ? 'Agreement History' : activePage === 'claimed-history' ? 'Claimed History & Data' : 'Backup Data'}</h2>
              <p className="mt-1 text-sm text-slate-500">Paparan ini akan disiapkan dalam fasa UI seterusnya.</p>
            </div>
          )}
          {error && <div role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
        </main>
      </div>
    </div>
  );
}
