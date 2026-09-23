'use client';

import React, { useState, useEffect } from 'react';
import { Network, Smartphone, Server, ShieldAlert, Cpu, ZoomIn, Eye, RefreshCw } from 'lucide-react';
import { GraphNode, GraphEdge, DeviceFingerprintHash } from '@/lib/types';

export default function GraphAnalytics() {
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [edges, setEdges] = useState<GraphEdge[]>([]);
  const [fingerprints, setFingerprints] = useState<DeviceFingerprintHash[]>([]);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);

  useEffect(() => {
    fetch('/api/v1/graph')
      .then(r => r.json())
      .then(data => {
        if (data.data) {
          setNodes(data.data.graph.nodes);
          setEdges(data.data.graph.edges);
          setFingerprints(data.data.fingerprints);
          setSelectedNode(data.data.graph.nodes[0] || null);
        }
      });
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-white sm:text-2xl">
            Visualizador de Grafos de Fraude & Detector de Cuentas Mula
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Mapeo de conexiones invisibles entre identificadores hasheados, huellas de hardware (Device Fingerprint) y subredes anónimas.
          </p>
        </div>

        <span className="rounded-xl border border-indigo-500/30 bg-indigo-950/30 px-3 py-1.5 text-xs text-indigo-300 font-mono flex items-center gap-1.5">
          <Network className="h-4 w-4" /> Algoritmo de Detección de Redes Estructuradas Activo
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Interactive SVG Node Network */}
        <div className="glass-panel rounded-2xl p-6 lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between border-b border-white/10 pb-3 text-xs">
            <span className="font-semibold text-white">Topología de Relaciones del Caso (Red Sindicada)</span>
            <span className="text-slate-400">Haz clic en cualquier nodo para inspeccionar</span>
          </div>

          {/* SVG Visual Canvas */}
          <div className="relative h-96 w-full rounded-xl border border-white/5 bg-black/60 overflow-hidden flex items-center justify-center p-4">
            <svg className="w-full h-full" viewBox="0 0 700 360">
              <defs>
                <marker id="arrow" viewBox="0 0 10 10" refX="15" refY="5" markerWidth="6" markerHeight="6" orient="auto">
                  <path d="M 0 0 L 10 5 L 0 10 z" fill="#64748b" />
                </marker>
              </defs>

              {/* Connecting Lines */}
              <line x1="200" y1="180" x2="380" y2="80" stroke="#f43f5e" strokeWidth="2" strokeDasharray="4" />
              <line x1="200" y1="180" x2="380" y2="180" stroke="#f43f5e" strokeWidth="2" />
              <line x1="200" y1="180" x2="380" y2="280" stroke="#f43f5e" strokeWidth="2" strokeDasharray="4" />
              <line x1="200" y1="180" x2="100" y2="80" stroke="#818cf8" strokeWidth="2" />
              <line x1="380" y1="180" x2="550" y2="180" stroke="#f43f5e" strokeWidth="2" />
              <line x1="100" y1="80" x2="100" y2="280" stroke="#06b6d4" strokeWidth="2" />

              {/* Center Target Node */}
              <g
                onClick={() => setSelectedNode(nodes[0])}
                className="cursor-pointer transition hover:opacity-80"
                transform="translate(200, 180)"
              >
                <circle r="36" fill="#1e1b4b" stroke="#f43f5e" strokeWidth="3" />
                <circle r="44" fill="none" stroke="#f43f5e" strokeWidth="1" strokeDasharray="3" className="animate-spin" />
                <text textAnchor="middle" dy="4" fill="#ffffff" fontSize="10" fontWeight="bold">DNI Investigado</text>
                <text textAnchor="middle" dy="16" fill="#f43f5e" fontSize="9" fontWeight="bold">Score 96</text>
              </g>

              {/* Mule 1 */}
              <g
                onClick={() => setSelectedNode(nodes[1])}
                className="cursor-pointer transition hover:opacity-80"
                transform="translate(380, 80)"
              >
                <circle r="26" fill="#18181b" stroke="#fb7185" strokeWidth="2" />
                <text textAnchor="middle" dy="3" fill="#ffffff" fontSize="9">Mula #1</text>
                <text textAnchor="middle" dy="14" fill="#fb7185" fontSize="8">CVU Galicia</text>
              </g>

              {/* Mule 2 */}
              <g
                onClick={() => setSelectedNode(nodes[2])}
                className="cursor-pointer transition hover:opacity-80"
                transform="translate(380, 180)"
              >
                <circle r="28" fill="#18181b" stroke="#f43f5e" strokeWidth="2" />
                <text textAnchor="middle" dy="3" fill="#ffffff" fontSize="9">Mula #2</text>
                <text textAnchor="middle" dy="14" fill="#f43f5e" fontSize="8">CVU MP</text>
              </g>

              {/* Mule 3 (Triangulación Cripto) */}
              <g
                onClick={() => setSelectedNode(nodes[3])}
                className="cursor-pointer transition hover:opacity-80"
                transform="translate(550, 180)"
              >
                <circle r="28" fill="#18181b" stroke="#f59e0b" strokeWidth="2" />
                <text textAnchor="middle" dy="3" fill="#ffffff" fontSize="9">Mula #3</text>
                <text textAnchor="middle" dy="14" fill="#f59e0b" fontSize="8">CVU Lemon</text>
              </g>

              {/* Device Farm */}
              <g
                onClick={() => setSelectedNode(nodes[4])}
                className="cursor-pointer transition hover:opacity-80"
                transform="translate(100, 80)"
              >
                <rect x="-30" y="-18" width="60" height="36" rx="8" fill="#0f172a" stroke="#818cf8" strokeWidth="2" />
                <text textAnchor="middle" dy="4" fill="#818cf8" fontSize="8" fontWeight="bold">Device Farm</text>
              </g>

              {/* IP VPN */}
              <g
                onClick={() => setSelectedNode(nodes[5])}
                className="cursor-pointer transition hover:opacity-80"
                transform="translate(100, 280)"
              >
                <rect x="-35" y="-18" width="70" height="36" rx="8" fill="#0f172a" stroke="#06b6d4" strokeWidth="2" />
                <text textAnchor="middle" dy="4" fill="#06b6d4" fontSize="8" fontWeight="bold">VPN Exit Node</text>
              </g>
            </svg>
          </div>

          <div className="flex flex-wrap items-center justify-between text-[11px] text-slate-400 pt-1">
            <span>● Nodos Rojos: Cuentas Mula Confirmadas</span>
            <span>● Nodos Azules: Huella de Hardware (Device Fingerprint)</span>
            <span>● Líneas Punteadas: Triangulación Recurrente</span>
          </div>
        </div>

        {/* Selected Node Details & Device Fingerprinting Analysis */}
        <div className="space-y-4">
          {selectedNode && (
            <div className="glass-panel rounded-2xl p-5 space-y-3">
              <div className="flex items-center justify-between border-b border-white/10 pb-2">
                <span className="text-xs font-bold text-white">Detalle Forense del Nodo</span>
                <span className="text-xs font-mono text-rose-400 font-bold">Riesgo: {selectedNode.riskScore}/100</span>
              </div>
              <div className="text-xs font-semibold text-white">{selectedNode.label}</div>
              <div className="text-[11px] text-slate-400">
                Tipo: <strong className="text-cyan-400 font-mono">{selectedNode.type}</strong>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Este nodo presenta una correlación directa con múltiples aperturas concurrentes desde el mismo hardware ID en menos de 20 minutos.
              </p>
            </div>
          )}

          {/* Device Fingerprinting Hashes */}
          <div className="glass-panel rounded-2xl p-5 space-y-3">
            <div className="flex items-center gap-2 border-b border-white/10 pb-2">
              <Cpu className="h-4 w-4 text-[var(--accent-primary)]" />
              <h3 className="text-xs font-bold text-white">Análisis Forense de Dispositivos</h3>
            </div>

            <div className="space-y-3">
              {fingerprints.map((fp, idx) => (
                <div
                  key={idx}
                  className={`rounded-xl border p-3 text-xs font-mono space-y-1 ${
                    fp.isDeviceFarmSuspect
                      ? 'border-rose-500/30 bg-rose-950/20'
                      : 'border-emerald-500/20 bg-emerald-950/10'
                  }`}
                >
                  <div className="flex items-center justify-between font-sans">
                    <span className="text-[11px] font-bold text-white truncate max-w-[140px]">{fp.hardwareHash}</span>
                    <span
                      className={`rounded px-1.5 py-0.5 text-[9px] font-bold ${
                        fp.isDeviceFarmSuspect
                          ? 'bg-rose-500/20 text-rose-400'
                          : 'bg-emerald-500/20 text-emerald-400'
                      }`}
                    >
                      {fp.isDeviceFarmSuspect ? 'GRANJA DE DISPOSITIVOS' : 'DISPOSITIVO FÍSICO'}
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-400">Subred: {fp.ipSubnet}</div>
                  <div className="text-[10px] text-slate-400">Pantalla: {fp.screenSpec}</div>
                  <div className="text-[10px] text-cyan-400">GPU: {fp.gpuSignature}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
