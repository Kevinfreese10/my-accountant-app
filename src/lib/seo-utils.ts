import { getFirestore, doc, getDoc } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { Metadata } from 'next';

const db = getFirestore(firebaseApp);

/**
 * Fetches dynamic SEO overrides for static pages from Firestore.
 * Supports Open Graph and Twitter tags for social sharing.
 */
export async function getStaticPageMetadata(pageId: string, defaults: Metadata): Promise<Metadata> {
  try {
    const docRef = doc(db, 'staticSeo', pageId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      const data = docSnap.data();
      const title = data.metaTitle || data.title || defaults.title;
      const description = data.metaDescription || data.description || defaults.description;
      const imageUrl = data.seoImageUrl || (defaults.openGraph?.images as any)?.[0]?.url;
      const keywords = data.metaKeywords || data.keywords || defaults.keywords;

      return {
        ...defaults,
        title,
        description,
        keywords,
        openGraph: {
          ...defaults.openGraph,
          title,
          description,
          type: 'website',
          images: imageUrl ? [{ url: imageUrl, width: 1200, height: 630 }] : defaults.openGraph?.images,
        },
        twitter: {
          ...defaults.twitter,
          card: 'summary_large_image',
          title,
          description,
          images: imageUrl ? [imageUrl] : defaults.twitter?.images,
        }
      };
    }
  } catch (e) {
    console.error(`Error fetching SEO for ${pageId}:`, e);
  }
  return defaults;
}
