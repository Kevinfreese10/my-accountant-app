'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState, useEffect } from 'react';
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
  Smartphone
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

export default function HomePageClient() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const faqData = [
    { q: "Do you assist clients throughout South Africa?", a: "Yes. My Accountant provides online accounting, tax, and compliance services nationwide." },
    { q: "What accounting services do you provide?", a: "We assist with bookkeeping, annual financial statements, payroll, management accounts, and accounting compliance services." },
    { q: "Do you assist with SARS registrations?", a: "Yes. We assist with VAT registration, PAYE registration, income tax registration, and other SARS compliance services." },
    { q: "Can I buy services online?", a: "Yes. Our online platform allows clients to purchase accounting and compliance services online through a secure checkout process." },
    { q: "Do you assist with CIPC annual returns?", a: "Yes. We assist companies and close corporations with annual return submissions and CIPC compliance requirements." },
    { q: "How long does company registration take?", a: "Turnaround times vary depending on CIPC processing times and document submission requirements, but typically take between 1–3 working days." },
    { q: "Do you assist startups and small businesses?", a: "Yes. We work with startups, entrepreneurs, SMEs, and established businesses throughout South Africa." }
  ];

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

  if (!mounted) return null;

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
          <div className="mx-auto mb-10 max-w-4xl text-lg font-medium text-slate-300 md:text-xl leading-relaxed space-y-4">
            <p>
              My Accountant helps South African businesses stay compliant with professional accounting, tax, payroll, SARS, and CIPC services — all through a simple online process.
            </p>
            <p className="text-base text-slate-400">
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
              {[
                  { label: "Trusted by South African businesses", icon: CheckCircle },
                  { label: "Professional accounting & compliance support", icon: ShieldCheck },
                  { label: "Online service delivery nationwide", icon: Globe },
                  { label: "Transparent pricing", icon: Wallet },
                  { label: "Secure document submission", icon: ShieldCheck }
              ].map((item, idx) => (
                  <div key={idx} className="flex flex-col items-center gap-2 text-slate-300">
                      <item.icon className="h-5 w-5 text-primary" />
                      <span className="text-[10px] font-bold uppercase tracking-wider text-center">{item.label}</span>
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
                        <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                        <span className="text-sm font-semibold text-slate-700">{service}</span>
                      </div>
                    ))}
                  </div>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {[
                { title: "Professional & Reliable", desc: "Our team focuses on practical accounting and compliance solutions designed specifically for South African businesses.", icon: ShieldCheck },
                { title: "Nationwide Online Support", desc: "We assist clients throughout Johannesburg, Pretoria, Durban, Cape Town, Gauteng, and across South Africa.", icon: Globe },
                { title: "Transparent Process", desc: "Our online system makes it easy to purchase services, upload documents, and track your compliance requirements.", icon: RefreshCw },
                { title: "Business Compliance Specialists", desc: "We assist businesses with ongoing SARS, CIPC, payroll, and accounting compliance requirements.", icon: Landmark }
              ].map((block, idx) => (
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
      <section className="py-24 bg-slate-50 border-y border-slate-100">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16 space-y-4">
            <h2 className="text-4xl font-black text-slate-900">Our Accounting, Tax & Compliance Services</h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">Specialized financial solutions to power your business growth.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {/* Accounting */}
            <Card className="flex flex-col border-none shadow-xl bg-white group hover:-translate-y-1 transition-all">
              <CardHeader>
                <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4 text-primary group-hover:bg-primary group-hover:text-white transition-colors">
                  <Calculator className="h-6 w-6" />
                </div>
                <CardTitle className="text-xl">Accounting & Bookkeeping Services</CardTitle>
                <CardDescription>
                  We provide monthly bookkeeping, management accounts, annual financial statements, and accounting support for South African businesses.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex-grow">
                <ul className="space-y-2 text-sm font-medium">
                  <li><Link href="/monthly-accounting" className="hover:text-primary transition-colors flex items-center gap-2"><ArrowRight className="h-3 w-3" /> Monthly bookkeeping services</Link></li>
                  <li><Link href="/products#accounting-services" className="hover:text-primary transition-colors flex items-center gap-2"><ArrowRight className="h-3 w-3" /> Annual financial statements</Link></li>
                  <li><Link href="/monthly-accounting" className="hover:text-primary transition-colors flex items-center gap-2"><ArrowRight className="h-3 w-3" /> Management accounts</Link></li>
                  <li><Link href="/products#accounting-services" className="hover:text-primary transition-colors flex items-center gap-2"><ArrowRight className="h-3 w-3" /> Accounting services</Link></li>
                </ul>
              </CardContent>
            </Card>

            {/* Tax */}
            <Card className="flex flex-col border-none shadow-xl bg-white group hover:-translate-y-1 transition-all">
              <CardHeader>
                <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4 text-primary group-hover:bg-primary group-hover:text-white transition-colors">
                  <Landmark className="h-6 w-6" />
                </div>
                <CardTitle className="text-xl">Tax & SARS Compliance Services</CardTitle>
                <CardDescription>
                  Our tax specialists assist with SARS registrations, tax returns, VAT compliance, PAYE, tax clearance PINs, and tax compliance support.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex-grow">
                <ul className="space-y-2 text-sm font-medium">
                  <li><Link href="/products/vat-registration" className="hover:text-primary transition-colors flex items-center gap-2"><ArrowRight className="h-3 w-3" /> VAT registration</Link></li>
                  <li><Link href="/products#sars-services" className="hover:text-primary transition-colors flex items-center gap-2"><ArrowRight className="h-3 w-3" /> VAT returns</Link></li>
                  <li><Link href="/products/paye-registration" className="hover:text-primary transition-colors flex items-center gap-2"><ArrowRight className="h-3 w-3" /> PAYE registration</Link></li>
                  <li><Link href="/products#sars-services" className="hover:text-primary transition-colors flex items-center gap-2"><ArrowRight className="h-3 w-3" /> Income tax returns</Link></li>
                  <li><Link href="/products/tax-clearance-pin" className="hover:text-primary transition-colors flex items-center gap-2"><ArrowRight className="h-3 w-3" /> Tax clearance PIN</Link></li>
                  <li><Link href="/compliance" className="hover:text-primary transition-colors flex items-center gap-2"><ArrowRight className="h-3 w-3" /> SARS compliance services</Link></li>
                </ul>
              </CardContent>
            </Card>

            {/* CIPC */}
            <Card className="flex flex-col border-none shadow-xl bg-white group hover:-translate-y-1 transition-all">
              <CardHeader>
                <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4 text-primary group-hover:bg-primary group-hover:text-white transition-colors">
                  <Building className="h-6 w-6" />
                </div>
                <CardTitle className="text-xl">Company Registration & CIPC Services</CardTitle>
                <CardDescription>
                  We assist businesses with company registration, annual returns, beneficial ownership declarations, company reinstatements, and ongoing CIPC compliance.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex-grow">
                <ul className="space-y-2 text-sm font-medium">
                  <li><Link href="/products/company-registration" className="hover:text-primary transition-colors flex items-center gap-2"><ArrowRight className="h-3 w-3" /> Company registration</Link></li>
                  <li><Link href="/products/cipc-annual-returns" className="hover:text-primary transition-colors flex items-center gap-2"><ArrowRight className="h-3 w-3" /> CIPC annual returns</Link></li>
                  <li><Link href="/products/beneficial-ownership-declaration" className="hover:text-primary transition-colors flex items-center gap-2"><ArrowRight className="h-3 w-3" /> Beneficial ownership declarations</Link></li>
                  <li><Link href="/products/company-reinstatement" className="hover:text-primary transition-colors flex items-center gap-2"><ArrowRight className="h-3 w-3" /> Company reinstatement</Link></li>
                </ul>
              </CardContent>
            </Card>

            {/* Payroll */}
            <Card className="flex flex-col border-none shadow-xl bg-white group hover:-translate-y-1 transition-all">
              <CardHeader>
                <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4 text-primary group-hover:bg-primary group-hover:text-white transition-colors">
                  <Users className="h-6 w-6" />
                </div>
                <CardTitle className="text-xl">Payroll & Employee Compliance</CardTitle>
                <CardDescription>
                  Our payroll services help businesses remain compliant with PAYE, UIF, SDL, EMP201, and EMP501 requirements.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex-grow">
                <ul className="space-y-2 text-sm font-medium">
                  <li><Link href="/monthly-payroll" className="hover:text-primary transition-colors flex items-center gap-2"><ArrowRight className="h-3 w-3" /> Payroll services</Link></li>
                  <li><Link href="/products/paye-registration" className="hover:text-primary transition-colors flex items-center gap-2"><ArrowRight className="h-3 w-3" /> PAYE registration</Link></li>
                  <li><Link href="/products/uif-registration" className="hover:text-primary transition-colors flex items-center gap-2"><ArrowRight className="h-3 w-3" /> UIF registration</Link></li>
                </ul>
              </CardContent>
            </Card>

            {/* Business Compliance */}
            <Card className="flex flex-col border-none shadow-xl bg-white group hover:-translate-y-1 transition-all md:col-span-2 lg:col-span-1">
              <CardHeader>
                <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4 text-primary group-hover:bg-primary group-hover:text-white transition-colors">
                  <ShieldCheck className="h-6 w-6" />
                </div>
                <CardTitle className="text-xl">Business Compliance Services</CardTitle>
                <CardDescription>
                  We assist businesses with various compliance requirements including COIDA, CIDB, and more.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex-grow">
                <ul className="space-y-2 text-sm font-medium">
                  <li><Link href="/products/coida-registration" className="hover:text-primary transition-colors flex items-center gap-2"><ArrowRight className="h-3 w-3" /> COIDA registration</Link></li>
                  <li><Link href="/products/cidb-registration" className="hover:text-primary transition-colors flex items-center gap-2"><ArrowRight className="h-3 w-3" /> CIDB registration</Link></li>
                  <li><Link href="/products/ncr-registration" className="hover:text-primary transition-colors flex items-center gap-2"><ArrowRight className="h-3 w-3" /> NCR registration</Link></li>
                  <li><Link href="/products/bee-certificate" className="hover:text-primary transition-colors flex items-center gap-2"><ArrowRight className="h-3 w-3" /> BEE certificates</Link></li>
                  <li><Link href="/products/pbo-registration" className="hover:text-primary transition-colors flex items-center gap-2"><ArrowRight className="h-3 w-3" /> PBO registration</Link></li>
                  <li><Link href="/products/import-export-license" className="hover:text-primary transition-colors flex items-center gap-2"><ArrowRight className="h-3 w-3" /> Import/export licences</Link></li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* PROCESS SECTION */}
      <section className="py-24 bg-white">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-black text-slate-900 md:text-4xl uppercase tracking-tighter">How Our Online Accounting Process Works</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 relative">
            {[
              { step: "01", title: "Choose Your Service", desc: "Browse our online store and select the accounting, tax, or compliance service your business requires.", icon: ShoppingCart },
              { step: "02", title: "Upload Your Documents", desc: "Securely upload your supporting documents through our online platform.", icon: FileUp },
              { step: "03", title: "We Process Your Application", desc: "Our team handles the accounting, SARS, CIPC, or compliance process on your behalf.", icon: RefreshCw },
              { step: "04", title: "Receive Confirmation & Support", desc: "We provide updates, confirmations, and ongoing support throughout the process.", icon: CheckCircle2 }
            ].map((step, idx) => (
              <div key={idx} className="relative text-center space-y-4 group">
                <div className="h-16 w-16 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto mb-4 group-hover:bg-primary group-hover:text-white transition-all shadow-sm">
                  <step.icon className="h-8 w-8" />
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] font-black text-primary uppercase tracking-widest leading-none block mb-1">Step {step.step}</span>
                  <h3 className="font-bold text-lg text-slate-900 leading-tight">{step.title}</h3>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">{step.desc}</p>
                {idx < 3 && <ArrowRight className="hidden lg:block absolute -right-4 top-8 h-8 w-8 text-slate-200" />}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SOUTH AFRICA SEO SECTION */}
      <section className="py-24 bg-slate-900 text-white overflow-hidden">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div className="space-y-6">
              <h2 className="text-3xl font-black md:text-4xl">Accounting & Tax Services for Businesses Across South Africa</h2>
              <div className="space-y-4 text-lg text-slate-300 leading-relaxed">
                <p>My Accountant provides online accounting and compliance services to businesses throughout South Africa.</p>
                <p>We assist clients in Johannesburg, Randburg, Sandton, Midrand, Pretoria, Durban, Cape Town, Gauteng, and South Africa nationwide.</p>
                <p>Our online service model allows businesses to access professional accounting and tax services regardless of location.</p>
              </div>
            </div>
            <div className="relative h-[400px] rounded-3xl overflow-hidden shadow-2xl border border-white/10">
               <Image 
                  src="https://images.unsplash.com/photo-1521791136064-7986c2920216?auto=format&fit=crop&q=80&w=800"
                  alt="South African Business Support"
                  fill
                  className="object-cover"
                  data-ai-hint="business team"
               />
            </div>
          </div>
        </div>
      </section>

      {/* SMALL BUSINESS SECTION */}
      <section className="py-24 bg-white">
        <div className="container mx-auto px-4 text-center">
          <div className="max-w-4xl mx-auto space-y-12">
            <div className="space-y-6">
              <h2 className="text-3xl font-black text-slate-900 md:text-4xl">Accounting Solutions for South African SMEs & Entrepreneurs</h2>
              <p className="text-lg text-muted-foreground leading-relaxed">
                We understand the challenges faced by small businesses and startups in South Africa. Our services are designed to help businesses:
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {[
                "Stay compliant with SARS", "Maintain accurate accounting records", "Submit CIPC annual returns",
                "Register for VAT and PAYE", "Manage payroll requirements", "Prepare annual financial statements",
                "Maintain good standing status"
              ].map(item => (
                <div key={item} className="flex items-center gap-3 p-4 rounded-xl border border-slate-100 shadow-sm bg-slate-50 text-left">
                  <CheckCircle2 className="h-5 w-5 text-primary shrink-0" />
                  <span className="text-sm font-bold text-slate-700 leading-tight">{item}</span>
                </div>
              ))}
            </div>
            <p className="text-lg font-medium text-slate-800">
              Whether you are launching a startup, growing your SME, or managing an established business, My Accountant provides practical compliance support tailored to your needs.
            </p>
          </div>
        </div>
      </section>

      {/* WHY ONLINE ACCOUNTING SECTION */}
      <section className="py-24 bg-slate-50 border-y border-slate-100">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div className="relative h-[400px] rounded-3xl overflow-hidden shadow-xl border border-slate-200 order-2 lg:order-1">
               <Image 
                  src="https://images.unsplash.com/photo-1551288049-bbbda546697c?auto=format&fit=crop&q=80&w=800"
                  alt="Online Accounting Dashboard"
                  fill
                  className="object-cover"
                  data-ai-hint="digital finance"
               />
            </div>
            <div className="space-y-6 order-1 lg:order-2">
              <h2 className="text-3xl font-black text-slate-900 md:text-4xl">Why Businesses Are Moving to Online Accounting Services</h2>
              <p className="text-lg text-muted-foreground leading-relaxed">
                Online accounting services provide businesses with faster turnaround times, improved convenience, and simplified compliance management.
              </p>
              <div className="space-y-4">
                <p className="font-bold text-sm text-primary uppercase tracking-widest">By using My Accountant, businesses can:</p>
                {[
                  { label: "Purchase services online", icon: ShoppingCart },
                  { label: "Avoid unnecessary office visits", icon: MapPin },
                  { label: "Upload documents securely", icon: FileUp },
                  { label: "Receive digital compliance support", icon: Bot },
                  { label: "Track compliance requirements more efficiently", icon: ClipboardList },
                  { label: "Access accounting and tax assistance from anywhere in South Africa", icon: Globe }
                ].map((item, idx) => (
                  <div key={idx} className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0"><item.icon className="h-4 w-4" /></div>
                    <span className="text-sm font-bold text-slate-700">{item.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CASE STUDY / RESULTS SECTION */}
      <section className="py-24 bg-white">
        <div className="container mx-auto px-4 text-center">
          <div className="mb-16 space-y-4">
            <h2 className="text-3xl font-black text-slate-900 md:text-4xl">Helping South African Businesses Stay Compliant</h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">Proven results across tax, CIPC, and bookkeeping.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {[
              { title: "SARS Compliance Support", desc: "Assisting businesses with VAT registrations, tax compliance, and SARS submissions.", icon: ShieldCheck },
              { title: "CIPC Compliance Assistance", desc: "Helping companies maintain annual returns and beneficial ownership compliance.", icon: Building },
              { title: "SME Accounting Support", desc: "Providing bookkeeping and financial support to growing South African businesses.", icon: TrendingUp }
            ].map((caseStudy, idx) => (
              <Card key={idx} className="border-none shadow-lg bg-slate-50 group hover:shadow-2xl transition-all h-full flex flex-col">
                <CardHeader className="text-center pt-8">
                  <div className="mx-auto h-16 w-16 rounded-2xl bg-white shadow-md flex items-center justify-center mb-4 group-hover:bg-primary transition-colors">
                    <caseStudy.icon className="h-8 w-8 text-primary group-hover:text-white" />
                  </div>
                  <CardTitle className="text-xl font-bold group-hover:text-primary transition-colors">{caseStudy.title}</CardTitle>
                </CardHeader>
                <CardContent className="flex-grow">
                  <p className="text-sm text-muted-foreground leading-relaxed px-4">{caseStudy.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ SECTION */}
      <section className="py-24 bg-slate-50 border-y border-slate-100 scroll-m-20">
        <div className="container mx-auto px-4 max-w-4xl">
          <div className="text-center mb-16 space-y-4">
            <h2 className="text-3xl font-black text-slate-900 md:text-4xl">Frequently Asked Questions</h2>
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
          <div className="max-w-4xl mx-auto p-12 rounded-[2.5rem] bg-slate-900 text-white shadow-2xl relative overflow-hidden">
            <div className="relative z-10 space-y-8">
              <h2 className="text-4xl font-black md:text-5xl">Get Professional Accounting & Compliance Support</h2>
              <p className="text-xl text-slate-300 max-w-2xl mx-auto font-medium leading-relaxed">
                Whether you need accounting services, tax compliance, company registration, payroll support, or CIPC assistance, My Accountant is ready to assist your business.
              </p>
              <div className="flex flex-col sm:flex-row justify-center gap-4 pt-4">
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
            <div className="absolute top-0 right-0 p-8 opacity-10"><Calculator size={200} /></div>
            <div className="absolute bottom-0 left-0 p-8 opacity-10"><Landmark size={200} /></div>
          </div>
        </div>
      </section>
    </div>
  );
}
