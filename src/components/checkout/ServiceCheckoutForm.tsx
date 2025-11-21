
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Service, Order, User } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Loader2, LogIn } from 'lucide-react';
import { getFirestore, doc, setDoc, Timestamp, collection, query, where, getDocs } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { getNextOrderId } from '@/lib/sequence';
import { Checkbox } from '../ui/checkbox';
import { render } from '@react-email/components';
import OrderConfirmationEmail from '../emails/OrderConfirmationEmail';
import { sendEmail } from '@/lib/email';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '../ui/input';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Link from 'next/link';

const db = getFirestore(firebaseApp);


const guestFormSchema = z.object({
  name_first: z.string().min(1, 'First name is required.'),
  name_last: z.string().min(1, 'Last name is required.'),
  email_address: z.string().email('Invalid email address.'),
  cell_number: z.string().min(10, 'A valid phone number is required.'),
});

export default function ServiceCheckoutForm({ service }: { service: Service }) {
  const router = useRouter();
  const { user } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [hasPrerequisites, setHasPrerequisites] = useState(false);
  const [agreedToRefundPolicy, setAgreedToRefundPolicy] = useState(false);
  const [showGuestForm, setShowGuestForm] = useState(false);

  const form = useForm<z.infer<typeof guestFormSchema>>({
    resolver: zodResolver(guestFormSchema),
    defaultValues: {
      name_first: '',
      name_last: '',
      email_address: '',
      cell_number: '',
    },
  });

  const canPurchase = hasPrerequisites && agreedToRefundPolicy;
  
  const handleGuestCheckout = async (values: z.infer<typeof guestFormSchema>) => {
    setIsLoading(true);
    toast({
      title: 'Placing Your Order...',
      description: 'Please wait while we create your order.',
    });

    try {
      await createOrder(null, `${values.name_first} ${values.name_last}`, values.email_address, values.cell_number);
    } catch (error: any) {
        console.error("Error in guest checkout: ", error);
        toast({ title: 'Order Failed', description: 'There was a problem placing your order. Please try again.', variant: 'destructive' });
        setIsLoading(false);
    }
  };


  async function handleLoggedInCheckout() {
    if (!user) return;
    setIsLoading(true);
    toast({
      title: 'Placing Your Order...',
      description: 'Please wait while we create your order.',
    });

    try {
      await createOrder(user.uid, user.name, user.email, user.contactNumber);
    } catch (error) {
      console.error("Error creating order: ", error);
      toast({
        title: 'Order Failed',
        description: 'There was a problem saving your order. Please try again.',
        variant: 'destructive',
      });
      setIsLoading(false);
    }
  }

  async function createOrder(userId: string | null, customerName: string, customerEmail: string, customerPhone?: string | null) {
      const orderId = await getNextOrderId();
      const orderData: Order = {
        id: orderId,
        userId: userId,
        customerName: customerName,
        customerEmail: customerEmail,
        customerPhone: customerPhone || undefined,
        items: [{ id: service.id, title: service.title, price: service.price, quantity: 1 }],
        total: service.price,
        discountCode: null,
        discountAmount: null,
        paymentMethod: 'PayFast',
        status: 'Pending Payment',
        date: Timestamp.now(),
        department: service.department || null,
        source: 'Client',
      };

      await setDoc(doc(db, 'orders', orderId), orderData);
      
      const emailHtml = render(<OrderConfirmationEmail order={orderData} />);
      await sendEmail({
          to: orderData.customerEmail,
          bcc: 'kev@thinkestry.co.za',
          subject: `Order Confirmation #${orderId}`,
          html: emailHtml,
      });

      // Instead of redirecting to confirmation, submit to PayFast
      submitToPayFast(orderData);
  }

  const submitToPayFast = (order: Order) => {
    const payfastUrl = 'https://www.payfast.co.za/eng/process';
    const form = document.createElement('form');
    form.method = 'POST';
    form.action = payfastUrl;

    const data: { [key: string]: string } = {
        merchant_id: process.env.NEXT_PUBLIC_PAYFAST_MERCHANT_ID || '23836312',
        merchant_key: process.env.NEXT_PUBLIC_PAYFAST_MERCHANT_KEY || 'h4fkhz6ouoksx',
        return_url: `${process.env.NEXT_PUBLIC_APP_URL}/payment-success/${order.id}`,
        cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/products/${service.slug}`,
        notify_url: `${process.env.NEXT_PUBLIC_APP_URL}/api/payfast/notify`,
        name_first: order.customerName.split(' ')[0],
        name_last: order.customerName.split(' ').slice(1).join(' '),
        email_address: order.customerEmail,
        cell_number: order.customerPhone || '',
        m_payment_id: order.id,
        amount: order.total.toFixed(2),
        item_name: `Order #${order.id}`,
        item_description: order.items.map(i => i.title).join(', '),
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
  }
  
  const handleMainButtonClick = () => {
      if (!canPurchase) {
          toast({
              title: 'Confirmation Required',
              description: 'Please confirm you have the prerequisites and agree to the refund policy.',
              variant: 'destructive',
          });
          return;
      }
      
      if(user) {
          handleLoggedInCheckout();
      } else {
          setShowGuestForm(true);
      }
  }


  return (
    <>
    <div className="sticky top-24 space-y-4">
        <div className="space-y-4">
            <div className="flex items-start space-x-2">
                <Checkbox id="prerequisites" checked={hasPrerequisites} onCheckedChange={(checked) => setHasPrerequisites(checked as boolean)} />
                <div className="grid gap-1.5 leading-none">
                    <label
                    htmlFor="prerequisites"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    >
                    I confirm I have all the prerequisites for this service.
                    </label>
                </div>
            </div>
             <div className="flex items-start space-x-2">
                <Checkbox id="refund_policy" checked={agreedToRefundPolicy} onCheckedChange={(checked) => setAgreedToRefundPolicy(checked as boolean)} />
                <div className="grid gap-1.5 leading-none">
                    <label
                    htmlFor="refund_policy"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    >
                    I have read and agree to the <Link href="/refund-policy" className="text-primary underline" target="_blank">refund policy</Link>.
                    </label>
                </div>
            </div>
        </div>
      
      {showGuestForm && !user ? (
           <Form {...form}>
              <form onSubmit={form.handleSubmit(handleGuestCheckout)} className="space-y-4 pt-4 border-t">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField control={form.control} name="name_first" render={({ field }) => ( <FormItem><FormLabel>First Name</FormLabel><FormControl><Input placeholder="John" {...field} /></FormControl><FormMessage /></FormItem> )} />
                    <FormField control={form.control} name="name_last" render={({ field }) => ( <FormItem><FormLabel>Last Name</FormLabel><FormControl><Input placeholder="Doe" {...field} /></FormControl><FormMessage /></FormItem> )} />
                  </div>
                  <FormField control={form.control} name="email_address" render={({ field }) => ( <FormItem><FormLabel>Email Address</FormLabel><FormControl><Input placeholder="name@example.com" {...field} /></FormControl><FormMessage /></FormItem> )} />
                  <FormField control={form.control} name="cell_number" render={({ field }) => ( <FormItem><FormLabel>Cell Number</FormLabel><FormControl><Input placeholder="082 123 4567" {...field} /></FormControl><FormMessage /></FormItem> )} />
                <Button type="submit" className="w-full" size="lg" disabled={isLoading || !canPurchase}>
                    {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Proceed to Payment
                </Button>
              </form>
            </Form>
      ) : (
          <Button 
            onClick={handleMainButtonClick}
            disabled={isLoading || !canPurchase}
            className="w-full"
            size="lg"
          >
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isLoading ? 'Processing...' : user ? 'Proceed to Payment' : 'Checkout as Guest'}
          </Button>
      )}
       {!user && !showGuestForm && (
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">OR</span>
              </div>
            </div>
          )}
       {!user && !showGuestForm && (
            <Button variant="secondary" className="w-full" asChild>
                <Link href="/login?redirect=/products/new-company-registration">
                    <LogIn className="mr-2 h-4 w-4" />
                    Login to your account
                </Link>
            </Button>
        )}

    </div>
    </>
  );
}
