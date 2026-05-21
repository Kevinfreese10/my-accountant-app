'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Service, Order, User } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Loader2, Mail, User as UserIcon, CheckCircle2 } from 'lucide-react';
import { getFirestore, doc, setDoc, Timestamp, getDoc, serverTimestamp, collection, query, where, getDocs, or } from 'firebase/firestore';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import { firebaseApp } from '@/lib/firebase';
import { getNextOrderId } from '@/lib/sequence';
import { Checkbox } from '../ui/checkbox';
import { Separator } from '../ui/separator';
import { sendOrderConfirmationEmailAction } from '@/app/actions';
import { serializeForServerAction } from '@/lib/utils';
import Link from 'next/link';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { Input } from '@/components/ui/input';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { customAlphabet } from 'nanoid';

const db = getFirestore(firebaseApp);
const auth = getAuth(firebaseApp);
const nanoid = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 10);

const checkoutSchema = z.object({
    firstName: z.string().min(2, "First name is required"),
    lastName: z.string().min(2, "Surname is required"),
    email: z.string().email("A valid email is required"),
    phone: z.string().min(10, "A valid cell number is required"),
    hasPrerequisites: z.boolean().refine(v => v === true, { message: "You must confirm prerequisites" }),
    agreedToRefundPolicy: z.boolean().refine(v => v === true, { message: "You must agree to the refund policy" }),
});

export default function ServiceCheckoutForm({ service, partnerId }: { service: Service, partnerId?: string }) {
  const router = useRouter();
  const { user, reauthenticate } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [linkedUser, setLinkedUser] = useState<{name: string, id: string} | null>(null);
  const [isCheckingUser, setIsCheckingUser] = useState(false);

  const form = useForm<z.infer<typeof checkoutSchema>>({
      resolver: zodResolver(checkoutSchema),
      defaultValues: {
          firstName: (user?.role === 'client' ? user?.name?.split(' ')[0] : '') || '',
          lastName: (user?.role === 'client' ? user?.name?.split(' ').slice(1).join(' ') : '') || '',
          email: (user?.role === 'client' ? user?.email : '') || '',
          phone: (user?.role === 'client' ? user?.contactNumber : '') || '',
          hasPrerequisites: false,
          agreedToRefundPolicy: false,
      }
  });

  const watchedEmail = form.watch('email');

  // Automatic user lookup when email is entered
  useEffect(() => {
    const lookupUser = async () => {
        const rawEmail = watchedEmail?.trim();
        // Don't lookup if user is already logged in as a client
        if ((user && user.role === 'client') || !rawEmail || !rawEmail.includes('@') || rawEmail.length < 5) {
            setLinkedUser(null);
            return;
        }
        
        setIsCheckingUser(true);
        try {
            const collectionsToTry = ['users', 'aiAccountantClients', 'adminClients', 'partnerClients'];
            let found = false;

            for (const colName of collectionsToTry) {
                const q = query(
                    collection(db, colName), 
                    or(
                        where("email", "==", rawEmail),
                        where("email", "==", rawEmail.toLowerCase())
                    )
                );
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

  useEffect(() => {
    if (user && user.role === 'client') {
      form.reset({
        firstName: user.name?.split(' ')[0] || '',
        lastName: user.name?.split(' ').slice(1).join(' ') || '',
        email: user.email || '',
        phone: user.contactNumber || '',
        hasPrerequisites: form.getValues('hasPrerequisites'),
        agreedToRefundPolicy: form.getValues('agreedToRefundPolicy'),
      });
    }
  }, [user, form]);

  const onError = (errors: any) => {
    console.error("Checkout Validation Errors:", errors);
    const firstError = Object.values(errors)[0] as any;
    if (firstError) {
        toast({
            title: "Action Required",
            description: firstError.message || "Please complete all required fields.",
            variant: "destructive"
        });
    }
  };

  async function handleCheckout(values: z.infer<typeof checkoutSchema>) {
    setIsLoading(true);
    toast({
      title: 'Placing Your Order...',
      description: 'Please wait while we prepare your order.',
    });

    // --- TEMPORARY DIAGNOSTIC LOGGING START ---
    console.log("=== ServiceCheckoutForm - Order Generation Initiated ===");
    console.log("Input Payload (Zod values):", JSON.stringify(values, null, 2));
    console.log("Current Auth User State:", user ? { uid: user.uid, role: user.role, email: user.email } : "Not Logged In");
    console.log("Linked User State:", linkedUser ? { id: linkedUser.id, name: linkedUser.name } : "None Linked");
    console.log("Checkout Service Details:", JSON.stringify({ id: service.id, title: service.title, price: service.price }, null, 2));
    console.log("Partner ID (Reseller):", partnerId || "None");
    // --- TEMPORARY DIAGNOSTIC LOGGING END ---

    try {
        let finalUserId = (user?.role === 'client' ? user?.uid : null) || linkedUser?.id || null;
        const email = values.email.toLowerCase().trim();

        // Final verification check in case debounce didn't catch it
        if (!finalUserId) {
            const collectionsToTry = ['users', 'aiAccountantClients', 'adminClients', 'partnerClients'];
            for (const colName of collectionsToTry) {
                const q = query(collection(db, colName), or(where("email", "==", email), where("email", "==", values.email.trim())));
                const snap = await getDocs(q);
                if (!snap.empty) {
                    finalUserId = snap.docs[0].id;
                    break;
                }
            }
        }

        console.log("Resolved Final Client User ID:", finalUserId || "New Guest User (Will be created)");

        let isNewUser = false;
        let generatedPassword = null;

        // 1. Create account if truly a new guest
        if (!finalUserId) {
            isNewUser = true;
            generatedPassword = nanoid();
            console.log("Creating new user account for client...", { email, generatedPassword });
            
            try {
                const userCredential = await createUserWithEmailAndPassword(auth, values.email, generatedPassword);
                finalUserId = userCredential.user.uid;

                const userDocRef = doc(db, 'users', finalUserId);
                const newUserProfile = {
                    id: finalUserId,
                    uid: finalUserId,
                    name: `${values.firstName} ${values.lastName}`,
                    email: values.email.toLowerCase().trim(),
                    contactNumber: values.phone,
                    role: 'client',
                    source: partnerId ? 'Partner Landing Page' : 'Website',
                    createdAt: serverTimestamp(),
                };
                
                console.log("Writing new client profile to Firestore users collection:", newUserProfile);
                await setDoc(userDocRef, newUserProfile);

                if (auth.currentUser) {
                    await reauthenticate(auth.currentUser);
                }
            } catch (authError: any) {
                console.error("Firebase Auth Account creation failed:", authError);
                if (authError.code === 'auth/email-already-in-use') {
                    toast({
                        title: 'Account Exists',
                        description: 'An account already exists with this email address. Please log in to your existing account to continue.',
                        variant: 'destructive',
                    });
                    setIsLoading(false);
                    return;
                }
                throw authError;
            }
        }

        let resellerData: User | undefined;
        if (partnerId) {
            console.log("Fetching partner reseller data for ID:", partnerId);
            const partnerSnap = await getDoc(doc(db, 'users', partnerId));
            if (partnerSnap.exists()) {
                resellerData = { ...partnerSnap.data(), id: partnerSnap.id } as User;
                console.log("Partner Reseller data found:", JSON.stringify(resellerData, null, 2));
            } else {
                console.warn("Partner Reseller SNAP does not exist for ID:", partnerId);
            }
        }

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

        // --- TEMPORARY DIAGNOSTIC LOGGING FOR ORDER WRITE ---
        console.log("Order Data Payload to be written to Firestore (orders/" + orderId + "):", JSON.stringify(orderData, null, 2));
        // --- TEMPORARY DIAGNOSTIC LOGGING END ---

        await setDoc(doc(db, 'orders', orderId), orderData);
        console.log("Firestore Order document successfully written!");
        
        console.log("Calling sendOrderConfirmationEmailAction server action...");
        const emailResult = await sendOrderConfirmationEmailAction({
            order: serializeForServerAction(orderData),
            resellerId: partnerId || null,
            isNewUser,
            generatedPassword,
            showPaymentButton: !resellerData?.bankingDetails?.bankName
        });

        console.log("sendEmail Server Action response returned to UI:", JSON.stringify(emailResult, null, 2));

        if (emailResult && !emailResult.success) {
            console.error("Email delivery failed on server:", emailResult.error);
            toast({
                title: "Order Placed, Email Pending",
                description: `Your order was successfully placed, but we couldn't send the confirmation email right now: ${emailResult.error || 'SMTP Connection Error'}. Our support team has been alerted.`,
                variant: "default",
            });
        }

        router.push(`/order-confirmation/${orderId}`);

    } catch (error: any) {
      console.error("FATAL ERROR in ServiceCheckoutForm handleCheckout flow:", error);
      console.error("Full server-side / client-side stack trace:", error.stack || error);
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
              <Mail className="h-4 w-4" />
              <AlertTitle>Price on Request</AlertTitle>
              <AlertDescription>
                  Please <Link href="/contact" className="font-semibold underline">contact us</Link> for pricing information for this service.
              </AlertDescription>
          </Alert>
      )
  }

  return (
    <Form {...form}>
        <form onSubmit={form.handleSubmit(handleCheckout, onError)} className="space-y-6">
            {(!user || user.role !== 'client') && (
                <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                    <div className="flex items-center gap-2 text-xs font-bold uppercase text-muted-foreground tracking-widest mb-2">
                        <UserIcon className="h-3 w-3" /> Personal Details
                    </div>
                    
                    <FormField control={form.control} name="email" render={({ field }) => ( 
                        <FormItem>
                            <FormLabel className="text-xs">Email Address</FormLabel>
                            <FormControl>
                                <div className="relative">
                                    <Input type="email" placeholder="Start here..." {...field} className="h-10 border-primary/20 focus-visible:ring-primary font-medium" />
                                    {isCheckingUser && <Loader2 className="absolute right-3 top-3 h-4 w-4 animate-spin text-muted-foreground" />}
                                </div>
                            </FormControl>
                            {linkedUser && (
                                <div className="flex items-center gap-2 text-[10px] text-green-600 font-bold bg-green-50 p-2 rounded border border-green-100 mt-1">
                                    <CheckCircle2 className="h-3 w-3" /> Matched: {linkedUser.name}
                                </div>
                            )}
                            <FormMessage />
                        </FormItem> 
                    )} />

                    <div className="grid grid-cols-2 gap-3">
                        <FormField control={form.control} name="firstName" render={({ field }) => ( <FormItem><FormLabel className="text-xs">First Name</FormLabel><FormControl><Input placeholder="John" {...field} /></FormControl><FormMessage /></FormItem> )} />
                        <FormField control={form.control} name="lastName" render={({ field }) => ( <FormItem><FormLabel className="text-xs">Surname</FormLabel><FormControl><Input placeholder="Doe" {...field} /></FormControl><FormMessage /></FormItem> )} />
                    </div>
                    <FormField control={form.control} name="phone" render={({ field }) => ( <FormItem><FormLabel className="text-xs">Cell Number</FormLabel><FormControl><Input placeholder="082 123 4567" {...field} /></FormControl><FormMessage /></FormItem> )} />
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
