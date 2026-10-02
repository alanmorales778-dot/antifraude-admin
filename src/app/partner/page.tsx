'use client';

import React from 'react';
import { useConsortiumStore } from '@/lib/store';
import EntityPortal from '@/components/EntityPortal';
import PartnerLogin from '@/components/PartnerLogin';

export default function PartnerPage() {
  const { partnerSession, logoutPartner } = useConsortiumStore();

  if (!partnerSession?.isAuthenticated) {
    return (
      <PartnerLogin
        onSuccess={() => {}}
        showAdminLink={false}
      />
    );
  }

  return (
    <EntityPortal
      fintechId={partnerSession.entityId}
      onLogout={() => {
        logoutPartner();
      }}
    />
  );
}
