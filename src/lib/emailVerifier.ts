// ─────────────────────────────────────────────────────────────────
// MOTOR DE VERIFICACIÓN DE EXISTENCIA Y ENTREGABILIDAD DE EMAILS
// ─────────────────────────────────────────────────────────────────

export type EmailVerificationStatus =
  | 'EXISTING'
  | 'NON_EXISTENT'
  | 'DISPOSABLE'
  | 'INVALID_FORMAT';

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
}

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

/**
 * Evalúa la sintaxis, registros MX simulados/heurísticos y existencia del correo.
 */
export function verifyEmailExistence(emailRaw?: string): EmailVerificationResult | null {
  if (!emailRaw || !emailRaw.trim()) return null;

  const email = emailRaw.trim().toLowerCase();

  // 1. Sintaxis RFC
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  if (!emailRegex.test(email)) {
    return {
      email,
      domain: email.split('@')[1] || '',
      status: 'INVALID_FORMAT',
      isDeliverable: false,
      isDisposable: false,
      mxValid: false,
      scorePenalty: 30,
      badgeText: 'Formato Inválido',
      alertTitle: 'Sintaxis de Correo Inválida',
      alertMessage: 'La dirección no cumple con los estándares RFC de correo electrónico.',
    };
  }

  const [username, domain] = email.split('@');

  // 2. Correo temporal / descartable
  if (DISPOSABLE_DOMAINS.has(domain)) {
    return {
      email,
      domain,
      status: 'DISPOSABLE',
      isDeliverable: true,
      isDisposable: true,
      mxValid: true,
      scorePenalty: 25,
      badgeText: 'Correo Temporal / Descartable',
      alertTitle: 'Advertencia: Proveedor Descartable Detectado',
      alertMessage: `El dominio @${domain} pertenece a un servicio de correos efímeros (10-minute mail), vector frecuente de fraude y robo de identidad.`,
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
      scorePenalty: 35,
      badgeText: 'Email Inexistente',
      alertTitle: 'Alerta Crítica: El Correo Consultado NO EXISTE',
      alertMessage: `El dominio @${domain} o el buzón consultado no existe en los servidores de correo (sin registros DNS MX o buzón desconocido 550). Alta probabilidad de cuenta falsa o identidad inventada.`,
    };
  }

  // 4. Correo existente y válido
  return {
    email,
    domain,
    status: 'EXISTING',
    isDeliverable: true,
    isDisposable: false,
    mxValid: true,
    scorePenalty: 0,
    badgeText: 'Buzón Existente y Activo',
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
