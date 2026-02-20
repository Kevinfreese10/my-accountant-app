import { getFirestore, collection, getDocs, query, orderBy, where } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { User, Service } from '@/lib/types';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Clock, CheckCircle2, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import TrustIndexWidget from '@/components/shared/TrustIndexWidget';

const db = getFirestore(firebaseApp);

async function getPartnerBySlug(slug: string): Promise<User | null> {
  const q = query(
    collection(db, "users"), 
    where("landingPage.enabled", "==", true),
    where("landingPage.slug", "==", slug)
  );
  const snapshot = await getDocs(q);
  if (snapshot.empty) return null;
  return { ...snapshot.docs[0].data(), id: snapshot.docs[0].id, uid: snapshot.docs[0].id } as User;
}

async function getServices(): Promise<Service[]> {
  const q = query(collection(db, "services"), orderBy("title"));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Service));
}

const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-ZA', {
      style: 'currency',
      currency: 'ZAR',
      minimumFractionDigits: price % 1 === 0 ? 0 : 2,
      maximumFractionDigits: 2,
    }).format(price);
};

export default async function PartnerLandingPage({ params }: { params: { slug: string } }) {
  const partner = await getPartnerBySlug(params.slug);
  if (!partner) return null;

  const services = await getServices();
  const primaryColor = partner.landingPage?.primaryColor || '#214392';

  return (
    <div className="space-y-24 pb-24">
      {/* Hero Section */}
      <section className="relative bg-muted/30 py-20 lg:py-32">
        <div className="container mx-auto px-4 text-center space-y-8">
          <div className="max-w-3xl mx-auto space-y-6">
            <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight text-foreground leading-tight">
              {partner.landingPage?.heroTitle}
            </h1>
            <p className="text-xl text-muted-foreground leading-relaxed">
              {partner.landingPage?.heroSubtitle}
            </p>
          </div>
          <div className="flex justify-center gap-4">
            <Button size="lg" className="partner-btn" asChild>
              <Link href="#products">View Our Services</Link>
            </Button>
            <Button size="lg" variant="outline" className="partner-border partner-text" asChild>
              <Link href="#about">About Our Practice</Link>
            </Button>
          </div>
        </div>
      </section>

      <div className="container mx-auto px-4">
        <TrustIndexWidget />
      </div>

      {/* About Section */}
      <section id="about" className="container mx-auto px-4 scroll-m-24">
        <div className="max-w-4xl mx-auto text-center space-y-6">
          <h2 className="text-3xl font-bold">About Our Practice</h2>
          <Separator className="w-24 mx-auto partner-border border-b-2" />
          <p className="text-lg text-muted-foreground leading-relaxed whitespace-pre-wrap">
            {partner.landingPage?.aboutUs}
          </p>
        </div>
      </section>

      {/* Services Grid */}
      <section id="products" className="container mx-auto px-4 scroll-m-24 space-y-12">
        <div className="text-center space-y-4">
          <h2 className="text-3xl font-bold">Accounting & Tax Solutions</h2>
          <p className="text-muted-foreground">Comprehensive professional services for individuals and SMEs.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {services.map((service) => (
            <Card key={service.id} className="flex flex-col group hover:shadow-lg transition-all duration-300">
              <CardHeader>
                <div className="space-y-1">
                  <Badge variant="secondary" className="mb-2">{service.category}</Badge>
                  <CardTitle className="group-hover:partner-text transition-colors">{service.title}</CardTitle>
                </div>
                <div className="pt-4 flex items-center justify-between">
                  {service.isPriceTbc ? (
                    <span className="text-lg font-bold text-muted-foreground">Price on Request</span>
                  ) : (
                    <span className="text-2xl font-bold" style={{ color: primaryColor }}>{formatPrice(service.price)}</span>
                  )}
                  <div className="flex items-center text-xs text-muted-foreground">
                    <Clock className="h-3 w-3 mr-1" />
                    {service.turnaroundTime}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="flex-grow">
                <p className="text-sm text-muted-foreground line-clamp-3">{service.description}</p>
                <ul className="mt-4 space-y-2">
                  {service.whatsIncluded.slice(0, 3).map((item, i) => (
                    <li key={i} className="flex items-start text-xs text-muted-foreground">
                      <CheckCircle2 className="h-3 w-3 mr-2 mt-0.5 partner-text" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
              <CardFooter>
                <Button variant="outline" className="w-full group-hover:partner-btn transition-all" asChild>
                  <Link href={`/p/${params.slug}/products/${service.slug}`}>
                    View Details <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      </section>

      {/* Trust & Closing */}
      <section className="bg-muted/30 py-20">
        <div className="container mx-auto px-4 text-center max-w-2xl space-y-8">
          <h2 className="text-3xl font-bold">Ready to Start?</h2>
          <p className="text-lg text-muted-foreground">
            Partner with a practice that understands your growth. Our experts are ready to handle your compliance so you can focus on your business.
          </p>
          <Button size="lg" className="partner-btn px-12" asChild>
            <Link href={`mailto:${partner.email}`}>Get in Touch</Link>
          </Button>
        </div>
      </section>
    </div>
  );
}
