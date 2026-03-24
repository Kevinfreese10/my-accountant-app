'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Service, Order, User } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Loader2, LogIn, UserPlus, Contact, Mail, User as UserIcon, Phone } from 'lucide-react';
import { getFirestore, doc, setDoc, Timestamp, getDoc, serverTimestamp } from 'firebase/firestore';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import { firebaseApp } from '@/lib/firebase';
import { getNextOrderId } from '@/lib/sequence';
import { Checkbox } from '../ui/checkbox';
import { render } from '@react-email/components';
import OrderConfirmationEmail from '../emails/OrderConfirmationEmail';
import { sendEmail } from '@/lib/email';
import Link from 'next/link';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { Input } from '../ui/input';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { customAlphabet } from 'nanoid';

const db = getFirestore(firebaseApp);
const auth = getAuth(firebaseApp);
const nanoid = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 10);

const checkoutSchema = z.object({
    firstName: z.string().min(2, "First name is required"),
    lastName: z.string().min(2, "Last name is required"),
    email: z.string().email("A valid email is required"),
    phone: z.string().min(10, "A valid phone number is required"),
    hasPrerequisites: z.boolean().refine(v => v === true, { message: "You must confirm prerequisites" }),
    agreedToRefundPolicy: z.boolean().refine(v => v === true, { message: "You must agree to the refund policy" }),
});

export default function ServiceCheckoutForm({ service, partnerId }: { service: Service, partnerId?: string }) {
  const router = useRouter();
  const { user, reauthenticate } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<z.infer<typeof checkoutSchema>>({
      resolver: zodResolver(checkoutSchema),
      defaultValues: {
          firstName: user?.name?.split(' ')[0] || '',
          lastName: user?.name?.split(' ').slice(1).join(' ') || '',
          email: user?.email || '',
          phone: user?.contactNumber || '',
          hasPrerequisites: false,
          agreedToRefundPolicy: false,
      }
  });

  async function handleCheckout(values: z.infer<typeof checkoutSchema>) {
    setIsLoading(true);
    toast({
      title: 'Placing Your Order...',
      description: 'Please wait while we set up your profile and create your order.',
    });

    try {
        let finalUserId = user?.uid || null;
        let isNewUser = false;
        let generatedPassword = null;

        // 1. Create account if guest
        if (!finalUserId) {
            isNewUser = true;
            generatedPassword = nanoid();
            
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
                source: partnerId ? 'Partner Landing Page' : 'Website',
                createdAt: serverTimestamp(),
            });

            if (auth.currentUser) {
                await reauthenticate(auth.currentUser);
            }
        }

        // 2. Fetch Partner Details for White-Labeling
        let resellerData: User | undefined;
        if (partnerId) {
            const partnerSnap = await getDoc(doc(db, 'users', partnerId));
            if (partnerSnap.exists()) {
                resellerData = { ...partnerSnap.data(), id: partnerSnap.id } as User;
            }
        }

        // 3. Create Order
        const orderId = await getNextOrderId();
        const orderData: Order = {
            id: orderId,
            userId: finalUserId,
            customerName: `${values.firstName} ${values.lastName}`,
            customerEmail: values.email,
            customerPhone: values.phone,
            items: [{ id: service.id, title: service.title, price: service.price, quantity: 1 }],
            total: service.price,
            discountCode: null,
            discountAmount: null,
            paymentMethod: resellerData?.bankingDetails?.bankName ? 'EFT' : 'PayFast',
            status: 'Pending Payment',
            date: Timestamp.now(),
            department: service.department || null,
            source: partnerId ? 'Partner Landing Page' : 'Client',
            resellerId: partnerId || null,
        };

        await setDoc(doc(db, 'orders', orderId), orderData);
        
        // 4. Send Confirmation Email
        const emailHtml = render(
            <OrderConfirmationEmail 
                order={orderData} 
                reseller={resellerData}
                isNewUser={isNewUser}
                generatedPassword={generatedPassword}
                showPaymentButton={!resellerData?.bankingDetails?.bankName}
            />
        );
        
        await sendEmail({
            to: orderData.customerEmail,
            subject: `Order Confirmation #${orderId}`,
            html: emailHtml,
            resellerId: partnerId || undefined,
        });

        router.push(`/order-confirmation/${orderId}`);

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

  if (service.isPriceTbc) {
      return (
          <Alert>
              <Contact className="h-4 w-4" />
              <AlertTitle>Price on Request</AlertTitle>
              <AlertDescription>
                  Please <Link href="/contact" className="font-semibold underline">contact us</Link> for pricing information for this service.
              </AlertDescription>
          </Alert>
      )
  }

  return (
    <Form {...form}>
        <form onSubmit={form.handleSubmit(handleCheckout)} className="space-y-6">
            {!user && (
                <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                    <div className="flex items-center gap-2 text-xs font-bold uppercase text-muted-foreground tracking-widest mb-2">
                        <UserIcon className="h-3 w-3" /> Personal Details
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <FormField control={form.control} name="firstName" render={({ field }) => ( <FormItem><FormControl><Input placeholder="First Name" {...field} /></FormControl><FormMessage /></FormItem> )} />
                        <FormField control={form.control} name="lastName" render={({ field }) => ( <FormItem><FormControl><Input placeholder="Last Name" {...field} /></FormControl><FormMessage /></FormItem> )} />
                    </div>
                    <FormField control={form.control} name="email" render={({ field }) => ( <FormItem><FormControl><Input type="email" placeholder="Email Address" {...field} /></FormControl><FormMessage /></FormItem> )} />
                    <FormField control={form.control} name="phone" render={({ field }) => ( <FormItem><FormControl><Input placeholder="Phone Number" {...field} /></FormControl><FormMessage /></FormItem> )} />
                    <Separator />
                </div>
            )}

            <div className="space-y-4">
                <FormField
                    control={form.control}
                    name="hasPrerequisites"
                    render={({ field }) => (
                        <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                            <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                            <div className="space-y-1 leading-none">
                                <FormLabel className="text-sm font-medium cursor-pointer">I confirm I have all the prerequisites for this service.</FormLabel>
                                <FormMessage />
                            </div>
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="agreedToRefundPolicy"
                    render={({ field }) => (
                        <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                            <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                            <div className="space-y-1 leading-none">
                                <FormLabel className="text-sm font-medium cursor-pointer">
                                    I agree to the <Link href="/refund-policy" className="text-primary underline" target="_blank">refund policy</Link>.
                                </FormLabel>
                                <FormMessage />
                            </div>
                        </FormItem>
                    )}
                />
            </div>
        
            <Button 
                type="submit"
                disabled={isLoading}
                className="w-full partner-btn h-12 text-lg font-bold"
            >
                {isLoading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : null}
                {isLoading ? 'Processing...' : 'Proceed to Payment'}
            </Button>

            {!user && (
                <div className="text-center">
                    <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-tighter">
                        Already have an account? <Link href="/login" className="text-primary hover:underline">Login here</Link>
                    </p>
                </div>
            )}
        </form>
    </Form>
  );
}