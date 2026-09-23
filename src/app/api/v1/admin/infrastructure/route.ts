import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { redis } from '@/lib/redis';

export async function GET() {
  const infra = db.getSuperAdminInfrastructure();
  const redisStats = redis.getStats();
  const allTenants = await db.getAllTenants();

  return NextResponse.json({
    status: 'success',
    data: {
      infra,
      redisStats,
      tenantsReputation: allTenants.map(t => ({
        id: t.id,
        name: t.name,
        code: t.code,
        trustScore: t.trustScore,
        noiseRate: t.noiseRate,
        inQuarantine: t.inQuarantine,
        subscriptionTier: t.subscriptionTier,
      })),
    },
  });
}
