'use client';

import { useState, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Download, Sparkles, FileText, Upload, AlertTriangle, CheckCircle2, Search, ArrowRight, User, Banknote, Calendar as CalendarIcon, CheckCheck, ChevronsUpDown, Info, RotateCcw, Trash } from 'lucide-react';
import { extractStatementData } from '@/ai/flows/extract-statement-data';
import { extractStatementPeriod, ExtractStatementPeriodOutput } from '@/ai/flows/extract-statement-period';
import { getFirestore, collection, getDocs, doc, query, where, getDoc, writeBatch, serverTimestamp, orderBy, limit } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { User as UserType, ChartOfAccount, ImportedTransaction, AllocationRule } from '@/lib/types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Slider } from '@/components/ui/slider';
import { format, parseISO, isWithinInterval, startOfDay, endOfDay } from 'date-fns';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList, CommandGroup } from '@/components/ui/command';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

const db = getFirestore(firebaseApp);

const formSchema = z.object({
  clientId: z.string().min(1, 'Please select a client.'),
  bankAccountId: z.string().min(1, 'Please select a bank account.'),
  statement: z.custom<FileList>().refine((files) => files && files.length > 0, 'A file is required.'),
});

type Transaction = {
  date: string;
  description: string;
  amount: number;
};

const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-ZA', {
      style: 'currency',
      currency: 'ZAR',
    }).format(price);
};

export default function PdfToCsvPage() {
  const [isExtracting, setIsExtracting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [clients, setClients] = useState<UserType[]>([]);
  const [selectedClient, setSelectedClient] = useState<UserType | null>(null);
  const [bankAccounts, setBankAccounts] = useState<ChartOfAccount[]>([]);
  const [currentAccountData, setCurrentAccountData] = useState<{ balance: number, lastTxDate: string | null }>({ balance: 0, lastTxDate: null });
  const [existingTransactions, setExistingTransactions] = useState<ImportedTransaction[]>([]);
  const [createOpeningBalance, setCreateOpeningBalance] = useState(false);
  
  const [extractedTransactions, setExtractedTransactions] = useState<Transaction[]>([]);
  const [statementMeta, setStatementMeta] = useState<ExtractStatementPeriodOutput | null>(null);
  
  const [dateRange, setDateRange] = useState<[number, number]>([0, 100]);
  const { toast } = useToast();
  const router = useRouter();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { clientId: '', bankAccountId: '' },
  });

  const watchClientId = form.watch('clientId');
  const watchBankAccountId = form.watch('bankAccountId');

  useEffect(() => {
    const fetchClients = async () => {
        const snap = await getDocs(query(collection(db, "aiAccountantClients"), orderBy("name")));
        setClients(snap.docs.map(d => ({ ...d.data(), id: d.id, uid: d.id } as UserType)));
    };
    fetchClients();
  }, []);

  useEffect(() => {
    if (watchClientId) {
        const client = clients.find(c => c.id === watchClientId);
        if (client) {
            setSelectedClient(client);
            setBankAccounts(client.chartOfAccounts?.filter(acc => acc.accountNumber.startsWith('8400-')) || []);
        }
    }
    setCreateOpeningBalance(false);
  }, [watchClientId, clients]);

  useEffect(() => {
    const fetchAccountStats = async () => {
        if (!watchClientId || !watchBankAccountId) return;
        
        const transRef = collection(db, 'aiAccountantClients', watchClientId, 'transactions');
        const q = query(transRef, where('bankAccountId', '==', watchBankAccountId));
        const snap = await getDocs(q);
        const txs = snap.docs.map(d => ({ ...d.data(), id: d.id } as ImportedTransaction));
        setExistingTransactions(txs);

        const balance = txs.reduce((s, t) => s + t.amount, 0);
        const lastTx = txs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
        
        setCurrentAccountData({
            balance,
            lastTxDate: lastTx ? lastTx.date : null
        });
    };
    fetchAccountStats();
    setCreateOpeningBalance(false);
  }, [watchClientId, watchBankAccountId]);

  const sortedDates = useMemo(() => {
    if (extractedTransactions.length === 0) return [];
    return Array.from(new Set(extractedTransactions.map(tx => tx.date))).sort();
  }, [extractedTransactions]);

  const filteredTransactions = useMemo(() => {
    if (extractedTransactions.length === 0) return [];
    const startDate = sortedDates[Math.floor((dateRange[0] / 100) * (sortedDates.length - 1))];
    const endDate = sortedDates[Math.floor((dateRange[1] / 100) * (sortedDates.length - 1))];
    
    return extractedTransactions.filter(tx => tx.date >= startDate && tx.date <= endDate);
  }, [extractedTransactions, sortedDates, dateRange]);

  const calculatedRecon = useMemo(() => {
    if (!statementMeta) return null;
    const importTotal = filteredTransactions.reduce((s, t) => s + t.amount, 0);
    const startingBalance = createOpeningBalance ? statementMeta.openingBalance : currentAccountData.balance;
    const projectedBalance = startingBalance + importTotal;
    const diff = Math.abs(projectedBalance - statementMeta.closingBalance);
    const isMatched = diff < 0.01;

    return { importTotal, projectedBalance, diff, isMatched };
  }, [statementMeta, filteredTransactions, currentAccountData.balance, createOpeningBalance]);

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    const file = values.statement[0];
    if (!file) return;

    setIsExtracting(true);
    setExtractedTransactions([]);
    setStatementMeta(null);
    toast({ title: 'AI Analysis Started', description: 'Extracting metadata and transactions...' });

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = async () => {
      const dataUrl = reader.result as string;
      try {
        const [meta, data] = await Promise.all([
            extractStatementPeriod({ statementPdf: dataUrl }),
            extractStatementData({ statementFile: dataUrl })
        ]);

        if (meta) setStatementMeta(meta);
        if (data?.transactions) {
            setExtractedTransactions(data.transactions);
            toast({ title: 'Extraction Complete', description: `Found ${data.transactions.length} transactions.` });
        }
      } catch (error) {
        console.error('Extraction error:', error);
        toast({ title: 'AI Error', description: 'Failed to extract data from statement.', variant: 'destructive' });
      } finally {
        setIsExtracting(false);
      }
    };
  };

  const handleFinalImport = async () => {
    if (!selectedClient || !watchBankAccountId || filteredTransactions.length === 0) return;
    setIsImporting(true);
    
    try {
        const rulesRef = collection(db, "allocationRules");
        const rulesSnap = await getDocs(rulesRef);
        const globalRules = rulesSnap.docs.map(d => ({ id: d.id, ...d.data() } as AllocationRule));
        const allRules = [...(selectedClient.allocationRules || []), ...globalRules].sort((a, b) => (a.priority || 99) - (b.priority || 99));

        const batch = writeBatch(db);
        let matchCount = 0;

        // Create opening balance transaction if requested
        if (createOpeningBalance && statementMeta) {
            const openBalRef = doc(collection(db, 'aiAccountantClients', selectedClient.id, 'transactions'));
            batch.set(openBalRef, {
                clientId: selectedClient.id,
                date: new Date(statementMeta.startDate).toISOString(),
                reference: `OPEN-BAL-${Date.now()}`,
                description: "OPENING BALANCE",
                amount: statementMeta.openingBalance,
                isExpense: statementMeta.openingBalance < 0,
                bankAccountId: watchBankAccountId,
                status: 'allocated',
                allocatedTo: { value: '9500-002', type: 'account' },
                vatType: 'no_vat',
                allocatedAt: serverTimestamp(),
                allocationSource: 'manual'
            });
        }

        filteredTransactions.forEach(tx => {
            const match = allRules.find(r => r.keywords.some(kw => tx.description.toUpperCase().includes(kw.toUpperCase())));
            
            const txData: any = {
                clientId: selectedClient.id,
                date: new Date(tx.date).toISOString(),
                reference: `PDF-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                description: tx.description.toUpperCase(),
                amount: tx.amount,
                isExpense: tx.amount < 0,
                bankAccountId: watchBankAccountId,
                status: match ? 'reviewed' : 'new'
            };

            if (match) {
                const keyword = match.keywords.find(kw => tx.description.toUpperCase().includes(kw.toUpperCase()));
                txData.allocatedTo = { value: match.accountId, type: 'account' };
                txData.vatType = selectedClient.isVatRegistered ? match.vatType : 'no_vat';
                txData.allocatedAt = serverTimestamp();
                txData.allocationSource = 'rule';
                txData.matchedRuleId = match.id;
                txData.matchedRuleDescription = match.description;
                txData.matchedKeyword = keyword;
                matchCount++;
            }

            const newRef = doc(collection(db, 'aiAccountantClients', selectedClient.id, 'transactions'));
            batch.set(newRef, txData);
        });

        await batch.commit();
        toast({ title: 'Import Successful', description: `${filteredTransactions.length} transactions imported. ${matchCount} auto-allocated.` });
        router.push(`/admin/ai-accountant/${selectedClient.id}/bank/transactions?accountId=${watchBankAccountId}`);
    } catch (e) {
        console.error("Import error:", e);
        toast({ title: 'Import Failed', variant: 'destructive' });
    } finally {
        setIsImporting(false);
    }
  };

  const isDuplicate = (tx: Transaction) => {
    return existingTransactions.some(e => 
        format(new Date(e.date), 'yyyy-MM-dd') === tx.date && 
        e.description.toLowerCase().trim() === tx.description.toLowerCase().trim() && 
        Math.abs(e.amount - tx.amount) < 0.01
    );
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">AI Bank Statement Importer</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <div className="lg:col-span-4 space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg">Target Account</CardTitle>
                    <CardDescription>Select the client and bank account for this statement.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                            <FormField
                                control={form.control}
                                name="clientId"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Client</FormLabel>
                                        <Select onValueChange={field.onChange} value={field.value}>
                                            <FormControl><SelectTrigger><SelectValue placeholder="Select client..." /></SelectTrigger></FormControl>
                                            <SelectContent>{clients.map(c => <SelectItem key={c.id} value={c.id}>{c.companyName || c.name}</SelectItem>)}</SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="bankAccountId"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Bank Account</FormLabel>
                                        <Select onValueChange={field.onChange} value={field.value} disabled={!watchClientId}>
                                            <FormControl><SelectTrigger><SelectValue placeholder="Select account..." /></SelectTrigger></FormControl>
                                            <SelectContent>{bankAccounts.map(acc => <SelectItem key={acc.id} value={acc.id}>{acc.description}</SelectItem>)}</SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            
                            {watchBankAccountId && (
                                <div className="bg-muted/50 p-3 rounded-lg text-xs space-y-1 animate-in fade-in">
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Current Balance:</span>
                                        <span className="font-bold">{formatPrice(currentAccountData.balance)}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Last Imported:</span>
                                        <span className="font-semibold">{currentAccountData.lastTxDate ? format(new Date(currentAccountData.lastTxDate), 'dd MMM yyyy') : 'Never'}</span>
                                    </div>
                                </div>
                            )}

                            <Separator />

                            <FormField
                                control={form.control}
                                name="statement"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Statement File (PDF/Image)</FormLabel>
                                        <FormControl>
                                            <Input
                                                type="file"
                                                accept="application/pdf,image/*"
                                                onChange={(e) => field.onChange(e.target.files)}
                                                disabled={!watchBankAccountId || isExtracting}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <Button type="submit" className="w-full" disabled={isExtracting || !watchBankAccountId}>
                                {isExtracting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                                {isExtracting ? 'Extracting...' : 'Extract from PDF'}
                            </Button>
                        </form>
                    </Form>
                </CardContent>
            </Card>

            {statementMeta && (
                <Card className="bg-primary/5 border-primary/20 animate-in slide-in-from-left-2">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-bold uppercase tracking-wider flex items-center gap-2">
                            <Info className="h-4 w-4 text-primary" />
                            Statement Details
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="text-xs space-y-2">
                        <div className="flex justify-between"><span>Period:</span><span className="font-bold">{format(parseISO(statementMeta.startDate), 'dd MMM')} - {format(parseISO(statementMeta.endDate), 'dd MMM yyyy')}</span></div>
                        <div className="flex justify-between"><span>Opening Bal:</span><span className="font-mono">{formatPrice(statementMeta.openingBalance)}</span></div>
                        <div className="flex justify-between border-t pt-2 mt-2"><span>Closing Bal:</span><span className="font-mono font-bold text-primary">{formatPrice(statementMeta.closingBalance)}</span></div>
                    </CardContent>
                </Card>
            )}
        </div>

        <div className="lg:col-span-8 space-y-6">
            {extractedTransactions.length > 0 ? (
                <div className="space-y-6">
                    <Card>
                        <CardHeader>
                            <div className="flex justify-between items-center">
                                <div>
                                    <CardTitle>Review & Reconcile</CardTitle>
                                    <CardDescription>Adjust the date range and verify the calculated balance.</CardDescription>
                                </div>
                                <div className="text-right">
                                    <p className="text-[10px] font-bold uppercase text-muted-foreground">Importing</p>
                                    <p className="text-lg font-bold text-primary">{filteredTransactions.length} of {extractedTransactions.length} items</p>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-8">
                            <div className="space-y-4">
                                <div className="flex justify-between text-xs font-medium">
                                    <span>From: {sortedDates[Math.floor((dateRange[0] / 100) * (sortedDates.length - 1))]}</span>
                                    <span>To: {sortedDates[Math.floor((dateRange[1] / 100) * (sortedDates.length - 1))]}</span>
                                </div>
                                <Slider
                                    value={dateRange}
                                    onValueChange={(v) => setDateRange(v as [number, number])}
                                    max={100}
                                    step={1}
                                    className="py-4"
                                />
                                <p className="text-[10px] text-muted-foreground italic text-center">Slide to adjust which dates from the statement are imported.</p>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="p-4 rounded-xl border bg-muted/20 space-y-2">
                                    <p className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest">Calculated Recon</p>
                                    <div className="flex justify-between text-xs"><span>Account Current Bal:</span><span>{formatPrice(currentAccountData.balance)}</span></div>
                                    {createOpeningBalance && (
                                        <div className="flex justify-between text-xs text-blue-600 font-semibold"><span>Initial Opening Bal:</span><span>{formatPrice(statementMeta?.openingBalance || 0)}</span></div>
                                    )}
                                    <div className="flex justify-between text-xs"><span>Import Items Total:</span><span className={calculatedRecon?.importTotal! < 0 ? "text-destructive" : "text-green-600"}>{formatPrice(calculatedRecon?.importTotal || 0)}</span></div>
                                    <Separator />
                                    <div className="flex justify-between text-sm font-bold pt-1"><span>Projected GL Bal:</span><span>{formatPrice(calculatedRecon?.projectedBalance || 0)}</span></div>
                                </div>

                                <div className={cn("p-4 rounded-xl border flex flex-col justify-center items-center text-center space-y-2 transition-colors", calculatedRecon?.isMatched ? "bg-green-50 border-green-200" : "bg-destructive/5 border-destructive/20")}>
                                    {calculatedRecon?.isMatched ? (
                                        <>
                                            <CheckCircle2 className="h-8 w-8 text-green-600" />
                                            <p className="text-sm font-bold text-green-800">Perfect Match!</p>
                                            <p className="text-[10px] text-green-700">Calculated balance matches the statement closing balance.</p>
                                        </>
                                    ) : (
                                        <>
                                            <AlertTriangle className="h-8 w-8 text-destructive" />
                                            <p className="text-sm font-bold text-destructive">Balance Mismatch</p>
                                            <p className="text-[10px] text-muted-foreground">Difference: {formatPrice(calculatedRecon?.diff || 0)}. <br/>Check for missing or double-counted items.</p>
                                        </>
                                    )}
                                </div>
                            </div>

                            {currentAccountData.balance === 0 && statementMeta && statementMeta.openingBalance !== 0 && (
                                <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg flex items-start gap-3">
                                    <Checkbox 
                                        id="create-opening" 
                                        checked={createOpeningBalance} 
                                        onCheckedChange={(v) => setCreateOpeningBalance(!!v)} 
                                        className="mt-1"
                                    />
                                    <div className="space-y-1">
                                        <Label htmlFor="create-opening" className="text-sm font-bold text-yellow-800">Create Opening Balance Transaction?</Label>
                                        <p className="text-xs text-yellow-700 leading-relaxed">
                                            The current bank account balance is zero. Create a transaction for <strong>{formatPrice(statementMeta.openingBalance)}</strong> to match the statement opening balance? This will be posted to the Opening Balance account (9500-002).
                                        </p>
                                    </div>
                                </div>
                            )}
                        </CardContent>
                        <CardFooter className="flex justify-end gap-2 border-t pt-4">
                            <Button variant="ghost" onClick={() => setExtractedTransactions([])}>Clear & Restart</Button>
                            <Button size="lg" onClick={handleFinalImport} disabled={isImporting || filteredTransactions.length === 0}>
                                {isImporting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Approve & Import {filteredTransactions.length} Items
                            </Button>
                        </CardFooter>
                    </Card>

                    <Card>
                        <CardHeader className="py-4">
                            <CardTitle className="text-md">Transaction Preview</CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Date</TableHead>
                                        <TableHead>Description</TableHead>
                                        <TableHead className="text-right">Amount</TableHead>
                                        <TableHead className="w-24"></TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredTransactions.map((tx, idx) => {
                                        const potentialDup = isDuplicate(tx);
                                        return (
                                            <TableRow key={idx} className={cn(potentialDup && "bg-destructive/5")}>
                                                <TableCell className="text-xs">{format(new Date(tx.date), 'dd/MM/yyyy')}</TableCell>
                                                <TableCell>
                                                    <p className="text-xs font-medium">{tx.description}</p>
                                                    {potentialDup && <p className="text-[10px] text-destructive flex items-center gap-1 mt-0.5"><AlertTriangle className="h-3 w-3" /> Potential Duplicate (Exists in DB)</p>}
                                                </TableCell>
                                                <TableCell className="text-right font-mono text-xs">{formatPrice(tx.amount)}</TableCell>
                                                <TableCell className="text-center">
                                                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setExtractedTransactions(prev => prev.filter((_, i) => i !== idx))}>
                                                        <Trash className="h-3.5 w-3.5" />
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </div>
            ) : (
                <div className="flex flex-col items-center justify-center h-96 text-center text-muted-foreground border-2 border-dashed rounded-xl bg-muted/5 p-8 space-y-4">
                    {isExtracting ? (
                        <>
                            <Loader2 className="h-12 w-12 animate-spin text-primary opacity-20" />
                            <div className="space-y-1">
                                <p className="text-lg font-bold">AI Processing in Progress...</p>
                                <p className="text-sm">We are performing deep OCR on your statement. This takes about 30-60 seconds.</p>
                            </div>
                        </>
                    ) : (
                        <>
                            <FileText className="h-16 w-16 opacity-10" />
                            <div className="space-y-2">
                                <p className="text-lg font-bold">Ready for Statement</p>
                                <p className="text-sm max-w-sm">Select a client account and upload a PDF or Image statement to begin automated extraction and reconciliation.</p>
                            </div>
                        </>
                    )}
                </div>
            )}
        </div>
      </div>
    </div>
  );
}
