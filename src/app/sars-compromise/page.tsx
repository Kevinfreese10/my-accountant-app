import SarsCompromisePageClient from '@/components/sars/SarsCompromisePageClient';
import { getStaticPageMetadata } from '@/lib/seo-utils';
import { Metadata } from 'next';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function generateMetadata(): Promise<Metadata> {
    const defaults: Metadata = {
        title: 'SARS Compromise of Debt | My Accountant',
        description: 'Explore your options for a SARS Compromise of Debt. We help you negotiate a settlement with SARS to resolve outstanding tax debt.',
    };
    return getStaticPageMetadata('sars-compromise', defaults);
}

export default function SarsCompromisePage() {
  return <SarsCompromisePageClient />;
}
