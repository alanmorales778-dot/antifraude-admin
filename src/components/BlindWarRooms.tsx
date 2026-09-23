'use client';

import React, { useState, useEffect } from 'react';
import { ShieldAlert, Users, MessageSquare, Send, Radio, Lock, Flame } from 'lucide-react';
import { BlindWarRoom, Tenant } from '@/lib/types';

interface BlindWarRoomsProps {
  currentTenant?: Tenant;
}

export default function BlindWarRooms({ currentTenant }: BlindWarRoomsProps) {
  const [rooms, setRooms] = useState<BlindWarRoom[]>([]);
  const [activeRoomId, setActiveRoomId] = useState<string>('room-rio-plata');
  const [chatInput, setChatInput] = useState('');
  const [myAlias, setMyAlias] = useState(
    currentTenant ? `Analista ${currentTenant.name} (Tú)` : 'Analista Mercado Pago (Tú)'
  );

  const fetchRooms = async () => {
    try {
      const res = await fetch('/api/v1/war-rooms');
      const data = await res.json();
      if (data.data) {
        setRooms(data.data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchRooms();
  }, []);

  const activeRoom = rooms.find(r => r.id === activeRoomId) || rooms[0];

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || !activeRoom) return;

    try {
      await fetch('/api/v1/war-rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomId: activeRoom.id,
          senderAlias: myAlias,
          text: chatInput.trim(),
        }),
      });

      setChatInput('');
      fetchRooms();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-2.5 w-2.5 rounded-full bg-rose-500 animate-ping" />
            <h2 className="text-xl font-bold text-white sm:text-2xl">
              Salas de Crisis Ciegas (Blind War Rooms)
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Espacio de colaboración táctica en tiempo real para analistas de riesgo de bancos y fintechs ante ataques masivos sindicados.
          </p>
        </div>

        <div className="flex items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-950/30 px-3 py-1.5 text-xs text-rose-300 font-mono">
          <Radio className="h-4 w-4 text-rose-400 animate-pulse" />
          <span>Canal Criptográfico Anonimizado Activo</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Rooms Selector Sidebar */}
        <div className="glass-panel rounded-2xl p-4 space-y-3 lg:col-span-1">
          <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider px-2">
            Incidentes en Curso
          </h3>

          <div className="space-y-2">
            {rooms.map(room => (
              <button
                key={room.id}
                onClick={() => setActiveRoomId(room.id)}
                className={`w-full text-left rounded-xl p-3 text-xs transition border ${
                  activeRoom?.id === room.id
                    ? 'border-rose-500/40 bg-rose-950/20 text-white shadow-md'
                    : 'border-white/5 bg-slate-900/40 text-slate-400 hover:border-white/10 hover:text-slate-200'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={`rounded px-1.5 py-0.5 text-[9px] font-bold ${
                      room.severity === 'CRITICAL'
                        ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                        : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                    }`}
                  >
                    {room.status === 'ACTIVE_CRISIS' ? 'CRISIS ACTIVA' : 'CONTENIDO'}
                  </span>
                  <span className="text-[10px] text-slate-500">{room.affectedCount} Entidades</span>
                </div>

                <div className="font-bold text-white mt-2 line-clamp-1">{room.title}</div>
                <p className="text-[11px] text-slate-400 line-clamp-2 mt-1">{room.attackVector}</p>
              </button>
            ))}
          </div>

          <div className="rounded-xl border border-white/5 bg-black/40 p-3 text-[11px] text-slate-500 space-y-1">
            <div className="flex items-center gap-1 font-semibold text-slate-400">
              <Lock className="h-3 w-3 text-cyan-400" /> Cero Fuga de PII:
            </div>
            <p>Los participantes solo ven seudónimos institucionales. Ningún nombre de usuario ni CBU/CVU es revelado.</p>
          </div>
        </div>

        {/* Chat Anonimizado Interbancario */}
        {activeRoom && (
          <div className="glass-panel rounded-2xl p-5 lg:col-span-2 flex flex-col justify-between h-[520px]">
            {/* Room Header */}
            <div className="border-b border-white/10 pb-3 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <Flame className="h-4 w-4 text-rose-400" />
                  <h3 className="text-sm font-bold text-white">{activeRoom.title}</h3>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">{activeRoom.attackVector}</p>
              </div>
              <span className="font-mono text-xs text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded border border-emerald-500/20">
                5 Analistas en Línea
              </span>
            </div>

            {/* Messages Feed */}
            <div className="flex-1 overflow-y-auto space-y-3 py-4 pr-2">
              {activeRoom.messages.map(msg => (
                <div
                  key={msg.id}
                  className={`rounded-xl p-3 text-xs ${
                    msg.isTelemetryAlert
                      ? 'border border-cyan-500/30 bg-cyan-950/20 text-cyan-300 font-mono'
                      : msg.senderAlias.includes('(Tú)')
                      ? 'border border-indigo-500/30 bg-indigo-950/30 text-white ml-8'
                      : 'border border-white/5 bg-slate-900/70 text-slate-200 mr-8'
                  }`}
                >
                  <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
                    <span className="font-semibold text-white">{msg.senderAlias}</span>
                    <span className="text-[10px] font-mono">{msg.timestamp}</span>
                  </div>
                  <p className="leading-relaxed">{msg.text}</p>
                </div>
              ))}
            </div>

            {/* Chat Input Form */}
            <form onSubmit={handleSendMessage} className="border-t border-white/10 pt-3 flex gap-2">
              <input
                type="text"
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                placeholder="Escribe telemetría o actualización táctica (sin compartir datos en texto plano)..."
                className="flex-1 rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-xs text-white focus:outline-none focus:border-rose-500"
              />
              <button
                type="submit"
                className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-rose-600 to-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-lg hover:brightness-110"
              >
                <Send className="h-3.5 w-3.5" /> Enviar
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
