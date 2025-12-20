
'use client';
import { useState, useEffect } from 'react';
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
import { getFirestore, collection, addDoc, getDocs, doc, setDoc, deleteDoc, writeBatch, Timestamp, query, orderBy, where } from 'firebase/firestore';
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
import { chartOfAccounts as initialChartOfAccounts } from '@/lib/chart-of-accounts';
import { allocationRules as initialAllocationRules } from '@/lib/allocation-rules';

const db = getFirestore(firebaseApp);

type Client = User & { status: 'Active' | 'Inactive'; cellNumber?: string; contactPerson?: string; };

const clientStatuses: ('Active' | 'Inactive')[] = ['Active', 'Inactive'];
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
  contactPerson: z.string().min(2, 'Contact person name is required.'),
  email: z.string().email('Invalid email address.'),
  cellNumber: z.string().optional(),
  status: z.enum(clientStatuses).optional(),
  
  yearEnd: z.string().optional(),
  preparesFinancials: z.boolean().default(false),
  financialsDueDate: z.string().optional(),

  requiresManagementAccounts: z.boolean().default(false),
  managementAccountsFrequency: z.enum(managementAccountFrequencies).optional(),

  isVatRegistered: z.boolean().default(false),
  vatNumber: z.string().optional(),
  vatCategory: z.enum(['A', 'B', 'C']).optional(),
  
  preparesPayroll: z.boolean().default(false),
  payrollDueDate: z.string().optional(),
  submitsEmp201: z.boolean().default(false),
  submitsEmp501: z.boolean().default(false),

  createAIProfile: z.boolean().default(false),
});

function ClientForm({ client, onSubmit, onCancel }: { client: Client | null, onSubmit: (data: any) => void, onCancel: () => void }) {
    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            id: client?.id || '',
            name: client?.name || '',
            contactPerson: client?.contactPerson || '',
            email: client?.email || '',
            cellNumber: client?.cellNumber || '',
            status: client?.status || 'Active',
            yearEnd: client?.yearEnd || undefined,
            preparesFinancials: client?.preparesFinancials || false,
            financialsDueDate: client?.financialsDueDate || undefined,
            requiresManagementAccounts: client?.requiresManagementAccounts || false,
            managementAccountsFrequency: client?.managementAccountsFrequency || undefined,
            isVatRegistered: client?.isVatRegistered || false,
            vatNumber: client?.vatNumber || '',
            vatCategory: client?.vatCategory || undefined,
            preparesPayroll: client?.preparesPayroll || false,
            payrollDueDate: client?.payrollDueDate || undefined,
            submitsEmp201: client?.submitsEmp201 || false,
            submitsEmp501: client?.submitsEmp501 || false,
            createAIProfile: client?.hasNumeraProfile || false,
        },
    });

    const isVatRegistered = form.watch('isVatRegistered');
    const preparesFinancials = form.watch('preparesFinancials');
    const requiresManagementAccounts = form.watch('requiresManagementAccounts');
    const preparesPayroll = form.watch('preparesPayroll');

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 max-h-[70vh] overflow-y-auto p-1 pr-4">
                <div className="space-y-4">
                    <h3 className="text-lg font-medium">Client Details</h3>
                    <FormField control={form.control} name="name" render={({ field }) => ( <FormItem><FormLabel>Client / Company Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="contactPerson" render={({ field }) => ( <FormItem><FormLabel>Contact Person Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="email" render={({ field }) => ( <FormItem><FormLabel>Email Address</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="cellNumber" render={({ field }) => ( <FormItem><FormLabel>Cell Number</FormLabel><FormControl><Input placeholder="e.g. 0821234567" {...field} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="status" render={({ field }) => ( <FormItem><FormLabel>Status</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select a status" /></SelectTrigger></FormControl><SelectContent>{clientStatuses.map(status => <SelectItem key={status} value={status}>{status}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                </div>
                 <Separator />
                <div className="space-y-4">
                     <h3 className="text-lg font-medium">Automation Settings</h3>
                     <FormField control={form.control} name="createAIProfile" render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                            <div className="space-y-0.5"><FormLabel>Create AI Accountant Profile?</FormLabel><FormDescription>This will give the client access to the AI Accountant module.</FormDescription></div>
                            <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                        </FormItem>
                     )}/>
                    <FormField control={form.control} name="yearEnd" render={({ field }) => ( <FormItem><FormLabel>Financial Year End</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select a month" /></SelectTrigger></FormControl><SelectContent>{months.map(month => <SelectItem key={month} value={month}>{month}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="preparesFinancials" render={({ field }) => ( <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm"><div className="space-y-0.5"><FormLabel>Prepare Annual Financials?</FormLabel></div><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem> )}/>
                    {preparesFinancials && (
                        <FormField control={form.control} name="financialsDueDate" render={({ field }) => ( <FormItem><FormLabel>Due Date (Day of Month)</FormLabel><FormControl><Input type="number" min="1" max="31" {...field} /></FormControl><FormMessage /></FormItem>)} />
                    )}
                     <FormField control={form.control} name="requiresManagementAccounts" render={({ field }) => ( <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm"><div className="space-y-0.5"><FormLabel>Prepare Management Accounts?</FormLabel></div><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem> )}/>
                     {requiresManagementAccounts && (
                        <FormField control={form.control} name="managementAccountsFrequency" render={({ field }) => ( <FormItem><FormLabel>Frequency</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select frequency" /></SelectTrigger></FormControl><SelectContent>{managementAccountFrequencies.map(freq => <SelectItem key={freq} value={freq}>{freq}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                     )}
                     <FormField control={form.control} name="isVatRegistered" render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                            <div className="space-y-0.5"><FormLabel>Is the client registered for VAT?</FormLabel></div>
                            <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                        </FormItem>
                    )} />

                    {isVatRegistered && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                             <FormField control={form.control} name="vatNumber" render={({ field }) => ( <FormItem><FormLabel>VAT Number</FormLabel><FormControl><Input placeholder="4..." {...field} /></FormControl><FormMessage /></FormItem>)} />
                             <FormField control={form.control} name="vatCategory" render={({ field }) => ( <FormItem><FormLabel>VAT Category</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger></FormControl><SelectContent>{vatCategories.map(cat => <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                        </div>
                    )}

                    <FormField control={form.control} name="preparesPayroll" render={({ field }) => ( <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm"><div className="space-y-0.5"><FormLabel>Prepare Payroll?</FormLabel></div><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem> )}/>
                    {preparesPayroll && (
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                            <FormField control={form.control} name="payrollDueDate" render={({ field }) => ( <FormItem><FormLabel>Payroll Due Date (Day of Month)</FormLabel><FormControl><Input type="number" min="1" max="31" {...field} /></FormControl><FormMessage /></FormItem>)} />
                            <div className="space-y-2 pt-6">
                                <FormField control={form.control} name="submitsEmp201" render={({ field }) => ( <FormItem className="flex flex-row items-center space-x-3 space-y-0"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl><FormLabel>Submit EMP201</FormLabel></FormItem> )}/>
                                <FormField control={form.control} name="submitsEmp501" render={({ field }) => ( <FormItem className="flex flex-row items-center space-x-3 space-y-0"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl><FormLabel>Submit EMP501</FormLabel></FormItem> )}/>
                            </div>
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
  const [allStaff, setAllStaff] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const { toast } = useToast();
  const { user: currentUser } = useAuth();
  
  const fetchClientsAndStaff = async () => {
    setIsLoading(true);
    try {
        const staffQuery = query(collection(db, "users"));
        const staffSnapshot = await getDocs(staffQuery);
        const fetchedStaff = staffSnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as User));
        setAllStaff(fetchedStaff);

        const clientsQuery = query(collection(db, "clients"), orderBy("name"));
        const clientsSnapshot = await getDocs(clientsQuery);
        const fetchedClients = clientsSnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Client));
        setClients(fetchedClients);
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

  const handleFormSubmit = async (data: any) => {
    if (!currentUser) return;
    
    const { createAIProfile, ...clientFormData } = data;

    const clientData: Partial<Client> = {
        ...clientFormData,
        financialsDueDate: data.preparesFinancials ? data.financialsDueDate : null,
        managementAccountsFrequency: data.requiresManagementAccounts ? data.managementAccountsFrequency : null,
        vatCategory: data.isVatRegistered ? data.vatCategory : null,
        payrollDueDate: data.preparesPayroll ? data.payrollDueDate : null,
        role: 'client',
    };
    
    if (createAIProfile) {
        clientData.hasNumeraProfile = true;
        clientData.source = 'AI Accountant';
        clientData.chartOfAccounts = initialChartOfAccounts;
        clientData.allocationRules = initialAllocationRules;
    } else {
        clientData.source = 'Client Management';
    }

    try {
        let clientToProcess: Client;

        if (selectedClient?.id) {
            await setDoc(doc(db, "clients", selectedClient.id), clientData, { merge: true });
            toast({ title: 'Client Updated'});
            clientToProcess = { ...selectedClient, ...clientData };
        } else {
            const newDocRef = await addDoc(collection(db, "clients"), clientData);
            toast({ title: 'Client Created' });
            clientToProcess = { ...clientData, id: newDocRef.id } as Client;
        }

        if (createAIProfile) {
            const aiClientRef = doc(db, 'aiAccountantClients', clientToProcess.id);
            const aiClientSnap = await getDoc(aiClientRef);
            if (!aiClientSnap.exists()) {
                await setDoc(aiClientRef, {
                    ...clientData,
                    id: clientToProcess.id,
                    uid: clientToProcess.id,
                    createdAt: Timestamp.now(),
                    createdBy: currentUser.uid,
                    sharedWith: [],
                });
            }
        }

        fetchClientsAndStaff();
        setIsFormOpen(false);
        setSelectedClient(null);
    } catch (error) {
        console.error("Error saving client:", error);
        toast({ title: 'Error', description: 'Could not save the client.', variant: 'destructive'});
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
        <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
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
                <TableHead>Email</TableHead>
                <TableHead>Cell Number</TableHead>
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
                        {client.contactPerson && <p className="text-xs text-muted-foreground">{client.contactPerson}</p>}
                    </div>
                  </TableCell>
                  <TableCell>{client.email}</TableCell>
                  <TableCell>{client.cellNumber}</TableCell>
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
