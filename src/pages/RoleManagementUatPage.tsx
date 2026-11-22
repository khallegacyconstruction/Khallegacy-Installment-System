import { useMemo, useState } from 'react';
import { Search, Shield, Users, Info, Lock } from 'lucide-react';

interface FixedRole {
  id: string;
  name: string;
  description: string;
  scope: string;
}

const FIXED_ROLES: FixedRole[] = [
  {
    id: 'role-management',
    name: 'Management',
    description: 'Pentadbiran utama dan pemantauan keseluruhan operasi sistem.',
    scope: 'Pentadbiran sistem',
  },
  {
    id: 'role-manager',
    name: 'Manager',
    description: 'Pengurusan operasi cawangan dan penyeliaan pasukan.',
    scope: 'Pengurusan operasi',
  },
  {
    id: 'role-sales-admin',
    name: 'Sales Admin',
    description: 'Pengurusan permohonan pelanggan dan tugasan operasi harian.',
    scope: 'Operasi jualan',
  },
];

export function RoleManagementUatPage() {
  const [search, setSearch] = useState('');

  const filteredRoles = useMemo(
    () => FIXED_ROLES.filter((role) =>
      `${role.name} ${role.description} ${role.scope}`.toLowerCase().includes(search.toLowerCase())
    ),
    [search],
  );

  return (
    <div className="space-y-5">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-blue-700">
            <Shield className="h-4 w-4" /> System Administration
          </div>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">Role Management</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-500">
            Sistem Khallegacy menggunakan tiga role tetap untuk mengurus akses dan tanggungjawab pengguna.
          </p>
        </div>
        <span className="inline-flex items-center gap-2 self-start rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700">
          <Lock className="h-4 w-4 text-slate-500" /> 3 Fixed Roles
        </span>
      </header>

      <div className="flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4 text-blue-900">
        <Info className="mt-0.5 h-4 w-4 shrink-0" />
        <div>
          <p className="text-sm font-semibold">Role tetap sistem</p>
          <p className="mt-0.5 text-xs leading-5 text-blue-800">
            Management, Manager dan Sales Admin ialah tiga role yang ditetapkan. Role baharu tidak boleh dicipta,
            nama role tidak boleh ditukar dan role tidak boleh dipadam atau dinyahaktifkan.
            Security level serta permission akan dikonfigurasi dalam fasa seterusnya.
          </p>
        </div>
      </div>

      <section className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-medium text-slate-500">Total Fixed Roles</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">3</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-medium text-slate-500">Role Status</p>
          <p className="mt-1 text-sm font-semibold text-emerald-700">All roles permanently available</p>
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Role Directory</h2>
            <p className="mt-0.5 text-xs text-slate-500">Tiga role rasmi yang digunakan dalam sistem.</p>
          </div>
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search role..."
              className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-blue-500 sm:w-64"
            />
          </label>
        </div>

        <div className="divide-y divide-slate-100">
          {filteredRoles.map((role, index) => (
            <div key={role.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
                  <Users className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <p className="font-semibold text-slate-900">{role.name}</p>
                  <p className="mt-0.5 text-xs leading-5 text-slate-500">{role.description}</p>
                  <p className="mt-1 font-mono text-[10px] text-slate-400">{role.id}</p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2 sm:pl-4">
                <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">FIXED ROLE</span>
                <span className="text-xs text-slate-500">{role.scope}</span>
              </div>
            </div>
          ))}
          {filteredRoles.length === 0 && (
            <div className="px-5 py-12 text-center text-sm text-slate-400">No roles found. Cuba ubah carian.</div>
          )}
        </div>
        <div className="border-t border-slate-100 bg-slate-50 px-5 py-3 text-xs text-slate-500">
          Showing {filteredRoles.length} of 3 fixed roles
        </div>
      </section>
    </div>
  );
}
