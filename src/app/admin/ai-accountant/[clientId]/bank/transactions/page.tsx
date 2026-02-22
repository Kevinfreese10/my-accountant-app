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
import { FileUp, Loader2, PlusCircle, Search, Settings, Trash2, Edit, ArrowRightLeft, BookOpen, Sparkles, ArrowUpDown, ChevronLeft, ChevronRight, CheckCheck, ChevronsUpDown, MoreHorizontal, RotateCcw, AlertTriangle, Download, BrainCircuit, Play, CheckCircle2, Clock, Undo2 } from 'lucide-react';
import Papa from 'papaparse';
import { ImportedTransaction, ChartOfAccount, User, VatType, AllocatedTransaction, AllocationRule, ClientCustomer, Invoice, AIAllocationResult } from '@/lib/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { getFirestore, doc, updateDoc, arrayUnion, getDoc, collection, getDocs, query, orderBy, where, writeBatch, onSnapshot, Timestamp, deleteField, addDoc, limit, serverTimestamp } from 'firebase/firestore';
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
import { Command, CommandEmpty, CommandInput, CommandList, CommandGroup, CommandSeparator, CommandItem } from '@/components/ui/command';
import { ScrollArea } from '@/components/ui/scroll-area';
import { format, parse } from 'date-fns';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { DateRange } from 'react-day-picker';
import { Badge } from '@/components/ui/badge';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { Button } from '@/components/ui/button';
import { useParams, useSearchParams } from 'next/navigation';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { suggestTransactionAllocation } from '@/ai/flows/suggest-transaction-allocation';
import { useAuth } from '@/contexts/AuthContext';
import { runAiAccountantAnalysis, prepareAiAccountantAnalysis, moveTransactionToNew } from '@/app/actions';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

const db = getFirestore(firebaseApp);
const PAGE_SIZE = 50;

const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-GB', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(price);
};

// #region Helper Components

function ImportDialog({ client, bankAccountId, currentBalance, onImportComplete, globalRules }: { client: User | null, bankAccountId: string, currentBalance: number, onImportComplete: () => void, globalRules: AllocationRule[] }) {
    const [isOpen, setIsOpen] = useState(false);
    const [file, setFile] = useState<File | null>(null);
    const [parsedTransactions, setParsedTransactions] = useState<any[]>([]);
    const [isParsing, setIsParsing] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const { toast } = useToast();

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
            const batch = writeBatch(db);
            parsedTransactions.forEach((row) => {
                let parsedDate = parse(row.Date, 'dd/MM/yyyy', new Date());
                if (isNaN(parsedDate.getTime())) parsedDate = new Date(row.Date);
                if (isNaN(parsedDate.getTime())) return;

                const newRef = doc(collection(db, 'aiAccountantClients', client.uid!, 'transactions'));
                batch.set(newRef, {
                    clientId: client.uid!,
                    date: parsedDate.toISOString(),
                    reference: `CSV-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                    description: row.Description,
                    amount: row.Amount,
                    isExpense: row.Amount < 0,
                    bankAccountId: bankAccountId,
                    status: 'new'
                });
            });

            await batch.commit();
            toast({ title: "Import Successful", description: `${parsedTransactions.length} transactions imported.`});
            onImportComplete();
            setIsOpen(false);
        } catch (error) {
            console.error("Import error", error);
            toast({ title: "Import Failed", variant: "destructive"});
        } finally {
            setIsUploading(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild><Button variant="outline"><FileUp className="mr-2 h-4 w-4" /> Import CSV</Button></DialogTrigger>
            <DialogContent className="sm:max-w-xl">
                <DialogHeader><DialogTitle>Import Bank Statement</DialogTitle></DialogHeader>
                <div className="space-y-4 py-4">
                     <Input id="statement-file" type="file" accept=".csv" onChange={handleFileChange} />
                     {isParsing && <p className="text-sm text-muted-foreground flex items-center"><Loader2 className="mr-2 animate-spin"/> Parsing...</p>}
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
            toast({ title: 'Error', variant: 'destructive' });
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

// #endregion

const NewTransactionsTab = React.forwardRef<any, any>(({ client, bankAccountId, globalRules, onAccountCreated, setActiveTab, currentBalance }, ref) => {
    const { user } = useAuth();
    const { toast } = useToast();
    const [activeSubTab, setActiveSubTab] = useState<'expenses' | 'income'>('expenses');
    const [allocations, setAllocations] = useState<any>({});
    const [isCreateRuleOpen, setIsCreateRuleOpen] = useState(false);
    const [isCreateGeneralAccountOpen, setIsCreateGeneralAccountOpen] = useState(false);
    const [ruleDefaultValues, setRuleDefaultValues] = useState<any>({});
    const [isSaving, setIsSaving] = useState(false);

    const baseQuery = useMemo(() => {
        if (!client?.uid || !bankAccountId) return null;
        return query(collection(db, 'aiAccountantClients', client.uid, 'transactions'), 
            where('bankAccountId', '==', bankAccountId),
            where('status', '==', 'new'),
            where('isExpense', '==', activeSubTab === 'expenses'),
            orderBy('description', 'asc')
        );
    }, [client?.uid, bankAccountId, activeSubTab]);

    const { documents: transactions, isLoading, refetch, goToNextPage, goToPreviousPage, canGoNext, canGoPrev, currentPage } = usePaginatedFirestore<ImportedTransaction>({ baseQuery, pageSize: PAGE_SIZE });

    React.useImperativeHandle(ref, () => ({ refetch }));

    const handleSaveAllocations = async () => {
        if (!client?.uid || Object.keys(allocations).length === 0) return;
        setIsSaving(true);
        try {
            const batch = writeBatch(db);
            Object.entries(allocations).forEach(([txId, alloc]: [string, any]) => {
                const txRef = doc(db, 'aiAccountantClients', client.uid!, 'transactions', txId);
                batch.update(txRef, {
                    status: 'reviewed',
                    allocatedTo: { value: alloc.value, type: alloc.type },
                    vatType: client.isVatRegistered ? alloc.vatType : 'no_vat',
                    allocatedAt: Timestamp.now(),
                    allocationSource: 'manual',
                });
            });
            await batch.commit();
            toast({ title: "Allocations Saved" });
            setAllocations({});
            refetch();
        } catch (e) { console.error(e); } finally { setIsSaving(false); }
    };

    const handleRunAiWorkflow = async () => {
        if (!client?.uid || !bankAccountId || !user?.email) return;
        toast({ title: "Starting AI Analysis..." });
        try {
            const lockRes = await prepareAiAccountantAnalysis({ clientId: client.uid, bankAccountId });
            if (lockRes.count > 0) {
                setActiveTab('ai-workflow');
                runAiAccountantAnalysis({ clientId: client.uid, bankAccountId, initiatorEmail: user.email });
            } else {
                toast({ title: "No new expenses found to process." });
            }
        } catch (e) { toast({ title: "Workflow Failed", variant: "destructive" }); }
    };

    return (
        <div className="space-y-4">
            <CreateRuleDialog client={client} onRuleCreated={refetch} open={isCreateRuleOpen} onOpenChange={setIsCreateRuleOpen} defaultValues={ruleDefaultValues} transactionDescription={null} existingRules={globalRules} />
            <CreateGeneralAccountDialog client={client} onAccountCreated={onAccountCreated} open={isCreateGeneralAccountOpen} onOpenChange={setIsCreateGeneralAccountOpen} />
            <Card>
                <CardHeader className="p-0 border-b">
                    <Tabs value={activeSubTab} onValueChange={(v: any) => setActiveSubTab(v)} className="w-full">
                        <TabsList className="grid w-full grid-cols-2 rounded-none"><TabsTrigger value="expenses">Expenses</TabsTrigger><TabsTrigger value="income">Income</TabsTrigger></TabsList>
                    </Tabs>
                    <div className="p-4 flex justify-between items-center gap-2">
                        <div className="flex gap-2">
                            {bankAccountId && <ImportDialog client={client} bankAccountId={bankAccountId} currentBalance={currentBalance} onImportComplete={refetch} globalRules={globalRules} />}
                            {activeSubTab === 'expenses' && <Button variant="secondary" onClick={handleRunAiWorkflow}><Sparkles className="mr-2 h-4 w-4" /> Run AI Analysis</Button>}
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Description</TableHead><TableHead>Allocate To</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader>
                        <TableBody>
                            {isLoading ? <TableRow><TableCell colSpan={4} className="text-center h-24"><Loader2 className="animate-spin mx-auto"/></TableCell></TableRow> :
                             transactions.map(tx => (
                                <TableRow key={tx.id}>
                                    <TableCell>{new Date(tx.date).toLocaleDateString('en-GB')}</TableCell>
                                    <TableCell>{tx.description}</TableCell>
                                    <TableCell>
                                        <Select onValueChange={(v) => setAllocations((p: any) => ({...p, [tx.id]: { value: v, type: 'account', vatType: 'standard_rated_purchases' }}))}>
                                            <SelectTrigger className="h-8"><SelectValue placeholder="Select account..." /></SelectTrigger>
                                            <SelectContent>{client?.chartOfAccounts?.map(a => <SelectItem key={a.id} value={a.id}>{a.description}</SelectItem>)}</SelectContent>
                                        </Select>
                                    </TableCell>
                                    <TableCell className="text-right font-mono">{formatPrice(tx.amount)}</TableCell>
                                </TableRow>
                             ))}
                        </TableBody>
                    </Table>
                </CardContent>
                <CardFooter className="flex justify-between p-4 border-t">
                    <Button onClick={handleSaveAllocations} disabled={isSaving || Object.keys(allocations).length === 0}>Save Allocations</Button>
                    <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" onClick={goToPreviousPage} disabled={!canGoPrev}>Previous</Button>
                        <span className="text-sm">Page {currentPage}</span>
                        <Button variant="outline" size="sm" onClick={goToNextPage} disabled={!canGoNext}>Next</Button>
                    </div>
                </CardFooter>
            </Card>
        </div>
    );
});
NewTransactionsTab.displayName = 'NewTransactionsTab';

interface TransactionGroup {
    merchantKey: string;
    transactions: ImportedTransaction[];
    suggestion: AIAllocationResult | null;
    status: 'pending' | 'ready' | 'processing' | 'server_researching';
}

const AIWorkflowTab = ({ client, bankAccountId, onAccountCreated }: { 
    client: User | null; 
    bankAccountId: string | null; 
    globalRules: AllocationRule[];
    onAccountCreated: () => void;
}) => {
    const { toast } = useToast();
    const [groups, setGroups] = useState<TransactionGroup[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isCreateGeneralAccountOpen, setIsCreateGeneralAccountOpen] = useState(false);
    const [approvalSettings, setApprovalSettings] = useState<any>({});
    const [viewingGroup, setViewingGroup] = useState<TransactionGroup | null>(null);
    const [isMovingBack, setIsMovingBack] = useState<string | null>(null);

    const fetchData = useCallback(async () => {
        if (!client?.uid || !bankAccountId) return;
        setIsLoading(true);
        try {
            const transRef = collection(db, 'aiAccountantClients', client.uid, 'transactions');
            const workflowSnap = await getDocs(query(transRef, where('bankAccountId', '==', bankAccountId), where('status', 'in', ['ai_processing', 'ai_review'])));
            const workflowTxs = workflowSnap.docs.map(d => ({ id: d.id, ...d.data() } as ImportedTransaction));

            const merchantGroups: { [key: string]: ImportedTransaction[] } = {};
            workflowTxs.forEach(tx => {
                const key = tx.merchantKey || 'UNKNOWN';
                if (!merchantGroups[key]) merchantGroups[key] = [];
                merchantGroups[key].push(tx);
            });

            const initialGroups: TransactionGroup[] = Object.entries(merchantGroups).map(([key, txs]) => ({
                merchantKey: key,
                transactions: txs,
                suggestion: txs[0].aiAllocationResult || null,
                status: txs[0].status === 'ai_processing' ? 'server_researching' : 'ready'
            }));

            setGroups(initialGroups);
            const settings: any = {};
            initialGroups.forEach(g => { if (g.suggestion) settings[g.merchantKey] = { accountId: g.suggestion.accountId, vatType: g.suggestion.vatType, createRule: true }; });
            setApprovalSettings(settings);
        } catch (e) { console.error(e); } finally { setIsLoading(false); }
    }, [client, bankAccountId]);

    useEffect(() => { fetchData(); }, [fetchData]);

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
                    allocationSource: 'ai'
                });
            });
            if (settings.createRule) {
                batch.update(doc(db, 'aiAccountantClients', client.uid), { allocationRules: arrayUnion({ id: `rule_${Date.now()}`, description: `Auto-categorization for ${group.merchantKey}`, keywords: [group.merchantKey.toUpperCase()], accountId: settings.accountId, vatType: settings.vatType, type: 'hard', scope: 'client', priority: 99 }) });
            }
            await batch.commit();
            toast({ title: "Group Approved" });
            setGroups(prev => prev.filter(g => g.merchantKey !== group.merchantKey));
        } catch (e) { toast({ title: "Approval Failed", variant: "destructive" }); }
    };

    const handleMoveSingleTransactionToNew = async (txId: string) => {
        if (!client?.uid) return;
        setIsMovingBack(txId);
        try {
            await moveTransactionToNew({ clientId: client.uid, transactionId: txId });
            toast({ title: "Transaction Moved" });
            fetchData();
        } catch (e) { toast({ title: "Failed to move", variant: "destructive" }); } finally { setIsMovingBack(null); }
    };

    if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="animate-spin" /></div>;

    return (
        <div className="space-y-6 p-4">
            <CreateGeneralAccountDialog client={client} onAccountCreated={fetchData} open={isCreateGeneralAccountOpen} onOpenChange={setIsCreateGeneralAccountOpen} />
            <Dialog open={!!viewingGroup} onOpenChange={(o) => !o && setViewingGroup(null)}>
                <DialogContent className="sm:max-w-xl">
                    <DialogHeader><DialogTitle>Transactions for {viewingGroup?.merchantKey}</DialogTitle></DialogHeader>
                    <ScrollArea className="max-h-96 pr-4">
                        <Table>
                            <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Description</TableHead><TableHead className="text-right">Amount</TableHead><TableHead className="w-10"></TableHead></TableRow></TableHeader>
                            <TableBody>
                                {viewingGroup?.transactions.map((tx) => (
                                    <TableRow key={tx.id}>
                                        <TableCell className="text-xs">{format(new Date(tx.date), 'dd/MM/yyyy')}</TableCell>
                                        <TableCell className="text-xs">{tx.description}</TableCell>
                                        <TableCell className="text-right text-xs font-mono">{formatPrice(tx.amount)}</TableCell>
                                        <TableCell>
                                            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => handleMoveSingleTransactionToNew(tx.id)} disabled={isMovingBack === tx.id}>
                                                {isMovingBack === tx.id ? <Loader2 className="h-3 w-3 animate-spin"/> : <Undo2 className="h-3 w-3" />}
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </ScrollArea>
                </DialogContent>
            </Dialog>

            <div className="grid grid-cols-1 gap-4">
                {groups.map((group) => (
                    <Card key={group.merchantKey} className={cn("overflow-hidden border shadow-sm", group.status === 'server_researching' && "opacity-75 border-dashed")}>
                        <div className="grid grid-cols-1 md:grid-cols-12">
                            {/* Column 1: Merchant Info (Left) */}
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
                                            "{group.transactions[0].description}"
                                        </p>
                                    </div>
                                    {group.status === 'server_researching' && <div className="flex items-center gap-2 text-xs text-primary"><Loader2 className="h-3 w-3 animate-spin" /> Analyzing...</div>}
                                </div>
                            </div>
                            
                            {/* Column 2: Selectors (Middle) */}
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

                            {/* Column 3: AI Insight & Actions (Right) */}
                            <div className="md:col-span-6 p-4 flex flex-col justify-between">
                                <div className="p-4 rounded-xl border border-primary/10 bg-primary/5 flex-grow mb-4">
                                    <div className="mb-3">
                                        {group.status === 'ready' && group.suggestion ? (
                                            <Badge className={cn(
                                                "text-[10px] font-bold py-1 px-3 rounded-full",
                                                group.suggestion.confidence > 80 
                                                ? "bg-green-600 hover:bg-green-600 text-white" 
                                                : "bg-yellow-500 hover:bg-yellow-500 text-white"
                                            )}>
                                                {group.suggestion.confidence}% AI Confidence
                                            </Badge>
                                        ) : (
                                            <Badge variant="secondary" className="text-[10px] font-bold py-1 px-3 rounded-full">
                                                Researching...
                                            </Badge>
                                        )}
                                    </div>
                                    <p className="text-xs italic text-muted-foreground leading-relaxed">
                                        {group.status === 'ready' && group.suggestion ? group.suggestion.summary : "The AI engine is currently performing research on this merchant across your history, rules, and external knowledge bases."}
                                    </p>
                                </div>
                                
                                <div className="flex items-center justify-between mt-auto pt-2">
                                    <div className="flex items-center space-x-2">
                                        <Checkbox 
                                            id={`rule-${group.merchantKey}`} 
                                            className="rounded border-muted-foreground/30 data-[state=checked]:bg-primary"
                                            checked={approvalSettings[group.merchantKey]?.createRule} 
                                            onCheckedChange={(v) => setApprovalSettings((p: any) => ({...p, [group.merchantKey]: {...p[group.merchantKey], createRule: !!v}}))} 
                                        />
                                        <Label htmlFor={`rule-${group.merchantKey}`} className="text-xs font-bold text-muted-foreground cursor-pointer">Create Client Rule</Label>
                                    </div>
                                    <Button 
                                        className="bg-primary hover:bg-primary/90 text-white font-bold h-10 px-6 rounded-lg shadow-md" 
                                        onClick={() => handleApproveGroup(group)} 
                                        disabled={group.status !== 'ready'}
                                    >
                                        <CheckCircle2 className="mr-2 h-4 w-4" /> Approve Group
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </Card>
                ))}
            </div>
        </div>
    );
};

const ReviewedTab = ({ client, bankAccountId }: { 
    client: User | null; 
    bankAccountId: string | null; 
    customers: ClientCustomer[]; 
    onAccountCreated: () => void; 
}) => {
    const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
    const [activeSubTab, setActiveSubTab] = useState<'expenses' | 'income'>('expenses');
    const uniqueChartOfAccounts = useMemo(() => client?.chartOfAccounts || [], [client]);

    const baseQuery = useMemo(() => {
        if (!client?.uid || !bankAccountId) return null;
        let constraints: any[] = [where('bankAccountId', '==', bankAccountId), where('status', 'in', ['reviewed', 'allocated']), where('isExpense', '==', activeSubTab === 'expenses'), orderBy('description', 'asc')];
        if (dateRange?.from) constraints.push(where('date', '>=', dateRange.from.toISOString()));
        if (dateRange?.to) constraints.push(where('date', '<=', dateRange.to.toISOString()));
        return query(collection(db, 'aiAccountantClients', client.uid, 'transactions'), ...constraints);
    }, [client?.uid, bankAccountId, activeSubTab, dateRange]);

    const { documents: transactions, isLoading, goToNextPage, goToPreviousPage, canGoNext, canGoPrev, currentPage } = usePaginatedFirestore<ImportedTransaction>({ baseQuery, pageSize: PAGE_SIZE });

    return (
        <Card>
            <CardHeader className="p-0 border-b">
                 <Tabs value={activeSubTab} onValueChange={(v: any) => setActiveSubTab(v)} className="w-full">
                    <TabsList className="grid w-full grid-cols-2 rounded-none"><TabsTrigger value="expenses">Reviewed Expenses</TabsTrigger><TabsTrigger value="income">Reviewed Income</TabsTrigger></TabsList>
                </Tabs>
                 <div className="p-4 flex flex-col md:flex-row items-center justify-between gap-4">
                    <div />
                    <DateRangePicker onDateChange={setDateRange} />
                </div>
            </CardHeader>
            <CardContent className="p-0">
                <Table>
                    <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Description</TableHead><TableHead>Allocated To</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader>
                    <TableBody>
                        {isLoading ? <TableRow><TableCell colSpan={4} className="text-center h-24"><Loader2 className="animate-spin mx-auto"/></TableCell></TableRow> :
                         transactions.map(tx => (
                            <TableRow key={tx.id}>
                                <TableCell>{new Date(tx.date).toLocaleDateString('en-GB')}</TableCell>
                                <TableCell>{tx.description}</TableCell>
                                <TableCell className="text-sm">{uniqueChartOfAccounts.find(a => a.id === tx.allocatedTo?.value)?.description || tx.allocatedTo?.value}</TableCell>
                                <TableCell className="text-right font-mono">{formatPrice(tx.amount)}</TableCell>
                            </TableRow>
                         ))}
                    </TableBody>
                </Table>
            </CardContent>
            <CardFooter className="flex justify-between p-4 border-t">
                <div />
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={goToPreviousPage} disabled={!canGoPrev}>Previous</Button>
                    <span className="text-sm">Page {currentPage}</span>
                    <Button variant="outline" size="sm" onClick={goToNextPage} disabled={!canGoNext}>Next</Button>
                </div>
            </CardFooter>
        </Card>
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

    useEffect(() => { fetchClientData(); fetchGlobalRules(); }, [fetchClientData, fetchGlobalRules]);
    
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

    if (!client) return <div className="text-center mt-8"><Loader2 className="h-8 w-8 animate-spin" /></div>;
    
    const bankAccounts = client.chartOfAccounts?.filter(acc => acc.accountNumber.startsWith('8400-')) || [];
    
    return (
        <div className="space-y-4">
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
            </div>
            <div className="border rounded-lg mt-4">
                 <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                    <TabsList className="grid w-full grid-cols-3 rounded-t-lg rounded-b-none h-auto">
                        <TabsTrigger value="new-transactions">New Transactions</TabsTrigger>
                        <TabsTrigger value="ai-workflow">AI Workflow</TabsTrigger>
                        <TabsTrigger value="reviewed">Reviewed</TabsTrigger>
                    </TabsList>
                    <TabsContent value="new-transactions" className="p-0">
                        <NewTransactionsTab client={client} bankAccountId={accountId} currentBalance={stats.balance} globalRules={globalRules} onAccountCreated={fetchClientData} setActiveTab={setActiveTab} />
                    </TabsContent>
                    <TabsContent value="ai-workflow" className="p-0">
                        <AIWorkflowTab client={client} bankAccountId={accountId} globalRules={globalRules} onAccountCreated={fetchClientData} />
                    </TabsContent>
                    <TabsContent value="reviewed" className="p-0">
                        <ReviewedTab client={client} bankAccountId={accountId} customers={[]} onAccountCreated={fetchClientData} />
                    </TabsContent>
                </Tabs>
            </div>
        </div>
    );
}
