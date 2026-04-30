import { getFirestore, doc, getDoc } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { Metadata } from 'next';

const db = getFirestore(firebaseApp);

/**
 * Fetches dynamic SEO overrides for static pages from Firestore.
 * Ensures absolute URLs and explicit image objects for og:image to satisfy social scrapers.
 */
export async function getStaticPageMetadata(pageId: string, defaults: Metadata): Promise<Metadata> {
  try {
    const docRef = doc(db, 'staticSeo', pageId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      const data = docSnap.data();
      const title = data.metaTitle || data.title || defaults.title;
      const description = data.metaDescription || data.description || defaults.description;
      const keywords = data.metaKeywords || data.keywords || defaults.keywords;
      
      // Ensure absolute image URL
      let imageUrl = data.seoImageUrl || 'https://www.myacc.co.za/og-image.jpg';
      if (imageUrl.startsWith('/')) {
        imageUrl = `https://www.myacc.co.za${imageUrl}`;
      }

      const canonicalUrl = `https://www.myacc.co.za/${pageId === 'home' ? '' : pageId}`;

      return {
        ...defaults,
        title,
        description,
        keywords,
        alternates: {
          canonical: canonicalUrl,
        },
        openGraph: {
          ...defaults.openGraph,
          title: String(title),
          description: String(description),
          type: 'website',
          url: canonicalUrl,
          siteName: 'My Accountant',
          locale: 'en_ZA',
          images: [
            { 
              url: imageUrl, 
              width: 1200, 
              height: 630,
              alt: data.seoImageLabel || String(title)
            }
          ],
        },
        twitter: {
          ...defaults.twitter,
          card: 'summary_large_image',
          title: String(title),
          description: String(description),
          images: [imageUrl],
        }
      };
    }
  } catch (e) {
    console.error(`Error fetching SEO for ${pageId}:`, e);
  }
  
  // Robust fallback with explicit OG object using default og-image
  const fallbackTitle = String(defaults.title || 'My Accountant');
  const fallbackDesc = String(defaults.description || 'Professional Accounting & Tax Services');
  const fallbackImg = 'https://www.myacc.co.za/og-image.jpg';

  return {
    ...defaults,
    openGraph: {
        ...defaults.openGraph,
        title: fallbackTitle,
        description: fallbackDesc,
        images: [
            {
                url: fallbackImg,
                width: 1200,
                height: 630,
                alt: fallbackTitle,
            }
        ]
    },
    twitter: {
        ...defaults.twitter,
        card: 'summary_large_image',
        images: [fallbackImg],
    }
  };
}
