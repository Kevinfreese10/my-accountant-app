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
import { Separator } from '../ui/separator';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { getFirestore, doc, setDoc, collection, getDocs, query, orderBy, where, serverTimestamp } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { useState, useEffect, useMemo } from 'react';
import { Loader2 } from 'lucide-react';
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
  const { user: adminUser, login } = useAuth();
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
            toast({
                title: 'Error',
                description: 'Could not load required data. Please try again refreshing the page.',
                variant: 'destructive',
            });
        } finally {
            setIsServicesLoading(false);
        }
    };
    fetchServicesAndCategories();
  }, [toast]);

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

  const handlePayFastRedirect = (order: Order) => {
    const payfastUrl = 'https://www.payfast.co.za/eng/process';
    const form = document.createElement('form');
    form.method = 'POST';
    form.action = payfastUrl;

    const data: { [key: string]: string } = {
        merchant_id: process.env.NEXT_PUBLIC_PAYFAST_MERCHANT_ID || '23836312',
        merchant_key: process.env.NEXT_PUBLIC_PAYFAST_MERCHANT_KEY || 'h4fkhz6ouoksx',
        return_url: `${process.env.NEXT_PUBLIC_APP_URL}/partner/dashboard`,
        cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/become-a-partner`,
        notify_url: `${process.env.NEXT_PUBLIC_APP_URL}/api/payfast/notify`,
        name_first: order.customerName.split(' ')[0],
        name_last: order.customerName.split(' ').slice(1).join(' '),
        email_address: order.customerEmail,
        m_payment_id: order.id,
        amount: order.total.toFixed(2),
        item_name: `Partner Setup Fee & R5000 Credits`,
        item_description: `Initial setup fee for the My Accountant Partner Program. R5000 will be added to your practice credits upon successful payment.`,
    };

    for (const key in data) {
        const input = document.createElement('input');
        input.type = 'hidden';
        input.name = key;
        input.value = data[key];
        form.appendChild(input);
    }
    
    document.body.appendChild(form);
    form.submit();
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

        const newUserDocRef = doc(db, "users", authUid);
        await setDoc(newUserDocRef, {
            ...partnerData,
            contactPerson: contactPersonFullName,
            name: contactPersonFullName,
            id: authUid,
            uid: authUid,
            role: 'partner',
            status: 'Pending Setup Payment', // Mark as pending until R5000 is paid
            creditBalance: 0,
            createdAt: serverTimestamp(),
            cvUrl: cvUrl,
            certificateUrl: certificateUrl,
        });

        // Create the setup order
        const orderId = await getNextOrderId();
        const setupOrder: Order = {
            id: orderId,
            userId: authUid,
            customerName: values.companyName,
            customerEmail: values.email,
            customerPhone: values.contactNumber,
            items: [{
                id: 'partner_setup_fee',
                title: 'Partner Setup Fee & Initial Credits',
                price: 5000,
                quantity: 1,
            }],
            total: 5000,
            discountCode: null,
            discountAmount: null,
            status: 'Pending Payment',
            date: Timestamp.now(),
            source: 'Partner',
            resellerId: authUid,
        };
        await setDoc(doc(db, 'orders', orderId), setupOrder);

        const emailHtml = render(<PartnerWelcomeEmail partnerName={values.name} dashboardUrl={`${process.env.NEXT_PUBLIC_APP_URL}/partner/dashboard`} />);
        await sendEmail({
            to: values.email,
            subject: 'Welcome to the My Accountant Partner Program!',
            html: emailHtml,
        });
        
        toast({
            title: 'Account Created!',
            description: `Redirecting to payment for setup fee and credits...`,
        });
        
        handlePayFastRedirect(setupOrder);

    } catch (error: any) {
        console.error("Partner signup error:", error);
        let description = 'There was a problem creating your account. Please try again.';
        if (error.code === 'auth/email-already-in-use') {
            description = 'An account with this email already exists. Please log in instead.';
        }
        toast({
            title: 'Signup Failed',
            description,
            variant: 'destructive',
        });
        setIsLoading(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        
        <div className="space-y-4">
             <h3 className="text-lg font-medium">Step 1: Practice Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField control={form.control} name="companyName" render={({ field }) => ( <FormItem><FormLabel>Company Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="name" render={({ field }) => ( <FormItem><FormLabel>Contact Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="surname" render={({ field }) => ( <FormItem><FormLabel>Contact Surname</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="email" render={({ field }) => ( <FormItem><FormLabel>Login Email Address</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                 <FormField control={form.control} name="password" render={({ field }) => ( <FormItem><FormLabel>Create Password</FormLabel><FormControl><Input type="password" {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="contactNumber" render={({ field }) => ( <FormItem><FormLabel>Contact Number</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
            </div>
        </div>
        
         <Separator />

        <div className="space-y-4">
             <h3 className="text-lg font-medium">Step 2: Work & Capabilities</h3>
             <FormField
                control={form.control}
                name="wantsOutsourcedWork"
                render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                    <FormControl>
                        <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                        <FormLabel>
                            Would you like us to outsource work to you?
                        </FormLabel>
                         <p className="text-sm text-muted-foreground">
                            If you belong to a professional accounting or tax body, we can send overflow work your way. You can complete this later.
                        </p>
                         <FormMessage />
                    </div>
                    </FormItem>
                )}
            />
            {wantsOutsourcedWork && (
                <div className="space-y-4 pt-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField
                            control={form.control}
                            name="cv"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Upload your CV</FormLabel>
                                    <FormControl>
                                        <Input type="file" accept=".pdf,.doc,.docx" onChange={(e) => field.onChange(e.target.files)} />
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
                                    <FormLabel>Upload Professional Certificate</FormLabel>
                                    <FormControl>
                                        <Input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={(e) => field.onChange(e.target.files)} />
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
                            <FormLabel className="text-base">Service Capabilities</FormLabel>
                            <p className="text-sm text-muted-foreground">
                              Select all the services you are qualified to perform.
                            </p>
                          </div>
                          {isServicesLoading ? (
                             <div className="flex items-center gap-2 text-muted-foreground">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                <span>Loading services...</span>
                            </div>
                          ) : (
                          <div className="space-y-4">
                             {categorizedServices.map(category => (
                                <div key={category.id}>
                                    <h4 className="font-semibold mb-2">{category.name}</h4>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pl-2">
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
                                                    <FormLabel className="font-normal">
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
                          )}
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                </div>
            )}
        </div>


        <Separator />

        <div className="bg-primary/5 p-6 rounded-lg border border-primary/20 space-y-4">
            <h3 className="text-lg font-bold flex items-center gap-2">
                <Wallet2 className="h-5 w-5 text-primary" />
                Step 3: Setup & Credits
            </h3>
            <p className="text-sm">
                To activate your partner account, a <strong>R5000 (Incl. VAT)</strong> setup fee is required.
            </p>
            <div className="bg-white p-4 rounded border flex justify-between items-center">
                <span className="font-semibold">Setup Fee Total:</span>
                <span className="text-xl font-bold text-primary">R5,000.00</span>
            </div>
            <p className="text-xs text-muted-foreground">
                * This R5000 will be loaded as credits into your practice wallet and can be used to pay for any services or subscriptions.
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
                        I agree to the <Link href="/terms" className="underline" target="_blank">terms and conditions</Link> and understand that the R5000 setup fee is mandatory for account activation.
                    </FormLabel>
                    <FormMessage />
                </div>
                </FormItem>
            )}
        />
        
        <Button type="submit" className="w-full" size="lg" disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isLoading ? 'Processing...' : 'Pay R5000 & Start My Practice'}
        </Button>
      </form>
    </Form>
  );
}

import { Wallet2 } from 'lucide-react';
