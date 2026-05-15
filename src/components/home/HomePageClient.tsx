
'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Rocket, ShieldCheck, Wallet, Clock, Search, Loader2, CheckCircle2, ArrowRight, Calculator, Users, Landmark, Scale, Building, MapPin } from 'lucide-react';
import { Input } from '@/components/ui/input';
import TrustIndexWidget from '@/components/shared/TrustIndexWidget';
import { Service } from '@/lib/types';
import { useEffect, useState, useMemo } from 'react';
import { getFirestore, collection, getDocs, orderBy, query, Timestamp } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError, type SecurityRuleContext } from '@/firebase/errors';
import { Separator } from '../ui/separator';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

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

export default function HomePageClient() {
  const [services, setServices] = useState<Service[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      
      const servicesRef = collection(db, 'services');
      const servicesQuery = query(servicesRef, orderBy('title'));
      getDocs(servicesQuery)
        .then((snapshot) => {
          const fetchedServices = snapshot.docs.map(doc => {
            const data = doc.data();
            const serviceData = { ...data, id: doc.id } as any;
            if (data.createdAt && data.createdAt instanceof Timestamp) {
                serviceData.createdAt = data.createdAt.toDate().toISOString();
            }
            return serviceData as Service;
          });
          setServices(fetchedServices);
        })
        .catch(async (error) => {
          const permissionError = new FirestorePermissionError({
            path: servicesRef.path,
            operation: 'list',
          } satisfies SecurityRuleContext);
          errorEmitter.emit('permission-error', permissionError);
        });

      const categoriesRef = collection(db, 'categories');
      const categoriesQuery = query(categoriesRef, orderBy('order'));
      getDocs(categoriesQuery)
        .then((snapshot) => {
          const fetchedCategories = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Category));
          setCategories(fetchedCategories);
        })
        .catch(async (error) => {
          const permissionError = new FirestorePermissionError({
            path: categoriesRef.path,
            operation: 'list',
          } satisfies SecurityRuleContext);
          errorEmitter.emit('permission-error', permissionError);
        })
        .finally(() => {
          setIsLoading(false);
        });
    };

    fetchData();
  }, []);

  const whyChooseUs = [
    {
      title: 'Expert & Reliable',
      description: 'Our team of seasoned professionals ensures accuracy and dependability.',
      icon: ShieldCheck,
    },
    {
      title: 'Affordable Pricing',
      description: 'Transparent, competitive rates with no hidden costs.',
      icon: Wallet,
    },
    {
      title: 'Fast Turnaround',
      description: 'We prioritize efficiency to meet your deadlines without compromising quality.',
      icon: Rocket,
    },
  ];
  
  const categorizedServices = useMemo(() => {
    let filteredServices = services;
    if (searchTerm) {
        filteredServices = services.filter(service => 
            service.title.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }

    return categories
      .map(category => ({
          ...category,
          data: filteredServices.filter(s => s.category === category.name)
      }))
      .filter(c => c.data.length > 0);
  }, [categories, services, searchTerm]);

  const keywordButtons = [
    { label: 'Entity Registrations', href: '/products#entity-registrations' },
    { label: 'SARS Services', href: '/products#sars-services' },
    { label: 'CIPC Services', href: '/products#cipc-services' },
    { label: 'Accounting Services', href: '/products#accounting-services' },
    { label: 'Payroll Services', href: '/products#payroll-services' },
  ];

  const servicePillars = [
    {
      title: 'Monthly Accounting',
      description: 'Full-service bookkeeping, management accounts, and VAT for South African SMEs.',
      icon: Calculator,
      href: '/monthly-accounting',
    },
    {
      title: 'Monthly Payroll',
      description: 'Compliant payroll management, digital payslips, and statutory SARS submissions.',
      icon: Users,
      href: '/monthly-payroll',
    },
    {
      title: 'Tax Compliance',
      description: 'Expert SARS representation, income tax returns, and free compliance health checks.',
      icon: Landmark,
      href: '/compliance',
    },
    {
      title: 'Liquidations',
      description: 'Professional assistance with voluntary company liquidations and responsible business closure.',
      icon: Scale,
      href: '/liquidations',
    },
  ];

  const specialisations = [
    { label: "SARS tax services", href: "/products#sars-services" },
    { label: "Company registrations", href: "/products#entity-registrations" },
    { label: "VAT and PAYE registrations", href: "/products#sars-services" },
    { label: "Monthly bookkeeping", href: "/products#accounting-services" },
    { label: "Payroll services", href: "/products#payroll-services" },
    { label: "Annual Financial Statements", href: "/products#accounting-services" },
    { label: "CIPC annual returns", href: "/products#cipc-services" },
    { label: "Tax clearance certificates", href: "/products#sars-services" },
    { label: "Beneficial Ownership submissions", href: "/products#cipc-services" },
    { label: "COIDA registrations", href: "/products#coida-services" },
    { label: "CIDB registrations", href: "/products#cidb-services" },
    { label: "NCR registrations", href: "/products#ncr-services" }
  ];

  return (
    <div className="space-y-16 pb-16">
      {/* Hero Image Section */}
      <section className="relative w-full aspect-[16/9] lg:aspect-[21/9] xl:aspect-[24/9] overflow-hidden bg-slate-900">
        <Image 
          src="https://firebasestorage.googleapis.com/v0/b/studio-2604127518-57889.firebasestorage.app/o/uploads%2FLRM285EOq3gwNMKayY6vtzooaC03%2F1778842309292-South%20Africa%E2%80%99s%20Trusted%20Online%20Accounting%20%26%20Tax%20Compliance%20Partner%20(1).png?alt=media&token=f64e0df6-ab06-4ebb-9470-e15c9f827437"
          alt="My Accountant - South Africa's Trusted Online Accounting & Tax Compliance Partner"
          fill
          priority
          className="object-contain lg:object-cover"
          data-ai-hint="accounting banner"
        />
      </section>

      {/* Hero Content Section (Below Image) */}
      <section className="container mx-auto px-4 text-center">
        <div className="max-w-4xl mx-auto space-y-6">
          <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl md:text-5xl lg:text-6xl text-slate-900">
            South Africa’s Leading Online Accounting, Tax & Compliance Firm
          </h1>
          <p className="text-lg sm:text-xl md:text-2xl font-medium text-muted-foreground max-w-3xl mx-auto">
            Professional SARS, CIPC, bookkeeping, payroll, tax and business compliance services for South African businesses and entrepreneurs.
          </p>
          
          <div className="flex flex-wrap justify-center gap-3 pt-4">
            {keywordButtons.map((btn) => (
              <Button key={btn.label} asChild variant="outline" className="h-9 md:h-11 px-4 md:px-6 rounded-full font-bold transition-all">
                <Link href={btn.href}>{btn.label}</Link>
              </Button>
            ))}
          </div>
        </div>
      </section>

      {/* SEO Content Section */}
      <section className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto space-y-12">
            <div className="text-center space-y-6">
                <h2 className="text-3xl md:text-4xl font-bold text-slate-900 tracking-tight">Professional Accounting & Tax Services in South Africa</h2>
                <div className="space-y-4 text-lg text-muted-foreground leading-relaxed">
                    <p>
                        At My Accountant, we help South African businesses, entrepreneurs, freelancers and individuals stay compliant with SARS, CIPC and all financial regulations. Our online accounting firm provides affordable and professional accounting services throughout South Africa.
                    </p>
                    <p>
                        Whether you need assistance with company registration, VAT registration, bookkeeping, payroll, annual financial statements, tax returns or CIPC compliance, our experienced team is ready to assist.
                    </p>
                </div>
            </div>
            
            <div className="space-y-6">
                <h3 className="text-xl font-bold text-center text-slate-900 uppercase tracking-widest text-xs">We specialise in:</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {specialisations.map((item) => (
                        <Link key={item.label} href={item.href} className="group">
                            <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-xl border border-slate-100 shadow-sm transition-all group-hover:border-primary/30 group-hover:bg-primary/5">
                                <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                                <span className="text-sm font-semibold text-slate-700 group-hover:text-primary transition-colors">{item.label}</span>
                            </div>
                        </Link>
                    ))}
                </div>
            </div>

            <p className="text-lg text-center text-muted-foreground leading-relaxed font-medium">
                Our goal is to simplify accounting and compliance so that business owners can focus on growing their businesses while we manage the administration and regulatory requirements.
            </p>
        </div>
      </section>

      {/* Service Pillars / Internal Linking Blocks */}
      <section className="bg-slate-50 py-16 border-y">
        <div className="container mx-auto px-4">
            <div className="text-center mb-12">
                <h2 className="text-3xl font-bold tracking-tight text-slate-900">Explore Our Core Solutions</h2>
                <p className="text-muted-foreground mt-2">Comprehensive financial and regulatory support for your growing business.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
                {servicePillars.map((pillar) => (
                    <Link key={pillar.title} href={pillar.href} className="group">
                        <Card className="h-full border-2 transition-all group-hover:border-primary group-hover:shadow-xl group-hover:-translate-y-1">
                            <CardHeader>
                                <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary group-hover:text-white transition-colors">
                                    <pillar.icon className="h-6 w-6" />
                                </div>
                                <CardTitle className="text-xl group-hover:text-primary transition-colors">{pillar.title}</CardTitle>
                                <CardDescription className="leading-relaxed">
                                    {pillar.description}
                                </CardDescription>
                            </CardHeader>
                            <CardFooter className="pt-0">
                                <span className="text-sm font-bold text-primary flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    Learn More <ArrowRight className="h-3 w-3" />
                                </span>
                            </CardFooter>
                        </Card>
                    </Link>
                ))}
            </div>
        </div>
      </section>

      <TrustIndexWidget />

      {/* Location SEO Section */}
      <section className="container mx-auto px-4 py-12 bg-white">
        <div className="max-w-4xl mx-auto text-center space-y-6">
            <div className="flex items-center justify-center gap-2 text-primary font-bold uppercase text-xs tracking-widest">
                <MapPin className="h-4 w-4" /> Based in Gauteng
            </div>
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 tracking-tight">Accounting Firm in Randburg, Johannesburg</h2>
            <div className="space-y-4 text-lg text-muted-foreground leading-relaxed">
                <p>
                    My Accountant is based in Randburg, Johannesburg and provides online accounting and tax services across South Africa. Our digital platform allows clients nationwide to securely upload documents, purchase services online and communicate directly with our team.
                </p>
                <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm font-semibold text-slate-500 uppercase tracking-tighter">
                    <span>• Accountant Randburg</span>
                    <span>• Accountants Johannesburg</span>
                    <span>• Tax Consultant Johannesburg</span>
                    <span>• Bookkeeping Randburg</span>
                </div>
            </div>
        </div>
      </section>

      {/* About Section */}
      <section id="about" className="container mx-auto px-4 py-8 scroll-m-20">
        <div className="max-w-4xl mx-auto text-center space-y-12">
            <div className="space-y-6">
                <div className="space-y-4">
                    <h2 className="text-4xl font-bold tracking-tight">About My Accountant</h2>
                    <p className="text-xl text-muted-foreground font-medium">Your dynamic partner in conquering the financial world.</p>
                </div>
                
                <div className="space-y-6 text-lg text-muted-foreground leading-relaxed text-left sm:text-center">
                    <p>
                        Welcome to My Accountant—your dynamic partner in conquering the financial world. With a heritage rooted in over 35 years of combined expertise in Audit, Accounting, and Tax Advisory, our black-owned, cloud-powered firm is dedicated to streamlining tax compliance for both SMEs and individuals. Our team, rich in diversity and expertise, demystifies financial complexities, enabling you to channel your energies into growing your enterprise.
                    </p>
                    <p>
                        At My Accountant we go beyond accounting; we’re your partners in progress, equipped with the latest tech and deep insights to propel your business forward. Embrace a financial journey marked by growth, clarity, and success with us. Let’s navigate the path to your financial empowerment together, making every step towards achieving your business ambitions a confident stride into a prosperous future.
                    </p>
                </div>
            </div>

            <Separator className="max-w-xs mx-auto" />

            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="vision" className="border-none">
                <AccordionTrigger className="text-3xl font-bold tracking-tight hover:no-underline justify-center gap-4">
                  Our Vision
                </AccordionTrigger>
                <AccordionContent className="text-lg text-muted-foreground leading-relaxed text-left sm:text-center pt-4">
                  <div className="space-y-6">
                    <p>
                        Our vision at My Accountant is to redefine excellence in financial services, grounded in integrity, transparency, and professionalism. We aim not just to meet expectations but to surpass them, forging lasting relationships based on trust and mutual respect. We’re committed to your long-term success, employing a forward-thinking strategy to stay ahead of financial trends and provide solutions that cater to your evolving needs.
                    </p>
                    <p>
                        As your trusted partners, we’re dedicated to your growth, offering personalized guidance through every financial challenge and opportunity. Our mission is to empower you with the knowledge and strategies for lasting prosperity, ensuring you navigate the future with confidence. Join us in a journey toward achieving your highest potential, where commitment to excellence and client success lights the way. Together, let’s build a legacy of success and achieve greatness.
                    </p>
                  </div>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="mission" className="border-none">
                <AccordionTrigger className="text-3xl font-bold tracking-tight hover:no-underline justify-center gap-4">
                  Our Mission
                </AccordionTrigger>
                <AccordionContent className="text-lg text-muted-foreground leading-relaxed text-left sm:text-center pt-4">
                  <div className="space-y-6">
                    <p>
                        Our mission at My Accountant is to set a new standard in financial and professional services, driven by our core values of integrity, transparency, and professionalism. We’re committed to not just meeting, but exceeding your expectations, building a foundation of trust and reliability with every interaction.
                    </p>
                    <p>
                        We see your success as a journey, not just a destination. That’s why we’re dedicated to supporting both your immediate and future financial goals with our forward-thinking approach. Our team is passionate about providing personalized solutions that cater to your unique needs, empowering you to navigate the complexities of finance with confidence.
                    </p>
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
        </div>
      </section>

      <section className="bg-background pt-8">
         <div className="container mx-auto px-4">
            <div className="text-center mb-12">
                <h2 className="text-3xl font-bold">Why Choose My Accountant?</h2>
                <p className="text-muted-foreground mt-2 max-w-2xl mx-auto">
                    We're committed to providing you with the best service possible.
                </p>
            </div>
            <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
                {whyChooseUs.map(item => (
                    <div key={item.title} className="flex items-start gap-4">
                        <div className="flex-shrink-0">
                            <item.icon className="h-8 w-8 text-primary" />
                        </div>
                        <div>
                            <h3 className="font-semibold">{item.title}</h3>
                            <p className="text-sm text-muted-foreground">{item.description}</p>
                        </div>
                    </div>
                ))}
            </div>
        </div>
      </section>

      <section>
        <div className="container mx-auto max-w-2xl px-4">
          <form className="relative" onSubmit={(e) => e.preventDefault()}>
            <Input
              type="search"
              placeholder="Search for a product (e.g., 'Company Registration')"
              className="h-12 w-full rounded-md border-input bg-background pr-14 text-base"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <div
              className="absolute right-1 top-1/2 h-10 w-10 -translate-y-1/2 flex items-center justify-center"
            >
              <Search className="h-5 w-5 text-muted-foreground" />
              <span className="sr-only">Search</span>
            </div>
          </form>
        </div>
      </section>
      
        <div id="products" className="container mx-auto px-4 space-y-12 scroll-m-20">
            {isLoading ? (
                <div className="flex justify-center items-center h-40">
                    <Loader2 className="h-12 w-12 animate-spin text-primary" />
                </div>
            ) : categorizedServices.length > 0 ? (
                categorizedServices.map(category => (
                <section key={category.id} id={category.name.toLowerCase().replace(/ /g, '-')}>
                    <div className="text-center mb-8">
                        <h2 className="text-3xl font-bold">{category.name}</h2>
                        <p className="text-muted-foreground mt-2 max-w-2xl mx-auto">
                            {category.description}
                        </p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {category.data.map(service => (
                        <Card key={service.id} className="flex flex-col group hover:shadow-xl transition-all duration-300 border">
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
                                <div className="space-y-3">
                                    <p className="text-sm font-semibold">What&apos;s Included:</p>
                                    <ul className="space-y-2">
                                        {(service.whatsIncluded || []).slice(0, 3).map((item, i) => (
                                            <li key={i} className="flex items-start text-xs opacity-90">
                                                <CheckCircle2 className="h-4 w-4 mr-3 mt-0.5 text-primary flex-shrink-0" />
                                                <span className="leading-tight">{item}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
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
                </section>
                ))
              ) : (
                 <div className="text-center py-10">
                    <p className="text-muted-foreground">No services found for "{searchTerm}".</p>
                 </div>
              )
            }
      </div>
    </div>
  );
}
