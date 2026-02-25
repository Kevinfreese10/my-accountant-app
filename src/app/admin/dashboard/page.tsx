'use client';
import { useState, useMemo, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { format, isPast, addDays, isWithinInterval, startOfToday } from 'date-fns';
import { Task, User, TaskComment, Order } from '@/lib/types';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { MessageSquare, PlusCircle, MoreHorizontal, CalendarIcon, Loader2, Repeat, Check, Eye, Inbox, Archive, TrendingUp, Wallet2, ClipboardList } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';
import { getFirestore, collection, addDoc, getDocs, doc, updateDoc, deleteDoc, query, orderBy, where, arrayUnion, Timestamp, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { sendEmail } from '@/lib/email';
import { render } from '@react-email/components';
import NewTaskEmail from '@/components/emails/NewTaskEmail';
import WeeklyTaskCalendar from '@/components/dashboard/WeeklyTaskCalendar';
import { ScrollArea } from '@/components/ui/scroll-area';
import TaskCompletedEmail from '@/components/emails/TaskCompletedEmail';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError, type SecurityRuleContext } from '@/firebase/errors';
import { generateNextTaskOccurrence } from '@/app/actions';
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip as RechartsTooltip, Cell } from "recharts";
import TaskForm from '@/components/admin/TaskForm';

const db = getFirestore(firebaseApp);

const taskStatuses: Task['status'][] = ['To-Do', 'In Progress', 'Review', 'Done'];

const getTaskDate = (task: Task): Date => {
  if (task.dueDate instanceof Date) return task.dueDate;
  if (task.dueDate && typeof (task.dueDate as any).toDate === 'function') return (task.dueDate as any).toDate();
  return new Date(task.dueDate);
};

const userColors = [
  'bg-red-200 text-red-800', 'bg-blue-200 text-blue-800', 'bg-green-200 text-green-800',
  'bg-yellow-200 text-yellow-800', 'bg-purple-200 text-purple-800', 'bg-pink-200 text-pink-800',
];

const getUserColor = (userId: string) => {
  const hash = userId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return userColors[hash % userColors.length];
};

export default function AdminDashboardPage() {
    const { user } = useAuth();
    const [tasks, setTasks] = useState<Task[]>([]);
    const [orders, setOrders] = useState<Order[]>([]);
    const [adminClients, setAdminClients] = useState<User[]>([]);
    const [allStaffAndClients, setAllStaffAndClients] = useState<User[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [selectedTask, setSelectedTask] = useState<Task | null>(null);
    const { toast } = useToast();
    
    const isKev = user?.email === 'kev@thinkestry.co.za';

    useEffect(() => {
        setIsLoading(true);
        const usersRef = collection(db, "users");
        getDocs(usersRef).then(usersSnapshot => {
            const fetchedUsers = usersSnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id, uid: doc.id } as User));
            setAllStaffAndClients(fetchedUsers);
        });

        const adminClientsUnsubscribe = onSnapshot(collection(db, "adminClients"), (snapshot) => {
            setAdminClients(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as User)));
        });

        const tasksUnsubscribe = onSnapshot(query(collection(db, 'tasks'), orderBy('dueDate', 'asc')), (snapshot) => {
            setTasks(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Task)));
            setIsLoading(false);
        });

        const ordersUnsubscribe = onSnapshot(query(collection(db, 'orders'), orderBy('date', 'desc')), (snapshot) => {
            setOrders(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Order)));
        });

        return () => {
            adminClientsUnsubscribe();
            tasksUnsubscribe();
            ordersUnsubscribe();
        };
    }, []);

    const revenueData = useMemo(() => {
        const total = adminClients.reduce((acc, client) => acc + (client.monthlyRetainerFee || 0), 0);
        const sorted = [...adminClients].sort((a, b) => (b.monthlyRetainerFee || 0) - (a.monthlyRetainerFee || 0));
        const top5 = sorted.slice(0, 5).map(c => ({ name: c.name.substring(0, 10), value: c.monthlyRetainerFee || 0 }));
        const othersValue = sorted.slice(5).reduce((acc, c) => acc + (c.monthlyRetainerFee || 0), 0);
        if (othersValue > 0) top5.push({ name: 'Others', value: othersValue });
        
        return { total, chartData: top5 };
    }, [adminClients]);

    const myTasks = useMemo(() => {
        if (!user) return [];
        return tasks.filter(task => 
            Array.isArray(task.assignedTo) && 
            task.assignedTo.includes(user.id) &&
            task.status !== 'Done'
        ).sort((a,b) => getTaskDate(a).getTime() - getTaskDate(b).getTime());
    }, [tasks, user]);

    const roadmapTasks = useMemo(() => {
        return tasks.filter(task => 
            task.createdBy === 'system' && 
            task.status !== 'Done'
        ).sort((a,b) => getTaskDate(a).getTime() - getTaskDate(b).getTime());
    }, [tasks]);

    const staffByDept = useMemo(() => {
        const result: Record<string, User[]> = {};
        ['Accounting and Tax', 'Administration', 'CAP'].forEach(dept => {
            result[dept] = allStaffAndClients.filter(u => u.department === dept);
        });
        return result;
    }, [allStaffAndClients]);

    const handleUpdate = async (taskId: string, updates: Partial<Task>) => {
        const originalTask = tasks.find(t => t.id === taskId);
        if (!originalTask || !user) return;
        updateDoc(doc(db, 'tasks', taskId), updates).then(() => {
            if (updates.status === 'Done' && originalTask.recurrence && originalTask.recurrence !== 'None') {
                generateNextTaskOccurrence(originalTask.id);
            }
            toast({ title: 'Task Updated' });
        });
    };

    const handleFormSubmit = async (data: any) => {
        if (!user) return;
        setIsLoading(true);
        
        const taskData = {
            ...data,
            dueDate: Timestamp.fromDate(data.dueDate as Date),
        };

        try {
            if (selectedTask?.id) {
                const taskRef = doc(db, 'tasks', selectedTask.id);
                await updateDoc(taskRef, { ...taskData });
                toast({ title: 'Task Updated', description: 'The task details have been saved.' });
            } else {
                const newTask: Omit<Task, 'id' | 'priority'> = {
                    ...taskData,
                    status: 'To-Do',
                    createdBy: user.uid, 
                    createdAt: serverTimestamp(),
                    comments: [],
                };
                await addDoc(collection(db, 'tasks'), newTask);
                toast({ title: 'Task Created', description: `Task assigned.` });
            }
            setIsFormOpen(false);
            setSelectedTask(null);
        } catch (error) {
            console.error("Error saving task:", error);
            toast({ title: 'Error', description: 'Could not save the task.', variant: 'destructive'});
        } finally {
            setIsLoading(false);
        }
    };

    const formatPrice = (price: number) => {
        return new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' }).format(price);
    };

    if (isLoading) return <div className="flex justify-center items-center h-64"><Loader2 className="animate-spin" /></div>;

    return (
        <div className="space-y-8">
            <div className="flex justify-between items-center border-b pb-4">
                <h1 className="text-3xl font-bold tracking-tight text-slate-950">Welcome, {user?.name}!</h1>
                <Dialog open={isFormOpen} onOpenChange={(open) => { setIsFormOpen(open); if (!open) setSelectedTask(null); }}>
                    <DialogTrigger asChild>
                        <Button onClick={() => { setSelectedTask(null); setIsFormOpen(true); }}>
                            <PlusCircle className="mr-2 h-4 w-4" />
                            Create Task
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[700px]">
                        <DialogHeader>
                            <DialogTitle>{selectedTask ? 'Edit Task' : 'Create New Task'}</DialogTitle>
                            <DialogDescription>
                                {selectedTask ? 'Update the details of this task.' : 'Fill out the form to add a new task for a staff member.'}
                            </DialogDescription>
                        </DialogHeader>
                        <TaskForm 
                            task={selectedTask || {}} 
                            onSubmit={handleFormSubmit}
                            onCancel={() => setIsFormOpen(false)}
                            onCommentSubmit={() => {}}
                            allStaff={allStaffAndClients}
                            staffByDept={staffByDept}
                        />
                    </DialogContent>
                </Dialog>
            </div>

            {isKev && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-in fade-in slide-in-from-top-4 duration-500">
                    <Card className="md:col-span-1 border-primary/20 shadow-md">
                        <CardHeader className="pb-2">
                            <div className="flex items-center gap-2">
                                <Wallet2 className="h-4 w-4 text-primary" />
                                <CardTitle className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Monthly Retainer Revenue</CardTitle>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="text-4xl font-extrabold text-primary tabular-nums tracking-tight">
                                {formatPrice(revenueData.total)}
                            </div>
                            <p className="text-[10px] font-medium mt-2 text-muted-foreground uppercase tracking-wide">
                                Estimated from {adminClients.length} active client retainers
                            </p>
                        </CardContent>
                    </Card>
                    <Card className="md:col-span-2 border-primary/10 shadow-sm">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                                <TrendingUp className="h-4 w-4 text-green-600" />
                                Revenue Distribution (Top Clients)
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="h-[120px] pt-4">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={revenueData.chartData}>
                                    <XAxis dataKey="name" fontSize={9} tickLine={false} axisLine={false} />
                                    <YAxis hide />
                                    <RechartsTooltip 
                                        content={({ active, payload }) => {
                                            if (active && payload && payload.length) {
                                                return (
                                                    <div className="bg-background border rounded-lg p-2 shadow-lg text-xs">
                                                        <p className="font-bold border-b pb-1 mb-1">{payload[0].payload.name}</p>
                                                        <p className="text-primary font-mono">{formatPrice(payload[0].value as number)}</p>
                                                    </div>
                                                );
                                            }
                                            return null;
                                        }}
                                    />
                                    <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                                        {revenueData.chartData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={`hsl(var(--primary) / ${1 - (index * 0.12)})`} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </CardContent>
                    </Card>
                </div>
            )}

            <WeeklyTaskCalendar tasks={tasks} allStaff={allStaffAndClients} currentUser={user} onTaskUpdate={handleUpdate} onEdit={(t) => { setSelectedTask(t); setIsFormOpen(true); }} />

            <div className="space-y-8">
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <ClipboardList className="h-5 w-5 text-primary" />
                            My Tasks
                        </CardTitle>
                        <CardDescription>Directly assigned to you.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Task</TableHead>
                                    <TableHead>Due Date</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {myTasks.map(task => (
                                    <TableRow key={task.id}>
                                        <TableCell className="font-medium">
                                            <p className="line-clamp-1">{task.title}</p>
                                            <p className="text-[10px] text-muted-foreground line-clamp-1">{task.description}</p>
                                        </TableCell>
                                        <TableCell className="text-xs">{format(getTaskDate(task), 'dd/MM/yyyy')}</TableCell>
                                        <TableCell><Badge variant="secondary" className="text-[10px]">{task.status}</Badge></TableCell>
                                        <TableCell className="text-right">
                                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleUpdate(task.id, { status: 'Done' })}><Check className="h-4 w-4 text-green-600" /></Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                                {myTasks.length === 0 && <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground text-xs">No pending assigned tasks.</TableCell></TableRow>}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Repeat className="h-5 w-5 text-primary" />
                            Compliance Roadmap
                        </CardTitle>
                        <CardDescription>Practice-wide automated deadlines.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Service Task</TableHead>
                                    <TableHead>Due Date</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {roadmapTasks.map(task => (
                                    <TableRow key={task.id}>
                                        <TableCell className="font-medium">
                                            <p className="line-clamp-1">{task.title}</p>
                                            {task.recurrence && <Badge variant="outline" className="text-[9px] h-4 mt-1 font-bold uppercase">{task.recurrence}</Badge>}
                                        </TableCell>
                                        <TableCell className="text-xs">{format(getTaskDate(task), 'dd/MM/yyyy')}</TableCell>
                                        <TableCell className="text-right">
                                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleUpdate(task.id, { status: 'Done' })}><Check className="h-4 w-4 text-green-600" /></Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                                {roadmapTasks.length === 0 && <TableRow><TableCell colSpan={3} className="text-center py-8 text-muted-foreground text-xs">No upcoming roadmap tasks.</TableCell></TableRow>}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
