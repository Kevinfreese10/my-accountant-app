'use client';
import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { MoreHorizontal, PlusCircle, Loader2, CalendarIcon, CheckCircle2, RotateCw } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { User, Task } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { getFirestore, collection, addDoc, getDocs, doc, setDoc, deleteDoc, writeBatch, Timestamp, query, orderBy, where, updateDoc, serverTimestamp } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { format, addMonths, setDate, setHours, setMinutes, setSeconds, startOfMonth, startOfToday } from 'date-fns';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';

const db = getFirestore(firebaseApp);

const months = [ "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December" ];
const vatCategories = [
    { value: 'A', label: 'Category A (Odd Months)' },
    { value: 'B', label: 'Category B (Even Months)' },
    { value: 'C', label: 'Category C (Monthly)' },
];

const clientFormSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(2, 'Company name is required.'),
  status: z.enum(['Active', 'Inactive', 'Archived']).default('Active'),
  yearEnd: z.string().min(1, 'Financial year end is required.'),
  // Automation settings
  isVatRegistered: z.boolean().default(false),
  vatCategory: z.enum(['A', 'B', 'C']).optional().nullable(),
  submitsEmp201: z.boolean().default(false),
  submitsProvisionalTax: z.boolean().default(false),
  preparesFinancials: z.boolean().default(false),
});

type ClientFormValues = z.infer<typeof clientFormSchema>;

function ClientForm({ client, onSubmit, onCancel }: { client: User | null, onSubmit: (data: ClientFormValues) => void, onCancel: () => void }) {
    const form = useForm<ClientFormValues>({
        resolver: zodResolver(clientFormSchema),
        defaultValues: {
            id: client?.id || '',
            name: client?.name || '',
            status: (client?.status as any) || 'Active',
            yearEnd: client?.yearEnd || 'February',
            isVatRegistered: client?.isVatRegistered || false,
            vatCategory: client?.vatCategory || null,
            submitsEmp201: client?.submitsEmp201 || false,
            submitsProvisionalTax: client?.submitsProvisionalTax || false,
            preparesFinancials: client?.preparesFinancials || false,
        },
    });

    const isVatRegistered = form.watch('isVatRegistered');

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 max-h-[80vh] overflow-y-auto p-1 pr-4">
                <div className="space-y-4">
                    <FormField control={form.control} name="name" render={({ field }) => ( <FormItem><FormLabel>Company Name</FormLabel><FormControl><Input placeholder="e.g. Acme Corp (Pty) Ltd" {...field} /></FormControl><FormMessage /></FormItem>)} />
                    <div className="grid grid-cols-2 gap-4">
                        <FormField control={form.control} name="status" render={({ field }) => ( <FormItem><FormLabel>Status</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent>{['Active', 'Inactive', 'Archived'].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select></FormItem>)} />
                        <FormField control={form.control} name="yearEnd" render={({ field }) => ( <FormItem><FormLabel>Financial Year End</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent>{months.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent></Select></FormItem>)} />
                    </div>
                </div>
                
                <Separator />
                
                <div className="space-y-4">
                    <h3 className="text-sm font-bold uppercase tracking-wider text-primary">Task Automation</h3>
                    <p className="text-xs text-muted-foreground">Select the services to generate a 12-month compliance roadmap.</p>
                    
                    <div className="space-y-3">
                        <FormField
                            control={form.control}
                            name="isVatRegistered"
                            render={({ field }) => (
                                <FormItem className="flex items-center justify-between rounded-lg border p-3 shadow-sm">
                                    <div className="space-y-0.5"><FormLabel className="text-sm">VAT Submissions (VAT201)</FormLabel></div>
                                    <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                                </FormItem>
                            )}
                        />
                        {isVatRegistered && (
                            <div className="pl-4 animate-in fade-in slide-in-from-top-2">
                                <FormField control={form.control} name="vatCategory" render={({ field }) => ( 
                                    <FormItem>
                                        <FormLabel className="text-xs">VAT Category</FormLabel>
                                        <Select onValueChange={field.onChange} value={field.value || ''}>
                                            <FormControl><SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select category..." /></SelectTrigger></FormControl>
                                            <SelectContent>
                                                {vatCategories.map(cat => <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    </FormItem>
                                )} />
                            </div>
                        )}

                        <FormField control={form.control} name="submitsEmp201" render={({ field }) => ( 
                            <FormItem className="flex items-center justify-between rounded-lg border p-3 shadow-sm">
                                <div className="space-y-0.5"><FormLabel className="text-sm">Monthly Payroll (EMP201)</FormLabel></div>
                                <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                            </FormItem>
                        )} />

                        <FormField control={form.control} name="submitsProvisionalTax" render={({ field }) => ( 
                            <FormItem className="flex items-center justify-between rounded-lg border p-3 shadow-sm">
                                <div className="space-y-0.5"><FormLabel className="text-sm">Provisional Tax (IRP6)</FormLabel></div>
                                <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                            </FormItem>
                        )} />

                        <FormField control={form.control} name="preparesFinancials" render={({ field }) => ( 
                            <FormItem className="flex items-center justify-between rounded-lg border p-3 shadow-sm">
                                <div className="space-y-0.5"><FormLabel className="text-sm">Annual Financial Statements</FormLabel></div>
                                <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                            </FormItem>
                        )} />
                    </div>
                </div>

                <div className="flex justify-end gap-2 pt-4">
                    <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>
                    <Button type="submit">Save & Generate Roadmap</Button>
                </div>
            </form>
        </Form>
    );
}

export default function AdminClientsPage() {
  const [clients, setClients] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<User | null>(null);
  const { toast } = useToast();
  const { user: currentUser } = useAuth();
  
  const fetchClients = async () => {
    setIsLoading(true);
    try {
        const q = query(collection(db, "adminClients"), orderBy("name"));
        const snapshot = await getDocs(q);
        setClients(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as User)));
    } catch (error) {
        toast({ title: 'Error', description: 'Could not fetch clients.', variant: 'destructive'});
    } finally {
        setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchClients();
  }, []);

  const handleFormSubmit = async (values: ClientFormValues) => {
    if (!currentUser) return;
    setIsLoading(true);
    
    try {
        const batch = writeBatch(db);
        let clientId = values.id;

        // 1. Save or Update Client Document
        const clientData = {
            ...values,
            companyName: values.name,
            clientSource: 'admin' as const,
            updatedAt: serverTimestamp(),
        };

        if (!clientId) {
            const newDocRef = doc(collection(db, "adminClients"));
            clientId = newDocRef.id;
            batch.set(newDocRef, { ...clientData, id: clientId, createdAt: serverTimestamp(), createdBy: currentUser.uid });
        } else {
            batch.update(doc(db, "adminClients", clientId), clientData);
        }

        // 2. Clear existing system tasks for this client to prevent duplicates
        const oldTasksQuery = query(collection(db, 'tasks'), where('clientId', '==', clientId), where('createdBy', '==', 'system'));
        const oldTasksSnap = await getDocs(oldTasksQuery);
        oldTasksSnap.forEach(d => batch.delete(d.ref));

        // 3. Generate new tasks for next 12 months
        const tasksToCreate: any[] = [];
        const today = startOfToday();

        // Helper to normalize task due date (Time: 09:00 AM)
        const getDueDate = (date: Date, day: number) => {
            return Timestamp.fromDate(setSeconds(setMinutes(setHours(setDate(date, day), 9), 0), 0));
        };

        // Monthly PAYE (EMP201)
        if (values.submitsEmp201) {
            for (let i = 1; i <= 12; i++) {
                const periodDate = addMonths(today, i);
                tasksToCreate.push({
                    title: `EMP201 Submission - ${format(periodDate, 'MMMM yyyy')} for ${values.name}`,
                    description: `Submit monthly EMP201 return to SARS for ${values.name}. Due on the 5th of the following month.`,
                    dueDate: getDueDate(addMonths(periodDate, 1), 5),
                    type: 'EMP201'
                });
            }
        }

        // VAT (VAT201)
        if (values.isVatRegistered && values.vatCategory) {
            for (let i = 1; i <= 12; i++) {
                const periodDate = addMonths(today, i);
                const monthNum = periodDate.getMonth() + 1; // 1-12
                
                let isDue = false;
                if (values.vatCategory === 'C') isDue = true;
                else if (values.vatCategory === 'A' && monthNum % 2 !== 0) isDue = true; // Odd
                else if (values.vatCategory === 'B' && monthNum % 2 === 0) isDue = true; // Even

                if (isDue) {
                    tasksToCreate.push({
                        title: `VAT201 Submission - ${format(periodDate, 'MMMM yyyy')} for ${values.name}`,
                        description: `Submit VAT201 return to SARS for ${values.name}. Due on the 25th of the following month.`,
                        dueDate: getDueDate(addMonths(periodDate, 1), 25),
                        type: 'VAT201'
                    });
                }
            }
        }

        // Annual Financial Statements
        if (values.preparesFinancials) {
            const yeMonthIndex = months.indexOf(values.yearEnd);
            let yeDate = new Date(today.getFullYear(), yeMonthIndex, 28);
            if (yeDate < today) yeDate = new Date(today.getFullYear() + 1, yeMonthIndex, 28);

            tasksToCreate.push({
                title: `Annual Financial Statements for ${values.name} (${values.yearEnd} YE)`,
                description: `Prepare and finalize annual financial statements for the ${values.yearEnd} year end.`,
                dueDate: getDueDate(addMonths(yeDate, 3), 25),
                type: 'AFS'
            });
        }

        // Provisional Tax
        if (values.submitsProvisionalTax) {
            const yeMonthIndex = months.indexOf(values.yearEnd);
            let firstPeriod = new Date(today.getFullYear(), yeMonthIndex - 6, 25);
            let secondPeriod = new Date(today.getFullYear(), yeMonthIndex, 25);
            
            [firstPeriod, secondPeriod].forEach((d, idx) => {
                let targetDate = d;
                if (targetDate < today) targetDate = addMonths(targetDate, 12);
                tasksToCreate.push({
                    title: `Provisional Tax (IRP6) - Period ${idx + 1} for ${values.name}`,
                    description: `Submit ${idx + 1}st period provisional tax return for ${values.name}.`,
                    dueDate: Timestamp.fromDate(targetDate),
                    type: 'IRP6'
                });
            });
        }

        // Commit tasks to batch
        tasksToCreate.forEach(t => {
            const taskRef = doc(collection(db, 'tasks'));
            batch.set(taskRef, {
                ...t,
                clientId,
                clientSource: 'admin',
                status: 'To-Do',
                priority: 'Medium',
                assignedTo: [], // Unallocated as requested
                createdBy: 'system',
                createdAt: serverTimestamp(),
                comments: []
            });
        });

        await batch.commit();
        toast({ title: 'Client Saved', description: `Roadmap generated with ${tasksToCreate.length} automated tasks.` });
        fetchClients();
        setIsFormOpen(false);
    } catch (error) {
        console.error(error);
        toast({ title: 'Error', description: 'Failed to process automation roadmap.', variant: 'destructive'});
    } finally {
        setIsLoading(false);
    }
  };

  const handleDelete = async (clientId: string) => {
    try {
        const batch = writeBatch(db);
        batch.delete(doc(db, "adminClients", clientId));
        const tasksSnap = await getDocs(query(collection(db, 'tasks'), where('clientId', '==', clientId)));
        tasksSnap.forEach(d => batch.delete(d.ref));
        await batch.commit();
        fetchClients();
        toast({ title: 'Client Removed', variant: 'destructive' });
    } catch (error) {
        toast({ title: 'Delete Failed', variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-950">Manage Clients</h1>
            <p className="text-sm text-muted-foreground">Configure client compliance roadmap and automation settings.</p>
        </div>
        <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
           <DialogTrigger asChild>
                <Button onClick={() => { setSelectedClient(null); setIsFormOpen(true); }}>
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Add Client
                </Button>
           </DialogTrigger>
           <DialogContent className="sm:max-w-xl">
                <DialogHeader>
                    <DialogTitle>{selectedClient ? 'Update Client' : 'Setup New Client'}</DialogTitle>
                    <DialogDescription>Setting service toggles will automatically generate a 12-month compliance roadmap.</DialogDescription>
                </DialogHeader>
                <ClientForm 
                    client={selectedClient} 
                    onSubmit={handleFormSubmit}
                    onCancel={() => setIsFormOpen(false)}
                />
           </DialogContent>
        </Dialog>
      </div>

      <Card className="border-2 shadow-sm">
        <CardHeader className="bg-muted/30 pb-4">
          <CardTitle className="text-lg">Accounting Clients</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading && clients.length === 0 ? (
            <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
          ) : (
          <Table>
            <TableHeader className="bg-muted/20">
              <TableRow>
                <TableHead className="font-bold text-slate-950">Company</TableHead>
                <TableHead className="font-bold text-slate-950">Year End</TableHead>
                <TableHead className="font-bold text-slate-950">Services Enabled</TableHead>
                <TableHead className="font-bold text-slate-950">Status</TableHead>
                <TableHead className="text-right font-bold text-slate-950">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {clients.map(client => (
                <TableRow key={client.id} className="hover:bg-muted/5 transition-colors">
                  <TableCell className="font-bold text-slate-950">{client.name}</TableCell>
                  <TableCell className="font-medium">{client.yearEnd}</TableCell>
                  <TableCell>
                      <div className="flex flex-wrap gap-1">
                          {client.isVatRegistered && <Badge variant="success" className="text-[10px] font-bold">VAT ({client.vatCategory})</Badge>}
                          {client.submitsEmp201 && <Badge variant="info" className="text-[10px] font-bold">PAYE</Badge>}
                          {client.submitsProvisionalTax && <Badge variant="secondary" className="text-[10px] font-bold">PROV</Badge>}
                          {client.preparesFinancials && <Badge variant="outline" className="text-[10px] font-bold">AFS</Badge>}
                      </div>
                  </TableCell>
                  <TableCell><Badge variant={client.status === 'Active' ? 'default' : 'secondary'} className="font-bold">{client.status}</Badge></TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleEdit(client)}><RotateCw className="mr-2 h-4 w-4" /> Edit & Refresh Roadmap</DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <AlertDialog>
                                <AlertDialogTrigger asChild><DropdownMenuItem className="text-destructive">Delete Client</DropdownMenuItem></AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader><AlertDialogTitle>Confirm Deletion</AlertDialogTitle><AlertDialogDescription>This will delete the client and all associated system-generated tasks. This cannot be undone.</AlertDialogDescription></AlertDialogHeader>
                                    <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => handleDelete(client.id)}>Confirm Delete</AlertDialogAction></AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
              {clients.length === 0 && <TableRow><TableCell colSpan={5} className="text-center py-12 text-muted-foreground font-medium">No clients setup yet.</TableCell></TableRow>}
            </TableBody>
          </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
