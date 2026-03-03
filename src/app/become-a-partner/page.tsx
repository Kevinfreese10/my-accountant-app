'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Rocket, ShieldCheck, Wallet, UserCheck, Cpu, Briefcase, Users, FileText, Bot, GraduationCap, CheckCircle2, ArrowRight, Wallet2, Sparkles } from 'lucide-react';
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
        answer: "Joining requires a R5000 setup fee (Incl. VAT). This is not a 'lost' fee — the entire amount is immediately converted into R5000 credits in your practice wallet.\n\nYou can use these credits towards monthly AI Accountant subscriptions for your clients or paying for outsourced compliance services. There are no hidden monthly admin fees."
    },
    {
        question: "How does the credit system work?",
        answer: "Think of it like a prepaid mobile account. Your initial R5000 setup fee provides you with R5000 in starting credits. When you outsource a service or activate an AI Accountant subscription, the cost is deducted from your balance. Once your credits are finished, you can top up your wallet with any custom amount to keep your services active."
    },
    {
        question: "How does outsourcing work?",
        answer: "We communicate with you — you communicate with your client. All updates, queries, and deliverables are sent directly to you, ensuring that you remain the sole point of contact. Your clients never know the service has been outsourced, ensuring total confidentiality and trust."
    },
    {
        question: "Do I need to be a registered accountant?",
        answer: "No. Everyone is welcome — including business owners who do not work in the accounting or tax space but would like to offer these services to their clients.\n\nHowever, to qualify for opportunities where My Accountant outsources work back to you, you must belong to a recognized professional accounting or tax body such as SAICA, SAIT, CIBA, or SAIPA. This ensures we maintain consistent quality and professional standards across all network work."
    },
    {
        question: "How do I get support?",
        answer: "You’ll have access to a dedicated partner support team, mentorship network, and helpdesk through your dashboard."
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

  const challenges = [
    {
      title: 'Limited Service Range',
      description: 'Offering only bookkeeping services limits your earning potential.',
      icon: Briefcase,
      solution: "Through BEI, you can sell My Accountant’s full suite of services — from company registration to VAT, COIDA, CIDB, NCR, and more.",
    },
    {
      title: 'Lack of Mentorship',
      description: 'Many bookkeepers work alone, with no guidance from experienced professionals.',
      icon: GraduationCap,
      solution: 'We provide mentorship from senior accountants and industry experts who help you grow your confidence and capabilities.',
    },
    {
      title: 'Technology Gaps',
      description: 'Without proper systems, managing clients and documents becomes messy.',
      icon: Cpu,
      solution: 'You get access to our cloud-based reseller dashboard to manage, track, and outsource client orders seamlessly.',
    },
    {
      title: 'Capacity Constraints',
      description: 'Handling large clients or complex projects alone isn’t easy.',
      icon: Users,
      solution: 'We’re a qualified team of accountants and tax professionals — when you outsource overflow work to us, it’s handled securely, accurately, and on time.',
    },
     {
      title: 'Compliance Overwhelm',
      description: 'Complex tax and statutory rules can deter small practitioners from taking on advanced clients.',
      icon: ShieldCheck,
      solution: 'We provide ready-to-use templates, compliance guides, and ongoing training to help you stay compliant and confident.',
    },
  ];

  const benefits = [
    {
        icon: <Wallet2 className="h-6 w-6 text-primary" />,
        title: 'Credit-Based Model',
        description: 'Your R5000 setup fee is returned to you as R5000 in credits. Use these to pay for services as you grow, with no fixed monthly overheads.',
    },
    {
        icon: <Users className="h-6 w-6 text-primary" />,
        title: 'Reseller Dashboard',
        description: 'Access your dedicated reseller dashboard to create and manage client orders, track progress in real time, and outsource orders directly to My Accountant.',
    },
    {
        icon: <Sparkles className="h-6 w-6 text-primary" />,
        title: 'AI Branding Tool',
        description: 'Use our AI engine to automatically re-brand all 50+ My Accountant services with your own practice identity and custom pricing in seconds.',
    },
    {
        icon: <UserCheck className="h-6 w-6 text-primary" />,
        title: 'Seamless White-Labeling',
        description: 'We communicate with you — you communicate with your client. All deliverables are sent directly to you, preserving your brand authority.',
    },
    {
        icon: <GraduationCap className="h-6 w-6 text-primary" />,
        title: 'Mentorship & Training',
        description: 'Get practical guidance from experienced accountants. Join monthly training webinars and Q&A sessions to grow your capabilities.',
    },
    {
        icon: <FileText className="h-6 w-6 text-primary" />,
        title: 'Compliance Tools',
        description: 'Save time with professional templates for engagement letters, contracts, and onboarding forms, all available in your dashboard.',
    },
  ];

  return (
    <div className="space-y-16 pb-16">
      <section className="bg-background border-b relative overflow-hidden">
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
                Join the BEI network. R5000 Setup fee (fully returned as R5000 practice credits). 
                No fixed monthly fees. Grow at your own pace.
            </p>
            <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
                <Button asChild size="lg" className="h-14 px-8 text-lg font-bold shadow-xl hover:scale-105 transition-transform">
                    <Link href="/partner-signup">Join the Initiative & Get R5000 Credits</Link>
                </Button>
                <Button asChild variant="outline" size="lg" className="h-14 px-8 text-lg border-2">
                    <Link href="/login">Partner Portal Login</Link>
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
                        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2">Setup Fee</p>
                        <p className="text-4xl font-black text-primary">R5,000</p>
                        <Separator className="my-4" />
                        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2">Practice Credits</p>
                        <p className="text-4xl font-black text-green-600">R5,000</p>
                    </div>
                    <div className="space-y-4 text-center md:text-left">
                        <h2 className="text-3xl font-black italic uppercase tracking-tighter">The Credit-Based Growth Model</h2>
                        <p className="text-lg text-muted-foreground leading-relaxed font-medium">
                            We don't charge you to join — we help you fund your growth. Your R5000 setup fee is immediately loaded into your <strong>Practice Wallet</strong> as credits. 
                        </p>
                        <p className="text-lg text-muted-foreground leading-relaxed font-medium">
                            Use these credits to pay for AI Accountant subscriptions for your clients or to outsource complex compliance work to our team. It's your money, working for your practice.
                        </p>
                    </div>
                </div>
            </div>
        </div>
      </section>
      
      <section className="container mx-auto px-4">
        <div className="text-center mb-12">
            <h2 className="text-3xl font-bold tracking-tight">The Challenges We Solve</h2>
            <p className="text-muted-foreground mt-2">Why 150+ practitioners have joined the BEI network.</p>
        </div>
        <div className="space-y-12 max-w-4xl mx-auto">
            {challenges.map((challenge, index) => (
                <div key={challenge.title} className="group">
                    <div className="flex items-center gap-6">
                        <div className="bg-primary/10 rounded-2xl h-16 w-16 flex items-center justify-center flex-shrink-0 group-hover:bg-primary group-hover:text-white transition-colors duration-300">
                            <challenge.icon className="h-8 w-8 text-primary group-hover:text-white" />
                        </div>
                        <div className="space-y-1">
                            <h3 className="text-2xl font-bold tracking-tight">{challenge.title}</h3>
                            <p className="text-muted-foreground font-medium">{challenge.description}</p>
                        </div>
                    </div>
                    <div className="mt-4 ml-20 bg-green-50 border-l-4 border-green-500 p-4 rounded-r-lg">
                        <div className="flex gap-3">
                            <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0"/>
                            <p className="font-bold text-green-900 text-sm">{challenge.solution}</p>
                        </div>
                    </div>
                </div>
            ))}
        </div>
      </section>
      
      <section className="bg-background py-24">
        <div className="container mx-auto px-4">
            <div className="text-center mb-16">
                <h2 className="text-4xl font-bold tracking-tight">Why Partner With Us?</h2>
                <p className="text-muted-foreground mt-4 max-w-2xl mx-auto">Everything you need to run a modern, automated accounting firm.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {benefits.map(benefit => (
                <div key={benefit.title} className="flex flex-col gap-4 p-8 bg-card rounded-2xl border border-border hover:border-primary/50 transition-colors shadow-sm">
                    <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
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
