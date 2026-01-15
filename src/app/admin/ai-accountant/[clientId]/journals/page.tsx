

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
import { Loader2, Plus, Trash2, CalendarIcon } from 'lucide-react';
import { getFirestore, doc, getDoc, collection, writeBatch, Timestamp, query, where, orderBy, getDocs, deleteDoc } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { useParams, useSearchParams } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { User, ChartOfAccount, ClientCustomer, Supplier, AllocatedTransaction } from '@/lib/types';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { allVatTypes } from '@/lib/vat-types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';


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
            
            const controlAccountId = journalType === 'customer' 
                ? clientSnap.data()?.chartOfAccounts?.find((acc: any) => acc.accountNumber === '8000-001')?.id
                : clientSnap.data()?.chartOfAccounts?.find((acc: any) => acc.accountNumber === '7000-000')?.id;
            
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
            const journalRef = `JNL-${Date.now()}`;

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
                    reference: line.reference || journalRef,
                    description: `Journal for ${primaryActorName}: ${line.description}`,
                    amount: primaryAmount,
                    bankAccountId: 'JOURNAL',
                    allocatedTo: { value: primaryAccountId, type: 'account' },
                    vatType: 'no_vat',
                    status: 'allocated',
                    allocatedAt: new Date(),
                });

                // Contra Entry
                const contraRef = doc(collection(db, 'aiAccountantClients', client.id, 'transactions'));
                batch.set(contraRef, {
                    clientId: client.id,
                    date: line.date.toISOString(),
                    reference: line.reference || journalRef,
                    description: line.description,
                    amount: -primaryAmount,
                    bankAccountId: 'JOURNAL',
                    allocatedTo: { value: line.affectingAccountId, type: 'account' },
                    vatType: line.vatType,
                    status: 'allocated',
                    allocatedAt: new Date(),
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
                                        const exclusiveAmount = isStandardRate ? journal.amount / 1.15 : journal.amount;
                                        const vatAmount = journal.amount - exclusiveAmount;

                                        return (
                                        <TableRow key={journal.id}>
                                            <TableCell>{format(new Date(journal.date), 'dd/MM/yyyy')}</TableCell>
                                            <TableCell>{journal.reference}</TableCell>
                                            <TableCell>{journal.description}</TableCell>
                                            <TableCell className="text-right font-mono">{formatPrice(exclusiveAmount)}</TableCell>
                                            <TableCell className="text-right font-mono">{formatPrice(vatAmount)}</TableCell>
                                            <TableCell className="text-right font-mono">{formatPrice(journal.amount)}</TableCell>
                                            <TableCell className="text-right">
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
    );
}
