'use client';

import React from 'react';
import { Scale, ShieldCheck, FileText, CheckCircle2, Lock, AlertOctagon } from 'lucide-react';

export default function LegalSection() {
  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-white sm:text-2xl">
          Términos de Adhesión & Marco Legal del Consorcio (Argentina)
        </h2>
        <p className="text-xs text-slate-400 mt-1">
          Acuerdo Interinstitucional de Threat Intelligence y Prevención Comunitaria de Fraudes bajo la Ley 25.326.
        </p>
      </div>

      <div className="glass-panel rounded-2xl p-6 sm:p-8 space-y-6 shadow-2xl text-xs text-slate-300 leading-relaxed">
        {/* Section 1 */}
        <div className="space-y-2">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Scale className="h-4 w-4 text-indigo-400" />
            1. Cumplimiento de la Ley 25.326 de Protección de Datos Personales
          </h3>
          <p>
            El presente Consorcio opera bajo una estricta arquitectura de <strong>Privacidad Ciega (Zero-Knowledge)</strong>. Conforme a las directrices de la Agencia de Acceso a la Información Pública (AAIP) y el marco normativo de la República Argentina, ninguna entidad financiera, banco o billetera virtual transfiere ni almacena datos personales identificables (PII) en texto claro.
          </p>
          <p>
            Todo identificador (correo electrónico, DNI, CUIL o teléfono) es normalizado y sometido de forma irreversible a un algoritmo de función resumen criptográfica <strong>SHA-256 enriquecido con una Salt global secreta</strong>. Dicho hash resultante constituye un identificador ciego que no permite la reconstrucción del dato original ni la ingeniería inversa del titular.
          </p>
        </div>

        <hr className="border-white/10" />

        {/* Section 2 */}
        <div className="space-y-2">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Lock className="h-4 w-4 text-cyan-400" />
            2. Principio de No Revelación y Secreto Bancario (Ley 21.526)
          </h3>
          <p>
            Las consultas comunitarias de riesgo se resuelven de forma descentralizada y agregada. El sistema informa únicamente el <strong>nivel de riesgo calculado (0 a 100)</strong> y la <strong>cantidad de entidades independientes</strong> en las que el identificador coincide, sin revelar jamás el nombre de la institución que originó el reporte ni detalles comerciales de la relación con el usuario.
          </p>
          <p>
            Queda prohibido a los miembros del consorcio intentar correlacionar hashes para fines publicitarios, de scoring crediticio tradicional o prácticas anticompetitivas. El único fin autorizado es la detección y mitigación de ciberdelitos y fraudes transaccionales.
          </p>
        </div>

        <hr className="border-white/10" />

        {/* Section 3 */}
        <div className="space-y-2">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-emerald-400" />
            3. Garantía de Rectificación de Falsos Positivos y Habeas Data
          </h3>
          <p>
            En estricto cumplimiento del derecho de <em>Habeas Data</em> consagrado en el artículo 43 de la Constitución Nacional y el artículo 14 de la Ley 25.326:
          </p>
          <ul className="list-disc pl-5 space-y-1.5 text-slate-300">
            <li>
              Cualquier entidad que constate un error material, una recuperación legítima de cuenta o una verificación de identidad biométrica concluyente (ej. RENAPER) tiene la obligación de invocar de inmediato el <strong>Endpoint de Rehabilitación</strong>.
            </li>
            <li>
              La reducción del puntaje de riesgo tiene efecto inmediato en la red en menos de <strong>50 milisegundos</strong> y limpia el caché en memoria para garantizar que el usuario no sufra perjuicios operativos en otras entidades del ecosistema.
            </li>
            <li>
              Todo reporte de fraude tiene un decaimiento temporal automático si no registra nuevas reiteraciones en un lapso de 180 días corridos.
            </li>
          </ul>
        </div>

        <hr className="border-white/10" />

        {/* Section 4 */}
        <div className="space-y-2">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <AlertOctagon className="h-4 w-4 text-amber-400" />
            4. SLA y Continuidad Operacional de Alta Velocidad
          </h3>
          <p>
            El consorcio garantiza a cada participante una latencia de respuesta P99 inferior a <strong>50 milisegundos</strong> en los puntos de terminación de API para no demorar los flujos transaccionales de onboarding o transferencias inmediatas (3.0 / Transferencias 24x7 BCRA).
          </p>
        </div>

        <div className="rounded-xl border border-indigo-500/20 bg-indigo-950/20 p-4 text-[11px] text-indigo-300">
          <strong>Constancia de Adhesión Digital:</strong> La utilización de las credenciales de API por parte de un miembro participante implica la aceptación plena e incondicional de los presentes Términos de Gobernanza y Confidencialidad Criptográfica.
        </div>
      </div>
    </div>
  );
}
