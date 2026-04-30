import BEIPageClient from '@/components/BEI/BEIPageClient';

/**
 * @fileOverview Bookkeeper Empowerment Initiative (BEI) landing page.
 * Uses a Server Component wrapper to force dynamic rendering.
 */

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function BEIPage() {
  return <BEIPageClient />;
}
