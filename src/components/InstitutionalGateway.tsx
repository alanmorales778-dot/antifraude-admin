'use client';

import React from 'react';
import {
  Shield,
  Building2,
  Lock,
  ArrowRight,
  Network,
  Activity,
  CheckCircle2,
  FileCheck2,
  KeyRound,
  ShieldCheck,
  Scale,
  Sparkles,
} from 'lucide-react';
import { useConsortiumStore } from '@/lib/store';
import ConsortiumLogo from '@/components/ConsortiumLogo';

interface InstitutionalGatewayProps {
  onSelectAdmin: () => void;
  onSelectPartner: () => void;
}

export default function InstitutionalGateway({
  onSelectAdmin,
  onSelectPartner,
}: InstitutionalGatewayProps) {
  const { fintechs, supabaseStatus } = useConsortiumStore();

  return (
    <div className="min-h-screen bg-[#070d18] text-[#f1f5f9] font-sans flex flex-col justify-between selection:bg-[#1d4ed8] selection:text-white">
      {/* ── Top Bar ── */}
      <header className="border-b border-[#17253d] bg-[#0c1628]/95 backdrop-blur-md px-6 py-4 sticky top-0 z-30 shadow-lg">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <ConsortiumLogo size="sm" showGlow={true} />
            <div>
              <span className="block text-xs font-bold tracking-wider text-white uppercase">
                Consorcio Federal de Prevención de Fraude
              </span>
              <span className="block text-[11px] text-[#60a5fa] font-mono">
                Red Interbancaria de Inteligencia de Amenazas ZK
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#062c1d] border border-[#0f5132] text-[#34d399] font-mono text-[11px]">
              <span className="w-2 h-2 rounded-full bg-[#10b981] animate-pulse" />
              Red Federal Operativa
            </span>
          </div>
        </div>
      </header>

      {/* ── Hero & Gateway Portals ── */}
      <main className="flex-1 max-w-6xl mx-auto w-full px-6 py-12 flex flex-col justify-center">
        {/* Intro con Logo Gigante y Brillante */}
        <div className="text-center max-w-3xl mx-auto space-y-6 mb-12 flex flex-col items-center">
          <ConsortiumLogo size="hero" showGlow={true} className="mb-2 hover:scale-105 transition-transform duration-300 drop-shadow-[0_0_40px_rgba(6,182,212,0.6)]" />

          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#13233e] border border-[#203c68] text-xs font-medium text-[#93c5fd] shadow-md">
            <ShieldCheck className="w-4 h-4 text-[#34d399]" />
            <span>Infraestructura de Inteligencia Colaborativa Criptográfica</span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight leading-tight">
            Resolviendo el dilema del prisionero en la prevención de fraude
          </h1>

          <p className="text-sm sm:text-base text-[#94a3b8] leading-relaxed max-w-2xl">
            Una plataforma que permite a bancos y fintechs compartir inteligencia de amenazas y cuentas mula en tiempo real con <strong className="text-cyan-300">criptografía Zero-Knowledge</strong>, sin revelar datos confidenciales de clientes.
          </p>
        </div>

        {/* Las 2 Puertas de Acceso Separadas */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto w-full">
          {/* PUERTA 1: Entidades Financieras */}
          <div className="bg-[#0c182c] border border-[#1b335a] hover:border-cyan-500/60 rounded-2xl p-8 shadow-[0_8px_32px_rgba(3,7,18,0.7)] transition-all flex flex-col justify-between group">
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-xl bg-cyan-950/60 border border-cyan-500/40 text-cyan-400 flex items-center justify-center">
                <Building2 className="w-6 h-6" />
              </div>

              <div>
                <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-cyan-400">
                  Portal de Participantes
                </span>
                <h2 className="text-xl font-bold text-white mt-1">
                  Acceso Bancos & Fintechs
                </h2>
                <p className="text-xs text-[#94a3b8] mt-2 leading-relaxed font-sans">
                  Espacio de trabajo para mesas de riesgo, analistas de fraude y cumplimiento. Consultas de identidad, reportes de incidentes y auditoría interna.
                </p>
              </div>

              <div className="space-y-2 pt-2 border-t border-[#162744] text-xs text-[#cbd5e1]">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Workspace de Riesgo Interno Aislado</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Consultas ZK Unitarias y Masivas (CSV)</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Alertas Tempranas de Cuentas Mula y Granjas</span>
                </div>
              </div>
            </div>

            <div className="pt-6 mt-6 border-t border-[#162744]">
              <button
                onClick={onSelectPartner}
                className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-500 hover:to-cyan-500 text-white text-xs font-bold shadow-lg shadow-cyan-950/50 transition-all flex items-center justify-center gap-2 group-hover:scale-[1.02]"
              >
                <span>Ingresar como Entidad Financiera</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>
              <p className="text-[10px] text-center text-[#64748b] mt-2">
                {fintechs.length > 0
                  ? `${fintechs.length} ${fintechs.length === 1 ? 'entidad activa conectada' : 'entidades activas conectadas'}`
                  : 'Plataforma lista para adherir primera entidad'}
              </p>
            </div>
          </div>

          {/* PUERTA 2: Gobernanza Central */}
          <div className="bg-[#0c182c] border border-[#1b335a] hover:border-blue-500/60 rounded-2xl p-8 shadow-[0_8px_32px_rgba(3,7,18,0.7)] transition-all flex flex-col justify-between group">
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-xl bg-blue-950/60 border border-blue-500/40 text-blue-400 flex items-center justify-center">
                <Scale className="w-6 h-6" />
              </div>

              <div>
                <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-blue-400">
                  SuperAdmin & Compliance
                </span>
                <h2 className="text-xl font-bold text-white mt-1">
                  Gobernanza & Auditoría
                </h2>
                <p className="text-xs text-[#94a3b8] mt-2 leading-relaxed font-sans">
                  Consola reservada para la administración del consorcio, calibración de pesos de confianza (Trust Weights), rotación de sales criptográficas y reportes normativos.
                </p>
              </div>

              <div className="space-y-2 pt-2 border-t border-[#162744] text-xs text-[#cbd5e1]">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-blue-400" />
                  <span>Alta y Suspensión de Entidades (Cuarentena)</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-blue-400" />
                  <span>Libro de Auditoría Inmutable (BCRA)</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-blue-400" />
                  <span>Validación FIPS 140-2 con Llave 2FA</span>
                </div>
              </div>
            </div>

            <div className="pt-6 mt-6 border-t border-[#162744]">
              <button
                onClick={onSelectAdmin}
                className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-blue-700 to-indigo-700 hover:from-blue-600 hover:to-indigo-600 text-white text-xs font-bold shadow-lg shadow-blue-950/50 transition-all flex items-center justify-center gap-2 group-hover:scale-[1.02]"
              >
                <span>Acceso Central de Gobernanza</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>
              <p className="text-[10px] text-center text-[#64748b] mt-2">
                Acceso restringido con credenciales de auditor
              </p>
            </div>
          </div>
        </div>

        {/* Pilares Institucionales */}
        <div className="mt-16 grid grid-cols-1 sm:grid-cols-3 gap-6 text-center max-w-4xl mx-auto">
          <div className="p-5 rounded-xl bg-[#0a1424]/80 border border-[#172b4d]">
            <Lock className="w-6 h-6 text-cyan-400 mx-auto mb-2" />
            <h3 className="text-xs font-bold text-white">Zero-Knowledge Real</h3>
            <p className="text-[11px] text-[#94a3b8] mt-1">
              Las identidades se evalúan mediante hashes ciegos. Ninguna entidad conoce los DNIs de otros bancos.
            </p>
          </div>

          <div className="p-5 rounded-xl bg-[#0a1424]/80 border border-[#172b4d]">
            <Network className="w-6 h-6 text-blue-400 mx-auto mb-2" />
            <h3 className="text-xs font-bold text-white">Aislamiento RLS Dual</h3>
            <p className="text-[11px] text-[#94a3b8] mt-1">
              Tus auditorías internas jamás se filtran a la red. Las alertas comunitarias se auditan por consenso.
            </p>
          </div>

          <div className="p-5 rounded-xl bg-[#0a1424]/80 border border-[#172b4d]">
            <Activity className="w-6 h-6 text-amber-400 mx-auto mb-2" />
            <h3 className="text-xs font-bold text-white">Respuesta Sub-12ms</h3>
            <p className="text-[11px] text-[#94a3b8] mt-1">
              Diseñado para integrarse en pasarelas de pago, transferencias y altas de cuenta en tiempo real.
            </p>
          </div>
        </div>
      </main>

      {/* ── Footer ── */}
      <footer className="border-t border-[#17253d] bg-[#09101d] px-6 py-4 text-center text-xs text-[#64748b]">
        <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-2">
          <span>© 2026 Red Federal Interbancaria de Prevención de Fraude</span>
          <div className="flex items-center gap-4 text-[11px]">
            <span>Arquitectura Anti-Fraude v2.4</span>
            <span>•</span>
            <span className="text-emerald-400">Memoria Cloud Supabase</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
