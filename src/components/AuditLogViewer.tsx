'use client';

import React, { useState, useEffect } from 'react';
import { ShieldCheck, RefreshCw, CheckCircle2, Clock, Filter, Terminal } from 'lucide-react';
import { AuditLog } from '@/lib/types';

export default function AuditLogViewer() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/audit/logs?limit=40');
      const data = await res.json();
      if (data.data) setLogs(data.data);
    } catch (err) {
      console.error('Error fetching audit logs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
    if (!autoRefresh) return;
    const interval = setInterval(fetchLogs, 5000);
    return () => clearInterval(interval);
  }, [autoRefresh]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white sm:text-2xl">
            Registro Inviolable de Auditoría (Audit Trail)
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Trazabilidad criptográfica inalterable de cada consulta, reporte y tiempo de respuesta procesado por el consorcio.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={e => setAutoRefresh(e.target.checked)}
              className="rounded border-white/20 bg-slate-900 text-indigo-600 focus:ring-0"
            />
            <span>Auto-actualizar (5s)</span>
          </label>

          <button
            onClick={fetchLogs}
            disabled={loading}
            className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-slate-900 px-3.5 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-800 transition"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin text-indigo-400' : ''}`} />
            Actualizar
          </button>
        </div>
      </div>

      <div className="glass-panel rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between border-b border-white/10 pb-3 text-xs text-slate-400">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 font-semibold text-white">
              <Terminal className="h-4 w-4 text-cyan-400" /> Transmisión en Vivo de Consultas & Trazas
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-mono font-semibold text-emerald-300">
              <ShieldCheck className="h-3 w-3" /> Hash-Chain SHA-256 Inmutable
            </span>
          </div>
          <span className="font-mono text-[11px] text-emerald-400">
            Total en cola auditada: {logs.length} eventos
          </span>
        </div>

        <div className="overflow-x-auto rounded-xl border border-white/10 bg-slate-950/60 max-h-[500px]">
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 bg-slate-900 text-[11px] uppercase text-slate-400 border-b border-white/10">
              <tr>
                <th className="px-4 py-2.5">Hora (Timestamp)</th>
                <th className="px-4 py-2.5">Entidad (Tenant)</th>
                <th className="px-4 py-2.5">Endpoint</th>
                <th className="px-4 py-2.5">Tipo</th>
                <th className="px-4 py-2.5">Blind Hash Preview</th>
                <th className="px-4 py-2.5">Hash de Bloque (Chained)</th>
                <th className="px-4 py-2.5">Latencia</th>
                <th className="px-4 py-2.5">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-slate-300 font-mono text-[11px]">
              {logs.map(log => (
                <tr key={log.id} className="hover:bg-white/5">
                  <td className="px-4 py-2.5 text-slate-400 whitespace-nowrap">
                    {new Date(log.timestamp).toLocaleTimeString('es-AR', {
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                    })}
                  </td>
                  <td className="px-4 py-2.5 font-sans font-semibold text-white whitespace-nowrap">
                    {log.tenantName}
                  </td>
                  <td className="px-4 py-2.5 text-indigo-300">{log.endpoint}</td>
                  <td className="px-4 py-2.5 text-cyan-400">{log.identifierType || '—'}</td>
                  <td className="px-4 py-2.5 text-slate-500 font-mono">
                    {log.blindHashPreview || '—'}
                  </td>
                  <td className="px-4 py-2.5 text-emerald-400/90 font-mono text-[10px]">
                    {log.blockHash ? `${log.blockHash.slice(0, 12)}…` : 'blk_genesis_ok'}
                  </td>
                  <td className="px-4 py-2.5">
                    <span
                      className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                        log.latencyMs <= 20
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : log.latencyMs <= 50
                          ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20'
                          : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                      }`}
                    >
                      {log.latencyMs} ms
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className="flex items-center gap-1 text-emerald-400">
                      <CheckCircle2 className="h-3.5 w-3.5" /> {log.statusCode} OK
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
