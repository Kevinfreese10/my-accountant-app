
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
import { Loader2, Plus, Trash2, CalendarIcon, Edit } from 'lucide-react';
import { getFirestore, doc, getDoc, collection, writeBatch, Timestamp, query, where, orderBy, getDocs, deleteDoc } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { useParams, useSearchParams } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { User, ChartOfAccount, ClientCustomer, Supplier, AllocatedTransaction } from '@/lib/types';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { allVatTypes, VatType } from '@/lib/vat-types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';

const db = getFirestore(firebaseApp);

const journalLineSchema = z.object({
  date: z.date(),
  effect: z.enum(['Increase', 'Decrease']),
  actorId: z.string().min(1, "Please select a customer or supplier."),
  reference: z.string().optional(),
  description: z.string().min(1, "Description is required."),
  vatType: z.string(),
  exclusiveAmount: z.number().min(0, "Amount must be positive."),
  vatAmount: z.number(),
  inclusiveAmount: z.number(),
  affectingAccountId: z.string().min(1, "Affecting account is required."),
});

const formSchema = z.object({
  lines: z.array(journalLineSchema).min(1, "At least one journal line is required."),
});

type JournalFormValues = z.infer<typeof formSchema>;

const editJournalFormSchema = z.object({
  reference: z.string(),
  date: z.date(),
  lines: z.array(z.object({
    id: z.string(), // Keep track of the original transaction ID
    accountId: z.string().min(1),
    description: z.string().min(1),
    amount: z.number(),
    vatType: z.string(),
  })),
});
type EditJournalFormValues = z.infer<typeof editJournalFormSchema>;


function EditJournalDialog({ isOpen, onOpenChange, journalEntries, client, onSave }: { isOpen: boolean, onOpenChange: (open: boolean) => void, journalEntries: AllocatedTransaction[] | null, client: User | null, onSave: (data: EditJournalFormValues) => void }) {
    const form = useForm<EditJournalFormValues>({
        resolver: zodResolver(editJournalFormSchema),
        defaultValues: {
            reference: '',
            date: new Date(),
            lines: [],
        },
    });

    useEffect(() => {
        if (journalEntries && journalEntries.length > 0) {
            const date = journalEntries[0].date;
            form.reset({
                reference: journalEntries[0].reference,
                date: date?.toDate ? date.toDate() : new Date(date),
                lines: journalEntries.map(entry => ({
                    id: entry.id,
                    accountId: entry.allocatedTo.value,
                    description: entry.description,
                    amount: entry.amount,
                    vatType: entry.vatType || 'no_vat',
                })),
            });
        }
    }, [journalEntries, form]);

    const { fields } = useFieldArray({
        control: form.control,
        name: "lines",
    });

    const totalDebits = fields.reduce((sum, line, index) => sum + (form.watch(`lines.${index}.amount`) > 0 ? form.watch(`lines.${index}.amount`) : 0), 0);
    const totalCredits = fields.reduce((sum, line, index) => sum + (form.watch(`lines.${index}.amount`) < 0 ? -form.watch(`lines.${index}.amount`) : 0), 0);
    
    const formatPrice = (price: number) => {
        if (price === 0) return '';
        return new Intl.NumberFormat('en-ZA', {
          style: 'currency',
          currency: 'ZAR',
        }).format(price);
    };

    if (!isOpen || !journalEntries) return null;

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-4xl">
                <DialogHeader>
                    <DialogTitle>Edit Journal: {journalEntries[0].reference}</DialogTitle>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSave)} className="space-y-4">
                        <div className="max-h-[60vh] overflow-y-auto p-1 pr-4 space-y-4">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Account</TableHead>
                                        <TableHead>Description</TableHead>
                                        <TableHead>VAT Type</TableHead>
                                        <TableHead className="text-right">Debit</TableHead>
                                        <TableHead className="text-right">Credit</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {fields.map((field, index) => (
                                        <TableRow key={field.id}>
                                            <TableCell className="w-[200px]">
                                                <FormField
                                                    control={form.control}
                                                    name={`lines.${index}.accountId`}
                                                    render={({ field }) => (
                                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                            <FormControl><SelectTrigger className="h-8"><SelectValue /></SelectTrigger></FormControl>
                                                            <SelectContent>{client?.chartOfAccounts?.map(acc => <SelectItem key={acc.id} value={acc.id}>{acc.description}</SelectItem>)}</SelectContent>
                                                        </Select>
                                                    )}
                                                />
                                            </TableCell>
                                            <TableCell>
                                                <FormField control={form.control} name={`lines.${index}.description`} render={({ field }) => <Input className="h-8" {...field} />} />
                                            </TableCell>
                                             <TableCell className="w-[200px]">
                                                <FormField
                                                    control={form.control}
                                                    name={`lines.${index}.vatType`}
                                                    render={({ field }) => (
                                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                            <FormControl><SelectTrigger className="h-8"><SelectValue /></SelectTrigger></FormControl>
                                                            <SelectContent>{allVatTypes.map(vt => <SelectItem key={vt.name} value={vt.name}>{vt.label}</SelectItem>)}</SelectContent>
                                                        </Select>
                                                    )}
                                                />
                                            </TableCell>
                                            <TableCell>
                                                <FormField
                                                    control={form.control}
                                                    name={`lines.${index}.amount`}
                                                    render={({ field }) => (
                                                        <Input
                                                            type="number" step="0.01" className="h-8 text-right"
                                                            value={field.value > 0 ? field.value : ''}
                                                            onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                                                            disabled={field.value < 0}
                                                        />
                                                    )}
                                                />
                                            </TableCell>
                                             <TableCell>
                                                <FormField
                                                    control={form.control}
                                                    name={`lines.${index}.amount`}
                                                    render={({ field }) => (
                                                        <Input
                                                            type="number" step="0.01" className="h-8 text-right"
                                                            value={field.value < 0 ? -field.value : ''}
                                                            onChange={(e) => field.onChange(-(parseFloat(e.target.value) || 0))}
                                                            disabled={field.value > 0}
                                                        />
                                                    )}
                                                />
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                    <TableRow className="font-bold bg-muted">
                                        <TableCell colSpan={3}>Totals</TableCell>
                                        <TableCell className="text-right">{formatPrice(totalDebits)}</TableCell>
                                        <TableCell className="text-right">{formatPrice(totalCredits)}</TableCell>
                                    </TableRow>
                                </TableBody>
                            </Table>
                        </div>
                        <DialogFooter>
                            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
                            <Button type="submit">Update Journal</Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    )
}

export default function JournalsPage() {
    const params = useParams();
    const searchParams = useSearchParams();
    const clientId = params.clientId as string;
    const journalType = searchParams.get('type') || 'customer';
    
    const [client, setClient] = useState<User | null>(null);
    const [customers, setCustomers] = useState<ClientCustomer[]>([]);
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [postedJournals, setPostedJournals] = useState<AllocatedTransaction[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const { toast } = useToast();
    const [isEditFormOpen, setIsEditFormOpen] = useState(false);
    const [editingJournal, setEditingJournal] = useState<AllocatedTransaction[] | null>(null);

    const form = useForm<JournalFormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            lines: [{
                date: new Date(),
                effect: 'Increase',
                actorId: '',
                description: '',
                vatType: 'no_vat',
                exclusiveAmount: 0,
                vatAmount: 0,
                inclusiveAmount: 0,
                affectingAccountId: '',
            }],
        },
    });

    const { fields, append, remove } = useFieldArray({
        control: form.control,
        name: "lines",
    });

    const fetchRelatedData = async () => {
        if (!clientId) return;
        setIsLoading(true);
        try {
            const clientRef = doc(db, 'aiAccountantClients', clientId);
            const clientSnap = await getDoc(clientRef);
            if (clientSnap.exists()) {
                setClient(clientSnap.data() as User);
            }

            const customersQuery = query(collection(db, `aiAccountantClients/${clientId}/customers`));
            const customersSnapshot = await getDocs(customersQuery);
            setCustomers(customersSnapshot.docs.map(d => ({id: d.id, ...d.data()} as ClientCustomer)));

            const suppliersQuery = query(collection(db, `aiAccountantClients/${clientId}/suppliers`));
            const suppliersSnapshot = await getDocs(suppliersQuery);
            setSuppliers(suppliersSnapshot.docs.map(d => ({id: d.id, ...d.data()} as Supplier)));
            
            const controlAccountConfig = {
                customer: clientSnap.data()?.chartOfAccounts?.find((acc: any) => acc.accountNumber === '8000-001')?.id,
                supplier: clientSnap.data()?.chartOfAccounts?.find((acc: any) => acc.accountNumber === '7000-000')?.id,
            };
            const controlAccountId = controlAccountConfig[journalType as keyof typeof controlAccountConfig];
            
            if (controlAccountId) {
                const journalsQuery = query(
                    collection(db, 'aiAccountantClients', clientId, 'transactions'),
                    where('bankAccountId', '==', 'JOURNAL'),
                    where('allocatedTo.value', '==', controlAccountId),
                    orderBy('date', 'desc')
                );
                const journalsSnapshot = await getDocs(journalsQuery);
                setPostedJournals(journalsSnapshot.docs.map(d => ({id: d.id, ...d.data()}) as AllocatedTransaction));
            }

        } catch (e) {
            toast({ title: 'Error', description: 'Failed to fetch client data.', variant: 'destructive' });
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchRelatedData();
    }, [clientId, toast, journalType]);
    
     const updateLineAmounts = (index: number) => {
        const line = form.getValues(`lines.${index}`);
        const vatRate = line.vatType === 'standard_rated_sales' || line.vatType === 'standard_rated_purchases' ? 0.15 : 0;
        const vatAmount = line.exclusiveAmount * vatRate;
        const inclusiveAmount = line.exclusiveAmount + vatAmount;
        form.setValue(`lines.${index}.vatAmount`, vatAmount);
        form.setValue(`lines.${index}.inclusiveAmount`, inclusiveAmount);
    };

    const onSubmit = async (data: JournalFormValues) => {
        if (!client) return;
        setIsLoading(true);
        
        try {
            const batch = writeBatch(db);
            const journalTimestamp = Timestamp.now();

            const customerControlAccount = client.chartOfAccounts?.find(acc => acc.accountNumber === '8000-001')?.id;
            const supplierControlAccount = client.chartOfAccounts?.find(acc => acc.accountNumber === '7000-000')?.id;
            
            if (!customerControlAccount || !supplierControlAccount) {
                toast({ title: 'Error', description: 'Customer or Supplier control account not found.', variant: 'destructive' });
                setIsLoading(false);
                return;
            }

            data.lines.forEach((line) => {
                let primaryAmount = line.inclusiveAmount;
                if (line.effect === 'Decrease') {
                    primaryAmount = -primaryAmount;
                }

                const primaryAccountId = journalType === 'customer' ? customerControlAccount : supplierControlAccount;
                const actorList = journalType === 'customer' ? customers : suppliers;
                const primaryActorName = actorList.find(a => a.id === line.actorId)?.name;

                // Entry for the Customer/Supplier control account
                const primaryRef = doc(collection(db, 'aiAccountantClients', client.id, 'transactions'));
                batch.set(primaryRef, {
                    clientId: client.id,
                    date: line.date.toISOString(),
                    reference: line.reference || `JNL-${journalTimestamp.seconds}`,
                    description: `Journal for ${primaryActorName}: ${line.description}`,
                    amount: primaryAmount,
                    bankAccountId: 'JOURNAL',
                    allocatedTo: { value: primaryAccountId, type: 'account' },
                    vatType: 'no_vat',
                    status: 'allocated',
                    allocatedAt: journalTimestamp,
                });

                // Contra Entry
                const contraRef = doc(collection(db, 'aiAccountantClients', client.id, 'transactions'));
                batch.set(contraRef, {
                    clientId: client.id,
                    date: line.date.toISOString(),
                    reference: line.reference || `JNL-${journalTimestamp.seconds}`,
                    description: line.description,
                    amount: -primaryAmount,
                    bankAccountId: 'JOURNAL',
                    allocatedTo: { value: line.affectingAccountId, type: 'account' },
                    vatType: line.vatType,
                    status: 'allocated',
                    allocatedAt: journalTimestamp,
                });
            });

            await batch.commit();

            toast({ title: 'Journal Posted', description: 'The journal entry has been successfully recorded.' });
            form.reset({
                lines: [{
                    date: new Date(),
                    effect: 'Increase',
                    actorId: '',
                    description: '',
                    vatType: 'no_vat',
                    exclusiveAmount: 0,
                    vatAmount: 0,
                    inclusiveAmount: 0,
                    affectingAccountId: '',
                }],
            });
            fetchRelatedData();
        } catch (error) {
            toast({ title: 'Error', description: 'Failed to post journal entry.', variant: 'destructive' });
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    };
    
    const handleEditJournal = async (reference: string) => {
        if (!client) return;
        const q = query(
            collection(db, "aiAccountantClients", client.id, "transactions"), 
            where("reference", "==", reference)
        );
        const snapshot = await getDocs(q);
        const entries = snapshot.docs.map(d => ({id: d.id, ...d.data()}) as AllocatedTransaction);
        setEditingJournal(entries);
        setIsEditFormOpen(true);
    };

    const handleUpdateJournal = async (values: EditJournalFormValues) => {
        if (!client || !editingJournal) return;
        setIsLoading(true);
        try {
            const batch = writeBatch(db);
            const transactionsToUpdate = new Map(editingJournal.map(tx => [tx.id, tx]));

            for (const line of values.lines) {
                const txData = transactionsToUpdate.get(line.id);
                if (txData) {
                    const docRef = doc(db, "aiAccountantClients", client.id, "transactions", line.id);
                    batch.update(docRef, {
                        'allocatedTo.value': line.accountId,
                        description: line.description,
                        amount: line.amount,
                        vatType: line.vatType
                    });
                }
            }

            await batch.commit();
            toast({ title: 'Journal Updated Successfully!' });
            setIsEditFormOpen(false);
            setEditingJournal(null);
            fetchRelatedData();
        } catch (error) {
            console.error("Error updating journal:", error);
            toast({ title: 'Update Failed', variant: 'destructive' });
        } finally {
            setIsLoading(false);
        }
    };

    const handleDeleteJournal = async (journal: AllocatedTransaction) => {
        if (!client) return;

        try {
            const batch = writeBatch(db);
            const q = query(
                collection(db, "aiAccountantClients", client.id, "transactions"), 
                where("reference", "==", journal.reference),
                where("allocatedAt", "==", journal.allocatedAt)
            );
            const querySnapshot = await getDocs(q);
            querySnapshot.forEach(doc => {
                batch.delete(doc.ref);
            });
            await batch.commit();
            
            toast({ title: 'Journal Deleted', description: `Journal ${journal.reference} has been removed.`, variant: 'destructive' });
            fetchRelatedData();

        } catch (error) {
            console.error("Error deleting journal:", error);
            toast({ title: 'Error', description: 'Failed to delete journal entry.', variant: 'destructive' });
        }
    };
    
    const formatPrice = (price: number) => {
        if (price === 0) return '';
        return new Intl.NumberFormat('en-ZA', {
          style: 'currency',
          currency: 'ZAR',
        }).format(price);
    };

    return (
      <>
        <Card>
            <CardHeader>
                <div className="flex justify-between items-center">
                    <div>
                        <CardTitle>Post {journalType === 'customer' ? 'Customer' : 'Supplier'} Journals</CardTitle>
                        <CardDescription>Create manual journal entries. Each line represents a distinct entry.</CardDescription>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                <Tabs defaultValue="new">
                    <TabsList>
                        <TabsTrigger value="new">New Journal</TabsTrigger>
                        <TabsTrigger value="posted">Posted Journals</TabsTrigger>
                    </TabsList>
                    <TabsContent value="new" className="pt-4">
                        <Form {...form}>
                            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                                <div className="border rounded-lg overflow-x-auto">
                                <table className="min-w-full divide-y divide-gray-200">
                                    <thead className="bg-gray-50">
                                        <tr>
                                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Effect</th>
                                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{journalType === 'customer' ? 'Customer' : 'Supplier'}</th>
                                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Reference</th>
                                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">VAT %</th>
                                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Excl. VAT</th>
                                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">VAT</th>
                                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Incl. VAT</th>
                                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Affecting Acc.</th>
                                        <th className="px-3 py-2"></th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                        {fields.map((field, index) => (
                                        <tr key={field.id}>
                                                <td className="px-2 py-1 whitespace-nowrap">
                                                    <FormField control={form.control} name={`lines.${index}.date`} render={({ field }) => ( <FormItem><Popover><PopoverTrigger asChild><FormControl><Button variant={"outline"} size="sm" className="w-[150px] justify-start text-left font-normal h-8"><CalendarIcon className="mr-2 h-4 w-4" />{field.value ? format(field.value, "dd/MM/yyyy") : <span>Pick a date</span>}</Button></FormControl></PopoverTrigger><PopoverContent className="w-auto p-0"><Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus /></PopoverContent></Popover></FormItem> )}/>
                                                </td>
                                                <td className="px-2 py-1 whitespace-nowrap">
                                                    <FormField control={form.control} name={`lines.${index}.effect`} render={({ field }) => ( <FormItem><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger className="h-8 w-[120px]"><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value="Increase">Increase</SelectItem><SelectItem value="Decrease">Decrease</SelectItem></SelectContent></Select></FormItem> )}/>
                                                </td>
                                                <td className="px-2 py-1 whitespace-nowrap">
                                                    <FormField control={form.control} name={`lines.${index}.actorId`} render={({ field }) => ( <FormItem><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger className="h-8 w-[200px]"><SelectValue placeholder="Select..." /></SelectTrigger></FormControl><SelectContent>{(journalType === 'customer' ? customers : suppliers).map(item => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent></Select></FormItem> )}/>
                                                </td>
                                                <td className="px-2 py-1 whitespace-nowrap"><FormField control={form.control} name={`lines.${index}.reference`} render={({ field }) => ( <Input className="h-8" {...field} /> )}/></td>
                                                <td className="px-2 py-1 whitespace-nowrap"><FormField control={form.control} name={`lines.${index}.description`} render={({ field }) => ( <Input className="h-8" {...field} /> )}/></td>
                                                <td className="px-2 py-1 whitespace-nowrap">
                                                    <FormField control={form.control} name={`lines.${index}.vatType`} render={({ field }) => ( <FormItem><Select onValueChange={(value) => { field.onChange(value); updateLineAmounts(index); }} defaultValue={field.value}><FormControl><SelectTrigger className="h-8 w-[180px]"><SelectValue /></SelectTrigger></FormControl><SelectContent>{allVatTypes.map(vt => ( <SelectItem key={vt.name} value={vt.name}>{vt.label}</SelectItem>))}</SelectContent></Select></FormItem> )}/>
                                                </td>
                                                <td className="px-2 py-1 whitespace-nowrap"><FormField control={form.control} name={`lines.${index}.exclusiveAmount`} render={({ field }) => ( <Input type="number" className="h-8" {...field} onChange={(e) => {field.onChange(parseFloat(e.target.value) || 0); updateLineAmounts(index); }} /> )}/></td>
                                                <td className="px-2 py-1 whitespace-nowrap"><FormField control={form.control} name={`lines.${index}.vatAmount`} render={({ field }) => ( <Input type="number" className="h-8 bg-muted" readOnly {...field} /> )}/></td>
                                                <td className="px-2 py-1 whitespace-nowrap"><FormField control={form.control} name={`lines.${index}.inclusiveAmount`} render={({ field }) => ( <Input type="number" className="h-8 bg-muted" readOnly {...field} /> )}/></td>
                                                <td className="px-2 py-1 whitespace-nowrap">
                                                    <FormField control={form.control} name={`lines.${index}.affectingAccountId`} render={({ field }) => ( <FormItem><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger className="h-8 w-[200px]"><SelectValue placeholder="Select account..." /></SelectTrigger></FormControl><SelectContent>{client?.chartOfAccounts?.filter(a => a.section === 'Income Statement').map(acc => ( <SelectItem key={acc.id} value={acc.id}>{acc.description}</SelectItem>))}</SelectContent></Select></FormItem> )}/>
                                                </td>
                                                <td className="px-2 py-1 whitespace-nowrap">
                                                    <Button type="button" size="icon" variant="ghost" onClick={() => remove(index)} disabled={fields.length <= 1}><Trash2 className="h-4 w-4 text-red-600" /></Button>
                                                </td>
                                        </tr>
                                        ))}
                                    </tbody>
                                </table>
                                </div>
                                <Button type="button" variant="outline" size="sm" onClick={() => append({ date: new Date(), effect: 'Increase', actorId: '', description: '', vatType: 'no_vat', exclusiveAmount: 0, vatAmount: 0, inclusiveAmount: 0, affectingAccountId: ''})}><Plus className="mr-2 h-4 w-4" /> Add Line</Button>
                                <CardFooter className="p-4 bg-muted rounded-b-lg mt-4 flex justify-end">
                                    <Button type="submit" disabled={isLoading}>
                                        {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                        Post Journals
                                    </Button>
                                </CardFooter>
                            </form>
                        </Form>
                    </TabsContent>
                    <TabsContent value="posted">
                         <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Date</TableHead>
                                    <TableHead>Reference</TableHead>
                                    <TableHead>Description</TableHead>
                                    <TableHead className="text-right">Exclusive</TableHead>
                                    <TableHead className="text-right">VAT</TableHead>
                                    <TableHead className="text-right">Inclusive</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {postedJournals.length === 0 ? (
                                    <TableRow><TableCell colSpan={7} className="text-center h-24 text-muted-foreground">No journals posted yet.</TableCell></TableRow>
                                ) : (
                                    postedJournals.map((journal) => {
                                        const isStandardRate = journal.vatType === 'standard_rated_sales' || journal.vatType === 'standard_rated_purchases';
                                        const vatRate = client?.isVatRegistered && isStandardRate ? 0.15 : 0;
                                        
                                        const inclusiveAmount = journal.amount;
                                        const exclusiveAmount = isStandardRate ? inclusiveAmount / (1 + vatRate) : inclusiveAmount;
                                        const vatAmount = inclusiveAmount - exclusiveAmount;

                                        const date = journal.date;
                                        const formattedDate = date ? (date.toDate ? format(date.toDate(), 'dd/MM/yyyy') : format(new Date(date), 'dd/MM/yyyy')) : 'N/A';

                                        return (
                                        <TableRow key={journal.id}>
                                            <TableCell>{formattedDate}</TableCell>
                                            <TableCell>{journal.reference}</TableCell>
                                            <TableCell>{journal.description}</TableCell>
                                            <TableCell className="text-right font-mono">{formatPrice(exclusiveAmount)}</TableCell>
                                            <TableCell className="text-right font-mono">{formatPrice(vatAmount)}</TableCell>
                                            <TableCell className="text-right font-mono">{formatPrice(inclusiveAmount)}</TableCell>
                                            <TableCell className="text-right">
                                                <Button variant="ghost" size="icon" onClick={() => handleEditJournal(journal.reference)}><Edit className="h-4 w-4" /></Button>
                                                <AlertDialog>
                                                    <AlertDialogTrigger asChild>
                                                        <Button variant="ghost" size="icon"><Trash2 className="h-4 w-4 text-destructive"/></Button>
                                                    </AlertDialogTrigger>
                                                    <AlertDialogContent>
                                                        <AlertDialogHeader>
                                                            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                                            <AlertDialogDescription>This action will delete the entire journal entry ({journal.reference}). This cannot be undone.</AlertDialogDescription>
                                                        </AlertDialogHeader>
                                                        <AlertDialogFooter>
                                                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                            <AlertDialogAction onClick={() => handleDeleteJournal(journal)}>Delete</AlertDialogAction>
                                                        </AlertDialogFooter>
                                                    </AlertDialogContent>
                                                </AlertDialog>
                                            </TableCell>
                                        </TableRow>
                                    )})
                                )}
                            </TableBody>
                        </Table>
                    </TabsContent>
                </Tabs>
            </CardContent>
        </Card>
        {client && <EditJournalDialog isOpen={isEditFormOpen} onOpenChange={setIsEditFormOpen} journalEntries={editingJournal} client={client} onSave={handleUpdateJournal} />}
      </>
    );
}

    