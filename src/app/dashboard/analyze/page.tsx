'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function AnalyzePage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to the dashboard page since the analyze link now serves as the dashboard link
    router.push('/dashboard');
  }, [router]);

  return null; // Return null since we're redirecting
}