'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Users,
  UserPlus,
  UserCheck,
  UserX,
  Shield,
  Crown,
  Eye,
  ChevronDown,
  ChevronUp,
  X,
  Check,
  KeyRound,
  Mail,
  Building2,
  Search,
  SlidersHorizontal,
  Lock,
  FileCheck,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
} from 'lucide-react';
import { useConsortiumStore } from '@/lib/store';

// ─────────────────────────────────────────────────────────────────
// TIPOS
// ─────────────────────────────────────────────────────────────────

export type UserRole = 'ANALYST_L1' | 'ANALYST_L2' | 'ENTITY_ADMIN';
export type UserStatus = 'ACTIVE' | 'SUSPENDED' | 'PENDING';

export interface EntityUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  lastLogin: string;
  fintechId: string;
}

// ─────────────────────────────────────────────────────────────────
// DATOS SEMILLA
// ─────────────────────────────────────────────────────────────────

const INITIAL_USERS: EntityUser[] = [
  { id: 'u1', name: 'Laura Gómez', email: 'lgomez@fintechalpha.com', role: 'ENTITY_ADMIN', status: 'ACTIVE', lastLogin: '2026-09-23T18:30:00', fintechId: 'fintech-alpha' },
  { id: 'u2', name: 'Martín Pérez', email: 'mperez@fintechalpha.com', role: 'ANALYST_L2', status: 'ACTIVE', lastLogin: '2026-09-23T15:10:00', fintechId: 'fintech-alpha' },
  { id: 'u3', name: 'Ana Rodríguez', email: 'arodriguez@fintechalpha.com', role: 'ANALYST_L1', status: 'ACTIVE', lastLogin: '2026-09-20T09:00:00', fintechId: 'fintech-alpha' },
  { id: 'u4', name: 'Carlos Benítez', email: 'cbenitez@bancobeta.com.ar', role: 'ENTITY_ADMIN', status: 'ACTIVE', lastLogin: '2026-09-23T17:45:00', fintechId: 'banco-beta' },
  { id: 'u5', name: 'Sofía Herrera', email: 'sherrera@bancobeta.com.ar', role: 'ANALYST_L2', status: 'PENDING', lastLogin: '-', fintechId: 'banco-beta' },
  { id: 'u6', name: 'Federico Rossi', email: 'frossi@galicia.com.ar', role: 'ANALYST_L2', status: 'ACTIVE', lastLogin: '2026-09-23T12:00:00', fintechId: 'tenant-galicia' },
];

const ROLE_CONFIG: Record<
  UserRole,
  {
    label: string;
    description: string;
    color: string;
    icon: React.ElementType;
    permissions: string[];
  }
> = {
  ANALYST_L1: {
    label: 'Analista L1',
    description: 'Consultas unitarias individuales y chequeo de score ciego.',
    color: 'text-slate-300 border-slate-500/30 bg-slate-700/30',
    icon: Eye,
    permissions: [
      'Consulta ciega unitaria (DNI / Email / Teléfono / IP)',
      'Visualización de score de riesgo (0-100) y recomendación',
      'Sin acceso a cargas masivas ni exportación',
      'Sin permisos para modificar falsos positivos',
    ],
  },
  ANALYST_L2: {
    label: 'Analista L2',
    description: 'Consultas masivas CSV, reportes de incidentes y gestión de falsos positivos.',
    color: 'text-cyan-400 border-cyan-500/30 bg-cyan-500/10',
    icon: Shield,
    permissions: [
      'Todas las funciones de Analista L1',
      'Carga y consulta masiva de lotes vía CSV',
      'Reporte de fraudes e incidentes confirmados',
      'Gestión de reclamos de falsos positivos y rehabilitación',
      'Descarga de certificados de atestación ZK en JSON',
    ],
  },
  ENTITY_ADMIN: {
    label: 'Admin de Entidad',
    description: 'Gestión institucional, credenciales API, webhooks y alta de analistas.',
    color: 'text-amber-400 border-amber-500/30 bg-amber-500/10',
    icon: Crown,
    permissions: [
      'Acceso total a funciones analíticas L1 y L2',
      'Generación y rotación de claves API (Live & Test)',
      'Configuración de endpoints de Webhooks y suscripción de eventos',
      'Administración y alta de usuarios internos de su entidad',
      'Gestión de políticas de tolerancia y umbrales de score',
    ],
  },
};

const STATUS_LABELS: Record<UserStatus, { label: string; color: string }> = {
  ACTIVE: { label: 'Activo / Habilitado', color: 'text-emerald-400 border-emerald-500/25 bg-emerald-500/10' },
  SUSPENDED: { label: 'Suspendido', color: 'text-rose-400 border-rose-500/25 bg-rose-500/10' },
  PENDING: { label: 'Pendiente de Alta', color: 'text-amber-400 border-amber-500/25 bg-amber-500/10' },
};

// ─────────────────────────────────────────────────────────────────
// MODAL NUEVO USUARIO
// ─────────────────────────────────────────────────────────────────

function NewUserModal({
  fintechs,
  defaultFintechId,
  onClose,
  onConfirm,
}: {
  fintechs: { id: string; name: string }[];
  defaultFintechId?: string;
  onClose: () => void;
  onConfirm: (user: Omit<EntityUser, 'id' | 'lastLogin'>) => void;
}) {
  const [fintechId, setFintechId] = useState(defaultFintechId || fintechs[0]?.id || 'fintech-alpha');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<UserRole>('ANALYST_L2');
  const [autoActivate, setAutoActivate] = useState(true);
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim().length < 3) {
      setError('El nombre debe tener al menos 3 caracteres.');
      return;
    }
    if (!email.includes('@')) {
      setError('Ingresá un correo corporativo válido.');
      return;
    }
    onConfirm({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      role,
      status: autoActivate ? 'ACTIVE' : 'PENDING',
      fintechId,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4">
      <div className="w-full max-w-lg rounded-2xl border border-white/12 bg-[#0c1020] shadow-2xl p-6 space-y-5">
        <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-amber-500/15 border border-amber-500/20 flex items-center justify-center">
              <UserPlus className="h-4 w-4 text-amber-400" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Dar de Alta Usuario en Entidad</h3>
              <p className="text-[11px] text-slate-400">Creación de credenciales y asignación de rol de seguridad</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Selector de Entidad */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Entidad Financiera / Banco / Fintech
            </label>
            <select
              value={fintechId}
              onChange={e => setFintechId(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 text-xs text-white focus:outline-none focus:border-amber-500/50"
            >
              {fintechs.map(f => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </div>

          {/* Nombre */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Nombre Completo del Usuario
            </label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Ej: Lic. Juan Martín Pérez"
              className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-amber-500/50"
              required
            />
          </div>

          {/* Email */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Email Corporativo (Login)
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="analista@entidad.com.ar"
                className="w-full rounded-xl border border-white/10 bg-black/40 pl-9 pr-3 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-amber-500/50"
                required
              />
            </div>
          </div>

          {/* Rol de Acceso */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Rol y Nivel de Privilegio
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(Object.keys(ROLE_CONFIG) as UserRole[]).map(r => {
                const config = ROLE_CONFIG[r];
                const Icon = config.icon;
                const isSelected = role === r;
                return (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRole(r)}
                    className={`flex flex-col items-center gap-1.5 rounded-xl border p-2.5 text-center transition ${
                      isSelected
                        ? `${config.color} border-current shadow-sm`
                        : 'border-white/8 text-slate-500 hover:border-white/20 hover:text-slate-300 bg-white/[0.02]'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="text-[11px] font-bold">{config.label}</span>
                  </button>
                );
              })}
            </div>
            <p className="mt-2 text-[11px] text-slate-400 bg-white/[0.02] p-2.5 rounded-lg border border-white/[0.04]">
              {ROLE_CONFIG[role].description}
            </p>
          </div>

          {/* Checkbox auto-activación */}
          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="autoActivate"
              checked={autoActivate}
              onChange={e => setAutoActivate(e.target.checked)}
              className="rounded border-white/20 bg-black/40 text-amber-500 focus:ring-amber-500"
            />
            <label htmlFor="autoActivate" className="text-xs text-slate-300 cursor-pointer">
              Habilitar e inicializar acceso inmediatamente (Estado: Activo)
            </label>
          </div>

          {error && <p className="text-xs text-rose-400 font-medium">{error}</p>}

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/[0.08]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] text-xs font-semibold text-slate-300"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-xs font-bold text-white transition shadow-lg shadow-amber-950/40"
            >
              <UserPlus className="h-4 w-4" />
              Dar de Alta en Red
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// PANEL PRINCIPAL
// ─────────────────────────────────────────────────────────────────

export default function EntityUsersPanel() {
  const { fintechs } = useConsortiumStore();

  // Lista de entidades disponibles
  const availableEntities = useMemo(() => {
    return fintechs.map(f => ({ id: f.id, name: f.name }));
  }, [fintechs]);

  // Estado de usuarios con persistencia en localStorage
  const [users, setUsers] = useState<EntityUser[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('antifraude_entity_users_v2');
        if (saved) return JSON.parse(saved);
      } catch {
        // fallback
      }
    }
    return INITIAL_USERS;
  });

  useEffect(() => {
    try {
      localStorage.setItem('antifraude_entity_users_v2', JSON.stringify(users));
    } catch {
      // ignore
    }
  }, [users]);

  // Filtros
  const [selectedEntityFilter, setSelectedEntityFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalEntityId, setModalEntityId] = useState<string | undefined>(undefined);
  const [showPermissionsMatrix, setShowPermissionsMatrix] = useState(false);

  // Acciones de usuario
  const toggleUserStatus = (userId: string) => {
    setUsers(prev =>
      prev.map(u =>
        u.id === userId
          ? { ...u, status: u.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE' }
          : u
      )
    );
  };

  const setUserRole = (userId: string, newRole: UserRole) => {
    setUsers(prev =>
      prev.map(u => (u.id === userId ? { ...u, role: newRole } : u))
    );
  };

  const handleCreateUser = (newUser: Omit<EntityUser, 'id' | 'lastLogin'>) => {
    const created: EntityUser = {
      ...newUser,
      id: `usr_${Date.now()}`,
      lastLogin: '-',
    };
    setUsers(prev => [created, ...prev]);
  };

  const deleteUser = (userId: string) => {
    if (!confirm('¿Eliminar este usuario de forma permanente?')) return;
    setUsers(prev => prev.filter(u => u.id !== userId));
  };

  // Filtrado de usuarios
  const filteredUsers = useMemo(() => {
    return users.filter(u => {
      if (selectedEntityFilter !== 'ALL' && u.fintechId !== selectedEntityFilter) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = u.name.toLowerCase().includes(q);
        const matchesEmail = u.email.toLowerCase().includes(q);
        if (!matchesName && !matchesEmail) return false;
      }
      return true;
    });
  }, [users, selectedEntityFilter, searchQuery]);

  return (
    <div className="space-y-6">
      {/* ── ENCABEZADO Y ACCIONES PRINCIPALES ──────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/[0.08] pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-amber-500/15 border border-amber-500/20 flex items-center justify-center">
              <Users className="h-4 w-4 text-amber-400" />
            </div>
            <h2 className="text-lg font-bold text-white tracking-tight">
              Gestión de Usuarios y Roles de Entidades
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl">
            Control de altas, bajas, suspensión y asignación de roles (L1, L2, Admin) para los analistas de riesgo de cada fintech y banco participante.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            onClick={() => setShowPermissionsMatrix(!showPermissionsMatrix)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.08] text-xs font-semibold text-slate-300 hover:text-white transition"
          >
            <Shield className="h-3.5 w-3.5 text-amber-400" />
            {showPermissionsMatrix ? 'Ocultar Matriz de Roles' : 'Ver Matriz de Roles'}
          </button>

          <button
            onClick={() => {
              setModalEntityId(undefined);
              setIsModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-xs font-bold text-white transition shadow-lg shadow-amber-950/40 active:scale-95"
          >
            <UserPlus className="h-4 w-4" />
            + Dar de Alta Usuario
          </button>
        </div>
      </div>

      {/* ── MATRIZ DE CONFIGURACIÓN DE ROLES (RBAC) ─────────────── */}
      {showPermissionsMatrix && (
        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/[0.03] p-5 space-y-4 animate-fade-in">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-2">
                <Lock className="h-4 w-4" /> Matriz de Permisos por Rol (Role-Based Access Control)
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Alcance regulatorio y privilegios vigentes para cada perfil dentro del Consorcio Antifraude.
              </p>
            </div>
            <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
              Cumplimiento ISO 27001 / Zero-Knowledge
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
            {(Object.keys(ROLE_CONFIG) as UserRole[]).map(r => {
              const cfg = ROLE_CONFIG[r];
              const Icon = cfg.icon;
              return (
                <div
                  key={r}
                  className="rounded-xl border border-white/[0.08] bg-black/40 p-4 space-y-2.5"
                >
                  <div className="flex items-center gap-2">
                    <div className={`p-1.5 rounded-lg border ${cfg.color}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-white">{cfg.label}</h4>
                      <p className="text-[10px] text-slate-500">{r}</p>
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-300 leading-snug">
                    {cfg.description}
                  </p>
                  <div className="pt-2 border-t border-white/[0.06] space-y-1">
                    <span className="text-[10px] uppercase font-mono text-slate-500 font-bold block">
                      Permisos habilitados:
                    </span>
                    {cfg.permissions.map((p, idx) => (
                      <div key={idx} className="flex items-start gap-1.5 text-[10px] text-slate-400">
                        <Check className="h-3 w-3 text-emerald-400 shrink-0 mt-0.5" />
                        <span>{p}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── BARRA DE BÚSQUEDA Y FILTRO POR ENTIDAD ──────────────── */}
      <div className="flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Buscar usuario por nombre o correo corporativo..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-black/40 border border-white/[0.08] text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500/50"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Building2 className="h-4 w-4 text-slate-500 shrink-0" />
          <select
            value={selectedEntityFilter}
            onChange={e => setSelectedEntityFilter(e.target.value)}
            className="w-full sm:w-64 px-3 py-2.5 rounded-xl bg-black/40 border border-white/[0.08] text-xs text-slate-300 focus:outline-none focus:border-amber-500/50"
          >
            <option value="ALL">Todas las Entidades ({users.length} usuarios)</option>
            {availableEntities.map(f => (
              <option key={f.id} value={f.id}>
                {f.name} ({users.filter(u => u.fintechId === f.id).length})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* ── TABLA PRINCIPAL DE USUARIOS Y ROLES ─────────────────── */}
      <div className="rounded-2xl border border-white/[0.08] bg-[#0c1222]/80 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-black/40 border-b border-white/[0.08] text-[10px] uppercase font-mono tracking-wider text-slate-400">
              <tr>
                <th className="px-5 py-3.5">Usuario & Credenciales</th>
                <th className="px-5 py-3.5">Entidad Asignada</th>
                <th className="px-5 py-3.5">Rol de Seguridad</th>
                <th className="px-5 py-3.5 text-center">Estado</th>
                <th className="px-5 py-3.5 text-center">Último Acceso</th>
                <th className="px-5 py-3.5 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-slate-500">
                    No se encontraron usuarios para el filtro seleccionado.
                  </td>
                </tr>
              ) : (
                filteredUsers.map(user => {
                  const entity = availableEntities.find(e => e.id === user.fintechId);
                  const roleConfig = ROLE_CONFIG[user.role];
                  const statusInfo = STATUS_LABELS[user.status];

                  return (
                    <tr key={user.id} className="hover:bg-white/[0.02] transition">
                      {/* Usuario & Email */}
                      <td className="px-5 py-4">
                        <div className="font-semibold text-white text-xs">{user.name}</div>
                        <div className="text-[11px] text-slate-400 font-mono mt-0.5 flex items-center gap-1">
                          <Mail className="h-3 w-3 text-slate-500" />
                          {user.email}
                        </div>
                      </td>

                      {/* Entidad */}
                      <td className="px-5 py-4">
                        <span className="font-medium text-slate-300 flex items-center gap-1.5">
                          <Building2 className="h-3.5 w-3.5 text-amber-400/80" />
                          {entity?.name || user.fintechId}
                        </span>
                      </td>

                      {/* Selector de Rol en Línea */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <select
                            value={user.role}
                            onChange={e => setUserRole(user.id, e.target.value as UserRole)}
                            className="px-2.5 py-1.5 rounded-lg bg-black/60 border border-white/10 text-xs font-semibold text-white focus:outline-none focus:border-amber-500/50"
                          >
                            <option value="ANALYST_L1">Analista L1</option>
                            <option value="ANALYST_L2">Analista L2</option>
                            <option value="ENTITY_ADMIN">Admin Entidad</option>
                          </select>
                        </div>
                      </td>

                      {/* Estado */}
                      <td className="px-5 py-4 text-center">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-mono font-semibold border ${statusInfo.color}`}
                        >
                          {user.status === 'ACTIVE' && (
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          )}
                          {statusInfo.label}
                        </span>
                      </td>

                      {/* Último acceso */}
                      <td className="px-5 py-4 text-center text-slate-400 font-mono text-[11px]">
                        {user.lastLogin !== '-'
                          ? new Date(user.lastLogin).toLocaleString('es-AR', {
                              day: '2-digit',
                              month: '2-digit',
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : '—'}
                      </td>

                      {/* Acciones */}
                      <td className="px-5 py-4 text-right">
                        <div className="inline-flex items-center gap-2">
                          <button
                            onClick={() => toggleUserStatus(user.id)}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition border ${
                              user.status === 'ACTIVE'
                                ? 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border-rose-500/20'
                                : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border-emerald-500/20'
                            }`}
                          >
                            {user.status === 'ACTIVE' ? 'Suspender' : 'Habilitar'}
                          </button>

                          <button
                            onClick={() => deleteUser(user.id)}
                            className="p-1 rounded-lg text-slate-600 hover:text-rose-400 hover:bg-white/[0.04] transition"
                            title="Eliminar usuario"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal para crear usuario */}
      {isModalOpen && (
        <NewUserModal
          fintechs={availableEntities}
          defaultFintechId={modalEntityId}
          onClose={() => setIsModalOpen(false)}
          onConfirm={handleCreateUser}
        />
      )}
    </div>
  );
}
