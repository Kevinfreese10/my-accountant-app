'use client';

import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useState, useEffect } from 'react';
import { Loader2, ShieldCheck, Rocket, Wallet, Building, Landmark, CheckCircle, FileWarning, CalendarCheck2, FileUp, Phone, Mail } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { getFirestore, addDoc, doc, setDoc, serverTimestamp, collection, Timestamp, getDocs, query, where } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { customAlphabet } from 'nanoid';
import { sendEmail } from '@/lib/email';
import { render } from '@react-email/components';
import WelcomeDiscountEmail from '@/components/emails/WelcomeDiscountEmail';
import { DiscountCode, Task, User } from '@/lib/types';
import NewTaskEmail from '@/components/emails/NewTaskEmail';
import { format } from 'date-fns';
import TrustIndexWidget from '@/components/shared/TrustIndexWidget';
import Link from 'next/link';
import Image from 'next/image';
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';

const db = getFirestore(firebaseApp);
const nanoid = customAlphabet('0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ', 8);

const complianceFormSchema = z.object({
  companyName: z.string().min(2, 'Company name is required.'),
  registrationNumber: z.string().min(5, 'A valid registration number is required.'),
  sarsUsername: z.string().optional(),
  sarsPassword: z.string().optional(),
  yourName: z.string().min(2, 'Your name is required.'),
  yourEmail: z.string().email('A valid email is required.'),
  yourPhone: z.string().min(10, 'A valid phone number is required.'),
});

function ComplianceFormCard({ onComplete }: { onComplete: () => void }) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [isStaffLoading, setIsStaffLoading] = useState(true);
  const [allStaff, setAllStaff] = useState<User[]>([]);
  
  useEffect(() => {
    const fetchStaff = async () => {
        setIsStaffLoading(true);
        try {
            const staffQuery = query(collection(db, "users"), where("role", "in", ["staff", "admin"]));
            const staffSnapshot = await getDocs(staffQuery);
            const fetchedStaff = staffSnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as User));
            setAllStaff(fetchedStaff);
        } catch(e) {
            console.error("Could not fetch staff", e);
        } finally {
            setIsStaffLoading(false);
        }
    };
    fetchStaff();
  }, []);

  const form = useForm<z.infer<typeof complianceFormSchema>>({
    resolver: zodResolver(complianceFormSchema),
    defaultValues: {
      companyName: '',
      registrationNumber: '',
      sarsUsername: '',
      sarsPassword: '',
      yourName: '',
      yourEmail: '',
      yourPhone: '',
    },
  });

  async function handleSubmit(values: z.infer<typeof complianceFormSchema>) {
    setIsLoading(true);
    
    const discountCode = `WELCOME-${nanoid()}`;
    const discountData: Omit<DiscountCode, 'id'> = {
        percentage: 5,
        status: 'active',
        clientEmail: values.yourEmail,
        createdAt: serverTimestamp(),
    };

    try {
      await addDoc(collection(db, 'complianceRequests'), {
        ...values,
        submittedAt: serverTimestamp(),
      });
      
      await setDoc(doc(db, 'discounts', discountCode), discountData);

      const assignedStaff = allStaff.find(u => u.department === 'Administration') || allStaff[0];
      if (assignedStaff) {
          const dueDate = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
          const taskData = {
              title: `Follow up on Compliance Assessment for ${values.companyName}`,
              description: `New request submitted by ${values.yourName} (${values.yourEmail}).`,
              assignedTo: [assignedStaff.id],
              status: 'To-Do',
              priority: 'Medium',
              dueDate: Timestamp.fromDate(dueDate),
              createdBy: 'system',
              createdAt: serverTimestamp(),
              comments: [],
          };
          await addDoc(collection(db, 'tasks'), taskData);
      }

      const emailHtml = render(<WelcomeDiscountEmail name={values.yourName} discountCode={discountCode} />);
      await sendEmail({
        to: values.yourEmail,
        subject: `Your Free Compliance Assessment & 5% Discount!`,
        html: emailHtml,
      });

      toast({
        title: 'Request Submitted!',
        description: "We've received your request and sent a welcome email.",
      });

      form.reset();
      onComplete();

    } catch(error) {
       toast({ title: 'Error', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField control={form.control} name="companyName" render={({ field }) => ( <FormItem><FormLabel>Company Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )}/>
            <FormField control={form.control} name="registrationNumber" render={({ field }) => ( <FormItem><FormLabel>Registration Number</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )}/>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField control={form.control} name="yourName" render={({ field }) => ( <FormItem><FormLabel>Your Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )}/>
                <FormField control={form.control} name="yourEmail" render={({ field }) => ( <FormItem><FormLabel>Your Email</FormLabel><FormControl><Input type="email" {...field} /></FormControl><FormMessage /></FormItem> )}/>
            </div>
            <FormField control={form.control} name="yourPhone" render={({ field }) => ( <FormItem><FormLabel>Your Phone Number</FormLabel><FormControl><Input type="tel" {...field} /></FormControl><FormMessage /></FormItem> )}/>
            <Button type="submit" disabled={isLoading} className="w-full">
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Sign Up & Get Discount
            </Button>
        </form>
    </Form>
  )
}

export default function CompliancePageClient() {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isComplete, setIsComplete] = useState(false);

  const sarsServices = [
    { title: "Tax Clearance Pins:", description: "Same-day issue for R250." },
    { title: "Income Tax Registration:", description: "Register your business and directors with SARS." },
    { title: "VAT Registration:", description: "For businesses earning over R1 million or voluntarily from R50 000+." },
    { title: "PAYE, UIF & SDL Registration:", description: "Stay compliant with employment laws." },
    { title: "Tax Returns & Submissions:", description: "Including Income Tax, VAT, PAYE, and Provisional Tax." },
    { title: "SARS Compliance Review:", description: "Identify risks, outstanding returns, and penalties." },
    { title: "Remission of Fines & Penalties:", description: "We negotiate with SARS to reduce or remove penalties." },
  ];

  const cipcServices = [
    { title: "Company Registration:", description: "Fast online setup with documents delivered to your inbox." },
    { title: "Amendments:", description: "Update director details, company name, or address." },
    { title: "Beneficial Ownership Declaration:", description: "Compliant with the new CIPC requirements." },
    { title: "Annual Returns:", description: "Ensure your company remains in good standing." },
    { title: "Reinstatements:", description: "Restore deregistered companies quickly and legally." },
    { title: "Securities Register:", description: "Issued in terms of the Companies Act for transparency." },
  ];

  const whyChooseUs = [
    { title: 'Same-day service options', description: 'for urgent SARS or CIPC filings.', icon: Rocket },
    { title: 'Affordable pricing', description: 'no hidden fees, just transparent packages.', icon: Wallet },
    { title: 'Trusted experts', description: 'over 150 five-star reviews.', icon: ShieldCheck },
    { title: 'Free compliance assessment', description: 'includes a health check (valued at R250).', icon: CalendarCheck2 },
    { title: 'All-in-one platform', description: 'track orders and upload documents online.', icon: FileUp },
    { title: 'Common mistakes fixed', description: 'We identify issues before they affect you.', icon: FileWarning },
  ];

  const keywordButtons = [
    { label: 'Entity Registrations', href: '/products#entity-registrations' },
    { label: 'SARS Services', href: '/products#sars-services' },
    { label: 'CIPC Services', href: '/products#cipc-services' },
    { label: 'Accounting Services', href: '/products#accounting-services' },
    { label: 'Payroll Services', href: '/products#payroll-services' },
  ];

  return (
     <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <div className="space-y-16 pb-16 bg-white">
        {/* HERO SECTION */}
        <section className="relative w-full overflow-hidden bg-white pt-16 lg:pt-24 pb-20 border-b">
            <div className="container relative z-10 mx-auto px-4 text-center">
                <h1 className="mb-6 text-4xl font-black tracking-tight text-slate-900 md:text-5xl lg:text-6xl">
                    Free <span className="text-gradient">#Compliance</span> Check
                </h1>
                <p className="text-lg sm:text-xl md:text-2xl font-medium text-muted-foreground max-w-3xl mx-auto">
                    Ensure your business is compliant with CIPC and SARS. Enter your details for a free assessment and get 5% off your next service.
                </p>
                <div className="flex flex-col gap-4 sm:flex-row sm:justify-center pt-4">
                    <DialogTrigger asChild>
                        <Button size="lg" className="font-bold px-10 shadow-xl">Get My Free Assessment</Button>
                    </DialogTrigger>
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

         <section className="bg-white py-16">
            <div className="container mx-auto px-4">
                <div className="text-center mb-12">
                    <h2 className="text-3xl font-bold">🧾 SARS &amp; CIPC Compliance</h2>
                </div>
                <div className="mt-12 space-y-8">
                    <Card className="border-2 bg-slate-50 shadow-sm">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-3"><Landmark className="h-6 w-6 text-primary"/> SARS Compliance</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <ul className="space-y-4 text-sm">
                                {sarsServices.map((service, index) => (
                                    <li key={index} className="grid grid-cols-1 sm:grid-cols-[1fr_2fr] items-start gap-x-4 p-3 bg-white rounded-lg border border-slate-100">
                                        <div className="flex items-start gap-2 font-semibold">
                                            <CheckCircle className="h-4 w-4 mt-0.5 text-green-500"/> 
                                            <span>{service.title}</span>
                                        </div>
                                        <div className="text-muted-foreground sm:pl-6">{service.description}</div>
                                    </li>
                                ))}
                            </ul>
                        </CardContent>
                    </Card>

                    <Card className="border-2 bg-slate-50 shadow-sm">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-3"><Building className="h-6 w-6 text-primary"/> CIPC Compliance</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <ul className="space-y-4 text-sm">
                                {cipcServices.map((service, index) => (
                                    <li key={index} className="grid grid-cols-1 sm:grid-cols-[1fr_2fr] items-start gap-x-4 p-3 bg-white rounded-lg border border-slate-100">
                                        <div className="flex items-start gap-2 font-semibold">
                                            <CheckCircle className="h-4 w-4 mt-0.5 text-green-500"/> 
                                            <span>{service.title}</span>
                                        </div>
                                        <div className="text-muted-foreground sm:pl-6">{service.description}</div>
                                    </li>
                                ))}
                            </ul>
                        </CardContent>
                    </Card>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 mt-24">
                    {whyChooseUs.map((item) => (
                        <div key={item.title} className="text-center p-6 bg-slate-50 rounded-2xl border border-slate-100">
                            <div className="flex justify-center mb-4">
                                <div className="bg-primary/10 rounded-full h-16 w-16 flex items-center justify-center">
                                    <item.icon className="h-8 w-8 text-primary" />
                                </div>
                            </div>
                            <h4 className="font-bold text-lg">{item.title}</h4>
                            <p className="text-muted-foreground text-sm">{item.description}</p>
                        </div>
                    ))}
                </div>
            </div>
        </section>

        {isComplete && (
             <section className="container mx-auto max-w-2xl px-4 py-12 scroll-m-20">
                <Alert className="bg-green-50 border-green-200">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <AlertTitle className="text-green-800">Thank You!</AlertTitle>
                    <AlertDescription className="text-green-700">
                        Your request has been submitted. Check your email for your 5% discount code.
                    </AlertDescription>
                </Alert>
             </section>
        )}
        
        </div>
        <DialogContent className="sm:max-w-xl">
             <DialogHeader>
                <DialogTitle>Free Compliance Assessment</DialogTitle>
                <DialogDescription>
                Enter your details and we'll perform a free check for your company.
                </DialogDescription>
            </DialogHeader>
            <ComplianceFormCard onComplete={() => { setIsComplete(true); setIsFormOpen(false); }} />
        </DialogContent>
     </Dialog>
  );
}
