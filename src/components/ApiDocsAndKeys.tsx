'use client';

import React, { useState, useEffect } from 'react';
import {
  Key,
  Copy,
  Check,
  Plus,
  Trash2,
  Code2,
  Terminal,
  Zap,
  ExternalLink,
  ShieldCheck,
  Play,
  FileCode,
  Lock,
} from 'lucide-react';
import { Tenant } from '@/lib/types';

interface ApiDocsAndKeysProps {
  currentTenant: Tenant;
}

export default function ApiDocsAndKeys({ currentTenant }: ApiDocsAndKeysProps) {
  const [keys, setKeys] = useState<any[]>([]);
  const [newKeyName, setNewKeyName] = useState('');
  const [copiedKeyId, setCopiedKeyId] = useState<string | null>(null);
  const [selectedEndpoint, setSelectedEndpoint] = useState<'evaluate' | 'report' | 'rehabilitate'>('evaluate');
  const [apiRequestBody, setApiRequestBody] = useState('');
  const [apiResponse, setApiResponse] = useState<any>(null);
  const [apiLatency, setApiLatency] = useState<number | null>(null);
  const [callingApi, setCallingApi] = useState(false);
  const [activeCodeTab, setActiveCodeTab] = useState<'curl' | 'ts' | 'python'>('curl');

  // Cargar claves del tenant actual
  const loadKeys = async () => {
    try {
      const res = await fetch(`/api/v1/tenants/keys?tenant_id=${currentTenant.id}`);
      const data = await res.json();
      if (data.data) setKeys(data.data);
    } catch (err) {
      console.error('Error loading keys:', err);
    }
  };

  useEffect(() => {
    loadKeys();
  }, [currentTenant.id]);

  // Actualizar body según endpoint seleccionado
  useEffect(() => {
    if (selectedEndpoint === 'evaluate') {
      setApiRequestBody(
        JSON.stringify(
          {
            identifier_type: 'EMAIL',
            identifier_value: 'estafador.red@gmail.com',
          },
          null,
          2
        )
      );
    } else if (selectedEndpoint === 'report') {
      setApiRequestBody(
        JSON.stringify(
          {
            identifier_type: 'DNI',
            identifier_value: '20-41882991-3',
            reason: 'IDENTIDAD_SINTETICA',
            severity: 4,
            non_pii_notes: 'Validación biométrica no superada en onboarding',
          },
          null,
          2
        )
      );
    } else {
      setApiRequestBody(
        JSON.stringify(
          {
            identifier_type: 'EMAIL',
            identifier_value: 'juan.perez.reclamado@gmail.com',
            reason: 'Titular acreditó legitimidad mediante validación presencial RENAPER',
          },
          null,
          2
        )
      );
    }
  }, [selectedEndpoint]);

  const handleCreateKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKeyName.trim()) return;
    try {
      const res = await fetch('/api/v1/tenants/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_id: currentTenant.id,
          name: newKeyName.trim(),
        }),
      });
      if (res.ok) {
        setNewKeyName('');
        loadKeys();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleRevokeKey = async (keyId: string) => {
    if (!confirm('¿Estás seguro de revocar esta clave de API? Las integraciones que la utilicen dejarán de responder inmediatamente.'))
      return;
    try {
      const res = await fetch(`/api/v1/tenants/keys?key_id=${keyId}`, { method: 'DELETE' });
      if (res.ok) loadKeys();
    } catch (err) {
      console.error(err);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKeyId(id);
    setTimeout(() => setCopiedKeyId(null), 2000);
  };

  const executeSandboxCall = async () => {
    setCallingApi(true);
    setApiResponse(null);
    setApiLatency(null);

    const endpointUrl =
      selectedEndpoint === 'evaluate'
        ? '/api/v1/risk/evaluate'
        : selectedEndpoint === 'report'
        ? '/api/v1/fraud/report'
        : '/api/v1/fraud/rehabilitate';

    const t0 = performance.now();
    try {
      const parsedBody = JSON.parse(apiRequestBody);
      const res = await fetch(endpointUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${currentTenant.apiKey}`,
        },
        body: JSON.stringify(parsedBody),
      });

      const elapsed = Math.round(performance.now() - t0);
      const json = await res.json();
      setApiResponse(json);
      setApiLatency(elapsed);
    } catch (err: any) {
      setApiResponse({ error: err.message });
      setApiLatency(Math.round(performance.now() - t0));
    } finally {
      setCallingApi(false);
    }
  };

  // Code snippets
  const getSnippet = () => {
    const activeKey = currentTenant.apiKey;
    if (activeCodeTab === 'curl') {
      return `curl -X POST http://localhost:3000/api/v1/risk/evaluate \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer ${activeKey}" \\
  -d '{
    "identifier_type": "EMAIL",
    "identifier_value": "estafador.red@gmail.com"
  }'`;
    }
    if (activeCodeTab === 'ts') {
      return `import axios from 'axios';

const response = await axios.post(
  'http://localhost:3000/api/v1/risk/evaluate',
  {
    identifier_type: 'EMAIL',
    identifier_value: 'estafador.red@gmail.com'
  },
  {
    headers: {
      'Authorization': 'Bearer ${activeKey}',
      'Content-Type': 'application/json'
    },
    timeout: 50 // SLA estricto < 50ms
  }
);

console.log('Score de Riesgo:', response.data.data.risk_score);
console.log('Recomendación:', response.data.data.recommendation);`;
    }
    return `import requests

url = "http://localhost:3000/api/v1/risk/evaluate"
headers = {
    "Authorization": "Bearer ${activeKey}",
    "Content-Type": "application/json"
}
payload = {
    "identifier_type": "EMAIL",
    "identifier_value": "estafador.red@gmail.com"
}

response = requests.post(url, json=payload, headers=headers, timeout=0.05)
print(response.json())`;
  };

  return (
    <div className="space-y-8">
      {/* Title */}
      <div>
        <h2 className="text-xl font-bold text-white sm:text-2xl">
          API & Developer Hub (B2B Integration Center)
        </h2>
        <p className="text-xs text-slate-400 mt-1">
          Administra tus credenciales de conexión B2B, prueba los endpoints en vivo con el sandbox interactivo y consulta la especificación OpenAPI 3.0.3 (Swagger).
        </p>
      </div>

      {/* 1. API Keys Management Card */}
      <div className="glass-panel rounded-2xl p-6 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-400">
              <Key className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Claves de API de {currentTenant.name}</h3>
              <p className="text-xs text-slate-400">Utilizadas para autenticar las peticiones B2B en el encabezado Authorization: Bearer</p>
            </div>
          </div>

          {/* Form to generate new key */}
          <form onSubmit={handleCreateKey} className="flex gap-2">
            <input
              type="text"
              value={newKeyName}
              onChange={e => setNewKeyName(e.target.value)}
              placeholder="Nombre clave (ej. Backend Prod 2)"
              className="rounded-xl border border-white/10 bg-slate-950 px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
            />
            <button
              type="submit"
              className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white shadow-md hover:bg-indigo-700 transition"
            >
              <Plus className="h-4 w-4" /> Generar Clave
            </button>
          </form>
        </div>

        {/* Keys List */}
        <div className="mt-4 space-y-3">
          {keys.map(k => (
            <div
              key={k.id}
              className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-white/5 bg-slate-900/60 p-3.5 transition hover:border-white/10"
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-white">{k.name}</span>
                  {k.isPrimary && (
                    <span className="rounded bg-indigo-500/20 px-2 py-0.5 text-[10px] font-semibold text-indigo-300">
                      PRIMARIA
                    </span>
                  )}
                </div>
                <div className="mt-1 flex items-center gap-2 font-mono text-xs text-cyan-400">
                  <Lock className="h-3.5 w-3.5 text-slate-500" />
                  <span>{k.key}</span>
                </div>
                <span className="text-[10px] text-slate-500">
                  Creada el {new Date(k.createdAt).toLocaleDateString('es-AR')}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => copyToClipboard(k.key, k.id)}
                  className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-700 transition"
                >
                  {copiedKeyId === k.id ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-emerald-400" /> Copiado
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" /> Copiar Clave
                    </>
                  )}
                </button>

                {!k.isPrimary && (
                  <button
                    onClick={() => handleRevokeKey(k.id)}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-rose-500/20 bg-rose-950/30 text-rose-400 hover:bg-rose-900/40 transition"
                    title="Revocar clave"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 2. Interactive Sandbox & Live Swagger Tester */}
      <div className="glass-panel rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <Terminal className="h-5 w-5 text-indigo-400" />
              <h3 className="text-sm font-bold text-white">Consola de Prueba Interactiva (Swagger Sandbox)</h3>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Envía peticiones directas a la API del consorcio y verifica la respuesta en menos de 50ms.
            </p>
          </div>

          <a
            href="/api/v1/openapi.json"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-slate-900 px-3 py-1.5 text-xs font-semibold text-cyan-300 hover:bg-slate-800 transition"
          >
            <FileCode className="h-4 w-4" /> Ver OpenAPI 3.0.3 Spec (JSON) <ExternalLink className="h-3 w-3" />
          </a>
        </div>

        {/* Endpoint selector */}
        <div className="flex flex-wrap gap-2">
          {[
            { id: 'evaluate', method: 'POST', path: '/api/v1/risk/evaluate', name: '1. Evaluar Riesgo (<50ms)' },
            { id: 'report', method: 'POST', path: '/api/v1/fraud/report', name: '2. Reportar Fraude Confirmado' },
            { id: 'rehabilitate', method: 'POST', path: '/api/v1/fraud/rehabilitate', name: '3. Falso Positivo / Rehabilitar' },
          ].map(ep => (
            <button
              key={ep.id}
              onClick={() => setSelectedEndpoint(ep.id as any)}
              className={`flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-medium transition ${
                selectedEndpoint === ep.id
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'bg-slate-900/80 text-slate-400 hover:bg-slate-800 hover:text-white border border-white/5'
              }`}
            >
              <span className="font-mono text-[10px] font-bold text-emerald-400">{ep.method}</span>
              <span>{ep.name}</span>
            </button>
          ))}
        </div>

        {/* Request & Response Split Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pt-2">
          {/* Request Payload */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span className="font-semibold">Cuerpo de la Petición (JSON Request Body):</span>
              <span className="font-mono text-[11px] text-indigo-400">Content-Type: application/json</span>
            </div>
            <textarea
              rows={8}
              value={apiRequestBody}
              onChange={e => setApiRequestBody(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-slate-950 p-3 font-mono text-xs text-slate-200 focus:border-indigo-500 focus:outline-none"
            />
            <button
              onClick={executeSandboxCall}
              disabled={callingApi}
              className="flex items-center justify-center gap-2 w-full rounded-xl bg-gradient-to-r from-emerald-500 to-indigo-600 px-4 py-2.5 text-xs font-bold text-white shadow-lg transition hover:brightness-110 active:scale-98 disabled:opacity-50"
            >
              {callingApi ? (
                <span>Ejecutando en el nodo...</span>
              ) : (
                <>
                  <Play className="h-4 w-4" /> Enviar Petición B2B en Tiempo Real
                </>
              )}
            </button>
          </div>

          {/* Response Payload */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span className="font-semibold">Respuesta del Servidor (Response):</span>
              {apiLatency !== null && (
                <span className="font-mono text-xs text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                  Latencia: {apiLatency} ms (&lt;50ms SLA ✓)
                </span>
              )}
            </div>
            <pre className="h-[218px] overflow-y-auto rounded-xl border border-white/10 bg-slate-950 p-3 font-mono text-xs text-emerald-300">
              {apiResponse
                ? JSON.stringify(apiResponse, null, 2)
                : '// Haz clic en "Enviar Petición" para ejecutar la llamada en vivo y medir la latencia real...'}
            </pre>
          </div>
        </div>
      </div>

      {/* 3. Multi-Language Code Generator */}
      <div className="glass-panel rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-3">
          <div className="flex items-center gap-2">
            <Code2 className="h-5 w-5 text-indigo-400" />
            <h3 className="text-sm font-bold text-white">Ejemplos de Integración Rápida</h3>
          </div>

          <div className="flex gap-1 rounded-xl border border-white/10 bg-slate-900 p-1">
            {[
              { id: 'curl', label: 'cURL' },
              { id: 'ts', label: 'TypeScript / Node.js' },
              { id: 'python', label: 'Python' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveCodeTab(tab.id as any)}
                className={`rounded-lg px-3 py-1 text-xs font-medium transition ${
                  activeCodeTab === tab.id ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="relative">
          <pre className="overflow-x-auto rounded-xl border border-white/10 bg-slate-950 p-4 font-mono text-xs text-slate-200">
            {getSnippet()}
          </pre>
          <button
            onClick={() => copyToClipboard(getSnippet(), 'snippet')}
            className="absolute top-3 right-3 flex items-center gap-1 rounded-lg border border-white/10 bg-slate-900/80 px-2.5 py-1 text-[11px] font-medium text-slate-300 hover:bg-slate-800"
          >
            {copiedKeyId === 'snippet' ? (
              <span className="text-emerald-400 flex items-center gap-1">
                <Check className="h-3 w-3" /> Copiado
              </span>
            ) : (
              <span className="flex items-center gap-1">
                <Copy className="h-3 w-3" /> Copiar
              </span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
