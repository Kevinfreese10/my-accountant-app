'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Store, MapPin, ArrowRight, ArrowLeft, CheckCircle2, ShieldCheck, Wallet, Globe } from 'lucide-react';
import { getFirestore, doc, setDoc, serverTimestamp, collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import { firebaseApp } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { Separator } from '@/components/ui/separator';
import { checkTerritoryAvailability } from '@/app/actions';
import { cn } from '@/lib/utils';
import Link from 'next/link';

const db = getFirestore(firebaseApp);
const auth = getAuth(firebaseApp);

const RESERVED_SLUGS = ['admin', 'login', 'signup', 'api', 'dashboard', 'partner', 'p', 'products', 'blog', 'about', 'contact', 'compliance', 'terms', 'popia', 'refund-policy', 'support', 'franchise', 'franchise-signup'];

const formSchema = z.object({
  // Step 1: Personal Info
  name: z.string().min(2, 'First name is required.'),
  surname: z.string().min(2, 'Surname is required.'),
  email: z.string().email('Please enter a valid email.'),
  password: z.string().min(6, 'Password must be at least 6 characters.'),
  phone: z.string().min(10, 'A valid phone number is required.'),
  
  // Step 2: Territory
  areaName: z.string().min(2, 'Area name is required (e.g. Sandton).'),
  areaSlug: z.string()
    .min(3, 'Slug must be at least 3 characters')
    .regex(/^[a-z0-9-]+$/, 'Slug can only contain lowercase letters, numbers and hyphens')
    .refine(val => !RESERVED_SLUGS.includes(val), { message: "This name is reserved for system use." }),
  
  agreeTerms: z.boolean().refine(val => val === true, {
    message: 'You must accept the terms.',
  }),
});

export default function FranchiseSignupPage() {
  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingSlug, setIsCheckingSlug] = useState(false);
  const { toast } = useToast();
  const { reauthenticate } = useAuth();
  const router = useRouter();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      surname: '',
      email: '',
      password: '',
      phone: '',
      areaName: '',
      areaSlug: '',
      agreeTerms: false,
    },
  });

  const handleNext = async () => {
    const fields = step === 1 
        ? ['name', 'surname', 'email', 'password', 'phone'] as const
        : ['areaName', 'areaSlug'] as const;
    
    const isValid = await form.trigger(fields);
    if (!isValid) return;

    if (step === 2) {
        setIsCheckingSlug(true);
        const slug = form.getValues('areaSlug');
        const res = await checkTerritoryAvailability(slug);
        setIsCheckingSlug(false);

        if (!res.available) {
            form.setError('areaSlug', { message: 'This territory is already claimed by another franchisee.' });
            return;
        }
    }

    setStep(step + 1);
  };

  const handleSlugAuto = (val: string) => {
      const slug = val.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]+/g, '');
      form.setValue('areaSlug', slug, { shouldValidate: true });
  };

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    setIsLoading(true);
    try {
        const userCredential = await createUserWithEmailAndPassword(auth, values.email, values.password);
        const firebaseUser = userCredential.user;
        const authUid = firebaseUser.uid;

        const franchiseeData = {
            id: authUid,
            uid: authUid,
            name: `${values.name} ${values.surname}`,
            email: values.email,
            contactNumber: values.phone,
            role: 'franchisee',
            status: 'Pending Setup Payment',
            source: 'Franchise',
            creditBalance: 0,
            createdAt: serverTimestamp(),
            franchise: {
                areaName: values.areaName,
                areaSlug: values.areaSlug,
                royaltyPercentage: 10,
                setupFeePaid: false,
            }
        };

        await setDoc(doc(db, 'users', authUid), franchiseeData);
        await reauthenticate(firebaseUser);

        toast({ title: "Account Registered", description: "Your franchise profile is pending R10,000 setup payment." });
        router.push('/partner/dashboard'); // Franchisees share the dashboard view for now

    } catch (error: any) {
        console.error(error);
        const msg = error.code === 'auth/email-already-in-use' ? 'Email already registered.' : 'Signup failed. Please try again.';
        toast({ title: "Error", description: msg, variant: "destructive" });
    } finally {
        setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-4 sm:p-6 lg:p-8">
      <div className="w-full max-w-2xl space-y-8">
        <div className="text-center space-y-2">
            <Link href="/" className="text-2xl font-black text-primary">My Accountant</Link>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">Franchise Onboarding</h1>
            <div className="flex justify-center items-center gap-2">
                {[1, 2, 3].map(i => (
                    <div key={i} className={cn("h-2 w-12 rounded-full transition-all", step >= i ? "bg-primary" : "bg-slate-200")} />
                ))}
            </div>
        </div>

        <Card className="border-2 shadow-xl">
          <CardContent className="pt-8">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                {step === 1 && (
                  <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
                    <div className="space-y-4">
                        <h3 className="text-lg font-bold flex items-center gap-2"><Store className="h-5 w-5 text-primary" /> Personal Information</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <FormField control={form.control} name="name" render={({ field }) => ( <FormItem><FormLabel>First Name</FormLabel><FormControl><Input placeholder="John" {...field} /></FormControl><FormMessage /></FormItem>)} />
                            <FormField control={form.control} name="surname" render={({ field }) => ( <FormItem><FormLabel>Surname</FormLabel><FormControl><Input placeholder="Doe" {...field} /></FormControl><FormMessage /></FormItem>)} />
                        </div>
                        <FormField control={form.control} name="email" render={({ field }) => ( <FormItem><FormLabel>Email Address</FormLabel><FormControl><Input placeholder="john@example.com" {...field} /></FormControl><FormMessage /></FormItem>)} />
                        <FormField control={form.control} name="password" render={({ field }) => ( <FormItem><FormLabel>Create Password</FormLabel><FormControl><Input type="password" {...field} /></FormControl><FormMessage /></FormItem>)} />
                        <FormField control={form.control} name="phone" render={({ field }) => ( <FormItem><FormLabel>Contact Number</FormLabel><FormControl><Input placeholder="082 123 4567" {...field} /></FormControl><FormMessage /></FormItem>)} />
                    </div>
                    <Button type="button" onClick={handleNext} className="w-full h-12 font-bold">Continue to Territory</Button>
                  </div>
                )}

                {step === 2 && (
                  <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
                    <div className="space-y-4">
                        <h3 className="text-lg font-bold flex items-center gap-2"><MapPin className="h-5 w-5 text-primary" /> Territory Selection</h3>
                        <FormField control={form.control} name="areaName" render={({ field }) => ( 
                            <FormItem>
                                <FormLabel>Target Area / Branch Name</FormLabel>
                                <FormControl><Input placeholder="e.g. Sandton" {...field} onChange={(e) => { field.onChange(e); handleSlugAuto(e.target.value); }} /></FormControl>
                                <FormDescription className="text-[10px]">Enter the name of the area you wish to own.</FormDescription>
                                <FormMessage />
                            </FormItem>
                        )} />
                        <FormField control={form.control} name="areaSlug" render={({ field }) => ( 
                            <FormItem>
                                <FormLabel>Desired Store URL Slug</FormLabel>
                                <div className="flex items-center gap-2">
                                    <span className="text-xs text-muted-foreground font-mono">myacc.co.za/</span>
                                    <FormControl className="flex-grow"><Input {...field} /></FormControl>
                                </div>
                                <FormMessage />
                            </FormItem>
                        )} />
                    </div>
                    <div className="flex gap-3">
                        <Button type="button" variant="outline" onClick={() => setStep(1)} className="w-1/3 h-12">Back</Button>
                        <Button type="button" onClick={handleNext} className="w-2/3 h-12 font-bold" disabled={isCheckingSlug}>
                            {isCheckingSlug && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Check Availability
                        </Button>
                    </div>
                  </div>
                )}

                {step === 3 && (
                  <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
                    <div className="space-y-6">
                        <div className="p-6 bg-primary/5 rounded-xl border border-primary/10 space-y-4">
                            <h3 className="text-lg font-bold flex items-center gap-2 text-primary"><ShieldCheck className="h-5 w-5" /> Summary & Legal</h3>
                            <div className="space-y-2 text-sm">
                                <div className="flex justify-between font-medium"><span>Franchise Role:</span> <span>My Accountant {form.getValues('areaName')}</span></div>
                                <div className="flex justify-between font-medium"><span>Store URL:</span> <span className="text-primary font-bold">myacc.co.za/{form.getValues('areaSlug')}</span></div>
                                <Separator className="my-2" />
                                <div className="flex justify-between items-center"><span className="text-muted-foreground">Setup Fee:</span> <span className="font-bold text-lg">R10,000.00</span></div>
                                <div className="flex justify-between items-center"><span className="text-muted-foreground">Sales Royalty:</span> <span className="font-bold">10%</span></div>
                            </div>
                        </div>

                        <FormField control={form.control} name="agreeTerms" render={({ field }) => (
                            <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4 bg-white">
                                <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                                <div className="space-y-1 leading-none">
                                    <FormLabel className="font-bold cursor-pointer">Agree to Franchise Terms</FormLabel>
                                    <p className="text-[10px] text-muted-foreground leading-relaxed">I understand that my franchise territory is locked upon payment of the R10,000 setup fee and that a 10% royalty applies to all sales.</p>
                                </div>
                            </FormItem>
                        )} />
                    </div>
                    <div className="flex gap-3">
                        <Button type="button" variant="outline" onClick={() => setStep(2)} className="w-1/3 h-12" disabled={isLoading}>Back</Button>
                        <Button type="submit" className="w-2/3 h-12 font-black text-lg shadow-lg" disabled={isLoading}>
                            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wallet className="mr-2 h-5 w-5" />}
                            Complete Registration
                        </Button>
                    </div>
                  </div>
                )}
              </form>
            </Form>
          </CardContent>
        </Card>
        
        <div className="text-center text-xs text-muted-foreground">
            <p>© {new Date().getFullYear()} My Accountant (Pty) Ltd. Franchise Program.</p>
        </div>
      </div>
    </div>
  );
}
