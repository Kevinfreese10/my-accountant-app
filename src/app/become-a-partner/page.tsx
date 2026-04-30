import BecomeAPartnerPageClient from '@/components/become-a-partner/BecomeAPartnerPageClient';

/**
 * @fileOverview Become a Partner landing page.
 * Forces dynamic rendering to ensure fresh content and resolves build conflicts.
 */

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function BecomeAPartnerPage() {
  return <BecomeAPartnerPageClient />;
}
