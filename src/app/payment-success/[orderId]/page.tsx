
'use client';
import { useEffect, useState } from 'react';
import { useParams, notFound, useRouter } from 'next/navigation';
import { getFirestore, doc, onSnapshot } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { Order } from '@/lib/types';
import { Loader2, CheckCircle } from 'lucide-react';
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

    useEffect(() => {
        if (orderId) {
            const orderRef = doc(db, 'orders', orderId);
            const unsubscribe = onSnapshot(orderRef, (docSnap) => {
                if (docSnap.exists()) {
                    const orderData = { ...docSnap.data(), id: docSnap.id } as Order;
                    setOrder(orderData);
                    // If status is 'Processing' or 'Completed', we know ITN was successful
                    if (orderData.status === 'Processing' || orderData.status === 'Completed') {
                        setIsLoading(false);
                    }
                } else {
                    setIsLoading(false);
                    notFound();
                }
            }, (error) => {
                console.error("Error fetching order:", error);
                setIsLoading(false);
                notFound();
            });

            // Fallback timer in case ITN is delayed
            const timer = setTimeout(() => {
                if (isLoading) {
                    setIsLoading(false);
                }
            }, 10000); // 10 seconds

            return () => {
                unsubscribe();
                clearTimeout(timer);
            };
        }
    }, [orderId]);

    if (isLoading) {
        return (
            <div className="container mx-auto px-4 py-20 text-center">
                <Loader2 className="mx-auto h-12 w-12 animate-spin text-primary" />
                <h1 className="mt-4 text-2xl font-semibold">Finalizing your order...</h1>
                <p className="text-muted-foreground">Please wait while we confirm your payment with the bank.</p>
            </div>
        );
    }
    
    if (!order) {
        return notFound();
    }

    return (
        <div className="container mx-auto px-4 py-12 max-w-4xl">
            <Card>
                <CardHeader className="text-center">
                    <CheckCircle className="mx-auto h-12 w-12 text-green-500" />
                    <CardTitle className="text-3xl mt-4">Payment Received!</CardTitle>
                    <CardDescription>
                       Thank you for your payment. Your order is now being processed.
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
