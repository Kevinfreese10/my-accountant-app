import SeoManagementClient from '@/components/admin/SeoManagementClient';

/**
 * @fileOverview Top-level management for website pages and their SEO metadata.
 */

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function PagesManagementPage() {
  return <SeoManagementClient />;
}
