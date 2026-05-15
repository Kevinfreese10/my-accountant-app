
import { notFound } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { BadgeCheck, Clock, ClipboardCheck } from 'lucide-react';
import { Service } from '@/lib/types';
import { Separator } from '@/components/ui/separator';
import TrustIndexWidget from '@/components/shared/TrustIndexWidget';
import { getFirestore, collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { Metadata, ResolvingMetadata } from 'next';
import ServiceCheckoutForm from '@/components/checkout/ServiceCheckoutForm';
import Script from 'next/script';
import { generateStructuredData } from '@/lib/schema/productSchema';

const db = getFirestore(firebaseApp);

export const dynamic = 'force-dynamic';

async function getService(slug: string): Promise<Service | null> {
    const q = query(collection(db, 'services'), where('slug', '==', slug));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
        return null;
    }
    const doc = querySnapshot.docs[0];
    const data = doc.data();

    const serviceData = {
        id: doc.id,
        ...data,
    } as any;

    if (data.createdAt && data.createdAt instanceof Timestamp) {
        serviceData.createdAt = data.createdAt.toDate().toISOString();
    }
    
    return serviceData as Service;
}

type Props = {
  params: Promise<{ slug: string }>
}

export async function generateMetadata(
  { params }: Props,
  parent: ResolvingMetadata
): Promise<Metadata> {
  const { slug } = await params;
  const service = await getService(slug);
  const siteUrl = 'https://www.myacc.co.za';
  const globalFallbackImg = 'https://firebasestorage.googleapis.com/v0/b/studio-2604127518-57889.firebasestorage.app/o/uploads%2FLRM285EOq3gwNMKayY6vtzooaC03%2F1778842309292-South%20Africa%E2%80%99s%20Trusted%20Online%20Accounting%20%26%20Tax%20Compliance%20Partner%20(1).png?alt=media&token=f64e0df6-ab06-4ebb-9470-e15c9f827437';

  if (!service) {
    return { title: 'Product Not Found' }
  }

  const canonicalUrl = `${siteUrl}/products/${service.slug}`;
  const title = service.metaTitle || `${service.title} | My Accountant`;
  const description = service.metaDescription || service.description;
  
  let ogImage = service.seoImageUrl || service.imageUrl || globalFallbackImg;
  if (ogImage.startsWith('/')) {
    ogImage = `${siteUrl}${ogImage}`;
  }
 
  return {
    title: title,
    description: description,
    alternates: {
        canonical: canonicalUrl,
    },
    openGraph: {
      title: title,
      description: description,
      url: canonicalUrl,
      siteName: 'My Accountant',
      locale: 'en_ZA',
      type: 'website',
      images: [{
        url: ogImage,
        width: 1200,
        height: 630,
        alt: service.seoImageLabel || service.title
      }],
    },
    twitter: {
      card: 'summary_large_image',
      title: title,
      description: description,
      images: [ogImage],
    },
  }
}

const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-ZA', {
      style: 'currency',
      currency: 'ZAR',
      minimumFractionDigits: price % 1 === 0 ? 0 : 2,
      maximumFractionDigits: 2,
    }).format(price);
};

export default async function ProductDetailPage({ params }: Props) {
  const { slug } = await params;
  const service = await getService(slug);

  if (!service) {
    notFound();
  }

  // Generate structured data server-side
  const jsonLd = generateStructuredData(service);

  return (
    <>
      <Script
        id="product-schema"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div className="container mx-auto px-4 py-12">
          <div className="text-center mb-8">
              <TrustIndexWidget />
          </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
          <div className="space-y-8 md:col-span-2">
              
            <div className="space-y-3">
              <Badge variant="secondary" className="w-fit">{service.category}</Badge>
              <h1 className="text-3xl md:text-4xl font-bold tracking-tight">{service.title}</h1>
               {service.isPriceTbc ? (
                <p className="text-2xl font-bold text-muted-foreground">Price on request</p>
              ) : (
                <p className="text-3xl font-bold text-primary">{formatPrice(service.price)}</p>
              )}
              <div className="flex items-center text-muted-foreground">
                  <Clock className="h-4 w-4 mr-1.5" />
                  <span className="text-sm font-medium">{service.turnaroundTime}</span>
              </div>
            </div>
            
            <div>
              <h2 className="text-xl font-semibold">Product Description</h2>
              <Separator className="my-3" />
              <p className="text-muted-foreground">{service.longDescription}</p>
            </div>

            {service.whatsIncluded && service.whatsIncluded.length > 0 && (
              <div>
                <h2 className="text-xl font-semibold">What's Included</h2>
                <Separator className="my-3" />
                <ul className="space-y-3">
                  {service.whatsIncluded.map((item, index) => (
                    <li key={index} className="flex items-start">
                      <BadgeCheck className="h-5 w-5 text-primary mr-3 mt-1 flex-shrink-0" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div>
              <h2 className="text-xl font-semibold">Prerequisites</h2>
              <Separator className="my-3" />
               <ul className="space-y-3">
                {service.clientRequirements.map((doc, index) => (
                  <li key={index} className="flex items-start">
                    <ClipboardCheck className="h-5 w-5 text-primary mr-3 mt-1 flex-shrink-0" />
                    <span>{doc}</span>
                  </li>
                ))}
              </ul>
            </div>

          </div>

          <div className="md:col-span-1">
              <ServiceCheckoutForm service={service} />
          </div>
        </div>
      </div>
    </>
  );
}
