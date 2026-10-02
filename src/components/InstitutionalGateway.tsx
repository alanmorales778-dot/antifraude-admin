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
    <div className="min-h-screen bg-[#f7f6f2] text-[#1a202c] font-sans flex flex-col justify-between selection:bg-[#152a38] selection:text-white">
      {/* ── Top Bar ── */}
      <header className="border-b border-[#e2dfd5] bg-[#faf9f5]/90 backdrop-blur-sm px-6 py-4 sticky top-0 z-20">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-[#0f2132] text-[#f7f6f2] flex items-center justify-center font-serif font-bold text-base shadow-sm border border-[#233547]">
              C
            </div>
            <div>
              <span className="block text-xs font-semibold tracking-wider text-[#1e2e3e] uppercase">
                Consorcio Federal de Prevención de Fraude
              </span>
              <span className="block text-[11px] text-[#717d8a] font-mono">
                Red Interbancaria de Amenazas ZK
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#edf7ed] text-[#2e7d32] border border-[#c8e6c9] font-mono text-[11px]">
              <span className="w-2 h-2 rounded-full bg-[#4caf50] animate-pulse" />
              Red Federal Operativa
            </span>
          </div>
        </div>
      </header>

      {/* ── Hero & Gateway Portals ── */}
      <main className="flex-1 max-w-6xl mx-auto w-full px-6 py-12 flex flex-col justify-center">
        {/* Intro */}
        <div className="text-center max-w-2xl mx-auto space-y-4 mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white border border-[#dedad0] text-xs font-medium text-[#4a5568] shadow-2xs">
            <ShieldCheck className="w-3.5 h-3.5 text-[#1b3b36]" />
            <span>Infraestructura de Inteligencia Colaborativa</span>
          </div>

          <h1 className="text-3xl sm:text-4xl font-serif font-normal text-[#0f2132] tracking-tight leading-tight">
            Resolviendo el dilema del prisionero en la prevención de fraude
          </h1>

          <p className="text-sm text-[#5a6878] leading-relaxed font-sans">
            Una plataforma que permite a bancos y fintechs compartir inteligencia de amenazas y cuentas mula en tiempo real con <strong>criptografía Zero-Knowledge</strong>, sin revelar datos confidenciales de clientes.
          </p>
        </div>

        {/* Las 2 Puertas de Acceso Separadas */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto w-full">
          {/* PUERTA 1: Entidades Financieras */}
          <div className="bg-white border border-[#dedad0] rounded-2xl p-8 shadow-[0_4px_24px_rgba(20,28,38,0.05)] hover:border-[#1b3b36] transition-all flex flex-col justify-between group">
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-xl bg-[#eef5f3] border border-[#cfe2dd] text-[#1b3b36] flex items-center justify-center">
                <Building2 className="w-6 h-6" />
              </div>

              <div>
                <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-[#1b3b36]">
                  Portal de Participantes
                </span>
                <h2 className="text-xl font-serif font-medium text-[#0f2132] mt-1">
                  Acceso Bancos & Fintechs
                </h2>
                <p className="text-xs text-[#637282] mt-2 leading-relaxed font-sans">
                  Espacio de trabajo para mesas de riesgo, analistas de fraude y cumplimiento. Consultas de identidad, reportes de incidentes y auditoría interna.
                </p>
              </div>

              <div className="space-y-2 pt-2 border-t border-[#f0ede4] text-xs text-[#4a5568]">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#1b3b36]" />
                  <span>Workspace de Riesgo Interno Aislado</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#1b3b36]" />
                  <span>Consultas ZK Unitarias y Masivas (CSV)</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#1b3b36]" />
                  <span>Alertas Tempranas de Cuentas Mula y Granjas</span>
                </div>
              </div>
            </div>

            <div className="pt-6 mt-6 border-t border-[#f0ede4]">
              <button
                onClick={onSelectPartner}
                className="w-full py-3 px-4 rounded-xl bg-[#1b3b36] hover:bg-[#254d46] text-[#f7f6f1] text-xs font-semibold shadow-sm transition-all flex items-center justify-center gap-2 group-hover:shadow"
              >
                <span>Ingresar como Entidad Financiera</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
              </button>
              <p className="text-[10px] text-center text-[#8a98a8] mt-2">
                {fintechs.length} entidades activas conectadas
              </p>
            </div>
          </div>

          {/* PUERTA 2: Gobernanza Central */}
          <div className="bg-white border border-[#dedad0] rounded-2xl p-8 shadow-[0_4px_24px_rgba(20,28,38,0.05)] hover:border-[#0f2132] transition-all flex flex-col justify-between group">
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-xl bg-[#eaf0f6] border border-[#c9d9e8] text-[#0f2132] flex items-center justify-center">
                <Scale className="w-6 h-6" />
              </div>

              <div>
                <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-[#0f2132]">
                  SuperAdmin & Compliance
                </span>
                <h2 className="text-xl font-serif font-medium text-[#0f2132] mt-1">
                  Gobernanza & Auditoría
                </h2>
                <p className="text-xs text-[#637282] mt-2 leading-relaxed font-sans">
                  Consola reservada para la administración del consorcio, calibración de pesos de confianza (Trust Weights), rotación de sales criptográficas y reportes normativos.
                </p>
              </div>

              <div className="space-y-2 pt-2 border-t border-[#f0ede4] text-xs text-[#4a5568]">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#0f2132]" />
                  <span>Alta y Suspensión de Entidades (Cuarentena)</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#0f2132]" />
                  <span>Libro de Auditoría Inmutable (BCRA)</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#0f2132]" />
                  <span>Validación FIPS 140-2 con Llave 2FA</span>
                </div>
              </div>
            </div>

            <div className="pt-6 mt-6 border-t border-[#f0ede4]">
              <button
                onClick={onSelectAdmin}
                className="w-full py-3 px-4 rounded-xl bg-[#0f2132] hover:bg-[#1a334d] text-[#f7f6f2] text-xs font-semibold shadow-sm transition-all flex items-center justify-center gap-2 group-hover:shadow"
              >
                <span>Acceso Central de Gobernanza</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
              </button>
              <p className="text-[10px] text-center text-[#8a98a8] mt-2">
                Acceso restringido con credenciales de auditor
              </p>
            </div>
          </div>
        </div>

        {/* Pilares Institucionales */}
        <div className="mt-16 grid grid-cols-1 sm:grid-cols-3 gap-6 text-center max-w-4xl mx-auto">
          <div className="p-4 rounded-xl bg-[#ffffff]/60 border border-[#e5e1d7]">
            <Lock className="w-5 h-5 text-[#1b3b36] mx-auto mb-2" />
            <h3 className="text-xs font-bold text-[#0f2132]">Zero-Knowledge Real</h3>
            <p className="text-[11px] text-[#637282] mt-1">
              Las identidades se evalúan mediante hashes ciegos. Ninguna entidad conoce los DNIs de otros bancos.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-[#ffffff]/60 border border-[#e5e1d7]">
            <Network className="w-5 h-5 text-[#0f2132] mx-auto mb-2" />
            <h3 className="text-xs font-bold text-[#0f2132]">Aislamiento RLS Dual</h3>
            <p className="text-[11px] text-[#637282] mt-1">
              Tus auditorías internas jamás se filtran a la red. Las alertas comunitarias se auditan por consenso.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-[#ffffff]/60 border border-[#e5e1d7]">
            <Activity className="w-5 h-5 text-[#b45309] mx-auto mb-2" />
            <h3 className="text-xs font-bold text-[#0f2132]">Respuesta Sub-12ms</h3>
            <p className="text-[11px] text-[#637282] mt-1">
              Diseñado para integrarse en pasarelas de pago, transferencias y altas de cuenta en tiempo real.
            </p>
          </div>
        </div>
      </main>

      {/* ── Footer ── */}
      <footer className="border-t border-[#e2dfd5] bg-[#faf9f5] px-6 py-4 text-center text-xs text-[#7d8b9b]">
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
