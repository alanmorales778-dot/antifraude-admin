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
  showPartnerLink?: boolean;
}

export default function AdminLogin({
  onSuccess,
  onNavigatePartner,
  onNavigateHome,
  showPartnerLink = false,
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
    <div className="min-h-screen bg-[#070d18] text-[#f1f5f9] font-sans flex flex-col justify-between selection:bg-[#1d4ed8] selection:text-white">
      {/* ── Top Executive Bar ── */}
      <header className="border-b border-[#17253d] bg-[#0c1628]/95 backdrop-blur-md px-6 py-4 sticky top-0 z-30">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={onNavigateHome || (() => setCurrentRoute('admin-portal'))}
              className="flex items-center gap-3 text-left group"
            >
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#1d4ed8] to-[#0f2756] text-white flex items-center justify-center font-serif font-bold text-base shadow-[0_0_15px_rgba(29,78,216,0.35)] border border-[#3b82f6]/40">
                G
              </div>
              <div>
                <span className="block text-xs font-bold tracking-wider text-white uppercase">
                  Consorcio Federal Antifraude
                </span>
                <span className="block text-[11px] text-[#60a5fa] font-mono font-medium">
                  Portal Central de Gobernanza y Auditoría
                </span>
              </div>
            </button>
          </div>

          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#062c1d] border border-[#0f5132] text-[#34d399] font-mono text-[11px]">
              <span className="w-2 h-2 rounded-full bg-[#10b981] animate-pulse" />
              Entorno Seguro FIPS 140-2
            </span>
            {showPartnerLink && onNavigatePartner && (
              <button
                type="button"
                onClick={onNavigatePartner}
                className="text-xs font-medium text-[#94a3b8] hover:text-white px-3.5 py-1.5 rounded-lg border border-[#1e365b] bg-[#0c172c] hover:bg-[#162746] transition-all"
              >
                Acceso Entidades / Bancos →
              </button>
            )}
          </div>
        </div>
      </header>

      {/* ── Main Authentication Box ── */}
      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-[480px]">
          {/* Card Frame */}
          <div className="bg-[#0d182e] border border-[#1e365b] rounded-2xl shadow-[0_8px_32px_rgba(3,7,18,0.6)] overflow-hidden">
            {/* Header Accent */}
            <div className="bg-gradient-to-b from-[#0f203c] to-[#0a1528] px-8 pt-8 pb-7 border-b border-[#1b3152]">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-[#13233e] border border-[#203c68] text-[11px] font-mono text-[#93c5fd] uppercase tracking-wider mb-4">
                <ShieldCheck className="w-3.5 h-3.5 text-[#34d399]" />
                Acceso Reservado SuperAdmin
              </div>
              <h1 className="text-xl font-bold tracking-tight text-white">
                Autenticación de Gobernanza
              </h1>
              <p className="text-xs text-[#94a3b8] mt-2 leading-relaxed">
                Consola reservada para la administración del consorcio, calibración de pesos de confianza de entidades y auditoría regulatoria BCRA.
              </p>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="p-8 space-y-5 bg-[#0d182e]">
              {errorMsg && (
                <div className="p-3.5 rounded-xl bg-[#2e0909] border border-[#661616] text-[#fca5a5] text-xs flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-[#ef4444]" />
                  <span className="leading-snug">{errorMsg}</span>
                </div>
              )}

              {/* Email */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-[#cbd5e1] tracking-wide">
                  Correo Oficial de Gobernanza
                </label>
                <div className="relative">
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="gobernanza@consorcio-antifraude.org"
                    className="w-full px-3.5 py-2.5 pl-10 bg-[#060c17] border border-[#1e365b] rounded-lg text-xs text-white placeholder-[#475569] focus:outline-none focus:border-[#3b82f6] focus:bg-[#081122] transition-all font-mono"
                  />
                  <Mail className="w-4 h-4 text-[#64748b] absolute left-3.5 top-3" />
                </div>
              </div>

              {/* Master Security Key */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-semibold text-[#cbd5e1] tracking-wide">
                    Master Security Key / Token Criptográfico
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
                    value={masterKey}
                    onChange={e => setMasterKey(e.target.value)}
                    placeholder="antf_master_..."
                    className="w-full px-3.5 py-2.5 pl-10 bg-[#060c17] border border-[#1e365b] rounded-lg text-xs text-white placeholder-[#475569] focus:outline-none focus:border-[#3b82f6] focus:bg-[#081122] transition-all font-mono"
                  />
                  <KeyRound className="w-4 h-4 text-[#64748b] absolute left-3.5 top-3" />
                </div>
              </div>

              {/* Hardware / TOTP 2FA */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-semibold text-[#cbd5e1] tracking-wide">
                    Código TOTP / Llave 2FA (6 dígitos)
                  </label>
                  <span className="text-[10px] text-[#34d399] font-mono bg-[#062c1d] px-2 py-0.5 rounded border border-[#0f5132]">
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
                    className="w-full px-3.5 py-2.5 pl-10 bg-[#060c17] border border-[#1e365b] rounded-lg text-xs text-white placeholder-[#475569] focus:outline-none focus:border-[#3b82f6] focus:bg-[#081122] transition-all font-mono tracking-widest text-center font-bold"
                  />
                  <Fingerprint className="w-4 h-4 text-[#64748b] absolute left-3.5 top-3" />
                </div>
              </div>

              {/* Submit Button */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-2.5 px-4 rounded-lg bg-[#1d4ed8] hover:bg-[#2563eb] active:translate-y-[0.5px] text-white font-semibold text-xs shadow-[0_0_20px_rgba(29,78,216,0.3)] hover:shadow-[0_0_25px_rgba(37,99,235,0.4)] transition-all flex items-center justify-center gap-2 border border-[#3b82f6]/50 disabled:opacity-60"
                >
                  {isLoading ? (
                    <span className="animate-pulse">Validando credenciales en HSM...</span>
                  ) : (
                    <>
                      <span>Ingresar a Gobernanza Central</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>
              </div>

              {/* Demo Helper */}
              <div className="pt-3 border-t border-[#17253d] flex items-center justify-between text-[11px] text-[#94a3b8]">
                <span>Ambiente de Certificación v2.4</span>
                <button
                  type="button"
                  onClick={handleFillDemo}
                  className="text-[#60a5fa] hover:text-[#93c5fd] font-medium hover:underline"
                >
                  Autocompletar credenciales demo
                </button>
              </div>
            </form>
          </div>

          {/* Legal / Security Notice */}
          <div className="mt-6 px-4 text-center">
            <p className="text-[11px] text-[#64748b] leading-relaxed">
              Trazabilidad criptográfica activa. Toda interacción queda registrada en libros de auditoría inmutables según normativa de ciberseguridad interbancaria.
            </p>
          </div>
        </div>
      </main>

      {/* ── Footer ── */}
      <footer className="border-t border-[#17253d] bg-[#0c1628] px-6 py-4 text-center text-xs text-[#64748b]">
        <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-2">
          <span>© 2026 Consorcio Federal de Prevención de Fraude · Consola de Gobernanza</span>
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
