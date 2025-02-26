'use client';

import { AuthProvider } from '@/context/AuthContext';
import Navigation from '@/components/Navigation';

export default function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthProvider>
      <Navigation />
      <main className="min-h-screen bg-gray-50">
        {children}
      </main>
    </AuthProvider>
  );
} 