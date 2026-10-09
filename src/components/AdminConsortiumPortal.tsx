'use client';

import React, { useState } from 'react';
import {
  ShieldCheck,
  Building2,
  Users,
  Activity,
  Plus,
  Lock,
  LogOut,
  Sliders,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Search,
  Key,
  Database,
  ExternalLink,
  RotateCcw,
} from 'lucide-react';
import { useConsortiumStore } from '@/lib/store';

import ScoringLabAdmin from '@/components/ScoringLabAdmin';
import RegulatoryAuditTable from '@/components/RegulatoryAuditTable';
import AdminUsersManagement from '@/components/AdminUsersManagement';
import ConsortiumLogo from '@/components/ConsortiumLogo';

interface AdminConsortiumPortalProps {
  onLogout: () => void;
}

export default function AdminConsortiumPortal({ onLogout }: AdminConsortiumPortalProps) {
  const {
    adminSession,
    fintechs,
    auditLogs,
    appUsers,
    addFintech,
    updateTrustWeight,
    toggleFintechStatus,
    supabaseStatus,
    supabaseLatencyMs,
    resetEnvironmentToCleanAlpha,
  } = useConsortiumStore();

  const [activeTab, setActiveTab] = useState<'entities' | 'audit' | 'network' | 'scoring-lab' | 'users'>('entities');
  const [newEntityName, setNewEntityName] = useState('');
  const [filterQuery, setFilterQuery] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  const handleResetToZero = async () => {
    const ok = window.confirm(
      '¿Desea resetear el entorno a 0 para pruebas oficiales?\\n\\nEsta acción:\\n- Purgará todas las transacciones, consultas, reportes y listas negras de prueba.\\n- Mantendrá únicamente Banco Alpha con todos sus contadores en 0.\\n- Sincronizará la limpieza de inmediato en Supabase y en todas las sesiones activas.'
    );
    if (!ok) return;
    setIsResetting(true);
    try {
      await resetEnvironmentToCleanAlpha();
      alert('Entorno reiniciado exitosamente a 0. Banco Alpha listo con contadores en blanco.');
    } catch (err) {
      alert('Error reiniciando entorno: ' + String(err));
    } finally {
      setIsResetting(false);
    }
  };

  // Auto-seleccionar pestaña si está en la URL (ej: #scoring, ?tab=scoring)
  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    const hash = window.location.hash.toLowerCase();
    const search = window.location.search.toLowerCase();
    if (hash.includes('scoring') || hash.includes('score') || search.includes('scoring') || search.includes('score')) {
      setActiveTab('scoring-lab');
    }
  }, []);

  const handleCreateEntity = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEntityName.trim()) return;
    addFintech(newEntityName.trim());
    setNewEntityName('');
    setIsAdding(false);
  };

  const filteredEntities = fintechs.filter(f =>
    f.name.toLowerCase().includes(filterQuery.toLowerCase()) ||
    f.id.toLowerCase().includes(filterQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[#070d18] text-[#f1f5f9] font-sans flex flex-col justify-between selection:bg-[#1d4ed8] selection:text-white">
      {/* ── Top Executive Bar ── */}
      <header className="border-b border-[#17253d] bg-[#0c1628]/95 backdrop-blur-md px-6 py-4 sticky top-0 z-30 shadow-lg">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ConsortiumLogo size="md" showGlow={true} />
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold tracking-wider text-white uppercase">
                  Consorcio Federal Antifraude
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-[#13233e] text-[#60a5fa] border border-[#203c68] font-mono font-semibold">
                  Mando Central
                </span>
              </div>
              <p className="text-[11px] text-[#94a3b8] font-mono">
                Operador: {adminSession?.email || 'superadmin@consorcio-antifraude.org'} (Firma Digital Activa)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Acceso Rápido al Control de Scores */}
            <button
              onClick={() => setActiveTab('scoring-lab')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                activeTab === 'scoring-lab'
                  ? 'bg-blue-600/30 border-blue-500 text-cyan-300 shadow-[0_0_12px_rgba(59,130,246,0.3)]'
                  : 'bg-[#0e1d38] border-[#1e3a6a] text-cyan-300 hover:bg-[#152b52]'
              }`}
            >
              <Sliders className="w-3.5 h-3.5 text-cyan-400" />
              <span>Control de Scores</span>
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse ml-0.5" />
            </button>

            {/* Resetear Entorno a 0 */}
            <button
              onClick={handleResetToZero}
              disabled={isResetting}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all bg-[#240e13] border-[#5e1923] text-[#fca5a5] hover:bg-[#381119] shadow-sm"
              title="Restablecer el entorno desde cero: mantiene únicamente Banco Alpha con contadores en blanco."
            >
              <RotateCcw className={`w-3.5 h-3.5 ${isResetting ? 'animate-spin text-rose-400' : 'text-rose-400'}`} />
              <span>{isResetting ? 'Limpiando...' : 'Resetear Entorno a 0'}</span>
            </button>

            {/* Logout */}
            <button
              onClick={onLogout}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-medium text-[#f87171] hover:text-white bg-[#220d12] hover:bg-[#381119] border border-[#5c1d24] transition-all shadow-sm"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Cerrar Sesión de Gobernanza</span>
            </button>
          </div>
        </div>
      </header>

      {/* ── Main Workspace ── */}
      <main className="max-w-7xl mx-auto w-full px-6 py-8 flex-1 space-y-6">
        {/* Navigation Tabs */}
        <div className="flex flex-wrap items-center justify-between border-b border-[#17253d] pb-4 gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setActiveTab('entities')}
              className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'entities'
                  ? 'bg-[#1d4ed8] text-white shadow-[0_0_15px_rgba(29,78,216,0.35)] border border-[#3b82f6]/50'
                  : 'bg-[#0d182e] text-[#94a3b8] hover:bg-[#13233e] hover:text-white border border-[#1e365b]'
              }`}
            >
              Entidades Participantes ({fintechs.length})
            </button>

            <button
              onClick={() => setActiveTab('audit')}
              className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'audit'
                  ? 'bg-[#1d4ed8] text-white shadow-[0_0_15px_rgba(29,78,216,0.35)] border border-[#3b82f6]/50'
                  : 'bg-[#0d182e] text-[#94a3b8] hover:bg-[#13233e] hover:text-white border border-[#1e365b]'
              }`}
            >
              Libro de Auditoría Regulatoria ({auditLogs.length})
            </button>

            <button
              onClick={() => setActiveTab('network')}
              className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'network'
                  ? 'bg-[#1d4ed8] text-white shadow-[0_0_15px_rgba(29,78,216,0.35)] border border-[#3b82f6]/50'
                  : 'bg-[#0d182e] text-[#94a3b8] hover:bg-[#13233e] hover:text-white border border-[#1e365b]'
              }`}
            >
              Telemetría & Salud de Red
            </button>

            <button
              onClick={() => setActiveTab('scoring-lab')}
              className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                activeTab === 'scoring-lab'
                  ? 'bg-[#1d4ed8] text-white shadow-[0_0_15px_rgba(29,78,216,0.35)] border border-[#3b82f6]/50'
                  : 'bg-[#0d182e] text-[#94a3b8] hover:bg-[#13233e] hover:text-white border border-[#1e365b]'
              }`}
            >
              <Sliders className="w-3.5 h-3.5 text-cyan-400" />
              <span>Gestión de Scores de Fraude</span>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 ml-1">
                Motor Dual
              </span>
            </button>

            <button
              onClick={() => setActiveTab('users')}
              className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                activeTab === 'users'
                  ? 'bg-[#1d4ed8] text-white shadow-[0_0_15px_rgba(29,78,216,0.35)] border border-[#3b82f6]/50'
                  : 'bg-[#0d182e] text-[#94a3b8] hover:bg-[#13233e] hover:text-white border border-[#1e365b]'
              }`}
            >
              <Users className="w-3.5 h-3.5 text-blue-400" />
              <span>Gestión de Accesos & Roles ({appUsers?.length || 0})</span>
            </button>
          </div>

          {activeTab === 'entities' && (
            <button
              onClick={() => setIsAdding(!isAdding)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#1d4ed8] hover:bg-[#2563eb] text-white text-xs font-semibold shadow-[0_0_15px_rgba(29,78,216,0.3)] border border-[#3b82f6]/50 transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Adherir Nueva Entidad</span>
            </button>
          )}
        </div>

        {/* Formulario Añadir Entidad */}
        {isAdding && (
          <div className="p-5 bg-[#0d182e] border border-[#1e365b] rounded-xl shadow-lg animate-in fade-in duration-200">
            <h3 className="text-xs font-bold text-white uppercase tracking-wide mb-3 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-[#60a5fa]" />
              <span>Adhesión de Nueva Entidad Financiera al Consorcio</span>
            </h3>
            <form onSubmit={handleCreateEntity} className="flex flex-wrap items-center gap-3">
              <input
                type="text"
                required
                value={newEntityName}
                onChange={e => setNewEntityName(e.target.value)}
                placeholder="Nombre de la entidad (ej: Banco Santander, Ualá, Naranja X)..."
                className="flex-1 min-w-[280px] px-3.5 py-2.5 bg-[#060c17] border border-[#1e365b] rounded-lg text-xs text-white placeholder-[#475569] focus:outline-none focus:border-[#3b82f6]"
              />
              <button
                type="submit"
                className="px-4 py-2.5 rounded-lg bg-[#1d4ed8] hover:bg-[#2563eb] text-white text-xs font-semibold shadow-sm border border-[#3b82f6]/50"
              >
                Generar Credenciales y Adherir
              </button>
              <button
                type="button"
                onClick={() => setIsAdding(false)}
                className="px-3.5 py-2.5 rounded-lg bg-[#13233e] text-[#94a3b8] text-xs font-medium hover:bg-[#1a3052] border border-[#203c68]"
              >
                Cancelar
              </button>
            </form>
          </div>
        )}

        {/* ── TAB 1: Entidades ── */}
        {activeTab === 'entities' && (
          <div className="space-y-4">
            {/* Buscador */}
            <div className="relative max-w-sm">
              <input
                type="text"
                value={filterQuery}
                onChange={e => setFilterQuery(e.target.value)}
                placeholder="Filtrar por nombre o identificador..."
                className="w-full px-3.5 py-2 pl-9 bg-[#060c17] border border-[#1e365b] rounded-lg text-xs text-white placeholder-[#475569] focus:outline-none focus:border-[#3b82f6]"
              />
              <Search className="w-3.5 h-3.5 text-[#64748b] absolute left-3 top-2.5" />
            </div>

            {/* Listado de Entidades */}
            {filteredEntities.length === 0 ? (
              <div className="p-12 border border-[#1e365b] rounded-2xl bg-[#0c1628] text-center space-y-4">
                <div className="w-16 h-16 rounded-2xl bg-blue-500/10 border border-blue-500/30 text-blue-400 mx-auto flex items-center justify-center shadow-lg">
                  <Building2 className="w-8 h-8" />
                </div>
                <div className="max-w-md mx-auto space-y-2">
                  <h3 className="text-base font-bold text-white">No hay entidades financieras registradas</h3>
                  <p className="text-xs text-[#94a3b8] leading-relaxed">
                    La plataforma se encuentra completamente limpia y lista para preproducción.
                    Haga clic en <strong className="text-white">"Adherir Nueva Entidad"</strong> para dar de alta su primer banco o fintech y comenzar a realizar pruebas.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsAdding(true)}
                  className="px-4 py-2.5 rounded-xl bg-[#1d4ed8] hover:bg-[#2563eb] text-white text-xs font-semibold shadow-md border border-[#3b82f6]/50 transition-all inline-flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  <span>Adherir Primera Entidad Financiera</span>
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredEntities.map(fintech => (
                <div
                  key={fintech.id}
                  className={`border rounded-xl p-5 shadow-lg transition-all flex flex-col justify-between ${
                    fintech.status === 'SUSPENDED'
                      ? 'border-[#5c1d24] bg-[#1a0c14]'
                      : 'border-[#1e365b] bg-[#0d182e] hover:border-[#254575]'
                  }`}
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="text-sm font-bold text-white flex items-center gap-1.5">
                          {fintech.name}
                        </h4>
                        <p className="text-[11px] text-[#60a5fa] font-mono mt-0.5">ID: {fintech.id}</p>
                      </div>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase tracking-wider ${
                          fintech.status === 'ACTIVE'
                            ? 'bg-[#062c1d] text-[#34d399] border-[#0f5132]'
                            : 'bg-[#2e0909] text-[#f87171] border-[#661616]'
                        }`}
                      >
                        {fintech.status === 'ACTIVE' ? 'Activo' : 'Suspendido (Cuarentena)'}
                      </span>
                    </div>

                    {/* API Key */}
                    <div className="p-2.5 rounded-lg bg-[#060c17] border border-[#17253d]">
                      <div className="text-[10px] font-semibold text-[#94a3b8] flex items-center justify-between">
                        <span>Partner API Key</span>
                        <Key className="w-3 h-3 text-[#64748b]" />
                      </div>
                      <code className="text-[11px] font-mono text-[#93c5fd] block truncate mt-1">
                        {fintech.apiKey}
                      </code>
                    </div>

                    {/* Trust Weight Slider */}
                    <div className="space-y-1.5 pt-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-[#cbd5e1]">Peso de Confianza (Trust):</span>
                        <span className="font-mono font-bold text-[#60a5fa]">
                          {(fintech.trustWeight * 100).toFixed(0)}%
                        </span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        value={fintech.trustWeight}
                        onChange={e => updateTrustWeight(fintech.id, parseFloat(e.target.value))}
                        className="w-full accent-blue-500 cursor-pointer"
                      />
                      <p className="text-[10px] text-[#64748b]">
                        Calibra el impacto ponderado de los reportes emitidos por esta entidad en el grafo Zero-Knowledge.
                      </p>
                    </div>

                    {/* Métricas */}
                    <div className="grid grid-cols-3 gap-2 pt-2 border-t border-[#17253d] text-center text-[10px]">
                      <div className="p-2 rounded bg-[#060c17] border border-[#142238]">
                        <span className="block font-bold text-white text-xs">{fintech.queriesCount}</span>
                        <span className="text-[#94a3b8]">Consultas</span>
                      </div>
                      <div className="p-2 rounded bg-[#060c17] border border-[#142238]">
                        <span className="block font-bold text-[#f87171] text-xs">{fintech.reportsCount}</span>
                        <span className="text-[#94a3b8]">Reportes</span>
                      </div>
                      <div className="p-2 rounded bg-[#060c17] border border-[#142238]">
                        <span className="block font-bold text-[#60a5fa] text-xs">{fintech.falsePositivesCount}</span>
                        <span className="text-[#94a3b8]">Falsos Pos.</span>
                      </div>
                    </div>
                  </div>

                  {/* Acciones */}
                  <div className="pt-4 mt-3 border-t border-[#17253d] flex items-center justify-end">
                    <button
                      onClick={() => toggleFintechStatus(fintech.id)}
                      className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all ${
                        fintech.status === 'ACTIVE'
                          ? 'border-[#661616] text-[#f87171] hover:bg-[#2e0909]'
                          : 'border-[#0f5132] text-[#34d399] hover:bg-[#062c1d]'
                      }`}
                    >
                      {fintech.status === 'ACTIVE' ? 'Poner en Cuarentena' : 'Reactivar Entidad'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
          </div>
        )}

        {/* ── TAB 2: Auditoría Regulatoria Estándar BCRA A7370 ── */}
        {activeTab === 'audit' && <RegulatoryAuditTable />}

        {/* ── TAB 3: Telemetría ── */}
        {activeTab === 'network' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-6 bg-[#0d182e] border border-[#1e365b] rounded-xl shadow-lg space-y-4">
              <h3 className="text-xs font-bold text-white uppercase tracking-wide flex items-center gap-2">
                <Activity className="w-4 h-4 text-[#34d399]" />
                Estado del Consorcio Zero-Knowledge
              </h3>
              <div className="space-y-3 text-xs text-[#cbd5e1]">
                <div className="flex justify-between py-2 border-b border-[#17253d]">
                  <span className="text-[#94a3b8]">Algoritmo Blind Hash</span>
                  <strong className="font-mono text-white">HMAC-SHA256 (Salt Rotativo)</strong>
                </div>
                <div className="flex justify-between py-2 border-b border-[#17253d]">
                  <span className="text-[#94a3b8]">Latencia de Resolución de Red</span>
                  <strong className="font-mono text-[#34d399]">&lt; 12ms</strong>
                </div>
                <div className="flex justify-between py-2 border-b border-[#17253d]">
                  <span className="text-[#94a3b8]">Aislamiento de Bases de Datos</span>
                  <strong className="font-mono text-white">Row-Level Security (RLS) Dual</strong>
                </div>
                <div className="flex justify-between py-2 border-b border-[#17253d]">
                  <span className="text-[#94a3b8]">Estado de la Memoria Persistente</span>
                  <strong className="font-mono text-[#34d399]">{supabaseStatus} ({supabaseLatencyMs || 0}ms)</strong>
                </div>
              </div>
            </div>

            <div className="p-6 bg-[#0d182e] border border-[#1e365b] rounded-xl shadow-lg space-y-4">
              <h3 className="text-xs font-bold text-white uppercase tracking-wide flex items-center gap-2">
                <Lock className="w-4 h-4 text-[#fbbf24]" />
                Políticas de Cuarentena y Tolerancia a Fallos
              </h3>
              <p className="text-xs text-[#94a3b8] leading-relaxed">
                Si una entidad presenta una tasa de falsos positivos superior al 15% o reporta anomalías no consensuadas, el sistema reduce automáticamente su peso de confianza o la aísla temporalmente para salvaguardar la reputación de la red.
              </p>
              <div className="p-3.5 rounded-lg bg-[#2e1d09] border border-[#663e0e] text-[#fbbf24] text-xs">
                Protocolo de emergencia activable únicamente mediante firma de Gobernanza Central.
              </div>
            </div>
          </div>
        )}

        {/* ── TAB 4: Gestión de Scores de Fraude (Dual Engine) ── */}
        {activeTab === 'scoring-lab' && <ScoringLabAdmin />}

        {/* ── TAB 5: Gestión de Accesos & Roles (RBAC Supabase Auth) ── */}
        {activeTab === 'users' && <AdminUsersManagement />}
      </main>

      {/* ── Footer ── */}
      <footer className="border-t border-[#17253d] bg-[#0c1628] px-6 py-4 text-center text-xs text-[#64748b]">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2">
          <span>Consola de Gobernanza Central · Red Federal de Inteligencia Antifraude</span>
          <span className="font-mono text-[11px] text-[#60a5fa]">Build v2.4.0 — Security Hardened</span>
        </div>
      </footer>


    </div>
  );
}
