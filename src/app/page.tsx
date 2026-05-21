import HomePageClient from '@/components/home/HomePageClient';
import { getStaticPageMetadata } from '@/lib/seo-utils';
import { Metadata } from 'next';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function generateMetadata(): Promise<Metadata> {
    const defaults: Metadata = {
        title: 'My Accountant | Professional Accounting & Tax Services',
        description: 'Professional Accounting & Tax Services for South Africa. We handle SARS, CIPC, and all your compliance needs so you can focus on your business.',
        verification: {
            google: 'UJqrDV4weHPKHA8UCKC5Ns8gVfMvRG7-4so6iU116dA',
        },
    };
    return getStaticPageMetadata('home', defaults);
}

export default function Home() {
  return <HomePageClient />;
}
