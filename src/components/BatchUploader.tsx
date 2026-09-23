'use client';

import React, { useState } from 'react';
import {
  UploadCloud,
  FileText,
  Download,
  CheckCircle,
  AlertCircle,
  ShieldAlert,
  Zap,
  Play,
  RotateCcw,
  Search,
  Filter,
} from 'lucide-react';
import { IdentifierType, FraudTypology, UserRole } from '@/lib/types';

interface BatchUploaderProps {
  userRole?: UserRole;
}

export default function BatchUploader({ userRole = 'ANALYST_L2' }: BatchUploaderProps) {
  const [mode, setMode] = useState<'EVALUATE' | 'REPORT'>('EVALUATE');
  const [fileContent, setFileContent] = useState<string>('');
  const [fileName, setFileName] = useState<string>('');
  const [parsedItems, setParsedItems] = useState<any[]>([]);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<any[]>([]);
  const [summaryStats, setSummaryStats] = useState<any>(null);
  const [filterRisk, setFilterRisk] = useState<'ALL' | 'ALTO' | 'MEDIO' | 'BAJO'>('ALL');

  // Descarga de plantillas CSV
  const downloadSampleTemplate = (type: 'EVALUATE' | 'REPORT') => {
    let csv = '';
    let filename = '';

    if (type === 'EVALUATE') {
      csv = `identifier_type,identifier_value\nEMAIL,estafador.red@gmail.com\nDNI,20-41882991-3\nPHONE,+5491140558891\nEMAIL,compras.sospechosas@hotmail.com\nEMAIL,juan.perez.reclamado@gmail.com\nEMAIL,usuario.verificado@empresa.com.ar\nDNI,38912441\nEMAIL,fraude.corporativo@test.com\n`;
      filename = 'plantilla_evaluacion_riesgo_consorcio.csv';
    } else {
      csv = `identifier_type,identifier_value,reason,severity,notes\nEMAIL,alerta.nueva.mula@fraude.org,MULA_DE_DINERO,5,Transferencias cruzadas en menos de 2 minutos\nDNI,27-39128374-1,ROBO_DE_CUENTA,4,Acceso desde VPN foránea y cambio de alias\nPHONE,+5491122334455,PHISHING,3,Envío masivo de SMS engañosos con enlace falso\n`;
      filename = 'plantilla_carga_fraudes_consorcio.csv';
    }

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Cargar archivo CSV o JSON
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    const reader = new FileReader();

    reader.onload = event => {
      const text = event.target?.result as string;
      setFileContent(text);
      parseFile(text, file.name);
    };

    reader.readAsText(file);
  };

  // Parsear texto CSV o JSON
  const parseFile = (text: string, name: string) => {
    try {
      if (name.endsWith('.json')) {
        const json = JSON.parse(text);
        const list = Array.isArray(json) ? json : json.items || [];
        setParsedItems(list);
        return;
      }

      // Parser CSV sencillo
      const lines = text.split(/\r?\n/).filter(line => line.trim() !== '');
      if (lines.length < 2) {
        setParsedItems([]);
        return;
      }

      const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
      const items = lines.slice(1).map((line, idx) => {
        const values = line.split(',').map(v => v.trim());
        const item: any = { id: `row-${idx + 1}` };
        headers.forEach((h, i) => {
          item[h] = values[i] || '';
        });
        return item;
      });

      setParsedItems(items);
    } catch (err) {
      console.error('Error parsing file:', err);
    }
  };

  // Cargar ejemplo directo sin archivo
  const loadDemoData = () => {
    if (mode === 'EVALUATE') {
      const sample = [
        { id: '1', identifier_type: 'EMAIL', identifier_value: 'estafador.red@gmail.com' },
        { id: '2', identifier_type: 'DNI', identifier_value: '20-41882991-3' },
        { id: '3', identifier_type: 'PHONE', identifier_value: '+54 9 11 4055-8891' },
        { id: '4', identifier_type: 'EMAIL', identifier_value: 'compras.sospechosas@hotmail.com' },
        { id: '5', identifier_type: 'EMAIL', identifier_value: 'juan.perez.reclamado@gmail.com' },
        { id: '6', identifier_type: 'EMAIL', identifier_value: 'usuario.verificado@empresa.com.ar' },
        { id: '7', identifier_type: 'DNI', identifier_value: '35123456' },
      ];
      setParsedItems(sample);
      setFileName('demo_evaluacion_lote.csv');
    } else {
      const sample = [
        {
          id: '1',
          identifier_type: 'EMAIL',
          identifier_value: 'nuevo.reporte.mula@test.ar',
          reason: 'MULA_DE_DINERO',
          severity: 5,
        },
        {
          id: '2',
          identifier_type: 'DNI',
          identifier_value: '20-38192837-9',
          reason: 'ROBO_DE_CUENTA',
          severity: 4,
        },
        {
          id: '3',
          identifier_type: 'PHONE',
          identifier_value: '+54 9 11 9876-5432',
          reason: 'PHISHING',
          severity: 3,
        },
      ];
      setParsedItems(sample);
      setFileName('demo_reporte_fraudes.csv');
    }
  };

  // Ejecutar proceso masivo
  const executeBatch = async () => {
    if (userRole === 'ANALYST_L1') {
      alert('Operación Bloqueada: El rol Analista L1 no tiene permisos para ejecutar consultas masivas por lotes. Por favor seleccione Analista L2 o Admin Tenant en la barra de autenticación.');
      return;
    }
    if (parsedItems.length === 0) return;
    setProcessing(true);
    setProgress(10);

    const endpoint = mode === 'EVALUATE' ? '/api/v1/batch/evaluate' : '/api/v1/batch/report';

    try {
      setProgress(40);
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: parsedItems }),
      });

      setProgress(85);
      const data = await res.json();
      setProgress(100);

      if (res.ok) {
        setResults(data.data || []);
        setSummaryStats({
          total: data.total_processed || data.total_submitted,
          successful: data.successful,
          failed: data.failed,
          elapsedMs: data.execution_time_ms,
          avgPerItem: data.average_per_item_ms,
        });
      }
    } catch (err) {
      console.error('Error executing batch:', err);
    } finally {
      setProcessing(false);
    }
  };

  // Exportar resultados en CSV
  const exportResultsCSV = () => {
    if (results.length === 0) return;

    let csvContent = '';
    if (mode === 'EVALUATE') {
      csvContent = 'index,identifier_type,blind_hash,risk_score,risk_level,recommendation,distinct_institutions\n';
      results.forEach(r => {
        csvContent += `${r.index},${r.identifier_type},${r.blind_hash || ''},${r.risk_score ?? ''},${r.risk_level || ''},${r.recommendation || ''},${r.distinct_institutions ?? ''}\n`;
      });
    } else {
      csvContent = 'index,blind_hash,event_id,updated_score,distinct_institutions,status\n';
      results.forEach(r => {
        csvContent += `${r.index},${r.blind_hash || ''},${r.event_id || ''},${r.updated_score ?? ''},${r.distinct_institutions ?? ''},${r.status}\n`;
      });
    }

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Resultados_Procesamiento_${mode}_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Filtrado de resultados
  const filteredResults = results.filter(r => {
    if (filterRisk === 'ALL') return true;
    return r.risk_level === filterRisk;
  });

  return (
    <div className="space-y-6">
      {/* Title & Mode Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white sm:text-2xl">
            Procesamiento Masivo por Lotes (Batch Engine)
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Permite procesar archivos CSV o JSON con cientos de identificadores en paralelo con Hashing Ciego automático.
          </p>
        </div>

        {/* Dual Mode Selector */}
        <div className="flex rounded-xl border border-white/10 bg-slate-900/80 p-1">
          <button
            onClick={() => {
              setMode('EVALUATE');
              setParsedItems([]);
              setResults([]);
            }}
            className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition ${
              mode === 'EVALUATE'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            🔍 Evaluación Masiva de Riesgo
          </button>
          <button
            onClick={() => {
              setMode('REPORT');
              setParsedItems([]);
              setResults([]);
            }}
            className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition ${
              mode === 'REPORT'
                ? 'bg-rose-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            🚨 Ingesta Masiva de Fraudes
          </button>
        </div>
      </div>

      {/* RBAC Warning for Analyst L1 */}
      {userRole === 'ANALYST_L1' && (
        <div className="rounded-2xl border border-amber-500/40 bg-amber-950/30 p-4 text-xs text-amber-200 shadow-lg">
          <div className="flex items-start gap-3">
            <span className="text-xl">🔒</span>
            <div>
              <strong className="block text-sm font-bold text-amber-300">
                Permiso Restringido a Analista L2 / Admin Tenant
              </strong>
              <p className="mt-1 leading-relaxed text-amber-200/90">
                Tu rol actual de sesión es <strong>Analista L1</strong> (acceso restringido únicamente a consultas manuales e individuales). Para cargar archivos por lotes, procesar CSVs masivos o descargar reportes consolidados, cambia de rol a <strong>Analista L2</strong> o <strong>Admin Tenant</strong> en la barra superior de autenticación.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Upload Zone */}
      <div className="glass-panel rounded-2xl p-6 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <UploadCloud className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">
                {mode === 'EVALUATE'
                  ? 'Cargar Lote para Verificación Comunitaria'
                  : 'Cargar Lote de Incidentes Confirmados'}
              </h3>
              <p className="text-xs text-slate-400">Archivos soportados: CSV con encabezados o JSON</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => downloadSampleTemplate(mode)}
              className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800 transition"
            >
              <Download className="h-4 w-4 text-cyan-400" /> Descargar Plantilla CSV
            </button>
            <button
              onClick={loadDemoData}
              className="flex items-center gap-1.5 rounded-xl border border-indigo-500/30 bg-indigo-950/40 px-3 py-2 text-xs font-semibold text-indigo-300 hover:bg-indigo-900/50 transition"
            >
              <Zap className="h-4 w-4" /> Cargar Lote Demo (7 Registros)
            </button>
          </div>
        </div>

        {/* Drag & drop box */}
        <div className="mt-5">
          <label className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-white/15 bg-slate-950/40 p-8 text-center cursor-pointer transition hover:border-indigo-500/50 hover:bg-slate-950/60">
            <FileText className="h-10 w-10 text-indigo-400/80 mb-2" />
            <span className="text-xs font-semibold text-white">
              {fileName ? `Archivo cargado: ${fileName}` : 'Haz clic para seleccionar o arrastra tu archivo CSV aquí'}
            </span>
            <span className="mt-1 text-[11px] text-slate-500">
              Los datos se anonimizan con SHA-256 antes de salir de tu infraestructura
            </span>
            <input
              type="file"
              accept=".csv,.json"
              onChange={handleFileUpload}
              className="hidden"
            />
          </label>
        </div>

        {/* Preview of parsed items & Action Button */}
        {parsedItems.length > 0 && (
          <div className="mt-5 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-300">
                Vista previa: <strong className="text-indigo-400">{parsedItems.length}</strong> registros listos para procesar
              </span>
              <button
                onClick={executeBatch}
                disabled={processing}
                className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-indigo-600 px-5 py-2.5 text-xs font-bold text-white shadow-lg shadow-emerald-500/20 transition hover:brightness-110 active:scale-95 disabled:opacity-50"
              >
                {processing ? (
                  <>
                    <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Procesando Lote...
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4" /> Ejecutar Lote en Tiempo Real
                  </>
                )}
              </button>
            </div>

            {/* Progress Bar */}
            {processing && (
              <div className="h-2 w-full rounded-full bg-slate-800 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-indigo-500 to-emerald-400 transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            )}

            {/* Preview table (first 5 rows) */}
            <div className="overflow-x-auto rounded-xl border border-white/10 bg-slate-900/60">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950/80 text-[11px] uppercase text-slate-400">
                  <tr>
                    <th className="px-4 py-2.5">#</th>
                    <th className="px-4 py-2.5">Tipo</th>
                    <th className="px-4 py-2.5">Identificador</th>
                    {mode === 'REPORT' && (
                      <>
                        <th className="px-4 py-2.5">Motivo</th>
                        <th className="px-4 py-2.5">Severidad</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-slate-300">
                  {parsedItems.slice(0, 5).map((row, idx) => (
                    <tr key={idx} className="hover:bg-white/5">
                      <td className="px-4 py-2 text-slate-500">{idx + 1}</td>
                      <td className="px-4 py-2 font-mono text-cyan-400">
                        {row.identifier_type || row.type || 'EMAIL'}
                      </td>
                      <td className="px-4 py-2 font-mono truncate max-w-xs">
                        {row.identifier_value || row.value || '—'}
                      </td>
                      {mode === 'REPORT' && (
                        <>
                          <td className="px-4 py-2 text-amber-300">{row.reason || 'OPERACION_SOSPECHOSA'}</td>
                          <td className="px-4 py-2">{row.severity || 3}/5</td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
              {parsedItems.length > 5 && (
                <div className="p-2 text-center text-[11px] text-slate-500 bg-slate-950/40 border-t border-white/5">
                  y {parsedItems.length - 5} registros más...
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Results Section */}
      {results.length > 0 && (
        <div className="glass-panel rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-emerald-400" />
                <h3 className="text-sm font-bold text-white">Resultados del Procesamiento Masivo</h3>
              </div>
              {summaryStats && (
                <p className="text-xs text-slate-400 mt-0.5">
                  Procesados: <strong className="text-white">{summaryStats.total}</strong> en{' '}
                  <strong className="text-cyan-400 font-mono">{summaryStats.elapsedMs} ms</strong> (Promedio:{' '}
                  <span className="font-mono text-emerald-400">{summaryStats.avgPerItem} ms/ítem</span>)
                </p>
              )}
            </div>

            <div className="flex items-center gap-3">
              {/* Filter */}
              {mode === 'EVALUATE' && (
                <div className="flex items-center gap-1 rounded-xl border border-white/10 bg-slate-900 p-1 text-xs">
                  {(['ALL', 'ALTO', 'MEDIO', 'BAJO'] as const).map(f => (
                    <button
                      key={f}
                      onClick={() => setFilterRisk(f)}
                      className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold transition ${
                        filterRisk === f
                          ? 'bg-indigo-600 text-white'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      {f === 'ALL' ? 'Todos' : f}
                    </button>
                  ))}
                </div>
              )}

              <button
                onClick={exportResultsCSV}
                className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-indigo-500 to-indigo-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-lg hover:brightness-110"
              >
                <Download className="h-3.5 w-3.5" /> Exportar Resultados CSV
              </button>
            </div>
          </div>

          {/* Results Table */}
          <div className="overflow-x-auto rounded-xl border border-white/10 bg-slate-950/60 max-h-96">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-slate-900 text-[11px] uppercase text-slate-400 border-b border-white/10">
                <tr>
                  <th className="px-4 py-3">#</th>
                  <th className="px-4 py-3">Blind Hash (SHA-256)</th>
                  {mode === 'EVALUATE' ? (
                    <>
                      <th className="px-4 py-3">Score</th>
                      <th className="px-4 py-3">Nivel de Riesgo</th>
                      <th className="px-4 py-3">Recomendación</th>
                      <th className="px-4 py-3">Bancos Coincidentes</th>
                    </>
                  ) : (
                    <>
                      <th className="px-4 py-3">ID Evento</th>
                      <th className="px-4 py-3">Nuevo Score</th>
                      <th className="px-4 py-3">Entidades</th>
                      <th className="px-4 py-3">Estado</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-slate-300">
                {filteredResults.map((r, idx) => (
                  <tr key={idx} className="hover:bg-white/5">
                    <td className="px-4 py-2.5 text-slate-500">{r.index + 1}</td>
                    <td className="px-4 py-2.5 font-mono text-[11px] text-slate-400 truncate max-w-xs">
                      {r.blind_hash ? `${r.blind_hash.slice(0, 16)}...${r.blind_hash.slice(-8)}` : '—'}
                    </td>
                    {mode === 'EVALUATE' ? (
                      <>
                        <td className="px-4 py-2.5 font-bold">
                          <span
                            className={
                              r.risk_score >= 75
                                ? 'text-rose-400'
                                : r.risk_score >= 35
                                ? 'text-amber-400'
                                : 'text-emerald-400'
                            }
                          >
                            {r.risk_score}
                          </span>
                        </td>
                        <td className="px-4 py-2.5">
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-bold border ${
                              r.risk_level === 'ALTO'
                                ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                                : r.risk_level === 'MEDIO'
                                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                                : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                            }`}
                          >
                            {r.risk_level}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 font-semibold text-white">
                          {r.recommendation}
                        </td>
                        <td className="px-4 py-2.5 text-slate-400 font-mono">
                          {r.distinct_institutions || 0} entidades
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="px-4 py-2.5 font-mono text-cyan-400">{r.event_id}</td>
                        <td className="px-4 py-2.5 font-bold text-rose-400">{r.updated_score}</td>
                        <td className="px-4 py-2.5 font-mono">{r.distinct_institutions}</td>
                        <td className="px-4 py-2.5">
                          <span className="rounded bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-400 font-bold border border-emerald-500/20">
                            REGISTRADO
                          </span>
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
