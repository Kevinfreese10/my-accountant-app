
'use client';

import { useState, useMemo, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Sparkles, FileText, Upload, AlertTriangle, CheckCircle2, Info, FileSpreadsheet, RotateCcw, Trash2, X, Download, Banknote } from 'lucide-react';
import { extractStatementPeriod, ExtractStatementPeriodOutput } from '@/ai/flows/extract-statement-period';
import { getFirestore, collection, getDocs, doc, query, where, writeBatch, serverTimestamp } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { User, ChartOfAccount, ImportedTransaction, AllocationRule } from '@/lib/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { format, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { extractStatementChunk } from '@/app/actions';
import { PDFDocument } from 'pdf-lib';
import * as XLSX from 'xlsx';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const db = getFirestore(firebaseApp);

const formSchema = z.object({
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

export default function AIStatementImportDialog({ 
    open, 
    onOpenChange, 
    client, 
    bankAccountId: initialBankAccountId,
    onImportComplete
}: { 
    open: boolean; 
    onOpenChange: (open: boolean) => void; 
    client: User; 
    bankAccountId?: string;
    onImportComplete: () => void;
}) {
  const [isExtracting, setIsExtracting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [extractedTransactions, setExtractedTransactions] = useState<Transaction[]>([]);
  const [statementMeta, setStatementMeta] = useState<ExtractStatementPeriodOutput | null>(null);
  const [extractionProgress, setExtractionProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState('');
  
  // Filtering states
  const [filterStartDate, setFilterStartDate] = useState<string>('');
  const [filterEndDate, setFilterEndDate] = useState<string>('');
  const [excludedIndices, setExcludedIndices] = useState<Set<number>>(new Set());

  const [existingTransactions, setExistingTransactions] = useState<ImportedTransaction[]>([]);
  const [currentAccountData, setCurrentAccountData] = useState<{ balance: number }>({ balance: 0 });
  const [createOpeningBalance, setCreateOpeningBalance] = useState(false);
  
  const { toast } = useToast();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { bankAccountId: initialBankAccountId || '' },
  });

  const watchBankAccountId = form.watch('bankAccountId');

  useEffect(() => {
      if (open && initialBankAccountId) {
          form.setValue('bankAccountId', initialBankAccountId);
      }
  }, [open, initialBankAccountId, form]);

  useEffect(() => {
    const fetchAccountStats = async () => {
        if (!client.id || !watchBankAccountId) return;
        
        const transRef = collection(db, 'aiAccountantClients', client.id, 'transactions');
        const q = query(transRef, where('bankAccountId', '==', watchBankAccountId));
        const snap = await getDocs(q);
        const txs = snap.docs.map(d => ({ ...d.data(), id: d.id } as ImportedTransaction));
        setExistingTransactions(txs);

        const balance = txs.reduce((s, t) => s + t.amount, 0);
        setCurrentAccountData({ balance });
    };
    if (open) fetchAccountStats();
  }, [client.id, watchBankAccountId, open]);

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

  const handleExtract = async (values: z.infer<typeof formSchema>) => {
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
            setExtractionProgress(Math.round((start / pageCount) * 100));
            setStatusMessage(`Processing pages ${start + 1} to ${end}...`);

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
        toast({ title: 'Extraction Complete' });

      } catch (error) {
        console.error('Extraction error:', error);
        toast({ title: 'AI Error', description: 'Failed to extract data from statement.', variant: 'destructive' });
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
  };

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
      XLSX.writeFile(ws, `Extracted_Statement_${client.name}_${format(new Date(), 'yyyyMMdd')}.xlsx`);
  };

  const handleImport = async () => {
    if (!client.id || !watchBankAccountId || filteredTransactions.length === 0) return;
    setIsImporting(true);
    
    try {
        let allRules = [...(client.allocationRules || [])];
        
        // Respect Isolated Practice Mode during import
        if (!client.disableGlobalRules) {
            const rulesRef = collection(db, "allocationRules");
            const rulesSnap = await getDocs(rulesRef);
            const globalRules = rulesSnap.docs.map(d => ({ ...d.data(), id: d.id } as AllocationRule));
            allRules = [...allRules, ...globalRules];
        }
        
        allRules.sort((a, b) => (a.priority || 99) - (b.priority || 99));

        const batch = writeBatch(db);

        if (createOpeningBalance && statementMeta) {
            const openBalRef = doc(collection(db, 'aiAccountantClients', client.id, 'transactions'));
            const openBalDate = filterStartDate || statementMeta.startDate;
            
            batch.set(openBalRef, {
                clientId: client.id,
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
            const match = isExpense ? allRules.find(r => {
                const keywordsArray = Array.isArray(r.keywords) ? r.keywords : (r.keywords ? [r.keywords] : []);
                return keywordsArray.some((kw: string) => tx.description.toUpperCase().includes(kw.toUpperCase()));
            }) : null;
            
            const txData: any = {
                clientId: client.id,
                date: new Date(tx.date).toISOString(),
                reference: `AI-PDF-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                description: tx.description.toUpperCase(),
                amount: tx.amount,
                isExpense: isExpense,
                bankAccountId: watchBankAccountId,
                status: (isExpense && match) ? 'reviewed' : 'new'
            };

            if (isExpense && match) {
                const keywordsArray = Array.isArray(match.keywords) ? match.keywords : (match.keywords ? [match.keywords] : []);
                const keyword = keywordsArray.find((kw: string) => tx.description.toUpperCase().includes(kw.toUpperCase()));
                txData.allocatedTo = { value: match.accountId, type: 'account' };
                txData.vatType = client.isVatRegistered ? match.vatType : 'no_vat';
                txData.allocatedAt = serverTimestamp();
                txData.allocationSource = 'rule';
                txData.matchedRuleId = match.id;
                txData.matchedKeyword = keyword;
            }

            const newRef = doc(collection(db, 'aiAccountantClients', client.id, 'transactions'));
            batch.set(newRef, txData);
        });

        await batch.commit();
        toast({ title: 'Import Successful' });
        onImportComplete();
        onOpenChange(false);
    } catch (e) {
        console.error("Import error:", e);
        toast({ title: 'Import Failed', variant: 'destructive' });
    } finally {
        setIsImporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-6xl max-h-[95vh] flex flex-col p-0">
        <DialogHeader className="p-6 pb-0">
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            AI Bank Statement Importer
          </DialogTitle>
          <DialogDescription>
            Extract and reconcile transactions for <strong>{client.companyName || client.name}</strong>.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-grow overflow-hidden grid grid-cols-1 lg:grid-cols-12 gap-0">
          <aside className="lg:col-span-4 p-6 border-r space-y-6 overflow-y-auto">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleExtract)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="bankAccountId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Target Cashbook Account</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger><SelectValue placeholder="Select account..." /></SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {client.chartOfAccounts?.filter(acc => acc.accountNumber?.startsWith('8400-')).map(acc => (
                            <SelectItem key={acc.id} value={acc.id}>{acc.description}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {watchBankAccountId && (
                    <div className="bg-muted/50 p-3 rounded-lg flex items-center justify-between animate-in fade-in">
                        <div className="flex items-center gap-2">
                            <Banknote className="h-4 w-4 text-muted-foreground" />
                            <span className="text-xs font-medium">Existing Book Balance:</span>
                        </div>
                        <span className="text-xs font-bold font-mono">{formatPrice(currentAccountData.balance)}</span>
                    </div>
                )}

                <FormField
                  control={form.control}
                  name="statement"
                  render={({ field: { onChange, value, ...rest } }) => (
                    <FormItem>
                      <FormLabel>Upload PDF Statement</FormLabel>
                      <FormControl>
                        <Input
                          type="file"
                          accept="application/pdf,image/*"
                          onChange={(e) => onChange(e.target.files)}
                          disabled={isExtracting}
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

            {isExtracting && (
                <div className="space-y-2 animate-in fade-in">
                    <div className="flex justify-between items-center text-[10px] font-bold uppercase text-primary">
                        <span>{statusMessage}</span>
                        <span>{extractionProgress}%</span>
                    </div>
                    <Progress value={extractionProgress} className="h-1.5" />
                </div>
            )}

            {statementMeta && (
                <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                    <Separator />
                    <div className="p-4 rounded-xl border bg-primary/5 space-y-3">
                        <h4 className="text-[10px] font-bold uppercase tracking-widest text-primary flex items-center gap-2">
                            <Info className="h-3 w-3" /> Header Detection
                        </h4>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                            <div className="space-y-1">
                                <Label className="text-[9px] uppercase">Opening Bal</Label>
                                <Input 
                                    type="number" 
                                    step="0.01" 
                                    value={statementMeta.openingBalance} 
                                    onChange={(e) => setStatementMeta(p => p ? {...p, openingBalance: parseFloat(e.target.value) || 0} : null)}
                                    className="h-8 font-mono bg-white"
                                />
                            </div>
                            <div className="space-y-1">
                                <Label className="text-[9px] uppercase">Closing Bal</Label>
                                <Input 
                                    type="number" 
                                    step="0.01" 
                                    value={statementMeta.closingBalance} 
                                    onChange={(e) => setStatementMeta(p => p ? {...p, closingBalance: parseFloat(e.target.value) || 0} : null)}
                                    className="h-8 font-mono bg-white"
                                />
                            </div>
                        </div>
                    </div>
                </div>
            )}
          </aside>

          <main className="lg:col-span-8 p-6 overflow-y-auto space-y-6">
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
                                    <X className="mr-1 h-3 w-3" /> Exclude {duplicatesInCurrentList.length} Duplicates
                                </Button>
                            )}
                        </CardContent>
                    </Card>

                    <div className={cn("p-4 rounded-xl border flex flex-col justify-center items-center text-center space-y-1 transition-colors", calculatedRecon?.isMatched ? "bg-green-50 border-green-200" : "bg-destructive/5 border-destructive/20")}>
                        {calculatedRecon?.isMatched ? (
                            <>
                                <CheckCircle2 className="h-6 w-6 text-green-600" />
                                <p className="text-xs font-bold text-green-800">Balanced!</p>
                                <p className="text-[10px] text-green-700">Matches detected closing balance.</p>
                            </>
                        ) : (
                            <>
                                <AlertTriangle className="h-6 w-6 text-destructive" />
                                <p className="text-xs font-bold text-destructive">Recon Mismatch</p>
                                <p className="text-muted-foreground text-[10px]">Diff: {formatPrice(calculatedRecon?.diff || 0)}</p>
                            </>
                        )}
                    </div>
                </div>

                {statementMeta && (
                    <div className="bg-yellow-50 border border-yellow-200 p-3 rounded-lg flex items-start gap-3">
                        <Checkbox id="create-open-check" checked={createOpeningBalance} onCheckedChange={(v) => setCreateOpeningBalance(!!v)} className="mt-1" />
                        <div className="space-y-1">
                            <Label htmlFor="create-open-check" className="text-xs font-bold text-yellow-800">Post Opening Balance?</Label>
                            <p className="text-[10px] text-yellow-700">
                                Create a transaction for <strong>{formatPrice(statementMeta.openingBalance)}</strong> dated <strong>{filterStartDate || statementMeta.startDate}</strong>.
                            </p>
                        </div>
                    </div>
                )}

                <div className="border rounded-lg overflow-hidden">
                    <div className="bg-muted/50 p-2 border-b flex justify-between items-center">
                        <span className="text-[10px] font-bold uppercase text-muted-foreground ml-2">Editable Preview ({filteredTransactions.length} items)</span>
                    </div>
                    <div className="max-h-[400px] overflow-y-auto">
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
                                                    {isDup && !isExcluded && <span className="text-[8px] text-destructive font-bold uppercase px-3">Possible Duplicate</span>}
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
                    </div>
                </div>
              </div>
            ) : (
              <div className="flex h-[500px] flex-col items-center justify-center text-center space-y-4 border-2 border-dashed rounded-xl bg-muted/5 p-8">
                <FileText className="h-16 w-16 opacity-10" />
                <p className="text-lg font-bold">Ready for Analysis</p>
                <p className="text-sm text-muted-foreground max-w-sm">Upload a PDF statement to begin automated extraction and reconciliation.</p>
              </div>
            )}
          </main>
        </div>

        <DialogFooter className="border-t p-6">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button 
                onClick={handleImport} 
                disabled={isImporting || filteredTransactions.length === 0}
                className="font-bold min-w-[200px]"
            >
                {isImporting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Import {filteredTransactions.length} Transactions
            </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
