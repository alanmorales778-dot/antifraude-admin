import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  try {
    const tenants = await db.getAllTenants();
    // Omitir api keys privadas en la lista pública de tenants
    const safeTenants = tenants.map(t => ({
      id: t.id,
      name: t.name,
      code: t.code,
      subscriptionTier: t.subscriptionTier,
      trustScore: t.trustScore,
      status: t.status,
      joinedAt: t.joinedAt,
      logo: t.logo,
      apiKeyPreview: `${t.apiKey.slice(0, 12)}...${t.apiKey.slice(-4)}`,
    }));

    return NextResponse.json({
      status: 'success',
      count: safeTenants.length,
      data: safeTenants,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
