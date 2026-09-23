'use client';

import React, { useState } from 'react';
import {
  Shield,
  Crown,
  Building2,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  Zap,
  Network,
} from 'lucide-react';
import { useConsortiumStore } from '@/lib/store';

type PortalChoice = 'admin' | 'entity';

interface Props {
  onEnterAdmin: () => void;
  onEnterEntity: (fintechId: string) => void;
}

export default function LoginScreen({ onEnterAdmin, onEnterEntity }: Props) {
  const { fintechs } = useConsortiumStore();
  const [choice, setChoice] = useState<PortalChoice | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [fintechId, setFintechId] = useState(fintechs[0]?.id || 'fintech-alpha');
  const [loading, setLoading] = useState(false);

  const handleSelect = (p: PortalChoice) => {
    setChoice(p);
    setEmail(p === 'admin' ? 'superadmin@consorcio.ar' : 'analista@banco.com');
    setPassword('');
    setShowPw(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    await new Promise(r => setTimeout(r, 700));
    setLoading(false);
    if (choice === 'admin') {
      onEnterAdmin();
    } else {
      onEnterEntity(fintechId);
    }
  };

  return (
    <div className="min-h-screen bg-[#060a12] flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Fondo sutil con gradiente radial */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 80% 50% at 50% -10%, rgba(6,182,212,0.07) 0%, transparent 60%), radial-gradient(ellipse 60% 40% at 80% 80%, rgba(99,102,241,0.05) 0%, transparent 60%)',
        }}
      />

      {/* Grid pattern sutil */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }}
      />

      <div className="relative z-10 w-full max-w-xl">
        {/* Logo */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center gap-3 mb-4">
            <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-indigo-600/20 border border-cyan-500/25 flex items-center justify-center shadow-lg shadow-cyan-900/20">
              <Shield className="h-6 w-6 text-cyan-400" />
            </div>
            <div className="text-left">
              <h1 className="text-lg font-bold text-white tracking-tight leading-tight">
                CONSORCIO ANTIFRAUDE
              </h1>
              <p className="text-[11px] text-slate-500 font-mono">
                Zero-Knowledge Threat Intelligence
              </p>
            </div>
          </div>

          <div className="flex items-center justify-center gap-4 text-[11px] text-slate-600 font-mono">
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Red Federal Activa
            </span>
            <span>·</span>
            <span className="flex items-center gap-1.5">
              <Zap className="h-3 w-3 text-slate-600" />
              P99 &lt; 50ms
            </span>
            <span>·</span>
            <span className="flex items-center gap-1.5">
              <Network className="h-3 w-3 text-slate-600" />
              SHA-256 ZK
            </span>
          </div>
        </div>

        {/* Selección de portal */}
        {!choice && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Card SuperAdmin */}
            <button
              onClick={() => handleSelect('admin')}
              className="group flex flex-col gap-5 rounded-2xl border border-amber-500/15 bg-amber-500/[0.04] hover:bg-amber-500/[0.08] hover:border-amber-500/30 p-6 text-left transition-all duration-200 active:scale-[0.98]"
            >
              <div className="h-10 w-10 rounded-xl bg-amber-500/12 border border-amber-500/20 flex items-center justify-center">
                <Crown className="h-5 w-5 text-amber-400" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold text-white">SuperAdmin</p>
                <p className="text-[11px] font-mono text-amber-500/50 mt-0.5">
                  admin.antifraude.com
                </p>
                <p className="text-xs text-slate-500 mt-2.5 leading-relaxed">
                  Gestión de entidades, trust weights, reglas e infraestructura del consorcio.
                </p>
              </div>
              <div className="flex items-center gap-1 text-xs text-amber-500/40 group-hover:text-amber-400 transition">
                Acceder <ArrowRight className="h-3.5 w-3.5" />
              </div>
            </button>

            {/* Card Entidades */}
            <button
              onClick={() => handleSelect('entity')}
              className="group flex flex-col gap-5 rounded-2xl border border-cyan-500/15 bg-cyan-500/[0.04] hover:bg-cyan-500/[0.08] hover:border-cyan-500/30 p-6 text-left transition-all duration-200 active:scale-[0.98]"
            >
              <div className="h-10 w-10 rounded-xl bg-cyan-500/12 border border-cyan-500/20 flex items-center justify-center">
                <Building2 className="h-5 w-5 text-cyan-400" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold text-white">Portal de Entidades</p>
                <p className="text-[11px] font-mono text-cyan-500/50 mt-0.5">
                  app.antifraude.com
                </p>
                <p className="text-xs text-slate-500 mt-2.5 leading-relaxed">
                  Consultas de riesgo, reportes de fraude, importación masiva y analytics.
                </p>
              </div>
              <div className="flex items-center gap-1 text-xs text-cyan-500/40 group-hover:text-cyan-400 transition">
                Acceder <ArrowRight className="h-3.5 w-3.5" />
              </div>
            </button>
          </div>
        )}

        {/* Formulario de login */}
        {choice && (
          <div
            className={`rounded-2xl border p-6 shadow-2xl ${
              choice === 'admin'
                ? 'border-amber-500/20 bg-amber-500/[0.04] shadow-amber-900/10'
                : 'border-cyan-500/20 bg-cyan-500/[0.04] shadow-cyan-900/10'
            }`}
          >
            {/* Header del form */}
            <div className="flex items-center gap-3 mb-6">
              <div
                className={`h-9 w-9 rounded-xl flex items-center justify-center border ${
                  choice === 'admin'
                    ? 'bg-amber-500/12 border-amber-500/20'
                    : 'bg-cyan-500/12 border-cyan-500/20'
                }`}
              >
                {choice === 'admin' ? (
                  <Crown className="h-4 w-4 text-amber-400" />
                ) : (
                  <Building2 className="h-4 w-4 text-cyan-400" />
                )}
              </div>
              <div>
                <p className="text-sm font-bold text-white">
                  {choice === 'admin' ? 'Portal SuperAdmin' : 'Portal de Entidades'}
                </p>
                <p
                  className={`text-[11px] font-mono ${
                    choice === 'admin' ? 'text-amber-500/50' : 'text-cyan-500/50'
                  }`}
                >
                  {choice === 'admin' ? 'admin.antifraude.com' : 'app.antifraude.com'}
                </p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3">
              {/* Selector de entidad (solo para entity portal) */}
              {choice === 'entity' && (
                <div>
                  <label className="block text-xs text-slate-400 mb-1.5">Entidad financiera</label>
                  <select
                    value={fintechId}
                    onChange={e => setFintechId(e.target.value)}
                    className="w-full rounded-xl border border-white/8 bg-slate-900/80 px-3 py-2.5 text-sm text-white focus:border-cyan-500/40 focus:outline-none transition appearance-none"
                  >
                    {fintechs.length > 0 ? (
                      fintechs.map(f => (
                        <option
                          key={f.id}
                          value={f.id}
                          disabled={f.status === 'SUSPENDED'}
                        >
                          {f.name}
                          {f.status === 'SUSPENDED' ? ' (Suspendida)' : ''}
                        </option>
                      ))
                    ) : (
                      <>
                        <option value="fintech-alpha">Fintech Alpha</option>
                        <option value="banco-beta">Banco Beta</option>
                      </>
                    )}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs text-slate-400 mb-1.5">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  className="w-full rounded-xl border border-white/8 bg-slate-900/80 px-3 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-slate-500/50 transition"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1.5">Contraseña</label>
                <div className="relative">
                  <input
                    type={showPw ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="w-full rounded-xl border border-white/8 bg-slate-900/80 px-3 py-2.5 pr-10 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-slate-500/50 transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw(!showPw)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-600 hover:text-slate-400 transition"
                  >
                    {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className={`mt-1 w-full flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-bold text-white transition-all active:scale-[0.98] disabled:opacity-60 ${
                  choice === 'admin'
                    ? 'bg-amber-600 hover:bg-amber-500 shadow-lg shadow-amber-900/30'
                    : 'bg-cyan-600 hover:bg-cyan-500 shadow-lg shadow-cyan-900/30'
                }`}
              >
                {loading ? (
                  <span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                ) : (
                  <>
                    <Lock className="h-3.5 w-3.5" />
                    Ingresar
                  </>
                )}
              </button>
            </form>

            <button
              onClick={() => setChoice(null)}
              className="mt-4 w-full text-center text-xs text-slate-600 hover:text-slate-400 transition"
            >
              ← Cambiar portal
            </button>
          </div>
        )}

        {/* Footer */}
        <p className="mt-8 text-center text-[11px] text-slate-700">
          Consorcio Antifraude ARG · Protocolo Zero-Knowledge · Ley 25.326
        </p>
      </div>
    </div>
  );
}
