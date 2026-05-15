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
  
  // Using the primary brand image as the fallback for reliability
  const globalFallbackImg = 'https://firebasestorage.googleapis.com/v0/b/studio-2604127518-57889.firebasestorage.app/o/uploads%2FLRM285EOq3gwNMKayY6vtzooaC03%2F1778841517299-South%20Africa%E2%80%99s%20Trusted%20Online%20Accounting%20%26%20Tax%20Compliance%20Partner.png?alt=media&token=70d6af1c-faef-4964-b0bc-4a7bca97a302';

  try {
    const docRef = doc(db, 'staticSeo', pageId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      const data = docSnap.data();
      const title = String(data.metaTitle || data.title || defaults.title || 'My Accountant');
      const description = String(data.metaDescription || data.description || defaults.description || '');
      const keywords = data.metaKeywords || data.keywords || defaults.keywords;
      
      let imageUrl = data.seoImageUrl || globalFallbackImg;
      // Force absolute URL for local paths
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
