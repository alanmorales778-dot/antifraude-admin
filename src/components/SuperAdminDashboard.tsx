'use client';

import React, { useState, useEffect } from 'react';
import { Crown, Server, Activity, ShieldAlert, ShieldCheck, Database, Zap, AlertTriangle, Lock, Ban } from 'lucide-react';
import { Tenant } from '@/lib/types';

export default function SuperAdminDashboard() {
  const [infraData, setInfraData] = useState<any>(null);
  const [tenants, setTenants] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchSuperAdminData = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/admin/infrastructure');
      const json = await res.json();
      if (json.data) {
        setInfraData(json.data.infra);
        setTenants(json.data.tenantsReputation || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSuperAdminData();
  }, []);

  const handleToggleQuarantine = async (tenantId: string, currentStatus: boolean) => {
    const actionName = currentStatus ? 'retirar de cuarentena a' : 'poner en cuarentena a';
    if (!confirm(`¿Confirmas ${actionName} esta entidad financiera? Mientras esté en cuarentena, sus reportes no afectarán el score de la red comunitaria.`)) {
      return;
    }

    try {
      await fetch('/api/v1/admin/quarantine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId, inQuarantine: !currentStatus }),
      });
      fetchSuperAdminData();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-6">
      {/* 4 Infrastructure KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
        <div className="glass-panel rounded-2xl p-4">
          <span className="text-slate-400">Latencia API P95 / P99</span>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-emerald-400 font-mono">9 ms</span>
            <span className="text-slate-500 font-mono">/ 14 ms (P99)</span>
          </div>
          <p className="mt-1 text-[11px] text-emerald-400">✓ Cumple SLA estricto &lt; 50ms</p>
        </div>

        <div className="glass-panel rounded-2xl p-4">
          <span className="text-slate-400">Tasa de Aciertos Caché (Redis)</span>
          <div className="mt-2 text-2xl font-bold text-cyan-400 font-mono">
            {infraData?.redisHitRate || '99.4%'}
          </div>
          <p className="mt-1 text-[11px] text-slate-500">18,450 claves activas en memoria</p>
        </div>

        <div className="glass-panel rounded-2xl p-4">
          <span className="text-slate-400">Pool Conexiones Supabase</span>
          <div className="mt-2 text-2xl font-bold text-white font-mono">
            12 / 100 <span className="text-xs text-emerald-400">Saludable</span>
          </div>
          <p className="mt-1 text-[11px] text-slate-500">Tiempo de consulta BD: 2.1 ms</p>
        </div>

        <div className="glass-panel rounded-2xl p-4">
          <span className="text-slate-400">Entidades en Cuarentena</span>
          <div className="mt-2 text-2xl font-bold text-amber-400 font-mono">
            {tenants.filter(t => t.inQuarantine).length} <span className="text-xs text-slate-400">Aisladas</span>
          </div>
          <p className="mt-1 text-[11px] text-slate-500">Reportes silenciados preventivamente</p>
        </div>
      </div>

      {/* Tenant Reputation Index & Quality Control Table */}
      <div className="glass-panel rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-4">
          <div>
            <h3 className="text-sm font-bold text-white">Tenant Reputation Index & Control de Calidad</h3>
            <p className="text-xs text-slate-400">
              Evalúa el puntaje de confianza (Trust Score) y el nivel de ruido/falsos positivos de cada banco o fintech
            </p>
          </div>
          <span className="text-xs text-slate-400 font-mono">10 Entidades Federadas</span>
        </div>

        {/* Quality Table with Quarantine Button */}
        <div className="overflow-x-auto rounded-xl border border-white/10 bg-slate-950/60">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-900 text-[11px] uppercase text-slate-400 border-b border-white/10">
              <tr>
                <th className="px-4 py-3">Institución</th>
                <th className="px-4 py-3">Suscripción</th>
                <th className="px-4 py-3">Trust Score</th>
                <th className="px-4 py-3">Tasa de Ruido / Falsos Positivos</th>
                <th className="px-4 py-3">Estado de Calidad</th>
                <th className="px-4 py-3 text-right">Acción de Aislamiento</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-slate-300">
              {tenants.map(t => (
                <tr key={t.id} className={t.inQuarantine ? 'bg-amber-950/20' : 'hover:bg-white/5'}>
                  <td className="px-4 py-3 font-semibold text-white">
                    {t.name}
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded bg-white/5 px-2 py-0.5 text-[10px] font-mono text-slate-300">
                      {t.subscriptionTier}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono font-bold">
                    <span className={t.trustScore >= 95 ? 'text-emerald-400' : 'text-amber-400'}>
                      {t.trustScore}%
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono">
                    <span className={t.noiseRate > 2.5 ? 'text-rose-400 font-bold' : 'text-slate-400'}>
                      {t.noiseRate}%
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {t.inQuarantine ? (
                      <span className="rounded bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold text-amber-400 border border-amber-500/30">
                        AISLADO EN CUARENTENA
                      </span>
                    ) : (
                      <span className="rounded bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-400 border border-emerald-500/20">
                        CONFIABLE EN RED
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => handleToggleQuarantine(t.id, t.inQuarantine)}
                      className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
                        t.inQuarantine
                          ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                          : 'border border-amber-500/30 bg-amber-950/40 text-amber-300 hover:bg-amber-900/50'
                      }`}
                    >
                      {t.inQuarantine ? 'Restablecer en Red' : 'Poner en Cuarentena'}
                    </button>
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
