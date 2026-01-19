
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle, ShieldCheck, LifeBuoy, FileText } from 'lucide-react';
import Link from 'next/link';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'SARS Compromise of Debt',
  description: 'Explore your options for a SARS Compromise of Debt with My Accountant. We help you negotiate a settlement with SARS to resolve outstanding tax debt and get a fresh start.',
};

export default function SarsCompromisePage() {
  const benefits = [
    {
      title: 'Reduce Your Tax Debt',
      description: 'Potentially write off a significant portion of your tax debt, including penalties and interest.',
      icon: CheckCircle,
    },
    {
      title: 'Achieve Compliance',
      description: 'Settle your outstanding tax affairs and become fully compliant with SARS.',
      icon: ShieldCheck,
    },
    {
      title: 'Get Expert Guidance',
      description: 'Our tax experts manage the entire application process on your behalf, ensuring the best possible outcome.',
      icon: LifeBuoy,
    },
    {
      title: 'Avoid Legal Action',
      description: 'A successful compromise can prevent asset seizure, judgments, or liquidation proceedings.',
      icon: FileText,
    },
  ];

  return (
    <div className="space-y-16 pb-16">
      <section className="bg-background">
        <div className="container mx-auto px-4 py-16 text-center">
          <h1 className="text-4xl font-bold tracking-tight md:text-5xl lg:text-6xl">
            SARS <span className="text-gradient">#Compromise</span> of Debt
          </h1>
          <p className="mt-6 text-lg text-muted-foreground max-w-3xl mx-auto">
            Overwhelmed by tax debt? A SARS Compromise could be your solution. We negotiate with SARS on your behalf to settle your tax liability for a lower amount.
          </p>
          <Button asChild size="lg" className="mt-8">
            <Link href="/contact">Book a Free Consultation</Link>
          </Button>
        </div>
      </section>

      <section className="container mx-auto px-4">
        <div className="text-center mb-12">
            <h2 className="text-3xl font-bold">Is a SARS Compromise Right for You?</h2>
            <p className="text-muted-foreground mt-2 max-w-2xl mx-auto">
              If your business is unable to pay its tax debt in full, a compromise may be the best way forward.
            </p>
        </div>
        <Card>
            <CardHeader>
                <CardTitle>Who Qualifies?</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-muted-foreground">
                <p>You may qualify for a tax compromise if:</p>
                <ul className="list-disc pl-6 space-y-2">
                    <li>Your business has outstanding tax liabilities it cannot afford to pay.</li>
                    <li>There is a genuine risk of insolvency or liquidation if the full debt is enforced.</li>
                    <li>The compromise will offer a better return to the fiscus than liquidation.</li>
                    <li>You have a clean compliance history, apart from the debt in question.</li>
                </ul>
                <p>Our team will assess your financial situation to determine if you meet the criteria for a successful compromise application.</p>
            </CardContent>
        </Card>
      </section>

      <section className="bg-background py-16">
        <div className="container mx-auto px-4">
            <div className="text-center mb-12">
                <h2 className="text-3xl font-bold">The Benefits of a SARS Compromise</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                {benefits.map(benefit => (
                <div key={benefit.title} className="flex flex-col items-center text-center gap-4">
                    <div className="bg-primary/10 rounded-full h-16 w-16 flex items-center justify-center">
                        <benefit.icon className="h-8 w-8 text-primary" />
                    </div>
                    <div>
                        <h3 className="text-lg font-semibold">{benefit.title}</h3>
                        <p className="text-sm text-muted-foreground mt-1">{benefit.description}</p>
                    </div>
                </div>
                ))}
            </div>
        </div>
      </section>
      
      <section className="container mx-auto px-4 text-center">
        <h2 className="text-3xl font-bold">Ready to Resolve Your Tax Debt?</h2>
        <p className="text-muted-foreground mt-2 max-w-2xl mx-auto">
            Don't let tax debt cripple your business. Contact us today for a confidential consultation to explore your options.
        </p>
        <Button asChild size="lg" className="mt-8">
            <Link href="/contact">Get Help Now</Link>
        </Button>
      </section>
    </div>
  );
}
