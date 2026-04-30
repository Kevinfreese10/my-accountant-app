import SeoManagementClient from '@/components/admin/SeoManagementClient';

/**
 * @fileOverview SEO Management dashboard for managing site metadata.
 * Uses a Server Component wrapper to correctly handle route segment configuration
 * while using a dedicated Client Component for the interactive form logic.
 */

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function SeoManagementPage() {
  return <SeoManagementClient />;
}
