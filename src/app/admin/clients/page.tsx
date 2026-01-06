
'use client';
import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { MoreHorizontal, PlusCircle, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { User, Task, Service } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { getFirestore, collection, addDoc, getDocs, doc, setDoc, deleteDoc, writeBatch, Timestamp, query, orderBy, where, serverTimestamp } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { format } from 'date-fns';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';

const db = getFirestore(firebaseApp);

type Client = User & { status: 'Active' | 'Inactive'; cellNumber?: string; contactPerson?: string; };

const clientStatuses: ('Active' | 'Inactive' | 'Archived')[] = ['Active', 'Inactive', 'Archived'];
const months = [ "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December" ];
const managementAccountFrequencies: ('Monthly' | 'Quarterly' | 'Bi-Annually' | 'Annually')[] = ['Monthly', 'Quarterly', 'Bi-Annually', 'Annually'];
const vatCategories: { value: 'A' | 'B' | 'C'; label: string }[] = [
    { value: 'A', label: 'Category A (Odd Months)' },
    { value: 'B', label: 'Category B (Even Months)' },
    { value: 'C', label: 'Category C (Monthly)' },
];

const formSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(2, 'Client/Company name is required.'),
  status: z.enum(clientStatuses).optional(),
  
  yearEnd: z.string().min(1, 'Financial Year End is required.'),
  preparesFinancials: z.boolean().default(false),
  financialsDueDate: z.string().optional(),

  requiresManagementAccounts: z.boolean().default(false),
  managementAccountsFrequency: z.enum(managementAccountFrequencies).optional(),

  isVatRegistered: z.boolean().default(false),
  vatCategory: z.enum(['A', 'B', 'C']).optional(),
  
  preparesPayroll: z.boolean().default(false),
  payrollDueDate: z.string().optional(),
  submitsEmp201: z.boolean().default(false),
  submitsEmp501: z.boolean().default(false),

  submitsProvisionalTax: z.boolean().default(false),
  submitsIncomeTax: z.boolean().default(false),
  
  submitsAnnualReturns: z.boolean().default(false),
  submitsBeneficialOwnership: z.boolean().default(false),
});

function ClientForm({ client, onSubmit, onCancel }: { client: Client | null, onSubmit: (data: any, originalClient: Client | null) => void, onCancel: () => void }) {
    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            id: client?.id || '',
            name: client?.name || '',
            status: client?.status || 'Active',
            yearEnd: client?.yearEnd || undefined,
            preparesFinancials: client?.preparesFinancials || false,
            financialsDueDate: client?.financialsDueDate || undefined,
            requiresManagementAccounts: client?.requiresManagementAccounts || false,
            managementAccountsFrequency: client?.managementAccountsFrequency || undefined,
            isVatRegistered: client?.isVatRegistered || false,
            vatCategory: client?.vatCategory || undefined,
            preparesPayroll: client?.preparesPayroll || false,
            payrollDueDate: client?.payrollDueDate || undefined,
            submitsEmp201: client?.submitsEmp201 || false,
            submitsEmp501: client?.submitsEmp501 || false,
            submitsProvisionalTax: client?.submitsProvisionalTax || false,
            submitsIncomeTax: client?.submitsIncomeTax || false,
            submitsAnnualReturns: client?.submitsAnnualReturns || false,
            submitsBeneficialOwnership: client?.submitsBeneficialOwnership || false,
        },
    });

    const isVatRegistered = form.watch('isVatRegistered');
    const preparesFinancials = form.watch('preparesFinancials');
    const requiresManagementAccounts = form.watch('requiresManagementAccounts');
    const preparesPayroll = form.watch('preparesPayroll');

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(data => onSubmit(data, client))} className="space-y-6 max-h-[70vh] overflow-y-auto p-1 pr-4">
                <div className="space-y-4">
                    <h3 className="text-lg font-medium">Client Details</h3>
                    <FormField control={form.control} name="name" render={({ field }) => ( <FormItem><FormLabel>Client / Company Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="status" render={({ field }) => ( <FormItem><FormLabel>Status</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select a status" /></SelectTrigger></FormControl><SelectContent>{clientStatuses.map(status => <SelectItem key={status} value={status}>{status}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                </div>
                 <Separator />
                
                <div className="space-y-4 rounded-md border p-4">
                    <h3 className="text-lg font-medium">Accounting and Tax</h3>
                    <FormField control={form.control} name="yearEnd" render={({ field }) => ( <FormItem><FormLabel>Financial Year End</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select a month" /></SelectTrigger></FormControl><SelectContent>{months.map(month => <SelectItem key={month} value={month}>{month}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="preparesFinancials" render={({ field }) => ( <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm"><div className="space-y-0.5"><FormLabel>Prepare Annual Financials?</FormLabel></div><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem> )}/>
                    <FormField control={form.control} name="requiresManagementAccounts" render={({ field }) => ( <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm"><div className="space-y-0.5"><FormLabel>Prepare Management Accounts?</FormLabel></div><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem> )}/>
                    {requiresManagementAccounts && (
                       <FormField control={form.control} name="managementAccountsFrequency" render={({ field }) => ( <FormItem><FormLabel>Frequency</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select frequency" /></SelectTrigger></FormControl><SelectContent>{managementAccountFrequencies.map(freq => <SelectItem key={freq} value={freq}>{freq}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                    )}
                    <FormField control={form.control} name="isVatRegistered" render={({ field }) => ( <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm"><div className="space-y-0.5"><FormLabel>Submit VAT201 Returns?</FormLabel></div><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem> )}/>
                   {isVatRegistered && (
                       <div className="pl-4">
                            <FormField control={form.control} name="vatCategory" render={({ field }) => ( <FormItem><FormLabel>VAT Category</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger></FormControl><SelectContent>{vatCategories.map(cat => <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                       </div>
                   )}
                   <FormField control={form.control} name="submitsProvisionalTax" render={({ field }) => ( <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm"><div className="space-y-0.5"><FormLabel>Submit Provisional Tax?</FormLabel></div><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem> )}/>
                   <FormField control={form.control} name="submitsIncomeTax" render={({ field }) => ( <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm"><div className="space-y-0.5"><FormLabel>Submit Income Tax Return (ITR14)?</FormLabel></div><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem> )}/>
                </div>
                
                <div className="space-y-4 rounded-md border p-4">
                     <h3 className="text-lg font-medium">Payroll</h3>
                    <FormField control={form.control} name="preparesPayroll" render={({ field }) => ( <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm"><div className="space-y-0.5"><FormLabel>Prepare Payroll?</FormLabel></div><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem> )}/>
                    {preparesPayroll && (
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center pl-4">
                            <FormField control={form.control} name="payrollDueDate" render={({ field }) => ( <FormItem><FormLabel>Payroll Due Date (Day of Month)</FormLabel><FormControl><Input type="number" min="1" max="31" {...field} /></FormControl><FormMessage /></FormItem>)} />
                            <div className="space-y-2 pt-6">
                                <FormField control={form.control} name="submitsEmp201" render={({ field }) => ( <FormItem className="flex flex-row items-center space-x-3 space-y-0"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl><FormLabel>Submit EMP201</FormLabel></FormItem> )}/>
                                <FormField control={form.control} name="submitsEmp501" render={({ field }) => ( <FormItem className="flex flex-row items-center space-x-3 space-y-0"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl><FormLabel>Submit EMP501</FormLabel></FormItem> )}/>
                            </div>
                        </div>
                    )}
                </div>

                <div className="space-y-4 rounded-md border p-4">
                    <h3 className="text-lg font-medium">Compliance</h3>
                    <FormField control={form.control} name="submitsAnnualReturns" render={({ field }) => ( <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm"><div className="space-y-0.5"><FormLabel>Submit CIPC Annual Returns?</FormLabel></div><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem> )}/>
                    <FormField control={form.control} name="submitsBeneficialOwnership" render={({ field }) => ( <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm"><div className="space-y-0.5"><FormLabel>Submit Beneficial Ownership?</FormLabel></div><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem> )}/>
               </div>

                <div className="flex justify-end gap-2 pt-4">
                    <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>
                    <Button type="submit">Save Client</Button>
                </div>
            </form>
        </Form>
    )
}


export default function AdminClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [allStaff, setAllStaff] = useState<User[]>([]);
  const [taskTemplates, setTaskTemplates] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const { toast } = useToast();
  const { user: currentUser } = useAuth();
  
  const fetchClientsAndStaff = async () => {
    setIsLoading(true);
    try {
        const staffQuery = query(collection(db, "users"), where('role', 'in', ['staff', 'admin']));
        const staffSnapshot = await getDocs(staffQuery);
        const fetchedStaff = staffSnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as User));
        setAllStaff(fetchedStaff);

        const clientsQuery = query(collection(db, "clients"), orderBy("name"));
        const clientsSnapshot = await getDocs(clientsQuery);
        const fetchedClients = clientsSnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Client));
        setClients(fetchedClients);
        
        const templatesQuery = query(collection(db, "taskTemplates"));
        const templatesSnapshot = await getDocs(templatesQuery);
        const fetchedTemplates = templatesSnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Task));
        setTaskTemplates(fetchedTemplates);

    } catch (error) {
        console.error("Error fetching data:", error);
        toast({ title: 'Error', description: 'Could not fetch data from the database.', variant: 'destructive'});
    } finally {
        setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchClientsAndStaff();
  }, []);

  const handleAdd = () => {
    setSelectedClient(null);
    setIsFormOpen(true);
  };

  const handleEdit = (client: Client) => {
    setSelectedClient(client);
    setIsFormOpen(true);
  };
  
  const handleDelete = async (clientId: string) => {
    try {
        const batch = writeBatch(db);

        const clientRef = doc(db, "clients", clientId);
        batch.delete(clientRef);
        
        const tasksQuery = query(collection(db, 'tasks'), where('clientId', '==', clientId));
        const tasksSnapshot = await getDocs(tasksQuery);
        tasksSnapshot.docs.forEach(taskDoc => {
            batch.delete(taskDoc.ref);
        });

        await batch.commit();
        
        fetchClientsAndStaff();
        toast({
            title: 'Client Deleted',
            description: `The client and their ${tasksSnapshot.size} associated tasks have been removed.`,
            variant: 'destructive',
        });
    } catch (error) {
        console.error("Error deleting client:", error);
        toast({ title: 'Error', description: 'Could not delete client and their tasks.', variant: 'destructive' });
    }
  };

  const handleFormSubmit = async (data: any, originalClient: Client | null) => {
    if (!currentUser) return;

    let clientDataForDb: Partial<User>;

    // Common data preparation
    clientDataForDb = {
        name: data.name,
        status: data.status,
        yearEnd: data.yearEnd,
        preparesFinancials: data.preparesFinancials,
        requiresManagementAccounts: data.requiresManagementAccounts,
        isVatRegistered: data.isVatRegistered,
        preparesPayroll: data.preparesPayroll,
        submitsEmp201: data.submitsEmp201,
        submitsEmp501: data.submitsEmp501,
        submitsProvisionalTax: data.submitsProvisionalTax,
        submitsIncomeTax: data.submitsIncomeTax,
        submitsAnnualReturns: data.submitsAnnualReturns,
        submitsBeneficialOwnership: data.submitsBeneficialOwnership,
    };
    
    // Auto-calculate financialsDueDate if financials are prepared
    if (data.preparesFinancials) {
        const yearEndMonthIndex = months.indexOf(data.yearEnd);
        // Financials are due 3 months after year-end.
        // We set the date to the last day of that month.
        const dueDate = new Date(new Date().getFullYear(), yearEndMonthIndex + 4, 0); 
        clientDataForDb.financialsDueDate = dueDate;
    } else {
        clientDataForDb.financialsDueDate = null;
    }

    clientDataForDb.managementAccountsFrequency = data.requiresManagementAccounts ? data.managementAccountsFrequency : null;
    clientDataForDb.payrollDueDate = data.preparesPayroll ? data.payrollDueDate : null;
    clientDataForDb.vatCategory = data.isVatRegistered ? data.vatCategory : null;
    
    // This is a temporary fix. In a real app, you would have a more robust way of handling user creation or linking
    if (!originalClient) {
        clientDataForDb.email = `client-${Date.now()}@my-company.com`;
    }
    
    try {
        const batch = writeBatch(db);
        const clientIdForTasks = originalClient?.id || doc(collection(db, "clients")).id;

        if (originalClient) { // Editing existing client
            const clientRef = doc(db, "clients", clientIdForTasks);
            batch.update(clientRef, clientDataForDb);
            
            const existingTasksQuery = query(collection(db, 'tasks'), where('clientId', '==', clientIdForTasks));
            const existingTasksSnapshot = await getDocs(existingTasksQuery);
            const existingTasks = existingTasksSnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Task));

            const automationFlags: (keyof User)[] = [
                'preparesFinancials', 'requiresManagementAccounts', 'submitsEmp201', 'submitsEmp501', 
                'submitsProvisionalTax', 'submitsIncomeTax', 'isVatRegistered',
                'submitsAnnualReturns', 'submitsBeneficialOwnership'
            ];
            
            for (const flag of automationFlags) {
                const wasEnabled = !!originalClient[flag];
                const isNowEnabled = !!data[flag];
                
                if (isNowEnabled && !wasEnabled) {
                    const templatesToCreate = taskTemplates.filter(t => t.triggerField === flag);
                    templatesToCreate.forEach(template => {
                         if (flag === 'isVatRegistered' && template.vatCategory && template.vatCategory !== data.vatCategory) return;
                        if (!existingTasks.some(t => t.title.includes(template.title.replace('{clientName}', '')))) {
                           createTaskFromTemplate(batch, template, data, clientIdForTasks, currentUser.uid);
                        }
                    });
                } else if (!isNowEnabled && wasEnabled) {
                     const templatesToDelete = taskTemplates.filter(t => t.triggerField === flag);
                    templatesToDelete.forEach(template => {
                         if (flag === 'isVatRegistered' && template.vatCategory && originalClient && template.vatCategory !== originalClient.vatCategory) return;
                         const taskToDelete = existingTasks.find(t => t.title.includes(template.title.replace('{clientName}', '')) && t.status !== 'Done');
                         if (taskToDelete) batch.delete(doc(db, 'tasks', taskToDelete.id));
                    });
                } else if (flag === 'isVatRegistered' && isNowEnabled && wasEnabled && originalClient?.vatCategory !== data.vatCategory) {
                    // Delete old VAT tasks
                    const oldVatTemplates = taskTemplates.filter(t => t.triggerField === 'isVatRegistered' && t.vatCategory === originalClient?.vatCategory);
                    oldVatTemplates.forEach(template => {
                        const taskToDelete = existingTasks.find(t => t.title.includes(template.title.replace('{clientName}', '')) && t.status !== 'Done');
                        if (taskToDelete) batch.delete(doc(db, 'tasks', taskToDelete.id));
                    });
                    // Create new VAT tasks
                    const newVatTemplates = taskTemplates.filter(t => t.triggerField === 'isVatRegistered' && t.vatCategory === data.vatCategory);
                    newVatTemplates.forEach(template => {
                         if (!existingTasks.some(t => t.title.includes(template.title.replace('{clientName}', '')))) {
                           createTaskFromTemplate(batch, template, data, clientIdForTasks, currentUser.uid);
                        }
                    });
                }
            }
             toast({ title: 'Client Updated', description: 'Automation settings and tasks have been synchronized.' });

        } else { // Creating new client
             const newDocRef = doc(db, "clients", clientIdForTasks);
             clientDataForDb = { ...clientDataForDb, role: 'client', source: 'Client Management', createdAt: serverTimestamp() };
             batch.set(newDocRef, clientDataForDb);

             const automationFlags: (keyof User)[] = [
                'preparesFinancials', 'requiresManagementAccounts', 'submitsEmp201', 'submitsEmp501', 
                'submitsProvisionalTax', 'submitsIncomeTax', 'isVatRegistered',
                'submitsAnnualReturns', 'submitsBeneficialOwnership'
             ];

             automationFlags.forEach(flag => {
                if(data[flag]) {
                    const templatesToCreate = taskTemplates.filter(t => t.triggerField === flag);
                    templatesToCreate.forEach(template => {
                        if (flag === 'isVatRegistered' && template.vatCategory && template.vatCategory !== data.vatCategory) return;
                        createTaskFromTemplate(batch, template, data, clientIdForTasks, currentUser.uid);
                    });
                }
             });
             toast({ title: 'Client Created', description: 'Automated tasks have been generated based on your selections.' });
        }
        
        await batch.commit();
        
        fetchClientsAndStaff();
        setIsFormOpen(false);
        setSelectedClient(null);
    } catch (error) {
        console.error("Error saving client:", error);
        toast({ title: 'Error', description: 'Could not save the client or update tasks.', variant: 'destructive'});
    }
  };
  
  const createTaskFromTemplate = (batch: ReturnType<typeof writeBatch>, template: Task, clientData: any, clientId: string, currentUserId: string) => {
    const taskTitle = template.title.replace('{clientName}', clientData.name);
    
    const yearEndMonth = months.indexOf(clientData.yearEnd);
    let dueYear = new Date().getFullYear();
    let dueMonth = (yearEndMonth + template.dueMonthOffset);

    if (dueMonth > 11) {
        dueMonth = dueMonth % 12;
    } else if (dueMonth < 0) {
        dueMonth = 12 + dueMonth;
        dueYear--;
    }
    
    const dueDate = new Date(dueYear, dueMonth, template.dueDay);

    const newTask: Omit<Task, 'id'> = { 
        ...template,
        title: taskTitle, 
        description: template.description.replace('{clientName}', clientData.name), 
        clientId: clientId, 
        status: 'To-Do', 
        dueDate: Timestamp.fromDate(dueDate), 
        createdAt: Timestamp.now(), 
        createdBy: currentUserId,
        comments: [],
        assignedTo: []
    };
    batch.set(doc(collection(db, 'tasks')), newTask);
  };
  
    const formatYearEnd = (yearEnd: any): string => {
        if (!yearEnd) return 'N/A';
        if (typeof yearEnd === 'string') {
          return yearEnd;
        }
        if (yearEnd.toDate && typeof yearEnd.toDate === 'function') {
          const date = yearEnd.toDate();
          return format(date, 'MMMM');
        }
        try {
            const d = new Date(yearEnd);
            if (!isNaN(d.getTime())) {
                 return format(d, 'MMMM');
            }
        } catch (e) {
            // fall through
        }
        return 'Invalid Date';
    };


  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Manage Clients</h1>
        <Dialog open={isFormOpen} onOpenChange={(isOpen) => { setIsFormOpen(isOpen); if (!isOpen) setSelectedClient(null); }}>
           <DialogTrigger asChild>
                <Button onClick={handleAdd}>
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Create Client
                </Button>
           </DialogTrigger>
           <DialogContent className="sm:max-w-2xl">
                <DialogHeader>
                    <DialogTitle>{selectedClient ? 'Edit Client' : 'Create New Client'}</DialogTitle>
                    <DialogDescription>
                        {selectedClient ? 'Update the details for this client.' : 'Fill out the form to add a new client and automate their tasks.'}
                    </DialogDescription>
                </DialogHeader>
                <ClientForm 
                    client={selectedClient} 
                    onSubmit={handleFormSubmit}
                    onCancel={() => setIsFormOpen(false)}
                />
           </DialogContent>
        </Dialog>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>All Clients</CardTitle>
          <CardDescription>View, edit, and manage your monthly accounting clients.</CardDescription>
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
                <TableHead>Client</TableHead>
                <TableHead>Year End</TableHead>
                <TableHead>VAT Registered</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {clients.map(client => (
                <TableRow key={client.id}>
                  <TableCell className="font-medium">
                    <div>
                        <span>{client.name}</span>
                    </div>
                  </TableCell>
                   <TableCell>{formatYearEnd(client.yearEnd)}</TableCell>
                    <TableCell>
                      {client.isVatRegistered ? (
                          <Badge variant="success">Yes ({client.vatCategory})</Badge>
                      ) : (
                          <Badge variant="secondary">No</Badge>
                      )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={client.status === 'Active' ? 'default' : 'secondary'}>
                        {client.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
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
                            <DropdownMenuItem onClick={() => handleEdit(client)}>
                                Edit
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                             <AlertDialogTrigger asChild>
                                <DropdownMenuItem className="text-destructive">
                                    Delete
                                </DropdownMenuItem>
                            </AlertDialogTrigger>
                        </DropdownMenuContent>
                        </DropdownMenu>
                         <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                <AlertDialogDescription>
                                This action cannot be undone. This will permanently delete the client account for:
                                <span className="font-semibold"> {client.name}</span>. All associated tasks will also be deleted.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDelete(client.id)}>
                                    Continue
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
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

    