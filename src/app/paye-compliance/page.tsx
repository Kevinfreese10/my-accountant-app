import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Landmark, Users, Receipt, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { Metadata } from 'next';
import { getStaticPageMetadata } from '@/lib/seo-utils';
import TrustIndexWidget from '@/components/shared/TrustIndexWidget';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function generateMetadata(): Promise<Metadata> {
    const defaults: Metadata = {
        title: 'PAYE Compliance & EMP201 Returns | My Accountant',
        description: 'Professional management of PAYE compliance and monthly EMP201 submissions for South African employers.',
    };
    return getStaticPageMetadata('paye-compliance', defaults);
}

export default function PayeCompliancePage() {
  const highlights = [
    { title: 'EMP201 Submissions', description: 'Accurate monthly declarations of PAYE, UIF, and SDL to SARS.', icon: Landmark },
    { title: 'Tax Threshold Monitoring', description: 'Ensure correct deductions based on the latest SA tax brackets.', icon: Receipt },
    { title: 'SDL & UIF Calculations', description: 'Automatic tracking of Skills Development Levy and Unemployment Insurance.', icon: ShieldCheck },
    { title: 'Interim Reconciliations', description: 'Full support for the EMP501 interim and final tax year recons.', icon: Users },
  ];

  return (
    <div className="space-y-16 pb-16 bg-white">
      <section className="relative w-full overflow-hidden bg-white pt-16 lg:pt-24 pb-20 border-b text-center">
        <div className="container relative z-10 mx-auto px-4">
          <h1 className="mb-6 text-4xl font-black tracking-tight text-slate-900 md:text-5xl lg:text-6xl text-center">
            <span className="text-gradient">PAYE #Compliance & EMP201</span>
          </h1>
          <p className="text-lg sm:text-xl md:text-2xl font-medium text-muted-foreground max-w-3xl mx-auto">
            Stay on the right side of SARS. We manage your monthly employee tax declarations so you avoid costly non-compliance penalties.
          </p>
          <div className="flex flex-col gap-4 sm:flex-row sm:justify-center pt-8">
            <Button asChild size="lg" className="font-bold px-10 shadow-xl">
                <Link href="/contact">Get a Compliance Assessment</Link>
            </Button>
          </div>
        </div>
      </section>

      <TrustIndexWidget />

      <section className="container mx-auto px-4 bg-white">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold">Comprehensive PAYE Support</h2>
          <p className="text-muted-foreground mt-2 max-w-2xl mx-auto text-center">We handle the complexity of employer tax obligations for you.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {highlights.map((item, index) => (
            <Card key={index} className="border-2 bg-slate-50 shadow-sm h-full">
              <CardHeader>
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center mb-2">
                  <item.icon className="h-5 w-5 text-primary" />
                </div>
                <CardTitle className="text-lg font-bold">{item.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground leading-relaxed">{item.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="container mx-auto px-4 text-center bg-white py-12">
        <div className="max-w-3xl mx-auto p-12 rounded-3xl bg-slate-50 border border-slate-100 shadow-sm">
            <h2 className="text-3xl font-bold text-center">Simplify Your Payroll Tax</h2>
            <p className="text-lg text-muted-foreground mt-4 leading-relaxed text-center">
                SARS PAYE compliance is rigorous. Our specialists ensure your calculations are correct and your returns are filed before the 7th of every month.
            </p>
            <Button asChild size="lg" className="mt-8 shadow-lg font-bold">
                <Link href="/contact">Contact a Consultant</Link>
            </Button>
        </div>
      </section>
    </div>
  );
}
