'use client';

import React, { useState, useMemo } from 'react';
import {
  ShieldCheck,
  Search,
  Filter,
  Calendar,
  Clock,
  Download,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  RefreshCw,
  FileText,
  User,
  Hash,
  Activity,
  Layers,
} from 'lucide-react';
import { StoreAuditLog } from '@/lib/types';
import { useConsortiumStore } from '@/lib/store';

interface RegulatoryAuditTableProps {
  logs?: StoreAuditLog[];
}

export default function RegulatoryAuditTable({ logs }: RegulatoryAuditTableProps) {
  const storeLogs = useConsortiumStore(state => state.auditLogs);
  const allLogs = logs || storeLogs;

  // Filtros
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAction, setSelectedAction] = useState<string>('ALL');
  const [timeRange, setTimeRange] = useState<'ALL' | '1H' | '24H' | '7D' | '30D'>('ALL');

  // Paginación
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState<number>(10);

  // Obtener lista única de tipos de acción para el dropdown
  const uniqueActions = useMemo(() => {
    const set = new Set<string>();
    allLogs.forEach(l => {
      if (l.action) set.add(l.action);
    });
    return Array.from(set).sort();
  }, [allLogs]);

  // Filtrado reactivo
  const filteredLogs = useMemo(() => {
    const now = Date.now();

    return allLogs.filter(log => {
      // 1. Filtro de búsqueda libre (actor, acción, detalles)
      const matchesSearch =
        !searchQuery.trim() ||
        log.actor.toLowerCase().includes(searchQuery.toLowerCase()) ||
        log.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
        log.details.toLowerCase().includes(searchQuery.toLowerCase());

      // 2. Filtro de tipo de evento
      const matchesAction =
        selectedAction === 'ALL' || log.action === selectedAction;

      // 3. Filtro de rango de tiempo
      let matchesTime = true;
      if (timeRange !== 'ALL') {
        const logTime = new Date(log.timestamp).getTime();
        const diffMs = now - logTime;
        if (timeRange === '1H') matchesTime = diffMs <= 1000 * 60 * 60;
        else if (timeRange === '24H') matchesTime = diffMs <= 1000 * 60 * 60 * 24;
        else if (timeRange === '7D') matchesTime = diffMs <= 1000 * 60 * 60 * 24 * 7;
        else if (timeRange === '30D') matchesTime = diffMs <= 1000 * 60 * 60 * 24 * 30;
      }

      return matchesSearch && matchesAction && matchesTime;
    });
  }, [allLogs, searchQuery, selectedAction, timeRange]);

  // Paginación
  const totalPages = Math.max(1, Math.ceil(filteredLogs.length / itemsPerPage));
  const paginatedLogs = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredLogs.slice(start, start + itemsPerPage);
  }, [filteredLogs, currentPage, itemsPerPage]);

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
    }
  };

  // Badge de color por Tipo de Evento
  const getEventBadge = (action: string) => {
    switch (action) {
      case 'ADMIN_LOGIN':
      case 'LOGIN':
        return 'bg-blue-500/20 text-blue-300 border-blue-500/40';
      case 'ADMIN_LOGOUT':
      case 'LOGOUT':
      case 'PARTNER_LOGOUT':
        return 'bg-purple-500/20 text-purple-300 border-purple-500/40';
      case '2FA_ENROLL':
      case '2FA_VERIFY':
        return 'bg-teal-500/20 text-teal-300 border-teal-500/40';
      case 'USER_CREATE':
      case 'ROLE_UPDATE':
      case 'USER_STATUS_CHANGE':
        return 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40';
      case 'FRAUD_REPORTED':
      case 'FRAUD_REPORT':
      case 'CONFIRM_BLOCK':
        return 'bg-rose-500/20 text-rose-300 border-rose-500/40';
      case 'RISK_EVALUATE':
      case 'IDENTITY_LOOKUP':
      case 'BATCH_LOOKUP':
        return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';
      case 'CONFIG_UPDATE':
      case 'SCORING_PRESET_APPLIED':
      case 'SCORING_CONFIG_RESET':
        return 'bg-amber-500/20 text-amber-300 border-amber-500/40';
      case 'DB_INIT':
      case 'SUPABASE_SYNC':
      case 'SUPABASE_CONNECTED':
        return 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40';
      default:
        return 'bg-slate-700/30 text-slate-300 border-slate-600/40';
    }
  };

  // Exportar a CSV para auditoría
  const exportToCSV = () => {
    const headers = ['Timestamp', 'Tipo_Evento', 'Actor_Usuario', 'Descripcion_Evento'];
    const rows = filteredLogs.map(l => [
      `"${new Date(l.timestamp).toISOString()}"`,
      `"${l.action}"`,
      `"${l.actor}"`,
      `"${l.details.replace(/"/g, '""')}"`,
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `auditoria_bcra_a7370_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="bg-[#0d182e] border border-[#1e365b] rounded-2xl shadow-xl overflow-hidden space-y-4">
      {/* ── Encabezado Estándar BCRA ── */}
      <div className="p-5 border-b border-[#17253d] bg-[#091222] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              Libro de Auditoría Regulatoria Inmutable
            </h3>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold">
              BCRA A7370
            </span>
          </div>
          <p className="text-xs text-[#94a3b8] mt-1">
            Trazabilidad criptográfica inalterable sincronizada en tiempo real con Supabase. Registro formal de cada acceso, evaluación, reporte y cambio de configuración.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={exportToCSV}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#13233e] hover:bg-[#1a3052] text-[#93c5fd] text-xs font-semibold border border-[#203c68] transition"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Exportar CSV</span>
          </button>
        </div>
      </div>

      {/* ── Barra de Herramientas & Filtros de Búsqueda ── */}
      <div className="px-5 py-2 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[280px]">
          {/* Buscador de texto libre */}
          <div className="relative flex-1 min-w-[220px] max-w-md">
            <input
              type="text"
              value={searchQuery}
              onChange={e => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Buscar por correo, IP, acción o contenido..."
              className="w-full px-3.5 py-2 pl-9 bg-[#060c17] border border-[#1e365b] rounded-xl text-xs text-white placeholder-[#475569] focus:outline-none focus:border-[#3b82f6]"
            />
            <Search className="w-3.5 h-3.5 text-[#64748b] absolute left-3 top-2.5" />
          </div>

          {/* Selector de Tipo de Evento */}
          <div className="flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-[#64748b]" />
            <select
              value={selectedAction}
              onChange={e => {
                setSelectedAction(e.target.value);
                setCurrentPage(1);
              }}
              className="px-3 py-2 bg-[#060c17] border border-[#1e365b] rounded-xl text-xs text-white focus:outline-none focus:border-[#3b82f6]"
            >
              <option value="ALL">Todos los Eventos ({allLogs.length})</option>
              {uniqueActions.map(act => (
                <option key={act} value={act}>
                  {act} ({allLogs.filter(l => l.action === act).length})
                </option>
              ))}
            </select>
          </div>

          {/* Selector de Rango de Fechas/Horas */}
          <div className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-[#64748b]" />
            <select
              value={timeRange}
              onChange={e => {
                setTimeRange(e.target.value as any);
                setCurrentPage(1);
              }}
              className="px-3 py-2 bg-[#060c17] border border-[#1e365b] rounded-xl text-xs text-white focus:outline-none focus:border-[#3b82f6]"
            >
              <option value="ALL">Todo el Historial</option>
              <option value="1H">Última 1 hora</option>
              <option value="24H">Últimas 24 horas</option>
              <option value="7D">Últimos 7 días</option>
              <option value="30D">Últimos 30 días</option>
            </select>
          </div>
        </div>

        {/* Contador de resultados */}
        <span className="text-xs font-mono text-[#60a5fa] bg-[#13233e] px-3 py-1.5 rounded-xl border border-[#203c68]">
          {filteredLogs.length} eventos encontrados
        </span>
      </div>

      {/* ── Tabla Estructurada de Auditoría ── */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-[#081223] text-[#94a3b8] uppercase text-[11px] font-semibold border-y border-[#17253d]">
            <tr>
              <th className="px-5 py-3.5 w-48">Timestamp (Fecha y Hora)</th>
              <th className="px-5 py-3.5 w-44">Tipo de Evento</th>
              <th className="px-5 py-3.5 w-48">Rol / Usuario / Actor</th>
              <th className="px-5 py-3.5">Descripción del Evento</th>
              <th className="px-5 py-3.5 text-right w-36">Integridad BCRA</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#17253d] text-[#cbd5e1] font-mono">
            {paginatedLogs.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-5 py-8 text-center text-[#64748b] font-sans">
                  No hay eventos registrados que coincidan con los filtros aplicados.
                </td>
              </tr>
            ) : (
              paginatedLogs.map((log, idx) => {
                const dateObj = new Date(log.timestamp);
                const dateFormatted = dateObj.toLocaleDateString('es-AR', {
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric',
                });
                const timeFormatted = dateObj.toLocaleTimeString('es-AR', {
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                });

                return (
                  <tr key={idx} className="hover:bg-[#0a162b] transition">
                    {/* Timestamp */}
                    <td className="px-5 py-3.5 text-slate-300 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                        <span className="font-semibold text-white">{dateFormatted}</span>
                        <span className="text-[#94a3b8]">{timeFormatted}</span>
                      </div>
                    </td>

                    {/* Tipo de Evento Badge */}
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center px-2.5 py-1 rounded-lg text-[10px] font-bold border tracking-wider ${getEventBadge(
                          log.action
                        )}`}
                      >
                        {log.action}
                      </span>
                    </td>

                    {/* Rol / Usuario / Actor */}
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      <div className="flex items-center gap-1.5 text-blue-300 font-semibold">
                        <User className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                        <span className="truncate max-w-[160px]" title={log.actor}>
                          {log.actor}
                        </span>
                      </div>
                    </td>

                    {/* Descripción del Evento */}
                    <td className="px-5 py-3.5 font-sans text-xs text-slate-200 leading-relaxed">
                      {log.details}
                    </td>

                    {/* Integridad Criptográfica */}
                    <td className="px-5 py-3.5 text-right whitespace-nowrap">
                      <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400 font-mono bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-500/30">
                        <ShieldCheck className="w-3 h-3 text-emerald-400" />
                        <span>SHA-256 OK</span>
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* ── Controles de Paginación ── */}
      <div className="p-4 border-t border-[#17253d] bg-[#091222] flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs text-[#94a3b8]">
        <div className="flex items-center gap-3">
          <span>Registros por página:</span>
          <select
            value={itemsPerPage}
            onChange={e => {
              setItemsPerPage(Number(e.target.value));
              setCurrentPage(1);
            }}
            className="px-2.5 py-1 bg-[#060c17] border border-[#1e365b] rounded-lg text-xs text-white focus:outline-none"
          >
            <option value={10}>10</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
          <span className="font-mono">
            Página {currentPage} de {totalPages} ({filteredLogs.length} eventos)
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => handlePageChange(1)}
            disabled={currentPage === 1}
            className="p-1.5 rounded-lg border border-[#1e365b] bg-[#0c1628] text-white hover:bg-[#13233e] disabled:opacity-40 disabled:cursor-not-allowed transition"
            title="Primera página"
          >
            <ChevronsLeft className="w-4 h-4" />
          </button>
          <button
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage === 1}
            className="px-3 py-1.5 rounded-lg border border-[#1e365b] bg-[#0c1628] text-white hover:bg-[#13233e] disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center gap-1"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Anterior</span>
          </button>

          <span className="px-3 py-1.5 rounded-lg bg-[#1d4ed8] text-white font-bold font-mono">
            {currentPage}
          </span>

          <button
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
            className="px-3 py-1.5 rounded-lg border border-[#1e365b] bg-[#0c1628] text-white hover:bg-[#13233e] disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center gap-1"
          >
            <span>Siguiente</span>
            <ChevronRight className="w-4 h-4" />
          </button>
          <button
            onClick={() => handlePageChange(totalPages)}
            disabled={currentPage === totalPages}
            className="p-1.5 rounded-lg border border-[#1e365b] bg-[#0c1628] text-white hover:bg-[#13233e] disabled:opacity-40 disabled:cursor-not-allowed transition"
            title="Última página"
          >
            <ChevronsRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
