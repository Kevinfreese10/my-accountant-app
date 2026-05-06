'use client';

import * as React from "react";
import { useState, useEffect, useMemo, Suspense } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm, useFieldArray } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, Plus, Trash2, CalendarIcon, Eye, Edit, ChevronsUpDown, PlusCircle, Calculator, AlertCircle, CheckCircle, FileUp, Download, X, ListTree, ArrowRightLeft } from 'lucide-react';
import { getFirestore, doc, collection, writeBatch, Timestamp, query, where, orderBy, getDocs, deleteDoc, arrayUnion, setDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { useParams, useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { User, ChartOfAccount, AllocatedTransaction, VatType } from '@/lib/types';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { format, parse, isValid } from 'date-fns';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter as TableFooterComponent } from '@/components/ui/table';
import { Separator } from '@/components/ui/separator';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList, CommandGroup } from '@/components/ui/command';
import { allVatTypes } from '@/lib/vat-types';
import * as XLSX from 'xlsx';
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';

const db = getFirestore(firebaseApp);

// #region Schemas

const quickJournalLineSchema = z.object({
  date: z.date({ required_error: "Date is required." }),
  effect: z.enum(['Debit', 'Credit']),
  accountId: z.string().min(1, "Account is required."),
  reference: z.string().min(1, "Ref is required."),
  description: z.string().min(1, "Description is required."),
  vatType: z.string().default('no_vat'),
  inclusiveAmount: z.number().min(0.01, "Amount required."),
  exclusiveAmount: z.number().optional(),
  vatAmount: z.number().optional(),
  affectingAccountId: z.string().min(1, "Contra account required."),
});

const complexJournalLineSchema = z.object({
  date: z.date({ required_error: "Date is required." }),
  accountId: z.string().min(1, "Account is required."),
  description: z.string().min(1, "Description is required."),
  debit: z.number().min(0).optional(),
  credit: z.number().min(0).optional(),
  vatType: z.string().default('no_vat'),
});

const quickFormSchema = z.object({
  lines: z.array(quickJournalLineSchema).min(1),
});

const complexFormSchema = z.object({
  reference: z.string().min(1, "Batch reference required."),
  lines: z.array(complexJournalLineSchema).min(2),
}).refine(data => {
    const groups: Record<string, typeof data.lines> = {};
    data.lines.forEach(line => {
        const dateKey = format(line.date, 'yyyy-MM-dd');
        if (!groups[dateKey]) groups[dateKey] = [];
        groups[dateKey].push(line);
    });

    return Object.values(groups).every(groupLines => {
        const totalDebits = groupLines.reduce((acc, line) => {
            const base = line.debit || 0;
            const vat = (line.vatType === 'standard_rated_purchases' || line.vatType === 'standard_rated_sales' || line.vatType === 'capital_goods_purchases') ? base * 0.15 : 0;
            return acc + base + vat;
        }, 0);
        const totalCredits = groupLines.reduce((acc, line) => {
            const base = line.credit || 0;
            const vat = (line.vatType === 'standard_rated_purchases' || line.vatType === 'standard_rated_sales' || line.vatType === 'capital_goods_purchases') ? base * 0.15 : 0;
            return acc + base + vat;
        }, 0);
        return Math.abs(totalDebits - totalCredits) < 0.01;
    });
}, {
    message: "Each unique date must balance (Incl Debits == Incl Credits).",
    path: ["lines"],
});

// #endregion

const formatPrice = (price: number | undefined) => {
    if (price === undefined || price === null || isNaN(price)) return '0.00';
    return new Intl.NumberFormat('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(price);
};

function CreateGeneralAccountDialog({ client, onAccountCreated, open, onOpenChange }: { client: User | null; onAccountCreated: () => void; open: boolean; onOpenChange: (open: boolean) => void }) {
    const { toast } = useToast();
    const [isSaving, setIsSaving] = useState(false);
    const form = useForm({
        resolver: zodResolver(z.object({
            accountNumber: z.string().min(1),
            description: z.string().min(3),
            section: z.enum(['Income Statement', 'Balance Sheet']),
        })),
        defaultValues: { accountNumber: '', description: '', section: 'Income Statement' as const },
    });

    const handleCreateAccount = async (values: any) => {
        if (!client || !client.uid) return;
        setIsSaving(true);
        try {
            const clientRef = doc(db, 'aiAccountantClients', client.uid);
            await updateDoc(clientRef, { chartOfAccounts: arrayUnion({ ...values, id: values.accountNumber }) });
            toast({ title: 'Account Created' });
            onAccountCreated();
            onOpenChange(false);
        } catch (error) {
            toast({ title: 'Error', variant: 'destructive' });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader><DialogTitle>Create New Account</DialogTitle></DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(handleCreateAccount)} className="space-y-4">
                        <FormField control={form.control} name="accountNumber" render={({ field }) => ( <FormItem><FormLabel>Account Number</FormLabel><FormControl><Input placeholder="e.g. 3000-058" {...field} /></FormControl><FormMessage /></FormItem>)} />
                        <FormField control={form.control} name="description" render={({ field }) => ( <FormItem><FormLabel>Description</FormLabel><FormControl><Input placeholder="e.g. Cleaning Materials" {...field} /></FormControl><FormMessage /></FormItem>)} />
                        <FormField control={form.control} name="section" render={({ field }) => ( <FormItem><FormLabel>Section</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value="Income Statement">Income Statement</SelectItem><SelectItem value="Balance Sheet">Balance Sheet</SelectItem></SelectContent></Select></FormItem>)} />
                        <DialogFooter><Button type="submit" disabled={isSaving}>Create</Button></DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}

function JournalManager({ clientId, client, fetchClientAndJournals, allJournals, isLoading, setIsLoading }: { clientId: string, client: User | null, fetchClientAndJournals: () => void, allJournals: AllocatedTransaction[], isLoading: boolean, setIsLoading: (val: boolean) => void }) {
    const { toast } = useToast();
    const [viewingJournal, setViewingJournal] = useState<AllocatedTransaction[] | null>(null);
    const [isCreateAccountOpen, setIsCreateAccountOpen] = useState(false);
    const [entryMode, setEntryMode] = useState<'quick' | 'complex'>('quick');

    // #region Quick Form Setup
    const quickForm = useForm<z.infer<typeof quickFormSchema>>({
        resolver: zodResolver(quickFormSchema),
        defaultValues: {
            lines: [{ date: new Date(), effect: 'Debit', accountId: '', reference: '', description: '', vatType: 'no_vat', inclusiveAmount: 0, exclusiveAmount: 0, vatAmount: 0, affectingAccountId: '' }]
        }
    });

    const { fields: quickFields, append: appendQuick, remove: removeQuick } = useFieldArray({
        control: quickForm.control,
        name: "lines"
    });

    const updateQuickAmounts = (index: number) => {
        const line = quickForm.getValues(`lines.${index}`);
        const isStandard = line.vatType === 'standard_rated_sales' || line.vatType === 'standard_rated_purchases' || line.vatType === 'capital_goods_purchases';
        
        const inclusive = line.inclusiveAmount || 0;
        const exclusive = isStandard ? inclusive / 1.15 : inclusive;
        const vat = inclusive - exclusive;

        quickForm.setValue(`lines.${index}.exclusiveAmount`, exclusive);
        quickForm.setValue(`lines.${index}.vatAmount`, vat);
    };

    const onQuickSubmit = async (data: z.infer<typeof quickFormSchema>) => {
        if (!client) return;
        setIsLoading(true);
        try {
            const batch = writeBatch(db);
            const journalTimestamp = Timestamp.now();
            const vatControlAccount = client.chartOfAccounts?.find(acc => acc.accountNumber === '7000-008')?.id;

            for (const line of data.lines) {
                const isStandard = line.vatType === 'standard_rated_sales' || line.vatType === 'standard_rated_purchases' || line.vatType === 'capital_goods_purchases';
                const excl = line.exclusiveAmount || 0;
                const vat = line.vatAmount || 0;
                const incl = line.inclusiveAmount || 0;
                
                const multiplier = line.effect === 'Debit' ? 1 : -1;

                // 1. Primary Account (Exclusive)
                const pRef = doc(collection(db, 'aiAccountantClients', client.id, 'transactions'));
                batch.set(pRef, {
                    clientId: client.id,
                    date: line.date.toISOString(),
                    reference: line.reference,
                    description: line.description,
                    amount: excl * multiplier,
                    isExpense: (excl * multiplier) < 0,
                    bankAccountId: 'JOURNAL',
                    allocatedTo: { value: line.accountId, type: 'account' },
                    vatType: line.vatType as VatType,
                    status: 'allocated',
                    allocatedAt: journalTimestamp,
                });

                // 2. Affecting Account (Inclusive)
                const aRef = doc(collection(db, 'aiAccountantClients', client.id, 'transactions'));
                batch.set(aRef, {
                    clientId: client.id,
                    date: line.date.toISOString(),
                    reference: line.reference,
                    description: `Contra: ${line.description}`,
                    amount: -(incl * multiplier),
                    isExpense: -(incl * multiplier) < 0,
                    bankAccountId: 'JOURNAL',
                    allocatedTo: { value: line.affectingAccountId, type: 'account' },
                    vatType: 'no_vat',
                    status: 'allocated',
                    allocatedAt: journalTimestamp,
                });

                // 3. VAT Entry
                if (isStandard && vat !== 0 && vatControlAccount) {
                    const vRef = doc(collection(db, 'aiAccountantClients', client.id, 'transactions'));
                    batch.set(vRef, {
                        clientId: client.id,
                        date: line.date.toISOString(),
                        reference: line.reference,
                        description: `VAT on: ${line.description}`,
                        amount: vat * multiplier,
                        isExpense: (vat * multiplier) < 0,
                        bankAccountId: 'JOURNAL',
                        allocatedTo: { value: vatControlAccount, type: 'account' },
                        vatType: 'no_vat',
                        status: 'allocated',
                        allocatedAt: journalTimestamp,
                    });
                }
            }

            await batch.commit();
            toast({ title: "Journal Posted Successfully" });
            quickForm.reset();
            fetchClientAndJournals();
        } catch (e) {
            toast({ title: "Error Posting", variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    };
    // #endregion

    // #region Complex Form Setup
    const complexForm = useForm<z.infer<typeof complexFormSchema>>({
        resolver: zodResolver(complexFormSchema),
        defaultValues: {
            reference: '',
            lines: [
                { date: new Date(), accountId: '', description: '', debit: 0, credit: 0, vatType: 'no_vat' },
                { date: new Date(), accountId: '', description: '', debit: 0, credit: 0, vatType: 'no_vat' },
            ],
        },
    });

    const { fields: complexFields, append: appendComplex, remove: removeComplex } = useFieldArray({
        control: complexForm.control,
        name: "lines",
    });

    const onComplexSubmit = async (data: z.infer<typeof complexFormSchema>) => {
        if (!client) return;
        setIsLoading(true);
        try {
            const batch = writeBatch(db);
            const journalTimestamp = Timestamp.now();
            const vatControlAccount = client.chartOfAccounts?.find(acc => acc.accountNumber === '7000-008')?.id;

            for (const line of data.lines) {
                const amount = (line.debit || 0) - (line.credit || 0);
                if (amount === 0) continue;

                const isStandardVat = line.vatType === 'standard_rated_purchases' || line.vatType === 'standard_rated_sales' || line.vatType === 'capital_goods_purchases';
                const vatAmount = isStandardVat ? amount * 0.15 : 0;

                const ref = doc(collection(db, 'aiAccountantClients', client.id, 'transactions'));
                batch.set(ref, {
                    clientId: client.id,
                    date: line.date.toISOString(),
                    reference: data.reference,
                    description: line.description,
                    amount: amount,
                    isExpense: amount < 0,
                    bankAccountId: 'JOURNAL',
                    allocatedTo: { value: line.accountId, type: 'account' },
                    vatType: line.vatType as VatType,
                    status: 'allocated',
                    allocatedAt: journalTimestamp,
                });

                if (vatAmount !== 0 && vatControlAccount) {
                    const vatRef = doc(collection(db, 'aiAccountantClients', client.id, 'transactions'));
                    batch.set(vatRef, {
                        clientId: client.id,
                        date: line.date.toISOString(),
                        reference: data.reference,
                        description: `VAT on: ${line.description}`,
                        amount: vatAmount,
                        isExpense: vatAmount < 0,
                        bankAccountId: 'JOURNAL',
                        allocatedTo: { value: vatControlAccount, type: 'account' },
                        vatType: 'no_vat',
                        status: 'allocated',
                        allocatedAt: journalTimestamp,
                    });
                }
            }
            await batch.commit();
            toast({ title: 'Batch Posted' });
            complexForm.reset();
            fetchClientAndJournals();
        } catch (error) {
            toast({ title: 'Error', variant: 'destructive' });
        } finally {
            setIsLoading(false);
        }
    };
    // #endregion

    const allAccounts = useMemo(() => client?.chartOfAccounts?.sort((a,b) => a.description.localeCompare(b.description)) || [], [client]);

    const handleDeleteJournal = async (ref: string) => {
      if (!client) return;
      try {
        const snap = await getDocs(query(collection(db, "aiAccountantClients", client.id, "transactions"), where("reference", "==", ref)));
        const batch = writeBatch(db);
        snap.forEach(d => batch.delete(d.ref));
        await batch.commit();
        toast({ title: 'Journal Deleted' });
        fetchClientAndJournals();
      } catch (error) {
        toast({ title: 'Error', variant: 'destructive'});
      }
    };

    const groupedJournals = useMemo(() => {
        const grouped = new Map<string, AllocatedTransaction[]>();
        allJournals.forEach(tx => {
            const key = tx.reference;
            if (!grouped.has(key)) grouped.set(key, []);
            grouped.get(key)?.push(tx);
        });
        return Array.from(grouped.values()).sort((a,b) => new Date(b[0].date).getTime() - new Date(a[0].date).getTime());
    }, [allJournals]);

    return (
        <div className="space-y-8">
            <CreateGeneralAccountDialog client={client} onAccountCreated={fetchClientAndJournals} open={isCreateAccountOpen} onOpenChange={setIsCreateAccountOpen} />
            
            <Card className="border-primary/20 shadow-md">
                <CardHeader className="bg-primary/5 border-b flex flex-row items-center justify-between space-y-0">
                    <div>
                        <CardTitle className="text-xl font-bold flex items-center gap-2">
                            <ArrowRightLeft className="h-5 w-5 text-primary" />
                            Post General Journal
                        </CardTitle>
                        <CardDescription>Select entry method below.</CardDescription>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <Tabs value={entryMode} onValueChange={(v: any) => setEntryMode(v)} className="w-full">
                        <TabsList className="w-full grid grid-cols-2 h-12 rounded-none border-b">
                            <TabsTrigger value="quick" className="font-bold gap-2">
                                <ArrowRightLeft className="h-4 w-4" /> Quick Journal (Double Entry)
                            </TabsTrigger>
                            <TabsTrigger value="complex" className="font-bold gap-2">
                                <ListTree className="h-4 w-4" /> Complex Journal (Multi-line)
                            </TabsTrigger>
                        </TabsList>
                        
                        <TabsContent value="quick" className="p-6">
                            <Form {...quickForm}>
                                <form onSubmit={quickForm.handleSubmit(onQuickSubmit)} className="space-y-4">
                                    <div className="border rounded-xl overflow-x-auto shadow-sm">
                                        <Table>
                                            <TableHeader className="bg-muted/50">
                                                <TableRow>
                                                    <TableHead className="w-[120px] text-[10px] font-black uppercase">Date</TableHead>
                                                    <TableHead className="w-[110px] text-[10px] font-black uppercase">Effect</TableHead>
                                                    <TableHead className="w-[180px] text-[10px] font-black uppercase">Account</TableHead>
                                                    <TableHead className="w-[100px] text-[10px] font-black uppercase">Reference</TableHead>
                                                    <TableHead className="text-[10px] font-black uppercase">Description</TableHead>
                                                    <TableHead className="w-[150px] text-[10px] font-black uppercase">VAT Type</TableHead>
                                                    <TableHead className="w-[110px] text-[10px] font-black uppercase text-right">Amount (Incl)</TableHead>
                                                    <TableHead className="w-[180px] text-[10px] font-black uppercase">Affecting Account</TableHead>
                                                    <TableHead className="w-10"></TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {quickFields.map((field, index) => (
                                                    <TableRow key={field.id} className="hover:bg-muted/5">
                                                        <TableCell className="p-2">
                                                            <FormField control={quickForm.control} name={`lines.${index}.date`} render={({ field }) => (
                                                                <Popover>
                                                                    <PopoverTrigger asChild>
                                                                        <Button variant="outline" className={cn("w-full pl-3 text-left font-normal h-8 text-[11px]", !field.value && "text-muted-foreground")}>
                                                                            {field.value ? format(field.value, "dd/MM/yyyy") : <span>Date</span>}
                                                                        </Button>
                                                                    </PopoverTrigger>
                                                                    <PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus /></PopoverContent>
                                                                </Popover>
                                                            )} />
                                                        </TableCell>
                                                        <TableCell className="p-2">
                                                            <FormField control={quickForm.control} name={`lines.${index}.effect`} render={({ field }) => (
                                                                <Select onValueChange={field.onChange} value={field.value}>
                                                                    <FormControl><SelectTrigger className="h-8 text-[11px] font-bold"><SelectValue /></SelectTrigger></FormControl>
                                                                    <SelectContent>
                                                                        <SelectItem value="Debit">Debit</SelectItem>
                                                                        <SelectItem value="Credit">Credit</SelectItem>
                                                                    </SelectContent>
                                                                </Select>
                                                            )} />
                                                        </TableCell>
                                                        <TableCell className="p-2">
                                                            <FormField control={quickForm.control} name={`lines.${index}.accountId`} render={({ field }) => (
                                                                <Select onValueChange={field.onChange} value={field.value}>
                                                                    <FormControl><SelectTrigger className="h-8 text-[11px]"><SelectValue placeholder="Select..." /></SelectTrigger></FormControl>
                                                                    <SelectContent>
                                                                        {allAccounts.map(a => <SelectItem key={a.id} value={a.id}>{a.description}</SelectItem>)}
                                                                    </SelectContent>
                                                                </Select>
                                                            )} />
                                                        </TableCell>
                                                        <TableCell className="p-2">
                                                            <FormField control={quickForm.control} name={`lines.${index}.reference`} render={({ field }) => <Input className="h-8 text-[11px] font-mono" {...field} />} />
                                                        </TableCell>
                                                        <TableCell className="p-2">
                                                            <FormField control={quickForm.control} name={`lines.${index}.description`} render={({ field }) => <Input className="h-8 text-[11px]" {...field} />} />
                                                        </TableCell>
                                                        <TableCell className="p-2">
                                                            <FormField control={quickForm.control} name={`lines.${index}.vatType`} render={({ field }) => (
                                                                <Select onValueChange={(v) => { field.onChange(v); updateQuickAmounts(index); }} value={field.value}>
                                                                    <FormControl><SelectTrigger className="h-8 text-[10px]"><SelectValue /></SelectTrigger></FormControl>
                                                                    <SelectContent>{allVatTypes.map(vt => <SelectItem key={vt.name} value={vt.name} className="text-xs">{vt.label}</SelectItem>)}</SelectContent>
                                                                </Select>
                                                            )} />
                                                        </TableCell>
                                                        <TableCell className="p-2">
                                                            <FormField control={quickForm.control} name={`lines.${index}.inclusiveAmount`} render={({ field }) => (
                                                                <Input type="number" step="0.01" className="h-8 text-[11px] text-right font-mono font-bold" {...field} onChange={(e) => { field.onChange(parseFloat(e.target.value) || 0); updateQuickAmounts(index); }} />
                                                            )} />
                                                        </TableCell>
                                                        <TableCell className="p-2">
                                                            <FormField control={quickForm.control} name={`lines.${index}.affectingAccountId`} render={({ field }) => (
                                                                <Select onValueChange={field.onChange} value={field.value}>
                                                                    <FormControl><SelectTrigger className="h-8 text-[11px]"><SelectValue placeholder="Select..." /></SelectTrigger></FormControl>
                                                                    <SelectContent>
                                                                        {allAccounts.map(a => <SelectItem key={a.id} value={a.id}>{a.description}</SelectItem>)}
                                                                    </SelectContent>
                                                                </Select>
                                                            )} />
                                                        </TableCell>
                                                        <TableCell className="p-2">
                                                            <Button type="button" variant="ghost" size="icon" onClick={() => removeQuick(index)} disabled={quickFields.length === 1} className="h-8 w-8 text-destructive"><Trash2 className="h-3.5 w-3.5"/></Button>
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <Button type="button" variant="outline" size="sm" onClick={() => appendQuick({ date: new Date(), effect: 'Debit', accountId: '', reference: '', description: '', vatType: 'no_vat', inclusiveAmount: 0, affectingAccountId: '' })} className="font-bold gap-2">
                                            <Plus className="h-4 w-4" /> Add Balanced Entry
                                        </Button>
                                        <Button type="submit" disabled={isLoading} className="font-black px-12 gap-2 h-11">
                                            {isLoading ? <Loader2 className="animate-spin" /> : <Calculator className="h-5 w-5" />}
                                            Post Journals
                                        </Button>
                                    </div>
                                </form>
                            </Form>
                        </TabsContent>

                        <TabsContent value="complex" className="p-6">
                            <Form {...complexForm}>
                                <form onSubmit={complexForm.handleSubmit(onComplexSubmit)} className="space-y-6">
                                    <div className="max-w-sm">
                                        <FormField control={complexForm.control} name="reference" render={({ field }) => ( <FormItem><FormLabel className="text-[10px] font-black uppercase">Batch Reference</FormLabel><FormControl><Input {...field} className="h-10 font-bold" /></FormControl><FormMessage /></FormItem> )} />
                                    </div>
                                    <div className="border rounded-xl overflow-hidden shadow-sm">
                                        <Table>
                                            <TableHeader className="bg-muted/50">
                                                <TableRow>
                                                    <TableHead className="w-[180px] text-[10px] font-black uppercase">Date</TableHead>
                                                    <TableHead className="w-[200px] text-[10px] font-black uppercase">Account</TableHead>
                                                    <TableHead className="text-[10px] font-black uppercase">Description</TableHead>
                                                    <TableHead className="w-[120px] text-[10px] font-black uppercase">VAT %</TableHead>
                                                    <TableHead className="w-[120px] text-[10px] font-black uppercase text-right">Debit (Excl)</TableHead>
                                                    <TableHead className="w-[120px] text-[10px] font-black uppercase text-right">Credit (Excl)</TableHead>
                                                    <TableHead className="w-10"></TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {complexFields.map((field, index) => (
                                                    <TableRow key={field.id} className="hover:bg-muted/5">
                                                        <TableCell className="p-2">
                                                            <FormField control={complexForm.control} name={`lines.${index}.date`} render={({ field }) => (
                                                                <Popover>
                                                                    <PopoverTrigger asChild>
                                                                        <Button variant="outline" className={cn("w-full pl-3 text-left font-normal h-8 text-[11px]", !field.value && "text-muted-foreground")}>
                                                                            {field.value ? format(field.value, "dd/MM/yyyy") : <span>Date</span>}
                                                                        </Button>
                                                                    </PopoverTrigger>
                                                                    <PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus /></PopoverContent>
                                                                </Popover>
                                                            )} />
                                                        </TableCell>
                                                        <TableCell className="p-2">
                                                            <FormField control={complexForm.control} name={`lines.${index}.accountId`} render={({ field }) => (
                                                                <Select onValueChange={field.onChange} value={field.value}>
                                                                    <FormControl><SelectTrigger className="h-8 text-[11px]"><SelectValue placeholder="Select..." /></SelectTrigger></FormControl>
                                                                    <SelectContent>{allAccounts.map(a => <SelectItem key={a.id} value={a.id}>{a.description}</SelectItem>)}</SelectContent>
                                                                </Select>
                                                            )} />
                                                        </TableCell>
                                                        <TableCell className="p-2">
                                                            <FormField control={complexForm.control} name={`lines.${index}.description`} render={({ field }) => <Input className="h-8 text-[11px]" {...field} />} />
                                                        </TableCell>
                                                        <TableCell className="p-2">
                                                            <FormField control={complexForm.control} name={`lines.${index}.vatType`} render={({ field }) => (
                                                                <Select onValueChange={field.onChange} value={field.value}>
                                                                    <FormControl><SelectTrigger className="h-8 text-[10px]"><SelectValue /></SelectTrigger></FormControl>
                                                                    <SelectContent>{allVatTypes.map(vt => <SelectItem key={vt.name} value={vt.name} className="text-xs">{vt.label}</SelectItem>)}</SelectContent>
                                                                </Select>
                                                            )} />
                                                        </TableCell>
                                                        <TableCell className="p-2">
                                                            <FormField control={complexForm.control} name={`lines.${index}.debit`} render={({ field }) => <Input type="number" step="0.01" className="h-8 text-[11px] text-right font-mono" {...field} onChange={e => field.onChange(parseFloat(e.target.value) || 0)} />} />
                                                        </TableCell>
                                                        <TableCell className="p-2">
                                                            <FormField control={complexForm.control} name={`lines.${index}.credit`} render={({ field }) => <Input type="number" step="0.01" className="h-8 text-[11px] text-right font-mono" {...field} onChange={e => field.onChange(parseFloat(e.target.value) || 0)} />} />
                                                        </TableCell>
                                                        <TableCell className="p-2">
                                                            <Button type="button" variant="ghost" size="icon" onClick={() => removeComplex(index)} disabled={complexFields.length <= 2} className="h-8 w-8 text-destructive"><Trash2 className="h-3.5 w-3.5"/></Button>
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <Button type="button" variant="outline" size="sm" onClick={() => appendComplex({ date: new Date(), accountId: '', description: '', debit: 0, credit: 0, vatType: 'no_vat' })} className="font-bold gap-2">
                                            <Plus className="h-4 w-4" /> Add Line
                                        </Button>
                                        <Button type="submit" disabled={isLoading} className="font-black px-12 gap-2 h-11">
                                            {isLoading ? <Loader2 className="animate-spin" /> : <Calculator className="h-5 w-5" />}
                                            Post Batch
                                        </Button>
                                    </div>
                                    {complexForm.formState.errors.lines && (
                                        <div className="flex items-center gap-2 text-destructive bg-destructive/5 p-3 rounded-lg border border-destructive/10 text-xs font-bold uppercase tracking-tight">
                                            <AlertCircle className="h-4 w-4" /> {complexForm.formState.errors.lines.message}
                                        </div>
                                    )}
                                </form>
                            </Form>
                        </TabsContent>
                    </Tabs>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="text-lg">Posted Journal History</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader className="bg-muted/30">
                            <TableRow>
                                <TableHead>Date</TableHead>
                                <TableHead>Reference</TableHead>
                                <TableHead>Description</TableHead>
                                <TableHead className="text-right">Total (Incl)</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {groupedJournals.length === 0 ? (
                                <TableRow><TableCell colSpan={5} className="text-center py-12 text-muted-foreground italic">No journals found.</TableCell></TableRow>
                            ) : groupedJournals.map((entries, i) => {
                                const ref = entries[0].reference;
                                const total = entries.reduce((s, e) => s + (e.amount > 0 ? e.amount : 0), 0);
                                return (
                                    <TableRow key={i}>
                                        <TableCell className="text-xs font-medium">{format(new Date(entries[0].date), 'dd/MM/yyyy')}</TableCell>
                                        <TableCell className="font-bold text-primary">{ref}</TableCell>
                                        <TableCell className="text-xs text-muted-foreground line-clamp-1">{entries[0].description}</TableCell>
                                        <TableCell className="text-right font-mono font-bold">{formatPrice(total)}</TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex justify-end gap-1">
                                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setViewingJournal(entries)}><Eye className="h-4 w-4" /></Button>
                                                <AlertDialog>
                                                    <AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8 text-destructive"><Trash2 className="h-4 w-4"/></Button></AlertDialogTrigger>
                                                    <AlertDialogContent>
                                                        <AlertDialogHeader><AlertDialogTitle>Delete Journal {ref}?</AlertDialogTitle><AlertDialogDescription>This will remove all associated lines.</AlertDialogDescription></AlertDialogHeader>
                                                        <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => handleDeleteJournal(ref)} className="bg-destructive text-destructive-foreground">Delete</AlertDialogAction></AlertDialogFooter>
                                                    </AlertDialogContent>
                                                </AlertDialog>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            <Dialog open={!!viewingJournal} onOpenChange={(o) => !o && setViewingJournal(null)}>
                <DialogContent className="sm:max-w-4xl max-h-[85vh] flex flex-col p-0 overflow-hidden">
                    <DialogHeader className="p-6 border-b bg-muted/20 shrink-0">
                        <div className="flex justify-between items-start">
                            <div>
                                <DialogTitle className="text-xl">Journal Details: {viewingJournal?.[0]?.reference}</DialogTitle>
                                <DialogDescription>Reviewing transaction entries.</DialogDescription>
                            </div>
                            <Button variant="ghost" size="icon" onClick={() => setViewingJournal(null)}><X className="h-4 w-4" /></Button>
                        </div>
                    </DialogHeader>
                    <ScrollArea className="flex-grow p-6">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Date</TableHead>
                                    <TableHead>Account</TableHead>
                                    <TableHead>Description</TableHead>
                                    <TableHead className="text-right">Debit</TableHead>
                                    <TableHead className="text-right">Credit</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {viewingJournal?.map((tx, idx) => {
                                    const account = client?.chartOfAccounts?.find(a => a.id === tx.allocatedTo.value);
                                    return (
                                        <TableRow key={idx}>
                                            <TableCell className="text-xs">{format(new Date(tx.date), 'dd/MM/yyyy')}</TableCell>
                                            <TableCell className="text-xs font-bold">{account?.description || tx.allocatedTo.value}</TableCell>
                                            <TableCell className="text-xs italic">{tx.description}</TableCell>
                                            <TableCell className="text-right font-mono">{tx.amount > 0 ? formatPrice(tx.amount) : ''}</TableCell>
                                            <TableCell className="text-right font-mono">{tx.amount < 0 ? formatPrice(Math.abs(tx.amount)) : ''}</TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                            <TableFooterComponent>
                                <TableRow className="bg-muted/50 font-black">
                                    <TableCell colSpan={3}>Totals</TableCell>
                                    <TableCell className="text-right font-mono">{formatPrice(viewingJournal?.reduce((s, e) => s + (e.amount > 0 ? e.amount : 0), 0))}</TableCell>
                                    <TableCell className="text-right font-mono">{formatPrice(viewingJournal?.reduce((s, e) => s + (e.amount < 0 ? Math.abs(e.amount) : 0), 0))}</TableCell>
                                </TableRow>
                            </TableFooterComponent>
                        </Table>
                    </ScrollArea>
                    <DialogFooter className="p-4 border-t shrink-0">
                        <Button variant="ghost" onClick={() => setViewingJournal(null)}>Close</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

export default function GeneralJournalsPage() {
    const params = useParams();
    const clientId = params.clientId as string;
    const [client, setClient] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [allJournals, setAllJournals] = useState<AllocatedTransaction[]>([]);

    const fetchClientAndJournals = async () => {
        if (!clientId) return;
        setIsLoading(true);
        try {
            const clientRef = doc(db, 'aiAccountantClients', clientId);
            const clientSnap = await getDoc(clientRef);
            if (clientSnap.exists()) {
                const data = clientSnap.data() as User;
                if (data.chartOfAccounts) {
                    const uniqueAccounts = Array.from(new Map(data.chartOfAccounts.map(a => [a.accountNumber, a])).values());
                    data.chartOfAccounts = uniqueAccounts;
                }
                setClient(data);
            }

            const journalsQuery = query(
                collection(db, 'aiAccountantClients', clientId, 'transactions'),
                where('bankAccountId', '==', 'JOURNAL'),
                orderBy('date', 'desc'),
                orderBy('reference', 'asc')
            );
            const journalsSnapshot = await getDocs(journalsQuery);
            setAllJournals(journalsSnapshot.docs.map(d => ({id: d.id, ...d.data()}) as AllocatedTransaction));
        } catch (e) {
            console.error(e);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchClientAndJournals();
    }, [clientId]);

    return (
        <Suspense fallback={<div className="flex justify-center items-center h-64"><Loader2 className="animate-spin" /></div>}>
            <JournalManager 
                clientId={clientId}
                client={client}
                fetchClientAndJournals={fetchClientAndJournals}
                allJournals={allJournals}
                isLoading={isLoading}
                setIsLoading={setIsLoading}
            />
        </Suspense>
    );
}
