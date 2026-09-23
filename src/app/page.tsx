'use client';

import React, { useState, useEffect } from 'react';
import LoginScreen from '@/components/LoginScreen';
import AdminPortal from '@/components/AdminPortal';
import EntityPortal from '@/components/EntityPortal';
import { useConsortiumStore } from '@/lib/store';

type AppScreen = 'login' | 'admin' | 'entity';

export default function Home() {
  const [screen, setScreen] = useState<AppScreen>('login');
  const [entityFintechId, setEntityFintechId] = useState('fintech-alpha');
  const { initSeedData } = useConsortiumStore();

  // Pre-computar hashes con Web Crypto API al montar
  useEffect(() => {
    initSeedData();
  }, [initSeedData]);

  if (screen === 'login') {
    return (
      <LoginScreen
        onEnterAdmin={() => setScreen('admin')}
        onEnterEntity={(fintechId) => {
          setEntityFintechId(fintechId);
          setScreen('entity');
        }}
      />
    );
  }

  if (screen === 'admin') {
    return <AdminPortal onLogout={() => setScreen('login')} />;
  }

  return (
    <EntityPortal
      fintechId={entityFintechId}
      onLogout={() => setScreen('login')}
    />
  );
}
