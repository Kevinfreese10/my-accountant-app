
'use client';
import { useEffect, useState } from 'react';
import { useParams, notFound } from 'next/navigation';
import { getFirestore, doc, onSnapshot } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { Order } from '@/lib/types';
import { Loader2, CheckCircle, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

const db = getFirestore(firebaseApp);

const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-ZA', {
      style: 'currency',
      currency: 'ZAR',
    }).format(price);
};

export default function PaymentSuccessPage() {
    const params = useParams();
    const orderId = params.orderId as string;
    const [order, setOrder] = useState<Order | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (orderId) {
            const orderRef = doc(db, 'orders', orderId);

            const unsubscribe = onSnapshot(orderRef, (docSnap) => {
                if (docSnap.exists()) {
                    const orderData = { ...docSnap.data(), id: docSnap.id } as Order;
                    setOrder(orderData);
                    
                    if (orderData.status === 'Processing' || orderData.status === 'Completed') {
                        setIsLoading(false);
                        setError(null);
                    }
                } else {
                    setIsLoading(false);
                    notFound();
                }
            }, (err) => {
                console.error("Error with real-time listener:", err);
                setError("There was a problem confirming your order status.");
                setIsLoading(false);
            });

            // Fallback timer to check for ITN issues
            const timer = setTimeout(() => {
                if (isLoading) {
                    // Re-check order one last time
                    if (order) {
                        if (!order.itnHistory || order.itnHistory.length === 0) {
                            setError("We haven't received payment confirmation from PayFast yet. Please don't worry, your order is safe. Our team will manually verify it shortly. You can check your dashboard for updates.");
                        } else {
                            const lastAttempt = order.itnHistory[order.itnHistory.length - 1];
                            if (lastAttempt.status === 'Failed') {
                                setError(`Payment confirmation failed: ${lastAttempt.message}. Please contact support with your order ID.`);
                            }
                        }
                    } else {
                        setError("Confirmation is taking longer than expected. Please check your dashboard for updates or contact support if your order status doesn't update within a few minutes.");
                    }
                    setIsLoading(false);
                }
            }, 15000); // 15 seconds

            return () => {
                unsubscribe();
                clearTimeout(timer);
            };
        }
    }, [orderId, order, isLoading]); // Add order and isLoading to dependency array

    const ConfirmationView = () => (
        <CardHeader className="text-center">
            <CheckCircle className="mx-auto h-12 w-12 text-green-500" />
            <CardTitle className="text-3xl mt-4">Payment Received!</CardTitle>
            <CardDescription>
                Thank you for your payment. Your order is now being processed.
            </CardDescription>
        </CardHeader>
    );

    const LoadingView = () => (
        <CardHeader className="text-center">
            <Loader2 className="mx-auto h-12 w-12 animate-spin text-primary" />
            <CardTitle className="text-3xl mt-4">Finalizing your order...</CardTitle>
            <CardDescription>
                Please wait while we confirm your payment. This may take a few moments.
            </CardDescription>
        </CardHeader>
    );
    
    if (!order && isLoading) {
        return (
             <div className="container mx-auto px-4 py-20 text-center">
                <Loader2 className="mx-auto h-12 w-12 animate-spin text-primary" />
                <h1 className="mt-4 text-2xl font-semibold">Loading Your Order...</h1>
            </div>
        )
    }

    if (!order) {
        return notFound();
    }

    return (
        <div className="container mx-auto px-4 py-12 max-w-4xl">
            <Card>
                {isLoading ? <LoadingView /> : <ConfirmationView />}
                <CardContent className="space-y-8">
                     <section>
                        <h3 className="font-semibold text-lg mb-2">Order Summary</h3>
                        <div className="border rounded-lg p-4 space-y-2">
                           <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Order ID:</span>
                                <span className="font-mono">{order.id}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Order Date:</span>
                                <span>{new Date(order.date.seconds * 1000).toLocaleDateString()}</span>
                            </div>
                            <Separator />
                            {order.items.map((item, index) => (
                                <div key={index} className="flex justify-between items-center">
                                    <p>{item.title}</p>
                                    <p className="font-semibold">{formatPrice(item.price)}</p>
                                </div>
                            ))}
                             <Separator />
                            <div className="flex justify-between font-bold text-lg">
                                <p>Total Paid</p>
                                <p>{formatPrice(order.total)}</p>
                            </div>
                        </div>
                    </section>
                    
                    {error && (
                        <div className="flex items-center gap-4 bg-destructive/10 border border-destructive/20 p-4 rounded-lg">
                            <AlertTriangle className="h-6 w-6 text-destructive" />
                            <p className="text-sm text-destructive">{error}</p>
                        </div>
                    )}

                    <div className="text-center pt-4">
                        <Button asChild>
                            <Link href="/dashboard/orders">Go to My Dashboard</Link>
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
