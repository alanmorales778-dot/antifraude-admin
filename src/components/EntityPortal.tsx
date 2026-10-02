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
  LogOut,
  ChevronRight,
  Menu,
  X,
  Sparkles,
  Activity,
  FileSpreadsheet,
  Building2,
  Network,
  Fingerprint,
  Database,
} from 'lucide-react';
import FintechDashboard from '@/components/FintechDashboard';
import DashboardKPIs from '@/components/DashboardKPIs';
import ThreatAnalytics from '@/components/ThreatAnalytics';
import ApiDocsAndKeys from '@/components/ApiDocsAndKeys';
import WebhooksCenter from '@/components/WebhooksCenter';
import AuditLogViewer from '@/components/AuditLogViewer';
import AICopilotDrawer from '@/components/AICopilotDrawer';
import DatabaseConfigModal from '@/components/DatabaseConfigModal';
import { INITIAL_TENANTS } from '@/lib/data-seed';
import { useConsortiumStore } from '@/lib/store';
import { ServiceScope } from '@/lib/types';

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

// ─────────────────────────────────────────────────────────────────
// SERVICE SCOPE SWITCHER
// ─────────────────────────────────────────────────────────────────

function ServiceSwitcher({
  active,
  onChange,
}: {
  active: ServiceScope;
  onChange: (s: ServiceScope) => void;
}) {
  return (
    <div className="relative flex bg-[#12161d] rounded-lg p-1 border border-[#2b3442]">
      {/* Sliding indicator */}
      <div
        className="absolute top-1 bottom-1 rounded-md transition-all duration-200 ease-out"
        style={{
          left: active === 'INTERNAL' ? '4px' : 'calc(50% + 0px)',
          width: 'calc(50% - 4px)',
          background: active === 'INTERNAL' ? '#1c2938' : '#172f2a',
          borderColor: active === 'INTERNAL' ? '#354d6b' : '#2b544b',
          borderWidth: '1px',
          borderStyle: 'solid',
        }}
      />

      <button
        onClick={() => onChange('INTERNAL')}
        className={`relative z-10 flex items-center gap-2 px-3 py-1.5 rounded-md text-[11px] font-semibold transition-colors flex-1 justify-center ${
          active === 'INTERNAL'
            ? 'text-[#d6e3f2]'
            : 'text-[#6e7b8c] hover:text-[#9eaec2]'
        }`}
      >
        <Building2 className="h-3.5 w-3.5" />
        <span className="hidden xl:inline">Workspace Interno</span>
        <span className="xl:hidden">Interno</span>
      </button>

      <button
        onClick={() => onChange('CONSORTIUM')}
        className={`relative z-10 flex items-center gap-2 px-3 py-1.5 rounded-md text-[11px] font-semibold transition-colors flex-1 justify-center ${
          active === 'CONSORTIUM'
            ? 'text-[#d2eae4]'
            : 'text-[#6e7b8c] hover:text-[#9eaec2]'
        }`}
      >
        <Network className="h-3.5 w-3.5" />
        <span className="hidden xl:inline">Consorcio Federal</span>
        <span className="xl:hidden">Consorcio</span>
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// PORTAL PRINCIPAL
// ─────────────────────────────────────────────────────────────────

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
  const [isDbModalOpen, setIsDbModalOpen] = useState(false);
  const [stats, setStats] = useState<any>(null);

  const {
    fintechs,
    setActiveFintechId,
    activeService,
    setActiveService,
    supabaseStatus,
    supabaseLatencyMs,
  } = useConsortiumStore();
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

  const isInternal = activeService === 'INTERNAL';

  return (
    <div className="min-h-screen flex bg-[#13171e] text-[#e2e8f0] font-sans selection:bg-[#1b3b36] selection:text-white">
      {/* ── SIDEBAR ─────────────────────────────────────────── */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-60 flex flex-col bg-[#171c24] border-r border-[#29313d] transition-transform duration-300 ${
          isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Logo + entidad activa */}
        <div className="px-4 py-5 border-b border-[#29313d]">
          <div className="flex items-center gap-3 mb-3">
            <div className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 border transition-colors ${
              isInternal
                ? 'bg-[#15263a] border-[#294260] text-[#a8c5e5]'
                : 'bg-[#18342e] border-[#2a554a] text-[#a2d6cb]'
            }`}>
              {isInternal
                ? <Building2 className="h-4.5 w-4.5" />
                : <Shield className="h-4.5 w-4.5" />
              }
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-white truncate">
                {activeFintech?.name || 'Entidad'}
              </p>
              <p className={`text-[10px] font-mono transition-colors ${
                isInternal ? 'text-[#7e9bbd]' : 'text-[#74b3a5]'
              }`}>
                {isInternal ? 'workspace.interno' : 'red.consorcio.zk'}
              </p>
            </div>
          </div>

          {/* Service Scope Switcher */}
          <ServiceSwitcher active={activeService} onChange={setActiveService} />
        </div>

        {/* Scope label */}
        <div className={`mx-4 mt-3 mb-1 flex items-center gap-2 px-2.5 py-1.5 rounded-md text-[10px] font-semibold uppercase tracking-wider border transition-all ${
          isInternal
            ? 'bg-[#15263a]/60 text-[#a8c5e5] border-[#253e5e]'
            : 'bg-[#18342e]/60 text-[#a2d6cb] border-[#265046]'
        }`}>
          {isInternal ? (
            <>
              <Building2 className="h-3 w-3" />
              Internal Risk Workspace
            </>
          ) : (
            <>
              <Network className="h-3 w-3" />
              Federated Threat Consortium
            </>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 p-2.5 space-y-1 overflow-y-auto">
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
                className={`w-full flex items-center gap-3 rounded-lg px-3 py-2 text-left text-xs transition-all ${
                  isActive
                    ? isInternal
                      ? 'bg-[#1b2b3d] text-[#e0ecf7] border border-[#2d4663] font-semibold shadow-2xs'
                      : 'bg-[#18332c] text-[#d6ede7] border border-[#2c554a] font-semibold shadow-2xs'
                    : 'text-[#7e8c9d] hover:text-[#d3dce6] hover:bg-[#1e2430] border border-transparent font-medium'
                }`}
              >
                <Icon className={`h-4 w-4 shrink-0 ${
                  isActive
                    ? isInternal ? 'text-[#8eb8e5]' : 'text-[#78c8b8]'
                    : 'text-[#5a6878]'
                }`} />
                <span className="truncate">{item.label}</span>
                {isActive && (
                  <ChevronRight className="h-3 w-3 ml-auto shrink-0 opacity-60" />
                )}
              </button>
            );
          })}
        </nav>

        {/* Stats rápidas + logout */}
        <div className="p-3 border-t border-[#29313d] space-y-2 bg-[#141820]">
          <div className="grid grid-cols-2 gap-1.5 text-center">
            <div className="rounded-md bg-[#1a202a] border border-[#28323f] p-2">
              <p className="text-sm font-bold font-mono text-[#d6e3f2]">
                {activeFintech?.queriesCount ?? 0}
              </p>
              <p className="text-[9px] text-[#718096] uppercase tracking-wide">Consultas</p>
            </div>
            <div className="rounded-md bg-[#1a202a] border border-[#28323f] p-2">
              <p className="text-sm font-bold font-mono text-[#e57373]">
                {activeFintech?.reportsCount ?? 0}
              </p>
              <p className="text-[9px] text-[#718096] uppercase tracking-wide">Reportes</p>
            </div>
          </div>

          <button
            onClick={onLogout}
            className="w-full flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-[#9faec0] hover:text-[#fc8181] hover:bg-[#2b1f1f] border border-[#29313d] transition-all"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span>Cerrar Sesión</span>
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
      <div className="flex-1 lg:ml-60 flex flex-col min-h-screen">
        {/* Header */}
        <header className="sticky top-0 z-20 flex items-center gap-4 px-6 py-3.5 border-b border-[#29313d] bg-[#171c24]/95 backdrop-blur-sm shadow-2xs">
          <button
            className="lg:hidden text-[#718096] hover:text-white transition"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          >
            {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>

          <div className="flex-1 min-w-0">
            <h1 className="text-sm font-semibold text-white tracking-wide">{activeNav?.label}</h1>
            {activeNav?.description && (
              <p className="text-[11px] text-[#718096] hidden sm:block">{activeNav.description}</p>
            )}
          </div>

          <div className="flex items-center gap-3">
            {/* Scope badge in header */}
            <div className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[10px] font-mono border transition-all ${
              isInternal
                ? 'bg-[#15263a] border-[#294260] text-[#a8c5e5]'
                : 'bg-[#18342e] border-[#2a554a] text-[#a2d6cb]'
            }`}>
              {isInternal ? (
                <Building2 className="h-3 w-3" />
              ) : (
                <Network className="h-3 w-3" />
              )}
              {isInternal ? 'WORKSPACE INTERNO' : 'CONSORCIO FEDERAL'}
            </div>

            {/* Supabase Cloud Memory Button */}
            <button
              onClick={() => setIsDbModalOpen(true)}
              className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[10px] font-mono border transition-all ${
                supabaseStatus === 'CONNECTED'
                  ? 'bg-[#14291f] border-[#254d3b] text-[#7ee787] hover:bg-[#1a382a]'
                  : supabaseStatus === 'SYNCING'
                  ? 'bg-[#152735] border-[#254560] text-[#79c0ff] hover:bg-[#1c354a]'
                  : 'bg-[#2a2114] border-[#4d3c22] text-[#e3b341] hover:bg-[#382c1a]'
              }`}
              title="Configurar Memoria Cloud (Supabase)"
            >
              <Database className="h-3 w-3" />
              <span>
                {supabaseStatus === 'CONNECTED'
                  ? `Cloud DB: ${supabaseLatencyMs ? `${supabaseLatencyMs}ms` : 'Supabase'}`
                  : supabaseStatus === 'SYNCING'
                  ? 'Sincronizando...'
                  : 'Memoria Local (Conectar DB)'}
              </span>
            </button>

            <span className="flex items-center gap-1.5 text-[11px] text-[#718096] font-mono">
              <span className="w-2 h-2 rounded-full bg-[#48bb78] animate-pulse" />
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
          className={`group flex items-center gap-2 rounded-xl bg-[#0e1424] border px-4 py-2.5 text-xs font-bold text-slate-200 hover:text-white shadow-xl hover:scale-105 active:scale-95 transition-all ${
            isInternal
              ? 'border-indigo-500/30 hover:border-indigo-400/60 shadow-indigo-950/40'
              : 'border-cyan-500/30 hover:border-cyan-400/60 shadow-cyan-950/40'
          }`}
        >
          <Sparkles className={`h-4 w-4 group-hover:rotate-12 transition animate-pulse ${
            isInternal ? 'text-indigo-400' : 'text-cyan-400'
          }`} />
          <span>Centinela AI</span>
          <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
        </button>
      </div>

      <AICopilotDrawer isOpen={isCopilotOpen} onClose={() => setIsCopilotOpen(false)} />
      <DatabaseConfigModal isOpen={isDbModalOpen} onClose={() => setIsDbModalOpen(false)} />
    </div>
  );
}

