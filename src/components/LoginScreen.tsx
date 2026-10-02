'use client';
import InstitutionalGateway from '@/components/InstitutionalGateway';
export default function LoginScreen({ onEnterAdmin, onEnterEntity }: { onEnterAdmin?: () => void; onEnterEntity?: (id: string) => void }) {
  return (
    <InstitutionalGateway
      onSelectAdmin={onEnterAdmin || (() => {})}
      onSelectPartner={() => { if (onEnterEntity) onEnterEntity('fintech-alpha'); }}
    />
  );
}
