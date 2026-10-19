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
import SessionTimeoutGuard from '@/components/SessionTimeoutGuard';

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

  // Determinar el reino estricto de la ventana / pestaña actual basado en la URL
  const isAdminRealm = typeof window !== 'undefined' && (
    window.location.pathname.toLowerCase().startsWith('/admin') ||
    window.location.hash.toLowerCase().includes('admin') ||
    window.location.search.toLowerCase().includes('admin')
  );

  // ── ROUTE: Landing Opcional de Presentación Institucional ──
  if (currentRoute === 'landing') {
    return (
      <InstitutionalGateway
        onSelectAdmin={() => {
          if (typeof window !== 'undefined') window.location.hash = 'admin-login';
          setCurrentRoute('admin-login');
        }}
        onSelectPartner={() => {
          if (typeof window !== 'undefined') window.location.hash = 'partner-login';
          setCurrentRoute('partner-login');
        }}
      />
    );
  }

  // ── REINO ADMIN: Si la URL es explícitamente de administración (/admin o #admin) ──
  if (isAdminRealm) {
    if (currentRoute === 'admin-portal' && adminSession?.isAuthenticated) {
      return (
        <>
          <SessionTimeoutGuard />
          <AdminConsortiumPortal
            onLogout={() => {
              logoutAdmin();
              setCurrentRoute('admin-login');
            }}
          />
        </>
      );
    }

    return (
      <UnifiedLogin
        portalType="admin"
        onSuccess={() => setCurrentRoute('admin-portal')}
        onNavigateHome={() => {
          if (typeof window !== 'undefined') {
            window.location.hash = 'partner-login';
          }
          setCurrentRoute('partner-login');
        }}
      />
    );
  }

  // ── REINO BANCOS / FINTECHS: La raíz y todo lo que no sea admin ──
  // Si la sesión de partner está activa, renderizar SIEMPRE el portal del banco
  if (partnerSession?.isAuthenticated) {
    return (
      <>
        <SessionTimeoutGuard />
        <EntityPortal
          fintechId={partnerSession.entityId}
          onLogout={() => {
            logoutPartner();
            setCurrentRoute('partner-login');
          }}
        />
      </>
    );
  }

  // Si no está autenticado como partner, renderizar el login de bancos/fintechs
  return (
    <UnifiedLogin
      portalType="partner"
      onSuccess={() => setCurrentRoute('partner-portal')}
      onNavigateAdmin={() => {
        if (typeof window !== 'undefined') {
          window.location.hash = 'admin-login';
        }
        setCurrentRoute('admin-login');
      }}
      onNavigateHome={() => {
        if (typeof window !== 'undefined') {
          window.location.hash = 'partner-login';
        }
        setCurrentRoute('partner-login');
      }}
    />
  );
}
