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
  Trash2,
  Mail,
  UserPlus,
  X,
  UserCheck,
  BadgeCheck,
} from 'lucide-react';
import { useConsortiumStore } from '@/lib/store';
import { computeHeuristicLearningMetrics } from '@/lib/fraudEngine';

import ScoringLabAdmin from '@/components/ScoringLabAdmin';
import RegulatoryAuditTable from '@/components/RegulatoryAuditTable';
import AdminUsersManagement from '@/components/AdminUsersManagement';
import ConsortiumLogo from '@/components/ConsortiumLogo';
import SessionTimeoutGuard from '@/components/SessionTimeoutGuard';

interface AdminConsortiumPortalProps {
  onLogout: () => void;
}

export default function AdminConsortiumPortal({ onLogout }: AdminConsortiumPortalProps) {
  const {
    adminSession,
    fintechs,
    auditLogs,
    appUsers,
    graphEdges,
    scoringConfig,
    addFintech,
    deleteFintech,
    addAuthorizedUserToFintech,
    updateTrustWeight,
    toggleFintechStatus,
    supabaseStatus,
    supabaseLatencyMs,
    resetEnvironmentToZero,
  } = useConsortiumStore();

  const activeHeuristicAlerts = React.useMemo(() => {
    return computeHeuristicLearningMetrics(graphEdges, scoringConfig).filter(m => m.alertTriggered);
  }, [graphEdges, scoringConfig]);

  const [activeTab, setActiveTab] = useState<'entities' | 'audit' | 'network' | 'scoring-lab' | 'users'>('entities');
  const [filterQuery, setFilterQuery] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  // Estados enriquecidos para alta completa de entidad
  const [newEntityName, setNewEntityName] = useState('');
  const [newContactName, setNewContactName] = useState('');
  const [newContactEmail, setNewContactEmail] = useState('');
  const [newTrustWeight, setNewTrustWeight] = useState(1.0);
  const [additionalEmails, setAdditionalEmails] = useState<string[]>([]);
  const [tempEmailInput, setTempEmailInput] = useState('');

  // Gestión inline de accesos por banco
  const [inlineAddUserId, setInlineAddUserId] = useState<string | null>(null);
  const [inlineNewUserEmail, setInlineNewUserEmail] = useState('');
  const [actionFeedback, setActionFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const handleResetToZero = async () => {
    const ok = window.confirm(
      '¿Desea resetear el entorno a 0 para comenzar con datos reales?\\n\\nEsta acción:\\n- Purgará todas las entidades bancarias de prueba (incluyendo Fintech Alpha y Banco Beta).\\n- Purgará todas las transacciones, consultas, reportes, alertas y registros de prueba.\\n- Dejará el sistema completamente en 0, listo para dar de alta entidades e importar casos reales.\\n- Sincronizará la limpieza de inmediato en Supabase y en todas las sesiones activas.'
    );
    if (!ok) return;
    setIsResetting(true);
    try {
      await resetEnvironmentToZero();
      alert('Entorno reiniciado exitosamente a 0. Todas las entidades de prueba y registros han sido purgados.');
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

  const handleAddAdditionalEmail = (e?: React.MouseEvent | React.KeyboardEvent) => {
    if (e) e.preventDefault();
    const clean = tempEmailInput.trim().toLowerCase();
    if (!clean) return;
    if (!clean.includes('@') || !clean.includes('.')) {
      alert('Por favor ingrese un formato de correo electrónico válido.');
      return;
    }
    if (clean === newContactEmail.trim().toLowerCase()) {
      alert('Este correo ya está ingresado como el contacto principal.');
      return;
    }
    if (additionalEmails.includes(clean)) {
      alert('Este correo ya fue agregado a la lista.');
      return;
    }
    setAdditionalEmails([...additionalEmails, clean]);
    setTempEmailInput('');
  };

  const handleRemoveAdditionalEmail = (emailToRemove: string) => {
    setAdditionalEmails(additionalEmails.filter(e => e !== emailToRemove));
  };

  const handleCreateEntity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEntityName.trim()) {
      alert('El nombre de la entidad es obligatorio.');
      return;
    }
    if (!newContactEmail.trim()) {
      alert('El correo electrónico del responsable es obligatorio para generar los accesos.');
      return;
    }

    try {
      const created = addFintech({
        name: newEntityName.trim(),
        contactName: newContactName.trim() || undefined,
        contactEmail: newContactEmail.trim(),
        trustWeight: newTrustWeight,
        authorizedEmails: additionalEmails,
      });

      setNewEntityName('');
      setNewContactName('');
      setNewContactEmail('');
      setNewTrustWeight(1.0);
      setAdditionalEmails([]);
      setTempEmailInput('');
      setIsAdding(false);

      setActionFeedback({
        type: 'success',
        message: `¡Entidad "${created.name}" creada exitosamente con sus accesos emitidos!`,
      });
      setTimeout(() => setActionFeedback(null), 5000);
    } catch (err: any) {
      alert('Error creando entidad: ' + (err?.message || String(err)));
    }
  };

  const handleDeleteEntity = async (fintech: { id: string; name: string }) => {
    const ok = window.confirm(
      `¿Está seguro de eliminar definitivamente a "${fintech.name}" (ID: ${fintech.id})?\n\nEsta acción revocará su API Key, eliminará sus credenciales y desvinculará a los operadores asignados a esta entidad.`
    );
    if (!ok) return;

    try {
      const res = await deleteFintech(fintech.id);
      if (res.success) {
        setActionFeedback({
          type: 'success',
          message: res.message,
        });
        setTimeout(() => setActionFeedback(null), 5000);
      } else {
        alert(res.message);
      }
    } catch (err: any) {
      alert('Error eliminando entidad: ' + (err?.message || String(err)));
    }
  };

  const handleInlineAddUser = async (fintechId: string) => {
    const clean = inlineNewUserEmail.trim().toLowerCase();
    if (!clean) return;
    if (!clean.includes('@') || !clean.includes('.')) {
      alert('Por favor ingrese un correo electrónico válido.');
      return;
    }

    try {
      const res = await addAuthorizedUserToFintech(fintechId, clean, 'usuario');
      if (res.success) {
        setInlineNewUserEmail('');
        setInlineAddUserId(null);
        setActionFeedback({ type: 'success', message: res.message });
        setTimeout(() => setActionFeedback(null), 4000);
      } else {
        alert(res.message);
      }
    } catch (err: any) {
      alert('Error otorgando acceso: ' + (err?.message || String(err)));
    }
  };

  const filteredEntities = fintechs.filter(f =>
    f.name.toLowerCase().includes(filterQuery.toLowerCase()) ||
    f.id.toLowerCase().includes(filterQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[#070d18] text-[#f1f5f9] font-sans flex flex-col justify-between selection:bg-[#1d4ed8] selection:text-white">
      <SessionTimeoutGuard />
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
            {/* Estado de Conexión Real */}
            <div
              className={`hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-mono text-[11px] ${
                supabaseStatus === 'CONNECTED'
                  ? 'bg-emerald-950/60 border border-emerald-500/40 text-emerald-300'
                  : 'bg-amber-950/60 border border-amber-500/40 text-amber-300'
              }`}
              title={supabaseStatus === 'CONNECTED' ? `Conexión a Supabase activa (${supabaseLatencyMs}ms)` : 'Modo local seguro ZK'}
            >
              <span className="relative flex h-2 w-2">
                {supabaseStatus === 'CONNECTED' && (
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                )}
                <span className={`relative inline-flex rounded-full h-2 w-2 ${supabaseStatus === 'CONNECTED' ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
              </span>
              <span>{supabaseStatus === 'CONNECTED' ? `Supabase en Vivo (${supabaseLatencyMs}ms)` : 'Modo Local ZK'}</span>
            </div>

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
                title="Restablecer el entorno desde cero: purga entidades de prueba y deja el sistema completamente limpio."
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
              {activeHeuristicAlerts.length > 0 ? (
                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 ml-1 animate-pulse flex items-center gap-1">
                  <AlertTriangle className="w-2.5 h-2.5" />
                  {activeHeuristicAlerts.length} Alerta{activeHeuristicAlerts.length > 1 ? 's' : ''} Heurística{activeHeuristicAlerts.length > 1 ? 's' : ''}
                </span>
              ) : (
                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 ml-1">
                  Motor Dual
                </span>
              )}
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

        {/* Banner de Feedback / Notificaciones de Acción */}
        {actionFeedback && (
          <div
            className={`p-4 rounded-xl border flex items-center justify-between animate-in fade-in duration-200 ${
              actionFeedback.type === 'success'
                ? 'bg-[#062c1d] border-[#0f5132] text-[#86efac]'
                : 'bg-[#2e0909] border-[#661616] text-[#fca5a5]'
            }`}
          >
            <div className="flex items-center gap-2.5 text-xs font-medium">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{actionFeedback.message}</span>
            </div>
            <button
              onClick={() => setActionFeedback(null)}
              className="text-xs hover:opacity-80 p-1"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Formulario Enriquecido: Añadir Entidad Financiera */}
        {isAdding && (
          <div className="p-6 bg-[#0d182e] border border-[#1e365b] rounded-2xl shadow-2xl animate-in fade-in duration-200 space-y-5">
            <div className="flex items-start justify-between border-b border-[#17253d] pb-4">
              <div>
                <h3 className="text-sm font-bold text-white uppercase tracking-wide flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-[#60a5fa]" />
                  <span>Adhesión de Nueva Entidad Financiera y Configuración de Accesos</span>
                </h3>
                <p className="text-xs text-[#94a3b8] mt-1">
                  Configure los datos institucionales, el responsable legal y los correos autorizados para operar la plataforma.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsAdding(false)}
                className="text-[#94a3b8] hover:text-white p-1 rounded-lg hover:bg-[#13233e] transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateEntity} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* 1. Nombre de la Entidad */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-[#cbd5e1]">
                    Razón Social / Nombre de la Entidad <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={newEntityName}
                    onChange={e => setNewEntityName(e.target.value)}
                    placeholder="ej: Banco Santander, Banco Galicia, Ualá, Mercado Pago..."
                    className="w-full px-3.5 py-2.5 bg-[#060c17] border border-[#1e365b] rounded-lg text-xs text-white placeholder-[#475569] focus:outline-none focus:border-[#3b82f6]"
                  />
                </div>

                {/* 2. Nombre del Responsable */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-[#cbd5e1]">
                    Nombre del Responsable / Funcionario
                  </label>
                  <input
                    type="text"
                    value={newContactName}
                    onChange={e => setNewContactName(e.target.value)}
                    placeholder="ej: Dra. Sofía Albarracín - Jefa de Ciberdelito y Prevención"
                    className="w-full px-3.5 py-2.5 bg-[#060c17] border border-[#1e365b] rounded-lg text-xs text-white placeholder-[#475569] focus:outline-none focus:border-[#3b82f6]"
                  />
                </div>

                {/* 3. Email Principal del Responsable */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-[#cbd5e1]">
                    Email Principal del Responsable <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    value={newContactEmail}
                    onChange={e => setNewContactEmail(e.target.value)}
                    placeholder="ej: sofia.albarracin@banco.com.ar"
                    className="w-full px-3.5 py-2.5 bg-[#060c17] border border-[#1e365b] rounded-lg text-xs text-white placeholder-[#475569] focus:outline-none focus:border-[#3b82f6]"
                  />
                  <p className="text-[11px] text-[#64748b]">
                    Este correo se creará automáticamente como Operador con acceso al Portal de Entidades.
                  </p>
                </div>

                {/* 4. Peso de Confianza Inicial */}
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center text-xs">
                    <label className="font-semibold text-[#cbd5e1]">Peso de Confianza Inicial (Trust Weight)</label>
                    <span className="font-mono font-bold text-[#60a5fa]">{(newTrustWeight * 100).toFixed(0)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0.5"
                    max="1"
                    step="0.05"
                    value={newTrustWeight}
                    onChange={e => setNewTrustWeight(parseFloat(e.target.value))}
                    className="w-full accent-blue-500 cursor-pointer mt-2"
                  />
                  <p className="text-[11px] text-[#64748b]">
                    Calibra la ponderación de sus reportes en el grafo federal (recomendado 100% para bancos regulados).
                  </p>
                </div>
              </div>

              {/* 5. Múltiples Accesos Adicionales */}
              <div className="p-4 rounded-xl bg-[#060c17] border border-[#17253d] space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-[#cbd5e1] flex items-center gap-1.5">
                    <UserPlus className="w-3.5 h-3.5 text-[#60a5fa]" />
                    <span>Accesos Adicionales Autorizados (Operadores / Analistas)</span>
                  </label>
                  <span className="text-[11px] text-[#94a3b8]">
                    {additionalEmails.length} adicionales añadidos
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="email"
                    value={tempEmailInput}
                    onChange={e => setTempEmailInput(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddAdditionalEmail();
                      }
                    }}
                    placeholder="ej: analista_riesgo@banco.com.ar (Presione Enter o Sumar)"
                    className="flex-1 px-3 py-2 bg-[#0d182e] border border-[#1e365b] rounded-lg text-xs text-white placeholder-[#475569] focus:outline-none focus:border-[#3b82f6]"
                  />
                  <button
                    type="button"
                    onClick={handleAddAdditionalEmail}
                    className="px-3.5 py-2 rounded-lg bg-[#1e3a6a] hover:bg-[#254985] text-cyan-200 text-xs font-semibold transition-all border border-[#2b5394]"
                  >
                    + Sumar Acceso
                  </button>
                </div>

                {/* Lista de tags de correos adicionales */}
                {additionalEmails.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-2 border-t border-[#14233c]">
                    {additionalEmails.map(email => (
                      <span
                        key={email}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#13233e] text-[#93c5fd] border border-[#203c68] text-xs font-mono"
                      >
                        <Mail className="w-3 h-3 text-[#60a5fa]" />
                        <span>{email}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveAdditionalEmail(email)}
                          className="text-[#f87171] hover:text-white ml-1"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Botones de Acción */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#17253d]">
                <button
                  type="button"
                  onClick={() => setIsAdding(false)}
                  className="px-4 py-2.5 rounded-lg bg-[#13233e] text-[#94a3b8] text-xs font-medium hover:bg-[#1a3052] border border-[#203c68]"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-lg bg-[#1d4ed8] hover:bg-[#2563eb] text-white text-xs font-semibold shadow-md border border-[#3b82f6]/50 flex items-center gap-2"
                >
                  <Building2 className="w-4 h-4" />
                  <span>Adherir Entidad & Otorgar Accesos</span>
                </button>
              </div>
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
                placeholder="Filtrar por nombre, identificador o responsable..."
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
                    Haga clic en <strong className="text-white">"Adherir Nueva Entidad"</strong> para dar de alta su primer banco o fintech con sus operadores autorizados.
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
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredEntities.map(fintech => {
                // Obtener todos los operadores asignados a esta entidad
                const entityUsers = appUsers.filter(u => u.entityId === fintech.id);
                const allAuthorized = Array.from(new Set([
                  ...(fintech.authorizedEmails || []),
                  ...(fintech.contactEmail ? [fintech.contactEmail] : []),
                  ...entityUsers.map(u => u.email),
                ])).filter(Boolean);

                return (
                  <div
                    key={fintech.id}
                    className={`border rounded-xl p-5 shadow-lg transition-all flex flex-col justify-between ${
                      fintech.status === 'SUSPENDED'
                        ? 'border-[#5c1d24] bg-[#1a0c14]'
                        : 'border-[#1e365b] bg-[#0d182e] hover:border-[#254575]'
                    }`}
                  >
                    <div className="space-y-3.5">
                      {/* Header de la Tarjeta */}
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
                          {fintech.status === 'ACTIVE' ? 'Activo' : 'En Cuarentena'}
                        </span>
                      </div>

                      {/* Partner API Key */}
                      <div className="p-2.5 rounded-lg bg-[#060c17] border border-[#17253d]">
                        <div className="text-[10px] font-semibold text-[#94a3b8] flex items-center justify-between">
                          <span>Partner API Key</span>
                          <Key className="w-3 h-3 text-[#64748b]" />
                        </div>
                        <code className="text-[11px] font-mono text-[#93c5fd] block truncate mt-1">
                          {fintech.apiKey}
                        </code>
                      </div>

                      {/* Responsable Institucional */}
                      <div className="p-2.5 rounded-lg bg-[#060c17] border border-[#17253d] space-y-1">
                        <span className="text-[10px] font-semibold text-[#94a3b8] block uppercase tracking-wider">
                          Responsable Institucional
                        </span>
                        <p className="text-xs font-medium text-white truncate">
                          {fintech.contactName || 'No especificado'}
                        </p>
                        <p className="text-[11px] text-[#60a5fa] font-mono flex items-center gap-1.5 truncate">
                          <Mail className="w-3 h-3 shrink-0" />
                          <span>{fintech.contactEmail || 'Sin email principal'}</span>
                        </p>
                      </div>

                      {/* Operadores y Accesos Autorizados */}
                      <div className="p-2.5 rounded-lg bg-[#060c17] border border-[#17253d] space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-semibold text-[#94a3b8] flex items-center gap-1 uppercase tracking-wider">
                            <Users className="w-3 h-3 text-[#60a5fa]" />
                            <span>Accesos Autorizados ({allAuthorized.length})</span>
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              if (inlineAddUserId === fintech.id) {
                                setInlineAddUserId(null);
                              } else {
                                setInlineAddUserId(fintech.id);
                                setInlineNewUserEmail('');
                              }
                            }}
                            className="text-[11px] text-cyan-300 hover:text-white font-medium hover:underline flex items-center gap-1"
                          >
                            <Plus className="w-3 h-3" />
                            <span>Sumar Acceso</span>
                          </button>
                        </div>

                        {/* Lista de badges de operadores */}
                        <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto pr-1">
                          {allAuthorized.length === 0 ? (
                            <span className="text-[11px] text-[#64748b] italic">Sin operadores adicionales</span>
                          ) : (
                            allAuthorized.map(em => (
                              <span
                                key={em}
                                className="px-2 py-0.5 rounded bg-[#101f38] text-[#93c5fd] border border-[#1d3863] text-[10px] font-mono truncate max-w-full"
                                title={em}
                              >
                                {em}
                              </span>
                            ))
                          )}
                        </div>

                        {/* Input inline para sumar acceso */}
                        {inlineAddUserId === fintech.id && (
                          <div className="pt-2 border-t border-[#17253d] flex items-center gap-1.5 animate-in fade-in duration-150">
                            <input
                              type="email"
                              value={inlineNewUserEmail}
                              onChange={e => setInlineNewUserEmail(e.target.value)}
                              onKeyDown={e => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  handleInlineAddUser(fintech.id);
                                }
                              }}
                              placeholder="correo@entidad.com..."
                              className="flex-1 px-2 py-1 bg-[#0c1628] border border-[#1e365b] rounded text-xs text-white placeholder-[#475569] focus:outline-none focus:border-[#3b82f6]"
                            />
                            <button
                              type="button"
                              onClick={() => handleInlineAddUser(fintech.id)}
                              className="px-2.5 py-1 rounded bg-[#1d4ed8] hover:bg-[#2563eb] text-white text-xs font-semibold"
                            >
                              Dar
                            </button>
                            <button
                              type="button"
                              onClick={() => setInlineAddUserId(null)}
                              className="p-1 text-[#94a3b8] hover:text-white"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
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

                    {/* Acciones Inferiores (Cuarentena & Eliminar) */}
                    <div className="pt-4 mt-3 border-t border-[#17253d] flex items-center justify-between gap-2">
                      <button
                        onClick={() => handleDeleteEntity(fintech)}
                        className="text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-[#5e1923] bg-[#240e13] text-[#fca5a5] hover:bg-[#381119] transition-all flex items-center gap-1.5"
                        title={`Eliminar definitivamente a ${fintech.name}`}
                      >
                        <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                        <span>Eliminar Banco</span>
                      </button>

                      <button
                        onClick={() => toggleFintechStatus(fintech.id)}
                        className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all ${
                          fintech.status === 'ACTIVE'
                            ? 'border-[#661616] text-[#f87171] hover:bg-[#2e0909]'
                            : 'border-[#0f5132] text-[#34d399] hover:bg-[#062c1d]'
                        }`}
                      >
                        {fintech.status === 'ACTIVE' ? 'Poner en Cuarentena' : 'Reactivar'}
                      </button>
                    </div>
                  </div>
                );
              })}
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
