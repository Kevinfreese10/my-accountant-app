
'use client';

import { useState, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Sparkles, FileText, Upload, AlertTriangle, CheckCircle2, Info, RotateCcw, FileSpreadsheet, ArrowRight } from 'lucide-react';
import { extractStatementPeriod, ExtractStatementPeriodOutput } from '@/ai/flows/extract-statement-period';
import { getFirestore, collection, getDocs, doc, query, where, writeBatch, serverTimestamp, orderBy } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { User as UserType, ChartOfAccount, ImportedTransaction, AllocationRule } from '@/lib/types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Slider } from '@/components/ui/slider';
import { format, parseISO } from 'date-fns';
import { useRouter } from 'next/navigation';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import * as XLSX from 'xlsx';
import { extractStatementChunk } from '@/app/actions';
import { PDFDocument } from 'pdf-lib';

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
    const formatted = new Intl.NumberFormat('en-ZA', {
      style: 'currency',
      currency: 'ZAR',
    }).format(Math.abs(price));
    return price < 0 ? `-${formatted}` : formatted;
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
  const [extractionProgress, setExtractionProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState('');
  
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
    const startIndex = Math.floor((dateRange[0] / 100) * (sortedDates.length - 1));
    const endIndex = Math.floor((dateRange[1] / 100) * (sortedDates.length - 1));
    const startDate = sortedDates[startIndex];
    const endDate = sortedDates[endIndex];
    
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
    setExtractionProgress(0);
    setStatusMessage('Reading file...');
    setExtractedTransactions([]);
    setStatementMeta(null);

    const reader = new FileReader();
    reader.readAsArrayBuffer(file);
    reader.onload = async () => {
      try {
        const arrayBuffer = reader.result as ArrayBuffer;
        const pdfDoc = await PDFDocument.load(arrayBuffer);
        const pageCount = pdfDoc.getPageCount();
        const chunkSize = 5;
        
        // 1. Convert to data URL for Meta Extraction (just first chunk usually works for meta)
        const firstChunkDoc = await PDFDocument.create();
        const firstPages = await firstChunkDoc.copyPages(pdfDoc, [0]);
        firstChunkDoc.addPage(firstPages[0]);
        const firstChunkBase64 = await firstChunkDoc.saveAsBase64({ dataUri: true });
        
        setStatusMessage('Extracting statement header...');
        const meta = await extractStatementPeriod({ statementPdf: firstChunkBase64 });
        if (meta) setStatementMeta(meta);

        let allTransactions: Transaction[] = [];

        for (let i = 0; i < pageCount; i += chunkSize) {
            const start = i;
            const end = Math.min(i + chunkSize, pageCount);
            const currentProgress = Math.round((start / pageCount) * 100);
            setExtractionProgress(currentProgress);
            setStatusMessage(`Processing pages ${start + 1} to ${end} of ${pageCount}...`);

            const chunkDoc = await PDFDocument.create();
            const pagesToCopy = Array.from({ length: end - start }, (_, idx) => start + idx);
            const copiedPages = await chunkDoc.copyPages(pdfDoc, pagesToCopy);
            copiedPages.forEach(p => chunkDoc.addPage(p));
            
            const chunkBase64 = await chunkDoc.saveAsBase64({ dataUri: true });
            
            const result = await extractStatementChunk({ chunkBase64 });

            if (result.success && result.transactions) {
                allTransactions = [...allTransactions, ...result.transactions];
                setExtractedTransactions([...allTransactions]); // Update preview live
            }
        }

        setExtractionProgress(100);
        setStatusMessage('Extraction Complete!');
        toast({ title: 'Success', description: `Processed ${pageCount} pages and found ${allTransactions.length} transactions.` });

      } catch (error) {
        console.error('Extraction error:', error);
        toast({ title: 'Processing Failed', description: 'Ensure the file is a valid PDF statement.', variant: 'destructive' });
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

        if (createOpeningBalance && statementMeta) {
            const openBalRef = doc(collection(db, 'aiAccountantClients', selectedClient.id, 'transactions'));
            batch.set(openBalRef, {
                clientId: selectedClient.id,
                date: new Date(statementMeta.startDate).toISOString(),
                reference: `OPEN-BAL-${Date.now()}`,
                description: statementMeta.openingBalance < 0 ? "OPENING BALANCE (OVERDRAFT)" : "OPENING BALANCE",
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
            const isExpense = tx.amount < 0;
            const match = isExpense ? allRules.find(r => r.keywords.some(kw => tx.description.toUpperCase().includes(kw.toUpperCase()))) : null;
            
            const txData: any = {
                clientId: selectedClient.id,
                date: new Date(tx.date).toISOString(),
                reference: `AI-CHUNK-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                description: tx.description.toUpperCase(),
                amount: tx.amount,
                isExpense: isExpense,
                bankAccountId: watchBankAccountId,
                status: (isExpense && match) ? 'reviewed' : 'new'
            };

            if (isExpense && match) {
                const keyword = match.keywords.find(kw => tx.description.toUpperCase().includes(kw.toUpperCase()));
                txData.allocatedTo = { value: match.accountId, type: 'account' };
                txData.vatType = selectedClient.isVatRegistered ? match.vatType : 'no_vat';
                txData.allocatedAt = serverTimestamp();
                txData.allocationSource = 'rule';
                txData.matchedRuleId = match.id;
                txData.matchedKeyword = keyword;
                matchCount++;
            }

            const newRef = doc(collection(db, 'aiAccountantClients', selectedClient.id, 'transactions'));
            batch.set(newRef, txData);
        });

        await batch.commit();
        toast({ title: 'Import Successful', description: `${filteredTransactions.length} transactions imported.` });
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
        <h1 className="text-3xl font-bold tracking-tight text-slate-950">AI Bank Importer</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <div className="lg:col-span-4 space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg">Configuration</CardTitle>
                    <CardDescription>Select client and upload statement.</CardDescription>
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
                            
                            <FormField
                                control={form.control}
                                name="statement"
                                render={({ field: { onChange, value, ...rest } }) => (
                                    <FormItem>
                                        <FormLabel>PDF Statement</FormLabel>
                                        <FormControl>
                                            <Input
                                                type="file"
                                                accept="application/pdf"
                                                onChange={(e) => onChange(e.target.files)}
                                                disabled={!watchBankAccountId || isExtracting}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <Button type="submit" className="w-full h-12 font-bold" disabled={isExtracting || !watchBankAccountId}>
                                {isExtracting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                                {isExtracting ? 'Analyzing...' : 'Extract from PDF'}
                            </Button>
                        </form>
                    </Form>
                </CardContent>
            </Card>

            {isExtracting && (
                <Card className="border-primary bg-primary/5 animate-pulse">
                    <CardHeader className="py-3 px-4">
                        <div className="flex justify-between items-center text-xs font-bold text-primary uppercase">
                            <span>{statusMessage}</span>
                            <span>{extractionProgress}%</span>
                        </div>
                    </CardHeader>
                    <CardContent className="px-4 pb-4">
                        <Progress value={extractionProgress} className="h-2" />
                    </CardContent>
                </Card>
            )}

            {statementMeta && (
                <Card className="bg-muted/30 border-dashed">
                    <CardHeader className="pb-2"><CardTitle className="text-sm font-bold uppercase">Statement Meta</CardTitle></CardHeader>
                    <CardContent className="text-[11px] space-y-2">
                        <div className="flex justify-between font-bold"><span>Period:</span><span>{format(parseISO(statementMeta.startDate), 'dd MMM')} - {format(parseISO(statementMeta.endDate), 'dd MMM yyyy')}</span></div>
                        <div className="flex justify-between"><span>Opening Bal:</span><span>{formatPrice(statementMeta.openingBalance)}</span></div>
                        <div className="flex justify-between"><span>Closing Bal:</span><span>{formatPrice(statementMeta.closingBalance)}</span></div>
                    </CardContent>
                </Card>
            )}
        </div>

        <div className="lg:col-span-8 space-y-6">
            {extractedTransactions.length > 0 ? (
                <div className="space-y-6 animate-in fade-in zoom-in-95">
                    <Card>
                        <CardHeader>
                            <CardTitle>Reconciliation & Filter</CardTitle>
                            <CardDescription>Verify the extraction matches your statement totals.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="p-4 rounded-xl border bg-muted/20 space-y-2">
                                    <p className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest">Projected Recon</p>
                                    <div className="flex justify-between text-xs">
                                        <span className="text-muted-foreground">Starting Reference:</span>
                                        <span className="font-bold">{formatPrice(createOpeningBalance ? statementMeta?.openingBalance! : currentAccountData.balance)}</span>
                                    </div>
                                    <div className="flex justify-between text-xs">
                                        <span className="text-muted-foreground">Import Total:</span>
                                        <span className={calculatedRecon?.importTotal! < 0 ? "text-destructive" : "text-green-600"}>{formatPrice(calculatedRecon?.importTotal || 0)}</span>
                                    </div>
                                    <Separator />
                                    <div className="flex justify-between text-sm font-bold pt-1">
                                        <span>Projected Bal:</span>
                                        <span>{formatPrice(calculatedRecon?.projectedBalance || 0)}</span>
                                    </div>
                                </div>

                                <div className={cn("p-4 rounded-xl border flex flex-col justify-center items-center text-center transition-colors", calculatedRecon?.isMatched ? "bg-green-50 border-green-200" : "bg-destructive/5 border-destructive/20")}>
                                    {calculatedRecon?.isMatched ? (
                                        <>
                                            <CheckCircle2 className="h-8 w-8 text-green-600 mb-2" />
                                            <p className="text-sm font-bold text-green-800">Balanced!</p>
                                            <p className="text-[10px] text-green-700">Matches statement closing.</p>
                                        </>
                                    ) : (
                                        <>
                                            <AlertTriangle className="h-8 w-8 text-destructive mb-2" />
                                            <p className="text-sm font-bold text-destructive">Mismatch</p>
                                            <p className="text-[10px] text-muted-foreground">Diff: {formatPrice(calculatedRecon?.diff || 0)}</p>
                                        </>
                                    )}
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label className="text-[10px] font-bold uppercase text-muted-foreground">Adjust Import Range</Label>
                                <Slider
                                    value={dateRange}
                                    onValueChange={(v) => setDateRange(v as [number, number])}
                                    max={100}
                                    step={1}
                                />
                                <div className="flex justify-between text-[10px] font-bold">
                                    <span>{sortedDates[0]}</span>
                                    <span>Importing {filteredTransactions.length} items</span>
                                    <span>{sortedDates[sortedDates.length-1]}</span>
                                </div>
                            </div>
                        </CardContent>
                        <CardFooter className="flex justify-end gap-2 border-t pt-4">
                            <Button size="lg" onClick={handleFinalImport} disabled={isImporting || filteredTransactions.length === 0} className="font-bold min-w-[200px]">
                                {isImporting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Approve & Import
                            </Button>
                        </CardFooter>
                    </Card>

                    <Card>
                        <CardHeader><CardTitle className="text-md">Extracted Data</CardTitle></CardHeader>
                        <CardContent className="p-0">
                            <Table>
                                <TableHeader className="bg-muted/30">
                                    <TableRow>
                                        <TableHead className="text-[10px] py-2">Date</TableHead>
                                        <TableHead className="text-[10px] py-2">Description</TableHead>
                                        <TableHead className="text-right text-[10px] py-2">Amount</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredTransactions.map((tx, idx) => (
                                        <TableRow key={idx} className={cn(isDuplicate(tx) && "bg-destructive/5")}>
                                            <TableCell className="text-[10px] py-2">{tx.date}</TableCell>
                                            <TableCell className="text-[10px] py-2 font-medium truncate max-w-[300px]">{tx.description}</TableCell>
                                            <TableCell className={cn("text-right font-mono text-[10px] py-2", tx.amount < 0 ? "text-destructive" : "text-green-600")}>
                                                {formatPrice(tx.amount)}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </div>
            ) : (
                <div className="flex flex-col items-center justify-center h-96 text-center text-muted-foreground border-2 border-dashed rounded-xl bg-muted/5 p-8">
                    <FileText className="h-16 w-16 opacity-10 mb-4" />
                    <p className="text-lg font-bold">Ready for Analysis</p>
                    <p className="text-sm max-w-sm mx-auto">Upload a PDF statement. We will split it into manageable chunks to ensure accurate data extraction without timeouts.</p>
                </div>
            )}
        </div>
      </div>
    </div>
  );
}
