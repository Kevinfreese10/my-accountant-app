
'use client';
import { useEffect, useState } from 'react';
import { useParams, notFound, useRouter } from 'next/navigation';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { Order } from '@/lib/types';
import { Loader2, CheckCircle, Banknote, LogIn } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';

const db = getFirestore(firebaseApp);

const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-ZA', {
      style: 'currency',
      currency: 'ZAR',
    }).format(price);
};

export default function OrderConfirmationPage() {
    const params = useParams();
    const router = useRouter();
    const { user, isAuthenticated } = useAuth();
    const orderId = params.orderId as string;
    const [order, setOrder] = useState<Order | null>(null);
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

                    // If user is authenticated and lands here, redirect them to PayFast immediately.
                    if (isAuthenticated && orderData.status === 'Pending Payment') {
                        handlePayNow(orderData);
                    }
                } else {
                    notFound();
                }
                setIsLoading(false);
            };
            fetchOrder();
        }
    }, [orderId, isAuthenticated]); // Rerun when authentication status changes
    
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
    
    return (
        <div className="container mx-auto px-4 py-12 max-w-4xl">
            <Card>
                <CardHeader className="text-center">
                    <CheckCircle className="mx-auto h-12 w-12 text-green-500" />
                    <CardTitle className="text-3xl mt-4">Order Placed Successfully!</CardTitle>
                    <CardDescription>
                       Please complete payment for your order using the secure PayFast button below.
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
                        {isAuthenticated ? (
                             <Button onClick={() => handlePayNow(order)} className="w-full max-w-sm">
                                Pay Now with PayFast
                            </Button>
                        ) : (
                             <Button onClick={() => handlePayNow(order)} className="w-full max-w-sm">
                                <LogIn className="mr-2 h-4 w-4" /> Login or Sign Up to Pay
                            </Button>
                        )}
                       
                    </section>
                </CardContent>
            </Card>
        </div>
    );
}
