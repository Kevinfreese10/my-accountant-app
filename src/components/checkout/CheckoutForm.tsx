'use client';

import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';
import { useCart } from '@/contexts/CartContext';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Mail, CheckCircle2 } from 'lucide-react';
import { useState, useEffect } from 'react';
import { getFirestore, doc, setDoc, Timestamp, collection, query, where, getDocs, serverTimestamp } from 'firebase/firestore';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import { firebaseApp } from '@/lib/firebase';
import { getNextOrderId } from '@/lib/sequence';
import { Order } from '@/lib/types';
import { customAlphabet } from 'nanoid';
import { Separator } from '../ui/separator';

const db = getFirestore(firebaseApp);
const auth = getAuth(firebaseApp);
const nanoid = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 10);

const formSchema = z.object({
  firstName: z.string().min(2, 'First name is required.'),
  lastName: z.string().min(2, 'Surname is required.'),
  email: z.string().email('Please enter a valid email.'),
  phone: z.string().min(10, 'Please enter a valid cell number.'),
});

const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-ZA', {
      style: 'currency',
      currency: 'ZAR',
      minimumFractionDigits: price % 1 === 0 ? 0 : 2,
      maximumFractionDigits: 2,
    }).format(price);
};

export default function CheckoutForm() {
  const router = useRouter();
  const { user, reauthenticate } = useAuth();
  const { cartItems, cartTotal, clearCart } = useCart();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  
  const [linkedUser, setLinkedUser] = useState<{name: string, id: string} | null>(null);
  const [isCheckingUser, setIsCheckingUser] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      firstName: (user?.role === 'client' ? user?.name?.split(' ')[0] : '') || '',
      lastName: (user?.role === 'client' ? user?.name?.split(' ').slice(1).join(' ') : '') || '',
      email: (user?.role === 'client' ? user?.email : '') || '',
      phone: (user?.role === 'client' ? user?.contactNumber : '') || '',
    },
  });

  const watchedEmail = form.watch('email');

  useEffect(() => {
    if (user && user.role === 'client') {
      form.reset({
        firstName: user.name?.split(' ')[0] || '',
        lastName: user.name?.split(' ').slice(1).join(' ') || '',
        email: user.email || '',
        phone: user.contactNumber || '',
      });
    }
  }, [user, form]);

  // Automatic user lookup when email is entered
  useEffect(() => {
    const lookupUser = async () => {
        const email = watchedEmail?.toLowerCase().trim();
        // Don't lookup if user is already logged in as a client
        if ((user && user.role === 'client') || !email || !email.includes('@') || email.length < 5) {
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
                    form.setValue('firstName', nameParts[0] || '');
                    form.setValue('lastName', nameParts.slice(1).join(' ') || '');
                    form.setValue('phone', userData.contactNumber || userData.cellNumber || userData.phone || '');
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
  }, [watchedEmail, user, form]);
  
  const submitToPayFast = (order: Order) => {
    const payfastUrl = 'https://www.payfast.co.za/eng/process';
    const formElement = document.createElement('form');
    formElement.method = 'POST';
    formElement.action = payfastUrl;

    const data: { [key: string]: string } = {
        merchant_id: process.env.NEXT_PUBLIC_PAYFAST_MERCHANT_ID || '23836312',
        merchant_key: process.env.NEXT_PUBLIC_PAYFAST_MERCHANT_KEY || 'h4fkhz6ouoksx',
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
        formElement.appendChild(input);
    }
    
    document.body.appendChild(formElement);
    formElement.submit();
  }


  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsLoading(true);
    toast({
        title: 'Processing Order...',
        description: 'Please wait while we prepare your order.',
    });

    try {
        let finalUserId = (user?.role === 'client' ? user?.uid : null) || linkedUser?.id || null;
        let isNewUser = false;
        let generatedPassword = null;

        // Create account if truly new guest
        if (!finalUserId) {
            isNewUser = true;
            generatedPassword = nanoid();
            
            try {
                const userCredential = await createUserWithEmailAndPassword(auth, values.email, generatedPassword);
                finalUserId = userCredential.user.uid;

                const userDocRef = doc(db, 'users', finalUserId);
                await setDoc(userDocRef, {
                    id: finalUserId,
                    uid: finalUserId,
                    name: `${values.firstName} ${values.lastName}`,
                    email: values.email.toLowerCase().trim(),
                    contactNumber: values.phone,
                    role: 'client',
                    source: 'Checkout',
                    createdAt: serverTimestamp(),
                });

                if (auth.currentUser) {
                    await reauthenticate(auth.currentUser);
                }
            } catch (authError: any) {
                if (authError.code === 'auth/email-already-in-use') {
                    toast({
                        title: 'Account Exists',
                        description: 'An account already exists with this email address. Please log in to continue.',
                        variant: 'destructive',
                    });
                    setIsLoading(false);
                    return;
                }
                throw authError;
            }
        }

        const orderId = await getNextOrderId();
        const orderData: Order = {
            id: orderId,
            userId: finalUserId,
            customerName: `${values.firstName} ${values.lastName}`,
            customerEmail: values.email,
            customerPhone: values.phone,
            items: cartItems.map(item => ({
                id: item.service.id,
                title: item.service.title,
                price: item.service.price,
                quantity: item.quantity
            })),
            total: cartTotal,
            discountCode: null,
            discountAmount: null,
            status: 'Pending Payment',
            date: Timestamp.now(),
            source: 'Client',
        };

        await setDoc(doc(db, 'orders', orderId), orderData);
        
        clearCart();
        submitToPayFast(orderData);

    } catch (error: any) {
        console.error("Error creating order: ", error);
        toast({
            title: 'Order Failed',
            description: error.message || 'There was a problem saving your order.',
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
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-primary" />
                  Email Address
              </FormLabel>
              <FormControl>
                <div className="relative">
                    <Input placeholder="Start here..." {...field} className="h-12 border-primary/20 focus-visible:ring-primary font-medium" />
                    {isCheckingUser && <Loader2 className="absolute right-3 top-4 h-4 w-4 animate-spin text-muted-foreground" />}
                </div>
              </FormControl>
              {linkedUser && (
                <div className="flex items-center gap-2 text-[10px] text-green-600 font-bold bg-green-50 p-2 rounded border border-green-100 mt-1">
                    <CheckCircle2 className="h-3 w-3" /> Matched: {linkedUser.name}
                </div>
              )}
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-2 gap-4">
            <FormField
            control={form.control}
            name="firstName"
            render={({ field }) => (
                <FormItem>
                <FormLabel>First Name</FormLabel>
                <FormControl><Input placeholder="John" {...field} /></FormControl>
                <FormMessage />
                </FormItem>
            )}
            />
            <FormField
            control={form.control}
            name="lastName"
            render={({ field }) => (
                <FormItem>
                <FormLabel>Surname</FormLabel>
                <FormControl><Input placeholder="Doe" {...field} /></FormControl>
                <FormMessage />
                </FormItem>
            )}
            />
        </div>

         <FormField
          control={form.control}
          name="phone"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Cell Number</FormLabel>
              <FormControl><Input type="tel" placeholder="082 123 4567" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Separator />

        <Button type="submit" className="w-full h-12 text-lg font-bold" disabled={isLoading}>
          {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {isLoading ? 'Processing...' : `Pay ${formatPrice(cartTotal)}`}
        </Button>
      </form>
    </Form>
  );
}
