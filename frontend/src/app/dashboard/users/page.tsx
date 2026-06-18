'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function UsersPage() {
  const router = useRouter();

  useEffect(() => {
    // Users page merged into Students management in ICMS v2
    router.replace('/dashboard/students');
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <p className="text-dark-400 text-sm">Redirecting to Student Management...</p>
    </div>
  );
}
