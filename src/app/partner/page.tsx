'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useConsortiumStore } from '@/lib/store';
import EntityPortal from '@/components/EntityPortal';

export default function PartnerPage() {
  const router = useRouter();
  const { partnerSession, logoutPartner } = useConsortiumStore();

  useEffect(() => {
    if (!partnerSession?.isAuthenticated) {
      router.replace('/partner/login');
    }
  }, [partnerSession, router]);

  if (!partnerSession?.isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#f7f6f1] flex items-center justify-center font-mono text-xs text-[#697887]">
        Verificando credenciales de Entidad Participante...
      </div>
    );
  }

  return (
    <EntityPortal
      fintechId={partnerSession.entityId}
      onLogout={() => {
        logoutPartner();
        router.push('/partner/login');
      }}
    />
  );
}
