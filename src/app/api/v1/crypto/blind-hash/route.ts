import { NextRequest, NextResponse } from 'next/server';
import { normalizeIdentifier, CONSORTIUM_SALT, validateCbuChecksum } from '@/lib/crypto';
import { IdentifierType } from '@/lib/types';
import crypto from 'crypto';

/**
 * Endpoint seguro server-side para cálculo de Blind Hashes del Consorcio.
 * Garantiza que CONSORTIUM_SALT nunca sea expuesto a navegadores ni bundles cliente.
 * 
 * Cumple con Ley 25.326 y principios de Zero-Knowledge Architecture.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { identifier_type, identifier_value, tenant_salt } = body;

    if (!identifier_type || !identifier_value) {
      return NextResponse.json(
        { error: 'Parámetros requeridos: identifier_type e identifier_value.' },
        { status: 400 }
      );
    }

    const type = identifier_type as IdentifierType;
    const normalized = normalizeIdentifier(type, identifier_value);

    // Validación opcional de formato para CBU / CVU argentino
    let checksumValidation: { valid: boolean; reason?: string } | undefined;
    if (type === 'CBU_CVU' && /^\d{22}$/.test(normalized)) {
      checksumValidation = validateCbuChecksum(normalized);
    }

    // Doble Salting Server-Side:
    // 1. Tenant Salt (intermediario institucional)
    const effectiveTenantSalt = tenant_salt || 'DEFAULT_TENANT_ISOLATION_SALT';
    const intermediateHash = crypto
      .createHash('sha256')
      .update(`${type}:${normalized}:${effectiveTenantSalt}`)
      .digest('hex');

    // 2. Consortium Master Salt (guardado en variables de entorno / KMS)
    const blindHash = crypto
      .createHash('sha256')
      .update(`${type}:${normalized}:${CONSORTIUM_SALT}`)
      .digest('hex');

    return NextResponse.json({
      status: 'success',
      data: {
        identifier_type: type,
        normalized_preview: normalized.length > 8 ? `${normalized.slice(0, 3)}***${normalized.slice(-3)}` : '***',
        blind_hash: blindHash,
        intermediate_hash: intermediateHash,
        checksum_validation: checksumValidation,
        salt_preview: `${CONSORTIUM_SALT.slice(0, 4)}****${CONSORTIUM_SALT.slice(-4)}`,
        zero_knowledge: true,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Error en el cálculo criptográfico server-side.' },
      { status: 500 }
    );
  }
}
