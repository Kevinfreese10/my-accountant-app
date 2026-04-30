import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '@/contexts/AuthContext';
import AppShell from '@/components/layout/AppShell';
import ClientProviders from '@/contexts/ClientProviders';
import { bodyFont, headlineFont } from '@/app/fonts';
import { cn } from '@/lib/utils';
import { FirebaseErrorListener } from '@/components/FirebaseErrorListener';
import ExternalScripts from '@/components/layout/ExternalScripts';

const GLOBAL_OG_IMAGE = 'https://firebasestorage.googleapis.com/v0/b/studio-2604127518-57889.firebasestorage.app/o/uploads%2FLRM285EOq3gwNMKayY6vtzooaC03%2F1777450406330-WWW.MYACC.CO.ZA.png?alt=media&token=e5cf2944-6006-4f21-9a20-ff403ff380e0';

export const metadata: Metadata = {
  metadataBase: new URL('https://www.myacc.co.za'),
  title: {
    default: 'My Accountant | South African Tax, Accounting & Compliance Services',
    template: '%s | My Accountant',
  },
  description: 'Professional online tax, accounting, CIPC, SARS and compliance services for South African businesses.',
  keywords: ['accounting', 'tax services', 'CIPC', 'SARS', 'bookkeeping', 'South Africa'],
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
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <ExternalScripts />
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
