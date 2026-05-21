'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { getFirestore, collection, getDocs, orderBy, query, where, doc, updateDoc, arrayUnion, getDoc, Timestamp, addDoc, writeBatch, onSnapshot } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { Order, User, Service, OrderNote, Task, ItnLog, OrderStatusHistoryEntry } from '@/lib/types';
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
import { MoreHorizontal, Loader2, PlusCircle, MessageSquare, Server, History, User2, Zap, CheckCircle2, Clock, XCircle, ArrowRight } from 'lucide-react';
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
import { sendEmail } from '@/lib/email';
import { render } from '@react-email/components';
import PaymentConfirmationEmail from '@/components/emails/PaymentConfirmationEmail';
import DocumentRequestEmail from '@/components/emails/DocumentRequestEmail';
import ReviewRequestEmail from '@/components/emails/ReviewRequestEmail';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError, type SecurityRuleContext } from '@/firebase/errors';


const db = getFirestore(firebaseApp);

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  const { user } = useAuth();
  const [allStaff, setAllStaff] = useState<User[]>([]);
  const [selectedOrderHistory, setSelectedOrderHistory] = useState<{ order: Order; history: OrderStatusHistoryEntry[] } | null>(null);

  const staffCounters = useRef<{ [key: string]: number }>({});
  
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
    if (!user) return;
    setIsLoading(true);

    const staffQuery = query(collection(db, "users"), where('role', 'in', ['staff', 'admin']));
    getDocs(staffQuery).then(staffSnapshot => {
        const fetchedStaff = staffSnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as User));
        setAllStaff(fetchedStaff);
    }).catch(error => {
        console.error("Error fetching staff:", error);
    });

    const ordersRef = collection(db, 'orders');
    const ordersQuery = query(ordersRef, orderBy('date', 'desc'));
    
    const unsubscribe = onSnapshot(ordersQuery, async (snapshot) => {
        const fetchedOrders = snapshot.docs.map(doc => {
            const data = doc.data();
            return {
                ...data,
                id: doc.id,
                date: data.date?.toDate ? data.date.toDate().toISOString() : new Date().toISOString(),
                notes: (data.notes || []).map((note: any) => ({...note, date: note.date?.toDate ? note.date.toDate().toISOString() : new Date().toISOString()})),
                itnHistory: (data.itnHistory || []).map((log: any) => ({ ...log, receivedAt: log.receivedAt?.toDate ? log.receivedAt.toDate().toISOString() : new Date().toISOString() })),
                statusHistory: (data.statusHistory || []).map((entry: any) => ({ ...entry, changedAt: entry.changedAt?.toDate ? entry.changedAt.toDate().toISOString() : new Date().toISOString() })),
            } as Order;
        });

        const ordersWithClientDetails = await Promise.all(fetchedOrders.map(async (order) => {
            if (order.resellerId && order.originalOrderId && !order.endCustomerEmail) {
                const originalOrderRef = doc(db, 'orders', order.originalOrderId);
                const originalOrderSnap = await getDoc(originalOrderRef);
                if (originalOrderSnap.exists()) {
                    const originalOrderData = originalOrderSnap.data();
                    order.endCustomerName = originalOrderData.customerName;
                    order.endCustomerEmail = originalOrderData.customerEmail;
                }
            }
            return order;
        }));
        
        // ADMIN VISIBILITY LOGIC:
        // 1. Direct Customer Orders (resellerId is null or empty)
        // 2. Explicitly Outsourced Work (resellerId IS set AND originalOrderId IS set)
        // 3. HIDE: Internal Partner Orders (resellerId IS set AND originalOrderId IS NULL)
        const visibleOrders = ordersWithClientDetails.filter(order => {
            const isDirectOrder = !order.resellerId;
            const isOutsourcedWork = !!(order.resellerId && order.originalOrderId);
            const isCancelled = order.status === 'Cancelled';
            
            return (isDirectOrder || isOutsourcedWork) && !isCancelled;
        });

        setOrders(visibleOrders);
        setIsLoading(false);
    }, (error) => {
        console.error("Error fetching orders in real-time:", error);
        toast({ title: "Error", description: "Could not fetch real-time order data.", variant: "destructive" });
        setIsLoading(false);
    });

    return () => unsubscribe();
  }, [user, toast]);

   const handleAssignment = async (orderId: string, staffId: string) => {
    try {
        const batch = writeBatch(db);

        // 1. Update the order
        const orderRef = doc(db, 'orders', orderId);
        batch.update(orderRef, { assignedTo: [staffId] });

        // 2. Find and update the associated task
        const tasksQuery = query(collection(db, 'tasks'), where('orderId', '==', orderId));
        const tasksSnapshot = await getDocs(tasksQuery);
        
        if (!tasksSnapshot.empty) {
            const taskDoc = tasksSnapshot.docs[0];
            batch.update(taskDoc.ref, { assignedTo: [staffId] });
        }

        await batch.commit();

        toast({
            title: 'Order Reassigned',
            description: `Order and its associated task have been assigned.`,
        });
    } catch (error) {
        console.error('Error reassigning order: ', error);
        toast({
            title: 'Assignment Failed',
            description: 'There was a problem reassigning the order.',
            variant: 'destructive',
        });
    }
  };


  const addEmailToHistory = async (orderId: string, subject: string, message: string) => {
    if (!user?.id) return;

     const emailNote: OrderNote = {
      text: message,
      subject: subject || null,
      authorId: user.id,
      date: Timestamp.now(),
      type: 'email',
      attachments: null,
    };

    try {
      const orderRef = doc(db, 'orders', orderId);
      await updateDoc(orderRef, {
        notes: arrayUnion(emailNote),
      });
    } catch (error) {
        console.error("Error logging email to history:", error);
    }
  };

  const handleUpdateStatus = async (orderId: string, newStatus: Order['status']) => {
    const orderToUpdate = orders.find(o => o.id === orderId);
    if (!orderToUpdate || !user || !user.id) {
        toast({
            title: 'Action Failed',
            description: 'Cannot update status. User not found or not authenticated.',
            variant: 'destructive',
        });
        return;
    }

    let assignedStaffIds = orderToUpdate.assignedTo;
    let assignedStaffMember = assignedStaffIds?.[0] ? allStaff.find(s => s.id === assignedStaffIds![0]) : undefined;


    // New Logic: Assign staff only when moving to "Processing"
    if (newStatus === 'Processing' && !assignedStaffIds?.length) {
        const department = orderToUpdate.department as 'Accounting and Tax' | 'Administration' | 'CAP' | undefined;
        if (department) {
            const newStaffAssignment = getNextStaffMember(department);
            if (newStaffAssignment) {
                assignedStaffMember = newStaffAssignment;
                assignedStaffIds = [newStaffAssignment.id];
                 toast({
                    title: 'Order Assigned',
                    description: `Order has been assigned to ${assignedStaffMember.name}.`
                });
            }
        }
    }
    
    try {
      const orderRef = doc(db, 'orders', orderId);

      // Build status history entry
      const historyEntry: OrderStatusHistoryEntry = {
        status: newStatus,
        changedAt: Timestamp.now(),
        changedBy: user.id,
        changedByName: user.name || user.email,
        notes: `Status manually changed to "${newStatus}" by ${user.name || user.email}.`,
      };

      await updateDoc(orderRef, {
        status: newStatus,
        assignedTo: assignedStaffIds || null,
        statusHistory: arrayUnion(historyEntry),
      });

      // SYNC STATUS TO ORIGINAL ORDER IF OUTSOURCED
      if (orderToUpdate.originalOrderId) {
          const originalRef = doc(db, 'orders', orderToUpdate.originalOrderId);
          updateDoc(originalRef, { status: newStatus, statusHistory: arrayUnion({
            status: newStatus,
            changedAt: Timestamp.now(),
            changedBy: user.id,
            changedByName: user.name || user.email,
            notes: `Status synced from outsourced order by ${user.name || user.email}.`,
          } as OrderStatusHistoryEntry) }).catch(async (error) => {
              const permissionError = new FirestorePermissionError({
                  path: originalRef.path,
                  operation: 'update',
                  requestResourceData: { status: newStatus }
              } satisfies SecurityRuleContext);
              errorEmitter.emit('permission-error', permissionError);
          });
      }

      // Create a task if moving to processing and a staff member is assigned
      if (newStatus === 'Processing' && assignedStaffIds && assignedStaffIds.length > 0 && user.id) {
          const taskData = {
              title: `Process Order: ${orderToUpdate.id}`,
              description: `Fulfill the services for order ${orderToUpdate.id}. Services include: ${orderToUpdate.items.map(i => i.title).join(', ')}.`,
              assignedTo: assignedStaffIds,
              createdBy: user.id,
              dueDate: Timestamp.fromDate(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)), // 7 days from now
              priority: 'Medium',
              status: 'To-Do',
              orderId: orderToUpdate.id,
              comments: [],
          };
          await addDoc(collection(db, 'tasks'), taskData);
          toast({
              title: 'Task Created',
              description: `A new task has been created for ${assignedStaffMember?.name} to process this order.`,
          });
      }

      toast({
        title: 'Status Updated',
        description: `Order ${orderId} has been marked as ${newStatus}.`,
      });
      
      const reseller = orderToUpdate.resellerId ? allStaff.find(u => u.id === orderToUpdate.resellerId) : undefined;
      const isOutsourced = !!orderToUpdate.resellerId;
      const emailTo = isOutsourced ? orderToUpdate.endCustomerEmail : orderToUpdate.customerEmail;
      const customerName: string = (isOutsourced ? orderToUpdate.endCustomerName : orderToUpdate.customerName) || orderToUpdate.customerName;
      const emailOrder = {...orderToUpdate, customerName, id: orderToUpdate.originalOrderId || orderToUpdate.id };
      
      if (newStatus === 'Processing' && emailTo && user.email) {
        const subject = `Action Required for Your Order #${emailOrder.id}`;
        const message = "Sent 'Request Documents' email to client.";

        const itemsWithServices = orderToUpdate.items.map(item => {
            const service = allServices.find(s => s.id === item.id);
            return { ...item, service };
        }).filter(item => item.service) as { service: Service }[];

        const emailHtml = render(<DocumentRequestEmail order={emailOrder} items={itemsWithServices} reseller={reseller} replyTo={user.email} />);
        
        await sendEmail({
            to: emailTo,
            bcc: 'kev@thinkestry.co.za',
            subject: subject,
            html: emailHtml,
            resellerId: orderToUpdate.resellerId,
        });

        await addEmailToHistory(orderToUpdate.id, subject, message);

        toast({
            title: 'Document Request Sent',
            description: `An email has been sent to the client.`
        });
      }

      if (newStatus === 'Completed' && emailTo) {
        const emailHtml = render(<ReviewRequestEmail order={emailOrder} reseller={reseller} />);
        await sendEmail({
            to: emailTo,
            subject: `We'd love your feedback on order #${emailOrder.id}`,
            html: emailHtml,
            resellerId: orderToUpdate.resellerId
        });
        toast({
            title: 'Review Request Sent',
            description: `An email has been sent to the client requesting a review.`
        });
      }

    } catch (error) {
      console.error('Error updating order status: ', error);
      toast({
        title: 'Update Failed',
        description: 'There was a problem updating the order status.',
        variant: 'destructive',
      });
    }
  };

  const getAssignee = (userId?: string): User | undefined => {
    if (!userId) return undefined;
    return allStaff.find(u => u.id === userId);
  }

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

  const getCustomerName = (order: Order) => {
    return order.endCustomerName || order.customerName;
  }

  const getSourceText = (order: Order) => {
    return order.source || 'Client';
  }


  return (
    <>
        <div className="space-y-8">
        <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold tracking-tight">Manage Orders</h1>
            <Button asChild>
            <Link href="/admin/orders/new">
                <PlusCircle className="mr-2 h-4 w-4" />
                Create Custom Order
            </Link>
            </Button>
        </div>
        <Card>
            <CardHeader>
            <CardTitle>All Client Orders</CardTitle>
            <CardDescription>
                {user?.role === 'staff' ? 'Showing all orders assigned to you.' : 'View and manage all orders in the system.'}
            </CardDescription>
            </CardHeader>
            <CardContent>
            {isLoading ? (
                <div className="flex justify-center items-center h-64">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
            ) : orders.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No orders to display.</p>
            ) : (
                <Table>
                <TableHeader>
                    <TableRow>
                    <TableHead>Order ID</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Assigned To</TableHead>
                    <TableHead>Last Update</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {orders.map((order) => {
                    const assignee = getAssignee(order.assignedTo?.[0]);
                    const lastNote = order.notes && order.notes.length > 0 ? order.notes[order.notes.length - 1] : null;
                    const lastNoteAuthor = lastNote ? getAssignee(lastNote.authorId) : null;
                    const customerName = getCustomerName(order);
                    return (
                    <TableRow key={order.id}>
                        <TableCell className="font-medium">
                            <p>{order.originalOrderId || order.id}</p>
                            <p className="text-xs text-muted-foreground">{format(new Date(order.date), 'dd/MM/yyyy')}</p>
                        </TableCell>
                        <TableCell>{customerName}</TableCell>
                        <TableCell>
                        {assignee ? (
                            <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger>
                                    <span>{assignee.name}</span>
                                </TooltipTrigger>
                                <TooltipContent>
                                <p>{assignee.name}</p>
                                </TooltipContent>
                            </Tooltip>
                            </TooltipProvider>
                        ) : (
                            <span className="text-muted-foreground">N/A</span>
                        )}
                        </TableCell>
                        <TableCell className="max-w-[250px] truncate">
                            {lastNote && lastNoteAuthor ? (
                                <div className="flex items-start gap-2">
                                    <MessageSquare className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                                    <div className="text-xs">
                                        <span className="font-semibold">{lastNoteAuthor.name}:</span>
                                        <span className="text-muted-foreground ml-1">"{lastNote.subject || lastNote.text}"</span>
                                    </div>
                                </div>
                            ) : (
                                <span className="text-muted-foreground text-xs">No updates</span>
                            )}
                        </TableCell>
                        <TableCell>
                        <Badge variant={getStatusVariant(order.status)}>
                            {order.status === 'Outsourced' ? 'Processing' : order.status}
                        </Badge>
                        </TableCell>
                        <TableCell>
                        <Badge variant="secondary">{getSourceText(order)}</Badge>
                        </TableCell>
                        <TableCell className="text-right">{formatPrice(order.total)}</TableCell>
                        <TableCell className="text-right">
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                                <span className="sr-only">Open menu</span>
                                <MoreHorizontal className="h-4 w-4" />
                            </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent>
                                <DropdownMenuItem asChild>
                                    <Link href={`/admin/orders/${order.id}`}>View Order</Link>
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => setSelectedOrderHistory({ order, history: order.statusHistory || [] })}
                                >
                                  <History className="mr-2 h-4 w-4" />
                                  View Status History
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                {user?.role === 'admin' && (
                                    <>
                                        <DropdownMenuSub>
                                        <DropdownMenuSubTrigger>Assign To</DropdownMenuSubTrigger>
                                        <DropdownMenuSubContent>
                                            {allStaff.map(staff => (
                                            <DropdownMenuItem 
                                                key={staff.id} 
                                                onClick={() => handleAssignment(order.id, staff.id)}
                                                disabled={order.assignedTo?.[0] === staff.id}
                                            >
                                                {staff.name}
                                            </DropdownMenuItem>
                                            ))}
                                        </DropdownMenuSubContent>
                                        </DropdownMenuSub>
                                        <DropdownMenuSeparator />
                                    </>
                                )}
                                <DropdownMenuItem
                                    onClick={() => handleUpdateStatus(order.id, 'Pending Payment')}
                                    disabled={order.status === 'Pending Payment'}
                                >
                                    Mark as Pending Payment
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                    onClick={() => handleUpdateStatus(order.id, 'Processing')}
                                    disabled={order.status === 'Processing'}
                                >
                                    Mark as Processing
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                    onClick={() => handleUpdateStatus(order.id, 'Completed')}
                                    disabled={order.status === 'Completed'}
                                >
                                    Mark as Completed
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                    onClick={() => handleUpdateStatus(order.id, 'Cancelled')}
                                    className="text-destructive"
                                    disabled={order.status === 'Cancelled'}
                                >
                                    Cancel Order
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                        </TableCell>

                    </TableRow>
                    )})}
                </TableBody>
                </Table>
            )}
            </CardContent>
        </Card>
        </div>

        {/* Order Status History Dialog */}
        <Dialog open={!!selectedOrderHistory} onOpenChange={(open) => { if (!open) setSelectedOrderHistory(null); }}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <History className="h-5 w-5 text-primary" />
                Order Status History
              </DialogTitle>
              <DialogDescription>
                {selectedOrderHistory ? (
                  <>Audit trail for order <span className="font-semibold text-foreground">#{selectedOrderHistory.order.originalOrderId || selectedOrderHistory.order.id}</span> &mdash; {selectedOrderHistory.order.endCustomerName || selectedOrderHistory.order.customerName}</>
                ) : null}
              </DialogDescription>
            </DialogHeader>

            <ScrollArea className="max-h-[70vh] pr-2">
              {selectedOrderHistory && (() => {
                const history = selectedOrderHistory.history;

                // If no history logged yet, synthesize an initial entry from order creation
                const entries: OrderStatusHistoryEntry[] = history.length > 0
                  ? [...history].sort((a, b) => new Date(a.changedAt).getTime() - new Date(b.changedAt).getTime())
                  : [{
                      status: 'Pending Payment',
                      changedAt: selectedOrderHistory.order.date,
                      changedBy: selectedOrderHistory.order.userId || 'system',
                      changedByName: selectedOrderHistory.order.customerName || 'Client',
                      notes: 'Order created. Awaiting payment.',
                    }];

                const getStatusIcon = (status: OrderStatusHistoryEntry['status']) => {
                  switch (status) {
                    case 'Completed': return <CheckCircle2 className="h-4 w-4 text-green-500" />;
                    case 'Processing': return <Zap className="h-4 w-4 text-blue-500" />;
                    case 'Pending Payment': return <Clock className="h-4 w-4 text-yellow-500" />;
                    case 'Cancelled': return <XCircle className="h-4 w-4 text-red-500" />;
                    default: return <ArrowRight className="h-4 w-4 text-muted-foreground" />;
                  }
                };

                const getStatusColor = (status: OrderStatusHistoryEntry['status']) => {
                  switch (status) {
                    case 'Completed': return 'border-green-500/40 bg-green-500/5';
                    case 'Processing': return 'border-blue-500/40 bg-blue-500/5';
                    case 'Pending Payment': return 'border-yellow-500/40 bg-yellow-500/5';
                    case 'Cancelled': return 'border-red-500/40 bg-red-500/5';
                    default: return 'border-border bg-muted/30';
                  }
                };

                const getActorIcon = (changedBy: string) => {
                  if (changedBy === 'payfast_itn') return <Zap className="h-3 w-3" />;
                  if (changedBy === 'system') return <Server className="h-3 w-3" />;
                  return <User2 className="h-3 w-3" />;
                };

                return (
                  <div className="relative space-y-0 py-2">
                    {entries.map((entry, idx) => (
                      <div key={idx} className="relative flex gap-4 pb-6 last:pb-0">
                        {/* Vertical connecting line */}
                        {idx < entries.length - 1 && (
                          <div className="absolute left-[19px] top-9 bottom-0 w-px bg-border" />
                        )}

                        {/* Status icon bubble */}
                        <div className={`relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 shadow-sm transition-all ${
                          getStatusColor(entry.status)
                        }`}>
                          {getStatusIcon(entry.status)}
                        </div>

                        {/* Content card */}
                        <div className={`flex-1 rounded-xl border p-3 shadow-sm transition-all ${
                          getStatusColor(entry.status)
                        }`}>
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="font-semibold text-sm leading-tight">
                                {entry.status === 'Outsourced' ? 'Processing (Outsourced)' : entry.status}
                              </p>
                              <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                                {getActorIcon(entry.changedBy)}
                                <span className="font-medium">{entry.changedByName}</span>
                                {entry.changedBy === 'payfast_itn' && (
                                  <span className="ml-1 inline-flex items-center rounded-full bg-blue-500/15 px-1.5 py-0.5 text-[10px] font-medium text-blue-600 border border-blue-500/20">
                                    Automated
                                  </span>
                                )}
                                {entry.changedBy === 'system' && (
                                  <span className="ml-1 inline-flex items-center rounded-full bg-gray-500/15 px-1.5 py-0.5 text-[10px] font-medium text-gray-600 border border-gray-500/20">
                                    System
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              <p className="text-xs text-muted-foreground">
                                {format(new Date(entry.changedAt), 'dd MMM yyyy')}
                              </p>
                              <p className="text-[11px] text-muted-foreground/70">
                                {format(new Date(entry.changedAt), 'HH:mm')}
                              </p>
                            </div>
                          </div>
                          {entry.notes && (
                            <p className="mt-2 text-xs text-muted-foreground border-t border-border/50 pt-2">
                              {entry.notes}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}

                    {history.length === 0 && (
                      <p className="text-xs text-muted-foreground text-center pt-4 pb-2">
                        No detailed history recorded yet. Future status changes will appear here.
                      </p>
                    )}
                  </div>
                );
              })()}
            </ScrollArea>
          </DialogContent>
        </Dialog>
    </>
  );
}
