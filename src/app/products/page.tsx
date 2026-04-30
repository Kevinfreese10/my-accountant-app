import ProductsPageClient from '@/components/products/ProductsPageClient';
import { getStaticPageMetadata } from '@/lib/seo-utils';
import { Metadata } from 'next';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function generateMetadata(): Promise<Metadata> {
    const defaults: Metadata = {
        title: 'Our Products | My Accountant',
        description: 'Comprehensive solutions to meet all your financial needs. We offer a range of services for individuals and businesses.',
    };
    return getStaticPageMetadata('products', defaults);
}

export default function ProductsPage() {
  return <ProductsPageClient />;
}
