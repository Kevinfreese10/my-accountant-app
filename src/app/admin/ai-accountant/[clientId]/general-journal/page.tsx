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
import { Loader2, Plus, Trash2, CalendarIcon, Eye, Edit, ChevronsUpDown, PlusCircle, Calculator, AlertCircle, CheckCircle, FileUp, Download, X } from 'lucide-react';
import { getFirestore, collection, writeBatch, Timestamp, query, where, orderBy, getDocs, deleteDoc, arrayUnion, setDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
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

const journalLineSchema = z.object({
  date: z.date({ required_error: "Date is required for every line." }),
  accountId: z.string().min(1, "Account is required."),
  description: z.string().min(1, "Description is required."),
  debit: z.number().min(0).optional(),
  credit: z.number().min(0).optional(),
  vatType: z.string().default('no_vat'),
});

const formSchema = z.object({
  reference: z.string().min(1, "Reference is required."),
  lines: z.array(journalLineSchema).min(2, "At least two lines are required."),
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
    message: "Each unique date within this journal must balance (Inclusive Debits == Inclusive Credits).",
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

function ImportJournalsDialog({ client, onImport }: { client: User | null; onImport: (lines: any[]) => void }) {
    const [isOpen, setIsOpen] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const { toast } = useToast();

    const handleDownloadTemplate = () => {
        const headers = [['Date (DD/MM/YYYY)', 'Account Number', 'Description', 'VAT Type', 'Debit', 'Credit']];
        const today = format(new Date(), 'dd/MM/yyyy');
        const example = [
            [today, '3000-010', 'Office Rent Payment', 'standard_rated_purchases', 5000, 0],
            [today, '8400-001', 'Bank Contra', 'no_vat', 0, 5750]
        ];
        const ws = XLSX.utils.aoa_to_sheet([...headers, ...example]);
        const wb = XLSX.utils.book_new();
        
        if (client?.chartOfAccounts) {
            const coaData = [['Account Number', 'Description', 'Section']];
            client.chartOfAccounts.forEach(acc => coaData.push([acc.accountNumber, acc.description, acc.section]));
            const coaWs = XLSX.utils.aoa_to_sheet(coaData);
            XLSX.utils.book_append_sheet(wb, coaWs, "Account Reference");
        }

        XLSX.utils.book_append_sheet(wb, ws, "Journal Template");
        XLSX.writeFile(wb, "multi_date_journal_template.xlsx");
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !client) return;

        setIsUploading(true);
        const reader = new FileReader();
        reader.readAsArrayBuffer(file);
        reader.onload = async (event) => {
            try {
                const data = new Uint8Array(event.target?.result as ArrayBuffer);
                const workbook = XLSX.read(data, { type: 'array' });
                const sheet = workbook.Sheets["Journal Template"] || workbook.Sheets[workbook.SheetNames[0]];
                const json = XLSX.utils.sheet_to_json(sheet) as any[];

                const importedLines = json.map((row) => {
                    const rawDate = row['Date (DD/MM/YYYY)'] || row['Date'] || row['date'];
                    let parsedDate: Date | null = null;
                    
                    if (rawDate) {
                        if (typeof rawDate === 'number') {
                            parsedDate = XLSX.utils.sheet_to_date(sheet, rawDate);
                        } else if (typeof rawDate === 'string') {
                            parsedDate = parse(rawDate.trim(), 'dd/MM/yyyy', new Date());
                            if (!isValid(parsedDate)) {
                                parsedDate = new Date(rawDate);
                            }
                        }
                    }

                    if (!parsedDate || !isValid(parsedDate)) return null;

                    const accNum = String(row['Account Number'] || row['accountNumber'] || '').trim();
                    const desc = String(row['Description'] || row['description'] || '').trim();
                    const debit = parseFloat(String(row['Debit'] || 0).replace(/[^\d.]/g, '')) || 0;
                    const credit = parseFloat(String(row['Credit'] || 0).replace(/[^\d.]/g, '')) || 0;
                    let vatType = String(row['VAT Type'] || 'no_vat').trim().toLowerCase();

                    if (vatType.includes('standard') && vatType.includes('purchase')) vatType = 'standard_rated_purchases';
                    else if (vatType.includes('standard') && vatType.includes('sale')) vatType = 'standard_rated_sales';
                    else if (vatType.includes('capital') && vatType.includes('purchase')) vatType = 'capital_goods_purchases';
                    else if (vatType.includes('zero') && vatType.includes('sale')) vatType = 'zero_rated_sales';
                    else if (!allVatTypes.some(v => v.name === vatType)) vatType = 'no_vat';

                    const account = client.chartOfAccounts?.find(a => a.accountNumber === accNum);

                    if (!accNum || (!debit && !credit)) return null;

                    return {
                        date: parsedDate,
                        accountId: account?.id || accNum,
                        description: desc || 'Journal Entry',
                        debit,
                        credit,
                        vatType
                    };
                }).filter((l): l is NonNullable<typeof l> => l !== null);

                if (importedLines.length === 0) {
                    toast({ title: "Import Failed", description: "No valid lines with UK format dates (DD/MM/YYYY) found.", variant: "destructive" });
                } else {
                    onImport(importedLines);
                    toast({ title: "Import Successful", description: `Loaded ${importedLines.length} journal lines.` });
                    setIsOpen(false);
                }
            } catch (error) {
                console.error(error);
                toast({ title: "Import Failed", variant: "destructive" });
            } finally {
                setIsUploading(false);
            }
        };
    };

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2 border-primary/20 text-primary font-bold">
                    <FileUp className="h-4 w-4" /> Multi-Date Import (UK)
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Import Multi-Date Journal</DialogTitle>
                    <DialogDescription>Bulk load journal lines from Excel using UK date format (DD/MM/YYYY).</DialogDescription>
                </DialogHeader>
                <div className="space-y-6 py-4">
                    <div className="space-y-2">
                        <Label>1. Download the Template</Label>
                        <Button variant="secondary" className="w-full justify-start h-12 gap-3" onClick={handleDownloadTemplate}>
                            <Download className="h-5 w-5 text-primary" />
                            <div className="text-left">
                                <p className="text-sm font-bold text-slate-900">Download UK Template</p>
                                <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-black">DD/MM/YYYY Required</p>
                            </div>
                        </Button>
                    </div>
                    <Separator />
                    <div className="space-y-2">
                        <Label>2. Upload Your File</Label>
                        <Input type="file" accept=".xlsx,.xls,.csv" onChange={handleFileChange} disabled={isUploading} className="cursor-pointer" />
                        {isUploading && <div className="flex items-center gap-2 text-sm text-primary animate-pulse font-bold mt-2"><Loader2 className="h-4 w-4 animate-spin"/> Processing...</div>}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

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
            
            toast({ title: 'Account Created' });
            onAccountCreated();
            form.reset();
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
                <DialogHeader>
                    <DialogTitle>Create New Account</DialogTitle>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(handleCreateAccount)} className="space-y-4">
                        <FormField control={form.control} name="accountNumber" render={({ field }) => ( <FormItem><FormLabel>Account Number</FormLabel><FormControl><Input placeholder="e.g., 3000-058" {...field} /></FormControl><FormMessage /></FormItem>)} />
                        <FormField control={form.control} name="description" render={({ field }) => ( <FormItem><FormLabel>Description</FormLabel><FormControl><Input placeholder="e.g., Office Flowers" {...field} /></FormControl><FormMessage /></FormItem>)} />
                        <FormField control={form.control} name="section" render={({ field }) => ( <FormItem><FormLabel>Section</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select a section" /></SelectTrigger></FormControl><SelectContent><SelectItem value="Income Statement">Income Statement</SelectItem><SelectItem value="Balance Sheet">Balance Sheet</SelectItem></SelectContent></Select></FormItem>)} />
                        <DialogFooter>
                            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
                            <Button type="submit" disabled={isSaving}>{isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Create</Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}

function JournalManager({ clientId, client, fetchClientAndJournals, allJournals, isLoading, setIsLoading }: { clientId: string, client: User | null, fetchClientAndJournals: () => void, allJournals: AllocatedTransaction[], isLoading: boolean, setIsLoading: (val: boolean) => void }) {
    const { toast } = useToast();

    const [viewingJournal, setViewingJournal] = useState<AllocatedTransaction[] | null>(null);
    const [editingJournalRef, setEditingJournalRef] = useState<string | null>(null);
    const [isCreateAccountOpen, setIsCreateAccountOpen] = useState(false);

    const form = useForm<JournalFormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            reference: '',
            lines: [
                { date: new Date(), accountId: '', description: '', debit: 0, credit: 0, vatType: 'no_vat' },
                { date: new Date(), accountId: '', description: '', debit: 0, credit: 0, vatType: 'no_vat' },
            ],
        },
    });
    
    const { fields, append, remove, replace } = useFieldArray({
        control: form.control,
        name: "lines",
    });
    
    const watchedLines = form.watch("lines");

    const totalsPerDate = useMemo(() => {
        const groups: Record<string, { exclDebit: number; exclCredit: number; vat: number }> = {};
        watchedLines.forEach(line => {
            if (!line.date) return;
            const dateKey = format(line.date, 'yyyy-MM-dd');
            if (!groups[dateKey]) groups[dateKey] = { exclDebit: 0, exclCredit: 0, vat: 0 };
            
            const debit = line.debit || 0;
            const credit = line.credit || 0;
            const isStandard = line.vatType === 'standard_rated_purchases' || line.vatType === 'standard_rated_sales' || line.vatType === 'capital_goods_purchases';
            
            groups[dateKey].exclDebit += debit;
            groups[dateKey].exclCredit += credit;
            if (isStandard) groups[dateKey].vat += (debit - credit) * 0.15;
        });

        return Object.entries(groups).map(([date, vals]) => ({
            date,
            ...vals,
            inclDebit: vals.exclDebit + (vals.vat > 0 ? vals.vat : 0),
            inclCredit: vals.exclCredit + (vals.vat < 0 ? -vals.vat : 0)
        }));
    }, [watchedLines]);

    const globalTotals = useMemo(() => {
        return totalsPerDate.reduce((acc, curr) => ({
            exclDebit: acc.exclDebit + curr.exclDebit,
            exclCredit: acc.exclCredit + curr.exclCredit,
            vat: acc.vat + curr.vat,
            inclDebit: acc.inclDebit + curr.inclDebit,
            inclCredit: acc.inclCredit + curr.inclCredit,
        }), { exclDebit: 0, exclCredit: 0, vat: 0, inclDebit: 0, inclCredit: 0 });
    }, [totalsPerDate]);
    
    const generalAccounts = useMemo(() => {
        const excluded = ['8000-001', '7000-000'];
        return client?.chartOfAccounts?.filter(acc => !excluded.includes(acc.accountNumber)) || [];
    }, [client]);

    const onSubmit = async (data: JournalFormValues) => {
        if (!client) return;
        setIsLoading(true);
        try {
            const batch = writeBatch(db);
            const journalTimestamp = Timestamp.now();
            const vatControlAccount = client.chartOfAccounts?.find(acc => acc.accountNumber === '7000-008')?.id;

            if(editingJournalRef) {
                 const snap = await getDocs(query(collection(db, "aiAccountantClients", client.id, "transactions"), where("reference", "==", editingJournalRef)));
                 snap.forEach(d => batch.delete(d.ref));
            }

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
                    description: line.description || 'General Journal Entry',
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
                        description: `VAT on: ${line.description || 'Journal Entry'}`,
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
            toast({ title: 'Journal Posted' });
            form.reset({
                 reference: '',
                 lines: [
                    { date: new Date(), accountId: '', description: '', debit: 0, credit: 0, vatType: 'no_vat' },
                    { date: new Date(), accountId: '', description: '', debit: 0, credit: 0, vatType: 'no_vat' },
                ],
            });
            setEditingJournalRef(null);
            fetchClientAndJournals();
        } catch (error) {
            toast({ title: 'Error', variant: 'destructive' });
        } finally {
            setIsLoading(false);
        }
    };

    const handleEditJournal = (entries: AllocatedTransaction[]) => {
        if (entries.length === 0) return;
        const ref = entries[0].reference;
        const vatCtrl = client?.chartOfAccounts?.find(acc => acc.accountNumber === '7000-008')?.id;
        const mainLines = entries.filter(e => e.allocatedTo.value !== vatCtrl);

        replace(mainLines.map(e => ({
            date: e.date instanceof Date ? e.date : new Date(e.date),
            accountId: e.allocatedTo.value,
            description: e.description,
            debit: e.amount > 0 ? e.amount : 0,
            credit: e.amount < 0 ? -e.amount : 0,
            vatType: e.vatType || 'no_vat',
        })));
        
        form.setValue('reference', ref);
        setEditingJournalRef(ref);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };
    
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
    
    const groupedGeneralJournals = useMemo(() => {
        const grouped = new Map<string, AllocatedTransaction[]>();
        const custCtrl = client?.chartOfAccounts?.find((acc: any) => acc.accountNumber === '8000-001')?.id;
        const supCtrl = client?.chartOfAccounts?.find((acc: any) => acc.accountNumber === '7000-000')?.id;

        allJournals.forEach(tx => {
            if (tx.allocatedTo?.value !== custCtrl && tx.allocatedTo?.value !== supCtrl && !tx.reference.startsWith('TAX-')) {
                const uniqueKey = `${tx.reference}-${tx.allocatedAt?.seconds || 0}`;
                if (!grouped.has(uniqueKey)) grouped.set(uniqueKey, []);
                grouped.get(uniqueKey)?.push(tx);
            }
        });
        return Array.from(grouped.values()).sort((a, b) => new Date(b[0].date).getTime() - new Date(a[0].date).getTime());
    }, [allJournals, client]);
    
     const groupedTaxJournals = useMemo(() => {
        const grouped = new Map<string, AllocatedTransaction[]>();
        allJournals.forEach(tx => {
            if (tx.reference.startsWith('TAX-')) {
                 const uniqueKey = `${tx.reference}-${tx.allocatedAt?.seconds || 0}`;
                if (!grouped.has(uniqueKey)) grouped.set(uniqueKey, []);
                grouped.get(uniqueKey)?.push(tx);
            }
        });
        return Array.from(grouped.values()).sort((a, b) => new Date(b[0].date).getTime() - new Date(a[0].date).getTime());
    }, [allJournals]);

    const isUnbalanced = totalsPerDate.some(g => Math.abs(g.inclDebit - g.inclCredit) > 0.01);

    return (
        <div className="space-y-8">
            <CreateGeneralAccountDialog client={client} onAccountCreated={fetchClientAndJournals} open={isCreateAccountOpen} onOpenChange={setIsCreateAccountOpen} />
            
            <Card>
                <CardHeader>
                    <div className="flex justify-between items-center flex-wrap gap-4">
                        <div>
                            <CardTitle className="text-xl font-bold">{editingJournalRef ? `Edit Journal: ${editingJournalRef}` : 'Post General Journal'}</CardTitle>
                            <CardDescription>Support for multi-date reference. UK date format (DD/MM/YYYY) supported.</CardDescription>
                        </div>
                        <div className="flex gap-2 flex-wrap">
                            <ImportJournalsDialog client={client} onImport={(lines) => replace(lines)} />
                            {editingJournalRef && (
                                <Button variant="outline" onClick={() => { 
                                    setEditingJournalRef(null); 
                                    form.reset({ reference: '', lines: [ { date: new Date(), accountId: '', description: '', debit: 0, credit: 0, vatType: 'no_vat' }, { date: new Date(), accountId: '', description: '', debit: 0, credit: 0, vatType: 'no_vat' } ] }); 
                                }}>
                                    Discard Edit
                                </Button>
                            )}
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                            <div className="max-w-sm">
                                <FormField control={form.control} name="reference" render={({ field }) => ( <FormItem><FormLabel className="font-bold uppercase text-[10px] tracking-widest text-muted-foreground">Reference / Batch Code</FormLabel><FormControl><Input placeholder="e.g., JNL001" {...field} disabled={!!editingJournalRef} className="h-12 font-bold text-lg" /></FormControl><FormMessage /></FormItem> )}/>
                            </div>

                            <div className="border rounded-xl overflow-hidden shadow-sm">
                                <Table>
                                    <TableHeader className="bg-muted/50">
                                        <TableRow>
                                            <TableHead className="w-[180px] font-bold text-[10px] uppercase">Date</TableHead>
                                            <TableHead className="w-[200px] font-bold text-[10px] uppercase">Account</TableHead>
                                            <TableHead className="font-bold text-[10px] uppercase">Description</TableHead>
                                            <TableHead className="w-[120px] font-bold text-[10px] uppercase">VAT %</TableHead>
                                            <TableHead className="w-[120px] font-bold text-[10px] uppercase text-right">Debit (Excl)</TableHead>
                                            <TableHead className="w-[120px] font-bold text-[10px] uppercase text-right">Credit (Excl)</TableHead>
                                            <TableHead className="w-10"></TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {fields.map((field, index) => (
                                        <TableRow key={field.id} className="hover:bg-muted/10">
                                                <TableCell>
                                                    <FormField control={form.control} name={`lines.${index}.date`} render={({ field }) => (
                                                        <Popover>
                                                            <PopoverTrigger asChild>
                                                                <Button variant="outline" size="sm" className="w-full justify-start font-bold h-9 text-[11px] border-primary/10">
                                                                    <CalendarIcon className="mr-2 h-3.5 w-3.5 opacity-50" />
                                                                    {field.value ? format(field.value, "dd/MM/yyyy") : "Select Date"}
                                                                </Button>
                                                            </PopoverTrigger>
                                                            <PopoverContent className="w-auto p-0" align="start">
                                                                <Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus />
                                                            </PopoverContent>
                                                        </Popover>
                                                    )} />
                                                </TableCell>
                                                <TableCell>
                                                    <FormField control={form.control} name={`lines.${index}.accountId`} render={({ field }) => (
                                                        <Popover>
                                                            <PopoverTrigger asChild>
                                                                <Button variant="outline" size="sm" className="w-full justify-between h-9 text-[11px] border-primary/10">
                                                                    <span className="truncate">{field.value ? generalAccounts.find(acc => acc.id === field.value)?.description : "Select account..."}</span>
                                                                    <ChevronsUpDown className="ml-2 h-3.5 w-3.5 opacity-50 shrink-0" />
                                                                </Button>
                                                            </PopoverTrigger>
                                                            <PopoverContent className="w-[300px] p-0">
                                                                <Command>
                                                                    <CommandInput placeholder="Search GL..." />
                                                                    <CommandList>
                                                                        <CommandEmpty>No account found.</CommandEmpty>
                                                                        <CommandGroup>
                                                                            <CommandItem onSelect={() => setIsCreateAccountOpen(true)} className="text-primary cursor-pointer font-bold"><PlusCircle className="mr-2 h-4 w-4" />New Account</CommandItem>
                                                                            {generalAccounts.map((acc) => (
                                                                                <CommandItem key={acc.id} value={acc.description} onSelect={() => form.setValue(`lines.${index}.accountId`, acc.id, { shouldDirty: true })}>
                                                                                    <CheckCircle className={cn("mr-2 h-4 w-4", field.value === acc.id ? "opacity-100" : "opacity-0")} />
                                                                                    {acc.description}
                                                                                </CommandItem>
                                                                            ))}
                                                                        </CommandGroup>
                                                                    </CommandList>
                                                                </Command>
                                                            </PopoverContent>
                                                        </Popover>
                                                    )} />
                                                </TableCell>
                                                <TableCell><FormField control={form.control} name={`lines.${index}.description`} render={({ field }) => ( <Input className="h-9 text-[11px] font-medium" {...field} /> )}/></TableCell>
                                                <TableCell>
                                                    <FormField control={form.control} name={`lines.${index}.vatType`} render={({ field }) => ( 
                                                        <Select onValueChange={field.onChange} value={field.value} disabled={!client?.isVatRegistered}>
                                                            <FormControl><SelectTrigger className="h-9 text-[10px] font-bold"><SelectValue /></SelectTrigger></FormControl>
                                                            <SelectContent>{allVatTypes.map(vt => <SelectItem key={vt.name} value={vt.name} className="text-xs">{vt.label}</SelectItem>)}</SelectContent>
                                                        </Select>
                                                    )} />
                                                </TableCell>
                                                <TableCell><FormField control={form.control} name={`lines.${index}.debit`} render={({ field }) => ( <Input type="number" step="0.01" className="h-9 text-[11px] text-right font-mono font-bold" {...field} onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)} /> )}/></TableCell>
                                                <TableCell><FormField control={form.control} name={`lines.${index}.credit`} render={({ field }) => ( <Input type="number" step="0.01" className="h-9 text-[11px] text-right font-mono font-bold" {...field} onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)} /> )}/></TableCell>
                                                <TableCell>
                                                    <Button type="button" size="icon" variant="ghost" onClick={() => remove(index)} disabled={fields.length <= 2} className="h-8 w-8 text-destructive"><Trash2 className="h-4 w-4" /></Button>
                                                </TableCell>
                                        </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>

                            <div className="flex justify-between items-center">
                                <Button type="button" variant="outline" size="sm" onClick={() => append({ date: new Date(), accountId: '', description: '', debit: 0, credit: 0, vatType: 'no_vat' })} className="font-bold gap-2">
                                    <Plus className="h-4 w-4" /> Add Transaction Line
                                </Button>
                                {form.formState.errors.lines && (
                                    <div className="flex items-center gap-2 text-destructive bg-destructive/10 px-4 py-2 rounded-lg border border-destructive/20">
                                        <AlertCircle className="h-4 w-4" />
                                        <span className="text-xs font-black uppercase tracking-tight">{form.formState.errors.lines.message}</span>
                                    </div>
                                )}
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {totalsPerDate.map((group) => (
                                    <Card key={group.date} className={cn("border-l-4 shadow-sm", Math.abs(group.inclDebit - group.inclCredit) > 0.01 ? "border-l-destructive bg-destructive/5" : "border-l-green-500 bg-green-50/30")}>
                                        <CardHeader className="py-3 px-4 flex flex-row items-center justify-between space-y-0">
                                            <CardTitle className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{format(new Date(group.date), 'dd MMM yyyy')}</CardTitle>
                                            {Math.abs(group.inclDebit - group.inclCredit) < 0.01 && <CheckCircle className="h-4 w-4 text-green-600" />}
                                        </CardHeader>
                                        <CardContent className="px-4 pb-3 space-y-2">
                                            <div className="flex justify-between text-[11px]">
                                                <span className="text-muted-foreground">Excl Debits:</span>
                                                <span className="font-mono">{formatPrice(group.exclDebit)}</span>
                                            </div>
                                            <div className="flex justify-between text-[11px]">
                                                <span className="text-muted-foreground">Excl Credits:</span>
                                                <span className="font-mono">{formatPrice(group.exclCredit)}</span>
                                            </div>
                                            <div className="flex justify-between text-[11px] font-bold text-primary">
                                                <span>VAT Portion:</span>
                                                <span className="font-mono">R {formatPrice(Math.abs(group.vat))}</span>
                                            </div>
                                            <Separator />
                                            <div className="flex justify-between text-xs font-black pt-1">
                                                <span>INCLUSIVE:</span>
                                                <span className={cn("font-mono", Math.abs(group.inclDebit - group.inclCredit) > 0.01 ? "text-destructive" : "text-slate-900")}>
                                                    {formatPrice(group.inclDebit)} / {formatPrice(group.inclCredit)}
                                                </span>
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>

                            <div className="bg-slate-900 rounded-xl p-6 text-white flex justify-between items-center shadow-xl mt-8">
                                <div className="space-y-1">
                                    <p className="text-[10px] font-black uppercase tracking-widest opacity-60">Global Journal Total</p>
                                    <p className="text-xs opacity-80">Inclusive values for all dates</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-2xl font-black tabular-nums font-mono">
                                        R {formatPrice(globalTotals.inclDebit)}
                                    </p>
                                    {isUnbalanced && <p className="text-[10px] text-red-400 font-bold uppercase tracking-tighter">Reference is unbalanced</p>}
                                </div>
                            </div>

                            <div className="flex justify-end pt-4">
                                <Button type="submit" size="lg" disabled={isLoading || isUnbalanced} className="font-black px-12 gap-2 shadow-lg h-12">
                                    {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Calculator className="h-5 w-5" />}
                                    {editingJournalRef ? 'Update Journal' : 'Finalize & Post Journal'}
                                </Button>
                            </div>
                        </form>
                    </Form>
                </CardContent>
            </Card>

            <Tabs defaultValue="general">
                <TabsList className="w-full grid grid-cols-2 h-12 shadow-sm border">
                    <TabsTrigger value="general" className="font-bold">General Journals ({groupedGeneralJournals.length})</TabsTrigger>
                    <TabsTrigger value="tax" className="font-bold">Tax Provision Journals ({groupedTaxJournals.length})</TabsTrigger>
                </TabsList>
                
                <TabsContent value="general" className="pt-4">
                    <Card>
                        <CardHeader><CardTitle className="text-sm">Posted Journal History</CardTitle></CardHeader>
                        <CardContent className="p-0">
                            <Table>
                                <TableHeader className="bg-muted/30">
                                    <TableRow>
                                        <TableHead>Primary Date</TableHead>
                                        <TableHead>Reference</TableHead>
                                        <TableHead>Summary Description</TableHead>
                                        <TableHead className="text-right">Total (Incl)</TableHead>
                                        <TableHead className="text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {groupedGeneralJournals.length === 0 ? (
                                        <TableRow><TableCell colSpan={5} className="text-center py-12 text-muted-foreground italic">No journals found.</TableCell></TableRow>
                                    ) : groupedGeneralJournals.map((entries, i) => {
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
                                                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEditJournal(entries)}><Edit className="h-4 w-4" /></Button>
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
                </TabsContent>

                <TabsContent value="tax" className="pt-4">
                    <Card>
                        <CardHeader><CardTitle className="text-sm">Auto-Generated Tax Journals</CardTitle></CardHeader>
                        <CardContent className="p-0">
                            <Table>
                                <TableHeader className="bg-muted/30">
                                    <TableRow>
                                        <TableHead>Date</TableHead>
                                        <TableHead>Reference</TableHead>
                                        <TableHead className="text-right">Provision Amount</TableHead>
                                        <TableHead className="text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {groupedTaxJournals.map((entries, i) => (
                                        <TableRow key={i}>
                                            <TableCell className="text-xs">{format(new Date(entries[0].date), 'dd/MM/yyyy')}</TableCell>
                                            <TableCell className="font-bold">{entries[0].reference}</TableCell>
                                            <TableCell className="text-right font-mono font-bold text-destructive">{formatPrice(Math.abs(entries.find(e => e.amount > 0)?.amount || 0))}</TableCell>
                                            <TableCell className="text-right">
                                                <Button variant="ghost" size="icon" onClick={() => setViewingJournal(entries)}><Eye className="h-4 w-4" /></Button>
                                                <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDeleteJournal(entries[0].reference)}><Trash2 className="h-4 w-4" /></Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

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
