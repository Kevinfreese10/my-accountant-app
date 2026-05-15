import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '@/contexts/AuthContext';
import AppShell from '@/components/layout/AppShell';
import ClientProviders from '@/contexts/ClientProviders';
import { bodyFont, headlineFont } from '@/app/fonts';
import { cn } from '@/lib/utils';
import { FirebaseErrorListener } from '@/components/FirebaseErrorListener';
import ExternalScripts from '@/components/layout/ExternalScripts';
import Script from 'next/script';
import { generateOrganizationSchema } from '@/lib/schema/productSchema';
import { SITE_URL, GLOBAL_OG_IMAGE } from '@/lib/constants';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'My Accountant | Professional Accounting & Tax Services',
    template: '%s | My Accountant',
  },
  description: 'Professional online tax, accounting, CIPC, SARS and compliance services for South African businesses.',
  keywords: ['accounting', 'tax services', 'CIPC', 'SARS', 'bookkeeping', 'South Africa'],
  alternates: {
    canonical: SITE_URL,
  },
  openGraph: {
    title: 'My Accountant | South African Tax, Accounting & Compliance Services',
    description: 'Professional online tax, accounting, CIPC, SARS and compliance services for South African businesses.',
    url: SITE_URL,
    siteName: 'My Accountant',
    images: [
      {
        url: GLOBAL_OG_IMAGE,
        width: 1200,
        height: 630,
        alt: 'My Accountant - Professional Accounting & Tax',
      },
    ],
    locale: 'en_ZA',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'My Accountant | Professional Accounting & Tax Services',
    description: 'Simplify your finances with our expert accounting and tax solutions.',
    images: [GLOBAL_OG_IMAGE],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const organizationSchema = generateOrganizationSchema();

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <ExternalScripts />
        <Script
          id="organization-schema"
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
        />
      </head>
      <body className={cn("antialiased", bodyFont.variable, headlineFont.variable)} suppressHydrationWarning>
        <AuthProvider>
            <ClientProviders>
                <FirebaseErrorListener />
                <AppShell>
                  {children}
                </AppShell>
            </ClientProviders>
        </AuthProvider>
      </body>
    </html>
  );
}
