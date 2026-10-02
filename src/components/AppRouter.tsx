'use client';

import React, { useEffect } from 'react';
import { useConsortiumStore } from '@/lib/store';
import { AppRoute } from '@/lib/types';
import InstitutionalGateway from '@/components/InstitutionalGateway';
import AdminLogin from '@/components/AdminLogin';
import AdminConsortiumPortal from '@/components/AdminConsortiumPortal';
import PartnerLogin from '@/components/PartnerLogin';
import EntityPortal from '@/components/EntityPortal';

export default function AppRouter() {
  const {
    currentRoute,
    setCurrentRoute,
    adminSession,
    partnerSession,
    logoutAdmin,
    logoutPartner,
    initSeedData,
  } = useConsortiumStore();

  // Inicializar semillas y sincronización
  useEffect(() => {
    initSeedData();
  }, [initSeedData]);

  // Sincronizar ruta con la URL del navegador (hash o query param)
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleLocationChange = () => {
      const hash = window.location.hash.replace('#', '').trim();
      const params = new URLSearchParams(window.location.search);
      const queryRoute = params.get('route') || params.get('path');
      const target = hash || queryRoute;

      if (target === 'admin/login' || target === 'admin-login') {
        setCurrentRoute('admin-login');
      } else if (target === 'admin' || target === 'admin/portal' || target === 'admin-portal') {
        setCurrentRoute('admin-portal');
      } else if (target === 'partner/login' || target === 'partner-login' || target === 'bancos/ingreso') {
        setCurrentRoute('partner-login');
      } else if (target === 'partner' || target === 'partner/portal' || target === 'partner-portal') {
        setCurrentRoute('partner-portal');
      }
    };

    handleLocationChange();
    window.addEventListener('hashchange', handleLocationChange);
    return () => window.removeEventListener('hashchange', handleLocationChange);
  }, [setCurrentRoute]);

  // Actualizar el hash de la URL cuando cambia currentRoute
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const targetHash = `#${currentRoute}`;
    if (window.location.hash !== targetHash) {
      window.history.replaceState(null, '', targetHash);
    }
  }, [currentRoute]);

  // ── ROUTE 1: Landing / Gateway ──
  if (currentRoute === 'landing') {
    return (
      <InstitutionalGateway
        onSelectAdmin={() => setCurrentRoute('admin-login')}
        onSelectPartner={() => setCurrentRoute('partner-login')}
      />
    );
  }

  // ── ROUTE 2: Admin Login ──
  if (currentRoute === 'admin-login') {
    return (
      <AdminLogin
        onSuccess={() => setCurrentRoute('admin-portal')}
        onNavigatePartner={() => setCurrentRoute('partner-login')}
        onNavigateHome={() => setCurrentRoute('landing')}
      />
    );
  }

  // ── ROUTE 3: Admin Portal (Protegida) ──
  if (currentRoute === 'admin-portal') {
    // Auth Guard
    if (!adminSession?.isAuthenticated) {
      return (
        <AdminLogin
          onSuccess={() => setCurrentRoute('admin-portal')}
          onNavigatePartner={() => setCurrentRoute('partner-login')}
          onNavigateHome={() => setCurrentRoute('landing')}
        />
      );
    }

    return <AdminConsortiumPortal onLogout={logoutAdmin} />;
  }

  // ── ROUTE 4: Partner / Bancos Login ──
  if (currentRoute === 'partner-login') {
    return (
      <PartnerLogin
        onSuccess={() => setCurrentRoute('partner-portal')}
        onNavigateAdmin={() => setCurrentRoute('admin-login')}
        onNavigateHome={() => setCurrentRoute('landing')}
      />
    );
  }

  // ── ROUTE 5: Partner Portal (Protegida) ──
  if (currentRoute === 'partner-portal') {
    // Auth Guard
    if (!partnerSession?.isAuthenticated) {
      return (
        <PartnerLogin
          onSuccess={() => setCurrentRoute('partner-portal')}
          onNavigateAdmin={() => setCurrentRoute('admin-login')}
          onNavigateHome={() => setCurrentRoute('landing')}
        />
      );
    }

    return (
      <EntityPortal
        fintechId={partnerSession.entityId}
        onLogout={logoutPartner}
      />
    );
  }

  // Default fallback
  return (
    <InstitutionalGateway
      onSelectAdmin={() => setCurrentRoute('admin-login')}
      onSelectPartner={() => setCurrentRoute('partner-login')}
    />
  );
}
