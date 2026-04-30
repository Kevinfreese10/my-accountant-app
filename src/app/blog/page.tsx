import BlogPageClient from '@/components/blog/BlogPageClient';

/**
 * @fileOverview Blog index page.
 * Forces dynamic rendering to ensure latest posts are always visible.
 */

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function BlogPage() {
  return <BlogPageClient />;
}
