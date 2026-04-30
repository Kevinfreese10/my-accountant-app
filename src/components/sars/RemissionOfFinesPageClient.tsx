'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { CheckCircle, ShieldCheck, Scale, FileText, BadgeDollarSign, FileWarning } from 'lucide-react';
import Link from 'next/link';
import TrustIndexWidget from '@/components/shared/TrustIndexWidget';

export default function RemissionOfFinesPageClient() {
  const serviceIncludes = [
    'Assessment of penalty type (Admin vs Understatement)',
    'Review of "Bona Fide" errors or extenuating circumstances',
    'Drafting of Request for Remission (RFR)',
    'Compilation of supporting documentation',
    'Follow-up with SARS Debt Management',
    'Advisory on preventing future penalties',
  ];

  const whyChooseUs = [
    {
      title: 'Penalty Specialists',
      description: 'Deep experience with SARS penalty codes.',
      icon: <FileWarning className="h-4 w-4" />,
    },
    {
      title: 'Cost Effective',
      description: 'Our fees are often a fraction of the savings.',
      icon: <BadgeDollarSign className="h-4 w-4" />,
    },
    {
      title: 'High Success Rate',
      description: 'Expertly drafted motivations yield better results.',
      icon: <CheckCircle className="h-4 w-4" />,
    },
    {
      title: 'Legal Alignment',
      description: 'Arguments aligned to Section 215-218.',
      icon: <Scale className="h-4 w-4" />,
    },
  ];

  const penaltySections = [
    {
        title: 'Administrative Non-Compliance Penalties',
        content: `These are fixed-amount penalties for failing to perform a duty, such as:
- Failure to submit a return on time.
- Failure to register when required.
- Failure to notify SARS of change of address.`
    },
    {
        title: 'Understatement Penalties (USP)',
        content: `These are percentage-based penalties (up to 200%) for:
- Omitting income from a return.
- Claiming incorrect deductions.
- Making a false statement to SARS.`
    },
    {
        title: 'The RFR Process',
        content: `1. Identify the penalty on the assessment.
2. Lodge a "Request for Remission" (RFR) via eFiling.
3. Provide a detailed motivation explaining why the penalty should be waived.`
    }
  ];

  return (
    <div className="space-y-16 pb-16">
      <section className="bg-background">
        <div className="container mx-auto px-4 py-16 text-center">
          <h1 className="text-4xl font-bold tracking-tight md:text-5xl lg:text-6xl">
            Remission of <span className="text-gradient">#Fines</span> & Penalties
          </h1>
           <p className="mt-6 text-lg text-muted-foreground max-w-3xl mx-auto">
            Get your tax penalties waived. SARS penalties can be aggressive, but they are not always final. If you have been hit with administrative or understatement penalties, you have the right to request a remission.
          </p>
          <Button asChild size="lg" className="mt-8">
            <Link href="/contact">Request a Penalty Review</Link>
          </Button>
        </div>
      </section>

      <TrustIndexWidget />

       <section className="bg-slate-50 py-16">
        <div className="container mx-auto px-4">
            <div className="text-center mb-12">
                <h2 className="text-3xl font-bold">Our Penalty Resolution Service</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-4xl mx-auto">
                {serviceIncludes.map((item, index) => (
                <div key={index} className="flex items-start gap-4">
                    <div className="bg-primary/10 rounded-full h-10 w-10 flex items-center justify-center flex-shrink-0">
                         <CheckCircle className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                        <p className="font-medium text-sm">{item}</p>
                    </div>
                </div>
                ))}
            </div>
        </div>
      </section>

       <section className="container mx-auto px-4 max-w-4xl">
         <div className="text-center mb-12">
            <h2 className="text-3xl font-bold">Understanding SARS Penalties</h2>
        </div>
         <Accordion type="single" collapsible className="w-full">
            {penaltySections.map((section, index) => (
              <AccordionItem key={index} value={`item-${index}`}>
                <AccordionTrigger className="text-left font-semibold">{section.title}</AccordionTrigger>
                <AccordionContent className="whitespace-pre-line text-muted-foreground text-sm leading-relaxed">{section.content}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
      </section>

      <section className="container mx-auto px-4 text-center">
        <h2 className="text-3xl font-bold">Are your SARS penalties unfair?</h2>
        <Button asChild size="lg" className="mt-8">
            <Link href="/contact">Talk to a Penalty Expert</Link>
        </Button>
      </section>
    </div>
  );
}
