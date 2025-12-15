

'use client';

import * as React from "react";
import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm, useFieldArray } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, Plus, Trash2, CalendarIcon, Eye, Edit, ChevronsUpDown, PlusCircle } from 'lucide-react';
import { getFirestore, doc, getDoc, collection, writeBatch, Timestamp, query, where, orderBy, getDocs, deleteDoc, arrayUnion, setDoc } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { useParams, useSearchParams } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { User, ChartOfAccount, AllocatedTransaction } from '@/lib/types';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter as TableFooterComponent } from '@/components/ui/table';
import { Separator } from '@/components/ui/separator';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from '@/components/ui/command';


const db = getFirestore(firebaseApp);

const journalLineSchema = z.object({
  accountId: z.string().min(1, "Account is required."),
  description: z.string().optional(),
  debit: z.number().min(0).optional(),
  credit: z.number().min(0).optional(),
});

const formSchema = z.object({
  date: z.date(),
  reference: z.string().min(1, "Reference is required."),
  lines: z.array(journalLineSchema).min(2, "At least two lines are required."),
}).refine(data => {
    const totalDebits = data.lines.reduce((acc, line) => acc + (line.debit || 0), 0);
    const totalCredits = data.lines.reduce((acc, line) => acc + (line.credit || 0), 0);
    return Math.abs(totalDebits - totalCredits) < 0.01; // Allow for floating point inaccuracies
}, {
    message: "Total debits must equal total credits.",
    path: ["lines"],
});

type JournalFormValues = z.infer<typeof formSchema>;

const formatPrice = (price: number | undefined) => {
    if (price === undefined || price === null || isNaN(price)) return '0.00';
    return new Intl.NumberFormat('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(price);
};

const generalAccountFormSchema = z.object({
  accountNumber: z.string().min(1, "Account number is required."),
  description: z.string().min(3, "Description is required."),
  section: z.enum(['Income Statement', 'Balance Sheet']),
});

function CreateGeneralAccountDialog({ client, onAccountCreated, open, onOpenChange }: { client: User | null; onAccountCreated: () => void; open: boolean; onOpenChange: (open: boolean) => void }) {
    const { toast } = useToast();
    const [isSaving, setIsSaving] = useState(false);
    const form = useForm<z.infer<typeof generalAccountFormSchema>>({
        resolver: zodResolver(generalAccountFormSchema),
        defaultValues: { accountNumber: '', description: '', section: 'Income Statement' },
    });

    const handleCreateAccount = async (values: z.infer<typeof generalAccountFormSchema>) => {
        if (!client || !client.uid) return;
        
        const existingAccount = client.chartOfAccounts?.find(acc => acc.accountNumber === values.accountNumber);
        if (existingAccount) {
            form.setError('accountNumber', { message: 'This account number already exists.' });
            return;
        }

        setIsSaving(true);
        try {
            const newAccount: ChartOfAccount = {
                id: values.accountNumber,
                accountNumber: values.accountNumber,
                description: values.description,
                section: values.section,
            };

            const clientRef = doc(db, 'aiAccountantClients', client.uid);
            await setDoc(clientRef, { chartOfAccounts: arrayUnion(newAccount) }, { merge: true });
            
            toast({ title: 'Account Created', description: `Account "${values.description}" has been added.` });
            onAccountCreated();
            form.reset();
            onOpenChange(false);
        } catch (error) {
            console.error("Error creating general account:", error);
            toast({ title: 'Error', description: 'Could not create the account.', variant: 'destructive' });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Create New General Ledger Account</DialogTitle>
                    <DialogDescription>Add a new account to this client's chart of accounts.</DialogDescription>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(handleCreateAccount)} className="space-y-4">
                        <FormField control={form.control} name="accountNumber" render={({ field }) => ( <FormItem><FormLabel>Account Number</FormLabel><FormControl><Input placeholder="e.g., 3000-058" {...field} /></FormControl><FormMessage /></FormItem>)} />
                        <FormField control={form.control} name="description" render={({ field }) => ( <FormItem><FormLabel>Description</FormLabel><FormControl><Input placeholder="e.g., Office Flowers" {...field} /></FormControl><FormMessage /></FormItem>)} />
                        <FormField control={form.control} name="section" render={({ field }) => ( <FormItem><FormLabel>Section</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select a section" /></SelectTrigger></FormControl><SelectContent><SelectItem value="Income Statement">Income Statement</SelectItem><SelectItem value="Balance Sheet">Balance Sheet</SelectItem></SelectContent></Select><FormMessage /></FormItem>)} />
                        <DialogFooter>
                            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
                            <Button type="submit" disabled={isSaving}>{isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Create Account</Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}

export default function GeneralJournalsPage() {
    const params = useParams();
    const searchParams = useSearchParams();
    const clientId = params.clientId as string;
    const [client, setClient] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [allJournals, setAllJournals] = useState<AllocatedTransaction[]>([]);
    const [viewingJournal, setViewingJournal] = useState<AllocatedTransaction[] | null>(null);
    const [editingJournalRef, setEditingJournalRef] = useState<string | null>(null);
    const [isCreateAccountOpen, setIsCreateAccountOpen] = useState(false);
    const { toast } = useToast();

    const form = useForm<JournalFormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            date: new Date(),
            reference: '',
            lines: [
                { accountId: '', description: '', debit: 0, credit: 0 },
                { accountId: '', description: '', debit: 0, credit: 0 },
            ],
        },
    });
    
    useEffect(() => {
        const reference = searchParams.get('reference');
        if (reference && reference.startsWith('TAX-')) { // Only prefill for tax journals
            const date = searchParams.get('date');
            const line1_debit = searchParams.get('line1_debit');
            const line1_desc = searchParams.get('line1_desc');
            const line1_acc = searchParams.get('line1_acc');
            const line2_credit = searchParams.get('line2_credit');
            const line2_desc = searchParams.get('line2_desc');
            const line2_acc = searchParams.get('line2_acc');

            if (line1_debit && line2_credit) {
                form.reset({
                    date: date ? new Date(date) : new Date(),
                    reference: reference,
                    lines: [
                        { accountId: line1_acc || '', description: line1_desc || '', debit: parseFloat(line1_debit), credit: 0 },
                        { accountId: line2_acc || '', description: line2_desc || '', credit: parseFloat(line2_credit), debit: 0 },
                    ],
                });
            }
        }
    }, [searchParams, form]);


    const { fields, append, remove, replace } = useFieldArray({
        control: form.control,
        name: "lines",
    });
    
    const watchedLines = form.watch("lines");

    const totals = useMemo(() => {
        const totalDebits = watchedLines.reduce((acc, line) => acc + (line.debit || 0), 0);
        const totalCredits = watchedLines.reduce((acc, line) => acc + (line.credit || 0), 0);
        return { totalDebits, totalCredits };
    }, [watchedLines]);
    
    const generalAccounts = useMemo(() => {
        const excludedAccountNumbers = ['8000-001', '7000-000'];
        return client?.chartOfAccounts?.filter(acc => !excludedAccountNumbers.includes(acc.accountNumber)) || [];
    }, [client]);

    const fetchClientAndJournals = async () => {
        if (!clientId) return;
        setIsLoading(true);
        try {
            const clientRef = doc(db, 'aiAccountantClients', clientId);
            const clientSnap = await getDoc(clientRef);
            if (clientSnap.exists()) {
                setClient(clientSnap.data() as User);
            }

            const journalsQuery = query(
                collection(db, 'aiAccountantClients', clientId, 'transactions'),
                where('bankAccountId', '==', 'JOURNAL'),
                orderBy('date', 'desc'),
                orderBy('reference', 'asc') // Add secondary sort
            );
            const journalsSnapshot = await getDocs(journalsQuery);
            const journals = journalsSnapshot.docs.map(d => ({id: d.id, ...d.data()}) as AllocatedTransaction);
            setAllJournals(journals);
        } catch (e) {
            console.error("Failed to fetch data:", e);
            toast({ title: 'Error', description: 'Failed to fetch client data or journals.', variant: 'destructive' });
        } finally {
            setIsLoading(false);
        }
    };


    useEffect(() => {
        fetchClientAndJournals();
    }, [clientId]);
    
    const onSubmit = async (data: JournalFormValues) => {
        if (!client) return;
        setIsLoading(true);
        
        try {
            const batch = writeBatch(db);
            const journalTimestamp = Timestamp.now(); // Use a single timestamp for the whole journal

            // If we are editing, delete the old journal entries first
            if(editingJournalRef) {
                 const journalsToDeleteSnapshot = await getDocs(query(collection(db, "aiAccountantClients", client.id, "transactions"), where("reference", "==", editingJournalRef)));
                 journalsToDeleteSnapshot.forEach(journalDoc => {
                    batch.delete(journalDoc.ref);
                });
            }

            data.lines.forEach((line) => {
                if ((line.debit || 0) > 0 || (line.credit || 0) > 0) {
                    const amount = (line.debit || 0) - (line.credit || 0);
                    const journalEntryRef = doc(collection(db, 'aiAccountantClients', client.id, 'transactions'));
                    
                    batch.set(journalEntryRef, {
                        clientId: client.id,
                        date: data.date.toISOString(),
                        reference: data.reference,
                        description: line.description || 'General Journal Entry',
                        amount: amount,
                        bankAccountId: 'JOURNAL',
                        allocatedTo: { value: line.accountId, type: 'account' },
                        vatType: 'no_vat',
                        status: 'allocated',
                        allocatedAt: journalTimestamp, // Use the same timestamp for all lines in this journal
                    });
                }
            });

            await batch.commit();

            toast({ title: `Journal ${editingJournalRef ? 'Updated' : 'Posted'}`, description: `The journal entry has been successfully ${editingJournalRef ? 'updated' : 'recorded'}.` });
            form.reset({
                 date: new Date(),
                 reference: '',
                 lines: [
                    { accountId: '', description: '', debit: 0, credit: 0 },
                    { accountId: '', description: '', debit: 0, credit: 0 },
                ],
            });
            setEditingJournalRef(null);
            fetchClientAndJournals(); // Re-fetch journals after posting
        } catch (error) {
            toast({ title: 'Error', description: 'Failed to post journal entry.', variant: 'destructive' });
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleEditJournal = (entries: AllocatedTransaction[]) => {
        if (entries.length === 0) return;

        const reference = entries[0].reference;
        const date = new Date(entries[0].date);

        const formLines = entries.map(entry => ({
            accountId: entry.allocatedTo.value,
            description: entry.description,
            debit: entry.amount > 0 ? entry.amount : 0,
            credit: entry.amount < 0 ? -entry.amount : 0,
        }));
        
        replace(formLines); // use 'replace' from useFieldArray
        form.setValue('date', date);
        form.setValue('reference', reference);
        setEditingJournalRef(reference);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };
    
    const handleDeleteJournal = async (journalReference: string, journalDate: string) => {
      if (!client) return;
      
      const q = query(
          collection(db, "aiAccountantClients", client.id, "transactions"), 
          where("reference", "==", journalReference),
          where("allocatedAt", "==", Timestamp.fromDate(new Date(journalDate)))
        );

      const journalsToDeleteSnapshot = await getDocs(q);

      if (journalsToDeleteSnapshot.empty) {
        toast({ title: 'Error', description: 'Could not find journal entries to delete.', variant: 'destructive'});
        return;
      }
      
      try {
        const batch = writeBatch(db);
        journalsToDeleteSnapshot.forEach(journalDoc => {
          batch.delete(journalDoc.ref);
        });
        await batch.commit();
        toast({ title: 'Journal Deleted', description: `Journal ${journalReference} has been deleted.`, variant: 'destructive'});
        fetchClientAndJournals();
      } catch (error) {
        console.error("Error deleting journal:", error);
        toast({ title: 'Error', description: 'Failed to delete journal.', variant: 'destructive'});
      }
    };
    
    const groupedGeneralJournals = useMemo(() => {
        const grouped = new Map<string, AllocatedTransaction[]>();
        const customerControlAccount = client?.chartOfAccounts?.find((acc: any) => acc.accountNumber === '8000-001')?.id;
        const supplierControlAccount = client?.chartOfAccounts?.find((acc: any) => acc.accountNumber === '7000-000')?.id;

        allJournals.forEach(tx => {
            if (tx.allocatedTo?.value !== customerControlAccount &&
                tx.allocatedTo?.value !== supplierControlAccount &&
                !tx.reference.startsWith('TAX-')) {
                
                // Create a unique key for each batch using reference and exact timestamp
                const uniqueKey = `${tx.reference}-${tx.allocatedAt.seconds}-${tx.allocatedAt.nanoseconds}`;

                if (!grouped.has(uniqueKey)) {
                    grouped.set(uniqueKey, []);
                }
                grouped.get(uniqueKey)?.push(tx);
            }
        });
        return grouped;
    }, [allJournals, client]);
    
     const groupedTaxJournals = useMemo(() => {
        const grouped = new Map<string, AllocatedTransaction[]>();
        allJournals.forEach(tx => {
            if (tx.reference.startsWith('TAX-')) {
                 const uniqueKey = `${tx.reference}-${tx.allocatedAt.seconds}-${tx.allocatedAt.nanoseconds}`;
                if (!grouped.has(uniqueKey)) {
                    grouped.set(uniqueKey, []);
                }
                grouped.get(uniqueKey)?.push(tx);
            }
        });
        return grouped;
    }, [allJournals]);

    if (isLoading && !client) {
        return <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin" /></div>;
    }

    return (
      <Dialog onOpenChange={(open) => !open && setViewingJournal(null)}>
      <div className="space-y-8">
        <CreateGeneralAccountDialog client={client} onAccountCreated={fetchClientAndJournals} open={isCreateAccountOpen} onOpenChange={setIsCreateAccountOpen} />
        <Card>
            <CardHeader>
                <div className="flex justify-between items-center">
                    <div>
                        <CardTitle>{editingJournalRef ? `Editing Journal: ${editingJournalRef}` : 'Post General Journal'}</CardTitle>
                        <CardDescription>Create manual journal entries between general ledger accounts.</CardDescription>
                    </div>
                     {editingJournalRef && <Button variant="outline" onClick={() => { setEditingJournalRef(null); form.reset({ date: new Date(), reference: '', lines: [{ accountId: '', description: '', debit: 0, credit: 0 }, { accountId: '', description: '', debit: 0, credit: 0 }] }); }}>Cancel Edit</Button>}
                </div>
            </CardHeader>
            <CardContent>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                           <FormField control={form.control} name="date" render={({ field }) => ( <FormItem><FormLabel>Date</FormLabel><Popover><PopoverTrigger asChild><FormControl><Button variant={"outline"} className={cn("w-full justify-start text-left font-normal", !field.value && "text-muted-foreground")}><CalendarIcon className="mr-2 h-4 w-4" />{field.value ? format(field.value, "dd/MM/yyyy") : <span>Pick a date</span>}</Button></FormControl></PopoverTrigger><PopoverContent className="w-auto p-0"><Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus /></PopoverContent></Popover><FormMessage /></FormItem> )}/>
                           <FormField control={form.control} name="reference" render={({ field }) => ( <FormItem><FormLabel>Reference</FormLabel><FormControl><Input placeholder="e.g., JNL001" {...field} disabled={!!editingJournalRef} /></FormControl><FormMessage /></FormItem> )}/>
                        </div>

                         <div className="border rounded-lg overflow-x-auto">
                           <table className="min-w-full divide-y divide-gray-200">
                             <thead className="bg-gray-50">
                               <tr>
                                 <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[30%]">Account</th>
                                 <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[30%]">Description</th>
                                 <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[200px]">Debit</th>
                                 <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[200px]">Credit</th>
                                 <th className="px-3 py-2 w-[5%]"></th>
                               </tr>
                             </thead>
                             <tbody className="bg-white divide-y divide-gray-200">
                                {fields.map((field, index) => (
                                   <tr key={field.id}>
                                        <td className="px-2 py-1 whitespace-nowrap">
                                             <FormField
                                                control={form.control}
                                                name={`lines.${index}.accountId`}
                                                render={({ field }) => (
                                                    <FormItem>
                                                    <Popover>
                                                        <PopoverTrigger asChild>
                                                        <FormControl>
                                                            <Button
                                                            variant="outline"
                                                            role="combobox"
                                                            className="w-full justify-between h-8 text-xs"
                                                            >
                                                            {field.value
                                                                ? generalAccounts.find(
                                                                    (acc) => acc.id === field.value
                                                                )?.description
                                                                : "Select account..."}
                                                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                                            </Button>
                                                        </FormControl>
                                                        </PopoverTrigger>
                                                        <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                                                            <Command>
                                                                <CommandInput placeholder="Search account..." />
                                                                <CommandList>
                                                                    <CommandEmpty>No account found.</CommandEmpty>
                                                                    <CommandItem onSelect={() => setIsCreateAccountOpen(true)} className="text-primary cursor-pointer"><PlusCircle className="mr-2 h-4 w-4"/>Create new account...</CommandItem>
                                                                    {generalAccounts.map((acc) => (
                                                                        <CommandItem
                                                                            value={acc.description}
                                                                            key={acc.id}
                                                                            onSelect={() => {
                                                                                form.setValue(`lines.${index}.accountId`, acc.id)
                                                                            }}
                                                                        >
                                                                            {acc.description}
                                                                        </CommandItem>
                                                                    ))}
                                                                </CommandList>
                                                            </Command>
                                                        </PopoverContent>
                                                    </Popover>
                                                    <FormMessage />
                                                    </FormItem>
                                                )}
                                                />
                                        </td>
                                        <td className="px-2 py-1 whitespace-nowrap"><FormField control={form.control} name={`lines.${index}.description`} render={({ field }) => ( <Input className="h-8" {...field} /> )}/></td>
                                        <td className="px-2 py-1 whitespace-nowrap"><FormField control={form.control} name={`lines.${index}.debit`} render={({ field }) => ( <Input type="number" step="0.01" className="h-8" {...field} onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)} /> )}/></td>
                                        <td className="px-2 py-1 whitespace-nowrap"><FormField control={form.control} name={`lines.${index}.credit`} render={({ field }) => ( <Input type="number" step="0.01" className="h-8" {...field} onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)} /> )}/></td>
                                        <td className="px-2 py-1 whitespace-nowrap">
                                            <Button type="button" size="icon" variant="ghost" onClick={() => remove(index)} disabled={fields.length <= 2}><Trash2 className="h-4 w-4 text-red-600" /></Button>
                                        </td>
                                  </tr>
                                ))}
                             </tbody>
                             <tfoot className="bg-gray-50">
                                <tr>
                                    <td colSpan={2} className="px-3 py-2 text-right font-bold">Totals</td>
                                    <td className="px-3 py-2 font-mono">{formatPrice(totals.totalDebits)}</td>
                                    <td className="px-3 py-2 font-mono">{formatPrice(totals.totalCredits)}</td>
                                    <td></td>
                                </tr>
                             </tfoot>
                           </table>
                         </div>
                         <div className="flex justify-between items-center">
                            <Button type="button" variant="outline" size="sm" onClick={() => append({ accountId: '', description: '', debit: 0, credit: 0 })}><Plus className="mr-2 h-4 w-4" /> Add Line</Button>
                            {form.formState.errors.lines && <p className="text-sm font-medium text-destructive">{form.formState.errors.lines.message}</p>}
                         </div>

                         <CardFooter className="p-4 bg-muted rounded-b-lg mt-4 flex justify-end">
                             <Button type="submit" disabled={isLoading}>
                                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                {editingJournalRef ? 'Update Journal' : 'Post Journal'}
                            </Button>
                        </CardFooter>
                    </form>
                </Form>
            </CardContent>
        </Card>
        <Separator />
         <Card>
            <CardHeader>
                <CardTitle>Posted Tax Journals</CardTitle>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Date</TableHead>
                            <TableHead>Reference</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {Array.from(groupedTaxJournals.entries()).length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={3} className="text-center h-24 text-muted-foreground">
                                    No tax journals have been posted yet.
                                </TableCell>
                            </TableRow>
                        ) : (
                            Array.from(groupedTaxJournals.values()).map((entries) => {
                                const journalRef = entries[0].reference;
                                const journalDate = entries[0].allocatedAt.toDate().toISOString();
                                return (
                                <TableRow key={`${journalRef}-${journalDate}`}>
                                    <TableCell>{format(new Date(entries[0].date), 'dd/MM/yyyy')}</TableCell>
                                    <TableCell>{journalRef}</TableCell>
                                    <TableCell className="text-right">
                                         <DialogTrigger asChild>
                                            <Button variant="ghost" size="icon" onClick={() => setViewingJournal(entries)}><Eye className="h-4 w-4" /></Button>
                                        </DialogTrigger>
                                        <AlertDialog>
                                            <AlertDialogTrigger asChild>
                                                <Button variant="ghost" size="icon"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                                            </AlertDialogTrigger>
                                            <AlertDialogContent>
                                                <AlertDialogHeader>
                                                    <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                                    <AlertDialogDescription>This action will delete the entire journal entry ({journalRef}). This cannot be undone.</AlertDialogDescription>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter>
                                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                    <AlertDialogAction onClick={() => handleDeleteJournal(journalRef, journalDate)}>Delete</AlertDialogAction>
                                                </AlertDialogFooter>
                                            </AlertDialogContent>
                                        </AlertDialog>
                                    </TableCell>
                                </TableRow>
                            )})
                        )}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
        <Separator />
         <Card>
            <CardHeader>
                <CardTitle>Posted General Journals</CardTitle>
            </CardHeader>
            <CardContent>
                 <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Date</TableHead>
                            <TableHead>Reference</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {Array.from(groupedGeneralJournals.entries()).length === 0 ? (
                            <TableRow><TableCell colSpan={3} className="text-center h-24 text-muted-foreground">No general journals have been posted yet.</TableCell></TableRow>
                        ) : (
                            Array.from(groupedGeneralJournals.values()).map((entries) => {
                                const journalRef = entries[0].reference;
                                const journalDate = entries[0].allocatedAt.toDate().toISOString();
                                return (
                                <TableRow key={`${journalRef}-${journalDate}`}>
                                    <TableCell>{format(new Date(entries[0].date), 'dd/MM/yyyy')}</TableCell>
                                    <TableCell>{journalRef}</TableCell>
                                    <TableCell className="text-right">
                                        <DialogTrigger asChild>
                                            <Button variant="ghost" size="icon" onClick={() => setViewingJournal(entries)}><Eye className="h-4 w-4" /></Button>
                                        </DialogTrigger>
                                        <Button variant="ghost" size="icon" onClick={() => handleEditJournal(entries)}><Edit className="h-4 w-4" /></Button>
                                        <AlertDialog>
                                            <AlertDialogTrigger asChild>
                                                <Button variant="ghost" size="icon"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                                            </AlertDialogTrigger>
                                            <AlertDialogContent>
                                                <AlertDialogHeader>
                                                    <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                                    <AlertDialogDescription>This action will delete the entire journal entry ({journalRef}). This cannot be undone.</AlertDialogDescription>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter>
                                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                    <AlertDialogAction onClick={() => handleDeleteJournal(journalRef, journalDate)}>Delete</AlertDialogAction>
                                                </AlertDialogFooter>
                                            </AlertDialogContent>
                                        </AlertDialog>
                                    </TableCell>
                                </TableRow>
                            )})
                        )}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
        <DialogContent className="sm:max-w-2xl">
            <DialogHeader>
                <DialogTitle>Journal Details: {viewingJournal?.[0]?.reference}</DialogTitle>
                <DialogDescription>
                    Date: {viewingJournal ? format(new Date(viewingJournal[0].date), 'dd MMMM yyyy') : ''}
                </DialogDescription>
            </DialogHeader>
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Description</TableHead>
                        <TableHead>Account</TableHead>
                        <TableHead className="text-right">Debit</TableHead>
                        <TableHead className="text-right">Credit</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {viewingJournal?.map(journal => {
                        const account = client?.chartOfAccounts?.find(a => a.id === journal.allocatedTo.value);
                        return (
                            <TableRow key={journal.id}>
                                <TableCell>{journal.description}</TableCell>
                                <TableCell>{account?.description || journal.allocatedTo.value}</TableCell>
                                <TableCell className="text-right font-mono">{formatPrice(journal.amount > 0 ? journal.amount : undefined)}</TableCell>
                                <TableCell className="text-right font-mono">{formatPrice(journal.amount < 0 ? -journal.amount : undefined)}</TableCell>
                            </TableRow>
                        );
                    })}
                </TableBody>
                <TableFooterComponent>
                    <TableRow>
                        <TableCell colSpan={2} className="font-bold">Totals</TableCell>
                        <TableCell className="text-right font-bold font-mono">{formatPrice(viewingJournal?.reduce((sum, j) => sum + (j.amount > 0 ? j.amount : 0), 0))}</TableCell>
                        <TableCell className="text-right font-bold font-mono">{formatPrice(viewingJournal?.reduce((sum, j) => sum + (j.amount < 0 ? -j.amount : 0), 0))}</TableCell>
                    </TableRow>
                </TableFooterComponent>
            </Table>
        </DialogContent>
    </div>
    </Dialog>
    );
}
