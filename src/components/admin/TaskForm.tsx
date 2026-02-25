'use client';

import { useForm, useFieldArray } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Task, User, TaskComment } from '@/lib/types';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, MoreHorizontal, Check } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList, CommandGroup } from '@/components/ui/command';
import { Separator } from '../ui/separator';

const taskRecurrences: Task['recurrence'][] = ['None', 'Daily', 'Weekly', 'Monthly', 'Bi-Monthly', 'Annually'];

const formSchema = z.object({
  id: z.string().optional(),
  title: z.string().min(5, 'Title is required.'),
  description: z.string().min(10, 'Description is required.'),
  assignedTo: z.array(z.string()).min(1, 'Please assign a staff member.'),
  tags: z.array(z.string()).optional(),
  dueDate: z.date({ required_error: 'A due date is required.'}),
  recurrence: z.enum(taskRecurrences).optional(),
  orderId: z.string().optional(),
  newComment: z.string().optional(),
});

export default function TaskForm({ task, onSubmit, onCancel, onCommentSubmit, allStaff, staffByDept }: { task: Partial<Task> | null, onSubmit: (data: any) => void, onCancel: () => void, onCommentSubmit: (taskId: string, commentText: string) => void, allStaff: User[], staffByDept: Record<string, User[]> }) {
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

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            id: task?.id || '',
            title: task?.title || '',
            description: task?.description || '',
            assignedTo: task?.assignedTo || [],
            tags: task?.tags || [],
            dueDate: getTaskDate(task),
            recurrence: task?.recurrence || 'None',
            orderId: task?.orderId || '',
            newComment: '',
        },
    });

    const handleSubmit = (values: z.infer<typeof formSchema>) => {
        onSubmit(values);
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

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4 max-h-[70vh] overflow-y-auto p-1 pr-4">
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
                                        : "Select member"}
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
                                        {Object.keys(staffByDept).map(dept => (
                                            <CommandItem key={dept} onSelect={() => field.onChange(staffByDept[dept]?.map(s => s.id) || [])}>{dept} Dept</CommandItem>
                                        ))}
                                    </CommandGroup>
                                    <CommandGroup heading="Assignable Members">
                                        {allStaff.map((staff) => (
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
                     <FormField
                        control={form.control}
                        name="dueDate"
                        render={({ field }) => (
                            <FormItem className="flex flex-col pt-2">
                            <FormLabel className="mb-1">Due Date</FormLabel>
                            <Popover>
                                <PopoverTrigger asChild>
                                <FormControl>
                                    <Button
                                    variant={"outline"}
                                    className={cn(
                                        "w-full pl-3 text-left font-normal",
                                        !field.value && "text-muted-foreground"
                                    )}
                                    >
                                    {field.value ? (
                                        format(field.value, "dd/MM/yyyy")
                                    ) : (
                                        <span>Pick a date</span>
                                    )}
                                    <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
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
                                    <CommandGroup heading="Members">
                                        {allStaff.map((staff) => (
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
                                FormItem>
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
