'use client';

import React, { useState } from 'react';
import {
  ShieldCheck,
  KeyRound,
  Lock,
  Mail,
  Fingerprint,
  ArrowRight,
  ShieldAlert,
  Building2,
  FileCheck2,
  AlertCircle,
  Eye,
  EyeOff,
  HelpCircle,
} from 'lucide-react';
import { useConsortiumStore } from '@/lib/store';

interface AdminLoginProps {
  onSuccess?: () => void;
  onNavigatePartner?: () => void;
  onNavigateHome?: () => void;
}

export default function AdminLogin({
  onSuccess,
  onNavigatePartner,
  onNavigateHome,
}: AdminLoginProps) {
  const { loginAdmin, setCurrentRoute } = useConsortiumStore();

  const [email, setEmail] = useState('gobernanza@consorcio-antifraude.org');
  const [masterKey, setMasterKey] = useState('antf_master_superadmin_2026');
  const [totpCode, setTotpCode] = useState('741982');
  const [showKey, setShowKey] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg(null);

    try {
      const res = await loginAdmin({ email, masterKey, totpCode });
      if (res.success) {
        if (onSuccess) onSuccess();
        else setCurrentRoute('admin-portal');
      } else {
        setErrorMsg(res.message);
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Error de autenticación');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFillDemo = () => {
    setEmail('gobernanza@consorcio-antifraude.org');
    setMasterKey('antf_master_superadmin_2026');
    setTotpCode('852963');
    setErrorMsg(null);
  };

  return (
    <div className="min-h-screen bg-[#f5f4ef] text-[#1a202c] font-sans flex flex-col justify-between selection:bg-[#1b3a4b] selection:text-white">
      {/* ── Top Institutional Bar ── */}
      <header className="border-b border-[#e2dfd5] bg-[#faf9f5]/90 backdrop-blur-sm px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={onNavigateHome || (() => setCurrentRoute('landing'))}
              className="flex items-center gap-3 text-left group"
            >
              <div className="w-9 h-9 rounded-lg bg-[#0f2132] text-[#f7f6f2] flex items-center justify-center font-serif font-bold text-base shadow-sm border border-[#233547]">
                C
              </div>
              <div>
                <span className="block text-xs font-semibold tracking-wider text-[#1e2e3e] uppercase">
                  Consorcio Federal Antifraude
                </span>
                <span className="block text-[11px] text-[#717d8a] font-mono">
                  Gobernanza & Auditoría Central
                </span>
              </div>
            </button>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onNavigatePartner || (() => setCurrentRoute('partner-login'))}
              className="text-xs font-medium text-[#4a5568] hover:text-[#0f2132] px-3.5 py-1.5 rounded-lg border border-[#d8d5cb] bg-white hover:bg-[#f0ede6] transition-all shadow-2xs"
            >
              Acceso Entidades / Bancos →
            </button>
          </div>
        </div>
      </header>

      {/* ── Main Authentication Box ── */}
      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-[460px]">
          {/* Card Frame */}
          <div className="bg-white border border-[#dedad0] rounded-2xl shadow-[0_4px_24px_rgba(20,28,38,0.06)] overflow-hidden">
            {/* Header Accent */}
            <div className="bg-[#0f2132] text-[#f5f4ef] px-8 pt-8 pb-7 border-b border-[#223547]">
              <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-[#1d354a] border border-[#2c4760] text-[11px] font-mono text-[#d6e2ed] uppercase tracking-wider mb-4">
                <ShieldCheck className="w-3.5 h-3.5 text-[#52b788]" />
                Acceso Reservado SuperAdmin
              </div>
              <h1 className="text-xl font-serif font-medium tracking-tight text-white">
                Autenticación de Gobernanza
              </h1>
              <p className="text-xs text-[#9fb3c8] mt-1.5 leading-relaxed font-sans">
                Consola para la gestión de entidades participantes, calibración de pesos de confianza y auditoría regulatoria.
              </p>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="p-8 space-y-5 bg-[#ffffff]">
              {errorMsg && (
                <div className="p-3.5 rounded-xl bg-[#fff5f5] border border-[#fed7d7] text-[#c53030] text-xs flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-[#e53e3e]" />
                  <span className="leading-snug">{errorMsg}</span>
                </div>
              )}

              {/* Email */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-[#2d3748] tracking-wide">
                  Correo Oficial de Gobernanza
                </label>
                <div className="relative">
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="gobernanza@consorcio-antifraude.org"
                    className="w-full px-3.5 py-2.5 pl-10 bg-[#faf9f6] border border-[#dcd7cb] rounded-lg text-xs text-[#1a202c] placeholder-[#a0aec0] focus:outline-none focus:border-[#0f2132] focus:bg-white transition-all shadow-2xs font-mono"
                  />
                  <Mail className="w-4 h-4 text-[#8a98a8] absolute left-3.5 top-3" />
                </div>
              </div>

              {/* Master Security Key */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-semibold text-[#2d3748] tracking-wide">
                    Master Security Key / Token Criptográfico
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
                    value={masterKey}
                    onChange={e => setMasterKey(e.target.value)}
                    placeholder="antf_master_..."
                    className="w-full px-3.5 py-2.5 pl-10 bg-[#faf9f6] border border-[#dcd7cb] rounded-lg text-xs text-[#1a202c] placeholder-[#a0aec0] focus:outline-none focus:border-[#0f2132] focus:bg-white transition-all shadow-2xs font-mono"
                  />
                  <KeyRound className="w-4 h-4 text-[#8a98a8] absolute left-3.5 top-3" />
                </div>
              </div>

              {/* Hardware / TOTP 2FA */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-semibold text-[#2d3748] tracking-wide">
                    Código TOTP / Llave 2FA (6 dígitos)
                  </label>
                  <span className="text-[10px] text-[#4a7c59] font-mono bg-[#edf7ed] px-1.5 py-0.5 rounded border border-[#c8e6c9]">
                    FIPS 140-2
                  </span>
                </div>
                <div className="relative">
                  <input
                    type="text"
                    maxLength={6}
                    value={totpCode}
                    onChange={e => setTotpCode(e.target.value)}
                    placeholder="000000"
                    className="w-full px-3.5 py-2.5 pl-10 bg-[#faf9f6] border border-[#dcd7cb] rounded-lg text-xs text-[#1a202c] placeholder-[#a0aec0] focus:outline-none focus:border-[#0f2132] focus:bg-white transition-all shadow-2xs font-mono tracking-widest text-center"
                  />
                  <Fingerprint className="w-4 h-4 text-[#8a98a8] absolute left-3.5 top-3" />
                </div>
              </div>

              {/* Submit Button */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-2.5 px-4 rounded-lg bg-[#0f2132] hover:bg-[#1a334d] active:translate-y-[0.5px] text-[#f5f4ef] font-medium text-xs shadow-sm hover:shadow transition-all flex items-center justify-center gap-2 border border-[#0f2132] disabled:opacity-60"
                >
                  {isLoading ? (
                    <span className="animate-pulse">Validando credenciales...</span>
                  ) : (
                    <>
                      <span>Ingresar a Gobernanza Central</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>
              </div>

              {/* Demo Helper */}
              <div className="pt-3 border-t border-[#eeebe2] flex items-center justify-between text-[11px] text-[#718096]">
                <span>Ambiente de Certificación v2.4</span>
                <button
                  type="button"
                  onClick={handleFillDemo}
                  className="text-[#2b6cb0] hover:text-[#1a4971] font-medium hover:underline"
                >
                  Autocompletar credenciales demo
                </button>
              </div>
            </form>
          </div>

          {/* Legal / Security Notice */}
          <div className="mt-6 px-4 text-center">
            <p className="text-[11px] text-[#717d8a] leading-relaxed">
              Trazabilidad criptográfica activa. Toda interacción queda registrada en libros de auditoría inmutables según normativa de ciberseguridad interbancaria.
            </p>
          </div>
        </div>
      </main>

      {/* ── Footer ── */}
      <footer className="border-t border-[#e2dfd5] bg-[#faf9f5] px-6 py-4 text-center text-xs text-[#8a95a5]">
        <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-2">
          <span>© 2026 Consorcio Federal de Prevención de Fraude</span>
          <div className="flex items-center gap-4 text-[11px]">
            <span>Protocolo Zero-Knowledge SHA-256</span>
            <span>•</span>
            <span>BCRA Comunicación A7370</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
