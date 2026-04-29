
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { Metadata } from 'next';

const db = getFirestore(firebaseApp);

/**
 * Fetches dynamic SEO overrides for static pages from Firestore.
 */
export async function getStaticPageMetadata(pageId: string, defaults: Metadata): Promise<Metadata> {
  try {
    const docRef = doc(db, 'staticSeo', pageId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      const data = docSnap.data();
      return {
        ...defaults,
        title: data.title || defaults.title,
        description: data.description || defaults.description,
        keywords: data.keywords || defaults.keywords,
        openGraph: {
          ...defaults.openGraph,
          title: data.title || defaults.title,
          description: data.description || defaults.description,
          images: data.seoImageUrl ? [{ url: data.seoImageUrl }] : defaults.openGraph?.images,
        }
      };
    }
  } catch (e) {
    console.error(`Error fetching SEO for ${pageId}:`, e);
  }
  return defaults;
}
