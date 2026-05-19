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
    <div className="space-y-16 pb-16 bg-white">
      {/* HERO SECTION */}
      <section className="relative w-full overflow-hidden bg-white pt-16 lg:pt-24 pb-20 border-b text-center">
        <div className="container relative z-10 mx-auto px-4">
          <h1 className="mb-6 text-4xl font-black tracking-tight text-slate-900 md:text-6xl lg:text-7xl">
            Monthly <span className="text-gradient">#Payroll</span> Services
          </h1>
          <div className="mx-auto mb-10 max-w-4xl text-lg font-medium text-muted-foreground md:text-xl leading-relaxed">
            <p>
              Hassle-free payroll management. From payslips to SARS submissions, we ensure your employees are paid accurately and your business stays compliant.
            </p>
          </div>
          
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

      <section className="container mx-auto px-4 bg-white">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-center">Everything Your Business Needs</h2>
          <p className="text-muted-foreground mt-2 max-w-2xl mx-auto text-center">
            Our end-to-end payroll service takes the administrative burden off your shoulders.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {features.map((feature, index) => (
            <Card key={index} className="border-2 bg-slate-50 hover:border-primary/50 transition-colors shadow-sm">
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

      <section className="py-16 bg-white border-t border-b">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
              <h2 className="text-3xl font-bold text-slate-900">Total Compliance Management</h2>
              <p className="text-lg text-muted-foreground leading-relaxed">
                Payroll isn&apos;t just about paying people; it&apos;s about ensuring you meet all legal requirements from the Department of Labour and SARS.
              </p>
              <ul className="space-y-4">
                {complianceItems.map((item, index) => (
                  <li key={index} className="flex items-center gap-3 text-sm font-medium text-slate-700 p-3 bg-slate-50 rounded-lg border border-slate-100 shadow-sm">
                    <CheckCircle2 className="h-5 w-5 text-primary shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <Card className="bg-slate-50 border-2 shadow-xl p-8">
                <div className="space-y-4 text-center">
                    <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                        <Users className="h-8 w-8 text-primary" />
                    </div>
                    <h3 className="text-2xl font-bold">Scale as You Grow</h3>
                    <p className="text-muted-foreground text-sm">
                        Whether you have 1 employee or 100, our scalable system handles the load. Get specialized support for commissions, bonuses, and complex deductions.
                    </p>
                    <Separator className="my-6 bg-slate-200" />
                    <Button asChild className="w-full font-bold shadow-lg h-12">
                        <Link href="/contact">Speak to a Payroll Expert</Link>
                    </Button>
                </div>
            </Card>
          </div>
        </div>
      </section>

      <section className="container mx-auto px-4 text-center bg-white">
        <h2 className="text-3xl font-bold text-center">Stop Struggling with Manual Payroll</h2>
        <p className="text-lg text-muted-foreground mt-4 max-w-2xl mx-auto text-center">
            Switch to a professional payroll solution and ensure your business remains compliant with the latest tax laws.
        </p>
        <Button asChild size="lg" className="mt-8 font-bold px-12 shadow-xl">
          <Link href="/contact">Inquire Now</Link>
        </Button>
      </section>
    </div>
  );
}