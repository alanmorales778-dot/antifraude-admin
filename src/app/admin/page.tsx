'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useConsortiumStore } from '@/lib/store';
import AdminConsortiumPortal from '@/components/AdminConsortiumPortal';

export default function AdminPage() {
  const router = useRouter();
  const { adminSession, logoutAdmin } = useConsortiumStore();

  useEffect(() => {
    if (!adminSession?.isAuthenticated) {
      router.replace('/admin/login');
    }
  }, [adminSession, router]);

  if (!adminSession?.isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#f5f4ef] flex items-center justify-center font-mono text-xs text-[#717d8a]">
        Verificando credenciales de Gobernanza...
      </div>
    );
  }

  return (
    <AdminConsortiumPortal
      onLogout={() => {
        logoutAdmin();
        router.push('/admin/login');
      }}
    />
  );
}
