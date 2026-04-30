'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { CheckCircle, ShieldCheck, Scale, FileText, Gavel, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import TrustIndexWidget from '@/components/shared/TrustIndexWidget';

export default function SarsDisputesPageClient() {
  const serviceIncludes = [
    'Analysis of the grounds for assessment',
    'Drafting of Section 104 Notice of Objection (NOO)',
    'Preparation of comprehensive supporting evidence',
    'Submission of Suspension of Payment requests',
    'Managing Notice of Appeal (NOA) where necessary',
    'Representation in Alternative Dispute Resolution (ADR)',
  ];

  const whyChooseUs = [
    {
      title: 'Procedural Experts',
      description: 'Experts in Tax Administration Act procedures.',
      icon: <Gavel className="h-4 w-4" />,
    },
    {
      title: 'Strong Arguments',
      description: 'Legally sound, merit-based motivations.',
      icon: <FileText className="h-4 w-4" />,
    },
    {
      title: 'Risk Management',
      description: 'Strategic advice on when to settle or fight.',
      icon: <ShieldCheck className="h-4 w-4" />,
    },
    {
      title: 'Results Driven',
      description: 'Proven track record in successful objections.',
      icon: <Scale className="h-4 w-4" />,
    },
  ];

  const disputeSteps = [
    {
        title: 'Step 1: Notice of Objection (NOO)',
        content: `Under Section 104, if you disagree with a SARS assessment, you must lodge an objection.
- Must be lodged within 80 days of the assessment.
- Must clearly state the grounds for the objection.
- Must include all relevant supporting documentation.

📌 Missing the 80-day deadline requires a separate application for Condonation based on "Reasonable Grounds".`
    },
    {
        title: 'Step 2: Suspension of Payment',
        content: `Lodging an objection does NOT automatically stop SARS from collecting the debt.
- We apply for a formal "Suspension of Payment".
- This prevents SARS from using third-party appointments (bank sweeps) while the dispute is active.
- SARS considers the risk of dissipation of assets when deciding.`
    },
    {
        title: 'Step 3: SARS Decision',
        content: `SARS must decide on the objection (Allow, Disallow, or Partially Allow).
- If allowed, the assessment is corrected and the debt removed.
- If disallowed, the next step is a formal Appeal.`
    },
    {
        title: 'Step 4: Notice of Appeal (NOA)',
        content: `If an objection is disallowed, you have 30 days to lodge an appeal.
- This leads to Alternative Dispute Resolution (ADR) or the Tax Board/Court.
- Most cases are resolved during the ADR stage through negotiation.`
    }
  ];

  return (
    <div className="space-y-16 pb-16">
      <section className="bg-background">
        <div className="container mx-auto px-4 py-16 text-center">
          <h1 className="text-4xl font-bold tracking-tight md:text-5xl lg:text-6xl">
            SARS <span className="text-gradient">#Disputes</span> & Objections
          </h1>
           <p className="mt-6 text-lg text-muted-foreground max-w-3xl mx-auto">
            Challenge incorrect assessments legally. Don't pay for SARS errors. If you have received an assessment that is factually incorrect or based on a misinterpretation of tax law, you have the legal right to dispute it.
          </p>
          <Button asChild size="lg" className="mt-8">
            <Link href="/contact">Challenge My Assessment</Link>
          </Button>
        </div>
      </section>

      <TrustIndexWidget />

       <section className="bg-slate-50 py-16">
        <div className="container mx-auto px-4">
            <div className="text-center mb-12">
                <h2 className="text-3xl font-bold">What Our Dispute Service Includes</h2>
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
            <h2 className="text-3xl font-bold">The SARS Dispute Process</h2>
        </div>
         <Accordion type="single" collapsible className="w-full">
            {disputeSteps.map((step, index) => (
              <AccordionItem key={index} value={`item-${index}`}>
                <AccordionTrigger className="text-left font-semibold">{step.title}</AccordionTrigger>
                <AccordionContent className="whitespace-pre-line text-muted-foreground text-sm leading-relaxed">{step.content}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
      </section>
      
        <section className="container mx-auto px-4">
            <Card className="max-w-3xl mx-auto border-destructive/20 bg-destructive/5">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-destructive">
                        <AlertCircle className="h-5 w-5" />
                        Important: The "Pay Now, Argue Later" Rule
                    </CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-destructive-foreground opacity-90 leading-relaxed">
                    <p>
                        SARS generally operates on the principle that tax must be paid even if it is under dispute. To avoid SARS collecting funds from your bank account, we formally apply for a Suspension of Payment as part of our service.
                    </p>
                </CardContent>
            </Card>
        </section>

      <section className="container mx-auto px-4 text-center">
        <h2 className="text-3xl font-bold">Unfair SARS Assessment?</h2>
        <Button asChild size="lg" className="mt-8">
            <Link href="/contact">Book a Consultation</Link>
        </Button>
      </section>
    </div>
  );
}
