'use client';
import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { MoreHorizontal, PlusCircle, Loader2, RotateCw } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { User, Task } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { getFirestore, collection, addDoc, getDocs, doc, setDoc, deleteDoc, writeBatch, Timestamp, query, orderBy, where, updateDoc, serverTimestamp } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { format, addMonths, setDate, setHours, setMinutes, setSeconds, startOfMonth, startOfToday, isSameDay, addYears, lastDayOfMonth } from 'date-fns';
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
  monthlyRetainerFee: z.preprocess(val => Number(val) || 0, z.number().min(0).optional()),
  isVatRegistered: z.boolean().default(false),
  vatCategory: z.enum(['A', 'B', 'C']).optional().nullable(),
  submitsEmp201: z.boolean().default(false),
  preparesPayroll: z.boolean().default(false),
  payrollDay: z.preprocess(val => Number(val), z.number().min(1).max(31)).optional(),
  submitsProvisionalTax: z.boolean().default(false),
  preparesFinancials: z.boolean().default(false),
  preparesManagementAccounts: z.boolean().default(false),
  managementAccountsDay: z.preprocess(val => Number(val), z.number().min(1).max(31)).optional(),
  submitsIncomeTax: z.boolean().default(false),
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
            monthlyRetainerFee: client?.monthlyRetainerFee || 0,
            isVatRegistered: client?.isVatRegistered || false,
            vatCategory: client?.vatCategory || null,
            submitsEmp201: client?.submitsEmp201 || false,
            preparesPayroll: client?.preparesPayroll || false,
            payrollDay: client?.payrollDay || 25,
            submitsProvisionalTax: client?.submitsProvisionalTax || false,
            preparesFinancials: client?.preparesFinancials || false,
            preparesManagementAccounts: client?.preparesManagementAccounts || false,
            managementAccountsDay: client?.managementAccountsDay || 10,
            submitsIncomeTax: client?.submitsIncomeTax || false,
        },
    });

    const isVatRegistered = form.watch('isVatRegistered');
    const preparesPayroll = form.watch('preparesPayroll');
    const preparesManagementAccounts = form.watch('preparesManagementAccounts');

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 max-h-[80vh] overflow-y-auto p-1 pr-4">
                <div className="space-y-4">
                    <FormField control={form.control} name="name" render={({ field }) => ( <FormItem><FormLabel>Company Name</FormLabel><FormControl><Input placeholder="e.g. Acme Corp (Pty) Ltd" {...field} /></FormControl><FormMessage /></FormItem>)} />
                    <div className="grid grid-cols-2 gap-4">
                        <FormField control={form.control} name="status" render={({ field }) => ( <FormItem><FormLabel>Status</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent>{['Active', 'Inactive', 'Archived'].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select></FormItem>)} />
                        <FormField control={form.control} name="yearEnd" render={({ field }) => ( <FormItem><FormLabel>Financial Year End</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select a month" /></SelectTrigger></FormControl><SelectContent>{months.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent></Select></FormItem>)} />
                    </div>
                    <FormField control={form.control} name="monthlyRetainerFee" render={({ field }) => ( <FormItem><FormLabel>Monthly Retainer Fee (R)</FormLabel><FormControl><Input type="number" step="0.01" placeholder="0.00" {...field} /></FormControl><FormMessage /></FormItem>)} />
                </div>
                
                <Separator />
                
                <div className="space-y-4">
                    <h3 className="text-sm font-bold uppercase tracking-wider text-primary">Compliance Roadmap Automation</h3>
                    <p className="text-xs text-muted-foreground">The system will automatically generate the next upcoming task for each enabled service.</p>
                    
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
                                <div className="space-y-0.5"><FormLabel className="text-sm">Monthly PAYE (EMP201)</FormLabel></div>
                                <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                            </FormItem>
                        )} />

                        <FormField control={form.control} name="preparesPayroll" render={({ field }) => ( 
                            <FormItem className="flex items-center justify-between rounded-lg border p-3 shadow-sm">
                                <div className="space-y-0.5"><FormLabel className="text-sm">Monthly Payroll Preparation</FormLabel></div>
                                <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                            </FormItem>
                        )} />
                        {preparesPayroll && (
                            <div className="pl-4 animate-in fade-in slide-in-from-top-2">
                                <FormField control={form.control} name="payrollDay" render={({ field }) => ( 
                                    <FormItem>
                                        <FormLabel className="text-xs">Payroll Day of Month</FormLabel>
                                        <FormControl><Input type="number" min="1" max="31" {...field} className="h-8 text-xs w-24" /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                            </div>
                        )}

                        <FormField control={form.control} name="preparesManagementAccounts" render={({ field }) => ( 
                            <FormItem className="flex items-center justify-between rounded-lg border p-3 shadow-sm">
                                <div className="space-y-0.5"><FormLabel className="text-sm">Monthly Management Accounts</FormLabel></div>
                                <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                            </FormItem>
                        )} />
                        {preparesManagementAccounts && (
                            <div className="pl-4 animate-in fade-in slide-in-from-top-2">
                                <FormField control={form.control} name="managementAccountsDay" render={({ field }) => ( 
                                    <FormItem>
                                        <FormLabel className="text-xs">Reporting Day of Month</FormLabel>
                                        <FormControl><Input type="number" min="1" max="31" {...field} className="h-8 text-xs w-24" /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                            </div>
                        )}

                        <FormField control={form.control} name="submitsProvisionalTax" render={({ field }) => ( 
                            <FormItem className="flex items-center justify-between rounded-lg border p-3 shadow-sm">
                                <div className="space-y-0.5"><FormLabel className="text-sm">Provisional Tax (IRP6)</FormLabel></div>
                                <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                            </FormItem>
                        )} />

                        <FormField control={form.control} name="submitsIncomeTax" render={({ field }) => ( 
                            <FormItem className="flex items-center justify-between rounded-lg border p-3 shadow-sm">
                                <div className="space-y-0.5">
                                    <FormLabel className="text-sm">Annual Income Tax Return (ITR14)</FormLabel>
                                    <p className="text-[10px] text-muted-foreground">Due 12 months after Financial Year End.</p>
                                </div>
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
                    <Button type="submit">Save & Update Roadmap</Button>
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

  const formatYearEnd = (yearEnd: any): string => {
    if (!yearEnd) return 'N/A';
    if (typeof yearEnd === 'string') return yearEnd;
    
    if (yearEnd && typeof yearEnd.toDate === 'function') {
      try {
        return format(yearEnd.toDate(), 'MMMM');
      } catch (e) {
        return 'Invalid Date';
      }
    }
    
    if (yearEnd && typeof yearEnd.seconds === 'number') {
      try {
        return format(new Date(yearEnd.seconds * 1000), 'MMMM');
      } catch (e) {
        return 'Invalid Date';
      }
    }

    try {
        const d = new Date(yearEnd);
        if (!isNaN(d.getTime())) {
             return format(d, 'MMMM');
        }
    } catch (e) {}
    
    return 'N/A';
  };

  const handleEdit = (client: User) => {
    setSelectedClient(client);
    setIsFormOpen(true);
  };

  const handleFormSubmit = async (values: ClientFormValues) => {
    if (!currentUser) return;
    setIsLoading(true);
    
    try {
        const batch = writeBatch(db);
        let clientId = values.id;

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

        const oldTasksQuery = query(collection(db, 'tasks'), where('clientId', '==', clientId), where('createdBy', '==', 'system'));
        const oldTasksSnap = await getDocs(oldTasksQuery);
        oldTasksSnap.forEach(d => batch.delete(d.ref));

        const tasksToCreate: any[] = [];
        const today = startOfToday();

        const getDueDate = (date: Date, day: number) => {
            return Timestamp.fromDate(setSeconds(setMinutes(setHours(setDate(date, day), 9), 0), 0));
        };

        if (values.submitsEmp201) {
            let found = false;
            for (let i = -1; i < 12 && !found; i++) {
                const periodDate = addMonths(today, i);
                const dueDate = getDueDate(addMonths(periodDate, 1), 5);
                if (dueDate.toDate() >= today) {
                    tasksToCreate.push({
                        title: `EMP201 Submission - ${format(periodDate, 'MMMM yyyy')} for ${values.name}`,
                        description: `Submit monthly EMP201 return to SARS for ${values.name}. Due on the 5th of the following month.`,
                        dueDate: dueDate,
                        type: 'EMP201',
                        recurrence: 'Monthly'
                    });
                    found = true;
                }
            }
        }

        if (values.preparesPayroll && values.payrollDay) {
            let found = false;
            for (let i = 0; i < 12 && !found; i++) {
                const periodDate = addMonths(today, i);
                const dueDate = getDueDate(periodDate, values.payrollDay);
                if (dueDate.toDate() >= today) {
                    tasksToCreate.push({
                        title: `Payroll Preparation - ${format(periodDate, 'MMMM yyyy')} for ${values.name}`,
                        description: `Prepare and issue payslips for ${values.name} for the period of ${format(periodDate, 'MMMM yyyy')}.`,
                        dueDate: dueDate,
                        type: 'PAYROLL',
                        recurrence: 'Monthly'
                    });
                    found = true;
                }
            }
        }

        if (values.preparesManagementAccounts && values.managementAccountsDay) {
            let found = false;
            for (let i = 0; i < 12 && !found; i++) {
                const periodDate = addMonths(today, i);
                const dueDate = getDueDate(addMonths(periodDate, 1), values.managementAccountsDay);
                if (dueDate.toDate() >= today) {
                    tasksToCreate.push({
                        title: `Management Accounts - ${format(periodDate, 'MMMM yyyy')} for ${values.name}`,
                        description: `Prepare and issue monthly management reports for ${values.name} for the ${format(periodDate, 'MMMM yyyy')} period.`,
                        dueDate: dueDate,
                        type: 'MGMT',
                        recurrence: 'Monthly'
                    });
                    found = true;
                }
            }
        }

        if (values.isVatRegistered && values.vatCategory) {
            let found = false;
            for (let i = -1; i < 12 && !found; i++) {
                const periodDate = addMonths(today, i);
                const monthNum = periodDate.getMonth() + 1;
                
                let isDue = false;
                if (values.vatCategory === 'C') isDue = true;
                else if (values.vatCategory === 'A' && monthNum % 2 !== 0) isDue = true;
                else if (values.vatCategory === 'B' && monthNum % 2 === 0) isDue = true;

                if (isDue) {
                    const dueDate = getDueDate(addMonths(periodDate, 1), 25);
                    if (dueDate.toDate() >= today) {
                        tasksToCreate.push({
                            title: `VAT201 Submission - ${format(periodDate, 'MMMM yyyy')} for ${values.name}`,
                            description: `Submit VAT201 return to SARS for ${values.name}. Due on the 25th of the following month.`,
                            dueDate: dueDate,
                            type: 'VAT201',
                            recurrence: values.vatCategory === 'C' ? 'Monthly' : 'Bi-Monthly'
                        });
                        found = true;
                    }
                }
            }
        }

        if (values.preparesFinancials) {
            const yeMonthIndex = months.indexOf(values.yearEnd);
            let yeDate = new Date(today.getFullYear(), yeMonthIndex, 28);
            let dueDate = getDueDate(addMonths(yeDate, 3), 25);
            
            if (dueDate.toDate() < today) {
                yeDate = addMonths(yeDate, 12);
                dueDate = getDueDate(addMonths(yeDate, 3), 25);
            }

            tasksToCreate.push({
                title: `Annual Financial Statements for ${values.name} (${values.yearEnd} YE)`,
                description: `Prepare and finalize annual financial statements for the ${values.yearEnd} year end.`,
                dueDate: dueDate,
                type: 'AFS',
                recurrence: 'Annually'
            });
        }

        if (values.submitsIncomeTax) {
            const yeMonthIndex = months.indexOf(values.yearEnd);
            let yeDate = new Date(today.getFullYear(), yeMonthIndex, 28);
            let dueDate = getDueDate(addYears(yeDate, 1), 28);
            
            if (dueDate.toDate() < today) {
                yeDate = addMonths(yeDate, 12);
                dueDate = getDueDate(addYears(yeDate, 1), 28);
            }

            tasksToCreate.push({
                title: `Income Tax Return (ITR14) for ${values.name} (${values.yearEnd} YE)`,
                description: `Submit annual income tax return for ${values.name}. Due 12 months after the financial year end.`,
                dueDate: dueDate,
                type: 'ITR',
                recurrence: 'Annually'
            });
        }

        if (values.submitsProvisionalTax) {
            const yeMonthIndex = months.indexOf(values.yearEnd);
            let firstPeriod = new Date(today.getFullYear(), yeMonthIndex - 6, 25);
            let secondPeriod = new Date(today.getFullYear(), yeMonthIndex, 25);
            
            const dates = [firstPeriod, secondPeriod, addMonths(firstPeriod, 12), addMonths(secondPeriod, 12)];
            const nextDate = dates.map(d => getDueDate(d, 25)).filter(d => d.toDate() >= today).sort((a,b) => a.toDate().getTime() - b.toDate().getTime())[0];

            if (nextDate) {
                const isFirst = isSameDay(nextDate.toDate(), getDueDate(firstPeriod, 25).toDate()) || isSameDay(nextDate.toDate(), getDueDate(addMonths(firstPeriod, 12), 25).toDate());
                tasksToCreate.push({
                    title: `Provisional Tax (IRP6) - Period ${isFirst ? 1 : 2} for ${values.name}`,
                    description: `Submit ${isFirst ? 1 : 2}st period provisional tax return for ${values.name}.`,
                    dueDate: nextDate,
                    type: 'IRP6',
                    recurrence: 'Semi-Annually'
                });
            }
        }

        tasksToCreate.forEach(t => {
            const taskRef = doc(collection(db, 'tasks'));
            batch.set(taskRef, {
                ...t,
                clientId,
                clientSource: 'admin',
                status: 'To-Do',
                priority: 'Medium',
                assignedTo: [], 
                createdBy: 'system',
                createdAt: serverTimestamp(),
                comments: []
            });
        });

        await batch.commit();
        toast({ title: 'Client Saved', description: `Roadmap updated with upcoming automated tasks.` });
        fetchClients();
        setIsFormOpen(false);
    } catch (error) {
        console.error(error);
        toast({ title: 'Error', description: 'Failed to update automation roadmap.', variant: 'destructive'});
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
                    <DialogTitle>{selectedClient?.id ? 'Update Client' : 'Setup New Client'}</DialogTitle>
                    <DialogDescription>Setting service toggles will automatically generate the next upcoming compliance task.</DialogDescription>
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
        <CardHeader className="bg-muted/30 pb-4 border-b">
          <CardTitle className="text-lg">Accounting Clients</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading && clients.length === 0 ? (
            <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
          ) : (
          <Table>
            <TableHeader className="bg-muted/10">
              <TableRow>
                <TableHead className="font-semibold text-muted-foreground">Company</TableHead>
                <TableHead className="font-semibold text-muted-foreground">Year End</TableHead>
                <TableHead className="font-semibold text-muted-foreground">Services Enabled</TableHead>
                <TableHead className="font-semibold text-muted-foreground">Status</TableHead>
                <TableHead className="text-right font-semibold text-muted-foreground">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {clients.map(client => (
                <TableRow key={client.id} className="hover:bg-muted/5 transition-colors">
                  <TableCell className="font-medium text-slate-900">{client.name}</TableCell>
                  <TableCell className="text-sm text-slate-600">{formatYearEnd(client.yearEnd)}</TableCell>
                  <TableCell>
                      <div className="flex flex-wrap gap-1.5">
                          {client.isVatRegistered && (
                              <Badge variant="outline" className="text-[9px] font-semibold bg-blue-50 text-blue-700 border-blue-200 uppercase tracking-tight">
                                  VAT ({client.vatCategory})
                              </Badge>
                          )}
                          {client.submitsEmp201 && (
                              <Badge variant="outline" className="text-[9px] font-semibold bg-green-50 text-green-700 border-green-200 uppercase tracking-tight">
                                  PAYE
                              </Badge>
                          )}
                          {client.preparesPayroll && (
                              <Badge variant="outline" className="text-[9px] font-semibold bg-emerald-50 text-emerald-700 border-emerald-200 uppercase tracking-tight">
                                  Payroll
                              </Badge>
                          )}
                          {client.preparesManagementAccounts && (
                              <Badge variant="outline" className="text-[9px] font-semibold bg-amber-50 text-amber-700 border-amber-200 uppercase tracking-tight">
                                  Mgmt
                              </Badge>
                          )}
                          {client.submitsProvisionalTax && (
                              <Badge variant="outline" className="text-[9px] font-semibold bg-purple-50 text-purple-700 border-purple-200 uppercase tracking-tight">
                                  Prov
                              </Badge>
                          )}
                          {client.submitsIncomeTax && (
                              <Badge variant="outline" className="text-[9px] font-semibold bg-rose-50 text-rose-700 border-rose-200 uppercase tracking-tight">
                                  ITR
                              </Badge>
                          )}
                          {client.preparesFinancials && (
                              <Badge variant="outline" className="text-[9px] font-semibold bg-slate-50 text-slate-700 border-slate-200 uppercase tracking-tight">
                                  AFS
                              </Badge>
                          )}
                      </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={client.status === 'Active' ? 'default' : 'secondary'} className="font-medium text-[11px] px-2 py-0.5">
                        {client.status}
                    </Badge>
                  </TableCell>
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
