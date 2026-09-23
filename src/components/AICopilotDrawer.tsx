'use client';

import React, { useState } from 'react';
import { Sparkles, MessageSquare, Bot, X, Send, FileText, ChevronRight, CheckCircle2 } from 'lucide-react';

interface AICopilotDrawerProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export default function AICopilotDrawer({ isOpen: controlledIsOpen, onClose }: AICopilotDrawerProps = {}) {
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const isOpen = controlledIsOpen !== undefined ? controlledIsOpen : internalIsOpen;
  const handleClose = () => {
    if (onClose) onClose();
    else setInternalIsOpen(false);
  };

  const [messages, setMessages] = useState<
    { sender: 'user' | 'ai'; text: string; actionReport?: boolean }[]
  >([
    {
      sender: 'ai',
      text: '¡Hola! Soy tu AI Behavioral Copilot del Consorcio Antifraude. Puedo explicarte la causa raíz de cualquier score, simular escenarios de ataque de mulas o redactar informes de auditoría para el BCRA o reguladores. ¿En qué te ayudo hoy?',
    },
  ]);
  const [inputQuery, setInputQuery] = useState('');
  const [isThinking, setIsThinking] = useState(false);

  const quickPrompts = [
    'Explicar por qué estafador.red@gmail.com tiene Score 100',
    '¿Por qué se activó la condición de Kill-Switch?',
    'Generar informe de auditoría de falsos positivos',
    '¿Cómo funciona la regla de decaimiento temporal (180 días)?',
  ];

  const handleSend = (textToSend?: string) => {
    const query = textToSend || inputQuery;
    if (!query.trim()) return;

    const newMessages = [...messages, { sender: 'user' as const, text: query }];
    setMessages(newMessages);
    setInputQuery('');
    setIsThinking(true);

    setTimeout(() => {
      setIsThinking(false);
      let reply = '';
      let hasReport = false;

      if (query.includes('estafador.red@gmail.com') || query.includes('Score 100')) {
        reply =
          'Análisis Forense del Hash a8f5c3... (estafador.red@gmail.com):\n' +
          '• Consenso: Reportado por 5 entidades independientes (Galicia, Ualá, MP, Santander, Lemon) -> Aporte +40 pts.\n' +
          '• Velocidad: 8 transacciones cruzadas en 24h -> Aporte +25 pts.\n' +
          '• Gravedad: Tipología MULA_DE_DINERO (peso crítico 100) -> Aporte +25 pts.\n' +
          '• Recencia: Último reporte registrado hace 1 día -> Aporte +10 pts.\n' +
          'Total: 100/100 (Recomendación: BLOQUEO INMEDIATO Y RETENCIÓN KILL-SWITCH).';
        hasReport = true;
      } else if (query.includes('Kill-Switch')) {
        reply =
          'El Kill-Switch se dispara de forma automática cuando el Risk Score ponderado alcanza o supera los 90 puntos. Su propósito es interceptar la salida de fondos en menos de 15ms y aplicar una auto-pausa preventiva de 45 segundos mientras se verifica si el dispositivo pertenece a una granja de emuladores (Device Farm).';
      } else if (query.includes('auditoría') || query.includes('informe')) {
        reply =
          'He generado un informe técnico de cumplimiento conforme al protocolo de Privacidad Ciega (Ley 25.326). Los dictámenes han sido emitidos con firmas HMAC-SHA256 y cero retención de datos personales en texto claro.';
        hasReport = true;
      } else {
        reply =
          'El motor algorítmico del consorcio procesa 4 variables ponderadas (Consenso 40%, Velocidad 25%, Gravedad 25%, Recencia 10%) con decaimiento lineal tras 180 días sin nuevas alertas confirmadas.';
      }

      setMessages([...newMessages, { sender: 'ai', text: reply, actionReport: hasReport }]);
    }, 900);
  };

  return (
    <>
      {/* Floating Copilot Button */}
      <button
        onClick={() => setInternalIsOpen(true)}
        className="fixed bottom-6 right-6 z-40 flex items-center gap-2 rounded-2xl bg-gradient-to-r from-indigo-500 via-purple-600 to-cyan-500 p-0.5 shadow-2xl shadow-indigo-500/30 transition hover:scale-105 active:scale-95"
      >
        <div className="flex items-center gap-2 rounded-[14px] bg-[#090d16] px-4 py-2.5 text-xs font-bold text-white">
          <Sparkles className="h-4 w-4 text-cyan-400 animate-pulse" />
          <span>AI Behavioral Copilot</span>
        </div>
      </button>

      {/* Slide-out Drawer */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md h-full bg-[#0d121f] border-l border-white/10 p-5 shadow-2xl flex flex-col justify-between">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                  <Bot className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">AI Behavioral Copilot</h3>
                  <p className="text-[11px] text-slate-400">Inteligencia Artificial Forense de Red</p>
                </div>
              </div>

              <button
                onClick={handleClose}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Quick Prompts */}
            <div className="py-2 flex flex-col gap-1.5 border-b border-white/5">
              <span className="text-[10px] font-semibold text-slate-500 uppercase">Consultas Frecuentes:</span>
              <div className="flex flex-wrap gap-1">
                {quickPrompts.slice(0, 2).map((p, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSend(p)}
                    className="rounded-lg border border-white/10 bg-slate-900 px-2 py-1 text-[10px] text-slate-300 hover:text-white hover:border-cyan-500/40 text-left"
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            {/* Messages Stream */}
            <div className="flex-1 overflow-y-auto space-y-3 py-4 pr-1 text-xs">
              {messages.map((m, idx) => (
                <div
                  key={idx}
                  className={`rounded-2xl p-3.5 space-y-2 ${
                    m.sender === 'user'
                      ? 'bg-indigo-600 text-white ml-8 shadow-md'
                      : 'bg-slate-900 border border-white/10 text-slate-200 mr-4'
                  }`}
                >
                  <p className="whitespace-pre-line leading-relaxed">{m.text}</p>
                  {m.actionReport && (
                    <button
                      onClick={() => alert('Informe oficial descargado como: Dictamen_Auditoria_Consorcio.pdf')}
                      className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-black/40 px-3 py-1.5 text-[11px] font-semibold text-cyan-300 hover:bg-black/60 transition"
                    >
                      <FileText className="h-3.5 w-3.5" /> Descargar Dictamen en PDF
                    </button>
                  )}
                </div>
              ))}
              {isThinking && (
                <div className="flex items-center gap-2 text-xs text-slate-400 italic">
                  <Sparkles className="h-3.5 w-3.5 text-cyan-400 animate-spin" />
                  Analizando telemetría de grafos y consenso...
                </div>
              )}
            </div>

            {/* Input Form */}
            <form onSubmit={e => { e.preventDefault(); handleSend(); }} className="border-t border-white/10 pt-3 flex gap-2">
              <input
                type="text"
                value={inputQuery}
                onChange={e => setInputQuery(e.target.value)}
                placeholder="Pregunta sobre causas de score, mulas o regulaciones..."
                className="flex-1 rounded-xl border border-white/10 bg-black/50 px-3 py-2.5 text-xs text-white focus:outline-none focus:border-cyan-400"
              />
              <button
                type="submit"
                className="rounded-xl theme-btn-primary px-4 py-2 text-xs font-bold"
              >
                <Send className="h-4 w-4" />
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
