'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Rocket, ShieldCheck, Wallet, UserCheck, Cpu, Briefcase, Users, FileText, Bot, GraduationCap, CheckCircle2, ArrowRight, Wallet2, Sparkles, Globe, HeartHandshake, Percent, ClipboardList, TrendingUp, ExternalLink, AlertCircle, Zap, ShieldAlert, BarChart3, LayoutDashboard, LifeBuoy } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import WebsiteAIWidget from '@/components/shared/WebsiteAIWidget';
import dynamic from 'next/dynamic';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

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
        description: 'Get 25% off My Accountant service fees (excl. 3rd party costs). Enjoy high margins while offering competitive pricing.',
    },
    {
        icon: <LayoutDashboard className="h-6 w-6 text-primary" />,
        title: 'Reseller Dashboard',
        description: 'Access your dedicated reseller dashboard to create and manage client orders, track progress in real time, and outsource orders directly through a secure platform.',
    },
    {
        icon: <Users className="h-6 w-6 text-primary" />,
        title: 'Outsourcing Opportunities',
        description: 'Join a growing pool of bookkeepers and accountants who share work through the BEI network. Take on client work from other members and refer clients.',
    },
    {
        icon: <ShieldCheck className="h-6 w-6 text-primary" />,
        title: 'Seamless Outsourcing (White-Label Model)',
        description: 'We communicate with you — you communicate with your client. Deliverables are sent to you, ensuring you remain the sole point of contact.',
    },
    {
        icon: <GraduationCap className="h-6 w-6 text-primary" />,
        title: 'Mentorship & Training',
        description: 'Get practical guidance from experienced accountants. Join monthly training webinars and Q&A sessions to help you price, sell, and manage effectively.',
    },
    {
        icon: <FileText className="h-6 w-6 text-primary" />,
        title: 'Document Templates & Compliance Tools',
        description: 'Save time with professional templates for engagement letters, employment contracts, pricing schedules, and POPIA compliance documents.',
    },
    {
        icon: <LifeBuoy className="h-6 w-6 text-primary" />,
        title: 'Technical & Partner Support',
        description: 'Our technical team ensures your dashboard runs smoothly. You\'ll have access to support whenever you need help with your account or system setup.',
    },
    {
        icon: <ClipboardList className="h-6 w-6 text-primary" />,
        title: 'Client CRM & Automation',
        description: 'Automated task creation based on client needs (VAT, PAYE, etc.). Never miss a SARS or CIPC deadline again.',
    },
    {
        icon: <TrendingUp className="h-6 w-6 text-primary" />,
        title: 'Flexible Pricing Control',
        description: 'Edit your own selling prices on your landing page. Our wholesale costs remain fixed, giving you full control over profit.',
    },
  ];

  const challenges = [
    {
        title: 'Limited Service Range',
        description: 'Offering only bookkeeping services limits your earning potential. Through BEI, you can sell My Accountant’s full suite of services — from company registration to VAT, COIDA, CIDB, NCR, and more.',
        icon: Briefcase
    },
    {
        title: 'Lack of Mentorship',
        description: 'Many bookkeepers work alone, with no guidance from experienced professionals. We provide mentorship from senior accountants and industry experts who help you grow your confidence and capabilities.',
        icon: GraduationCap
    },
    {
        title: 'Technology Gaps',
        description: 'Without proper systems, managing clients and documents becomes messy. You get access to our cloud-based reseller dashboard to manage, track, and outsource client orders seamlessly.',
        icon: Cpu
    },
    {
        title: 'Capacity Constraints',
        description: 'Handling large clients or complex projects alone isn’t easy. We’re a qualified team of accountants and tax professionals — when you outsource overflow work to us, it’s handled securely, accurately, and on time.',
        icon: Users
    },
    {
        title: 'Compliance Overwhelm',
        description: 'Complex tax and statutory rules can deter small practitioners from taking on advanced clients. We provide ready-to-use templates, compliance guides, and ongoing training to help you stay compliant and confident.',
        icon: ShieldAlert
    }
  ]

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
            <h2 className="mt-6 text-2xl md:text-3xl font-bold text-slate-800 uppercase tracking-tighter italic">Scale Your Practice with AI and Expert Back-Office Support</h2>
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

      {/* About the Initiative */}
      <section className="container mx-auto px-4 scroll-m-20">
        <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
                <Badge className="bg-primary/10 text-primary hover:bg-primary/10 border-none px-4 py-1 text-xs font-bold uppercase tracking-widest">About the Initiative</Badge>
                <h2 className="text-4xl font-bold leading-tight">A Modern Engine for Modern Bookkeepers</h2>
                <p className="text-lg text-muted-foreground leading-relaxed">
                    The Bookkeeper Empowerment Initiative (BEI) is a pioneering program designed to solve the two biggest hurdles for South African independent practitioners: <strong>Capacity</strong> and <strong>Technology</strong>.
                </p>
                <p className="text-lg text-muted-foreground leading-relaxed">
                    We provide you with a fully white-labeled service platform, AI-powered automation tools, and an expert back-office team that fulfills orders under your brand. You keep the client, you set the price, we provide the power.
                </p>
            </div>
            <div className="relative aspect-video rounded-2xl overflow-hidden shadow-2xl border-8 border-white">
                <img 
                    src="https://picsum.photos/seed/bei-about/800/600" 
                    alt="Accounting Team" 
                    className="object-cover w-full h-full"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-end p-6">
                    <div className="flex items-center gap-3 text-white">
                        <CheckCircle2 className="h-6 w-6 text-green-400" />
                        <span className="font-bold">Over 150 Practices Empowered</span>
                    </div>
                </div>
            </div>
        </div>
      </section>

      {/* Challenges Section */}
      <section className="bg-slate-50 py-24 border-y">
        <div className="container mx-auto px-4">
            <div className="text-center mb-16 space-y-4">
                <h2 className="text-3xl font-bold tracking-tight">The Challenges We're Solving</h2>
                <p className="text-muted-foreground max-w-2xl mx-auto">We built the BEI because we know what it's like to run a growing practice in South Africa.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {challenges.map((item, idx) => (
                    <Card key={idx} className="border-none shadow-none bg-transparent text-center space-y-4">
                        <div className="mx-auto h-16 w-16 rounded-full bg-white shadow-sm border flex items-center justify-center">
                            <item.icon className="h-8 w-8 text-primary" />
                        </div>
                        <div className="space-y-2">
                            <h3 className="font-bold text-lg">{item.title}</h3>
                            <p className="text-sm text-muted-foreground leading-relaxed px-4">{item.description}</p>
                        </div>
                    </Card>
                ))}
            </div>
        </div>
      </section>

      {/* Financial Model Section */}
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
      
      {/* Key Benefits Grid */}
      <section id="benefits" className="bg-white py-24 border-t border-b scroll-m-20">
        <div className="container mx-auto px-4">
            <div className="text-center mb-16">
                <h2 className="text-4xl font-bold tracking-tight">Key Benefits of Joining</h2>
                <p className="text-muted-foreground mt-4 max-w-2xl mx-auto">A modern back-office engine for your accounting firm, designed for maximum profitability.</p>
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

      <section id="ai-assistant" className="container mx-auto px-4 scroll-m-24 border-t pt-16">
        <WebsiteAIWidget />
      </section>
    </div>
  );
}
