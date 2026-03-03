'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Rocket, ShieldCheck, Wallet, UserCheck, Cpu, Briefcase, Users, FileText, Bot, GraduationCap, CheckCircle2, ArrowRight, Wallet2, Sparkles, Globe, HeartHandshake, Percent, ClipboardList, TrendingUp, ExternalLink } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import WebsiteAIWidget from '@/components/shared/WebsiteAIWidget';
import dynamic from 'next/dynamic';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const TrustIndexWidget = dynamic(() => import('@/components/shared/TrustIndexWidget'), {
  ssr: false,
});

const FaqSection = () => {
    const faqs = [
    {
        question: "Who should join the Bookkeeper Empowerment Initiative?",
        answer: "BEI is ideal for passionate professionals who want to grow their business without stress, including:\n- Freelance Bookkeepers\n- Startup Accounting Firms\n- Tax Practitioners\n- Business Consultants\n- Payroll Administrators"
    },
    {
        question: "What does it cost to join?",
        answer: "Joining requires a R5000 setup fee (Incl. VAT). This is not a 'lost' fee — the entire amount is immediately converted into R5000 credits in your practice wallet.\n\nFrom these credits, a monthly subscription of R499 is deducted for app hosting, AI tools, and priority support."
    },
    {
        question: "How does the staff billing work?",
        answer: "Every practice gets 3 free additional staff user accounts (4 total users including the owner). Any staff members added beyond this limit cost only R45 per month."
    },
    {
        question: "How does the credit system work?",
        answer: "Think of it like a prepaid mobile account. Your initial R5000 setup fee provides you with R5000 in starting credits. Your monthly subscription (R499) and any outsourced services are deducted from this balance. Once your credits are finished, you can top up your wallet to keep your services active."
    },
    {
        question: "How does the landing page work?",
        answer: "Included in your setup is a fully customizable, white-labeled landing page. You can choose your colors, upload your logo, and use our AI to re-brand our 50+ services as your own. Your clients see your brand, while we provide the back-office engine."
    },
    {
        question: "Do I need to be a registered accountant?",
        answer: "No. Everyone is welcome. However, to receive outsourced work from My Accountant, you must belong to a recognized professional accounting or tax body such as SAICA, SAIT, CIBA, or SAIPA."
    }
  ];

  return (
      <section className="container mx-auto px-4 max-w-4xl py-12">
         <div className="text-center mb-12">
            <h2 className="text-3xl font-bold">Frequently Asked Questions</h2>
        </div>
         <Accordion type="single" collapsible className="w-full">
            {faqs.map((faq, index) => (
              <AccordionItem key={index} value={`item-${index}`}>
                <AccordionTrigger className="text-left font-semibold">{faq.question}</AccordionTrigger>
                <AccordionContent className="whitespace-pre-line text-muted-foreground leading-relaxed">{faq.answer}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
      </section>
  )
}

const DynamicFaqSection = dynamic(() => Promise.resolve(FaqSection), {
    ssr: false,
});


export default function BecomeAPartnerPage() {

  const benefits = [
    {
        icon: <Percent className="h-6 w-6 text-primary" />,
        title: '25% Partner Discount',
        description: 'Get 25% off our standard service pricing (excluding 3rd party costs like CIPC fees). High margins for your practice.',
    },
    {
        icon: <HeartHandshake className="h-6 w-6 text-primary" />,
        title: 'White-Label Outsourcing',
        description: 'Our back-office fulfills orders under your brand. All client communication uses your identity.',
    },
    {
        icon: <ClipboardList className="h-6 w-6 text-primary" />,
        title: 'Client CRM & Automation',
        description: 'Automated task creation based on client needs (VAT, PAYE, etc.). Never miss a compliance deadline.',
    },
    {
        icon: <Users className="h-6 w-6 text-primary" />,
        title: 'Staff Management Module',
        description: 'Assign tasks to your team, track progress, and manage internal workflows through a dedicated staff portal.',
    },
    {
        icon: <TrendingUp className="h-6 w-6 text-primary" />,
        title: 'Flexible Pricing Control',
        description: 'Edit your own selling prices on your landing page. Our costs remain fixed, giving you full control over your profit.',
    },
    {
        icon: <Globe className="h-6 w-6 text-primary" />,
        title: 'Custom Landing Page',
        description: 'Get a professional, white-labeled landing page to showcase your services. Fully customizable branding.',
    },
  ];

  return (
    <div className="space-y-16 pb-16">
      <section className="bg-white border-b relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full opacity-5 pointer-events-none">
            <div className="absolute top-10 left-10"><Bot size={120} /></div>
            <div className="absolute bottom-10 right-10"><Wallet size={120} /></div>
        </div>
        <div className="container mx-auto px-4 py-20 text-center relative z-10">
            <h1 className="text-4xl font-black tracking-tight md:text-6xl lg:text-7xl">
                Bookkeeper <span className="text-gradient">#Empowerment</span> Initiative
            </h1>
            <h2 className="mt-6 text-2xl md:text-3xl font-bold text-slate-800">Scale Your Practice with AI and Expert Back-Office Support</h2>
            <p className="mt-6 text-xl text-muted-foreground max-w-3xl mx-auto font-medium">
                Join the BEI network. R5000 Setup fee (fully returned as practice credits). 
                R499/month hosting & support. 3 Free Staff Members included.
            </p>
            <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
                <Button asChild size="lg" className="h-14 px-8 text-lg font-bold shadow-xl hover:scale-105 transition-transform">
                    <Link href="/partner-signup">Join the Initiative & Get R5000 Credits</Link>
                </Button>
                <Button asChild variant="outline" size="lg" className="h-14 px-8 text-lg border-2">
                    <Link href="/p/interscope" target="_blank">View Example Page <ExternalLink className="ml-2 h-4 w-4" /></Link>
                </Button>
            </div>
        </div>
      </section>

      <div className="container mx-auto px-4">
        <TrustIndexWidget />
      </div>

      <section className="container mx-auto px-4">
        <div className="max-w-4xl mx-auto">
            <div className="bg-primary/5 border-2 border-primary/10 rounded-3xl p-8 md:p-12 shadow-inner">
                <div className="flex flex-col md:flex-row gap-8 items-center">
                    <div className="bg-white p-6 rounded-2xl shadow-sm border text-center min-w-[240px]">
                        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2">Practice Setup</p>
                        <p className="text-4xl font-black text-primary">R5,000</p>
                        <Separator className="my-4" />
                        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2">Practice Credits</p>
                        <p className="text-4xl font-black text-green-600">R5,000</p>
                    </div>
                    <div className="space-y-4 text-center md:text-left">
                        <h2 className="text-3xl font-black italic uppercase tracking-tighter">Your Money, Working for Your Growth</h2>
                        <p className="text-lg text-muted-foreground leading-relaxed font-medium">
                            Your R5000 setup fee is immediately loaded into your <strong>Practice Wallet</strong> as credits. 
                        </p>
                        <p className="text-lg text-muted-foreground leading-relaxed font-medium">
                            We deduct your monthly subscription (R499) and any outsourced work from this balance. It covers your hosting, AI tools, and gives you a professional headstart.
                        </p>
                    </div>
                </div>
            </div>
        </div>
      </section>
      
      <section className="bg-white py-24 border-t border-b">
        <div className="container mx-auto px-4">
            <div className="text-center mb-16">
                <h2 className="text-4xl font-bold tracking-tight">Everything You Need to Scale</h2>
                <p className="text-muted-foreground mt-4 max-w-2xl mx-auto">A modern back-office engine for your accounting firm.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {benefits.map(benefit => (
                <div key={benefit.title} className="flex flex-col gap-4 p-8 bg-white rounded-2xl border border-border hover:border-primary/50 transition-colors shadow-sm">
                    <div className="h-12 w-12 rounded-lg bg-primary/5 flex items-center justify-center">
                        {benefit.icon}
                    </div>
                    <div>
                        <h3 className="text-xl font-bold">{benefit.title}</h3>
                        <p className="text-muted-foreground mt-2 text-sm leading-relaxed">{benefit.description}</p>
                    </div>
                </div>
                ))}
            </div>
        </div>
      </section>

      <DynamicFaqSection />
      
      <section className="container mx-auto px-4 text-center">
        <div className="max-w-2xl mx-auto space-y-8">
            <h2 className="text-4xl font-bold tracking-tight">Ready to Empower Your Practice?</h2>
            <p className="text-xl text-muted-foreground">
                Join the Bookkeeper Empowerment Initiative today and claim your R5000 in starting credits.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Button asChild size="lg" className="h-14 px-10 text-lg font-bold">
                    <Link href="/partner-signup">Sign Up & Claim Credits</Link>
                </Button>
                <Button asChild variant="outline" size="lg" className="h-14 px-10 text-lg border-2">
                    <Link href="/contact">Speak to a Consultant</Link>
                </Button>
            </div>
        </div>
      </section>

      <section id="ai-assistant" className="container mx-auto px-4 scroll-m-20 border-t pt-16">
        <WebsiteAIWidget />
      </section>
    </div>
  );
}
