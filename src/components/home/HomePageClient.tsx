'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState, useEffect, useMemo } from 'react';
import { 
  Rocket, 
  ShieldCheck, 
  Wallet, 
  CheckCircle2, 
  ArrowRight, 
  Calculator, 
  Users, 
  Landmark, 
  Building, 
  MapPin,
  ClipboardList,
  RefreshCw,
  Info,
  Briefcase,
  TrendingUp,
  ShoppingCart,
  FileUp,
  Bot,
  CheckCircle,
  FileText,
  Smartphone,
  Globe,
  HardHat,
  Camera,
  User,
  Utensils,
  ShoppingBag,
  Loader2,
  ChevronRight,
  PlusCircle,
  Calendar as CalendarIcon,
  Clock
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { 
  Accordion, 
  AccordionContent, 
  AccordionItem, 
  AccordionTrigger 
} from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import TrustIndexWidget from '@/components/shared/TrustIndexWidget';
import Script from 'next/script';
import { useBlog } from '@/contexts/BlogContext';
import { format } from 'date-fns';
import { useCart } from '@/contexts/CartContext';
import { Service } from '@/lib/types';
import { getFirestore, collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';

const db = getFirestore(firebaseApp);

export default function HomePageClient() {
  const [mounted, setMounted] = useState(false);
  const { blogPosts, isLoading: isBlogLoading } = useBlog();
  const [services, setServices] = useState<Service[]>([]);
  const [isLoadingServices, setIsLoadingServices] = useState(true);

  useEffect(() => {
    setMounted(true);
    const unsub = onSnapshot(query(collection(db, 'services'), orderBy('title')), (snap) => {
        setServices(snap.docs.map(d => ({ ...d.data(), id: d.id } as Service)));
        setIsLoadingServices(false);
    });
    return () => unsub();
  }, []);

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-ZA', {
      style: 'currency',
      currency: 'ZAR',
      minimumFractionDigits: price % 1 === 0 ? 0 : 2,
      maximumFractionDigits: 2,
    }).format(price);
  };

  const trustIndicators = [
    { label: "Trusted by South African businesses", icon: CheckCircle },
    { label: "Professional accounting & compliance support", icon: ShieldCheck },
    { label: "Online service delivery nationwide", icon: Globe },
    { label: "Transparent pricing", icon: Wallet },
    { label: "Secure document submission", icon: ShieldCheck }
  ];

  const trustBlocks = [
    { title: "Professional & Reliable", desc: "Our team focuses on practical accounting and compliance solutions designed specifically for South African businesses.", icon: ShieldCheck },
    { title: "Nationwide Online Support", desc: "We assist clients throughout Johannesburg, Pretoria, Durban, Cape Town, Gauteng, and across South Africa.", icon: Globe },
    { title: "Transparent Process", desc: "Our online system makes it easy to purchase services, upload documents, and track your compliance requirements.", icon: RefreshCw },
    { title: "Business Compliance Specialists", desc: "We assist businesses with ongoing SARS, CIPC, payroll, and accounting compliance requirements.", icon: Landmark }
  ];

  const servicePillars = [
      { title: 'Monthly Accounting', href: '/monthly-accounting', icon: Calculator, desc: 'Professional bookkeeping, management accounts, and financial reporting.' },
      { title: 'Monthly Payroll', href: '/monthly-payroll', icon: Users, desc: 'Digital payslips, EMP201 submissions, and UIF declarations.' },
      { title: 'Tax Compliance', href: '/compliance', icon: Landmark, desc: 'VAT registration, income tax returns, and SARS disputes.' },
      { title: 'Company Liquidations', href: '/liquidations', icon: Briefcase, desc: 'Voluntary liquidations and legal company closures.' },
  ];

  const industries = [
    { title: "Accounting for SMEs", slug: "sme", icon: Building, desc: "Scale from startup to market player with expert financial structure." },
    { title: "Accounting for Construction", slug: "construction", icon: HardHat, desc: "Project-based tracking for builders and contractors." },
    { title: "Accounting for Influencers", slug: "influencers", icon: Camera, desc: "Tax optimization and income tracking for digital creators." },
    { title: "Accounting for Freelancers", slug: "freelancers", icon: User, desc: "Simple bookkeeping and tax for independent professionals." },
    { title: "Accounting for Restaurants", slug: "restaurants", icon: Utensils, desc: "Inventory and POS management for the hospitality sector." },
    { title: "Accounting for E-commerce", slug: "ecommerce", icon: ShoppingBag, desc: "Automated VAT and multi-currency tracking for online stores." },
  ];

  const faqData = [
    { q: "How long does company registration take in South Africa?", a: "Most company registrations are completed within 1–3 working days depending on CIPC processing times." },
    { q: "Can I register for VAT online?", a: "Yes. My Accountant assists businesses throughout South Africa with SARS VAT registrations and VAT compliance services." },
    { q: "Do you offer online accounting services?", a: "Yes. Our systems allow clients nationwide to securely upload documents and communicate directly with our consultants online." },
    { q: "Can you assist with SARS tax debt?", a: "Yes. We assist with SARS disputes, payment arrangements, penalty remissions and tax debt compromise applications." },
    { q: "Do you assist small businesses?", a: "Yes. We specialize in assisting startups, entrepreneurs and small to medium-sized businesses throughout South Africa." },
    { q: "Do you provide bookkeeping services?", a: "Yes. We provide monthly bookkeeping and accounting services tailored to the needs of South African businesses." }
  ];

  const categorizedServices = useMemo(() => {
    const groups: Record<string, Service[]> = {};
    services.forEach(s => {
        if (!groups[s.category]) groups[s.category] = [];
        groups[s.category].push(s);
    });
    return groups;
  }, [services]);

  if (!mounted) return null;

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": faqData.map(item => ({
      "@type": "Question",
      "name": item.q,
      "acceptedAnswer": {
        "@type": "Answer",
        "text": item.a
      }
    }))
  };

  return (
    <div className="flex flex-col min-h-screen">
      <Script
        id="faq-schema"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
      
      {/* HERO SECTION */}
      <section className="relative w-full overflow-hidden bg-slate-900 pt-16 lg:pt-24 pb-20">
        <div className="absolute inset-0 z-0 opacity-20">
          <Image 
            src="https://firebasestorage.googleapis.com/v0/b/studio-2604127518-57889.firebasestorage.app/o/uploads%2FLRM285EOq3gwNMKayY6vtzooaC03%2F1778852737208-South%20Africa%E2%80%99s%20Trusted%20Online%20Accounting%20%26%20Tax%20Compliance%20Partner%20(2).png?alt=media&token=3e8db3bc-8d7a-44b3-a258-dce170c9076d"
            alt="My Accountant - Online Accounting & Tax Services"
            fill
            priority
            className="object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-slate-900/60 to-slate-900" />
        </div>

        <div className="container relative z-10 mx-auto px-4 text-center">
          <h1 className="mb-6 text-4xl font-black tracking-tight text-white md:text-6xl lg:text-7xl">
            Online Accounting, Tax & <span className="text-primary">CIPC Services</span> in South Africa
          </h1>
          <div className="mx-auto mb-10 max-w-4xl text-lg font-medium text-slate-300 md:text-xl leading-relaxed">
            <p>
              My Accountant helps South African businesses stay compliant with professional accounting, tax, payroll, SARS, and CIPC services — all through a simple online process.
            </p>
            <p className="mt-4 text-base text-slate-400">
              Whether you need company registration, VAT registration, bookkeeping, payroll, annual financial statements, tax compliance, or CIPC annual returns, our team assists businesses throughout Johannesburg, Randburg, Gauteng, and across South Africa.
            </p>
          </div>
          <div className="flex flex-col gap-4 sm:flex-row sm:justify-center">
            <Button asChild size="lg" className="h-14 px-10 text-lg font-bold shadow-xl">
              <Link href="/signup">Get Started</Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="h-14 px-10 text-lg font-bold border-2 border-white/20 text-white hover:bg-white/10 backdrop-blur-sm">
              <Link href="/products">View Services</Link>
            </Button>
            <Button asChild variant="secondary" size="lg" className="h-14 px-10 text-lg font-bold shadow-lg">
              <Link href="/compliance">Request a Compliance Assessment</Link>
            </Button>
          </div>

          <div className="mt-16 grid grid-cols-2 md:grid-cols-5 gap-4 max-w-5xl mx-auto">
              {trustIndicators.map((item, idx) => (
                  <div key={idx} className="flex flex-col items-center gap-2 text-slate-300">
                      <item.icon className="h-5 w-5 text-primary" />
                      <span className="text-[10px] font-bold uppercase tracking-wider text-center leading-tight">{item.label}</span>
                  </div>
              ))}
          </div>
        </div>
      </section>

      <TrustIndexWidget />

      {/* TRUST & AUTHORITY SECTION */}
      <section className="py-24 bg-white">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div className="space-y-6">
              <h2 className="text-3xl font-black tracking-tight text-slate-900 md:text-4xl">
                Why South African Businesses Choose My Accountant
              </h2>
              <div className="space-y-4 text-lg text-muted-foreground leading-relaxed">
                <p>
                  At My Accountant, we focus on helping South African entrepreneurs, startups, SMEs, and established businesses simplify accounting and compliance.
                </p>
                <p>
                  Our online accounting platform allows clients to purchase services online, upload documents securely, and receive professional support without needing to visit a physical office.
                </p>
              </div>
              <div className="space-y-3 pt-4">
                  <p className="font-bold text-slate-900 uppercase text-xs tracking-widest">We assist businesses throughout South Africa with:</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2">
                    {[
                      "Accounting services", "Tax compliance", "SARS registrations", "CIPC compliance",
                      "Payroll administration", "VAT services", "Company registrations", "COIDA compliance",
                      "CIDB registrations", "NCR registrations", "BEE certificates", "PBO registrations"
                    ].map((service) => (
                      <div key={service} className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                        <span className="text-sm font-semibold text-slate-700">{service}</span>
                      </div>
                    ))}
                  </div>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {trustBlocks.map((block, idx) => (
                <Card key={idx} className="border-2 border-slate-100 shadow-none hover:border-primary/20 transition-all">
                  <CardHeader className="pb-2">
                    <block.icon className="h-8 w-8 text-primary mb-2" />
                    <CardTitle className="text-base font-bold">{block.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs text-muted-foreground leading-relaxed">{block.desc}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* SERVICES SECTION */}
      <section className="py-24 bg-white border-t">
          <div className="container mx-auto px-4">
              <div className="text-center mb-16 space-y-4">
                  <Badge variant="outline" className="px-4 py-1 uppercase font-black text-[10px] tracking-widest text-primary border-primary/20">Our Solutions</Badge>
                  <h2 className="text-4xl font-black text-slate-900">Our Accounting, Tax & Compliance Services</h2>
                  <p className="text-muted-foreground text-lg max-w-2xl mx-auto">Strategic financial management and statutory support for your practice.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                  {/* Accounting & Bookkeeping */}
                  <Card className="border-2 shadow-lg">
                      <CardHeader>
                          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary mb-2"><Calculator className="h-5 w-5" /></div>
                          <CardTitle className="text-xl">Accounting & Bookkeeping Services</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                          <p className="text-sm text-muted-foreground">We provide monthly bookkeeping, management accounts, annual financial statements, and accounting support.</p>
                          <div className="flex flex-col gap-2">
                              <Button variant="link" asChild className="p-0 h-auto justify-start text-xs font-bold"><Link href="/products#accounting-services">Monthly bookkeeping services <ArrowRight className="ml-1 h-3 w-3" /></Link></Button>
                              <Button variant="link" asChild className="p-0 h-auto justify-start text-xs font-bold"><Link href="/products#accounting-services">Annual financial statements <ArrowRight className="ml-1 h-3 w-3" /></Link></Button>
                              <Button variant="link" asChild className="p-0 h-auto justify-start text-xs font-bold"><Link href="/products#accounting-services">Management accounts <ArrowRight className="ml-1 h-3 w-3" /></Link></Button>
                              <Button variant="link" asChild className="p-0 h-auto justify-start text-xs font-bold"><Link href="/products#accounting-services">Accounting services <ArrowRight className="ml-1 h-3 w-3" /></Link></Button>
                          </div>
                      </CardContent>
                  </Card>

                  {/* Tax & SARS */}
                  <Card className="border-2 shadow-lg">
                      <CardHeader>
                          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary mb-2"><Landmark className="h-5 w-5" /></div>
                          <CardTitle className="text-xl">Tax & SARS Compliance Services</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                          <p className="text-sm text-muted-foreground">Our tax specialists assist with SARS registrations, tax returns, VAT compliance, PAYE, and tax clearance PINs.</p>
                          <div className="flex flex-col gap-2">
                              <Button variant="link" asChild className="p-0 h-auto justify-start text-xs font-bold"><Link href="/products/vat-registration">VAT registration <ArrowRight className="ml-1 h-3 w-3" /></Link></Button>
                              <Button variant="link" asChild className="p-0 h-auto justify-start text-xs font-bold"><Link href="/products#sars-services">VAT returns <ArrowRight className="ml-1 h-3 w-3" /></Link></Button>
                              <Button variant="link" asChild className="p-0 h-auto justify-start text-xs font-bold"><Link href="/products#sars-services">PAYE registration <ArrowRight className="ml-1 h-3 w-3" /></Link></Button>
                              <Button variant="link" asChild className="p-0 h-auto justify-start text-xs font-bold"><Link href="/products#sars-services">Income tax returns <ArrowRight className="ml-1 h-3 w-3" /></Link></Button>
                              <Button variant="link" asChild className="p-0 h-auto justify-start text-xs font-bold"><Link href="/products/tax-clearance-pin">Tax clearance PIN <ArrowRight className="ml-1 h-3 w-3" /></Link></Button>
                          </div>
                      </CardContent>
                  </Card>

                  {/* CIPC */}
                  <Card className="border-2 shadow-lg">
                      <CardHeader>
                          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary mb-2"><Building className="h-5 w-5" /></div>
                          <CardTitle className="text-xl">Company Registration & CIPC Services</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                          <p className="text-sm text-muted-foreground">We assist businesses with company registration, annual returns, beneficial ownership, and company reinstatements.</p>
                          <div className="flex flex-col gap-2">
                              <Button variant="link" asChild className="p-0 h-auto justify-start text-xs font-bold"><Link href="/products/company-registration">Company registration <ArrowRight className="ml-1 h-3 w-3" /></Link></Button>
                              <Button variant="link" asChild className="p-0 h-auto justify-start text-xs font-bold"><Link href="/products/cipc-annual-returns">CIPC annual returns <ArrowRight className="ml-1 h-3 w-3" /></Link></Button>
                              <Button variant="link" asChild className="p-0 h-auto justify-start text-xs font-bold"><Link href="/products/beneficial-ownership-declaration">Beneficial ownership declarations <ArrowRight className="ml-1 h-3 w-3" /></Link></Button>
                              <Button variant="link" asChild className="p-0 h-auto justify-start text-xs font-bold"><Link href="/products#cipc-services">Company reinstatement <ArrowRight className="ml-1 h-3 w-3" /></Link></Button>
                          </div>
                      </CardContent>
                  </Card>

                  {/* Payroll */}
                  <Card className="border-2 shadow-lg">
                      <CardHeader>
                          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary mb-2"><Users className="h-5 w-5" /></div>
                          <CardTitle className="text-xl">Payroll & Employee Compliance</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                          <p className="text-sm text-muted-foreground">Our payroll services help businesses remain compliant with PAYE, UIF, SDL, EMP201, and EMP501 requirements.</p>
                          <div className="flex flex-col gap-2">
                              <Button variant="link" asChild className="p-0 h-auto justify-start text-xs font-bold"><Link href="/monthly-payroll">Payroll services <ArrowRight className="ml-1 h-3 w-3" /></Link></Button>
                              <Button variant="link" asChild className="p-0 h-auto justify-start text-xs font-bold"><Link href="/products#sars-services">PAYE registration <ArrowRight className="ml-1 h-3 w-3" /></Link></Button>
                              <Button variant="link" asChild className="p-0 h-auto justify-start text-xs font-bold"><Link href="/products#payroll-services">UIF registration <ArrowRight className="ml-1 h-3 w-3" /></Link></Button>
                          </div>
                      </CardContent>
                  </Card>

                  {/* Business Compliance */}
                  <Card className="border-2 shadow-lg md:col-span-2 lg:col-span-1">
                      <CardHeader>
                          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary mb-2"><ShieldCheck className="h-5 w-5" /></div>
                          <CardTitle className="text-xl">Business Compliance Services</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                          <p className="text-sm text-muted-foreground">We assist businesses with industry-specific registrations including COIDA, CIDB, NCR, BEE, CSD, and PBO.</p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1">
                              <Link href="/products/coida-registration" className="text-xs font-bold text-primary hover:underline">COIDA registration</Link>
                              <Link href="/products#cipc-services" className="text-xs font-bold text-primary hover:underline">CIDB registration</Link>
                              <Link href="/products#cipc-services" className="text-xs font-bold text-primary hover:underline">NCR registration</Link>
                              <Link href="/products#cipc-services" className="text-xs font-bold text-primary hover:underline">BEE certificates</Link>
                              <Link href="/products#cipc-services" className="text-xs font-bold text-primary hover:underline">CSD registration</Link>
                              <Link href="/products#sars-services" className="text-xs font-bold text-primary hover:underline">PBO registration</Link>
                              <Link href="/products#sars-services" className="text-xs font-bold text-primary hover:underline">Import/export licences</Link>
                          </div>
                      </CardContent>
                  </Card>
              </div>
          </div>
      </section>

      {/* PROCESS SECTION */}
      <section className="py-24 bg-slate-900 text-white overflow-hidden">
        <div className="container mx-auto px-4">
          <div className="text-center mb-20 space-y-4">
            <h2 className="text-3xl font-black md:text-5xl uppercase tracking-tighter">How Our Online Accounting Process Works</h2>
            <p className="text-slate-400 text-lg">Four simple steps to full compliance.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-12 relative">
            {[
              { step: "01", title: "Choose Your Service", desc: "Browse our online store and select the accounting, tax, or compliance service your business requires.", icon: ShoppingCart },
              { step: "02", title: "Upload Your Documents", desc: "Securely upload your supporting documents through our online platform.", icon: FileUp },
              { step: "03", title: "We Process Your Application", desc: "Our team handles the accounting, SARS, CIPC, or compliance process on your behalf.", icon: RefreshCw },
              { step: "04", title: "Receive Confirmation & Support", desc: "We provide updates, confirmations, and ongoing support throughout the process.", icon: CheckCircle2 }
            ].map((step, idx) => (
              <div key={idx} className="relative text-center space-y-6 group">
                <div className="h-20 w-20 rounded-3xl bg-white/10 text-primary flex items-center justify-center mx-auto mb-6 group-hover:bg-primary group-hover:text-white transition-all shadow-2xl backdrop-blur-sm border border-white/5">
                  <step.icon className="h-10 w-10" />
                </div>
                <div className="space-y-2">
                  <span className="text-[10px] font-black text-primary uppercase tracking-widest leading-none block mb-1">Step {step.step}</span>
                  <h3 className="font-bold text-xl leading-tight">{step.title}</h3>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed px-4">{step.desc}</p>
                {idx < 3 && <ArrowRight className="hidden lg:block absolute -right-6 top-10 h-8 w-8 text-white/10" />}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SOUTH AFRICA SEO SECTION */}
      <section className="py-24 bg-white">
          <div className="container mx-auto px-4">
              <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
                  <div className="space-y-6">
                      <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary"><MapPin className="h-6 w-6" /></div>
                      <h2 className="text-3xl font-black text-slate-900 md:text-4xl">Accounting & Tax Services for Businesses Across South Africa</h2>
                      <div className="space-y-4 text-lg text-muted-foreground leading-relaxed">
                          <p>My Accountant provides online accounting and compliance services to businesses throughout South Africa. Our online service model allows businesses to access professional accounting and tax services regardless of location.</p>
                          <p>We assist clients in Johannesburg, Randburg, Sandton, Midrand, Pretoria, Durban, Cape Town, Gauteng, and nationwide.</p>
                      </div>
                      <div className="pt-4 flex flex-wrap gap-2">
                          {["Johannesburg", "Randburg", "Sandton", "Midrand", "Pretoria", "Cape Town", "Durban", "Gauteng", "South Africa Nationwide"].map(city => (
                              <Badge key={city} variant="secondary" className="bg-slate-100 text-slate-600 border-none font-bold text-[10px] uppercase px-3 py-1">{city}</Badge>
                          ))}
                      </div>
                  </div>
                  <div className="relative h-[450px] rounded-3xl overflow-hidden shadow-2xl border-8 border-slate-50">
                      <iframe
                          src="https://www.google.com/maps?q=Stonemill+Office+Park+Johannesburg&output=embed"
                          width="100%"
                          height="100%"
                          style={{ border: 0 }}
                          allowFullScreen={false}
                          loading="lazy"
                          referrerPolicy="no-referrer-when-downgrade"
                      ></iframe>
                  </div>
              </div>
          </div>
      </section>

      {/* SMALL BUSINESS SECTION */}
      <section className="py-24 bg-white border-t">
          <div className="container mx-auto px-4">
              <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
                  <div className="relative aspect-video rounded-3xl overflow-hidden shadow-2xl">
                      <Image src="https://picsum.photos/seed/sme/800/600" alt="Small Business Accounting" fill className="object-cover" />
                      <div className="absolute inset-0 bg-primary/10" />
                  </div>
                  <div className="space-y-6">
                      <Badge variant="outline" className="px-4 py-1 uppercase font-black text-[10px] tracking-widest text-primary border-primary/20">SME Solutions</Badge>
                      <h2 className="text-3xl font-black text-slate-900 md:text-4xl">Accounting Solutions for South African SMEs & Entrepreneurs</h2>
                      <p className="text-lg text-muted-foreground leading-relaxed">We understand the challenges faced by small businesses and startups in South Africa. Whether you are launching a startup, growing your SME, or managing an established business, My Accountant provides practical compliance support tailored to your needs.</p>
                      <ul className="grid grid-cols-1 sm:grid-cols-2 gap-y-3 gap-x-6">
                          {[
                              "Stay compliant with SARS", "Maintain accurate records", "Submit CIPC annual returns", 
                              "Register for VAT and PAYE", "Manage payroll requirements", "Prepare financial statements", 
                              "Maintain good standing"
                          ].map(item => (
                              <li key={item} className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                                  <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" /> {item}
                              </li>
                          ))}
                      </ul>
                  </div>
              </div>
          </div>
      </section>

      {/* INDUSTRY SPECIFIC SEO SECTION */}
      <section className="py-24 bg-white border-t">
          <div className="container mx-auto px-4">
              <div className="text-center mb-16 space-y-4">
                  <Badge variant="outline" className="px-4 py-1 uppercase font-black text-[10px] tracking-widest text-primary border-primary/20">Specialized Expertise</Badge>
                  <h2 className="text-4xl font-black text-slate-900">Industries We Assist</h2>
                  <p className="text-muted-foreground text-lg max-w-2xl mx-auto leading-relaxed">Tailored accounting and tax solutions for South Africa's high-growth sectors.</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {industries.map((item, idx) => (
                      <Card key={idx} className="border-2 border-slate-100 hover:border-primary/30 hover:shadow-lg transition-all duration-300 group">
                          <CardHeader className="pb-3">
                              <div className="h-10 w-10 rounded-lg bg-primary/5 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-colors mb-2">
                                  <item.icon className="h-5 w-5" />
                              </div>
                              <CardTitle className="text-lg font-bold">{item.title}</CardTitle>
                          </CardHeader>
                          <CardContent>
                              <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2">{item.desc}</p>
                          </CardContent>
                          <CardFooter className="pt-2">
                              <Button variant="link" asChild className="p-0 h-auto font-black text-[10px] uppercase tracking-widest text-primary group-hover:translate-x-1 transition-transform">
                                  <Link href={`/industries/${item.slug}`}>Explore Industry <ArrowRight className="ml-1 h-3 w-3" /></Link>
                              </Button>
                          </CardFooter>
                      </Card>
                  ))}
              </div>
          </div>
      </section>

      {/* WHY ONLINE ACCOUNTING SECTION */}
      <section className="py-24 bg-slate-50">
          <div className="container mx-auto px-4 max-w-4xl text-center space-y-8">
              <h2 className="text-3xl font-black text-slate-900 md:text-4xl">Why Businesses Are Moving to Online Accounting Services</h2>
              <p className="text-lg text-muted-foreground leading-relaxed">Online accounting services provide businesses with faster turnaround times, improved convenience, and simplified compliance management.</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-left pt-6">
                  {[
                      "Purchase services online", "Avoid unnecessary office visits", "Upload documents securely", 
                      "Receive digital compliance support", "Track requirements efficiently", "Access assistance nationwide"
                  ].map(item => (
                      <div key={item} className="flex items-center gap-3 p-4 bg-white rounded-xl border border-slate-100 shadow-sm font-bold text-sm text-slate-800">
                          <CheckCircle className="h-5 w-5 text-primary shrink-0" /> {item}
                      </div>
                  ))}
              </div>
          </div>
      </section>

      {/* CASE STUDY / RESULTS SECTION */}
      <section className="py-24 bg-white">
          <div className="container mx-auto px-4">
              <div className="text-center mb-16 space-y-4">
                  <Badge variant="outline" className="px-4 py-1 uppercase font-black text-[10px] tracking-widest text-primary border-primary/20">Our Impact</Badge>
                  <h2 className="text-4xl font-black text-slate-900">Helping South African Businesses Stay Compliant</h2>
                  <p className="text-muted-foreground text-lg">Proven results across accounting, tax, and CIPC compliance.</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                  {[
                      { title: "SARS Compliance Support", icon: ShieldCheck, desc: "Assisting businesses with VAT registrations, tax compliance, and SARS submissions." },
                      { title: "CIPC Compliance Assistance", icon: Building, desc: "Helping companies maintain annual returns and beneficial ownership compliance." },
                      { title: "SME Accounting Support", icon: TrendingUp, desc: "Providing bookkeeping and financial support to growing South African businesses." }
                  ].map((study, idx) => (
                      <Card key={idx} className="border-none shadow-xl bg-slate-900 text-white text-center overflow-hidden h-full">
                          <CardHeader className="pt-8 pb-4">
                              <div className="mx-auto h-12 w-12 rounded-full bg-primary flex items-center justify-center mb-4 shadow-lg shadow-primary/20">
                                  <study.icon className="h-6 w-6 text-white" />
                              </div>
                              <CardTitle className="text-xl font-bold">{study.title}</CardTitle>
                          </CardHeader>
                          <CardContent className="pb-8 px-8">
                              <p className="text-sm text-slate-400 leading-relaxed">{study.desc}</p>
                          </CardContent>
                      </Card>
                  ))}
              </div>
          </div>
      </section>

      {/* SERVICE FAQ SECTION (Grouped by Category) */}
      <section id="service-faq" className="py-24 bg-white border-t scroll-m-24">
          <div className="container mx-auto px-4 max-w-5xl">
              <div className="text-center mb-16 space-y-4">
                  <Badge variant="outline" className="px-4 py-1 uppercase font-black text-[10px] tracking-widest text-primary border-primary/20">Service FAQ</Badge>
                  <h2 className="text-4xl font-black text-slate-900">Service Frequently Asked Questions</h2>
                  <p className="text-muted-foreground text-lg">Detailed answers for every service we provide.</p>
              </div>

              {isLoadingServices ? (
                  <div className="flex justify-center py-12"><Loader2 className="animate-spin text-primary h-8 w-8" /></div>
              ) : (
                  <div className="space-y-12">
                      {Object.entries(categorizedServices).map(([category, catServices]) => (
                          <div key={category} className="space-y-6">
                              <div className="flex items-center gap-3">
                                  <h3 className="text-xl font-black text-primary uppercase tracking-tighter">{category}</h3>
                                  <Separator className="flex-grow bg-primary/10" />
                              </div>
                              <Accordion type="single" collapsible className="w-full space-y-4">
                                {catServices.map((service) => (
                                    <AccordionItem key={service.id} value={service.id} className="bg-white border rounded-xl overflow-hidden shadow-sm hover:border-primary/20 transition-colors">
                                        <AccordionTrigger className="px-6 py-4 hover:no-underline text-left font-bold text-slate-900">
                                            Everything you need to know about {service.title}
                                        </AccordionTrigger>
                                        <AccordionContent className="px-6 pb-6 pt-2 space-y-6">
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                                <div className="space-y-2">
                                                    <p className="flex items-center gap-2 text-xs font-black uppercase text-primary tracking-widest">
                                                        <Clock className="h-3 w-3" /> Turnaround Time
                                                    </p>
                                                    <p className="text-sm text-slate-700 font-medium">
                                                        How long does a {service.title} take to complete?
                                                    </p>
                                                    <p className="text-sm text-muted-foreground italic leading-relaxed">
                                                        Standard processing for this service is approximately <strong>{service.turnaroundTime}</strong>.
                                                    </p>
                                                </div>
                                                <div className="space-y-2">
                                                    <p className="flex items-center gap-2 text-xs font-black uppercase text-primary tracking-widest">
                                                        <ClipboardList className="h-3 w-3" /> Requirements
                                                    </p>
                                                    <p className="text-sm text-slate-700 font-medium">
                                                        What are the requirements for {service.title}?
                                                    </p>
                                                    <ul className="space-y-1">
                                                        {service.clientRequirements.map((req, i) => (
                                                            <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                                                                <span className="text-primary font-bold">•</span> {req}
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            </div>
                                            <Separator className="opacity-50" />
                                            <div className="flex justify-between items-center bg-slate-50 p-4 rounded-lg">
                                                <div>
                                                    <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Pricing</p>
                                                    <p className="text-lg font-black text-slate-900">{service.isPriceTbc ? 'Price on Request' : formatPrice(service.price)}</p>
                                                </div>
                                                <Button size="sm" className="font-bold gap-2" asChild>
                                                    <Link href={`/products/${service.slug}`}>View Product Details <ArrowRight className="h-4 w-4" /></Link>
                                                </Button>
                                            </div>
                                        </AccordionContent>
                                    </AccordionItem>
                                ))}
                              </Accordion>
                          </div>
                      ))}
                  </div>
              )}
          </div>
      </section>

      {/* LATEST FROM BLOG */}
      <section className="py-24 bg-slate-50 border-y">
          <div className="container mx-auto px-4">
              <div className="flex flex-col md:flex-row justify-between items-end gap-6 mb-12">
                  <div className="space-y-4 text-left">
                      <Badge variant="outline" className="px-4 py-1 uppercase font-black text-[10px] tracking-widest text-primary border-primary/20">Resources</Badge>
                      <h2 className="text-4xl font-black text-slate-900">Latest from our Tax Tip Blog</h2>
                      <p className="text-muted-foreground text-lg max-w-2xl">Expert insights to help you navigate the complexities of South African tax and business legislation.</p>
                  </div>
                  <Button asChild variant="outline" className="font-bold gap-2 group border-primary/20 text-primary">
                      <Link href="/blog">Visit the Blog <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" /></Link>
                  </Button>
              </div>

              {isBlogLoading ? (
                  <div className="flex justify-center py-12"><Loader2 className="animate-spin text-primary h-8 w-8" /></div>
              ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                      {blogPosts.slice(0, 3).map(post => (
                          <Card key={post.id} className="border-none shadow-xl flex flex-col group overflow-hidden bg-white">
                              <Link href={`/blog/${post.slug}`} className="block relative h-56 overflow-hidden">
                                  <Image src={post.imageUrl} alt={post.title} fill className="object-cover group-hover:scale-105 transition-transform duration-500" />
                                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                              </Link>
                              <CardHeader className="space-y-3">
                                  <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-primary">
                                      <CalendarIcon className="h-3 w-3" />
                                      {format(new Date(post.date), 'dd MMMM yyyy')}
                                  </div>
                                  <CardTitle className="text-xl font-bold leading-tight group-hover:text-primary transition-colors">
                                      <Link href={`/blog/${post.slug}`}>{post.title}</Link>
                                  </CardTitle>
                              </CardHeader>
                              <CardContent className="flex-grow">
                                  <p className="text-sm text-muted-foreground line-clamp-3 leading-relaxed">{post.excerpt}</p>
                              </CardContent>
                              <CardFooter className="pt-0 pb-6">
                                  <Button variant="link" asChild className="p-0 h-auto font-black text-[10px] uppercase tracking-widest gap-2">
                                      <Link href={`/blog/${post.slug}`}>Read Article <ChevronRight className="h-3 w-3" /></Link>
                                  </Button>
                              </CardFooter>
                          </Card>
                      ))}
                  </div>
              )}
          </div>
      </section>

      {/* GENERAL FAQ SECTION */}
      <section className="py-24 bg-white border-b scroll-m-20">
        <div className="container mx-auto px-4 max-w-4xl">
          <div className="text-center mb-16 space-y-4">
            <h2 className="text-3xl font-black text-slate-900 md:text-5xl uppercase tracking-tighter">Frequently Asked Questions</h2>
            <p className="text-muted-foreground text-lg">Clear answers to common client queries.</p>
          </div>
          
          <Accordion type="single" collapsible className="w-full space-y-4">
            {faqData.map((faq, idx) => (
              <AccordionItem key={idx} value={`item-${idx}`} className="bg-white border rounded-xl overflow-hidden shadow-sm">
                <AccordionTrigger className="px-6 py-4 hover:no-underline hover:bg-slate-50 transition-colors text-left font-bold text-slate-900">
                  {faq.q}
                </AccordionTrigger>
                <AccordionContent className="px-6 pb-6 pt-2 text-muted-foreground leading-relaxed text-sm font-medium">
                  {faq.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      {/* FINAL CTA SECTION */}
      <section className="py-24 bg-white">
        <div className="container mx-auto px-4 text-center">
          <div className="max-w-5xl mx-auto p-12 rounded-[3rem] bg-slate-900 text-white shadow-2xl relative overflow-hidden">
            <div className="relative z-10 space-y-10">
              <h2 className="text-4xl font-black md:text-5xl lg:text-6xl">Get Professional Accounting & Compliance Support</h2>
              <p className="text-xl text-slate-300 max-w-3xl mx-auto font-medium leading-relaxed">
                Whether you need accounting services, tax compliance, company registration, payroll support, or CIPC assistance, My Accountant is ready to assist your business.
              </p>
              
              <div className="space-y-6">
                  <p className="text-xs font-black uppercase text-primary tracking-[0.2em]">Quick Links</p>
                  <div className="flex flex-wrap justify-center gap-3">
                      {[
                          { label: "Company Registration", href: "/products/company-registration" },
                          { label: "VAT Registration", href: "/products/vat-registration" },
                          { label: "Bookkeeping", href: "/products#accounting-services" },
                          { label: "Tax Clearance", href: "/products/tax-clearance-pin" },
                          { label: "Annual Returns", href: "/products/cipc-annual-returns" },
                          { label: "Beneficial Ownership", href: "/products/beneficial-ownership-declaration" }
                      ].map(s => (
                          <Button key={s.label} variant="outline" size="sm" asChild className="h-9 border-white/20 bg-white/5 hover:bg-white text-white hover:text-slate-900 font-bold rounded-full transition-all">
                              <Link href={s.href}><PlusCircle className="mr-2 h-3.5 w-3.5" /> {s.label}</Link>
                          </Button>
                      ))}
                  </div>
              </div>

              <div className="flex flex-col sm:flex-row justify-center gap-4 pt-8">
                <Button asChild size="lg" className="h-14 px-10 text-lg font-bold shadow-xl">
                  <Link href="/products">View Services</Link>
                </Button>
                <Button asChild variant="outline" size="lg" className="h-14 px-10 text-lg font-bold border-2 border-white/20 text-white hover:bg-white/10">
                  <Link href="/compliance">Request a Compliance Assessment</Link>
                </Button>
                <Button asChild variant="secondary" size="lg" className="h-14 px-10 text-lg font-bold shadow-lg">
                  <Link href="/contact">Contact Us</Link>
                </Button>
              </div>
            </div>
            {/* Background elements */}
            <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none"><Calculator size={250} /></div>
            <div className="absolute bottom-0 left-0 p-8 opacity-10 pointer-events-none"><Landmark size={250} /></div>
          </div>
        </div>
      </section>
    </div>
  );
}
