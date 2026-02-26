import { getFirestore, collection, getDocs, query, orderBy, where, Timestamp } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { User, Service } from '@/lib/types';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Clock, CheckCircle2, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import TrustIndexWidget from '@/components/shared/TrustIndexWidget';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

const db = getFirestore(firebaseApp);

export const dynamic = 'force-dynamic';

type Category = { 
    id: string; 
    name: string; 
    description: string; 
    order: number; 
};

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

async function getServices(): Promise<Service[]> {
  const q = query(collection(db, "services"), orderBy("title"));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => {
    const data = doc.data();
    const serviceData = { ...data, id: doc.id } as any;
    if (data.createdAt && data.createdAt instanceof Timestamp) {
        serviceData.createdAt = data.createdAt.toDate().toISOString();
    }
    return serviceData as Service;
  });
}

async function getCategories(): Promise<Category[]> {
    const q = query(collection(db, "categories"), orderBy("order"));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Category));
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

  const [services, categories] = await Promise.all([
    getServices(),
    getCategories()
  ]);

  const lp = partner.landingPage;
  const heroImage = lp?.heroImageUrl;
  const overlayOpacity = (lp?.heroOverlayOpacity || 0) / 100;
  const heroLayout = lp?.heroLayout || 'centered';
  const textPosition = lp?.heroTextPosition || 'inside';

  const categorizedServices = categories
    .map(category => ({
        ...category,
        data: services.filter(s => s.category === category.name)
    }))
    .filter(c => c.data.length > 0);

  const HeroContent = ({ isOverlay = true }: { isOverlay?: boolean }) => (
    <div className={cn(
        isOverlay && "container mx-auto px-4 relative z-10",
        heroLayout === 'split-left' && 'lg:mr-auto lg:ml-0 lg:max-w-xl',
        heroLayout === 'split-right' && 'lg:ml-auto lg:mr-0 lg:max-w-xl',
        heroLayout === 'background' && 'max-w-4xl mx-auto'
    )}>
      <div className="space-y-6">
        <h1 
            className="text-4xl md:text-6xl font-extrabold tracking-tight leading-tight"
            style={{ 
                color: isOverlay ? (lp?.heroTitleColor || (heroImage && overlayOpacity > 0.3 ? '#ffffff' : 'inherit')) : lp?.heroTitleColor || 'inherit'
            }}
        >
          {lp?.heroTitle}
        </h1>
        <p 
            className="text-xl opacity-90 leading-relaxed"
            style={{ 
                color: isOverlay ? (lp?.heroSubtitleColor || (heroImage && overlayOpacity > 0.3 ? '#ffffff' : 'inherit')) : lp?.heroSubtitleColor || 'inherit'
            }}
        >
          {lp?.heroSubtitle}
        </p>
      </div>
      <div className={cn(
          "flex gap-4 mt-8",
          heroLayout === 'centered' || heroLayout === 'background' ? 'justify-center' : 
          heroLayout === 'split-left' ? 'justify-start' : 'justify-end'
      )}>
        <Button size="lg" className="partner-btn" asChild>
          <Link href="#products">View Our Services</Link>
        </Button>
        <Button size="lg" variant="outline" className={cn(
            "partner-border",
            isOverlay && heroImage && overlayOpacity > 0.3 ? "bg-white/10 text-white hover:bg-white/20" : "partner-text"
        )} asChild>
          <Link href="#about">About Our Practice</Link>
        </Button>
      </div>
    </div>
  );

  return (
    <div className="space-y-24 pb-24">
      {/* Hero Section */}
      <section 
        className={cn(
            "relative overflow-hidden flex items-center",
            textPosition === 'inside' ? "py-20 lg:py-32" : "h-[300px] lg:h-[450px]",
            heroLayout === 'split-left' ? 'text-left' : heroLayout === 'split-right' ? 'text-right' : 'text-center'
        )}
        style={{ 
            backgroundColor: lp?.secondaryColor || 'rgba(0,0,0,0.03)',
            minHeight: textPosition === 'inside' ? (heroImage ? '500px' : 'auto') : 'auto',
            backgroundImage: heroImage ? `url("${heroImage}")` : 'none',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
        }}
      >
        {/* Overlay */}
        {heroImage && (
            <div 
                className="absolute inset-0 z-0" 
                style={{ backgroundColor: `rgba(0,0,0,${overlayOpacity})` }}
            />
        )}

        {textPosition === 'inside' && <HeroContent isOverlay={true} />}
      </section>

      {/* Text Below Hero Image */}
      {textPosition === 'below' && (
          <section className={cn(
              "container mx-auto px-4 -mt-12 lg:-mt-16 text-center"
          )}>
              <div className="bg-background p-8 md:p-12 rounded-2xl">
                <HeroContent isOverlay={false} />
              </div>
          </section>
      )}

      <div className="container mx-auto px-4">
        <TrustIndexWidget />
      </div>

      {/* About Section */}
      <section id="about" className="container mx-auto px-4 scroll-m-24">
        <div className="max-w-4xl mx-auto text-center space-y-6">
          <h2 className="text-3xl font-bold">About Our Practice</h2>
          <Separator className="w-24 mx-auto partner-border border-b-2 opacity-50" />
          <p className="text-lg opacity-80 leading-relaxed whitespace-pre-wrap">
            {lp?.aboutUs}
          </p>
        </div>
      </section>

      {/* Services Grid */}
      <section id="products" className="container mx-auto px-4 scroll-m-24 space-y-16">
        {lp?.servicesHeroImageUrl ? (
            <div 
                className="relative h-[200px] lg:h-[350px] rounded-2xl overflow-hidden flex items-center justify-center text-center"
                style={{ 
                    backgroundImage: `url("${lp.servicesHeroImageUrl}")`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center'
                }}
            >
                <div 
                    className="absolute inset-0" 
                    style={{ backgroundColor: `rgba(0,0,0,${(lp.servicesHeroOverlayOpacity || 0) / 100})` }}
                />
                <div className="relative z-10 space-y-4 px-6">
                    <h2 className="text-3xl md:text-5xl font-bold text-white">Accounting & Tax Solutions</h2>
                    <p className="text-white/90 max-w-2xl mx-auto">Comprehensive professional services for individuals and SMEs.</p>
                </div>
            </div>
        ) : (
            <div className="text-center space-y-4">
              <h2 className="text-3xl font-bold">Accounting & Tax Solutions</h2>
              <p className="opacity-70">Comprehensive professional services for individuals and SMEs.</p>
            </div>
        )}

        <div className="space-y-20">
            {categorizedServices.map((category) => (
                <div key={category.id} className="space-y-8">
                    <div className="flex items-center gap-4">
                        <h3 className="text-2xl font-bold">{category.name}</h3>
                        <Separator className="flex-grow opacity-20" />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {category.data.map((service) => (
                            <Card key={service.id} className="flex flex-col group hover:shadow-xl transition-all duration-300 partner-card border">
                                <CardHeader className="space-y-2 pb-4">
                                    <CardTitle className="text-2xl font-bold leading-tight group-hover:partner-text transition-colors">
                                        {service.title}
                                    </CardTitle>
                                    <div className="space-y-1">
                                        {service.isPriceTbc ? (
                                            <span className="text-xl font-bold opacity-50 block">Price on Request</span>
                                        ) : (
                                            <span className="text-2xl font-bold partner-text block">
                                                {formatPrice(service.price)}
                                            </span>
                                        )}
                                        <div className="flex items-center text-xs opacity-70 font-medium">
                                            <Clock className="h-4 w-4 mr-1.5 opacity-70" />
                                            {service.turnaroundTime}
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent className="flex-grow space-y-6">
                                    <p className="text-sm opacity-80 leading-relaxed line-clamp-3">
                                        {service.description}
                                    </p>
                                    <div className="space-y-3">
                                        <p className="text-sm font-semibold">What&apos;s Included:</p>
                                        <ul className="space-y-2">
                                            {service.whatsIncluded.slice(0, 3).map((item, i) => (
                                                <li key={i} className="flex items-start text-xs opacity-90">
                                                    <CheckCircle2 className="h-4 w-4 mr-3 mt-0.5 partner-text flex-shrink-0" />
                                                    <span className="leading-tight">{item}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                </CardContent>
                                <CardFooter className="pt-0">
                                    <Button variant="outline" className="w-full partner-border partner-text font-semibold h-11" asChild>
                                        <Link href={`/p/${params.slug}/products/${service.slug}`}>
                                            View Details <ArrowRight className="ml-2 h-4 w-4" />
                                        </Link>
                                    </Button>
                                </CardFooter>
                            </Card>
                        ))}
                    </div>
                </div>
            ))}
        </div>
      </section>
    </div>
  );
}
