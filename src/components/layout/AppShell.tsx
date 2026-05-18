'use client';

import { useAuth } from '@/contexts/AuthContext';
import { usePathname } from 'next/navigation';
import Footer from '@/components/layout/Footer';
import { ReactNode, useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { Button } from '@/components/ui/button';
import { Phone, ArrowRight, MessageSquare } from 'lucide-react';
import Link from 'next/link';

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

  const shouldShowHeader = mounted && (!isDashboardPage || isAuthPage);
  const shouldShowFooter = mounted && !isDashboardPage && !isAuthPage;
  const showStickyCTA = mounted && !isDashboardPage && !isAuthPage;

  return (
    <div className="flex min-h-screen flex-col">
      {shouldShowHeader && <Header />}
      <main className="flex-grow bg-background relative">{children}</main>
      
      {showStickyCTA && (
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-t p-2 md:hidden">
          <div className="container mx-auto flex items-center justify-around gap-2">
            <Button variant="ghost" size="sm" asChild className="flex-1 h-12 flex flex-col gap-1">
              <a href="https://wa.me/27101091625" target="_blank" rel="noopener noreferrer">
                <WhatsAppIcon className="h-5 w-5 text-[#25D366]" />
                <span className="text-[10px] font-bold uppercase tracking-tighter">WhatsApp</span>
              </a>
            </Button>
            <Button variant="ghost" size="sm" asChild className="flex-1 h-12 flex flex-col gap-1">
              <a href="tel:0101091625">
                <Phone className="h-5 w-5 text-primary" />
                <span className="text-[10px] font-bold uppercase tracking-tighter">Call Now</span>
              </a>
            </Button>
            <Button size="sm" asChild className="flex-1 h-12 gap-1 font-bold">
              <Link href="/signup">
                Get Started <ArrowRight className="h-3 w-3" />
              </Link>
            </Button>
          </div>
        </div>
      )}

      {showStickyCTA && (
          <div className="fixed bottom-8 right-8 z-50 hidden md:flex flex-col gap-3">
              <div className="group relative">
                  <div className="absolute right-full mr-4 top-1/2 -translate-y-1/2 bg-slate-900 text-white px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity shadow-xl">
                      Chat on WhatsApp
                  </div>
                  <Button size="icon" className="h-14 w-14 rounded-full bg-[#25D366] hover:bg-[#20ba5c] shadow-2xl transition-transform hover:scale-110" asChild>
                    <a href="https://wa.me/27101091625" target="_blank" rel="noopener noreferrer">
                        <WhatsAppIcon className="h-7 w-7 text-white" />
                    </a>
                  </Button>
              </div>
              <div className="group relative">
                  <div className="absolute right-full mr-4 top-1/2 -translate-y-1/2 bg-slate-900 text-white px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity shadow-xl">
                      Call our office
                  </div>
                  <Button size="icon" className="h-14 w-14 rounded-full bg-primary shadow-2xl transition-transform hover:scale-110" asChild>
                    <a href="tel:0101091625">
                        <Phone className="h-7 w-7 text-white" />
                    </a>
                  </Button>
              </div>
          </div>
      )}

      {shouldShowFooter && <Footer />}
    </div>
  );
}

function WhatsAppIcon(props: any) {
  return (
    <svg
      {...props}
      viewBox="0 0 24 24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.353-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.131.57-.074 1.758-.718 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.87 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.414 0 .011 5.398 0 12.036c0 2.12.554 4.189 1.604 6.04L0 24l4.062-1.065a11.85 11.81 0 005.42 1.341h.005c6.634 0 12.032-5.398 12.033-12.037a11.81 11.81 0 00-3.417-8.536z" />
    </svg>
  );
}
