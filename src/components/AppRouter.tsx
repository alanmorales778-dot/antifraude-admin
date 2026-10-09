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

  // Sincronizar ruta con la URL del navegador (pathname, hash, query param)
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleLocationChange = () => {
      const pathname = window.location.pathname.toLowerCase();
      const hash = window.location.hash.replace('#', '').trim().toLowerCase();
      const params = new URLSearchParams(window.location.search);
      const queryRoute = (params.get('route') || params.get('path') || '').toLowerCase();
      const host = window.location.hostname.toLowerCase();

      // Rutas explícitas de aterrizaje institucional oficial
      if (hash === 'landing' || queryRoute === 'landing') {
        setCurrentRoute('landing');
        return;
      }

      // Si el subdominio/host o la ruta contiene 'admin':
      const isAdminContext =
        host.includes('admin') ||
        pathname.startsWith('/admin') ||
        hash.includes('admin') ||
        queryRoute.includes('admin');

      if (isAdminContext) {
        if (hash === 'admin-portal' || queryRoute === 'admin-portal' || (adminSession?.isAuthenticated && !hash.includes('login'))) {
          setCurrentRoute('admin-portal');
        } else {
          setCurrentRoute('admin-login');
        }
        return;
      }

      // Contexto explícito de empresa / banco / participante
      const isPartnerContext =
        hash.includes('partner') ||
        hash.includes('banco') ||
        hash.includes('empresa') ||
        queryRoute.includes('partner') ||
        queryRoute.includes('banco') ||
        queryRoute.includes('empresa');

      if (isPartnerContext) {
        if (hash === 'partner-portal' || queryRoute === 'partner-portal' || (partnerSession?.isAuthenticated && !hash.includes('login'))) {
          setCurrentRoute('partner-portal');
        } else {
          setCurrentRoute('partner-login');
        }
        return;
      }

      // En la raíz sin parámetros específicos:
      if (adminSession?.isAuthenticated) {
        setCurrentRoute('admin-portal');
      } else if (partnerSession?.isAuthenticated) {
        setCurrentRoute('partner-portal');
      } else {
        // Portal Institucional Oficial como pantalla principal
        setCurrentRoute('landing');
      }
    };

    handleLocationChange();
    window.addEventListener('hashchange', handleLocationChange);
    return () => window.removeEventListener('hashchange', handleLocationChange);
  }, [setCurrentRoute, adminSession?.isAuthenticated, partnerSession?.isAuthenticated]);

  // ── ROUTE: Landing Oficial (Institutional Gateway) ──
  if (currentRoute === 'landing') {
    return (
      <InstitutionalGateway
        onSelectAdmin={() => setCurrentRoute('admin-login')}
        onSelectPartner={() => setCurrentRoute('partner-login')}
      />
    );
  }

  // ── ROUTE: Admin Login ──
  if (currentRoute === 'admin-login') {
    return (
      <AdminLogin
        onSuccess={() => setCurrentRoute('admin-portal')}
        onNavigatePartner={() => setCurrentRoute('partner-login')}
        onNavigateHome={() => setCurrentRoute('landing')}
        showPartnerLink={true}
      />
    );
  }

  // ── ROUTE: Admin Portal (Gobernanza Central) ──
  if (currentRoute === 'admin-portal') {
    // Auth Guard
    if (!adminSession?.isAuthenticated) {
      return (
        <AdminLogin
          onSuccess={() => setCurrentRoute('admin-portal')}
          onNavigatePartner={() => setCurrentRoute('partner-login')}
          onNavigateHome={() => setCurrentRoute('landing')}
          showPartnerLink={true}
        />
      );
    }

    return (
      <AdminConsortiumPortal
        onLogout={() => {
          logoutAdmin();
          setCurrentRoute('landing');
        }}
      />
    );
  }

  // ── ROUTE: Partner / Bancos Login ──
  if (currentRoute === 'partner-login') {
    return (
      <PartnerLogin
        onSuccess={() => setCurrentRoute('partner-portal')}
        onNavigateAdmin={() => setCurrentRoute('admin-login')}
        onNavigateHome={() => setCurrentRoute('landing')}
        showAdminLink={true}
      />
    );
  }

  // ── ROUTE: Partner Portal (Internal Risk Workspace) ──
  if (currentRoute === 'partner-portal') {
    // Auth Guard
    if (!partnerSession?.isAuthenticated) {
      return (
        <PartnerLogin
          onSuccess={() => setCurrentRoute('partner-portal')}
          onNavigateAdmin={() => setCurrentRoute('admin-login')}
          onNavigateHome={() => setCurrentRoute('landing')}
          showAdminLink={true}
        />
      );
    }

    return (
      <EntityPortal
        fintechId={partnerSession.entityId}
        onLogout={() => {
          logoutPartner();
          setCurrentRoute('landing');
        }}
      />
    );
  }

  // Default fallback: Portal Institucional Oficial
  return (
    <InstitutionalGateway
      onSelectAdmin={() => setCurrentRoute('admin-login')}
      onSelectPartner={() => setCurrentRoute('partner-login')}
    />
  );
}
