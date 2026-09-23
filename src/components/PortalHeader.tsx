'use client';

import React from 'react';
import { ShieldCheck, ShieldAlert, Users, Crown, Globe, Lock, Cpu, Server } from 'lucide-react';
import { PortalType, UserRole } from '@/lib/types';

interface PortalHeaderProps {
  currentPortal: PortalType;
  onSelectPortal: (portal: PortalType) => void;
  currentRole: UserRole;
  onSelectRole: (role: UserRole) => void;
}

export default function PortalHeader({
  currentPortal,
  onSelectPortal,
  currentRole,
  onSelectRole,
}: PortalHeaderProps) {
  return (
    <div className="border-b border-white/10 bg-black/60 px-4 py-2 text-xs">
      <div className="mx-auto flex max-w-7xl flex-col sm:flex-row items-center justify-between gap-2.5">
        {/* Subdominio & Portal Switcher */}
        <div className="flex items-center gap-2">
          <span className="text-slate-400 font-mono text-[11px] flex items-center gap-1">
            <Globe className="h-3 w-3 text-cyan-400" />
            Entorno:
          </span>
          <div className="flex rounded-lg border border-white/10 bg-slate-900/80 p-0.5">
            <button
              onClick={() => onSelectPortal('ENTITY_PORTAL')}
              className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-semibold transition ${
                currentPortal === 'ENTITY_PORTAL'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Users className="h-3 w-3" />
              Portal Entidades (app.antifraude.com)
            </button>
            <button
              onClick={() => onSelectPortal('SUPERADMIN_PORTAL')}
              className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-semibold transition ${
                currentPortal === 'SUPERADMIN_PORTAL'
                  ? 'bg-amber-500 text-black font-bold shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Crown className="h-3 w-3" />
              SuperAdmin / Owner (admin.antifraude.com)
            </button>
          </div>
        </div>

        {/* Roles & Fixed IP Indicator */}
        <div className="flex items-center gap-3">
          {currentPortal === 'ENTITY_PORTAL' ? (
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400 text-[11px]">Rol en Entidad:</span>
              <select
                value={currentRole}
                onChange={e => onSelectRole(e.target.value as UserRole)}
                aria-label="Seleccionar Rol en Entidad"
                className="rounded-lg border border-white/10 bg-slate-900 py-0.5 px-2 text-[11px] font-semibold text-slate-200 focus:outline-none cursor-pointer"
              >
                <option value="ANALYST_L1">Analista L1 (Solo Búsqueda Manual)</option>
                <option value="ANALYST_L2">Analista L2 (Batch + Falsos Positivos + Reportes)</option>
                <option value="TENANT_ADMIN">Admin Tenant (API Keys + Webhooks + Reglas)</option>
              </select>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1 font-mono text-[10px] text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded">
                <Lock className="h-3 w-3" /> IP Fija Restringida: 190.210.10.4/32
              </span>
              <span className="flex items-center gap-1 font-mono text-[10px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded">
                <ShieldCheck className="h-3 w-3" /> 2FA Hardware Token OK
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
