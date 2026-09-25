import { NextRequest, NextResponse } from 'next/server';
import { evaluateRisk } from '@/lib/risk-engine';
import { IdentifierType } from '@/lib/types';
import { db } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    let tenantId = 'tenant-mp'; // Default demo tenant

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const apiKey = authHeader.replace('Bearer ', '').trim();
      const tenant = await db.getTenantByApiKey(apiKey);
      if (tenant) {
        tenantId = tenant.id;
      }
    }

    const body = await req.json().catch(() => ({}));
    const { identifier_type, identifier_value, client_ip } = body;

    if (!identifier_type || !identifier_value) {
      return NextResponse.json(
        {
          error: 'BAD_REQUEST',
          message: 'Se requieren identifier_type (EMAIL, DNI, PHONE, TAX_ID) e identifier_value',
        },
        { status: 400 }
      );
    }

    const validTypes: IdentifierType[] = ['EMAIL', 'DNI', 'PHONE', 'IP', 'CBU', 'CBU_CVU', 'TAX_ID', 'CARD_BIN'];
    if (!validTypes.includes(identifier_type as IdentifierType)) {
      return NextResponse.json(
        {
          error: 'INVALID_IDENTIFIER_TYPE',
          message: `El tipo debe ser uno de: ${validTypes.join(', ')}`,
        },
        { status: 400 }
      );
    }

    const ip = client_ip || req.headers.get('x-forwarded-for') || '190.210.45.12';

    const result = await evaluateRisk(
      identifier_type as IdentifierType,
      identifier_value,
      tenantId,
      ip
    );

    const formattedData = {
      ...result,
      risk_score: result.riskScore,
      risk_level: result.riskLevel,
      network_matches: result.networkMatches,
      distinct_institutions_count: result.distinctInstitutionsCount,
      blind_hash: result.blindHash,
      identifier_type: result.identifierType,
      primary_reason: result.primaryReason,
      last_reported_at: result.lastReportedAt,
      cryptographic_proof: result.cryptographicProof,
      latency_ms: result.latencyMs,
      kill_switch_triggered: result.killSwitchTriggered,
      risk_matrix: result.riskMatrix,
    };

    return NextResponse.json(
      {
        status: 'success',
        data: formattedData,
      },
      {
        status: 200,
        headers: {
          'X-Consortium-Latency-Ms': result.latencyMs.toString(),
          'X-Consortium-Node': 'arg-buenos-aires-edge-1',
          'X-Zero-Knowledge': 'SHA-256-Blind-Salted',
        },
      }
    );
  } catch (error: any) {
    console.error('Error evaluating risk:', error);
    return NextResponse.json(
      {
        error: 'INTERNAL_SERVER_ERROR',
        message: error.message || 'Error interno al evaluar el riesgo',
      },
      { status: 500 }
    );
  }
}

