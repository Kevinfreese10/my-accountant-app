'use client';
import { useEffect, useState, useMemo, useRef } from 'react';
import { useParams, notFound } from 'next/navigation';
import { getFirestore, doc, onSnapshot, collection, query, where, getDocs, getDoc, updateDoc, arrayUnion, Timestamp } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { Order, Service, User, OrderNote } from '@/lib/types';
import { Loader2, CheckCircle, Clock } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { format, addDays } from 'date-fns';
import { useAuth } from '@/contexts/AuthContext';
import { services as allServices } from '@/lib/data';
import { render } from '@react-email/components';
import React from 'react';
import DocumentRequestEmail from '@/components/emails/DocumentRequestEmail';
import { sendEmail } from '@/lib/email';

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
    const [assignee, setAssignee] = useState<User | null>(null);
    const { user: currentUser } = useAuth();
    const emailSentRef = useRef(false);

    useEffect(() => {
        if (!orderId) return;

        // Real-time listener — the PayFast ITN fires asynchronously after the
        // return_url redirect, so we watch for the status to flip to Processing.
        const orderRef = doc(db, 'orders', orderId);
        const unsubscribe = onSnapshot(orderRef, async (orderSnap) => {
            if (!orderSnap.exists()) {
                notFound();
                return;
            }

            const orderData = { ...orderSnap.data(), id: orderSnap.id } as Order;

            // Trigger Google Customer Reviews Opt-in once
            if (isLoading && typeof window !== 'undefined' && (window as any).renderOptIn) {
                const deliveryDate = format(addDays(new Date(), 10), 'yyyy-MM-dd');
                (window as any).renderOptIn({
                    id: orderData.id,
                    customerEmail: orderData.customerEmail,
                    estimated_delivery_date: deliveryDate,
                });
            }

            setOrder(orderData);
            setIsLoading(false);

            // Send document-request email as a fallback (server action).
            // The ITN also sends this email, but if the ITN is delayed or blocked,
            // this ensures the customer still gets the notification promptly.
            // The alreadyNotified check prevents duplicates.
            if (!emailSentRef.current) {
                emailSentRef.current = true;

                const alreadyNotified = orderData.notes?.some(
                    n => n.subject === `Action Required for Your Order #${orderId}`
                );

                if (!alreadyNotified) {
                    try {
                        // Fetch reseller details if it's a white-label order
                        let resellerData: User | undefined;
                        if (orderData.resellerId) {
                            const resellerSnap = await getDoc(doc(db, 'users', orderData.resellerId));
                            if (resellerSnap.exists()) {
                                resellerData = { ...resellerSnap.data(), id: resellerSnap.id } as User;
                            }
                        }

                        const itemsWithServices = orderData.items.map(item => {
                            const service = allServices.find(s => s.id === item.id);
                            return { ...item, service };
                        }).filter(item => item.service) as { service: Service }[];

                        const emailHtml = render(
                            React.createElement(DocumentRequestEmail, {
                                order: orderData,
                                items: itemsWithServices,
                                reseller: resellerData,
                                replyTo: resellerData?.email || 'info@myacc.co.za',
                            })
                        );

                        const attachments = itemsWithServices
                            .filter(item => item.service.attachmentUrl)
                            .map(item => ({
                                filename: `${item.service.title.replace(/\s/g, '_')}.pdf`,
                                path: item.service.attachmentUrl!,
                            }));

                        const recipientEmail = orderData.resellerId && orderData.endCustomerEmail
                            ? orderData.endCustomerEmail
                            : orderData.customerEmail;

                        await sendEmail({
                            to: recipientEmail,
                            subject: `Action Required for Your Order #${orderId}`,
                            html: emailHtml,
                            attachments: attachments,
                            resellerId: orderData.resellerId || undefined,
                        });

                        const emailNote: OrderNote = {
                            text: `Sent "Request Documents" email to ${recipientEmail} (Payment Success Page).`,
                            date: Timestamp.now(),
                            authorId: 'system',
                            type: 'email',
                            subject: `Action Required for Your Order #${orderId}`,
                            attachments: null,
                        };
                        await updateDoc(orderRef, { notes: arrayUnion(emailNote) });
                    } catch (e) {
                        console.error('Failed to send document request email:', e);
                    }
                }
            }

            // Fetch assignee if set
            if (orderData.assignedTo && orderData.assignedTo.length > 0 && !assignee) {
                const staffQuery = query(
                    collection(db, 'users'),
                    where('uid', '==', orderData.assignedTo[0])
                );
                const staffSnapshot = await getDocs(staffQuery);
                if (!staffSnapshot.empty) {
                    setAssignee(staffSnapshot.docs[0].data() as User);
                }
            }
        }, () => {
            setIsLoading(false);
        });

        return () => unsubscribe();
    }, [orderId]);

    const orderUrl = useMemo(() => {
        if (!currentUser) return '/login';
        if (currentUser.role === 'admin' || currentUser.role === 'staff') return `/admin/orders/${orderId}`;
        if (currentUser.role === 'partner' || currentUser.role === 'partner_staff') return `/partner/orders/${orderId}`;
        return `/dashboard/orders/${orderId}`;
    }, [currentUser, orderId]);
    
    if (isLoading) {
        return (
            <div className="container mx-auto px-4 py-20 text-center">
                <Loader2 className="mx-auto h-12 w-12 animate-spin text-primary" />
                <h1 className="mt-4 text-2xl font-semibold">Finalizing your order...</h1>
                <p className="text-muted-foreground">Please wait while we confirm your payment.</p>
            </div>
        );
    }
    
    if (!order) {
        return notFound();
    }

    const orderedServices = order.items.map(item => {
        return allServices.find(s => s.id === item.id);
    }).filter((s): s is Service => s !== undefined);


    return (
        <div className="container mx-auto px-4 py-12 max-w-4xl">
            <Card>
                <CardHeader className="text-center">
                    <CheckCircle className="mx-auto h-12 w-12 text-green-500" />
                    <CardTitle className="text-3xl mt-4">Payment Received!</CardTitle>
                    <CardDescription>
                        Thank you — your payment was successful. We are now processing your order.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-8">

                    {/* Real-time order status indicator */}
                    <div className="flex items-center justify-between rounded-lg border bg-muted/40 px-4 py-3">
                        <span className="text-sm font-medium text-muted-foreground">Order Status</span>
                        {order.status === 'Processing' ? (
                            <Badge variant="info" className="flex items-center gap-1">
                                <CheckCircle className="h-3 w-3" /> Processing
                            </Badge>
                        ) : (
                            <Badge variant="warning" className="flex items-center gap-1">
                                <Clock className="h-3 w-3 animate-spin" /> Confirming payment…
                            </Badge>
                        )}
                    </div>

                    <section>
                        <h3 className="font-semibold text-lg mb-2">Order Summary</h3>
                        <div className="border rounded-lg p-4 space-y-2">
                           <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Order ID:</span>
                                <span className="font-mono">{order.id}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Order Date:</span>
                                <span>{order.date?.toDate ? format(order.date.toDate(), 'dd/MM/yyyy') : format(new Date(order.date), 'dd/MM/yyyy')}</span>
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
                                <p>{formatPrice(order.clientTotal || order.total)}</p>
                            </div>
                        </div>
                    </section>

                    <section>
                        <h3 className="font-semibold text-lg mb-2">Next Steps</h3>
                        <p className="text-sm text-muted-foreground mb-4">
                            We have emailed you the documents required to get started. You can also log into your dashboard to securely upload everything so we can begin processing your order immediately.
                        </p>
                        <div className="space-y-4">
                            {orderedServices.map(service => (
                                <div key={service.id}>
                                    <h4 className="font-semibold">{service.title}</h4>
                                    <ul className="list-disc pl-5 mt-2 space-y-1 text-sm text-muted-foreground">
                                        {service.clientRequirements.map((req, index) => (
                                            <li key={index}>{req}</li>
                                        ))}
                                    </ul>
                                </div>
                            ))}
                        </div>
                    </section>

                    <div className="text-center pt-4">
                        <Button asChild size="lg">
                            <Link href={orderUrl}>
                                Go to My Dashboard
                            </Link>
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
