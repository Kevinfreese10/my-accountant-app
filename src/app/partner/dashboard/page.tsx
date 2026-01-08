
'use client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { useBlog } from '@/contexts/BlogContext';
import { Loader2, ArrowRight, Banknote, Building, Clock, MoreHorizontal, PlusCircle, BrainCircuit, Briefcase, Users, CheckCircle, BadgeDollarSign, UserPlus, MessageSquare, Inbox, Archive } from 'lucide-react';
import Image from 'next/image';
import { format, formatDistanceToNow } from 'date-fns';
import { Order, Service, User, OrderNote } from '@/lib/types';
import { useState, useEffect, useRef, useMemo } from 'react';
import { getFirestore, collection, getDocs, orderBy, query, where, doc, updateDoc, setDoc, Timestamp, onSnapshot } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { useToast } from '@/hooks/use-toast';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent } from '@/components/ui/dropdown-menu';
import { services as allServices } from '@/lib/data';
import { Separator } from '@/components/ui/separator';
import CreatePartnerOrderForm from '@/components/partner/CreatePartnerOrderForm';
import { useRouter } from 'next/navigation';
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from '@/components/ui/carousel';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

const db = getFirestore(firebaseApp);

const userColors = [
  'bg-red-200 text-red-800', 'bg-blue-200 text-blue-800', 'bg-green-200 text-green-800',
  'bg-yellow-200 text-yellow-800', 'bg-purple-200 text-purple-800', 'bg-pink-200 text-pink-800',
];

const getUserColor = (userId: string) => {
  const hash = userId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return userColors[hash % userColors.length];
};

export default function PartnerDashboardPage() {
    const { user, updateUser } = useAuth();
    const router = useRouter();
    const { blogPosts, isLoading: isBlogLoading } = useBlog();
    const [orders, setOrders] = useState<Order[]>([]);
    const [outsourcedOrders, setOutsourcedOrders] = useState<Order[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const { toast } = useToast();
    const [isCreateOrderOpen, setIsCreateOrderOpen] = useState(false);
    const [allStaff, setAllStaff] = useState<User[]>([]);
    const staffCounters = useRef<{ [key: string]: number }>({});
    
    const archivedNotifications = user?.archivedNotifications || [];

    const archiveNotification = async (noteId: string) => {
        if (!user) return;
        const userRef = doc(db, 'users', user.uid);
        await updateDoc(userRef, {
            archivedNotifications: arrayUnion(noteId)
        });
        // Optimistically update local state
        updateUser({ ...user, archivedNotifications: [...(user.archivedNotifications || []), noteId] });
    };
    
    const orderStatuses: Order['status'][] = ['Pending Payment', 'Processing', 'Completed', 'Cancelled'];

    const getNextStaffMember = (department: 'Accounting and Tax' | 'Administration' | 'CAP'): User | undefined => {
      const staffInDept = allStaff.filter(u => u.role === 'staff' && u.department === department);
      if (staffInDept.length === 0) return undefined;

      const currentIndex = staffCounters.current[department] || 0;
      const nextStaff = staffInDept[currentIndex];
      
      staffCounters.current[department] = (currentIndex + 1) % staffInDept.length;
      
      return nextStaff;
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

        const outsourcedOrdersQuery = query(ordersRef, where('resellerId', '==', user.uid), where('originalOrderId', '!=', null), orderBy('date', 'desc'));
        const outsourcedOrdersSnapshot = await getDocs(outsourcedOrdersQuery);
        let fetchedOutsourcedOrders = outsourcedOrdersSnapshot.docs.map(doc => {
            const data = doc.data();
            return {
                ...data,
                id: doc.id,
                date: data.date.toDate(),
            } as Order;
        });
        setOutsourcedOrders(fetchedOutsourcedOrders);

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

    const notifications = useMemo(() => {
        if (!user || outsourcedOrders.length === 0) return [];
        let allNotes: (OrderNote & { orderId: string, orderTitle: string, customerName: string })[] = [];
        outsourcedOrders.forEach(order => {
          const notes = (order.notes || [])
            .filter(note => note.authorId !== user.id && note.type === 'note') // Only show notes from others
            .map(note => ({
              ...note,
              date: note.date instanceof Date ? note.date : note.date.toDate(),
              orderId: order.id,
              orderTitle: order.items[0]?.title || 'Untitled Order',
              customerName: order.customerName,
            }));
          allNotes.push(...notes);
        });
        return allNotes.sort((a, b) => b.date.getTime() - a.date.getTime());
    }, [outsourcedOrders, user]);

    const getAuthor = (authorId: string): User | undefined => {
        return allStaff.find(u => u.id === authorId);
    }

    const handleOutsource = async (orderToOutsource: Order) => {
        if (!user) return;
        
        toast({
            title: 'Outsourcing Order...',
            description: `Submitting order ${orderToOutsource.id} to My Accountant.`
        });
    
        try {
            const newOrderId = `ORD-${Date.now().toString().slice(-6)}`;
            const firstServiceId = orderToOutsource.items[0]?.id;
            const serviceDetails = allServices.find(s => s.id === firstServiceId);
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

    const formatPrice = (price: number) => {
        return new Intl.NumberFormat('en-ZA', {
        style: 'currency',
        currency: 'ZAR',
        minimumFractionDigits: price % 1 === 0 ? 0 : 2,
        maximumFractionDigits: 2,
        }).format(price);
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

    const pendingApprovalOrders = outsourcedOrders.filter(o => o.status === 'Pending Payment');
    const activeOutsourcedOrders = outsourcedOrders.filter(o => o.status !== 'Pending Payment');

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Welcome, {user?.contactPerson}!</h1>
                <p className="text-lg text-muted-foreground">{user?.companyName}</p>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <Card className="lg:col-span-2">
                    <CardHeader>
                        <CardTitle>Notifications</CardTitle>
                        <CardDescription>Recent notes from My Accountant on your outsourced orders.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {isLoading ? <div className="flex justify-center"><Loader2 className="h-6 w-6 animate-spin"/></div> :
                        notifications.length > 0 ? (
                        <ScrollArea className="h-72">
                            <div className="space-y-4">
                            {notifications.filter(n => !archivedNotifications.includes(n.orderId + n.date.toISOString())).map((note, index) => {
                                const author = getAuthor(note.authorId);
                                const date = note.date instanceof Date ? note.date : note.date.toDate();
                                const noteId = note.orderId + date.toISOString();
                                return (
                                    <div key={index} className="flex items-start gap-3">
                                        <div className={cn("mt-1 h-8 w-8 rounded-full flex items-center justify-center font-bold text-sm", getUserColor(note.authorId))}>
                                            {author?.name.charAt(0) || 'U'}
                                        </div>
                                        <div className="flex-1">
                                            <p className="text-sm">
                                                <span className="font-semibold">{author?.name || 'Unknown User'}</span>
                                                <span className="text-muted-foreground"> left a note on order </span>
                                                <Link href={`/partner/outsourced-orders/${note.orderId}`} className="font-semibold text-primary hover:underline">{note.orderId}</Link>
                                            </p>
                                            <blockquote className="mt-1 border-l-2 pl-3 text-sm italic">
                                                "{note.text}"
                                            </blockquote>
                                                <div className="flex items-center justify-between">
                                                <p className="text-xs text-muted-foreground mt-1">
                                                    {formatDistanceToNow(date, { addSuffix: true })}
                                                </p>
                                                <Button size="sm" variant="ghost" onClick={() => archiveNotification(noteId)}>
                                                    <Archive className="mr-2 h-4 w-4"/> Archive
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                )
                            })}
                            </div>
                        </ScrollArea>
                        ) : (
                        <div className="flex flex-col items-center justify-center h-40 text-center text-muted-foreground">
                            <Inbox className="h-12 w-12 mb-4"/>
                            <p className="font-semibold">All caught up!</p>
                            <p className="text-sm">You have no new notifications.</p>
                        </div>
                        )}
                    </CardContent>
                </Card>
                <div className="space-y-8">
                    <Card>
                        <CardHeader>
                            <CardTitle>Quick Actions</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <Button className="w-full justify-start" asChild><Link href="/partner/services"><Briefcase className="mr-2"/>View Services & Pricing</Link></Button>
                            <Button className="w-full justify-start" asChild><Link href="/partner/ai-accountant/clients"><BrainCircuit className="mr-2"/>AI Accountant</Link></Button>
                            <Button className="w-full justify-start" asChild><Link href="/partner/profile"><Users className="mr-2"/>Manage Profile</Link></Button>
                        </CardContent>
                    </Card>
                     <Card>
                        <CardHeader>
                            <CardTitle>Your Earnings</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-sm text-muted-foreground">Coming soon...</p>
                        </CardContent>
                    </Card>
                </div>
            </div>
      
        </div>
    );
}
