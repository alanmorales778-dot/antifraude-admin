'use client';
import PartnerLogin from '@/components/PartnerLogin';
import { useRouter } from 'next/navigation';

export default function PartnerLoginPage() {
  const router = useRouter();
  return (
    <PartnerLogin
      onSuccess={() => router.push('/#partner-portal')}
      onNavigateAdmin={() => router.push('/admin/login')}
      onNavigateHome={() => router.push('/')}
    />
  );
}
