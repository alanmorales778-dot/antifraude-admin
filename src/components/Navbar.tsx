'use client';

import React, { useState } from 'react';
import { ShieldAlert, ShieldCheck, Key, Lock, Palette, Check } from 'lucide-react';
import { Tenant, PortalType, UserRole } from '@/lib/types';

export type ThemeMode = 'emerald' | 'gold' | 'crimson' | 'indigo';

export const THEMES: { id: ThemeMode; label: string; dot: string; desc: string; bgAccent: string }[] = [
  {
    id: 'emerald',
    label: 'Cyber Emerald',
    dot: 'bg-[#00f59b]',
    desc: 'Neón Ciberseguridad / Stripe Radar',
    bgAccent: 'from-[#00f59b] to-[#06b6d4]',
  },
  {
    id: 'gold',
    label: 'Luxury Gold & Titanium',
    dot: 'bg-amber-400',
    desc: 'Fintech VIP / Mercury & Brex',
    bgAccent: 'from-amber-400 to-amber-600',
  },
  {
    id: 'crimson',
    label: 'Crimson Defense Protocol',
    dot: 'bg-rose-500',
    desc: 'Defensa de Misión Crítica / CrowdStrike',
    bgAccent: 'from-rose-500 to-orange-500',
  },
  {
    id: 'indigo',
    label: 'Electric Indigo / Deep Tech',
    dot: 'bg-indigo-500',
    desc: 'Linear / Palantir Deep Dark',
    bgAccent: 'from-indigo-500 to-cyan-400',
  },
];

interface NavbarProps {
  currentTenant: Tenant;
  tenants: Tenant[];
  onSelectTenant: (tenant: Tenant) => void;
  onOpen2FAModal: () => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  is2FAVerified: boolean;
  currentTheme: ThemeMode;
  onSelectTheme: (theme: ThemeMode) => void;
  currentPortal?: PortalType;
  userRole?: UserRole;
}

export default function Navbar({
  currentTenant,
  tenants,
  onSelectTenant,
  onOpen2FAModal,
  activeTab,
  setActiveTab,
  is2FAVerified,
  currentTheme,
  onSelectTheme,
  currentPortal = 'ENTITY_PORTAL',
  userRole = 'ANALYST_L2',
}: NavbarProps) {
  const [isThemeMenuOpen, setIsThemeMenuOpen] = useState(false);

  const activeThemeObj = THEMES.find(t => t.id === currentTheme) || THEMES[0];

  const entityTabs = [
    { id: 'dashboard', label: 'Métricas & KPIs' },
    { id: 'lookup', label: 'Buscador Ciego' },
    { id: 'batch', label: 'Carga Masiva' },
    { id: 'rules', label: 'Reglas No-Code' },
    { id: 'war-rooms', label: 'Salas de Crisis' },
    { id: 'graph', label: 'Grafos & Mulas' },
    { id: 'webhooks', label: 'Webhooks API' },
    { id: 'salting', label: 'Salting & Token' },
    { id: 'analytics', label: 'Inteligencia' },
    { id: 'api', label: 'API & Sandbox' },
    { id: 'audit', label: 'Auditoría' },
    { id: 'legal', label: 'Consorcio' },
  ];

  const superAdminTabs = [
    { id: 'superadmin', label: 'Monitor Salud & Cuarentena' },
    { id: 'audit', label: 'Auditoría Inmutable' },
    { id: 'analytics', label: 'Métricas Globales' },
    { id: 'rules', label: 'Reglas de Red' },
    { id: 'war-rooms', label: 'Salas de Crisis' },
    { id: 'graph', label: 'Topología de Grafos' },
  ];

  const activeTabsList = currentPortal === 'SUPERADMIN_PORTAL' ? superAdminTabs : entityTabs;

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-[var(--bg-main)]/85 backdrop-blur-xl transition-colors duration-300">
      {/* Top micro-bar: Consortium Network Status */}
      <div className="border-b border-white/5 bg-black/40 px-4 py-1.5 text-xs">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 font-mono text-emerald-400">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
              </span>
              RED FEDERAL ACTIVA
            </span>
            <span className="hidden text-slate-500 sm:inline">•</span>
            <span className="hidden text-slate-400 sm:inline">10 Nodos Interconectados (Argentina)</span>
            <span className="hidden text-slate-500 sm:inline">•</span>
            <span className="hidden font-mono text-cyan-400 sm:inline">P99: 14ms (SLA &lt;50ms)</span>
          </div>

          <div className="flex items-center gap-3">
            <span className="rounded bg-white/5 px-2 py-0.5 font-mono text-[10px] text-slate-300 border border-white/10">
              SHA-256 ZERO-KNOWLEDGE
            </span>
            <button
              onClick={onOpen2FAModal}
              className="flex items-center gap-1 text-[11px] text-slate-400 transition hover:text-white"
            >
              {is2FAVerified ? (
                <span className="flex items-center gap-1 text-emerald-400">
                  <ShieldCheck className="h-3.5 w-3.5" /> 2FA Verificado
                </span>
              ) : (
                <span className="flex items-center gap-1 text-amber-400">
                  <Lock className="h-3.5 w-3.5" /> Activar 2FA
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Main navigation header */}
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
        {/* Brand with Dynamic Gradient */}
        <div className="flex items-center gap-3">
          <div className={`flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${activeThemeObj.bgAccent} p-0.5 shadow-lg shadow-black/40`}>
            <div className="flex h-full w-full items-center justify-center rounded-[10px] bg-[var(--bg-main)]">
              <ShieldAlert className="h-5 w-5 text-white" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-base font-bold tracking-tight text-white">CONSORCIO ANTIFRAUDE</span>
              <span className="rounded bg-white/10 px-1.5 py-0.2 text-[10px] font-semibold text-slate-200">
                B2B THREAT INTEL
              </span>
            </div>
            <p className="text-xs text-slate-400">Red Colaborativa Interbancaria & Fintech</p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="hidden items-center gap-1 xl:flex overflow-x-auto">
          {activeTabsList.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition whitespace-nowrap ${
                activeTab === tab.id
                  ? 'bg-white/15 text-white shadow-sm border border-white/15'
                  : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        {/* Right Section: Palette Switcher & Tenant Selector */}
        <div className="flex items-center gap-2.5">
          {/* Theme Palette Switcher Dropdown */}
          <div className="relative">
            <button
              onClick={() => setIsThemeMenuOpen(!isThemeMenuOpen)}
              className="flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/5 px-2.5 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-white/10 transition"
              title="Cambiar Paleta de Colores"
            >
              <Palette className="h-3.5 w-3.5 text-slate-300" />
              <span className={`h-2.5 w-2.5 rounded-full ${activeThemeObj.dot}`} />
              <span className="hidden sm:inline text-[11px]">{activeThemeObj.label}</span>
              <span className="text-[9px] text-slate-400">▾</span>
            </button>

            {isThemeMenuOpen && (
              <div className="absolute right-0 mt-2 w-64 rounded-2xl border border-white/15 bg-[#0e1424] p-2 shadow-2xl shadow-black/80 backdrop-blur-2xl z-50 animate-fade-in">
                <div className="px-2.5 py-1.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider border-b border-white/10 mb-1">
                  Paletas Silicon Valley
                </div>
                {THEMES.map(t => (
                  <button
                    key={t.id}
                    onClick={() => {
                      onSelectTheme(t.id);
                      setIsThemeMenuOpen(false);
                    }}
                    className={`flex items-center justify-between w-full rounded-xl px-3 py-2 text-xs transition text-left ${
                      currentTheme === t.id
                        ? 'bg-white/15 text-white font-bold'
                        : 'text-slate-300 hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <span className={`h-3 w-3 rounded-full ${t.dot} shadow-sm`} />
                      <div>
                        <div className="font-semibold">{t.label}</div>
                        <div className="text-[10px] text-slate-400 font-normal">{t.desc}</div>
                      </div>
                    </div>
                    {currentTheme === t.id && <Check className="h-4 w-4 text-emerald-400" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Tenant Selector */}
          <div className="relative">
            <label htmlFor="tenant-select" className="sr-only">Seleccionar Entidad</label>
            <select
              id="tenant-select"
              value={currentTenant.id}
              onChange={e => {
                const found = tenants.find(t => t.id === e.target.value);
                if (found) onSelectTenant(found);
              }}
              className="appearance-none cursor-pointer rounded-xl border border-white/15 bg-black/40 py-1.5 pl-3 pr-8 text-xs font-medium text-slate-200 shadow-inner focus:border-white/30 focus:outline-none"
            >
              {tenants.map(t => (
                <option key={t.id} value={t.id} className="bg-slate-900 text-white">
                  {t.logo} {t.name}
                </option>
              ))}
            </select>
            <div className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-[10px]">
              ▼
            </div>
          </div>

          <button
            onClick={onOpen2FAModal}
            title="Configuración de Sesión & 2FA"
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-slate-400 transition hover:border-white/20 hover:text-white"
          >
            <Key className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Mobile Tab Bar */}
      <div className="flex overflow-x-auto border-t border-white/5 px-2 py-1 md:hidden">
        {activeTabsList.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`whitespace-nowrap px-3 py-1 text-xs font-medium ${
              activeTab === tab.id ? 'text-white border-b-2 border-white font-bold' : 'text-slate-400'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
    </header>
  );
}
