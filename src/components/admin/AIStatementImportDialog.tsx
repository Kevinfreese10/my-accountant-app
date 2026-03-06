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
import { Loader2, Sparkles, FileText, Upload, AlertTriangle, CheckCircle2, Info, FileSpreadsheet, RotateCcw, Trash2, CalendarIcon, X } from 'lucide-react';
import { extractStatementData } from '@/ai/flows/extract-statement-data';
import { extractStatementPeriod, ExtractStatementPeriodOutput } from '@/ai/flows/extract-statement-period';
import { getFirestore, collection, getDocs, doc, query, where, writeBatch, serverTimestamp } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { User, ChartOfAccount, ImportedTransaction, AllocationRule } from '@/lib/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { format, parseISO, isWithinInterval, startOfDay, endOfDay } from 'date-fns';
import { cn } from '@/lib/utils';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

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
    setExtractedTransactions([]);
    setExcludedIndices(new Set());
    setStatementMeta(null);
    toast({ title: 'AI Analysis Started', description: 'Extracting data from statement...' });

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = async () => {
      const dataUrl = reader.result as string;
      try {
        const [meta, data] = await Promise.all([
            extractStatementPeriod({ statementPdf: dataUrl }),
            extractStatementData({ statementFile: dataUrl })
        ]);

        if (meta) {
            setStatementMeta(meta);
            setFilterStartDate(meta.startDate);
            setFilterEndDate(meta.endDate);
        }
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

  const handleRemoveDuplicates = () => {
      const newExcluded = new Set(excludedIndices);
      extractedTransactions.forEach((tx, idx) => {
          if (isDuplicate(tx)) newExcluded.add(idx);
      });
      setExcludedIndices(newExcluded);
      toast({ title: "Duplicates Removed", description: `Excluded ${duplicatesInCurrentList.length} possible matches.` });
  };

  const handleImport = async () => {
    if (!client.id || !watchBankAccountId || filteredTransactions.length === 0) return;
    setIsImporting(true);
    
    try {
        const rulesRef = collection(db, "allocationRules");
        const rulesSnap = await getDocs(rulesRef);
        const globalRules = rulesSnap.docs.map(d => ({ ...d.data(), id: d.id } as AllocationRule));
        const allRules = [...(client.allocationRules || []), ...globalRules].sort((a, b) => (a.priority || 99) - (b.priority || 99));

        const batch = writeBatch(db);
        let matchCount = 0;

        if (createOpeningBalance && statementMeta) {
            const openBalRef = doc(collection(db, 'aiAccountantClients', client.id, 'transactions'));
            // Use user-selected filterStartDate or fallback to statementMeta.startDate
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
            const match = isExpense ? allRules.find(r => r.keywords.some(kw => tx.description.toUpperCase().includes(kw.toUpperCase()))) : null;
            
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
                const keyword = match.keywords.find(kw => tx.description.toUpperCase().includes(kw.toUpperCase()));
                txData.allocatedTo = { value: match.accountId, type: 'account' };
                txData.vatType = client.isVatRegistered ? match.vatType : 'no_vat';
                txData.allocatedAt = serverTimestamp();
                txData.allocationSource = 'rule';
                txData.matchedRuleId = match.id;
                txData.matchedKeyword = keyword;
                matchCount++;
            }

            const newRef = doc(collection(db, 'aiAccountantClients', client.id, 'transactions'));
            batch.set(newRef, txData);
        });

        await batch.commit();
        toast({ title: 'Import Successful', description: `${filteredTransactions.length} transactions imported.` });
        onImportComplete();
        onOpenChange(false);
        setExtractedTransactions([]);
        setExcludedIndices(new Set());
        setStatementMeta(null);
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
                          {client.chartOfAccounts?.filter(acc => acc.accountNumber.startsWith('8400-')).map(acc => (
                            <SelectItem key={acc.id} value={acc.id}>{acc.description}</SelectItem>
                          ))}
                        </SelectContent>
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

                <Button type="submit" className="w-full" disabled={isExtracting || !watchBankAccountId}>
                  {isExtracting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                  {isExtracting ? 'Analyzing...' : 'Extract Data'}
                </Button>
              </form>
            </Form>

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
                        <CardHeader className="py-3"><CardTitle className="text-xs uppercase">Import Filters</CardTitle></CardHeader>
                        <CardContent className="space-y-4">
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
                                <p className="text-xs font-bold text-green-800">Ready to Import</p>
                                <p className="text-[10px] text-green-700">Projected balance matches statement.</p>
                            </>
                        ) : (
                            <>
                                <AlertTriangle className="h-6 w-6 text-destructive" />
                                <p className="text-xs font-bold text-destructive">Recon Mismatch</p>
                                <p className="text-[10px] text-muted-foreground">Diff: {formatPrice(calculatedRecon?.diff || 0)}</p>
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
                                Create a transaction for <strong>{formatPrice(statementMeta.openingBalance)}</strong> dated <strong>{filterStartDate || statementMeta.startDate}</strong> to match the statement start.
                            </p>
                        </div>
                    </div>
                )}

                <div className="border rounded-lg overflow-hidden">
                    <div className="bg-muted/50 p-2 border-b flex justify-between items-center">
                        <span className="text-[10px] font-bold uppercase text-muted-foreground ml-2">Preview ({filteredTransactions.length} items)</span>
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
                                            <TableCell className="text-[10px] py-2 whitespace-nowrap">{tx.date}</TableCell>
                                            <TableCell className="text-[10px] py-2 font-medium">
                                                <div className="flex flex-col">
                                                    <span className="truncate max-w-[250px]">{tx.description}</span>
                                                    {isDup && !isExcluded && <span className="text-[8px] text-destructive font-bold uppercase">Possible Duplicate</span>}
                                                </div>
                                            </TableCell>
                                            <TableCell className={cn("text-right font-mono text-[10px] py-2", tx.amount < 0 ? "text-destructive" : "text-green-600")}>
                                                {formatPrice(tx.amount)}
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
              <div className="h-[500px] flex flex-col items-center justify-center text-center space-y-4 border-2 border-dashed rounded-xl bg-muted/5 p-8">
                {isExtracting ? (
                    <>
                        <Loader2 className="h-12 w-12 animate-spin text-primary opacity-20" />
                        <p className="text-lg font-bold">AI Processing...</p>
                        <p className="text-sm text-muted-foreground">Extracting transactions from your PDF.</p>
                    </>
                ) : (
                    <>
                        <FileText className="h-16 w-16 opacity-10" />
                        <p className="text-lg font-bold">Ready for Analysis</p>
                        <p className="text-sm text-muted-foreground max-w-sm">Upload a PDF statement to begin automated extraction.</p>
                    </>
                )}
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
