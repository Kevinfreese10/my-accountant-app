'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Rocket, ShieldCheck, Wallet, Bot, Cpu, Briefcase, Users, FileText, GraduationCap, CheckCircle2, ArrowRight, LayoutDashboard, LifeBuoy, Percent, TrendingUp, ShieldAlert, ClipboardList, ShoppingBag, CheckCircle, Globe, Scale, Loader2, ExternalLink } from 'lucide-react';
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
        feature: 'Mentorship & Professional Support',
        benefit: 'Direct access to senior Chartered Accountants and tax experts to help you navigate complex client queries and technical hurdles.',
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
        answer: "You can decide to complete the order yourself or outsource to us. The process is completely white-labeled, so your client doesn't know the work is being outsourced. We charge you a fixed wholesale price, and you keep the markup.\n\nWe can then either contact you or contact your client directly through our app which is completely white-labeled so your client remains none the wiser."
    },
    {
        question: "Who should join the Bookkeeper Empowerment Initiative?",
        answer: "BEI is ideal for passionate professionals who want to grow their business without stress, including:\n- Freelance Bookkeepers\n- Startup Accounting Firms\n- Tax Practitioners\n- Business Consultants\n- Payroll Administrators"
    },
    {
        question: "What does it cost to join?",
        answer: "Joining requires a R5000 setup fee. This is not a 'lost' fee — the entire amount is immediately converted into R5000 credits in your practice wallet.\n\nFrom these credits, a monthly subscription of R499 is deducted for app hosting, AI tools, and priority support."
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

export default function BecomeAPartnerPage() {
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

      <section className="bg-slate-50 border-y py-20 overflow-hidden">
        <div className="container mx-auto px-4">
            <div className="flex flex-col lg:flex-row items-center gap-12 max-w-6xl mx-auto">
                <div className="lg:w-1/2 space-y-8 text-center lg:text-left">
                    <div className="space-y-4">
                        <Badge className="bg-primary text-white hover:bg-primary border-none px-3 py-1 text-[10px] font-black uppercase tracking-widest">Platform Feature</Badge>
                        <h2 className="text-3xl md:text-4xl lg:text-5xl font-black text-slate-900 leading-tight">
                            Your own <span className="text-primary">branded</span> online store.
                        </h2>
                        <p className="text-xl text-slate-600 font-medium">
                            Sign up and get a fully customizable online store preloaded with 65+ services. Just add your logo, set your prices, and start selling.
                        </p>
                    </div>
                    <div className="flex flex-col sm:flex-row items-center gap-4 justify-center lg:justify-start">
                        <Button asChild size="lg" className="h-14 px-10 text-lg font-bold shadow-xl">
                            <Link href="/partner-signup">Sign up</Link>
                        </Button>
                        <Button asChild variant="outline" size="lg" className="h-14 px-8 border-2 border-slate-200 hover:border-primary hover:text-primary transition-all font-bold">
                            <Link href="https://www.myacc.co.za/p/interscope" target="_blank">
                                View Example Store <ExternalLink className="ml-2 h-4 w-4 opacity-50" />
                            </Link>
                        </Button>
                    </div>
                </div>
                <div className="lg:w-1/2 relative">
                    <div className="bg-white rounded-3xl shadow-2xl border-8 border-slate-900 p-2 overflow-hidden aspect-[16/10] group">
                        <div className="bg-slate-100 h-full w-full rounded-2xl overflow-hidden relative">
                            <div className="absolute top-0 left-0 w-full h-8 bg-white border-b flex items-center px-4 gap-1">
                                <div className="w-2 h-2 rounded-full bg-red-400"></div>
                                <div className="w-2 h-2 rounded-full bg-yellow-400"></div>
                                <div className="w-2 h-2 rounded-full bg-green-400"></div>
                                <div className="ml-4 h-4 w-32 bg-slate-100 rounded-full"></div>
                            </div>
                            <div className="pt-12 p-6 grid grid-cols-2 gap-4">
                                {[1,2,3,4].map(i => (
                                    <div key={i} className="h-24 bg-white rounded-xl border border-slate-200 p-3 space-y-2">
                                        <div className="h-3 w-3/4 bg-slate-100 rounded"></div>
                                        <div className="h-2 w-1/2 bg-slate-50 rounded"></div>
                                        <div className="h-4 w-1/3 bg-primary/10 rounded mt-auto"></div>
                                    </div>
                                ))}
                            </div>
                            <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                <Button className="bg-white text-slate-900 hover:bg-slate-100 font-bold" asChild>
                                    <Link href="https://www.myacc.co.za/p/interscope" target="_blank">Live Preview</Link>
                                </Button>
                            </div>
                        </div>
                    </div>
                    <div className="absolute -top-6 -right-6 h-24 w-24 bg-primary/10 rounded-full blur-2xl -z-10"></div>
                    <div className="absolute -bottom-10 -left-10 h-40 w-40 bg-purple-100 rounded-full blur-3xl -z-10"></div>
                </div>
            </div>
        </div>
      </section>

      <div className="container mx-auto px-4">
        <TrustIndexWidget />
      </div>

      <section className="container mx-auto px-4 scroll-m-20">
        <div className="max-w-4xl mx-auto text-center space-y-8">
            <div className="space-y-4">
                <Badge className="bg-primary/10 text-primary hover:bg-primary/10 border-none px-4 py-1 text-xs font-bold uppercase tracking-widest">About the Initiative</Badge>
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
                
                <Separator className="my-12" />

                <p>
                    The Bookkeeper Empowerment Initiative by My Accountant was created to empower small and growing bookkeepers across South Africa. We know what it’s like to start out — you have the skills, but limited clients, tools, and support. That’s why BEI gives you the technology, mentorship, and opportunities to build your own brand, attract more clients, and scale your income — all while staying independent.
                </p>
                <p>
                    Whether you’re a freelance bookkeeper, a new accounting firm, or a small practitioner, BEI is designed to help you grow faster with less stress.
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
                Join the Bookkeeper Empowerment Initiative and scale your firm 10× — without hiring additional staff.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Button asChild size="lg" className="h-14 px-10 text-lg font-bold shadow-lg">
                    <Link href="/partner-signup">Sign up</Link>
                </Button>
                <BookDemoDialog />
            </div>
        </div>
      </section>
    </div>
  );
}
