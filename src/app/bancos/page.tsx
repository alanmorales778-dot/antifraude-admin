'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function BancosPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/partner/login');
  }, [router]);
  return null;
}
