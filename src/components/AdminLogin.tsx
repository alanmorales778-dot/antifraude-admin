'use client';

import React from 'react';
import UnifiedLogin from '@/components/UnifiedLogin';

interface AdminLoginProps {
  onSuccess?: () => void;
  onNavigatePartner?: () => void;
  onNavigateHome?: () => void;
  showPartnerLink?: boolean;
}

/**
 * Portal Central de Gobernanza - Acceso Unificado RBAC + 2FA
 * Rediseñado: Sin campos redundantes.
 * Formulario: Email, Contraseña y "¿Olvidé mi contraseña?".
 * Redirige automáticamente al Panel Central si la cuenta tiene rol Admin.
 */
export default function AdminLogin({
  onSuccess,
  onNavigateHome,
}: AdminLoginProps) {
  return (
    <UnifiedLogin
      portalType="admin"
      onSuccess={onSuccess}
      onNavigateHome={onNavigateHome}
    />
  );
}
