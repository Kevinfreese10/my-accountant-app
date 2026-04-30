import ProductsPageClient from '@/components/products/ProductsPageClient';

/**
 * @fileOverview Products index page.
 * Uses a Server Component wrapper to force dynamic rendering and resolve build segment conflicts.
 */

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function ProductsPage() {
  return <ProductsPageClient />;
}
