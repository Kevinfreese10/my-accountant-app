'use client';

import * as React from "react";
import { useState, useEffect, useMemo, Suspense } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { useForm, useFieldArray } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, Plus, Trash2, Eye, Calculator, ArrowRightLeft, X, ListTree, History, CheckCircle2, FileUp, Download, AlertCircle, FileWarning, Edit, Save, Calendar as CalendarIcon } from 'lucide-react';
import { getFirestore, doc, collection, writeBatch, Timestamp, query, where, orderBy, getDocs, updateDoc, arrayUnion, serverTimestamp, getDoc, deleteField } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { useParams } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { User, AllocatedTransaction, VatType, ChartOfAccount } from '@/lib/types';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { format, parse } from 'date-fns';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter as TableFooterComponent } from '@/components/ui/table';
import { Separator } from '@/components/ui/separator';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { allVatTypes } from '@/lib/vat-types';
import { ScrollArea } from '@/components/ui/scroll-area';
import Papa from 'papaparse';

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

const quickFormSchema = z.object({
  lines: z.array(quickJournalLineSchema).min(1),
});

const editJournalLineSchema = z.object({
    id: z.string(),
    accountId: z.string().min(1),
    description: z.string().min(1),
    amount: z.number(),
    vatType: z.string(),
});

const editJournalFormSchema = z.object({
    reference: z.string(),
    date: z.date(),
    lines: z.array(editJournalLineSchema),
});

// #endregion

const formatPrice = (price: number | undefined) => {
    if (price === undefined || price === null || isNaN(price)) return '0.00';
    return new Intl.NumberFormat('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(price);
};

function EditJournalDialog({ isOpen, onOpenChange, journalEntries, client, onSave }: { 
    isOpen: boolean, 
    onOpenChange: (open: boolean) => void, 
    journalEntries: AllocatedTransaction[] | null, 
    client: User | null, 
    onSave: (data: z.infer<typeof editJournalFormSchema>) => Promise<void> 
}) {
    const { toast } = useToast();
    const [isSaving, setIsSaving] = useState(false);

    const form = useForm<z.infer<typeof editJournalFormSchema>>({
        resolver: zodResolver(editJournalFormSchema),
        defaultValues: {
            reference: '',
            date: new Date(),
            lines: [],
        }
    });

    const { fields, append, remove } = useFieldArray({
        control: form.control,
        name: "lines"
    });

    useEffect(() => {
        if (journalEntries && journalEntries.length > 0) {
            form.reset({
                reference: journalEntries[0].reference,
                date: journalEntries[0].date?.toDate ? journalEntries[0].date.toDate() : new Date(journalEntries[0].date),
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

    const watchedLines = form.watch("lines");
    const totals = useMemo(() => {
        let debits = 0;
        let credits = 0;
        watchedLines?.forEach(line => {
            if (line.amount > 0) debits += line.amount;
            else credits += Math.abs(line.amount);
        });
        return { debits, credits, balance: debits - credits };
    }, [watchedLines]);

    const isBalanced = Math.abs(totals.balance) < 0.01;

    const handleFormSubmit = async (data: z.infer<typeof editJournalFormSchema>) => {
        if (!isBalanced) {
            toast({ title: "Journal Unbalanced", description: "Total debits must equal total credits.", variant: "destructive" });
            return;
        }
        setIsSaving(true);
        try {
            await onSave(data);
            onOpenChange(false);
        } finally {
            setIsSaving(false);
        }
    };

    if (!journalEntries) return null;

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-5xl">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Edit className="h-5 w-5 text-primary" />
                        Edit Journal Group: {form.getValues("reference")}
                    </DialogTitle>
                    <DialogDescription>Modify individual transactions within this balanced group.</DialogDescription>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <FormField control={form.control} name="date" render={({ field }) => (
                                <FormItem className="flex flex-col">
                                    <FormLabel>Journal Date</FormLabel>
                                    <Popover>
                                        <PopoverTrigger asChild>
                                            <FormControl>
                                                <Button variant="outline" className={cn("pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
                                                    {field.value ? format(field.value, "dd/MM/yyyy") : <span>Pick a date</span>}
                                                    <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                                </Button>
                                            </FormControl>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-0" align="start">
                                            <Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus />
                                        </PopoverContent>
                                    </Popover>
                                </FormItem>
                            )} />
                            <FormField control={form.control} name="reference" render={({ field }) => (
                                <FormItem><FormLabel>Reference</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
                            )} />
                        </div>

                        <div className="border rounded-lg overflow-hidden">
                            <Table>
                                <TableHeader className="bg-muted/50">
                                    <TableRow>
                                        <TableHead className="text-[10px] uppercase font-black">Account</TableHead>
                                        <TableHead className="text-[10px] uppercase font-black">Description</TableHead>
                                        <TableHead className="text-[10px] uppercase font-black">VAT Type</TableHead>
                                        <TableHead className="text-right text-[10px] uppercase font-black">Debit</TableHead>
                                        <TableHead className="text-right text-[10px] uppercase font-black">Credit</TableHead>
                                        <TableHead className="w-10"></TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {fields.map((field, index) => (
                                        <TableRow key={field.id}>
                                            <TableCell className="p-2">
                                                <FormField control={form.control} name={`lines.${index}.accountId`} render={({ field }) => (
                                                    <Select onValueChange={field.onChange} value={field.value}>
                                                        <FormControl><SelectTrigger className="h-8 text-11px]"><SelectValue /></SelectTrigger></FormControl>
                                                        <SelectContent>
                                                            {client?.chartOfAccounts?.map(a => <SelectItem key={a.id} value={a.id}>{a.description}</SelectItem>)}
                                                        </SelectContent>
                                                    </Select>
                                                )} />
                                            </TableCell>
                                            <TableCell className="p-2">
                                                <FormField control={form.control} name={`lines.${index}.description`} render={({ field }) => <Input className="h-8 text-[11px]" {...field} />} />
                                            </TableCell>
                                            <TableCell className="p-2">
                                                <FormField control={form.control} name={`lines.${index}.vatType`} render={({ field }) => (
                                                    <Select onValueChange={field.onChange} value={field.value}>
                                                        <FormControl><SelectTrigger className="h-8 text-[11px]"><SelectValue /></SelectTrigger></FormControl>
                                                        <SelectContent>
                                                            {allVatTypes.map(v => <SelectItem key={v.name} value={v.name}>{v.label}</SelectItem>)}
                                                        </SelectContent>
                                                    </Select>
                                                )} />
                                            </TableCell>
                                            <TableCell className="p-2">
                                                <Input 
                                                    type="number" 
                                                    step="0.01" 
                                                    className="h-8 text-right font-mono text-[11px]" 
                                                    placeholder="0.00"
                                                    value={watchedLines[index]?.amount > 0 ? watchedLines[index].amount : ''}
                                                    onChange={(e) => form.setValue(`lines.${index}.amount`, parseFloat(e.target.value) || 0)}
                                                />
                                            </TableCell>
                                            <TableCell className="p-2">
                                                <Input 
                                                    type="number" 
                                                    step="0.01" 
                                                    className="h-8 text-right font-mono text-[11px]" 
                                                    placeholder="0.00"
                                                    value={watchedLines[index]?.amount < 0 ? Math.abs(watchedLines[index].amount) : ''}
                                                    onChange={(e) => form.setValue(`lines.${index}.amount`, -(parseFloat(e.target.value) || 0))}
                                                />
                                            </TableCell>
                                            <TableCell className="p-2">
                                                <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)} className="h-8 w-8 text-destructive"><Trash2 className="h-4 w-4"/></Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                        <Button type="button" variant="outline" size="sm" onClick={() => append({ id: `new_${Date.now()}`, accountId: '', description: '', amount: 0, vatType: 'no_vat' })} className="font-bold gap-2">
                            <Plus className="h-4 w-4" /> Add Line
                        </Button>

                        <div className="bg-muted/30 p-4 rounded-xl border flex justify-between items-center">
                            <div className="flex gap-8 text-xs">
                                <div><span className="text-muted-foreground uppercase font-black text-[9px] block">Total Debits</span><span className="font-bold font-mono">R {formatPrice(totals.debits)}</span></div>
                                <div><span className="text-muted-foreground uppercase font-black text-[9px] block">Total Credits</span><span className="font-bold font-mono">R {formatPrice(totals.credits)}</span></div>
                            </div>
                            <div className="text-right">
                                <span className="text-muted-foreground uppercase font-black text-[9px] block">Out of Balance</span>
                                <span className={cn("font-black font-mono text-lg", isBalanced ? "text-green-600" : "text-destructive")}>
                                    R {formatPrice(totals.balance)}
                                </span>
                            </div>
                        </div>

                        <DialogFooter>
                            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
                            <Button type="submit" disabled={!isBalanced || isSaving} className="font-black px-8">
                                {isSaving ? <Loader2 className="animate-spin mr-2"/> : <Save className="mr-2 h-4 w-4" />}
                                Update Journal
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}

function ImportJournalDialog({ client, onImported }: { client: User | null; onImported: (lines: any[]) => void }) {
    const [isOpen, setIsOpen] = useState(false);
    const [isParsing, setIsParsing] = useState(false);
    const { toast } = useToast();

    const handleDownloadTemplate = () => {
        const headers = ['Date (DD/MM/YYYY)', 'Effect (Debit/Credit)', 'Account Number', 'Reference', 'Description', 'VAT Type', 'Amount (Excl)', 'VAT Amount', 'Amount (Incl)', 'Contra Account Number'];
        const accounts = client?.chartOfAccounts || [];
        const acc1 = accounts[0]?.accountNumber || '1000-000';
        const acc2 = accounts[1]?.accountNumber || '8000-004';
        
        const dummyRows = [
            ['15/03/2026', 'Debit', acc1, 'GJ-001', 'Service Sale Example', 'Standard-rated supplies (15%)', '1000.00', '150.00', '1150.00', acc2],
            ['16/03/2026', 'Debit', acc1, 'GJ-002', 'Asset Purchase Example', 'Capital goods (15%)', '20000.00', '3000.00', '23000.00', acc2],
            ['17/03/2026', 'Credit', acc1, 'GJ-003', 'Inventory Adj Example', 'No VAT', '5000.00', '0.00', '5000.00', acc2],
            ['18/03/2026', 'Debit', acc1, 'GJ-004', 'Fuel Example', 'Zero-rated purchases (0%)', '800.00', '0.00', '800.00', acc2]
        ];
        
        const csvContent = Papa.unparse([headers, ...dummyRows]);
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.setAttribute('download', 'general_journal_import_template.csv');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !client) return;
        setIsParsing(true);
        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: (results) => {
                const data = results.data as any[];
                const errors: any[] = [];
                const validLines: any[] = [];
                data.forEach((row, i) => {
                    const rowNum = i + 2;
                    const rawDate = row['Date (DD/MM/YYYY)'];
                    const rawEffect = row['Effect (Debit/Credit)'];
                    const rawAcc = row['Account Number'];
                    const rawRef = row['Reference'];
                    const rawDesc = row['Description'];
                    const rawVatType = row['VAT Type'];
                    const rawAmtExcl = row['Amount (Excl)'];
                    const rawVatAmt = row['VAT Amount'];
                    const rawAmtIncl = row['Amount (Incl)'];
                    const rawAffecting = row['Affecting Account Number'];
                    
                    const parsedDate = parse(rawDate || '', 'dd/MM/yyyy', new Date());
                    if (isNaN(parsedDate.getTime())) errors.push({ Row: rowNum, Field: 'Date', Error: 'Invalid format. Use DD/MM/YYYY.', Value: rawDate });
                    if (rawEffect !== 'Debit' && rawEffect !== 'Credit') errors.push({ Row: rowNum, Field: 'Effect', Error: 'Must be "Debit" or "Credit".', Value: rawEffect });
                    
                    const account = client.chartOfAccounts?.find(a => a.accountNumber === rawAcc);
                    if (!account) errors.push({ Row: rowNum, Field: 'Account Number', Error: 'Account number not found.', Value: rawAcc });
                    
                    const affectingAccount = client.chartOfAccounts?.find(a => a.accountNumber === rawAffecting);
                    if (!affectingAccount) errors.push({ Row: rowNum, Field: 'Affecting Account Number', Error: 'Affecting account not found.', Value: rawAffecting });
                    
                    const amountIncl = parseFloat(String(rawAmtIncl || '').replace(/[^\d.-]/g, ''));
                    if (isNaN(amountIncl) || amountIncl <= 0) errors.push({ Row: rowNum, Field: 'Amount (Incl)', Error: 'Must be a positive numeric value.', Value: rawAmtIncl });
                    
                    const vatAmt = parseFloat(String(rawVatAmt || '0').replace(/[^\d.-]/g, ''));
                    const vatTypeObj = allVatTypes.find(v => v.label === rawVatType) || allVatTypes.find(v => v.name === 'no_vat');
                    
                    if (errors.length === 0) {
                        const isStandard = vatTypeObj?.name === 'standard_rated_sales' || vatTypeObj?.name === 'standard_rated_purchases' || vatTypeObj?.name === 'capital_goods_purchases';
                        
                        // Prioritize manual VAT if provided, else calculate
                        const effectiveVat = !isNaN(vatAmt) && vatAmt !== 0 ? vatAmt : (isStandard ? amountIncl - (amountIncl / 1.15) : 0);
                        const effectiveExcl = amountIncl - effectiveVat;

                        validLines.push({ 
                            date: parsedDate, 
                            effect: rawEffect, 
                            accountId: account?.id, 
                            reference: rawRef || `IMPORT-${Date.now()}`, 
                            description: rawDesc || 'Imported Journal', 
                            vatType: vatTypeObj?.name || 'no_vat', 
                            inclusiveAmount: amountIncl, 
                            vatAmount: effectiveVat,
                            exclusiveAmount: effectiveExcl,
                            affectingAccountId: affectingAccount?.id 
                        });
                    }
                });
                
                if (errors.length > 0) {
                    const errorCsv = Papa.unparse(errors);
                    const blob = new Blob([errorCsv], { type: 'text/csv;charset=utf-8;' });
                    const link = document.createElement('a');
                    link.href = URL.createObjectURL(blob);
                    link.setAttribute('download', `import_errors_${format(new Date(), 'yyyyMMdd_HHmm')}.csv`);
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    toast({ title: "Import Errors Found", description: `We found ${errors.length} issues. An error report has been downloaded.`, variant: "destructive" });
                } else if (validLines.length > 0) {
                    onImported(validLines);
                    toast({ title: "Import Successful", description: `Loaded ${validLines.length} rows for review.` });
                    setIsOpen(false);
                }
                setIsParsing(false);
            }
        });
    };

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2"><FileUp className="h-4 w-4" /> Import CSV</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
                <DialogHeader><DialogTitle>Bulk Journal Import</DialogTitle><DialogDescription>Upload a CSV file to populate the journal grid. Dates must be in DD/MM/YYYY format.</DialogDescription></DialogHeader>
                <div className="space-y-6 py-4">
                    <Button variant="secondary" className="w-full gap-2" onClick={handleDownloadTemplate}><Download className="h-4 w-4" /> Download CSV Template</Button>
                    <Separator />
                    <div className="space-y-3">
                        <Label>Select CSV File</Label>
                        <Input type="file" accept=".csv" onChange={handleFileChange} disabled={isParsing} />
                        {isParsing && <p className="text-xs text-primary flex items-center gap-2"><Loader2 className="h-3 w-3 animate-spin"/> Validating data...</p>}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

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
            toast({ title: "Account Created" });
            onAccountCreated();
            onOpenChange(false);
        } catch (error) {
            toast({ title: "Error", variant: 'destructive' });
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
                        <FormField control={form.control} name="section" render={({ field }) => ( <FormItem><FormLabel>Section</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select a section" /></SelectTrigger></FormControl><SelectContent><SelectItem value="Income Statement">Income Statement</SelectItem><SelectItem value="Balance Sheet">Balance Sheet</SelectItem></SelectContent></Select></FormItem>)} />
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
    const [editingJournal, setEditingJournal] = useState<AllocatedTransaction[] | null>(null);
    const [isCreateAccountOpen, setIsCreateAccountOpen] = useState(false);
    const [activeTab, setActiveTab] = useState<'post' | 'reviewed'>('post');

    const quickForm = useForm<z.infer<typeof quickFormSchema>>({
        resolver: zodResolver(quickFormSchema),
        defaultValues: {
            lines: [{ date: new Date(), effect: 'Debit', accountId: '', reference: '', description: '', vatType: 'no_vat', inclusiveAmount: 0, exclusiveAmount: 0, vatAmount: 0, affectingAccountId: '' }]
        }
    });

    const { fields: quickFields, append: appendQuick, remove: removeQuick, replace: replaceQuick } = useFieldArray({
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

    const handleImportedLines = (lines: any[]) => {
        replaceQuick(lines);
    };

    const onQuickSubmit = async (data: z.infer<typeof quickFormSchema>) => {
        if (!client) return;
        setIsLoading(true);
        try {
            const batch = writeBatch(db);
            const journalTimestamp = Timestamp.now();
            const vatControlAccount = client.chartOfAccounts?.find(acc => acc.accountNumber === '7000-008')?.id;
            for (const line of data.lines) {
                const excl = line.exclusiveAmount || 0;
                const vat = line.vatAmount || 0;
                const incl = line.inclusiveAmount || 0;
                const multiplier = line.effect === 'Debit' ? 1 : -1;
                const pRef = doc(collection(db, 'aiAccountantClients', client.id, 'transactions'));
                batch.set(pRef, { clientId: client.id, date: line.date.toISOString(), reference: line.reference, description: line.description, amount: excl * multiplier, isExpense: (excl * multiplier) < 0, bankAccountId: 'JOURNAL', allocatedTo: { value: line.accountId, type: 'account' }, vatType: line.vatType as VatType, status: 'allocated', allocatedAt: journalTimestamp });
                const aRef = doc(collection(db, 'aiAccountantClients', client.id, 'transactions'));
                batch.set(aRef, { clientId: client.id, date: line.date.toISOString(), reference: line.reference, description: line.description, amount: -(incl * multiplier), isExpense: -(incl * multiplier) < 0, bankAccountId: 'JOURNAL', allocatedTo: { value: line.affectingAccountId, type: 'account' }, vatType: 'no_vat', status: 'allocated', allocatedAt: journalTimestamp });
                if (vat !== 0 && vatControlAccount) {
                    const vRef = doc(collection(db, 'aiAccountantClients', client.id, 'transactions'));
                    batch.set(vRef, { clientId: client.id, date: line.date.toISOString(), reference: line.reference, description: `VAT: ${line.description}`, amount: vat * multiplier, isExpense: (vat * multiplier) < 0, bankAccountId: 'JOURNAL', allocatedTo: { value: vatControlAccount, type: 'account' }, vatType: 'no_vat', status: 'allocated', allocatedAt: journalTimestamp });
                }
            }
            await batch.commit();
            toast({ title: "Journal Posted Successfully" });
            quickForm.reset({ lines: [{ date: new Date(), effect: 'Debit', accountId: '', reference: '', description: '', vatType: 'no_vat', inclusiveAmount: 0, exclusiveAmount: 0, vatAmount: 0, affectingAccountId: '' }] });
            fetchClientAndJournals();
            setActiveTab('reviewed');
        } catch (e) { toast({ title: "Error Posting", variant: "destructive" }); } finally { setIsLoading(false); }
    };

    const handleUpdateJournal = async (data: z.infer<typeof editJournalFormSchema>) => {
        if (!client) return;
        setIsLoading(true);
        try {
            const batch = writeBatch(db);
            const ref = data.reference;
            const txCollection = collection(db, 'aiAccountantClients', client.id, 'transactions');
            
            // 1. Identify IDs to delete (original lines that were removed in editor)
            const originalIds = editingJournal?.map(j => j.id) || [];
            const updatedIds = data.lines.map(l => l.id).filter(id => !id.startsWith('new_'));
            const toDelete = originalIds.filter(id => !updatedIds.includes(id));

            toDelete.forEach(id => batch.delete(doc(txCollection, id)));

            // 2. Update existing or set new lines
            data.lines.forEach(line => {
                const docRef = line.id.startsWith('new_') ? doc(txCollection) : doc(txCollection, line.id);
                const payload: any = {
                    clientId: client.id,
                    date: data.date.toISOString(),
                    reference: ref,
                    description: line.description,
                    amount: line.amount,
                    isExpense: line.amount < 0,
                    bankAccountId: 'JOURNAL',
                    allocatedTo: { value: line.accountId, type: 'account' },
                    vatType: line.vatType,
                    status: 'allocated',
                    updatedAt: serverTimestamp(),
                };
                if (line.id.startsWith('new_')) payload.allocatedAt = serverTimestamp();
                batch.set(docRef, payload, { merge: true });
            });

            await batch.commit();
            toast({ title: "Journal Updated" });
            fetchClientAndJournals();
        } catch (e) {
            console.error(e);
            toast({ title: "Update Failed", variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    };

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
      } catch (error) { toast({ title: 'Error', variant: 'destructive'}); }
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
            <EditJournalDialog isOpen={!!editingJournal} onOpenChange={(o) => !o && setEditingJournal(null)} journalEntries={editingJournal} client={client} onSave={handleUpdateJournal} />
            
            <Card className="border-primary/20 shadow-md">
                <CardHeader className="bg-primary/5 border-b flex flex-row items-center justify-between space-y-0">
                    <div>
                        <CardTitle className="text-xl font-bold flex items-center gap-2"><ArrowRightLeft className="h-5 w-5 text-primary" /> General Journal Manager</CardTitle>
                        <CardDescription>Post balanced entries or review historical items.</CardDescription>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="flex justify-between items-center pr-4 border-b">
                        <div className="flex">
                            <button className={cn("px-6 py-3 text-sm font-bold flex items-center gap-2 transition-all", activeTab === 'post' ? "border-b-2 border-primary text-primary" : "text-muted-foreground hover:bg-muted/50")} onClick={() => setActiveTab('post')}><Plus className="h-4 w-4" /> Post New Journal</button>
                            <button className={cn("px-6 py-3 text-sm font-bold flex items-center gap-2 transition-all", activeTab === 'reviewed' ? "border-b-2 border-primary text-primary" : "text-muted-foreground hover:bg-muted/50")} onClick={() => setActiveTab('reviewed')}><History className="h-4 w-4" /> Reviewed Journals</button>
                        </div>
                        {activeTab === 'post' && <ImportJournalDialog client={client} onImported={handleImportedLines} />}
                    </div>

                    <div className="p-0">
                        {activeTab === 'post' && (
                            <div className="p-6 space-y-6">
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
                                                        <TableHead className="w-[110px] text-[10px] font-black uppercase text-right">Excl. Amount</TableHead>
                                                        <TableHead className="w-[100px] text-[10px] font-black uppercase text-right">VAT Amount</TableHead>
                                                        <TableHead className="w-[180px] text-[10px] font-black uppercase">Affecting Account</TableHead>
                                                        <TableHead className="w-10"></TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {quickFields.map((field, index) => (
                                                        <TableRow key={field.id} className="hover:bg-muted/5">
                                                            <TableCell className="p-2"><FormField control={quickForm.control} name={`lines.${index}.date`} render={({ field }) => ( <Popover><PopoverTrigger asChild><Button variant="outline" className={cn("w-full pl-3 text-left font-normal h-8 text-[11px]", !field.value && "text-muted-foreground")}>{field.value ? format(field.value, "dd/MM/yyyy") : <span>Date</span>}</Button></PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus /></PopoverContent></Popover> )} /></TableCell>
                                                            <TableCell className="p-2"><FormField control={quickForm.control} name={`lines.${index}.effect`} render={({ field }) => ( <Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger className="h-8 text-[11px] font-bold"><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value="Debit">Debit</SelectItem><SelectItem value="Credit">Credit</SelectItem></SelectContent></Select> )} /></TableCell>
                                                            <TableCell className="p-2"><FormField control={quickForm.control} name={`lines.${index}.accountId`} render={({ field }) => ( <Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger className="h-8 text-[11px]"><SelectValue placeholder="Select..." /></SelectTrigger></FormControl><SelectContent>{allAccounts.map(a => <SelectItem key={a.id} value={a.id}>{a.description}</SelectItem>)}</SelectContent></Select> )} /></TableCell>
                                                            <TableCell className="p-2"><FormField control={quickForm.control} name={`lines.${index}.reference`} render={({ field }) => <Input className="h-8 text-[11px] font-mono" {...field} />} /></TableCell>
                                                            <TableCell className="p-2"><FormField control={quickForm.control} name={`lines.${index}.description`} render={({ field }) => <Input className="h-8 text-[11px]" {...field} />} /></TableCell>
                                                            <TableCell className="p-2"><FormField control={quickForm.control} name={`lines.${index}.vatType`} render={({ field }) => ( <Select onValueChange={(v) => { field.onChange(v); updateQuickAmounts(index); }} value={field.value}><FormControl><SelectTrigger className="h-8 text-[10px]"><SelectValue /></SelectTrigger></FormControl><SelectContent>{allVatTypes.map(vt => <SelectItem key={vt.name} value={vt.name} className="text-xs">{vt.label}</SelectItem>)}</SelectContent></Select> )} /></TableCell>
                                                            <TableCell className="p-2"><FormField control={quickForm.control} name={`lines.${index}.inclusiveAmount`} render={({ field }) => ( <Input type="number" step="0.01" className="h-8 text-right font-mono font-bold text-[11px]" {...field} onChange={(e) => { field.onChange(parseFloat(e.target.value) || 0); updateQuickAmounts(index); }} /> )} /></TableCell>
                                                            <TableCell className="p-2"><FormField control={quickForm.control} name={`lines.${index}.exclusiveAmount`} render={({ field }) => ( <Input readOnly className="h-8 text-[11px] text-right font-mono bg-muted border-none shadow-none focus-visible:ring-0" value={formatPrice(field.value)} /> )} /></TableCell>
                                                            <TableCell className="p-2"><FormField control={quickForm.control} name={`lines.${index}.vatAmount`} render={({ field }) => ( <Input readOnly className="h-8 text-[11px] text-right font-mono bg-muted border-none shadow-none focus-visible:ring-0" value={formatPrice(field.value)} /> )} /></TableCell>
                                                            <TableCell className="p-2"><FormField control={quickForm.control} name={`lines.${index}.affectingAccountId`} render={({ field }) => ( <Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger className="h-8 text-[11px]"><SelectValue placeholder="Select..." /></SelectTrigger></FormControl><SelectContent>{allAccounts.map(a => <SelectItem key={a.id} value={a.id}>{a.description}</SelectItem>)}</SelectContent></Select> )} /></TableCell>
                                                            <TableCell className="p-2"><Button type="button" variant="ghost" size="icon" onClick={() => removeQuick(index)} disabled={quickFields.length === 1} className="h-8 w-8 text-destructive"><Trash2 className="h-3.5 w-3.5"/></Button></TableCell>
                                                        </TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                        </div>
                                        <div className="flex justify-between items-center"><Button type="button" variant="outline" size="sm" onClick={() => appendQuick({ date: new Date(), effect: 'Debit', accountId: '', reference: '', description: '', vatType: 'no_vat', inclusiveAmount: 0, affectingAccountId: '' })} className="font-bold gap-2"><Plus className="h-4 w-4" /> Add Balanced Entry</Button><Button type="submit" disabled={isLoading} className="font-black px-12 gap-2 h-11">{isLoading ? <Loader2 className="animate-spin" /> : <Calculator className="h-5 w-5" />}Post Journals</Button></div>
                                    </form>
                                </Form>
                            </div>
                        )}

                        {activeTab === 'reviewed' && (
                            <div className="p-0">
                                <Table>
                                    <TableHeader className="bg-muted/30">
                                        <TableRow>
                                            <TableHead className="px-6">Date</TableHead>
                                            <TableHead>Reference</TableHead>
                                            <TableHead>Description</TableHead>
                                            <TableHead className="text-right">Total (Incl)</TableHead>
                                            <TableHead className="text-right px-6">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {groupedJournals.length === 0 ? (
                                            <TableRow><TableCell colSpan={5} className="text-center py-20 text-muted-foreground italic">No journals found.</TableCell></TableRow>
                                        ) : groupedJournals.map((entries, i) => {
                                            const ref = entries[0].reference;
                                            const total = entries.reduce((s, e) => s + (e.amount > 0 ? e.amount : 0), 0);
                                            return (
                                                <TableRow key={i}>
                                                    <TableCell className="px-6 text-xs font-medium">{format(new Date(entries[0].date), 'dd/MM/yyyy')}</TableCell>
                                                    <TableCell className="font-bold text-primary">{ref}</TableCell>
                                                    <TableCell className="text-xs text-muted-foreground line-clamp-1">{entries[0].description}</TableCell>
                                                    <TableCell className="text-right font-mono font-bold">{formatPrice(total)}</TableCell>
                                                    <TableCell className="text-right px-6">
                                                        <div className="flex justify-end gap-1">
                                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-primary" onClick={() => setEditingJournal(entries)}><Edit className="h-4 w-4" /></Button>
                                                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setViewingJournal(entries)}><Eye className="h-4 w-4" /></Button>
                                                            <AlertDialog>
                                                                <AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8 text-destructive"><Trash2 className="h-4 w-4"/></Button></AlertDialogTrigger>
                                                                <AlertDialogContent>
                                                                    <AlertDialogHeader><AlertDialogTitle>Delete Journal {ref}?</AlertDialogTitle><AlertDialogDescription>This will remove all associated lines.</AlertDialogDescription></AlertDialogHeader>
                                                                    <AlertDialogFooter>
                                                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                                        <AlertDialogAction onClick={() => handleDeleteJournal(ref)} className="bg-destructive text-destructive-foreground">Delete</AlertDialogAction>
                                                                    </AlertDialogFooter>
                                                                </AlertDialogContent>
                                                            </AlertDialog>
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })}
                                    </TableBody>
                                </Table>
                            </div>
                        )}
                    </div>
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

export default function GeneralLedgerPage() {
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
            const journalsQuery = query(collection(db, 'aiAccountantClients', clientId, 'transactions'), where('bankAccountId', '==', 'JOURNAL'), orderBy('date', 'desc'), orderBy('reference', 'asc'));
            const journalsSnapshot = await getDocs(journalsQuery);
            setAllJournals(journalsSnapshot.docs.map(d => ({id: d.id, ...d.data()}) as AllocatedTransaction));
        } catch (e) { console.error(e); } finally { setIsLoading(false); }
    };

    useEffect(() => { fetchClientAndJournals(); }, [clientId]);

    return (
        <Suspense fallback={<div className="flex justify-center items-center h-64"><Loader2 className="animate-spin" /></div>}>
            <JournalManager clientId={clientId} client={client} fetchClientAndJournals={fetchClientAndJournals} allJournals={allJournals} isLoading={isLoading} setIsLoading={setIsLoading} />
        </Suspense>
    );
}
