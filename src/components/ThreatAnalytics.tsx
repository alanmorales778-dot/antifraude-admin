'use client';

import React from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  AlertTriangle,
  Layers,
  PieChart,
  Users,
  Activity,
  ArrowUpRight,
  Fingerprint,
} from 'lucide-react';

export default function ThreatAnalytics() {
  const typologies = [
    {
      name: 'Cuentas Mula & Triangulación',
      count: 542,
      percentage: 38,
      color: 'bg-rose-500',
      trend: '+12%',
      description: 'Cuentas bancarias o billeteras utilizadas para lavar giros de estafas en cadena.',
    },
    {
      name: 'Robo de Cuenta (Account Takeover)',
      count: 356,
      percentage: 25,
      color: 'bg-indigo-500',
      trend: '-4%',
      description: 'Credenciales vulneradas por SIM swapping, ingeniería social o malware bancario.',
    },
    {
      name: 'Identidades Sintéticas & DNI Falso',
      count: 228,
      percentage: 16,
      color: 'bg-amber-500',
      trend: '+19%',
      description: 'Combinación de DNI legítimos con fotos adulteradas para superar validación biométrica.',
    },
    {
      name: 'Contracargos Reincidentes',
      count: 171,
      percentage: 12,
      color: 'bg-cyan-500',
      trend: '-2%',
      description: 'Usuarios que desconocen compras reiteradas en plataformas de comercio electrónico.',
    },
    {
      name: 'Phishing Bancario & Smishing',
      count: 128,
      percentage: 9,
      color: 'bg-emerald-500',
      trend: '+8%',
      description: 'Enlaces clonados simulando plataformas de homebanking o billeteras oficiales.',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-white sm:text-2xl">
          Inteligencia de Amenazas & Métricas Colaborativas
        </h2>
        <p className="text-xs text-slate-400 mt-1">
          Análisis agregado y tipologías de ataque detectadas en tiempo real a través del consorcio interbancario de Argentina.
        </p>
      </div>

      {/* Top 3 Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="glass-panel rounded-2xl p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">Tasa de Falsos Positivos</span>
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400">
              <ShieldCheck className="h-4 w-4" />
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-white">2.8%</span>
            <span className="text-xs text-emerald-400 font-medium">Bajo estándar global (avg: 5.4%)</span>
          </div>
          <p className="mt-2 text-[11px] text-slate-500">
            Gracias a la regla de consenso multientidad (se requieren reportes independientes).
          </p>
        </div>

        <div className="glass-panel rounded-2xl p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">Tiempo Medio de Rehabilitación</span>
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-400">
              <Activity className="h-4 w-4" />
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-white">3.4 hrs</span>
            <span className="text-xs text-cyan-400 font-medium">SLA de disputa &lt; 24h</span>
          </div>
          <p className="mt-2 text-[11px] text-slate-500">
            Validación biométrica automatizada con soporte de verificación RENAPER.
          </p>
        </div>

        <div className="glass-panel rounded-2xl p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">Ataques Sindicados Detectados</span>
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-rose-500/10 text-rose-400">
              <ShieldAlert className="h-4 w-4" />
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-white">41 bandas</span>
            <span className="text-xs text-rose-400 font-medium">100% neutralizadas</span>
          </div>
          <p className="mt-2 text-[11px] text-slate-500">
            Detección de patrones coordinados operando en más de 4 entidades en menos de 1 hora.
          </p>
        </div>
      </div>

      {/* Breakdown by Typology */}
      <div className="glass-panel rounded-2xl p-6 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/10 pb-4">
          <div>
            <h3 className="text-sm font-bold text-white">Distribución de Fraudes Confirmados por Tipología</h3>
            <p className="text-xs text-slate-400">Mapeo de vector de ataque en las principales entidades financieras argentinas</p>
          </div>
          <span className="rounded bg-indigo-500/10 px-2.5 py-1 text-xs font-mono text-indigo-300 border border-indigo-500/20">
            Total Reportes: 1,425
          </span>
        </div>

        <div className="mt-6 space-y-5">
          {typologies.map(typ => (
            <div key={typ.name} className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-white">{typ.name}</span>
                <div className="flex items-center gap-3">
                  <span className="text-slate-400">{typ.count} casos ({typ.percentage}%)</span>
                  <span className={`font-mono text-[11px] font-bold ${typ.trend.startsWith('+') ? 'text-rose-400' : 'text-emerald-400'}`}>
                    {typ.trend}
                  </span>
                </div>
              </div>

              {/* Progress bar */}
              <div className="h-2 w-full rounded-full bg-slate-800 overflow-hidden">
                <div
                  className={`h-full ${typ.color} rounded-full transition-all duration-500`}
                  style={{ width: `${typ.percentage}%` }}
                />
              </div>

              <p className="text-[11px] text-slate-500">{typ.description}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Community Syndicate Prevention Story */}
      <div className="glass-panel rounded-2xl p-6 border-l-4 border-l-cyan-500">
        <h4 className="text-sm font-bold text-white flex items-center gap-2">
          <Fingerprint className="h-4 w-4 text-cyan-400" />
          ¿Cómo neutraliza la Red Comunitaria a las Bandas Criminales?
        </h4>
        <p className="mt-2 text-xs text-slate-300 leading-relaxed">
          Tradicionalmente, cuando un ciberdelincuente comete un fraude en una fintech (ej. Mercado Pago), pasa de inmediato a probar suerte en otra (ej. Ualá, Santander o Lemon Cash). En un modelo aislado, cada empresa tarda semanas en detectar el patrón.
          <br className="my-1.5" />
          Con el <strong>Consorcio Antifraude B2B en Tiempo Real</strong>, el identificador blind-hasheado entra en la red comunitaria en menos de <strong>14 milisegundos</strong>. Cuando la segunda entidad realiza la evaluación previa a la transacción, el score ya marca <strong>RIESGO ALTO (BLOQUEAR)</strong> con coincidencia en entidades independientes, frustrando el ataque instantáneamente y sin revelar el origen confidencial del reporte.
        </p>
      </div>
    </div>
  );
}
