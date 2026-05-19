'use client';
import Link from 'next/link';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Clock, 
  Loader2, 
  CheckCircle2, 
  ArrowRight, 
  ShoppingCart, 
  FileUp, 
  RefreshCw 
} from 'lucide-react';
import { collection, getFirestore, orderBy, query, onSnapshot } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { Service } from '@/lib/types';
import { useEffect, useState, useMemo } from 'react';

const db = getFirestore(firebaseApp);

type Category = { 
    id: string; 
    name: string; 
    description: string; 
    order: number; 
};

const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-ZA', {
      style: 'currency',
      currency: 'ZAR',
      minimumFractionDigits: price % 1 === 0 ? 0 : 2,
      maximumFractionDigits: 2,
    }).format(price);
};

export default function ProductsPageClient() {
  const [services, setServices] = useState<Service[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const servicesUnsubscribe = onSnapshot(query(collection(db, 'services'), orderBy('title')), (snapshot) => {
        const fetchedServices = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Service));
        setServices(fetchedServices);
        setIsLoading(false);
    });

    const categoriesUnsubscribe = onSnapshot(query(collection(db, 'categories'), orderBy('order')), (snapshot) => {
        const fetchedCategories = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Category));
        setCategories(fetchedCategories);
    });

    return () => {
        servicesUnsubscribe();
        categoriesUnsubscribe();
    }
  }, []);
  
  const categorizedServices = useMemo(() => {
    return categories
      .map(category => ({
        ...category,
        data: services.filter(s => s.category === category.name)
      }))
      .filter(c => c.data.length > 0);
  }, [categories, services]);


  return (
    <div className="container mx-auto px-4 py-12 bg-white">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold tracking-tight text-slate-900">Our <span className="text-gradient">Products</span></h1>
        <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
          Comprehensive solutions to meet all your financial needs. We offer a range of products for individuals and businesses.
        </p>
      </div>

      <div className="space-y-12">
        {isLoading ? (
            <div className="flex justify-center items-center h-40">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
            </div>
        ) : (
            categorizedServices.map(category => (
            <section key={category.id} id={category.name.toLowerCase().replace(/ /g, '-')} className="scroll-m-20">
                <h2 className="text-2xl font-bold mb-6">{category.name}</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {category.data.map(service => (
                    <Card
                    key={service.id}
                    className="flex flex-col overflow-hidden transition-all duration-300 hover:shadow-xl hover:-translate-y-1 bg-slate-50"
                    >
                    <CardHeader>
                        <CardTitle className="leading-tight">{service.title}</CardTitle>
                        {service.isPriceTbc ? (
                            <p className="text-xl font-bold text-muted-foreground pt-2">Price on request</p>
                        ) : (
                            <p className="text-2xl font-bold text-primary pt-2">{formatPrice(service.price)}</p>
                        )}
                        <div className="flex items-center text-muted-foreground pt-1">
                            <Clock className="h-4 w-4 mr-1.5" />
                            <span className="text-xs font-medium">{service.turnaroundTime}</span>
                        </div>
                    </CardHeader>
                    <CardContent className="flex-grow">
                        <CardDescription>{service.description}</CardDescription>
                        <p className="text-xs text-muted-foreground mt-2">Brand: {service.brand || 'My Accountant'}</p>
                    </CardContent>
                    <CardFooter>
                        <Button asChild className="w-full font-bold shadow-sm">
                        <Link href={`/products/${service.slug}`}>Learn More</Link>
                        </Button>
                    </CardFooter>
                    </Card>
                ))}
                </div>
            </section>
            ))
        )}
      </div>

      {/* PROCESS SECTION */}
      <section className="py-24 bg-white border-t mt-12">
        <div className="container mx-auto px-4">
          <div className="text-center mb-20 space-y-4">
            <h2 className="text-3xl font-black md:text-5xl uppercase tracking-tighter text-slate-900">How Our Online Accounting Process Works</h2>
            <p className="text-muted-foreground text-lg">Four simple steps to full compliance.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-12 relative">
            {[
              { step: "01", title: "Choose Your Service", desc: "Browse our online store and select the accounting, tax, or compliance service your business requires.", icon: ShoppingCart },
              { step: "02", title: "Upload Your Documents", desc: "Securely upload your supporting documents through our online platform.", icon: FileUp },
              { step: "03", title: "We Process Your Application", desc: "Our team handles the accounting, SARS, CIPC, or compliance process on your behalf.", icon: RefreshCw },
              { step: "04", title: "Receive Confirmation & Support", desc: "We provide updates, confirmations, and ongoing support throughout the process.", icon: CheckCircle2 }
            ].map((step, idx) => (
              <div key={idx} className="relative text-center space-y-6 group">
                <div className="h-20 w-20 rounded-3xl bg-slate-50 text-primary flex items-center justify-center mx-auto mb-6 group-hover:bg-primary group-hover:text-white transition-all shadow-md border border-primary/5">
                  <step.icon className="h-10 w-10" />
                </div>
                <div className="space-y-2">
                  <span className="text-[10px] font-black text-primary uppercase tracking-widest leading-none block mb-1">Step {step.step}</span>
                  <h3 className="font-bold text-xl leading-tight text-slate-900">{step.title}</h3>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed px-4">{step.desc}</p>
                {idx < 3 && <ArrowRight className="hidden lg:block absolute -right-6 top-10 h-8 w-8 text-primary/10" />}
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}