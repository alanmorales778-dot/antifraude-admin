/**
 * Utilidades de 2FA / TOTP (RFC 6238 / RFC 4226)
 * Compatible con Google Authenticator, Microsoft Authenticator, Authy y 1Password.
 * Implementación criptográfica pura con Web Crypto API (SubtleCrypto) y generación de QR real.
 */
import QRCode from 'qrcode';

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

/**
 * Genera un secreto aleatorio Base32 de longitud especificada (por defecto 32 caracteres = 160 bits RFC 4648)
 */
export function generateTOTPSecret(length: number = 32): string {
  const bytes = new Uint8Array(length);
  if (typeof window !== 'undefined' && window.crypto) {
    window.crypto.getRandomValues(bytes);
  } else if (typeof globalThis !== 'undefined' && globalThis.crypto) {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < length; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }

  let secret = '';
  for (let i = 0; i < length; i++) {
    secret += BASE32_ALPHABET[bytes[i] % BASE32_ALPHABET.length];
  }
  return secret;
}

/**
 * Genera el URI estándar otpauth:// para vincular en Google Authenticator
 */
export function generateTOTPUri(
  email: string,
  secret: string,
  issuer: string = 'Consorcio Antifraude'
): string {
  const cleanEmail = email.trim();
  const cleanIssuer = issuer.trim();
  const cleanSecret = secret.replace(/\s+/g, '').toUpperCase();
  return `otpauth://totp/${encodeURIComponent(cleanIssuer)}:${encodeURIComponent(cleanEmail)}?secret=${cleanSecret}&issuer=${encodeURIComponent(cleanIssuer)}&algorithm=SHA1&digits=6&period=30`;
}

/**
 * Genera el código QR en formato SVG puro
 */
export async function generateQRCodeSvg(otpauthUri: string): Promise<string> {
  try {
    return await QRCode.toString(otpauthUri, {
      type: 'svg',
      width: 240,
      margin: 2,
      color: {
        dark: '#050a14',
        light: '#ffffff',
      },
      errorCorrectionLevel: 'M',
    });
  } catch (err) {
    console.error('Error generando SVG de QR code:', err);
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240"><text x="20" y="120" fill="#fff">QR no disponible</text></svg>`;
  }
}

/**
 * Genera el código QR en Data URL base64 usando la librería qrcode
 */
export async function generateQRCodeDataUrl(otpauthUri: string): Promise<string> {
  try {
    return await QRCode.toDataURL(otpauthUri, {
      width: 240,
      margin: 2,
      color: {
        dark: '#050a14',
        light: '#ffffff',
      },
      errorCorrectionLevel: 'M',
    });
  } catch (err) {
    console.error('Error generando QR code:', err);
    // Fallback URL de respaldo en caso extremo
    return `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(otpauthUri)}`;
  }
}

/**
 * Decodifica una cadena Base32 a Uint8Array
 */
function base32ToUint8Array(base32: string): Uint8Array {
  const clean = base32.toUpperCase().replace(/=+$/, '').replace(/\s+/g, '');
  let bits = '';
  for (let i = 0; i < clean.length; i++) {
    const val = BASE32_ALPHABET.indexOf(clean[i]);
    if (val === -1) continue;
    bits += val.toString(2).padStart(5, '0');
  }

  const bytes = new Uint8Array(Math.floor(bits.length / 8));
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(bits.substring(i * 8, (i + 1) * 8), 2);
  }
  return bytes;
}

/**
 * Calcula el código TOTP dinámico de 6 dígitos para un timestamp dado usando HMAC-SHA1
 */
export async function generateTOTP(
  secret: string,
  timeStepSeconds: number = 30,
  forTimestampMs: number = Date.now()
): Promise<string> {
  const counter = Math.floor(forTimestampMs / 1000 / timeStepSeconds);
  const keyBytes = base32ToUint8Array(secret);

  // Convertir el contador a un buffer de 8 bytes (Big-Endian)
  const counterBuffer = new ArrayBuffer(8);
  const counterView = new DataView(counterBuffer);
  // En JS BigInt para los 64 bits
  counterView.setBigUint64(0, BigInt(counter), false);

  const cryptoObj = typeof window !== 'undefined' ? window.crypto : globalThis.crypto;
  const key = await cryptoObj.subtle.importKey(
    'raw',
    keyBytes as ArrayBufferView<ArrayBuffer>,
    { name: 'HMAC', hash: { name: 'SHA-1' } },
    false,
    ['sign']
  );

  const signature = await cryptoObj.subtle.sign('HMAC', key, counterBuffer);
  const hmac = new Uint8Array(signature);

  // Dynamic Truncation (RFC 4226)
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);

  const otp = binary % 1000000;
  return otp.toString().padStart(6, '0');
}

/**
 * Valida criptográficamente un código TOTP de 6 dígitos ingresado por el usuario
 * Ventana de tolerancia: ±1 paso de tiempo (±30 segundos) para mitigar desviaciones de reloj.
 */
export async function verifyTOTP(
  token: string,
  secret: string,
  windowSteps: number = 1
): Promise<boolean> {
  const cleanToken = token.trim().replace(/\s+/g, '');
  if (!cleanToken || cleanToken.length !== 6 || !/^\d{6}$/.test(cleanToken)) {
    return false;
  }

  if (!secret) return false;

  const now = Date.now();
  const stepMs = 30 * 1000;

  for (let i = -windowSteps; i <= windowSteps; i++) {
    try {
      const generated = await generateTOTP(secret, 30, now + i * stepMs);
      if (generated === cleanToken) {
        return true;
      }
    } catch (err) {
      console.warn('Error calculando paso TOTP:', err);
    }
  }

  return false;
}
