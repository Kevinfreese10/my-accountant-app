'use client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Order } from '@/lib/types';
import { useState, useEffect } from 'react';
import { getFirestore, collection, query, where, getDocs, orderBy, or } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { Loader2, ArrowRight } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { format } from 'date-fns';
import { getPayFastConfig } from '@/lib/payfast';

const db = getFirestore(firebaseApp);

export default function DashboardPage() {
    const { user } = useAuth();
    const [orders, setOrders] = useState<Order[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchOrders = async () => {
            if (!user?.uid) return;
            setIsLoading(true);
            try {
                // Expanded query to look for userId OR email match in customer/end-customer fields
                const q = query(
                    collection(db, 'orders'), 
                    or(
                        where('userId', '==', user.uid),
                        where('customerEmail', '==', user.email),
                        where('endCustomerEmail', '==', user.email)
                    ),
                    orderBy('date', 'desc')
                );
                
                const querySnapshot = await getDocs(q);
                const fetchedOrders = querySnapshot.docs.map(doc => {
                    const data = doc.data();
                    return {
                        ...data,
                        id: doc.id,
                        date: data.date.toDate().toISOString(),
                    } as Order;
                });
                // Deduplicate in case an order matches multiple conditions
                const uniqueOrders = Array.from(new Map(fetchedOrders.map(o => [o.id, o])).values());
                setOrders(uniqueOrders.filter(order => order.status !== 'Cancelled'));
            } catch (error) {
                console.error("Error fetching orders:", error);
            } finally {
                setIsLoading(false);
            }
        };
        fetchOrders();
    }, [user]);

    const getStatusVariant = (status: Order['status'] | 'Outsourced') => {
        switch (status) {
            case 'Completed': return 'success';
            case 'Processing':
            case 'Outsourced':
                return 'info';
            case 'Pending Payment': return 'warning';
            case 'Cancelled': return 'destructive';
            default: return 'secondary';
        }
    };
    
     const formatPrice = (price: number) => {
        return new Intl.NumberFormat('en-ZA', {
          style: 'currency',
          currency: 'ZAR',
        }).format(price);
    };

    const handlePayNow = (order: Order) => {
        const { processUrl, merchantId, merchantKey } = getPayFastConfig();
        const form = document.createElement('form');
        form.method = 'POST';
        form.action = processUrl;

        const origin = typeof window !== 'undefined' ? window.location.origin : (process.env.NEXT_PUBLIC_APP_URL || 'https://www.myacc.co.za');

        const data: { [key: string]: string } = {
            merchant_id: merchantId,
            merchant_key: merchantKey,
            return_url: `${origin}/payment-success/${order.id}`,
            cancel_url: `${origin}/dashboard/orders`,
            notify_url: `${origin}/api/payfast/notify`,
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
    };

    return (
        <div className="space-y-8">
            <Card>
                <CardHeader>
                    <CardTitle>My Orders</CardTitle>
                    <CardDescription>A list of your recent product orders.</CardDescription>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="flex justify-center items-center h-40">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        </div>
                    ) : orders.length === 0 ? (
                        <div className="text-center py-10">
                            <p className="text-muted-foreground">You haven't placed any orders yet.</p>
                            <Button asChild className="mt-4">
                                <Link href="/products">Browse Products</Link>
                            </Button>
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Order ID</TableHead>
                                    <TableHead>Date</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className="text-right">Total</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {orders.map(order => (
                                    <TableRow key={order.id}>
                                        <TableCell className="font-medium">{order.id}</TableCell>
                                        <TableCell>{format(new Date(order.date), 'dd MMMM yyyy')}</TableCell>
                                        <TableCell>
                                            <Badge variant={getStatusVariant(order.status)}>
                                                {order.status === 'Outsourced' ? 'Processing' : order.status}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right">{formatPrice(order.total)}</TableCell>
                                        <TableCell className="text-right">
                                            {order.status === 'Pending Payment' ? (
                                                <Button size="sm" onClick={() => handlePayNow(order)}>
                                                    Pay Now
                                                </Button>
                                            ) : (
                                                <Button variant="ghost" size="sm" asChild>
                                                    <Link href={`/dashboard/orders/${order.id}`}>
                                                        View <ArrowRight className="ml-2 h-4 w-4" />
                                                    </Link>
                                                </Button>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
