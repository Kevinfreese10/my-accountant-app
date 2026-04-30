import CompliancePageClient from '@/components/compliance/CompliancePageClient';
import { getStaticPageMetadata } from '@/lib/seo-utils';
import { Metadata } from 'next';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function generateMetadata(): Promise<Metadata> {
    const defaults: Metadata = {
        title: 'Free SARS & CIPC Compliance Check',
        description: 'Ensure your South African business is compliant. Get a free, no-obligation compliance assessment for CIPC and SARS.',
    };
    return getStaticPageMetadata('compliance', defaults);
}

export default function CompliancePage() {
  return <CompliancePageClient />;
}
