
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
import { User, Task } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { getFirestore, collection, addDoc, getDocs, doc, setDoc, deleteDoc, writeBatch, Timestamp, query, orderBy, where, updateDoc } from 'firebase/firestore';
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
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';

const db = getFirestore(firebaseApp);

type Client = User & { status: 'Active' | 'Inactive' | 'Archived'; };

const clientStatuses: ('Active' | 'Inactive' | 'Archived')[] = ['Active', 'Inactive', 'Archived'];
const months = [ "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December" ];
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
  // Automation settings
  isVatRegistered: z.boolean().default(false),
  vatCategory: z.enum(['A', 'B', 'C']).optional(),
  submitsEmp201: z.boolean().default(false),
  submitsEmp501: z.boolean().default(false),
  submitsProvisionalTax: z.boolean().default(false),
  submitsIncomeTax: z.boolean().default(false),
  preparesFinancials: z.boolean().default(false),
  submitsAnnualReturns: z.boolean().default(false),
  submitsBeneficialOwnership: z.boolean().default(false),
  requiresManagementAccounts: z.boolean().default(false),
  managementAccountsFrequency: z.enum(['Monthly', 'Quarterly', 'Bi-Annually', 'Annually']).optional(),
});

function ClientForm({ client, onSubmit, onCancel, taskTemplates }: { client: Partial<User> | null, onSubmit: (data: any, originalClient: Partial<User> | null) => void, onCancel: () => void, taskTemplates: Task[] }) {
    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            id: client?.id || '',
            name: client?.name || '',
            status: client?.status || 'Active',
            yearEnd: client?.yearEnd || 'February',
            isVatRegistered: client?.isVatRegistered || false,
            vatCategory: client?.vatCategory || undefined,
            submitsEmp201: client?.submitsEmp201 || false,
            submitsEmp501: client?.submitsEmp501 || false,
            submitsProvisionalTax: client?.submitsProvisionalTax || false,
            submitsIncomeTax: client?.submitsIncomeTax || false,
            preparesFinancials: client?.preparesFinancials || false,
            submitsAnnualReturns: client?.submitsAnnualReturns || false,
            submitsBeneficialOwnership: client?.submitsBeneficialOwnership || false,
            requiresManagementAccounts: client?.requiresManagementAccounts || false,
            managementAccountsFrequency: client?.managementAccountsFrequency || undefined,
        },
    });

    const isVatRegistered = form.watch('isVatRegistered');
    const requiresManagementAccounts = form.watch('requiresManagementAccounts');

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(data => onSubmit(data, client))} className="space-y-6 max-h-[70vh] overflow-y-auto p-1 pr-4">
                <div className="space-y-4">
                    <FormField control={form.control} name="name" render={({ field }) => ( <FormItem><FormLabel>Client / Company Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="status" render={({ field }) => ( <FormItem><FormLabel>Status</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select a status" /></SelectTrigger></FormControl><SelectContent>{clientStatuses.map(status => <SelectItem key={status} value={status}>{status}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="yearEnd" render={({ field }) => ( <FormItem><FormLabel>Financial Year End</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select a month" /></SelectTrigger></FormControl><SelectContent>{months.map(month => <SelectItem key={month} value={month}>{month}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                </div>
                
                <Separator />
                
                <div>
                  <h3 className="text-lg font-medium">Automation Settings</h3>
                  <p className="text-sm text-muted-foreground">Select the services this client requires to automate task creation.</p>
                </div>
                
                <div className="space-y-4 rounded-lg border p-4">
                    <FormField
                        control={form.control}
                        name="isVatRegistered"
                        render={({ field }) => (
                            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                                <div className="space-y-0.5"><FormLabel>VAT Submissions</FormLabel></div>
                                <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                            </FormItem>
                        )}
                    />
                     {isVatRegistered && (
                        <div className="pl-4">
                            <FormField control={form.control} name="vatCategory" render={({ field }) => ( <FormItem><FormLabel>VAT Category</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger></FormControl><SelectContent>{vatCategories.map(cat => <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                         </div>
                    )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField control={form.control} name="submitsEmp201" render={({ field }) => ( <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm"><div className="space-y-0.5"><FormLabel>EMP201 (PAYE)</FormLabel></div><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem>)} />
                    <FormField control={form.control} name="submitsEmp501" render={({ field }) => ( <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm"><div className="space-y-0.5"><FormLabel>EMP501</FormLabel></div><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem>)} />
                    <FormField control={form.control} name="submitsProvisionalTax" render={({ field }) => ( <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm"><div className="space-y-0.5"><FormLabel>Provisional Tax</FormLabel></div><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem>)} />
                    <FormField control={form.control} name="submitsIncomeTax" render={({ field }) => ( <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm"><div className="space-y-0.5"><FormLabel>Income Tax (ITR14)</FormLabel></div><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem>)} />
                    <FormField control={form.control} name="preparesFinancials" render={({ field }) => ( <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm"><div className="space-y-0.5"><FormLabel>Annual Financials</FormLabel></div><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem>)} />
                    <FormField control={form.control} name="submitsAnnualReturns" render={({ field }) => ( <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm"><div className="space-y-0.5"><FormLabel>CIPC Annual Returns</FormLabel></div><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem>)} />
                    <FormField control={form.control} name="submitsBeneficialOwnership" render={({ field }) => ( <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm"><div className="space-y-0.5"><FormLabel>Beneficial Ownership</FormLabel></div><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem>)} />
                </div>
                 <div className="space-y-4 rounded-lg border p-4">
                     <FormField control={form.control} name="requiresManagementAccounts" render={({ field }) => ( <FormItem className="flex flex-row items-center justify-between"><div className="space-y-0.5"><FormLabel>Management Accounts</FormLabel></div><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem>)} />
                    {requiresManagementAccounts && (
                        <div className="pl-4">
                           <FormField control={form.control} name="managementAccountsFrequency" render={({ field }) => ( <FormItem><FormLabel>Frequency</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select frequency" /></SelectTrigger></FormControl><SelectContent>{['Monthly', 'Quarterly', 'Bi-Annually', 'Annually'].map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                        </div>
                    )}
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
  const [taskTemplates, setTaskTemplates] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Partial<User> | null>(null);
  const { toast } = useToast();
  const { user: currentUser } = useAuth();
  
  const fetchClientsAndStaff = async () => {
    setIsLoading(true);
    try {
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

  const handleFormSubmit = async (data: any, originalClient: Partial<User> | null) => {
    if (!currentUser) return;
    
    let clientDataForDb: Partial<User> = {
      name: data.name,
      status: data.status,
      yearEnd: data.yearEnd,
      isVatRegistered: data.isVatRegistered,
      vatCategory: data.isVatRegistered ? data.vatCategory : undefined,
      submitsEmp201: data.submitsEmp201,
      submitsEmp501: data.submitsEmp501,
      submitsProvisionalTax: data.submitsProvisionalTax,
      submitsIncomeTax: data.submitsIncomeTax,
      preparesFinancials: data.preparesFinancials,
      submitsAnnualReturns: data.submitsAnnualReturns,
      submitsBeneficialOwnership: data.submitsBeneficialOwnership,
      requiresManagementAccounts: data.requiresManagementAccounts,
      managementAccountsFrequency: data.requiresManagementAccounts ? data.managementAccountsFrequency : undefined,
    };
    
    try {
        let clientId: string;
        if (originalClient?.id) { 
            clientId = originalClient.id;
            const clientRef = doc(db, "clients", clientId);
            await updateDoc(clientRef, clientDataForDb);
            toast({ title: 'Client Updated' });
        } else { // Creating new client
            clientId = doc(collection(db, "clients")).id;
            const newDocRef = doc(db, "clients", clientId);
            await setDoc(newDocRef, { ...clientDataForDb, role: 'client', source: 'Client Management', createdAt: serverTimestamp() });
            toast({ title: 'Client Created' });
        }
        
        // Task Sync Logic
        const batch = writeBatch(db);
        const existingTasksQuery = query(collection(db, 'tasks'), where('clientId', '==', clientId));
        const existingTasksSnapshot = await getDocs(existingTasksQuery);
        const existingTasks = existingTasksSnapshot.docs.map(d => ({id: d.id, ...d.data()}));
        
        for (const template of taskTemplates) {
            const isApplicableNow = !!clientDataForDb[template.triggerField as keyof typeof clientDataForDb];
            const wasApplicable = originalClient ? !!originalClient[template.triggerField as keyof typeof originalClient] : false;
            
            const existingTask = existingTasks.find(t => t.title === template.title.replace('{clientName}', clientDataForDb.name!));

            if (isApplicableNow && !existingTask) {
                // Create new task
                const newTaskRef = doc(collection(db, 'tasks'));
                batch.set(newTaskRef, {
                    ...template,
                    clientId: clientId,
                    title: template.title.replace('{clientName}', clientDataForDb.name!),
                    status: 'To-Do',
                    assignedTo: [], // Assign later or based on dept
                    createdAt: serverTimestamp(),
                });
            } else if (!isApplicableNow && wasApplicable && existingTask) {
                // Delete task
                const taskRef = doc(db, 'tasks', existingTask.id);
                batch.delete(taskRef);
            }
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
                    taskTemplates={taskTemplates}
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
