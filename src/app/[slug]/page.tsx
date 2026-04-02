import { getFirestore, collection, getDocs, query, orderBy, where, Timestamp } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { User, Service } from '@/lib/types';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Clock, CheckCircle2, ArrowRight, MapPin } from 'lucide-react';
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

async function getFranchiseBySlug(slug: string): Promise<User | null> {
  const q = query(
    collection(db, "users"), 
    where("role", "==", "franchisee"),
    where("franchise.areaSlug", "==", slug)
  );
  const snapshot = await getDocs(q);
  if (snapshot.empty) return null;
  const doc = snapshot.docs[0];
  const data = doc.data();

  return {
    ...data,
    id: doc.id,
    uid: doc.id,
  } as User;
}

async function getServices(): Promise<Service[]> {
  const q = query(collection(db, "services"), orderBy("title"));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Service));
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

export default async function FranchiseLandingPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const franchisee = await getFranchiseBySlug(slug);
  if (!franchisee) return null;

  const [services, categories] = await Promise.all([
    getServices(),
    getCategories()
  ]);

  const categorizedServices = categories
    .map(category => ({
        ...category,
        data: services.filter(s => s.category === category.name)
    }))
    .filter(c => c.data.length > 0);

  return (
    <div className="space-y-24 pb-24">
      {/* Hero Section */}
      <section className="bg-slate-900 text-white py-24 relative overflow-hidden">
        <div className="container mx-auto px-4 text-center relative z-10">
          <Badge className="mb-4 bg-primary hover:bg-primary text-white border-none px-4 py-1 uppercase font-black tracking-widest flex items-center w-fit mx-auto gap-2">
            <MapPin className="h-3 w-3" /> {franchisee.franchise?.areaName} Branch
          </Badge>
          <h1 className="text-4xl md:text-6xl font-black tracking-tight leading-tight">
            My Accountant <span className="text-primary">{franchisee.franchise?.areaName}</span>
          </h1>
          <p className="mt-6 text-xl text-slate-300 max-w-3xl mx-auto font-medium leading-relaxed">
            Professional accounting, tax, and compliance solutions delivered with local expertise and national standards.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row justify-center gap-4">
            <Button asChild size="lg" className="h-12 px-8 font-bold">
              <Link href="#products">Explore Services</Link>
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
          <h2 className="text-3xl font-bold text-slate-900">Your Local Compliance Partner</h2>
          <Separator className="w-24 mx-auto border-b-2 border-primary/30" />
          <p className="text-lg opacity-80 leading-relaxed">
            Welcome to My Accountant {franchisee.franchise?.areaName}. We are proud to serve the local community with standard-setting financial services. 
            Leveraging the powerful My Accountant technical engine and back-office team, we provide accuracy, speed, and peace of mind for every client.
          </p>
        </div>
      </section>

      {/* Services Grid */}
      <section id="products" className="container mx-auto px-4 space-y-20 scroll-m-24">
            {categorizedServices.map((category) => (
                <div key={category.id} className="space-y-12">
                    <div className="text-center space-y-4 max-w-2xl mx-auto">
                        <h3 className="text-3xl font-bold text-slate-900">{category.name}</h3>
                        <Separator className="w-16 mx-auto border-b-2 border-primary/20" />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {category.data.map((service) => (
                            <Card key={service.id} className="flex flex-col group hover:shadow-xl transition-all duration-300 border shadow-sm">
                                <CardHeader className="space-y-2 pb-4">
                                    <CardTitle className="text-2xl font-bold leading-tight group-hover:text-primary transition-colors">
                                        {service.title}
                                    </CardTitle>
                                    <div className="space-y-1">
                                        {service.isPriceTbc ? (
                                            <span className="text-xl font-bold opacity-50 block">Price on Request</span>
                                        ) : (
                                            <span className="text-2xl font-bold text-primary block">
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
                                </CardContent>
                                <CardFooter className="pt-0">
                                    <Button variant="outline" className="w-full border-primary text-primary font-semibold h-11" asChild>
                                        <Link href={`/products/${service.slug}`}>
                                            View Details <ArrowRight className="ml-2 h-4 w-4" />
                                        </Link>
                                    </Button>
                                </CardFooter>
                            </Card>
                        ))}
                    </div>
                </div>
            ))}
      </section>
    </div>
  );
}
