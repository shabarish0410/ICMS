'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function EquipmentPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/dashboard');
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <p className="text-dark-400 text-sm">Redirecting...</p>
    </div>
  );
}
