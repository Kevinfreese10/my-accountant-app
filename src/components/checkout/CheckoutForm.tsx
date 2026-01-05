
'use client';

import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';
import { useCart } from '@/contexts/CartContext';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { useState, useEffect } from 'react';
import { getFirestore, doc, setDoc, Timestamp } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { getNextOrderId } from '@/lib/sequence';
import { Order } from '@/lib/types';

const db = getFirestore(firebaseApp);

const formSchema = z.object({
  name: z.string().min(2, 'Full name is required.'),
  email: z.string().email('Please enter a valid email.'),
  phone: z.string().min(10, 'Please enter a valid phone number.'),
});

export default function CheckoutForm() {
  const router = useRouter();
  const { user } = useAuth();
  const { cartItems, cartTotal, clearCart } = useCart();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      email: '',
      phone: '',
    },
  });

  useEffect(() => {
    if (user) {
      form.reset({
        name: user.name || '',
        email: user.email || '',
        phone: user.contactNumber || '',
      });
    }
  }, [user, form]);
  
  const submitToPayFast = (order: Order) => {
    const payfastUrl = 'https://www.payfast.co.za/eng/process';
    const form = document.createElement('form');
    form.method = 'POST';
    form.action = payfastUrl;

    const data: { [key: string]: string } = {
        merchant_id: process.env.NEXT_PUBLIC_PAYFAST_MERCHANT_ID || '',
        merchant_key: process.env.NEXT_PUBLIC_PAYFAST_MERCHANT_KEY || '',
        return_url: `${process.env.NEXT_PUBLIC_APP_URL}/payment-success/${order.id}`,
        cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/cart`,
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


  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsLoading(true);
    toast({
        title: 'Processing Order...',
        description: 'Please wait while we prepare your order.',
    });

    try {
      const orderId = await getNextOrderId();
      const orderData: Order = {
        id: orderId,
        userId: user?.uid || null,
        customerName: values.name,
        customerEmail: values.email,
        customerPhone: values.phone,
        items: cartItems.map(item => ({
            id: item.service.id,
            title: item.service.title,
            price: item.service.price,
            quantity: item.quantity
        })),
        total: cartTotal,
        discountCode: null, // Placeholder for future implementation
        discountAmount: null, // Placeholder
        status: 'Pending Payment',
        date: Timestamp.now(),
        source: 'Client',
      };

      await setDoc(doc(db, 'orders', orderId), orderData);
      
      clearCart();
      submitToPayFast(orderData);

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

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
         <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Full Name</FormLabel>
              <FormControl><Input {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
         <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email Address</FormLabel>
              <FormControl><Input type="email" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
         <FormField
          control={form.control}
          name="phone"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Phone Number</FormLabel>
              <FormControl><Input type="tel" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" className="w-full" size="lg" disabled={isLoading}>
          {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {isLoading ? 'Processing...' : `Pay ${formatPrice(cartTotal)}`}
        </Button>
      </form>
    </Form>
  );
}
