import { getFirestore, doc, getDoc } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { Metadata } from 'next';
import { SITE_URL, GLOBAL_OG_IMAGE } from './constants';

const db = getFirestore(firebaseApp);

/**
 * Fetches dynamic SEO overrides for static pages from Firestore.
 * Ensures absolute URLs and explicit image objects for og:image to satisfy social scrapers.
 */
export async function getStaticPageMetadata(pageId: string, defaults: Metadata): Promise<Metadata> {
  const canonicalUrl = `${SITE_URL}${pageId === 'home' ? '' : `/${pageId}`}`;
  
  let title = String(defaults.title || 'My Accountant');
  let description = String(defaults.description || '');
  let imageUrl = GLOBAL_OG_IMAGE;
  let imageAlt = title;

  try {
    const docRef = doc(db, 'staticSeo', pageId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      const data = docSnap.data();
      title = String(data.metaTitle || data.title || title);
      description = String(data.metaDescription || data.description || description);
      if (data.seoImageUrl) {
        imageUrl = data.seoImageUrl;
        // Ensure URL is absolute
        if (imageUrl.startsWith('/')) {
            imageUrl = `${SITE_URL}${imageUrl}`;
        }
      }
      imageAlt = data.seoImageLabel || title;
    }
  } catch (e) {
    console.error(`Error fetching SEO for ${pageId}:`, e);
  }
  
  return {
    ...defaults,
    title,
    description,
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
              alt: imageAlt
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
