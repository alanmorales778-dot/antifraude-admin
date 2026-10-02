// ─────────────────────────────────────────────────────────────────
// DEVICE FINGERPRINT — Captura de Huella Digital de Hardware
// ─────────────────────────────────────────────────────────────────
// Utiliza señales estables del hardware (Canvas, WebGL, AudioContext,
// resolución, timezone) para generar un identificador determinístico
// que sobrevive modo incógnito y borrado de cookies.
// ─────────────────────────────────────────────────────────────────

import { hashData, CONSORTIUM_SALT, normalizeIdentifier } from './crypto';

export interface DeviceSignals {
  canvas: string;
  webgl: string;
  audioContext: string;
  screen: string;
  timezone: string;
  platform: string;
  languages: string;
  hardwareConcurrency: number;
  deviceMemory: number | null;
  touchPoints: number;
}

/**
 * Captura las señales de hardware del dispositivo actual.
 * Estas señales son estables entre sesiones incluso en modo incógnito.
 */
export function captureDeviceSignals(): DeviceSignals {
  const signals: DeviceSignals = {
    canvas: getCanvasFingerprint(),
    webgl: getWebGLFingerprint(),
    audioContext: getAudioContextFingerprint(),
    screen: getScreenFingerprint(),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'unknown',
    platform: navigator?.platform || 'unknown',
    languages: (navigator?.languages || [navigator?.language || 'unknown']).join(','),
    hardwareConcurrency: navigator?.hardwareConcurrency || 0,
    deviceMemory: (navigator as any)?.deviceMemory || null,
    touchPoints: navigator?.maxTouchPoints || 0,
  };

  return signals;
}

/**
 * Genera un hash compuesto determinístico a partir de las señales del dispositivo.
 * Aplica el mismo pipeline de normalización + salt del consorcio.
 */
export async function generateDeviceFingerprint(): Promise<{
  fingerprint: string;
  signals: DeviceSignals;
  hash: string;
}> {
  const signals = captureDeviceSignals();
  
  // Construir cadena canónica determinística
  const canonicalString = [
    signals.canvas,
    signals.webgl,
    signals.audioContext,
    signals.screen,
    signals.timezone,
    signals.platform,
    signals.languages,
    signals.hardwareConcurrency.toString(),
    (signals.deviceMemory || 0).toString(),
    signals.touchPoints.toString(),
  ].join('|');

  // Generar fingerprint intermedio (sin salt para identificación)
  const encoder = new TextEncoder();
  const buffer = await crypto.subtle.digest('SHA-256', encoder.encode(canonicalString));
  const fingerprint = Array.from(new Uint8Array(buffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  // Hash con salt del consorcio para almacenamiento ciego
  const normalized = normalizeIdentifier('DEVICE', fingerprint);
  const hash = await hashData(`DEVICE:${normalized}`, CONSORTIUM_SALT);

  return {
    fingerprint, // ID legible para debug (nunca se persiste en producción)
    signals,
    hash,        // Token ciego para almacenamiento y consulta
  };
}

// ─────────────────────────────────────────────────────────────────
// SEÑALES INDIVIDUALES
// ─────────────────────────────────────────────────────────────────

function getCanvasFingerprint(): string {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 200;
    canvas.height = 50;
    const ctx = canvas.getContext('2d');
    if (!ctx) return 'no-canvas';

    // Texto con font rendering específico del GPU/OS
    ctx.textBaseline = 'top';
    ctx.font = '14px Arial';
    ctx.fillStyle = '#f60';
    ctx.fillRect(125, 1, 62, 20);
    ctx.fillStyle = '#069';
    ctx.fillText('Cwm fjordbank 🏦', 2, 15);
    ctx.fillStyle = 'rgba(102, 204, 0, 0.7)';
    ctx.fillText('Cwm fjordbank 🏦', 4, 17);

    return canvas.toDataURL();
  } catch {
    return 'canvas-error';
  }
}

function getWebGLFingerprint(): string {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (!gl) return 'no-webgl';

    const glCtx = gl as WebGLRenderingContext;
    const debugInfo = glCtx.getExtension('WEBGL_debug_renderer_info');
    if (!debugInfo) return 'no-debug-info';

    const vendor = glCtx.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) || 'unknown';
    const renderer = glCtx.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) || 'unknown';

    return `${vendor}~${renderer}`;
  } catch {
    return 'webgl-error';
  }
}

function getAudioContextFingerprint(): string {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return 'no-audio';

    const ctx = new AudioCtx();
    const analyser = ctx.createAnalyser();
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();

    oscillator.type = 'triangle';
    oscillator.frequency.setValueAtTime(10000, ctx.currentTime);
    gain.gain.setValueAtTime(0, ctx.currentTime);

    oscillator.connect(gain);
    gain.connect(analyser);
    analyser.connect(ctx.destination);

    oscillator.start(0);

    const dataArray = new Float32Array(analyser.fftSize);
    analyser.getFloatTimeDomainData(dataArray);

    oscillator.stop();
    ctx.close();

    // Hash de los primeros valores del array
    const slice = Array.from(dataArray.slice(0, 30));
    return slice.map(v => v.toFixed(6)).join(',');
  } catch {
    return 'audio-error';
  }
}

function getScreenFingerprint(): string {
  try {
    return [
      screen.width,
      screen.height,
      screen.colorDepth,
      window.devicePixelRatio || 1,
    ].join('x');
  } catch {
    return 'screen-error';
  }
}
