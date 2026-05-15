'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle, ShieldCheck, BarChart3, Calculator, Clock, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';
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

  return (
    <div className="space-y-16 pb-16">
      <section className="bg-slate-900 text-white">
        <div className="container mx-auto px-4 py-16 lg:py-24 text-center">
          <h1 className="text-4xl font-bold tracking-tight md:text-5xl lg:text-6xl">
            Monthly <span className="text-primary">#Accounting</span> & Bookkeeping
          </h1>
          <p className="mt-6 text-xl text-slate-300 max-w-3xl mx-auto">
            Focus on your business, we&apos;ll handle the numbers. Our monthly accounting packages provide SMEs with the accurate data and compliance support needed to scale.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row justify-center gap-4">
            <Button asChild size="lg" className="h-12 px-8 font-bold">
              <Link href="/contact">Get a Custom Quote</Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="h-12 px-8 font-bold text-white border-white hover:bg-white hover:text-slate-900">
              <Link href="/products#accounting-services">View All Packages</Link>
            </Button>
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
