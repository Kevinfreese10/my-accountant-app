'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { FileUp, Loader2, PlusCircle, Search, Settings, Trash2, Edit, ArrowRightLeft, BookOpen, Sparkles, ArrowUpDown, ChevronLeft, ChevronRight, CheckCheck, ChevronsUpDown, MoreHorizontal, RotateCcw, AlertTriangle, Download, BrainCircuit, Play, CheckCircle2, Clock, Undo2, RotateCw, History, Info, X, ArrowRight, MessageSquareQuote, Send, AlertCircle, StopCircle } from 'lucide-react';
import Papa from 'papaparse';
import { ImportedTransaction, ChartOfAccount, User, VatType, AllocatedTransaction, AllocationRule, ClientCustomer, Invoice, SmartAllocationResult } from '@/lib/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { getFirestore, doc, updateDoc, arrayUnion, getDoc, collection, getDocs, query, orderBy, where, writeBatch, onSnapshot, Timestamp, deleteField, addDoc, limit, serverTimestamp, deleteDoc } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { useToast } from '@/hooks/use-toast';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { Label } from '@/components/ui/label';
import { allVatTypes } from '@/lib/vat-types';
import { usePaginatedFirestore } from '@/hooks/use-paginated-firestore';
import { Command, CommandEmpty, CommandInput, CommandList, CommandGroup, CommandSeparator, CommandItem } from "@/components/ui/command";
import { ScrollArea } from '@/components/ui/scroll-area';
import { format, parse } from 'date-fns';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { DateRange } from "react-day-picker";
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { suggestTransactionAllocation } from '@/ai/flows/suggest-transaction-allocation';
import { useAuth } from '@/contexts/AuthContext';
import { runAiAccountantAnalysis, prepareAiAccountantAnalysis, moveTransactionToNew, researchMerchantWithAi, updateGlobalMerchantDb, sendAllocationQueryEmail, resetAiAccountantAnalysis } from '@/app/actions';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from "@/components/ui/progress";

const db = getFirestore(firebaseApp);
const PAGE_SIZE = 50;

const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-GB', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(price);
};

// #region Helper Components

function RuleViewDialog({ open, onOpenChange, rule, matchedKeyword }: { open: boolean, onOpenChange: (open: boolean) => void, rule: AllocationRule | null, matchedKeyword?: string | null }) {
    if (!rule) return null;
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <BookOpen className="h-5 w-5 text-primary" />
                        Allocation Rule Details
                    </DialogTitle>
                    <DialogDescription>Details for rule: <strong>{rule.description}</strong></DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    {matchedKeyword && (
                        <div className="bg-primary/5 p-3 rounded-lg border border-primary/20">
                            <p className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest mb-1">Triggering Keyword</p>
                            <Badge variant="outline" className="text-sm font-bold border-primary/30 text-primary uppercase">
                                {matchedKeyword}
                            </Badge>
                        </div>
                    )}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <p className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest">Allocate To</p>
                            <p className="text-sm font-semibold">{rule.accountId}</p>
                        </div>
                        <div className="space-y-1">
                            <p className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest">VAT Treatment</p>
                            <p className="text-sm font-semibold capitalize">{rule.vatType.replace(/_/g, ' ')}</p>
                        </div>
                    </div>
                    <div className="space-y-2">
                        <p className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest">All Rule Keywords</p>
                        <div className="flex flex-wrap gap-1">
                            {rule.keywords.map(kw => (
                                <Badge key={kw} variant="secondary" className={cn("text-[10px]", kw.toUpperCase() === matchedKeyword?.toUpperCase() && "bg-primary text-primary-foreground")}>
                                    {kw}
                                </Badge>
                            ))}
                        </div>
                    </div>
                </div>
                <DialogFooter>
                    <Button asChild variant="outline" className="w-full">
                        <Link href="/admin/ai-accountant/allocation-rules">
                            Manage All Rules <ArrowRight className="ml-2 h-4 w-4" />
                        </Link>
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function ImportDialog({ client, bankAccountId, currentBalance, onImportComplete }: { client: User | null, bankAccountId: string, currentBalance: number, onImportComplete: () => void }) {
    const [isOpen, setIsOpen] = useState(false);
    const [file, setFile] = useState<File | null>(null);
    const [parsedTransactions, setParsedTransactions] = useState<any[]>([]);
    const [isParsing, setIsParsing] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const { toast } = useToast();

    const importTotal = useMemo(() => {
        return parsedTransactions.reduce((sum, tx) => sum + tx.Amount, 0);
    }, [parsedTransactions]);

    const potentialBalance = currentBalance + importTotal;

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (selectedFile) {
            setIsParsing(true);
            setFile(selectedFile);
            
            Papa.parse(selectedFile, {
                header: true,
                skipEmptyLines: true,
                complete: (results) => {
                    const data = results.data as any[];
                    const transactions = data.map(row => {
                        const normalizedRow: any = {};
                        Object.keys(row).forEach(k => normalizedRow[k.toLowerCase().trim()] = row[k]);
                        return {
                            Date: normalizedRow.date || '',
                            Description: normalizedRow.description || normalizedRow.desc || '',
                            Amount: parseFloat(String(normalizedRow.amount || '').replace(/[^\d.-]/g, ''))
                        };
                    }).filter(tx => tx.Date && tx.Description && !isNaN(tx.Amount));
                    
                    setParsedTransactions(transactions);
                    setIsParsing(false);
                }
            });
        }
    };
    
    const handleImport = async () => {
        if (!client?.uid || !bankAccountId || parsedTransactions.length === 0) return;
        setIsUploading(true);
        try {
            const rulesQuery = collection(db, "allocationRules");
            const rulesSnap = await getDocs(rulesQuery);
            const globalRules = rulesSnap.docs.map(d => ({ id: d.id, ...d.data() } as AllocationRule));
            const allRules = [...(client.allocationRules || []), ...globalRules].sort((a, b) => (a.priority || 99) - (b.priority || 99));

            const batch = writeBatch(db);
            let matchCount = 0;

            parsedTransactions.forEach((row) => {
                let parsedDate = parse(row.Date, 'dd/MM/yyyy', new Date());
                if (isNaN(parsedDate.getTime())) parsedDate = new Date(row.Date);
                if (isNaN(parsedDate.getTime())) return;

                const description = row.Description;
                const match = allRules.find(r => r.keywords.some(kw => description.toUpperCase().includes(kw.toUpperCase())));

                const txData: any = {
                    clientId: client.uid!,
                    date: parsedDate.toISOString(),
                    reference: `CSV-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                    description: description,
                    amount: row.Amount,
                    isExpense: row.Amount < 0,
                    bankAccountId: bankAccountId,
                    status: match ? 'reviewed' : 'new'
                };

                if (match) {
                    const keyword = match.keywords.find(kw => description.toUpperCase().includes(kw.toUpperCase()));
                    txData.allocatedTo = { value: match.accountId, type: 'account' };
                    txData.vatType = client.isVatRegistered ? match.vatType : 'no_vat';
                    txData.allocatedAt = serverTimestamp();
                    txData.allocationSource = 'rule';
                    
                    if (match.id) txData.matchedRuleId = match.id;
                    if (match.description) txData.matchedRuleDescription = match.description;
                    if (keyword) txData.matchedKeyword = keyword;
                    
                    matchCount++;
                }

                const newRef = doc(collection(db, 'aiAccountantClients', client.uid!, 'transactions'));
                batch.set(newRef, txData);
            });

            await batch.commit();
            toast({ 
                title: "Import Successful", 
                description: `${parsedTransactions.length} transactions imported. ${matchCount} auto-allocated by rules.`
            });
            onImportComplete();
            setIsOpen(false);
        } catch (error) {
            console.error("Import error", error);
            toast({ title: "Import Failed", description: "An unexpected error occurred. Please check your data format.", variant: "destructive"});
        } finally {
            setIsUploading(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild><Button variant="outline" className="bg-primary text-primary-foreground hover:bg-primary/90 border-none font-bold"><FileUp className="mr-2 h-4 w-4" /> Import CSV</Button></DialogTrigger>
            <DialogContent className="sm:max-w-xl">
                <DialogHeader><DialogTitle>Import Bank Statement</DialogTitle></DialogHeader>
                <div className="space-y-4 py-4">
                     <input id="statement-file" type="file" accept=".csv" onChange={handleFileChange} />
                     {isParsing && <p className="text-sm text-muted-foreground flex items-center"><Loader2 className="mr-2 animate-spin"/> Parsing...</p>}
                     
                     {parsedTransactions.length > 0 && (
                        <div className="bg-muted/50 p-4 rounded-lg border space-y-2 animate-in fade-in slide-in-from-top-2">
                            <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Transactions Found:</span>
                                <span className="font-bold">{parsedTransactions.length}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Current Balance:</span>
                                <span className="font-semibold">{formatPrice(currentBalance)}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Import Total:</span>
                                <span className={cn("font-bold", importTotal < 0 ? "text-destructive" : "text-green-600")}>
                                    {formatPrice(importTotal)}
                                </span>
                            </div>
                            <Separator />
                            <div className="flex justify-between text-sm pt-1">
                                <span className="text-muted-foreground font-semibold">New Potential Balance:</span>
                                <span className="font-bold text-primary text-lg">
                                    {formatPrice(potentialBalance)}
                                </span>
                            </div>
                        </div>
                     )}
                </div>
                <DialogFooter>
                    <Button type="button" onClick={handleImport} disabled={isUploading || isParsing || parsedTransactions.length === 0}>
                        {isUploading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Save {parsedTransactions.length} Transactions
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

const ruleFormSchema = z.object({
  mode: z.enum(['new', 'append']).default('new'),
  existingRuleId: z.string().optional(),
  description: z.string().optional(),
  keywords: z.string().min(2),
  accountId: z.string().optional(),
  vatType: z.string().optional(),
  scope: z.enum(['global', 'client']).default('client'),
});

function CreateRuleDialog({ client, onRuleCreated, open, onOpenChange, defaultValues, existingRules }: {
    client: User | null;
    onRuleCreated: () => void;
    open: boolean;
    onOpenChange: (isOpen: boolean) => void;
    defaultValues: Partial<z.infer<typeof ruleFormSchema>>;
    transactionDescription: string | null;
    existingRules: AllocationRule[];
}) {
    const { toast } = useToast();
    const form = useForm<z.infer<typeof ruleFormSchema>>({
        resolver: zodResolver(ruleFormSchema),
        defaultValues: { mode: 'new', ...defaultValues },
    });
    
    const handleSave = async (values: z.infer<typeof ruleFormSchema>) => {
        if (!client?.uid) return;
        const keywordsArray = values.keywords.split(',').map(k => k.trim().toUpperCase()).filter(Boolean);

        try {
            if (values.mode === 'append' && values.existingRuleId) {
                const rule = existingRules.find(r => r.id === values.existingRuleId);
                if (rule) {
                    const clientRef = doc(db, 'aiAccountantClients', client.uid);
                    const updatedRules = (client.allocationRules || []).map(r => r.id === rule.id ? { ...r, keywords: Array.from(new Set([...r.keywords, ...keywordsArray])) } : r);
                    await updateDoc(clientRef, { allocationRules: updatedRules });
                }
            } else {
                const newRule = {
                    id: `rule_${Date.now()}`,
                    description: values.description || '',
                    keywords: keywordsArray,
                    accountId: values.accountId || '',
                    vatType: values.vatType || 'no_vat',
                    type: 'hard',
                    scope: values.scope,
                    priority: 99,
                };
                await updateDoc(doc(db, 'aiAccountantClients', client.uid), { allocationRules: arrayUnion(newRule) });
            }
            toast({ title: 'Rule Saved' });
            onRuleCreated();
            onOpenChange(false);
        } catch(e) {
            toast({ title: 'Error', variant: 'destructive'});
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader><DialogTitle>Create Allocation Rule</DialogTitle></DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(handleSave)} className="space-y-4">
                        <FormField control={form.control} name="description" render={({ field }) => ( <FormItem><FormLabel>Description</FormLabel><FormControl><Input {...field} /></FormControl></FormItem> )} />
                        <FormField control={form.control} name="keywords" render={({ field }) => ( <FormItem><FormLabel>Keywords</FormLabel><FormControl><Input {...field} /></FormControl></FormItem> )} />
                        <FormField control={form.control} name="accountId" render={({ field }) => (
                            <FormItem><FormLabel>Account</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                    <FormControl><SelectTrigger><SelectValue placeholder="Select account..." /></SelectTrigger></FormControl>
                                    <SelectContent>{client?.chartOfAccounts?.map(acc => <SelectItem key={acc.id} value={acc.id}>{acc.description}</SelectItem>)}</SelectContent>
                                </Select>
                            </FormItem>
                        )} />
                        <DialogFooter><Button type="submit">Save Rule</Button></DialogFooter>
                    </form>
                </Form>
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
        if (!client?.uid) return;
        setIsSaving(true);
        try {
            const clientRef = doc(db, 'aiAccountantClients', client.uid);
            await updateDoc(clientRef, { chartOfAccounts: arrayUnion({ ...values, id: values.accountNumber }) });
            toast({ title: 'Account Created' });
            onAccountCreated();
            onOpenChange(false);
        } catch (error) {
            toast({ title: 'Error', description: 'Failed to create account.', variant: 'destructive' });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader><DialogTitle>Create New Ledger Account</DialogTitle></DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(handleCreateAccount)} className="space-y-4">
                        <FormField control={form.control} name="accountNumber" render={({ field }) => ( <FormItem><FormLabel>Account Number</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>)} />
                        <FormField control={form.control} name="description" render={({ field }) => ( <FormItem><FormLabel>Description</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>)} />
                        <FormField control={form.control} name="section" render={({ field }) => ( <FormItem><FormLabel>Section</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value="Income Statement">Income Statement</SelectItem><SelectItem value="Balance Sheet">Balance Sheet</SelectItem></SelectContent></Select></FormItem>)} />
                        <DialogFooter><Button type="submit" disabled={isSaving}>Create Account</Button></DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}

function AIAllocationReviewDialog({ open, onOpenChange, suggestion, transaction, onAction }: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    suggestion: SmartAllocationResult | null;
    transaction: ImportedTransaction | null;
    onAction: (mode: 'new' | 'append' | 'allocate') => void;
}) {
    if (!suggestion || !transaction) return null;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-primary" /> AI Allocation Suggestion</DialogTitle>
                    <DialogDescription>AI Analysis for: <strong>{transaction.description}</strong></DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div className="bg-primary/5 p-4 rounded-lg border border-primary/10">
                        <div className="flex justify-between items-center mb-2">
                            <span className="text-xs font-bold uppercase text-muted-foreground">Confidence</span>
                            <Badge variant={suggestion.confidence > 80 ? 'success' : 'warning'}>{suggestion.confidence}%</Badge>
                        </div>
                        <p className="text-sm italic text-muted-foreground leading-relaxed">"{suggestion.summary}"</p>
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                            <p className="font-bold text-muted-foreground text-[10px] uppercase">Account</p>
                            <p className="font-semibold">{suggestion.accountId}</p>
                        </div>
                        <div>
                            <p className="font-bold text-muted-foreground text-[10px] uppercase">VAT</p>
                            <p className="font-semibold">{suggestion.vatType}</p>
                        </div>
                    </div>
                </div>
                <DialogFooter className="flex flex-col sm:flex-row gap-2">
                    <Button onClick={() => onAction('allocate')} className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90">Allocate Only</Button>
                    <Button variant="outline" onClick={() => onAction('append')} className="flex-1">Add Keyword to Existing Rule</Button>
                    <Button variant="outline" onClick={() => onAction('new')} className="flex-1">Create New Rule</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

interface TransactionGroup {
    merchantKey: string;
    transactions: ImportedTransaction[];
    suggestion: SmartAllocationResult | null;
    status: 'pending' | 'ready' | 'processing' | 'server_researching';
}

function GroupTransactionsDialog({ open, onOpenChange, group, onMoveToNew }: { 
    open: boolean, 
    onOpenChange: (open: boolean) => void, 
    group: TransactionGroup | null,
    onMoveToNew: (txId: string) => Promise<void>
}) {
    const [isMoving, setIsMoving] = useState<string | null>(null);
    if (!group) return null;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-3xl">
                <DialogHeader>
                    <DialogTitle>Transactions for: {group.merchantKey}</DialogTitle>
                    <DialogDescription>Review individual transactions in this group.</DialogDescription>
                </DialogHeader>
                <div className="max-h-[60vh] overflow-y-auto">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Date</TableHead>
                                <TableHead>Description</TableHead>
                                <TableHead className="text-right">Amount</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {group.transactions.map(tx => (
                                <TableRow key={tx.id}>
                                    <TableCell className="text-xs">{new Date(tx.date).toLocaleDateString('en-GB')}</TableCell>
                                    <TableCell className="text-xs font-medium">
                                        <div className="flex flex-col">
                                            <span>{tx.cleanDescription || tx.description}</span>
                                            {tx.cleanDescription && <span className="text-[9px] text-muted-foreground italic">Raw: {tx.description}</span>}
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-right font-mono text-xs">{formatPrice(tx.amount)}</TableCell>
                                    <TableCell className="text-right">
                                        <Button 
                                            variant="ghost" 
                                            size="sm" 
                                            className="text-destructive h-7 text-[10px]"
                                            onClick={() => {
                                                setIsMoving(tx.id);
                                                onMoveToNew(tx.id).finally(() => setIsMoving(null));
                                            }}
                                            disabled={isMoving === tx.id}
                                        >
                                            {isMoving === tx.id ? <Loader2 className="h-3 w-3 animate-spin mr-1"/> : <Undo2 className="h-3 w-3 mr-1"/>}
                                            Move to New
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            </DialogContent>
        </Dialog>
    );
}

// #endregion

const NewTransactionsTab = React.forwardRef<any, any>(({ client, bankAccountId, globalRules, onAccountCreated, setActiveTab, currentBalance, customers }, ref) => {
    const { user } = useAuth();
    const { toast } = useToast();
    const [activeSubTab, setActiveSubTab] = useState<'expenses' | 'income'>('expenses');
    const [allocations, setAllocations] = useState<any>({});
    const [selectedTransactions, setSelectedTransactions] = useState<string[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [isCreateRuleOpen, setIsCreateOpen] = useState(false);
    const [isCreateGeneralAccountOpen, setIsCreateGeneralAccountOpen] = useState(false);
    const [ruleDefaultValues, setRuleDefaultValues] = useState<any>({});
    const [transactionDescriptionForRule, setTransactionDescriptionForRule] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [isAiResearching, setIsAiResearching] = useState<string | null>(null);
    const [isAiReviewOpen, setIsAiReviewOpen] = useState(false);
    const [aiSuggestion, setAiSuggestion] = useState<SmartAllocationResult | null>(null);
    const [selectedTxForAi, setSelectedTxForAi] = useState<ImportedTransaction | null>(null);
    const [isRuleAllocating, setIsRuleAllocating] = useState(false);
    const [isSubmittingToWorkflow, setIsSubmittingToWorkflow] = useState(false);

    type SortField = 'date' | 'description' | 'amount';
    const [sortField, setSortField] = useState<SortField>('description');
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

    const baseQuery = useMemo(() => {
        if (!client?.uid || !bankAccountId) return null;
        return query(collection(db, 'aiAccountantClients', client.uid, 'transactions'), 
            where('bankAccountId', '==', bankAccountId),
            where('status', 'in', ['new', 'ai_processing']),
            where('isExpense', '==', activeSubTab === 'expenses'),
            orderBy(sortField, sortDirection)
        );
    }, [client?.uid, bankAccountId, activeSubTab, sortField, sortDirection]);

    const { documents: fetchedTransactions, isLoading, refetch, goToNextPage, goToPreviousPage, canGoNext, canGoPrev, currentPage } = usePaginatedFirestore<ImportedTransaction>({ baseQuery, pageSize: PAGE_SIZE });

    const transactions = useMemo(() => {
        if (!searchTerm.trim()) return fetchedTransactions;
        return fetchedTransactions.filter(tx => tx.description.toLowerCase().includes(searchTerm.toLowerCase()));
    }, [fetchedTransactions, searchTerm]);

    React.useImperativeHandle(ref, () => ({ refetch }));

    const handleSort = (field: SortField) => {
        if (sortField === field) {
            setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDirection('asc');
        }
    };

    const handleBulkDelete = async () => {
        if (!client?.uid || selectedTransactions.length === 0) return;
        try {
            const batch = writeBatch(db);
            selectedTransactions.forEach(id => batch.delete(doc(db, 'aiAccountantClients', client.uid!, 'transactions', id)));
            await batch.commit();
            toast({ title: 'Deleted', description: `${selectedTransactions.length} transactions removed.` });
            setSelectedTransactions([]);
            refetch();
        } catch (e) { toast({ title: 'Error', variant: 'destructive' }); }
    };

    const handleBulkAllocate = async (allocation: { value: string, type: 'account' | 'customer' | 'supplier' }, vatType: VatType) => {
        if (!client?.uid || selectedTransactions.length === 0) return;
        try {
            const batch = writeBatch(db);
            selectedTransactions.forEach(id => {
                batch.update(doc(db, 'aiAccountantClients', client.uid!, 'transactions', id), {
                    status: 'reviewed',
                    allocatedTo: allocation,
                    vatType: client.isVatRegistered ? vatType : 'no_vat',
                    allocatedAt: serverTimestamp(),
                    allocationSource: 'manual'
                });
            });
            await batch.commit();
            toast({ title: 'Allocated', description: `${selectedTransactions.length} transactions updated.` });
            setSelectedTransactions([]);
            refetch();
        } catch (e) { toast({ title: 'Error', variant: 'destructive' }); }
    };

    const handleAllocateByRules = async () => {
        if (!client?.uid || !bankAccountId) return;
        setIsRuleAllocating(true);
        try {
            const rulesQuery = collection(db, "allocationRules");
            const rulesSnap = await getDocs(rulesQuery);
            const globalRulesList = rulesSnap.docs.map(d => ({ id: d.id, ...d.data() } as AllocationRule));
            const allRules = [...(client.allocationRules || []), ...globalRulesList].sort((a, b) => (a.priority || 99) - (b.priority || 99));

            const transRef = collection(db, 'aiAccountantClients', client.uid, 'transactions');
            const q = query(
                transRef, 
                where('bankAccountId', '==', bankAccountId), 
                where('status', '==', 'new'),
                where('isExpense', '==', activeSubTab === 'expenses')
            );
            const snapshot = await getDocs(q);

            const batch = writeBatch(db);
            let count = 0;
            snapshot.docs.forEach(d => {
                const tx = d.data() as ImportedTransaction;
                const match = allRules.find(r => r.keywords.some(kw => tx.description.toUpperCase().includes(kw.toUpperCase())));
                if (match) {
                    const keyword = match.keywords.find(kw => tx.description.toUpperCase().includes(kw.toUpperCase()));
                    batch.update(d.ref, {
                        status: 'reviewed',
                        allocatedTo: { value: match.accountId, type: 'account' },
                        vatType: client.isVatRegistered ? match.vatType : 'no_vat',
                        allocatedAt: serverTimestamp(),
                        allocationSource: 'rule',
                        matchedRuleId: match.id,
                        matchedRuleDescription: match.description,
                        matchedKeyword: keyword
                    });
                    count++;
                }
            });

            if (count > 0) {
                await batch.commit();
                toast({ title: 'Rules Applied', description: `${count} transactions auto-allocated across all pages.` });
                refetch();
            } else { 
                toast({ title: 'No Matches', description: 'No rules matched any unallocated transactions.' }); 
            }
        } catch (e) { 
            console.error(e);
            toast({ title: 'Error', description: 'Failed to apply rules.', variant: 'destructive' }); 
        } finally { 
            setIsRuleAllocating(false); 
        }
    };

    const handleSaveAllocations = async () => {
        if (!client?.uid || Object.keys(allocations).length === 0) return;
        setIsSaving(true);
        try {
            const batch = writeBatch(db);
            Object.entries(allocations).forEach(([txId, alloc]: [string, any]) => {
                const tx = transactions.find(t => t.id === txId);
                const selectedVat = alloc.vatType || tx?.vatType || 'no_vat';
                
                batch.update(doc(db, 'aiAccountantClients', client.uid!, 'transactions', txId), {
                    status: 'reviewed',
                    allocatedTo: { value: alloc.value, type: alloc.type },
                    vatType: client.isVatRegistered ? selectedVat : 'no_vat',
                    allocatedAt: serverTimestamp(),
                    allocationSource: 'manual',
                });
            });
            await batch.commit();
            toast({ title: "Allocations Saved" });
            setAllocations({});
            refetch();
        } catch (e) { 
            console.error(e); 
            toast({ title: "Error Saving", variant: "destructive" });
        } finally { 
            setIsSaving(false); 
        }
    };

    const handleRunSmartMatch = async () => {
        if (!client?.uid || !bankAccountId || !user?.email) return;
        setIsSubmittingToWorkflow(true);
        try {
            const lockRes = await prepareAiAccountantAnalysis({ clientId: client.uid, bankAccountId });
            if (lockRes.count > 0) {
                setActiveTab('ai-workflow');
                // runAiAccountantAnalysis is a deterministic app-based process
                runAiAccountantAnalysis({ clientId: client.uid, bankAccountId, initiatorEmail: user.email });
            } else { 
                toast({ title: "No new expenses found to process." }); 
                setIsSubmittingToWorkflow(false);
            }
        } catch (e) { 
            toast({ title: "Process Failed", variant: "destructive" }); 
            setIsSubmittingToWorkflow(false);
        }
    };

    const handleAiResearch = async (tx: ImportedTransaction) => {
        if (!client) return;
        setIsAiResearching(tx.id);
        setSelectedTxForAi(tx);
        try {
            const res = await researchMerchantWithAi({
                clientId: client.uid,
                description: tx.description,
                chartOfAccounts: JSON.stringify(client.chartOfAccounts || []),
                isVatRegistered: !!client.isVatRegistered,
            });
            setAiSuggestion(res);
            setIsAiReviewOpen(true);
        } catch (e) { toast({ title: "Analysis Failed", variant: "destructive" }); } finally { setIsAiResearching(null); }
    };

    const handleAiReviewAction = async (mode: 'new' | 'append' | 'allocate') => {
        if (!aiSuggestion || !selectedTxForAi || !client) return;
        
        if (mode === 'allocate') {
            try {
                const batch = writeBatch(db);
                const transRef = collection(db, 'aiAccountantClients', client.uid, 'transactions');
                batch.update(doc(transRef, selectedTxForAi.id), {
                    status: 'reviewed',
                    allocatedTo: { value: aiSuggestion.accountId, type: 'account' },
                    vatType: aiSuggestion.vatType,
                    allocatedAt: serverTimestamp(),
                    allocationSource: 'ai',
                });
                await batch.commit();
                toast({ title: "Transaction Allocated" });
                setIsAiReviewOpen(false);
                refetch();
            } catch (e) {
                toast({ title: "Allocation Failed", variant: "destructive" });
            }
            return;
        }

        setTransactionDescriptionForRule(selectedTxForAi.description);
        setRuleDefaultValues({
            mode,
            description: `Rule for: ${aiSuggestion.suggestedKeyword || 'Merchant'}`,
            keywords: aiSuggestion.suggestedKeyword || '',
            accountId: aiSuggestion.accountId,
            vatType: aiSuggestion.vatType,
            scope: 'client',
        });
        setIsAiReviewOpen(false);
        setIsCreateOpen(true);
    };

    return (
        <div className="space-y-4">
            <CreateRuleDialog client={client} onRuleCreated={refetch} open={isCreateRuleOpen} onOpenChange={setIsCreateOpen} defaultValues={ruleDefaultValues} transactionDescription={transactionDescriptionForRule} existingRules={globalRules} />
            <CreateGeneralAccountDialog client={client} onAccountCreated={onAccountCreated} open={isCreateGeneralAccountOpen} onOpenChange={setIsCreateGeneralAccountOpen} />
            <AIAllocationReviewDialog open={isAiReviewOpen} onOpenChange={setIsAiReviewOpen} suggestion={aiSuggestion} transaction={selectedTxForAi} onAction={handleAiReviewAction} />
            
            <Card>
                <CardHeader className="p-0 border-b">
                    <Tabs value={activeSubTab} onValueChange={(v: any) => setActiveSubTab(v)} className="w-full">
                        <TabsList className="grid w-full grid-cols-2 rounded-none"><TabsTrigger value="expenses">Expenses</TabsTrigger><TabsTrigger value="income">Income</TabsTrigger></TabsList>
                    </Tabs>
                    <div className="p-4 flex justify-between items-center gap-2 flex-wrap">
                        <div className="flex gap-2 flex-wrap">
                            <ImportDialog client={client} bankAccountId={bankAccountId} currentBalance={currentBalance} onImportComplete={refetch} />
                            
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="outline" disabled={selectedTransactions.length === 0}>
                                        Manual Allocate <ChevronsUpDown className="ml-2 h-4 w-4"/>
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent className="w-64 p-0">
                                    <Command className="w-full">
                                        <CommandInput placeholder="Search accounts..." />
                                        <CommandList className="max-h-72 overflow-y-auto">
                                            <CommandEmpty>No results found.</CommandEmpty>
                                            <CommandGroup>
                                                <CommandItem onSelect={() => setIsCreateGeneralAccountOpen(true)} className="text-primary font-medium cursor-pointer p-2 flex items-center"><PlusCircle className="mr-2 h-4 w-4" />Create new account...</CommandItem>
                                            </CommandGroup>
                                            <CommandSeparator />
                                            {activeSubTab === 'income' && (
                                                <CommandGroup heading="Customers">
                                                    {customers.map(c => <CommandItem key={c.id} onSelect={() => handleBulkAllocate({value: c.id, type: 'customer'}, 'no_vat')} className="p-2 cursor-pointer hover:bg-muted">{c.name}</CommandItem>)}
                                                </CommandGroup>
                                            )}
                                            <CommandGroup heading="General Ledger Accounts">
                                                {client?.chartOfAccounts?.map(acc => (
                                                    <DropdownMenuSub key={acc.id}>
                                                        <DropdownMenuSubTrigger className="flex items-center justify-between w-full p-2 cursor-pointer hover:bg-muted">
                                                            <span>{acc.description}</span>
                                                        </DropdownMenuSubTrigger>
                                                        <DropdownMenuSubContent className="w-56">
                                                            <DropdownMenuLabel>VAT Treatment</DropdownMenuLabel>
                                                            <DropdownMenuSeparator />
                                                            {allVatTypes.map(v => <DropdownMenuItem key={v.name} onSelect={() => handleBulkAllocate({value: acc.id, type: 'account'}, v.name as VatType)}>{v.label}</DropdownMenuItem>)}
                                                        </DropdownMenuSubContent>
                                                    </DropdownMenuSub>
                                                ))}
                                            </CommandGroup>
                                        </CommandList>
                                    </Command>
                                </DropdownMenuContent>
                            </DropdownMenu>

                            <Button variant="outline" onClick={handleAllocateByRules} disabled={isRuleAllocating}>
                                {isRuleAllocating ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <BookOpen className="mr-2 h-4 w-4" />} Apply Rules
                            </Button>

                            <DropdownMenu>
                                <DropdownMenuTrigger asChild><Button variant="outline" disabled={selectedTransactions.length === 0}>Actions ...</Button></DropdownMenuTrigger>
                                <DropdownMenuContent><DropdownMenuItem className="text-destructive" onClick={handleBulkDelete}>Delete Selected</DropdownMenuItem></DropdownMenuContent>
                            </DropdownMenu>

                            {activeSubTab === 'expenses' && <Button variant="secondary" onClick={handleRunSmartMatch} disabled={isSubmittingToWorkflow} className="font-bold border-2 border-primary/20"><RotateCw className="mr-2 h-4 w-4" /> Group & Smart Match</Button>}
                        </div>
                        <div className="flex items-center gap-4 flex-wrap">
                            <div className="flex items-center gap-2">
                                <Button variant="outline" size="sm" onClick={goToPreviousPage} disabled={!canGoPrev}><ChevronLeft className="h-4 w-4" /></Button>
                                <span className="text-xs font-medium min-w-[60px] text-center">Page {currentPage}</span>
                                <Button variant="outline" size="sm" onClick={goToNextPage} disabled={!canGoNext}><ChevronRight className="h-4 w-4" /></Button>
                            </div>
                            <div className="relative">
                                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input placeholder="Search descriptions..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-8 w-64" />
                            </div>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-12"><Checkbox checked={transactions.length > 0 && selectedTransactions.length === transactions.length} onCheckedChange={(v) => setSelectedTransactions(v ? transactions.map(tx => tx.id) : [])} /></TableHead>
                                <TableHead><Button variant="ghost" onClick={() => handleSort('date')}>Date <ArrowUpDown className="ml-2 h-4 w-4" /></Button></TableHead>
                                <TableHead><Button variant="ghost" onClick={() => handleSort('description')}>Description <ArrowUpDown className="ml-2 h-4 w-4" /></Button></TableHead>
                                <TableHead>Reference</TableHead>
                                <TableHead>Allocate To</TableHead>
                                {client?.isVatRegistered && <TableHead className="w-[180px]">VAT Type</TableHead>}
                                <TableHead className="text-right"><Button variant="ghost" onClick={() => handleSort('amount')}>Amount <ArrowUpDown className="ml-2 h-4 w-4" /></Button></TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? <TableRow><TableCell colSpan={client?.isVatRegistered ? 8 : 7} className="text-center h-24"><Loader2 className="animate-spin mx-auto"/></TableCell></TableRow> :
                             transactions.map(tx => (
                                <TableRow key={tx.id}>
                                    <TableCell><Checkbox checked={selectedTransactions.includes(tx.id)} onCheckedChange={(v) => setSelectedTransactions(prev => v ? [...prev, tx.id] : prev.filter(id => id !== tx.id))} /></TableCell>
                                    <TableCell>{new Date(tx.date).toLocaleDateString('en-GB')}</TableCell>
                                    <TableCell>
                                        <div className="flex flex-col">
                                            <span className="font-medium">{tx.cleanDescription || tx.description}</span>
                                            {tx.cleanDescription && <span className="text-[9px] text-muted-foreground italic">Raw: {tx.description}</span>}
                                            {tx.merchantKey && <Badge variant="secondary" className="w-fit mt-1 text-[9px] font-bold">{tx.merchantKey}</Badge>}
                                        </div>
                                    </TableCell>
                                    <TableCell className="font-mono text-xs opacity-70">{tx.reference}</TableCell>
                                    <TableCell>
                                        <Popover>
                                            <PopoverTrigger asChild>
                                                <Button variant="outline" className="h-8 text-[11px] w-full justify-start overflow-hidden">
                                                    <span className="truncate">
                                                        {allocations[tx.id] 
                                                            ? [...(client?.chartOfAccounts || []), ...customers].find(o => o.id === allocations[tx.id].value)?.description || 'Selected' 
                                                            : 'Select Account...'}
                                                    </span>
                                                </Button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-[300px] p-0" align="start">
                                                <Command className="w-full">
                                                    <CommandInput placeholder="Search accounts..." />
                                                    <CommandList>
                                                        <CommandEmpty>No results found.</CommandEmpty>
                                                        <CommandGroup heading="GL Accounts">
                                                            {client?.chartOfAccounts?.map(a => (
                                                                <CommandItem 
                                                                    key={a.id} 
                                                                    value={a.description}
                                                                    onSelect={() => setAllocations((p: any) => ({
                                                                        ...p, 
                                                                        [tx.id]: { 
                                                                            ...(p[tx.id] || { type: 'account' }), 
                                                                            value: a.id, 
                                                                            type: 'account' 
                                                                        }
                                                                    }))}
                                                                    className="p-2 cursor-pointer hover:bg-muted"
                                                                >
                                                                    {a.description}
                                                                </CommandItem>
                                                            ))}
                                                        </CommandGroup>
                                                        {activeSubTab === 'income' && (
                                                            <CommandGroup heading="Customers">
                                                                {customers.map(c => (
                                                                    <CommandItem 
                                                                        key={c.id} 
                                                                        value={c.name}
                                                                        onSelect={() => setAllocations((p: any) => ({
                                                                            ...p, 
                                                                            [tx.id]: { 
                                                                                value: c.id, 
                                                                                type: 'customer', 
                                                                                vatType: 'no_vat' 
                                                                            }
                                                                        }))}
                                                                        className="p-2 cursor-pointer hover:bg-muted"
                                                                    >
                                                                        {c.name}
                                                                    </CommandItem>
                                                                ))}
                                                            </CommandGroup>
                                                        )}
                                                    </CommandList>
                                                </Command>
                                            </PopoverContent>
                                        </Popover>
                                    </TableCell>
                                    {client?.isVatRegistered && (
                                        <TableCell>
                                            <Select 
                                                value={allocations[tx.id]?.vatType || tx.vatType || ""} 
                                                onValueChange={(v) => setAllocations((p: any) => ({
                                                    ...p, 
                                                    [tx.id]: { 
                                                        ...(p[tx.id] || { value: '', type: 'account' }), 
                                                        vatType: v 
                                                    }
                                                }))}
                                            >
                                                <SelectTrigger className="h-8 text-[10px] w-full min-w-[120px]"><SelectValue placeholder="Select VAT..." /></SelectTrigger>
                                                <SelectContent>
                                                    {allVatTypes.map(vt => <SelectItem key={vt.name} value={vt.name}>{vt.label}</SelectItem>)}
                                                </SelectContent>
                                            </Select>
                                        </TableCell>
                                    )}
                                    <TableCell className="text-right font-mono">{formatPrice(tx.amount)}</TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex items-center justify-end gap-1">
                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-primary" onClick={() => handleAiResearch(tx)} disabled={isAiResearching === tx.id}>
                                                {isAiResearching === tx.id ? <Loader2 className="h-4 w-4 animate-spin"/> : <Sparkles className="h-4 w-4" />}
                                            </Button>
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4"/></Button></DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuItem onClick={() => {
                                                        const keyword = tx.cleanDescription?.split(/\s+/)[0] || tx.description.split(/\s+/)[0];
                                                        setTransactionDescriptionForRule(tx.description);
                                                        setRuleDefaultValues({ description: `Rule for: ${keyword}`, keywords: keyword, accountId: '', vatType: activeSubTab === 'income' ? 'standard_rated_sales' : 'standard_rated_purchases' });
                                                        setIsCreateOpen(true);
                                                    }}>Create Rule</DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </div>
                                    </TableCell>
                                </TableRow>
                             ))}
                        </TableBody>
                    </Table>
                </CardContent>
                <CardFooter className="flex justify-end p-4 border-t">
                    <Button onClick={handleSaveAllocations} disabled={isSaving || Object.keys(allocations).length === 0}>Save Allocations</Button>
                </CardFooter>
            </Card>
        </div>
    );
});
NewTransactionsTab.displayName = 'NewTransactionsTab';

const AIWorkflowTab = ({ client, bankAccountId, onAccountCreated }: { 
    client: User | null; 
    bankAccountId: string | null; 
    onAccountCreated: () => void;
}) => {
    const { toast } = useToast();
    const [groups, setGroups] = useState<TransactionGroup[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isRechecking, setIsRechecking] = useState(false);
    const [isReseting, setIsReseting] = useState(false);
    const [isQueryingClient, setIsQueryingClient] = useState(false);
    const [isCreateGeneralAccountOpen, setIsCreateGeneralAccountOpen] = useState(false);
    const [approvalSettings, setApprovalSettings] = useState<any>({});
    const [viewingGroup, setViewingGroup] = useState<TransactionGroup | null>(null);
    const [isMovingBack, setIsMovingBack] = useState<string | null>(null);
    const [isResearchingId, setIsResearchingId] = useState<string | null>(null);
    const [isQueryDialogOpen, setIsQueryDialogOpen] = useState(false);
    const [queryEmail, setQueryEmail] = useState('');
    
    // User lookup states
    const [isSearchingUser, setIsSearchingUser] = useState(false);
    const [foundUser, setFoundUser] = useState<User | null>(null);

    // REAL-TIME PROGRESS CALCULATION
    const [workflowTransactions, setWorkflowTransactions] = useState<ImportedTransaction[]>([]);
    
    useEffect(() => {
        if (!client?.uid || !bankAccountId) return;
        const transRef = collection(db, 'aiAccountantClients', client.uid, 'transactions');
        const q = query(transRef, where('bankAccountId', '==', bankAccountId), where('status', 'in', ['ai_processing', 'ai_review']));
        
        const unsubscribe = onSnapshot(q, (snap) => {
            const txs = snap.docs.map(d => ({ id: d.id, ...d.data() } as ImportedTransaction));
            setWorkflowTransactions(txs);
            
            // Build groups reactively
            const merchantGroups: { [key: string]: ImportedTransaction[] } = {};
            txs.forEach(tx => {
                const key = tx.merchantKey || tx.cleanDescription || 'UNKNOWN';
                if (!merchantGroups[key]) merchantGroups[key] = [];
                merchantGroups[key].push(tx);
            });

            const initialGroups: TransactionGroup[] = Object.entries(merchantGroups).map(([key, txs]) => ({
                merchantKey: key,
                transactions: txs,
                suggestion: txs[0].smartAllocationResult || null,
                status: txs[0].status === 'ai_processing' ? 'server_researching' : 'ready'
            }));

            setGroups(initialGroups);
            
            // Update settings for new groups
            setApprovalSettings((prev: any) => {
                const newSettings = { ...prev };
                initialGroups.forEach(g => { 
                    if (g.suggestion && !newSettings[g.merchantKey]) {
                        newSettings[g.merchantKey] = { accountId: g.suggestion.accountId, vatType: g.suggestion.vatType, createRule: true }; 
                    }
                });
                return newSettings;
            });
            
            setIsLoading(false);
        });

        return () => unsubscribe();
    }, [client, bankAccountId]);

    const progressStats = useMemo(() => {
        const total = workflowTransactions.length;
        const processed = workflowTransactions.filter(tx => tx.status === 'ai_review').length;
        const percentage = total > 0 ? (processed / total) * 100 : 0;
        return { total, processed, percentage };
    }, [workflowTransactions]);

    // Lookup user by email as accountant types
    useEffect(() => {
        const lookupUser = async () => {
            if (!queryEmail || !queryEmail.includes('@') || queryEmail.length < 5) {
                setFoundUser(null);
                return;
            }
            setIsSearchingUser(true);
            try {
                const q = query(collection(db, 'users'), where('email', '==', queryEmail.trim().toLowerCase()), limit(1));
                const snap = await getDocs(q);
                if (!snap.empty) {
                    setFoundUser({ ...snap.docs[0].data(), id: snap.docs[0].id } as User);
                } else {
                    setFoundUser(null);
                }
            } catch (e) {
                console.error("User lookup failed", e);
            } finally {
                setIsSearchingUser(false);
            }
        };
        const timer = setTimeout(lookupUser, 500);
        return () => clearTimeout(timer);
    }, [queryEmail]);

    const handleRecheckRules = async () => {
        if (!client?.uid) return;
        setIsRechecking(true);
        try {
            // Fetch fresh rules
            const clientRef = doc(db, 'aiAccountantClients', client.uid);
            const clientSnap = await getDoc(clientRef);
            const latestClient = clientSnap.data() as User;
            
            const rulesQuery = collection(db, "allocationRules");
            const rulesSnap = await getDocs(rulesQuery);
            const globalRulesList = rulesSnap.docs.map(d => ({ id: d.id, ...d.data() } as AllocationRule));
            const allRules = [...(latestClient.allocationRules || []), ...globalRulesList].sort((a, b) => (a.priority || 99) - (b.priority || 99));

            const updatedGroups = groups.map(group => {
                const description = group.transactions[0].description;
                const match = allRules.find(r => r.keywords.some(kw => description.toUpperCase().includes(kw.toUpperCase())));
                
                if (match) {
                    const keyword = match.keywords.find(kw => description.toUpperCase().includes(kw.toUpperCase()));
                    const newSuggestion: SmartAllocationResult = {
                        accountId: match.accountId,
                        vatType: client.isVatRegistered ? match.vatType : 'no_vat',
                        confidence: 100,
                        summary: `Matched latest existing allocation rule for ${keyword}.`,
                        ruleId: match.id,
                        matchedKeyword: keyword
                    };
                    
                    setApprovalSettings((prev: any) => ({
                        ...prev,
                        [group.merchantKey]: {
                            accountId: match.accountId,
                            vatType: newSuggestion.vatType,
                            createRule: false
                        }
                    }));

                    return {
                        ...group,
                        suggestion: newSuggestion,
                        status: 'ready' as const,
                        transactions: group.transactions.map(tx => ({...tx, allocationSource: 'rule' as const}))
                    };
                }
                return group;
            });

            setGroups(updatedGroups);
            toast({ title: "Rules Rechecked", description: "Groups updated based on the latest allocation rules." });
        } catch (e) {
            toast({ title: "Recheck Failed", variant: "destructive" });
        } finally {
            setIsRechecking(false);
        }
    };

    const handleResetAnalysis = async () => {
        if (!client?.uid || !bankAccountId) return;
        setIsReseting(true);
        try {
            const res = await resetAiAccountantAnalysis({ clientId: client.uid, bankAccountId });
            toast({ title: "Analysis Stopped", description: `${res.count} transactions have been reset to 'new'.` });
        } catch (e) {
            toast({ title: "Reset Failed", variant: "destructive" });
        } finally {
            setIsReseting(false);
        }
    };

    const handleQueryClient = async () => {
        if (!client?.uid || !queryEmail) return;
        setIsQueryingClient(true);
        try {
            const transRef = collection(db, 'aiAccountantClients', client.uid, 'transactions');
            // Include 'new' and 'ai_review' items in the count sent to the client
            const q = query(transRef, where('bankAccountId', '==', bankAccountId), where('status', 'in', ['new', 'ai_review']));
            const snapshot = await getDocs(q);
            
            if (snapshot.empty) {
                toast({ title: "No transactions to query", description: "All items are currently allocated." });
                return;
            }

            // LINK: If user exists, ensure they have shared access to this client profile
            if (foundUser && foundUser.id) {
                const clientDocRef = doc(db, 'aiAccountantClients', client.uid);
                await updateDoc(clientDocRef, {
                    sharedWith: arrayUnion(foundUser.id)
                });
            }

            await sendAllocationQueryEmail({ 
                clientId: client.uid, 
                clientEmail: queryEmail,
                unallocatedCount: snapshot.size 
            });
            toast({ title: "Query Sent", description: `The client has been notified at ${queryEmail}.` });
            setIsQueryDialogOpen(false);
        } catch (error) {
            toast({ title: "Failed to send query", variant: "destructive" });
        } finally {
            setIsQueryingClient(false);
        }
    };

    const handleApproveGroup = async (group: TransactionGroup) => {
        if (!client?.uid) return;
        const settings = approvalSettings[group.merchantKey];
        if (!settings) return;
        try {
            const batch = writeBatch(db);
            const transRef = collection(db, 'aiAccountantClients', client.uid, 'transactions');
            group.transactions.forEach(tx => {
                batch.update(doc(transRef, tx.id), {
                    status: 'reviewed',
                    allocatedTo: { value: settings.accountId, type: 'account' },
                    vatType: settings.vatType,
                    allocatedAt: serverTimestamp(),
                    allocationSource: tx.allocationSource || 'ai',
                    matchedRuleId: group.suggestion?.ruleId || deleteField(),
                    matchedKeyword: group.suggestion?.matchedKeyword || deleteField()
                });
            });
            
            updateGlobalMerchantDb({
                merchantKey: group.merchantKey,
                accountId: settings.accountId,
                vatType: settings.vatType
            });

            if (settings.createRule && group.transactions[0].allocationSource === 'ai') {
                batch.update(doc(db, 'aiAccountantClients', client.uid), { allocationRules: arrayUnion({ id: `rule_${Date.now()}`, description: `Auto-categorization for ${group.merchantKey}`, keywords: [group.merchantKey.toUpperCase()], accountId: settings.accountId, vatType: settings.vatType, type: 'hard', scope: 'client', priority: 99 }) });
            }
            await batch.commit();
            toast({ title: "Group Approved" });
            setGroups(prev => prev.filter(g => g.merchantKey !== group.merchantKey));
        } catch (e) { toast({ title: "Approval Failed", variant: "destructive" }); }
    };

    const handleApproveAllSmartMatches = async () => {
        if (!client?.uid) return;
        const smartGroups = groups.filter(g => g.suggestion && (g.transactions[0].allocationSource === 'history' || g.transactions[0].allocationSource === 'rule' || g.transactions[0].allocationSource === 'global_db'));
        if (smartGroups.length === 0) {
            toast({ title: "No Smart Matches found to approve." });
            return;
        }

        try {
            const batch = writeBatch(db);
            const transRef = collection(db, 'aiAccountantClients', client.uid, 'transactions');
            smartGroups.forEach(group => {
                const settings = approvalSettings[group.merchantKey];
                group.transactions.forEach(tx => {
                    batch.update(doc(transRef, tx.id), {
                        status: 'reviewed',
                        allocatedTo: { value: settings.accountId, type: 'account' },
                        vatType: settings.vatType,
                        allocatedAt: serverTimestamp(),
                        allocationSource: group.transactions[0].allocationSource,
                        matchedRuleId: group.suggestion?.ruleId || deleteField(),
                        matchedKeyword: group.suggestion?.matchedKeyword || deleteField()
                    });
                });
                
                updateGlobalMerchantDb({
                    merchantKey: group.merchantKey,
                    accountId: settings.accountId,
                    vatType: settings.vatType
                });
            });
            await batch.commit();
            toast({ title: "Approved all smart matches!" });
        } catch (e) { toast({ title: "Bulk Approval Failed", variant: "destructive" }); }
    }

    const handleMoveSingleTransactionToNew = async (txId: string) => {
        if (!client?.uid) return;
        setIsMovingBack(txId);
        try {
            await moveTransactionToNew({ clientId: client.uid, transactionId: txId });
            toast({ title: "Transaction Moved" });
        } catch (e) { toast({ title: "Failed to move", variant: "destructive" }); } finally { setIsMovingBack(null); }
    };

    const handleResearchWithAi = async (group: TransactionGroup) => {
        if (!client) return;
        setIsResearchingId(group.merchantKey);
        try {
            const res = await researchMerchantWithAi({
                clientId: client.uid,
                description: group.transactions[0].description,
                chartOfAccounts: JSON.stringify(client.chartOfAccounts || []),
                isVatRegistered: !!client.isVatRegistered
            });
            toast({ title: "Research Complete" });
        } catch (error) {
            console.error("Research Failed", error);
            toast({ title: "Research Failed", variant: "destructive" });
        } finally {
            setIsResearchingId(null);
        }
    }

    if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="animate-spin" /></div>;

    const smartMatchCount = groups.filter(g => g.suggestion && (g.transactions[0].allocationSource === 'history' || g.transactions[0].allocationSource === 'rule' || g.transactions[0].allocationSource === 'global_db')).length;
    const isCurrentlyProcessing = workflowTransactions.some(tx => tx.status === 'ai_processing');

    return (
        <div className="space-y-6 p-4">
            <CreateGeneralAccountDialog client={client} onAccountCreated={() => {}} open={isCreateGeneralAccountOpen} onOpenChange={setIsCreateGeneralAccountOpen} />
            <GroupTransactionsDialog open={!!viewingGroup} onOpenChange={(o) => !o && setViewingGroup(null)} group={viewingGroup} onMoveToNew={handleMoveSingleTransactionToNew} />
            
            <Dialog open={isQueryDialogOpen} onOpenChange={setIsQueryDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Query Client</DialogTitle>
                        <DialogDescription>
                            Send a secure chat link to the client to clarify these transactions.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4 space-y-4">
                        <div className="space-y-2">
                            <Label>Client Email</Label>
                            <div className="relative">
                                <Input 
                                    type="email" 
                                    value={queryEmail} 
                                    onChange={(e) => setQueryEmail(e.target.value)}
                                    placeholder="Enter client's email..."
                                    className={cn(foundUser && "border-green-500 focus-visible:ring-green-500")}
                                />
                                {isSearchingUser && <Loader2 className="absolute right-3 top-3 h-4 w-4 animate-spin text-muted-foreground" />}
                            </div>
                            {foundUser ? (
                                <div className="flex items-center gap-2 text-xs text-green-600 font-bold bg-green-50 p-2 rounded border border-green-100 animate-in fade-in">
                                    <CheckCircle2 className="h-3.5 w-3.5" />
                                    User found: {foundUser.name}. Sending will link their profile to this client.
                                </div>
                            ) : queryEmail && !isSearchingUser && queryEmail.includes('@') && (
                                <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 p-2 rounded border animate-in fade-in">
                                    <AlertCircle className="h-3.5 w-3.5" />
                                    No user found with this email. An invite will still be sent.
                                </div>
                            )}
                        </div>
                        <Alert>
                            <Info className="h-4 w-4" />
                            <AlertTitle>Conversational Chat</AlertTitle>
                            <AlertDescription className="text-xs">
                                The client will be asked about transactions one-by-one by Khai (AI Assistant) and their responses will automatically allocate the items.
                            </AlertDescription>
                        </Alert>
                    </div>
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setIsQueryDialogOpen(false)}>Cancel</Button>
                        <Button onClick={handleQueryClient} disabled={isQueryingClient || !queryEmail}>
                            {isQueryingClient ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Send className="mr-2 h-4 w-4" />}
                            Send Query Email
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {isCurrentlyProcessing && (
                <Card className="border-primary bg-primary/5 shadow-md overflow-hidden animate-in fade-in zoom-in-95 duration-300">
                    <CardHeader className="py-3 px-4 border-b border-primary/10">
                        <div className="flex justify-between items-center">
                            <CardTitle className="text-sm font-bold text-primary flex items-center gap-2">
                                <RotateCw className="h-4 w-4 animate-spin" />
                                Smart Identification in Progress...
                            </CardTitle>
                            <span className="text-xs font-bold text-primary tabular-nums">
                                {progressStats.processed} / {progressStats.total} items
                            </span>
                        </div>
                    </CardHeader>
                    <CardContent className="p-4 space-y-2">
                        <Progress value={progressStats.percentage} className="h-2" />
                        <p className="text-[10px] text-muted-foreground italic">
                            Currently cleaning descriptions and matching against rules, history, and global smart database. This is a deterministic app-based process.
                        </p>
                    </CardContent>
                </Card>
            )}

            <div className="flex justify-between items-center bg-muted/20 p-4 rounded-lg border border-dashed gap-4 flex-wrap">
                <div className="space-y-1">
                    <h3 className="font-bold text-sm">Review Identifiable Merchants</h3>
                    <p className="text-xs text-muted-foreground">Approve matched transactions or research unknown ones with AI.</p>
                </div>
                <div className="flex gap-2 flex-wrap">
                    <Button variant="outline" onClick={() => setIsQueryDialogOpen(true)} disabled={groups.length === 0}>
                        <MessageSquareQuote className="mr-2 h-4 w-4" />
                        Query Client
                    </Button>
                    <Button variant="outline" onClick={handleRecheckRules} disabled={isRechecking || groups.length === 0}>
                        {isRechecking ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <RotateCcw className="mr-2 h-4 w-4" />}
                        Recheck Rules
                    </Button>
                    {isCurrentlyProcessing && (
                        <Button variant="destructive" onClick={handleResetAnalysis} disabled={isReseting}>
                            {isReseting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <StopCircle className="mr-2 h-4 w-4" />}
                            Stop & Reset
                        </Button>
                    )}
                    <Button onClick={handleApproveAllSmartMatches} disabled={smartMatchCount === 0} className="bg-green-600 hover:bg-green-700 text-white">
                        <CheckCheck className="mr-2 h-4 w-4" /> Approve {smartMatchCount} Smart Matches
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-4">
                {groups.map((group) => {
                    const firstTx = group.transactions[0];
                    const sourceLabel = firstTx.allocationSource === 'history' ? 'HISTORY MATCH' : 
                                      firstTx.allocationSource === 'rule' ? 'RULE MATCH' :
                                      firstTx.allocationSource === 'global_db' ? 'SMART DB MATCH' : null;
                    
                    return (
                    <Card key={group.merchantKey} className={cn("overflow-hidden border shadow-sm", group.status === 'server_researching' && "opacity-75 border-dashed")}>
                        <div className="grid grid-cols-1 md:grid-cols-12">
                            <div className="md:col-span-3 p-4 border-r border-b md:border-b-0 bg-muted/10">
                                <div className="space-y-4">
                                    <div>
                                        <Badge variant="outline" className="text-[10px] font-bold uppercase tracking-wider mb-1">MERCHANT</Badge>
                                        <h4 className="text-xl font-extrabold truncate uppercase leading-tight">{group.merchantKey}</h4>
                                        <Button 
                                            variant="link" 
                                            className="p-0 h-auto text-sm text-primary font-medium hover:no-underline"
                                            onClick={() => setViewingGroup(group)}
                                        >
                                            {group.transactions.length} transactions
                                        </Button>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-[10px] font-bold uppercase text-muted-foreground">EXAMPLE REFERENCE</p>
                                        <p className="text-[11px] italic text-muted-foreground leading-snug break-words font-medium">
                                            "{firstTx.description}"
                                        </p>
                                    </div>
                                    {group.status === 'server_researching' && (
                                        <div className="flex items-center gap-2 text-xs text-primary font-bold">
                                            <Loader2 className="h-3 w-3 animate-spin" /> 
                                            Identifying...
                                        </div>
                                    )}
                                </div>
                            </div>
                            
                            <div className="md:col-span-3 p-4 border-r space-y-4">
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest">ALLOCATE TO</Label>
                                    <Select value={approvalSettings[group.merchantKey]?.accountId || ''} onValueChange={(v) => setApprovalSettings((p: any) => ({...p, [group.merchantKey]: {...p[group.merchantKey], accountId: v}}))}>
                                        <SelectTrigger className="h-10 text-sm"><SelectValue placeholder="Select account..." /></SelectTrigger>
                                        <SelectContent>{client?.chartOfAccounts?.map(acc => <SelectItem key={acc.id} value={acc.id}>{acc.description}</SelectItem>)}</SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest">VAT</Label>
                                    <Select value={approvalSettings[group.merchantKey]?.vatType || 'no_vat'} onValueChange={(v) => setApprovalSettings((p: any) => ({...p, [group.merchantKey]: {...p[group.merchantKey], vatType: v}}))}>
                                        <SelectTrigger className="h-10 text-sm"><SelectValue /></SelectTrigger>
                                        <SelectContent>{allVatTypes.map(vt => <SelectItem key={vt.name} value={vt.name}>{vt.label}</SelectItem>)}</SelectContent>
                                    </Select>
                                </div>
                            </div>

                            <div className="md:col-span-6 p-4 flex flex-col justify-between">
                                <div className="p-4 rounded-xl border border-primary/10 bg-primary/5 flex-grow mb-4">
                                    <div className="mb-3 flex justify-between items-center">
                                        {group.suggestion ? (
                                            <Badge className={cn(
                                                "text-[10px] font-bold py-1 px-3 rounded-full",
                                                group.suggestion.confidence > 80 
                                                ? "bg-green-600 hover:bg-green-600 text-white" 
                                                : "bg-yellow-500 hover:bg-yellow-500 text-white"
                                            )}>
                                                {sourceLabel || `${group.suggestion.confidence}% Match Confidence`}
                                            </Badge>
                                        ) : (
                                            <Badge variant="secondary" className="text-[10px] font-bold py-1 px-3 rounded-full">
                                                No Match Found
                                            </Badge>
                                        )}
                                        {!group.suggestion && (
                                            <Button variant="ghost" size="sm" className="h-7 text-xs text-primary font-bold" onClick={() => handleResearchWithAi(group)} disabled={isResearchingId === group.merchantKey}>
                                                {isResearchingId === group.merchantKey ? <Loader2 className="mr-1 h-3 w-3 animate-spin"/> : <Sparkles className="mr-1 h-3 w-3"/>}
                                                Research with AI
                                            </Button>
                                        )}
                                    </div>
                                    <p className="text-xs italic text-muted-foreground leading-relaxed">
                                        {group.suggestion ? group.suggestion.summary : "No historical matches or active rules found for this merchant. Use the 'Research with AI' button to perform a deep analysis across our knowledge bases."}
                                    </p>
                                </div>
                                
                                <div className="flex items-center justify-between mt-auto pt-2">
                                    <div className="flex items-center space-x-2">
                                        <Checkbox 
                                            id={`rule-${group.merchantKey}`} 
                                            className="rounded border-muted-foreground/30 data-[state=checked]:bg-primary"
                                            checked={approvalSettings[group.merchantKey]?.createRule} 
                                            onCheckedChange={(v) => setApprovalSettings((p: any) => ({...p, [group.merchantKey]: {...p[group.merchantKey], createRule: !!v}}))} 
                                            disabled={!!sourceLabel}
                                        />
                                        <Label htmlFor={`rule-${group.merchantKey}`} className="text-xs font-bold text-muted-foreground cursor-pointer">Create Client Rule</Label>
                                    </div>
                                    <Button 
                                        className="bg-primary hover:bg-primary/90 text-white font-bold h-10 px-6 rounded-lg shadow-md" 
                                        onClick={() => handleApproveGroup(group)} 
                                        disabled={!approvalSettings[group.merchantKey]?.accountId}
                                    >
                                        <CheckCircle2 className="mr-2 h-4 w-4" /> Approve Group
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </Card>
                )})}
            </div>
        </div>
    );
};

const ReviewedTab = ({ client, bankAccountId, customers, globalRules, onAccountCreated }: { 
    client: User | null; 
    bankAccountId: string | null; 
    customers: ClientCustomer[]; 
    globalRules: AllocationRule[];
    onAccountCreated: () => void; 
}) => {
    const { toast } = useToast();
    const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
    const [activeSubTab, setActiveSubTab] = useState<'expenses' | 'income'>('expenses');
    const [selectedGlAccountId, setSelectedGlAccountId] = useState<string>("all");
    const [usedAccountIds, setUsedAccountIds] = useState<Set<string>>(new Set());
    const [isMovingBack, setIsMovingBack] = useState<string | null>(null);
    const [editedAllocations, setEditedAllocations] = useState<any>({});
    const [isSaving, setIsSaving] = useState(false);
    const [viewingRuleData, setViewingRuleData] = useState<{ rule: AllocationRule, keyword?: string } | null>(null);

    const uniqueChartOfAccounts = useMemo(() => [...(client?.chartOfAccounts || [])].sort((a, b) => a.description.localeCompare(b.description)), [client]);
    const allAvailableRules = useMemo(() => [...(client?.allocationRules || []), ...globalRules], [client?.allocationRules, globalRules]);

    useEffect(() => {
        if (!client?.uid || !bankAccountId) return;
        const transRef = collection(db, 'aiAccountantClients', client.uid, 'transactions');
        const q = query(transRef, 
            where('bankAccountId', '==', bankAccountId), 
            where('status', 'in', ['reviewed', 'allocated']),
            where('isExpense', '==', activeSubTab === 'expenses')
        );
        
        const unsubscribe = onSnapshot(q, (snap) => {
            const ids = new Set<string>();
            snap.docs.forEach(doc => {
                const data = doc.data() as ImportedTransaction;
                if (data.allocatedTo?.value) ids.add(data.allocatedTo.value);
            });
            setUsedAccountIds(ids);
        });
        return () => unsubscribe();
    }, [client?.uid, bankAccountId, activeSubTab]);

    const baseQuery = useMemo(() => {
        if (!client?.uid || !bankAccountId) return null;
        let constraints: any[] = [
            where('bankAccountId', '==', bankAccountId), 
            where('status', 'in', ['reviewed', 'allocated']), 
            where('isExpense', '==', activeSubTab === 'expenses'), 
            orderBy('date', 'desc')
        ];
        
        if (selectedGlAccountId !== "all") {
            constraints.push(where('allocatedTo.value', '==', selectedGlAccountId));
        }

        if (dateRange?.from) constraints.push(where('date', '>=', dateRange.from.toISOString()));
        if (dateRange?.to) constraints.push(where('date', '<=', dateRange.to.toISOString()));
        
        return query(collection(db, 'aiAccountantClients', client.uid, 'transactions'), ...constraints);
    }, [client?.uid, bankAccountId, activeSubTab, dateRange, selectedGlAccountId]);

    const { documents: transactions, isLoading, goToNextPage, goToPreviousPage, canGoNext, canGoPrev, currentPage, refetch } = usePaginatedFirestore<ImportedTransaction>({ baseQuery, pageSize: PAGE_SIZE });

    const getAllocationName = (allocatedTo: any) => {
        if (!allocatedTo) return 'Unallocated';
        if (allocatedTo.type === 'customer') {
            return customers.find(c => c.id === allocatedTo.value)?.name || allocatedTo.value;
        }
        return uniqueChartOfAccounts.find(a => a.id === allocatedTo.value)?.description || allocatedTo.value;
    };

    const handleResetToNew = async (txId: string) => {
        if (!client?.uid) return;
        setIsMovingBack(txId);
        try {
            await moveTransactionToNew({ clientId: client.uid, transactionId: txId });
            toast({ title: "Allocation Cleared", description: "Transaction moved back to 'New' tab." });
            refetch();
        } catch (e) { 
            toast({ title: "Failed to reset", variant: "destructive" }); 
        } finally { 
            setIsMovingBack(null); 
        }
    };

    const handleSaveEditedAllocations = async () => {
        if (!client?.uid || Object.keys(editedAllocations).length === 0) return;
        setIsSaving(true);
        try {
            const batch = writeBatch(db);
            const txCollection = collection(db, 'aiAccountantClients', client.uid, 'transactions');
            
            Object.entries(editedAllocations).forEach(([txId, alloc]: [string, any]) => {
                const tx = transactions.find(t => t.id === txId);
                if (!tx) return;
                
                batch.update(doc(txCollection, txId), {
                    allocatedTo: alloc.allocatedTo || tx.allocatedTo,
                    vatType: alloc.vatType || tx.vatType || 'no_vat',
                    allocatedAt: serverTimestamp(),
                    allocationSource: 'manual'
                });
            });
            
            await batch.commit();
            toast({ title: "Changes Saved", description: `${Object.keys(editedAllocations).length} transactions updated.` });
            setEditedAllocations({});
            refetch();
        } catch (e) {
            console.error(e);
            toast({ title: "Error Saving", variant: "destructive" });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="space-y-4">
            <RuleViewDialog 
                open={!!viewingRuleData} 
                onOpenChange={(open) => !open && setViewingRuleData(null)}
                rule={viewingRuleData?.rule || null}
                matchedKeyword={viewingRuleData?.keyword}
            />
            <Card>
                <CardHeader className="p-0 border-b">
                    <Tabs value={activeSubTab} onValueChange={(v: any) => { setActiveSubTab(v); setSelectedGlAccountId("all"); setEditedAllocations({}); }} className="w-full">
                        <TabsList className="grid w-full grid-cols-2 rounded-none"><TabsTrigger value="expenses">Reviewed Expenses</TabsTrigger><TabsTrigger value="income">Reviewed Income</TabsTrigger></TabsList>
                    </Tabs>
                    <div className="p-4 flex flex-col md:flex-row items-center justify-between gap-4">
                        <div className="flex items-center gap-2 w-full md:w-auto">
                            <Select value={selectedGlAccountId} onValueChange={setSelectedGlAccountId}>
                                <SelectTrigger className="w-full md:w-[240px]">
                                    <SelectValue placeholder="Filter by Account..." />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Accounts ({usedAccountIds.size})</SelectItem>
                                    {uniqueChartOfAccounts.filter(acc => usedAccountIds.has(acc.id)).map(acc => (
                                        <SelectItem key={acc.id} value={acc.id}>{acc.description}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <div className="flex items-center gap-2 ml-4">
                                <Button variant="outline" size="sm" onClick={goToPreviousPage} disabled={!canGoPrev}><ChevronLeft className="h-4 w-4" /></Button>
                                <span className="text-xs font-medium min-w-[60px] text-center">Page {currentPage}</span>
                                <Button variant="outline" size="sm" onClick={goToNextPage} disabled={!canGoNext}><ChevronRight className="h-4 w-4" /></Button>
                            </div>
                        </div>
                        <DateRangePicker onDateChange={setDateRange} />
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Date</TableHead>
                                <TableHead>Description</TableHead>
                                <TableHead>Allocated To</TableHead>
                                <TableHead>Source</TableHead>
                                {client?.isVatRegistered && <TableHead>VAT Type</TableHead>}
                                <TableHead className="text-right">Amount</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? <TableRow><TableCell colSpan={client?.isVatRegistered ? 7 : 6} className="text-center h-24"><Loader2 className="animate-spin mx-auto"/></TableCell></TableRow> :
                            transactions.map(tx => {
                                const edited = editedAllocations[tx.id];
                                const currentAlloc = edited?.allocatedTo || tx.allocatedTo;
                                const currentVat = edited?.vatType || tx.vatType || "no_vat";

                                return (
                                <TableRow key={tx.id} className={cn(edited && "bg-primary/5")}>
                                    <TableCell>{new Date(tx.date).toLocaleDateString('en-GB')}</TableCell>
                                    <TableCell>
                                        <div className="flex flex-col">
                                            <span>{tx.cleanDescription || tx.description}</span>
                                            {tx.cleanDescription && <span className="text-[9px] text-muted-foreground italic">Raw: {tx.description}</span>}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <Popover>
                                            <PopoverTrigger asChild>
                                                <Button variant="outline" className={cn("h-8 text-[11px] w-full justify-start overflow-hidden", edited?.allocatedTo && "border-primary")}>
                                                    <span className="truncate">
                                                        {getAllocationName(currentAlloc)}
                                                    </span>
                                                </Button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-[300px] p-0" align="start">
                                                <Command className="w-full">
                                                    <CommandInput placeholder="Search accounts..." />
                                                    <CommandList>
                                                        <CommandEmpty>No results found.</CommandEmpty>
                                                        <CommandGroup heading="GL Accounts">
                                                            {client?.chartOfAccounts?.map(a => (
                                                                <CommandItem 
                                                                    key={a.id} 
                                                                    value={a.description}
                                                                    onSelect={() => setEditedAllocations((p: any) => ({
                                                                        ...p, 
                                                                        [tx.id]: { 
                                                                            ...(p[tx.id] || { vatType: tx.vatType }), 
                                                                            allocatedTo: { value: a.id, type: 'account' }
                                                                        }
                                                                    }))}
                                                                    className="p-2 cursor-pointer hover:bg-muted"
                                                                >
                                                                    {a.description}
                                                                </CommandItem>
                                                            ))}
                                                        </CommandGroup>
                                                        {activeSubTab === 'income' && (
                                                            <CommandGroup heading="Customers">
                                                                {customers.map(c => (
                                                                    <CommandItem 
                                                                        key={c.id} 
                                                                        value={c.name}
                                                                        onSelect={() => setEditedAllocations((p: any) => ({
                                                                            ...p, 
                                                                            [tx.id]: { 
                                                                                allocatedTo: { value: c.id, type: 'customer' },
                                                                                vatType: 'no_vat' 
                                                                            }
                                                                        }))}
                                                                        className="p-2 cursor-pointer hover:bg-muted"
                                                                    >
                                                                        {c.name}
                                                                    </CommandItem>
                                                                ))}
                                                            </CommandGroup>
                                                        )}
                                                    </CommandList>
                                                </Command>
                                            </PopoverContent>
                                        </Popover>
                                    </TableCell>
                                    <TableCell>
                                        {tx.allocationSource === 'rule' ? (
                                            <Badge 
                                                variant="outline" 
                                                className="text-[10px] gap-1 cursor-pointer hover:bg-muted"
                                                onClick={() => {
                                                    const rule = allAvailableRules.find(r => r.id === tx.matchedRuleId);
                                                    if (rule) setViewingRuleData({ rule, keyword: tx.matchedKeyword });
                                                }}
                                            >
                                                <BookOpen className="h-3 w-3"/> Rule
                                            </Badge>
                                        ) : tx.allocationSource === 'ai' ? (
                                            <Badge variant="secondary" className="text-[10px] gap-1"><Sparkles className="h-3 w-3"/> AI</Badge>
                                        ) : tx.allocationSource === 'history' ? (
                                            <Badge variant="outline" className="text-[10px] gap-1 border-primary/30 text-primary"><History className="h-3 w-3"/> History</Badge>
                                        ) : tx.allocationSource === 'global_db' ? (
                                            <Badge variant="outline" className="text-[10px] gap-1 border-green-500/30 text-green-600"><RotateCw className="h-3 w-3"/> Smart DB</Badge>
                                        ) : (
                                            <Badge variant="ghost" className="text-[10px] opacity-50">Manual</Badge>
                                        )}
                                    </TableCell>
                                    {client?.isVatRegistered && (
                                        <TableCell>
                                            <Select 
                                                value={currentVat} 
                                                onValueChange={(v) => setEditedAllocations((p: any) => ({
                                                    ...p, 
                                                    [tx.id]: { 
                                                        ...(p[tx.id] || { allocatedTo: tx.allocatedTo }), 
                                                        vatType: v 
                                                    }
                                                }))}
                                            >
                                                <SelectTrigger className={cn("h-8 text-[10px] w-full min-w-[120px]", edited?.vatType && "border-primary")}><SelectValue placeholder="Select VAT..." /></SelectTrigger>
                                                <SelectContent>
                                                    {allVatTypes.map(vt => <SelectItem key={vt.name} value={vt.name}>{vt.label}</SelectItem>)}
                                                </SelectContent>
                                            </Select>
                                        </TableCell>
                                    )}
                                    <TableCell className="text-right font-mono">{formatPrice(tx.amount)}</TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex items-center justify-end gap-1">
                                            {edited && (
                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={() => {
                                                    const newEdited = { ...editedAllocations };
                                                    delete newEdited[tx.id];
                                                    setEditedAllocations(newEdited);
                                                }}>
                                                    <X className="h-4 w-4" />
                                                </Button>
                                            )}
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4"/></Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuItem onClick={() => handleResetToNew(tx.id)} className="text-destructive">
                                                        <Undo2 className="mr-2 h-4 w-4" /> Move to New
                                                    </DropdownMenuItem>
                                                    <DropdownMenuSeparator />
                                                    <DropdownMenuItem onClick={() => {
                                                        const account = uniqueChartOfAccounts.find(a => a.id === tx.allocatedTo?.value);
                                                        if (account) {
                                                            window.location.href = `/admin/ai-accountant/${client?.uid}/reports/general-ledger?accountId=${account.id}`;
                                                        }
                                                    }}>
                                                        <ArrowRightLeft className="mr-2 h-4 w-4" /> View Ledger
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            )})}
                        </TableBody>
                    </Table>
                </CardContent>
                <CardFooter className="flex justify-end p-4 border-t">
                    {Object.keys(editedAllocations).length > 0 && (
                        <div className="flex gap-2">
                            <Button variant="ghost" size="sm" onClick={() => setEditedAllocations({})}>Cancel Edits</Button>
                            <Button size="sm" onClick={handleSaveEditedAllocations} disabled={isSaving}>
                                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Save {Object.keys(editedAllocations).length} Changes
                            </Button>
                        </div>
                    )}
                </CardFooter>
            </Card>
        </div>
    );
};

export default function BankTransactionsPage() {
    const params = useParams();
    const accountIdFromUrl = useSearchParams().get('accountId');
    const [client, setClient] = useState<User | null>(null);
    const [accountId, setAccountId] = useState<string | null>(accountIdFromUrl);
    const [allAccountTransactions, setAllAccountTransactions] = useState<any[]>([]);
    const [globalRules, setGlobalRules] = useState<AllocationRule[]>([]);
    const [activeTab, setActiveTab] = useState('new-transactions');
    const [customers, setCustomers] = useState<ClientCustomer[]>([]);
    const [isEditAccountOpen, setIsEditAccountOpen] = useState(false);
    const [isCreateAccountOpen, setIsCreateAccountOpen] = useState(false);
    const [isClearAccountAlertOpen, setIsClearAccountAlertOpen] = useState(false);
    const { toast } = useToast();

    const fetchClientData = useCallback(async () => {
        if (!params.clientId) return;
        const clientSnap = await getDoc(doc(db, 'aiAccountantClients', params.clientId as string));
        if (clientSnap.exists()) {
            const data = clientSnap.data() as User;
            setClient(data);
            const bankAccounts = data.chartOfAccounts?.filter(acc => acc.accountNumber.startsWith('8400-'));
            if(!accountId && bankAccounts?.[0]) setAccountId(bankAccounts[0].id);
        }
    }, [params.clientId, accountId]);

    const fetchGlobalRules = useCallback(async () => {
        const rulesSnap = await getDocs(collection(db, 'allocationRules'));
        setGlobalRules(rulesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as AllocationRule)));
    }, []);

    const fetchCustomers = useCallback(async () => {
        if (!params.clientId) return;
        const custSnap = await getDocs(collection(db, `aiAccountantClients/${params.clientId}/customers`));
        setCustomers(custSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as ClientCustomer)));
    }, [params.clientId]);

    useEffect(() => { fetchClientData(); fetchGlobalRules(); fetchCustomers(); }, [fetchClientData, fetchGlobalRules, fetchCustomers]);
    
    useEffect(() => {
        if (!params.clientId || !accountId) return;
        return onSnapshot(query(collection(db, 'aiAccountantClients', params.clientId as string, 'transactions'), where('bankAccountId', '==', accountId)), (snap) => {
            setAllAccountTransactions(snap.docs.map(d => ({id: d.id, ...d.data()})));
        });
    }, [params.clientId, accountId]);
    
    const stats = useMemo(() => {
        const balance = allAccountTransactions.reduce((s, t) => s + t.amount, 0);
        const unallocatedCount = allAccountTransactions.filter(t => t.status === 'new').length;
        return { balance, unallocatedCount };
    }, [allAccountTransactions]);

    const handleClearAccount = async () => {
        if (!params.clientId || !accountId) return;
        toast({ title: "Cleaning account...", description: "Please wait." });
        try {
            const transRef = collection(db, 'aiAccountantClients', params.clientId as string, 'transactions');
            const q = query(transRef, where('bankAccountId', '==', accountId));
            const snap = await getDocs(q);
            
            if (snap.empty) {
                toast({ title: "Account is already empty" });
                setIsClearAccountAlertOpen(false);
                return;
            }

            // Chunk deletions to stay within the 500-op limit
            const docs = snap.docs;
            for (let i = 0; i < docs.length; i += 500) {
                const batch = writeBatch(db);
                const chunk = docs.slice(i, i + 500);
                chunk.forEach(d => batch.delete(d.ref));
                await batch.commit();
            }

            toast({ title: "Account Cleared", description: `Successfully deleted ${snap.size} transactions.` });
            setIsClearAccountAlertOpen(false);
        } catch (e: any) {
            console.error("Clear account error:", e);
            toast({ 
                title: "Clear Failed", 
                description: e.message || "An unexpected error occurred while deleting transactions.",
                variant: "destructive" 
            });
        }
    };

    const handleEditAccount = async (newName: string) => {
        if (!client || !accountId) return;
        try {
            const updatedCOA = (client.chartOfAccounts || []).map(acc => acc.id === accountId ? { ...acc, description: newName } : acc);
            await updateDoc(doc(db, 'aiAccountantClients', client.uid), { chartOfAccounts: updatedCOA });
            toast({ title: "Account Updated" });
            fetchClientData();
            setIsEditAccountOpen(false);
        } catch (e) {
            toast({ title: "Error", variant: "destructive" });
        }
    };

    if (!client) return <div className="text-center mt-8"><Loader2 className="h-8 w-8 animate-spin" /></div>;
    
    const bankAccounts = client.chartOfAccounts?.filter(acc => acc.accountNumber.startsWith('8400-')) || [];
    const selectedAccount = bankAccounts.find(a => a.id === accountId);
    
    return (
        <div className="space-y-4">
            <CreateGeneralAccountDialog client={client} onAccountCreated={fetchClientData} open={isCreateAccountOpen} onOpenChange={setIsCreateAccountOpen} />
            
            <Dialog open={isEditAccountOpen} onOpenChange={setIsEditAccountOpen}>
                <DialogContent>
                    <DialogHeader><DialogTitle>Edit Bank Account Name</DialogTitle></DialogHeader>
                    <div className="py-4">
                        <Input id="new-account-name" defaultValue={selectedAccount?.description} placeholder="e.g. FNB Business Account" />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsEditAccountOpen(false)}>Cancel</Button>
                        <Button onClick={() => {
                            const val = (document.getElementById('new-account-name') as HTMLInputElement).value;
                            handleEditAccount(val);
                        }}>Save Changes</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <AlertDialog open={isClearAccountAlertOpen} onOpenChange={setIsClearAccountAlertOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will permanently delete all transactions for the selected bank account ({selectedAccount?.description}). This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleClearAccount} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Yes, Clear Account</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <div className="md:flex items-start justify-between">
                <div className="flex flex-col gap-2">
                     <Select onValueChange={setAccountId} value={accountId || ''}>
                        <SelectTrigger className="w-[280px]"><SelectValue placeholder="Select a bank account" /></SelectTrigger>
                        <SelectContent>{bankAccounts.map(acc => <SelectItem key={acc.id} value={acc.id}>{acc.description}</SelectItem>)}</SelectContent>
                    </Select>
                     <div className="flex gap-4 text-sm">
                        <div><span className="text-muted-foreground">Balance: </span><span className="font-semibold">{formatPrice(stats.balance)}</span></div>
                        <div><span className="text-muted-foreground">Unallocated: </span><span className="font-semibold">{stats.unallocatedCount}</span></div>
                    </div>
                </div>
                <div className="flex items-center gap-2 mt-4 md:mt-0">
                    <Button variant="outline" size="sm" onClick={() => fetchClientData()}>
                        <RotateCcw className="mr-2 h-4 w-4" /> Refresh
                    </Button>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90 border-none font-bold">
                                <Settings className="mr-2 h-4 w-4" /> Manage
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setIsCreateAccountOpen(true)}>Create New Bank Account</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setIsEditAccountOpen(true)}>Edit Selected Account</DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => setIsClearAccountAlertOpen(true)} className="text-destructive">Clear Bank Account</DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>
            <div className="border rounded-lg mt-4">
                 <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                    <TabsList className="grid w-full grid-cols-3 rounded-t-lg rounded-b-none h-auto">
                        <TabsTrigger value="new-transactions">New Transactions</TabsTrigger>
                        <TabsTrigger value="ai-workflow">Smart Match Queue</TabsTrigger>
                        <TabsTrigger value="reviewed">Reviewed</TabsTrigger>
                    </TabsList>
                    <TabsContent value="new-transactions" className="p-0">
                        <NewTransactionsTab client={client} bankAccountId={accountId} currentBalance={stats.balance} globalRules={globalRules} onAccountCreated={fetchClientData} setActiveTab={setActiveTab} customers={customers} />
                    </TabsContent>
                    <TabsContent value="ai-workflow" className="p-0">
                        <AIWorkflowTab client={client} bankAccountId={accountId} onAccountCreated={fetchClientData} />
                    </TabsContent>
                    <TabsContent value="reviewed" className="p-0">
                        <ReviewedTab client={client} bankAccountId={accountId} customers={customers} globalRules={globalRules} onAccountCreated={fetchClientData} />
                    </TabsContent>
                </Tabs>
            </div>
        </div>
    );
}
