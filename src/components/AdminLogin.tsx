'use client';

import React, { useState, useEffect } from 'react';
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
  Smartphone,
  CheckCircle2,
  Copy,
  Check,
  RotateCcw,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';
import { useConsortiumStore } from '@/lib/store';
import { supabaseAuthResetPassword, supabaseAuthUpdatePassword } from '@/lib/supabaseClient';

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
  const { loginAdmin, complete2FAEnrollment, setCurrentRoute, appUsers } = useConsortiumStore();

  // Estados de vista: LOGIN | FORGOT_PASSWORD | RESET_PASSWORD | 2FA_ENROLL
  const [viewMode, setViewMode] = useState<'LOGIN' | 'FORGOT_PASSWORD' | 'RESET_PASSWORD' | '2FA_ENROLL'>('LOGIN');

  // Formulario Login
  const [email, setEmail] = useState('andresalaniz8@gmail.com');
  const [masterKey, setMasterKey] = useState('antf_master_superadmin_2026');
  const [totpCode, setTotpCode] = useState('852963');
  const [showKey, setShowKey] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Formulario 2FA Enroll
  const [enrollSecret, setEnrollSecret] = useState('JBSWY3DPEHPK3PXP');
  const [enrollCode, setEnrollCode] = useState('');
  const [copiedSecret, setCopiedSecret] = useState(false);

  // Formulario Recuperar Contraseña
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [isRecovering, setIsRecovering] = useState(false);

  // Formulario Restablecer Contraseña
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);

  // Detectar enlaces de restablecimiento de contraseña en la URL
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const hash = window.location.hash;
    if (params.get('mode') === 'reset' || hash.includes('type=recovery') || hash.includes('access_token')) {
      setViewMode('RESET_PASSWORD');
    }
  }, []);

  // Submit Login
  const handleSubmitLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await loginAdmin({ email, masterKey, totpCode });

      if (res.success) {
        if (onSuccess) onSuccess();
        else setCurrentRoute('admin-portal');
      } else if (res.requires2FAEnroll) {
        // Redirección obligatoria a pantalla de enrolamiento de 2FA
        setViewMode('2FA_ENROLL');
      } else {
        setErrorMsg(res.message);
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Error de autenticación');
    } finally {
      setIsLoading(false);
    }
  };

  // Submit Enrolamiento 2FA Inicial
  const handleCompleteEnrollment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!enrollCode || enrollCode.length < 6) {
      setErrorMsg('Por favor ingrese el código de 6 dígitos de Google Authenticator.');
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);

    const res = await complete2FAEnrollment(email, enrollCode);
    setIsLoading(false);

    if (res.success) {
      setSuccessMsg('2FA vinculado exitosamente. Ingresando al panel...');
      setTimeout(() => {
        if (onSuccess) onSuccess();
        else setCurrentRoute('admin-portal');
      }, 1000);
    } else {
      setErrorMsg(res.message);
    }
  };

  // Submit Recuperar Contraseña (resetPasswordForEmail)
  const handleSendRecoveryEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recoveryEmail.trim()) return;

    setIsRecovering(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    const res = await supabaseAuthResetPassword(recoveryEmail.trim());
    setIsRecovering(false);

    if (res.success) {
      setSuccessMsg(res.message);
    } else {
      setErrorMsg(res.message);
    }
  };

  // Submit Restablecer Contraseña (updatePassword)
  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      setErrorMsg('La contraseña debe tener al menos 6 caracteres.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMsg('Las contraseñas no coinciden.');
      return;
    }

    setIsUpdatingPassword(true);
    setErrorMsg(null);

    const res = await supabaseAuthUpdatePassword(newPassword);
    setIsUpdatingPassword(false);

    if (res.success) {
      setSuccessMsg(res.message);
      setTimeout(() => {
        setViewMode('LOGIN');
        setSuccessMsg('Contraseña actualizada. Inicie sesión con su nueva clave.');
      }, 2000);
    } else {
      setErrorMsg(res.message);
    }
  };

  const copyToClipboard = (text: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedSecret(true);
      setTimeout(() => setCopiedSecret(false), 3000);
    }
  };

  // QR Code URL para Google Authenticator
  const totpUri = `otpauth://totp/ConsorcioAntifraude:${encodeURIComponent(email)}?secret=${enrollSecret}&issuer=ConsorcioAntifraude`;
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(totpUri)}&bgcolor=0c1628&color=ffffff&margin=1`;

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
                onClick={onNavigatePartner}
                className="px-3.5 py-1.5 rounded-lg text-xs font-medium text-[#93c5fd] hover:text-white bg-[#0d182e] hover:bg-[#13233e] border border-[#1e365b] transition-all flex items-center gap-1.5"
              >
                <Building2 className="w-3.5 h-3.5" />
                <span>Portal Entidades</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* ── Main Container ── */}
      <main className="max-w-md mx-auto w-full px-6 py-12 flex-1 flex flex-col justify-center">
        <div className="bg-[#0c1628] border border-[#1e365b] rounded-2xl p-8 shadow-2xl space-y-6">
          {/* Header del Formulario */}
          <div className="text-center space-y-2">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#1d4ed8] to-[#1e40af] text-white mx-auto flex items-center justify-center shadow-lg border border-blue-400/40">
              {viewMode === '2FA_ENROLL' ? (
                <Smartphone className="w-6 h-6 text-emerald-300" />
              ) : viewMode === 'FORGOT_PASSWORD' || viewMode === 'RESET_PASSWORD' ? (
                <KeyRound className="w-6 h-6 text-cyan-300" />
              ) : (
                <Lock className="w-6 h-6 text-white" />
              )}
            </div>

            <h1 className="text-lg font-bold text-white tracking-wide">
              {viewMode === '2FA_ENROLL'
                ? 'Enrolamiento Obligatorio 2FA'
                : viewMode === 'FORGOT_PASSWORD'
                ? 'Recuperar Contraseña'
                : viewMode === 'RESET_PASSWORD'
                ? 'Definir Nueva Contraseña'
                : 'Acceso de Gobernanza Central'}
            </h1>

            <p className="text-xs text-[#94a3b8]">
              {viewMode === '2FA_ENROLL'
                ? 'Vincule Google Authenticator escaneando el código QR para autorizar su acceso.'
                : viewMode === 'FORGOT_PASSWORD'
                ? 'Ingrese su correo registrado para recibir el enlace de restablecimiento seguro.'
                : viewMode === 'RESET_PASSWORD'
                ? 'Ingrese su nueva contraseña de acceso institucional.'
                : 'Acceso restringido exclusivamente a administradores autorizados.'}
            </p>
          </div>

          {/* Feedback de error o éxito */}
          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-rose-950/80 border border-rose-500/50 text-rose-200 text-xs flex items-start gap-2.5 animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div className="flex-1 leading-relaxed">{errorMsg}</div>
            </div>
          )}

          {successMsg && (
            <div className="p-3.5 rounded-xl bg-emerald-950/80 border border-emerald-500/50 text-emerald-200 text-xs flex items-start gap-2.5 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div className="flex-1 leading-relaxed">{successMsg}</div>
            </div>
          )}

          {/* ═════════════════════════════════════════════════════════ */}
          {/* ── MODO 1: LOGIN PRINCIPAL ───────────────────────────── */}
          {/* ═════════════════════════════════════════════════════════ */}
          {viewMode === 'LOGIN' && (
            <form onSubmit={handleSubmitLogin} className="space-y-4">
              {/* Selector Rápido de Correos Autorizados por defecto */}
              <div className="space-y-1">
                <label className="block text-[11px] font-semibold text-[#94a3b8] uppercase tracking-wider">
                  Seleccionar Administrador Autorizado
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setEmail('andresalaniz8@gmail.com')}
                    className={`p-2 rounded-lg text-left text-xs border transition ${
                      email === 'andresalaniz8@gmail.com'
                        ? 'bg-blue-950/70 border-blue-500 text-white font-semibold'
                        : 'bg-[#060c17] border-[#1e365b] text-[#94a3b8] hover:text-white'
                    }`}
                  >
                    <span className="block truncate">andresalaniz8@...</span>
                    <span className="text-[10px] text-blue-400 block">Admin</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setEmail('alan.morales778@gmail.com')}
                    className={`p-2 rounded-lg text-left text-xs border transition ${
                      email === 'alan.morales778@gmail.com'
                        ? 'bg-blue-950/70 border-blue-500 text-white font-semibold'
                        : 'bg-[#060c17] border-[#1e365b] text-[#94a3b8] hover:text-white'
                    }`}
                  >
                    <span className="block truncate">alan.morales778@...</span>
                    <span className="text-[10px] text-blue-400 block">Admin</span>
                  </button>
                </div>
              </div>

              {/* Email */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-[#cbd5e1] tracking-wide">
                  Correo Electrónico Oficial *
                </label>
                <div className="relative">
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="andresalaniz8@gmail.com"
                    className="w-full px-3.5 py-2.5 pl-10 bg-[#060c17] border border-[#1e365b] rounded-xl text-xs text-white placeholder-[#475569] focus:outline-none focus:border-[#3b82f6] font-mono"
                  />
                  <Mail className="w-4 h-4 text-[#64748b] absolute left-3.5 top-3" />
                </div>
              </div>

              {/* Contraseña / Master Key */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-semibold text-[#cbd5e1] tracking-wide">
                    Contraseña / Master Security Key *
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
                    className="w-full px-3.5 py-2.5 pl-10 bg-[#060c17] border border-[#1e365b] rounded-xl text-xs text-white placeholder-[#475569] focus:outline-none focus:border-[#3b82f6] font-mono"
                  />
                  <KeyRound className="w-4 h-4 text-[#64748b] absolute left-3.5 top-3" />
                </div>
                <div className="flex justify-end pt-0.5">
                  <button
                    type="button"
                    onClick={() => {
                      setRecoveryEmail(email);
                      setViewMode('FORGOT_PASSWORD');
                      setErrorMsg(null);
                      setSuccessMsg(null);
                    }}
                    className="text-[11px] text-[#60a5fa] hover:text-[#93c5fd] hover:underline"
                  >
                    ¿Olvidaste tu contraseña?
                  </button>
                </div>
              </div>

              {/* Código 2FA TOTP */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-semibold text-[#cbd5e1] tracking-wide">
                    Código TOTP / 2FA (6 dígitos)
                  </label>
                  <span className="text-[10px] text-[#34d399] font-mono bg-[#062c1d] px-2 py-0.5 rounded border border-[#0f5132]">
                    Google Authenticator
                  </span>
                </div>
                <div className="relative">
                  <input
                    type="text"
                    maxLength={6}
                    value={totpCode}
                    onChange={e => setTotpCode(e.target.value)}
                    placeholder="852963"
                    className="w-full px-3.5 py-2.5 pl-10 bg-[#060c17] border border-[#1e365b] rounded-xl text-xs text-white focus:outline-none focus:border-[#3b82f6] font-mono tracking-widest text-center font-bold"
                  />
                  <Fingerprint className="w-4 h-4 text-[#64748b] absolute left-3.5 top-3" />
                </div>
              </div>

              {/* Botón Ingresar */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-2.5 px-4 rounded-xl bg-[#1d4ed8] hover:bg-[#2563eb] active:translate-y-[0.5px] text-white font-semibold text-xs shadow-[0_0_20px_rgba(29,78,216,0.3)] hover:shadow-[0_0_25px_rgba(37,99,235,0.4)] transition-all flex items-center justify-center gap-2 border border-[#3b82f6]/50 disabled:opacity-60"
                >
                  {isLoading ? (
                    <span className="flex items-center gap-2">
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      Validando permisos Supabase...
                    </span>
                  ) : (
                    <>
                      <span>Ingresar a Gobernanza Central</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>
              </div>

              {/* Nota de restricción */}
              <div className="pt-3 border-t border-[#17253d] text-center text-[11px] text-[#64748b]">
                <span>Acceso auditado según estándar BCRA Comunicación A7370</span>
              </div>
            </form>
          )}

          {/* ═════════════════════════════════════════════════════════ */}
          {/* ── MODO 2: ENROLAMIENTO OBLIGATORIO DE 2FA (TOTP) ─────── */}
          {/* ═════════════════════════════════════════════════════════ */}
          {viewMode === '2FA_ENROLL' && (
            <div className="space-y-4">
              <div className="p-3.5 bg-blue-950/40 border border-blue-500/30 rounded-xl text-xs text-[#cbd5e1] space-y-1">
                <p className="font-semibold text-white flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  Vinculación Requerida para el Usuario
                </p>
                <p className="text-[#94a3b8] text-[11px]">
                  Abra Google Authenticator o Authy en su teléfono y escanee el código QR a continuación para completar la configuración de seguridad.
                </p>
              </div>

              {/* Código QR */}
              <div className="flex flex-col items-center justify-center p-4 bg-[#060c17] border border-[#1e365b] rounded-2xl">
                <img
                  src={qrCodeUrl}
                  alt="QR Google Authenticator"
                  className="w-44 h-44 rounded-xl border border-white/10 shadow-lg"
                />
                <span className="text-[10px] text-[#64748b] mt-2 font-mono">
                  Issuer: ConsorcioAntifraude ({email})
                </span>
              </div>

              {/* Clave Secreta Manual */}
              <div className="space-y-1">
                <label className="block text-[11px] text-[#94a3b8] font-medium">
                  ¿No puedes escanear? Clave secreta manual:
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={enrollSecret}
                    className="flex-1 px-3 py-1.5 bg-[#060c17] border border-[#1e365b] rounded-lg text-xs font-mono text-cyan-300 text-center"
                  />
                  <button
                    type="button"
                    onClick={() => copyToClipboard(enrollSecret)}
                    className="px-3 py-1.5 rounded-lg bg-[#13233e] hover:bg-[#1a3052] border border-[#203c68] text-xs font-semibold text-[#93c5fd] flex items-center gap-1"
                  >
                    {copiedSecret ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedSecret ? 'Copiado' : 'Copiar'}</span>
                  </button>
                </div>
              </div>

              {/* Formulario Confirmar Código */}
              <form onSubmit={handleCompleteEnrollment} className="space-y-3 pt-2">
                <div>
                  <label className="block text-xs font-semibold text-white mb-1">
                    Código de 6 dígitos generado por la App:
                  </label>
                  <input
                    type="text"
                    maxLength={6}
                    required
                    value={enrollCode}
                    onChange={e => setEnrollCode(e.target.value)}
                    placeholder="123456"
                    className="w-full px-3.5 py-2.5 bg-[#060c17] border border-[#1e365b] rounded-xl text-sm text-white focus:outline-none focus:border-[#3b82f6] font-mono tracking-widest text-center font-bold"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setViewMode('LOGIN')}
                    className="flex-1 py-2 px-3 rounded-xl bg-[#13233e] text-[#94a3b8] text-xs font-medium hover:bg-[#1a3052] border border-[#203c68]"
                  >
                    Volver
                  </button>
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="flex-1 py-2 px-3 rounded-xl bg-[#1d4ed8] hover:bg-[#2563eb] text-white text-xs font-semibold shadow-sm border border-[#3b82f6]/50"
                  >
                    {isLoading ? 'Verificando...' : 'Completar y Entrar'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* ═════════════════════════════════════════════════════════ */}
          {/* ── MODO 3: OLVIDÉ MI CONTRASEÑA (RECOVERY EMAIL) ─────── */}
          {/* ═════════════════════════════════════════════════════════ */}
          {viewMode === 'FORGOT_PASSWORD' && (
            <form onSubmit={handleSendRecoveryEmail} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-[#cbd5e1]">
                  Correo Electrónico de la Cuenta *
                </label>
                <div className="relative">
                  <input
                    type="email"
                    required
                    value={recoveryEmail}
                    onChange={e => setRecoveryEmail(e.target.value)}
                    placeholder="andresalaniz8@gmail.com"
                    className="w-full px-3.5 py-2.5 pl-10 bg-[#060c17] border border-[#1e365b] rounded-xl text-xs text-white focus:outline-none focus:border-[#3b82f6] font-mono"
                  />
                  <Mail className="w-4 h-4 text-[#64748b] absolute left-3.5 top-3" />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setViewMode('LOGIN')}
                  className="flex-1 py-2.5 px-3 rounded-xl bg-[#13233e] text-[#94a3b8] text-xs font-medium hover:bg-[#1a3052] border border-[#203c68]"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isRecovering}
                  className="flex-1 py-2.5 px-3 rounded-xl bg-[#1d4ed8] hover:bg-[#2563eb] text-white text-xs font-semibold shadow-sm border border-[#3b82f6]/50 flex items-center justify-center gap-1.5"
                >
                  {isRecovering && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>Enviar Correo</span>
                </button>
              </div>

              {/* Botón simulador para pruebas locales inmediatas */}
              <div className="pt-2 text-center">
                <button
                  type="button"
                  onClick={() => setViewMode('RESET_PASSWORD')}
                  className="text-[11px] text-[#64748b] hover:text-[#93c5fd] underline"
                >
                  ¿Ya tienes el enlace? Definir nueva contraseña aquí
                </button>
              </div>
            </form>
          )}

          {/* ═════════════════════════════════════════════════════════ */}
          {/* ── MODO 4: DEFINIR NUEVA CONTRASEÑA ───────────────────── */}
          {/* ═════════════════════════════════════════════════════════ */}
          {viewMode === 'RESET_PASSWORD' && (
            <form onSubmit={handleUpdatePassword} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-[#cbd5e1]">
                  Nueva Contraseña *
                </label>
                <div className="relative">
                  <input
                    type="password"
                    required
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    placeholder="Mínimo 6 caracteres"
                    className="w-full px-3.5 py-2.5 pl-10 bg-[#060c17] border border-[#1e365b] rounded-xl text-xs text-white focus:outline-none focus:border-[#3b82f6] font-mono"
                  />
                  <KeyRound className="w-4 h-4 text-[#64748b] absolute left-3.5 top-3" />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-[#cbd5e1]">
                  Confirmar Nueva Contraseña *
                </label>
                <div className="relative">
                  <input
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    placeholder="Repita la contraseña"
                    className="w-full px-3.5 py-2.5 pl-10 bg-[#060c17] border border-[#1e365b] rounded-xl text-xs text-white focus:outline-none focus:border-[#3b82f6] font-mono"
                  />
                  <Lock className="w-4 h-4 text-[#64748b] absolute left-3.5 top-3" />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setViewMode('LOGIN')}
                  className="flex-1 py-2.5 px-3 rounded-xl bg-[#13233e] text-[#94a3b8] text-xs font-medium hover:bg-[#1a3052] border border-[#203c68]"
                >
                  Volver al Login
                </button>
                <button
                  type="submit"
                  disabled={isUpdatingPassword}
                  className="flex-1 py-2.5 px-3 rounded-xl bg-[#1d4ed8] hover:bg-[#2563eb] text-white text-xs font-semibold shadow-sm border border-[#3b82f6]/50 flex items-center justify-center gap-1.5"
                >
                  {isUpdatingPassword && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>Guardar Contraseña</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </main>

      {/* ── Footer ── */}
      <footer className="border-t border-[#17253d] bg-[#0c1628] px-6 py-4 text-center text-xs text-[#64748b]">
        <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-2">
          <span>Consorcio Federal de Inteligencia Antifraude & Cooperación Interbancaria</span>
          <span className="font-mono text-[11px] text-[#60a5fa]">Supabase MFA · RFC 6238 TOTP</span>
        </div>
      </footer>
    </div>
  );
}
