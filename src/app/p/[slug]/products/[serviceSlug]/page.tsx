import { getFirestore, collection, query, where, getDocs, doc, getDoc, Timestamp } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { User, Service, Order } from '@/lib/types';
import { notFound } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Clock, ClipboardCheck, BadgeCheck, ArrowLeft } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import ServiceCheckoutForm from '@/components/checkout/ServiceCheckoutForm';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Metadata } from 'next';

const db = getFirestore(firebaseApp);

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

  if (data.createdAt instanceof Timestamp) {
    serializedPartner.createdAt = data.createdAt.toDate().toISOString();
  }

  return serializedPartner as User;
}

async function getService(slug: string): Promise<Service | null> {
    const q = query(collection(db, 'services'), where('slug', '==', slug));
    const snapshot = await getDocs(q);
    if (snapshot.empty) return null;
    const doc = snapshot.docs[0];
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

async function getPartnerOverride(partnerId: string, serviceId: string): Promise<any | null> {
    const overrideRef = doc(db, 'users', partnerId, 'serviceOverrides', serviceId);
    const snap = await getDoc(overrideRef);
    return snap.exists() ? snap.data() : null;
}

export async function generateMetadata({ params }: { params: { slug: string, serviceSlug: string } }): Promise<Metadata> {
  const [partner, rawService] = await Promise.all([
    getPartnerBySlug(params.slug),
    getService(params.serviceSlug)
  ]);

  if (!partner || !rawService) return { title: 'Product Not Found' };

  const override = await getPartnerOverride(partner.id, rawService.id);
  
  // Use branded AI title if available, fallback to template
  const title = override?.metaTitle || `${override?.title || rawService.title} | ${partner.companyName || partner.name}`;
  const description = override?.metaDescription || override?.description || rawService.metaDescription || rawService.description;

  return {
    title,
    description,
    openGraph: {
        title,
        description,
        images: [rawService.imageUrl],
    }
  };
}

const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-ZA', {
      style: 'currency',
      currency: 'ZAR',
      minimumFractionDigits: price % 1 === 0 ? 0 : 2,
      maximumFractionDigits: 2,
    }).format(price);
};

export default async function PartnerProductDetailPage({ params }: { params: { slug: string, serviceSlug: string } }) {
  const [partner, rawService] = await Promise.all([
    getPartnerBySlug(params.slug),
    getService(params.serviceSlug)
  ]);

  if (!partner || !rawService) {
    notFound();
  }

  const lp = partner.landingPage;
  const override = await getPartnerOverride(partner.id, rawService.id);

  // Merge override but prioritize AI branded content
  const service = override ? {
      ...rawService,
      ...override,
      title: override.title || rawService.title,
      price: override.price ?? rawService.price,
      description: override.description || rawService.description,
      longDescription: override.longDescription || rawService.longDescription,
      turnaroundTime: override.turnaroundTime || rawService.turnaroundTime,
  } : rawService;

  return (
    <div className="container mx-auto px-4 py-12">
      <Button variant="ghost" asChild className="mb-8 hover:partner-text">
        <Link href={`/p/${params.slug}`}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Services
        </Link>
      </Button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
        <div className="lg:col-span-2 space-y-8">
          <div className="space-y-4">
            <Badge variant="secondary" className="partner-btn-secondary">{service.category}</Badge>
            <h1 className="text-3xl md:text-5xl font-bold tracking-tight">{service.title}</h1>
            <div className="flex items-center gap-6">
               {service.isPriceTbc ? (
                <p className="text-2xl font-bold opacity-50">Price on Request</p>
              ) : (
                <p className="text-3xl font-bold partner-text">{formatPrice(service.price)}</p>
              )}
              <div className="flex items-center opacity-70">
                <Clock className="h-5 w-5 mr-2" />
                <span className="font-medium">{service.turnaroundTime}</span>
              </div>
            </div>
          </div>

          <div className="prose prose-blue max-w-none partner-text-main">
            <h2 className="text-xl font-semibold">Service Description</h2>
            <Separator className="my-4 opacity-20" />
            <p className="opacity-80 leading-relaxed text-lg whitespace-pre-wrap">
              {service.longDescription}
            </p>
          </div>

          {service.whatsIncluded.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold">What's Included</h2>
              <Separator className="opacity-20" />
              <ul className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {service.whatsIncluded.map((item, i) => (
                  <li key={i} className="flex items-start p-3 rounded-lg partner-card border">
                    <BadgeCheck className="h-5 w-5 mr-3 mt-0.5 partner-text flex-shrink-0" />
                    <span className="text-sm">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Prerequisites</h2>
            <Separator className="opacity-20" />
            <div className="border p-6 rounded-xl partner-card" style={{ borderLeftWidth: '4px', borderLeftColor: lp?.primaryColor }}>
              <ul className="space-y-3">
                {service.clientRequirements.map((req, i) => (
                  <li key={i} className="flex items-start">
                    <ClipboardCheck className="h-5 w-5 partner-text mr-3 mt-0.5 flex-shrink-0" />
                    <span className="text-sm opacity-90">{req}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        <aside className="lg:col-span-1">
          <div className="sticky top-24">
            <Card className="partner-card border-2 overflow-hidden shadow-xl">
              <CardHeader style={{ backgroundColor: lp?.secondaryColor || 'rgba(0,0,0,0.03)' }}>
                <CardTitle className="text-lg">Place Order</CardTitle>
                <CardDescription>Secure payment via My Accountant network</CardDescription>
              </CardHeader>
              <CardContent className="pt-6">
                <ServiceCheckoutForm service={service} partnerId={partner.id} />
              </CardContent>
              <CardFooter className="text-center border-t py-4" style={{ backgroundColor: 'rgba(0,0,0,0.02)' }}>
                <p className="text-[10px] opacity-50 px-4 uppercase tracking-widest font-bold">
                  Fulfilled by {partner.companyName || partner.name}
                </p>
              </CardFooter>
            </Card>
          </div>
        </aside>
      </div>
    </div>
  );
}
