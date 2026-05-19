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
  Landmark, 
  Building, 
  MapPin,
  CheckCircle, 
  RefreshCw, 
  Globe, 
  HardHat, 
  Camera, 
  User, 
  Utensils, 
  Loader2, 
  Clock,
  PlusCircle,
  Users,
  TrendingUp,
  Phone,
  MessageCircle,
  FileUp,
  ShoppingCart
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter
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
      minimumFractionDigits: 2,
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

  const faqData = [
    { q: "What accounting services do you provide for SMEs?", a: "We provide comprehensive bookkeeping, annual financial statements, management accounts, and outsourced CFO services tailored for South African SMEs." },
    { q: "How does the VAT registration process work?", a: "We handle the entire VAT registration process with SARS, ensuring your business meets the mandatory or voluntary requirements correctly." },
    { q: "Can you help with tax debt relief and SARS compromises?", a: "Yes, our specialists assist with Section 200 compromises and negotiations to settle outstanding tax debt legally and affordably." },
    { q: "Do you provide monthly management reports?", a: "Yes, we prepare regular management accounts, including Income Statements and Balance Sheets, to help you track your business performance." },
    { q: "What is the process for SARS disputes and objections?", a: "We analyze the grounds for assessment, draft Section 104 objections, and manage the entire dispute resolution process with SARS." },
    { q: "Where can I find the latest South African tax tips?", a: "You can visit our Tax Tip Blog, where we regularly publish articles on tax optimization, compliance updates, and financial advice for freelancers and business owners." },
    { q: "Do you assist with annual financial statement preparation?", a: "Yes, we prepare IFRS-compliant annual financial statements for companies and trusts to ensure year-end compliance and audit readiness." }
  ];

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
      <section className="relative w-full overflow-hidden bg-white pt-16 lg:pt-24 pb-20 border-b text-center">
        <div className="container relative z-10 mx-auto px-4">
          <h1 className="mb-6 text-4xl font-black tracking-tight text-slate-900 md:text-5xl lg:text-6xl">
            Online <span className="text-gradient">Accounting, Tax & Payroll</span> Services in South Africa
          </h1>
          <div className="mx-auto mb-10 max-w-4xl text-lg font-medium text-muted-foreground md:text-xl leading-relaxed">
            <p>
              My Accountant helps South African businesses stay compliant with professional accounting, tax, payroll, SARS, and CIPC services — all through a simple online process.
            </p>
            <p className="mt-4">
              Whether you need company registration, VAT registration, bookkeeping, payroll, annual financial statements, tax compliance, or CIPC annual returns, our team assists businesses throughout Johannesburg, Randburg, Gauteng, and across South Africa.
            </p>
          </div>
          <div className="flex flex-col gap-4 sm:flex-row sm:justify-center">
            <Button asChild size="lg" className="h-14 px-10 text-lg font-bold shadow-xl">
              <Link href="/contact">Book Free Consultation</Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="h-14 px-10 text-lg font-bold border-2 shadow-sm">
              <Link href="/contact">Speak to an Accountant</Link>
            </Button>
            <Button asChild variant="secondary" size="lg" className="h-14 px-10 text-lg font-bold shadow-lg">
              <Link href="/products">Visit our online store</Link>
            </Button>
          </div>

          <div className="mt-16 grid grid-cols-2 md:grid-cols-5 gap-4 max-w-5xl mx-auto border-t pt-8">
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
      <section className="py-24 bg-white text-center">
        <div className="container mx-auto px-4 space-y-16">
          <div className="max-w-6xl mx-auto space-y-6">
            <h2 className="text-3xl font-black tracking-tight text-slate-900 md:text-4xl text-center">
              Why South African Businesses Choose My Accountant
            </h2>
            <div className="space-y-4 text-lg text-muted-foreground leading-relaxed text-center">
              <p>
                At My Accountant, we focus on helping South African entrepreneurs, startups, SMEs, and established businesses simplify accounting, tax, payroll, SARS, and CIPC compliance through a modern online service model designed for convenience, efficiency, and ongoing business support.
              </p>
              <p>
                Our platform allows clients to purchase services online, upload documents securely, and receive professional accounting and compliance assistance from anywhere in South Africa without needing to visit a physical office. Whether you require bookkeeping, annual financial statements, VAT registration, payroll services, tax compliance, company registration, or ongoing CIPC support, our team provides practical solutions tailored to the South African business environment.
              </p>
              <p>
                My Accountant is backed by strong client satisfaction and has earned over 200+ 5-star Google reviews from businesses across South Africa. View our Google Reviews & Client Feedback to see what our clients have to say about our accounting, tax, payroll, SARS, and compliance services.
              </p>
              <p>
                Our team includes professionals affiliated with recognised professional bodies including South African Institute of Chartered Accountants (SAICA), Chartered Institute for Business Accountants (CIBA), and South African Institute of Taxation (SAIT), with expertise spanning chartered accounting, management accounting, bookkeeping, taxation, and registered tax practitioner services. This provides clients with confidence that their accounting, tax, SARS, and compliance matters are handled professionally, ethically, and in accordance with recognised industry standards.
              </p>
              <p>
                We are also proud to be the appointed financial management partner for Carte Blanche, South Africa’s longest-running and most trusted current affairs television programme, further reinforcing our commitment to professionalism, reliability, and high-quality financial management services.
              </p>
              <p>
                From startups and small businesses to established companies operating across Johannesburg, Randburg, Gauteng, and throughout South Africa, My Accountant remains committed to helping businesses stay compliant, organised, and financially supported through every stage of growth.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 pt-12">
                {trustBlocks.map((block, idx) => (
                    <Card key={idx} className="border-2 border-slate-100 shadow-none bg-slate-50 hover:border-primary/20 transition-all text-center">
                        <CardHeader className="pb-2 flex flex-col items-center">
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

      {/* CORE SERVICES SEO SECTION */}
      <section className="py-24 bg-white border-y">
          <div className="container mx-auto px-4">
              <div className="text-center mb-16 space-y-4">
                  <h2 className="text-3xl font-black text-slate-900 md:text-5xl uppercase tracking-tighter">Core Business Services</h2>
                  <p className="text-muted-foreground text-lg">Specialised accounting and tax compliance for the South African market.</p>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                  {/* Accounting Pillar */}
                  <Card className="border-2 border-slate-100 shadow-sm bg-slate-50 hover:border-primary/20 transition-all">
                      <CardHeader className="pb-3">
                          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary mb-3">
                              <Calculator className="h-5 w-5" />
                          </div>
                          <CardTitle className="text-xl font-bold">Accounting Services</CardTitle>
                          <CardDescription className="text-[10px] font-bold uppercase tracking-widest text-primary">Core Compliance</CardDescription>
                      </CardHeader>
                      <CardContent>
                          <ul className="space-y-4">
                              <li className="group">
                                  <Link href="/monthly-accounting" className="text-sm font-bold text-slate-700 hover:text-primary transition-colors flex items-center gap-2">
                                      <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                                      Monthly accounting services
                                  </Link>
                              </li>
                              <li className="group">
                                  <Link href="/annual-financial-statements" className="text-sm font-bold text-slate-700 hover:text-primary transition-colors flex items-center gap-2">
                                      <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                                      Financial statement preparation
                                  </Link>
                              </li>
                              <li className="group">
                                  <Link href="/management-accounts" className="text-sm font-bold text-slate-700 hover:text-primary transition-colors flex items-center gap-2">
                                      <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                                      Management accounts
                                  </Link>
                              </li>
                              <li className="group">
                                  <Link href="/contact" className="text-sm font-bold text-slate-700 hover:text-primary transition-colors flex items-center gap-2">
                                      <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                                      Outsourced accounting
                                  </Link>
                              </li>
                          </ul>
                      </CardContent>
                  </Card>

                  {/* Tax Pillar */}
                  <Card className="border-2 border-slate-100 shadow-sm bg-slate-50 hover:border-primary/20 transition-all">
                      <CardHeader className="pb-3">
                          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary mb-3">
                              <Landmark className="h-5 w-5" />
                          </div>
                          <CardTitle className="text-xl font-bold">Tax Services</CardTitle>
                          <CardDescription className="text-[10px] font-bold uppercase tracking-widest text-primary">SARS Specialists</CardDescription>
                      </CardHeader>
                      <CardContent>
                          <ul className="space-y-4">
                              <li className="group">
                                  <Link href="/products/vat-registration" className="text-sm font-bold text-slate-700 hover:text-primary transition-colors flex items-center gap-2">
                                      <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                                      VAT Registration
                                  </Link>
                              </li>
                              <li className="group">
                                  <Link href="/products/vat-returns" className="text-sm font-bold text-slate-700 hover:text-primary transition-colors flex items-center gap-2">
                                      <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                                      VAT Returns
                                  </Link>
                              </li>
                              <li className="group">
                                  <Link href="/products/tax-clearance-pin" className="text-sm font-bold text-slate-700 hover:text-primary transition-colors flex items-center gap-2">
                                      <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                                      Tax Clearance
                                  </Link>
                              </li>
                              <li className="group">
                                  <Link href="/sars-disputes" className="text-sm font-bold text-slate-700 hover:text-primary transition-colors flex items-center gap-2">
                                      <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                                      SARS Disputes
                                  </Link>
                              </li>
                              <li className="group">
                                  <Link href="/sars-compromise" className="text-sm font-bold text-slate-700 hover:text-primary transition-colors flex items-center gap-2">
                                      <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                                      Tax Debt Relief
                                  </Link>
                              </li>
                          </ul>
                      </CardContent>
                  </Card>

                  {/* Payroll Pillar */}
                  <Card className="border-2 border-slate-100 shadow-sm bg-slate-50 hover:border-primary/20 transition-all">
                      <CardHeader className="pb-3">
                          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary mb-3">
                              <Users className="h-5 w-5" />
                          </div>
                          <CardTitle className="text-xl font-bold">Payroll Services</CardTitle>
                          <CardDescription className="text-[10px] font-bold uppercase tracking-widest text-primary">Workforce Management</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                          <p className="text-[10px] text-muted-foreground font-medium uppercase leading-tight italic">
                              Targeting payroll services South Africa, PAYE submissions, and IRP5 submissions.
                          </p>
                          <ul className="space-y-4">
                              <li className="group">
                                  <Link href="/monthly-payroll" className="text-sm font-bold text-slate-700 hover:text-primary transition-colors flex items-center gap-2">
                                      <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                                      Payroll outsourcing
                                  </Link>
                              </li>
                              <li className="group">
                                  <Link href="/paye-compliance" className="text-sm font-bold text-slate-700 hover:text-primary transition-colors flex items-center gap-2">
                                      <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                                      PAYE Compliance (EMP201)
                                  </Link>
                              </li>
                              <li className="group">
                                  <Link href="/uif-compliance" className="text-sm font-bold text-slate-700 hover:text-primary transition-colors flex items-center gap-2">
                                      <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                                      UIF & SDL Compliance
                                  </Link>
                              </li>
                              <li className="group">
                                  <Link href="/payroll-administration" className="text-sm font-bold text-slate-700 hover:text-primary transition-colors flex items-center gap-2">
                                      <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                                      Payroll compliance (EMP501)
                                  </Link>
                              </li>
                          </ul>
                      </CardContent>
                  </Card>

                  {/* CIPC Pillar */}
                  <Card className="border-2 border-slate-100 shadow-sm bg-slate-50 hover:border-primary/20 transition-all">
                      <CardHeader className="pb-3">
                          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary mb-3">
                              <Building className="h-5 w-5" />
                          </div>
                          <CardTitle className="text-xl font-bold">CIPC & Compliance</CardTitle>
                          <CardDescription className="text-[10px] font-bold uppercase tracking-widest text-primary">Entity Maintenance</CardDescription>
                      </CardHeader>
                      <CardContent>
                          <ul className="space-y-4">
                              <li className="group">
                                  <Link href="/products/company-registration" className="text-sm font-bold text-slate-700 hover:text-primary transition-colors flex items-center gap-2">
                                      <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                                      Company Registration
                                  </Link>
                              </li>
                              <li className="group">
                                  <Link href="/products/cipc-annual-returns" className="text-sm font-bold text-slate-700 hover:text-primary transition-colors flex items-center gap-2">
                                      <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                                      CIPC Annual Returns
                                  </Link>
                              </li>
                              <li className="group">
                                  <Link href="/products/beneficial-ownership-declaration" className="text-sm font-bold text-slate-700 hover:text-primary transition-colors flex items-center gap-2">
                                      <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                                      Beneficial Ownership
                                  </Link>
                              </li>
                              <li className="group">
                                  <Link href="/liquidations" className="text-sm font-bold text-slate-700 hover:text-primary transition-colors flex items-center gap-2">
                                      <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                                      Company Liquidations
                                  </Link>
                              </li>
                          </ul>
                      </CardContent>
                  </Card>
              </div>
          </div>
      </section>

      {/* SOUTH AFRICA SEO SECTION */}
      <section className="py-24 bg-white border-t">
          <div className="container mx-auto px-4">
              <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
                  <div className="space-y-6 text-center lg:text-left">
                      <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary mx-auto lg:mx-0"><MapPin className="h-6 w-6" /></div>
                      <h2 className="text-3xl font-black text-slate-900 md:text-4xl">Accounting & Tax Services for Businesses Across South Africa</h2>
                      <div className="space-y-4 text-lg text-muted-foreground leading-relaxed">
                          <p>My Accountant provides online accounting and compliance services to businesses throughout South Africa.</p>
                          <p>We assist clients in:</p>
                          <div className="grid grid-cols-2 gap-2 text-sm font-bold text-slate-700 max-w-sm mx-auto lg:mx-0">
                             <div className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-green-600" /> Johannesburg</div>
                             <div className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-green-600" /> Randburg</div>
                             <div className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-green-600" /> Sandton</div>
                             <div className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-green-600" /> Midrand</div>
                             <div className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-green-600" /> Pretoria</div>
                             <div className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-green-600" /> Durban</div>
                             <div className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-green-600" /> Cape Town</div>
                             <div className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-green-600" /> Gauteng</div>
                          </div>
                      </div>
                  </div>
                  <div className="relative h-[400px] rounded-3xl overflow-hidden shadow-xl border-8 border-slate-50">
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

      {/* GENERAL FAQ SECTION */}
      <section className="py-24 bg-white border-t scroll-m-20">
        <div className="container mx-auto px-4 max-w-4xl">
          <div className="text-center mb-16 space-y-4">
            <h2 className="text-3xl font-black text-slate-900 md:text-5xl uppercase tracking-tighter">Frequently Asked Questions</h2>
            <p className="text-muted-foreground text-lg">Clear answers to common client queries.</p>
          </div>
          
          <Accordion type="single" collapsible className="w-full space-y-4">
            {faqData.map((faq, idx) => (
              <AccordionItem key={idx} value={`item-${idx}`} className="bg-slate-50 border rounded-xl overflow-hidden shadow-sm px-6">
                <AccordionTrigger className="py-4 hover:no-underline hover:bg-slate-100 transition-colors text-left font-bold text-slate-900">
                  {faq.q}
                </AccordionTrigger>
                <AccordionContent className="pb-6 pt-2 text-muted-foreground leading-relaxed text-sm font-medium">
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
              <h2 className="text-4xl font-black md:text-5xl lg:text-6xl text-center">Get Professional Accounting & Compliance Support</h2>
              <p className="text-xl text-muted-foreground max-w-3xl mx-auto font-medium leading-relaxed text-center">
                Whether you need accounting services, tax compliance, company registration, payroll support, or CIPC assistance, My Accountant is ready to assist your business.
              </p>
              
              <div className="space-y-6">
                  <p className="text-xs font-black uppercase text-primary tracking-[0.2em]">Popular Services</p>
                  <div className="flex flex-wrap justify-center gap-3">
                      {[
                          { label: "Company Registration Services", href: "/products/company-registration" },
                          { label: "VAT Registration Services", href: "/products/vat-registration" },
                          { label: "Bookkeeping Services", href: "/products#accounting-services" },
                          { label: "Tax Clearance Certificate PIN", href: "/products/tax-clearance-pin" },
                          { label: "CIPC Annual Returns", href: "/products/cipc-annual-returns" },
                          { label: "Beneficial Ownership Services", href: "/products/beneficial-ownership-declaration" }
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

      {/* STICKY CONVERSION BAR */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t shadow-2xl p-3 md:hidden animate-in slide-in-from-bottom duration-500">
          <div className="grid grid-cols-1 gap-2">
              <Button asChild className="h-10 text-xs font-black uppercase tracking-widest">
                  <Link href="/signup">Get Started Now</Link>
              </Button>
          </div>
      </div>
    </div>
  );
}
