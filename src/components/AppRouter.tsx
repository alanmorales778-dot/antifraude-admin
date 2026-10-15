'use client';

import React, { useEffect } from 'react';
import { useConsortiumStore } from '@/lib/store';
import { AppRoute } from '@/lib/types';
import InstitutionalGateway from '@/components/InstitutionalGateway';
import AdminLogin from '@/components/AdminLogin';
import AdminConsortiumPortal from '@/components/AdminConsortiumPortal';
import PartnerLogin from '@/components/PartnerLogin';
import EntityPortal from '@/components/EntityPortal';
import UnifiedLogin from '@/components/UnifiedLogin';

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
      const state = useConsortiumStore.getState();

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
        if (hash === 'admin-portal' || queryRoute === 'admin-portal' || (state.adminSession?.isAuthenticated && !hash.includes('login'))) {
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
        if (hash === 'partner-portal' || queryRoute === 'partner-portal' || (state.partnerSession?.isAuthenticated && !hash.includes('login'))) {
          setCurrentRoute('partner-portal');
        } else {
          setCurrentRoute('partner-login');
        }
        return;
      }

      // En la raíz sin parámetros específicos:
      // Exclusivamente portal bancario/partner (aislamiento estricto contra el portal Admin):
      if (state.partnerSession?.isAuthenticated) {
        setCurrentRoute('partner-portal');
      } else {
        // Pantalla Principal por defecto: Exclusivamente inicio de sesión para Empresas, Fintechs o Bancos
        setCurrentRoute('partner-login');
      }
    };

    handleLocationChange();
    window.addEventListener('hashchange', handleLocationChange);
    return () => window.removeEventListener('hashchange', handleLocationChange);
  }, [setCurrentRoute]);

  // ── ROUTE: Landing Opcional de Presentación Institucional ──
  if (currentRoute === 'landing') {
    return (
      <InstitutionalGateway
        onSelectAdmin={() => setCurrentRoute('admin-login')}
        onSelectPartner={() => setCurrentRoute('partner-login')}
      />
    );
  }

  // ── ROUTE: Admin Login (Gobernanza Central / SuperAdmin) ──
  if (currentRoute === 'admin-login') {
    return (
      <UnifiedLogin
        portalType="admin"
        onSuccess={() => setCurrentRoute('admin-portal')}
        onNavigateHome={() => setCurrentRoute('partner-login')}
      />
    );
  }

  // ── ROUTE: Admin Portal (Gobernanza Central) ──
  if (currentRoute === 'admin-portal') {
    // Auth Guard
    if (!adminSession?.isAuthenticated) {
      return (
        <UnifiedLogin
          portalType="admin"
          onSuccess={() => setCurrentRoute('admin-portal')}
          onNavigateHome={() => setCurrentRoute('partner-login')}
        />
      );
    }

    return (
      <AdminConsortiumPortal
        onLogout={() => {
          logoutAdmin();
          setCurrentRoute('admin-login');
        }}
      />
    );
  }

  // ── ROUTE: Partner / Bancos / Fintechs Login (Pantalla Principal) ──
  if (currentRoute === 'partner-login') {
    return (
      <UnifiedLogin
        portalType="partner"
        onSuccess={() => setCurrentRoute('partner-portal')}
        onNavigateAdmin={() => setCurrentRoute('admin-login')}
        onNavigateHome={() => setCurrentRoute('partner-login')}
      />
    );
  }

  // ── ROUTE: Partner Portal (Página del Propio Banco / Internal Risk Workspace) ──
  if (currentRoute === 'partner-portal') {
    // Auth Guard
    if (!partnerSession?.isAuthenticated) {
      return (
        <UnifiedLogin
          portalType="partner"
          onSuccess={() => setCurrentRoute('partner-portal')}
          onNavigateAdmin={() => setCurrentRoute('admin-login')}
          onNavigateHome={() => setCurrentRoute('partner-login')}
        />
      );
    }

    return (
      <EntityPortal
        fintechId={partnerSession.entityId}
        onLogout={() => {
          logoutPartner();
          setCurrentRoute('partner-login');
        }}
      />
    );
  }

  // Default fallback: Inicio de sesión de Bancos, Fintechs y Empresas
  return (
    <UnifiedLogin
      portalType="partner"
      onSuccess={() => setCurrentRoute('partner-portal')}
      onNavigateAdmin={() => setCurrentRoute('admin-login')}
      onNavigateHome={() => setCurrentRoute('partner-login')}
    />
  );
}
