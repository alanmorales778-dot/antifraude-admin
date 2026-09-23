'use client';

import React, { useState, useEffect } from 'react';
import { Hash, Key, Lock, ArrowDown, Sparkles, Shield, RefreshCw } from 'lucide-react';
import { IdentifierType } from '@/lib/types';
import { computeBlindHash, CONSORTIUM_SALT } from '@/lib/crypto';

export default function SaltingInspector() {
  const [identifierType, setIdentifierType] = useState<IdentifierType>('EMAIL');
  const [identifierValue, setIdentifierValue] = useState('estafador.red@gmail.com');
  const [customTenantSalt, setCustomTenantSalt] = useState('GALICIA_LOCAL_SALT_HSM_9921');
  const [hashResult, setHashResult] = useState<any>(null);

  const calculateHash = async () => {
    const res = await computeBlindHash(identifierType, identifierValue, customTenantSalt);
    setHashResult(res);
  };

  useEffect(() => {
    calculateHash();
  }, [identifierType, identifierValue, customTenantSalt]);

  const setPresetSalt = (salt: string) => {
    setCustomTenantSalt(salt);
  };

  return (
    <div className="glass-panel rounded-2xl p-6 shadow-xl space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <Key className="h-5 w-5 text-[var(--accent-primary)]" />
            <h3 className="text-sm font-bold text-white">Inspector de Salting & Tokenización Criptográfica</h3>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Comprueba cómo el doble salting (Salt Privada del Banco + Salt Global del Consorcio) blinda el dato contra tablas arcoíris.
          </p>
        </div>

        {/* Preset Salts */}
        <div className="flex flex-wrap gap-1.5 text-xs">
          <button
            onClick={() => setPresetSalt('GALICIA_LOCAL_SALT_HSM_9921')}
            className="rounded-lg border border-white/10 bg-slate-900 px-2.5 py-1 text-[11px] text-slate-300 hover:text-white"
          >
            Salt Banco Galicia
          </button>
          <button
            onClick={() => setPresetSalt('MERCADOPAGO_ROTATIVE_SALT_2026')}
            className="rounded-lg border border-white/10 bg-slate-900 px-2.5 py-1 text-[11px] text-slate-300 hover:text-white"
          >
            Salt Mercado Pago
          </button>
          <button
            onClick={() => setPresetSalt(`HSM_TOKEN_${Date.now().toString(16).toUpperCase()}`)}
            className="rounded-lg border border-white/10 bg-slate-900 px-2.5 py-1 text-[11px] text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
          >
            <RefreshCw className="h-3 w-3" /> Token Dinámico
          </button>
        </div>
      </div>

      {/* Inputs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
        <div>
          <label className="block text-slate-400 mb-1 font-semibold">1. Tipo de Identificador</label>
          <select
            value={identifierType}
            onChange={e => setIdentifierType(e.target.value as IdentifierType)}
            className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-white focus:outline-none"
          >
            <option value="EMAIL">Email</option>
            <option value="DNI">DNI / CUIT</option>
            <option value="PHONE">Teléfono</option>
            <option value="CARD_BIN">Tarjeta BIN</option>
          </select>
        </div>

        <div>
          <label className="block text-slate-400 mb-1 font-semibold">2. Identificador en Crudo</label>
          <input
            type="text"
            value={identifierValue}
            onChange={e => setIdentifierValue(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-white font-mono focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-slate-400 mb-1 font-semibold flex items-center justify-between">
            <span>3. Salt Privada del Tenant / Token</span>
            <span className="text-[10px] text-[var(--accent-primary)] font-mono">Editable</span>
          </label>
          <input
            type="text"
            value={customTenantSalt}
            onChange={e => setCustomTenantSalt(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-amber-300 font-mono focus:outline-none"
          />
        </div>
      </div>

      {/* Step by Step Visual Derivation */}
      {hashResult && (
        <div className="space-y-3 font-mono text-xs">
          {/* Step 1: Normalization */}
          <div className="rounded-xl border border-white/5 bg-slate-950/60 p-3">
            <div className="flex items-center justify-between text-[11px] text-slate-400 pb-1">
              <span className="font-semibold text-slate-300">Paso 1: Normalización Canónica</span>
              <span>trim() + toLowerCase() + strip symbols</span>
            </div>
            <div className="text-cyan-400 bg-black/40 px-2.5 py-1.5 rounded-lg truncate">
              {hashResult.normalized}
            </div>
          </div>

          <div className="flex justify-center text-slate-600">
            <ArrowDown className="h-4 w-4 animate-bounce" />
          </div>

          {/* Step 2: Tenant Salting */}
          <div className="rounded-xl border border-amber-500/20 bg-amber-950/20 p-3">
            <div className="flex items-center justify-between text-[11px] text-amber-400 pb-1">
              <span className="font-semibold">Paso 2: Inyección de Salt Local del Tenant</span>
              <span>SHA-256(Tipo + ":" + Normalizado + ":" + SaltTenant)</span>
            </div>
            <div className="text-amber-300 bg-black/40 px-2.5 py-1.5 rounded-lg truncate">
              Payload: {identifierType}:{hashResult.normalized}:{hashResult.tenantSaltUsed}
            </div>
            <div className="mt-1.5 text-[10px] text-slate-400 truncate">
              Hash Intermedio Local: <span className="text-slate-200">{hashResult.intermediateHash}</span>
            </div>
          </div>

          <div className="flex justify-center text-slate-600">
            <ArrowDown className="h-4 w-4 animate-bounce" />
          </div>

          {/* Step 3: Master Consortium Salting */}
          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-3">
            <div className="flex items-center justify-between text-[11px] text-[var(--accent-primary)] pb-1">
              <span className="font-semibold flex items-center gap-1">
                <Shield className="h-3.5 w-3.5" /> Paso 3: Blind Hash Final del Consorcio (Zero-Knowledge)
              </span>
              <span>SHA-256 Irreversible (64 hex characters)</span>
            </div>
            <div className="text-[var(--accent-primary)] bg-black/60 px-3 py-2 rounded-lg text-sm font-bold break-all shadow-inner border border-white/5">
              {hashResult.blindHash}
            </div>
            <div className="mt-2 flex items-center justify-between text-[10px] text-slate-500">
              <span>Salt Maestra Red: {hashResult.consortiumSaltPreview}</span>
              <span className="text-emerald-400">Garantía Matemática de Imposibilidad de Reversión ✓</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
