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
    default: 'My Accountant | SME Accounting, Payroll & SARS Tax Services South Africa',
    template: '%s | My Accountant',
  },
  description: 'Professional bookkeeping, monthly payroll, VAT compliance, CIPC company registration, and SARS tax returns eFiling services for small-to-medium businesses (SMEs) in South Africa.',
  keywords: [
    'SARS tax compliance South Africa',
    'SME payroll services',
    'CIPC company registration',
    'monthly VAT returns',
    'bookkeeping services Johannesburg',
    'SARS tax returns eFiling',
    'accounting',
    'tax services',
    'CIPC',
    'SARS',
    'bookkeeping',
    'South Africa'
  ],
  alternates: {
    canonical: SITE_URL,
  },
  openGraph: {
    title: 'My Accountant | South African Tax, Accounting & Compliance Services',
    description: 'Professional online bookkeeping, monthly payroll, VAT compliance, and SARS tax returns eFiling for SMEs in South Africa.',
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
    title: 'My Accountant | SME Accounting, Payroll & SARS Tax Services South Africa',
    description: 'Simplify your small business bookkeeping, CIPC registrations, and SARS tax compliance with My Accountant.',
    images: [GLOBAL_OG_IMAGE],
  },
  verification: {
    google: 'UJqrDV4weHPKHA8UCKC5Ns8gVfMvRG7-4so6iU116dA',
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
