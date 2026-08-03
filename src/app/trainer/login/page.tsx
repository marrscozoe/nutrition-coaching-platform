'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function TrainerLoginPage() {
  const router = useRouter();

  useEffect(() => {
    // Trainer login is handled on the home page with the Trainer Login toggle
    // Redirect to home page where trainers can log in
    router.replace('/');
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-brand-orange">Redirecting to login...</div>
    </div>
  );
}
