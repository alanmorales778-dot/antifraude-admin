'use client';

import React, { useState, useEffect } from 'react';
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
  Fingerprint,
  RefreshCw,
  Copy,
  Check,
  QrCode,
  ShieldAlert,
} from 'lucide-react';
import { useConsortiumStore } from '@/lib/store';
import { UserRole } from '@/lib/types';
import { getSupabaseBrowserClient } from '@/lib/supabaseClient';
import { generateTOTPSecret, generateTOTPUri, generateQRCodeSvg } from '@/lib/totp';

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
  const { fintechs, loginPartner, complete2FAEnrollment, setCurrentRoute, appUsers } = useConsortiumStore();

  const [viewMode, setViewMode] = useState<'LOGIN' | '2FA_ENROLL'>('LOGIN');
  const [selectedEntityId, setSelectedEntityId] = useState(fintechs[0]?.id || '');
  const [apiKey, setApiKey] = useState(fintechs[0]?.apiKey || '');
  const [operatorEmail, setOperatorEmail] = useState('');
  const [operatorRole, setOperatorRole] = useState<UserRole>('ANALYST_L2');
  const [totpCode, setTotpCode] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Sincronizar automáticamente cuando se cargan o crean entidades
  useEffect(() => {
    if (fintechs.length > 0) {
      if (!selectedEntityId || !fintechs.some(f => f.id === selectedEntityId)) {
        setSelectedEntityId(fintechs[0].id);
        setApiKey(fintechs[0].apiKey);
        const userInEntity = appUsers.find(u => u.entityId === fintechs[0].id);
        if (userInEntity) {
          setOperatorEmail(userInEntity.email);
        }
      }
    }
  }, [fintechs, appUsers, selectedEntityId]);

  // Formulario 2FA Enroll con código QR real y secreto Base32 dinámico
  const [factorId, setFactorId] = useState('');
  const [enrollSecret, setEnrollSecret] = useState('');
  const [enrollQrCode, setEnrollQrCode] = useState('');
  const [enrollCode, setEnrollCode] = useState('');
  const [copiedSecret, setCopiedSecret] = useState(false);
  const [isGeneratingQr, setIsGeneratingQr] = useState(false);

  // Cuando cambia la entidad seleccionada, actualizar la API key y el correo autorizado de ejemplo
  const handleEntityChange = (id: string) => {
    setSelectedEntityId(id);
    const entity = fintechs.find(f => f.id === id);
    if (entity) {
      setApiKey(entity.apiKey);
      // Buscar si hay un usuario precargado para esta entidad en appUsers
      const userInEntity = appUsers.find(u => u.entityId === id);
      if (userInEntity) {
        setOperatorEmail(userInEntity.email);
      } else {
        const slug = entity.name.toLowerCase().replace(/[^a-z0-9]/g, '');
        setOperatorEmail(`riesgo@${slug}.com.ar`);
      }
    }
  };

  // Función para inicializar secreto y QR de enrolamiento con Supabase Auth
  const init2FAEnrollment = async (userEmail: string) => {
    setIsGeneratingQr(true);
    try {
      const supabase = getSupabaseBrowserClient();
      const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp' });

      if (data && data.totp) {
        setFactorId(data.id);
        setEnrollQrCode(data.totp.qr_code);
        setEnrollSecret(data.totp.secret);
      } else {
        const secret = generateTOTPSecret(32);
        setEnrollSecret(secret);
        const uri = generateTOTPUri(userEmail || 'analista@consorcio.ar', secret, 'Consorcio Federal Antifraude');
        const qrSvg = await generateQRCodeSvg(uri);
        setEnrollQrCode(qrSvg);
      }
    } catch (err) {
      console.error('Error generando QR de 2FA:', err);
      const secret = generateTOTPSecret(32);
      setEnrollSecret(secret);
      const uri = generateTOTPUri(userEmail || 'analista@consorcio.ar', secret, 'Consorcio Federal Antifraude');
      const qrSvg = await generateQRCodeSvg(uri);
      setEnrollQrCode(qrSvg);
    } finally {
      setIsGeneratingQr(false);
    }
  };

  const copyToClipboard = (text: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedSecret(true);
      setTimeout(() => setCopiedSecret(false), 2500);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await loginPartner({
        entityId: selectedEntityId,
        apiKey,
        operatorEmail,
        operatorRole,
        totpCode,
      });

      if (res.success) {
        if (onSuccess) onSuccess();
        else setCurrentRoute('partner-portal');
      } else if (res.requires2FAEnroll) {
        // Redirección obligatoria a pantalla de enrolamiento de 2FA con código QR real
        await init2FAEnrollment(operatorEmail.trim());
        setViewMode('2FA_ENROLL');
      } else {
        setErrorMsg(res.message);
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Error durante la autenticación de la entidad');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCompleteEnrollment = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = enrollCode.trim().replace(/\D/g, '');
    if (!cleanCode || cleanCode.length !== 6) {
      setErrorMsg('Por favor ingrese el código dinámico de 6 dígitos visible en Google Authenticator.');
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);

    try {
      if (factorId) {
        try {
          const supabase = getSupabaseBrowserClient();
          await supabase.auth.mfa.challengeAndVerify({
            factorId,
            code: cleanCode,
          });
        } catch (mfaErr) {
          console.warn('MFA challenge warning:', mfaErr);
        }
      }

      const res = await complete2FAEnrollment(operatorEmail.trim(), enrollSecret, cleanCode);
      setIsLoading(false);

      if (res.success) {
        setSuccessMsg('¡Google Authenticator vinculado y verificado! Redirigiendo a tu espacio de riesgo...');
        setTimeout(() => {
          if (onSuccess) onSuccess();
          else setCurrentRoute('partner-portal');
        }, 1000);
      } else {
        setErrorMsg(res.message);
      }
    } catch (err: any) {
      setIsLoading(false);
      setErrorMsg(err?.message || 'Error validando código 2FA.');
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
                {viewMode === 'LOGIN' ? 'Ingreso de Entidades Participantes' : 'Enrolamiento Obligatorio 2FA'}
              </h1>
              <p className="text-xs text-[#94a3b8] mt-2 leading-relaxed">
                {viewMode === 'LOGIN'
                  ? 'Accedé a tu Internal Risk Workspace y consultá correlaciones de amenazas en la red interbancaria Zero-Knowledge.'
                  : 'Para cumplir con la normativa BCRA Com. A7370, vinculá Google Authenticator antes de ingresar al Workspace.'}
              </p>
            </div>

            {/* Mensajes de Estado */}
            {errorMsg && (
              <div className="m-6 mb-0 p-3.5 rounded-xl bg-[#2e0909] border border-[#661616] text-[#fca5a5] text-xs flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-[#ef4444]" />
                <span className="leading-snug">{errorMsg}</span>
              </div>
            )}
            {successMsg && (
              <div className="m-6 mb-0 p-3.5 rounded-xl bg-[#062c1d] border border-[#0f5132] text-[#86efac] text-xs flex items-start gap-2.5">
                <Check className="w-4 h-4 shrink-0 mt-0.5 text-[#22c55e]" />
                <span className="leading-snug">{successMsg}</span>
              </div>
            )}

            {/* MODO 1: LOGIN */}
            {viewMode === 'LOGIN' && (
              fintechs.length === 0 ? (
                <div className="p-8 space-y-5 bg-[#0d182e] text-center">
                  <div className="w-14 h-14 rounded-2xl bg-blue-500/10 border border-blue-500/30 text-blue-400 mx-auto flex items-center justify-center shadow-lg">
                    <Building2 className="w-7 h-7" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-sm font-bold text-white">Sin Entidades Financieras Registradas</h3>
                    <p className="text-xs text-[#94a3b8] leading-relaxed max-w-sm mx-auto">
                      La plataforma está inicializada desde cero para pruebas de preproducción. 
                      Para comenzar, acceda como <strong className="text-white">Administrador de Gobernanza</strong> y cree su primer banco o fintech participante.
                    </p>
                  </div>
                  {showAdminLink && onNavigateAdmin ? (
                    <button
                      type="button"
                      onClick={onNavigateAdmin}
                      className="w-full py-2.5 px-4 rounded-xl bg-[#1d4ed8] hover:bg-[#2563eb] text-white font-semibold text-xs shadow-md border border-[#3b82f6]/50 transition-all flex items-center justify-center gap-2"
                    >
                      <span>Ir al Panel de Gobernanza (Crear Banco)</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  ) : (
                    <a
                      href="/admin"
                      className="w-full py-2.5 px-4 rounded-xl bg-[#1d4ed8] hover:bg-[#2563eb] text-white font-semibold text-xs shadow-md border border-[#3b82f6]/50 transition-all flex items-center justify-center gap-2"
                    >
                      <span>Ir al Panel de Gobernanza (Crear Banco)</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </a>
                  )}
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="p-8 space-y-4 bg-[#0d182e]">
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
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-semibold text-[#cbd5e1] tracking-wide">
                      Correo del Analista u Operador Autorizado
                    </label>
                    <span className="text-[10px] text-amber-400 font-mono">
                      Pre-autorización requerida
                    </span>
                  </div>
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
                  <p className="text-[10px] text-[#64748b]">
                    Solo pueden ingresar correos dados de alta previamente desde el Panel de Gobernanza Central.
                  </p>
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

                {/* Código Dinámico 2FA TOTP */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-semibold text-[#cbd5e1] tracking-wide">
                      Código Dinámico TOTP / 2FA (6 dígitos)
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
                      onChange={e => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="000000"
                      className="w-full px-3.5 py-2.5 pl-10 bg-[#060c17] border border-[#1e365b] rounded-lg text-xs text-white focus:outline-none focus:border-[#3b82f6] font-mono tracking-widest text-center font-bold"
                    />
                    <Fingerprint className="w-4 h-4 text-[#64748b] absolute left-3.5 top-3" />
                  </div>
                  <p className="text-[10px] text-[#64748b]">
                    Si aún no vinculaste Google Authenticator, deja este campo vacío para iniciar el enrolamiento.
                  </p>
                </div>

                {/* Botón de Ingreso */}
                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full py-2.5 px-4 rounded-lg bg-[#1d4ed8] hover:bg-[#2563eb] active:translate-y-[0.5px] text-white font-semibold text-xs shadow-[0_0_20px_rgba(29,78,216,0.3)] hover:shadow-[0_0_25px_rgba(37,99,235,0.4)] transition-all flex items-center justify-center gap-2 border border-[#3b82f6]/50 disabled:opacity-60"
                  >
                    {isLoading ? (
                      <span className="flex items-center gap-2">
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        Validando credenciales B2B y 2FA...
                      </span>
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
            ))}

            {/* MODO 2: ENROLAMIENTO OBLIGATORIO 2FA */}
            {viewMode === '2FA_ENROLL' && (
              <div className="p-8 space-y-4 bg-[#0d182e]">
                <div className="p-3.5 bg-blue-950/40 border border-blue-500/30 rounded-xl text-xs text-[#cbd5e1] space-y-1">
                  <p className="font-semibold text-white flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    Vinculación Requerida de Google Authenticator
                  </p>
                  <p className="text-[#94a3b8] text-[11px]">
                    Abra <strong>Google Authenticator</strong> en su teléfono móvil y escanee el código QR a continuación para registrar la llave criptográfica RFC 6238 de su cuenta institucional.
                  </p>
                </div>

                {/* Código QR */}
                <div className="flex flex-col items-center justify-center p-4 bg-[#060c17] border border-[#1e365b] rounded-2xl">
                  {isGeneratingQr ? (
                    <div className="w-48 h-48 flex flex-col items-center justify-center text-xs text-slate-400 gap-2">
                      <RefreshCw className="w-6 h-6 animate-spin text-blue-400" />
                      <span>Generando QR seguro...</span>
                    </div>
                  ) : enrollQrCode ? (
                    enrollQrCode.startsWith('<svg') ? (
                      <div
                        className="w-48 h-48 rounded-xl border border-white/10 shadow-lg bg-white p-2 flex items-center justify-center [&>svg]:w-full [&>svg]:h-full"
                        dangerouslySetInnerHTML={{ __html: enrollQrCode }}
                      />
                    ) : (
                      <img
                        src={enrollQrCode}
                        alt="Código QR Google Authenticator"
                        className="w-48 h-48 rounded-xl border border-white/10 shadow-lg bg-white p-2"
                      />
                    )
                  ) : (
                    <button
                      type="button"
                      onClick={() => init2FAEnrollment(operatorEmail)}
                      className="w-44 h-44 flex flex-col items-center justify-center text-xs text-blue-400 gap-2 hover:bg-slate-900 rounded-xl transition"
                    >
                      <QrCode className="w-8 h-8" />
                      <span>Haga clic para generar QR</span>
                    </button>
                  )}
                  <span className="text-[10px] text-[#64748b] mt-2 font-mono">
                    Cuenta: {operatorEmail} · HMAC-SHA1 (30s)
                  </span>
                </div>

                {/* Clave Secreta Manual */}
                <div className="space-y-1">
                  <label className="block text-[11px] text-[#94a3b8] font-medium">
                    ¿No puedes escanear con la cámara? Clave secreta manual:
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={enrollSecret}
                      className="flex-1 px-3 py-1.5 bg-[#060c17] border border-[#1e365b] rounded-lg text-xs font-mono text-cyan-300 text-center tracking-wider select-all"
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
                      Ingrese el código de 6 dígitos que muestra Google Authenticator:
                    </label>
                    <input
                      type="text"
                      maxLength={6}
                      required
                      value={enrollCode}
                      onChange={e => setEnrollCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="000000"
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
                      {isLoading ? 'Validando token...' : 'Verificar y Activar 2FA'}
                    </button>
                  </div>
                </form>
              </div>
            )}
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
