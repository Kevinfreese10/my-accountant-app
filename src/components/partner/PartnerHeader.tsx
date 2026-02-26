'use client';

import Link from 'next/link';
import { LogIn } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { User } from '@/lib/types';
import Image from 'next/image';

export default function PartnerHeader({ partner }: { partner: User }) {
  const lp = partner.landingPage;
  const logoHeight = lp?.logoHeight || 40;
  const showLogo = lp?.showLogo !== false;
  const hideBranding = lp?.hideHeaderBranding === true;

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background shadow-sm h-16 flex items-center">
      <div className="container mx-auto flex items-center justify-between px-4">
        {!hideBranding ? (
          <Link href={`/p/${lp?.slug}`} className="flex items-center gap-3">
            {showLogo && lp?.logoUrl ? (
              <div 
                  className="relative" 
                  style={{ 
                      height: `${logoHeight}px`,
                      width: `${logoHeight * 3}px`
                  }}
              >
                <Image 
                  src={lp.logoUrl} 
                  alt={partner.companyName || partner.name} 
                  fill 
                  className="object-contain object-left"
                />
              </div>
            ) : (
              <span className="text-xl font-bold" style={{ color: lp?.primaryColor || 'inherit' }}>
                {partner.companyName || partner.name}
              </span>
            )}
          </Link>
        ) : (
          <div /> // Spacer if branding is hidden
        )}

        <div className="flex items-center gap-4">
          <Button variant="ghost" asChild className="hidden sm:inline-flex">
            <Link href={`/p/${lp?.slug}#about`}>About Us</Link>
          </Button>
          <Button variant="ghost" asChild className="hidden sm:inline-flex">
            <Link href={`/p/${lp?.slug}#products`}>Services</Link>
          </Button>
          <Button asChild style={{ backgroundColor: lp?.primaryColor || undefined }}>
            <Link href="/login">
              <LogIn className="mr-2 h-4 w-4" /> Portal Login
            </Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
