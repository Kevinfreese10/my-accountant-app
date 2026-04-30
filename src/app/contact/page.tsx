import ContactPageClient from '@/components/contact/ContactPageClient';
import { getStaticPageMetadata } from '@/lib/seo-utils';
import { Metadata } from 'next';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function generateMetadata(): Promise<Metadata> {
    const defaults: Metadata = {
        title: 'Contact Us | My Accountant',
        description: 'Get in touch with the My Accountant team. Fill out our contact form with your questions or inquiries.',
    };
    return getStaticPageMetadata('contact', defaults);
}

export default function ContactPage() {
  return <ContactPageClient />;
}
