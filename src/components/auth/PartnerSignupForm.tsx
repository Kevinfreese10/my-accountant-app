'use client';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Checkbox } from '../ui/checkbox';
import { Separator } from '../ui/separator';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { getFirestore, doc, setDoc, collection, getDocs, query, orderBy, where, serverTimestamp } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { useState, useEffect, useMemo } from 'react';
import { Loader2, Wallet2, Zap, Briefcase, CheckCircle2, BadgeCheck } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Service, Order, User } from '@/lib/types';
import { sendEmail } from '@/lib/email';
import { render } from '@react-email/components';
import PartnerWelcomeEmail from '../emails/PartnerWelcomeEmail';
import { getNextOrderId } from '@/lib/sequence';
import { Timestamp } from 'firebase/firestore';
import { Badge } from '../ui/badge';
import { cn } from '@/lib/utils';

const auth = getAuth(firebaseApp);
const db = getFirestore(firebaseApp);
const storage = getStorage(firebaseApp);

const formSchema = z.object({
  partnerTier: z.enum(['starter', 'full']).default('starter'),
  companyName: z.string().min(2, 'Company name is required.'),
  name: z.string().min(2, 'First name is required.'),
  surname: z.string().min(2, 'Surname is required.'),
  email: z.string().email('Please enter a valid email.'),
  password: z.string().min(6, 'Password must be at least 6 characters.'),
  contactNumber: z.string().min(10, 'A valid contact number is required.'),
  wantsOutsourcedWork: z.boolean().default(false),
  cv: z.any().optional(),
  certificate: z.any().optional(),
  agreeTerms: z.boolean().refine(val => val === true, {
    message: 'You must accept the terms and conditions.',
  }),
  capableServices: z.array(z.string()).optional(),
}).refine(data => {
    if (data.partnerTier === 'full' && data.wantsOutsourcedWork) {
      return data.cv?.[0] && data.certificate?.[0];
    }
    return true;
}, {
    message: 'CV and Certificate are required to be considered for outsourced work.',
    path: ['wantsOutsourcedWork'],
});

type Category = { 
    id: string; 
    name: string; 
    description: string; 
    order: number; 
};

export default function PartnerSignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialTier = searchParams.get('tier') as 'starter' | 'full' | null;
  
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const { user: adminUser, login } = useAuth();
  const [allServices, setAllServices] = useState<Service[]>([]);
  const [allCategories, setAllCategories] = useState<Category[]>([]);
  const [isServicesLoading, setIsServicesLoading] = useState(true);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      partnerTier: initialTier || 'starter',
      companyName: '',
      name: '',
      surname: '',
      email: '',
      password: '',
      contactNumber: '',
      wantsOutsourcedWork: false,
      agreeTerms: false,
      capableServices: [],
    },
  });
  
  useEffect(() => {
    const fetchServicesAndCategories = async () => {
        setIsServicesLoading(true);
        try {
            const servicesQuery = query(collection(db, "services"), orderBy("title"));
            const servicesSnapshot = await getDocs(servicesQuery);
            const fetchedServices = servicesSnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Service));
            setAllServices(fetchedServices);

            const categoriesQuery = query(collection(db, "categories"), orderBy("order"));
            const categoriesSnapshot = await getDocs(categoriesQuery);
            const fetchedCategories = categoriesSnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Category));
            setAllCategories(fetchedCategories);

        } catch (error) {
            console.error("Error fetching data:", error);
        } finally {
            setIsServicesLoading(false);
        }
    };
    fetchServicesAndCategories();
  }, []);

  const categorizedServices = useMemo(() => {
    if (!allCategories.length || !allServices.length) return [];
    return allCategories
      .map(category => ({
        ...category,
        services: allServices.filter(service => service.category === category.name),
      }))
      .filter(category => category.services.length > 0);
  }, [allCategories, allServices]);

  const partnerTier = form.watch('partnerTier');
  const wantsOutsourcedWork = form.watch('wantsOutsourcedWork');

  const uploadFile = async (file: File, path: string): Promise<string> => {
    const fileRef = ref(storage, path);
    await uploadBytes(fileRef, file);
    return await getDownloadURL(fileRef);
  };

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsLoading(true);
    try {
        const { password, cv, certificate, ...partnerData } = values;

        const userCredential = await createUserWithEmailAndPassword(auth, values.email, values.password);
        const newFirebaseUser = userCredential.user;
        const authUid = newFirebaseUser.uid;
        
        let cvUrl = '';
        let certificateUrl = '';

        if (values.partnerTier === 'full' && values.wantsOutsourcedWork && values.cv?.[0] && values.certificate?.[0]) {
            toast({ title: 'Uploading Documents...', description: 'Please wait while we upload your files.' });
            cvUrl = await uploadFile(values.cv[0], `partner-applications/${authUid}/cv-${values.cv[0].name}`);
            certificateUrl = await uploadFile(values.certificate[0], `partner-applications/${authUid}/certificate-${values.certificate[0].name}`);
        }
        
        const contactPersonFullName = `${values.name} ${values.surname}`;

        const newUserDocRef = doc(db, "users", authUid);
        await setDoc(newUserDocRef, {
            ...partnerData,
            contactPerson: contactPersonFullName,
            name: contactPersonFullName,
            id: authUid,
            uid: authUid,
            role: 'partner',
            status: 'Active',
            creditBalance: 0,
            createdAt: serverTimestamp(),
            cvUrl: cvUrl,
            certificateUrl: certificateUrl,
            subscription: {
                monthlyTotal: values.partnerTier === 'full' ? 0 : 0, // No monthly subscription fee
                subscriptionStatus: 'active',
                lastBillingDate: serverTimestamp(),
            }
        });

        // Send welcome email
        try {
            const emailHtml = render(<PartnerWelcomeEmail 
                partnerName={values.name} 
                email={values.email}
                password={values.password}
                loginUrl={`${process.env.NEXT_PUBLIC_APP_URL}/login`} 
            />);

            await sendEmail({
                to: values.email,
                subject: `Welcome to the My Accountant Partner Program!`,
                html: emailHtml,
            });
        } catch (e) {
            console.error("Welcome email failed", e);
        }
        
        await login(values.email, values.password);

        toast({
            title: 'Welcome Aboard!',
            description: `Your ${values.partnerTier === 'full' ? 'Full Practice' : 'Starter Partner'} account is active.`,
        });
        
        router.push('/partner/dashboard');

    } catch (error: any) {
        console.error("Partner signup error:", error);
        let description = 'There was a problem creating your account.';
        if (error.code === 'auth/email-already-in-use') {
            description = 'An account with this email already exists.';
        }
        toast({ title: 'Signup Failed', description, variant: 'destructive' });
        setIsLoading(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        
        <div className="space-y-4">
            <h3 className="text-lg font-bold flex items-center gap-2">
                <BadgeCheck className="h-5 w-5 text-primary" />
                Step 1: Choose Your Tier
            </h3>
            <FormField
                control={form.control}
                name="partnerTier"
                render={({ field }) => (
                    <FormItem>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div 
                                className={cn(
                                    "relative p-6 rounded-2xl border-2 cursor-pointer transition-all flex flex-col items-center",
                                    field.value === 'starter' ? "border-primary bg-primary/5 shadow-md ring-4 ring-primary/10" : "border-muted opacity-60 hover:opacity-100",
                                    initialTier && initialTier !== 'starter' && "hidden"
                                )}
                                onClick={() => !initialTier && field.onChange('starter')}
                            >
                                <Zap className={cn("h-8 w-8 mb-3", field.value === "starter" ? "text-primary" : "text-muted-foreground")} />
                                <p className="font-black uppercase tracking-tight text-lg">Starter</p>
                                <Badge variant="outline" className="mt-1">10% DISCOUNT</Badge>
                                <p className="text-[10px] text-muted-foreground mt-4 text-center leading-relaxed">Free setup. All orders outsourced to us. Simple toolset.</p>
                                <div className={cn("mt-4 h-6 w-6 rounded-full border-2 flex items-center justify-center", field.value === "starter" ? "border-primary bg-primary" : "border-muted")}>
                                    {field.value === "starter" && <CheckCircle2 className="h-4 w-4 text-white" />}
                                </div>
                            </div>

                            <div 
                                className={cn(
                                    "relative p-6 rounded-2xl border-2 cursor-pointer transition-all flex flex-col items-center",
                                    field.value === 'full' ? "border-primary bg-primary/5 shadow-md ring-4 ring-primary/10" : "border-muted opacity-60 hover:opacity-100",
                                    initialTier && initialTier !== 'full' && "hidden"
                                )}
                                onClick={() => !initialTier && field.onChange('full')}
                            >
                                <Briefcase className={cn("h-8 w-8 mb-3", field.value === "full" ? "text-primary" : "text-muted-foreground")} />
                                <p className="font-black uppercase tracking-tight text-lg">Full Practice</p>
                                <Badge variant="default" className="mt-1 bg-green-600">25% DISCOUNT</Badge>
                                <p className="text-[10px] text-muted-foreground mt-4 text-center leading-relaxed">Free setup. Full white-label dashboard. Staff management. Custom branding.</p>
                                <div className={cn("mt-4 h-6 w-6 rounded-full border-2 flex items-center justify-center", field.value === "full" ? "border-primary bg-primary" : "border-muted")}>
                                    {field.value === "full" && <CheckCircle2 className="h-4 w-4 text-white" />}
                                </div>
                            </div>
                        </div>
                        {initialTier && (
                            <p className="text-[10px] text-center text-muted-foreground italic mt-2">
                                Tier locked based on your selection. <Link href="/BEI" className="underline">Change selection?</Link>
                            </p>
                        )}
                    </FormItem>
                )}
            />
        </div>

        <Separator />

        <div className="space-y-4">
             <h3 className="text-lg font-medium">Practice Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField control={form.control} name="companyName" render={({ field }) => ( <FormItem><FormLabel>Company Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="name" render={({ field }) => ( <FormItem><FormLabel>Contact Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="surname" render={({ field }) => ( <FormItem><FormLabel>Contact Surname</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="email" render={({ field }) => ( <FormItem><FormLabel>Login Email Address</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                 <FormField control={form.control} name="password" render={({ field }) => ( <FormItem><FormLabel>Create Password</FormLabel><FormControl><Input type="password" {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="contactNumber" render={({ field }) => ( <FormItem><FormLabel>Contact Number</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
            </div>
        </div>
        
        {partnerTier === 'full' && (
            <>
            <Separator />
            <div className="space-y-4 animate-in fade-in slide-in-from-top-4 duration-500">
                <div className="flex items-center justify-between">
                    <h3 className="text-lg font-medium">Overflow Work & Capabilities (Optional)</h3>
                    <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20">FULL TIER ONLY</Badge>
                </div>
                <FormField
                    control={form.control}
                    name="wantsOutsourcedWork"
                    render={({ field }) => (
                        <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4 bg-muted/20">
                        <FormControl>
                            <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                            <FormLabel className="font-bold">
                                Apply for the Overflow Work Program?
                            </FormLabel>
                            <p className="text-xs text-muted-foreground leading-relaxed mt-1">
                                We regularly have more work than our team can handle. If you are a member of a professional body, we can outsource overflow projects to your practice at wholesale rates.
                            </p>
                        </div>
                        </FormItem>
                    )}
                />
                {wantsOutsourcedWork && (
                    <div className="space-y-6 pt-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="cv"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-xs">Upload Professional CV (PDF)</FormLabel>
                                        <FormControl>
                                            <Input type="file" accept=".pdf" onChange={(e) => field.onChange(e.target.files)} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="certificate"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-xs">Professional Certificate / Membership Proof</FormLabel>
                                        <FormControl>
                                            <Input type="file" accept=".pdf,.jpg,.png" onChange={(e) => field.onChange(e.target.files)} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>
                        <FormField
                        control={form.control}
                        name="capableServices"
                        render={() => (
                            <FormItem>
                            <div className="mb-4">
                                <FormLabel className="text-base">Service Expertise</FormLabel>
                                <p className="text-sm text-muted-foreground">
                                Select services you are qualified to handle for the network.
                                </p>
                            </div>
                            <div className="space-y-4 max-h-60 overflow-y-auto p-4 border rounded-lg">
                                {categorizedServices.map(category => (
                                    <div key={category.id}>
                                        <h4 className="font-bold text-xs uppercase text-primary mb-3">{category.name}</h4>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
                                            {category.services.map((service) => (
                                                <FormField
                                                    key={service.id}
                                                    control={form.control}
                                                    name="capableServices"
                                                    render={({ field }) => (
                                                        <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                                                        <FormControl>
                                                            <Checkbox
                                                            checked={field.value?.includes(service.id)}
                                                            onCheckedChange={(checked) => {
                                                                return checked
                                                                ? field.onChange([...(field.value || []), service.id])
                                                                : field.onChange(
                                                                    field.value?.filter(
                                                                        (value) => value !== service.id
                                                                    )
                                                                )
                                                            }}
                                                            />
                                                        </FormControl>
                                                        <FormLabel className="font-normal text-xs">
                                                            {service.title}
                                                        </FormLabel>
                                                        </FormItem>
                                                    )}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                            </FormItem>
                        )}
                        />
                    </div>
                )}
            </div>
            </>
        )}

        <Separator />

        <div className="bg-green-50 p-6 rounded-lg border border-green-100 space-y-4">
            <h3 className="text-lg font-bold flex items-center gap-2 text-green-800">
                <CheckCircle2 className="h-5 w-5" />
                Zero Setup Fees
            </h3>
            <p className="text-sm text-green-700">
                Joining the Bookkeeper Empowerment Initiative is now free for all practitioners. You only need credits when you choose to outsource an order to our team.
            </p>
        </div>

        <FormField
            control={form.control}
            name="agreeTerms"
            render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                <FormControl>
                    <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                </FormControl>
                <div className="space-y-1 leading-none">
                    <FormLabel>
                        I agree to the <Link href="/terms" className="underline" target="_blank">terms and conditions</Link> and understand that I will need to maintain a credit balance only for outsourced services.
                    </FormLabel>
                    <FormMessage />
                </div>
                </FormItem>
            )}
        />
        
        <Button type="submit" className="w-full h-14 text-lg font-black shadow-xl" disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isLoading ? 'Processing...' : 'Complete Free Registration'}
        </Button>
      </form>
    </Form>
  );
}
