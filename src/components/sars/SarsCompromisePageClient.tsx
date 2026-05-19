'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { CheckCircle, ShieldCheck, Scale, FileText, LifeBuoy } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import TrustIndexWidget from '@/components/shared/TrustIndexWidget';

export default function SarsCompromisePageClient() {
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

  const keywordButtons = [
    { label: 'Entity Registrations', href: '/products#entity-registrations' },
    { label: 'SARS Services', href: '/products#sars-services' },
    { label: 'CIPC Services', href: '/products#cipc-services' },
    { label: 'Accounting Services', href: '/products#accounting-services' },
    { label: 'Payroll Services', href: '/products#payroll-services' },
  ];

  return (
    <div className="space-y-16 pb-16 bg-white">
      {/* HERO SECTION */}
      <section className="relative w-full overflow-hidden bg-white pt-16 lg:pt-24 pb-20 border-b">
        <div className="container relative z-10 mx-auto px-4 text-center">
          <h1 className="mb-6 text-4xl font-black tracking-tight text-slate-900 md:text-5xl lg:text-6xl">
            SARS <span className="text-primary">#Section 200</span> Compromise
          </h1>
          <p className="text-lg sm:text-xl md:text-2xl font-medium text-muted-foreground max-w-3xl mx-auto">
            Settle Your Tax Debt Legally & Affordably. If you owe SARS money and cannot realistically pay the full amount, a Section 200 Compromise may allow you to settle for less.
          </p>
          <div className="flex flex-col gap-4 sm:flex-row sm:justify-center pt-4">
            <Button asChild size="lg" className="font-bold px-10 shadow-xl">
                <Link href="/contact">Book a Free Consultation</Link>
            </Button>
          </div>
          <div className="flex flex-wrap justify-center gap-3 pt-6">
            {keywordButtons.map((btn) => (
              <Button key={btn.label} asChild variant="outline" className="h-9 md:h-11 px-4 md:px-6 rounded-full font-bold transition-all text-xs md:text-sm">
                <Link href={btn.href}>{btn.label}</Link>
              </Button>
            ))}
          </div>
        </div>
      </section>

      <TrustIndexWidget />

      <section className="container mx-auto px-4 bg-white">
        <div className="text-center mb-12">
            <h2 className="text-3xl font-bold">When Is a Compromise Appropriate?</h2>
        </div>
        <Card className="max-w-xl mx-auto mt-4 text-left border-2 bg-slate-50 shadow-sm">
            <CardHeader>
                <CardTitle>A compromise may be suitable if:</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-muted-foreground">
                <ul className="list-disc pl-6 space-y-2 text-sm">
                    <li>Your tax debt has become unmanageable.</li>
                    <li>SARS enforcement is imminent.</li>
                    <li>The business is at risk of closure or liquidation.</li>
                    <li>You cannot meet normal payment arrangements.</li>
                    <li>Full recovery by SARS is unlikely or uneconomical.</li>
                </ul>
            </CardContent>
        </Card>
      </section>

       <section className="py-16 bg-white border-t border-b">
        <div className="container mx-auto px-4">
            <div className="text-center mb-12">
                <h2 className="text-3xl font-bold">What Our Service Includes</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-4xl mx-auto">
                {serviceIncludes.map((item, index) => (
                <div key={index} className="flex items-start gap-4 p-4 bg-slate-50 rounded-xl border border-slate-100 shadow-sm">
                    <div className="bg-primary/10 rounded-full h-10 w-10 flex items-center justify-center flex-shrink-0">
                         <CheckCircle className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                        <p className="font-medium text-sm leading-relaxed">{item}</p>
                    </div>
                </div>
                ))}
            </div>
        </div>
      </section>

       <section className="container mx-auto px-4 max-w-4xl bg-white">
         <div className="text-center mb-12">
            <h2 className="text-3xl font-bold">SARS Section 200 to 205 Explained</h2>
        </div>
         <Accordion type="single" collapsible className="w-full space-y-4">
            {sarsSections.map((section, index) => (
              <AccordionItem key={index} value={`item-${index}`} className="bg-slate-50 border rounded-xl px-4 shadow-sm overflow-hidden">
                <AccordionTrigger className="text-left font-semibold hover:no-underline">{section.title}</AccordionTrigger>
                <AccordionContent className="whitespace-pre-line text-muted-foreground text-sm leading-relaxed pb-4">{section.content}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
      </section>
      
       <section className="py-24 bg-white border-t">
         <div className="container mx-auto px-4 max-w-4xl">
            <div className="text-center mb-12">
                <h2 className="text-3xl font-bold">When You Cannot Enter Into a SARS Section 200 Compromise</h2>
            </div>
            <Accordion type="single" collapsible className="w-full space-y-4">
                {whenYouCannot.map((item, index) => (
                <AccordionItem key={index} value={`item-cannot-${index}`} className="bg-slate-50 border rounded-xl px-4 shadow-sm overflow-hidden">
                    <AccordionTrigger className="text-left font-semibold hover:no-underline">{item.title}</AccordionTrigger>
                    <AccordionContent className="whitespace-pre-line text-muted-foreground text-sm leading-relaxed pb-4">{item.content}</AccordionContent>
                </AccordionItem>
                ))}
            </Accordion>
         </div>
      </section>

      <section className="container mx-auto px-4 text-center bg-white">
        <h2 className="text-3xl font-bold">Need Help With a SARS Compromise?</h2>
        <Button asChild size="lg" className="mt-8 shadow-lg">
            <Link href="/contact">Contact Us For A Confidential Assessment</Link>
        </Button>
      </section>
    </div>
  );
}
