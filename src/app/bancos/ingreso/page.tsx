'use client';
import PartnerLogin from '@/components/PartnerLogin';
import { useRouter } from 'next/navigation';

export default function BancosIngresoPage() {
  const router = useRouter();
  return (
    <PartnerLogin
      onSuccess={() => router.push('/partner')}
      onNavigateAdmin={() => router.push('/admin/login')}
      onNavigateHome={() => router.push('/')}
    />
  );
}
