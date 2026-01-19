
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { CheckCircle, ShieldCheck, Scale, Users, FileText, LifeBuoy } from 'lucide-react';
import Link from 'next/link';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'SARS Compromise of Debt',
  description: 'Explore your options for a SARS Compromise of Debt with My Accountant. We help you negotiate a settlement with SARS to resolve outstanding tax debt and get a fresh start.',
};

export default function SarsCompromisePage() {
  const serviceIncludes = [
    'Assessment of eligibility for Section 200',
    'Financial distress analysis',
    'Preparation of a legally compliant motivation',
    'Compilation of all SARS-required supporting documents',
    'Submission and engagement with SARS',
    'Ongoing support until SARS issues a decision',
  ];

  const whyChooseUs = [
    {
      title: 'Deep SARS Knowledge',
      description: 'Deep procedural knowledge.',
      icon: ShieldCheck,
    },
    {
      title: 'Experienced',
      description: 'Strong experience with distressed taxpayers.',
      icon: LifeBuoy,
    },
    {
      title: 'Clear Motivations',
      description: 'Structured motivations aligned to the Act.',
      icon: FileText,
    },
    {
      title: 'Honest Advice',
      description: 'Honest advice on likelihood of success.',
      icon: Scale,
    },
  ];

  const documentsRequired = [
    'ID / company registration documents',
    'Detailed statement of assets & liabilities',
    'Bank statements (usually 6–12 months)',
    'Latest financial statements or management accounts',
    'Income and expense breakdown',
    'Explanation of financial distress',
    'Proposed settlement amount and source of funds',
    'Confirmation of tax compliance submissions (even if unpaid)',
  ];

  const importantPoints = [
    'A Section 200 Compromise is not guaranteed.',
    'SARS expects absolute transparency.',
    'One-size-fits-all motivations do not work.',
    'Professional preparation significantly improves outcomes.',
    'Applying incorrectly can worsen enforcement action.',
  ];

  return (
    <div className="space-y-16 pb-16">
      <section className="bg-background">
        <div className="container mx-auto px-4 py-16 text-center">
          <h1 className="text-4xl font-bold tracking-tight md:text-5xl lg:text-6xl">
            SARS <span className="text-gradient">#Section 200</span> Compromise
          </h1>
           <p className="mt-6 text-lg text-muted-foreground max-w-3xl mx-auto">
            Settle Your Tax Debt Legally & Affordably. If you owe SARS money and cannot realistically pay the full amount, a Section 200 Compromise may allow you to legally settle your tax debt for less than what is owed.
          </p>
           <p className="mt-4 text-lg text-muted-foreground max-w-3xl mx-auto">
             At My Accountant, we assist individuals and businesses with preparing, motivating, and submitting S200–S205 Compromise Applications—ensuring they are technically correct, commercially realistic, and SARS-ready.
          </p>
          <Button asChild size="lg" className="mt-8">
            <Link href="/contact">Book a Free Consultation</Link>
          </Button>
        </div>
      </section>

      <section className="container mx-auto px-4">
        <div className="text-center mb-12">
            <h2 className="text-3xl font-bold">When Is a Compromise Appropriate?</h2>
            <p className="text-muted-foreground mt-2 max-w-2xl mx-auto">
              A Section 200 Compromise may be suitable if your tax debt has become unmanageable and full recovery by SARS is unlikely.
            </p>
        </div>
        <Card className="max-w-3xl mx-auto">
            <CardHeader>
                <CardTitle>A compromise may be suitable if:</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-muted-foreground">
                <ul className="list-disc pl-6 space-y-2">
                    <li>Your tax debt has become unmanageable.</li>
                    <li>SARS enforcement (e.g. third-party appointments, judgments) is imminent.</li>
                    <li>The business is at risk of closure or liquidation.</li>
                    <li>You cannot meet normal payment arrangements.</li>
                    <li>Full recovery by SARS is unlikely or uneconomical.</li>
                </ul>
            </CardContent>
        </Card>
      </section>

       <section className="bg-background py-16">
        <div className="container mx-auto px-4">
            <div className="text-center mb-12">
                <h2 className="text-3xl font-bold">What Our SARS Compromise Service Includes</h2>
                 <p className="text-muted-foreground mt-2 max-w-2xl mx-auto">
                    We don’t submit “hope letters” — we submit proper legal compromises.
                </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-4xl mx-auto">
                {serviceIncludes.map((item, index) => (
                <div key={index} className="flex items-start gap-4">
                    <div className="bg-primary/10 rounded-full h-10 w-10 flex items-center justify-center flex-shrink-0">
                         <CheckCircle className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                        <p className="font-medium">{item}</p>
                    </div>
                </div>
                ))}
            </div>
        </div>
      </section>

       <section className="container mx-auto px-4">
            <div className="text-center mb-12">
                <h2 className="text-3xl font-bold">Why Use My Accountant?</h2>
                 <p className="text-muted-foreground mt-2 max-w-2xl mx-auto">
                    We don’t sell time — we sell comfort.
                </p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
                {whyChooseUs.map((benefit) => (
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
      </section>

       <section className="container mx-auto px-4 max-w-4xl">
         <div className="text-center mb-12">
            <h2 className="text-3xl font-bold">SARS Section 200 to 205 Explained</h2>
            <p className="text-muted-foreground mt-2">(Tax Administration Act – Practical Requirements)</p>
        </div>
         <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="item-1">
                <AccordionTrigger>Section 200 – Compromise of Tax Debt</AccordionTrigger>
                <AccordionContent className="space-y-2">
                    <p>SARS may compromise a tax debt if:</p>
                    <ul className="list-disc pl-6 space-y-1">
                        <li>The taxpayer is in serious financial hardship</li>
                        <li>Recovery of the full amount is unlikely</li>
                        <li>The compromise is fair, equitable, and in the public interest</li>
                    </ul>
                    <p className="font-semibold pt-2">Key point: This is discretionary — SARS is not obliged to agree.</p>
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="item-2">
                <AccordionTrigger>Section 201 – Request for Compromise</AccordionTrigger>
                <AccordionContent className="space-y-2">
                    <p>The taxpayer must:</p>
                    <ul className="list-disc pl-6 space-y-1">
                        <li>Apply voluntarily</li>
                        <li>Submit the request in the prescribed form</li>
                        <li>Disclose full and honest financial information</li>
                    </ul>
                    <p className="font-semibold pt-2">Any false or misleading information will result in automatic rejection.</p>
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="item-3">
                <AccordionTrigger>Section 202 – Information Required by SARS</AccordionTrigger>
                <AccordionContent className="space-y-2">
                    <p>SARS may require:</p>
                    <ul className="list-disc pl-6 space-y-1">
                        <li>Full statement of assets and liabilities</li>
                        <li>Income and expenditure details</li>
                        <li>Bank statements</li>
                        <li>Business financials (if applicable)</li>
                        <li>Details of connected persons and entities</li>
                        <li>Explanation of how the debt arose</li>
                        <li>Proposed compromise amount and basis</li>
                    </ul>
                    <p className="font-semibold pt-2">Full disclosure is mandatory.</p>
                </AccordionContent>
              </AccordionItem>
               <AccordionItem value="item-4">
                <AccordionTrigger>Section 203 – Evaluation by SARS</AccordionTrigger>
                <AccordionContent className="space-y-2">
                    <p>SARS will consider:</p>
                    <ul className="list-disc pl-6 space-y-1">
                        <li>The taxpayer’s ability to pay</li>
                        <li>Whether liquidation, sequestration, or judgment would recover more</li>
                        <li>Whether the compromise amount is commercially reasonable</li>
                        <li>Compliance history</li>
                        <li>Public interest and precedent risk</li>
                    </ul>
                    <p className="font-semibold pt-2">If SARS believes it can recover more via enforcement, the application will fail.</p>
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="item-5">
                <AccordionTrigger>Section 204 – Effect of Accepted Compromise</AccordionTrigger>
                <AccordionContent className="space-y-2">
                    <p>Once accepted:</p>
                    <ul className="list-disc pl-6 space-y-1">
                        <li>The agreed amount becomes legally payable</li>
                        <li>Remaining debt is written off</li>
                        <li>The compromise replaces the original tax liability</li>
                        <li>Non-compliance with the compromise terms voids the agreement</li>
                    </ul>
                    <p className="font-bold pt-2">The compromise is final and binding.</p>
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="item-6">
                <AccordionTrigger>Section 205 – Invalid or Void Compromises</AccordionTrigger>
                <AccordionContent className="space-y-2">
                    <p>A compromise becomes invalid if:</p>
                    <ul className="list-disc pl-6 space-y-1">
                        <li>Information was false or incomplete</li>
                        <li>The taxpayer fails to meet the agreed terms</li>
                        <li>Fraud or misrepresentation is later discovered</li>
                    </ul>
                    <p className="pt-2">In such cases:</p>
                    <ul className="list-disc pl-6 space-y-1">
                        <li>SARS may reinstate the full original debt</li>
                        <li>Enforcement action may resume immediately</li>
                    </ul>
                </AccordionContent>
              </AccordionItem>
          </Accordion>
      </section>

      <section className="container mx-auto px-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <Card>
                    <CardHeader>
                        <CardTitle>Important Things to Know Before Applying</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-muted-foreground">
                        <ul className="list-disc pl-6 space-y-2">
                           {importantPoints.map((point, index) => <li key={index}>{point}</li>)}
                        </ul>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader>
                        <CardTitle>Typical Documents Required</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-muted-foreground">
                        <p>While each case differs, SARS usually requires:</p>
                        <ul className="list-disc pl-6 space-y-1">
                            {documentsRequired.map((doc, index) => <li key={index}>{doc}</li>)}
                        </ul>
                    </CardContent>
                </Card>
            </div>
        </section>

      <section className="container mx-auto px-4 text-center">
        <h2 className="text-3xl font-bold">Need Help With a SARS Compromise?</h2>
        <p className="text-muted-foreground mt-2 max-w-2xl mx-auto">
            If you’re facing serious tax debt and need a realistic, lawful solution, speak to My Accountant before SARS escalates enforcement. Contact us today for a confidential assessment of your Section 200 Compromise eligibility.
        </p>
        <Button asChild size="lg" className="mt-8">
            <Link href="/contact">Contact Us For A Confidential Assessment</Link>
        </Button>
      </section>
    </div>
  );
}
