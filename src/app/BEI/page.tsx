'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Bot, Wallet, GraduationCap, CheckCircle2, LayoutDashboard, Percent, Globe, Scale, Loader2, ExternalLink, UserPlus, ClipboardList, CheckCircle, Users } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import dynamicImport from 'next/dynamic';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
        link: 'https://www.myacc.co.za/p/interscope'
    },
    {
        icon: Users,
        feature: 'Elastic Outsourcing Capacity',
        benefit: 'Never say "no" to a complex project again. Confidently scale your business capacity by leveraging our expert backend team.',
    },
    {
        icon: UserPlus,
        feature: 'Team & Staff Management',
        benefit: 'Build your firm with up to 3 free additional staff users. Easily assign tasks, track progress, and manage internal project workflows.',
    },
    {
        icon: GraduationCap,
        feature: 'Onboarding & Professional Support',
        benefit: 'Full setup, training, and direct access to senior Chartered Accountants to help you navigate complex technical hurdles.',
    },
    {
        icon: ClipboardList,
        feature: 'Automated Compliance Roadmap',
        benefit: 'Never miss a SARS or CIPC deadline again. The system automatically monitors your client requirements and creates tasks for your team.',
    },
    {
        icon: Scale,
        feature: 'Flexible Pricing Control',
        benefit: 'Total control over your client-facing prices. Set your own markup on services while our underlying wholesale cost remains fixed.',
    },
];

const faqs = [
    {
        question: "How does the outsourcing work?",
        answer: "When you have an order you want us to handle, you submit it through your dashboard. We charge you the discounted wholesale price (25% off our retail rates), and we complete the work behind the scenes. You remain the primary contact for your client."
    },
    {
        question: "What is the setup fee?",
        answer: "Joining the Bookkeeper Empowerment Initiative requires a R4,950 once-off setup fee. This fee covers your white-label platform configuration, onboarding session, and professional training.\n\nMore importantly, 50% of this fee (R2,475) is immediately loaded into your Practice Wallet as credits to use for outsourcing."
    },
    {
        question: "Do I need to be a registered accountant?",
        answer: "Anyone can join the BEI to use the software and manage their own clients. However, to receive outsourced overflow work from the My Accountant network, you must be a registered member in good standing with a recognized professional body (SAICA, SAIT, CIBA, or SAIPA)."
    },
    {
        question: "How do I pay for outsourced services?",
        answer: "You load credits into your Practice Wallet via PayFast. When you outsource an order, the wholesale cost is deducted from your credit balance. This ensures a smooth, prepaid workflow."
    },
    {
        question: "Can I set my own prices?",
        answer: "Absolutely. As a BEI Practice, you have total control over your client-facing prices on your landing page. Our wholesale price remains fixed, allowing you to decide your own profit margins."
    }
];

export default function BEIPage() {
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

      <section className="container mx-auto px-4 scroll-m-20">
        <div className="max-w-4xl mx-auto space-y-8">
            <div className="text-center space-y-4">
                <h2 className="text-3xl font-bold text-slate-900">About the Bookkeeper Empowerment Initiative</h2>
                <Separator className="w-24 mx-auto border-b-2 border-primary/30" />
            </div>
            
            <div className="space-y-6 text-lg text-muted-foreground leading-relaxed">
                <p>
                    Most bookkeeping and accounting firms stop growing for one simple reason: <span className="font-bold text-slate-950">capacity</span>.
                </p>
                <p>
                    You may already have the clients and the demand, but expanding your services normally means hiring staff, building systems, investing in a website, and taking on significant operational risk.
                </p>
                <p className="font-bold text-slate-950">
                    The Bookkeeper Empowerment Initiative (BEI) was created to remove these barriers.
                </p>
                <p>
                    BEI gives bookkeepers and accountants the tools to scale their practice immediately without hiring staff or investing thousands into technology.
                </p>
                <p>
                    Through the program, partners receive access to a fully operational online accounting store and CRM platform, allowing them to start offering professional accounting, tax, and compliance services to their clients right away. There is no need to build a website, develop an ordering system, or create complex internal workflows — everything is already built and ready to use.
                </p>
                <p>
                    <span className="font-bold text-slate-950">More importantly, BEI ensures that you never have to turn away work again.</span>
                </p>
                <p>
                    If a client requires a service that you do not have the time, staff, or expertise to deliver, the work can be white-label outsourced through our platform while you remain the primary relationship holder. Your client continues to see you as their trusted advisor while the work is completed by experienced professionals behind the scenes.
                </p>
                <p>
                    Our philosophy has always been clear: <span className="italic font-medium text-slate-900">A client referred elsewhere is often a client lost.</span>
                </p>
                <p className="font-bold text-slate-950">
                    The Bookkeeper Empowerment Initiative ensures that every opportunity stays within your practice.
                </p>
                <p>
                    As the BEI network grows, the platform evolves into a collaborative ecosystem of accounting professionals. Partners can outsource work to My Accountant, and they can also receive outsourced work from other partners within the network — creating new revenue opportunities across the entire community.
                </p>
                
                <div className="bg-slate-50 p-8 rounded-2xl border space-y-4">
                    <p className="font-bold text-slate-900">The result is a powerful platform that allows accounting professionals to:</p>
                    <ul className="space-y-3">
                        <li className="flex items-center gap-3 font-medium text-slate-800">
                            <CheckCircle2 className="h-5 w-5 text-primary" /> Expand their service offering instantly
                        </li>
                        <li className="flex items-center gap-3 font-medium text-slate-800">
                            <CheckCircle2 className="h-5 w-5 text-primary" /> Accept more clients with confidence
                        </li>
                        <li className="flex items-center gap-3 font-medium text-slate-800">
                            <CheckCircle2 className="h-5 w-5 text-primary" /> Increase revenue without increasing staff
                        </li>
                        <li className="flex items-center gap-3 font-medium text-slate-800">
                            <CheckCircle2 className="h-5 w-5 text-primary" /> Retain clients by never turning work away
                        </li>
                    </ul>
                </div>

                <p className="text-center font-bold text-slate-950 text-xl pt-4">
                    BEI is more than a partner program. It is a growth platform designed to help accountants scale their practices faster, smarter, and with far less risk.
                </p>
            </div>
        </div>
      </section>

      <section className="bg-slate-50 py-24 border-y">
        <div className="container mx-auto px-4">
            <div className="text-center mb-16 space-y-4">
                <Badge className="bg-primary/10 text-primary hover:bg-primary/10 border-none px-4 py-1 text-xs font-bold uppercase tracking-widest">Practice Benefits</Badge>
                <h2 className="text-4xl font-bold tracking-tight text-slate-900">Features vs Benefits</h2>
                <p className="text-muted-foreground max-w-2xl mx-auto text-lg">Everything you need to build a professional, scalable firm.</p>
            </div>

            <div className="max-w-5xl mx-auto bg-white rounded-2xl overflow-hidden shadow-2xl border">
                <div className="grid grid-cols-1 md:grid-cols-2 bg-slate-900 text-white font-black uppercase tracking-widest text-[10px]">
                    <div className="p-4 border-r border-slate-800 hidden md:block">The Platform Feature</div>
                    <div className="p-4 hidden md:block">The Business Benefit</div>
                </div>
                <div className="divide-y divide-slate-100">
                    {featureBenefits.map((item, idx) => (
                        <div key={idx} className="grid grid-cols-1 md:grid-cols-2 group hover:bg-slate-50 transition-colors">
                            <div className="p-6 md:border-r border-slate-100 flex items-center gap-4">
                                <div className="h-12 w-12 rounded-xl bg-primary/5 border border-primary/10 flex items-center justify-center shrink-0 shadow-sm group-hover:bg-primary group-hover:text-white transition-colors">
                                    <item.icon className="h-6 w-6" />
                                </div>
                                <h3 className="font-bold text-lg text-slate-900">{item.feature}</h3>
                            </div>
                            <div className="p-6 flex flex-col items-start gap-1 bg-white group-hover:bg-transparent transition-colors">
                                <div className="flex items-start gap-3">
                                    <CheckCircle className="h-5 w-5 text-green-500 shrink-0 mt-0.5" />
                                    <p className="text-sm text-muted-foreground font-medium leading-relaxed">{item.benefit}</p>
                                </div>
                                {item.link && (
                                    <a 
                                        href={item.link} 
                                        target="_blank" 
                                        rel="noopener noreferrer" 
                                        className="text-primary font-bold text-xs flex items-center gap-1 mt-2 hover:underline ml-8"
                                    >
                                        View Example <ExternalLink className="h-3 w-3" />
                                    </a>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <div className="mt-16 text-center space-y-4">
                <p className="text-sm text-muted-foreground font-medium italic">Onboarding includes full platform setup, re-branding training, and R2,475 starting credits.</p>
                <Button asChild size="lg" className="h-14 px-12 text-lg font-black shadow-xl">
                    <Link href="/partner-signup">Join the BEI Network</Link>
                </Button>
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
                Join the Bookkeeper Empowerment Initiative today. Start growing your revenue with our expert back-office team.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Button asChild size="lg" className="h-14 px-10 text-lg font-bold shadow-lg">
                    <Link href="/partner-signup">Register My Practice</Link>
                </Button>
                <BookDemoDialog />
            </div>
        </div>
      </section>
    </div>
  );
}
