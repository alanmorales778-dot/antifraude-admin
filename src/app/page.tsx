'use client';

export const dynamic = 'force-dynamic';
export const revalidate = 0;


import React, { useEffect, useState } from 'react';
import { useConsortiumStore } from '@/lib/store';
import EntityPortal from '@/components/EntityPortal';
import PartnerLogin from '@/components/PartnerLogin';

export default function Page() {
  const { partnerSession, logoutPartner, initSeedData } = useConsortiumStore();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    initSeedData();
  }, [initSeedData]);

  if (!mounted) {
    return null;
  }

  // Si la sesión de partner está activa, renderizar exclusivamente el portal de la entidad financiera
  if (partnerSession?.isAuthenticated) {
    return (
      <EntityPortal
        fintechId={partnerSession.entityId}
        onLogout={() => {
          logoutPartner();
        }}
      />
    );
  }

  // De lo contrario, renderizar el portal de acceso para Bancos, Fintechs y Empresas
  return (
    <PartnerLogin
      onSuccess={() => {}}
      showAdminLink={true}
      onNavigateAdmin={() => {
        if (typeof window !== 'undefined') {
          window.location.href = '/admin';
        }
      }}
    />
  );
}
