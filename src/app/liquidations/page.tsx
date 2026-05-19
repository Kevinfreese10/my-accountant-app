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
    <div className="space-y-16 pb-16">
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
            <Button asChild size="lg" className="font-bold px-10">
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
            <h2 className="text-3xl font-bold">What Is a Company Liquidation?</h2>
            <p className="text-muted-foreground mt-2 max-w-2xl mx-auto">
              A liquidation is the formal legal process of closing a company by settling its affairs, paying creditors (where applicable), and removing it from the Companies Register. Liquidation may be appropriate when:
            </p>
            <ul className="mt-4 text-muted-foreground list-disc list-inside inline-block text-left text-sm space-y-1">
                <li>The company is no longer trading</li>
                <li>The business is financially distressed</li>
                <li>Shareholders wish to exit the business</li>
                <li>The company cannot meet its financial obligations</li>
                <li>There is no reasonable prospect of recovery</li>
            </ul>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <Card>
                <CardHeader>
                    <CardTitle>1. Voluntary Liquidation (Solvent)</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-muted-foreground">
                   <p>This applies when the company can pay its debts and shareholders decide to close the business voluntarily. We assist with:</p>
                   <ul className="list-disc pl-6 space-y-1">
                       <li>Shareholder resolutions</li>
                       <li>Appointment of a liquidator</li>
                       <li>Final CIPC and SARS compliance</li>
                       <li>Deregistration upon completion</li>
                   </ul>
                </CardContent>
            </Card>
             <Card>
                <CardHeader>
                    <CardTitle>2. Voluntary Liquidation (Insolvent)</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-muted-foreground">
                   <p>This applies when the company cannot pay its debts and creditors’ interests must be protected. We manage:</p>
                   <ul className="list-disc pl-6 space-y-1">
                       <li>Required resolutions and notices</li>
                       <li>Coordination with the appointed liquidator</li>
                       <li>SARS and CIPC compliance support</li>
                       <li>Practical guidance for directors</li>
                   </ul>
                </CardContent>
            </Card>
             <Card>
                <CardHeader>
                    <CardTitle>3. Compulsory Liquidation (Court-Ordered)</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-muted-foreground">
                   <p>In cases where creditors apply to court to liquidate the company or there is severe financial distress or dispute. My Accountant supports directors with:</p>
                   <ul className="list-disc pl-6 space-y-1">
                       <li>Compliance preparation</li>
                       <li>SARS matters and outstanding returns</li>
                       <li>Advisory support during liquidation</li>
                   </ul>
                </CardContent>
            </Card>
        </div>
      </section>

      <section className="bg-background py-16">
        <div className="container mx-auto px-4">
            <div className="text-center mb-12">
                <h2 className="text-3xl font-bold">What Our Liquidation Service Includes</h2>
                 <p className="text-muted-foreground mt-2 max-w-2xl mx-auto">
                    We don’t just process paperwork — we walk the journey with you.
                </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-4xl mx-auto">
                {processSteps.map((step, index) => (
                <div key={step.title} className="flex items-start gap-4">
                    <div className="bg-primary/10 rounded-full h-10 w-10 flex items-center justify-center flex-shrink-0">
                         <CheckCircle className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                        <h3 className="text-lg font-semibold">{step.title}</h3>
                        <p className="text-sm text-muted-foreground">{step.description}</p>
                    </div>
                </div>
                ))}
            </div>
        </div>
      </section>

       <section className="container mx-auto px-4">
            <div className="text-center mb-12">
                <h2 className="text-3xl font-bold">Why Use My Accountant?</h2>
                 <p className="text-muted-foreground mt-2 max-w-2xl mx-auto">
                    We don’t sell time — we sell comfort.
                </p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
                {whyChooseUs.map((benefit) => (
                    <div key={benefit.title} className="flex flex-col items-center text-center gap-4">
                        <div className="bg-primary/10 rounded-full h-16 w-16 flex items-center justify-center">
                            <benefit.icon className="h-8 w-8 text-primary" />
                        </div>
                        <div>
                            <h3 className="font-semibold">{benefit.title}</h3>
                            <p className="text-xs text-muted-foreground mt-1">{benefit.description}</p>
                        </div>
                    </div>
                ))}
            </div>
      </section>
      
        <section className="container mx-auto px-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <Card>
                    <CardHeader>
                        <CardTitle>Important Things Directors Should Know</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-muted-foreground">
                        <ul className="list-disc pl-6 space-y-2 text-sm">
                            <li>Liquidation does not automatically remove director liability</li>
                            <li>Outstanding tax returns and compliance issues must still be addressed</li>
                            <li>Early professional advice can prevent unnecessary personal exposure</li>
                            <li>Each liquidation is unique — getting the right guidance matters</li>
                        </ul>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader>
                        <CardTitle>Documents Typically Required</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-muted-foreground">
                        <p className="text-sm">While requirements differ by case, we usually need:</p>
                        <ul className="list-disc pl-6 space-y-1 text-sm">
                            <li>Company registration details</li>
                            <li>Latest financial statements (if available)</li>
                            <li>List of assets and liabilities</li>
                            <li>Director and shareholder information</li>
                            <li>SARS tax numbers and compliance status</li>
                        </ul>
                        <p className="text-xs italic pt-2">Don’t worry — if something is missing, we’ll help you work through it.</p>
                    </CardContent>
                </Card>
            </div>
        </section>

      <section className="container mx-auto px-4 text-center">
        <h2 className="text-3xl font-bold">Need Help Deciding If Liquidation Is Right?</h2>
        <p className="text-muted-foreground mt-2 max-w-2xl mx-auto">
            If you’re unsure whether liquidation is the correct step, we’re happy to assess your situation and explain your options before you commit. Contact My Accountant today for professional liquidation assistance and clear guidance you can trust.
        </p>
        <Button asChild size="lg" className="mt-8">
            <Link href="/contact">Book a Consultation</Link>
        </Button>
      </section>
    </div>
  );
}
