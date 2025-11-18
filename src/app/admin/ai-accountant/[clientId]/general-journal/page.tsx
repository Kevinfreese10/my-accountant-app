
'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm, useFieldArray } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, Plus, Trash2, CalendarIcon } from 'lucide-react';
import { getFirestore, doc, getDoc, collection, writeBatch, Timestamp, query, where, orderBy, getDocs, deleteDoc } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { useParams } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { User, ChartOfAccount, AllocatedTransaction } from '@/lib/types';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Separator } from '@/components/ui/separator';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

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
    if (price === undefined || price === null || isNaN(price) || price === 0) return '';
    return new Intl.NumberFormat('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(price);
};

export default function GeneralJournalsPage() {
    const params = useParams();
    const clientId = params.clientId as string;
    const [client, setClient] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [postedJournals, setPostedJournals] = useState<AllocatedTransaction[]>([]);
    const [taxJournals, setTaxJournals] = useState<AllocatedTransaction[]>([]);
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

    const { fields, append, remove } = useFieldArray({
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
                orderBy('date', 'desc')
            );
            const journalsSnapshot = await getDocs(journalsQuery);
            const allJournals = journalsSnapshot.docs.map(d => ({id: d.id, ...d.data()}) as AllocatedTransaction);
            
            const controlAccountIds = ['7000-000', '8000-001'];
            
            const generalOnlyJournals = allJournals.filter(tx => 
                !controlAccountIds.includes(tx.allocatedTo.value) && 
                !tx.reference.startsWith('TAX-')
            );
            
            const taxOnlyJournals = allJournals.filter(tx => tx.reference.startsWith('TAX-'));

            setPostedJournals(generalOnlyJournals);
            setTaxJournals(taxOnlyJournals);

        } catch (e) {
            toast({ title: 'Error', description: 'Failed to fetch client data or journals.', variant: 'destructive' });
        } finally {
            setIsLoading(false);
        }
    };


    useEffect(() => {
        fetchClientAndJournals();
    }, [clientId, toast]);
    
    const onSubmit = async (data: JournalFormValues) => {
        if (!client) return;
        setIsLoading(true);
        
        try {
            const batch = writeBatch(db);

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
                        allocatedAt: new Date(),
                    });
                }
            });

            await batch.commit();

            toast({ title: 'Journal Posted', description: 'The journal entry has been successfully recorded.' });
            form.reset({
                 date: new Date(),
                 reference: '',
                 lines: [
                    { accountId: '', description: '', debit: 0, credit: 0 },
                    { accountId: '', description: '', debit: 0, credit: 0 },
                ],
            });
            fetchClientAndJournals();
        } catch (error) {
            toast({ title: 'Error', description: 'Failed to post journal entry.', variant: 'destructive' });
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    };
    
    const handleDeleteJournal = async (journalReference: string) => {
      if (!client) return;
      
      const journalsToDelete = [...postedJournals, ...taxJournals].filter(
        (j) => j.reference === journalReference
      );

      if (journalsToDelete.length === 0) {
        toast({ title: 'Error', description: 'Could not find journal entries to delete.', variant: 'destructive'});
        return;
      }
      
      try {
        const batch = writeBatch(db);
        journalsToDelete.forEach(journal => {
          const docRef = doc(db, 'aiAccountantClients', client.id, 'transactions', journal.id);
          batch.delete(docRef);
        });
        await batch.commit();
        toast({ title: 'Journal Deleted', description: `Journal ${journalReference} has been deleted.`, variant: 'destructive'});
        fetchClientAndJournals();
      } catch (error) {
        console.error("Error deleting journal:", error);
        toast({ title: 'Error', description: 'Failed to delete journal.', variant: 'destructive'});
      }
    };

    if (isLoading && !client) {
        return <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin" /></div>;
    }

    return (
      <div className="space-y-8">
        <Card>
            <CardHeader>
                <div className="flex justify-between items-center">
                    <div>
                        <CardTitle>Post General Journal</CardTitle>
                        <CardDescription>Create manual journal entries between general ledger accounts.</CardDescription>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                           <FormField control={form.control} name="date" render={({ field }) => ( <FormItem><FormLabel>Date</FormLabel><Popover><PopoverTrigger asChild><FormControl><Button variant={"outline"} className={cn("w-full justify-start text-left font-normal", !field.value && "text-muted-foreground")}><CalendarIcon className="mr-2 h-4 w-4" />{field.value ? format(field.value, "dd/MM/yyyy") : <span>Pick a date</span>}</Button></FormControl></PopoverTrigger><PopoverContent className="w-auto p-0"><Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus /></PopoverContent></Popover><FormMessage /></FormItem> )}/>
                           <FormField control={form.control} name="reference" render={({ field }) => ( <FormItem><FormLabel>Reference</FormLabel><FormControl><Input placeholder="e.g., JNL001" {...field} /></FormControl><FormMessage /></FormItem> )}/>
                        </div>

                         <div className="border rounded-lg overflow-x-auto">
                           <table className="min-w-full divide-y divide-gray-200">
                             <thead className="bg-gray-50">
                               <tr>
                                 <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-2/5">Account</th>
                                 <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-2/5">Description</th>
                                 <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Debit</th>
                                 <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Credit</th>
                                 <th className="px-3 py-2"></th>
                               </tr>
                             </thead>
                             <tbody className="bg-white divide-y divide-gray-200">
                                {fields.map((field, index) => (
                                   <tr key={field.id}>
                                        <td className="px-2 py-1 whitespace-nowrap">
                                            <FormField control={form.control} name={`lines.${index}.accountId`} render={({ field }) => ( <FormItem><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger className="h-8"><SelectValue placeholder="Select account..." /></SelectTrigger></FormControl><SelectContent>{generalAccounts.map(acc => <SelectItem key={acc.id} value={acc.id}>{acc.accountNumber} - {acc.description}</SelectItem>)}</SelectContent></Select></FormItem> )}/>
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
                                Post Journal
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
                            <TableHead>Description</TableHead>
                            <TableHead>Account</TableHead>
                            <TableHead className="text-right">Debit</TableHead>
                            <TableHead className="text-right">Credit</TableHead>
                             <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {taxJournals.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={7} className="text-center h-24 text-muted-foreground">
                                    No tax journals have been posted yet.
                                </TableCell>
                            </TableRow>
                        ) : (
                            taxJournals.map(journal => {
                                const account = generalAccounts.find(a => a.id === journal.allocatedTo.value);
                                return (
                                <TableRow key={journal.id}>
                                    <TableCell>{format(new Date(journal.date), 'dd/MM/yyyy')}</TableCell>
                                    <TableCell>{journal.reference}</TableCell>
                                    <TableCell>{journal.description}</TableCell>
                                    <TableCell>{account?.description || journal.allocatedTo.value}</TableCell>
                                    <TableCell className="text-right font-mono">{formatPrice(journal.amount > 0 ? journal.amount : 0)}</TableCell>
                                    <TableCell className="text-right font-mono">{formatPrice(journal.amount < 0 ? -journal.amount : 0)}</TableCell>
                                     <TableCell className="text-right">
                                        <AlertDialog>
                                            <AlertDialogTrigger asChild>
                                                <Button variant="ghost" size="icon"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                                            </AlertDialogTrigger>
                                            <AlertDialogContent>
                                                <AlertDialogHeader>
                                                    <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                                    <AlertDialogDescription>This action will delete the entire journal entry ({journal.reference}). This cannot be undone.</AlertDialogDescription>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter>
                                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                    <AlertDialogAction onClick={() => handleDeleteJournal(journal.reference)}>Delete</AlertDialogAction>
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
                            <TableHead>Description</TableHead>
                            <TableHead>Account</TableHead>
                            <TableHead className="text-right">Debit</TableHead>
                            <TableHead className="text-right">Credit</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {postedJournals.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={6} className="text-center h-24 text-muted-foreground">
                                    No general journals have been posted yet.
                                </TableCell>
                            </TableRow>
                        ) : (
                            postedJournals.map(journal => {
                                const account = generalAccounts.find(a => a.id === journal.allocatedTo.value);
                                return (
                                <TableRow key={journal.id}>
                                    <TableCell>{format(new Date(journal.date), 'dd/MM/yyyy')}</TableCell>
                                    <TableCell>{journal.reference}</TableCell>
                                    <TableCell>{journal.description}</TableCell>
                                    <TableCell>{account?.description || journal.allocatedTo.value}</TableCell>
                                    <TableCell className="text-right font-mono">{formatPrice(journal.amount > 0 ? journal.amount : 0)}</TableCell>
                                    <TableCell className="text-right font-mono">{formatPrice(journal.amount < 0 ? -journal.amount : 0)}</TableCell>
                                </TableRow>
                            )})
                        )}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    </div>
    );
}
