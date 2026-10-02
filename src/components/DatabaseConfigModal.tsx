'use client';

import React, { useState } from 'react';
import {
  Database,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Copy,
  Check,
  ExternalLink,
  Shield,
  Zap,
  Server,
  X,
  AlertTriangle,
  Lock,
} from 'lucide-react';
import { useConsortiumStore } from '@/lib/store';
import { getSupabaseConfig } from '@/lib/supabaseClient';

interface DatabaseConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function DatabaseConfigModal({ isOpen, onClose }: DatabaseConfigModalProps) {
  const {
    supabaseStatus,
    supabaseLatencyMs,
    supabaseError,
    configureSupabase,
    disconnectSupabase,
    syncWithSupabase,
  } = useConsortiumStore();

  const currentConfig = getSupabaseConfig();
  const [urlInput, setUrlInput] = useState(currentConfig.url);
  const [keyInput, setKeyInput] = useState(currentConfig.anonKey);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitFeedback, setSubmitFeedback] = useState<{ success: boolean; message: string } | null>(null);
  const [copiedSql, setCopiedSql] = useState(false);

  if (!isOpen) return null;

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!urlInput.trim() || !keyInput.trim()) {
      setSubmitFeedback({
        success: false,
        message: 'Por favor ingresa tanto la URL de Supabase como la Anon Key.',
      });
      return;
    }

    setIsSubmitting(true);
    setSubmitFeedback(null);
    try {
      const res = await configureSupabase(urlInput, keyInput);
      setSubmitFeedback(res);
    } catch (err: any) {
      setSubmitFeedback({
        success: false,
        message: err?.message || 'Error al conectar con Supabase',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopySqlPath = () => {
    navigator.clipboard.writeText('supabase_schema.sql');
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2000);
  };

  const isConnected = supabaseStatus === 'CONNECTED';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className="relative w-full max-w-2xl bg-[#080e1a] border border-cyan-500/20 rounded-2xl shadow-2xl shadow-cyan-950/50 overflow-hidden text-slate-100 animate-in fade-in zoom-in-95 duration-200">
        {/* Glow Header */}
        <div className="relative px-6 py-5 border-b border-white/[0.08] bg-gradient-to-r from-cyan-950/40 via-slate-900 to-indigo-950/40 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold tracking-wide text-white flex items-center gap-2">
                Memoria Cloud & Sincronización Interbancaria
                <span
                  className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full border ${
                    isConnected
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                      : supabaseStatus === 'SYNCING'
                      ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30'
                      : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                  }`}
                >
                  {isConnected
                    ? `🟢 Conectado (${supabaseLatencyMs || 0}ms)`
                    : supabaseStatus === 'SYNCING'
                    ? '🔄 Sincronizando...'
                    : '🟡 Memoria Local'}
                </span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Conexión segura con Supabase (PostgreSQL + RLS + Realtime)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
          {/* Card de Beneficios de Arquitectura */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="p-3.5 rounded-xl bg-slate-900/60 border border-white/[0.06] flex items-start gap-2.5">
              <Lock className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
              <div>
                <div className="text-xs font-semibold text-slate-200">Zero-Knowledge</div>
                <div className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">
                  Solo almacena hashes HMAC-SHA256 con salt. Jamás PII en texto plano.
                </div>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-900/60 border border-white/[0.06] flex items-start gap-2.5">
              <Shield className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
              <div>
                <div className="text-xs font-semibold text-slate-200">Aislamiento RLS</div>
                <div className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">
                  Row-Level Security separa datos del Consorcio de los del Workspace Interno.
                </div>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-900/60 border border-white/[0.06] flex items-start gap-2.5">
              <Zap className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <div className="text-xs font-semibold text-slate-200">Memoria Persistente</div>
                <div className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">
                  Tus fraudes y consultas no se pierden al cerrar el navegador o cambiar de equipo.
                </div>
              </div>
            </div>
          </div>

          {/* Feedback de Estado */}
          {submitFeedback && (
            <div
              className={`p-3.5 rounded-xl border flex items-center gap-3 text-xs ${
                submitFeedback.success
                  ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
                  : 'bg-rose-950/40 border-rose-500/40 text-rose-300'
              }`}
            >
              {submitFeedback.success ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : (
                <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
              )}
              <span>{submitFeedback.message}</span>
            </div>
          )}

          {supabaseError && !submitFeedback && (
            <div className="p-3.5 rounded-xl bg-amber-950/40 border border-amber-500/40 text-amber-300 flex items-center gap-3 text-xs">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
              <span>{supabaseError}</span>
            </div>
          )}

          {/* Formulario de Conexión */}
          <form onSubmit={handleConnect} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5 flex items-center justify-between">
                <span>Supabase Project URL</span>
                <span className="text-[10px] text-slate-500 font-mono">https://xxxxxxxx.supabase.co</span>
              </label>
              <input
                type="url"
                value={urlInput}
                onChange={e => setUrlInput(e.target.value)}
                placeholder="https://xyzcompany.supabase.co"
                className="w-full px-3.5 py-2.5 bg-slate-950/80 border border-white/[0.1] rounded-xl text-xs text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500 transition-colors font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5 flex items-center justify-between">
                <span>Supabase Anon Public Key</span>
                <span className="text-[10px] text-slate-500 font-mono">eyJhbGciOi...</span>
              </label>
              <input
                type="password"
                value={keyInput}
                onChange={e => setKeyInput(e.target.value)}
                placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                className="w-full px-3.5 py-2.5 bg-slate-950/80 border border-white/[0.1] rounded-xl text-xs text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500 transition-colors font-mono"
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <div className="flex items-center gap-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white font-medium text-xs rounded-xl shadow-lg shadow-cyan-500/20 transition-all flex items-center gap-2 disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      Conectando...
                    </>
                  ) : (
                    <>
                      <Server className="w-3.5 h-3.5" />
                      {isConnected ? 'Actualizar Conexión' : 'Probar & Conectar Supabase'}
                    </>
                  )}
                </button>

                {isConnected && (
                  <button
                    type="button"
                    onClick={() => syncWithSupabase()}
                    className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs rounded-xl border border-white/[0.08] transition-colors flex items-center gap-1.5"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Sincronizar Datos
                  </button>
                )}
              </div>

              {isConnected && (
                <button
                  type="button"
                  onClick={disconnectSupabase}
                  className="text-xs text-rose-400 hover:text-rose-300 transition-colors px-2 py-1"
                >
                  Desconectar
                </button>
              )}
            </div>
          </form>

          {/* Guía Rápida de 3 Pasos */}
          <div className="pt-4 border-t border-white/[0.08] space-y-3">
            <h3 className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <span>¿Cómo crear la base de datos en 3 minutos?</span>
              <a
                href="https://supabase.com"
                target="_blank"
                rel="noreferrer"
                className="text-[11px] text-cyan-400 hover:underline flex items-center gap-1"
              >
                supabase.com <ExternalLink className="w-3 h-3" />
              </a>
            </h3>

            <div className="space-y-2 text-xs text-slate-400">
              <div className="flex items-start gap-2.5">
                <span className="w-4 h-4 rounded-full bg-cyan-500/20 text-cyan-300 text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                  1
                </span>
                <span>
                  Crea un proyecto gratuito en Supabase y ve a{' '}
                  <strong className="text-slate-200">Project Settings → API</strong> para copiar la URL y el{' '}
                  <strong className="text-slate-200">anon public key</strong>.
                </span>
              </div>

              <div className="flex items-start gap-2.5">
                <span className="w-4 h-4 rounded-full bg-cyan-500/20 text-cyan-300 text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                  2
                </span>
                <span className="flex-1">
                  Abre el <strong className="text-slate-200">SQL Editor</strong> en Supabase y ejecuta el script{' '}
                  <code className="px-1.5 py-0.5 bg-black/40 rounded border border-white/[0.08] text-cyan-300 font-mono text-[11px]">
                    supabase_schema.sql
                  </code>{' '}
                  incluido en el repositorio.
                </span>
                <button
                  type="button"
                  onClick={handleCopySqlPath}
                  className="p-1 rounded bg-white/5 hover:bg-white/10 text-slate-300 transition-colors shrink-0"
                  title="Copiar nombre del archivo"
                >
                  {copiedSql ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>

              <div className="flex items-start gap-2.5">
                <span className="w-4 h-4 rounded-full bg-cyan-500/20 text-cyan-300 text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                  3
                </span>
                <span>
                  Pega las credenciales arriba o en tu archivo{' '}
                  <code className="px-1.5 py-0.5 bg-black/40 rounded border border-white/[0.08] text-cyan-300 font-mono text-[11px]">
                    .env.local
                  </code>
                  . ¡La plataforma recordará todos los fraudes de manera permanente y compartida!
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
