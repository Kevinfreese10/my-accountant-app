'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Rocket, ShieldCheck, Wallet, Bot, Cpu, Briefcase, Users, FileText, GraduationCap, CheckCircle2, ArrowRight, LayoutDashboard, LifeBuoy, Percent, TrendingUp, ShieldAlert, ClipboardList, ShoppingBag, CheckCircle, Globe, Scale, Loader2, ExternalLink, UserPlus, Zap, X } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import dynamicImport from 'next/dynamic';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

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

const comparisonFeatures = [
    {
        feature: 'Setup Fee',
        starter: 'R0 (Free)',
        full: 'R0 (Free)',
        benefit: 'Zero barriers to entry. Start building your practice without upfront costs.'
    },
    {
        feature: 'Monthly Subscription',
        starter: 'R0 (Free)',
        full: 'R0 (Free)',
        benefit: 'Keep 100% of your earnings. No recurring overheads for using our platform.'
    },
    {
        feature: 'Wholesale Discount',
        starter: '10%',
        full: '25%',
        benefit: 'Higher margins on every service. Full Practices maximize profitability on all outsourced work.'
    },
    {
        feature: 'White-Label Branding',
        starter: 'No',
        full: 'Yes',
        benefit: 'Your logo, your colors. Maintain a professional front-end while we handle the back-office.'
    },
    {
        feature: 'Custom Practice Website',
        starter: 'No',
        full: 'Yes',
        benefit: 'Get a 24/7 online store preloaded with 60+ services. Browse Example: /p/interscope'
    },
    {
        feature: 'Pricing Control',
        starter: 'Fixed Retail',
        full: 'Custom Markup',
        benefit: 'Set your own retail prices. You decide your profit margins based on your market.'
    },
    {
        feature: 'Team & Staff Management',
        starter: 'No',
        full: 'Yes (Up to 3 Free)',
        benefit: 'Scale your workforce. Add staff users to assign tasks and manage internal workflows.'
    },
    {
        feature: 'Automated Task Manager',
        starter: 'No',
        full: 'Yes',
        benefit: 'Never miss a deadline. Automatic roadmap generation based on client compliance needs.'
    },
    {
        feature: 'Receive Overflow Work',
        starter: 'No',
        full: 'Yes (Optional)',
        benefit: 'Grow beyond your own client base. Get access to overflow work from our national network (merit-based).'
    },
    {
        feature: 'Document Contact',
        starter: 'Partner Only',
        full: 'Partner or Client',
        benefit: 'Save time. We can contact your client directly for documents under your brand.'
    }
];

const faqs = [
    {
        question: "Is it really free to join?",
        answer: "Yes! There are no setup fees or monthly subscription costs for either the Starter or Full Practice tiers. We only charge you the discounted wholesale price when you choose to outsource a service to us."
    },
    {
        question: "How does the outsourcing work?",
        answer: "When you have an order you want us to handle, you submit it through your dashboard. We charge you the wholesale price (minus your 10% or 25% discount), and we complete the work. You can choose whether we contact you or your client directly (Full Practice only) for documents."
    },
    {
        question: "Why should I choose the Full Practice tier if both are free?",
        answer: "The Full Practice tier offers significantly better margins (25% discount vs 10%), your own branded landing page, staff management tools, and the ability to set your own client-facing prices. It is designed for practitioners ready to build a professional, scalable firm."
    },
    {
        question: "Do I need to be a registered accountant?",
        answer: "Anyone can join the BEI to use the software. However, to receive outsourced overflow work from the My Accountant network, you must be a registered member in good standing with a recognized professional body (SAICA, SAIT, CIBA, or SAIPA)."
    },
    {
        question: "How do I pay for outsourced services?",
        answer: "You load credits into your Practice Wallet via PayFast. When you outsource an order, the wholesale cost is deducted from your credit balance."
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

      {/* Unified Comparison & Benefits Table */}
      <section id="pricing" className="bg-slate-50 py-24 border-y">
        <div className="container mx-auto px-4">
            <div className="text-center mb-16 space-y-4">
                <Badge className="bg-primary/10 text-primary hover:bg-primary/10 border-none px-4 py-1 text-xs font-bold uppercase tracking-widest">Model Comparison</Badge>
                <h2 className="text-4xl font-bold tracking-tight text-slate-900">Choose Your Path to Growth</h2>
                <p className="text-muted-foreground max-w-2xl mx-auto text-lg">Both models are free to join. Choose the level of support that fits your current practice stage.</p>
            </div>

            <div className="max-w-6xl mx-auto bg-white rounded-3xl shadow-2xl border overflow-hidden">
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-slate-900 hover:bg-slate-900 border-none">
                                <TableHead className="w-[200px] text-white font-bold py-6 px-6">Feature</TableHead>
                                <TableHead className="text-white font-bold text-center py-6">Starter Partner</TableHead>
                                <TableHead className="bg-primary text-white font-bold text-center py-6 shadow-2xl relative">
                                    Full BEI Practice
                                    <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-white text-primary font-black border-none animate-bounce">RECOMMENDED</Badge>
                                </TableHead>
                                <TableHead className="hidden md:table-cell text-white font-bold py-6 px-6">Practice Growth Benefit</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {comparisonFeatures.map((row, idx) => (
                                <TableRow key={idx} className="group hover:bg-muted/30 border-slate-100">
                                    <TableCell className="font-bold text-slate-700 py-4 px-6">{row.feature}</TableCell>
                                    <TableCell className="text-center text-slate-600">
                                        {row.starter === 'No' ? <X className="h-4 w-4 mx-auto text-slate-300" /> : row.starter}
                                    </TableCell>
                                    <TableCell className="text-center font-black text-primary bg-primary/5 group-hover:bg-primary/10 transition-colors">
                                        {row.feature === 'Custom Practice Website' ? (
                                            <div className="flex flex-col items-center gap-1">
                                                <span>{row.full}</span>
                                                <Button variant="link" size="xs" className="h-auto p-0 text-[10px] text-primary underline" asChild>
                                                    <Link href="/p/interscope" target="_blank">View Example <ExternalLink className="h-2 w-2 ml-1"/></Link>
                                                </Button>
                                            </div>
                                        ) : row.full}
                                    </TableCell>
                                    <TableCell className="hidden md:table-cell text-xs text-muted-foreground italic py-4 px-6 leading-relaxed">
                                        {row.benefit}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 bg-slate-50 border-t">
                    <div className="p-8 flex flex-col justify-center items-center text-center border-r border-slate-200">
                        <p className="text-sm font-bold text-slate-500 mb-4 uppercase tracking-widest">Freelance / Referral</p>
                        <Button variant="outline" size="lg" className="w-full sm:w-auto h-12 px-10 border-2 font-bold" asChild>
                            <Link href="/partner-signup?tier=starter">Join as Starter</Link>
                        </Button>
                    </div>
                    <div className="p-8 flex flex-col justify-center items-center text-center bg-primary/5">
                        <p className="text-sm font-bold text-primary mb-4 uppercase tracking-widest">Professional Firm</p>
                        <Button size="lg" className="w-full sm:w-auto h-12 px-10 font-black shadow-lg" asChild>
                            <Link href="/partner-signup?tier=full">Setup Full Practice</Link>
                        </Button>
                    </div>
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
                Join the Bookkeeper Empowerment Initiative today. No setup fees, no monthly costs — just pure growth.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Button asChild size="lg" className="h-14 px-10 text-lg font-bold shadow-lg">
                    <Link href="/partner-signup">Sign up for Free</Link>
                </Button>
                <BookDemoDialog />
            </div>
        </div>
      </section>
    </div>
  );
}
