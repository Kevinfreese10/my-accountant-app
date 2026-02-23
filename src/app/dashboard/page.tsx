'use client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Order, User, OrderNote } from '@/lib/types';
import { useState, useEffect, useMemo } from 'react';
import { getFirestore, collection, orderBy, query, onSnapshot, doc, updateDoc, arrayUnion, where, or } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { Loader2, ArrowRight, Inbox, Archive, Bot } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError, type SecurityRuleContext } from '@/firebase/errors';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

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

export default function DashboardPage() {
    const { user, updateUser } = useAuth();
    const [orders, setOrders] = useState<Order[]>([]);
    const [allStaff, setAllStaff] = useState<User[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [archivedNotifications, setArchivedNotifications] = useState<string[]>([]);
    const [pendingCount, setPendingCount] = useState(0);

    useEffect(() => {
        const storedArchived = localStorage.getItem('archivedNotifications-client');
        if (storedArchived) {
            setArchivedNotifications(JSON.parse(storedArchived));
        }
    }, []);

    const archiveNotification = (noteId: string) => {
        const newArchived = [...archivedNotifications, noteId];
        setArchivedNotifications(newArchived);
        localStorage.setItem('archivedNotifications-client', JSON.stringify(newArchived));
    };
    
    useEffect(() => {
        setIsLoading(true);

        const staffRef = collection(db, "users");
        const staffUnsubscribe = onSnapshot(query(staffRef, where('role', 'in', ['staff', 'admin', 'partner', 'partner_staff', 'ai_accountant'])), (snapshot) => {
            setAllStaff(snapshot.docs.map(doc => ({ ...doc.data(), uid: doc.id, id: doc.id } as User)));
        }, async (error) => {
            const permissionError = new FirestorePermissionError({
                path: 'users',
                operation: 'list',
            } satisfies SecurityRuleContext);
            errorEmitter.emit('permission-error', permissionError);
        });

        let ordersUnsubscribe = () => {};
        let transUnsubscribe = () => {};

        if (user) {
            const ordersRef = collection(db, 'orders');
            const q = query(
                ordersRef, 
                or(
                    where('userId', '==', user.uid),
                    where('customerEmail', '==', user.email),
                    where('endCustomerEmail', '==', user.email)
                ),
                orderBy('date', 'desc')
            );

            ordersUnsubscribe = onSnapshot(q, (snapshot) => {
                const fetchedOrders = snapshot.docs.map(doc => {
                    const data = doc.data();
                    return { 
                        ...data, 
                        id: doc.id,
                        notes: (data.notes || []).map((note: any) => {
                            let noteDate;
                            if (note.date?.toDate) {
                                noteDate = note.date.toDate();
                            } else if (typeof note.date === 'string') {
                                noteDate = new Date(note.date);
                            } else if (note.date instanceof Date) {
                                noteDate = note.date;
                            } else {
                                noteDate = new Date();
                            }
                            return { ...note, date: noteDate };
                        }),
                    } as Order;
                });
                const uniqueOrders = Array.from(new Map(fetchedOrders.map(o => [o.id, o])).values());
                setOrders(uniqueOrders);
                setIsLoading(false);
            }, async (error) => {
                const permissionError = new FirestorePermissionError({
                    path: 'orders',
                    operation: 'list',
                } satisfies SecurityRuleContext);
                errorEmitter.emit('permission-error', permissionError);
                setIsLoading(false);
            });

            // Count pending transactions for Khai Chat
            const transRef = collection(db, 'aiAccountantClients', user.uid, 'transactions');
            const transQ = query(transRef, where('status', 'in', ['new', 'ai_review']));
            transUnsubscribe = onSnapshot(transQ, (snap) => {
                setPendingCount(snap.size);
            });
        } else {
            setIsLoading(false);
        }

        return () => {
            staffUnsubscribe();
            ordersUnsubscribe();
            transUnsubscribe();
        }
    }, [user]);

    const notifications = useMemo(() => {
        if (!user || orders.length === 0) return [];
        let allNotes: (OrderNote & { orderId: string, orderTitle: string, customerName: string })[] = [];
        orders.forEach(order => {
          const notes = (order.notes || [])
            .filter(note => note.authorId !== user.id && note.type === 'note')
            .map(note => ({
              ...note,
              orderId: order.id,
              orderTitle: order.items[0]?.title || 'Untitled Order',
              customerName: order.customerName,
            }));
          allNotes.push(...notes);
        });
        return allNotes.sort((a, b) => b.date.getTime() - a.date.getTime());
      }, [orders, user]);

    const getAuthor = (authorId: string): User | undefined => {
        return allStaff.find(u => u.id === authorId);
    }

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Welcome, {user?.name}!</h1>
                <p className="text-muted-foreground">Here's a summary of your recent activity and notifications.</p>
            </div>

            {pendingCount > 0 && user && (
                <Alert className="bg-primary/10 border-primary/20 shadow-sm animate-in fade-in slide-in-from-top-4">
                    <Bot className="h-5 w-5 text-primary" />
                    <AlertTitle className="font-bold">Chat with Khai</AlertTitle>
                    <AlertDescription className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <span>You have <strong>{pendingCount}</strong> allocations waiting to be finalized.</span>
                        <Button size="sm" asChild>
                            <Link href={`/dashboard/ai-accountant/${user.uid}/chat`}>
                                Open Chat <ArrowRight className="ml-2 h-4 w-4" />
                            </Link>
                        </Button>
                    </AlertDescription>
                </Alert>
            )}
            
            <Card>
                <CardHeader>
                    <CardTitle>Notifications</CardTitle>
                    <CardDescription>Recent updates and messages from our team.</CardDescription>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="flex justify-center p-8">
                            <Loader2 className="h-8 w-8 animate-spin text-primary"/>
                        </div>
                    ) : notifications.length > 0 ? (
                        <ScrollArea className="h-96">
                            <div className="space-y-6">
                            {notifications.filter(n => !archivedNotifications.includes(n.orderId + n.date.toISOString())).map((note, index) => {
                                const author = getAuthor(note.authorId);
                                const date = note.date;
                                const noteId = note.orderId + date.toISOString();
                                return (
                                    <div key={index} className="flex items-start gap-4">
                                        <div className={cn("mt-1 h-10 w-10 rounded-full flex items-center justify-center font-bold text-base shadow-sm", getUserColor(note.authorId))}>
                                            {author?.name.charAt(0) || 'U'}
                                        </div>
                                        <div className="flex-1 space-y-1">
                                            <div className="flex items-center justify-between">
                                                <p className="text-sm">
                                                    <span className="font-semibold">{author?.name || 'Support Team'}</span>
                                                    <span className="text-muted-foreground ml-1">left a note on order </span>
                                                    <Link href={`/dashboard/orders/${note.orderId}`} className="font-semibold text-primary hover:underline">{note.orderId}</Link>
                                                </p>
                                                <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">
                                                    {formatDistanceToNow(date, { addSuffix: true })}
                                                </p>
                                            </div>
                                            <div className="bg-muted/50 p-3 rounded-lg border border-muted text-foreground">
                                                <p className="text-sm leading-relaxed italic" dangerouslySetInnerHTML={{ __html: `"${note.text.replace(/\n/g, '<br />')}"` }} />
                                            </div>
                                            <div className="flex justify-end pt-1">
                                                <Button size="sm" variant="ghost" className="h-7 text-xs text-muted-foreground hover:text-foreground" onClick={() => archiveNotification(noteId)}>
                                                    <Archive className="mr-1.5 h-3.5 w-3.5"/> Archive Notification
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
                            <p className="font-semibold">All caught up!</p>
                            <p className="text-sm">You have no new notifications.</p>
                        </div>
                    )}
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Recent Orders</CardTitle>
                    <CardDescription>Track the status of your active requests.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Button asChild variant="outline" className="w-full">
                        <Link href="/dashboard/orders">
                            View All My Orders <ArrowRight className="ml-2 h-4 w-4" />
                        </Link>
                    </Button>
                </CardContent>
            </Card>
        </div>
    );
}
