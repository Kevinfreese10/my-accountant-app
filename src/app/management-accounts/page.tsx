import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle2, BarChart3, Calculator, TrendingUp, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { Metadata } from 'next';
import { getStaticPageMetadata } from '@/lib/seo-utils';
import TrustIndexWidget from '@/components/shared/TrustIndexWidget';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function generateMetadata(): Promise<Metadata> {
    const defaults: Metadata = {
        title: 'Management Accounts & Financial Reporting | My Accountant',
        description: 'Professional monthly and quarterly management accounts for South African businesses. Data-driven insights to grow your practice.',
    };
    return getStaticPageMetadata('management-accounts', defaults);
}

export default function ManagementAccountsPage() {
  const coreFeatures = [
    { title: 'Profit & Loss Statement', description: 'Analyze your monthly revenue vs expenses to track actual profitability.', icon: Calculator },
    { title: 'Balance Sheet Review', description: 'Real-time view of your assets, liabilities, and equity structure.', icon: BarChart3 },
    { title: 'Budget vs Actuals', description: 'Strategic variance analysis to keep your spending in line with your business goals.', icon: TrendingUp },
    { title: 'Financial Ratios', description: 'Key performance indicators tailored to your specific industry.', icon: ShieldCheck },
  ];

  return (
    <div className="space-y-16 pb-16 bg-white">
      <section className="relative w-full overflow-hidden bg-white pt-16 lg:pt-24 pb-20 border-b">
        <div className="container relative z-10 mx-auto px-4 text-center">
          <h1 className="mb-6 text-4xl font-black tracking-tight text-slate-900 md:text-5xl lg:text-6xl">
            Management <span className="text-primary">#Accounts</span> & Reporting
          </h1>
          <p className="text-lg sm:text-xl md:text-2xl font-medium text-muted-foreground max-w-3xl mx-auto">
            Decisions are only as good as the data they are based on. Our management reporting gives you the clarity you need to lead your business with confidence.
          </p>
          <div className="flex flex-col gap-4 sm:flex-row sm:justify-center pt-8">
            <Button asChild size="lg" className="font-bold px-10 shadow-xl">
                <Link href="/contact">Book a Financial Review</Link>
            </Button>
          </div>
        </div>
      </section>

      <TrustIndexWidget />

      <section className="container mx-auto px-4 bg-white">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold">Why Management Accounts?</h2>
          <p className="text-muted-foreground mt-2 max-w-2xl mx-auto italic">"Waiting for year-end financials is too late to make strategic changes."</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {coreFeatures.map((feature, index) => (
            <Card key={index} className="border-2 bg-slate-50 shadow-sm h-full">
              <CardHeader>
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center mb-2">
                  <feature.icon className="h-5 w-5 text-primary" />
                </div>
                <CardTitle className="text-lg font-bold">{feature.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground leading-relaxed">{feature.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="container mx-auto px-4 text-center bg-white py-12">
        <div className="max-w-3xl mx-auto p-12 rounded-3xl bg-slate-50 border border-slate-100 shadow-sm">
            <h2 className="text-3xl font-bold">Get a Clear Financial View</h2>
            <p className="text-lg text-muted-foreground mt-4 leading-relaxed">
                Our team provides monthly or quarterly management packs that help you identify growth opportunities and eliminate waste before it affects your bottom line.
            </p>
            <Button asChild size="lg" className="mt-8 shadow-lg font-bold">
                <Link href="/contact">Contact Our Experts</Link>
            </Button>
        </div>
      </section>
    </div>
  );
}
