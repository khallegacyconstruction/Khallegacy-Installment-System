import { useMemo, useState, type FormEvent } from 'react';
import { Plus, Search, Shield, Pencil, Power, X, Users, Info } from 'lucide-react';

type RoleStatus = 'ACTIVE' | 'INACTIVE';
interface RoleDraft {
  id: string;
  name: string;
  description: string;
  status: RoleStatus;
}

const INITIAL_ROLE_DRAFTS: RoleDraft[] = [
  { id: 'role-management', name: 'Management', description: 'Pentadbiran utama dan pemantauan keseluruhan operasi sistem.', status: 'ACTIVE' },
  { id: 'role-manager', name: 'Manager', description: 'Pengurusan operasi cawangan dan penyeliaan pasukan.', status: 'ACTIVE' },
  { id: 'role-sales-admin', name: 'Sales Admin', description: 'Pengurusan permohonan pelanggan dan tugasan operasi harian.', status: 'ACTIVE' },
];

export function RoleManagementUatPage() {
  const [roles, setRoles] = useState<RoleDraft[]>(INITIAL_ROLE_DRAFTS);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | RoleStatus>('ALL');
  const [editingRole, setEditingRole] = useState<RoleDraft | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [formError, setFormError] = useState('');

  const filteredRoles = useMemo(() => roles.filter((role) => {
    const matchesSearch = `${role.name} ${role.description}`.toLowerCase().includes(search.toLowerCase());
    return matchesSearch && (statusFilter === 'ALL' || role.status === statusFilter);
  }), [roles, search, statusFilter]);

  const openCreate = () => {
    setEditingRole(null);
    setName('');
    setDescription('');
    setFormError('');
    setModalOpen(true);
  };

  const openEdit = (role: RoleDraft) => {
    setEditingRole(role);
    setName(role.name);
    setDescription(role.description);
    setFormError('');
    setModalOpen(true);
  };

  const saveRole = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const cleanName = name.trim();
    if (!cleanName) {
      setFormError('Nama role diperlukan.');
      return;
    }
    if (roles.some((role) => role.name.toLowerCase() === cleanName.toLowerCase() && role.id !== editingRole?.id)) {
      setFormError('Nama role ini sudah wujud.');
      return;
    }

    if (editingRole) {
      setRoles((current) => current.map((role) => role.id === editingRole.id
        ? { ...role, name: cleanName, description: description.trim() }
        : role));
    } else {
      setRoles((current) => [...current, {
        id: `draft-role-${Date.now()}`,
        name: cleanName,
        description: description.trim(),
        status: 'ACTIVE',
      }]);
    }
    setModalOpen(false);
  };

  const toggleStatus = (roleId: string) => {
    setRoles((current) => current.map((role) => role.id === roleId
      ? { ...role, status: role.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE' }
      : role));
  };

  const activeCount = roles.filter((role) => role.status === 'ACTIVE').length;

  return (
    <div className="space-y-5">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-blue-700">
            <Shield className="h-4 w-4" /> System Administration
          </div>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">Role Management</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-500">Cipta dan urus kategori role yang digunakan dalam sistem Khallegacy.</p>
        </div>
        <button type="button" onClick={openCreate} className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700">
          <Plus className="h-4 w-4" /> Add New Role
        </button>
      </header>

      <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-900">
        <Info className="mt-0.5 h-4 w-4 shrink-0" />
        <div>
          <p className="text-sm font-semibold">UI Preview — belum disambungkan ke database</p>
          <p className="mt-0.5 text-xs leading-5 text-amber-800">Perubahan di halaman ini hanya sementara dan akan reset apabila halaman dimuat semula. Security level, permission dan akses pengguna belum diubah.</p>
        </div>
      </div>

      <section className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-medium text-slate-500">Total Roles</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">{roles.length}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-medium text-slate-500">Active Roles</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-emerald-700">{activeCount}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-medium text-slate-500">Inactive Roles</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-slate-500">{roles.length - activeCount}</p>
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Role Directory</h2>
            <p className="mt-0.5 text-xs text-slate-500">Senarai role yang tersedia dalam sistem.</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <label className="relative block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search role..." className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-blue-500 sm:w-52" />
            </label>
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as 'ALL' | RoleStatus)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500">
              <option value="ALL">All Status</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-5 py-3 font-semibold">Role Name</th>
                <th className="px-5 py-3 font-semibold">Description</th>
                <th className="px-5 py-3 font-semibold">Status</th>
                <th className="px-5 py-3 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredRoles.map((role) => (
                <tr key={role.id} className="hover:bg-slate-50/70">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-700"><Users className="h-4 w-4" /></span>
                      <div>
                        <p className="font-semibold text-slate-900">{role.name}</p>
                        <p className="mt-0.5 font-mono text-[10px] text-slate-400">{role.id}</p>
                      </div>
                    </div>
                  </td>
                  <td className="max-w-md px-5 py-4 text-xs leading-5 text-slate-600">{role.description || '—'}</td>
                  <td className="px-5 py-4">
                    <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${role.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                      {role.status === 'ACTIVE' ? 'ACTIVE' : 'INACTIVE'}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex justify-end gap-2">
                      <button type="button" onClick={() => openEdit(role)} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50">
                        <Pencil className="h-3.5 w-3.5" /> Edit
                      </button>
                      <button type="button" onClick={() => toggleStatus(role.id)} className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium ${role.status === 'ACTIVE' ? 'border-rose-200 text-rose-700 hover:bg-rose-50' : 'border-emerald-200 text-emerald-700 hover:bg-emerald-50'}`}>
                        <Power className="h-3.5 w-3.5" /> {role.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredRoles.length === 0 && (
                <tr><td colSpan={4} className="px-5 py-12 text-center text-sm text-slate-400">No roles found. Cuba ubah carian atau filter.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {modalOpen && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/40 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setModalOpen(false); }}>
          <form onSubmit={saveRole} className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">{editingRole ? 'Edit Role' : 'Create New Role'}</h2>
                <p className="mt-1 text-sm text-slate-500">Masukkan nama dan penerangan role.</p>
              </div>
              <button type="button" onClick={() => setModalOpen(false)} aria-label="Close" className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><X className="h-5 w-5" /></button>
            </div>
            {formError && <p role="alert" className="mt-4 rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{formError}</p>}
            <label className="mt-5 block text-sm font-medium text-slate-700">Role Name
              <input autoFocus value={name} onChange={(event) => setName(event.target.value)} maxLength={60} required placeholder="Contoh: Supervisor" className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-blue-500" />
            </label>
            <label className="mt-4 block text-sm font-medium text-slate-700">Description
              <textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={3} maxLength={240} placeholder="Penerangan ringkas tanggungjawab role..." className="mt-1.5 w-full resize-y rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-blue-500" />
            </label>
            <div className="mt-6 flex justify-end gap-2">
              <button type="button" onClick={() => setModalOpen(false)} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">Cancel</button>
              <button type="submit" className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">{editingRole ? 'Save Changes' : 'Create Role'}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
