'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function TrainerDashboardRedirect() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to the main trainer dashboard at /trainer
    router.replace('/trainer');
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-brand-orange">Loading dashboard...</div>
    </div>
  );
}
