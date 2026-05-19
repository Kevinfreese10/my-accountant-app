import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle, ShieldCheck, Scale, Users, FileText } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { Metadata } from 'next';
import { getStaticPageMetadata } from '@/lib/seo-utils';
import TrustIndexWidget from '@/components/shared/TrustIndexWidget';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function generateMetadata(): Promise<Metadata> {
    const defaults: Metadata = {
        title: 'Company Liquidations | My Accountant',
        description: 'Professional assistance with voluntary company liquidations in South Africa. Close your business legally and responsibly.',
    };
    return getStaticPageMetadata('liquidations', defaults);
}

export default function LiquidationsPage() {
  const processSteps = [
    {
      title: 'Consultation & Assessment',
      description: 'We evaluate your company’s financial position and advise on the best course of action.',
    },
    {
      title: 'Resolution & Documentation',
      description: 'We prepare the special resolution and all necessary documents for CIPC submission.',
    },
    {
      title: 'Creditor & Employee Notifications',
      description: 'We ensure all legal notification requirements to creditors and employees are met.',
    },
    {
      title: 'Appointment of Liquidator',
      description: 'A liquidator is appointed to wind up the affairs of the company in an orderly manner.',
    },
     {
      title: 'Deregistration',
      description: 'Once the process is complete, we handle the final deregistration of the company from CIPC.',
    },
  ];

  const whyChooseUs = [
    {
      title: 'Experienced',
      description: 'in SARS & CIPC compliance.',
      icon: ShieldCheck,
    },
    {
      title: 'Clear Guidance',
      description: 'upfront guidance — no surprises.',
      icon: Scale,
    },
    {
      title: 'Confidential',
      description: 'Professional, confidential handling.',
      icon: Users,
    },
    {
      title: 'Transparent Pricing',
      description: 'Affordable and transparent pricing.',
      icon: FileText,
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
    <div className="space-y-16 pb-16 bg-white">
      {/* HERO SECTION */}
      <section className="relative w-full overflow-hidden bg-white pt-16 lg:pt-24 pb-20 border-b">
        <div className="container relative z-10 mx-auto px-4 text-center">
          <h1 className="mb-6 text-4xl font-black tracking-tight text-slate-900 md:text-5xl lg:text-6xl">
            Liquidation Services in South Africa
          </h1>
          <p className="text-lg sm:text-xl md:text-2xl font-medium text-muted-foreground max-w-3xl mx-auto">
            Simple, Compliant & Stress-Free Company Closures. We guide you through the process from start to finish—ensuring full compliance with CIPC and SARS.
          </p>
          <div className="flex flex-col gap-4 sm:flex-row sm:justify-center pt-4">
            <Button asChild size="lg" className="font-bold px-10 shadow-xl">
                <Link href="/contact">Get Professional Advice</Link>
            </Button>
          </div>
          <div className="flex flex-wrap justify-center gap-3 pt-6">
            {keywordButtons.map((btn) => (
              <Button key={btn.label} asChild variant="outline" className="h-9 md:h-11 px-4 md:px-6 rounded-full font-bold transition-all text-xs md:text-sm">
                <Link href={btn.href}>{btn.label}</Link>
              </Button>
            ))}
          </div>
        </div>
      </section>

      <TrustIndexWidget />

       <section className="container mx-auto px-4 bg-white">
        <div className="text-center mb-12">
            <h2 className="text-3xl font-bold">What Is a Company Liquidation?</h2>
            <p className="text-muted-foreground mt-2 max-w-2xl mx-auto">
              A liquidation is the formal legal process of closing a company by settling its affairs, paying creditors (where applicable), and removing it from the Companies Register.
            </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <Card className="border-2 bg-slate-50 shadow-sm">
                <CardHeader>
                    <CardTitle>1. Voluntary Liquidation (Solvent)</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-muted-foreground">
                   <p className="text-sm">This applies when the company can pay its debts and shareholders decide to close the business voluntarily. We assist with:</p>
                   <ul className="list-disc pl-6 space-y-1 text-xs">
                       <li>Shareholder resolutions</li>
                       <li>Appointment of a liquidator</li>
                       <li>Final CIPC and SARS compliance</li>
                       <li>Deregistration upon completion</li>
                   </ul>
                </CardContent>
            </Card>
             <Card className="border-2 bg-slate-50 shadow-sm">
                <CardHeader>
                    <CardTitle>2. Voluntary Liquidation (Insolvent)</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-muted-foreground">
                   <p className="text-sm">This applies when the company cannot pay its debts and creditors’ interests must be protected. We manage:</p>
                   <ul className="list-disc pl-6 space-y-1 text-xs">
                       <li>Required resolutions and notices</li>
                       <li>Coordination with the appointed liquidator</li>
                       <li>SARS and CIPC compliance support</li>
                       <li>Practical guidance for directors</li>
                   </ul>
                </CardContent>
            </Card>
             <Card className="border-2 bg-slate-50 shadow-sm">
                <CardHeader>
                    <CardTitle>3. Compulsory Liquidation</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-muted-foreground">
                   <p className="text-sm">In cases where creditors apply to court to liquidate the company or there is severe financial distress. We support directors with:</p>
                   <ul className="list-disc pl-6 space-y-1 text-xs">
                       <li>Compliance preparation</li>
                       <li>SARS matters and outstanding returns</li>
                       <li>Advisory support during liquidation</li>
                   </ul>
                </CardContent>
            </Card>
        </div>
      </section>

      <section className="py-24 bg-white border-t border-b">
        <div className="container mx-auto px-4">
            <div className="text-center mb-12">
                <h2 className="text-3xl font-bold">What Our Liquidation Service Includes</h2>
                 <p className="text-muted-foreground mt-2 max-w-2xl mx-auto">
                    We don’t just process paperwork — we walk the journey with you.
                </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-4xl mx-auto">
                {processSteps.map((step, index) => (
                <div key={step.title} className="flex items-start gap-4 p-4 bg-slate-50 rounded-xl border border-slate-100 shadow-sm">
                    <div className="bg-primary/10 rounded-full h-10 w-10 flex items-center justify-center flex-shrink-0">
                         <CheckCircle className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                        <h3 className="text-base font-bold">{step.title}</h3>
                        <p className="text-xs text-muted-foreground leading-relaxed">{step.description}</p>
                    </div>
                </div>
                ))}
            </div>
        </div>
      </section>

       <section className="container mx-auto px-4 bg-white py-12">
            <div className="text-center mb-12">
                <h2 className="text-3xl font-bold">Why Use My Accountant?</h2>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
                {whyChooseUs.map((benefit) => (
                    <div key={benefit.title} className="flex flex-col items-center text-center gap-4 p-6 bg-slate-50 rounded-2xl border border-slate-100 shadow-sm">
                        <div className="bg-primary/10 rounded-full h-16 w-16 flex items-center justify-center">
                            <benefit.icon className="h-8 w-8 text-primary" />
                        </div>
                        <div>
                            <h3 className="font-bold text-slate-900">{benefit.title}</h3>
                            <p className="text-[10px] text-muted-foreground mt-1 uppercase font-black tracking-widest">{benefit.description}</p>
                        </div>
                    </div>
                ))}
            </div>
      </section>

      <section className="container mx-auto px-4 text-center bg-white">
        <h2 className="text-3xl font-bold">Need Help Deciding If Liquidation Is Right?</h2>
        <p className="text-lg text-muted-foreground mt-2 max-w-2xl mx-auto">
            If you’re unsure whether liquidation is the correct step, we’re happy to assess your situation and explain your options before you commit.
        </p>
        <Button asChild size="lg" className="mt-8 shadow-lg">
            <Link href="/contact">Book a Consultation</Link>
        </Button>
      </section>
    </div>
  );
}
