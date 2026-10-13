'use client';

import React from 'react';
import UnifiedLogin from '@/components/UnifiedLogin';

interface PartnerLoginProps {
  onSuccess?: () => void;
  onNavigateAdmin?: () => void;
  onNavigateHome?: () => void;
  showAdminLink?: boolean;
}

/**
 * Portal de Ingreso Unificado con RBAC y 2FA
 * Rediseñado: Sin selección manual de banco ni API Key.
 * Formulario: Email, Contraseña y "¿Olvidé mi contraseña?".
 * Restringido: Solo cuentas pre-autorizadas por el Administrador.
 */
export default function PartnerLogin({
  onSuccess,
  onNavigateHome,
}: PartnerLoginProps) {
  return (
    <UnifiedLogin
      onSuccess={onSuccess}
      onNavigateHome={onNavigateHome}
    />
  );
}
