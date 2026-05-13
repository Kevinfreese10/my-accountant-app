'use client';
import { useEffect, useState } from 'react';
import { useParams, notFound, useRouter } from 'next/navigation';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { Order, User } from '@/lib/types';
import { Loader2, CheckCircle, Banknote, LogIn, ExternalLink } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { addDays, format } from 'date-fns';

const db = getFirestore(firebaseApp);

const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-ZA', {
      style: 'currency',
      currency: 'ZAR',
      minimumFractionDigits: price % 1 === 0 ? 0 : 2,
      maximumFractionDigits: 2,
    }).format(price);
};

export default function OrderConfirmationPage() {
    const params = useParams();
    const router = useRouter();
    const { user, isAuthenticated } = useAuth();
    const orderId = params.orderId as string;
    const [order, setOrder] = useState<Order | null>(null);
    const [reseller, setReseller] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (orderId) {
            const fetchOrder = async () => {
                setIsLoading(true);
                const orderRef = doc(db, 'orders', orderId);
                const orderSnap = await getDoc(orderRef);
                if (orderSnap.exists()) {
                    const orderData = { 
                        ...orderSnap.data(), 
                        id: orderSnap.id,
                        date: orderSnap.data().date.toDate().toISOString()
                    } as Order;
                    setOrder(orderData);

                    // Trigger Google Customer Reviews Opt-in
                    const deliveryDate = format(addDays(new Date(), 10), 'yyyy-MM-dd');
                    if (typeof window !== 'undefined' && (window as any).renderOptIn) {
                        (window as any).renderOptIn({
                            id: orderData.id,
                            customerEmail: orderData.customerEmail,
                            estimated_delivery_date: deliveryDate
                        });
                    }

                    // Fetch reseller details if it's a white-label order
                    if (orderData.resellerId) {
                        const resellerSnap = await getDoc(doc(db, 'users', orderData.resellerId));
                        if (resellerSnap.exists()) {
                            setReseller({ ...resellerSnap.data(), id: resellerSnap.id } as User);
                        }
                    }

                    // If user is authenticated and lands here, redirect them to PayFast immediately.
                    const isSetupOrTopup = orderData.items.some(i => i.id === 'partner_setup_fee' || i.id === 'partner_credit_topup');
                    
                    if (isAuthenticated && orderData.status === 'Pending Payment' && (!orderData.resellerId || isSetupOrTopup)) {
                        handlePayNow(orderData);
                    }
                } else {
                    notFound();
                }
                setIsLoading(false);
            };
            fetchOrder();
        }
    }, [orderId, isAuthenticated]); 
    
    const handlePayNow = (order: Order) => {
        if (!isAuthenticated) {
            router.push(`/login?redirect=/order-confirmation/${order.id}`);
            return;
        }

        const payfastUrl = 'https://www.payfast.co.za/eng/process';
        const form = document.createElement('form');
        form.method = 'POST';
        form.action = payfastUrl;

        const data: { [key: string]: string } = {
            merchant_id: process.env.NEXT_PUBLIC_PAYFAST_MERCHANT_ID || '23836312',
            merchant_key: process.env.NEXT_PUBLIC_PAYFAST_MERCHANT_KEY || 'h4fkhz6ouoksx',
            return_url: `${process.env.NEXT_PUBLIC_APP_URL}/payment-success/${order.id}`,
            cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/orders`,
            notify_url: `${process.env.NEXT_PUBLIC_APP_URL}/api/payfast/notify`,
            name_first: order.customerName.split(' ')[0],
            name_last: order.customerName.split(' ').slice(1).join(' '),
            email_address: order.customerEmail,
            cell_number: order.customerPhone || '',
            m_payment_id: order.id,
            amount: (order.clientTotal || order.total).toFixed(2),
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

    if (isLoading) {
        return (
            <div className="container mx-auto px-4 py-20 text-center">
                <Loader2 className="mx-auto h-12 w-12 animate-spin text-primary" />
                <h1 className="mt-4 text-2xl font-semibold">Loading Your Order...</h1>
            </div>
        );
    }

    if (!order) {
        return notFound();
    }
    
    const isSetupOrTopup = order.items.some(i => i.id === 'partner_setup_fee' || i.id === 'partner_credit_topup');
    const showEft = !!order.resellerId && !isSetupOrTopup;

    return (
        <div className="container mx-auto px-4 py-12 max-w-4xl">
            <Card>
                <CardHeader className="text-center">
                    <CheckCircle className="mx-auto h-12 w-12 text-green-500" />
                    <CardTitle className="text-3xl mt-4">Order Placed Successfully!</CardTitle>
                    <CardDescription>
                       {showEft 
                        ? "Please complete your payment via EFT using the details below." 
                        : "Please complete payment for your order using the secure PayFast button below."}
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-8">
                     <section>
                        <h3 className="font-semibold text-lg mb-2">Order Summary</h3>
                        <div className="border rounded-lg p-4 space-y-2">
                           <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Order ID:</span>
                                <span className="font-mono">{order.id}</span>
                            </div>
                            <Separator />
                            {order.items.map((item: any, index: number) => (
                                <div key={index} className="flex justify-between items-center">
                                    <p>{item.title}</p>
                                    <p className="font-semibold">{formatPrice(item.clientPrice || item.price)}</p>
                                </div>
                            ))}
                             <Separator />
                            <div className="flex justify-between font-bold text-lg">
                                <p>Total Due</p>
                                <p>{formatPrice(order.clientTotal || order.total)}</p>
                            </div>
                        </div>
                    </section>
                    
                    <section className="text-center">
                        {showEft ? (
                            <div className="space-y-6">
                                {reseller?.bankingDetails?.bankName ? (
                                    <div className="bg-muted p-6 rounded-lg border text-left space-y-4 shadow-sm animate-in fade-in slide-in-from-bottom-2">
                                        <div className="flex items-center gap-2">
                                            <Banknote className="h-5 w-5 text-primary" />
                                            <h4 className="font-bold text-lg">Payment Instructions (EFT)</h4>
                                        </div>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-sm">
                                            <div>
                                                <p className="text-muted-foreground uppercase text-[10px] font-bold tracking-widest mb-1">Bank Name</p>
                                                <p className="font-semibold">{reseller.bankingDetails.bankName}</p>
                                            </div>
                                            <div>
                                                <p className="text-muted-foreground uppercase text-[10px] font-bold tracking-widest mb-1">Account Holder</p>
                                                <p className="font-semibold">{reseller.bankingDetails.accountHolder}</p>
                                            </div>
                                            <div>
                                                <p className="text-muted-foreground uppercase text-[10px] font-bold tracking-widest mb-1">Account Number</p>
                                                <p className="font-semibold font-mono">{reseller.bankingDetails.accountNumber}</p>
                                            </div>
                                            <div>
                                                <p className="text-muted-foreground uppercase text-[10px] font-bold tracking-widest mb-1">Branch Code</p>
                                                <p className="font-semibold font-mono">{reseller.bankingDetails.branchCode}</p>
                                            </div>
                                        </div>
                                        <div className="bg-primary/5 p-4 rounded border border-primary/20 flex flex-col items-center justify-center">
                                            <p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest mb-1">EFT Payment Reference</p>
                                            <p className="text-2xl font-black text-primary font-mono">{order.id}</p>
                                        </div>
                                        <p className="text-xs text-muted-foreground italic text-center">
                                            Please email proof of payment to <a href={`mailto:${reseller.email}`} className="text-primary font-bold hover:underline">{reseller.email}</a>
                                        </p>
                                    </div>
                                ) : (
                                    <Alert variant="destructive">
                                        <AlertTitle>Missing Payment Info</AlertTitle>
                                        <AlertDescription>
                                            The partner has not provided banking details. Please contact them at {reseller?.email || 'the practice email'} for payment instructions.
                                        </AlertDescription>
                                    </Alert>
                                )}
                                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                                    <Button asChild variant="outline">
                                        <Link href="/dashboard/orders">Go to Dashboard</Link>
                                    </Button>
                                    <Button asChild className="gap-2">
                                        <Link href={`/p/${reseller?.landingPage?.slug || ''}`}>
                                            Return to Practice Page <ExternalLink className="h-4 w-4" />
                                        </Link>
                                    </Button>
                                </div>
                            </div>
                        ) : (
                            <>
                                {isAuthenticated ? (
                                    <Button onClick={() => handlePayNow(order)} className="w-full max-w-sm h-12 text-lg font-bold">
                                        Pay Now with PayFast
                                    </Button>
                                ) : (
                                    <Button onClick={() => handlePayNow(order)} className="w-full max-w-sm h-12 text-lg font-bold">
                                        <LogIn className="mr-2 h-5 w-5" /> Login to Pay
                                    </Button>
                                )}
                            </>
                        )}
                    </section>
                </CardContent>
            </Card>
        </div>
    );
}
