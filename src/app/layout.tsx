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

// Using the provided brand image as the global fallback for social sharing
const GLOBAL_OG_IMAGE = 'https://firebasestorage.googleapis.com/v0/b/studio-2604127518-57889.firebasestorage.app/o/uploads%2FLRM285EOq3gwNMKayY6vtzooaC03%2F1778842309292-South%20Africa%E2%80%99s%20Trusted%20Online%20Accounting%20%26%20Tax%20Compliance%20Partner%20(1).png?alt=media&token=f64e0df6-ab06-4ebb-9470-e15c9f827437';

export const metadata: Metadata = {
  metadataBase: new URL('https://www.myacc.co.za'),
  title: {
    default: 'My Accountant | Professional Accounting & Tax Services',
    template: '%s | My Accountant',
  },
  description: 'Professional online tax, accounting, CIPC, SARS and compliance services for South African businesses.',
  keywords: ['accounting', 'tax services', 'CIPC', 'SARS', 'bookkeeping', 'South Africa'],
  alternates: {
    canonical: 'https://www.myacc.co.za',
  },
  openGraph: {
    title: 'My Accountant | South African Tax, Accounting & Compliance Services',
    description: 'Professional online tax, accounting, CIPC, SARS and compliance services for South African businesses.',
    url: 'https://www.myacc.co.za',
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
