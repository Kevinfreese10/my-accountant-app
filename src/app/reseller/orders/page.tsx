
'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { getFirestore, collection, getDocs, orderBy, query, where, doc, updateDoc, arrayUnion, getDoc, Timestamp, addDoc, writeBatch } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { Order, User, Service, OrderNote, Task, ItnLog } from '@/lib/types';
import { useAuth } from '@/contexts/AuthContext';
import { services } from '@/lib/data';
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
import { MoreHorizontal, Loader2, PlusCircle, MessageSquare } from 'lucide-react';
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
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import CreateResellerOrderForm from '@/components/reseller/CreateResellerOrderForm';
import { useRouter } from 'next/navigation';


const db = getFirestore(firebaseApp);

export default function ResellerOrdersPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  const [isCreateOrderOpen, setIsCreateOrderOpen] = useState(false);
  const [allStaff, setAllStaff] = useState<User[]>([]);
  const staffCounters = useRef<{ [key: string]: number }>({});
    
  const orderStatuses: Order['status'][] = ['Pending Payment', 'Processing', 'Completed', 'Cancelled'];

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


  const fetchOrdersAndStaff = async () => {
      if (!user?.uid) {
        setIsLoading(false);
        return;
      };
      setIsLoading(true);
      try {
        const staffQuery = query(collection(db, "users"), where('role', 'in', ['staff', 'admin']));
        const staffSnapshot = await getDocs(staffQuery);
        const fetchedStaff = staffSnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as User));
        setAllStaff(fetchedStaff);

        const ordersRef = collection(db, 'orders');
        
        const clientOrdersQuery = query(ordersRef, where('resellerId', '==', user.uid), where('originalOrderId', '==', null), orderBy('date', 'desc'));
        const clientOrdersSnapshot = await getDocs(clientOrdersQuery);
        let clientOrders = clientOrdersSnapshot.docs.map(doc => {
          const data = doc.data();
          return {
            ...data,
            id: doc.id,
            date: data.date.toDate(),
          } as Order;
        });
        setOrders(clientOrders.filter(order => order.status !== 'Cancelled'));

      } catch (error) {
        console.error("Error fetching orders: ", error);
        toast({
            title: 'Error Fetching Orders',
            description: 'Could not load your orders. Please try again later.',
            variant: 'destructive',
        })
      } finally {
        setIsLoading(false);
      }
    };

    useEffect(() => {
        if (user) {
            fetchOrdersAndStaff();
        }
    }, [user, toast]);

    const handleOutsource = async (orderToOutsource: Order) => {
        if (!user) return;
        
        toast({
            title: 'Outsourcing Order...',
            description: `Submitting order ${orderToOutsource.id} to My Accountant.`
        });
    
        try {
            const newOrderId = `ORD-${Date.now().toString().slice(-6)}`;
            const firstServiceId = orderToOutsource.items[0]?.id;
            const serviceDetails = services.find(s => s.id === firstServiceId);
            const department = serviceDetails?.department;
            
            const newOrderData: Partial<Order> = {
                id: newOrderId,
                customerName: user.companyName || user.name,
                customerEmail: user.email,
                endCustomerName: orderToOutsource.customerName,
                endCustomerEmail: orderToOutsource.customerEmail,
                date: Timestamp.now(),
                items: orderToOutsource.items.map(item => ({
                    id: item.id,
                    title: item.title,
                    price: item.price,
                    quantity: item.quantity,
                })),
                total: orderToOutsource.total,
                status: 'Pending Payment',
                resellerId: user.uid,
                originalOrderId: orderToOutsource.id,
            };
            
            if (department) {
              const assignedStaff = getNextStaffMember(department);
              newOrderData.department = department;
              newOrderData.assignedTo = assignedStaff?.id ? [assignedStaff.id] : null;
            } else {
                newOrderData.department = null;
                newOrderData.assignedTo = null;
            }
            
            await setDoc(doc(db, 'orders', newOrderId), newOrderData);
    
            const originalOrderRef = doc(db, 'orders', orderToOutsource.id);
            await updateDoc(originalOrderRef, {
                isOutsourced: true,
                status: 'Outsourced',
            });
    
            fetchOrdersAndStaff();
            
            router.push(`/order-confirmation/${newOrderId}`);
    
        } catch (error) {
             console.error('Error outsourcing order: ', error);
            toast({
                title: 'Outsourcing Failed',
                description: 'There was a problem submitting your order. Please try again.',
                variant: 'destructive',
            });
        }
      };

    const handleUpdateStatus = async (orderId: string, newStatus: Order['status']) => {
    try {
      const orderRef = doc(db, 'orders', orderId);
      await updateDoc(orderRef, {
        status: newStatus,
      });

      setOrders(prevOrders =>
        prevOrders.map(order =>
          order.id === orderId ? { ...order, status: newStatus } : order
        )
      );

      toast({
        title: 'Status Updated',
        description: `Order ${orderId} has been marked as ${newStatus}.`,
      });

      if (newStatus === 'Cancelled') {
        setTimeout(() => {
          setOrders(prevOrders => prevOrders.filter(order => order.id !== orderId));
        }, 500);
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

    const getStatusVariant = (status: Order['status']) => {
        switch (status) {
        case 'Completed':
            return 'success';
        case 'Processing':
            return 'info';
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
        fetchOrdersAndStaff();
    };

    return (
        <div className="space-y-8">
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
                            <CreateResellerOrderForm onOrderCreated={handleOrderCreated} />
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
                        <TableHead>Selling Price</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {orders.map((order) => (
                        <TableRow key={order.id}>
                            <TableCell className="font-medium">{order.id}</TableCell>
                            <TableCell>{format(new Date(order.date), 'dd/MM/yyyy')}</TableCell>
                            <TableCell>{order.customerName}</TableCell>
                            <TableCell>
                            <Badge variant={getStatusVariant(order.status)}>
                                {order.status}
                            </Badge>
                            </TableCell>
                            <TableCell>
                                {order.isOutsourced ? (
                                    <Badge variant="info">Outsourced</Badge>
                                ) : (
                                    <Badge variant="secondary">Internal</Badge>
                                )}
                            </TableCell>
                            <TableCell className="font-semibold">{formatPrice(order.clientTotal || 0)}</TableCell>
                            <TableCell className="text-right">
                            <AlertDialog>
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
                                    <Link href={`/reseller/orders/${order.id}`}>View/Add Notes</Link>
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
                                <AlertDialogTrigger asChild>
                                    <DropdownMenuItem disabled={order.isOutsourced}>
                                    Outsource to My Accountant
                                    </DropdownMenuItem>
                                </AlertDialogTrigger>
                                </DropdownMenuContent>
                            </DropdownMenu>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                    <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                    This will create a new internal order for My Accountant to fulfill. The cost to you will be {formatPrice(order.total)}. You will be shown payment details after confirming. Are you sure you want to proceed?
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => handleOutsource(order)}>
                                    Yes, Outsource this Order
                                    </AlertDialogAction>
                                </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
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
