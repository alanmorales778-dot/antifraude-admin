// ─────────────────────────────────────────────────────────────────
// MOTOR DE VERIFICACIÓN DE EXISTENCIA Y ENTREGABILIDAD DE EMAILS
// + EMAIL INTELLIGENCE: PAÍS DE ORIGEN + ANTIGÜEDAD DEL DOMINIO
// ─────────────────────────────────────────────────────────────────

export type EmailVerificationStatus =
  | 'EXISTING'
  | 'NON_EXISTENT'
  | 'DISPOSABLE'
  | 'INVALID_FORMAT';

export type EmailMaturityLevel = 'NUEVO' | 'JOVEN' | 'INTERMEDIO' | 'MADURO';

export interface EmailCountryInfo {
  countryCode: string;       // ISO 3166-1 alpha-2 (ej: "AR", "US", "BR")
  countryName: string;       // Nombre legible (ej: "Argentina")
  flag: string;              // Emoji bandera (ej: "🇦🇷")
  source: 'TLD' | 'MX_REGION' | 'PROVIDER_HQ' | 'UNKNOWN';
  sourceLabel: string;       // Descripción de cómo se determinó
}

export interface EmailAgeInfo {
  domainCreatedDate: string;      // ISO date estimada de creación del dominio
  domainAgeDays: number;          // Antigüedad en días
  ageLabel: string;               // Legible: "Creado hace 8 años", etc.
  maturityLevel: EmailMaturityLevel;
  maturityBadge: string;          // Badge visual
  agePenalty: number;             // Penalidad adicional por dominio nuevo (0 si maduro)
  isNewDomain: boolean;           // true si < 30 días
  isYoungDomain: boolean;         // true si < 1 año
}

export interface EmailVerificationResult {
  email: string;
  domain: string;
  status: EmailVerificationStatus;
  isDeliverable: boolean;
  isDisposable: boolean;
  mxValid: boolean;
  scorePenalty: number;
  badgeText: string;
  alertTitle?: string;
  alertMessage?: string;
  // ── EMAIL INTELLIGENCE ──
  country: EmailCountryInfo;
  age: EmailAgeInfo;
}

// ─────────────────────────────────────────────────────────────────
// BASE DE DATOS DE PAÍSES POR ccTLD (Country Code Top-Level Domain)
// ─────────────────────────────────────────────────────────────────
const CCTLD_COUNTRY_MAP: Record<string, { code: string; name: string; flag: string }> = {
  'ar': { code: 'AR', name: 'Argentina', flag: '🇦🇷' },
  'mx': { code: 'MX', name: 'México', flag: '🇲🇽' },
  'br': { code: 'BR', name: 'Brasil', flag: '🇧🇷' },
  'cl': { code: 'CL', name: 'Chile', flag: '🇨🇱' },
  'co': { code: 'CO', name: 'Colombia', flag: '🇨🇴' },
  'pe': { code: 'PE', name: 'Perú', flag: '🇵🇪' },
  'uy': { code: 'UY', name: 'Uruguay', flag: '🇺🇾' },
  'py': { code: 'PY', name: 'Paraguay', flag: '🇵🇾' },
  'ec': { code: 'EC', name: 'Ecuador', flag: '🇪🇨' },
  've': { code: 'VE', name: 'Venezuela', flag: '🇻🇪' },
  'bo': { code: 'BO', name: 'Bolivia', flag: '🇧🇴' },
  'cr': { code: 'CR', name: 'Costa Rica', flag: '🇨🇷' },
  'pa': { code: 'PA', name: 'Panamá', flag: '🇵🇦' },
  'do': { code: 'DO', name: 'Rep. Dominicana', flag: '🇩🇴' },
  'gt': { code: 'GT', name: 'Guatemala', flag: '🇬🇹' },
  'hn': { code: 'HN', name: 'Honduras', flag: '🇭🇳' },
  'sv': { code: 'SV', name: 'El Salvador', flag: '🇸🇻' },
  'ni': { code: 'NI', name: 'Nicaragua', flag: '🇳🇮' },
  'cu': { code: 'CU', name: 'Cuba', flag: '🇨🇺' },
  'es': { code: 'ES', name: 'España', flag: '🇪🇸' },
  'us': { code: 'US', name: 'Estados Unidos', flag: '🇺🇸' },
  'uk': { code: 'GB', name: 'Reino Unido', flag: '🇬🇧' },
  'de': { code: 'DE', name: 'Alemania', flag: '🇩🇪' },
  'fr': { code: 'FR', name: 'Francia', flag: '🇫🇷' },
  'it': { code: 'IT', name: 'Italia', flag: '🇮🇹' },
  'pt': { code: 'PT', name: 'Portugal', flag: '🇵🇹' },
  'jp': { code: 'JP', name: 'Japón', flag: '🇯🇵' },
  'cn': { code: 'CN', name: 'China', flag: '🇨🇳' },
  'in': { code: 'IN', name: 'India', flag: '🇮🇳' },
  'ru': { code: 'RU', name: 'Rusia', flag: '🇷🇺' },
  'ca': { code: 'CA', name: 'Canadá', flag: '🇨🇦' },
  'au': { code: 'AU', name: 'Australia', flag: '🇦🇺' },
  'nz': { code: 'NZ', name: 'Nueva Zelanda', flag: '🇳🇿' },
  'za': { code: 'ZA', name: 'Sudáfrica', flag: '🇿🇦' },
  'ng': { code: 'NG', name: 'Nigeria', flag: '🇳🇬' },
  'ke': { code: 'KE', name: 'Kenia', flag: '🇰🇪' },
  'il': { code: 'IL', name: 'Israel', flag: '🇮🇱' },
  'ae': { code: 'AE', name: 'Emiratos Árabes', flag: '🇦🇪' },
  'kr': { code: 'KR', name: 'Corea del Sur', flag: '🇰🇷' },
  'tw': { code: 'TW', name: 'Taiwán', flag: '🇹🇼' },
  'sg': { code: 'SG', name: 'Singapur', flag: '🇸🇬' },
  'ph': { code: 'PH', name: 'Filipinas', flag: '🇵🇭' },
  'id': { code: 'ID', name: 'Indonesia', flag: '🇮🇩' },
  'th': { code: 'TH', name: 'Tailandia', flag: '🇹🇭' },
  'vn': { code: 'VN', name: 'Vietnam', flag: '🇻🇳' },
  'pl': { code: 'PL', name: 'Polonia', flag: '🇵🇱' },
  'nl': { code: 'NL', name: 'Países Bajos', flag: '🇳🇱' },
  'be': { code: 'BE', name: 'Bélgica', flag: '🇧🇪' },
  'ch': { code: 'CH', name: 'Suiza', flag: '🇨🇭' },
  'at': { code: 'AT', name: 'Austria', flag: '🇦🇹' },
  'se': { code: 'SE', name: 'Suecia', flag: '🇸🇪' },
  'no': { code: 'NO', name: 'Noruega', flag: '🇳🇴' },
  'dk': { code: 'DK', name: 'Dinamarca', flag: '🇩🇰' },
  'fi': { code: 'FI', name: 'Finlandia', flag: '🇫🇮' },
  'ie': { code: 'IE', name: 'Irlanda', flag: '🇮🇪' },
  'cz': { code: 'CZ', name: 'Chequia', flag: '🇨🇿' },
  'ro': { code: 'RO', name: 'Rumania', flag: '🇷🇴' },
  'ua': { code: 'UA', name: 'Ucrania', flag: '🇺🇦' },
  'tr': { code: 'TR', name: 'Turquía', flag: '🇹🇷' },
  'eg': { code: 'EG', name: 'Egipto', flag: '🇪🇬' },
};

// ─────────────────────────────────────────────────────────────────
// PROVEEDORES GLOBALES Y SU PAÍS DE SEDE (para dominios .com/.org)
// ─────────────────────────────────────────────────────────────────
const PROVIDER_HQ_MAP: Record<string, { code: string; name: string; flag: string; founded: string }> = {
  'gmail.com':       { code: 'US', name: 'Estados Unidos', flag: '🇺🇸', founded: '2004-04-01' },
  'googlemail.com':  { code: 'US', name: 'Estados Unidos', flag: '🇺🇸', founded: '2004-04-01' },
  'outlook.com':     { code: 'US', name: 'Estados Unidos', flag: '🇺🇸', founded: '2012-07-31' },
  'hotmail.com':     { code: 'US', name: 'Estados Unidos', flag: '🇺🇸', founded: '1996-07-04' },
  'live.com':        { code: 'US', name: 'Estados Unidos', flag: '🇺🇸', founded: '2005-11-01' },
  'yahoo.com':       { code: 'US', name: 'Estados Unidos', flag: '🇺🇸', founded: '1997-10-08' },
  'yahoo.com.ar':    { code: 'AR', name: 'Argentina', flag: '🇦🇷', founded: '2000-03-15' },
  'yahoo.com.br':    { code: 'BR', name: 'Brasil', flag: '🇧🇷', founded: '2000-06-01' },
  'yahoo.com.mx':    { code: 'MX', name: 'México', flag: '🇲🇽', founded: '2000-06-01' },
  'icloud.com':      { code: 'US', name: 'Estados Unidos', flag: '🇺🇸', founded: '2011-10-12' },
  'me.com':          { code: 'US', name: 'Estados Unidos', flag: '🇺🇸', founded: '2008-07-09' },
  'mac.com':         { code: 'US', name: 'Estados Unidos', flag: '🇺🇸', founded: '2000-01-05' },
  'protonmail.com':  { code: 'CH', name: 'Suiza', flag: '🇨🇭', founded: '2014-05-16' },
  'proton.me':       { code: 'CH', name: 'Suiza', flag: '🇨🇭', founded: '2014-05-16' },
  'tutanota.com':    { code: 'DE', name: 'Alemania', flag: '🇩🇪', founded: '2011-01-01' },
  'tuta.io':         { code: 'DE', name: 'Alemania', flag: '🇩🇪', founded: '2011-01-01' },
  'zoho.com':        { code: 'IN', name: 'India', flag: '🇮🇳', founded: '2008-06-01' },
  'aol.com':         { code: 'US', name: 'Estados Unidos', flag: '🇺🇸', founded: '1993-03-01' },
  'msn.com':         { code: 'US', name: 'Estados Unidos', flag: '🇺🇸', founded: '1995-08-24' },
  // Proveedores regionales argentinos
  'fibertel.com.ar': { code: 'AR', name: 'Argentina', flag: '🇦🇷', founded: '2000-01-15' },
  'speedy.com.ar':   { code: 'AR', name: 'Argentina', flag: '🇦🇷', founded: '1998-06-01' },
  'arnet.com.ar':    { code: 'AR', name: 'Argentina', flag: '🇦🇷', founded: '1998-01-10' },
  'ciudad.com.ar':   { code: 'AR', name: 'Argentina', flag: '🇦🇷', founded: '1999-03-01' },
  'uol.com.ar':      { code: 'AR', name: 'Argentina', flag: '🇦🇷', founded: '2000-09-01' },
  'infovia.com.ar':  { code: 'AR', name: 'Argentina', flag: '🇦🇷', founded: '1997-01-01' },
  'sinectis.com.ar': { code: 'AR', name: 'Argentina', flag: '🇦🇷', founded: '1997-06-01' },
  // Proveedores regionales brasileños
  'uol.com.br':      { code: 'BR', name: 'Brasil', flag: '🇧🇷', founded: '1996-04-16' },
  'bol.com.br':      { code: 'BR', name: 'Brasil', flag: '🇧🇷', founded: '2000-06-01' },
  'terra.com.br':    { code: 'BR', name: 'Brasil', flag: '🇧🇷', founded: '1999-01-15' },
  'globo.com':       { code: 'BR', name: 'Brasil', flag: '🇧🇷', founded: '2000-03-01' },
  'ig.com.br':       { code: 'BR', name: 'Brasil', flag: '🇧🇷', founded: '2000-01-13' },
  // Proveedores regionales mexicanos
  'prodigy.net.mx':  { code: 'MX', name: 'México', flag: '🇲🇽', founded: '1996-01-01' },
  'telmex.com':      { code: 'MX', name: 'México', flag: '🇲🇽', founded: '1996-01-01' },
};

// ─────────────────────────────────────────────────────────────────
// BASE DE DATOS DE ANTIGÜEDAD ESTIMADA DE DOMINIOS CONOCIDOS
// (WHOIS / RDAP heurístico para sandbox sin APIs externas)
// ─────────────────────────────────────────────────────────────────
const KNOWN_DOMAIN_CREATION: Record<string, string> = {
  'gmail.com': '2004-04-01',
  'googlemail.com': '2004-04-01',
  'outlook.com': '2012-07-31',
  'hotmail.com': '1996-07-04',
  'live.com': '2005-11-01',
  'yahoo.com': '1995-01-18',
  'yahoo.com.ar': '2000-03-15',
  'yahoo.com.br': '2000-06-01',
  'yahoo.com.mx': '2000-06-01',
  'icloud.com': '2011-10-12',
  'protonmail.com': '2014-05-16',
  'proton.me': '2022-04-26',
  'tutanota.com': '2011-01-01',
  'aol.com': '1993-03-01',
  'msn.com': '1995-08-24',
  'zoho.com': '2005-01-01',
  'fibertel.com.ar': '2000-01-15',
  'speedy.com.ar': '1998-06-01',
  'arnet.com.ar': '1998-01-10',
  'ciudad.com.ar': '1999-03-01',
  'uol.com.br': '1996-04-16',
  'terra.com.br': '1999-01-15',
  'globo.com': '2000-03-01',
  'prodigy.net.mx': '1996-01-01',
};

// Dominios descartables / temporales conocidos
const DISPOSABLE_DOMAINS = new Set([
  'yopmail.com',
  'yopmail.net',
  'yopmail.fr',
  'mailinator.com',
  'guerrillamail.com',
  'guerrillamail.info',
  'guerrillamail.net',
  '10minutemail.com',
  '10minutemail.net',
  'tempmail.com',
  'temp-mail.org',
  'trashmail.com',
  'sharklasers.com',
  'getairmail.com',
  'dispostable.com',
  'fakeinbox.com',
  'throwawaymail.com',
  'inboxkitten.com',
  'maildrop.cc',
  'mohmal.com',
  'crazymailing.com',
  'burnermail.io',
  'nada.ltd',
  'mytemp.email',
]);

// Dominios ficticios, de prueba o con errores de tipeo que no poseen registros MX reales
const KNOWN_NON_EXISTENT_DOMAINS = new Set([
  'noexiste.com',
  'noexiste.org',
  'invalido.com',
  'fake.com',
  'test.com',
  'ejemplo.com',
  'example.com',
  'dummy.com',
  'none.com',
  'null.com',
  'asdf.com',
  'nowhere.com',
  'notreal.com',
  'gmai.com',
  'gmail.con',
  'hotmial.com',
  'hotmai.com',
  'yahooo.com',
  'outlook.con',
]);

// ─────────────────────────────────────────────────────────────────
// DETECCIÓN DE PAÍS POR DOMINIO
// ─────────────────────────────────────────────────────────────────
function detectCountry(domain: string): EmailCountryInfo {
  // 1. Proveedor conocido con sede determinada
  if (PROVIDER_HQ_MAP[domain]) {
    const p = PROVIDER_HQ_MAP[domain];
    return {
      countryCode: p.code,
      countryName: p.name,
      flag: p.flag,
      source: 'PROVIDER_HQ',
      sourceLabel: `Proveedor con sede en ${p.name}`,
    };
  }

  // 2. ccTLD del dominio (ej: .com.ar, .co.uk, .org.br)
  const parts = domain.split('.');
  // Manejar ccTLDs compuestos como .com.ar, .org.br, .co.uk
  if (parts.length >= 3) {
    const lastPart = parts[parts.length - 1];
    if (CCTLD_COUNTRY_MAP[lastPart]) {
      const c = CCTLD_COUNTRY_MAP[lastPart];
      return {
        countryCode: c.code,
        countryName: c.name,
        flag: c.flag,
        source: 'TLD',
        sourceLabel: `Dominio ccTLD .${lastPart} (${c.name})`,
      };
    }
  }
  // TLD directo (ej: dominio.ar, dominio.br)
  if (parts.length >= 2) {
    const tld = parts[parts.length - 1];
    if (CCTLD_COUNTRY_MAP[tld]) {
      const c = CCTLD_COUNTRY_MAP[tld];
      return {
        countryCode: c.code,
        countryName: c.name,
        flag: c.flag,
        source: 'TLD',
        sourceLabel: `Dominio ccTLD .${tld} (${c.name})`,
      };
    }
  }

  // 3. gTLD global (.com, .org, .net) — Región MX heurística
  //    Para dominios .com sin provider conocido, usamos heurísticas:
  //    - Si el nombre del dominio contiene patrones regionales
  const lowerDomain = domain.toLowerCase();
  if (lowerDomain.includes('argentina') || lowerDomain.includes('baires') || lowerDomain.includes('bsas')) {
    return { countryCode: 'AR', countryName: 'Argentina', flag: '🇦🇷', source: 'MX_REGION', sourceLabel: 'Inferido por nombre de dominio (Argentina)' };
  }
  if (lowerDomain.includes('brasil') || lowerDomain.includes('brazil') || lowerDomain.includes('saopaulo')) {
    return { countryCode: 'BR', countryName: 'Brasil', flag: '🇧🇷', source: 'MX_REGION', sourceLabel: 'Inferido por nombre de dominio (Brasil)' };
  }
  if (lowerDomain.includes('mexico') || lowerDomain.includes('cdmx')) {
    return { countryCode: 'MX', countryName: 'México', flag: '🇲🇽', source: 'MX_REGION', sourceLabel: 'Inferido por nombre de dominio (México)' };
  }

  // 4. Fallback: Global / No determinado
  return {
    countryCode: 'GLOBAL',
    countryName: 'Global / No determinado',
    flag: '🌐',
    source: 'UNKNOWN',
    sourceLabel: 'Dominio gTLD global — país no determinable por DNS',
  };
}

// ─────────────────────────────────────────────────────────────────
// ESTIMACIÓN DE ANTIGÜEDAD DEL DOMINIO
// ─────────────────────────────────────────────────────────────────
function estimateDomainAge(domain: string): EmailAgeInfo {
  const now = new Date();

  // 1. Dominio con fecha de creación conocida
  if (KNOWN_DOMAIN_CREATION[domain]) {
    const createdDate = new Date(KNOWN_DOMAIN_CREATION[domain]);
    const ageDays = Math.floor((now.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24));
    return buildAgeInfo(KNOWN_DOMAIN_CREATION[domain], ageDays);
  }

  // 2. Proveedor conocido — usar fecha de fundación del servicio
  if (PROVIDER_HQ_MAP[domain]) {
    const createdDate = new Date(PROVIDER_HQ_MAP[domain].founded);
    const ageDays = Math.floor((now.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24));
    return buildAgeInfo(PROVIDER_HQ_MAP[domain].founded, ageDays);
  }

  // 3. Dominios descartables / temporales — siempre se tratan como "nuevos / efímeros"
  if (DISPOSABLE_DOMAINS.has(domain)) {
    return buildAgeInfo(new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10), 7);
  }

  // 4. Dominios inexistentes — 0 días
  if (KNOWN_NON_EXISTENT_DOMAINS.has(domain)) {
    return buildAgeInfo(now.toISOString().slice(0, 10), 0);
  }

  // 5. Heurística por TLD:
  //    - ccTLDs de países LATAM (.com.ar, .com.br) con dominios corporativos → estimar ~5 años
  //    - gTLDs desconocidos (.com, .net) → estimar ~3 años (intermedio)
  const parts = domain.split('.');
  const tld = parts[parts.length - 1];
  const isCountryTLD = CCTLD_COUNTRY_MAP[tld] !== undefined;

  if (isCountryTLD) {
    // Dominios nacionales corporativos → estimación conservadora: 3-5 años
    const estimatedDays = 365 * 4; // ~4 años
    const estimatedDate = new Date(now.getTime() - estimatedDays * 24 * 60 * 60 * 1000);
    return buildAgeInfo(estimatedDate.toISOString().slice(0, 10), estimatedDays);
  }

  // gTLD desconocido → estimación intermedia: 2-3 años
  const estimatedDays = 365 * 3;
  const estimatedDate = new Date(now.getTime() - estimatedDays * 24 * 60 * 60 * 1000);
  return buildAgeInfo(estimatedDate.toISOString().slice(0, 10), estimatedDays);
}

function buildAgeInfo(createdDateStr: string, ageDays: number): EmailAgeInfo {
  const isNewDomain = ageDays < 30;
  const isYoungDomain = ageDays < 365;

  let maturityLevel: EmailMaturityLevel;
  let maturityBadge: string;
  let agePenalty = 0;

  if (ageDays <= 0) {
    maturityLevel = 'NUEVO';
    maturityBadge = '🔴 Dominio Inexistente / Sin Registros';
    agePenalty = 20;
  } else if (ageDays < 30) {
    maturityLevel = 'NUEVO';
    maturityBadge = '🔴 Dominio Nuevo (< 30 días)';
    agePenalty = 15;
  } else if (ageDays < 180) {
    maturityLevel = 'JOVEN';
    maturityBadge = '🟠 Dominio Joven (< 6 meses)';
    agePenalty = 8;
  } else if (ageDays < 365) {
    maturityLevel = 'JOVEN';
    maturityBadge = '🟡 Dominio Joven (< 1 año)';
    agePenalty = 4;
  } else if (ageDays < 730) {
    maturityLevel = 'INTERMEDIO';
    maturityBadge = '🟢 Dominio Intermedio (1-2 años)';
    agePenalty = 0;
  } else {
    maturityLevel = 'MADURO';
    maturityBadge = '✅ Dominio Maduro y Establecido';
    agePenalty = 0;
  }

  // Calcular label legible
  let ageLabel: string;
  if (ageDays <= 0) {
    ageLabel = 'Sin registro DNS';
  } else if (ageDays < 30) {
    ageLabel = `Creado hace ${ageDays} día${ageDays !== 1 ? 's' : ''}`;
  } else if (ageDays < 365) {
    const months = Math.floor(ageDays / 30);
    ageLabel = `Creado hace ${months} mes${months !== 1 ? 'es' : ''}`;
  } else {
    const years = Math.floor(ageDays / 365);
    const remainingMonths = Math.floor((ageDays % 365) / 30);
    ageLabel = `Creado hace ${years} año${years !== 1 ? 's' : ''}`;
    if (remainingMonths > 0) {
      ageLabel += ` y ${remainingMonths} mes${remainingMonths !== 1 ? 'es' : ''}`;
    }
  }

  return {
    domainCreatedDate: createdDateStr,
    domainAgeDays: ageDays,
    ageLabel,
    maturityLevel,
    maturityBadge,
    agePenalty,
    isNewDomain,
    isYoungDomain,
  };
}

// ─────────────────────────────────────────────────────────────────
// FUNCIÓN PRINCIPAL DE VERIFICACIÓN
// ─────────────────────────────────────────────────────────────────

/**
 * Evalúa la sintaxis, registros MX simulados/heurísticos, existencia del correo,
 * país de origen y antigüedad del dominio.
 */
export function verifyEmailExistence(emailRaw?: string): EmailVerificationResult | null {
  if (!emailRaw || !emailRaw.trim()) return null;

  const email = emailRaw.trim().toLowerCase();

  // 1. Sintaxis RFC
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  if (!emailRegex.test(email)) {
    const domain = email.split('@')[1] || '';
    return {
      email,
      domain,
      status: 'INVALID_FORMAT',
      isDeliverable: false,
      isDisposable: false,
      mxValid: false,
      scorePenalty: 30,
      badgeText: 'Formato Inválido',
      alertTitle: 'Sintaxis de Correo Inválida',
      alertMessage: 'La dirección no cumple con los estándares RFC de correo electrónico.',
      country: detectCountry(domain),
      age: estimateDomainAge(domain),
    };
  }

  const [username, domain] = email.split('@');

  // Detectar país y antigüedad (se aplica a todos los escenarios)
  const country = detectCountry(domain);
  const age = estimateDomainAge(domain);

  // La penalidad total combina la penalidad base del status + la penalidad por antigüedad
  const baseAgePenalty = age.agePenalty;

  // 2. Correo temporal / descartable
  if (DISPOSABLE_DOMAINS.has(domain)) {
    return {
      email,
      domain,
      status: 'DISPOSABLE',
      isDeliverable: true,
      isDisposable: true,
      mxValid: true,
      scorePenalty: 25 + baseAgePenalty,
      badgeText: 'Correo Temporal / Descartable',
      alertTitle: 'Advertencia: Proveedor Descartable Detectado',
      alertMessage: `El dominio @${domain} pertenece a un servicio de correos efímeros (10-minute mail), vector frecuente de fraude y robo de identidad.`,
      country,
      age,
    };
  }

  // 3. Dominio inexistente, sin MX o ficticio
  const isTypoTld = domain.endsWith('.con') || domain.endsWith('.invalid') || domain.endsWith('.test');
  const isKnownFake = KNOWN_NON_EXISTENT_DOMAINS.has(domain);
  const isSyntheticUser =
    username.includes('noexiste') ||
    username.includes('fake') ||
    username.includes('invalido') ||
    username.includes('test_bounce');

  if (isTypoTld || isKnownFake || isSyntheticUser) {
    return {
      email,
      domain,
      status: 'NON_EXISTENT',
      isDeliverable: false,
      isDisposable: false,
      mxValid: false,
      scorePenalty: 35 + baseAgePenalty,
      badgeText: 'Email Inexistente',
      alertTitle: 'Alerta Crítica: El Correo Consultado NO EXISTE',
      alertMessage: `El dominio @${domain} o el buzón consultado no existe en los servidores de correo (sin registros DNS MX o buzón desconocido 550). Alta probabilidad de cuenta falsa o identidad inventada.`,
      country,
      age,
    };
  }

  // 4. Correo existente y válido — aún puede tener penalidad por dominio joven
  return {
    email,
    domain,
    status: 'EXISTING',
    isDeliverable: true,
    isDisposable: false,
    mxValid: true,
    scorePenalty: baseAgePenalty, // Solo penalidad por antigüedad si aplica
    badgeText: baseAgePenalty > 0
      ? `Buzón Existente — ${age.maturityBadge}`
      : 'Buzón Existente y Activo',
    country,
    age,
  };
}

/**
 * Simula el envío de un correo de verificación / código OTP con handshake SMTP.
 */
export async function simulateSendVerificationEmail(email: string): Promise<{
  success: boolean;
  message: string;
  otpCode?: string;
  bounceCode?: string;
}> {
  // Simular latencia de conexión SMTP
  await new Promise(resolve => setTimeout(resolve, 800));

  const verification = verifyEmailExistence(email);

  if (!verification || verification.status === 'NON_EXISTENT' || verification.status === 'INVALID_FORMAT') {
    return {
      success: false,
      message: `Rebote Inmediato (Hard Bounce - 550 Mailbox not found). El correo no pudo ser entregado a "${email}" porque el servidor o buzón no existe.`,
      bounceCode: '550 5.1.1 User unknown / Host not found',
    };
  }

  // Correo existente o descartable
  const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
  return {
    success: true,
    message: `Código de verificación OTP [${otpCode}] enviado exitosamente a "${email}". Servidor MX respondió 250 OK.`,
    otpCode,
  };
}
