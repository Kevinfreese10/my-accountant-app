'use client';
import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PlusCircle, Loader2, MoreHorizontal, Edit, Trash2 } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Task, User } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { getFirestore, collection, addDoc, getDocs, getDoc, doc, updateDoc, deleteDoc, query, orderBy, where, serverTimestamp, Timestamp } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { format } from 'date-fns';
import TaskForm from '@/components/admin/TaskForm';

const db = getFirestore(firebaseApp);

export default function PartnerTasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [practiceClients, setPracticeClients] = useState<User[]>([]);
  const [practiceStaff, setPracticeStaff] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const { toast } = useToast();
  const { user: currentUser } = useAuth();
  
  const partnerId = currentUser?.role === 'partner' ? currentUser.uid : currentUser?.partnerId;

  const fetchPracticeData = async () => {
    if (!partnerId) return;
    setIsLoading(true);
    try {
        // Fetch practice clients
        const clientsSnap = await getDocs(query(collection(db, "partnerClients"), where("partnerId", "==", partnerId)));
        setPracticeClients(clientsSnap.docs.map(doc => ({ ...doc.data(), id: doc.id } as User)));

        // Practice tasks can only be assigned to partner staff and partners
        const staffSnap = await getDocs(query(collection(db, "users"), where("partnerId", "==", partnerId), where("role", "==", "partner_staff")));
        const staff = staffSnap.docs.map(doc => ({ ...doc.data(), id: doc.id } as User));
        
        const partnerSnap = await getDoc(doc(db, 'users', partnerId));
        if (partnerSnap.exists()) staff.push({ ...partnerSnap.data(), id: partnerSnap.id } as User);
        setPracticeStaff(staff);

        // Fetch tasks
        const tasksRef = collection(db, "tasks");
        let tasksQ;
        if (currentUser?.role === 'partner') {
            tasksQ = query(tasksRef, where("partnerId", "==", partnerId), orderBy("dueDate", "asc"));
        } else {
            tasksQ = query(tasksRef, where("partnerId", "==", partnerId), where("assignedTo", "array-contains", currentUser?.uid), orderBy("dueDate", "asc"));
        }
        
        const tasksSnapshot = await getDocs(tasksQ);
        setTasks(tasksSnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Task)));
    } catch (error) {
        console.error("Error fetching practice tasks:", error);
    } finally {
        setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPracticeData();
  }, [partnerId, currentUser?.role]);

  const handleUpdateStatus = async (taskId: string, status: Task['status']) => {
    try {
        await updateDoc(doc(db, "tasks", taskId), { status });
        fetchPracticeData();
        toast({ title: 'Status Updated' });
    } catch (e) {
        toast({ title: 'Error', variant: 'destructive' });
    }
  };

  const handleFormSubmit = async (data: any) => {
    if (!partnerId) return;
    const taskData = {
        ...data,
        dueDate: Timestamp.fromDate(new Date(data.dueDate)),
        partnerId: partnerId,
        priority: 'Medium' as const,
        clientSource: 'partner',
    };

    try {
        if (selectedTask?.id) {
            await updateDoc(doc(db, "tasks", selectedTask.id), taskData);
            toast({ title: 'Task Updated' });
        } else {
            await addDoc(collection(db, "tasks"), {
                ...taskData,
                status: 'To-Do',
                createdBy: currentUser?.uid,
                createdAt: serverTimestamp(),
            });
            toast({ title: 'Task Created' });
        }
        fetchPracticeData();
        setIsFormOpen(false);
        setSelectedTask(null);
    } catch (error: any) {
        console.error("Error saving task:", error);
        toast({ title: 'Error', description: 'Could not save task.', variant: 'destructive'});
    }
  };

  const handleDelete = async (taskId: string) => {
    await deleteDoc(doc(db, "tasks", taskId));
    fetchPracticeData();
    toast({ title: 'Task Deleted', variant: 'destructive' });
  };

  const staffByDept = useMemo(() => {
      return { 'Practice Team': practiceStaff };
  }, [practiceStaff]);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Practice Tasks</h1>
        <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
            <DialogTrigger asChild>
                <Button onClick={() => setSelectedTask(null)}><PlusCircle className="mr-2 h-4 w-4" /> New Task</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-2xl">
                <DialogHeader>
                    <DialogTitle>{selectedTask ? 'Edit Task' : 'Add Task'}</DialogTitle>
                </DialogHeader>
                <TaskForm 
                    task={selectedTask}
                    onSubmit={handleFormSubmit}
                    onCancel={() => setIsFormOpen(false)}
                    onCommentSubmit={() => {}}
                    allStaff={practiceStaff}
                    staffByDept={staffByDept}
                />
            </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Task List</CardTitle>
          <CardDescription>Track the workflow of your practice's projects.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin" /></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Task</TableHead>
                  <TableHead>Assigned To</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tasks.map(task => (
                  <TableRow key={task.id}>
                    <TableCell className="font-medium">
                        <p>{task.title}</p>
                        <p className="text-xs text-muted-foreground truncate max-w-xs">{task.description}</p>
                    </TableCell>
                    <TableCell>
                        <div className="flex items-center gap-1">
                            {task.assignedTo?.map(uid => (
                                <Badge key={uid} variant="secondary" className="text-[10px]">
                                    {practiceStaff.find(s => s.id === uid)?.name || 'Member'}
                                </Badge>
                            ))}
                        </div>
                    </TableCell>
                    <TableCell>
                        {task.dueDate?.toDate ? format(task.dueDate.toDate(), 'dd MMM yyyy') : 'N/A'}
                    </TableCell>
                    <TableCell><Badge variant="outline">{task.status}</Badge></TableCell>
                    <TableCell className="text-right">
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => { setSelectedTask(task); setIsFormOpen(true); }}>Edit</DropdownMenuItem>
                                <DropdownMenuSub>
                                    <DropdownMenuSubTrigger>Change Status</DropdownMenuSubTrigger>
                                    <DropdownMenuSubContent>
                                        {['To-Do', 'In Progress', 'Review', 'Done'].map(status => (
                                            <DropdownMenuItem key={status} onClick={() => handleUpdateStatus(task.id, status as any)}>{status}</DropdownMenuItem>
                                        ))}
                                    </DropdownMenuSubContent>
                                </DropdownMenuSub>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem className="text-destructive" onClick={() => handleDelete(task.id)}>Delete</DropdownMenuItem>
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
