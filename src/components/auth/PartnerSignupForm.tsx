'use client';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Checkbox } from '../ui/checkbox';
import { Label } from '../ui/label';
import { Separator } from '../ui/separator';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { getFirestore, doc, setDoc, collection, getDocs, query, orderBy, where, serverTimestamp } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { useState, useEffect, useMemo } from 'react';
import { Loader2, Briefcase, CheckCircle2, UserPlus, Wallet2, CreditCard } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Service, Order } from '@/lib/types';
import { sendEmail } from '@/lib/email';
import { render } from '@react-email/components';
import PartnerWelcomeEmail from '../emails/PartnerWelcomeEmail';
import { getNextOrderId } from '@/lib/sequence';
import { Timestamp } from 'firebase/firestore';

const auth = getAuth(firebaseApp);
const db = getFirestore(firebaseApp);
const storage = getStorage(firebaseApp);

const formSchema = z.object({
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
    if (data.wantsOutsourcedWork) {
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
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [step, setStep] = useState(1);
  const { reauthenticate } = useAuth();
  const [allServices, setAllServices] = useState<Service[]>([]);
  const [allCategories, setAllCategories] = useState<Category[]>([]);
  const [isServicesLoading, setIsServicesLoading] = useState(true);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
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

        if (values.wantsOutsourcedWork && values.cv?.[0] && values.certificate?.[0]) {
            toast({ title: 'Uploading Documents...', description: 'Please wait while we upload your files.' });
            cvUrl = await uploadFile(values.cv[0], `partner-applications/${authUid}/cv-${values.cv[0].name}`);
            certificateUrl = await uploadFile(values.certificate[0], `partner-applications/${authUid}/certificate-${values.certificate[0].name}`);
        }
        
        const contactPersonFullName = `${values.name} ${values.surname}`;

        // Create the setup fee order
        const setupOrderId = await getNextOrderId();
        const setupFeePrice = 4950;
        const setupOrder: Order = {
            id: setupOrderId,
            userId: authUid,
            customerName: values.companyName || contactPersonFullName,
            customerEmail: values.email,
            items: [{
                id: 'partner_setup_fee',
                title: 'BEI Practice Setup & Onboarding Fee',
                price: setupFeePrice,
                quantity: 1,
            }],
            total: setupFeePrice,
            discountCode: null,
            discountAmount: null,
            status: 'Pending Payment',
            date: Timestamp.now(),
            source: 'Partner',
            resellerId: authUid,
        };

        await setDoc(doc(db, 'orders', setupOrderId), setupOrder);

        // Create the User Document - Status is Pending until setup fee is paid
        const newUserDocRef = doc(db, "users", authUid);
        await setDoc(newUserDocRef, {
            ...partnerData,
            partnerTier: 'full',
            contactPerson: contactPersonFullName,
            name: contactPersonFullName,
            id: authUid,
            uid: authUid,
            role: 'partner',
            status: 'Pending Setup Payment', 
            creditBalance: 0,
            createdAt: serverTimestamp(),
            cvUrl: cvUrl,
            certificateUrl: certificateUrl,
            subscription: {
                monthlyTotal: 0,
                subscriptionStatus: 'active',
                lastBillingDate: serverTimestamp(),
            }
        });

        // Trigger manual re-auth logic
        await reauthenticate(newFirebaseUser);

        // Send welcome email (credentials)
        try {
            const emailHtml = render(<PartnerWelcomeEmail 
                partnerName={values.name} 
                email={values.email}
                password={values.password}
                loginUrl={`${process.env.NEXT_PUBLIC_APP_URL}/login`} 
            />);

            await sendEmail({
                to: values.email,
                cc: 'kev@thinkestry.co.za',
                subject: `Welcome to the My Accountant Partner Program!`,
                html: emailHtml,
            });
        } catch (e) {
            console.error("Welcome email failed", e);
        }
        
        toast({
            title: 'Account Registered',
            description: `Redirecting to payment for setup activation...`,
        });
        
        // Redirect to order confirmation page for the setup fee
        router.push(`/order-confirmation/${setupOrderId}`);

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

  const handleNext = async () => {
      const isValid = await form.trigger(['companyName', 'name', 'surname', 'email', 'password', 'contactNumber']);
      if (isValid) setStep(2);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        
        {step === 1 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
                <div className="space-y-4">
                    <h3 className="text-lg font-bold flex items-center gap-2">
                        <UserPlus className="h-5 w-5 text-primary" />
                        Step 1: Practice Information
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField control={form.control} name="companyName" render={({ field }) => ( <FormItem><FormLabel>Company Name</FormLabel><FormControl><Input placeholder="Acme Consulting" {...field} /></FormControl><FormMessage /></FormItem>)} />
                        <FormField control={form.control} name="contactNumber" render={({ field }) => ( <FormItem><FormLabel>Contact Number</FormLabel><FormControl><Input placeholder="082 123 4567" {...field} /></FormControl><FormMessage /></FormItem>)} />
                        <FormField control={form.control} name="name" render={({ field }) => ( <FormItem><FormLabel>Contact First Name</FormLabel><FormControl><Input placeholder="John" {...field} /></FormControl><FormMessage /></FormItem>)} />
                        <FormField control={form.control} name="surname" render={({ field }) => ( <FormItem><FormLabel>Contact Surname</FormLabel><FormControl><Input placeholder="Doe" {...field} /></FormControl><FormMessage /></FormItem>)} />
                        <FormField control={form.control} name="email" render={({ field }) => ( <FormItem><FormLabel>Login Email Address</FormLabel><FormControl><Input placeholder="john@acme.co.za" {...field} /></FormControl><FormMessage /></FormItem>)} />
                        <FormField control={form.control} name="password" render={({ field }) => ( <FormItem><FormLabel>Create Password</FormLabel><FormControl><Input type="password" placeholder="••••••••" {...field} /></FormControl><FormMessage /></FormItem>)} />
                    </div>
                </div>
                <Button type="button" onClick={handleNext} className="w-full h-12 font-bold">Next: Capabilities & Documents</Button>
            </div>
        )}

        {step === 2 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h3 className="text-lg font-bold flex items-center gap-2">
                            <Briefcase className="h-5 w-5 text-primary" />
                            Step 2: Overflow Work & Capabilities (Optional)
                        </h3>
                    </div>
                    <FormField
                        control={form.control}
                        name="wantsOutsourcedWork"
                        render={({ field }) => (
                            <FormItem className="flex flex-col space-y-3 rounded-md border p-4 bg-muted/20">
                                <div className="flex flex-row items-start space-x-3">
                                    <FormControl>
                                        <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                                    </FormControl>
                                    <div className="space-y-1 leading-none">
                                        <FormLabel className="font-bold cursor-pointer">
                                            Apply for the Overflow Work Program?
                                        </FormLabel>
                                        <p className="text-xs text-muted-foreground leading-relaxed mt-1">
                                            We regularly have more work than our team can handle. If you are a member of a professional body, we can outsource overflow projects to your practice at wholesale rates.
                                        </p>
                                    </div>
                                </div>
                                <FormMessage />
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
                                render={({ field: parentField }) => (
                                    <FormItem>
                                        <div className="mb-4">
                                            <FormLabel className="text-base">Service Expertise</FormLabel>
                                            <p className="text-sm text-muted-foreground">
                                                Select services you are qualified to handle for the network.
                                            </p>
                                        </div>
                                        <div className="space-y-4 max-h-60 overflow-y-auto p-4 border rounded-lg bg-white">
                                            {isServicesLoading ? (
                                                <div className="flex justify-center py-4"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
                                            ) : (
                                                categorizedServices.map(category => (
                                                    <div key={category.id}>
                                                        <h4 className="font-bold text-[10px] uppercase text-primary mb-3 tracking-widest">{category.name}</h4>
                                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
                                                            {category.services.map((service) => (
                                                                <div key={service.id} className="flex flex-row items-start space-x-3 space-y-0">
                                                                    <Checkbox
                                                                        id={`check-${service.id}`}
                                                                        checked={parentField.value?.includes(service.id)}
                                                                        onCheckedChange={(checked) => {
                                                                            const current = parentField.value || [];
                                                                            const updated = checked
                                                                                ? [...current, service.id]
                                                                                : current.filter(val => val !== service.id);
                                                                            parentField.onChange(updated);
                                                                        }}
                                                                    />
                                                                    <Label htmlFor={`check-${service.id}`} className="font-normal text-xs cursor-pointer leading-tight">
                                                                        {service.title}
                                                                    </Label>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>
                    )}
                </div>

                <Separator />

                <div className="space-y-4">
                    <h3 className="text-lg font-bold flex items-center gap-2 text-slate-900">
                        <CreditCard className="h-5 w-5 text-primary" />
                        Activation & Fees
                    </h3>
                    <div className="p-4 rounded-lg bg-primary/5 border border-primary/10">
                        <div className="flex justify-between items-center mb-2">
                            <span className="font-bold text-sm">Once-off Setup & Onboarding</span>
                            <span className="font-black text-lg text-primary">R4,950.00</span>
                        </div>
                        <p className="text-[10px] text-muted-foreground leading-relaxed">
                            This activation fee covers your white-labeled dashboard configuration, re-branded landing page, and professional CA-led training. <strong>Monthly hosting fees are waived.</strong>
                        </p>
                    </div>
                </div>

                <FormField
                    control={form.control}
                    name="agreeTerms"
                    render={({ field }) => (
                        <FormItem className="flex flex-col space-y-3">
                            <div className="flex flex-row items-start space-x-3 space-y-0">
                                <FormControl>
                                    <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                                </FormControl>
                                <div className="space-y-1 leading-none">
                                    <FormLabel className="cursor-pointer font-medium">
                                        I agree to the <Link href="/terms" className="underline font-bold" target="_blank">terms and conditions</Link> and the R4,950 setup fee.
                                    </FormLabel>
                                </div>
                            </div>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                
                <div className="flex gap-2">
                    <Button type="button" variant="outline" onClick={() => setStep(1)} className="w-1/3 h-12 font-bold" disabled={isLoading}>Back</Button>
                    <Button type="submit" className="w-2/3 h-12 text-lg font-black shadow-xl" disabled={isLoading}>
                        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {isLoading ? 'Creating Account...' : 'Continue to Payment'}
                    </Button>
                </div>
            </div>
        )}
      </form>
    </Form>
  );
}
