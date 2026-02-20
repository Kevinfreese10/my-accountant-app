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
    
    const serviceData = { id: doc.id, ...data } as any;
    if (data.createdAt instanceof Timestamp) {
        serviceData.createdAt = data.createdAt.toDate().toISOString();
    }
    return serviceData as Service;
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
  const [partner, service] = await Promise.all([
    getPartnerBySlug(params.slug),
    getService(params.serviceSlug)
  ]);

  if (!partner || !service) {
    notFound();
  }

  const primaryColor = partner.landingPage?.primaryColor || '#214392';

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
            <Badge variant="secondary">{service.category}</Badge>
            <h1 className="text-3xl md:text-5xl font-bold tracking-tight">{service.title}</h1>
            <div className="flex items-center gap-6">
               {service.isPriceTbc ? (
                <p className="text-2xl font-bold text-muted-foreground">Price on Request</p>
              ) : (
                <p className="text-3xl font-bold" style={{ color: primaryColor }}>{formatPrice(service.price)}</p>
              )}
              <div className="flex items-center text-muted-foreground">
                <Clock className="h-5 w-5 mr-2" />
                <span className="font-medium">{service.turnaroundTime}</span>
              </div>
            </div>
          </div>

          <div className="prose prose-blue max-w-none">
            <h2 className="text-xl font-semibold">Service Description</h2>
            <Separator className="my-4" />
            <p className="text-muted-foreground leading-relaxed text-lg">
              {service.longDescription}
            </p>
          </div>

          {service.whatsIncluded.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold">What's Included</h2>
              <Separator />
              <ul className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {service.whatsIncluded.map((item, i) => (
                  <li key={i} className="flex items-start bg-muted/30 p-3 rounded-lg">
                    <BadgeCheck className="h-5 w-5 mr-3 mt-0.5 partner-text" />
                    <span className="text-sm">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Prerequisites</h2>
            <Separator />
            <div className="bg-orange-50 border border-orange-100 p-6 rounded-xl">
              <ul className="space-y-3">
                {service.clientRequirements.map((req, i) => (
                  <li key={i} className="flex items-start">
                    <ClipboardCheck className="h-5 w-5 text-orange-600 mr-3 mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-orange-900">{req}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        <aside className="lg:col-span-1">
          <div className="sticky top-24">
            <Card className="border-2 partner-border overflow-hidden shadow-xl">
              <CardHeader className="bg-muted/30">
                <CardTitle className="text-lg">Place Order</CardTitle>
                <CardDescription>Secure payment via My Accountant network</CardDescription>
              </CardHeader>
              <CardContent className="pt-6">
                <ServiceCheckoutForm service={service} partnerId={partner.id} />
              </CardContent>
              <CardFooter className="bg-muted/10 text-center border-t py-4">
                <p className="text-[10px] text-muted-foreground px-4 uppercase tracking-widest font-bold">
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
