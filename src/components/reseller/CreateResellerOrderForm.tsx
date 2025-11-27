
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
import { Loader2, Plus, Trash, RefreshCw, Clock, ClipboardCheck, Search } from 'lucide-react';
import { getFirestore, doc, setDoc, Timestamp, collection, query, orderBy, getDocs, where } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { Order, Service, OrderNote, User } from '@/lib/types';
import { Separator } from '../ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Checkbox } from '../ui/checkbox';
import { useAuth } from '@/contexts/AuthContext';
import { sendEmail } from '@/lib/email';
import { render } from '@react-email/components';
import OrderConfirmationEmail from '../emails/OrderConfirmationEmail';
import { getNextOrderId } from '@/lib/sequence';


const db = getFirestore(firebaseApp);

const lineItemSchema = z.object({
  serviceId: z.string().min(1, 'Please select a service.'),
  description: z.string().min(1, 'Description is required.'),
  quantity: z.preprocess(val => Number(val), z.number().min(1, 'Quantity must be at least 1.')),
  resellerPrice: z.preprocess(val => Number(val), z.number().min(0, 'Price cannot be negative.')),
  clientPrice: z.preprocess(val => Number(val), z.number().min(0, 'Price cannot be negative.')),
});


const formSchema = z.object({
  customerFirstName: z.string().min(2, "Client's first name is required."),
  customerLastName: z.string().min(2, "Client's last name is required."),
  customerEmail: z.string().email('A valid client email is required.'),
  customerPhone: z.string().min(10, 'A valid client phone number is required.'),
  items: z.array(lineItemSchema).min(1, 'At least one line item is required.'),
});

type CreateOrderFormValues = z.infer<typeof formSchema>;

export default function CreateResellerOrderForm({ onOrderCreated }: { onOrderCreated: () => void }) {
  const router = useRouter();
  const { user: reseller } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [allServices, setAllServices] = useState<Service[]>([]);
  const [isServicesLoading, setIsServicesLoading] = useState(true);

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
            toast({
                title: 'Error',
                description: 'Could not load the list of services. Please try again.',
                variant: 'destructive',
            });
        } finally {
            setIsServicesLoading(false);
        }
    };
    fetchServices();
  }, [toast]);


  const form = useForm<CreateOrderFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      customerFirstName: '',
      customerLastName: '',
      customerEmail: '',
      customerPhone: '',
      items: [{ serviceId: '', description: '', quantity: 1, resellerPrice: 0, clientPrice: 0 }],
    },
    mode: 'onChange',
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'items',
  });

  const watchedItems = form.watch('items');

  const calculateTotal = (items: any[]) => {
    return (items || []).reduce((acc, item) => {
        const quantity = item?.quantity || 0;
        const resellerPrice = item?.resellerPrice || 0;
        return acc + (resellerPrice * quantity);
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
        form.setValue(`items.${index}.resellerPrice`, selectedService.resellerPrice || selectedService.price);
        form.setValue(`items.${index}.clientPrice`, selectedService.price);
        form.trigger(`items.${index}`);
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-ZA', {
      style: 'currency',
      currency: 'ZAR',
      minimumFractionDigits: price % 1 === 0 ? 0 : 2,
      maximumFractionDigits: 2,
    }).format(price);
  };


  async function onSubmit(values: CreateOrderFormValues) {
    if (!reseller) {
        toast({ title: 'Error', description: 'You must be logged in to create an order.', variant: 'destructive'});
        return;
    }
    setIsLoading(true);
    toast({
      title: 'Creating Order...',
      description: 'Please wait while we generate the new order.',
    });

    try {
      const orderId = await getNextOrderId();
      const resellerTotalCost = values.items.reduce((acc, item) => acc + (item.resellerPrice * item.quantity), 0);
      const clientTotal = values.items.reduce((acc, item) => acc + (item.clientPrice * item.quantity), 0);
      
      const orderData: Order = {
        id: orderId,
        resellerId: reseller.id,
        customerName: `${reseller.name} ${reseller.surname}`,
        customerEmail: reseller.email,
        customerPhone: reseller.contactNumber,
        documentContact: 'reseller',
        endCustomerName: `${values.customerFirstName} ${values.customerLastName}`,
        endCustomerEmail: values.customerEmail,
        items: values.items.map(item => ({ 
            id: item.serviceId || item.description.toLowerCase().replace(/\s/g, '-'),
            title: item.description, 
            price: item.resellerPrice,
            clientPrice: item.clientPrice,
            quantity: item.quantity
        })),
        total: resellerTotalCost,
        clientTotal: clientTotal,
        status: 'Pending Payment',
        date: Timestamp.now(),
        isOutsourced: true, // All reseller-created orders are now considered outsourced
        originalOrderId: null,
      };

      await setDoc(doc(db, 'orders', orderId), orderData);

      try {
        const confirmationEmailSubject = `Your Order Confirmation: #${orderId}`;
        const emailHtml = render(<OrderConfirmationEmail order={orderData} reseller={reseller} />);
        await sendEmail({
          to: reseller.email,
          bcc: 'kev@thinkestry.co.za',
          subject: confirmationEmailSubject,
          html: emailHtml,
        });
      } catch (emailError) {
        console.error("Failed to send reseller email:", emailError);
        toast({
          title: 'Order Created, But Email Failed',
          description: 'The order was saved, but the confirmation email could not be sent.',
          variant: 'destructive',
        });
      }
      
      toast({
        title: 'Order Created Successfully',
        description: `Order ${orderId} has been created.`,
      });
      
      onOrderCreated();
      router.push(`/order-confirmation/${orderId}`);

    } catch (error) {
        console.error("Error creating order: ", error);
        toast({
            title: 'Order Creation Failed',
            description: 'There was a problem saving the order. Please try again.',
            variant: 'destructive',
        });
    } finally {
        setIsLoading(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 max-h-[70vh] overflow-y-auto p-1 pr-4">
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
            control={form.control}
            name="customerFirstName"
            render={({ field }) => (
                <FormItem>
                <FormLabel>Your Client's First Name</FormLabel>
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
                <FormLabel>Your Client's Last Name</FormLabel>
                <FormControl><Input placeholder="Doe" {...field} /></FormControl>
                <FormMessage />
                </FormItem>
            )}
            />
            <FormField
            control={form.control}
            name="customerEmail"
            render={({ field }) => (
                <FormItem>
                <FormLabel>Your Client's Email</FormLabel>
                <FormControl><Input placeholder="name@example.com" {...field} /></FormControl>
                <FormMessage />
                </FormItem>
            )}
            />
            <FormField
            control={form.control}
            name="customerPhone"
            render={({ field }) => (
                <FormItem>
                <FormLabel>Your Client's Phone</FormLabel>
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
                    const resellerPrice = form.watch(`items.${index}.resellerPrice`);
                    const clientPrice = form.watch(`items.${index}.clientPrice`);
                    const serviceId = form.watch(`items.${index}.serviceId`);
                    const selectedService = serviceId ? allServices.find(s => s.id === serviceId) : null;
                    
                    return (
                    <div key={field.id} className="p-3 border rounded-md space-y-3">
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="md:col-span-2 space-y-2">
                                <FormField
                                    control={form.control}
                                    name={`items.${index}.serviceId`}
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Service</FormLabel>
                                            <Select onValueChange={(value) => { field.onChange(value); handleServiceChange(value, index);}} defaultValue={field.value} disabled={isServicesLoading}>
                                                <FormControl><SelectTrigger><SelectValue placeholder={isServicesLoading ? "Loading services..." : "Select a service"} /></SelectTrigger></FormControl>
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
                                        {selectedService.clientRequirements.length > 0 && (
                                            <div className="space-y-1">
                                                <p className="font-medium">Prerequisites:</p>
                                                <ul className="list-disc pl-5">
                                                    {selectedService.clientRequirements.map((req, i) => <li key={i}>{req}</li>)}
                                                </ul>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                         </div>
                         <div className="grid grid-cols-2 md:grid-cols-3 gap-4 items-end">
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
                             <FormField
                                control={form.control}
                                name={`items.${index}.clientPrice`}
                                render={({ field }) => (
                                    <FormItem>
                                    <FormLabel>Selling Price (R)</FormLabel>
                                    <FormControl><Input type="number" step="0.01" {...field} /></FormControl>
                                    <FormMessage />
                                    </FormItem>
                                )}
                                />
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
                    </div>
                )})}
            </div>
            <div className="flex gap-2">
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-4"
                    onClick={() => append({ serviceId: '', description: '', quantity: 1, resellerPrice: 0, clientPrice: 0 })}
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
                <p className="text-sm text-muted-foreground">Total Outsourcing Cost</p>
                <p className="text-2xl font-bold">{formatPrice(total)}</p>
            </div>
        </div>

        <Button type="submit" className="w-full" size="lg" disabled={isLoading || !form.formState.isValid || total === 0}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isLoading ? 'Creating Order...' : 'Create Order & Proceed to Payment'}
        </Button>
      </form>
    </Form>
  );
}
