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
import { Loader2, Sparkles, FileText, Upload, AlertTriangle, CheckCircle2, Info, FileSpreadsheet, RotateCcw } from 'lucide-react';
import { extractStatementData } from '@/ai/flows/extract-statement-data';
import { extractStatementPeriod, ExtractStatementPeriodOutput } from '@/ai/flows/extract-statement-period';
import { getFirestore, collection, getDocs, doc, query, where, writeBatch, serverTimestamp } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { User, ChartOfAccount, ImportedTransaction, AllocationRule } from '@/lib/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Slider } from '@/components/ui/slider';
import { format, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import * as XLSX from 'xlsx';

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
  const [dateRange, setDateRange] = useState<[number, number]>([0, 100]);
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

  const handleExtract = async (values: z.infer<typeof formSchema>) => {
    const file = values.statement[0];
    if (!file) return;

    setIsExtracting(true);
    setExtractedTransactions([]);
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

  const handleImport = async () => {
    if (!client.id || !watchBankAccountId || filteredTransactions.length === 0) return;
    setIsImporting(true);
    
    try {
        const rulesRef = collection(db, "allocationRules");
        const rulesSnap = await getDocs(rulesRef);
        const globalRules = rulesSnap.docs.map(d => ({ id: d.id, ...d.data() } as AllocationRule));
        const allRules = [...(client.allocationRules || []), ...globalRules].sort((a, b) => (a.priority || 99) - (b.priority || 99));

        const batch = writeBatch(db);
        let matchCount = 0;

        if (createOpeningBalance && statementMeta) {
            const openBalRef = doc(collection(db, 'aiAccountantClients', client.id, 'transactions'));
            batch.set(openBalRef, {
                clientId: client.id,
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
            const match = allRules.find(r => r.keywords.some(kw => tx.description.toUpperCase().includes(kw.toUpperCase())));
            
            const txData: any = {
                clientId: client.id,
                date: new Date(tx.date).toISOString(),
                reference: `AI-PDF-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                description: tx.description.toUpperCase(),
                amount: tx.amount,
                isExpense: tx.amount < 0,
                bankAccountId: watchBankAccountId,
                status: match ? 'reviewed' : 'new'
            };

            if (match) {
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
        toast({ title: 'Import Successful', description: `${filteredTransactions.length} transactions imported. ${matchCount} auto-allocated.` });
        onImportComplete();
        onOpenChange(false);
        setExtractedTransactions([]);
        setStatementMeta(null);
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-5xl max-h-[95vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            AI Bank Statement Importer
          </DialogTitle>
          <DialogDescription>
            Use AI to extract transactions from PDF or Image statements for <strong>{client.companyName || client.name}</strong>.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 py-4">
          <div className="lg:col-span-4 space-y-6">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleExtract)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="bankAccountId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Select Target Account</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select account..." />
                          </SelectTrigger>
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
                      <FormLabel>Statement File (PDF/Image)</FormLabel>
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
                  {isExtracting ? 'Extracting...' : 'Extract from File'}
                </Button>
              </form>
            </Form>

            {statementMeta && (
                <Card className="bg-primary/5 border-primary/20">
                    <CardHeader className="py-3">
                        <CardTitle className="text-xs font-bold uppercase tracking-wider flex items-center gap-2">
                            <Info className="h-3 w-3 text-primary" />
                            Statement Details
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
                                className="h-7 text-[11px] font-mono"
                            />
                        </div>
                        <div className="space-y-1">
                            <Label className="text-[9px] uppercase text-muted-foreground">Closing Balance</Label>
                            <Input 
                                type="number" 
                                step="0.01" 
                                value={statementMeta.closingBalance} 
                                onChange={(e) => setStatementMeta(p => p ? {...p, closingBalance: parseFloat(e.target.value) || 0} : null)}
                                className="h-7 text-[11px] font-mono"
                            />
                        </div>
                    </CardContent>
                </Card>
            )}
          </div>

          <div className="lg:col-span-8">
            {extractedTransactions.length > 0 ? (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 rounded-lg border bg-muted/20 space-y-2">
                        <p className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest">Import Reconciliation</p>
                        <div className="flex justify-between text-xs">
                            <span className="text-muted-foreground">Starting Balance:</span>
                            <span className={cn("font-bold", (createOpeningBalance ? statementMeta?.openingBalance! : currentAccountData.balance) < 0 ? "text-destructive" : "text-green-600")}>
                                {formatPrice(createOpeningBalance ? statementMeta?.openingBalance! : currentAccountData.balance)}
                            </span>
                        </div>
                        <div className="flex justify-between text-xs">
                            <span className="text-muted-foreground">Import Sum:</span>
                            <span className={calculatedRecon?.importTotal! < 0 ? "text-destructive" : "text-green-600"}>{formatPrice(calculatedRecon?.importTotal || 0)}</span>
                        </div>
                        <Separator />
                        <div className="flex justify-between text-sm font-bold pt-1">
                            <span>Projected Balance:</span>
                            <span>{formatPrice(calculatedRecon?.projectedBalance || 0)}</span>
                        </div>
                    </div>

                    <div className={cn("p-4 rounded-lg border flex flex-col justify-center items-center text-center space-y-1 transition-colors", calculatedRecon?.isMatched ? "bg-green-50 border-green-200" : "bg-destructive/5 border-destructive/20")}>
                        {calculatedRecon?.isMatched ? (
                            <>
                                <CheckCircle2 className="h-6 w-6 text-green-600" />
                                <p className="text-xs font-bold text-green-800">Perfect Match!</p>
                                <p className="text-[10px] text-green-700">Projected balance matches statement.</p>
                            </>
                        ) : (
                            <>
                                <AlertTriangle className="h-6 w-6 text-destructive" />
                                <p className="text-xs font-bold text-destructive">Balance Mismatch</p>
                                <p className="text-[10px] text-muted-foreground">Difference: {formatPrice(calculatedRecon?.diff || 0)}</p>
                            </>
                        )}
                    </div>
                </div>

                <div className="space-y-4">
                    <div className="flex justify-between text-xs font-bold uppercase text-muted-foreground">
                        <span>Select Date Range</span>
                        <span>{filteredTransactions.length} of {extractedTransactions.length} items</span>
                    </div>
                    <Slider
                        value={dateRange}
                        onValueChange={(v) => setDateRange(v as [number, number])}
                        max={100}
                        step={1}
                    />
                </div>

                {currentAccountData.balance === 0 && statementMeta && statementMeta.openingBalance !== 0 && (
                    <div className="bg-yellow-50 border border-yellow-200 p-3 rounded-lg flex items-start gap-3">
                        <Checkbox 
                            id="create-opening-diag" 
                            checked={createOpeningBalance} 
                            onCheckedChange={(v) => setCreateOpeningBalance(!!v)} 
                            className="mt-1"
                        />
                        <div className="space-y-1">
                            <Label htmlFor="create-opening-diag" className="text-xs font-bold text-yellow-800">Post Opening Balance?</Label>
                            <p className="text-[10px] text-yellow-700 leading-tight">Create a transaction for <strong>{formatPrice(statementMeta.openingBalance)}</strong> to match the statement start.</p>
                        </div>
                    </div>
                )}

                <div className="border rounded-lg overflow-hidden max-h-[300px] overflow-y-auto">
                    <Table>
                        <TableHeader className="bg-muted/50 sticky top-0 z-10">
                            <TableRow>
                                <TableHead className="text-[10px] uppercase">Date</TableHead>
                                <TableHead className="text-[10px] uppercase">Description</TableHead>
                                <TableHead className="text-right text-[10px] uppercase">Amount</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredTransactions.map((tx, idx) => (
                                <TableRow key={idx} className={cn(isDuplicate(tx) && "bg-destructive/5")}>
                                    <TableCell className="text-[10px] py-2">{tx.date}</TableCell>
                                    <TableCell className="text-[10px] py-2 font-medium truncate max-w-[200px]">{tx.description}</TableCell>
                                    <TableCell className={cn("text-right font-mono text-[10px] py-2", tx.amount < 0 ? "text-destructive" : "text-green-600")}>
                                        {formatPrice(tx.amount)}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
              </div>
            ) : (
              <div className="h-[400px] flex flex-col items-center justify-center text-center space-y-4 border-2 border-dashed rounded-xl bg-muted/5 p-8">
                {isExtracting ? (
                    <>
                        <Loader2 className="h-12 w-12 animate-spin text-primary opacity-20" />
                        <div className="space-y-1">
                            <p className="text-lg font-bold">AI Processing...</p>
                            <p className="text-sm text-muted-foreground">We are performing deep OCR on your statement. This takes about 30 seconds.</p>
                        </div>
                    </>
                ) : (
                    <>
                        <FileText className="h-16 w-16 opacity-10" />
                        <div className="space-y-2">
                            <p className="text-lg font-bold">Ready for Statement</p>
                            <p className="text-sm text-muted-foreground max-w-sm">Upload a PDF or Image statement to begin automated extraction and reconciliation.</p>
                        </div>
                    </>
                )}
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="border-t pt-4">
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
