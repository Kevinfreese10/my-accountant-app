
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { Metadata } from 'next';

const db = getFirestore(firebaseApp);

/**
 * Fetches dynamic SEO overrides for static pages from Firestore.
 * Ensures absolute URLs and explicit image objects for og:image to satisfy social scrapers.
 */
export async function getStaticPageMetadata(pageId: string, defaults: Metadata): Promise<Metadata> {
  const siteUrl = 'https://www.myacc.co.za';
  const canonicalUrl = `${siteUrl}${pageId === 'home' ? '' : `/${pageId}`}`;
  const globalFallbackImg = 'https://www.myacc.co.za/og-image.jpg';

  try {
    const docRef = doc(db, 'staticSeo', pageId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      const data = docSnap.data();
      const title = String(data.metaTitle || data.title || defaults.title || 'My Accountant');
      const description = String(data.metaDescription || data.description || defaults.description || '');
      const keywords = data.metaKeywords || data.keywords || defaults.keywords;
      
      let imageUrl = data.seoImageUrl || globalFallbackImg;
      // Force absolute URL
      if (imageUrl.startsWith('/')) {
        imageUrl = `${siteUrl}${imageUrl}`;
      }

      return {
        ...defaults,
        title,
        description,
        keywords,
        alternates: {
          canonical: canonicalUrl,
        },
        openGraph: {
          title,
          description,
          url: canonicalUrl,
          siteName: 'My Accountant',
          locale: 'en_ZA',
          type: 'website',
          images: [
            { 
              url: imageUrl, 
              width: 1200, 
              height: 630,
              alt: data.seoImageLabel || title
            }
          ],
        },
        twitter: {
          card: 'summary_large_image',
          title,
          description,
          images: [imageUrl],
        }
      };
    }
  } catch (e) {
    console.error(`Error fetching SEO for ${pageId}:`, e);
  }
  
  const fallbackTitle = String(defaults.title || 'My Accountant');
  const fallbackDesc = String(defaults.description || '');

  return {
    ...defaults,
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
        title: fallbackTitle,
        description: fallbackDesc,
        url: canonicalUrl,
        siteName: 'My Accountant',
        locale: 'en_ZA',
        type: 'website',
        images: [
            {
                url: globalFallbackImg,
                width: 1200, 
                height: 630,
                alt: fallbackTitle,
            }
        ]
    },
    twitter: {
        card: 'summary_large_image',
        title: fallbackTitle,
        description: fallbackDesc,
        images: [globalFallbackImg],
    }
  };
}
