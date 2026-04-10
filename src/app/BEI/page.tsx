'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { 
    Bot, 
    Wallet, 
    GraduationCap, 
    CheckCircle2, 
    LayoutDashboard, 
    Percent, 
    Globe, 
    Scale, 
    Loader2, 
    ExternalLink, 
    UserPlus, 
    ClipboardList, 
    CheckCircle, 
    Users, 
    Zap, 
    ShieldCheck, 
    Rocket, 
    Table as TableIcon,
    BadgeDollarSign
} from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import dynamicImport from 'next/dynamic';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { saveDemoLead } from '@/app/actions';
import { getFirestore, collection, query, orderBy, getDocs } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { Service } from '@/lib/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';

const db = getFirestore(firebaseApp);

const TrustIndexWidget = dynamicImport(() => import('@/components/shared/TrustIndexWidget'), {
  ssr: false,
});

const demoFormSchema = z.object({
  name: z.string().min(2, "First name is required."),
  surname: z.string().min(2, "Surname is required."),
  email: z.string().email("A valid email is required."),
  cell: z.string().min(10, "A valid cell number is required."),
});

function PartnerPricingDialog() {
    const [services, setServices] = useState<Service[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isOpen, setIsOpen] = useState(false);

    const fetchPricing = async () => {
        setIsLoading(true);
        try {
            const q = query(collection(db, "services"), orderBy("title"));
            const snap = await getDocs(q);
            setServices(snap.docs.map(doc => ({ ...doc.data(), id: doc.id } as Service)));
        } catch (e) {
            console.error(e);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (isOpen) fetchPricing();
    }, [isOpen]);

    const formatPrice = (price: number) => {
        return new Intl.NumberFormat('en-ZA', {
          style: 'currency',
          currency: 'ZAR',
        }).format(price);
    };

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <button className="text-primary font-bold text-xs flex items-center gap-1 mt-2 hover:underline ml-8 animate-in fade-in">
                    View Partner Pricing <ExternalLink className="h-3 w-3" />
                </button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-4xl max-h-[90vh] flex flex-col p-0">
                <DialogHeader className="p-6 bg-slate-50 border-b">
                    <DialogTitle className="text-2xl font-bold flex items-center gap-2">
                        <BadgeDollarSign className="h-6 w-6 text-primary" />
                        Wholesale Partner Pricing
                    </DialogTitle>
                    <DialogDescription>
                        Practice members receive a standard 25% discount on all service fees.
                    </DialogDescription>
                </DialogHeader>
                
                <div className="flex-1 overflow-hidden p-6">
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center h-64 gap-2">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                            <p className="text-sm font-medium text-muted-foreground">Fetching latest rates...</p>
                        </div>
                    ) : (
                        <ScrollArea className="h-full border rounded-lg">
                            <Table>
                                <TableHeader className="bg-muted/50 sticky top-0 z-10 shadow-sm">
                                    <TableRow>
                                        <TableHead className="w-1/2">Service Description</TableHead>
                                        <TableHead className="text-right">Retail Price</TableHead>
                                        <TableHead className="text-right text-primary">Partner Cost (25% Off)</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {services.filter(s => !s.isPriceTbc).map((service) => (
                                        <TableRow key={service.id}>
                                            <TableCell className="font-medium text-xs sm:text-sm">{service.title}</TableCell>
                                            <TableCell className="text-right text-xs opacity-50 line-through">{formatPrice(service.price)}</TableCell>
                                            <TableCell className="text-right font-bold text-primary text-xs sm:text-sm">{formatPrice(service.resellerPrice || service.price * 0.75)}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </ScrollArea>
                    )}
                </div>
                <DialogFooter className="p-4 bg-muted/30 border-t">
                    <p className="text-[10px] text-muted-foreground italic px-4">
                        * Prices exclude 3rd party statutory costs (e.g. CIPC fees) which are passed through at cost.
                    </p>
                    <Button onClick={() => setIsOpen(false)}>Close List</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

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
        showPricing: true,
    },
    {
        icon: LayoutDashboard,
        feature: 'White-Label Dashboard',
        benefit: 'Manage your client orders and project progress from a single secure portal that carries your branding, not ours.',
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
        icon: GraduationCap,
        feature: 'Onboarding & Professional Support',
        benefit: 'Full setup, training, and direct access to senior Chartered Accountants to help you navigate complex technical hurdles.',
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
        answer: "Joining the Bookkeeper Empowerment Initiative requires a once-off setup and activation fee of R4,950. This covers your platform configuration, re-branding toolkit, and initial training."
    },
    {
        question: "Are there monthly fees?",
        answer: "No. The R4,950 setup fee replaces the previous monthly subscription model. Once your practice is set up, you only pay for the services you choose to outsource to us at wholesale rates."
    },
    {
        question: "Do I need to be a registered accountant?",
        answer: "Anyone can join the BEI to use the software and manage their own clients. However, to receive outsourced overflow work from the My Accountant network, you must be a registered member in good standing with a recognized professional body (SAICA, SAIT, CIBA, or SAIPA)."
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
                10X Your Practice — <span className="text-gradient">No Staff Required.</span>
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

      <section className="bg-slate-50 py-24 border-y">
        <div className="container mx-auto px-4">
            <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
                <div className="space-y-6">
                    <Badge className="bg-primary/10 text-primary hover:bg-primary/10 border-none px-3 py-1 text-[10px] font-black uppercase tracking-widest">Pricing Plan</Badge>
                    <h2 className="text-4xl md:text-5xl font-black leading-tight text-slate-900">One-Time Practice <br/><span className="text-primary">Investment</span></h2>
                    <p className="text-lg text-slate-600 leading-relaxed">
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
                            <li key={i} className="flex items-center gap-3 text-sm font-medium text-slate-700">
                                <CheckCircle2 className="h-5 w-5 text-primary shrink-0" />
                                {item}
                            </li>
                        ))}
                    </ul>
                </div>
                <Card className="border shadow-2xl bg-white overflow-hidden transform lg:scale-110">
                    <CardHeader className="bg-white border-b p-8 text-center">
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
                                    <p className="font-bold text-sm text-slate-900">Full Brand Ownership</p>
                                    <p className="text-xs text-muted-foreground">Keep 100% of your client relationships and brand identity.</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-3">
                                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0"><Rocket className="h-5 w-5" /></div>
                                <div>
                                    <p className="font-bold text-sm text-slate-900">Instant Market Presence</p>
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

      <section className="bg-white py-24 border-b">
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
                                {item.showPricing && <PartnerPricingDialog />}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <div className="mt-16 text-center space-y-4">
                <p className="text-sm text-muted-foreground font-medium italic">Ready to transform your practice? Start your onboarding today.</p>
                <Button asChild size="lg" className="h-14 px-12 text-lg font-black shadow-xl">
                    <Link href="/partner-signup">Register & Activate for R4,950</Link>
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
