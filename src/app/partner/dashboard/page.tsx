'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { useBlog } from '@/contexts/BlogContext';
import { Loader2, ArrowRight, Banknote, Building, Clock, MoreHorizontal, PlusCircle, BrainCircuit, Briefcase, Users, CheckCircle, BadgeDollarSign, UserPlus, MessageSquare, Inbox, Archive, Wallet2, TrendingUp, Bot, AlertCircle, Sparkles, Settings, CheckCircle2, Circle } from 'lucide-react';
import Image from 'next/image';
import { format, formatDistanceToNow } from 'date-fns';
import { Order, Service, User, OrderNote } from '@/lib/types';
import { getFirestore, doc, getDoc, collection, getDocs, orderBy, query, where, updateDoc, setDoc, Timestamp, onSnapshot, arrayUnion, increment } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { useToast } from '@/hooks/use-toast';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger, DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent } from '@/components/ui/dropdown-menu';
import { services as allServices } from '@/lib/data';
import { Separator } from '@/components/ui/separator';
import CreatePartnerOrderForm from '@/components/partner/CreatePartnerOrderForm';
import { useRouter } from 'next/navigation';
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from '@/components/ui/carousel';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError, type SecurityRuleContext } from '@/firebase/errors';
import { getNextOrderId } from '@/lib/sequence';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';

const db = getFirestore(firebaseApp);

const userColors = [
  'bg-red-200 text-red-800', 'bg-blue-200 text-blue-800', 'bg-green-200 text-green-800',
  'bg-yellow-200 text-yellow-800', 'bg-purple-200 text-purple-800', 'bg-pink-200 text-pink-800',
];

const getUserColor = (userId: string) => {
  if (!userId) return 'bg-gray-200 text-gray-800';
  const hash = userId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return userColors[hash % userColors.length];
};

function TopUpDialog({ partner }: { partner: User }) {
    const [amount, setAmount] = useState<string>('');
    const [isProcessing, setIsProcessing] = useState(false);
    const { toast } = useToast();

    const handleTopUp = async () => {
        const numericAmount = parseFloat(amount);
        if (isNaN(numericAmount) || numericAmount < 100) {
            toast({ title: 'Invalid Amount', description: 'Minimum top-up amount is R100.', variant: 'destructive' });
            return;
        }

        setIsProcessing(true);
        try {
            const orderId = await getNextOrderId();
            const topupOrder: Order = {
                id: orderId,
                userId: partner.uid,
                customerName: partner.companyName || partner.name,
                customerEmail: partner.email,
                items: [{
                    id: 'partner_credit_topup',
                    title: 'Practice Credit Top-up',
                    price: numericAmount,
                    quantity: 1,
                }],
                total: numericAmount,
                discountCode: null,
                discountAmount: null,
                status: 'Pending Payment',
                date: Timestamp.now(),
                source: 'Partner',
                resellerId: partner.uid,
            };
            
            const orderRef = doc(db, 'orders', orderId);
            setDoc(orderRef, topupOrder).catch(async (error) => {
                const permissionError = new FirestorePermissionError({
                    path: orderRef.path,
                    operation: 'create',
                    requestResourceData: topupOrder,
                } satisfies SecurityRuleContext);
                errorEmitter.emit('permission-error', permissionError);
            });

            const payfastUrl = 'https://www.payfast.co.za/eng/process';
            const form = document.createElement('form');
            form.method = 'POST';
            form.action = payfastUrl;

            const data: { [key: string]: string } = {
                merchant_id: process.env.NEXT_PUBLIC_PAYFAST_MERCHANT_ID || '23836312',
                merchant_key: process.env.NEXT_PUBLIC_PAYFAST_MERCHANT_KEY || 'h4fkhz6ouoksx',
                return_url: `${process.env.NEXT_PUBLIC_APP_URL}/partner/dashboard`,
                cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/partner/dashboard`,
                notify_url: `${process.env.NEXT_PUBLIC_APP_URL}/api/payfast/notify`,
                name_first: partner.name.split(' ')[0],
                name_last: partner.name.split(' ').slice(1).join(' '),
                email_address: partner.email,
                m_payment_id: orderId,
                amount: numericAmount.toFixed(2),
                item_name: `Practice Credit Top-up`,
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

        } catch (e) {
            console.error(e);
            toast({ title: 'Error', description: 'Could not create top-up order.', variant: 'destructive' });
            setIsProcessing(false);
        }
    };

    return (
        <Dialog>
            <DialogTrigger asChild>
                <Button size="xs" variant="outline" className="h-7 px-2 text-[10px]">
                    <PlusCircle className="mr-1 h-3 w-3" />
                    Top Up
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Top Up Practice Credits</DialogTitle>
                    <DialogDescription>Enter the amount you would like to add to your wallet.</DialogDescription>
                </DialogHeader>
                <div className="py-4 space-y-4">
                    <div className="grid gap-2">
                        <Label htmlFor="amount">Amount (ZAR)</Label>
                        <Input 
                            id="amount" 
                            type="number" 
                            placeholder="e.g. 1000" 
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                        />
                        <p className="text-[10px] text-muted-foreground">Minimum R100.</p>
                    </div>
                </div>
                <DialogFooter>
                    <Button onClick={handleTopUp} disabled={isProcessing} className="w-full">
                        {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Proceed to Payment
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

export default function PartnerDashboardPage() {
  const { user, updateUser } = useAuth();
  const router = useRouter();
  const { blogPosts, isLoading: isBlogLoading } = useBlog();
  const [orders, setOrders] = useState<Order[]>([]);
  const [outsourcedOrders, setOutsourcedOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  const [allStaff, setAllStaff] = useState<User[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [overrideCount, setOverrideCount] = useState(0);
  const [practiceProfile, setPracticeProfile] = useState<User | null>(null);
  
  const partnerId = user?.role === 'partner' ? user.uid : user?.partnerId;
  const archivedNotifications = user?.archivedNotifications || [];

  useEffect(() => {
      if (!partnerId) return;
      const fetchOverrides = async () => {
          const snap = await getDocs(collection(db, 'users', partnerId, 'serviceOverrides'));
          setOverrideCount(snap.size);
      };
      fetchOverrides();
  }, [partnerId]);

  const archiveNotification = async (noteId: string) => {
        if (!user) return;
        const userRef = doc(db, 'users', user.uid);
        updateDoc(userRef, {
            archivedNotifications: arrayUnion(noteId)
        }).catch(async (error) => {
            const permissionError = new FirestorePermissionError({
                path: userRef.path,
                operation: 'update',
                requestResourceData: { archivedNotifications: arrayUnion(noteId) },
            } satisfies SecurityRuleContext);
            errorEmitter.emit('permission-error', permissionError);
        });
        updateUser({ ...user, archivedNotifications: [...(user.archivedNotifications || []), noteId] });
    };
    
    useEffect(() => {
      if (!user?.uid || !partnerId) {
        setIsLoading(false);
        return;
      };
      setIsLoading(true);

      const unsubPractice = onSnapshot(doc(db, 'users', partnerId), (snap) => {
          if (snap.exists()) setPracticeProfile({ ...snap.data(), id: snap.id } as User);
          setIsLoading(false);
      }, async (error) => {
          const permissionError = new FirestorePermissionError({
              path: `users/${partnerId}`,
              operation: 'get',
          } satisfies SecurityRuleContext);
          errorEmitter.emit('permission-error', permissionError);
          setIsLoading(false);
      });

      const staffRef = collection(db, "users");
      const staffUnsubscribe = onSnapshot(query(staffRef, where('role', 'in', ['staff', 'admin', 'partner', 'partner_staff', 'ai_accountant'])), (snapshot) => {
          setAllStaff(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id, uid: doc.id } as User)));
      }, async (error) => {
          const permissionError = new FirestorePermissionError({
              path: 'users',
              operation: 'list',
          } satisfies SecurityRuleContext);
          errorEmitter.emit('permission-error', permissionError);
      });

      const ordersRef = collection(db, 'orders');
      
      const clientOrdersQuery = query(ordersRef, where('resellerId', '==', partnerId), where('originalOrderId', '==', null), orderBy('date', 'desc'));
      const unsubClientOrders = onSnapshot(clientOrdersQuery, (snapshot) => {
          let clientOrders = snapshot.docs.map(doc => {
            const data = doc.data();
            return {
              ...data,
              id: doc.id,
              date: data.date.toDate(),
            } as Order;
          });
          setOrders(clientOrders.filter(order => order.status !== 'Cancelled'));
      }, async (error) => {
          const permissionError = new FirestorePermissionError({
              path: 'orders',
              operation: 'list',
          } satisfies SecurityRuleContext);
          errorEmitter.emit('permission-error', permissionError);
      });

      const outsourcedOrdersQuery = query(ordersRef, where('resellerId', '==', partnerId), where('originalOrderId', '!=', null), orderBy('date', 'desc'));
      const unsubOutsourcedOrders = onSnapshot(outsourcedOrdersQuery, (snapshot) => {
          let fetchedOutsourcedOrders = snapshot.docs.map(doc => {
              const data = doc.data();
              return {
                  ...data,
                  id: doc.id,
                  date: data.date.toDate(),
              } as Order;
          });
          setOutsourcedOrders(fetchedOutsourcedOrders);
      }, async (error) => {
          const permissionError = new FirestorePermissionError({
              path: 'orders',
              operation: 'list',
          } satisfies SecurityRuleContext);
          errorEmitter.emit('permission-error', permissionError);
      });

      const transRef = collection(db, 'aiAccountantClients', partnerId, 'transactions');
      const transQ = query(transRef, where('status', 'in', ['new', 'ai_review']));
      const unsubTrans = onSnapshot(transQ, (snap) => {
          setPendingCount(snap.size);
      });

      return () => {
          unsubPractice();
          staffUnsubscribe();
          unsubClientOrders();
          unsubOutsourcedOrders();
          unsubTrans();
      }
    }, [user?.uid, partnerId]);

    const setupChecklist = useMemo(() => {
        const source = practiceProfile || user;
        if (!source) return [];
        
        const watchedBanking = source.bankingDetails;
        const watchedLp = source.landingPage || {};

        return [
            { label: 'Update Pricing', done: overrideCount > 0, description: 'Set your markups in the Services tab.' },
            { label: 'Update Banking Details', done: !!(watchedBanking?.bankName && watchedBanking?.accountNumber), description: 'Required for client EFT payments.' },
            { label: 'Edit Landing Content & Images', done: !!(watchedLp.heroImageUrl && watchedLp.aboutUs && watchedLp.aboutUs.length > 50), description: 'Customize your public practice website.' },
            { label: 'Branding & Theme', done: watchedLp.themePreset !== 'custom' || (watchedLp.primaryColor && watchedLp.primaryColor !== '#214392'), description: 'Apply your custom colors and styling.' },
        ];
    }, [user, practiceProfile, overrideCount]);

    const progressPercentage = useMemo(() => {
        const completed = setupChecklist.filter(i => i.done).length;
        const total = setupChecklist.length;
        if (total === 0) return 0;
        return Math.round((completed / total) * 100);
    }, [setupChecklist]);

    const notifications = useMemo(() => {
        if (!user || outsourcedOrders.length === 0) return [];
        let allNotes: (OrderNote & { orderId: string, orderTitle: string, customerName: string })[] = [];
        outsourcedOrders.forEach(order => {
          const notes = (order.notes || [])
            .filter(note => note.authorId !== user.id && note.type === 'note')
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

    const formatPrice = (price: number) => {
        return new Intl.NumberFormat('en-ZA', {
        style: 'currency',
        currency: 'ZAR',
        minimumFractionDigits: price % 1 === 0 ? 0 : 2,
        maximumFractionDigits: 2,
        }).format(price);
    };

    const walletBalance = practiceProfile?.creditBalance || 0;

    return (
        <div className="space-y-8">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b pb-6">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-slate-950">Welcome, {user?.contactPerson || user?.name}!</h1>
                    <p className="text-lg text-muted-foreground">{user?.companyName || 'Practice Member'}</p>
                </div>
                {user && partnerId && (
                    <Card className="bg-primary/5 border-primary/20 min-w-[260px] overflow-hidden">
                        <CardHeader className="py-2.5 px-4 flex flex-row items-center justify-between space-y-0 border-b border-primary/10">
                            <div className="flex items-center gap-2">
                                <Wallet2 className="h-3.5 w-3.5 text-muted-foreground" />
                                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Practice Wallet</span>
                            </div>
                            {user.role === 'partner' && <TopUpDialog partner={user} />}
                        </CardHeader>
                        <CardContent className="pt-4 px-4 pb-4">
                            <p className="text-3xl font-bold text-primary tabular-nums">
                                {formatPrice(walletBalance)}
                            </p>
                            <p className="text-[10px] text-muted-foreground mt-1 font-medium">Available Credits</p>
                        </CardContent>
                    </Card>
                )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                <div className="lg:col-span-8 space-y-8">
                    {progressPercentage < 100 && (
                        <Card className="border-2 border-primary/20 bg-primary/5 shadow-md overflow-hidden animate-in fade-in slide-in-from-top-4">
                            <CardHeader className="pb-2">
                                <div className="flex justify-between items-center">
                                    <div className="flex items-center gap-2">
                                        <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center text-white">
                                            <Settings className="h-4 w-4" />
                                        </div>
                                        <CardTitle className="text-lg">Practice Setup Progress</CardTitle>
                                    </div>
                                    <Badge variant={progressPercentage > 70 ? "success" : "secondary"} className="font-bold">
                                        {progressPercentage}% Complete
                                    </Badge>
                                </div>
                                <Progress value={progressPercentage} className="h-2 mt-4" />
                            </CardHeader>
                            <CardContent className="pt-6">
                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                                    {setupChecklist.map((item, idx) => (
                                        <div key={idx} className={cn("p-3 rounded-lg border flex flex-col gap-1 transition-all", item.done ? "bg-green-50/50 border-green-200" : "bg-muted/30 border-muted opacity-70")}>
                                            <div className="flex items-center gap-2">
                                                {item.done ? <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" /> : <Circle className="h-4 w-4 text-muted-foreground shrink-0 opacity-30" />}
                                                <span className={cn("text-xs font-bold truncate", item.done ? "text-green-800" : "text-slate-600")}>{item.label}</span>
                                            </div>
                                            <p className="text-[9px] text-muted-foreground leading-tight italic ml-6">{item.description}</p>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                            <CardFooter className="bg-primary/10 border-t border-primary/5 py-3 flex justify-between items-center">
                                <p className="text-[10px] text-primary font-bold uppercase tracking-widest italic">Complete your setup to scale faster.</p>
                                <Button size="sm" asChild variant="link" className="text-primary font-black h-auto p-0">
                                    <Link href="/partner/profile">Configure Settings <ArrowRight className="ml-1 h-3 w-3" /></Link>
                                </Button>
                            </CardFooter>
                        </Card>
                    )}

                    {pendingCount > 0 && partnerId && (
                        <Alert className="bg-primary/10 border-primary/20 shadow-sm animate-in fade-in slide-in-from-top-4 border-2">
                            <Bot className="h-5 w-5 text-primary" />
                            <AlertTitle className="font-bold text-slate-950">Chat with Khai</AlertTitle>
                            <AlertDescription className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                <span className="text-slate-950 font-bold">Chat with Khai waiting to finalize <strong>{pendingCount}</strong> allocations.</span>
                                <Button size="sm" asChild className="font-bold">
                                    <Link href={`/dashboard/ai-accountant/${partnerId}/chat`}>
                                        Open Chat <ArrowRight className="ml-2 h-4 w-4" />
                                    </Link>
                                </Button>
                            </AlertDescription>
                        </Alert>
                    )}

                    <Card>
                        <CardHeader>
                            <CardTitle>Recent Notifications</CardTitle>
                            <CardDescription>Updates from My Accountant on your outsourced orders.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            {isLoading ? <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin text-primary"/></div> :
                            notifications.length > 0 ? (
                            <ScrollArea className="h-72 pr-4">
                                <div className="space-y-4">
                                {notifications.filter(n => !archivedNotifications.includes(n.orderId + n.date.toISOString())).map((note, index) => {
                                    const author = getAuthor(note.authorId);
                                    const date = note.date;
                                    const noteId = note.orderId + date.toISOString();
                                    return (
                                        <div key={index} className="flex items-start gap-3 p-3 bg-muted/30 rounded-lg border border-transparent hover:border-border transition-colors">
                                            <div className={cn("mt-1 h-8 w-8 rounded-full flex items-center justify-center font-bold text-sm", author ? getUserColor(author.id) : 'bg-gray-200')}>
                                                {author?.name.charAt(0) || 'U'}
                                            </div>
                                            <div className="flex-1">
                                                <div className="flex justify-between items-start">
                                                    <p className="text-sm">
                                                        <span className="font-semibold">{author?.name || 'My Accountant Support'}</span>
                                                        <span className="text-muted-foreground"> left a note on order </span>
                                                        <Link href={`/partner/outsourced-orders/${note.orderId}`} className="font-semibold text-primary hover:underline">{note.orderId}</Link>
                                                    </p>
                                                    <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">
                                                        {formatDistanceToNow(date, { addSuffix: true })}
                                                    </p>
                                                </div>
                                                <p className="mt-2 text-sm text-foreground/80 italic leading-relaxed">
                                                    "{note.text}"
                                                </p>
                                                <div className="flex justify-end mt-2">
                                                    <Button size="sm" variant="ghost" className="h-7 text-xs text-muted-foreground" onClick={() => archiveNotification(noteId)}>
                                                        <Archive className="mr-2 h-3 w-3"/> Archive
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>
                                    )
                                })}
                                </div>
                            </ScrollArea>
                            ) : (
                            <div className="flex flex-col items-center justify-center h-40 text-center text-muted-foreground border-2 border-dashed rounded-lg">
                                <Inbox className="h-12 w-12 mb-4 opacity-20"/>
                                <p className="font-semibold text-sm">All caught up!</p>
                                <p className="text-xs">No new notes on your outsourced orders.</p>
                            </div>
                            )}
                        </CardContent>
                    </Card>
                </div>

                <div className="lg:col-span-4 space-y-8">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg">Quick Actions</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <Button className="w-full justify-start font-semibold" asChild><Link href="/partner/services"><Briefcase className="mr-3 h-4 w-4"/>Services & Pricing</Link></Button>
                            <Button className="w-full justify-start font-semibold" asChild><Link href="/partner/profile"><Users className="mr-3 h-4 w-4"/>Manage Profile</Link></Button>
                        </CardContent>
                    </Card>

                     <Card className="bg-muted/20">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm flex items-center gap-2">
                                <TrendingUp className="h-4 w-4 text-green-600" />
                                Statistics
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2">
                            <div className="flex justify-between items-center text-xs">
                                <span className="text-muted-foreground">Active Orders</span>
                                <span className="font-bold">{orders.length}</span>
                            </div>
                            <div className="flex justify-between items-center text-xs">
                                <span className="text-muted-foreground">Outsourced Orders</span>
                                <span className="font-bold">{outsourcedOrders.length}</span>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
