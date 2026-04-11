import { getFirestore, collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { User } from '@/lib/types';
import { notFound } from 'next/navigation';
import PartnerHeader from '@/components/partner/PartnerHeader';
import PartnerFooter from '@/components/partner/PartnerFooter';
import { Metadata } from 'next';

const db = getFirestore(firebaseApp);

export const dynamic = 'force-dynamic';

async function getPartnerBySlug(slug: string): Promise<User | null> {
  const q = query(
    collection(db, "users"), 
    where("landingPage.enabled", "==", true),
    where("landingPage.slug", "==", slug)
  );
  const snapshot = await getDocs(q);
  if (snapshot.empty) return null;
  const doc = snapshot.docs[0];
  const data = doc.data();

  const serializedPartner = {
    ...data,
    id: doc.id,
    uid: doc.id,
  } as any;

  // Serialize any potential timestamps to strings for Client Component transport
  if (data.createdAt instanceof Timestamp) {
    serializedPartner.createdAt = data.createdAt.toDate().toISOString();
  }
  if (data.yearEnd instanceof Timestamp) {
    serializedPartner.yearEnd = data.yearEnd.toDate().toISOString();
  }
  if (data.subscription) {
    serializedPartner.subscription = { ...data.subscription };
    if (data.subscription.lastBillingDate instanceof Timestamp) {
      serializedPartner.subscription.lastBillingDate = data.subscription.lastBillingDate.toDate().toISOString();
    }
    if (data.subscription.subscriptionEndDate instanceof Timestamp) {
      serializedPartner.subscription.subscriptionEndDate = data.subscription.subscriptionEndDate.toDate().toISOString();
    }
  }

  return serializedPartner as User;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const partner = await getPartnerBySlug(slug);
  if (!partner) return { title: 'Practice Not Found' };

  const lp = partner.landingPage;
  const title = lp?.metaTitle || `${partner.companyName || partner.name} | Professional Accounting & Tax`;
  const description = lp?.metaDescription || lp?.heroSubtitle;
  const ogImage = lp?.heroImageUrl || '';

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: ogImage ? [ogImage] : [],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: ogImage ? [ogImage] : [],
    }
  };
}

export default async function PartnerLandingLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const partner = await getPartnerBySlug(slug);

  if (!partner) {
    notFound();
  }

  const lp = partner.landingPage;
  const isOutline = lp?.buttonStyle === 'outline';

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <style dangerouslySetInnerHTML={{ __html: `
        :root {
          --partner-primary: ${lp?.primaryColor || '#214392'};
          --partner-secondary: ${lp?.secondaryColor || lp?.primaryColor || '#214392'};
          --partner-bg: ${lp?.backgroundColor || '#ffffff'};
          --partner-text: ${lp?.textColor || '#111827'};
          --partner-card-bg: ${lp?.cardBackgroundColor || '#ffffff'};
          --partner-card-border: ${lp?.cardBorderColor || '#e5e7eb'};
          --partner-btn-bg: ${lp?.buttonColor || lp?.primaryColor || '#214392'};
          --partner-btn-text: ${lp?.buttonTextColor || '#ffffff'};
        }
        .partner-btn {
          background-color: ${isOutline ? 'transparent' : 'var(--partner-btn-bg)'} !important;
          color: ${isOutline ? 'var(--partner-btn-bg)' : 'var(--partner-btn-text)'} !important;
          border: ${isOutline ? '1px solid var(--partner-btn-bg)' : 'none'} !important;
        }
        .partner-btn-secondary {
          background-color: var(--partner-secondary) !important;
          color: var(--partner-text) !important;
        }
        .partner-text {
          color: var(--partner-primary) !important;
        }
        .partner-icon {
          color: var(--partner-secondary) !important;
        }
        .partner-text-main {
          color: var(--partner-text) !important;
        }
        .partner-border {
          border-color: var(--partner-primary) !important;
        }
        .partner-card {
          background-color: var(--partner-card-bg) !important;
          border-color: var(--partner-card-border) !important;
        }
        .partner-page-bg {
          background-color: var(--partner-bg) !important;
        }
      `}} />
      <PartnerHeader partner={partner} />
      <main className="flex-grow partner-page-bg partner-text-main">
        {children}
      </main>
      <PartnerFooter partner={partner} />
    </div>
  );
}
