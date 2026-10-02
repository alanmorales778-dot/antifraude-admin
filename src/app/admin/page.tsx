'use client';

import React from 'react';
import { useConsortiumStore } from '@/lib/store';
import AdminConsortiumPortal from '@/components/AdminConsortiumPortal';
import AdminLogin from '@/components/AdminLogin';

export default function AdminPage() {
  const { adminSession, logoutAdmin } = useConsortiumStore();

  if (!adminSession?.isAuthenticated) {
    return (
      <AdminLogin
        onSuccess={() => {}}
        showPartnerLink={false}
      />
    );
  }

  return (
    <AdminConsortiumPortal
      onLogout={() => {
        logoutAdmin();
      }}
    />
  );
}
