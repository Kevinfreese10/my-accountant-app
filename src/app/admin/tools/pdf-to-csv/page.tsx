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
import { Loader2, Sparkles, FileText, Upload, AlertTriangle, CheckCircle2, Info, RotateCcw, FileSpreadsheet, ArrowRight, Trash2, X, Download } from 'lucide-react';
import { extractStatementPeriod, ExtractStatementPeriodOutput } from '@/ai/flows/extract-statement-period';
import { getFirestore, collection, getDocs, doc, query, where, writeBatch, serverTimestamp, orderBy } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { User as UserType, ChartOfAccount, ImportedTransaction, AllocationRule } from '@/lib/types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { format, parseISO } from 'date-fns';
import { useRouter } from 'next/navigation';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { extractStatementChunk } from '@/app/actions';
import { PDFDocument } from 'pdf-lib';
import * as XLSX from 'xlsx';

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
  
  // Filtering states
  const [filterStartDate, setFilterStartDate] = useState<string>('');
  const [filterEndDate, setFilterEndDate] = useState<string>('');
  const [excludedIndices, setExcludedIndices] = useState<Set<number>>(new Set());

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

  const isDuplicate = (tx: Transaction) => {
    return existingTransactions.some(e => 
        format(new Date(e.date), 'yyyy-MM-dd') === tx.date && 
        e.description.toLowerCase().trim() === tx.description.toLowerCase().trim() && 
        Math.abs(e.amount - tx.amount) < 0.01
    );
  };

  const filteredTransactions = useMemo(() => {
    return extractedTransactions.filter((tx, index) => {
        if (excludedIndices.has(index)) return false;
        if (filterStartDate && tx.date < filterStartDate) return false;
        if (filterEndDate && tx.date > filterEndDate) return false;
        return true;
    });
  }, [extractedTransactions, excludedIndices, filterStartDate, filterEndDate]);

  const duplicatesInCurrentList = useMemo(() => {
      return filteredTransactions.filter(isDuplicate);
  }, [filteredTransactions, existingTransactions]);

  const calculatedRecon = useMemo(() => {
    if (!statementMeta) return null;
    const importTotal = filteredTransactions.reduce((s, t) => s + t.amount, 0);
    const startingBalance = createOpeningBalance ? statementMeta.openingBalance : currentAccountData.balance;
    const projectedBalance = startingBalance + importTotal;
    const diff = Math.abs(projectedBalance - statementMeta.closingBalance);
    const isMatched = diff < 0.01;

    return { importTotal, projectedBalance, diff, isMatched };
  }, [statementMeta, filteredTransactions, currentAccountData.balance, createOpeningBalance]);

  const handleUpdateTransaction = (index: number, field: keyof Transaction, value: any) => {
      const updated = [...extractedTransactions];
      updated[index] = { ...updated[index], [field]: value };
      setExtractedTransactions(updated);
  };

  const handleDownloadExcel = () => {
      if (filteredTransactions.length === 0) return;
      const ws = XLSX.utils.book_new();
      const wsData = filteredTransactions.map(tx => ({
          Date: tx.date,
          Description: tx.description,
          Amount: tx.amount
      }));
      const worksheet = XLSX.utils.json_to_sheet(wsData);
      XLSX.utils.book_append_sheet(ws, worksheet, "Extracted Transactions");
      XLSX.writeFile(ws, `Extracted_Statement_${selectedClient?.name || 'Client'}_${format(new Date(), 'yyyyMMdd')}.xlsx`);
  };

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    const file = values.statement[0];
    if (!file) return;

    setIsExtracting(true);
    setExtractionProgress(0);
    setStatusMessage('Reading file...');
    setExtractedTransactions([]);
    setExcludedIndices(new Set());
    setStatementMeta(null);

    const reader = new FileReader();
    reader.readAsArrayBuffer(file);
    reader.onload = async () => {
      try {
        const arrayBuffer = reader.result as ArrayBuffer;
        const pdfDoc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
        const pageCount = pdfDoc.getPageCount();
        const chunkSize = 5;
        
        const firstChunkDoc = await PDFDocument.create();
        const firstPages = await firstChunkDoc.copyPages(pdfDoc, [0]);
        firstChunkDoc.addPage(firstPages[0]);
        const firstChunkBase64 = `data:application/pdf;base64,${await firstChunkDoc.saveAsBase64()}`;
        
        setStatusMessage('Extracting header...');
        const meta = await extractStatementPeriod({ statementPdf: firstChunkBase64 });
        if (meta) {
            setStatementMeta(meta);
            setFilterStartDate(meta.startDate);
            setFilterEndDate(meta.endDate);
        }

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
            
            const chunkBase64 = `data:application/pdf;base64,${await chunkDoc.saveAsBase64()}`;
            const result = await extractStatementChunk({ chunkBase64 });

            if (result.success && result.transactions) {
                allTransactions = [...allTransactions, ...result.transactions];
                setExtractedTransactions([...allTransactions]);
            }
        }

        setExtractionProgress(100);
        setStatusMessage('Complete!');
        toast({ title: 'Success', description: `Processed ${pageCount} pages.` });

      } catch (error) {
        console.error('Extraction error:', error);
        toast({ title: 'Processing Failed', variant: 'destructive' });
      } finally {
        setIsExtracting(false);
      }
    };
  };

  const handleRemoveDuplicates = () => {
      const newExcluded = new Set(excludedIndices);
      extractedTransactions.forEach((tx, idx) => {
          if (isDuplicate(tx)) newExcluded.add(idx);
      });
      setExcludedIndices(newExcluded);
      toast({ title: "Duplicates Excluded" });
  }

  const handleFinalImport = async () => {
    if (!selectedClient || !watchBankAccountId || filteredTransactions.length === 0) return;
    setIsImporting(true);
    
    try {
        const rulesRef = collection(db, "allocationRules");
        const rulesSnap = await getDocs(rulesRef);
        const globalRules = rulesSnap.docs.map(d => ({ ...d.data(), id: d.id } as AllocationRule));
        const allRules = [...(selectedClient.allocationRules || []), ...globalRules].sort((a, b) => (a.priority || 99) - (b.priority || 99));

        const batch = writeBatch(db);

        if (createOpeningBalance && statementMeta) {
            const openBalRef = doc(collection(db, 'aiAccountantClients', selectedClient.id, 'transactions'));
            const openBalDate = filterStartDate || statementMeta.startDate;
            
            batch.set(openBalRef, {
                clientId: selectedClient.id,
                date: new Date(openBalDate).toISOString(),
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
            }

            const newRef = doc(collection(db, 'aiAccountantClients', selectedClient.id, 'transactions'));
            batch.set(newRef, txData);
        });

        await batch.commit();
        toast({ title: 'Import Successful' });
        router.push(`/admin/ai-accountant/${selectedClient.id}/bank/transactions?accountId=${watchBankAccountId}`);
    } catch (e) {
        toast({ title: 'Import Failed', variant: 'destructive' });
    } finally {
        setIsImporting(false);
    }
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
                </CardHeader>
                <CardContent>
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                            <FormField control={form.control} name="clientId" render={({ field }) => ( <FormItem><FormLabel>Client</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select client..." /></SelectTrigger></FormControl><SelectContent>{clients.map(c => <SelectItem key={c.id} value={c.id}>{c.companyName || c.name}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem> )} />
                            <FormField control={form.control} name="bankAccountId" render={({ field }) => ( <FormItem><FormLabel>Bank Account</FormLabel><Select onValueChange={field.onChange} value={field.value} disabled={!watchClientId}><FormControl><SelectTrigger><SelectValue placeholder="Select account..." /></SelectTrigger></FormControl><SelectContent>{bankAccounts.map(acc => <SelectItem key={acc.id} value={acc.id}>{acc.description}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem> )} />
                            <FormField control={form.control} name="statement" render={({ field: { onChange, value, ...rest } }) => ( <FormItem><FormLabel>PDF Statement</FormLabel><FormControl><Input type="file" accept="application/pdf" onChange={(e) => onChange(e.target.files)} disabled={!watchBankAccountId || isExtracting} /></FormControl><FormMessage /></FormItem> )} />
                            <Button type="submit" className="w-full h-12 font-bold" disabled={isExtracting || !watchBankAccountId}>
                                {isExtracting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                                {isExtracting ? 'Analyzing...' : 'Extract from PDF'}
                            </Button>
                        </form>
                    </Form>
                </CardContent>
            </Card>

            {isExtracting && (
                <Card className="border-primary bg-primary/5">
                    <CardHeader className="py-3 px-4">
                        <div className="flex justify-between items-center text-xs font-bold text-primary uppercase">
                            <span>{statusMessage}</span>
                            <span>{extractionProgress}%</span>
                        </div>
                    </CardHeader>
                    <CardContent className="px-4 pb-4"><Progress value={extractionProgress} className="h-2" /></CardContent>
                </Card>
            )}

            {statementMeta && (
                <Card className="bg-primary/5 border-primary/20">
                    <CardHeader className="py-3">
                        <CardTitle className="text-xs font-bold uppercase tracking-wider flex items-center gap-2">
                            <Info className="h-3 w-3 text-primary" />
                            Header Detection
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="text-[11px] space-y-3">
                        <div className="flex justify-between font-medium">
                            <span>Period:</span>
                            <span>{format(parseISO(statementMeta.startDate), 'dd MMM')} - {format(parseISO(statementMeta.endDate), 'dd MMM yyyy')}</span>
                        </div>
                        <div className="space-y-1">
                            <Label className="text-[9px] uppercase text-muted-foreground">Opening Balance</Label>
                            <Input 
                                type="number" 
                                step="0.01" 
                                value={statementMeta.openingBalance} 
                                onChange={(e) => setStatementMeta(p => p ? {...p, openingBalance: parseFloat(e.target.value) || 0} : null)}
                                className="h-8 text-[11px] font-mono bg-white"
                            />
                        </div>
                        <div className="space-y-1">
                            <Label className="text-[9px] uppercase text-muted-foreground">Closing Balance</Label>
                            <Input 
                                type="number" 
                                step="0.01" 
                                value={statementMeta.closingBalance} 
                                onChange={(e) => setStatementMeta(p => p ? {...p, closingBalance: parseFloat(e.target.value) || 0} : null)}
                                className="h-8 text-[11px] font-mono bg-white"
                            />
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>

        <div className="lg:col-span-8 space-y-6">
            {extractedTransactions.length > 0 ? (
                <div className="space-y-6 animate-in fade-in zoom-in-95">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Card className="bg-muted/20 border-dashed">
                            <CardHeader className="py-3 px-4 flex flex-row items-center justify-between space-y-0">
                                <CardTitle className="text-xs uppercase">Import Filters</CardTitle>
                                <Button variant="ghost" size="sm" onClick={handleDownloadExcel} className="h-7 text-[10px] gap-1">
                                    <Download className="h-3 w-3" /> Export Excel
                                </Button>
                            </CardHeader>
                            <CardContent className="space-y-4 px-4 pb-4">
                                <div className="grid grid-cols-2 gap-2">
                                    <div className="space-y-1">
                                        <Label className="text-[9px] uppercase">Start Date</Label>
                                        <Input type="date" value={filterStartDate} onChange={(e) => setFilterStartDate(e.target.value)} className="h-8 text-xs" />
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-[9px] uppercase">End Date</Label>
                                        <Input type="date" value={filterEndDate} onChange={(e) => setFilterEndDate(e.target.value)} className="h-8 text-xs" />
                                    </div>
                                </div>
                                {duplicatesInCurrentList.length > 0 && (
                                    <Button variant="outline" size="sm" onClick={handleRemoveDuplicates} className="w-full text-destructive border-destructive/20 hover:bg-destructive/5 text-[10px] h-7">
                                        <X className="mr-1 h-3 w-3" /> Exclude {duplicatesInCurrentList.length} Potential Duplicates
                                    </Button>
                                )}
                            </CardContent>
                        </Card>

                        <div className={cn("p-4 rounded-xl border flex flex-col justify-center items-center text-center space-y-1 transition-colors", calculatedRecon?.isMatched ? "bg-green-50 border-green-200" : "bg-destructive/5 border-destructive/20")}>
                            {calculatedRecon?.isMatched ? (
                                <>
                                    <CheckCircle2 className="h-8 w-8 text-green-600 mb-2" />
                                    <p className="text-sm font-bold text-green-800">Balanced!</p>
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

                    {statementMeta && (
                        <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg flex items-start gap-3">
                            <Checkbox id="tools-open-check" checked={createOpeningBalance} onCheckedChange={(v) => setCreateOpeningBalance(!!v)} className="mt-1" />
                            <div className="space-y-1">
                                <Label htmlFor="tools-open-check" className="text-sm font-bold text-yellow-800">Post Opening Balance?</Label>
                                <p className="text-xs text-yellow-700">
                                    Create a transaction for <strong>{formatPrice(statementMeta.openingBalance)}</strong> dated <strong>{filterStartDate || statementMeta.startDate}</strong>.
                                </p>
                            </div>
                        </div>
                    )}

                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-bold uppercase">Editable Preview ({filteredTransactions.length} items)</CardTitle>
                            <Button size="lg" onClick={handleFinalImport} disabled={isImporting || filteredTransactions.length === 0} className="font-bold min-w-[200px]">
                                {isImporting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Approve & Import
                            </Button>
                        </CardHeader>
                        <CardContent className="p-0 overflow-hidden">
                            <Table>
                                <TableHeader className="bg-muted/30 sticky top-0 z-10 shadow-sm">
                                    <TableRow>
                                        <TableHead className="text-[10px] py-2">Date</TableHead>
                                        <TableHead className="text-[10px] py-2">Description</TableHead>
                                        <TableHead className="text-right text-[10px] py-2">Amount</TableHead>
                                        <TableHead className="w-10"></TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {extractedTransactions.map((tx, idx) => {
                                        const isExcluded = excludedIndices.has(idx);
                                        const isOutOfDateRange = (filterStartDate && tx.date < filterStartDate) || (filterEndDate && tx.date > filterEndDate);
                                        const isDup = isDuplicate(tx);
                                        
                                        if (isOutOfDateRange) return null;

                                        return (
                                            <TableRow key={idx} className={cn(
                                                isExcluded && "opacity-30 bg-muted/50 grayscale",
                                                isDup && !isExcluded && "bg-destructive/5"
                                            )}>
                                                <TableCell className="p-1">
                                                    <Input 
                                                        type="date" 
                                                        value={tx.date} 
                                                        onChange={(e) => handleUpdateTransaction(idx, 'date', e.target.value)}
                                                        className="h-7 text-[10px] border-none bg-transparent"
                                                    />
                                                </TableCell>
                                                <TableCell className="p-1">
                                                    <div className="flex flex-col">
                                                        <Input 
                                                            value={tx.description} 
                                                            onChange={(e) => handleUpdateTransaction(idx, 'description', e.target.value)}
                                                            className="h-7 text-[10px] border-none bg-transparent font-medium"
                                                        />
                                                        {isDup && !isExcluded && <span className="text-[8px] text-destructive font-bold uppercase tracking-tighter px-3">Existing Match</span>}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="p-1">
                                                    <Input 
                                                        type="number" 
                                                        step="0.01"
                                                        value={tx.amount} 
                                                        onChange={(e) => handleUpdateTransaction(idx, 'amount', parseFloat(e.target.value) || 0)}
                                                        className={cn("h-7 text-[10px] border-none bg-transparent text-right font-mono", tx.amount < 0 ? "text-destructive" : "text-green-600")}
                                                    />
                                                </TableCell>
                                                <TableCell className="text-right py-2 pr-4">
                                                    <Button 
                                                        variant="ghost" 
                                                        size="icon" 
                                                        className="h-6 w-6 text-muted-foreground hover:text-destructive"
                                                        onClick={() => {
                                                            const newExcluded = new Set(excludedIndices);
                                                            if (isExcluded) newExcluded.delete(idx);
                                                            else newExcluded.add(idx);
                                                            setExcludedIndices(newExcluded);
                                                        }}
                                                    >
                                                        {isExcluded ? <RotateCcw className="h-3.5 w-3.5" /> : <Trash2 className="h-3.5 w-3.5" />}
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        )})}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </div>
            ) : (
                <div className="flex flex-col items-center justify-center h-96 text-center text-muted-foreground border-2 border-dashed rounded-xl bg-muted/5 p-8">
                    <FileText className="h-16 w-16 opacity-10 mb-4" />
                    <p className="text-lg font-bold">Ready for Analysis</p>
                    <p className="text-sm max-w-sm mx-auto">Upload a PDF statement to begin automated extraction and reconciliation.</p>
                </div>
            )}
        </div>
      </div>
    </div>
  );
}
