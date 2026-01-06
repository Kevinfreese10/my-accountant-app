
'use client';
import { useEffect, useState } from 'react';
import { useParams, notFound } from 'next/navigation';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { Order, User } from '@/lib/types';
import { Loader2, CheckCircle, Banknote } from 'lucide-react';
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

export default function OrderConfirmationPage() {
    const params = useParams();
    const orderId = params.orderId as string;
    const [order, setOrder] = useState<Order | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [reseller, setReseller] = useState<User | null>(null);

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

                    if (orderData.resellerId) {
                        const resellerRef = doc(db, 'users', orderData.resellerId);
                        const resellerSnap = await getDoc(resellerRef);
                        if (resellerSnap.exists()) {
                            setReseller(resellerSnap.data() as User);
                        }
                    }

                } else {
                    notFound();
                }
                setIsLoading(false);
            };
            fetchOrder();
        }
    }, [orderId]);
    
    const handlePayNow = (order: Order) => {
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
    
    const bankingDetails = reseller?.bankingDetails || {
        bankName: 'FNB',
        accountHolder: 'My Accountant (Pty) Ltd',
        accountNumber: '63084378223',
        branchCode: '250655',
    };
    const hasBankingDetails = !!(bankingDetails.bankName && bankingDetails.accountHolder && bankingDetails.accountNumber);

    return (
        <div className="container mx-auto px-4 py-12 max-w-4xl">
            <Card>
                <CardHeader className="text-center">
                    <CheckCircle className="mx-auto h-12 w-12 text-green-500" />
                    <CardTitle className="text-3xl mt-4">Order Placed Successfully!</CardTitle>
                    <CardDescription>
                       Please complete payment for your order using one of the methods below.
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
                    
                    <section>
                        <h3 className="font-semibold text-lg mb-2">Payment Options</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-4">
                                <h4 className="font-medium">1. Pay with PayFast</h4>
                                <p className="text-sm text-muted-foreground">Click the button below to pay securely online with your card or instant EFT via PayFast.</p>
                                <Button onClick={() => handlePayNow(order)} className="w-full">
                                    Pay Now with PayFast
                                </Button>
                            </div>
                             {hasBankingDetails && (
                                <div className="space-y-4">
                                     <h4 className="font-medium">2. Pay via EFT</h4>
                                     <div className="text-sm space-y-2 p-4 bg-muted rounded-lg">
                                        <p><strong>Bank:</strong> {bankingDetails.bankName}</p>
                                        <p><strong>Account Holder:</strong> {bankingDetails.accountHolder}</p>
                                        <p><strong>Account Number:</strong> {bankingDetails.accountNumber}</p>
                                        <p><strong>Branch Code:</strong> {bankingDetails.branchCode}</p>
                                        <p><strong>Reference:</strong> <span className="font-bold text-destructive">{order.id}</span></p>
                                    </div>
                                </div>
                             )}
                        </div>
                    </section>

                    <div className="text-center pt-4">
                        <p className="text-sm text-muted-foreground">Once payment is complete, you can track your order status in your dashboard.</p>
                        <Button asChild className="mt-4">
                            <Link href="/dashboard/orders">Login to Dashboard</Link>
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
