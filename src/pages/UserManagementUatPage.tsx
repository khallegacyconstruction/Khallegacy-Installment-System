import { useMemo, useState, type FormEvent } from 'react';
import { Search, Users, UserPlus, Pencil, UserCheck, UserX, Info, Lock } from 'lucide-react';
import type { Branch, RoleConfig, StaffUser } from '../types/khallegacy';
import { RoleManagementUatPage } from './RoleManagementUatPage';

type UserDraft = Pick<StaffUser, 'name' | 'username' | 'email' | 'branchId' | 'roleId' | 'status'>;
interface Props { currentUser: StaffUser; roles: RoleConfig[]; branches: Branch[]; }
const FIXED_ROLE_NAMES = ['Management', 'Manager', 'Sales Admin'];

export function UserManagementUatPage({ currentUser, roles, branches }: Props) {
  const [tab, setTab] = useState<'users' | 'roles'>('users');
  const [users, setUsers] = useState<StaffUser[]>([{ ...currentUser }]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Active' | 'Inactive'>('All');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const allowedRoles = useMemo(() => FIXED_ROLE_NAMES.map(name => roles.find(role => role.name === name)).filter((role): role is RoleConfig => Boolean(role)), [roles]);
  const assignableBranches = useMemo(() => branches.filter(branch => branch.active && ['PHYSICAL', 'AGENT'].includes(branch.branchType ?? 'PHYSICAL')), [branches]);
  const [draft, setDraft] = useState<UserDraft>({ name: '', username: '', email: '', branchId: assignableBranches[0]?.id ?? '', roleId: allowedRoles.find(role => role.name === 'Sales Admin')?.id ?? allowedRoles[0]?.id ?? '', status: 'Active' });
  const [formError, setFormError] = useState('');
  const filteredUsers = useMemo(() => users.filter(user => {
    const q = search.trim().toLowerCase();
    const match = !q || [user.name, user.username, user.email, user.roleId, user.branchId].some(value => value.toLowerCase().includes(q));
    return match && (statusFilter === 'All' || user.status === statusFilter);
  }), [users, search, statusFilter]);
  const branchName = (id: string) => branches.find(branch => branch.id === id)?.name ?? id;
  const roleName = (id: string) => roles.find(role => role.id === id)?.name ?? id;

  const openAdd = () => {
    setEditingId(null); setFormError('');
    setDraft({ name: '', username: '', email: '', branchId: assignableBranches[0]?.id ?? '', roleId: allowedRoles.find(role => role.name === 'Sales Admin')?.id ?? allowedRoles[0]?.id ?? '', status: 'Active' });
    setModalOpen(true);
  };
  const openEdit = (user: StaffUser) => {
    setEditingId(user.id); setFormError('');
    setDraft({ name: user.name, username: user.username, email: user.email, branchId: user.branchId, roleId: user.roleId, status: user.status });
    setModalOpen(true);
  };
  const saveUser = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!draft.name.trim() || !draft.username.trim() || !draft.email.trim() || !draft.branchId || !draft.roleId) { setFormError('Sila lengkapkan semua maklumat yang diperlukan.'); return; }
    if (users.some(user => user.id !== editingId && (user.username.toLowerCase() === draft.username.trim().toLowerCase() || user.email.toLowerCase() === draft.email.trim().toLowerCase()))) { setFormError('Username atau email ini sudah digunakan dalam senarai sementara.'); return; }
    if (editingId) setUsers(previous => previous.map(user => user.id === editingId ? { ...user, ...draft, name: draft.name.trim(), username: draft.username.trim(), email: draft.email.trim() } : user));
    else setUsers(previous => [...previous, { ...draft, id: `uat-user-${Date.now()}`, name: draft.name.trim(), username: draft.username.trim(), email: draft.email.trim(), lastActive: '' }]);
    setModalOpen(false);
  };
  const toggleStatus = (id: string) => { if (id !== currentUser.id) setUsers(previous => previous.map(user => user.id === id ? { ...user, status: user.status === 'Active' ? 'Inactive' : 'Active' } : user)); };

  return <div className="space-y-5">
    <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div><div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-blue-700"><Users className="h-4 w-4" /> User &amp; Permissions</div><h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">User Management</h1><p className="mt-1 text-sm text-slate-500">Urus akaun staf, penempatan cawangan dan role pengguna.</p></div>
      <span className="inline-flex items-center gap-2 self-start rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800"><Lock className="h-4 w-4" /> UI Preview · Temporary Data</span>
    </header>
    <div className="flex gap-2 border-b border-slate-200">
      <button type="button" onClick={() => setTab('users')} className={`border-b-2 px-3 py-2 text-sm font-semibold ${tab === 'users' ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500'}`}>User Management</button>
      <button type="button" onClick={() => setTab('roles')} className={`border-b-2 px-3 py-2 text-sm font-semibold ${tab === 'roles' ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500'}`}>Role Management</button>
    </div>
    {tab === 'roles' ? <RoleManagementUatPage /> : <>
      <div className="flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4 text-blue-900"><Info className="mt-0.5 h-4 w-4 shrink-0" /><div><p className="text-sm font-semibold">Mod paparan sahaja</p><p className="mt-0.5 text-xs leading-5 text-blue-800">Tambah, edit dan tukar status hanya mengubah data sementara dalam browser. Tiada akaun Supabase Auth atau rekod database dicipta atau dikemas kini.</p></div></div>
      <section className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-xs text-slate-500">Total Staff</p><p className="mt-1 text-2xl font-bold">{users.length}</p></div>
        <div className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-xs text-slate-500">Active</p><p className="mt-1 text-2xl font-bold text-emerald-700">{users.filter(user => user.status === 'Active').length}</p></div>
        <div className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-xs text-slate-500">Inactive</p><p className="mt-1 text-2xl font-bold text-slate-500">{users.filter(user => user.status === 'Inactive').length}</p></div>
      </section>
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="text-sm font-semibold">Staff Directory</h2><p className="mt-0.5 text-xs text-slate-500">Senarai akaun pengguna sistem.</p></div><button type="button" onClick={openAdd} className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white"><UserPlus className="h-4 w-4" /> Add Staff</button></div>
        <div className="flex flex-col gap-2 border-b border-slate-100 p-4 sm:flex-row"><label className="relative block flex-1"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Cari nama, username, email..." className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm" /></label><select value={statusFilter} onChange={event => setStatusFilter(event.target.value as typeof statusFilter)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"><option>All</option><option>Active</option><option>Inactive</option></select></div>
        <div className="overflow-x-auto"><table className="w-full text-left text-xs"><thead><tr className="border-b bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500"><th className="px-4 py-3">Staff</th><th className="px-3 py-3">Username / Email</th><th className="px-3 py-3">Branch</th><th className="px-3 py-3">Role</th><th className="px-3 py-3">Status</th><th className="px-4 py-3 text-right">Action</th></tr></thead><tbody className="divide-y divide-slate-100">
          {filteredUsers.map(user => <tr key={user.id} className="hover:bg-slate-50/70"><td className="whitespace-nowrap px-4 py-3 font-semibold">{user.name}{user.id === currentUser.id && <span className="ml-2 rounded bg-blue-50 px-1.5 py-0.5 text-[10px] text-blue-700">YOU</span>}</td><td className="px-3 py-3"><div>{user.username}</div><div className="mt-0.5 text-slate-500">{user.email}</div></td><td className="whitespace-nowrap px-3 py-3">{branchName(user.branchId)}</td><td className="whitespace-nowrap px-3 py-3">{roleName(user.roleId)}</td><td className="px-3 py-3"><span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${user.status === 'Active' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>{user.status}</span></td><td className="whitespace-nowrap px-4 py-3 text-right"><button type="button" onClick={() => openEdit(user)} className="mr-1 inline-flex items-center gap-1 rounded-md border px-2.5 py-1.5"><Pencil className="h-3 w-3" /> Edit</button><button type="button" disabled={user.id === currentUser.id} onClick={() => toggleStatus(user.id)} className="inline-flex items-center gap-1 rounded-md border px-2.5 py-1.5 disabled:opacity-40">{user.status === 'Active' ? <><UserX className="h-3 w-3" /> Deactivate</> : <><UserCheck className="h-3 w-3" /> Activate</>}</button></td></tr>)}
          {filteredUsers.length === 0 && <tr><td colSpan={6} className="px-4 py-12 text-center text-sm text-slate-400">Tiada pengguna ditemui.</td></tr>}
        </tbody></table></div>
        <div className="border-t border-slate-100 bg-slate-50 px-4 py-3 text-xs text-slate-500">Showing {filteredUsers.length} of {users.length} staff accounts · {allowedRoles.length} fixed roles</div>
      </section>
      {modalOpen && <div className="fixed inset-0 z-[70] flex items-center justify-center overflow-y-auto bg-slate-950/40 p-4"><form onSubmit={saveUser} className="my-8 w-full max-w-2xl rounded-2xl bg-white shadow-2xl">
        <div className="border-b px-5 py-4"><h2 className="text-base font-bold">{editingId ? 'Edit Staff Account' : 'Add Staff Account'}</h2><p className="mt-1 text-xs text-slate-500">Maklumat asas pengguna dan penempatan cawangan.</p></div>
        <div className="grid gap-4 p-5 sm:grid-cols-2">{formError && <div role="alert" className="sm:col-span-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">{formError}</div>}
          <label className="text-xs font-semibold">Staff Name<input value={draft.name} onChange={event => setDraft({ ...draft, name: event.target.value })} className="mt-1.5 w-full rounded-lg border px-3 py-2.5 text-sm font-normal" /></label>
          <label className="text-xs font-semibold">Username<input value={draft.username} onChange={event => setDraft({ ...draft, username: event.target.value })} className="mt-1.5 w-full rounded-lg border px-3 py-2.5 text-sm font-normal" /></label>
          <label className="text-xs font-semibold">Email<input type="email" value={draft.email} onChange={event => setDraft({ ...draft, email: event.target.value })} className="mt-1.5 w-full rounded-lg border px-3 py-2.5 text-sm font-normal" /></label>
          <label className="text-xs font-semibold">Branch<select value={draft.branchId} onChange={event => setDraft({ ...draft, branchId: event.target.value })} className="mt-1.5 w-full rounded-lg border bg-white px-3 py-2.5 text-sm font-normal">{assignableBranches.map(branch => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select></label>
          <label className="text-xs font-semibold">Role<select value={draft.roleId} onChange={event => setDraft({ ...draft, roleId: event.target.value })} className="mt-1.5 w-full rounded-lg border bg-white px-3 py-2.5 text-sm font-normal">{allowedRoles.map(role => <option key={role.id} value={role.id}>{role.name}</option>)}</select></label>
          <label className="text-xs font-semibold">Account Status<select value={draft.status} onChange={event => setDraft({ ...draft, status: event.target.value as UserDraft['status'] })} className="mt-1.5 w-full rounded-lg border bg-white px-3 py-2.5 text-sm font-normal"><option value="Active">Active</option><option value="Inactive">Inactive</option></select></label>
        </div>
        <div className="flex justify-end gap-2 border-t px-5 py-4"><button type="button" onClick={() => setModalOpen(false)} className="rounded-lg border px-4 py-2 text-xs font-semibold">Cancel</button><button type="submit" className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white">Save User</button></div>
      </form></div>}
    </>}
  </div>;
}
