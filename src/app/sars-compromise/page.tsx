'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { CheckCircle, ShieldCheck, Scale, Users, FileText, LifeBuoy } from 'lucide-react';
import Link from 'next/link';

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

  const sarsSections = [
    {
        title: 'Section 200 – Compromise of Tax Debt',
        content: `SARS may compromise a tax debt if:
- The taxpayer is in serious financial hardship
- Recovery of the full amount is unlikely
- The compromise is fair, equitable, and in the public interest

Key point:
👉 This is discretionary — SARS is not obliged to agree.`
    },
    {
        title: 'Section 201 – Request for Compromise',
        content: `The taxpayer must:
- Apply voluntarily
- Submit the request in the prescribed form
- Disclose full and honest financial information

Any false or misleading information = automatic rejection.`
    },
    {
        title: 'Section 202 – Information Required by SARS',
        content: `SARS may require:
- Full statement of assets and liabilities
- Income and expenditure details
- Bank statements
- Business financials (if applicable)
- Details of connected persons and entities
- Explanation of how the debt arose
- Proposed compromise amount and basis

👉 Full disclosure is mandatory.`
    },
    {
        title: 'Section 203 – Evaluation by SARS',
        content: `SARS will consider:
- The taxpayer’s ability to pay
- Whether liquidation, sequestration, or judgment would recover more
- Whether the compromise amount is commercially reasonable
- Compliance history
- Public interest and precedent risk

If SARS believes it can recover more via enforcement, the application will fail.`
    },
    {
        title: 'Section 204 – Effect of Accepted Compromise',
        content: `Once accepted:
- The agreed amount becomes legally payable
- Remaining debt is written off
- The compromise replaces the original tax liability
- Non-compliance with the compromise terms voids the agreement

👉 The compromise is final and binding.`
    },
    {
        title: 'Section 205 – Invalid or Void Compromises',
        content: `A compromise becomes invalid if:
- Information was false or incomplete
- The taxpayer fails to meet the agreed terms
- Fraud or misrepresentation is later discovered

In such cases:
- SARS may reinstate the full original debt
- Enforcement action may resume immediately`
    },
  ];

  const whenYouCannot = [
    {
        title: '1. Where SARS Can Recover the Full Debt',
        content: `You cannot enter into a compromise if SARS can reasonably recover the debt through:
- Instalment payment agreements
- Judgments
- Third-party appointments
- Liquidation or sequestration

📌 If enforcement is likely to recover more than the compromise offer, SARS must reject the application.`
    },
    {
        title: '2. Where the Taxpayer Is Not in Genuine Financial Distress',
        content: `A compromise is not allowed where:
- The taxpayer has sufficient income or assets
- The financial hardship is temporary
- Cash flow constraints are short-term
- Assets could be sold without severe hardship

👉 A compromise is reserved for severe, long-term distress.`
    },
    {
        title: '3. Where There Is Dishonesty or Non-Disclosure',
        content: `SARS will not enter into a compromise if:
- Information was false, misleading, or incomplete
- Assets or income are concealed
- There is failure to disclose connected parties
- The taxpayer is not fully transparent

📌 Even after approval, non-disclosure can void the compromise under Section 205.`
    },
    {
        title: '4. Where the Tax debt Arose From Fraud or Intentional Tax Evasion',
        content: `You cannot enter into a compromise if the debt is linked to:
- Fraud
- Intentional tax evasion
- Falsified returns
- Fabricated supporting documents

📌 SARS policy is extremely strict where intentional misconduct is present.`
    },
    {
        title: '5. Where the Taxpayer Is Non-Compliant With Submissions',
        content: `SARS will not consider a compromise if:
- Returns are outstanding (even if unpaid)
- Compliance obligations are ignored
- The taxpayer refuses to regularise submissions

👉 All returns must be submitted before SARS will evaluate a compromise.`
    },
    {
        title: '6. Where the Application Is Used to Delay Enforcement',
        content: `A compromise is not permitted where:
- The application is submitted solely to delay collections
- There is no genuine settlement intent
- The offer is unrealistic or speculative

📌 SARS actively screens for abusive or tactical applications.`
    },
    {
        title: '7. Where the Proposed Offer Is Not Commercially Reasonable',
        content: `SARS will reject the compromise if:
- The offer is materially below what SARS could recover
- No credible funding source exists
- The offer lacks a rational basis

👉 SARS requires a realistic, defensible offer, not a “best-case wish”.`
    },
    {
        title: '8. Where the Taxpayer Has a History of Repeat Non-Compliance',
        content: `A compromise is unlikely or unavailable if:
- The taxpayer has repeated defaults
- Previous arrangements were breached
- There is a pattern of ignoring SARS obligations

📌 Compliance history weighs heavily in SARS’s decision.`
    },
    {
        title: '9. Where the Compromise Would Undermine Public Interest',
        content: `SARS will not enter into a compromise if:
- It creates a negative precedent
- It undermines voluntary compliance
- It is inconsistent with fairness to compliant taxpayers`
    }
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
        <Card className="max-w-xl mx-auto mt-4 text-left">
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
            {sarsSections.map((section, index) => (
              <AccordionItem key={index} value={`item-${index}`}>
                <AccordionTrigger className="text-left">{section.title}</AccordionTrigger>
                <AccordionContent className="whitespace-pre-line">{section.content}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
      </section>
      
       <section className="container mx-auto px-4 max-w-4xl">
         <div className="text-center mb-12">
            <h2 className="text-3xl font-bold">When You Cannot Enter Into a SARS Section 200 Compromise</h2>
            <p className="text-muted-foreground mt-2">A Section 200 Compromise is an exceptional remedy, not a right. SARS will not consider or will reject a compromise application in the following circumstances:</p>
        </div>
         <Accordion type="single" collapsible className="w-full">
            {whenYouCannot.map((item, index) => (
              <AccordionItem key={index} value={`item-cannot-${index}`}>
                <AccordionTrigger className="text-left">{item.title}</AccordionTrigger>
                <AccordionContent className="whitespace-pre-line">{item.content}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
      </section>

      <section className="container mx-auto px-4 text-center">
        <h2 className="text-3xl font-bold">Need Help With a SARS Compromise?</h2>
        <p className="text-muted-foreground mt-2 max-w-2xl mx-auto">
            If you’re facing serious tax debt and need a realistic, lawful solution, speak to My Accountant before SARS escalates enforcement.
        </p>
        <Button asChild size="lg" className="mt-8">
            <Link href="/contact">Contact Us For A Confidential Assessment</Link>
        </Button>
      </section>
    </div>
  );
}
