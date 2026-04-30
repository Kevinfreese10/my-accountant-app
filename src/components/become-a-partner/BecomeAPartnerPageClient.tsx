'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Rocket, ShieldCheck, Wallet, Bot, Cpu, Briefcase, Users, FileText, GraduationCap, CheckCircle2, ArrowRight, LayoutDashboard, LifeBuoy, Percent, TrendingUp, ShieldAlert, ClipboardList, ShoppingBag, CheckCircle, Globe, Scale, Loader2, ExternalLink } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import dynamicImport from 'next/dynamic';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { saveDemoLead } from '@/app/actions';

const TrustIndexWidget = dynamicImport(() => import('@/components/shared/TrustIndexWidget'), {
  ssr: false,
});

const demoFormSchema = z.object({
  name: z.string().min(2, "First name is required."),
  surname: z.string().min(2, "Surname is required."),
  email: z.string().email("A valid email is required."),
  cell: z.string().min(10, "A valid cell number is required."),
});

function BookDemoDialog() {
    const [isOpen, setIsOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const { toast } = useToast();
    
    const form = useForm<z.infer<typeof demoFormSchema>>({
        resolver: zodResolver(demoFormSchema),
        defaultValues: { name: '', surname: '', email: '', cell: '' },
    });

    const onSubmit = async (values: z.infer<typeof demoFormSchema>) => {
        setIsLoading(true);
        try {
            const res = await saveDemoLead(values);
            if (res.success) {
                toast({ title: "Request Sent!", description: "A consultant will contact you shortly to schedule your demo." });
                setIsOpen(false);
                form.reset();
            } else {
                toast({ title: "Submission Failed", variant: "destructive" });
            }
        } catch (e) {
            toast({ title: "Error", description: "An unexpected error occurred.", variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" size="lg" className="h-14 px-10 text-lg border-2 border-slate-200">
                    Book a demo
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="text-2xl font-bold">Book a Live Demo</DialogTitle>
                    <DialogDescription>
                        Enter your details and our team will reach out to schedule a personalized walkthrough of the BEI platform.
                    </DialogDescription>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
                        <div className="grid grid-cols-2 gap-4">
                            <FormField control={form.control} name="name" render={({ field }) => ( <FormItem><FormLabel>First Name</FormLabel><FormControl><Input placeholder="John" {...field} /></FormControl><FormMessage /></FormItem> )} />
                            <FormField control={form.control} name="surname" render={({ field }) => ( <FormItem><FormLabel>Surname</FormLabel><FormControl><Input placeholder="Doe" {...field} /></FormControl><FormMessage /></FormItem> )} />
                        </div>
                        <FormField control={form.control} name="email" render={({ field }) => ( <FormItem><FormLabel>Work Email</FormLabel><FormControl><Input type="email" placeholder="john@practice.co.za" {...field} /></FormControl><FormMessage /></FormItem> )} />
                        <FormField control={form.control} name="cell" render={({ field }) => ( <FormItem><FormLabel>Cell Number</FormLabel><FormControl><Input placeholder="082 123 4567" {...field} /></FormControl><FormMessage /></FormItem> )} />
                        
                        <Button type="submit" className="w-full h-12 text-md font-bold mt-4" disabled={isLoading}>
                            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                            Request Demo
                        </Button>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}

const featureBenefits = [
    {
        icon: Percent,
        feature: '25% Wholesale Discount',
        benefit: 'Increase your profit margins instantly. You buy services at wholesale rates and sell at retail prices, keeping 100% of the markup.',
    },
    {
        icon: LayoutDashboard,
        feature: 'White-Label Dashboard',
        benefit: 'Manage your entire practice, staff, and client workflows from a single secure portal that carries your branding, not ours.',
    },
    {
        icon: Globe,
        feature: 'Custom Practice Landing Page',
        benefit: 'Get a 24/7 online store with 50+ re-branded services. Let your clients browse, order, and pay while you sleep.',
    },
    {
        icon: Users,
        feature: 'Elastic Outsourcing Capacity',
        benefit: 'Never say "no" to a complex project again. Confidently scale your business capacity by leveraging our expert backend team.',
    },
    {
        icon: GraduationCap,
        feature: 'Onboarding & Professional Support',
        benefit: 'Full setup, training, and direct access to senior Chartered Accountants and tax experts to help you navigate complex technical hurdles.',
    },
    {
        icon: ClipboardList,
        feature: 'Automated Compliance Roadmap',
        benefit: 'Never miss a SARS or CIPC deadline again. The system automatically monitors your client requirements and creates tasks for your team.',
    },
    {
        icon: FileText,
        feature: 'Professional Template Library',
        benefit: 'Save hundreds of hours with ready-to-use, legally compliant engagement letters, contracts, and pricing schedules.',
    },
    {
        icon: Scale,
        feature: 'Flexible Pricing Control',
        benefit: 'Total control over your client-facing prices. Set your own markup on services while our underlying wholesale cost remains fixed.',
    },
];

const challenges = [
    {
        title: 'Limited Service Range',
        description: 'Offering only bookkeeping services limits your earning potential. Sell our full suite — from company registration to VAT, COIDA, CIDB, NCR, and more.',
        icon: Briefcase
    },
    {
        title: 'Lack of Mentorship',
        description: 'Many bookkeepers work alone. We provide mentorship from senior accountants and industry experts who help you grow your capabilities.',
        icon: GraduationCap
    },
    {
        title: 'Technology Gaps',
        description: 'Without proper systems, document management is messy. Get our cloud-based dashboard to manage and outsource client orders seamlessly.',
        icon: Cpu
    },
    {
        title: 'Manual Sales & Quoting',
        description: 'Quoting manually and chasing EFTs is a time-sink. Your white-labeled online store automates sales, PayFast, and document collection.',
        icon: ShoppingBag
    },
    {
        title: 'Capacity Constraints',
        description: 'Handling large clients alone isn’t easy. Our qualified team handles your overflow work securely, accurately, and on time.',
        icon: Users
    },
    {
        title: 'Compliance Overwhelm',
        description: 'Advanced statutory rules can be deterring. We provide ready-to-use templates and guides to help you stay compliant and confident.',
        icon: ShieldAlert
    }
];

const faqs = [
    {
        question: "How does the outsourcing work?",
        answer: "You can decide to complete the order yourself or outsource to us. The process is completely white-labeled, so your client doesn't know the work is being outsourced. We charge you a fixed wholesale price (25% discount), and you keep the markup."
    },
    {
        question: "What is the setup fee?",
        answer: "Joining the Bookkeeper Empowerment Initiative requires a once-off setup and activation fee of R4,950. This covers your platform configuration, re-branding toolkit, and initial CA-led training."
    },
    {
        question: "Are there monthly hosting fees?",
        answer: "No. The R4,950 activation fee now replaces all recurring hosting subscriptions. Once paid, you have lifetime access to the dashboard and your landing page without monthly overheads."
    },
    {
        question: "Do I need to be a registered accountant?",
        answer: "Anyone can join the BEI to use the software and manage their own clients. However, to receive outsourced overflow work from the My Accountant network, you must be a registered member in good standing with a recognized professional body (SAICA, SAIT, CIBA, or SAIPA)."
    }
];

export default function BecomeAPartnerPageClient() {
  return (
    <div className="space-y-16 pb-16 bg-white">
      <section className="bg-white border-b relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full opacity-5 pointer-events-none">
            <div className="absolute top-10 left-10"><Bot size={120} /></div>
            <div className="absolute bottom-10 right-10"><Wallet size={120} /></div>
        </div>
        <div className="container mx-auto px-4 py-20 text-center relative z-10">
            <h1 className="text-4xl font-black tracking-tight md:text-6xl lg:text-7xl text-slate-900">
                10X Your Practice — <span className="text-gradient">Without Hiring More Staff.</span>
            </h1>
            <p className="mt-6 text-xl text-slate-700 max-w-4xl mx-auto font-medium leading-relaxed">
                Never lose a client because you lack capacity, specialised expertise, or time. With the Bookkeeper Empowerment Initiative (BEI), you can confidently outsource complex work while keeping full control of the client relationship and growing your revenue.
            </p>
            <p className="mt-6 text-2xl font-bold text-slate-800 uppercase tracking-tighter">Expand your services. Protect your clients. Scale your practice.</p>
        </div>
      </section>

      <section className="bg-slate-900 py-24">
        <div className="container mx-auto px-4">
            <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
                <div className="text-white space-y-6">
                    <Badge className="bg-primary hover:bg-primary text-white border-none px-3 py-1 text-[10px] font-black uppercase tracking-widest">Pricing Plan</Badge>
                    <h2 className="text-4xl md:text-5xl font-black leading-tight">One-Time Practice <br/><span className="text-primary">Investment</span></h2>
                    <p className="text-lg text-slate-300 leading-relaxed">
                        Scale your firm with a turn-key solution. The BEI setup fee replaces all monthly hosting costs, giving you a lifetime platform for growth.
                    </p>
                    <ul className="space-y-4">
                        {[
                            'Fully Branded Practice Landing Page',
                            '65+ Pre-configured Accounting Products',
                            'Secure Client Onboarding Dashboard',
                            'Initial Setup & Professional Training',
                            'Direct CA Technical Support Access'
                        ].map((item, i) => (
                            <li key={i} className="flex items-center gap-3 text-sm font-medium text-slate-200">
                                <CheckCircle2 className="h-5 w-5 text-primary shrink-0" />
                                {item}
                            </li>
                        ))}
                    </ul>
                </div>
                <Card className="border-none shadow-2xl bg-white overflow-hidden transform lg:scale-110">
                    <CardHeader className="bg-slate-50 border-b p-8 text-center">
                        <CardTitle className="text-sm font-black uppercase tracking-widest text-slate-500">Setup & Activation</CardTitle>
                        <div className="mt-4 flex items-baseline justify-center gap-1">
                            <span className="text-2xl font-bold text-slate-900">R</span>
                            <span className="text-7xl font-black text-slate-900">4,950</span>
                        </div>
                        <p className="mt-2 text-xs font-bold text-primary uppercase tracking-tighter">Once-off payment • No monthly hosting fees</p>
                    </CardHeader>
                    <CardContent className="p-8 space-y-6">
                        <div className="space-y-4">
                            <div className="flex items-start gap-3">
                                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0"><ShieldCheck className="h-5 w-5" /></div>
                                <div>
                                    <p className="font-bold text-sm">Full Brand Ownership</p>
                                    <p className="text-xs text-muted-foreground">Keep 100% of your client relationships and brand identity.</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-3">
                                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0"><Rocket className="h-5 w-5" /></div>
                                <div>
                                    <p className="font-bold text-sm">Instant Market Presence</p>
                                    <p className="text-xs text-muted-foreground">Go from solo bookkeeper to full-service firm in 48 hours.</p>
                                </div>
                            </div>
                        </div>
                        <Button asChild size="lg" className="w-full h-14 text-lg font-black shadow-lg">
                            <Link href="/partner-signup">Register My Practice</Link>
                        </Button>
                    </CardContent>
                    <CardFooter className="bg-slate-50 p-4 border-t text-center justify-center">
                        <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-widest">Secure checkout via PayFast</p>
                    </CardFooter>
                </Card>
            </div>
        </div>
      </section>

      <div className="container mx-auto px-4">
        <TrustIndexWidget />
      </div>

      <section className="container mx-auto px-4 scroll-m-20">
        <div className="max-w-4xl mx-auto text-center space-y-8">
            <div className="space-y-4">
                <Badge className="bg-primary/10 text-primary hover:bg-primary/10 border-none px-4 py-1 text-xs font-bold uppercase tracking-widest">Our Philosophy</Badge>
                <h2 className="text-4xl font-bold leading-tight text-slate-900">Our philosophy has always been simple</h2>
                <p className="text-2xl font-bold text-slate-800 italic">"A client referred to someone else is a client lost."</p>
            </div>
            
            <div className="space-y-6 text-lg text-muted-foreground leading-relaxed text-left sm:text-center">
                <p>
                    With the Bookkeeper Empowerment Initiative, you never have to send your client away because you lack capacity, specialised experience, or technical expertise.
                </p>
                <p>
                    Instead, you can confidently outsource the service through us — discreetly and professionally — while maintaining your client relationship.
                </p>
                
                <div className="flex flex-wrap justify-center gap-4 py-4">
                    <div className="flex items-center gap-2 px-4 py-2 bg-green-50 text-green-700 rounded-full font-bold text-sm border border-green-100 shadow-sm">
                        <CheckCircle2 className="h-4 w-4" /> You stay in control
                    </div>
                    <div className="flex items-center gap-2 px-4 py-2 bg-green-50 text-green-700 rounded-full font-bold text-sm border border-green-100 shadow-sm">
                        <CheckCircle2 className="h-4 w-4" /> You keep the client
                    </div>
                    <div className="flex items-center gap-2 px-4 py-2 bg-green-50 text-green-700 rounded-full font-bold text-sm border border-green-100 shadow-sm">
                        <CheckCircle2 className="h-4 w-4" /> You protect your brand
                    </div>
                </div>

                <p className="font-bold text-slate-950 text-center text-xl">
                    We handle the complexity behind the scenes so your client never needs to move to another accountant.
                </p>
            </div>
        </div>
      </section>

      <section className="bg-slate-50 py-24 border-y">
        <div className="container mx-auto px-4">
            <div className="text-center mb-16 space-y-4">
                <Badge className="bg-primary/10 text-primary hover:bg-primary/10 border-none px-4 py-1 text-xs font-bold uppercase tracking-widest">The Problem</Badge>
                <h2 className="text-4xl font-bold tracking-tight text-slate-900">Challenges We Solve for Practitioners</h2>
                <p className="text-muted-foreground max-w-2xl mx-auto text-lg">Running a practice shouldn't feel like a solo battle against paperwork.</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {challenges.map((item, idx) => (
                    <Card key={idx} className="border-none shadow-sm bg-white hover:shadow-md transition-shadow">
                        <CardHeader className="text-center pb-2">
                            <div className="mx-auto h-16 w-16 rounded-full bg-primary/5 border flex items-center justify-center mb-4">
                                <item.icon className="h-8 w-8 text-primary" />
                            </div>
                            <CardTitle className="text-xl font-bold text-slate-900">{item.title}</CardTitle>
                        </CardHeader>
                        <CardContent className="text-center">
                            <p className="text-sm text-muted-foreground leading-relaxed px-4">{item.description}</p>
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>
      </section>
      
      <section id="benefits" className="bg-white py-24 border-t border-b scroll-m-20">
        <div className="container mx-auto px-4">
            <div className="text-center mb-16">
                <h2 className="text-4xl font-bold tracking-tight text-slate-900">Features vs Benefits</h2>
                <p className="text-muted-foreground mt-4 max-w-2xl mx-auto text-lg">A powerful back-office engine for your accounting firm, designed for maximum results.</p>
            </div>
            
            <div className="max-w-5xl mx-auto border rounded-2xl overflow-hidden shadow-xl">
                <div className="grid grid-cols-1 md:grid-cols-2 bg-slate-900 text-white font-black uppercase tracking-widest text-[10px]">
                    <div className="p-4 border-r border-slate-800 hidden md:block">The Platform Feature</div>
                    <div className="p-4 hidden md:block">The Business Benefit</div>
                </div>
                <div className="divide-y divide-slate-100">
                    {featureBenefits.map((item, idx) => (
                        <div key={idx} className="grid grid-cols-1 md:grid-cols-2 group hover:bg-slate-50 transition-colors">
                            <div className="p-6 md:border-r border-slate-100 space-y-2">
                                <span className="md:hidden text-[10px] font-black uppercase text-primary tracking-widest block mb-2">Feature</span>
                                <div className="flex items-center gap-4">
                                    <div className="h-10 w-10 rounded-xl bg-primary/5 border border-primary/10 flex items-center justify-center shrink-0 shadow-sm">
                                        <item.icon className="h-5 w-5 text-primary" />
                                    </div>
                                    <h3 className="font-bold text-lg text-slate-900 leading-tight">{item.feature}</h3>
                                </div>
                            </div>
                            <div className="p-6 bg-white group-hover:bg-transparent transition-colors flex flex-col justify-center">
                                <span className="md:hidden text-[10px] font-black uppercase text-green-600 tracking-widest block mb-2">The Benefit to You</span>
                                <div className="flex items-start gap-3">
                                    <CheckCircle className="h-5 w-5 text-green-500 shrink-0 mt-0.5" />
                                    <p className="text-sm text-muted-foreground font-medium leading-relaxed">{item.benefit}</p>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
      </section>

      <section className="container mx-auto px-4 max-w-4xl py-12">
         <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-slate-900">Frequently Asked Questions</h2>
        </div>
         <Accordion type="single" collapsible className="w-full">
            {faqs.map((faq, index) => (
              <AccordionItem key={index} value={`item-${index}`}>
                <AccordionTrigger className="text-left font-semibold hover:no-underline">{faq.question}</AccordionTrigger>
                <AccordionContent className="whitespace-pre-line text-muted-foreground leading-relaxed text-base">{faq.answer}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
      </section>
      
      <section className="container mx-auto px-4 text-center">
        <div className="max-w-2xl mx-auto space-y-8">
            <h2 className="text-4xl font-bold tracking-tight text-slate-900">Ready to Empower Your Practice?</h2>
            <p className="text-xl text-muted-foreground">
                Register now and complete your R4,950 onboarding to unlock your branded dashboard and re-branding toolkit.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Button asChild size="lg" className="h-14 px-10 text-lg font-bold shadow-lg">
                    <Link href="/partner-signup">Register Now</Link>
                </Button>
                <BookDemoDialog />
            </div>
        </div>
      </section>
    </div>
  );
}
