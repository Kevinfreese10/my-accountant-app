
'use client';

import { useAuth } from '@/contexts/AuthContext';
import { usePathname } from 'next/navigation';
import Footer from '@/components/layout/Footer';
import { ReactNode } from 'react';
import dynamic from 'next/dynamic';

const Header = dynamic(() => import('@/components/layout/Header'), { ssr: false });
const NewVisitorPopup = dynamic(() => import('@/components/shared/NewVisitorPopup'), { ssr: false });

export default function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  const isDashboardPage =
    pathname.startsWith('/admin') ||
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/partner') ||
    pathname.startsWith('/p/');

  const shouldShowHeaderFooter = !isDashboardPage;

  return (
    <div className="flex min-h-screen flex-col">
      {shouldShowHeaderFooter && <Header />}
      <main className="flex-grow bg-background">{children}</main>
      {shouldShowHeaderFooter && (
        <>
          <Footer />
          {/* <NewVisitorPopup /> */}
        </>
      )}
    </div>
  );
}
