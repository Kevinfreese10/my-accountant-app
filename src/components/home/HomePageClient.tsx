'use client';

import Link from 'next/link';
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

  const industries = [
    { title: "Accounting for SMEs", slug: "sme", icon: Building, desc: "Scale from startup to market player with expert financial structure." },
    { title: "Accounting for Construction", slug: "construction", icon: HardHat, desc: "Project-based tracking for builders and contractors." },
    { title: "Accounting for Influencers", slug: "influencers", icon: Camera, desc: "Tax optimization and income tracking for digital creators." },
    { title: "Accounting for Freelancers", slug: "freelancers", icon: User, desc: "Simple bookkeeping and tax for independent professionals." },
    { title: "Accounting for Restaurants", slug: "restaurants", icon: Utensils, desc: "Inventory and food cost tracking for the hospitality sector." },
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
    <div className="flex flex-col min-h-screen bg-white">
      <Script
        id="faq-schema"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
      
      {/* HERO SECTION */}
      <section className="relative w-full overflow-hidden bg-white pt-16 lg:pt-24 pb-20 border-b">
        <div className="container relative z-10 mx-auto px-4 text-center">
          <h1 className="mb-6 text-4xl font-black tracking-tight text-slate-900 md:text-5xl lg:text-6xl">
            Online Accounting, Tax & <span className="text-primary">CIPC Services</span> in South Africa
          </h1>
          <div className="mx-auto mb-10 max-w-4xl text-lg font-medium text-muted-foreground md:text-xl leading-relaxed">
            <p>
              My Accountant helps South African businesses stay compliant with professional accounting, tax, payroll, SARS, and CIPC services — all through a simple online process.
            </p>
            <p className="mt-4 text-base text-muted-foreground/70">
              Whether you need company registration, VAT registration, bookkeeping, payroll, annual financial statements, tax compliance, or CIPC annual returns, our team assists businesses throughout Johannesburg, Randburg, Gauteng, and across South Africa.
            </p>
          </div>
          <div className="flex flex-col gap-4 sm:flex-row sm:justify-center">
            <Button asChild size="lg" className="h-14 px-10 text-lg font-bold shadow-xl">
              <Link href="/signup">Get Started</Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="h-14 px-10 text-lg font-bold border-2">
              <Link href="/products">View Services</Link>
            </Button>
            <Button asChild variant="secondary" size="lg" className="h-14 px-10 text-lg font-bold shadow-lg">
              <Link href="/compliance">Request a Compliance Assessment</Link>
            </Button>
          </div>

          <div className="mt-16 grid grid-cols-2 md:grid-cols-5 gap-4 max-w-5xl mx-auto">
              {trustIndicators.map((item, idx) => (
                  <div key={idx} className="flex flex-col items-center gap-2 text-muted-foreground">
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
                <Card key={idx} className="border-2 border-slate-100 shadow-none bg-slate-50 hover:border-primary/20 transition-all">
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
                  <Card className="border-2 bg-slate-50 shadow-sm">
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
                  <Card className="border-2 bg-slate-50 shadow-sm">
                      <CardHeader>
                          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary mb-2"><Landmark className="h-5 w-5" /></div>
                          <CardTitle className="text-xl">Tax & SARS Compliance Services</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                          <p className="text-sm text-muted-foreground">Our tax specialists assist with SARS registrations, tax returns, VAT compliance, PAYE, tax clearance PINs, and tax compliance support.</p>
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
                  <Card className="border-2 bg-slate-50 shadow-sm">
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
                  <Card className="border-2 bg-slate-50 shadow-sm">
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
                  <Card className="border-2 bg-slate-50 shadow-sm md:col-span-2 lg:col-span-1">
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
      <section className="py-24 bg-white">
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
                <div className="h-20 w-20 rounded-3xl bg-primary/10 text-primary flex items-center justify-center mx-auto mb-6 group-hover:bg-primary group-hover:text-white transition-all shadow-md border border-primary/5">
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

      {/* SOUTH AFRICA SEO SECTION */}
      <section className="py-24 bg-white border-t">
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
                              <Badge key={city} variant="secondary" className="bg-slate-50 text-slate-600 border-none font-bold text-[10px] uppercase px-3 py-1">{city}</Badge>
                          ))}
                      </div>
                  </div>
                  <div className="relative h-[450px] rounded-3xl overflow-hidden shadow-xl border-8 border-slate-50">
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
                              <li key={item} className="flex items-center gap-2 text-sm font-semibold text-slate-700 p-2 bg-slate-50 rounded-lg">
                                  <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" /> {item}
                              </li>
                          ))}
                      </ul>
                  </div>
                  <Card className="bg-slate-50 border-2 shadow-sm p-8 flex flex-col items-center text-center">
                    <Building className="h-12 w-12 text-primary mb-4" />
                    <h3 className="text-xl font-bold mb-2">Dedicated SME Support</h3>
                    <p className="text-sm text-muted-foreground mb-6">Our accounting packages are designed to grow with your business.</p>
                    <Button asChild className="w-full">
                        <Link href="/signup">Get Started for my SME</Link>
                    </Button>
                  </Card>
              </div>
          </div>
      </section>

      {/* INDUSTRY SPECIFIC SECTION */}
      <section className="py-24 bg-white border-t">
          <div className="container mx-auto px-4">
              <div className="text-center mb-16 space-y-4">
                  <Badge variant="outline" className="px-4 py-1 uppercase font-black text-[10px] tracking-widest text-primary border-primary/20">Specialized Expertise</Badge>
                  <h2 className="text-4xl font-black text-slate-900">Industries We Assist</h2>
                  <p className="text-muted-foreground text-lg max-w-2xl mx-auto leading-relaxed">Tailored accounting and tax solutions for South Africa's high-growth sectors.</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {industries.map((item, idx) => (
                      <Card key={idx} className="border-2 border-slate-100 bg-slate-50 hover:border-primary/30 hover:shadow-lg transition-all duration-300 group">
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
      <section className="py-24 bg-white border-t">
          <div className="container mx-auto px-4 max-w-4xl text-center space-y-8">
              <h2 className="text-3xl font-black text-slate-900 md:text-4xl">Why Businesses Are Moving to Online Accounting Services</h2>
              <p className="text-lg text-muted-foreground leading-relaxed">Online accounting services provide businesses with faster turnaround times, improved convenience, and simplified compliance management.</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-left pt-6">
                  {[
                      "Purchase services online", "Avoid unnecessary office visits", "Upload documents securely", 
                      "Receive digital compliance support", "Track requirements efficiently", "Access assistance nationwide"
                  ].map(item => (
                      <div key={item} className="flex items-center gap-3 p-4 bg-slate-50 rounded-xl border border-slate-100 shadow-sm font-bold text-sm text-slate-800">
                          <CheckCircle className="h-5 w-5 text-primary shrink-0" /> {item}
                      </div>
                  ))}
              </div>
          </div>
      </section>

      {/* CASE STUDY / RESULTS SECTION */}
      <section className="py-24 bg-white border-t">
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
                      <Card key={idx} className="border-none shadow-sm bg-slate-50 text-slate-900 text-center overflow-hidden h-full">
                          <CardHeader className="pt-8 pb-4">
                              <div className="mx-auto h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-4 shadow-sm">
                                  <study.icon className="h-6 w-6 text-primary" />
                              </div>
                              <CardTitle className="text-xl font-bold">{study.title}</CardTitle>
                          </CardHeader>
                          <CardContent className="pb-8 px-8">
                              <p className="text-sm text-muted-foreground leading-relaxed">{study.desc}</p>
                          </CardContent>
                      </Card>
                  ))}
              </div>
          </div>
      </section>

      {/* GENERAL FAQ SECTION */}
      <section className="py-24 bg-white border-t scroll-m-20">
        <div className="container mx-auto px-4 max-w-4xl">
          <div className="text-center mb-16 space-y-4">
            <h2 className="text-3xl font-black text-slate-900 md:text-5xl uppercase tracking-tighter">Frequently Asked Questions</h2>
            <p className="text-muted-foreground text-lg">Clear answers to common client queries.</p>
          </div>
          
          <Accordion type="single" collapsible className="w-full space-y-4">
            {faqData.map((faq, idx) => (
              <AccordionItem key={idx} value={`item-${idx}`} className="bg-slate-50 border rounded-xl overflow-hidden shadow-sm">
                <AccordionTrigger className="px-6 py-4 hover:no-underline hover:bg-slate-100 transition-colors text-left font-bold text-slate-900">
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
      <section className="py-24 bg-white border-t">
        <div className="container mx-auto px-4 text-center">
          <div className="max-w-5xl mx-auto p-12 rounded-[3rem] bg-slate-50 text-slate-900 shadow-sm border relative overflow-hidden">
            <div className="relative z-10 space-y-10">
              <h2 className="text-4xl font-black md:text-5xl lg:text-6xl">Get Professional Accounting & Compliance Support</h2>
              <p className="text-xl text-muted-foreground max-w-3xl mx-auto font-medium leading-relaxed">
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
                          <Button key={s.label} variant="outline" size="sm" asChild className="h-9 border-slate-200 bg-white hover:bg-slate-50 text-slate-900 font-bold rounded-full transition-all shadow-sm">
                              <Link href={s.href}><PlusCircle className="mr-2 h-3.5 w-3.5" /> {s.label}</Link>
                          </Button>
                      ))}
                  </div>
              </div>

              <div className="flex flex-col sm:flex-row justify-center gap-4 pt-8">
                <Button asChild size="lg" className="h-14 px-10 text-lg font-bold shadow-xl">
                  <Link href="/products">View Services</Link>
                </Button>
                <Button asChild variant="outline" size="lg" className="h-14 px-10 text-lg font-bold border-2 shadow-sm">
                  <Link href="/compliance">Request a Compliance Assessment</Link>
                </Button>
                <Button asChild variant="secondary" size="lg" className="h-14 px-10 text-lg font-bold shadow-lg">
                  <Link href="/contact">Contact Us</Link>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
