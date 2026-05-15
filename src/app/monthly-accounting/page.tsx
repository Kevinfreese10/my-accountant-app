import MonthlyAccountingPageClient from '@/components/accounting/MonthlyAccountingPageClient';
import { getStaticPageMetadata } from '@/lib/seo-utils';
import { Metadata } from 'next';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function generateMetadata(): Promise<Metadata> {
    const defaults: Metadata = {
        title: 'Monthly Accounting & Bookkeeping | My Accountant',
        description: 'Professional monthly accounting and bookkeeping services for South African SMEs. We handle bank recons, management accounts, and VAT submissions.',
    };
    return getStaticPageMetadata('monthly-accounting', defaults);
}

export default function MonthlyAccountingPage() {
  return <MonthlyAccountingPageClient />;
}
