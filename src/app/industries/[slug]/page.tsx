import { notFound } from 'next/navigation';
import { industries } from '@/lib/industries';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle2, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import TrustIndexWidget from '@/components/shared/TrustIndexWidget';
import { Separator } from '@/components/ui/separator';
import { Metadata } from 'next';
import { SITE_URL } from '@/lib/constants';

type Props = {
  params: Promise<{ slug: string }>
}

export async function generateStaticParams() {
  return Object.keys(industries).map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const industry = industries[slug];
  
  if (!industry) return { title: 'Industry Not Found' };

  return {
    title: `${industry.title} | My Accountant`,
    description: industry.description,
    alternates: {
        canonical: `${SITE_URL}/industries/${slug}`,
    }
  };
}

export default async function IndustryPage({ params }: Props) {
  const { slug } = await params;
  const industry = industries[slug];

  if (!industry) {
    notFound();
  }

  return (
    <div className="space-y-16 pb-16">
      <section className="bg-slate-900 text-white py-20 lg:py-32">
        <div className="container mx-auto px-4 text-center">
            <div className="h-16 w-16 rounded-2xl bg-primary/20 flex items-center justify-center mx-auto mb-8">
                <industry.icon className="h-8 w-8 text-primary" />
            </div>
            <h1 className="text-4xl font-bold tracking-tight md:text-5xl lg:text-6xl max-w-4xl mx-auto">
                {industry.heroTitle}
            </h1>
            <p className="mt-6 text-xl text-slate-300 max-w-2xl mx-auto">
                {industry.heroSubtitle}
            </p>
            <Button asChild size="lg" className="mt-10 font-bold px-10 h-12">
                <Link href="/contact">Get Started for my Business</Link>
            </Button>
        </div>
      </section>

      <TrustIndexWidget />

      <section className="container mx-auto px-4 max-w-4xl">
          <div className="space-y-8">
            <div className="space-y-6">
                <h2 className="text-3xl font-bold text-slate-900">Tailored Expertise for {industry.title.replace('Accounting for ', '')}</h2>
                <div className="text-lg text-muted-foreground leading-relaxed">
                    {industry.content}
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-8">
                <Card className="border-2 border-primary/10">
                    <CardHeader>
                        <CardTitle className="text-xl font-bold">Key Benefits</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ul className="space-y-4">
                            {industry.benefits.map((benefit, i) => (
                                <li key={i} className="flex items-start gap-3">
                                    <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
                                    <span className="text-sm font-medium text-slate-700">{benefit}</span>
                                </li>
                            ))}
                        </ul>
                    </CardContent>
                </Card>

                <Card className="border-2 border-primary/10">
                    <CardHeader>
                        <CardTitle className="text-xl font-bold">Niche Services</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ul className="space-y-4">
                            {industry.specialServices.map((service, i) => (
                                <li key={i} className="flex items-start gap-3">
                                    <CheckCircle2 className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                                    <span className="text-sm font-medium text-slate-700">{service}</span>
                                </li>
                            ))}
                        </ul>
                    </CardContent>
                </Card>
            </div>
          </div>
      </section>

      <section className="bg-slate-50 py-16 border-y">
          <div className="container mx-auto px-4 text-center space-y-8">
              <h2 className="text-3xl font-bold text-slate-900">Ready to simplify your business finances?</h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                  Our team of experts understands the unique challenges of the {industry.title.replace('Accounting for ', '').toLowerCase()} sector in South Africa.
              </p>
              <div className="flex flex-col sm:flex-row justify-center gap-4">
                <Button asChild size="lg" className="font-bold h-12">
                    <Link href="/contact">Book a Consultation</Link>
                </Button>
                <Button asChild variant="outline" size="lg" className="font-bold h-12">
                    <Link href="/products">Browse All Services</Link>
                </Button>
              </div>
          </div>
      </section>
    </div>
  );
}
