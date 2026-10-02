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

export interface SupabaseConfig {
  url: string;
  anonKey: string;
  isConfigured: boolean;
}

const STORAGE_KEY_URL = 'antifraude_supabase_url';
const STORAGE_KEY_KEY = 'antifraude_supabase_anon_key';

const DEFAULT_SUPABASE_URL = 'https://yaehffwiehzdzykrzuge.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY = 'sb_publishable_mVVAkEq5XBG2H3bNIsOjGA_bJBTMfgO';

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

/**
 * Realiza una petición REST autenticada a la API PostgREST de Supabase
 */
export async function supabaseFetch<T = any>(
  endpoint: string,
  options: {
    method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
    body?: any;
    headers?: Record<string, string>;
    prefer?: string;
  } = {}
): Promise<{ data: T | null; error: string | null; status: number }> {
  const config = getSupabaseConfig();
  if (!config.isConfigured) {
    return { data: null, error: 'Supabase no está configurado', status: 400 };
  }

  const { method = 'GET', body, headers = {}, prefer } = options;
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
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

  try {
    const res = await fetch(fullUrl, {
      method,
      headers: requestHeaders,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) {
      let errorMsg = `Error ${res.status}: ${res.statusText}`;
      try {
        const errorJson = await res.json();
        errorMsg = errorJson.message || errorJson.details || errorMsg;
      } catch {
        // Fallback a texto
      }
      return { data: null, error: errorMsg, status: res.status };
    }

    // Si status es 204 No Content
    if (res.status === 204) {
      return { data: null, error: null, status: res.status };
    }

    const data = await res.json();
    return { data, error: null, status: res.status };
  } catch (err: any) {
    return {
      data: null,
      error: err?.message || 'Error de red conectando a Supabase',
      status: 0,
    };
  }
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
