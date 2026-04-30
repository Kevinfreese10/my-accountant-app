import BlogPageClient from '@/components/blog/BlogPageClient';
import { getStaticPageMetadata } from '@/lib/seo-utils';
import { Metadata } from 'next';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function generateMetadata(): Promise<Metadata> {
    const defaults: Metadata = {
        title: 'Tax Tip Blog | My Accountant',
        description: 'Stay informed with our latest articles, tips, and updates on tax-related topics relevant to South African individuals and businesses.',
    };
    return getStaticPageMetadata('blog', defaults);
}

export default function BlogPage() {
  return <BlogPageClient />;
}
