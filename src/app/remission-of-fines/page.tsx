import RemissionOfFinesPageClient from '@/components/sars/RemissionOfFinesPageClient';
import { getStaticPageMetadata } from '@/lib/seo-utils';
import { Metadata } from 'next';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function generateMetadata(): Promise<Metadata> {
    const defaults: Metadata = {
        title: 'Remission of Fines & Penalties | My Accountant',
        description: 'Apply for a SARS Request for Remission (RFR) to remove or reduce administrative and understatement penalties.',
    };
    return getStaticPageMetadata('remission-of-fines', defaults);
}

export default function RemissionOfFinesPage() {
  return <RemissionOfFinesPageClient />;
}
