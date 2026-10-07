'use client';

import React, { useState } from 'react';
import {
  Users,
  UserPlus,
  Shield,
  ShieldCheck,
  ShieldAlert,
  Key,
  Mail,
  Building,
  CheckCircle2,
  AlertTriangle,
  Lock,
  Unlock,
  RefreshCw,
  Search,
  Filter,
  UserX,
  BadgeCheck,
  Smartphone,
  ExternalLink,
} from 'lucide-react';
import { useConsortiumStore } from '@/lib/store';
import { AppUser } from '@/lib/types';

export default function AdminUsersManagement() {
  const {
    appUsers,
    addUser,
    updateUserRole,
    toggleUserStatus,
    adminSession,
    fintechs,
  } = useConsortiumStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'ALL' | 'admin' | 'usuario'>('ALL');
  const [isAddingUser, setIsAddingUser] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState<'admin' | 'usuario'>('usuario');
  const [newEntityId, setNewEntityId] = useState('CONSORCIO');
  const [tempPassword, setTempPassword] = useState('TempPass#2026');
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Filtrado de usuarios
  const filteredUsers = appUsers.filter(user => {
    const matchesSearch =
      user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (user.entityName || '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = roleFilter === 'ALL' || user.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail.trim()) return;

    setIsLoading(true);
    setStatusMsg(null);

    const selectedEntity = fintechs.find(f => f.id === newEntityId);
    const entityName = newEntityId === 'CONSORCIO' ? 'Gobernanza Central' : (selectedEntity?.name || 'Entidad');

    const res = await addUser({
      email: newEmail.trim(),
      role: newRole,
      entityId: newEntityId,
      entityName,
      tempPassword,
    });

    setIsLoading(false);

    if (res.success) {
      setStatusMsg({ type: 'success', text: res.message });
      setNewEmail('');
      setIsAddingUser(false);
      setTimeout(() => setStatusMsg(null), 5000);
    } else {
      setStatusMsg({ type: 'error', text: res.message });
    }
  };

  const handleRoleChange = async (userId: string, newRoleValue: 'admin' | 'usuario') => {
    const res = await updateUserRole(userId, newRoleValue);
    if (res.success) {
      setStatusMsg({ type: 'success', text: res.message });
      setTimeout(() => setStatusMsg(null), 4000);
    }
  };

  const handleToggleStatus = async (userId: string) => {
    const res = await toggleUserStatus(userId);
    if (res.success) {
      setStatusMsg({ type: 'success', text: res.message });
      setTimeout(() => setStatusMsg(null), 4000);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* ── Header con Resumen ── */}
      <div className="p-6 bg-[#0c1628] border border-[#1e365b] rounded-2xl shadow-xl flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-[#1d4ed8] to-[#1e40af] text-white shadow-lg border border-blue-400/40">
              <Users className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white">
                  Gestión de Accesos, Roles y Políticas RBAC
                </h2>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/40 font-bold">
                  Supabase Auth Guard
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold">
                  2FA Obligatorio
                </span>
              </div>
              <p className="text-xs text-[#94a3b8] mt-0.5">
                Control centralizado de identidades institucionales y delegación de privilegios de Administrador y Usuario.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsAddingUser(!isAddingUser)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#1d4ed8] hover:bg-[#2563eb] text-white text-xs font-semibold shadow-[0_0_15px_rgba(29,78,216,0.35)] border border-[#3b82f6]/50 transition-all"
          >
            <UserPlus className="w-4 h-4" />
            <span>Dar de Alta Usuario</span>
          </button>
        </div>
      </div>

      {/* ── Banner de Política de Seguridad ── */}
      <div className="p-4 bg-[#0a1832] border border-[#1e4277] rounded-xl flex items-start gap-3">
        <ShieldCheck className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
        <div className="text-xs text-[#cbd5e1] space-y-1">
          <p className="font-semibold text-white">
            Registro Público Deshabilitado por Política BCRA / Zero-Trust
          </p>
          <p className="text-[#94a3b8] leading-relaxed">
            Por estrictas normas regulatorias bancarias, ningún usuario puede registrarse de manera autónoma. 
            El acceso al sistema está restringido únicamente a cuentas previamente autorizadas por la Gobernanza Central. 
            Los administradores con rol <strong className="text-blue-300">admin</strong> tienen privilegios para operar la infraestructura, mientras que el rol <strong className="text-cyan-300">usuario</strong> solo puede realizar consultas y reportes en su entidad.
          </p>
        </div>
      </div>

      {/* Notificaciones */}
      {statusMsg && (
        <div
          className={`p-4 rounded-xl text-xs flex items-center gap-2 border animate-in fade-in ${
            statusMsg.type === 'success'
              ? 'bg-emerald-950/80 border-emerald-500/50 text-emerald-200'
              : 'bg-rose-950/80 border-rose-500/50 text-rose-200'
          }`}
        >
          {statusMsg.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
          )}
          <span>{statusMsg.text}</span>
        </div>
      )}

      {/* ── Formulario de Alta de Usuario ── */}
      {isAddingUser && (
        <div className="p-6 bg-[#0d182e] border border-[#1e365b] rounded-2xl shadow-xl animate-in fade-in duration-200 space-y-4">
          <div className="flex items-center justify-between border-b border-[#17253d] pb-3">
            <h3 className="text-xs font-bold text-white uppercase tracking-wide flex items-center gap-2">
              <UserPlus className="w-4 h-4 text-blue-400" />
              <span>Alta de Nueva Cuenta Institucional</span>
            </h3>
            <span className="text-[11px] font-mono text-[#94a3b8]">
              Se exigirá 2FA TOTP obligatorio en el primer inicio de sesión
            </span>
          </div>

          <form onSubmit={handleCreateUser} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-medium text-[#cbd5e1] mb-1.5">
                  Correo Electrónico Oficial *
                </label>
                <div className="relative">
                  <input
                    type="email"
                    required
                    value={newEmail}
                    onChange={e => setNewEmail(e.target.value)}
                    placeholder="ej: operador@bancosocio.com.ar"
                    className="w-full px-3.5 py-2 pl-9 bg-[#060c17] border border-[#1e365b] rounded-xl text-xs text-white placeholder-[#475569] focus:outline-none focus:border-[#3b82f6]"
                  />
                  <Mail className="w-3.5 h-3.5 text-[#64748b] absolute left-3 top-2.5" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#cbd5e1] mb-1.5">
                  Rol Asignado *
                </label>
                <select
                  value={newRole}
                  onChange={e => setNewRole(e.target.value as 'admin' | 'usuario')}
                  className="w-full px-3.5 py-2 bg-[#060c17] border border-[#1e365b] rounded-xl text-xs text-white focus:outline-none focus:border-[#3b82f6]"
                >
                  <option value="usuario">Usuario General (Analista / Consultas)</option>
                  <option value="admin">Administrador (Control de Gobernanza & Red)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#cbd5e1] mb-1.5">
                  Entidad Financiera *
                </label>
                <select
                  value={newEntityId}
                  onChange={e => setNewEntityId(e.target.value)}
                  className="w-full px-3.5 py-2 bg-[#060c17] border border-[#1e365b] rounded-xl text-xs text-white focus:outline-none focus:border-[#3b82f6]"
                >
                  <option value="CONSORCIO">Consorcio Central (Gobernanza)</option>
                  {fintechs.map(f => (
                    <option key={f.id} value={f.id}>
                      {f.name} ({f.id})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#cbd5e1] mb-1.5">
                  Contraseña Provisoria *
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={tempPassword}
                    onChange={e => setTempPassword(e.target.value)}
                    className="w-full px-3.5 py-2 pl-9 bg-[#060c17] border border-[#1e365b] rounded-xl text-xs text-white focus:outline-none focus:border-[#3b82f6] font-mono"
                  />
                  <Key className="w-3.5 h-3.5 text-[#64748b] absolute left-3 top-2.5" />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsAddingUser(false)}
                className="px-4 py-2 rounded-xl bg-[#13233e] text-[#94a3b8] text-xs font-medium hover:bg-[#1a3052] border border-[#203c68]"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isLoading}
                className="px-5 py-2 rounded-xl bg-[#1d4ed8] hover:bg-[#2563eb] text-white text-xs font-semibold shadow-sm border border-[#3b82f6]/50 flex items-center gap-2"
              >
                {isLoading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                <span>Crear Cuenta y Autorizar</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── Toolbar de Búsqueda y Filtros ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="relative w-64 sm:w-80">
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Buscar por correo o entidad..."
              className="w-full px-3.5 py-2 pl-9 bg-[#060c17] border border-[#1e365b] rounded-xl text-xs text-white placeholder-[#475569] focus:outline-none focus:border-[#3b82f6]"
            />
            <Search className="w-3.5 h-3.5 text-[#64748b] absolute left-3 top-2.5" />
          </div>

          <div className="flex items-center gap-1.5 bg-[#091222] border border-[#1e365b] rounded-xl p-1">
            <button
              onClick={() => setRoleFilter('ALL')}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition ${
                roleFilter === 'ALL'
                  ? 'bg-[#1d4ed8] text-white'
                  : 'text-[#94a3b8] hover:text-white'
              }`}
            >
              Todos ({appUsers.length})
            </button>
            <button
              onClick={() => setRoleFilter('admin')}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition ${
                roleFilter === 'admin'
                  ? 'bg-[#1d4ed8] text-white'
                  : 'text-[#94a3b8] hover:text-white'
              }`}
            >
              Admins ({appUsers.filter(u => u.role === 'admin').length})
            </button>
            <button
              onClick={() => setRoleFilter('usuario')}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition ${
                roleFilter === 'usuario'
                  ? 'bg-[#1d4ed8] text-white'
                  : 'text-[#94a3b8] hover:text-white'
              }`}
            >
              Usuarios ({appUsers.filter(u => u.role === 'usuario').length})
            </button>
          </div>
        </div>

        <span className="text-xs text-[#94a3b8] font-mono">
          Mostrando {filteredUsers.length} de {appUsers.length} cuentas registradas
        </span>
      </div>

      {/* ── Tabla de Cuentas y Roles ── */}
      <div className="bg-[#0d182e] border border-[#1e365b] rounded-2xl shadow-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#081223] text-[#94a3b8] uppercase text-[11px] font-semibold border-b border-[#17253d]">
              <tr>
                <th className="px-5 py-3.5">Usuario / Correo</th>
                <th className="px-5 py-3.5">Rol de Acceso</th>
                <th className="px-5 py-3.5">Entidad Asociada</th>
                <th className="px-5 py-3.5">Seguridad 2FA</th>
                <th className="px-5 py-3.5">Estado</th>
                <th className="px-5 py-3.5">Último Acceso</th>
                <th className="px-5 py-3.5 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#17253d] text-[#cbd5e1]">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-8 text-center text-[#64748b]">
                    No se encontraron usuarios que coincidan con la búsqueda.
                  </td>
                </tr>
              ) : (
                filteredUsers.map(user => {
                  const isSuperAdminEmail =
                    user.email === 'andresalaniz8@gmail.com' ||
                    user.email === 'alan.morales778@gmail.com';

                  return (
                    <tr key={user.id} className="hover:bg-[#0a162b] transition">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-blue-950/70 border border-blue-500/30 text-blue-300 flex items-center justify-center font-bold text-xs uppercase">
                            {user.email.slice(0, 2)}
                          </div>
                          <div>
                            <span className="font-semibold text-white block">
                              {user.email}
                            </span>
                            {isSuperAdminEmail && (
                              <span className="inline-flex items-center gap-1 text-[10px] text-amber-400 font-mono">
                                <BadgeCheck className="w-3 h-3" /> Admin Fundador
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      <td className="px-5 py-3.5">
                        <select
                          value={user.role}
                          disabled={isSuperAdminEmail}
                          onChange={e => handleRoleChange(user.id, e.target.value as 'admin' | 'usuario')}
                          className={`px-2.5 py-1 rounded-lg text-xs font-semibold border focus:outline-none transition ${
                            user.role === 'admin'
                              ? 'bg-blue-950/80 text-blue-300 border-blue-500/50'
                              : 'bg-slate-900 text-slate-300 border-slate-700'
                          } ${isSuperAdminEmail ? 'opacity-80 cursor-not-allowed' : 'cursor-pointer hover:border-blue-400'}`}
                        >
                          <option value="admin">🛡️ Admin (Gobernanza)</option>
                          <option value="usuario">👤 Usuario (Consultas)</option>
                        </select>
                      </td>

                      <td className="px-5 py-3.5">
                        <span className="font-medium text-white block">
                          {user.entityName || 'Consorcio Central'}
                        </span>
                        <span className="text-[10px] text-[#64748b] font-mono">
                          ID: {user.entityId || 'CONSORCIO'}
                        </span>
                      </td>

                      <td className="px-5 py-3.5">
                        {user.totpEnrolled ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 font-medium text-[11px]">
                            <Smartphone className="w-3 h-3 text-emerald-400" />
                            <span>TOTP Enrolado</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-950/60 border border-amber-500/40 text-amber-300 font-medium text-[11px]">
                            <AlertTriangle className="w-3 h-3 text-amber-400" />
                            <span>Pendiente de Vinculación</span>
                          </span>
                        )}
                      </td>

                      <td className="px-5 py-3.5">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                            user.status === 'ACTIVE'
                              ? 'bg-emerald-950/50 text-emerald-300 border border-emerald-500/30'
                              : 'bg-rose-950/50 text-rose-300 border border-rose-500/30'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              user.status === 'ACTIVE' ? 'bg-emerald-400' : 'bg-rose-400'
                            }`}
                          />
                          {user.status === 'ACTIVE' ? 'Activo' : 'Suspendido'}
                        </span>
                      </td>

                      <td className="px-5 py-3.5 text-xs text-[#94a3b8] font-mono">
                        {user.lastLogin
                          ? new Date(user.lastLogin).toLocaleString('es-AR', {
                              dateStyle: 'short',
                              timeStyle: 'short',
                            })
                          : 'Nunca'}
                      </td>

                      <td className="px-5 py-3.5 text-right">
                        <button
                          onClick={() => handleToggleStatus(user.id)}
                          disabled={isSuperAdminEmail}
                          className={`px-3 py-1 rounded-lg text-xs font-semibold border transition ${
                            user.status === 'ACTIVE'
                              ? 'bg-rose-950/40 border-rose-600/40 text-rose-300 hover:bg-rose-900/60'
                              : 'bg-emerald-950/40 border-emerald-600/40 text-emerald-300 hover:bg-emerald-900/60'
                          } ${isSuperAdminEmail ? 'opacity-40 cursor-not-allowed' : ''}`}
                        >
                          {user.status === 'ACTIVE' ? 'Suspender' : 'Reactivar'}
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
