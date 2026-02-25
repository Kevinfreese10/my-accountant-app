'use client';
import { useState, useMemo, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { MoreHorizontal, PlusCircle, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Task, User, TaskComment } from '@/lib/types';
import { useAuth } from '@/contexts/AuthContext';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { getFirestore, collection, addDoc, getDocs, doc, updateDoc, deleteDoc, query, orderBy, arrayUnion, Timestamp, where, serverTimestamp } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import TaskForm from '@/components/admin/TaskForm';
import { generateNextTaskOccurrence } from '@/app/actions';

const db = getFirestore(firebaseApp);

const departments = ['Accounting and Tax', 'Administration', 'CAP'] as const;

const userColors = [
  'bg-red-200 text-red-800',
  'bg-blue-200 text-blue-800',
  'bg-green-200 text-green-800',
  'bg-yellow-200 text-yellow-800',
  'bg-purple-200 text-purple-800',
  'bg-pink-200 text-pink-800',
  'bg-indigo-200 text-indigo-800',
  'bg-teal-200 text-teal-800',
];

const getUserColor = (userId: string) => {
  const hash = userId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return userColors[hash % userColors.length];
};

export default function AdminTasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [allStaff, setAllStaff] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [taskTypeFilter, setTaskTypeFilter] = useState('all');
  const { toast } = useToast();
  const { user } = useAuth();
  
  const fetchTasks = async () => {
    setIsLoading(true);
    try {
        const tasksQuery = query(collection(db, 'tasks'), orderBy('dueDate', 'asc'));
        const tasksSnapshot = await getDocs(tasksQuery);
        const fetchedTasks = tasksSnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Task));
        setTasks(fetchedTasks);

        const staffQuery = query(collection(db, "users"), where('role', 'in', ['staff', 'admin']));
        const staffSnapshot = await getDocs(staffQuery);
        const fetchedStaff = staffSnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id, uid: doc.id } as User));
        setAllStaff(fetchedStaff);

    } catch (error) {
        console.error("Error fetching tasks:", error);
        toast({ title: "Error", description: "Could not fetch tasks.", variant: "destructive" });
    } finally {
        setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, []);

  const staffByDept = useMemo(() => {
    const result: Record<string, User[]> = {};
    departments.forEach(dept => {
        result[dept] = allStaff.filter(u => u.department === dept);
    });
    return result;
  }, [allStaff]);

  const taskTypes = useMemo(() => {
    const types = new Set(tasks.map(task => {
        const title = task.title;
        const forIndex = title.lastIndexOf(' for ');
        if (forIndex > -1) {
            return title.substring(0, forIndex);
        }
        return title;
    }));
    return ['All Tasks', ...Array.from(types)];
  }, [tasks]);

  const filteredTasks = useMemo(() => {
    let tasksToFilter = tasks;
    if (user?.role === 'staff') {
        tasksToFilter = tasks.filter(task => Array.isArray(task.assignedTo) && task.assignedTo.includes(user.id));
    }
    
    if (taskTypeFilter !== 'all' && taskTypeFilter !== 'All Tasks') {
        return tasksToFilter.filter(task => task.title.startsWith(taskTypeFilter));
    }

    return tasksToFilter;
  }, [tasks, user, taskTypeFilter]);


  const handleAdd = () => {
    setSelectedTask(null);
    setIsFormOpen(true);
  };

  const handleEdit = (task: Task) => {
    setSelectedTask(task);
    setIsFormOpen(true);
  };
  
  const handleDelete = async (taskId: string) => {
    try {
        await deleteDoc(doc(db, 'tasks', taskId));
        fetchTasks();
        toast({
            title: 'Task Deleted',
            description: 'The task has been successfully removed.',
            variant: 'destructive',
        });
    } catch (error) {
        console.error("Error deleting task:", error);
        toast({ title: 'Error', description: 'Could not delete task.', variant: 'destructive'});
    }
  };

   const handleUpdateStatus = async (taskId: string, status: Task['status']) => {
    try {
        const taskRef = doc(db, 'tasks', taskId);
        await updateDoc(taskRef, { status });
        
        if (status === 'Done') {
            const task = tasks.find(t => t.id === taskId);
            if (task?.recurrence && task.recurrence !== 'None') {
                await generateNextTaskOccurrence(taskId);
            }
            toast({
                title: 'Task Completed!',
                description: 'The task has been successfully marked as complete.',
            });
        } else {
             toast({
                title: 'Task Status Updated',
                description: `The task has been marked as "${status}".`,
            });
        }
        fetchTasks();
    } catch (error) {
        console.error("Error updating status:", error);
        toast({ title: 'Error', description: 'Could not update status.', variant: 'destructive'});
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
                priority: 'Medium',
                dueMonthOffset: 0,
                dueDay: 1,
            };
            await addDoc(collection(db, 'tasks'), newTask);
            toast({ title: 'Task Created', description: `Task assigned.` });
        }
        fetchTasks();
        setIsFormOpen(false);
        setSelectedTask(null);
    } catch (error) {
        console.error("Error saving task:", error);
        toast({ title: 'Error', description: 'Could not save the task.', variant: 'destructive'});
    } finally {
        setIsLoading(false);
    }
  };
  
  const handleCommentSubmit = async (taskId: string, commentText: string) => {
    if (!user) return;
    
    const newComment: TaskComment = {
        text: commentText,
        date: Timestamp.now(),
        authorId: user.id,
    };

    try {
        const taskRef = doc(db, 'tasks', taskId);
        await updateDoc(taskRef, {
            comments: arrayUnion(newComment),
        });
        
        const newCommentForState = { ...newComment, date: new Date() };

        if (selectedTask) {
             const updatedComments = [...(selectedTask.comments || []), newCommentForState];
             setSelectedTask({ ...selectedTask, comments: updatedComments });
        }
       
        fetchTasks();
        toast({ title: 'Comment Posted', description: 'Your comment has been added.' });
    } catch (error) {
        console.error("Error posting comment:", error);
        toast({ title: 'Error', description: 'Could not post comment.', variant: 'destructive' });
    }
  };

  const getAssignee = (userId?: string): User | undefined => {
    if (!userId) return undefined;
    return allStaff.find(u => u.id === userId);
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Manage Tasks</h1>
        <Dialog open={isFormOpen} onOpenChange={(isOpen) => { setIsFormOpen(isOpen); if (!isOpen) setSelectedTask(null);}}>
           <DialogTrigger asChild>
                <Button onClick={handleAdd}>
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Create Task
                </Button>
           </DialogTrigger>
           <DialogContent className="sm:max-w-[700px]">
                <DialogHeader>
                    <DialogTitle>{selectedTask ? 'Edit Task' : 'Create New Task'}</DialogTitle>
                    <DialogDescription>
                        {selectedTask ? 'Update the details of this task.' : 'Fill out the form to add a new task.'}
                    </DialogDescription>
                </DialogHeader>
                <TaskForm 
                    task={selectedTask} 
                    onSubmit={handleFormSubmit}
                    onCancel={() => setIsFormOpen(false)}
                    onCommentSubmit={handleCommentSubmit}
                    allStaff={allStaff}
                    staffByDept={staffByDept}
                />
           </DialogContent>
        </Dialog>
      </div>
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
            <div>
              <CardTitle>All Tasks</CardTitle>
              <CardDescription>
                View, edit, and delete all tasks in the system.
              </CardDescription>
            </div>
            <div className="w-full sm:w-auto">
                <Select onValueChange={setTaskTypeFilter} defaultValue="all">
                    <SelectTrigger className="w-full sm:w-[240px]">
                        <SelectValue placeholder="Filter by task type..." />
                    </SelectTrigger>
                    <SelectContent>
                        {taskTypes.map(type => (
                            <SelectItem key={type} value={type === 'All Tasks' ? 'all' : type}>
                                {type}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center items-center h-64">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Task</TableHead>
                <TableHead>Assigned To</TableHead>
                <TableHead>Dates</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTasks.length === 0 ? (
                <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">No tasks to display.</TableCell>
                </TableRow>
              ) : (
                filteredTasks.map(task => {
                    const assignees = Array.isArray(task.assignedTo) ? task.assignedTo : [task.assignedTo];
                    return (
                    <TableRow key={task.id}>
                    <TableCell className="font-medium max-w-xs align-top">
                        <p className="font-semibold truncate">{task.title}</p>
                        <p className="text-xs text-muted-foreground truncate">{task.description}</p>
                    </TableCell>
                    <TableCell className="align-top">
                         <div className="flex items-center -space-x-2">
                            {assignees.slice(0, 3).map(userId => {
                                const assignee = getAssignee(userId);
                                if (!assignee) return null;
                                return (
                                        <TooltipProvider key={userId}>
                                        <Tooltip>
                                            <TooltipTrigger>
                                                <span className={cn("h-6 w-6 border-2 border-background rounded-full flex items-center justify-center text-xs font-semibold", getUserColor(assignee.id))}>{assignee.name.charAt(0)}</span>
                                            </TooltipTrigger>
                                            <TooltipContent>
                                                <p>{assignee.name}</p>
                                            </TooltipContent>
                                        </Tooltip>
                                    </TooltipProvider>
                                );
                            })}
                        </div>
                    </TableCell>
                    <TableCell className="align-top text-xs">
                        <div className="flex flex-col">
                            <span className="font-semibold">Due: {task.dueDate?.toDate ? format(task.dueDate.toDate(), 'dd/MM/yyyy') : 'N/A'}</span>
                        </div>
                    </TableCell>
                    <TableCell className="align-top">
                        <Badge variant="secondary">{task.status}</Badge>
                    </TableCell>
                    <TableCell className="text-right align-top">
                        <AlertDialog>
                            <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => handleEdit(task)}>Edit</DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <AlertDialogTrigger asChild>
                                    <DropdownMenuItem className="text-destructive">Delete</DropdownMenuItem>
                                </AlertDialogTrigger>
                            </DropdownMenuContent>
                            </DropdownMenu>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                    <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                    Permanently delete task: <span className="font-semibold"> {task.title}</span>?
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => handleDelete(task.id)}>Delete</AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    </TableCell>
                    </TableRow>
                )})
              )}
            </TableBody>
          </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
