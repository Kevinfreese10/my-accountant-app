'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle, ShieldCheck, BarChart3, Calculator, Clock, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import TrustIndexWidget from '@/components/shared/TrustIndexWidget';

export default function MonthlyAccountingPageClient() {
  const coreServices = [
    {
      title: 'Daily/Weekly Processing',
      description: 'Accurate recording of all business transactions, ensuring your ledgers are always up to date.',
      icon: Calculator,
    },
    {
      title: 'Bank Reconciliations',
      description: 'Regular matching of bank statements to accounting records to identify and fix discrepancies early.',
      icon: CheckCircle,
    },
    {
      title: 'Management Accounts',
      description: 'Monthly financial snapshots including Income Statements and Balance Sheets to track performance.',
      icon: BarChart3,
    },
    {
      title: 'VAT Submissions',
      description: 'Preparation and submission of VAT201 returns to ensure SARS compliance.',
      icon: ShieldCheck,
    },
  ];

  const benefits = [
    {
      title: 'Expert Oversight',
      description: 'Your books are managed by qualified accounting professionals.',
    },
    {
      title: 'Cloud-Based',
      description: 'Access your financial data anytime, anywhere with secure cloud technology.',
    },
    {
      title: 'Tax Ready',
      description: 'Maintain a clean audit trail that makes year-end tax season a breeze.',
    },
    {
      title: 'Transparent Pricing',
      description: 'Fixed monthly fees so you can budget with confidence.',
    },
  ];

  const keywordButtons = [
    { label: 'Entity Registrations', href: '/products#entity-registrations' },
    { label: 'SARS Services', href: '/products#sars-services' },
    { label: 'CIPC Services', href: '/products#cipc-services' },
    { label: 'Accounting Services', href: '/products#accounting-services' },
    { label: 'Payroll Services', href: '/products#payroll-services' },
  ];

  return (
    <div className="space-y-16 pb-16">
      {/* HERO SECTION */}
      <section className="relative w-full overflow-hidden bg-white pt-16 lg:pt-24 pb-20 border-b">
        <div className="container relative z-10 mx-auto px-4 text-center">
          <h1 className="mb-6 text-4xl font-black tracking-tight text-slate-900 md:text-6xl lg:text-7xl">
            Monthly <span className="text-primary">#Accounting</span> & Bookkeeping
          </h1>
          <div className="mx-auto mb-10 max-w-4xl text-lg font-medium text-muted-foreground md:text-xl leading-relaxed">
            <p>
              Focus on your business, we&apos;ll handle the numbers. Our monthly accounting packages provide SMEs with the accurate data and compliance support needed to scale.
            </p>
          </div>
          
          <div className="flex flex-wrap justify-center gap-3 pt-4">
            {keywordButtons.map((btn) => (
              <Button key={btn.label} asChild variant="outline" className="h-9 md:h-11 px-4 md:px-6 rounded-full font-bold transition-all text-xs md:text-sm">
                <Link href={btn.href}>{btn.label}</Link>
              </Button>
            ))}
          </div>

          <div className="mt-20 relative w-full aspect-[16/9] lg:aspect-[21/9] max-w-6xl mx-auto rounded-[2.5rem] overflow-hidden shadow-2xl border-8 border-slate-50 bg-slate-100">
            <Image 
              src="https://firebasestorage.googleapis.com/v0/b/studio-2604127518-57889.firebasestorage.app/o/uploads%2FLRM285EOq3gwNMKayY6vtzooaC03%2F1778852737208-South%20Africa%E2%80%99s%20Trusted%20Online%20Accounting%20%26%20Tax%20Compliance%20Partner%20(2).png?alt=media&token=3e8db3bc-8d7a-44b3-a258-dce170c9076d"
              alt="My Accountant - South Africa's Trusted Online Accounting & Tax Compliance Partner"
              fill
              priority
              className="object-cover"
            />
          </div>
        </div>
      </section>

      <TrustIndexWidget />

      <section className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold">Comprehensive Monthly Support</h2>
          <p className="text-muted-foreground mt-2 max-w-2xl mx-auto">
            Everything you need to keep your business financially healthy and SARS compliant.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {coreServices.map((service, index) => (
            <Card key={index} className="border-2 hover:border-primary/50 transition-colors">
              <CardHeader>
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center mb-2">
                  <service.icon className="h-5 w-5 text-primary" />
                </div>
                <CardTitle className="text-xl">{service.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground leading-relaxed">{service.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="bg-slate-50 py-16">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold">Why Outsource Your Accounting?</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
              {benefits.map((benefit, index) => (
                <div key={index} className="flex gap-4 items-start">
                  <div className="h-6 w-6 rounded-full bg-green-100 flex items-center justify-center shrink-0 mt-1">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900">{benefit.title}</h3>
                    <p className="text-sm text-muted-foreground mt-1">{benefit.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="container mx-auto px-4 text-center">
        <div className="max-w-3xl mx-auto p-12 rounded-3xl bg-primary/5 border-2 border-dashed border-primary/20">
          <h2 className="text-3xl font-bold">Ready for a Clean Set of Books?</h2>
          <p className="text-lg text-muted-foreground mt-4">
            Join hundreds of South African business owners who trust My Accountant for their monthly compliance and financial reporting.
          </p>
          <Button asChild size="lg" className="mt-8 font-bold px-12">
            <Link href="/contact">Book a Consultation</Link>
          </Button>
        </div>
      </section>
    </div>
  );
}
