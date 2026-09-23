'use client';

import React, { useState } from 'react';
import { CheckCircle, X, ShieldCheck } from 'lucide-react';
import { IdentifierType, Tenant } from '@/lib/types';

interface RehabilitateModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultType?: IdentifierType;
  defaultValue?: string;
  currentTenant: Tenant;
  onSuccess: () => void;
}

export default function RehabilitateModal({
  isOpen,
  onClose,
  defaultType = 'EMAIL',
  defaultValue = '',
  currentTenant,
  onSuccess,
}: RehabilitateModalProps) {
  const [identifierType, setIdentifierType] = useState<IdentifierType>(defaultType);
  const [identifierValue, setIdentifierValue] = useState(defaultValue);
  const [reason, setReason] = useState(
    'Titular acreditó legitimidad mediante validación biométrica con RENAPER'
  );
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [success, setSuccess] = useState(false);

  React.useEffect(() => {
    if (defaultValue) setIdentifierValue(defaultValue);
    if (defaultType) setIdentifierType(defaultType);
    setSuccess(false);
    setErrorMsg('');
  }, [defaultValue, defaultType, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifierValue.trim() || !reason.trim()) return;

    setLoading(true);
    setErrorMsg('');
    try {
      const res = await fetch('/api/v1/fraud/rehabilitate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier_type: identifierType,
          identifier_value: identifierValue.trim(),
          reason: reason.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Error al rehabilitar entidad');
      }

      setSuccess(true);
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 1200);
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al procesar el falso positivo');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-lg rounded-2xl border border-emerald-500/30 bg-[#0d121f] p-6 shadow-2xl shadow-emerald-950/40">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-lg p-1 text-slate-400 hover:bg-white/10 hover:text-white"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="flex items-center gap-3 border-b border-white/10 pb-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400">
            <CheckCircle className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">Rehabilitar / Falso Positivo</h3>
            <p className="text-xs text-slate-400">
              Restablece el score de riesgo a nivel seguro (&lt;15) en tiempo real
            </p>
          </div>
        </div>

        {success ? (
          <div className="py-8 text-center space-y-3">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400">
              <ShieldCheck className="h-8 w-8" />
            </div>
            <h4 className="text-sm font-bold text-white">¡Usuario Rehabilitado Exitosamente!</h4>
            <p className="text-xs text-slate-400">
              El estado fue actualizado en el clúster y el score restaurado a nivel seguro.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300">Tipo de Dato</label>
                <select
                  value={identifierType}
                  onChange={e => setIdentifierType(e.target.value as IdentifierType)}
                  className="mt-1 w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-xs text-white focus:outline-none"
                >
                  <option value="EMAIL">Email</option>
                  <option value="DNI">DNI / CUIT</option>
                  <option value="PHONE">Teléfono</option>
                  <option value="CARD_BIN">Tarjeta BIN</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300">Identificador</label>
                <input
                  type="text"
                  value={identifierValue}
                  onChange={e => setIdentifierValue(e.target.value)}
                  placeholder="ej: usuario@gmail.com"
                  className="mt-1 w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-xs text-white focus:outline-none font-mono"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300">
                Motivo / Justificación de la Rehabilitación
              </label>
              <textarea
                rows={3}
                value={reason}
                onChange={e => setReason(e.target.value)}
                placeholder="Detalla el proceso de verificación legítimo (ej. biometría facial aprobada)..."
                className="mt-1 w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-xs text-slate-300 focus:outline-none"
                required
              />
            </div>

            {errorMsg && (
              <p className="text-xs font-semibold text-rose-400">{errorMsg}</p>
            )}

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="w-1/3 rounded-xl border border-white/10 py-2 text-xs font-semibold text-slate-400 hover:text-white"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 rounded-xl bg-gradient-to-r from-emerald-600 to-indigo-600 py-2 text-xs font-bold text-white shadow-lg shadow-emerald-600/30 hover:brightness-110 disabled:opacity-50"
              >
                {loading ? 'Rehabilitando en la Red...' : 'Restablecer Score a Seguro'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
