import SarsDisputesPageClient from '@/components/sars/SarsDisputesPageClient';
import { getStaticPageMetadata } from '@/lib/seo-utils';
import { Metadata } from 'next';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function generateMetadata(): Promise<Metadata> {
    const defaults: Metadata = {
        title: 'SARS Disputes & Objections | My Accountant',
        description: 'Professional assistance with SARS disputes, objections (Section 104), and appeals.',
    };
    return getStaticPageMetadata('sars-disputes', defaults);
}

export default function SarsDisputesPage() {
  return <SarsDisputesPageClient />;
}
