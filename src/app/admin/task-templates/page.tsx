'use client';
import { useState, useMemo, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { MoreHorizontal, PlusCircle, Repeat } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Task, User } from '@/lib/types';
import { getFirestore, collection, addDoc, getDocs, doc, setDoc, deleteDoc, query, orderBy } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';


const db = getFirestore(firebaseApp);

const departments = ['Accounting and Tax', 'Administration', 'CAP'] as const;
const taskRecurrences = ['None', 'Daily', 'Weekly', 'Monthly', 'Bi-Monthly', 'Semi-Annually', 'Annually'] as const;
const triggerFields = [
    'preparesFinancials', 
    'requiresManagementAccounts', 
    'submitsEmp201', 
    'submitsEmp501', 
    'submitsProvisionalTax', 
    'submitsIncomeTax', 
    'isVatRegistered',
    'submitsAnnualReturns',
    'submitsBeneficialOwnership',
];
const vatCategories = ['A', 'B', 'C'] as const;


const formSchema = z.object({
    id: z.string().optional(),
    title: z.string().min(5, 'Title is required and must contain {clientName}.').refine(val => val.includes('{clientName}'), { message: 'Title must include the placeholder {clientName}.'}),
    description: z.string().min(10, 'Description is required.'),
    department: z.enum(departments),
    priority: z.enum(['High', 'Medium', 'Low']),
    recurrence: z.enum(taskRecurrences),
    dueMonthOffset: z.preprocess(val => Number(val), z.number()),
    dueDay: z.preprocess(val => Number(val), z.number().min(1).max(31)),
    triggerField: z.enum([...triggerFields, ''] as unknown as [string, ...string[]]),
    vatCategory: z.enum([...vatCategories, ''] as unknown as [string, ...string[]]).optional(),
});

function TemplateForm({ template, onSubmit, onCancel }: { template: Task | null; onSubmit: (data: any) => void; onCancel: () => void; }) {
    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            id: template?.id || '',
            title: template?.title || '{clientName} - ',
            description: template?.description || '',
            department: (departments.includes(template?.department as any) ? template?.department : 'Administration') as 'Accounting and Tax' | 'Administration' | 'CAP',
            priority: template?.priority || 'Medium',
            recurrence: template?.recurrence || 'Annually',
            dueMonthOffset: template?.dueMonthOffset || 0,
            dueDay: template?.dueDay || 1,
            triggerField: template?.triggerField || '',
            vatCategory: template?.vatCategory || '',
        },
    });
    
     const triggerField = form.watch('triggerField');

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 max-h-[70vh] overflow-y-auto p-1 pr-4">
                <FormField control={form.control} name="title" render={({ field }) => ( <FormItem><FormLabel>Template Title</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                <FormField control={form.control} name="description" render={({ field }) => ( <FormItem><FormLabel>Description</FormLabel><FormControl><Textarea {...field} rows={3} /></FormControl><FormMessage /></FormItem> )} />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField control={form.control} name="department" render={({ field }) => ( <FormItem><FormLabel>Department</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select a department" /></SelectTrigger></FormControl><SelectContent>{departments.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem> )} />
                    <FormField control={form.control} name="priority" render={({ field }) => ( <FormItem><FormLabel>Priority</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent>{['High', 'Medium', 'Low'].map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem> )} />
                </div>
                 <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <FormField control={form.control} name="recurrence" render={({ field }) => ( <FormItem><FormLabel>Recurrence</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent>{taskRecurrences.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem> )} />
                    <FormField control={form.control} name="dueMonthOffset" render={({ field }) => ( <FormItem><FormLabel>Due Month Offset</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem> )} />
                    <FormField control={form.control} name="dueDay" render={({ field }) => ( <FormItem><FormLabel>Due Day of Month</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem> )} />
                </div>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                     <FormField control={form.control} name="triggerField" render={({ field }) => ( <FormItem><FormLabel>Automation Trigger</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select trigger field..." /></SelectTrigger></FormControl><SelectContent>{triggerFields.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem> )} />
                     {triggerField === 'isVatRegistered' && (
                        <FormField control={form.control} name="vatCategory" render={({ field }) => ( <FormItem><FormLabel>VAT Category</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select VAT category..." /></SelectTrigger></FormControl><SelectContent>{vatCategories.map(c => <SelectItem key={c} value={c}>Category {c}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem> )} />
                     )}
                 </div>
                 <div className="flex justify-end gap-2 pt-4">
                    <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>
                    <Button type="submit">Save Template</Button>
                </div>
            </form>
        </Form>
    )
}

export default function TaskTemplatesPage() {
    const [templates, setTemplates] = useState<Task[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [selectedTemplate, setSelectedTemplate] = useState<Task | null>(null);
    const { toast } = useToast();

    const fetchTemplates = async () => {
        setIsLoading(true);
        try {
            const q = query(collection(db, "taskTemplates"), orderBy("title"));
            const querySnapshot = await getDocs(q);
            const fetchedTemplates = querySnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Task));
            setTemplates(fetchedTemplates);
        } catch (e) {
            toast({ title: 'Error', description: 'Failed to fetch task templates.', variant: 'destructive' });
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchTemplates();
    }, []);

    const handleAdd = () => {
        setSelectedTemplate(null);
        setIsFormOpen(true);
    };

    const handleEdit = (template: Task) => {
        setSelectedTemplate(template);
        setIsFormOpen(true);
    };

    const handleDelete = async (templateId: string) => {
        try {
            await deleteDoc(doc(db, "taskTemplates", templateId));
            toast({ title: 'Template Deleted', variant: 'destructive' });
            fetchTemplates();
        } catch (error) {
            toast({ title: 'Error', description: 'Could not delete template.', variant: 'destructive' });
        }
    };

    const handleFormSubmit = async (data: z.infer<typeof formSchema>) => {
        const { id, ...templateData } = data;
        const finalData = { ...templateData, dueDay: Number(templateData.dueDay), dueMonthOffset: Number(templateData.dueMonthOffset) };
        try {
            if (id) {
                await setDoc(doc(db, "taskTemplates", id), finalData, { merge: true });
                toast({ title: 'Template Updated' });
            } else {
                await addDoc(collection(db, "taskTemplates"), finalData);
                toast({ title: 'Template Created' });
            }
            fetchTemplates();
            setIsFormOpen(false);
        } catch (error) {
            console.error("Error saving template:", error);
            toast({ title: 'Error', description: 'Could not save the template.', variant: 'destructive'});
        }
    };

    return (
        <div className="space-y-8">
            <div className="flex items-center justify-between">
                <h1 className="text-3xl font-bold tracking-tight">Task Automation Templates</h1>
                <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
                    <DialogTrigger asChild>
                        <Button onClick={handleAdd}><PlusCircle className="mr-2 h-4 w-4" /> Create Template</Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-2xl">
                         <DialogHeader>
                            <DialogTitle>{selectedTemplate ? 'Edit Template' : 'Create New Template'}</DialogTitle>
                            <DialogDescription>
                                This template will be used to automatically generate tasks for new clients based on their automation settings.
                            </DialogDescription>
                        </DialogHeader>
                        <TemplateForm template={selectedTemplate} onSubmit={handleFormSubmit} onCancel={() => setIsFormOpen(false)} />
                    </DialogContent>
                </Dialog>
            </div>
            <Card>
                <CardHeader>
                    <CardTitle>Default Task Templates</CardTitle>
                    <CardDescription>These are the tasks that can be automatically created when a new client is set up.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Title</TableHead>
                                <TableHead>Department</TableHead>
                                <TableHead>Recurrence</TableHead>
                                <TableHead>Due</TableHead>
                                <TableHead>Automation Trigger</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow><TableCell colSpan={6} className="text-center">Loading...</TableCell></TableRow>
                            ) : (
                                templates.map(template => (
                                    <TableRow key={template.id}>
                                        <TableCell className="font-medium">{template.title}</TableCell>
                                        <TableCell>{template.department}</TableCell>
                                        <TableCell>{template.recurrence}</TableCell>
                                        <TableCell>{`Month ${template.dueMonthOffset}, Day ${template.dueDay}`}</TableCell>
                                        <TableCell>
                                            <span className="font-mono text-xs p-1 bg-muted rounded-md">{template.triggerField} {template.vatCategory && `(Cat ${template.vatCategory})`}</span>
                                        </TableCell>
                                        <TableCell className="text-right">
                                             <AlertDialog>
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild><Button variant="ghost" className="h-8 w-8 p-0"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end">
                                                        <DropdownMenuItem onClick={() => handleEdit(template)}>Edit</DropdownMenuItem>
                                                        <AlertDialogTrigger asChild><DropdownMenuItem className="text-destructive">Delete</DropdownMenuItem></AlertDialogTrigger>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                                <AlertDialogContent>
                                                    <AlertDialogHeader>
                                                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                                        <AlertDialogDescription>This will permanently delete the task template: "{template.title}".</AlertDialogDescription>
                                                    </AlertDialogHeader>
                                                    <AlertDialogFooter>
                                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                        <AlertDialogAction onClick={() => handleDelete(template.id)}>Delete</AlertDialogAction>
                                                    </AlertDialogFooter>
                                                </AlertDialogContent>
                                            </AlertDialog>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    )
}
