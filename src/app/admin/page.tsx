'use client';

import React, { useEffect, useState } from 'react';
import { useConsortiumStore } from '@/lib/store';
import AdminConsortiumPortal from '@/components/AdminConsortiumPortal';
import AdminLogin from '@/components/AdminLogin';

export default function AdminPage() {
  const { adminSession, logoutAdmin, initSeedData } = useConsortiumStore();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    initSeedData();
  }, [initSeedData]);

  if (!mounted) {
    return null;
  }

  if (!adminSession?.isAuthenticated) {
    return (
      <AdminLogin
        onSuccess={() => {}}
        showPartnerLink={true}
        onNavigatePartner={() => {
          if (typeof window !== 'undefined') {
            window.location.href = '/';
          }
        }}
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
