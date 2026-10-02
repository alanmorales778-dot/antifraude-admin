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
}

export default function PartnerLogin({
  onSuccess,
  onNavigateAdmin,
  onNavigateHome,
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
    <div className="min-h-screen bg-[#f7f6f1] text-[#1c222b] font-sans flex flex-col justify-between selection:bg-[#1b3b36] selection:text-white">
      {/* ── Header Institucional B2B ── */}
      <header className="border-b border-[#e4e0d5] bg-[#fdfcf9]/90 backdrop-blur-sm px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <button
            onClick={onNavigateHome || (() => setCurrentRoute('landing'))}
            className="flex items-center gap-3 text-left group"
          >
            <div className="w-9 h-9 rounded-lg bg-[#1b3b36] text-[#f7f6f1] flex items-center justify-center font-serif font-bold text-base shadow-sm border border-[#2b544e]">
              F
            </div>
            <div>
              <span className="block text-xs font-semibold tracking-wider text-[#1b3b36] uppercase">
                Portal de Entidades Financieras
              </span>
              <span className="block text-[11px] text-[#697887] font-mono">
                Bancos · Billeteras Virtuales · Neobancos
              </span>
            </div>
          </button>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onNavigateAdmin || (() => setCurrentRoute('admin-login'))}
              className="text-xs font-medium text-[#4a5568] hover:text-[#0f2132] px-3.5 py-1.5 rounded-lg border border-[#d8d5cb] bg-white hover:bg-[#f0ede6] transition-all shadow-2xs"
            >
              Acceso Gobernanza (Admin) →
            </button>
          </div>
        </div>
      </header>

      {/* ── Cuerpo Principal ── */}
      <main className="flex-1 flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-[500px]">
          {/* Tarjeta de Autenticación */}
          <div className="bg-white border border-[#dedad0] rounded-2xl shadow-[0_4px_24px_rgba(20,28,38,0.06)] overflow-hidden">
            {/* Cabecera con Acento Verde Bosque / Institucional */}
            <div className="bg-[#1b3b36] text-[#f7f6f1] px-8 pt-8 pb-7 border-b border-[#294f49]">
              <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-[#254d46] border border-[#34665d] text-[11px] font-mono text-[#d1e7e3] uppercase tracking-wider mb-3">
                <Network className="w-3.5 h-3.5 text-[#63d471]" />
                Acceso B2B a Red Federal
              </div>
              <h1 className="text-xl font-serif font-medium tracking-tight text-white">
                Ingreso de Entidades Participantes
              </h1>
              <p className="text-xs text-[#a9c9c3] mt-1.5 leading-relaxed font-sans">
                Accedé a tu <strong>Internal Risk Workspace</strong> y consultá correlaciones de amenazas en la red interbancaria Zero-Knowledge.
              </p>
            </div>

            {/* Formulario */}
            <form onSubmit={handleSubmit} className="p-8 space-y-4 bg-[#ffffff]">
              {errorMsg && (
                <div className="p-3.5 rounded-xl bg-[#fff5f5] border border-[#fed7d7] text-[#c53030] text-xs flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-[#e53e3e]" />
                  <span className="leading-snug">{errorMsg}</span>
                </div>
              )}

              {/* Selector de Entidad */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-[#2d3748] tracking-wide">
                  Entidad Financiera Registrada
                </label>
                <div className="relative">
                  <select
                    value={selectedEntityId}
                    onChange={e => handleEntityChange(e.target.value)}
                    className="w-full px-3.5 py-2.5 pl-10 bg-[#faf9f6] border border-[#dcd7cb] rounded-lg text-xs text-[#1a202c] focus:outline-none focus:border-[#1b3b36] focus:bg-white transition-all shadow-2xs font-medium cursor-pointer"
                  >
                    {fintechs.map(f => (
                      <option key={f.id} value={f.id}>
                        {f.name} {f.status === 'SUSPENDED' ? '(Suspendida)' : `— Trust ${(f.trustWeight * 100).toFixed(0)}%`}
                      </option>
                    ))}
                  </select>
                  <Building2 className="w-4 h-4 text-[#758a99] absolute left-3.5 top-3 pointer-events-none" />
                </div>
              </div>

              {/* Clave API de Entidad */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-semibold text-[#2d3748] tracking-wide">
                    Clave API de Entidad (Partner API Key)
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowKey(!showKey)}
                    className="text-[11px] text-[#718096] hover:text-[#2d3748] transition flex items-center gap-1"
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
                    className="w-full px-3.5 py-2.5 pl-10 bg-[#faf9f6] border border-[#dcd7cb] rounded-lg text-xs text-[#1a202c] placeholder-[#a0aec0] focus:outline-none focus:border-[#1b3b36] focus:bg-white transition-all shadow-2xs font-mono"
                  />
                  <KeyRound className="w-4 h-4 text-[#758a99] absolute left-3.5 top-3" />
                </div>
              </div>

              {/* Correo del Analista / Operador */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-[#2d3748] tracking-wide">
                  Correo Institucional del Operador
                </label>
                <div className="relative">
                  <input
                    type="email"
                    required
                    value={operatorEmail}
                    onChange={e => setOperatorEmail(e.target.value)}
                    placeholder="analista@entidad.com"
                    className="w-full px-3.5 py-2.5 pl-10 bg-[#faf9f6] border border-[#dcd7cb] rounded-lg text-xs text-[#1a202c] placeholder-[#a0aec0] focus:outline-none focus:border-[#1b3b36] focus:bg-white transition-all shadow-2xs font-mono"
                  />
                  <Mail className="w-4 h-4 text-[#758a99] absolute left-3.5 top-3" />
                </div>
              </div>

              {/* Rol de Operación */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-[#2d3748] tracking-wide">
                  Nivel de Autorización en Mesa de Riesgo
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setOperatorRole('ANALYST_L2')}
                    className={`px-3 py-2 rounded-lg border text-left text-xs transition-all ${
                      operatorRole === 'ANALYST_L2'
                        ? 'border-[#1b3b36] bg-[#f0f6f4] text-[#1b3b36] font-semibold shadow-2xs'
                        : 'border-[#dcd7cb] bg-[#faf9f6] text-[#4a5568] hover:bg-[#f3f1ea]'
                    }`}
                  >
                    <span className="block font-semibold">Analista L2 (Senior)</span>
                    <span className="block text-[10px] text-[#718096] font-normal mt-0.5">
                      Consultas, reportes y Falsos Positivos
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setOperatorRole('ANALYST_L1')}
                    className={`px-3 py-2 rounded-lg border text-left text-xs transition-all ${
                      operatorRole === 'ANALYST_L1'
                        ? 'border-[#1b3b36] bg-[#f0f6f4] text-[#1b3b36] font-semibold shadow-2xs'
                        : 'border-[#dcd7cb] bg-[#faf9f6] text-[#4a5568] hover:bg-[#f3f1ea]'
                    }`}
                  >
                    <span className="block font-semibold">Analista L1 (Junior)</span>
                    <span className="block text-[10px] text-[#718096] font-normal mt-0.5">
                      Solo consultas individuales y batch
                    </span>
                  </button>
                </div>
              </div>

              {/* Botón de Ingreso */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-2.5 px-4 rounded-lg bg-[#1b3b36] hover:bg-[#254d46] active:translate-y-[0.5px] text-[#f7f6f1] font-medium text-xs shadow-sm hover:shadow transition-all flex items-center justify-center gap-2 border border-[#1b3b36] disabled:opacity-60"
                >
                  {isLoading ? (
                    <span className="animate-pulse">Validando entidad y operador...</span>
                  ) : (
                    <>
                      <span>Ingresar al Workspace de {selectedEntity?.name || 'la Entidad'}</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>
              </div>

              {/* Garantías B2B */}
              <div className="pt-3 border-t border-[#eeebe2] grid grid-cols-3 gap-2 text-center text-[10px] text-[#637282]">
                <div className="p-1.5 rounded bg-[#f7f6f2] border border-[#e8e4dc]">
                  <span className="block font-bold text-[#1b3b36]">Zero-Knowledge</span>
                  <span>Sin PII compartida</span>
                </div>
                <div className="p-1.5 rounded bg-[#f7f6f2] border border-[#e8e4dc]">
                  <span className="block font-bold text-[#1b3b36]">RLS Aislado</span>
                  <span>Espacio privado</span>
                </div>
                <div className="p-1.5 rounded bg-[#f7f6f2] border border-[#e8e4dc]">
                  <span className="block font-bold text-[#1b3b36]">SLA 99.99%</span>
                  <span>Sub-10ms lookup</span>
                </div>
              </div>
            </form>
          </div>

          {/* Banner de Soporte Corporativo */}
          <div className="mt-5 px-4 text-center">
            <p className="text-[11px] text-[#717d8a]">
              ¿Tu entidad no está dada de alta en el Consorcio?{' '}
              <button
                onClick={onNavigateAdmin || (() => setCurrentRoute('admin-login'))}
                className="text-[#1b3b36] font-semibold hover:underline"
              >
                Solicitar adhesión a la Autoridad de Gobernanza
              </button>
            </p>
          </div>
        </div>
      </main>

      {/* ── Footer ── */}
      <footer className="border-t border-[#e4e0d5] bg-[#fdfcf9] px-6 py-4 text-center text-xs text-[#7d8b9b]">
        <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-2">
          <span>© 2026 Red Federal Interbancaria de Prevención de Fraude</span>
          <div className="flex items-center gap-4 text-[11px]">
            <span>Entorno de Producción Seguro</span>
            <span>•</span>
            <span>Cifrado SHA-256 HMAC</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
