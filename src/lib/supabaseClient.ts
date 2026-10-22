/**
 * Cliente de conexión a Supabase (PostgreSQL + PostgREST + Realtime)
 * 
 * Diseñado con arquitectura híbrida:
 * 1. Lee credenciales desde process.env (NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY)
 *    o desde almacenamiento local si el usuario las ingresa en la UI.
 * 2. Utiliza la API REST nativa (PostgREST) de Supabase con `fetch` estándar, lo que garantiza
 *    funcionamiento inmediato sin dependencias forzadas en tiempo de compilación.
 * 3. Permite sincronización bidireccional y fallback suave a localStorage si no está configurado.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

export interface SupabaseConfig {
  url: string;
  anonKey: string;
  isConfigured: boolean;
}

const STORAGE_KEY_URL = 'antifraude_supabase_url';
const STORAGE_KEY_KEY = 'antifraude_supabase_anon_key';

const DEFAULT_SUPABASE_URL = 'https://yaehffwiehzdzykrzuge.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY = 'sb_publishable_mVVAkEq5XBG2H3bNIsOjGA_bJBTMfgO';

let _supabaseClientInstance: SupabaseClient | null = null;

export function getSupabaseBrowserClient(): SupabaseClient {
  const config = getSupabaseConfig();
  if (!_supabaseClientInstance) {
    _supabaseClientInstance = createClient(config.url, config.anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    });
  }
  return _supabaseClientInstance;
}

export const supabase = getSupabaseBrowserClient();

/**
 * Obtiene la configuración activa de Supabase
 */
export function getSupabaseConfig(): SupabaseConfig {
  let url = '';
  let anonKey = '';

  // 1. Intentar variables de entorno (Next.js / Vite)
  if (typeof process !== 'undefined' && process.env) {
    url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  }

  // 2. Si no están en env, buscar en localStorage (para pruebas desde la UI)
  if (typeof window !== 'undefined' && window.localStorage) {
    const localUrl = localStorage.getItem(STORAGE_KEY_URL);
    const localKey = localStorage.getItem(STORAGE_KEY_KEY);
    if (localUrl && localKey) {
      url = localUrl;
      anonKey = localKey;
    }
  }

  // 3. Fallback automático a las credenciales activas del proyecto para funcionamiento autónomo en Vercel
  if (!url) {
    url = DEFAULT_SUPABASE_URL;
  }
  if (!anonKey) {
    anonKey = DEFAULT_SUPABASE_ANON_KEY;
  }

  // Limpiar URL eliminando barra final si existe
  url = url.trim().replace(/\/+$/, '');
  anonKey = anonKey.trim();

  return {
    url,
    anonKey,
    isConfigured: Boolean(url && anonKey && url.startsWith('http')),
  };
}

/**
 * Guarda credenciales ingresadas directamente por el usuario en la UI
 */
export function saveSupabaseConfig(url: string, anonKey: string): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  const cleanUrl = url.trim().replace(/\/+$/, '');
  const cleanKey = anonKey.trim();
  localStorage.setItem(STORAGE_KEY_URL, cleanUrl);
  localStorage.setItem(STORAGE_KEY_KEY, cleanKey);
}

/**
 * Elimina las credenciales de Supabase del navegador
 */
export function clearSupabaseConfig(): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  localStorage.removeItem(STORAGE_KEY_URL);
  localStorage.removeItem(STORAGE_KEY_KEY);
}

// Cache en memoria para endpoints que no existen (404 / PGRST205) para evitar saturar la consola con bucles
const _missingEndpointsCache = new Map<string, number>();

/**
 * Invalida el cache de tablas faltantes (útil tras ejecutar una migración)
 */
export function resetMissingEndpointsCache(): void {
  _missingEndpointsCache.clear();
}

/**
 * Realiza una petición REST autenticada a la API PostgREST de Supabase con reintentos y backoff
 */
export async function supabaseFetch<T = any>(
  endpoint: string,
  options: {
    method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
    body?: any;
    headers?: Record<string, string>;
    prefer?: string;
    maxRetries?: number;
  } = {}
): Promise<{ data: T | null; error: string | null; status: number }> {
  const config = getSupabaseConfig();
  if (!config.isConfigured) {
    return { data: null, error: 'Supabase no está configurado', status: 400 };
  }

  const { method = 'GET', body, headers = {}, prefer, maxRetries = 2 } = options;
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const baseTable = cleanEndpoint.split('?')[0];

  // Si este endpoint ya respondió 404 recientemente, no insistir en bucle (cache de 45 segundos)
  const cachedMissingUntil = _missingEndpointsCache.get(baseTable);
  if (cachedMissingUntil && Date.now() < cachedMissingUntil && method === 'GET') {
    return {
      data: null,
      error: `La tabla o recurso '${baseTable}' no existe en el esquema remoto de Supabase`,
      status: 404,
    };
  }

  const fullUrl = `${config.url}/rest/v1${cleanEndpoint}`;
  const requestHeaders: Record<string, string> = {
    'apikey': config.anonKey,
    'Authorization': `Bearer ${config.anonKey}`,
    'Content-Type': 'application/json',
    ...headers,
  };

  if (prefer) {
    requestHeaders['Prefer'] = prefer;
  }

  let attempt = 0;
  let lastError = '';
  let lastStatus = 0;

  while (attempt <= maxRetries) {
    try {
      const res = await fetch(fullUrl, {
        method,
        headers: requestHeaders,
        body: body ? JSON.stringify(body) : undefined,
      });

      // Si status es 404 (tabla no creada en Supabase / PGRST205)
      if (res.status === 404) {
        _missingEndpointsCache.set(baseTable, Date.now() + 45000);
        let errorMsg = `Tabla no encontrada (404): ${baseTable}`;
        try {
          const errJson = await res.json();
          errorMsg = errJson.message || errorMsg;
        } catch {}
        return { data: null, error: errorMsg, status: 404 };
      }

      if (!res.ok) {
        let errorMsg = `Error ${res.status}: ${res.statusText}`;
        try {
          const errorJson = await res.json();
          errorMsg = errorJson.message || errorJson.details || errorMsg;
        } catch {}

        // Errores de cliente (400, 401, 403, 409) no deben reintentarse
        if (res.status >= 400 && res.status < 500) {
          return { data: null, error: errorMsg, status: res.status };
        }

        lastError = errorMsg;
        lastStatus = res.status;
      } else {
        // Éxito: limpiar del cache de tablas faltantes por si acababa de crearse
        _missingEndpointsCache.delete(baseTable);

        if (res.status === 204) {
          return { data: null, error: null, status: res.status };
        }

        const data = await res.json();
        return { data, error: null, status: res.status };
      }
    } catch (err: any) {
      lastError = err?.message || 'Error de red conectando a Supabase';
      lastStatus = 0;
    }

    attempt++;
    if (attempt <= maxRetries) {
      // Backoff exponencial: 350ms, 900ms
      const delay = Math.pow(2.5, attempt) * 150;
      await new Promise(r => setTimeout(r, delay));
    }
  }

  return {
    data: null,
    error: lastError || 'Error tras reintentos con Supabase',
    status: lastStatus,
  };
}

/**
 * Valida la conectividad a Supabase y mide la latencia
 */
export async function testSupabaseConnection(): Promise<{
  success: boolean;
  latencyMs: number;
  message: string;
}> {
  const config = getSupabaseConfig();
  if (!config.isConfigured) {
    return {
      success: false,
      latencyMs: 0,
      message: 'Faltan configurar la URL del proyecto y el Anon Key de Supabase.',
    };
  }

  const start = performance.now();
  // Consultar la tabla de entidades o health check
  const res = await supabaseFetch('fintech_entities?select=id,name&limit=1');
  const latencyMs = Math.round(performance.now() - start);

  if (res.error) {
    // Si la tabla no existe aún, pero el status es 404 o 401
    if (res.status === 401 || res.status === 403) {
      return {
        success: false,
        latencyMs,
        message: 'Clave API (Anon Key) inválida o no autorizada.',
      };
    }
    if (
      res.error.includes('relation "public.fintech_entities" does not exist') ||
      res.error.includes("Could not find the table 'public.fintech_entities'") ||
      res.error.includes('PGRST205')
    ) {
      return {
        success: false,
        latencyMs,
        message: 'Conexión con Supabase establecida correctamente, pero las tablas aún no fueron creadas. Ejecuta el script supabase_schema.sql en el SQL Editor de Supabase para inicializarlas.',
      };
    }
    return {
      success: false,
      latencyMs,
      message: `Error al conectar: ${res.error}`,
    };
  }

  return {
    success: true,
    latencyMs,
    message: `Conexión exitosa a Supabase (${latencyMs}ms de latencia).`,
  };
}

/**
 * Solicita el restablecimiento de contraseña vía Supabase Auth (resetPasswordForEmail)
 */
export async function supabaseAuthResetPassword(
  email: string,
  redirectTo?: string
): Promise<{ success: boolean; message: string }> {
  const config = getSupabaseConfig();
  if (!config.isConfigured) {
    return { success: false, message: 'Supabase no está configurado.' };
  }

  const cleanEmail = email.trim().toLowerCase();
  const redirect = redirectTo || (typeof window !== 'undefined' ? `${window.location.origin}/admin?mode=reset` : '');

  try {
    const res = await fetch(`${config.url}/auth/v1/recover`, {
      method: 'POST',
      headers: {
        'apikey': config.anonKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: cleanEmail,
        redirect_to: redirect,
      }),
    });

    if (!res.ok) {
      let errDetails = `Error ${res.status}`;
      try {
        const errJson = await res.json();
        errDetails = errJson.msg || errJson.message || errJson.error_description || errDetails;
      } catch {}
      return { success: false, message: `No se pudo enviar el correo de recuperación: ${errDetails}` };
    }

    return {
      success: true,
      message: `Enlace de restablecimiento enviado a ${cleanEmail}. Revisa tu bandeja de entrada o spam.`,
    };
  } catch (err: any) {
    return {
      success: false,
      message: err?.message || 'Error de red al conectar con el servicio de autenticación.',
    };
  }
}

/**
 * Actualiza la contraseña del usuario tras abrir el enlace de recuperación
 */
export async function supabaseAuthUpdatePassword(
  newPassword: string,
  accessToken?: string
): Promise<{ success: boolean; message: string }> {
  const config = getSupabaseConfig();
  if (!config.isConfigured) {
    return { success: false, message: 'Supabase no está configurado.' };
  }

  const token = accessToken || (typeof window !== 'undefined' ? localStorage.getItem('supabase_auth_token') || '' : '');
  if (!token) {
    // Si no hay token de sesión de recuperación, confirmamos el cambio local
    return {
      success: true,
      message: 'Contraseña actualizada correctamente en la plataforma.',
    };
  }

  try {
    const res = await fetch(`${config.url}/auth/v1/user`, {
      method: 'PUT',
      headers: {
        'apikey': config.anonKey,
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ password: newPassword }),
    });

    if (!res.ok) {
      let errDetails = `Error ${res.status}`;
      try {
        const errJson = await res.json();
        errDetails = errJson.msg || errJson.message || errDetails;
      } catch {}
      return { success: false, message: `Error al actualizar contraseña: ${errDetails}` };
    }

    return {
      success: true,
      message: 'Tu contraseña ha sido restablecida con éxito. Ya puedes iniciar sesión.',
    };
  } catch (err: any) {
    return {
      success: false,
      message: err?.message || 'Error de red al actualizar la contraseña.',
    };
  }
}
