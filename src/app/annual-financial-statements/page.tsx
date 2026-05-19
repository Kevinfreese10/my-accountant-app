import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle2, FileText, Landmark, ShieldCheck, PieChart } from 'lucide-react';
import Link from 'next/link';
import { Metadata } from 'next';
import { getStaticPageMetadata } from '@/lib/seo-utils';
import TrustIndexWidget from '@/components/shared/TrustIndexWidget';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function generateMetadata(): Promise<Metadata> {
    const defaults: Metadata = {
        title: 'Annual Financial Statements (AFS) | My Accountant',
        description: 'Professional preparation of IFRS-compliant Annual Financial Statements for South African companies and trusts.',
    };
    return getStaticPageMetadata('annual-financial-statements', defaults);
}

export default function AnnualFinancialStatementsPage() {
  const steps = [
    { title: 'IFRS Compliance', description: 'Ensure your financials adhere to the latest reporting standards.', icon: ShieldCheck },
    { title: 'Audit Readiness', description: 'Prepare for independent review or full audit with clean, structured data.', icon: FileText },
    { title: 'Tax Alignment', description: 'Sync your accounting profit with your SARS taxable income requirements.', icon: Landmark },
    { title: 'Stakeholder Confidence', description: 'Present professional financials to banks, investors, and CIPC.', icon: PieChart },
  ];

  return (
    <div className="space-y-16 pb-16 bg-white">
      <section className="relative w-full overflow-hidden bg-white pt-16 lg:pt-24 pb-20 border-b">
        <div className="container relative z-10 mx-auto px-4 text-center">
          <h1 className="mb-6 text-4xl font-black tracking-tight text-slate-900 md:text-5xl lg:text-6xl">
            Annual Financial <span className="text-primary">#Statements</span>
          </h1>
          <p className="text-lg sm:text-xl md:text-2xl font-medium text-muted-foreground max-w-3xl mx-auto">
            Accurate, compliant, and ready for review. We help South African companies and trusts finalize their year-end financial reporting with precision.
          </p>
          <div className="flex flex-col gap-4 sm:flex-row sm:justify-center pt-8">
            <Button asChild size="lg" className="font-bold px-10 shadow-xl">
                <Link href="/contact">Request an AFS Quote</Link>
            </Button>
          </div>
        </div>
      </section>

      <TrustIndexWidget />

      <section className="container mx-auto px-4 bg-white">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold">Standard-Setting Year-End Support</h2>
          <p className="text-muted-foreground mt-2 max-w-2xl mx-auto">Our accountants ensure your annual reporting is correct and compliant with the Companies Act.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {steps.map((step, index) => (
            <Card key={index} className="border-2 bg-slate-50 shadow-sm h-full">
              <CardHeader>
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center mb-2">
                  <step.icon className="h-5 w-5 text-primary" />
                </div>
                <CardTitle className="text-lg font-bold">{step.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground leading-relaxed">{step.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="container mx-auto px-4 text-center bg-white py-12">
        <div className="max-w-3xl mx-auto p-12 rounded-3xl bg-slate-50 border border-slate-100 shadow-sm">
            <h2 className="text-3xl font-bold">Close Your Year with Peace of Mind</h2>
            <p className="text-lg text-muted-foreground mt-4 leading-relaxed">
                Whether you need financials for a bank loan application, CIPC compliance, or shareholder review, we deliver accurate statements you can rely on.
            </p>
            <Button asChild size="lg" className="mt-8 shadow-lg font-bold">
                <Link href="/contact">Talk to a Specialist</Link>
            </Button>
        </div>
      </section>
    </div>
  );
}
