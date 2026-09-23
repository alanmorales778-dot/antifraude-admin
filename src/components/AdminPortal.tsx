'use client';

import React, { useState } from 'react';
import {
  Crown,
  LayoutDashboard,
  Building2,
  Settings,
  Flame,
  Share2,
  ScrollText,
  Lock,
  LogOut,
  ChevronRight,
  Menu,
  X,
  Sparkles,
  Activity,
  Network,
  Users,
} from 'lucide-react';
import AdminView from '@/components/AdminView';
import SuperAdminDashboard from '@/components/SuperAdminDashboard';
import RuleEngineNoCode from '@/components/RuleEngineNoCode';
import BlindWarRooms from '@/components/BlindWarRooms';
import GraphAnalytics from '@/components/GraphAnalytics';
import AuditLogViewer from '@/components/AuditLogViewer';
import SaltingInspector from '@/components/SaltingInspector';
import AICopilotDrawer from '@/components/AICopilotDrawer';
import EntityUsersPanel from '@/components/EntityUsersPanel';
import { INITIAL_TENANTS } from '@/lib/data-seed';

const NAV_ITEMS = [
  { id: 'panel', label: 'Panel Principal', icon: LayoutDashboard, description: 'Infraestructura y KPIs' },
  { id: 'usuarios', label: 'Usuarios y Roles', icon: Users, description: 'Alta y permisos por entidad' },
  { id: 'entidades', label: 'Entidades', icon: Building2, description: 'Fintechs y trust weights' },
  { id: 'nodos', label: 'Nodos Activos', icon: Network, description: 'Red del consorcio' },
  { id: 'reglas', label: 'Reglas No-Code', icon: Settings, description: 'Motor de reglas' },
  { id: 'war-rooms', label: 'War Rooms', icon: Flame, description: 'Coordinación de crisis' },
  { id: 'grafo', label: 'Grafo de Identidad', icon: Share2, description: 'Red de vínculos' },
  { id: 'auditoria', label: 'Log de Auditoría', icon: ScrollText, description: 'Trazabilidad' },
  { id: 'cripto', label: 'Inspector Criptográfico', icon: Lock, description: 'Doble salting ZK' },
];

export default function AdminPortal({ onLogout }: { onLogout: () => void }) {
  const [activeTab, setActiveTab] = useState('panel');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isCopilotOpen, setIsCopilotOpen] = useState(false);

  const currentTenant = INITIAL_TENANTS[0];
  const activeNav = NAV_ITEMS.find(n => n.id === activeTab);

  return (
    <div className="min-h-screen flex bg-[#09090f] text-slate-100">
      {/* ── SIDEBAR ─────────────────────────────────────────── */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-56 flex flex-col bg-[#0d0c18] border-r border-white/[0.05] transition-transform duration-300 ${
          isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-4 py-5 border-b border-white/[0.05]">
          <div className="h-8 w-8 rounded-lg bg-amber-500/15 border border-amber-500/20 flex items-center justify-center shrink-0">
            <Crown className="h-4 w-4 text-amber-400" />
          </div>
          <div>
            <p className="text-xs font-bold text-white">SuperAdmin</p>
            <p className="text-[10px] text-amber-500/50 font-mono">admin.antifraude.com</p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-2.5 space-y-0.5 overflow-y-auto">
          {NAV_ITEMS.map(item => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setActiveTab(item.id);
                  setIsMobileMenuOpen(false);
                }}
                className={`w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-all ${
                  isActive
                    ? 'bg-amber-500/10 border border-amber-500/15 text-amber-200'
                    : 'text-slate-500 hover:text-slate-300 hover:bg-white/[0.04] border border-transparent'
                }`}
              >
                <Icon
                  className={`h-4 w-4 shrink-0 ${isActive ? 'text-amber-400' : 'text-slate-600'}`}
                />
                <span className="text-xs font-medium">{item.label}</span>
                {isActive && (
                  <ChevronRight className="h-3 w-3 ml-auto text-amber-500/40 shrink-0" />
                )}
              </button>
            );
          })}
        </nav>

        {/* Indicator de sesión + Logout */}
        <div className="p-2.5 border-t border-white/[0.05] space-y-0.5">
          <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-amber-500/5 border border-amber-500/10">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse shrink-0" />
            <span className="text-[10px] text-amber-400/60 font-mono truncate">
              Sesión Root · 2FA Activo
            </span>
          </div>
          <button
            onClick={onLogout}
            className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-medium text-slate-600 hover:text-slate-300 hover:bg-white/[0.04] transition"
          >
            <LogOut className="h-4 w-4 shrink-0" />
            Cerrar Sesión
          </button>
        </div>
      </aside>

      {/* Mobile overlay */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/60 lg:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* ── CONTENIDO PRINCIPAL ──────────────────────────────── */}
      <div className="flex-1 lg:ml-56 flex flex-col min-h-screen">
        {/* Header */}
        <header className="sticky top-0 z-20 flex items-center gap-4 px-6 py-3.5 border-b border-white/[0.05] bg-[#09090f]/95 backdrop-blur-sm">
          <button
            className="lg:hidden text-slate-600 hover:text-slate-300 transition"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          >
            {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>

          <div className="flex-1 min-w-0">
            <h1 className="text-sm font-semibold text-white">{activeNav?.label}</h1>
            {activeNav?.description && (
              <p className="text-[11px] text-slate-600 hidden sm:block">{activeNav.description}</p>
            )}
          </div>

          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 text-[11px] text-slate-600 font-mono">
              <Activity className="h-3 w-3 text-emerald-500" />
              Red Federal Activa
            </span>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 p-5 lg:p-7 overflow-auto">
          {activeTab === 'panel' && <SuperAdminDashboard />}
          {activeTab === 'usuarios' && <EntityUsersPanel />}
          {activeTab === 'entidades' && (
            <div className="space-y-8">
              <AdminView onNavigateToUsers={() => setActiveTab('usuarios')} />
            </div>
          )}
          {activeTab === 'nodos' && (
            <div className="space-y-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Network className="h-4 w-4 text-amber-400" />
                  <h2 className="text-base font-bold text-white">Nodos Activos del Consorcio</h2>
                </div>
                <p className="text-xs text-slate-500">
                  Instituciones financieras y billeteras digitales conectadas a la red de mitigación comunitaria.
                </p>
              </div>
              <div className="glass-panel rounded-2xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs text-slate-400">10 nodos sincronizados</span>
                  <span className="flex items-center gap-1.5 text-xs text-emerald-400 font-mono">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    10 / 10 Online
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                  {INITIAL_TENANTS.map(tenant => (
                    <div
                      key={tenant.id}
                      className="flex flex-col justify-between rounded-xl border border-white/5 bg-slate-900/40 p-3 transition hover:border-amber-500/20 hover:bg-slate-900/70"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xl">{tenant.logo}</span>
                        <span className="flex h-2 w-2 rounded-full bg-emerald-500" />
                      </div>
                      <div className="mt-2">
                        <div className="text-xs font-semibold text-white truncate">{tenant.name}</div>
                        <div className="flex items-center justify-between mt-1 text-[10px] text-slate-400">
                          <span>Trust Score</span>
                          <span className="font-mono text-amber-400 font-bold">{tenant.trustScore}%</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
          {activeTab === 'reglas' && <RuleEngineNoCode />}
          {activeTab === 'war-rooms' && <BlindWarRooms currentTenant={currentTenant} />}
          {activeTab === 'grafo' && <GraphAnalytics />}
          {activeTab === 'auditoria' && <AuditLogViewer />}
          {activeTab === 'cripto' && (
            <div className="space-y-5">
              <div>
                <h2 className="text-base font-bold text-white">
                  Inspector Criptográfico — Doble Salting ZK
                </h2>
                <p className="text-xs text-slate-500 mt-1 max-w-2xl">
                  Auditoría del proceso de hashing SHA-256 con salt del consorcio y salt del tenant. Cumplimiento Ley 25.326.
                </p>
              </div>
              <SaltingInspector />
            </div>
          )}
        </main>
      </div>

      {/* AI Copilot */}
      <div className="fixed bottom-6 right-6 z-30">
        <button
          onClick={() => setIsCopilotOpen(true)}
          className="group flex items-center gap-2 rounded-xl bg-[#16132a] border border-indigo-500/25 hover:border-indigo-500/40 px-4 py-2.5 text-xs font-semibold text-slate-300 hover:text-white shadow-xl shadow-black/40 hover:scale-105 active:scale-95 transition-all"
        >
          <Sparkles className="h-3.5 w-3.5 text-indigo-400 group-hover:rotate-12 transition" />
          AI Copilot
          <span className="flex h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
        </button>
      </div>

      <AICopilotDrawer isOpen={isCopilotOpen} onClose={() => setIsCopilotOpen(false)} />
    </div>
  );
}
