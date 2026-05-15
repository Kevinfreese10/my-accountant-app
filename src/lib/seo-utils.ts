
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
  const globalFallbackImg = 'https://firebasestorage.googleapis.com/v0/b/studio-2604127518-57889.firebasestorage.app/o/uploads%2FLRM285EOq3gwNMKayY6vtzooaC03%2F1778842309292-South%20Africa%E2%80%99s%20Trusted%20Online%20Accounting%20%26%20Tax%20Compliance%20Partner%20(1).png?alt=media&token=f64e0df6-ab06-4ebb-9470-e15c9f827437';

  let title = String(defaults.title || 'My Accountant');
  let description = String(defaults.description || '');
  let imageUrl = globalFallbackImg;
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
        if (imageUrl.startsWith('/')) {
            imageUrl = `${siteUrl}${imageUrl}`;
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
