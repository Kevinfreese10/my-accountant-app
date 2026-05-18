'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle, ShieldCheck, Users, Receipt, Landmark, CalendarDays, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import TrustIndexWidget from '@/components/shared/TrustIndexWidget';
import { Separator } from '@/components/ui/separator';

export default function MonthlyPayrollPageClient() {
  const features = [
    {
      title: 'Automated Payslips',
      description: 'Professional, SARS-compliant payslips delivered digitally to your employees each month.',
      icon: Receipt,
    },
    {
      title: 'EMP201 Submissions',
      description: 'Accurate calculation and submission of your monthly PAYE, UIF, and SDL declarations.',
      icon: Landmark,
    },
    {
      title: 'UIF Declarations',
      description: 'Monthly electronic filing (uFiling) for employee registrations and declarations.',
      icon: ShieldCheck,
    },
    {
      title: 'Leave Tracking',
      description: 'Systematic management of annual, sick, and family responsibility leave.',
      icon: CalendarDays,
    },
  ];

  const complianceItems = [
    'Annual IRP5 and IT3(a) certificates',
    'EMP501 Interim and Final reconciliations',
    'COIDA (Workmen’s Compensation) submissions',
    'UIF registration and deregistration',
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
      {/* Hero Image Section */}
      <section className="relative w-full aspect-[16/9] lg:aspect-[21/9] xl:aspect-[24/9] overflow-hidden bg-slate-900">
        <Image 
          src="https://firebasestorage.googleapis.com/v0/b/studio-2604127518-57889.firebasestorage.app/o/uploads%2FLRM285EOq3gwNMKayY6vtzooaC03%2F1778852737208-South%20Africa%E2%80%99s%20Trusted%20Online%20Accounting%20%26%20Tax%20Compliance%20Partner%20(2).png?alt=media&token=3e8db3bc-8d7a-44b3-a258-dce170c9076d"
          alt="My Accountant - South Africa's Trusted Online Accounting & Tax Compliance Partner"
          fill
          priority
          className="object-contain lg:object-cover"
        />
      </section>

      {/* Hero Content Section */}
      <section className="container mx-auto px-4 text-center">
        <div className="max-w-4xl mx-auto space-y-6">
          <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl md:text-5xl lg:text-6xl text-slate-900">
            Monthly <span className="text-primary">#Payroll</span> Services
          </h1>
          <p className="text-lg sm:text-xl md:text-2xl font-medium text-muted-foreground max-w-3xl mx-auto">
            Hassle-free payroll management. From payslips to SARS submissions, we ensure your employees are paid accurately and your business stays compliant.
          </p>
          
          <div className="flex flex-wrap justify-center gap-3 pt-4">
            {keywordButtons.map((btn) => (
              <Button key={btn.label} asChild variant="outline" className="h-9 md:h-11 px-4 md:px-6 rounded-full font-bold transition-all text-xs md:text-sm">
                <Link href={btn.href}>{btn.label}</Link>
              </Button>
            ))}
          </div>
        </div>
      </section>

      <TrustIndexWidget />

      <section className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold">Everything Your Business Needs</h2>
          <p className="text-muted-foreground mt-2 max-w-2xl mx-auto">
            Our end-to-end payroll service takes the administrative burden off your shoulders.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {features.map((feature, index) => (
            <Card key={index} className="border-2 hover:border-primary/50 transition-colors shadow-sm">
              <CardHeader>
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center mb-2">
                  <feature.icon className="h-5 w-5 text-primary" />
                </div>
                <CardTitle className="text-xl">{feature.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground leading-relaxed">{feature.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="bg-slate-50 py-16">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
              <h2 className="text-3xl font-bold text-slate-900">Total Compliance Management</h2>
              <p className="text-lg text-muted-foreground leading-relaxed">
                Payroll isn&apos;t just about paying people; it&apos;s about ensuring you meet all legal requirements from the Department of Labour and SARS.
              </p>
              <ul className="space-y-4">
                {complianceItems.map((item, index) => (
                  <li key={index} className="flex items-center gap-3 text-sm font-medium text-slate-700">
                    <CheckCircle2 className="h-5 w-5 text-primary shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <Card className="bg-white border-2 shadow-xl p-8">
                <div className="space-y-4 text-center">
                    <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                        <Users className="h-8 w-8 text-primary" />
                    </div>
                    <h3 className="text-2xl font-bold">Scale as You Grow</h3>
                    <p className="text-muted-foreground">
                        Whether you have 1 employee or 100, our scalable system handles the load. Get specialized support for commissions, bonuses, and complex deductions.
                    </p>
                    <Separator className="my-6" />
                    <Button asChild className="w-full">
                        <Link href="/contact">Speak to a Payroll Expert</Link>
                    </Button>
                </div>
            </Card>
          </div>
        </div>
      </section>

      <section className="container mx-auto px-4 text-center">
        <h2 className="text-3xl font-bold">Stop Struggling with Manual Payroll</h2>
        <p className="text-lg text-muted-foreground mt-4 max-w-2xl mx-auto">
            Switch to a professional payroll solution and ensure your business remains compliant with the latest tax laws.
        </p>
        <Button asChild size="lg" className="mt-8 font-bold px-12">
          <Link href="/contact">Inquire Now</Link>
        </Button>
      </section>
    </div>
  );
}