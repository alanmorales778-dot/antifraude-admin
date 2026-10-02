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
} from 'lucide-react';
import { useConsortiumStore } from '@/lib/store';
import DatabaseConfigModal from '@/components/DatabaseConfigModal';

interface AdminConsortiumPortalProps {
  onLogout: () => void;
}

export default function AdminConsortiumPortal({ onLogout }: AdminConsortiumPortalProps) {
  const {
    adminSession,
    fintechs,
    auditLogs,
    addFintech,
    updateTrustWeight,
    toggleFintechStatus,
    supabaseStatus,
    supabaseLatencyMs,
  } = useConsortiumStore();

  const [activeTab, setActiveTab] = useState<'entities' | 'audit' | 'network'>('entities');
  const [newEntityName, setNewEntityName] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [isDbModalOpen, setIsDbModalOpen] = useState(false);
  const [filterQuery, setFilterQuery] = useState('');

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
    <div className="min-h-screen bg-[#f5f4ef] text-[#1c2430] font-sans flex flex-col justify-between selection:bg-[#0f2132] selection:text-white">
      {/* ── Top Executive Bar ── */}
      <header className="border-b border-[#ded9cb] bg-[#fbfaf6] px-6 py-4 sticky top-0 z-30 shadow-2xs">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-[#0f2132] text-[#f7f6f2] flex items-center justify-center font-serif font-bold text-base shadow-sm border border-[#22374d]">
              G
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold tracking-wider text-[#0f2132] uppercase">
                  Consorcio Federal Antifraude
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-[#e8e4d8] text-[#556372] font-mono font-semibold">
                  Mando Central
                </span>
              </div>
              <p className="text-[11px] text-[#6b7785] font-mono">
                Operador: {adminSession?.email || 'superadmin@consorcio-antifraude.org'} (Firma Digital Activa)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Supabase Status Indicator */}
            <button
              onClick={() => setIsDbModalOpen(true)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono border transition-all ${
                supabaseStatus === 'CONNECTED'
                  ? 'bg-[#ebf7ee] border-[#b7e4c7] text-[#2d6a4f] hover:bg-[#d8f3dc]'
                  : 'bg-[#fff8e7] border-[#ffe8b3] text-[#b45309] hover:bg-[#fff0c2]'
              }`}
            >
              <Database className="w-3.5 h-3.5" />
              <span>
                {supabaseStatus === 'CONNECTED'
                  ? `Cloud DB: ${supabaseLatencyMs || 0}ms`
                  : 'Memoria Local (Configurar DB)'}
              </span>
            </button>

            {/* Logout */}
            <button
              onClick={onLogout}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-medium text-[#c53030] hover:text-[#9b2c2c] bg-white hover:bg-[#fff5f5] border border-[#fed7d7] transition-all shadow-2xs"
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
        <div className="flex items-center justify-between border-b border-[#ded9cb] pb-4">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('entities')}
              className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'entities'
                  ? 'bg-[#0f2132] text-white shadow-2xs'
                  : 'bg-white text-[#4a5568] hover:bg-[#eae7dd] border border-[#ded9cb]'
              }`}
            >
              Entidades Participantes ({fintechs.length})
            </button>

            <button
              onClick={() => setActiveTab('audit')}
              className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'audit'
                  ? 'bg-[#0f2132] text-white shadow-2xs'
                  : 'bg-white text-[#4a5568] hover:bg-[#eae7dd] border border-[#ded9cb]'
              }`}
            >
              Libro de Auditoría Regulatoria ({auditLogs.length})
            </button>

            <button
              onClick={() => setActiveTab('network')}
              className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'network'
                  ? 'bg-[#0f2132] text-white shadow-2xs'
                  : 'bg-white text-[#4a5568] hover:bg-[#eae7dd] border border-[#ded9cb]'
              }`}
            >
              Telemetría & Salud de Red
            </button>
          </div>

          {activeTab === 'entities' && (
            <button
              onClick={() => setIsAdding(!isAdding)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#1b3b36] hover:bg-[#254d46] text-white text-xs font-medium shadow-2xs transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Adherir Nueva Entidad</span>
            </button>
          )}
        </div>

        {/* Formulario Añadir Entidad */}
        {isAdding && (
          <div className="p-5 bg-white border border-[#ded9cb] rounded-xl shadow-2xs animate-in fade-in duration-200">
            <h3 className="text-xs font-bold text-[#0f2132] uppercase tracking-wide mb-2">
              Adhesión de Nueva Entidad Financiera
            </h3>
            <form onSubmit={handleCreateEntity} className="flex flex-wrap items-center gap-3">
              <input
                type="text"
                required
                value={newEntityName}
                onChange={e => setNewEntityName(e.target.value)}
                placeholder="Nombre de la entidad (ej: Banco Santander, Ualá, Naranja X)..."
                className="flex-1 min-w-[280px] px-3.5 py-2 bg-[#faf9f6] border border-[#dcd7cb] rounded-lg text-xs text-[#1a202c] focus:outline-none focus:border-[#0f2132]"
              />
              <button
                type="submit"
                className="px-4 py-2 rounded-lg bg-[#0f2132] hover:bg-[#1a334d] text-white text-xs font-semibold shadow-2xs"
              >
                Generar Credenciales y Adherir
              </button>
              <button
                type="button"
                onClick={() => setIsAdding(false)}
                className="px-3 py-2 rounded-lg bg-[#eae7dd] text-[#4a5568] text-xs font-medium hover:bg-[#ded9cb]"
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
                className="w-full px-3.5 py-2 pl-9 bg-white border border-[#ded9cb] rounded-lg text-xs text-[#1a202c] placeholder-[#a0aec0] focus:outline-none focus:border-[#0f2132] shadow-2xs"
              />
              <Search className="w-3.5 h-3.5 text-[#a0aec0] absolute left-3 top-2.5" />
            </div>

            {/* Listado de Entidades */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredEntities.map(fintech => (
                <div
                  key={fintech.id}
                  className={`bg-white border rounded-xl p-5 shadow-2xs transition-all flex flex-col justify-between ${
                    fintech.status === 'SUSPENDED'
                      ? 'border-[#feb2b2] bg-[#fffaf9]'
                      : 'border-[#ded9cb]'
                  }`}
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="text-sm font-bold text-[#0f2132] flex items-center gap-1.5">
                          {fintech.name}
                        </h4>
                        <p className="text-[11px] text-[#718096] font-mono mt-0.5">ID: {fintech.id}</p>
                      </div>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase tracking-wider ${
                          fintech.status === 'ACTIVE'
                            ? 'bg-[#edf7ed] text-[#2e7d32] border-[#c8e6c9]'
                            : 'bg-[#ffebee] text-[#c62828] border-[#ffcdd2]'
                        }`}
                      >
                        {fintech.status === 'ACTIVE' ? 'Activo' : 'Suspendido (Cuarentena)'}
                      </span>
                    </div>

                    {/* API Key */}
                    <div className="p-2.5 rounded-lg bg-[#faf9f6] border border-[#e8e4dc]">
                      <div className="text-[10px] font-semibold text-[#718096] flex items-center justify-between">
                        <span>Partner API Key</span>
                        <Key className="w-3 h-3 text-[#a0aec0]" />
                      </div>
                      <code className="text-[11px] font-mono text-[#2d3748] block truncate mt-1">
                        {fintech.apiKey}
                      </code>
                    </div>

                    {/* Trust Weight Slider */}
                    <div className="space-y-1.5 pt-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-[#4a5568]">Peso de Confianza (Trust):</span>
                        <span className="font-mono font-bold text-[#0f2132]">
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
                        className="w-full accent-[#0f2132] cursor-pointer"
                      />
                      <p className="text-[10px] text-[#718096]">
                        Influye en la severidad ponderada de los reportes emitidos por esta entidad.
                      </p>
                    </div>

                    {/* Métricas */}
                    <div className="grid grid-cols-3 gap-2 pt-2 border-t border-[#eeebe2] text-center text-[10px]">
                      <div className="p-1.5 rounded bg-[#f7f6f2]">
                        <span className="block font-bold text-[#0f2132]">{fintech.queriesCount}</span>
                        <span className="text-[#718096]">Consultas</span>
                      </div>
                      <div className="p-1.5 rounded bg-[#f7f6f2]">
                        <span className="block font-bold text-[#c53030]">{fintech.reportsCount}</span>
                        <span className="text-[#718096]">Reportes</span>
                      </div>
                      <div className="p-1.5 rounded bg-[#f7f6f2]">
                        <span className="block font-bold text-[#2b6cb0]">{fintech.falsePositivesCount}</span>
                        <span className="text-[#718096]">Falsos Pos.</span>
                      </div>
                    </div>
                  </div>

                  {/* Acciones */}
                  <div className="pt-4 mt-3 border-t border-[#eeebe2] flex items-center justify-end">
                    <button
                      onClick={() => toggleFintechStatus(fintech.id)}
                      className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all ${
                        fintech.status === 'ACTIVE'
                          ? 'border-[#feb2b2] text-[#c53030] hover:bg-[#fff5f5]'
                          : 'border-[#c8e6c9] text-[#2e7d32] hover:bg-[#edf7ed]'
                      }`}
                    >
                      {fintech.status === 'ACTIVE' ? 'Poner en Cuarentena' : 'Reactivar Entidad'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── TAB 2: Auditoría ── */}
        {activeTab === 'audit' && (
          <div className="bg-white border border-[#ded9cb] rounded-xl overflow-hidden shadow-2xs">
            <div className="p-4 border-b border-[#ded9cb] bg-[#faf9f6] flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold text-[#0f2132] uppercase tracking-wide">
                  Trazabilidad Criptográfica Inmutable
                </h3>
                <p className="text-[11px] text-[#718096]">
                  Registro auditado bajo estándar BCRA y sincronizado en tiempo real con Supabase.
                </p>
              </div>
              <span className="text-xs font-mono text-[#718096]">
                {auditLogs.length} eventos registrados
              </span>
            </div>

            <div className="divide-y divide-[#eeebe2] max-h-[550px] overflow-y-auto font-mono text-xs">
              {auditLogs.map((log, idx) => (
                <div key={idx} className="p-3.5 hover:bg-[#faf9f6] transition flex items-start gap-4">
                  <span className="text-[11px] text-[#a0aec0] shrink-0">
                    {new Date(log.timestamp).toLocaleTimeString()}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-[#f0ede6] text-[#2d3748] font-bold text-[10px] shrink-0">
                    {log.action}
                  </span>
                  <span className="font-semibold text-[#0f2132] shrink-0">
                    [{log.actor}]
                  </span>
                  <span className="text-[#4a5568] flex-1 font-sans text-xs">
                    {log.details}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── TAB 3: Telemetría ── */}
        {activeTab === 'network' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-6 bg-white border border-[#ded9cb] rounded-xl shadow-2xs space-y-4">
              <h3 className="text-xs font-bold text-[#0f2132] uppercase tracking-wide flex items-center gap-2">
                <Activity className="w-4 h-4 text-[#2e7d32]" />
                Estado del Consorcio Zero-Knowledge
              </h3>
              <div className="space-y-3 text-xs text-[#4a5568]">
                <div className="flex justify-between py-2 border-b border-[#eeebe2]">
                  <span>Algoritmo Blind Hash</span>
                  <strong className="font-mono text-[#0f2132]">HMAC-SHA256 (Salt Rotativo)</strong>
                </div>
                <div className="flex justify-between py-2 border-b border-[#eeebe2]">
                  <span>Latencia de Resolución de Red</span>
                  <strong className="font-mono text-[#2e7d32]">&lt; 12ms</strong>
                </div>
                <div className="flex justify-between py-2 border-b border-[#eeebe2]">
                  <span>Aislamiento de Bases de Datos</span>
                  <strong className="font-mono text-[#0f2132]">Row-Level Security (RLS) Activo</strong>
                </div>
                <div className="flex justify-between py-2 border-b border-[#eeebe2]">
                  <span>Estado de la Memoria Persistente</span>
                  <strong className="font-mono text-[#2e7d32]">{supabaseStatus} ({supabaseLatencyMs || 0}ms)</strong>
                </div>
              </div>
            </div>

            <div className="p-6 bg-white border border-[#ded9cb] rounded-xl shadow-2xs space-y-4">
              <h3 className="text-xs font-bold text-[#0f2132] uppercase tracking-wide flex items-center gap-2">
                <Lock className="w-4 h-4 text-[#b45309]" />
                Políticas de Cuarentena y Tolerancia a Fallos
              </h3>
              <p className="text-xs text-[#718096] leading-relaxed">
                Si una entidad presenta una tasa de falsos positivos superior al 15% o reporta anomalías no consensuadas, el sistema reduce automáticamente su peso de confianza o la aísla temporalmente para salvaguardar la reputación de la red.
              </p>
              <div className="p-3.5 rounded-lg bg-[#fff8e7] border border-[#ffe8b3] text-[#b45309] text-xs">
                Protocolo de emergencia activable únicamente mediante firma de Gobernanza Central.
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ── Footer ── */}
      <footer className="border-t border-[#ded9cb] bg-[#fbfaf6] px-6 py-4 text-center text-xs text-[#718096]">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2">
          <span>Consola de Gobernanza Central · Red Federal de Inteligencia Antifraude</span>
          <span className="font-mono text-[11px]">Build v2.4.0 — Security Hardened</span>
        </div>
      </footer>

      {/* Database Modal */}
      <DatabaseConfigModal
        isOpen={isDbModalOpen}
        onClose={() => setIsDbModalOpen(false)}
      />
    </div>
  );
}
