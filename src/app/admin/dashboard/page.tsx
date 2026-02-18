'use client';
import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { format, isPast, addDays, isWithinInterval, startOfToday, addMonths, addYears, formatDistanceToNow } from 'date-fns';
import { Task, User, TaskComment, Order, OrderNote } from '@/lib/types';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { MessageSquare, PlusCircle, MoreHorizontal, CalendarIcon, Loader2, Repeat, BrainCircuit, Check, Tag, Eye, Inbox, Bot, Mail, Send as SendIcon, Archive } from 'lucide-react';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';
import { getFirestore, collection, addDoc, getDocs, doc, updateDoc, deleteDoc, query, where, orderBy, arrayUnion, Timestamp, writeBatch, onSnapshot } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { sendEmail } from '@/lib/email';
import { render } from '@react-email/components';
import NewTaskEmail from '@/components/emails/NewTaskEmail';
import WeeklyTaskCalendar from '@/components/dashboard/WeeklyTaskCalendar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import TaskCompletedEmail from '@/components/emails/TaskCompletedEmail';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError, type SecurityRuleContext } from '@/firebase/errors';


const db = getFirestore(firebaseApp);

const departments = ['Accounting and Tax', 'Administration', 'CAP'] as const;

const taskStatuses: Task['status'][] = ['To-Do', 'In Progress', 'Review', 'Done'];
const taskRecurrences: Task['recurrence'][] = ['None', 'Daily', 'Weekly', 'Monthly', 'Bi-Monthly', 'Annually'];

const formSchema = z.object({
  id: z.string().optional(),
  title: z.string().min(5, 'Title is required.'),
  description: z.string().min(10, 'Description is required.'),
  assignedTo: z.array(z.string()).min(1, 'Please assign a staff member.'),
  tags: z.array(z.string()).optional(),
  dueDate: z.date({ required_error: 'A due date is required.'}),
  dueTime: z.string().optional(),
  recurrence: z.enum(taskRecurrences).optional(),
  orderId: z.string().optional(),
  newComment: z.string().optional(),
});

function TaskForm({ task, onSubmit, onCancel, onCommentSubmit, allStaff, staffByDept }: { task: Task | null, onSubmit: (data: any) => void, onCancel: () => void, onCommentSubmit: (taskId: string, commentText: string) => void, allStaff: User[], staffByDept: Record<string, User[]> }) {
    const { user } = useAuth();

    const getTaskDate = (task: Partial<Task>): Date => {
      if (!task?.dueDate) return new Date();
      if (task.dueDate instanceof Date) {
          return task.dueDate;
      }
      if (typeof (task.dueDate as any).toDate === 'function') {
          return (task.dueDate as any).toDate();
      }
      return new Date(task.dueDate);
    }

    const defaultDueDate = task?.dueDate ? getTaskDate(task) : new Date();
    const defaultDueTime = task?.dueDate ? format(getTaskDate(task), 'HH:mm') : '09:00';

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            id: task?.id || '',
            title: task?.title || '',
            description: task?.description || '',
            assignedTo: task?.assignedTo || [],
            tags: task?.tags || [],
            dueDate: defaultDueDate,
            dueTime: defaultDueTime,
            recurrence: task?.recurrence || 'None',
            orderId: task?.orderId || '',
            newComment: '',
        },
    });

    const handleSubmit = (values: z.infer<typeof formSchema>) => {
        const [hours, minutes] = (values.dueTime || "09:00").split(':').map(Number);
        const finalDueDate = new Date(values.dueDate);
        finalDueDate.setHours(hours, minutes, 0, 0);

        onSubmit({ ...values, dueDate: finalDueDate });
    };

    const handleCommentSubmit = () => {
        if (!task || !task.id) return;
        const commentText = form.getValues('newComment');
        if (commentText) {
            onCommentSubmit(task.id, commentText);
            form.setValue('newComment', '');
        }
    }
    
    const getAuthor = (authorId: string): User | undefined => {
        return allStaff.find(u => u.id === authorId);
    }
    
    const staffAndAdmins = allStaff.filter(s => s.role === 'staff' || s.role === 'admin');

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                <FormField control={form.control} name="title" render={({ field }) => (<FormItem><FormLabel>Title</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="description" render={({ field }) => (<FormItem><FormLabel>Description</FormLabel><FormControl><Textarea {...field} rows={3} /></FormControl><FormMessage /></FormItem>)} />
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-4">
                    <FormField
                        control={form.control}
                        name="assignedTo"
                        render={({ field }) => (
                            <FormItem>
                            <FormLabel>Assign To</FormLabel>
                            <Popover>
                                <PopoverTrigger asChild>
                                <FormControl>
                                    <Button
                                    variant="outline"
                                    role="combobox"
                                    className={cn(
                                        "w-full justify-between",
                                        !field.value?.length && "text-muted-foreground"
                                    )}
                                    >
                                    {field.value?.length > 0
                                        ? `${field.value.length} selected`
                                        : "Select staff or team"}
                                    <MoreHorizontal className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                    </Button>
                                </FormControl>
                                </PopoverTrigger>
                                <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                                <Command>
                                    <CommandInput placeholder="Search..." />
                                    <CommandList>
                                    <CommandEmpty>No results found.</CommandEmpty>
                                    <CommandGroup heading="Teams">
                                        <CommandItem onSelect={() => field.onChange(staffByDept['Accounting and Tax']?.map(s => s.id) || [])}>Accounting and Tax Dept</CommandItem>
                                        <CommandItem onSelect={() => field.onChange(staffByDept['Administration']?.map(s => s.id) || [])}>Administration Dept</CommandItem>
                                        <CommandItem onSelect={() => field.onChange(staffByDept['CAP']?.map(s => s.id) || [])}>CAP Dept</CommandItem>
                                    </CommandGroup>
                                    <CommandGroup heading="Individual Staff">
                                        {staffAndAdmins.map((staff) => (
                                        <CommandItem
                                            key={staff.id}
                                            value={staff.name}
                                            onSelect={() => {
                                            const selection = new Set(field.value);
                                            if (selection.has(staff.id)) {
                                                selection.delete(staff.id);
                                            } else {
                                                selection.add(staff.id);
                                            }
                                            field.onChange(Array.from(selection));
                                            }}
                                        >
                                            <div
                                            className={cn(
                                                "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary",
                                                field.value?.includes(staff.id)
                                                ? "bg-primary text-primary-foreground"
                                                : "opacity-50 [&_svg]:invisible"
                                            )}
                                            >
                                            <Check className={cn("h-4 w-4")} />
                                            </div>
                                            <span>{staff.name}</span>
                                        </CommandItem>
                                        ))}
                                    </CommandGroup>
                                    </CommandList>
                                </Command>
                                </PopoverContent>
                            </Popover>
                            <FormMessage />
                            </FormItem>
                        )}
                        />
                     <div className="flex gap-2 items-end">
                        <FormField
                            control={form.control}
                            name="dueDate"
                            render={({ field }) => (
                                <FormItem className="flex flex-col flex-grow">
                                <FormLabel>Due Date</FormLabel>
                                <Popover>
                                    <PopoverTrigger asChild>
                                    <FormControl>
                                        <Button
                                        variant={"outline"}
                                        className={cn(
                                            "w-full justify-start text-left font-normal",
                                            !field.value && "text-muted-foreground"
                                        )}
                                        >
                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                        {field.value ? (
                                            format(field.value, "dd/MM/yyyy")
                                        ) : (
                                            <span>Pick a date</span>
                                        )}
                                        </Button>
                                    </FormControl>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0" align="start">
                                    <Calendar
                                        mode="single"
                                        selected={field.value}
                                        onSelect={field.onChange}
                                        initialFocus
                                    />
                                    </PopoverContent>
                                </Popover>
                                <FormMessage />
                                </FormItem>
                            )}
                            />
                        <FormField
                            control={form.control}
                            name="dueTime"
                            render={({ field }) => (
                                <FormItem>
                                <FormControl>
                                    <Input type="time" {...field} className="w-28" />
                                </FormControl>
                                <FormMessage />
                                </FormItem>
                            )}
                        />
                     </div>
                </div>
                 <FormField
                        control={form.control}
                        name="tags"
                        render={({ field }) => (
                            <FormItem>
                            <FormLabel>Tag Staff (Optional)</FormLabel>
                            <Popover>
                                <PopoverTrigger asChild>
                                <FormControl>
                                    <Button
                                    variant="outline"
                                    role="combobox"
                                    className={cn(
                                        "w-full justify-between",
                                        !field.value?.length && "text-muted-foreground"
                                    )}
                                    >
                                    {field.value?.length > 0
                                        ? `${field.value.length} tagged`
                                        : "Select staff to tag..."}
                                    <MoreHorizontal className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                    </Button>
                                </FormControl>
                                </PopoverTrigger>
                                <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                                <Command>
                                    <CommandInput placeholder="Search..." />
                                    <CommandList>
                                    <CommandEmpty>No results found.</CommandEmpty>
                                    <CommandGroup heading="Individual Staff">
                                        {staffAndAdmins.map((staff) => (
                                        <CommandItem
                                            key={staff.id}
                                            value={staff.name}
                                            onSelect={() => {
                                            const selection = new Set(field.value);
                                            if (selection.has(staff.id)) {
                                                selection.delete(staff.id);
                                            } else {
                                                selection.add(staff.id);
                                            }
                                            field.onChange(Array.from(selection));
                                            }}
                                        >
                                            <div
                                            className={cn(
                                                "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary",
                                                field.value?.includes(staff.id)
                                                ? "bg-primary text-primary-foreground"
                                                : "opacity-50 [&_svg]:invisible"
                                            )}
                                            >
                                            <Check className={cn("h-4 w-4")} />
                                            </div>
                                            <span className="flex-grow">{staff.name}</span>
                                            <span className="text-xs text-muted-foreground font-mono">{staff.uid}</span>
                                        </CommandItem>
                                        ))}
                                    </CommandGroup>
                                    </CommandList>
                                </Command>
                                </PopoverContent>
                            </Popover>
                            <FormMessage />
                            </FormItem>
                        )}
                        />
                 <FormField control={form.control} name="orderId" render={({ field }) => (<FormItem><FormLabel>Related Order ID (Optional)</FormLabel><FormControl><Input {...field} placeholder="e.g. ORD-12345" /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="recurrence" render={({ field }) => (<FormItem><FormLabel>Recurrence</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select recurrence..." /></SelectTrigger></FormControl><SelectContent>{taskRecurrences.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                
                {task?.id && (
                    <>
                        <Separator />
                        <div className="space-y-4">
                            <h3 className="text-sm font-medium text-foreground">Comments</h3>
                            <div className="space-y-4 max-h-40 overflow-y-auto pr-2">
                                {task.comments && task.comments.length > 0 ? task.comments.slice().reverse().map((comment, index) => {
                                    const author = getAuthor(comment.authorId);
                                    const date = comment.date?.toDate ? comment.date.toDate() : new Date(comment.date);
                                    return (
                                    <div key={index} className="flex items-start gap-3">
                                         <div className="flex-shrink-0">
                                            {/* No Avatar */}
                                        </div>
                                        <div className="bg-muted p-3 rounded-lg w-full">
                                            <div className="flex justify-between items-center mb-1">
                                                <p className="text-xs font-semibold">{author?.name}</p>
                                                <p className="text-xs text-muted-foreground">{format(date, 'dd/MM/yyyy, HH:mm')}</p>
                                            </div>
                                            <p className="text-sm">{comment.text}</p>
                                        </div>
                                    </div>
                                )}) : <p className="text-xs text-muted-foreground text-center py-4">No comments posted yet.</p>}
                            </div>
                            <FormField 
                                control={form.control} 
                                name="newComment" 
                                render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Add a Comment</FormLabel>
                                    <FormControl><Textarea {...field} placeholder="Post a new comment..." rows={2}/></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}/>
                            <Button type="button" size="sm" onClick={handleCommentSubmit}>Post Comment</Button>
                        </div>
                    </>
                )}

                <div className="flex justify-end gap-2 pt-4">
                    <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>
                    <Button type="submit">Save Task</Button>
                </div>
            </form>
        </Form>
    )
}

const TaskViewDialog = ({ task, allStaff, open, onOpenChange }: { task: Task | null; allStaff: User[]; open: boolean; onOpenChange: (open: boolean) => void }) => {
    const getAuthor = (authorId: string): User | undefined => {
        return allStaff.find(u => u.id === authorId);
    }
    if (!task) return null;
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>{task.title}</DialogTitle>
                    <DialogDescription>Due: {format(getTaskDate(task), 'dd MMMM yyyy')}</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
                    <div className="space-y-2">
                        <h4 className="font-semibold text-sm">Description</h4>
                        <p className="text-sm text-muted-foreground p-3 bg-muted rounded-md">{task.description}</p>
                    </div>
                     <div className="space-y-2">
                        <h4 className="font-semibold text-sm">Comments</h4>
                         <div className="space-y-3">
                            {task.comments && task.comments.length > 0 ? task.comments.slice().reverse().map((comment, index) => {
                                const author = getAuthor(comment.authorId);
                                const date = comment.date?.toDate ? comment.date.toDate() : new Date(comment.date);
                                return (
                                <div key={index} className="flex items-start gap-3">
                                    <div className="bg-muted p-3 rounded-lg w-full">
                                        <div className="flex justify-between items-center mb-1">
                                            <p className="text-xs font-semibold">{author?.name}</p>
                                            <p className="text-xs text-muted-foreground">{format(date, 'dd/MM/yyyy, HH:mm')}</p>
                                        </div>
                                        <p className="text-sm">{comment.text}</p>
                                    </div>
                                </div>
                            )}) : <p className="text-xs text-muted-foreground text-center py-4">No comments posted yet.</p>}
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}

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

const getTaskDate = (task: Task): Date => {
  if (task.dueDate instanceof Date) {
      return task.dueDate;
  }
  if (task.dueDate && typeof (task.dueDate as any).toDate === 'function') {
      return (task.dueDate as any).toDate();
  }
  return new Date(task.dueDate);
}

const TaskTable = ({ tasks, title, description, onEdit, onUpdateStatus, onDelete, allStaff, currentUser, onFilter, taskTypes, onView }: { tasks: Task[], title: string, description: string, onEdit: (task: Task) => void, onView: (task: Task) => void, onUpdateStatus: (taskId: string, updates: Partial<Task>) => void, onDelete: (taskId: string) => void, allStaff: User[], currentUser: User | null, onFilter?: (filter: string) => void, taskTypes?: string[] }) => {
    const getAssignee = (userId?: string): User | undefined => {
        if (!userId) return undefined;
        return allStaff.find(u => u.id === userId);
    }
    
    const getStatusVariant = (status: Task['status']) => {
        switch (status) {
            case 'Done': return 'success';
            case 'In Progress': return 'info';
            case 'To-Do': return 'info';
            case 'Review': return 'warning';
            default: return 'secondary';
        }
    };

    return (
        <Card>
            <CardHeader>
                <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                    <div>
                        <CardTitle>{title}</CardTitle>
                        <CardDescription>{description}</CardDescription>
                    </div>
                    {onFilter && taskTypes && (
                        <div className="w-full sm:w-auto">
                            <Select onValueChange={onFilter} defaultValue="all">
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
                    )}
                </div>
            </CardHeader>
            <CardContent>
                 {tasks.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">No tasks to display.</p>
                ) : (
                <Table>
                    <TableHeader>
                    <TableRow>
                        <TableHead>Task</TableHead>
                        <TableHead>Assigned To</TableHead>
                        <TableHead>Tags</TableHead>
                        <TableHead>Dates</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Related Order</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                    </TableHeader>
                    <TableBody>
                    {tasks.map(task => {
                        const dueDate = getTaskDate(task);
                        const lastComment = task.comments && task.comments.length > 0 ? task.comments[task.comments.length - 1] : null;
                        const commentAuthor = lastComment ? getAssignee(lastComment.authorId) : null;
                        const assignees = Array.isArray(task.assignedTo) ? task.assignedTo : [task.assignedTo];
                        const tags = Array.isArray(task.tags) ? task.tags : [];
                        const canDelete = currentUser?.id === task.createdBy;
                        
                        return (
                        <TableRow key={task.id}>
                        <TableCell className="font-medium max-w-xs align-top">
                            <div className="flex items-center gap-2">
                                {task.recurrence && task.recurrence !== 'None' && <Repeat className="h-4 w-4 text-muted-foreground" title={`Repeats ${task.recurrence}`} />}
                                <p className="font-semibold truncate">{task.title}</p>
                            </div>
                            <p className="text-xs text-muted-foreground truncate">{task.description}</p>
                            {lastComment && commentAuthor && (
                                <div className="mt-2 flex items-start gap-2 border-l-2 border-primary/50 pl-2">
                                    <MessageSquare className="h-3 w-3 text-muted-foreground flex-shrink-0 mt-0.5" />
                                    <div className="text-xs">
                                        <span className="font-semibold">{commentAuthor.name.split(' ')[0]}:</span>
                                        <span className="text-muted-foreground ml-1">"{lastComment.text}"</span>
                                    </div>
                                </div>
                            )}
                        </TableCell>
                        <TableCell className="align-top">
                            <div className="flex items-center -space-x-2">
                                {assignees.slice(0, 3).map(userId => {
                                    const isDept = userId.startsWith('dept:');
                                    if (isDept) {
                                        const deptName = userId.split(':')[1].replace(/-/g, ' ');
                                        return (
                                            <TooltipProvider key={userId}>
                                                <Tooltip>
                                                    <TooltipTrigger>
                                                        <span className="h-6 w-6 border-2 border-background rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold">{deptName.charAt(0).toUpperCase()}</span>
                                                    </TooltipTrigger>
                                                    <TooltipContent>
                                                        <p className="capitalize">{deptName} Department</p>
                                                    </TooltipContent>
                                                </Tooltip>
                                            </TooltipProvider>
                                        )
                                    }
                                    const assignee = getAssignee(userId);
                                    if (!assignee) return null;
                                    return (
                                         <TooltipProvider key={userId}>
                                            <Tooltip>
                                                <TooltipTrigger>
                                                    <span className={cn("h-6 w-6 border-2 border-background rounded-full flex items-center justify-center text-xs font-semibold", getUserColor(assignee.id))}>{assignee.name.charAt(0)}</span>
                                                </TooltipTrigger>
                                                <TooltipContent>
                                                    <p>{assignee.name.split(' ')[0]}</p>
                                                </TooltipContent>
                                            </Tooltip>
                                        </TooltipProvider>
                                    );
                                })}
                                 {assignees.length > 3 && (
                                    <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center text-xs font-bold border-2 border-background">
                                        +{assignees.length - 3}
                                    </div>
                                )}
                            </div>
                        </TableCell>
                        <TableCell className="align-top">
                            <div className="flex items-center -space-x-2">
                                {tags.slice(0, 3).map(userId => {
                                    const taggedUser = getAssignee(userId);
                                    if (!taggedUser) return null;
                                    return (
                                         <TooltipProvider key={userId}>
                                            <Tooltip>
                                                <TooltipTrigger>
                                                    <span className={cn("h-6 w-6 border-2 border-background rounded-full flex items-center justify-center text-xs", getUserColor(taggedUser.id))}>{taggedUser.name.charAt(0)}</span>
                                                </TooltipTrigger>
                                                <TooltipContent>
                                                    <p>Tagged: {taggedUser.name.split(' ')[0]}</p>
                                                </TooltipContent>
                                            </Tooltip>
                                        </TooltipProvider>
                                    );
                                })}
                                 {tags.length > 3 && (
                                    <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center text-xs font-bold border-2 border-background opacity-70">
                                        +{tags.length - 3}
                                    </div>
                                )}
                            </div>
                        </TableCell>
                         <TableCell className="align-top text-xs">
                            <div className="flex flex-col">
                                <span className="font-semibold">Due: {format(dueDate, 'dd/MM/yyyy')}</span>
                                <span className="text-muted-foreground">Created: {task.createdAt?.toDate ? format(task.createdAt.toDate(), 'dd/MM/yyyy') : 'N/A'}</span>
                            </div>
                        </TableCell>
                        <TableCell className="align-top">
                            <Badge variant={getStatusVariant(task.status)}>
                                {task.status}
                            </Badge>
                        </TableCell>
                        <TableCell className="align-top">
                           {task.orderId ? (
                                <Button variant="link" asChild className="p-0 h-auto text-xs">
                                    <Link href={`/admin/orders/${task.orderId}`}>{task.orderId}</Link>
                                </Button>
                            ) : <span className="text-muted-foreground text-xs">N/A</span>}
                        </TableCell>
                        <TableCell className="text-right align-top">
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
                                    <DropdownMenuItem onClick={() => onView(task)}>
                                        <Eye className="mr-2 h-4 w-4" /> View Details
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => onEdit(task)}>
                                        Edit / Comment
                                    </DropdownMenuItem>
                                    <DropdownMenuSub>
                                        <DropdownMenuSubTrigger>Change Status</DropdownMenuSubTrigger>
                                        <DropdownMenuSubContent>
                                        {taskStatuses.map(status => (
                                            <DropdownMenuItem key={status} onClick={() => onUpdateStatus(task.id, { status })} disabled={task.status === status}>
                                                Mark as {status}
                                            </DropdownMenuItem>
                                        ))}
                                        </DropdownMenuSubContent>
                                    </DropdownMenuSub>
                                    <DropdownMenuSeparator />
                                    <AlertDialogTrigger asChild>
                                        <DropdownMenuItem className="text-destructive" disabled={!canDelete}>
                                            Delete
                                        </DropdownMenuItem>
                                    </AlertDialogTrigger>
                                </DropdownMenuContent>
                                </DropdownMenu>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                        This action cannot be undone. This will permanently delete the task:
                                        <span className="font-semibold"> {task.title}</span>.
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                        <AlertDialogAction onClick={() => onDelete(task.id)}>
                                            Continue
                                        </AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        </TableCell>
                        </TableRow>
                    )})}
                    </TableBody>
                </Table>
                )}
            </CardContent>
        </Card>
    )
};


export default function AdminDashboardPage() {
    const { user, updateUser } = useAuth();
    const [tasks, setTasks] = useState<Task[]>([]);
    const [orders, setOrders] = useState<Order[]>([]);
    const [allStaffAndClients, setAllStaffAndClients] = useState<User[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [isViewOpen, setIsViewOpen] = useState(false);
    const [selectedTask, setSelectedTask] = useState<Task | null>(null);
    const [viewingTask, setViewingTask] = useState<Task | null>(null);
    const [upcomingAutomatedTaskFilter, setUpcomingAutomatedTaskFilter] = useState('all');
    const { toast } = useToast();
    
    const archivedNotifications = user?.archivedNotifications || [];

    const archiveNotification = async (noteId: string) => {
        if (!user) return;
        const userRef = doc(db, 'users', user.uid);
        await updateDoc(userRef, {
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
        setIsLoading(true);
        const usersRef = collection(db, "users");
        getDocs(usersRef).then(usersSnapshot => {
            const fetchedUsers = usersSnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id, uid: doc.id } as User));
            setAllStaffAndClients(fetchedUsers);
        }).catch(async (error) => {
            const permissionError = new FirestorePermissionError({
                path: usersRef.path,
                operation: 'list',
            } satisfies SecurityRuleContext);
            errorEmitter.emit('permission-error', permissionError);
        });

        const tasksRef = collection(db, 'tasks');
        const tasksQuery = query(tasksRef, orderBy('dueDate', 'asc'));
        const tasksUnsubscribe = onSnapshot(tasksQuery, (snapshot) => {
            const fetchedTasks = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Task));
            setTasks(fetchedTasks);
            if (isLoading) setIsLoading(false);
        }, async (error) => {
            const permissionError = new FirestorePermissionError({
                path: tasksRef.path,
                operation: 'list',
            } satisfies SecurityRuleContext);
            errorEmitter.emit('permission-error', permissionError);
            if (isLoading) setIsLoading(false);
        });

        const ordersRef = collection(db, 'orders');
        const ordersQuery = query(ordersRef, orderBy('date', 'desc'));
        const ordersUnsubscribe = onSnapshot(ordersQuery, (snapshot) => {
            const fetchedOrders = snapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    ...data,
                    id: doc.id,
                    date: data.date?.toDate ? data.date.toDate().toISOString() : new Date().toISOString(),
                    notes: (data.notes || []).map((note: any) => ({...note, date: note.date?.toDate ? note.date.toDate().toISOString() : new Date().toISOString()})),
                    itnHistory: (data.itnHistory || []).map((log: any) => ({ ...log, receivedAt: log.receivedAt?.toDate ? log.receivedAt.toDate().toISOString() : new Date().toISOString() })),
                } as Order;
            });
            setOrders(fetchedOrders);
        }, async (error) => {
            const permissionError = new FirestorePermissionError({
                path: ordersRef.path,
                operation: 'list',
            } satisfies SecurityRuleContext);
            errorEmitter.emit('permission-error', permissionError);
        });

        return () => {
            tasksUnsubscribe();
            ordersUnsubscribe();
        };
    }, [toast]);


    const staffByDept = useMemo(() => {
        const result: Record<string, User[]> = {};
        departments.forEach(dept => {
            result[dept] = allStaffAndClients.filter(u => u.department === dept && (u.role === 'staff' || u.role === 'admin'));
        });
        return result;
    }, [allStaffAndClients]);

    const taskTypes = useMemo(() => {
        const types = new Set(tasks.filter(task => task.recurrence && task.recurrence !== 'None').map(task => {
            const title = task.title;
            const forIndex = title.lastIndexOf(' for ');
            if (forIndex > -1) {
                return title.substring(0, forIndex);
            }
            return title;
        }));
        return ['All Tasks', ...Array.from(types)];
    }, [tasks]);
    
    const getAuthor = (authorId: string): User | undefined => {
        return allStaffAndClients.find(u => u.uid === authorId || u.id === authorId);
    }

    const notifications = useMemo(() => {
        if (!user) return [];
    
        const orderNoteNotifications = orders
            .flatMap(order => {
                const isAssigned = order.assignedTo?.includes(user.id);
                const isTagged = tasks.some(task => task.orderId === order.id && task.tags?.includes(user.id));
                if (!isAssigned && !isTagged) return [];
    
                return (order.notes || [])
                    .filter(note => note.authorId !== user.id && note.type === 'note' && !archivedNotifications.includes(order.id + (note.date?.toDate ? note.date.toDate().toISOString() : new Date(note.date).toISOString())))
                    .map(note => {
                        const author = getAuthor(note.authorId);
                        const date = note.date?.toDate ? note.date.toDate() : new Date(note.date);
                        return {
                            id: order.id + date.toISOString(),
                            type: 'order_note' as const,
                            author,
                            date,
                            order,
                            note,
                        };
                    });
            })
            .filter(Boolean);
    
        const taskNotifications = tasks
            .filter(task => 
                task.assignedTo.includes(user.id) && 
                task.createdBy !== user.id && 
                !archivedNotifications.includes(`task-${task.id}`)
            )
            .map(task => {
                const author = getAuthor(task.createdBy);
                return {
                    id: `task-${task.id}`,
                    type: 'task_assigned' as const,
                    author,
                    date: task.createdAt?.toDate ? task.createdAt.toDate() : new Date(),
                    task,
                };
            });
    
        const allNotifications = [...orderNoteNotifications, ...taskNotifications];
        return allNotifications.sort((a, b) => b.date.getTime() - a.date.getTime());
    }, [orders, tasks, user, archivedNotifications]);


    const myTasks = useMemo(() => {
        if (!user) return [];
        return tasks.filter(task => 
            Array.isArray(task.assignedTo) && 
            task.assignedTo.includes(user.id) &&
            task.status !== 'Done' &&
            (!task.recurrence || task.recurrence === 'None')
        ).sort((a,b) => getTaskDate(a).getTime() - getTaskDate(b).getTime());
    }, [tasks, user]);

    const completedTasks = useMemo(() => {
        if (!user) return [];
        return tasks.filter(task => 
            (Array.isArray(task.assignedTo) && task.assignedTo.includes(user.id) || task.createdBy === user.id) &&
            task.status === 'Done'
        ).sort((a, b) => getTaskDate(b).getTime() - getTaskDate(a).getTime());
    }, [tasks, user]);

    const upcomingAutomatedTasks = useMemo(() => {
        const now = startOfToday();
        const thirtyDaysFromNow = addDays(now, 30);
        const filtered = tasks.filter(task => 
            task.recurrence && task.recurrence !== 'None' &&
            task.status !== 'Done' &&
            isWithinInterval(getTaskDate(task), { start: now, end: thirtyDaysFromNow })
        );
        
        if (upcomingAutomatedTaskFilter === 'all' || upcomingAutomatedTaskFilter === 'All Tasks') {
            return filtered.sort((a,b) => getTaskDate(a).getTime() - getTaskDate(b).getTime());
        }
        
        return filtered.filter(task => task.title.startsWith(upcomingAutomatedTaskFilter))
            .sort((a,b) => getTaskDate(a).getTime() - getTaskDate(b).getTime());

    }, [tasks, upcomingAutomatedTaskFilter]);
    
    const departmentTasks = useMemo(() => {
        if (user?.role !== 'admin') return [];
        
        const deptTasks = tasks.filter(task => {
            if (task.status === 'Done' || !task.clientId) return false;
            return true;
        });
        
        return deptTasks.sort((a, b) => getTaskDate(a).getTime() - getTaskDate(b).getTime());
    }, [tasks, user]);

    const handleAdd = () => {
        setSelectedTask(null);
        setIsFormOpen(true);
    };

    const handleEdit = (task: Task) => {
        setSelectedTask(task);
        setIsFormOpen(true);
    };

    const handleView = (task: Task) => {
        setViewingTask(task);
        setIsViewOpen(true);
    }
    
    const handleDelete = async (taskId: string) => {
        const taskRef = doc(db, 'tasks', taskId);
        deleteDoc(taskRef)
            .then(() => {
                toast({ title: 'Task Deleted', variant: 'destructive' });
            })
            .catch(async (error) => {
                const permissionError = new FirestorePermissionError({
                    path: taskRef.path,
                    operation: 'delete',
                } satisfies SecurityRuleContext);
                errorEmitter.emit('permission-error', permissionError);
            });
    };

    const handleUpdate = async (taskId: string, updates: Partial<Task>) => {
        const originalTask = tasks.find(t => t.id === taskId);
        if (!originalTask || !user) return;
    
        const taskRef = doc(db, 'tasks', taskId);
        updateDoc(taskRef, updates)
            .then(() => {
                if (updates.status === 'Done') {
                    const creator = allStaffAndClients.find(s => s.id === originalTask.createdBy);
                    if (creator && creator.email && creator.id !== user.id) {
                        try {
                            const emailHtml = render(<TaskCompletedEmail
                                creatorName={creator.name.split(' ')[0]}
                                taskTitle={originalTask.title}
                                completedBy={user.name}
                                taskUrl={`${window.location.origin}/admin/dashboard`}
                            />);
                            sendEmail({
                                to: creator.email,
                                subject: `Task Completed: ${originalTask.title}`,
                                html: emailHtml,
                            });
                        } catch (emailError) {}
                    }
        
                    if (originalTask.recurrence && originalTask.recurrence !== 'None') {
                        createNextRecurrence(originalTask);
                    }
                    toast({ title: 'Task Completed!' });
                } else {
                    toast({ title: 'Task Updated' });
                }
            })
            .catch(async (error) => {
                const permissionError = new FirestorePermissionError({
                    path: taskRef.path,
                    operation: 'update',
                    requestResourceData: updates,
                } satisfies SecurityRuleContext);
                errorEmitter.emit('permission-error', permissionError);
            });
    };

    const createNextRecurrence = async (completedTask: Task) => {
        if (!completedTask.recurrence || completedTask.recurrence === 'None') return;

        let nextDueDate: Date;
        const currentDueDate = getTaskDate(completedTask);

        switch (completedTask.recurrence) {
            case 'Monthly': nextDueDate = addMonths(currentDueDate, 1); break;
            case 'Bi-Monthly': nextDueDate = addMonths(currentDueDate, 2); break;
            case 'Annually': nextDueDate = addYears(currentDueDate, 1); break;
            default: return;
        }
        
        const { id, ...restOfTask } = completedTask;
        const newTaskData = {
            ...restOfTask,
            dueDate: Timestamp.fromDate(nextDueDate),
            status: 'To-Do' as const,
            createdAt: Timestamp.now(),
            comments: [],
        };
        
        addDoc(collection(db, 'tasks'), newTaskData)
            .catch(async (error) => {
                const permissionError = new FirestorePermissionError({
                    path: 'tasks',
                    operation: 'create',
                    requestResourceData: newTaskData,
                } satisfies SecurityRuleContext);
                errorEmitter.emit('permission-error', permissionError);
            });
    };


    const handleFormSubmit = async (data: Omit<Task, 'id' | 'status' | 'createdBy' | 'comments' | 'priority' | 'createdAt'>) => {
        if (!user || !user.id) return;
        setIsLoading(true);

        const taskData = {
            ...data,
            dueDate: Timestamp.fromDate(data.dueDate as Date),
        };
        
        try {
            if (selectedTask?.id) {
                const taskRef = doc(db, 'tasks', selectedTask.id);
                await updateDoc(taskRef, { ...taskData })
                    .catch(async (error) => {
                        const permissionError = new FirestorePermissionError({
                            path: taskRef.path,
                            operation: 'update',
                            requestResourceData: taskData,
                        } satisfies SecurityRuleContext);
                        errorEmitter.emit('permission-error', permissionError);
                    });
                toast({ title: 'Task Updated' });
            } else {
                const newTask: Omit<Task, 'id' | 'priority'> = {
                    ...taskData,
                    status: 'To-Do',
                    createdBy: user.id,
                    createdAt: Timestamp.now(),
                    comments: [],
                };
                await addDoc(collection(db, 'tasks'), newTask)
                    .catch(async (error) => {
                        const permissionError = new FirestorePermissionError({
                            path: 'tasks',
                            operation: 'create',
                            requestResourceData: newTask,
                        } satisfies SecurityRuleContext);
                        errorEmitter.emit('permission-error', permissionError);
                    });
                toast({ title: 'Task Created' });

                for (const assigneeId of data.assignedTo) {
                    if (assigneeId !== user.id) {
                        const assignee = allStaffAndClients.find(s => s.id === assigneeId);
                        if (assignee && assignee.email) {
                            try {
                                const emailHtml = render(<NewTaskEmail
                                    assigneeName={assignee.name.split(' ')[0]}
                                    taskTitle={newTask.title}
                                    taskDescription={newTask.description}
                                    dueDate={format((newTask.dueDate as Timestamp).toDate(), 'dd/MM/yyyy')}
                                    assignedBy={user.name}
                                    taskUrl={`${window.location.origin}/admin/dashboard`}
                                />);
                                sendEmail({
                                    to: assignee.email,
                                    subject: `New Task Assigned: ${newTask.title}`,
                                    html: emailHtml,
                                });
                            } catch (emailError) {}
                        }
                    }
                }
            }
            setIsFormOpen(false);
            setSelectedTask(null);
        } catch (error) {
            console.error("Error saving task:", error);
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

        const taskRef = doc(db, 'tasks', taskId);
        updateDoc(taskRef, {
            comments: arrayUnion(newComment),
        })
        .then(() => {
            const newCommentForState = { ...newComment, date: new Date() };
            if (selectedTask) {
                 const updatedComments = [...(selectedTask.comments || []), newCommentForState];
                 setSelectedTask({ ...selectedTask, comments: updatedComments });
            }
            setTasks(prevTasks => prevTasks.map(t => {
                if (t.id === taskId) {
                    const existingComments = t.comments?.map(c => c.date.toDate ? c : {...c, date: new Date(c.date)}) || [];
                    return {...t, comments: [...existingComments, newCommentForState]};
                }
                return t;
            }));
            toast({ title: 'Comment Posted' });
        })
        .catch(async (error) => {
            const permissionError = new FirestorePermissionError({
                path: taskRef.path,
                operation: 'update',
                requestResourceData: { comments: arrayUnion(newComment) },
            } satisfies SecurityRuleContext);
            errorEmitter.emit('permission-error', permissionError);
        });
    }

    const handleFormOpenChange = (open: boolean) => {
        setIsFormOpen(open);
        if (!open) setSelectedTask(null);
    }

    const handleViewOpenChange = (open: boolean) => {
        setIsViewOpen(open);
        if(!open) setViewingTask(null);
    }
    
    return (
        <div className="space-y-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Welcome, {user?.name}!</h1>
                    <p className="text-muted-foreground">Here's a summary of what's happening today.</p>
                </div>
                {user?.role !== 'cap_staff' && (
                    <div className="flex gap-2">
                        <Dialog open={isFormOpen} onOpenChange={handleFormOpenChange}>
                            <DialogTrigger asChild>
                                <Button onClick={handleAdd}>
                                    <PlusCircle className="mr-2 h-4 w-4" />
                                    Create Task
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="sm:max-w-xl">
                                <DialogHeader>
                                    <DialogTitle>{selectedTask?.id ? 'Edit Task' : 'Create New Task'}</DialogTitle>
                                    <DialogDescription>
                                        {selectedTask?.id ? 'Update the details of this task.' : 'Fill out the form to add a new task for a staff member.'}
                                    </DialogDescription>
                                </DialogHeader>
                                <TaskForm 
                                    task={selectedTask} 
                                    onSubmit={handleFormSubmit}
                                    onCancel={() => handleFormOpenChange(false)}
                                    onCommentSubmit={handleCommentSubmit}
                                    allStaff={allStaffAndClients.filter(u => u.role === 'admin' || u.role === 'staff')}
                                    staffByDept={staffByDept}
                                />
                            </DialogContent>
                        </Dialog>
                    </div>
                )}
            </div>
            
             <Separator />
            
             <TaskViewDialog task={viewingTask} allStaff={allStaffAndClients} open={isViewOpen} onOpenChange={handleViewOpenChange} />

            <div className="space-y-8">
                {isLoading ? (
                    <div className="flex justify-center items-center h-64">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
                ) : user?.role !== 'cap_staff' ? (
                    <>
                         <Card className="w-full">
                            <CardHeader>
                                <CardTitle>Notifications</CardTitle>
                                <CardDescription>Recent updates on your assigned orders and tasks.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <ScrollArea className="h-72">
                                    <div className="space-y-4">
                                        {notifications.map((item) => (
                                            <div key={item.id} className="flex items-start gap-3">
                                                <div className={cn("mt-1 h-8 w-8 rounded-full flex items-center justify-center font-bold text-sm", item.author ? getUserColor(item.author.id) : 'bg-gray-200')}>
                                                    {item.author?.name.charAt(0) || '?'}
                                                </div>
                                                <div className="flex-1">
                                                    {item.type === 'order_note' && item.note && (
                                                        <p className="text-sm">
                                                            <span className="font-semibold">{item.author?.name || 'Unknown User'}</span>
                                                            <span className="text-muted-foreground"> left a note on order </span>
                                                            <Link href={`/admin/orders/${item.order.id}`} className="font-semibold text-primary hover:underline">{item.order.id}</Link>
                                                        </p>
                                                    )}
                                                    {item.type === 'task_assigned' && (
                                                        <p className="text-sm">
                                                            <span className="font-semibold">{item.author?.name || 'System'}</span>
                                                            <span className="text-muted-foreground"> assigned you a new task.</span>
                                                        </p>
                                                    )}
                                                     <blockquote className="mt-1 border-l-2 pl-3 text-sm italic">
                                                        {item.type === 'order_note' ? `"${item.note.text}"` : `"${item.task.title}"`}
                                                    </blockquote>
                                                    <div className="flex items-center justify-between">
                                                        <p className="text-xs text-muted-foreground mt-1">
                                                            {formatDistanceToNow(item.date, { addSuffix: true })}
                                                        </p>
                                                        <Button size="sm" variant="ghost" onClick={() => archiveNotification(item.id)}>
                                                            <Archive className="mr-2 h-4 w-4"/> Archive
                                                        </Button>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                        {notifications.length === 0 && (
                                            <div className="flex flex-col items-center justify-center h-40 text-center text-muted-foreground">
                                                <Inbox className="h-12 w-12 mb-4"/>
                                                <p className="font-semibold">All caught up!</p>
                                                <p className="text-sm">You have no new notifications.</p>
                                            </div>
                                        )}
                                    </div>
                                </ScrollArea>
                            </CardContent>
                        </Card>

                        <WeeklyTaskCalendar tasks={tasks} allStaff={allStaffAndClients} currentUser={user} onTaskUpdate={handleUpdate} onEdit={handleEdit} />

                        <TaskTable 
                            tasks={myTasks} 
                            title="My Tasks" 
                            description="All tasks assigned directly to you."
                            onEdit={handleEdit}
                            onView={handleView}
                            onUpdateStatus={(taskId, updates) => handleUpdate(taskId, updates)}
                            onDelete={handleDelete}
                            allStaff={allStaffAndClients}
                            currentUser={user}
                        />

                        <TaskTable 
                            tasks={upcomingAutomatedTasks} 
                            title="Upcoming Automated Tasks" 
                            description="Automated tasks that are due within the next 30 days."
                            onEdit={handleEdit}
                            onView={handleView}
                            onUpdateStatus={(taskId, updates) => handleUpdate(taskId, updates)}
                            onDelete={handleDelete}
                            allStaff={allStaffAndClients}
                            currentUser={user}
                            onFilter={setUpcomingAutomatedTaskFilter}
                            taskTypes={taskTypes}
                        />
                        
                        <Accordion type="single" collapsible>
                            <AccordionItem value="completed-tasks">
                                <AccordionTrigger>
                                    <h2 className="text-2xl font-bold tracking-tight">Completed Tasks</h2>
                                </AccordionTrigger>
                                <AccordionContent className="pt-4">
                                     <TaskTable 
                                        tasks={completedTasks} 
                                        title="" 
                                        description="Tasks assigned to or created by you that have been marked as 'Done'."
                                        onEdit={handleEdit}
                                        onView={handleView}
                                        onUpdateStatus={(taskId, updates) => handleUpdate(taskId, updates)}
                                        onDelete={handleDelete}
                                        allStaff={allStaffAndClients}
                                        currentUser={user}
                                    />
                                </AccordionContent>
                            </AccordionItem>
                        </Accordion>


                        {user?.role === 'admin' && departmentTasks.length > 0 && (
                             <TaskTable 
                                tasks={departmentTasks} 
                                title={`${user?.department} Department Tasks`} 
                                description={`All automated tasks generated for clients.`}
                                onEdit={handleEdit}
                                onView={handleView}
                                onUpdateStatus={(taskId, updates) => handleUpdate(taskId, updates)}
                                onDelete={handleDelete}
                                allStaff={allStaffAndClients}
                                currentUser={user}
                            />
                        )}
                    </>
                ) : (
                    <Card>
                        <CardHeader>
                            <CardTitle>Dashboard</CardTitle>
                            <CardDescription>Welcome to the CAP Suppliers dashboard.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <p>As a CAP Staff member, your view is focused on CAP Supplier modules.</p>
                        </CardContent>
                    </Card>
                )}
            </div>
        </div>
    );
}
