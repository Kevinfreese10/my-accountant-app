
'use client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { useBlog } from '@/contexts/BlogContext';
import { Loader2, ArrowRight, Banknote, Building, Clock, MoreHorizontal, PlusCircle, BrainCircuit, Briefcase, Users, CheckCircle, BadgeDollarSign, UserPlus } from 'lucide-react';
import Image from 'next/image';
import { format } from 'date-fns';
import { Order, Service, User } from '@/lib/types';
import { useState, useEffect, useRef } from 'react';
import { getFirestore, collection, getDocs, orderBy, query, where, doc, updateDoc, setDoc, Timestamp } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { useToast } from '@/hooks/use-toast';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { services as allServices } from '@/lib/data';
import { Separator } from '@/components/ui/separator';
import CreateResellerOrderForm from '@/components/reseller/CreateResellerOrderForm';
import CommunityQnA from '@/components/reseller/CommunityQnA';
import { useRouter } from 'next/navigation';
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from '@/components/ui/carousel';

const db = getFirestore(firebaseApp);

export default function ResellerDashboardPage() {
    const { user } = useAuth();
    const router = useRouter();
    const { blogPosts, isLoading: isBlogLoading } = useBlog();
    const [orders, setOrders] = useState<Order[]>([]);
    const [outsourcedOrders, setOutsourcedOrders] = useState<Order[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const { toast } = useToast();
    const [isOutsourceModalOpen, setIsOutsourceModalOpen] = useState(false);
    const [isCreateOrderOpen, setIsCreateOrderOpen] = useState(false);
    const [outsourcedOrderDetails, setOutsourcedOrderDetails] = useState<Order | null>(null);
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
            
            setOutsourcedOrderDetails(newOrderData as Order);
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

            <section>
                <Card>
                    <CardHeader>
                        <CardTitle>Latest News</CardTitle>
                        <CardDescription>Stay up-to-date with the latest tax tips and articles.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {isBlogLoading ? (
                            <div className="flex justify-center items-center h-40">
                                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                            </div>
                        ) : (
                            <Carousel opts={{ align: "start", loop: true }} className="w-full">
                                <CarouselContent>
                                    {blogPosts.map(post => (
                                        <CarouselItem key={post.id} className="md:basis-1/2 lg:basis-1/3">
                                            <div className="p-1">
                                                <div className="group">
                                                    <Link href={`/blog/${post.slug}`} className="block">
                                                        <div className="relative h-40 w-full overflow-hidden rounded-lg">
                                                            <Image
                                                                src={post.imageUrl}
                                                                alt={post.title}
                                                                fill
                                                                className="object-cover transition-transform duration-300 group-hover:scale-105"
                                                                data-ai-hint={post.imageHint}
                                                            />
                                                        </div>
                                                        <div className="mt-3">
                                                            <p className="text-sm font-semibold group-hover:text-primary">{post.title}</p>
                                                            <p className="text-xs text-muted-foreground">{format(new Date(post.date), 'dd/MM/yyyy')}</p>
                                                        </div>
                                                    </Link>
                                                </div>
                                            </div>
                                        </CarouselItem>
                                    ))}
                                </CarouselContent>
                                <CarouselPrevious />
                                <CarouselNext />
                            </Carousel>
                        )}
                    </CardContent>
                </Card>
            </section>
      
        </div>
    );
}
