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
import { Loader2, Plus, Trash, RefreshCw, Clock, Search, CheckCircle2, Mail } from 'lucide-react';
import { getFirestore, collection, doc, setDoc, Timestamp, query, orderBy, getDocs, where, serverTimestamp } from 'firebase/firestore';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import { firebaseApp } from '@/lib/firebase';
import { Order, Service, User } from '@/lib/types';
import { Separator } from '../ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '../ui/checkbox';
import { sendEmail } from '@/lib/email';
import { render } from '@react-email/components';
import OrderConfirmationEmail from '../emails/OrderConfirmationEmail';
import { getNextOrderId } from '@/lib/sequence';
import { useAuth } from '@/contexts/AuthContext';
import { Alert, AlertTitle, AlertDescription } from '../ui/alert';
import { customAlphabet } from 'nanoid';

const db = getFirestore(firebaseApp);
const auth = getAuth(firebaseApp);
const nanoid = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 10);

const lineItemSchema = z.object({
  isCustom: z.boolean().default(false),
  serviceId: z.string().optional(),
  description: z.string().min(1, 'Description is required.'),
  quantity: z.preprocess(val => Number(val), z.number().min(1, 'Quantity must be at least 1.')),
  price: z.preprocess(val => Number(val), z.number().min(0, 'Price cannot be negative.')),
  discountType: z.enum(['fixed', 'percentage']).default('fixed'),
  discountValue: z.preprocess(val => Number(val) || 0, z.number().min(0, 'Discount cannot be negative.').optional()),
});

const formSchema = z.object({
  customerFirstName: z.string().min(2, "Client's first name is required."),
  customerLastName: z.string().min(2, "Client's last name is required."),
  customerEmail: z.string().email('Invalid email address.'),
  customerPhone: z.string().min(10, 'A valid phone number is required.'),
  items: z.array(lineItemSchema).min(1, 'At least one line item is required.'),
});

type CreateOrderFormValues = z.infer<typeof formSchema>;

const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-ZA', {
      style: 'currency',
      currency: 'ZAR',
      minimumFractionDigits: price % 1 === 0 ? 0 : 2,
      maximumFractionDigits: 2,
    }).format(price);
};

export default function CreateOrderForm() {
  const router = useRouter();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const { user: currentUser, reauthenticate } = useAuth();
  const [allServices, setAllServices] = useState<Service[]>([]);
  const [isServicesLoading, setIsServicesLoading] = useState(true);
  
  const [linkedUser, setLinkedUser] = useState<{name: string, id: string} | null>(null);
  const [isCheckingUser, setIsCheckingUser] = useState(false);

  const form = useForm<CreateOrderFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      customerFirstName: '',
      customerLastName: '',
      customerEmail: '',
      customerPhone: '',
      items: [{ isCustom: false, serviceId: '', description: '', quantity: 1, price: 0, discountType: 'fixed', discountValue: 0 }],
    },
    mode: 'onChange',
  });

  const watchedEmail = form.watch('customerEmail');

  useEffect(() => {
    const lookupUser = async () => {
        const email = watchedEmail?.toLowerCase().trim();
        if (!email || !email.includes('@') || email.length < 5) {
            setLinkedUser(null);
            return;
        }
        
        setIsCheckingUser(true);
        try {
            const collectionsToTry = ['users', 'aiAccountantClients', 'adminClients', 'partnerClients'];
            let found = false;

            for (const colName of collectionsToTry) {
                const q = query(collection(db, colName), where("email", "==", email));
                const snap = await getDocs(q);
                
                if (!snap.empty) {
                    const userData = snap.docs[0].data();
                    const fullName = userData.name || userData.companyName || 'Existing Client';
                    
                    setLinkedUser({ 
                        name: fullName, 
                        id: snap.docs[0].id 
                    });

                    // Auto-populate fields
                    const nameParts = fullName.split(' ');
                    form.setValue('customerFirstName', nameParts[0] || '');
                    form.setValue('customerLastName', nameParts.slice(1).join(' ') || '');
                    form.setValue('customerPhone', userData.contactNumber || userData.cellNumber || userData.phone || '');
                    form.trigger();
                    found = true;
                    break;
                }
            }

            if (!found) {
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
  }, [watchedEmail, form]);

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
    if (selectedService) {
        form.setValue(`items.${index}.description`, selectedService.title);
        form.setValue(`items.${index}.price`, selectedService.price);
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

  async function onSubmit(values: CreateOrderFormValues) {
    if (!currentUser) return;
    
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
            try {
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
                    source: 'Staff Order',
                    createdAt: serverTimestamp(),
                });

                // Re-authenticate admin to prevent auth state switch
                if (auth.currentUser) {
                    await reauthenticate(auth.currentUser);
                }
            } catch (authError: any) {
                if (authError.code === 'auth/email-already-in-use') {
                    toast({
                        title: 'Account Exists',
                        description: 'A user account already exists with this email address. Please link the order to the existing user instead.',
                        variant: 'destructive',
                    });
                    setIsLoading(false);
                    return;
                }
                throw authError;
            }
        }

        const orderId = await getNextOrderId();
        const firstService = allServices.find(s => s.id === values.items[0]?.serviceId);
        const department = firstService?.department;
        const customerFullName = `${values.customerFirstName} ${values.customerLastName}`;

        const confirmationEmailSubject = `My Accountant | Order Confirmation: #${orderId}`;

        const orderData: Order = {
            id: orderId,
            userId: finalUserId,
            customerName: customerFullName,
            customerEmail: values.customerEmail,
            customerPhone: values.customerPhone,
            items: values.items.map(item => ({ 
                id: item.serviceId || item.description.toLowerCase().replace(/\s/g, '-'),
                title: item.description, 
                price: item.price,
                quantity: item.quantity
            })),
            total: total,
            discountCode: null,
            discountAmount: null,
            paymentMethod: 'EFT',
            status: 'Pending Payment',
            date: Timestamp.now(),
            department: department || null,
            assignedTo: null,
            source: 'Staff',
        };

        await setDoc(doc(db, 'orders', orderId), orderData);
        
        const emailHtml = render(
            <OrderConfirmationEmail 
                order={orderData} 
                isNewUser={isNewUser} 
                generatedPassword={generatedPassword}
                showPaymentButton={true} 
            />
        );

        await sendEmail({
            to: values.customerEmail,
            bcc: 'kev@thinkestry.co.za',
            subject: confirmationEmailSubject,
            html: emailHtml,
        });

        toast({ title: 'Order Created', description: `Client notified. ${isNewUser ? 'New profile created.' : 'Existing profile linked.'}` });
        router.push('/admin/orders');

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

  useEffect(() => {
    const fetchServices = async () => {
        setIsServicesLoading(true);
        try {
            const q = query(collection(db, "services"), orderBy("title"));
            const querySnapshot = await getDocs(q);
            const fetchedServices = querySnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Service));
            setAllServices(fetchedServices);
        } catch (error) {
            console.error(error);
        } finally {
            setIsServicesLoading(false);
        }
    };
    fetchServices();
  }, []);

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2 space-y-2">
                <FormField
                control={form.control}
                name="customerEmail"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel className="flex items-center gap-2">
                        <Mail className="h-4 w-4 text-primary" />
                        Client's Email Address
                    </FormLabel>
                    <FormControl>
                        <div className="relative">
                            <Input placeholder="Start here to lookup client..." {...field} className="h-12 border-primary/20 focus-visible:ring-primary font-medium" />
                            {isCheckingUser && <Loader2 className="absolute right-3 top-4 h-4 w-4 animate-spin text-muted-foreground" />}
                        </div>
                    </FormControl>
                    <FormDescription>Entering the email first will automatically fill in existing client details.</FormDescription>
                    <FormMessage />
                    </FormItem>
                )}
                />
                {linkedUser && (
                    <div className="flex items-center gap-2 text-xs text-green-600 font-bold bg-green-50 p-3 rounded-md border border-green-100 animate-in fade-in slide-in-from-top-1">
                        <CheckCircle2 className="h-4 w-4" />
                        Matched: {linkedUser.name}
                    </div>
                )}
            </div>
            
            <FormField
            control={form.control}
            name="customerFirstName"
            render={({ field }) => (
                <FormItem>
                <FormLabel>Client's First Name</FormLabel>
                <FormControl><Input placeholder="John" {...field} /></FormControl>
                <FormMessage />
                </FormItem>
            )}
            />
            <FormField
            control={form.control}
            name="customerLastName"
            render={({ field }) => (
                <FormItem>
                <FormLabel>Client's Last Name</FormLabel>
                <FormControl><Input placeholder="Doe" {...field} /></FormControl>
                <FormMessage />
                </FormItem>
            )}
            />
            
            <FormField
            control={form.control}
            name="customerPhone"
            render={({ field }) => (
                <FormItem>
                <FormLabel>Customer Phone</FormLabel>
                <FormControl><Input placeholder="0821234567" {...field} /></FormControl>
                <FormMessage />
                </FormItem>
            )}
            />
        </div>
        
        <Separator />

        <div>
            <h3 className="text-lg font-medium mb-2">Order Items</h3>
            <div className="space-y-4">
                {fields.map((field, index) => {
                    const isCustom = form.watch(`items.${index}.isCustom`);
                    const lineItem = form.watch(`items.${index}`);
                    const serviceId = form.watch(`items.${index}.serviceId`);
                    const selectedService = serviceId ? allServices.find(s => s.id === serviceId) : null;
                    
                    return (
                    <div key={field.id} className="grid grid-cols-1 md:grid-cols-12 gap-x-3 gap-y-2 p-3 border rounded-md relative">
                         <div className="md:col-span-4 space-y-2">
                             {isCustom ? (
                                 <FormField
                                    control={form.control}
                                    name={`items.${index}.description`}
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Custom Description</FormLabel>
                                            <FormControl><Input {...field} /></FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                             ) : (
                                <>
                                <FormField
                                    control={form.control}
                                    name={`items.${index}.serviceId`}
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Service</FormLabel>
                                            <Select onValueChange={(value) => { field.onChange(value); handleServiceChange(value, index);}} defaultValue={field.value} disabled={isServicesLoading}>
                                                <FormControl>
                                                    <SelectTrigger>
                                                        <SelectValue placeholder={isServicesLoading ? 'Loading services...' : 'Select a service'} />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    {allServices.map(service => (
                                                        <SelectItem key={service.id} value={service.id}>{service.title}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                {selectedService && (
                                    <div className="text-xs space-y-2 pt-2">
                                        <div className="flex items-center gap-2 text-muted-foreground">
                                            <Clock className="h-4 w-4" />
                                            <span>{selectedService.turnaroundTime}</span>
                                        </div>
                                    </div>
                                )}
                                </>
                             )}
                             <FormField
                                control={form.control}
                                name={`items.${index}.isCustom`}
                                render={({ field }) => (
                                    <FormItem className="flex flex-row items-center space-x-2 pt-2">
                                        <FormControl>
                                            <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                                        </FormControl>
                                        <FormLabel className="text-xs !mt-0">Enter custom item</FormLabel>
                                    </FormItem>
                                )}
                            />
                         </div>
                        <div className="md:col-span-1">
                             <FormField
                                control={form.control}
                                name={`items.${index}.quantity`}
                                render={({ field }) => (
                                    <FormItem>
                                    <FormLabel>Qty</FormLabel>
                                    <FormControl><Input type="number" {...field} /></FormControl>
                                    <FormMessage />
                                    </FormItem>
                                )}
                                />
                         </div>
                        <div className="md:col-span-2">
                             <FormField
                                control={form.control}
                                name={`items.${index}.price`}
                                render={({ field }) => (
                                    <FormItem>
                                    <FormLabel>Unit Price (R)</FormLabel>
                                    <FormControl><Input type="number" step="0.01" {...field} /></FormControl>
                                    <FormMessage />
                                    </FormItem>
                                )}
                                />
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
                                        <FormMessage />
                                    </FormItem>
                                )}
                                />
                         </div>
                         <div className="md:col-span-1">
                             <FormField
                                control={form.control}
                                name={`items.${index}.discountValue`}
                                render={({ field }) => (
                                    <FormItem>
                                    <FormLabel>Value</FormLabel>
                                    <FormControl><Input type="number" step="0.01" {...field} /></FormControl>
                                    <FormMessage />
                                    </FormItem>
                                )}
                                />
                         </div>
                         <div className="md:col-span-1 flex items-end">
                            <p className="text-right w-full font-semibold">
                                {formatPrice(getLineItemTotal(lineItem))}
                            </p>
                         </div>
                         <div className="md:col-span-1 flex items-end">
                            <Button
                                type="button"
                                variant="destructive"
                                size="icon"
                                onClick={() => remove(index)}
                                className="w-full"
                                disabled={fields.length === 1}
                            >
                                <Trash className="h-4 w-4" />
                            </Button>
                         </div>
                    </div>
                )})}
            </div>
            <div className="flex gap-2">
                 <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-4"
                    onClick={() => append({ isCustom: false, serviceId: '', description: '', quantity: 1, price: 0, discountType: 'fixed', discountValue: 0 })}
                >
                    <Plus className="mr-2 h-4 w-4" /> Add Line Item
                </Button>
                 <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="mt-4"
                    onClick={() => form.trigger()}
                >
                    <RefreshCw className="mr-2 h-4 w-4" /> Update Totals & Validate
                </Button>
            </div>
        </div>

        <Separator />
        
        <div className="flex justify-end items-start gap-8">
            <div className="text-right">
                <p className="text-sm text-muted-foreground">Total</p>
                <p className="text-2xl font-bold">{formatPrice(total)}</p>
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
