'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getUser } from '@/lib/auth';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    const u = getUser();
    router.replace(!u ? '/login' : u.role === 'brand' ? '/brand' : '/creator');
  }, [router]);

  return <main className="p-8 text-sm">Loading…</main>;
}