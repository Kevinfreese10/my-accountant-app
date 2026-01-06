
'use client';
import { useEffect, useState, Suspense } from 'react';
import { useParams, notFound, useRouter, useSearchParams } from 'next/navigation';
import { getFirestore, doc, onSnapshot } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { Order } from '@/lib/types';
import { Loader2, CheckCircle, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

const db = getFirestore(firebaseApp);

function PaymentSuccessContent() {
    const params = useParams();
    const router = useRouter();
    const searchParams = useSearchParams();
    const orderId = params.orderId as string;
    const [order, setOrder] = useState<Order | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (orderId) {
            const orderRef = doc(db, 'orders', orderId);

            const unsubscribe = onSnapshot(orderRef, (docSnap) => {
                if (docSnap.exists()) {
                    const orderData = { 
                        ...docSnap.data(), 
                        id: docSnap.id,
                        date: docSnap.data().date.toDate().toISOString()
                    } as Order;
                    setOrder(orderData);
                    
                    // If payment is complete, redirect to the order details page
                    if (orderData.status === 'Processing' || orderData.status === 'Completed') {
                        router.replace(`/dashboard/orders/${orderId}`);
                    } else {
                        // Still loading or pending
                        setIsLoading(true);
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

            // Set a timeout to handle cases where ITN is delayed
            const timer = setTimeout(() => {
                if (isLoading) {
                    setIsLoading(false); // Stop loading to show a message
                    setError("Confirmation is taking longer than expected. We will update your order status as soon as we receive confirmation from the payment provider. Please check your dashboard shortly.");
                }
            }, 15000); // 15 seconds

            return () => {
                unsubscribe();
                clearTimeout(timer);
            };
        }
    }, [orderId, router, isLoading]);

    if (!order && isLoading) {
         return (
             <div className="container mx-auto px-4 py-20 text-center">
                <Loader2 className="mx-auto h-12 w-12 animate-spin text-primary" />
                <h1 className="mt-4 text-2xl font-semibold">Finalizing your order...</h1>
                <p className="text-muted-foreground">Please wait while we confirm your payment. Do not close this page.</p>
            </div>
        )
    }
    
    if (!order) {
        return notFound();
    }
    
     if (error) {
        return (
            <div className="container mx-auto px-4 py-12 max-w-2xl">
                 <Card>
                    <CardHeader className="text-center">
                        <AlertTriangle className="mx-auto h-12 w-12 text-yellow-500" />
                        <CardTitle className="text-3xl mt-4">Payment Confirmation Pending</CardTitle>
                    </CardHeader>
                    <CardContent className="text-center space-y-4">
                        <p className="text-muted-foreground">{error}</p>
                         <Button asChild>
                            <Link href="/dashboard/orders">Go to My Dashboard</Link>
                        </Button>
                    </CardContent>
                </Card>
            </div>
        )
     }

    // This view will only show briefly before redirect, or if the redirect fails.
    return (
        <div className="container mx-auto px-4 py-12 max-w-2xl">
             <Card>
                <CardHeader className="text-center">
                    <CheckCircle className="mx-auto h-12 w-12 text-green-500" />
                    <CardTitle className="text-3xl mt-4">Payment Success!</CardTitle>
                     <CardDescription>Redirecting you to your order...</CardDescription>
                </CardHeader>
                <CardContent className="text-center">
                    <Loader2 className="mx-auto h-8 w-8 animate-spin" />
                </CardContent>
             </Card>
        </div>
    );
}

export default function PaymentSuccessPage() {
    return (
        <Suspense fallback={<div className="flex h-screen items-center justify-center"><Loader2 className="h-12 w-12 animate-spin"/></div>}>
            <PaymentSuccessContent />
        </Suspense>
    )
}
