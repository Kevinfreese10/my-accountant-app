
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle, ShieldCheck, Scale, Users, FileText } from 'lucide-react';
import Link from 'next/link';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Company Liquidations',
  description: 'Professional assistance with voluntary company liquidations in South Africa. Close your business legally and responsibly with expert guidance from My Accountant.',
};

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

  return (
    <div className="space-y-16 pb-16">
      <section className="bg-background">
        <div className="container mx-auto px-4 py-16 text-center">
          <h1 className="text-4xl font-bold tracking-tight md:text-5xl lg:text-6xl">
            Company <span className="text-gradient">#Liquidations</span>
          </h1>
          <p className="mt-6 text-lg text-muted-foreground max-w-3xl mx-auto">
            Closing a business is a difficult decision. We provide expert guidance through the voluntary liquidation process to ensure it's done legally, responsibly, and with minimal stress.
          </p>
          <Button asChild size="lg" className="mt-8">
            <Link href="/contact">Get Professional Advice</Link>
          </Button>
        </div>
      </section>

       <section className="container mx-auto px-4">
        <div className="text-center mb-12">
            <h2 className="text-3xl font-bold">When is Liquidation the Right Choice?</h2>
            <p className="text-muted-foreground mt-2 max-w-2xl mx-auto">
              Voluntary liquidation is a formal process to wind up a solvent or insolvent company that is no longer trading.
            </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <Card>
                <CardHeader>
                    <CardTitle>Solvent Companies</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-muted-foreground">
                   <p>Even if your company can pay its debts, you may choose to liquidate if:</p>
                   <ul className="list-disc pl-6 space-y-1">
                       <li>The directors are retiring.</li>
                       <li>The company has served its purpose.</li>
                       <li>You wish to extract capital from the business.</li>
                   </ul>
                </CardContent>
            </Card>
             <Card>
                <CardHeader>
                    <CardTitle>Insolvent Companies</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-muted-foreground">
                   <p>If your company cannot pay its debts, liquidation is a legal necessity to:</p>
                   <ul className="list-disc pl-6 space-y-1">
                       <li>Prevent further debt and trading recklessly.</li>
                       <li>Ensure fair treatment of creditors.</li>
                       <li>Formally and legally close the company's affairs.</li>
                   </ul>
                </CardContent>
            </Card>
        </div>
      </section>

      <section className="bg-background py-16">
        <div className="container mx-auto px-4">
            <div className="text-center mb-12">
                <h2 className="text-3xl font-bold">Our Liquidation Process</h2>
                <p className="text-muted-foreground mt-2 max-w-2xl mx-auto">
                    We guide you through every step of the process.
                </p>
            </div>
            <div className="relative">
                <div aria-hidden="true" className="absolute hidden md:block w-0.5 h-full bg-border left-1/2 -translate-x-1/2"></div>
                 <div className="space-y-12 md:space-y-0 md:grid md:grid-cols-2 md:gap-x-8 md:gap-y-12">
                    {processSteps.map((step, index) => (
                    <div key={step.title} className={`flex items-start gap-4 ${index % 2 === 1 ? 'md:flex-row-reverse md:text-right' : ''}`}>
                        <div className="flex-shrink-0 bg-primary text-primary-foreground h-10 w-10 rounded-full flex items-center justify-center font-bold text-lg">{index + 1}</div>
                        <div>
                            <h3 className="text-lg font-semibold">{step.title}</h3>
                            <p className="text-sm text-muted-foreground">{step.description}</p>
                        </div>
                    </div>
                    ))}
                 </div>
            </div>
        </div>
      </section>
      
      <section className="container mx-auto px-4 text-center">
        <h2 className="text-3xl font-bold">Need to Close Your Company?</h2>
        <p className="text-muted-foreground mt-2 max-w-2xl mx-auto">
            Let us handle the complexities of liquidation so you can move forward with confidence.
        </p>
        <Button asChild size="lg" className="mt-8">
            <Link href="/contact">Book a Consultation</Link>
        </Button>
      </section>
    </div>
  );
}
