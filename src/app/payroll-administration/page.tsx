import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle2, Users, Receipt, Clock, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { Metadata } from 'next';
import { getStaticPageMetadata } from '@/lib/seo-utils';
import TrustIndexWidget from '@/components/shared/TrustIndexWidget';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function generateMetadata(): Promise<Metadata> {
    const defaults: Metadata = {
        title: 'Payroll Administration Services | My Accountant',
        description: 'Professional payroll administration for South African businesses. Digital payslips, leave tracking, and employer tax management.',
    };
    return getStaticPageMetadata('payroll-administration', defaults);
}

export default function PayrollAdministrationPage() {
  const coreServices = [
    { title: 'Digital Payslips', description: 'Automated monthly or bi-weekly payslips delivered securely to employees.', icon: Receipt },
    { title: 'Leave Management', description: 'Systematic tracking of annual, sick, and family responsibility leave.', icon: Clock },
    { title: 'Employee Onboarding', description: 'Setup and registration of new staff in the payroll system.', icon: Users },
    { title: 'Third-Party Payouts', description: 'Assistance with scheduling payments to medical aids and pension funds.', icon: ShieldCheck },
  ];

  return (
    <div className="space-y-16 pb-16 bg-white">
      <section className="relative w-full overflow-hidden bg-white pt-16 lg:pt-24 pb-20 border-b text-center">
        <div className="container relative z-10 mx-auto px-4">
          <h1 className="mb-6 text-4xl font-black tracking-tight text-slate-900 md:text-5xl lg:text-6xl">
            Payroll <span className="text-gradient">#Administration</span> Services
          </h1>
          <p className="text-lg sm:text-xl md:text-2xl font-medium text-muted-foreground max-w-3xl mx-auto">
            Accurate, on-time, and professional. We take the administrative burden out of paying your team, ensuring every calculation is perfect.
          </p>
          <div className="flex flex-col gap-4 sm:flex-row sm:justify-center pt-8">
            <Button asChild size="lg" className="font-bold px-10 shadow-xl">
                <Link href="/contact">Enquire About Payroll</Link>
            </Button>
          </div>
        </div>
      </section>

      <TrustIndexWidget />

      <section className="container mx-auto px-4 bg-white">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold">Reliable Payroll Outsourcing</h2>
          <p className="text-muted-foreground mt-2 max-w-2xl mx-auto">Strategic administrative support for your workforce.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {coreServices.map((service, index) => (
            <Card key={index} className="border-2 bg-slate-50 shadow-sm h-full">
              <CardHeader>
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center mb-2">
                  <service.icon className="h-5 w-5 text-primary" />
                </div>
                <CardTitle className="text-lg font-bold">{service.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground leading-relaxed">{service.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="container mx-auto px-4 text-center bg-white py-12">
        <div className="max-w-3xl mx-auto p-12 rounded-3xl bg-slate-50 border border-slate-100 shadow-sm">
            <h2 className="text-3xl font-bold">Scale Your Business, Not Your Admin</h2>
            <p className="text-lg text-muted-foreground mt-4 leading-relaxed text-center">
                Whether you have 1 or 100 employees, our payroll engine scales with you. We ensure your team is paid correctly while you focus on leading them.
            </p>
            <Button asChild size="lg" className="mt-8 shadow-lg font-bold">
                <Link href="/contact">Speak to a Specialist</Link>
            </Button>
        </div>
      </section>
    </div>
  );
}