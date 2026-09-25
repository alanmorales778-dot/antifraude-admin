'use client';

import React, { useState } from 'react';
import { ShieldAlert, X, AlertTriangle, CheckCircle } from 'lucide-react';
import { IdentifierType, FraudTypology, Tenant } from '@/lib/types';

interface ReportFraudModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultType?: IdentifierType;
  defaultValue?: string;
  currentTenant: Tenant;
  onSuccess: () => void;
}

export default function ReportFraudModal({
  isOpen,
  onClose,
  defaultType = 'EMAIL',
  defaultValue = '',
  currentTenant,
  onSuccess,
}: ReportFraudModalProps) {
  const [identifierType, setIdentifierType] = useState<IdentifierType>(defaultType);
  const [identifierValue, setIdentifierValue] = useState(defaultValue);
  const [reason, setReason] = useState<FraudTypology>('ROBO_DE_CUENTA');
  const [severity, setSeverity] = useState(4);
  const [notes, setNotes] = useState('');
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
    if (!identifierValue.trim()) return;

    setLoading(true);
    setErrorMsg('');
    try {
      const res = await fetch('/api/v1/fraud/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier_type: identifierType,
          identifier_value: identifierValue.trim(),
          reason,
          severity,
          non_pii_notes: notes,
          tenant_id_override: currentTenant.id,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Error al reportar');
      }

      setSuccess(true);
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 1200);
    } catch (err: any) {
      setErrorMsg(err.message || 'Error en el envío del reporte');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-lg rounded-2xl border border-rose-500/30 bg-[#0d121f] p-6 shadow-2xl shadow-rose-950/40">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-lg p-1 text-slate-400 hover:bg-white/10 hover:text-white"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="flex items-center gap-3 border-b border-white/10 pb-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-500/20 text-rose-400">
            <ShieldAlert className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">Reportar Fraude Confirmado</h3>
            <p className="text-xs text-slate-400">
              Emitiendo como: <strong className="text-white">{currentTenant.name}</strong>
            </p>
          </div>
        </div>

        {success ? (
          <div className="py-8 text-center space-y-3">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400">
              <CheckCircle className="h-8 w-8" />
            </div>
            <h4 className="text-sm font-bold text-white">¡Fraude Registrado en la Red!</h4>
            <p className="text-xs text-slate-400">
              El score de riesgo fue recalculado e invalidada la caché de todos los nodos.
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
                  <option value="CBU_CVU">CBU / CVU / Alias</option>
                  <option value="CARD_BIN">Tarjeta BIN</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300">Severidad (1 a 5)</label>
                <select
                  value={severity}
                  onChange={e => setSeverity(Number(e.target.value))}
                  className="mt-1 w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-xs text-white focus:outline-none"
                >
                  <option value={5}>5 - Crítico (Banda Sindicada)</option>
                  <option value={4}>4 - Alto (Fraude Confirmado)</option>
                  <option value={3}>3 - Medio (Contracargo Grave)</option>
                  <option value={2}>2 - Bajo (Operación Inusual)</option>
                  <option value={1}>1 - Leve</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300">Identificador</label>
              <input
                type="text"
                value={identifierValue}
                onChange={e => setIdentifierValue(e.target.value)}
                placeholder="ej: estafador@dominio.com o 20-38912441-2"
                className="mt-1 w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-xs text-white focus:outline-none font-mono"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300">Tipología del Fraude</label>
              <select
                value={reason}
                onChange={e => setReason(e.target.value as FraudTypology)}
                className="mt-1 w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-xs text-white focus:outline-none"
              >
                <option value="ROBO_DE_CUENTA">Robo de Cuenta (Account Takeover)</option>
                <option value="MULA_DE_DINERO">Cuenta Mula / Triangulación de Fondos</option>
                <option value="IDENTIDAD_SINTETICA">Identidad Sintética / DNI Falso</option>
                <option value="CONTRACARGO_REITERADO">Contracargo Reincidente Fraudulento</option>
                <option value="PHISHING">Phishing / Suplantación de Identidad</option>
                <option value="OPERACION_SOSPECHOSA">Operación Altamente Sospechosa</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300">
                Notas Operacionales (Sin datos personales)
              </label>
              <textarea
                rows={2}
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Detalle técnico no identificatorio para analistas de riesgo..."
                className="mt-1 w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-xs text-slate-300 focus:outline-none"
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
                className="flex-1 rounded-xl bg-gradient-to-r from-rose-600 to-rose-700 py-2 text-xs font-bold text-white shadow-lg shadow-rose-600/30 hover:brightness-110 disabled:opacity-50"
              >
                {loading ? 'Transmitiendo Hash a la Red...' : 'Confirmar Reporte en el Consorcio'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
