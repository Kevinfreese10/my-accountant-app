'use client';

import { useForm, useFieldArray } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Loader2, Plus, Trash, RefreshCw, Clock, AlertCircle, CheckCircle2 } from 'lucide-react';
import { getFirestore, doc, setDoc, Timestamp, collection, query, orderBy, getDocs, where, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import { firebaseApp } from '@/lib/firebase';
import { Order, Service, OrderNote, User } from '@/lib/types';
import { Separator } from '../ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '../ui/checkbox';
import { useAuth } from '@/contexts/AuthContext';
import { sendEmail } from '@/lib/email';
import { render } from '@react-email/components';
import OrderConfirmationEmail from '../emails/OrderConfirmationEmail';
import { getNextOrderId } from '@/lib/sequence';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import Link from 'next/link';
import { customAlphabet } from 'nanoid';

const db = getFirestore(firebaseApp);
const auth = getAuth(firebaseApp);
const nanoid = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 10);

const lineItemSchema = z.object({
  serviceId: z.string().min(1, 'Please select a service.'),
  description: z.string().min(1, 'Description is required.'),
  quantity: z.preprocess(val => Number(val), z.number().min(1, 'Quantity must be at least 1.')),
  price: z.preprocess(val => Number(val), z.number().min(0, 'Price cannot be negative.')),
  discountType: z.enum(['fixed', 'percentage']).default('fixed'),
  discountValue: z.preprocess(val => Number(val) || 0, z.number().min(0, 'Discount cannot be negative.').optional()),
  resellerPrice: z.preprocess(val => Number(val), z.number().min(0).optional()),
}).refine((data) => {
    const quantity = data.quantity || 1;
    const lineItemTotal = data.price * quantity;
    let discountAmount = 0;
    if (data.discountType === 'percentage') {
        discountAmount = lineItemTotal * ((data.discountValue || 0) / 100);
    } else {
        discountAmount = (data.discountValue || 0) * quantity;
    }
    const netTotal = lineItemTotal - discountAmount;
    const costTotal = (data.resellerPrice || 0) * quantity;
    
    return netTotal >= costTotal;
}, {
    message: "Selling price after discount cannot be less than your wholesale cost.",
    path: ["price"]
});

const formSchema = z.object({
  customerFirstName: z.string().min(2, "Client's first name is required."),
  customerLastName: z.string().min(2, "Client's last name is required."),
  customerEmail: z.string().email('A valid client email is required.'),
  customerPhone: z.string().min(10, 'A valid client phone number is required.'),
  items: z.array(lineItemSchema).min(1, 'At least one line item is required.'),
});

type CreatePartnerOrderFormValues = z.infer<typeof formSchema>;

const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-ZA', {
      style: 'currency',
      currency: 'ZAR',
      minimumFractionDigits: price % 1 === 0 ? 0 : 2,
      maximumFractionDigits: 2,
    }).format(price);
};

export default function CreatePartnerOrderForm({ onOrderCreated }: { onOrderCreated: () => void }) {
  const router = useRouter();
  const { user: partner, reauthenticate } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [allServices, setAllServices] = useState<Service[]>([]);
  const [serviceOverrides, setServiceOverrides] = useState<Record<string, any>>({});
  const [isServicesLoading, setIsServicesLoading] = useState(true);
  
  const [linkedUser, setLinkedUser] = useState<{name: string, id: string} | null>(null);
  const [isCheckingUser, setIsCheckingUser] = useState(false);

  const partnerId = partner?.role === 'partner' ? partner.uid : partner?.partnerId;
  const hasBankingDetails = !!(partner?.bankingDetails?.bankName && partner?.bankingDetails?.accountNumber);

  useEffect(() => {
    const fetchServices = async () => {
        setIsServicesLoading(true);
        try {
            const q = query(collection(db, "services"), orderBy("title"));
            const querySnapshot = await getDocs(q);
            const fetchedServices = querySnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Service));
            setAllServices(fetchedServices);
        } catch (error) {
            console.error("Error fetching services:", error);
        } finally {
            setIsServicesLoading(false);
        }
    };
    fetchServices();
  }, []);

  useEffect(() => {
    if (!partnerId) return;
    const overridesRef = collection(db, 'users', partnerId, 'serviceOverrides');
    const unsubscribe = onSnapshot(overridesRef, (snap) => {
        const data: Record<string, any> = {};
        snap.docs.forEach(doc => data[doc.id] = doc.data());
        setServiceOverrides(data);
    });
    return () => unsubscribe();
  }, [partnerId]);

  const form = useForm<CreatePartnerOrderFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      customerFirstName: '',
      customerLastName: '',
      customerEmail: '',
      customerPhone: '',
      items: [{ serviceId: '', description: '', quantity: 1, price: 0, discountType: 'fixed', discountValue: 0, resellerPrice: 0 }],
    },
    mode: 'onChange',
  });

  const watchedEmail = form.watch('customerEmail');

  useEffect(() => {
    const lookupUser = async () => {
        if (!watchedEmail || !watchedEmail.includes('@') || watchedEmail.length < 5) {
            setLinkedUser(null);
            return;
        }
        
        setIsCheckingUser(true);
        try {
            const usersQ = query(collection(db, 'users'), where("email", "==", watchedEmail.toLowerCase().trim()));
            const userSnap = await getDocs(usersQ);
            
            if (!userSnap.empty) {
                const userData = userSnap.docs[0].data();
                setLinkedUser({ 
                    name: userData.name, 
                    id: userSnap.docs[0].id 
                });
            } else {
                setLinkedUser(null);
            }
        } catch (e) {
            console.error("User lookup failed:", e);
        } finally {
            setIsCheckingUser(false);
        }
    };

    const timer = setTimeout(lookupUser, 600);
    return () => clearTimeout(timer);
  }, [watchedEmail]);

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'items',
  });

  const calculateTotal = (items: any[]) => {
    return (items || []).reduce((acc, item) => {
        const quantity = item?.quantity || 0;
        const price = item?.price || 0;
        const discountValue = item?.discountValue || 0;
        const lineItemTotal = price * quantity;

        let discountAmount = 0;
        if (item.discountType === 'percentage') {
            discountAmount = lineItemTotal * (discountValue / 100);
        } else {
            discountAmount = discountValue * quantity;
        }

        return acc + (lineItemTotal - discountAmount);
    }, 0);
  }

  useEffect(() => {
    const subscription = form.watch((value) => {
        setTotal(calculateTotal(value.items || []));
    });
    return () => subscription.unsubscribe();
  }, [form]);

  const handleServiceChange = (serviceId: string, index: number) => {
    const selectedService = allServices.find(s => s.id === serviceId);
    const override = serviceOverrides[serviceId];
    
    if (selectedService) {
        form.setValue(`items.${index}.description`, override?.title || selectedService.title);
        form.setValue(`items.${index}.price`, override?.price ?? selectedService.price);
        form.setValue(`items.${index}.resellerPrice`, selectedService.resellerPrice || selectedService.price);
        form.trigger(`items.${index}`);
    }
  };

  const getLineItemTotal = (item: any) => {
    const quantity = item.quantity || 0;
    const price = item.price || 0;
    const discountValue = item.discountValue || 0;
    const lineItemTotal = price * quantity;

    let discountAmount = 0;
    if (item.discountType === 'percentage') {
        discountAmount = lineItemTotal * (discountValue / 100);
    } else {
        discountAmount = discountValue * quantity;
    }
    return (lineItemTotal - discountAmount);
  };

  async function onSubmit(values: CreatePartnerOrderFormValues) {
    if (!partner || !partnerId) return;

    if (!hasBankingDetails) {
        toast({ title: 'Banking Details Missing', description: 'Please complete your practice banking details in your profile.', variant: 'destructive'});
        return;
    }

    setIsLoading(true);
    toast({ title: 'Processing Order...', description: 'Checking user profile and creating order.' });

    try {
        let finalUserId = linkedUser?.id || null;
        let isNewUser = false;
        let generatedPassword = null;

        if (!finalUserId) {
            isNewUser = true;
            generatedPassword = nanoid();
            
            // Create Firebase Auth Account
            const userCredential = await createUserWithEmailAndPassword(auth, values.customerEmail, generatedPassword);
            finalUserId = userCredential.user.uid;

            // Create Firestore Profile
            const userDocRef = doc(db, 'users', finalUserId);
            await setDoc(userDocRef, {
                id: finalUserId,
                uid: finalUserId,
                name: `${values.customerFirstName} ${values.customerLastName}`,
                email: values.customerEmail.toLowerCase().trim(),
                contactNumber: values.customerPhone,
                role: 'client',
                source: `Partner Order (${partner.companyName})`,
                createdAt: serverTimestamp(),
            });

            // Re-authenticate partner to prevent auth state switch
            if (auth.currentUser) {
                await reauthenticate(auth.currentUser);
            }
        }

        const orderId = await getNextOrderId();
        const customerFullName = `${values.customerFirstName} ${values.customerLastName}`;
        
        const resellerTotal = values.items.reduce((acc, item) => {
            const resellerBase = item.resellerPrice || item.price;
            return acc + (resellerBase * item.quantity);
        }, 0);

        const orderData: Order = {
            id: orderId,
            resellerId: partnerId,
            userId: finalUserId,
            customerName: partner.companyName || partner.name,
            customerEmail: partner.email,
            customerPhone: partner.contactNumber,
            endCustomerName: customerFullName,
            endCustomerEmail: values.customerEmail,
            documentContact: 'reseller',
            date: Timestamp.now(),
            items: values.items.map(item => ({ 
                id: item.serviceId,
                title: item.description, 
                price: item.resellerPrice || item.price,
                clientPrice: item.price,
                quantity: item.quantity,
                discountType: item.discountType,
                discountValue: item.discountValue,
            })),
            total: resellerTotal,
            clientTotal: total,
            status: 'Pending Payment',
            originalOrderId: null,
            isOutsourced: false,
            discountAmount: null,
            discountCode: null,
            source: 'Partner',
        };

        await setDoc(doc(db, 'orders', orderId), orderData);

        const confirmationEmailSubject = `Order Confirmation: #${orderId}`;
        const emailHtml = render(
            <OrderConfirmationEmail 
                order={orderData} 
                reseller={partner} 
                isNewUser={isNewUser}
                generatedPassword={generatedPassword}
            />
        );
        
        await sendEmail({
            to: values.customerEmail,
            subject: confirmationEmailSubject,
            html: emailHtml,
            resellerId: partnerId,
        });

        toast({ title: 'Order Created', description: `Client notified. ${isNewUser ? 'New profile created.' : 'Existing profile linked.'}` });
        onOrderCreated();

    } catch (error: any) {
        console.error("Error creating order: ", error);
        toast({
            title: 'Operation Failed',
            description: error.message || 'There was a problem processing your request.',
            variant: 'destructive',
        });
    } finally {
        setIsLoading(false);
    }
  }

  if (!hasBankingDetails) {
      return (
          <div className="py-8 text-center space-y-4">
              <Alert variant="destructive" className="text-left">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Action Required</AlertTitle>
                  <AlertDescription>
                      You must configure your <strong>Practice Banking Details</strong> in your profile before you can create client orders.
                  </AlertDescription>
              </Alert>
              <Button asChild variant="outline"><Link href="/partner/profile">Update Banking Details</Link></Button>
          </div>
      )
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 max-h-[70vh] overflow-y-auto p-1 pr-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField control={form.control} name="customerFirstName" render={({ field }) => ( <FormItem><FormLabel>Client's First Name</FormLabel><FormControl><Input placeholder="John" {...field} /></FormControl><FormMessage /></FormItem> )} />
            <FormField control={form.control} name="customerLastName" render={({ field }) => ( <FormItem><FormLabel>Client's Last Name</FormLabel><FormControl><Input placeholder="Doe" {...field} /></FormControl><FormMessage /></FormItem> )} />
            <div className="space-y-2">
                <FormField control={form.control} name="customerEmail" render={({ field }) => ( 
                    <FormItem>
                        <FormLabel>Client's Email</FormLabel>
                        <FormControl>
                            <div className="relative">
                                <Input placeholder="name@example.com" {...field} />
                                {isCheckingUser && <Loader2 className="absolute right-3 top-3 h-4 w-4 animate-spin text-muted-foreground" />}
                            </div>
                        </FormControl>
                        <FormMessage />
                    </FormItem> 
                )} />
                {linkedUser && (
                    <div className="flex items-center gap-2 text-xs text-green-600 font-medium bg-green-50 p-2 rounded-md border border-green-100 animate-in fade-in slide-in-from-top-1">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Linked to existing profile: {linkedUser.name}
                    </div>
                )}
            </div>
            <FormField control={form.control} name="customerPhone" render={({ field }) => ( <FormItem><FormLabel>Client's Phone</FormLabel><FormControl><Input placeholder="0821234567" {...field} /></FormControl><FormMessage /></FormItem> )} />
        </div>
        
        <Separator />

        <div>
            <h3 className="text-lg font-medium mb-2">Order Items</h3>
            <div className="space-y-4">
                {fields.map((field, index) => {
                    const lineItem = form.watch(`items.${index}`);
                    const resellerCost = lineItem?.resellerPrice || 0;
                    
                    return (
                    <div key={field.id} className="grid grid-cols-1 md:grid-cols-12 gap-x-3 gap-y-2 p-3 border rounded-md relative items-start">
                         <div className="md:col-span-4 space-y-2">
                            <FormField
                                control={form.control}
                                name={`items.${index}.serviceId`}
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Service</FormLabel>
                                        <Select onValueChange={(value) => { field.onChange(value); handleServiceChange(value, index);}} value={field.value} disabled={isServicesLoading}>
                                            <FormControl><SelectTrigger><SelectValue placeholder={isServicesLoading ? 'Loading services...' : 'Select a service'} /></SelectTrigger></FormControl>
                                            <SelectContent>
                                                {allServices.map(service => <SelectItem key={service.id} value={service.id}>{service.title}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                         </div>
                        <div className="md:col-span-1">
                             <FormField control={form.control} name={`items.${index}.quantity`} render={({ field }) => ( <FormItem><FormLabel>Qty</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem> )} />
                         </div>
                        <div className="md:col-span-2">
                             <FormField control={form.control} name={`items.${index}.price`} render={({ field }) => ( 
                                 <FormItem>
                                     <FormLabel>Selling Price (R)</FormLabel>
                                     <FormControl><Input type="number" step="0.01" {...field} /></FormControl>
                                     <FormDescription className="text-[10px]">
                                         Cost: {formatPrice(resellerCost)}
                                     </FormDescription>
                                     <FormMessage />
                                 </FormItem> 
                             )} />
                         </div>
                         <div className="md:col-span-2">
                             <FormField
                                control={form.control}
                                name={`items.${index}.discountType`}
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Discount</FormLabel>
                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                            <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                                            <SelectContent>
                                                <SelectItem value="fixed">Fixed (R)</SelectItem>
                                                <SelectItem value="percentage">Percent (%)</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </FormItem>
                                )}
                                />
                         </div>
                         <div className="md:col-span-1">
                             <FormField control={form.control} name={`items.${index}.discountValue`} render={({ field }) => ( <FormItem><FormLabel>Value</FormLabel><FormControl><Input type="number" step="0.01" {...field} /></FormControl><FormMessage /></FormItem> )} />
                         </div>
                         <div className="md:col-span-1 flex flex-col items-end justify-center h-full pt-8">
                            <p className="text-right w-full font-semibold text-sm">{formatPrice(getLineItemTotal(lineItem))}</p>
                            <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)} className="h-8 w-8 text-destructive" disabled={fields.length === 1}><Trash className="h-4 w-4" /></Button>
                         </div>
                    </div>
                )})}
            </div>
            <div className="flex gap-2">
                <Button type="button" variant="outline" size="sm" className="mt-4" onClick={() => append({ serviceId: '', description: '', quantity: 1, price: 0, discountType: 'fixed', discountValue: 0, resellerPrice: 0 })}>
                    <Plus className="mr-2 h-4 w-4" /> Add Line Item
                </Button>
                <Button type="button" variant="secondary" size="sm" className="mt-4" onClick={() => form.trigger()}><RefreshCw className="mr-2 h-4 w-4" /> Update Totals</Button>
            </div>
        </div>

        <Separator />
        
        <div className="flex justify-end items-start gap-8">
            <div className="text-right">
                <p className="text-sm text-muted-foreground">Practice Total (Client Facing)</p>
                <p className="text-2xl font-bold text-primary">{formatPrice(total)}</p>
            </div>
        </div>

        <Button type="submit" className="w-full" size="lg" disabled={isLoading || !form.formState.isValid || total === 0}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isLoading ? 'Creating Order...' : 'Create Order & Send for Payment'}
        </Button>
      </form>
    </Form>
  );
}