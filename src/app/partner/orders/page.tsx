'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import Link from 'next/link';
import { getFirestore, collection, getDocs, orderBy, query, where, doc, updateDoc, arrayUnion, getDoc, Timestamp, addDoc, writeBatch, onSnapshot, setDoc, serverTimestamp, increment } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { Order, User, Service, OrderNote, Task, ItnLog } from '@/lib/types';
import { useAuth } from '@/contexts/AuthContext';
import { services as allServices } from '@/lib/data';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { MoreHorizontal, Loader2, PlusCircle, MessageSquare, ArrowRight, CheckCircle2, Wallet2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from '@/components/ui/dropdown-menu';
import { format, formatDistanceToNow } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import CreatePartnerOrderForm from '@/components/partner/CreatePartnerOrderForm';
import { useRouter } from 'next/navigation';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { render } from '@react-email/components';
import React from 'react';
import DocumentRequestEmail from '@/components/emails/DocumentRequestEmail';
import { sendEmail } from '@/lib/email';
import { getNextOrderId } from '@/lib/sequence';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError, type SecurityRuleContext } from '@/firebase/errors';


const db = getFirestore(firebaseApp);

export default function PartnerOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  const { user } = useAuth();
  const [allStaff, setAllStaff] = useState<User[]>([]);
  const [outsourceOptionsOpen, setOutsourceOptionsOpen] = useState(false);
  const [isCreateOrderOpen, setIsCreateOrderOpen] = useState(false);
  const [selectedOrderForOutsource, setSelectedOrderForOutsource] = useState<Order | null>(null);
  const [docContactPreference, setDocContactPreference] = useState<'reseller' | 'client'>('reseller');
  const [isProcessingOutsource, setIsProcessingOutsource] = useState(false);
  
  const staffCounters = useRef<{ [key: string]: number }>({});
  const router = useRouter();
    
  const orderStatuses: Order['status'][] = ['Pending Payment', 'Processing', 'Completed', 'Cancelled'];
  const partnerId = user?.role === 'partner' ? user.uid : user?.partnerId;

  const getNextStaffMember = (department: 'Accounting and Tax' | 'Administration' | 'CAP'): User | undefined => {
      const staffInDept = allStaff.filter(u => u.role === 'staff' && u.department === department);
      if (staffInDept.length === 0) return undefined;

      const currentIndex = staffCounters.current[department] || 0;
      const nextStaff = staffInDept[currentIndex];
      
      staffCounters.current[department] = (currentIndex + 1) % staffInDept.length;
      
      return nextStaff;
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-ZA', {
      style: 'currency',
      currency: 'ZAR',
      minimumFractionDigits: price % 1 === 0 ? 0 : 2,
      maximumFractionDigits: 2,
    }).format(price);
  };


  useEffect(() => {
    if (!user?.uid || !partnerId) {
        setIsLoading(false);
        return;
    }
    
    setIsLoading(true);

    const staffQuery = query(collection(db, "users"), where('role', 'in', ['staff', 'admin']));
    getDocs(staffQuery).then(staffSnapshot => {
        const fetchedStaff = staffSnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as User));
        setAllStaff(fetchedStaff);
    });

    const ordersRef = collection(db, 'orders');
    const q = query(ordersRef, where('resellerId', '==', partnerId), where('originalOrderId', '==', null), orderBy('date', 'desc'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
        const fetchedOrders = snapshot.docs.map(doc => {
            const data = doc.data();
            return {
                ...data,
                id: doc.id,
                date: data.date?.toDate ? data.date.toDate().toISOString() : new Date().toISOString(),
            } as Order;
        });
        setOrders(fetchedOrders.filter(order => order.status !== 'Cancelled'));
        setIsLoading(false);
    }, async (error) => {
        const permissionError = new FirestorePermissionError({
            path: 'orders',
            operation: 'list',
        } satisfies SecurityRuleContext);
        errorEmitter.emit('permission-error', permissionError);
        setIsLoading(false);
    });

    return () => unsubscribe();
  }, [user?.uid, partnerId]);

    const handleOutsource = async () => {
        if (!user || !selectedOrderForOutsource || !partnerId) return;
        
        setIsProcessingOutsource(true);
        toast({
            title: 'Processing Outsourcing Request...',
            description: `Submitting order ${selectedOrderForOutsource.id} to My Accountant.`
        });
    
        try {
            // Determine the practice owner's profile for credit checks
            const partnerRef = doc(db, 'users', partnerId);
            const partnerSnap = await getDoc(partnerRef);
            const partnerProfile = partnerSnap.data() as User;

            const cost = selectedOrderForOutsource.total;
            const currentBalance = partnerProfile.creditBalance || 0;
            
            // STRICT CREDIT CHECK - MUST PAY BEFORE OUTSOURCING
            if (currentBalance < cost) {
                toast({ 
                    title: 'Insufficient Credits', 
                    description: `You need ${formatPrice(cost - currentBalance)} more in your wallet to outsource this order.`, 
                    variant: 'destructive' 
                });
                setIsProcessingOutsource(false);
                return;
            }

            const newOrderId = await getNextOrderId(); // Use sequential ID
            const firstServiceId = selectedOrderForOutsource.items[0]?.id;
            const serviceDetails = allServices.find(s => s.id === firstServiceId);
            const department = serviceDetails?.department;
            
            const newOrderData: Order = {
                id: newOrderId,
                customerName: partnerProfile.companyName || partnerProfile.name,
                customerEmail: partnerProfile.email,
                customerPhone: partnerProfile.contactNumber || null,
                endCustomerName: selectedOrderForOutsource.endCustomerName || selectedOrderForOutsource.customerName || null,
                endCustomerEmail: selectedOrderForOutsource.endCustomerEmail || selectedOrderForOutsource.customerEmail || null,
                documentContact: docContactPreference,
                date: Timestamp.now(),
                items: selectedOrderForOutsource.items.map(item => ({
                    id: item.id,
                    title: item.title,
                    price: item.price,
                    quantity: item.quantity,
                })),
                total: cost,
                status: 'Processing', // PAID VIA CREDITS - MOVES DIRECTLY TO PROCESSING
                resellerId: partnerId || null,
                originalOrderId: selectedOrderForOutsource.id,
                discountCode: null,
                discountAmount: null,
                userId: selectedOrderForOutsource.userId || null,
                source: 'Partner',
                department: department || null,
                assignedTo: null,
            };
            
            if (department) {
              const assignedStaff = getNextStaffMember(department);
              newOrderData.assignedTo = assignedStaff?.id ? [assignedStaff.id] : null;
            }
            
            // USE BATCH TO ENSURE ATOMICITY
            const batch = writeBatch(db);

            // 1. Deduct credits from practice wallet
            batch.update(partnerRef, {
                creditBalance: increment(-cost)
            });

            // 2. Create the main store order
            batch.set(doc(db, 'orders', newOrderId), newOrderData);
    
            // 3. Update original order status to Processing
            const originalOrderRef = doc(db, 'orders', selectedOrderForOutsource.id);
            batch.update(originalOrderRef, {
                isOutsourced: true,
                status: 'Processing',
                documentContact: docContactPreference,
            });

            // Commit Batch
            batch.commit().catch(async (error) => {
                const permissionError = new FirestorePermissionError({
                    path: 'batch-outsource',
                    operation: 'write',
                } satisfies SecurityRuleContext);
                errorEmitter.emit('permission-error', permissionError);
            });

            // 4. Notify Client (Document Request)
            const emailTo = newOrderData.endCustomerEmail || newOrderData.customerEmail;
            if (emailTo) {
                const itemsWithServices = newOrderData.items.map(item => {
                    const service = allServices.find(s => s.id === item.id);
                    return { ...item, service };
                }).filter(item => item.service) as { service: Service }[];

                const emailHtml = render(React.createElement(DocumentRequestEmail, {
                    order: { ...newOrderData, id: newOrderId },
                    items: itemsWithServices,
                    reseller: partnerProfile,
                    replyTo: partnerProfile.email,
                }));

                await sendEmail({
                    to: emailTo,
                    subject: `Action Required for Your Order #${selectedOrderForOutsource.id}`,
                    html: emailHtml,
                    resellerId: partnerId,
                });

                // Add note to original order about the outsourcing
                const note: OrderNote = {
                    text: `Order outsourced to My Accountant. Credits deducted: ${formatPrice(cost)}. Document request sent to ${emailTo}.`,
                    date: Timestamp.now(),
                    authorId: 'system',
                    type: 'note',
                    subject: null,
                    attachments: null,
                };
                updateDoc(originalOrderRef, {
                    notes: arrayUnion(note)
                }).catch(async (error) => {
                    const permissionError = new FirestorePermissionError({
                        path: originalOrderRef.path,
                        operation: 'update',
                        requestResourceData: { notes: arrayUnion(note) }
                    } satisfies SecurityRuleContext);
                    errorEmitter.emit('permission-error', permissionError);
                });
            }
    
            toast({ title: 'Order Outsourced', description: `${formatPrice(cost)} deducted from practice wallet.` });
            setOutsourceOptionsOpen(false);
            setSelectedOrderForOutsource(null);
            
            router.push(`/payment-success/${newOrderId}`);
    
        } catch (error) {
             console.error('Error outsourcing order: ', error);
            toast({
                title: 'Outsourcing Failed',
                description: 'There was a problem submitting your order. Please try again.',
                variant: 'destructive',
            });
        } finally {
            setIsProcessingOutsource(false);
        }
      };

    const handleUpdateStatus = async (orderId: string, newStatus: Order['status']) => {
    const orderToUpdate = orders.find(o => o.id === orderId);
    if (!orderToUpdate || !user || !partnerId) return;

    try {
      const orderRef = doc(db, 'orders', orderId);
      updateDoc(orderRef, {
        status: newStatus,
      }).catch(async (error) => {
          const permissionError = new FirestorePermissionError({
              path: orderRef.path,
              operation: 'update',
              requestResourceData: { status: newStatus }
          } satisfies SecurityRuleContext);
          errorEmitter.emit('permission-error', permissionError);
      });

      if (newStatus === 'Processing') {
          // If moving to processing and NOT outsourced, create an internal task
          if (!orderToUpdate.isOutsourced) {
              const taskData = {
                  title: `Process Order: ${orderToUpdate.id}`,
                  description: `Practice fulfillment for ${orderToUpdate.endCustomerName || orderToUpdate.customerName}. Services: ${orderToUpdate.items.map(i => i.title).join(', ')}.`,
                  assignedTo: [user.uid],
                  createdBy: user.uid,
                  dueDate: Timestamp.fromDate(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)),
                  priority: 'Medium' as const,
                  status: 'To-Do' as const,
                  orderId: orderToUpdate.id,
                  partnerId: partnerId,
                  comments: [],
                  createdAt: serverTimestamp(),
              };
              addDoc(collection(db, 'tasks'), taskData).catch(async (error) => {
                  const permissionError = new FirestorePermissionError({
                      path: 'tasks',
                      operation: 'create',
                      requestResourceData: taskData
                  } satisfies SecurityRuleContext);
                  errorEmitter.emit('permission-error', permissionError);
              });
              toast({ title: 'Task Created', description: 'A task has been added to your dashboard for fulfillment.' });
          }

          // NOTIFY CLIENT: Confirmation of payment & Request for documents
          const emailTo = orderToUpdate.endCustomerEmail || orderToUpdate.customerEmail;
          if (emailTo) {
              const itemsWithServices = orderToUpdate.items.map(item => {
                  const service = allServices.find(s => s.id === item.id);
                  return { ...item, service };
              }).filter(item => item.service) as { service: Service }[];

              const emailHtml = render(React.createElement(DocumentRequestEmail, {
                  order: { ...orderToUpdate, id: orderToUpdate.originalOrderId || orderToUpdate.id },
                  items: itemsWithServices,
                  reseller: user,
                  replyTo: user.email,
              }));

              await sendEmail({
                  to: emailTo,
                  subject: `Action Required for Your Order #${orderToUpdate.originalOrderId || orderToUpdate.id}`,
                  html: emailHtml,
                  resellerId: partnerId,
              });

              const note: OrderNote = {
                  text: `Sent "Payment Confirmed & Request Documents" email to ${emailTo}.`,
                  date: Timestamp.now(),
                  authorId: user.uid,
                  type: 'email',
                  subject: `Action Required for Your Order #${orderToUpdate.originalOrderId || orderToUpdate.id}`,
                  attachments: null,
              };
              updateDoc(orderRef, {
                  notes: arrayUnion(note)
              }).catch(async (error) => {
                  const permissionError = new FirestorePermissionError({
                      path: orderRef.path,
                      operation: 'update',
                      requestResourceData: { notes: arrayUnion(note) }
                  } satisfies SecurityRuleContext);
                  errorEmitter.emit('permission-error', permissionError);
              });
          }
      }

      toast({
        title: 'Status Updated',
        description: `Order ${orderId} has been marked as ${newStatus}.`,
      });

    } catch (error) {
      console.error('Error updating order status: ', error);
      toast({
        title: 'Update Failed',
        description: 'There was a problem updating the order status.',
        variant: 'destructive',
      });
    }
  };

    const getStatusVariant = (status: Order['status'] | 'Outsourced') => {
        switch (status) {
        case 'Completed':
            return 'success';
        case 'Processing':
        case 'Outsourced':
            return 'info';
        case 'Pending Payment':
            return 'warning';
        case 'Cancelled':
            return 'destructive';
        default:
            return 'secondary';
        }
    };
    
    const handleOrderCreated = () => {
        setIsCreateOrderOpen(false);
    };

    const costToOutsource = selectedOrderForOutsource?.total || 0;
    const currentWalletBalance = user?.creditBalance || 0; 
    const hasSufficientCredits = currentWalletBalance >= costToOutsource;

    return (
        <div className="space-y-8">
             <Dialog open={outsourceOptionsOpen} onOpenChange={setOutsourceOptionsOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Outsource Order #{selectedOrderForOutsource?.id}</DialogTitle>
                        <DialogDescription>
                            Confirm your document contact preference before submitting to My Accountant.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4 space-y-6">
                        <div className="space-y-3">
                            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Document Contact Preference</Label>
                            <RadioGroup 
                                value={docContactPreference} 
                                onValueChange={(v) => setDocContactPreference(v as 'reseller' | 'client')}
                                className="space-y-2"
                            >
                                <div className="flex items-start space-x-3 border rounded-md p-3 hover:bg-muted/50 cursor-pointer">
                                    <RadioGroupItem value="reseller" id="contact-reseller" className="mt-1" />
                                    <Label htmlFor="contact-reseller" className="cursor-pointer">
                                        <p className="font-semibold text-sm">Contact Me (The Partner)</p>
                                        <p className="text-[10px] text-muted-foreground">Communication and document requests will be sent to your email.</p>
                                    </Label>
                                </div>
                                <div className="flex items-start space-x-3 border rounded-md p-3 hover:bg-muted/50 cursor-pointer">
                                    <RadioGroupItem value="client" id="contact-client" className="mt-1" />
                                    <Label htmlFor="contact-client" className="cursor-pointer">
                                        <p className="font-semibold text-sm">Contact My Client Directly</p>
                                        <p className="text-[10px] text-muted-foreground">We will contact your client directly via white-label email.</p>
                                    </Label>
                                </div>
                            </RadioGroup>
                        </div>

                        <div className={cn(
                            "p-4 rounded-lg border space-y-2 text-sm",
                            hasSufficientCredits ? "bg-primary/5 border-primary/10" : "bg-destructive/5 border-destructive/20 shadow-sm"
                        )}>
                            <h4 className={cn("font-bold text-xs uppercase tracking-wider mb-2", hasSufficientCredits ? "text-primary" : "text-destructive flex items-center gap-2")}>
                                {!hasSufficientCredits && <AlertCircle className="h-3 w-3" />}
                                {hasSufficientCredits ? "Billing Summary" : "Insufficient Wallet Credits"}
                            </h4>
                            <div className="flex justify-between items-center">
                                <span className="text-muted-foreground text-xs">Wholesale Cost:</span>
                                <span className="font-semibold text-destructive">{formatPrice(costToOutsource)}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-muted-foreground text-xs">Available Balance:</span>
                                <span className="font-semibold">{formatPrice(currentWalletBalance)}</span>
                            </div>
                            <Separator className="my-2" />
                            {!hasSufficientCredits ? (
                                <div className="space-y-3">
                                    <p className="text-[10px] text-destructive font-bold leading-relaxed">
                                        You need an additional {formatPrice(costToOutsource - currentWalletBalance)} in your practice wallet to outsource this order.
                                    </p>
                                    <Button size="sm" variant="outline" className="w-full h-8 text-[10px] font-bold border-destructive/30 hover:bg-destructive/5" asChild>
                                        <Link href="/partner/dashboard">
                                            Go to Dashboard to Top Up <ArrowRight className="ml-1 h-3 w-3" />
                                        </Link>
                                    </Button>
                                </div>
                            ) : (
                                <p className="text-[10px] text-muted-foreground italic leading-relaxed">
                                    Credits will be deducted from your wallet immediately. My Accountant will begin work as soon as documents are received.
                                </p>
                            )}
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setOutsourceOptionsOpen(false)}>Cancel</Button>
                        <Button onClick={handleOutsource} disabled={isProcessingOutsource || !hasSufficientCredits}>
                            {isProcessingOutsource && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Proceed with Outsourcing
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

             <Card>
                <CardHeader>
                <div className="flex items-center justify-between">
                    <div>
                    <CardTitle>Your Client Orders</CardTitle>
                    <CardDescription>
                        View and manage all orders you've created for your clients.
                    </CardDescription>
                    </div>
                     <Dialog open={isCreateOrderOpen} onOpenChange={setIsCreateOrderOpen}>
                        <DialogTrigger asChild>
                             <Button>
                                <PlusCircle className="mr-2 h-4 w-4" />
                                Create New Order
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-4xl">
                             <DialogHeader>
                                <DialogTitle>New Order Details</DialogTitle>
                                <DialogDescription>Fill out the form below to create a new order for a client.</DialogDescription>
                            </DialogHeader>
                            <CreatePartnerOrderForm onOrderCreated={handleOrderCreated} />
                        </DialogContent>
                    </Dialog>
                </div>
                </CardHeader>
                <CardContent>
                {isLoading ? (
                    <div className="flex justify-center items-center h-64">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
                ) : orders.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">No client orders to display.</p>
                ) : (
                    <Table>
                    <TableHeader>
                        <TableRow>
                        <TableHead>Order ID</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Customer</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Fulfillment</TableHead>
                        <TableHead className="text-right">Price</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {orders.map((order) => (
                        <TableRow key={order.id}>
                            <TableCell className="font-medium">{order.id}</TableCell>
                            <TableCell>{format(new Date(order.date), 'dd/MM/yyyy')}</TableCell>
                            <TableCell>
                                <div>
                                    <p className="font-medium">{order.endCustomerName || order.customerName}</p>
                                    <p className="text-xs text-muted-foreground">{order.endCustomerEmail || order.customerEmail}</p>
                                </div>
                            </TableCell>
                            <TableCell>
                            <Badge variant={getStatusVariant(order.status)}>
                                {order.status === 'Outsourced' ? 'Processing' : order.status}
                            </Badge>
                            </TableCell>
                            <TableCell>
                                {order.isOutsourced ? (
                                    <Badge variant="outsourced">Outsourced</Badge>
                                ) : (
                                    <Badge variant="secondary">Internal</Badge>
                                )}
                            </TableCell>
                            <TableCell className="text-right font-semibold">{formatPrice(order.clientTotal || order.total)}</TableCell>
                            <TableCell className="text-right">
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                <Button variant="ghost" className="h-8 w-8 p-0">
                                    <span className="sr-only">Open menu</span>
                                    <MoreHorizontal className="h-4 w-4" />
                                </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                <DropdownMenuItem asChild>
                                    <Link href={`/partner/orders/${order.id}`}>View Details</Link>
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuSub>
                                    <DropdownMenuSubTrigger disabled={order.isOutsourced}>Change Status</DropdownMenuSubTrigger>
                                    <DropdownMenuSubContent>
                                        {orderStatuses.map(status => (
                                            <DropdownMenuItem 
                                                key={status} 
                                                onClick={() => handleUpdateStatus(order.id, status)} 
                                                disabled={order.status === status}
                                            >
                                                Mark as {status}
                                            </DropdownMenuItem>
                                        ))}
                                    </DropdownMenuSubContent>
                                </DropdownMenuSub>
                                <DropdownMenuItem 
                                    disabled={order.isOutsourced || order.status === 'Pending Payment'}
                                    onSelect={() => {
                                        setSelectedOrderForOutsource(order);
                                        setOutsourceOptionsOpen(true);
                                    }}
                                >
                                    Outsource to My Accountant
                                </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
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
