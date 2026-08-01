'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function ClientSignupPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to the main signup page
    router.replace('/signup');
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-brand-orange">Redirecting...</div>
    </div>
  );
}
