import { runQueryRest } from '@/lib/firestore-rest';
import { User } from '@/lib/types';
import { notFound } from 'next/navigation';
import PartnerHeader from '@/components/partner/PartnerHeader';
import PartnerFooter from '@/components/partner/PartnerFooter';
import { Metadata } from 'next';
import { SITE_URL, GLOBAL_OG_IMAGE } from '@/lib/constants';

export const dynamic = 'force-dynamic';

async function getFranchiseBySlug(slug: string): Promise<User | null> {
  try {
    const results = await runQueryRest("users", {
      where: {
        fieldFilter: {
          field: { fieldPath: "role" },
          op: "EQUAL",
          value: { stringValue: "franchisee" }
        }
      }
    });

    const franchisee = results.find(user => 
      user.areaSlug === slug || 
      user.franchise?.areaSlug === slug ||
      user.landingPage?.slug === slug
    );

    if (!franchisee) return null;

    // Synthetically construct franchise sub-object if missing to prevent layout crashes
    if (!franchisee.franchise) {
      franchisee.franchise = {
        areaSlug: franchisee.areaSlug || franchisee.landingPage?.slug || slug,
        areaName: franchisee.companyName?.replace("My Accountant ", "") || franchisee.name || slug
      };
    }

    return franchisee as User;
  } catch (error) {
    console.error(`Error querying franchisee by slug ${slug}:`, error);
    return null;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const partner = await getFranchiseBySlug(slug);
  if (!partner) return { title: 'Not Found' };

  const title = `My Accountant ${partner.franchise?.areaName} | Professional Accounting & Tax`;
  const description = `Your local My Accountant branch in ${partner.franchise?.areaName}. Professional bookkeeping, SARS and CIPC services.`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: [{
          url: GLOBAL_OG_IMAGE,
          width: 1200,
          height: 630,
          alt: title
      }],
      type: 'website',
      url: `${SITE_URL}/${slug}`,
      siteName: 'My Accountant',
      locale: 'en_ZA',
    }
  };
}

export default async function FranchiseLandingLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const partner = await getFranchiseBySlug(slug);

  if (!partner) {
    notFound();
  }

  // Franchisees use standard My Accountant branding
  const lp = {
      primaryColor: '#214392',
      secondaryColor: '#214392',
      backgroundColor: '#ffffff',
      textColor: '#111827',
      cardBackgroundColor: '#ffffff',
      cardBorderColor: '#e5e7eb',
      buttonColor: '#214392',
      buttonTextColor: '#ffffff',
      buttonStyle: 'solid',
      slug: partner.franchise?.areaSlug,
      heroTitle: `My Accountant ${partner.franchise?.areaName}`,
      heroSubtitle: `Expert tax, accounting, and compliance solutions for ${partner.franchise?.areaName}.`
  };

  const isOutline = lp.buttonStyle === 'outline';

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <style dangerouslySetInnerHTML={{ __html: `
        :root {
          --partner-primary: ${lp.primaryColor};
          --partner-secondary: ${lp.secondaryColor};
          --partner-bg: ${lp.backgroundColor};
          --partner-text: ${lp.textColor};
          --partner-card-bg: ${lp.cardBackgroundColor};
          --partner-card-border: ${lp.cardBorderColor};
          --partner-btn-bg: ${lp.buttonColor};
          --partner-btn-text: ${lp.buttonTextColor};
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
      <PartnerHeader partner={{ ...partner, landingPage: lp as any }} />
      <main className="flex-grow partner-page-bg partner-text-main">
        {children}
      </main>
      <PartnerFooter partner={{ ...partner, landingPage: lp as any }} />
    </div>
  );
}
