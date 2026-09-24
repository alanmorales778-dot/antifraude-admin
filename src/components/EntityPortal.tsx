'use client';

import React, { useState, useEffect } from 'react';
import {
  Shield,
  LayoutDashboard,
  Search,
  ShieldAlert,
  Upload,
  History,
  TrendingUp,
  Key,
  ScrollText,
  LogOut,
  ChevronRight,
  Menu,
  X,
  Sparkles,
  Activity,
  FileSpreadsheet,
} from 'lucide-react';
import FintechDashboard from '@/components/FintechDashboard';
import DashboardKPIs from '@/components/DashboardKPIs';
import ThreatAnalytics from '@/components/ThreatAnalytics';
import ApiDocsAndKeys from '@/components/ApiDocsAndKeys';
import WebhooksCenter from '@/components/WebhooksCenter';
import AuditLogViewer from '@/components/AuditLogViewer';
import AICopilotDrawer from '@/components/AICopilotDrawer';
import { INITIAL_TENANTS } from '@/lib/data-seed';
import { useConsortiumStore } from '@/lib/store';

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, description: 'KPIs y estadísticas' },
  { id: 'consulta', label: 'Consulta de Riesgo', icon: Search, description: 'Lookup unitario y combinado ZK' },
  { id: 'consulta_masiva', label: 'Consultas Masivas', icon: FileSpreadsheet, description: 'Subir CSV y descargar layout' },
  { id: 'reporte', label: 'Reportar Fraude', icon: ShieldAlert, description: 'Ingreso de incidentes' },
  { id: 'csv', label: 'Importación CSV', icon: Upload, description: 'Carga masiva de fraudes' },
  { id: 'historial', label: 'Historial', icon: History, description: 'Mis reportes' },
  { id: 'analytics', label: 'Analytics', icon: TrendingUp, description: 'Inteligencia de amenazas' },
  { id: 'api', label: 'API & Webhooks', icon: Key, description: 'Integración y claves' },
];

// Mapea cada tab al módulo dentro de FintechDashboard
type FintechModule = 'lookup' | 'bulk_lookup' | 'report' | 'csv' | 'history';
const TAB_TO_MODULE: Record<string, FintechModule> = {
  consulta: 'lookup',
  consulta_masiva: 'bulk_lookup',
  reporte: 'report',
  csv: 'csv',
  historial: 'history',
};

export default function EntityPortal({
  fintechId,
  onLogout,
}: {
  fintechId: string;
  onLogout: () => void;
}) {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isCopilotOpen, setIsCopilotOpen] = useState(false);
  const [stats, setStats] = useState<any>(null);

  const { fintechs, setActiveFintechId } = useConsortiumStore();
  const activeFintech = fintechs.find(f => f.id === fintechId) || fintechs[0];
  const currentTenant = INITIAL_TENANTS[0];

  // Sincronizar el fintech activo en el store global
  useEffect(() => {
    setActiveFintechId(fintechId);
  }, [fintechId, setActiveFintechId]);

  // Cargar stats para el dashboard
  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await fetch('/api/v1/analytics/stats');
        const data = await res.json();
        if (data.data) setStats(data.data);
      } catch {
        // silence
      }
    };
    fetchStats();
  }, []);

  const activeNav = NAV_ITEMS.find(n => n.id === activeTab);

  // Los tabs que usan FintechDashboard
  const isFintechModule = activeTab in TAB_TO_MODULE;

  return (
    <div className="min-h-screen flex bg-[#070d18] text-slate-100">
      {/* ── SIDEBAR ─────────────────────────────────────────── */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-56 flex flex-col bg-[#090f20] border-r border-white/[0.05] transition-transform duration-300 ${
          isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Logo + entidad activa */}
        <div className="px-4 py-5 border-b border-white/[0.05]">
          <div className="flex items-center gap-3 mb-3">
            <div className="h-8 w-8 rounded-lg bg-cyan-500/15 border border-cyan-500/20 flex items-center justify-center shrink-0">
              <Shield className="h-4 w-4 text-cyan-400" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-white truncate">
                {activeFintech?.name || 'Entidad'}
              </p>
              <p className="text-[10px] text-cyan-500/50 font-mono">app.antifraude.com</p>
            </div>
          </div>

          {/* Badge de estado */}
          <div
            className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[10px] font-mono border ${
              activeFintech?.status === 'SUSPENDED'
                ? 'bg-rose-500/10 border-rose-500/20 text-rose-400'
                : 'bg-emerald-500/8 border-emerald-500/15 text-emerald-400/70'
            }`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full shrink-0 ${
                activeFintech?.status === 'SUSPENDED'
                  ? 'bg-rose-500'
                  : 'bg-emerald-500 animate-pulse'
              }`}
            />
            {activeFintech?.status === 'SUSPENDED' ? 'SUSPENDIDA' : 'ACTIVA EN RED'}
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
                    ? 'bg-cyan-500/10 border border-cyan-500/15 text-cyan-200'
                    : 'text-slate-500 hover:text-slate-300 hover:bg-white/[0.04] border border-transparent'
                }`}
              >
                <Icon
                  className={`h-4 w-4 shrink-0 ${isActive ? 'text-cyan-400' : 'text-slate-600'}`}
                />
                <span className="text-xs font-medium">{item.label}</span>
                {isActive && (
                  <ChevronRight className="h-3 w-3 ml-auto text-cyan-500/40 shrink-0" />
                )}
              </button>
            );
          })}
        </nav>

        {/* Stats rápidas + logout */}
        <div className="p-2.5 border-t border-white/[0.05] space-y-1">
          <div className="grid grid-cols-2 gap-1 px-1 mb-1">
            <div className="text-center rounded-lg bg-white/[0.03] p-2">
              <p className="text-base font-bold font-mono text-cyan-400">
                {activeFintech?.queriesCount ?? 0}
              </p>
              <p className="text-[9px] text-slate-600 uppercase tracking-wide">Consultas</p>
            </div>
            <div className="text-center rounded-lg bg-white/[0.03] p-2">
              <p className="text-base font-bold font-mono text-rose-400">
                {activeFintech?.reportsCount ?? 0}
              </p>
              <p className="text-[9px] text-slate-600 uppercase tracking-wide">Reportes</p>
            </div>
          </div>
          <button
            onClick={onLogout}
            className="w-full flex items-center gap-3 rounded-xl px-3 py-2 text-xs font-medium text-slate-600 hover:text-slate-300 hover:bg-white/[0.04] transition"
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
        <header className="sticky top-0 z-20 flex items-center gap-4 px-6 py-3.5 border-b border-white/[0.05] bg-[#070d18]/95 backdrop-blur-sm">
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
          {activeTab === 'dashboard' && (
            <DashboardKPIs
              stats={stats}
              tenants={INITIAL_TENANTS}
              onNavigateTab={setActiveTab}
            />
          )}

          {/* Lookup, Reporte, CSV e Historial usan FintechDashboard con módulo activo */}
          {isFintechModule && (
            <FintechDashboard activeModule={TAB_TO_MODULE[activeTab]} />
          )}

          {activeTab === 'analytics' && <ThreatAnalytics />}

          {activeTab === 'api' && (
            <div className="space-y-6">
              <ApiDocsAndKeys currentTenant={currentTenant} />
              <WebhooksCenter currentTenant={currentTenant} />
            </div>
          )}
        </main>
      </div>

      {/* Centinela AI Floating Trigger */}
      <div className="fixed bottom-6 right-6 z-30">
        <button
          onClick={() => setIsCopilotOpen(true)}
          className="group flex items-center gap-2 rounded-xl bg-[#0e1424] border border-cyan-500/30 hover:border-cyan-400/60 px-4 py-2.5 text-xs font-bold text-slate-200 hover:text-white shadow-xl shadow-cyan-950/40 hover:scale-105 active:scale-95 transition-all"
        >
          <Sparkles className="h-4 w-4 text-cyan-400 group-hover:rotate-12 transition animate-pulse" />
          <span>Centinela AI</span>
          <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
        </button>
      </div>

      <AICopilotDrawer isOpen={isCopilotOpen} onClose={() => setIsCopilotOpen(false)} />
    </div>
  );
}

