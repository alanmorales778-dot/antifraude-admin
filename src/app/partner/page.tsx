'use client';



import React, { useEffect, useState } from 'react';
import { useConsortiumStore } from '@/lib/store';
import EntityPortal from '@/components/EntityPortal';
import PartnerLogin from '@/components/PartnerLogin';

export default function PartnerPage() {
  const { partnerSession, logoutPartner, initSeedData } = useConsortiumStore();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    initSeedData();
  }, [initSeedData]);

  if (!mounted) {
    return null;
  }

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
