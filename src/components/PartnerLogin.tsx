'use client';

import React, { useState } from 'react';
import {
  Building2,
  KeyRound,
  Mail,
  UserCheck,
  ArrowRight,
  ShieldCheck,
  Network,
  Lock,
  Layers,
  Sparkles,
  HelpCircle,
  Eye,
  EyeOff,
  AlertCircle,
  Briefcase,
} from 'lucide-react';
import { useConsortiumStore } from '@/lib/store';
import { UserRole } from '@/lib/types';

interface PartnerLoginProps {
  onSuccess?: () => void;
  onNavigateAdmin?: () => void;
  onNavigateHome?: () => void;
  showAdminLink?: boolean;
}

export default function PartnerLogin({
  onSuccess,
  onNavigateAdmin,
  onNavigateHome,
  showAdminLink = false,
}: PartnerLoginProps) {
  const { fintechs, loginPartner, setCurrentRoute } = useConsortiumStore();

  const [selectedEntityId, setSelectedEntityId] = useState(fintechs[0]?.id || 'fintech-alpha');
  const [apiKey, setApiKey] = useState(fintechs[0]?.apiKey || 'antf_live_alpha_a1b2c3d4e5f6');
  const [operatorEmail, setOperatorEmail] = useState('analista.fraude@alpha-fintech.ar');
  const [operatorRole, setOperatorRole] = useState<UserRole>('ANALYST_L2');
  const [showKey, setShowKey] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Cuando cambia la entidad seleccionada, actualizar la API key demo
  const handleEntityChange = (id: string) => {
    setSelectedEntityId(id);
    const entity = fintechs.find(f => f.id === id);
    if (entity) {
      setApiKey(entity.apiKey);
      const slug = entity.name.toLowerCase().replace(/[^a-z0-9]/g, '');
      setOperatorEmail(`riesgo@${slug}.com.ar`);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg(null);

    try {
      const res = await loginPartner({
        entityId: selectedEntityId,
        apiKey,
        operatorEmail,
        operatorRole,
      });

      if (res.success) {
        if (onSuccess) onSuccess();
        else setCurrentRoute('partner-portal');
      } else {
        setErrorMsg(res.message);
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Error durante la autenticación de la entidad');
    } finally {
      setIsLoading(false);
    }
  };

  const selectedEntity = fintechs.find(f => f.id === selectedEntityId) || fintechs[0];

  return (
    <div className="min-h-screen bg-[#070d18] text-[#f1f5f9] font-sans flex flex-col justify-between selection:bg-[#1d4ed8] selection:text-white">
      {/* ── Header Institucional B2B ── */}
      <header className="border-b border-[#17253d] bg-[#0c1628]/95 backdrop-blur-md px-6 py-4 sticky top-0 z-30">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#1d4ed8] to-[#0f2756] text-white flex items-center justify-center font-serif font-bold text-base shadow-[0_0_15px_rgba(29,78,216,0.35)] border border-[#3b82f6]/40">
              B
            </div>
            <div>
              <span className="block text-xs font-bold tracking-wider text-white uppercase">
                Portal de Entidades Financieras
              </span>
              <span className="block text-[11px] text-[#60a5fa] font-mono">
                Bancos · Billeteras Virtuales · Neobancos
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#062c1d] border border-[#0f5132] text-[#34d399] font-mono text-[11px]">
              <span className="w-2 h-2 rounded-full bg-[#10b981] animate-pulse" />
              Red Federal Activa
            </span>
            {showAdminLink && onNavigateAdmin && (
              <button
                type="button"
                onClick={onNavigateAdmin}
                className="text-xs font-medium text-[#94a3b8] hover:text-white px-3.5 py-1.5 rounded-lg border border-[#1e365b] bg-[#0c172c] hover:bg-[#162746] transition-all"
              >
                Acceso Gobernanza (Admin) →
              </button>
            )}
          </div>
        </div>
      </header>

      {/* ── Cuerpo Principal ── */}
      <main className="flex-1 flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-[500px]">
          {/* Tarjeta de Autenticación */}
          <div className="bg-[#0d182e] border border-[#1e365b] rounded-2xl shadow-[0_8px_32px_rgba(3,7,18,0.6)] overflow-hidden">
            {/* Cabecera con Acento Azul Seguridad */}
            <div className="bg-gradient-to-b from-[#0f203c] to-[#0a1528] px-8 pt-8 pb-7 border-b border-[#1b3152]">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-[#13233e] border border-[#203c68] text-[11px] font-mono text-[#93c5fd] uppercase tracking-wider mb-3">
                <Network className="w-3.5 h-3.5 text-[#60a5fa]" />
                Acceso B2B a Red Federal
              </div>
              <h1 className="text-xl font-bold tracking-tight text-white">
                Ingreso de Entidades Participantes
              </h1>
              <p className="text-xs text-[#94a3b8] mt-2 leading-relaxed">
                Accedé a tu <strong className="text-white">Internal Risk Workspace</strong> y consultá correlaciones de amenazas en la red interbancaria Zero-Knowledge.
              </p>
            </div>

            {/* Formulario */}
            <form onSubmit={handleSubmit} className="p-8 space-y-4 bg-[#0d182e]">
              {errorMsg && (
                <div className="p-3.5 rounded-xl bg-[#2e0909] border border-[#661616] text-[#fca5a5] text-xs flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-[#ef4444]" />
                  <span className="leading-snug">{errorMsg}</span>
                </div>
              )}

              {/* Selector de Entidad */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-[#cbd5e1] tracking-wide">
                  Seleccionar Entidad Financiera
                </label>
                <div className="relative">
                  <select
                    value={selectedEntityId}
                    onChange={e => handleEntityChange(e.target.value)}
                    className="w-full px-3.5 py-2.5 pl-10 bg-[#060c17] border border-[#1e365b] rounded-lg text-xs text-white focus:outline-none focus:border-[#3b82f6] transition-all cursor-pointer font-medium"
                  >
                    {fintechs.map(f => (
                      <option key={f.id} value={f.id} className="bg-[#0c1628] text-white">
                        {f.name} {f.status === 'SUSPENDED' ? '(En Cuarentena)' : ''}
                      </option>
                    ))}
                  </select>
                  <Building2 className="w-4 h-4 text-[#64748b] absolute left-3.5 top-3 pointer-events-none" />
                </div>
              </div>

              {/* Estado de la entidad seleccionada */}
              {selectedEntity && (
                <div className="p-3 rounded-lg bg-[#060c17] border border-[#17253d] flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${selectedEntity.status === 'ACTIVE' ? 'bg-[#10b981]' : 'bg-[#ef4444]'}`} />
                    <span className="text-[#cbd5e1] font-medium">{selectedEntity.name}</span>
                  </div>
                  <span className="text-[11px] font-mono text-[#60a5fa]">
                    Trust Weight: {(selectedEntity.trustWeight * 100).toFixed(0)}%
                  </span>
                </div>
              )}

              {/* API Key */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-semibold text-[#cbd5e1] tracking-wide">
                    API Key B2B de la Entidad
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowKey(!showKey)}
                    className="text-[11px] text-[#60a5fa] hover:text-[#93c5fd] transition flex items-center gap-1 font-mono"
                  >
                    {showKey ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                    <span>{showKey ? 'Ocultar' : 'Ver'}</span>
                  </button>
                </div>
                <div className="relative">
                  <input
                    type={showKey ? 'text' : 'password'}
                    required
                    value={apiKey}
                    onChange={e => setApiKey(e.target.value)}
                    placeholder="antf_live_..."
                    className="w-full px-3.5 py-2.5 pl-10 bg-[#060c17] border border-[#1e365b] rounded-lg text-xs text-white placeholder-[#475569] focus:outline-none focus:border-[#3b82f6] transition-all font-mono"
                  />
                  <KeyRound className="w-4 h-4 text-[#64748b] absolute left-3.5 top-3" />
                </div>
              </div>

              {/* Correo Operador / Analista */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-[#cbd5e1] tracking-wide">
                  Correo del Analista u Operador de Riesgo
                </label>
                <div className="relative">
                  <input
                    type="email"
                    required
                    value={operatorEmail}
                    onChange={e => setOperatorEmail(e.target.value)}
                    placeholder="analista@banco.com.ar"
                    className="w-full px-3.5 py-2.5 pl-10 bg-[#060c17] border border-[#1e365b] rounded-lg text-xs text-white placeholder-[#475569] focus:outline-none focus:border-[#3b82f6] transition-all font-mono"
                  />
                  <Mail className="w-4 h-4 text-[#64748b] absolute left-3.5 top-3" />
                </div>
              </div>

              {/* Rol Operativo */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-[#cbd5e1] tracking-wide">
                  Nivel de Autorización Operativa
                </label>
                <div className="relative">
                  <select
                    value={operatorRole}
                    onChange={e => setOperatorRole(e.target.value as UserRole)}
                    className="w-full px-3.5 py-2.5 pl-10 bg-[#060c17] border border-[#1e365b] rounded-lg text-xs text-white focus:outline-none focus:border-[#3b82f6] transition-all cursor-pointer font-medium"
                  >
                    <option value="ANALYST_L1" className="bg-[#0c1628]">Analista Nivel 1 (Consultas ZK)</option>
                    <option value="ANALYST_L2" className="bg-[#0c1628]">Analista Senior Nivel 2 (Reportes + Consultas)</option>
                    <option value="FRAUD_LEAD" className="bg-[#0c1628]">Líder de Fraude / Head of Risk</option>
                    <option value="AUDITOR" className="bg-[#0c1628]">Auditor de Cumplimiento (Solo Lectura)</option>
                  </select>
                  <Briefcase className="w-4 h-4 text-[#64748b] absolute left-3.5 top-3 pointer-events-none" />
                </div>
              </div>

              {/* Botón de Ingreso */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-2.5 px-4 rounded-lg bg-[#1d4ed8] hover:bg-[#2563eb] active:translate-y-[0.5px] text-white font-semibold text-xs shadow-[0_0_20px_rgba(29,78,216,0.3)] hover:shadow-[0_0_25px_rgba(37,99,235,0.4)] transition-all flex items-center justify-center gap-2 border border-[#3b82f6]/50 disabled:opacity-60"
                >
                  {isLoading ? (
                    <span className="animate-pulse">Validando credenciales B2B...</span>
                  ) : (
                    <>
                      <span>Ingresar al Workspace de la Entidad</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>
              </div>

              {/* Certificación BCRA */}
              <div className="pt-3 border-t border-[#17253d] flex items-center justify-between text-[11px] text-[#64748b]">
                <span className="flex items-center gap-1.5">
                  <Lock className="w-3 h-3 text-[#34d399]" />
                  Aislamiento RLS Dual
                </span>
                <span className="text-[#94a3b8]">BCRA Com. A7370</span>
              </div>
            </form>
          </div>

          {/* Footer Informativo */}
          <div className="mt-6 px-4 text-center">
            <p className="text-[11px] text-[#64748b] leading-relaxed">
              ¿Tu entidad no está dada de alta en el Consorcio?{' '}
              <span className="text-[#60a5fa] font-medium">
                Solicitar adhesión a la Autoridad de Gobernanza
              </span>
            </p>
          </div>
        </div>
      </main>

      {/* ── Footer ── */}
      <footer className="border-t border-[#17253d] bg-[#0c1628] px-6 py-4 text-center text-xs text-[#64748b]">
        <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-2">
          <span>© 2026 Red Federal Interbancaria de Prevención de Fraude</span>
          <div className="flex items-center gap-4 text-[11px]">
            <span>Arquitectura Anti-Fraude v2.4</span>
            <span>•</span>
            <span>Memoria Cloud Supabase</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
