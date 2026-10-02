'use client';
import AdminLogin from '@/components/AdminLogin';
import { useRouter } from 'next/navigation';

export default function AdminLoginPage() {
  const router = useRouter();
  return (
    <AdminLogin
      onSuccess={() => router.push('/admin')}
      onNavigatePartner={() => router.push('/partner/login')}
      onNavigateHome={() => router.push('/')}
    />
  );
}
