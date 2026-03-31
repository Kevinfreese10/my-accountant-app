'use client';
import { useState, useMemo, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { format, isPast, isSameDay } from 'date-fns';
import { Task, User, Order } from '@/lib/types';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { PlusCircle, CalendarIcon, Loader2, Repeat, Check, Eye, ClipboardList, Edit, CheckSquare, X, Filter, AlertOctagon, ArrowRight } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { getFirestore, collection, addDoc, getDocs, doc, updateDoc, query, orderBy, where, onSnapshot, serverTimestamp, Timestamp, writeBatch } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { generateNextTaskOccurrence } from '@/app/actions';
import TaskForm from '@/components/admin/TaskForm';
import { cn } from '@/lib/utils';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const db = getFirestore(firebaseApp);

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
  if (!userId) return 'bg-gray-200 text-gray-800';
  const hash = userId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return userColors[hash % userColors.length];
};

const taskTypeLabels: Record<string, string> = {
    'VAT201': 'VAT Submission (VAT201)',
    'EMP201': 'Monthly PAYE (EMP201)',
    'PAYROLL': 'Payroll Preparation',
    'MGMT': 'Management Accounts',
    'AFS': 'Annual Financial Statements',
    'ITR': 'Income Tax Return (ITR14)',
    'IRP6': 'Provisional Tax (IRP6)',
};

export default function AdminDashboardPage() {
    const { user } = useAuth();
    const [tasks, setTasks] = useState<Task[]>([]);
    const [allUsers, setAllUsers] = useState<User[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [selectedTask, setSelectedTask] = useState<Task | null>(null);
    const [selectedRoadmapIds, setSelectedRoadmapIds] = useState<string[]>([]);
    const [taskTypeFilter, setTaskTypeFilter] = useState('all');
    const { toast } = useToast();
    
    useEffect(() => {
        setIsLoading(true);
        const usersRef = collection(db, "users");
        getDocs(usersRef).then(usersSnapshot => {
            const fetchedUsers = usersSnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id, uid: doc.id } as User));
            setAllUsers(fetchedUsers);
        });

        const tasksUnsubscribe = onSnapshot(query(collection(db, 'tasks'), orderBy('dueDate', 'asc')), (snapshot) => {
            setTasks(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Task)));
            setIsLoading(false);
        });

        return () => {
            tasksUnsubscribe();
        };
    }, []);

    const overdueTasks = useMemo(() => {
        return tasks.filter(task => {
            const dueDate = getTaskDate(task);
            return isPast(dueDate) && !isSameDay(dueDate, new Date()) && task.status !== 'Done';
        }).sort((a, b) => getTaskDate(a).getTime() - getTaskDate(b).getTime());
    }, [tasks]);

    const myTasks = useMemo(() => {
        if (!user) return [];
        return tasks.filter(task => 
            Array.isArray(task.assignedTo) && 
            task.assignedTo.includes(user.id) &&
            task.status !== 'Done' &&
            !isPast(getTaskDate(task))
        ).sort((a,b) => getTaskDate(a).getTime() - getTaskDate(b).getTime());
    }, [tasks, user]);

    const roadmapTasks = useMemo(() => {
        let filtered = tasks.filter(task => 
            task.createdBy === 'system' && 
            task.status !== 'Done'
        );

        if (taskTypeFilter !== 'all') {
            filtered = filtered.filter(task => task.type === taskTypeFilter);
        }

        return filtered.sort((a,b) => getTaskDate(a).getTime() - getTaskDate(b).getTime());
    }, [tasks, taskTypeFilter]);

    const availableTaskTypes = useMemo(() => {
        const types = new Set<string>();
        tasks.forEach(t => {
            if (t.createdBy === 'system' && t.type) {
                types.add(t.type);
            }
        });
        return Array.from(types).sort();
    }, [tasks]);

    const assignableStaff = useMemo(() => {
        return allUsers.filter(u => u.role === 'staff' || u.role === 'admin');
    }, [allUsers]);

    const staffByDept = useMemo(() => {
        const result: Record<string, User[]> = {};
        ['Accounting and Tax', 'Administration', 'CAP'].forEach(dept => {
            result[dept] = assignableStaff.filter(u => u.department === dept);
        });
        return result;
    }, [assignableStaff]);

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

    const handleBulkAssign = async (staffId: string) => {
        if (selectedRoadmapIds.length === 0) return;
        
        setIsLoading(true);
        const batch = writeBatch(db);
        
        selectedRoadmapIds.forEach(taskId => {
            const taskRef = doc(db, 'tasks', taskId);
            batch.update(taskRef, { assignedTo: [staffId] });
        });

        try {
            await batch.commit();
            toast({ 
                title: 'Bulk Assignment Complete', 
                description: `Assigned ${selectedRoadmapIds.length} tasks successfully.` 
            });
            setSelectedRoadmapIds([]);
        } catch (e) {
            console.error(e);
            toast({ title: 'Bulk Update Failed', variant: 'destructive' });
        } finally {
            setIsLoading(false);
        }
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

    if (isLoading && tasks.length === 0) return <div className="flex justify-center items-center h-64"><Loader2 className="animate-spin" /></div>;

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
                            allStaff={assignableStaff}
                            staffByDept={staffByDept}
                        />
                    </DialogContent>
                </Dialog>
            </div>

            <div className="space-y-8">
                {overdueTasks.length > 0 && (
                    <Card className="border-destructive/20 bg-destructive/5 shadow-md animate-in fade-in slide-in-from-top-4 duration-500">
                        <CardHeader className="pb-3 border-b border-destructive/10">
                            <div className="flex justify-between items-center">
                                <CardTitle className="text-destructive flex items-center gap-2">
                                    <AlertOctagon className="h-5 w-5" />
                                    Overdue Tasks
                                </CardTitle>
                                <Badge variant="destructive" className="font-bold px-3">{overdueTasks.length} Overdue</Badge>
                            </div>
                            <CardDescription className="text-destructive/80 font-medium">Items requiring immediate attention across the practice.</CardDescription>
                        </CardHeader>
                        <CardContent className="p-0">
                            <Table>
                                <TableHeader className="bg-destructive/5">
                                    <TableRow>
                                        <TableHead className="text-destructive font-bold">Task</TableHead>
                                        <TableHead className="text-destructive font-bold text-center">Assigned To</TableHead>
                                        <TableHead className="text-destructive font-bold">Due Date</TableHead>
                                        <TableHead className="text-destructive font-bold text-right">Action</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {overdueTasks.slice(0, 10).map(task => (
                                        <TableRow key={task.id} className="hover:bg-destructive/10 border-destructive/5">
                                            <TableCell className="font-bold text-slate-900">
                                                <div className="flex flex-col">
                                                    <span>{task.title}</span>
                                                    <span className="text-[10px] text-muted-foreground uppercase tracking-tighter">
                                                        {task.type || 'Manual Task'}
                                                    </span>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex justify-center items-center -space-x-2">
                                                    {task.assignedTo?.map(uid => {
                                                        const staff = allUsers.find(u => u.uid === uid);
                                                        if (!staff) return null;
                                                        return (
                                                            <TooltipProvider key={uid}>
                                                                <Tooltip>
                                                                    <TooltipTrigger>
                                                                        <div className={cn("h-7 w-7 rounded-full border-2 border-background flex items-center justify-center text-[10px] font-black shadow-sm", getUserColor(staff.uid))}>
                                                                            {staff.name.charAt(0)}
                                                                        </div>
                                                                    </TooltipTrigger>
                                                                    <TooltipContent><p>{staff.name}</p></TooltipContent>
                                                                </Tooltip>
                                                            </TooltipProvider>
                                                        );
                                                    })}
                                                    {(!task.assignedTo || task.assignedTo.length === 0) && (
                                                        <span className="text-[10px] text-destructive italic font-bold">UNASSIGNED</span>
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-xs font-black text-destructive tabular-nums">
                                                {format(getTaskDate(task), 'dd MMM yyyy')}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <Button 
                                                    variant="ghost" 
                                                    size="icon" 
                                                    className="h-8 w-8 text-destructive hover:bg-destructive/20" 
                                                    onClick={() => handleUpdate(task.id, { status: 'Done' })}
                                                >
                                                    <Check className="h-4 w-4" />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                            {overdueTasks.length > 10 && (
                                <div className="p-3 text-center border-t border-destructive/10 bg-destructive/5">
                                    <Button variant="link" size="sm" asChild className="text-destructive font-bold text-xs uppercase tracking-widest">
                                        <Link href="/admin/tasks">View all {overdueTasks.length} overdue tasks <ArrowRight className="ml-2 h-3 w-3" /></Link>
                                    </Button>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                )}

                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-slate-950">
                            <ClipboardList className="h-5 w-5 text-primary" />
                            My Upcoming Tasks
                        </CardTitle>
                        <CardDescription>Directly assigned to you and due soon.</CardDescription>
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
                                        <TableCell><Badge variant="secondary" className="text-[10px] font-bold">{task.status}</Badge></TableCell>
                                        <TableCell className="text-right">
                                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleUpdate(task.id, { status: 'Done' })}><Check className="h-4 w-4 text-green-600" /></Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                                {myTasks.length === 0 && <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground text-xs font-medium">No upcoming assigned tasks.</TableCell></TableRow>}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                            <div>
                                <CardTitle className="flex items-center gap-2 text-slate-950">
                                    <Repeat className="h-5 w-5 text-primary" />
                                    Practice Compliance Roadmap
                                </CardTitle>
                                <CardDescription>Practice-wide automated deadlines across all clients.</CardDescription>
                            </div>
                            <div className="flex flex-wrap items-center gap-3">
                                <div className="flex items-center gap-2">
                                    <Filter className="h-4 w-4 text-muted-foreground" />
                                    <Select value={taskTypeFilter} onValueChange={(val) => { setTaskTypeFilter(val); setSelectedRoadmapIds([]); }}>
                                        <SelectTrigger className="w-[200px] h-9 text-xs font-bold">
                                            <SelectValue placeholder="Filter by service..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">All Services</SelectItem>
                                            {availableTaskTypes.map(type => (
                                                <SelectItem key={type} value={type}>{taskTypeLabels[type] || type}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                {selectedRoadmapIds.length > 0 && (
                                    <div className="flex items-center gap-2 animate-in fade-in slide-in-from-top-1">
                                        <Badge variant="secondary" className="px-3 h-9 gap-2 font-bold">
                                            {selectedRoadmapIds.length} selected
                                            <X 
                                                className="h-3 w-3 cursor-pointer hover:text-destructive" 
                                                onClick={() => setSelectedRoadmapIds([])}
                                            />
                                        </Badge>
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button size="sm" className="h-9 gap-2 font-bold">
                                                    <CheckSquare className="h-4 w-4" />
                                                    Bulk Assign To...
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end" className="w-56">
                                                <DropdownMenuLabel>Select Staff Member</DropdownMenuLabel>
                                                <DropdownMenuSeparator />
                                                <ScrollArea className="h-64">
                                                    {assignableStaff.map(staff => (
                                                        <DropdownMenuItem key={staff.id} onSelect={() => handleBulkAssign(staff.id)}>
                                                            {staff.name}
                                                        </DropdownMenuItem>
                                                    ))}
                                                </ScrollArea>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </div>
                                )}
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-12">
                                        <Checkbox 
                                            checked={roadmapTasks.length > 0 && selectedRoadmapIds.length === roadmapTasks.length}
                                            onCheckedChange={(checked) => setSelectedRoadmapIds(checked ? roadmapTasks.map(t => t.id) : [])}
                                        />
                                    </TableHead>
                                    <TableHead>Service Task</TableHead>
                                    <TableHead className="text-center">Assigned To</TableHead>
                                    <TableHead>Due Date</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {roadmapTasks.map(task => (
                                    <TableRow key={task.id} className={cn(selectedRoadmapIds.includes(task.id) && "bg-primary/5")}>
                                        <TableCell>
                                            <Checkbox 
                                                checked={selectedRoadmapIds.includes(task.id)}
                                                onCheckedChange={(checked) => setSelectedRoadmapIds(prev => checked ? [...prev, task.id] : prev.filter(id => id !== task.id))}
                                            />
                                        </TableCell>
                                        <TableCell className="font-medium align-top">
                                            <p className="line-clamp-1">{task.title}</p>
                                            <div className="flex gap-1.5 mt-1">
                                                {task.recurrence && <Badge variant="outline" className="text-[9px] h-4 font-black uppercase tracking-tighter">{task.recurrence}</Badge>}
                                                {task.type && <Badge variant="secondary" className="text-[9px] h-4 font-black uppercase tracking-tighter">{task.type}</Badge>}
                                            </div>
                                        </TableCell>
                                        <TableCell className="align-top">
                                            <div className="flex justify-center items-center -space-x-2">
                                                {task.assignedTo?.map(uid => {
                                                    const staff = allUsers.find(u => u.uid === uid);
                                                    if (!staff) return null;
                                                    return (
                                                        <TooltipProvider key={uid}>
                                                            <Tooltip>
                                                                <TooltipTrigger>
                                                                    <div className={cn("h-6 w-6 rounded-full border-2 border-background flex items-center justify-center text-[10px] font-bold shadow-sm", getUserColor(staff.uid))}>
                                                                        {staff.name.charAt(0)}
                                                                    </div>
                                                                </TooltipTrigger>
                                                                <TooltipContent><p>{staff.name}</p></TooltipContent>
                                                            </Tooltip>
                                                        </TooltipProvider>
                                                    );
                                                })}
                                                {(!task.assignedTo || task.assignedTo.length === 0) && (
                                                    <span className="text-[10px] text-muted-foreground italic font-medium uppercase opacity-50">Unassigned</span>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-xs font-bold tabular-nums align-top">
                                            {format(getTaskDate(task), 'dd/MM/yyyy')}
                                        </TableCell>
                                        <TableCell className="text-right align-top">
                                            <div className="flex items-center justify-end gap-1">
                                                <Button 
                                                    variant="ghost" 
                                                    size="icon" 
                                                    className="h-8 w-8" 
                                                    onClick={() => { setSelectedTask(task); setIsFormOpen(true); }}
                                                >
                                                    <Edit className="h-4 w-4" />
                                                </Button>
                                                <Button 
                                                    variant="ghost" 
                                                    size="icon" 
                                                    className="h-8 w-8" 
                                                    onClick={() => handleUpdate(task.id, { status: 'Done' })}
                                                >
                                                    <Check className="h-4 w-4 text-green-600" />
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                                {roadmapTasks.length === 0 && <TableRow><TableCell colSpan={5} className="text-center py-12 text-muted-foreground font-medium">No tasks found for the selected filter.</TableCell></TableRow>}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
