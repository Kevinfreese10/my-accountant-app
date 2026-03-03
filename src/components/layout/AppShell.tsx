'use client';

import { useAuth } from '@/contexts/AuthContext';
import { usePathname } from 'next/navigation';
import Footer from '@/components/layout/Footer';
import { ReactNode, useState, useEffect } from 'react';
import dynamic from 'next/dynamic';

const Header = dynamic(() => import('@/components/layout/Header'), { ssr: false });

export default function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isAuthPage = pathname === '/login' || pathname === '/signup';
  
  const isDashboardPage = pathname ? (
    pathname.startsWith('/admin') ||
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/partner') ||
    pathname.startsWith('/p/')
  ) : false;

  // Use a 'mounted' check to prevent hydration mismatch
  const shouldShowHeader = mounted && (!isDashboardPage || isAuthPage);
  const shouldShowFooter = mounted && !isDashboardPage && !isAuthPage;

  return (
    <div className="flex min-h-screen flex-col">
      {shouldShowHeader && <Header />}
      <main className="flex-grow bg-background">{children}</main>
      {shouldShowFooter && <Footer />}
    </div>
  );
}
