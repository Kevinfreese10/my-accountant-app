
      'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useForm, useFieldArray } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { FileUp, Loader2, PlusCircle, Search, Settings, Trash2, Edit, List, ArrowRightLeft, Paperclip, X, Plus, Minus, Download, Cog, BookOpen, Sparkles, ArrowUpDown, Ban, ChevronLeft, ChevronRight, CheckCircle, RotateCcw, Upload, AlertTriangle, Mail, Scale, CheckCheck, ChevronsUpDown, ChevronRight as ChevronRightIcon, MoreHorizontal } from 'lucide-react';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { ImportedTransaction, ChartOfAccount, User, VatType, AllocatedTransaction, AllocationRule, AIAllocationJob, ClientCustomer, Invoice, AIAllocationResult } from '@/lib/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { getFirestore, doc, updateDoc, arrayUnion, getDoc, arrayRemove, addDoc, collection, getDocs, query, orderBy, where, writeBatch, onSnapshot, Unsubscribe, Query, DocumentData, QueryDocumentSnapshot, limit, startAfter, QueryConstraint, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useParams, useSearchParams } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuSeparator, DropdownMenuGroup } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup } from "@/components/ui/select";
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { Label } from '@/components/ui/label';
import { allVatTypes } from '@/lib/vat-types';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { suggestTransactionAllocation } from '@/ai/flows/suggest-transaction-allocation';
import { extractStatementData } from '@/ai/flows/extract-statement-data';
import { extractStatementPeriod } from '@/ai/flows/extract-statement-period';
import { suggestIncomeAllocation } from '@/ai/flows/suggest-income-allocation';
import { extractSupplierName } from '@/ai/flows/extract-supplier-name';
import { Progress } from '@/components/ui/progress';
import { usePaginatedFirestore } from '@/hooks/use-paginated-firestore';
import { Command, CommandInput, CommandList, CommandEmpty, CommandItem, CommandGroup } from '@/components/ui/command';
import { ScrollArea } from '@/components/ui/scroll-area';
import { format, startOfMonth, endOfMonth, eachMonthOfInterval, getYear, getMonth, parseISO, addMonths, isSameMonth, addDays, differenceInDays, isAfter, subDays, startOfDay, endOfDay } from 'date-fns';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Slider } from '@/components/ui/slider';
import { DateRangePicker, type DateRange } from '@/components/ui/date-range-picker';


const PAGE_SIZE = 50;
const BATCH_SIZE = 400; // Firestore batch limit is 500

const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-GB', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(price);
};

// #region Import Dialog
const importFormSchema = z.object({
  file: z.any().refine(file => file instanceof File, "A CSV or Excel file is required."),
});

type ParsedTransaction = {
    Date: string;
    Description: string;
    Amount: number;
}

function ImportDialog({ client, bankAccountId, currentBalance, onImportComplete, globalRules }: { client: User | null, bankAccountId: string, currentBalance: number, onImportComplete: () => void, globalRules: AllocationRule[] }) {
    const [isOpen, setIsOpen] = useState(false);
    const [file, setFile] = useState<File | null>(null);
    const [parsedTransactions, setParsedTransactions] = useState<ParsedTransaction[]>([]);
    const [isParsing, setIsParsing] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const { toast } = useToast();
    const [potentialAllocations, setPotentialAllocations] = useState(0);
    const [potentialAiAllocations, setPotentialAiAllocations] = useState(0);
    const [importError, setImportError] = useState<string | null>(null);

    const resetState = useCallback(() => {
        setFile(null);
        setParsedTransactions([]);
        setPotentialAllocations(0);
        setPotentialAiAllocations(0);
        setIsParsing(false);
        setIsUploading(false);
        setImportError(null);
        const fileInput = document.getElementById('statement-file') as HTMLInputElement;
        if(fileInput) fileInput.value = '';
    }, []);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (selectedFile) {
            setIsParsing(true);
            setImportError(null);
            setFile(selectedFile);
            setParsedTransactions([]);
            setPotentialAllocations(0);
            setPotentialAiAllocations(0);
            
            const reader = new FileReader();
            reader.onload = (event) => {
                const fileContent = event.target?.result;
                if (!fileContent) {
                    setIsParsing(false);
                    return;
                }

                Papa.parse(fileContent as string, {
                    header: true,
                    skipEmptyLines: true,
                    complete: (results) => {
                        if (results.data.length > 2000) {
                            setImportError('File is too large. Please import no more than 2000 lines at a time.');
                            setParsedTransactions([]);
                            setIsParsing(false);
                            return;
                        }
                        
                        const data = results.data as any[];
                        const transactions: ParsedTransaction[] = data.map(row => ({
                            Date: row.Date,
                            Description: row.Description,
                            Amount: parseFloat(row.Amount)
                        })).filter(tx => tx.Date && tx.Description && !isNaN(tx.Amount));
                        
                        setParsedTransactions(transactions);

                        let ruleAllocationCount = 0;
                        let aiAllocationCount = 0;
                        
                        const allRules = [...(client?.allocationRules || []), ...globalRules];

                        if (allRules.length > 0) {
                            for (const tx of transactions) {
                                const txDescriptionLower = tx.Description.toLowerCase();
                                const matchedRule = allRules.find(rule => 
                                    rule.keywords.some(kw => txDescriptionLower.includes(kw.toLowerCase()))
                                );
                                if (matchedRule) {
                                    ruleAllocationCount++;
                                }
                                else if (tx.Amount < 0) {
                                    aiAllocationCount++;
                                }
                            }
                        } else {
                            aiAllocationCount = transactions.filter(tx => tx.Amount < 0).length;
                        }
                        
                        setPotentialAllocations(ruleAllocationCount);
                        setPotentialAiAllocations(aiAllocationCount);
                        setIsParsing(false);
                    }
                });
            };
            reader.readAsText(selectedFile);
        }
    };
    
    const handleImport = async () => {
        if (!file || !client || !client.uid || !bankAccountId || parsedTransactions.length === 0 || importError) return;
        setIsUploading(true);
        toast({ title: "Importing...", description: "Processing your file and applying rules."});

        try {
            const allRules = [...(client?.allocationRules || []), ...globalRules];

            const allDbOperations: ((batch: ReturnType<typeof writeBatch>) => void)[] = [];
            const dailyCounters: { [key: string]: number } = {};
            
            parsedTransactions.forEach((row, index) => {
                const parsedDate = new Date(row.Date.replace(/(\d{2})\/(\d{2})\/(\d{4})/, '$3-$2-$1'));

                if (isNaN(parsedDate.getTime())) {
                    console.warn(`Skipping row ${index + 2}: Invalid date format.`);
                    return;
                }
                
                const dateString = parsedDate.toISOString().split('T')[0].replace(/-/g, '');
                dailyCounters[dateString] = (dailyCounters[dateString] || 0) + 1;
                const dailyIndex = String(dailyCounters[dateString]).padStart(2, '0');
                const reference = `${dateString}${dailyIndex}`;
                
                let transaction: Omit<ImportedTransaction, 'id'> = {
                    clientId: client.uid!,
                    date: parsedDate.toISOString(),
                    reference: reference,
                    description: row.Description,
                    amount: row.Amount,
                    bankAccountId: bankAccountId,
                    status: 'new'
                };
                
                const txDescriptionLower = row.Description.toLowerCase();
                const matchedRule = allRules.find(rule => 
                    rule.keywords.some(kw => txDescriptionLower.includes(kw.toLowerCase()))
                );

                if (matchedRule) {
                    transaction.status = 'review';
                    transaction.allocatedTo = { value: matchedRule.accountId, type: 'account' };
                    transaction.vatType = client.isVatRegistered ? matchedRule.vatType : 'no_vat';
                }

                allDbOperations.push((batch) => {
                    const newTransactionRef = doc(collection(db, 'aiAccountantClients', client.uid!, 'transactions'));
                    batch.set(newTransactionRef, transaction);
                });
            });

            for (let i = 0; i < allDbOperations.length; i += BATCH_SIZE) {
                const batch = writeBatch(db);
                const chunk = allDbOperations.slice(i, i + BATCH_SIZE);
                chunk.forEach(op => op(batch));
                await batch.commit();
            }

            toast({ title: "Import Successful", description: `${parsedTransactions.length} transactions have been imported. ${potentialAllocations} transactions were automatically allocated for review.`});
            onImportComplete();
            setIsOpen(false);
            resetState();
        } catch (error) {
            console.error("Error importing transactions:", error);
            toast({ title: "Import Failed", description: "An error occurred during the import process.", variant: "destructive"});
        } finally {
            setIsUploading(false);
        }
    };

    const handleCancel = useCallback(() => {
        setIsOpen(false);
        resetState();
    }, [resetState]);
    
    const handleDownloadExample = () => {
        const csvContent = "Date,Description,Amount\nDD/MM/YYYY,Example Payment,-150.00\nDD/MM/YYYY,Example Income,1000.50";
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.setAttribute('download', 'example-statement.csv');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
    
    const importTotal = useMemo(() => {
        return parsedTransactions.reduce((sum, tx) => sum + tx.Amount, 0);
    }, [parsedTransactions]);

    const newBalance = useMemo(() => currentBalance + importTotal, [currentBalance, importTotal]);

    const totalAutomated = potentialAllocations + potentialAiAllocations;

    return (
        <Dialog open={isOpen} onOpenChange={(open) => { setIsOpen(open); if(!open) resetState(); }}>
            <DialogTrigger asChild>
                <Button><FileUp className="mr-2 h-4 w-4" /> Import CSV</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-2xl">
                <DialogHeader>
                    <DialogTitle>Import Bank Statement</DialogTitle>
                    <DialogDescription>
                        Upload a CSV file to import transactions. The system will automatically allocate transactions based on your rules.
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                     <div className="flex items-center justify-between">
                         <Label htmlFor="statement-file">Statement File</Label>
                         <Button variant="outline" size="sm" onClick={handleDownloadExample}><Download className="mr-2 h-4 w-4"/> Download Example</Button>
                     </div>
                     <Input id="statement-file" type="file" accept=".csv" onChange={handleFileChange} />
                     {isParsing && <p className="text-sm text-muted-foreground flex items-center"><Loader2 className="mr-2 animate-spin"/> Parsing file...</p>}
                     {importError && (
                         <Alert variant="destructive">
                             <AlertTriangle className="h-4 w-4" />
                             <AlertTitle>Import Error</AlertTitle>
                             <AlertDescription>{importError}</AlertDescription>
                         </Alert>
                     )}
                     {parsedTransactions.length > 0 && 
                        <div className="pt-4 space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-1 p-3 rounded-lg bg-muted">
                                    <p className="text-sm font-semibold">{parsedTransactions.length} transactions found.</p>
                                    <p className="text-sm text-purple-600">
                                       {totalAutomated} transaction(s) can be automatically processed.
                                    </p>
                                </div>
                                <div className="space-y-1 p-3 rounded-lg bg-muted">
                                    <p className="text-sm text-muted-foreground">New Potential Balance</p>
                                    <p className="text-lg font-bold">{new Intl.NumberFormat('en-GB', { style: 'decimal', minimumFractionDigits: 2 }).format(newBalance)}</p>
                                </div>
                            </div>
                        </div>
                     }
                </div>
                <DialogFooter>
                    <Button type="button" variant="ghost" onClick={handleCancel}>Cancel</Button>
                    <Button type="button" onClick={handleImport} disabled={isUploading || isParsing || parsedTransactions.length === 0 || !!importError}>
                        {isUploading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Save {parsedTransactions.length > 0 ? parsedTransactions.length : ''} Transactions
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
// #endregion

// #region Bank Account Management Dialogs

const editAccountSchema = z.object({
  id: z.string(),
  name: z.string().min(3, "Bank account name is required."),
});

function EditAccountDialog({ account, client, onAccountUpdated, onOpenChange, open }: { account: ChartOfAccount, client: User | null, onAccountUpdated: () => void, open: boolean, onOpenChange: (open: boolean) => void }) {
    const { toast } = useToast();
    const [isSaving, setIsSaving] = useState(false);
    const form = useForm<z.infer<typeof editAccountSchema>>({
        resolver: zodResolver(editAccountSchema),
        defaultValues: { id: account.id, name: account.description },
    });

    const handleEditAccount = async (values: z.infer<typeof editAccountSchema>) => {
        if (!client || !client.uid) return;
        setIsSaving(true);
        try {
            const updatedAccounts = client.chartOfAccounts?.map(acc =>
                acc.id === values.id ? { ...acc, description: values.name } : acc
            ) || [];

            const clientRef = doc(db, 'aiAccountantClients', client.uid);
            await updateDoc(clientRef, { chartOfAccounts: updatedAccounts });

            toast({ title: 'Bank Account Updated', description: `The account name has been changed to ${values.name}.` });
            onAccountUpdated();
            onOpenChange(false);
        } catch (error) {
            console.error("Error updating bank account:", error);
            toast({ title: 'Error', description: 'Could not update the bank account.', variant: 'destructive' });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Edit Bank Account</DialogTitle>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(handleEditAccount)} className="space-y-4">
                        <FormField control={form.control} name="name" render={({ field }) => ( <FormItem><FormLabel>Bank Account Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                        <DialogFooter>
                            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
                            <Button type="submit" disabled={isSaving}>{isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save Changes</Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}

const createAccountSchema = z.object({
  name: z.string().min(3, "Bank account name is required."),
});

function CreateAccountDialog({ client, onAccountCreated, onOpenChange, open }: { client: User | null, onAccountCreated: () => void, open: boolean, onOpenChange: (open: boolean) => void }) {
    const { toast } = useToast();
    const [isSaving, setIsSaving] = useState(false);
    const form = useForm<z.infer<typeof createAccountSchema>>({
        resolver: zodResolver(createAccountSchema),
        defaultValues: { name: '' },
    });

    const handleCreateAccount = async (values: z.infer<typeof createAccountSchema>) => {
        if (!client || !client.uid) return;
        setIsSaving(true);
        try {
            const existingBankAccounts = client.chartOfAccounts?.filter(
                acc => acc.accountNumber.startsWith('8400-')
            ) || [];

            const existingNumbers = existingBankAccounts.map(acc => {
                const parts = acc.accountNumber.split('-');
                return parts.length > 1 ? parseInt(parts[1], 10) : 0;
            });

            const nextNumber = existingBankAccounts.length > 0 ? Math.max(...existingNumbers) + 1 : 1;
            const newAccountNumber = `8400-${String(nextNumber).padStart(3, '0')}`;

            const newAccount: ChartOfAccount = {
                id: newAccountNumber,
                accountNumber: newAccountNumber,
                description: values.name,
                section: 'Balance Sheet',
            };

            const clientRef = doc(db, 'aiAccountantClients', client.uid);
            await updateDoc(clientRef, {
                chartOfAccounts: arrayUnion(newAccount)
            });

            toast({ title: 'Bank Account Created', description: `Account ${newAccount.description} (${newAccount.accountNumber}) has been added.` });
            onAccountCreated();
            form.reset();
            onOpenChange(false);
        } catch (error) {
            console.error("Error creating bank account:", error);
            toast({ title: 'Error', description: 'Could not create the bank account.', variant: 'destructive' });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Create New Bank Account</DialogTitle>
                    <DialogDescription>
                        This will add a new cashbook account to this client's chart of accounts.
                    </DialogDescription>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(handleCreateAccount)} className="space-y-4">
                        <FormField control={form.control} name="name" render={({ field }) => ( <FormItem><FormLabel>Bank Account Name</FormLabel><FormControl><Input placeholder="e.g., FNB Cheque Account" {...field} /></FormControl><FormMessage /></FormItem>)} />
                        <DialogFooter>
                            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
                            <Button type="submit" disabled={isSaving}>{isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Create Account</Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}

const generalAccountFormSchema = z.object({
  accountNumber: z.string().min(1, "Account number is required."),
  description: z.string().min(3, "Description is required."),
  section: z.enum(['Income Statement', 'Balance Sheet']),
});

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
            
            toast({ title: 'Account Created', description: `Account "${values.description}" has been added.` });
            onAccountCreated();
            form.reset();
            onOpenChange(false);
        } catch (error) {
            console.error("Error creating general account:", error);
            toast({ title: 'Error', description: 'Could not create the account.', variant: 'destructive' });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Create New General Ledger Account</DialogTitle>
                    <DialogDescription>Add a new account to this client's chart of accounts.</DialogDescription>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(handleCreateAccount)} className="space-y-4">
                        <FormField control={form.control} name="accountNumber" render={({ field }) => ( <FormItem><FormLabel>Account Number</FormLabel><FormControl><Input placeholder="e.g., 3000-058" {...field} /></FormControl><FormMessage /></FormItem>)} />
                        <FormField control={form.control} name="description" render={({ field }) => ( <FormItem><FormLabel>Description</FormLabel><FormControl><Input placeholder="e.g., Office Flowers" {...field} /></FormControl><FormMessage /></FormItem>)} />
                        <FormField control={form.control} name="section" render={({ field }) => ( <FormItem><FormLabel>Section</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select a section" /></SelectTrigger></FormControl><SelectContent><SelectItem value="Income Statement">Income Statement</SelectItem><SelectItem value="Balance Sheet">Balance Sheet</SelectItem></SelectContent></Select><FormMessage /></FormItem>)} />
                        <DialogFooter>
                            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
                            <Button type="submit" disabled={isSaving}>{isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Create Account</Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}

// #endregion

// #region Rule Creation Dialog

const ruleFormSchema = z.object({
  description: z.string().min(3, "Rule description is required."),
  keywords: z.string().min(2, "At least one keyword is required."),
  accountId: z.string().min(1, "Account is required."),
  vatType: z.enum(allVatTypes.map(v => v.name) as [string, ...string[]]),
  scope: z.enum(['client', 'global']).default('client'),
});

function CreateRuleDialog({ client, onRuleCreated, open, onOpenChange, defaultValues }: { client: User | null; onRuleCreated: () => void; open: boolean; onOpenChange: (open: boolean) => void; defaultValues?: Partial<z.infer<typeof ruleFormSchema>> }) {
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();
  const form = useForm<z.infer<typeof ruleFormSchema>>({
    resolver: zodResolver(ruleFormSchema),
    defaultValues: defaultValues,
  });
  
  useEffect(() => {
    form.reset(defaultValues || {
      description: "",
      keywords: "",
      accountId: "",
      vatType: "standard_rated_purchases",
      scope: "client",
    });
  }, [open, defaultValues, form]);

  const handleSaveRule = async (values: z.infer<typeof ruleFormSchema>) => {
    setIsSaving(true);
    
    const newRule: Partial<AllocationRule> = {
      description: values.description,
      keywords: values.keywords.split(',').map(k => k.trim().toLowerCase()),
      accountId: values.accountId,
      vatType: client?.isVatRegistered ? values.vatType : 'no_vat',
      type: 'hard', // All user-created rules are 'hard' rules
    };

    try {
        if (values.scope === 'global') {
            await addDoc(collection(db, 'allocationRules'), newRule);
            toast({ title: "Global Rule Created", description: `The rule "${values.description}" has been added globally.`});
        } else {
            if (!client || !client.uid) {
                toast({ title: 'Error', description: 'No client selected for client-specific rule.', variant: 'destructive'});
                setIsSaving(false);
                return;
            }
            const clientRef = doc(db, 'aiAccountantClients', client.uid);
            await updateDoc(clientRef, {
                allocationRules: arrayUnion(newRule),
            });
            toast({ title: "Client Rule Created", description: `The rule "${values.description}" has been added to this client.`});
        }

      form.reset();
      onOpenChange(false);
      onRuleCreated(); // Callback to refetch client/global data
    } catch (error) {
      console.error("Error creating rule:", error);
      toast({ title: 'Error', description: 'Could not create the allocation rule.', variant: 'destructive'});
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create New Allocation Rule</DialogTitle>
          <DialogDescription>
            This rule will be applied to transactions to automatically categorize them.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSaveRule)} className="space-y-4">
            <FormField
              control={form.control}
              name="scope"
              render={({ field }) => (
                <FormItem className="space-y-3">
                  <FormLabel>Rule Scope</FormLabel>
                  <FormControl>
                    <RadioGroup
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                      className="flex items-center space-x-4"
                    >
                      <FormItem className="flex items-center space-x-2 space-y-0">
                        <FormControl><RadioGroupItem value="client" /></FormControl>
                        <FormLabel className="font-normal">Client Specific</FormLabel>
                      </FormItem>
                      <FormItem className="flex items-center space-x-2 space-y-0">
                        <FormControl><RadioGroupItem value="global" /></FormControl>
                        <FormLabel className="font-normal">Global (All Clients)</FormLabel>
                      </FormItem>
                    </RadioGroup>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField control={form.control} name="description" render={({ field }) => ( <FormItem><FormLabel>Rule Description</FormLabel><FormControl><Input placeholder="e.g., Monthly bank charges" {...field} /></FormControl><FormMessage /></FormItem> )} />
            <FormField control={form.control} name="keywords" render={({ field }) => ( <FormItem><FormLabel>Keywords (comma-separated)</FormLabel><FormControl><Input placeholder="e.g., monthly account fee, service fee" {...field} /></FormControl><FormMessage /></FormItem> )} />
            <FormField control={form.control} name="accountId" render={({ field }) => ( <FormItem><FormLabel>Allocate To Account</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select an account" /></SelectTrigger></FormControl><SelectContent>{client?.chartOfAccounts?.map(acc => ( <SelectItem key={acc.id} value={acc.id}>{acc.description}</SelectItem>))}</SelectContent></Select><FormMessage /></FormItem> )}/>
            {client?.isVatRegistered && (
              <FormField control={form.control} name="vatType" render={({ field }) => ( <FormItem><FormLabel>VAT Type</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select VAT type" /></SelectTrigger></FormControl><SelectContent>{allVatTypes.map(vt => ( <SelectItem key={vt.name} value={vt.name}>{vt.label}</SelectItem>))}</SelectContent></Select><FormMessage /></FormItem>)}/>
            )}
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Rule
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

// #endregion

const NewTransactionsTab = React.forwardRef<
    { refetch: () => void },
    { client: User | null; bankAccountId: string | null; customers: ClientCustomer[]; invoices: Invoice[]; fetchClientData: () => void; globalRules: AllocationRule[]; onAccountCreated: () => void; }
>(({ client, bankAccountId, customers, invoices, fetchClientData, globalRules, onAccountCreated }, ref) => {
    const { toast, dismiss } = useToast();
    const [activeSubTab, setActiveSubTab] = useState<'expenses' | 'income'>('expenses');
    const [selectedTransactions, setSelectedTransactions] = useState<string[]>([]);
    const [allocations, setAllocations] = useState<{ [txId: string]: { value: string, type: 'account' | 'customer' | 'supplier', vatType?: VatType } }>({});
    const [isCreateRuleOpen, setIsCreateRuleOpen] = useState(false);
    const [isCreateGeneralAccountOpen, setIsCreateGeneralAccountOpen] = useState(false);
    const [ruleDefaultValues, setRuleDefaultValues] = useState<Partial<z.infer<typeof ruleFormSchema>>>({ description: '', keywords: '', accountId: '', vatType: 'standard_rated_purchases', scope: 'client' });
    const [isAiAllocating, setIsAiAllocating] = useState(false);
    const [isRuleAllocating, setIsRuleAllocating] = useState(false);
    const [isDownloading, setIsDownloading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [isSearching, setIsSearching] = useState(false);
    const [searchResults, setSearchResults] = useState<ImportedTransaction[] | null>(null);
    const [isAiSelectedDialogOpen, setIsAiSelectedDialogOpen] = useState(false);
    const [isAiAllDialogOpen, setIsAiAllDialogOpen] = useState(false);
    const [aiConfidenceThreshold, setAiConfidenceThreshold] = useState(70);
    const [isSaving, setIsSaving] = useState(false);
    const [showAll, setShowAll] = useState(false);
    const [allTransactions, setAllTransactions] = useState<ImportedTransaction[]>([]);
    const [isFetchingAll, setIsFetchingAll] = useState(false);


    type SortField = 'date' | 'description' | 'amount';
    type SortDirection = 'asc' | 'desc';
    const [sortField, setSortField] = useState<SortField>('date');
    const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

    const handleSort = (field: SortField) => {
        if (sortField === field) {
            setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDirection('asc');
        }
    };
    
    const baseQuery = useMemo(() => {
        if (!client?.uid || !bankAccountId) return null;

        let constraints: QueryConstraint[] = [
            where('bankAccountId', '==', bankAccountId),
            where('status', '==', 'new'),
        ];
    
        if (activeSubTab === 'expenses') {
            constraints.push(where('amount', '<', 0));
        } else {
             constraints.push(where('amount', '>=', 0));
        }
        
        let finalSortField = sortField;
        let finalSortDirection: 'asc' | 'desc' = sortDirection;

        // Firestore limitation: inequality filters must be on the first orderBy field.
        // If sorting by something other than amount, we still need amount inequality first.
        if (sortField !== 'amount') {
             constraints.push(orderBy('amount', activeSubTab === 'expenses' ? 'asc' : 'desc'));
             constraints.push(orderBy(finalSortField, finalSortDirection));
        } else {
             constraints.push(orderBy('amount', finalSortDirection));
        }
        
        return query(collection(db, 'aiAccountantClients', client.uid, 'transactions'), ...constraints);
    }, [client?.uid, bankAccountId, activeSubTab, sortField, sortDirection]);


    const {
        documents: paginatedDocuments,
        isLoading,
        goToNextPage,
        goToPreviousPage,
        canGoNext,
        canGoPrev,
        currentPage,
        refetch
    } = usePaginatedFirestore<ImportedTransaction>({ baseQuery: baseQuery, pageSize: PAGE_SIZE });

     const handleSearch = useCallback(async () => {
        if (!searchTerm.trim()) {
            setSearchResults(null);
            return;
        }
        if (!client?.uid || !bankAccountId) return;

        setIsSearching(true);
        let searchConstraints: QueryConstraint[] = [
            where('bankAccountId', '==', bankAccountId),
            where('status', '==', 'new'),
        ];
        if (activeSubTab === 'expenses') {
            searchConstraints.push(where('amount', '<', 0));
        } else {
            searchConstraints.push(where('amount', '>=', 0));
        }
        const q = query(collection(db, 'aiAccountantClients', client.uid, 'transactions'), ...searchConstraints);

        try {
            const snapshot = await getDocs(q);
            const allDocs = snapshot.docs.map(d => ({id: d.id, ...d.data()}) as ImportedTransaction);
            const filtered = allDocs.filter(tx => tx.description.toLowerCase().includes(searchTerm.toLowerCase()));
            setSearchResults(filtered);
        } catch (error) {
            console.error("Error during search:", error);
            toast({title: "Search Error", variant: "destructive"});
        } finally {
            setIsSearching(false);
        }
    }, [searchTerm, client, bankAccountId, activeSubTab, toast]);
    
    useEffect(() => {
        const debounce = setTimeout(() => {
            handleSearch();
        }, 500);

        return () => clearTimeout(debounce);
    }, [searchTerm, handleSearch]);

     useEffect(() => {
        const fetchAll = async () => {
            if (!baseQuery) return;
            setIsFetchingAll(true);
            try {
                // @ts-ignore
                const unlimitedQuery = query(baseQuery.firestore, baseQuery.path, ...baseQuery._query.constraints.filter((c: any) => c.type !== 'limit'));
                const snapshot = await getDocs(unlimitedQuery);
                const allDocs = snapshot.docs.map(d => ({id: d.id, ...d.data()}) as ImportedTransaction);
                setAllTransactions(allDocs);
            } catch (error) {
                console.error("Error fetching all transactions:", error);
                toast({ title: 'Error', description: 'Could not fetch all transactions.', variant: 'destructive' });
            } finally {
                setIsFetchingAll(false);
            }
        };

        if (showAll) {
            fetchAll();
        } else {
            setAllTransactions([]);
        }
    }, [showAll, baseQuery, toast]);


    const transactions = useMemo(() => {
        let docs = showAll ? allTransactions : (searchResults !== null ? searchResults : paginatedDocuments);
        
        if (sortField === 'description') {
            docs.sort((a, b) => {
                const comparison = a.description.localeCompare(b.description);
                return sortDirection === 'asc' ? comparison : -comparison;
            });
        }
        return docs;
    }, [showAll, allTransactions, searchResults, paginatedDocuments, sortField, sortDirection]);
    
    React.useImperativeHandle(ref, () => ({
        refetch,
    }));

    useEffect(() => {
        refetch();
        setSearchTerm('');
        setSearchResults(null);
    }, [activeSubTab, refetch]);
    
    const handleAllocateByRules = useCallback(async () => {
        if (!client || !client.uid || !bankAccountId) return;
        setIsRuleAllocating(true);
        toast({ title: "Applying Rules...", description: "Allocating all new transactions based on rules." });

        try {
            const allRules = [...(client.allocationRules || []), ...globalRules];
            if (allRules.length === 0) {
                toast({ title: 'No Rules Found', description: 'There are no allocation rules to apply.' });
                setIsRuleAllocating(false);
                return;
            }

            let baseQuery = query(
                collection(db, 'aiAccountantClients', client.uid, 'transactions'),
                where('bankAccountId', '==', bankAccountId),
                where('status', '==', 'new')
            );
            if (activeSubTab === 'expenses') {
                baseQuery = query(baseQuery, where('amount', '<', 0));
            } else {
                baseQuery = query(baseQuery, where('amount', '>=', 0));
            }

            const snapshot = await getDocs(baseQuery);
            const allNewTransactions = snapshot.docs.map(d => ({id: d.id, ...d.data()}) as ImportedTransaction);

            if (allNewTransactions.length === 0) {
                toast({ title: 'No New Transactions', description: 'No transactions to allocate.' });
                setIsRuleAllocating(false);
                return;
            }
            
            let allocatedCount = 0;
            const updatePromises = [];
            for (let i = 0; i < allNewTransactions.length; i += BATCH_SIZE) {
                const batch = writeBatch(db);
                const chunk = allNewTransactions.slice(i, i + BATCH_SIZE);
                chunk.forEach(tx => {
                    const txDescriptionLower = tx.description.toLowerCase();
                    const matchedRule = allRules.find(rule =>
                        rule.keywords.some(kw => txDescriptionLower.includes(kw.toLowerCase()))
                    );

                    if (matchedRule) {
                        const transactionRef = doc(db, 'aiAccountantClients', client.uid!, 'transactions', tx.id);
                        batch.update(transactionRef, {
                            status: 'review',
                            allocatedTo: { value: matchedRule.accountId, type: 'account' },
                            vatType: client.isVatRegistered ? matchedRule.vatType : 'no_vat',
                            allocatedAt: new Date(),
                        });
                        allocatedCount++;
                    }
                });
                updatePromises.push(batch.commit());
            }
            
            await Promise.all(updatePromises);

            if (allocatedCount > 0) {
                toast({ title: 'Rules Applied', description: `${allocatedCount} transaction(s) have been allocated for review.` });
                refetch();
            } else {
                toast({ title: 'No Matches Found', description: 'No transactions matched your existing rules.' });
            }
        } catch (error) {
            console.error("Error applying rules:", error);
            toast({ title: "Allocation Failed", description: "An error occurred while applying rules.", variant: "destructive" });
        } finally {
            setIsRuleAllocating(false);
        }
    }, [client, bankAccountId, activeSubTab, globalRules, toast, refetch]);

    const handleRuleCreated = useCallback(() => {
        fetchClientData();
        setTimeout(() => {
            handleAllocateByRules();
        }, 1000);
    }, [fetchClientData, handleAllocateByRules]);


    const handleAiExpenseAllocate = async (confidenceThreshold: number) => {
        if (!client || !client.uid || !client.chartOfAccounts || selectedTransactions.length === 0) return;
        setIsAiAllocating(true);
        toast({ title: "Preparing AI Workflow...", description: "Moving transactions to the AI workflow tab."});

        const batch = writeBatch(db);
        selectedTransactions.forEach(txId => {
            const txRef = doc(db, 'aiAccountantClients', client.uid!, 'transactions', txId);
            batch.update(txRef, { status: 'ai_processing' });
        });
        await batch.commit();

        toast({ title: "Transactions Moved", description: "Processing will begin in the AI Workflow tab."});
        
        setSelectedTransactions([]);
        refetch();
        setIsAiAllocating(false);
        setIsAiSelectedDialogOpen(false);
    };
    
    const handleAiAllocateAllExpenses = async (confidenceThreshold: number) => {
       if (!client || !client.uid || !client.chartOfAccounts || !bankAccountId) return;
        setIsAiAllDialogOpen(false);
        setIsAiAllocating(true);
        
        const newExpensesQuery = query(
            collection(db, 'aiAccountantClients', client.uid, 'transactions'),
            where('bankAccountId', '==', bankAccountId),
            where('status', '==', 'new'),
            where('amount', '<', 0)
        );
        const newExpensesSnapshot = await getDocs(newExpensesQuery);
        
        if (newExpensesSnapshot.empty) {
            toast({ title: "No new expenses to allocate." });
            setIsAiAllocating(false);
            return;
        }

        toast({ title: "Preparing AI Workflow...", description: `${newExpensesSnapshot.size} transactions moved to AI workflow.`});

        const batch = writeBatch(db);
        newExpensesSnapshot.docs.forEach(doc => {
            batch.update(doc.ref, { status: 'ai_processing' });
        });
        await batch.commit();
        
        toast({ title: "Transactions Moved", description: "Processing will begin in the AI Workflow tab."});

        setIsAiAllocating(false);
        refetch();
    };

    const handleAiIncomeAllocate = async (confidenceThreshold: number) => {
        if (!client || !client.uid || selectedTransactions.length === 0) return;
        setIsAiAllocating(true);
        toast({ title: "Preparing AI Workflow...", description: "Moving transactions to the AI workflow tab."});
        
        const batch = writeBatch(db);
        selectedTransactions.forEach(txId => {
            const txRef = doc(db, 'aiAccountantClients', client.uid!, 'transactions', txId);
            batch.update(txRef, { status: 'ai_processing' });
        });
        await batch.commit();

        toast({ title: "Transactions Moved", description: "Processing will begin in the AI Workflow tab."});
            
        setSelectedTransactions([]);
        refetch();
        setIsAiAllocating(false);
        setIsAiSelectedDialogOpen(false);
    };


    const handleBulkDelete = async () => {
        if (!client || !client.uid || selectedTransactions.length === 0) return;

        try {
            for (let i = 0; i < selectedTransactions.length; i += BATCH_SIZE) {
                const batch = writeBatch(db);
                const chunk = selectedTransactions.slice(i, i + BATCH_SIZE);
                chunk.forEach(txId => {
                    const docRef = doc(db, 'aiAccountantClients', client.uid, 'transactions', txId);
                    batch.delete(docRef);
                });
                await batch.commit();
            }
            toast({ title: 'Transactions Deleted', description: `${selectedTransactions.length} transactions have been removed.`, variant: 'destructive' });
            setSelectedTransactions([]);
            refetch();
        } catch (error) {
            toast({ title: 'Deletion Failed', variant: 'destructive' });
            console.error(error);
        }
    };

    const handleBulkAllocate = async (allocation: { value: string, type: 'account' | 'customer' | 'supplier' }, vatType: VatType) => {
        if (!client || !client.uid || selectedTransactions.length === 0) return;
        toast({ title: "Allocating...", description: `Allocating ${selectedTransactions.length} transactions.` });
    
        const transactionsToAllocate = selectedTransactions;
    
        try {
            for (let i = 0; i < transactionsToAllocate.length; i += BATCH_SIZE) {
                const batch = writeBatch(db);
                const chunk = transactionsToAllocate.slice(i, i + BATCH_SIZE);
                chunk.forEach(txId => {
                    const transactionRef = doc(db, 'aiAccountantClients', client.uid!, 'transactions', txId);
                    batch.update(transactionRef, {
                        status: 'review',
                        allocatedTo: allocation,
                        vatType: client.isVatRegistered ? vatType : 'no_vat',
                        allocatedAt: new Date(),
                    });
                });
                await batch.commit();
            }
            toast({ title: "Allocation Successful", description: `${transactionsToAllocate.length} transactions have been sent for review.` });
            
            setSelectedTransactions([]);
            
            if(searchTerm) {
                handleSearch();
            } else {
                refetch();
            }
    
        } catch (error) {
            console.error("Error during bulk allocation:", error);
            toast({ title: "Allocation Failed", variant: "destructive" });
        }
    };
    

    const handleDownloadExcel = async () => {
        if (!client || !client.uid || !bankAccountId) return;
        setIsDownloading(true);
        toast({ title: "Preparing Download...", description: "Fetching all new transactions." });
    
        try {
            const incomeQuery = query(
                collection(db, 'aiAccountantClients', client.uid, 'transactions'),
                where('bankAccountId', '==', bankAccountId),
                where('status', '==', 'new'),
                where('amount', '>=', 0)
            );
            const expensesQuery = query(
                collection(db, 'aiAccountantClients', client.uid, 'transactions'),
                where('bankAccountId', '==', bankAccountId),
                where('status', '==', 'new'),
                where('amount', '<', 0)
            );
    
            const [incomeSnapshot, expensesSnapshot] = await Promise.all([
                getDocs(incomeQuery),
                getDocs(expensesQuery)
            ]);
    
            const incomeData = incomeSnapshot.docs
                .map(doc => doc.data() as ImportedTransaction)
                .map(({ date, description, amount }) => ({ Date: format(new Date(date), 'dd/MM/yyyy'), Description: description, Amount: amount }));
    
            const expensesData = expensesSnapshot.docs
                .map(doc => doc.data() as ImportedTransaction)
                .map(({ date, description, amount }) => ({ Date: format(new Date(date), 'dd/MM/yyyy'), Description: description, Amount: amount }));
    
            const wb = XLSX.utils.book_new();
            const incomeSheet = XLSX.utils.json_to_sheet(incomeData);
            const expensesSheet = XLSX.utils.json_to_sheet(expensesData);
            
            XLSX.utils.book_append_sheet(wb, incomeSheet, "Income");
            XLSX.utils.book_append_sheet(wb, expensesSheet, "Expenses");
    
            XLSX.writeFile(wb, `New_Transactions_${client.name.replace(/\s/g, '_')}.xlsx`);
    
            toast({ title: 'Download Ready!', description: 'Your Excel file has been downloaded.' });
        } catch (error) {
            console.error("Error downloading excel:", error);
            toast({ title: 'Download Failed', description: 'Could not generate the Excel file.', variant: 'destructive' });
        } finally {
            setIsDownloading(false);
        }
    };
    
    const handleSaveAllocations = async () => {
        if (!client || !client.uid || Object.keys(allocations).length === 0) return;
        setIsSaving(true);
        toast({ title: "Saving allocations..." });
    
        try {
            const batch = writeBatch(db);
            let count = 0;
            for (const txId in allocations) {
                if (Object.prototype.hasOwnProperty.call(allocations, txId)) {
                    const allocation = allocations[txId];
                    if (allocation && allocation.value) {
                         const transactionRef = doc(db, 'aiAccountantClients', client.uid, 'transactions', txId);
                         batch.update(transactionRef, {
                            status: 'review',
                            allocatedTo: { value: allocation.value, type: allocation.type },
                            vatType: client.isVatRegistered ? allocation.vatType || (allocation.type === 'customer' ? 'no_vat' : 'standard_rated_purchases') : 'no_vat',
                            allocatedAt: new Date(),
                        });
                        count++;
                    }
                }
            }
            await batch.commit();
            toast({ title: `${count} allocations saved!`, description: 'Transactions moved to Pending Review.' });
            setAllocations({});
            setSearchTerm('');
            setSearchResults(null);
            refetch();
            
        } catch (error) {
            console.error("Error saving allocations:", error);
            toast({ title: "Save Failed", description: "Could not save allocations.", variant: "destructive" });
        } finally {
            setIsSaving(false);
        }
    };
    
    return (
        <Card>
            <CreateRuleDialog
                client={client}
                onRuleCreated={handleRuleCreated}
                open={isCreateRuleOpen}
                onOpenChange={(isOpen) => {
                    setIsCreateRuleOpen(isOpen);
                    if (!isOpen) {
                        setRuleDefaultValues({ description: '', keywords: '', accountId: '', vatType: 'standard_rated_purchases', scope: 'client' });
                    }
                }}
                defaultValues={ruleDefaultValues}
            />
             <CreateGeneralAccountDialog 
                client={client}
                onAccountCreated={onAccountCreated}
                open={isCreateGeneralAccountOpen}
                onOpenChange={setIsCreateGeneralAccountOpen}
             />

            <Dialog open={isAiAllDialogOpen} onOpenChange={setIsAiAllDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>AI Bulk Allocation</DialogTitle>
                        <DialogDescription>
                             This process will attempt to allocate all new expenses. It first learns from your previously reviewed transactions, then uses AI for the rest. Set the minimum confidence level the AI must have to make an allocation.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4 space-y-4">
                        <div className="flex items-center justify-between">
                            <Label htmlFor="confidence-slider">Confidence Threshold: <span className="font-bold">{aiConfidenceThreshold}%</span></Label>
                        </div>
                        <Slider
                            id="confidence-slider"
                            min={50}
                            max={100}
                            step={5}
                            value={[aiConfidenceThreshold]}
                            onValueChange={(value) => setAiConfidenceThreshold(value[0])}
                        />
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="ghost" onClick={() => setIsAiAllDialogOpen(false)}>Cancel</Button>
                        <Button type="button" onClick={() => handleAiAllocateAllExpenses(aiConfidenceThreshold)} disabled={isAiAllocating}>
                            {isAiAllocating ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Sparkles className="mr-2 h-4 w-4" />}
                            Start Allocation
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

             <Dialog open={isAiSelectedDialogOpen} onOpenChange={setIsAiSelectedDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>AI Allocate Selected</DialogTitle>
                        <DialogDescription>
                            The AI will attempt to allocate the selected transaction(s). Choose the minimum confidence level required for an allocation to be made.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4 space-y-4">
                        <div className="flex items-center justify-between">
                            <Label htmlFor="confidence-slider-selected">Confidence Threshold: <span className="font-bold">{aiConfidenceThreshold}%</span></Label>
                        </div>
                        <Slider
                            id="confidence-slider-selected"
                            min={50}
                            max={100}
                            step={5}
                            value={[aiConfidenceThreshold]}
                            onValueChange={(value) => setAiConfidenceThreshold(value[0])}
                        />
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="ghost" onClick={() => setIsAiSelectedDialogOpen(false)}>Cancel</Button>
                        <Button type="button" onClick={() => {
                            if (activeSubTab === 'expenses') handleAiExpenseAllocate(aiConfidenceThreshold);
                            else handleAiIncomeAllocate(aiConfidenceThreshold);
                        }} disabled={isAiAllocating}>
                            {isAiAllocating ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Sparkles className="mr-2 h-4 w-4" />}
                            Allocate Selected
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <CardHeader className="p-0">
                <Tabs value={activeSubTab} onValueChange={(value) => setActiveSubTab(value as 'expenses' | 'income')} className="w-full">
                    <TabsList className="grid w-full grid-cols-2 rounded-t-lg rounded-b-none h-auto">
                        <TabsTrigger value="expenses">Expenses</TabsTrigger>
                        <TabsTrigger value="income">Income</TabsTrigger>
                    </TabsList>
                </Tabs>
                 <div className="p-4 border-b flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2">
                         <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" disabled={selectedTransactions.length === 0}>
                                    Manual Allocate <ChevronsUpDown className="ml-2 h-4 w-4"/>
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent className="w-64 p-0">
                               <Command>
                                 <CommandInput placeholder="Search accounts..." />
                                 <ScrollArea className="h-72">
                                 <CommandList>
                                    <CommandEmpty>No results found.</CommandEmpty>
                                    <CommandGroup>
                                        <CommandItem onSelect={() => {setIsCreateGeneralAccountOpen(true);}} className="text-primary cursor-pointer">
                                            <PlusCircle className="mr-2 h-4 w-4"/>Create new account...
                                        </CommandItem>
                                    </CommandGroup>
                                    <DropdownMenuSeparator />
                                    {activeSubTab === 'income' && customers.length > 0 && (
                                        <CommandGroup heading="Customers">
                                            {customers.map(c => (
                                                <CommandItem key={c.id} onSelect={() => handleBulkAllocate({value: c.id, type: 'customer'}, 'no_vat')}>
                                                    {c.name}
                                                </CommandItem>
                                            ))}
                                        </CommandGroup>
                                    )}
                                    <CommandGroup heading="Accounts">
                                        {client?.chartOfAccounts?.map(acc => (
                                            <DropdownMenuSub key={acc.id}>
                                                <DropdownMenuSubTrigger>
                                                    <CommandItem onSelect={(e) => e.preventDefault()} className="w-full">
                                                        <span>{acc.description}</span>
                                                    </CommandItem>
                                                </DropdownMenuSubTrigger>
                                                <DropdownMenuSubContent>
                                                    {client?.isVatRegistered ? allVatTypes.map(vat => (
                                                        <DropdownMenuItem key={vat.name} onSelect={() => handleBulkAllocate({value: acc.id, type: 'account'}, vat.name)}>
                                                            {vat.label}
                                                        </DropdownMenuItem>
                                                    )) : (
                                                        <DropdownMenuItem onSelect={() => handleBulkAllocate({value: acc.id, type: 'account'}, 'no_vat')}>
                                                            No VAT
                                                        </DropdownMenuItem>
                                                    )}
                                                </DropdownMenuSubContent>
                                            </DropdownMenuSub>
                                        ))}
                                    </CommandGroup>
                                 </CommandList>
                                 </ScrollArea>
                               </Command>
                            </DropdownMenuContent>
                        </DropdownMenu>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" disabled={selectedTransactions.length === 0}>
                                    Actions <MoreHorizontal className="ml-2 h-4 w-4"/>
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent>
                                <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                        <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-destructive">
                                            Delete Selected
                                        </DropdownMenuItem>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                        <AlertDialogHeader>
                                            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                            <AlertDialogDescription>
                                                This will permanently delete {selectedTransactions.length} selected transaction(s). This cannot be undone.
                                            </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                                            <AlertDialogAction onClick={handleBulkDelete}>Yes, Delete</AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                            </DropdownMenuContent>
                        </DropdownMenu>

                         <Button variant="outline" onClick={() => setIsAiSelectedDialogOpen(true)} disabled={isAiAllocating || selectedTransactions.length === 0}>
                            <Sparkles className="mr-2 h-4 w-4"/> AI Allocate Selected
                        </Button>
                        {activeSubTab === 'expenses' && (
                            <Button variant="outline" onClick={() => setIsAiAllDialogOpen(true)} disabled={isAiAllocating || isLoading || transactions.length === 0}>
                                {isAiAllocating ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Sparkles className="mr-2 h-4 w-4"/>}
                                AI Allocate All
                            </Button>
                        )}
                        <Button variant="outline" onClick={handleDownloadExcel} disabled={isDownloading}>
                            {isDownloading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                            Download Excel
                        </Button>
                    </div>
                    <div className="relative">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            type="search"
                            placeholder="Search descriptions..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-8 w-64"
                        />
                    </div>
                </div>
            </CardHeader>
            <CardContent className="p-0">
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableCell className="w-12 p-2">
                                     <Checkbox
                                        checked={transactions.length > 0 && selectedTransactions.length === transactions.length}
                                        onCheckedChange={(checked) => {
                                            setSelectedTransactions(checked ? transactions.map(tx => tx.id) : []);
                                        }}
                                    />
                                </TableCell>
                                <TableHead>
                                    <Button variant="ghost" onClick={() => handleSort('date')}>Date <ArrowUpDown className="ml-2 h-4 w-4 inline" /></Button>
                                </TableHead>
                                <TableHead>
                                     <Button variant="ghost" onClick={() => handleSort('description')}>Description <ArrowUpDown className="ml-2 h-4 w-4 inline" /></Button>
                                </TableHead>
                                <TableHead>Reference</TableHead>
                                <TableHead className="w-[250px]">Allocate To</TableHead>
                                {client?.isVatRegistered && <TableHead className="w-[180px]">VAT Type</TableHead>}
                                <TableHead className="text-right">
                                     <Button variant="ghost" onClick={() => handleSort('amount')}>Amount <ArrowUpDown className="ml-2 h-4 w-4 inline" /></Button>
                                </TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading || isSearching || isFetchingAll ? (
                                <TableRow><TableCell colSpan={8} className="text-center h-24"><Loader2 className="animate-spin mx-auto" /></TableCell></TableRow>
                            ) : transactions.length === 0 ? (
                                <TableRow><TableCell colSpan={8} className="text-center h-24 text-muted-foreground">No new transactions found.</TableCell></TableRow>
                            ) : (
                                transactions.map(tx => (
                                    <TableRow key={tx.id} data-state={selectedTransactions.includes(tx.id) && "selected"}>
                                        <TableCell className="p-2">
                                            <Checkbox
                                                checked={selectedTransactions.includes(tx.id)}
                                                onCheckedChange={(checked) => {
                                                    setSelectedTransactions(prev =>
                                                        checked ? [...prev, tx.id] : prev.filter(id => id !== tx.id)
                                                    );
                                                }}
                                            />
                                        </TableCell>
                                        <TableCell>{new Date(tx.date).toLocaleDateString('en-GB')}</TableCell>
                                        <TableCell className="whitespace-normal break-words">{tx.description}</TableCell>
                                        <TableCell className="font-mono">{tx.reference}</TableCell>
                                        <TableCell>
                                            <Popover>
                                                <PopoverTrigger asChild>
                                                    <Button variant="outline" className="w-full justify-start text-left font-normal h-8">
                                                        {allocations[tx.id] ? [...(client?.chartOfAccounts || []), ...customers].find(o => o.id === allocations[tx.id].value)?.description || [...(client?.chartOfAccounts || []), ...customers].find(o => o.id === allocations[tx.id].value)?.name : "Select..."}
                                                    </Button>
                                                </PopoverTrigger>
                                                <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                                                    <Command>
                                                        <CommandInput placeholder="Search..." />
                                                        <CommandList>
                                                            <CommandEmpty>No results found.</CommandEmpty>
                                                            <CommandItem onSelect={() => setIsCreateGeneralAccountOpen(true)} className="text-primary cursor-pointer"><PlusCircle className="mr-2 h-4 w-4"/>Create new account...</CommandItem>
                                                            <CommandGroup heading="Customers">
                                                                {customers.map(c => <CommandItem key={c.id} onSelect={() => setAllocations(prev => ({...prev, [tx.id]: { value: c.id, type: 'customer', vatType: 'no_vat' }}))}>{c.name}</CommandItem>)}
                                                            </CommandGroup>
                                                            <CommandGroup heading="Accounts">
                                                                {client?.chartOfAccounts?.map(acc => <CommandItem key={acc.id} onSelect={() => setAllocations(prev => ({...prev, [tx.id]: { value: acc.id, type: 'account', vatType: prev[tx.id]?.vatType || (client.isVatRegistered ? 'standard_rated_purchases' : 'no_vat') }}))}>{acc.description}</CommandItem>)}
                                                            </CommandGroup>
                                                        </CommandList>
                                                    </Command>
                                                </PopoverContent>
                                            </Popover>
                                        </TableCell>
                                        {client?.isVatRegistered && (
                                            <TableCell>
                                                <Select
                                                   value={allocations[tx.id]?.vatType}
                                                   onValueChange={(value) => setAllocations(prev => ({...prev, [tx.id]: {...prev[tx.id], vatType: value as VatType}}))}
                                                   disabled={!allocations[tx.id] || allocations[tx.id]?.type === 'customer'}
                                                >
                                                    <SelectTrigger className="h-8"><SelectValue placeholder="Select VAT type" /></SelectTrigger>
                                                    <SelectContent>
                                                        {allVatTypes.map(vat => (
                                                            <SelectItem key={vat.name} value={vat.name}>{vat.label}</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </TableCell>
                                        )}
                                        <TableCell className="text-right font-mono">{formatPrice(tx.amount)}</TableCell>
                                        <TableCell className="text-right">
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent>
                                                     <DropdownMenuItem onSelect={() => {
                                                        const firstKeyword = tx.description.split(/\s+/)[0];
                                                        setIsCreateRuleOpen(true);
                                                        setRuleDefaultValues({ 
                                                            description: '', 
                                                            keywords: firstKeyword, 
                                                            accountId: '', 
                                                            vatType: 'standard_rated_purchases',
                                                            scope: 'client',
                                                        });
                                                     }}>
                                                        Create Rule from Transaction
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
             <CardFooter className="flex items-center justify-between p-4">
                 <Button onClick={handleSaveAllocations} disabled={isSaving || Object.keys(allocations).length === 0}>
                    {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Save Allocations
                </Button>
                 <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => setShowAll(!showAll)}>
                        {showAll ? 'Show Paginated' : 'Show All'}
                    </Button>
                    {!searchTerm && !showAll && (
                        <div className="flex items-center space-x-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={goToPreviousPage}
                                disabled={!canGoPrev || isLoading}
                            >
                                <ChevronLeft className="h-4 w-4" />
                                Previous
                            </Button>
                            <span className="text-sm font-medium">
                                Page {currentPage}
                            </span>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={goToNextPage}
                                disabled={!canGoNext || isLoading}
                            >
                                Next
                                <ChevronRight className="h-4 w-4" />
                            </Button>
                        </div>
                    )}
                 </div>
             </CardFooter>
        </Card>
    )
});
NewTransactionsTab.displayName = 'NewTransactionsTab';


const ReviewedTab = React.forwardRef<
    { refetch: () => void; },
    { client: User | null; bankAccountId: string | null; customers: ClientCustomer[], onAccountCreated: () => void; }
>(({ client, bankAccountId, customers, onAccountCreated }, ref) => {
    
    const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
    const [isSaving, setIsSaving] = useState(false);
    const { toast } = useToast();
    const [changes, setChanges] = useState<{ [txId: string]: Partial<ImportedTransaction> }>({});
    const [isDownloading, setIsDownloading] = useState(false);
    const [isCreateGeneralAccountOpen, setIsCreateGeneralAccountOpen] = useState(false);
    const [searchResults, setSearchResults] = useState<ImportedTransaction[] | null>(null);
    const [isSearching, setIsSearching] = useState(false);
    const [selectedTransactions, setSelectedTransactions] = useState<string[]>([]);
    const [showAll, setShowAll] = useState(false);
    const [allTransactions, setAllTransactions] = useState<ImportedTransaction[]>([]);
    const [isFetchingAll, setIsFetchingAll] = useState(false);
    const [isConsistencyCheckOpen, setIsConsistencyCheckOpen] = useState(false);
    const [inconsistencies, setInconsistencies] = useState<any[]>([]);
    const [selectedCorrections, setSelectedCorrections] = useState<string[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [accountFilter, setAccountFilter] = useState('all');
    const [activeSubTab, setActiveSubTab] = useState<'expenses' | 'income'>('expenses');


    type SortField = 'date' | 'description' | 'amount' | 'allocatedTo' | 'vatType';
    type SortDirection = 'asc' | 'desc';
    const [sortField, setSortField] = useState<SortField>('date');
    const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
    
    const uniqueChartOfAccounts = useMemo(() => {
        if (!client?.chartOfAccounts) return [];
        const seen = new Set();
        return client.chartOfAccounts.filter(el => {
            const duplicate = seen.has(el.id);
            seen.add(el.id);
            return !duplicate;
        });
    }, [client?.chartOfAccounts]);

    const handleSort = (field: SortField) => {
        if (sortField === field) {
            setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDirection('asc');
        }
    };
    
    const reviewedTransactionsQuery = useMemo(() => {
        if (!client?.uid || !bankAccountId) return null;
        
        let constraints: QueryConstraint[] = [
            where('bankAccountId', '==', bankAccountId),
            where('status', 'in', ['reviewed', 'allocated']),
        ];

        if (activeSubTab === 'expenses') {
            constraints.push(where('amount', '<', 0));
        } else {
             constraints.push(where('amount', '>=', 0));
        }

        if (dateRange?.from) {
            constraints.push(where('date', '>=', dateRange.from.toISOString()));
        }
        if (dateRange?.to) {
            constraints.push(where('date', '<=', dateRange.to.toISOString()));
        }

        const sortableFields: SortField[] = ['date', 'description', 'amount'];
        if (sortableFields.includes(sortField)) {
            constraints.push(orderBy(sortField, sortDirection));
        } else {
             constraints.push(orderBy('date', 'desc'));
        }
        
        return query(collection(db, 'aiAccountantClients', client.uid, 'transactions'), ...constraints);
    }, [client?.uid, bankAccountId, activeSubTab, sortField, sortDirection, dateRange]);


    const {
        documents: paginatedDocuments,
        isLoading,
        goToNextPage,
        goToPreviousPage,
        canGoNext,
        canGoPrev,
        currentPage,
        refetch
    } = usePaginatedFirestore<ImportedTransaction>({ baseQuery: reviewedTransactionsQuery, pageSize: PAGE_SIZE });
    
    useEffect(() => {
        const handleSearchAndFilter = async () => {
            if (!client?.uid || !bankAccountId) return;
            
            const hasSearch = searchTerm.trim().length > 0;
            const hasFilter = accountFilter !== 'all';

            if (!hasSearch && !hasFilter) {
                setSearchResults(null);
                refetch(); // This will refetch paginated data
                return;
            }

            setIsSearching(true);
            try {
                let baseConstraints: QueryConstraint[] = [
                    where('bankAccountId', '==', bankAccountId),
                    where('status', 'in', ['reviewed', 'allocated']),
                ];
                if (activeSubTab === 'expenses') {
                    baseConstraints.push(where('amount', '<', 0));
                } else {
                    baseConstraints.push(where('amount', '>=', 0));
                }
                
                let finalQuery;
                if (hasFilter) {
                    finalQuery = query(collection(db, 'aiAccountantClients', client.uid, 'transactions'), ...baseConstraints, where('allocatedTo.value', '==', accountFilter));
                } else {
                    finalQuery = query(collection(db, 'aiAccountantClients', client.uid, 'transactions'), ...baseConstraints);
                }

                const snapshot = await getDocs(finalQuery);
                let allDocs = snapshot.docs.map(d => ({ id: d.id, ...d.data() }) as ImportedTransaction);

                if (hasSearch) {
                    allDocs = allDocs.filter(tx => tx.description.toLowerCase().includes(searchTerm.toLowerCase()));
                }
                
                setSearchResults(allDocs);
            } catch (error) {
                console.error("Error during search/filter:", error);
                toast({ title: "Search/Filter Error", variant: "destructive" });
            } finally {
                setIsSearching(false);
            }
        };

        const debounce = setTimeout(() => {
            handleSearchAndFilter();
        }, 500);

        return () => clearTimeout(debounce);
    }, [searchTerm, accountFilter, client, bankAccountId, activeSubTab, toast, refetch]);


    React.useImperativeHandle(ref, () => ({
        refetch,
    }));

     useEffect(() => {
        setSearchTerm('');
        setSearchResults(null);
        setAccountFilter('all');
        refetch();
    }, [activeSubTab, refetch]);
    
    useEffect(() => {
        const fetchAll = async () => {
            if (!reviewedTransactionsQuery) return;
            setIsFetchingAll(true);
            try {
                 // @ts-ignore
                const unlimitedQuery = query(reviewedTransactionsQuery.firestore, reviewedTransactionsQuery.path, ...reviewedTransactionsQuery._query.constraints.filter((c: any) => c.type !== 'limit'));
                const snapshot = await getDocs(unlimitedQuery);
                const allDocs = snapshot.docs.map(d => ({id: d.id, ...d.data()}) as ImportedTransaction);
                setAllTransactions(allDocs);
            } catch (error) {
                console.error("Error fetching all transactions:", error);
                toast({ title: 'Error', description: 'Could not fetch all transactions.', variant: 'destructive' });
            } finally {
                setIsFetchingAll(false);
            }
        };

        if (showAll) {
            fetchAll();
        } else {
            setAllTransactions([]);
        }
    }, [showAll, reviewedTransactionsQuery, toast]);
    
    const displayedDocuments = useMemo(() => {
        if (searchResults !== null) {
            return searchResults;
        }
        if (showAll) {
            return allTransactions;
        }
        return paginatedDocuments;
    }, [showAll, allTransactions, searchResults, paginatedDocuments]);

    const accountsWithTransactions = useMemo(() => {
        if (!client || !client.chartOfAccounts) return [];

        const getAccounts = (transactions: ImportedTransaction[]) => {
            const accountIdsInDocs = new Set(transactions.map(tx => tx.allocatedTo?.value));
            return uniqueChartOfAccounts.filter(acc => accountIdsInDocs.has(acc.id));
        }

        if (searchResults !== null) return getAccounts(searchResults);
        if (showAll) return getAccounts(allTransactions);
        return getAccounts(paginatedDocuments);

    }, [paginatedDocuments, searchResults, allTransactions, showAll, uniqueChartOfAccounts, client]);

    const getAllocationDescription = (tx: ImportedTransaction) => {
        const changedTx = changes[tx.id];
        const allocatedTo = changedTx?.allocatedTo || tx.allocatedTo;

        if (!allocatedTo) return 'N/A';
        if (allocatedTo.type === 'customer') {
            return customers.find(c => c.id === allocatedTo.value)?.name || 'Unknown Customer';
        }
        return uniqueChartOfAccounts?.find(acc => acc.id === allocatedTo.value)?.description || 'Unknown Account';
    }

    const handleAllocationChange = (txId: string, value: string) => {
        const [type, val] = value.split(':');
        setChanges(prev => ({
            ...prev,
            [txId]: {
                ...prev[txId],
                allocatedTo: { value: val, type: type as 'account' | 'customer' }
            }
        }));
    }

    const handleVatChange = (txId: string, value: VatType) => {
        setChanges(prev => ({
            ...prev,
            [txId]: {
                ...prev[txId],
                vatType: value
            }
        }));
    }
    
    const handleBulkDelete = async () => {
        if (!client || !client.uid || selectedTransactions.length === 0) return;
        
        try {
             for (let i = 0; i < selectedTransactions.length; i += BATCH_SIZE) {
                const batch = writeBatch(db);
                const chunk = selectedTransactions.slice(i, i + BATCH_SIZE);
                chunk.forEach(txId => {
                    const docRef = doc(db, 'aiAccountantClients', client.uid, 'transactions', txId);
                    batch.delete(docRef);
                });
                await batch.commit();
            }
            toast({ title: 'Transactions Deleted', description: `${selectedTransactions.length} transactions have been removed.`, variant: 'destructive' });
            setSelectedTransactions([]);
            refetch();
        } catch (error) {
            toast({ title: 'Deletion Failed', variant: 'destructive' });
            console.error(error);
        }
    };
    
    const handleSaveChanges = async (changesToSave: typeof changes, transactionIds: string[]) => {
        if (!client || !client.uid || transactionIds.length === 0) return;
        setIsSaving(true);
        toast({ title: 'Saving changes...', description: 'Please wait.' });
    
        try {
            const batch = writeBatch(db);
            transactionIds.forEach(txId => {
                const changeData = changesToSave[txId];
                if (changeData) {
                    const txRef = doc(db, 'aiAccountantClients', client.uid!, 'transactions', txId);
                    const updateData: { [key: string]: any } = {};
                    if (changeData.allocatedTo) updateData.allocatedTo = changeData.allocatedTo;
                    if (changeData.vatType) updateData.vatType = changeData.vatType;
                    if (Object.keys(updateData).length > 0) {
                        batch.update(txRef, updateData);
                    }
                }
            });
            await batch.commit();
    
            toast({ title: 'Success!', description: 'Your changes have been saved.' });
            
            setChanges({});
            setSelectedTransactions([]);
            
             if(searchTerm.trim() || accountFilter !== 'all') {
                const hasSearch = searchTerm.trim().length > 0;
                const hasFilter = accountFilter !== 'all';
                let searchConstraints: QueryConstraint[] = [ where('bankAccountId', '==', bankAccountId!), where('status', 'in', ['reviewed', 'allocated']), ];
                if (activeSubTab === 'expenses') { searchConstraints.push(where('amount', '<', 0)); } else { searchConstraints.push(where('amount', '>=', 0)); }
                if (hasFilter) { searchConstraints.push(where('allocatedTo.value', '==', accountFilter)); }

                const q = query(collection(db, 'aiAccountantClients', client.uid, 'transactions'), ...searchConstraints);
                const snapshot = await getDocs(q);
                let allDocs = snapshot.docs.map(d => ({ id: d.id, ...d.data() }) as ImportedTransaction);

                if (hasSearch) {
                    allDocs = allDocs.filter(tx => tx.description.toLowerCase().includes(searchTerm.toLowerCase()));
                }
                setSearchResults(allDocs);
            } else {
                refetch();
            }

        } catch (error) {
            console.error('Error saving changes:', error);
            toast({ title: 'Error', description: 'Could not save your changes.', variant: 'destructive' });
        } finally {
            setIsSaving(false);
        }
    }
    
    const handleDownloadExcel = async () => {
        if (!client || !client.uid || !bankAccountId) return;
        setIsDownloading(true);
        toast({ title: "Preparing Download...", description: "Fetching all reviewed transactions." });

        try {
            const q = query(
                collection(db, 'aiAccountantClients', client.uid, 'transactions'),
                where('bankAccountId', '==', bankAccountId),
                where('status', 'in', ['reviewed', 'allocated'])
            );
            
            const snapshot = await getDocs(q);

            const mapToExport = (tx: ImportedTransaction) => ({
                'Date': format(new Date(tx.date), 'dd/MM/yyyy'),
                'Description': tx.description,
                'Allocated To': getAllocationDescription(tx),
                'VAT Type': allVatTypes.find(v => v.name === tx.vatType)?.label || 'N/A',
                'Amount': tx.amount,
            });

            const dataToExport = snapshot.docs.map(doc => mapToExport(doc.data() as ImportedTransaction));

            const wb = XLSX.utils.book_new();
            const ws = XLSX.utils.json_to_sheet(dataToExport);
            XLSX.utils.book_append_sheet(wb, ws, "Reviewed Transactions");
            
            XLSX.writeFile(wb, `Reviewed_Transactions_${client.name.replace(/\s/g, '_')}.xlsx`);

            toast({ title: 'Download Ready!', description: 'Your Excel file has been downloaded.' });
        } catch (error) {
            console.error("Error downloading excel:", error);
            toast({ title: 'Download Failed', description: 'Could not generate the Excel file.', variant: 'destructive' });
        } finally {
            setIsDownloading(false);
        }
    };
    
    
    const handleReviewConsistency = async () => {
        if (!client || !bankAccountId) return;
        setIsConsistencyCheckOpen(false);
        toast({ title: "Analyzing Transactions...", description: "Checking for allocation inconsistencies." });

        let q = query(
            collection(db, 'aiAccountantClients', client.uid!, 'transactions'),
            where('bankAccountId', '==', bankAccountId),
            where('status', 'in', ['reviewed', 'allocated'])
        );
        if (activeSubTab === 'expenses') {
            q = query(q, where('amount', '<', 0));
        } else {
            q = query(q, where('amount', '>=', 0));
        }

        const snapshot = await getDocs(q);
        const allReviewed = snapshot.docs.map(d => ({id: d.id, ...d.data()}) as ImportedTransaction);
        
        const getGroupKey = (description: string): string => {
            const lowerDesc = description.toLowerCase();
            const commonKeywords = ['shell', 'engen', 'pnp', 'pick n pay', 'checkers', 'shoprite', 'woolworths', 'clicks', 'dischem', 'bp', 'total', 'sasol'];
            
            for (const keyword of commonKeywords) {
                if (lowerDesc.includes(keyword)) {
                    return keyword;
                }
            }
            
            const words = lowerDesc.replace(/[^a-z\s]/g, '').split(/\s+/);
            const significantWords = words.filter(w => w.length > 3 && !['cheque', 'card', 'purchase', 'payment', 'debit', 'order', 'eft', 'from', 'pty', 'ltd'].includes(w));
            
            if (significantWords.length > 0) {
                 const wordCounts = significantWords.reduce((acc, word) => {
                    acc[word] = (acc[word] || 0) + 1;
                    return acc;
                }, {} as {[key: string]: number});

                let mostSignificantWord = '';
                let maxCount = 0;

                for (const word of significantWords) {
                    const totalOccurrences = allReviewed.filter(tx => tx.description.toLowerCase().includes(word)).length;
                    if (totalOccurrences > maxCount && totalOccurrences > 1) {
                        maxCount = totalOccurrences;
                        mostSignificantWord = word;
                    }
                }
                if (mostSignificantWord) return mostSignificantWord;
            }
            
            return lowerDesc.slice(0, 15);
        };


        const groups: { [key: string]: ImportedTransaction[] } = {};
        allReviewed.forEach(tx => {
            if(tx.allocatedTo?.type === 'account') {
                const key = getGroupKey(tx.description);
                if (!groups[key]) groups[key] = [];
                groups[key].push(tx);
            }
        });
    
        const foundInconsistencies: any[] = [];
        const hardRules: {[key: string]: string} = {
            'shell': '3000-033', // Fuel
            'bp': '3000-033', // Fuel
            'engen': '3000-033', // Fuel
            'total': '3000-033', // Fuel
        };

        Object.entries(groups).forEach(([groupKey, group]) => {
            if (group.length < 2) return;
    
            const allocationCounts: { [key: string]: number } = {};
            group.forEach(tx => {
                if (tx.allocatedTo?.value) {
                    const key = `${tx.allocatedTo.value}_${tx.vatType || 'no_vat'}`;
                    allocationCounts[key] = (allocationCounts[key] || 0) + 1;
                }
            });
            
            const [mostCommonKey] = Object.entries(allocationCounts).reduce((a, b) => a[1] > b[1] ? a : b);
            const [correctAccountId, correctVatType] = mostCommonKey.split('_');
    
            group.forEach(tx => {
                const currentAllocationId = tx.allocatedTo?.value;
                const currentVatType = tx.vatType || 'no_vat';
                let isConsistent = currentAllocationId === correctAccountId && currentVatType === correctVatType;
                
                // Hard Override Rule Check
                const hardRuleAccountId = hardRules[groupKey];
                if (hardRuleAccountId && currentAllocationId !== hardRuleAccountId) {
                     foundInconsistencies.push({
                        ...tx,
                        groupKey,
                        suggestedAccountId: hardRuleAccountId,
                        suggestedVatType: 'standard_rated_purchases',
                        reason: `Critical: Merchant rule violation (should be Fuel).`
                    });
                } else if (!isConsistent && currentAllocationId) {
                    foundInconsistencies.push({
                        ...tx,
                        groupKey,
                        suggestedAccountId: correctAccountId,
                        suggestedVatType: correctVatType,
                        reason: `Inconsistent with other '${groupKey}' transactions.`
                    });
                }
            });
        });
    
        setInconsistencies(foundInconsistencies);
        if (foundInconsistencies.length > 0) {
            setSelectedCorrections(foundInconsistencies.map(inc => inc.id));
            setIsConsistencyCheckOpen(true);
        } else {
            toast({ title: 'No Inconsistencies Found!', description: 'All your allocations look consistent.' });
        }
    };
    
    const handleApplyCorrections = async () => {
        if (!client || selectedCorrections.length === 0) return;
        
        setIsSaving(true);
        toast({ title: "Applying Corrections...", description: "Updating transactions." });

        try {
            const batch = writeBatch(db);
            selectedCorrections.forEach(txId => {
                const inconsistency = inconsistencies.find(inc => inc.id === txId);
                if (inconsistency) {
                    const txRef = doc(db, 'aiAccountantClients', client.uid!, 'transactions', txId);
                    batch.update(txRef, {
                        allocatedTo: { value: inconsistency.suggestedAccountId, type: 'account' },
                        vatType: inconsistency.suggestedVatType,
                    });
                }
            });
            await batch.commit();
            toast({ title: 'Corrections Applied!', description: `${selectedCorrections.length} transactions have been updated.` });
            
            refetch();
            setIsConsistencyCheckOpen(false);

        } catch (error) {
             toast({ title: 'Error', description: 'Could not apply corrections.', variant: 'destructive' });
        } finally {
            setIsSaving(false);
        }
    };

    const handleInconsistencyChange = (txId: string, field: 'accountId' | 'vatType', value: string) => {
        setInconsistencies(prev =>
            prev.map(inc => {
                if (inc.id === txId) {
                    if (field === 'accountId') {
                        return { ...inc, suggestedAccountId: value };
                    }
                    if (field === 'vatType') {
                        return { ...inc, suggestedVatType: value };
                    }
                }
                return inc;
            })
        );
    };

    const handleBulkReallocate = (allocation: { value: string; type: "account" | "customer" | "supplier"; }, vatType: VatType) => {
      const changesToSave: { [key: string]: Partial<ImportedTransaction> } = {};
        selectedTransactions.forEach(txId => {
            changesToSave[txId] = {
                allocatedTo: allocation,
                vatType: client?.isVatRegistered ? vatType : 'no_vat',
            };
        });
        handleSaveChanges(changesToSave, selectedTransactions);
    };


    return (
        <Card>
            <CreateGeneralAccountDialog 
                client={client}
                onAccountCreated={onAccountCreated}
                open={isCreateGeneralAccountOpen}
                onOpenChange={setIsCreateGeneralAccountOpen}
            />
            <Dialog open={isConsistencyCheckOpen} onOpenChange={setIsConsistencyCheckOpen}>
                <DialogContent className="sm:max-w-4xl">
                     <DialogHeader>
                        <DialogTitle>Allocation Consistency Review</DialogTitle>
                        <DialogDescription>
                            The AI found the following inconsistencies. Select the corrections you want to apply.
                        </DialogDescription>
                    </DialogHeader>
                    {inconsistencies.length > 0 ? (
                        <div className="max-h-[60vh] overflow-y-auto pr-4">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableCell className="w-12 p-2">
                                            <Checkbox
                                                checked={selectedCorrections.length === inconsistencies.length}
                                                onCheckedChange={(checked) => setSelectedCorrections(checked ? inconsistencies.map(i => i.id) : [])}
                                            />
                                        </TableCell>
                                        <TableHead>Description</TableHead>
                                        <TableHead>Current Allocation</TableHead>
                                        <TableHead className="w-[250px]">Suggested Account</TableHead>
                                        <TableHead className="w-[200px]">Suggested VAT</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {inconsistencies.map(tx => (
                                        <TableRow key={tx.id}>
                                            <TableCell className="p-2">
                                                <Checkbox
                                                    checked={selectedCorrections.includes(tx.id)}
                                                    onCheckedChange={(checked) => {
                                                        setSelectedCorrections(prev =>
                                                            checked ? [...prev, tx.id] : prev.filter(id => id !== tx.id)
                                                        );
                                                    }}
                                                />
                                            </TableCell>
                                            <TableCell>
                                                <p className="font-semibold">{tx.description}</p>
                                                <p className="text-xs text-muted-foreground">{format(new Date(tx.date), 'dd MMMM yyyy')}</p>
                                            </TableCell>
                                             <TableCell>
                                                <p className="text-xs">{getAllocationDescription(tx)}</p>
                                                <p className="text-xs font-mono">{tx.vatType}</p>
                                            </TableCell>
                                            <TableCell>
                                                 <Select value={tx.suggestedAccountId} onValueChange={(value) => handleInconsistencyChange(tx.id, 'accountId', value)}>
                                                    <SelectTrigger className="h-8 text-xs"><SelectValue/></SelectTrigger>
                                                    <SelectContent>
                                                        {uniqueChartOfAccounts.map(acc => (
                                                            <SelectItem key={acc.id} value={acc.id}>{acc.description}</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </TableCell>
                                            <TableCell>
                                                 <Select value={tx.suggestedVatType} onValueChange={(value) => handleInconsistencyChange(tx.id, 'vatType', value as VatType)}>
                                                    <SelectTrigger className="h-8 text-xs"><SelectValue/></SelectTrigger>
                                                    <SelectContent>
                                                        {allVatTypes.map(vt => (
                                                            <SelectItem key={vt.name} value={vt.name}>{vt.label}</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    ) : (
                        <p className="text-center text-muted-foreground py-8">No inconsistencies were found.</p>
                    )}
                     <DialogFooter>
                        <Button variant="ghost" onClick={() => setIsConsistencyCheckOpen(false)}>Cancel</Button>
                        <Button onClick={handleApplyCorrections} disabled={isSaving || selectedCorrections.length === 0}>
                            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : null}
                            Apply {selectedCorrections.length} Corrections
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            <CardHeader className="p-0 border-b">
                 <Tabs value={activeSubTab} onValueChange={(value) => setActiveSubTab(value as 'expenses' | 'income')} className="w-full">
                    <TabsList className="grid w-full grid-cols-2 rounded-t-lg rounded-b-none h-auto">
                        <TabsTrigger value="expenses">Reviewed Expenses</TabsTrigger>
                        <TabsTrigger value="income">Reviewed Income</TabsTrigger>
                    </TabsList>
                </Tabs>
                <div className="p-4 flex flex-col md:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-2 flex-wrap">
                        <Button variant="outline" onClick={handleDownloadExcel} disabled={isDownloading}>
                            {isDownloading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                            Download Excel
                        </Button>
                         <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button variant="outline">
                                    <Sparkles className="mr-2 h-4 w-4" /> Review Consistency
                                </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                    <AlertDialogTitle>Review Allocation Consistency</AlertDialogTitle>
                                    <AlertDialogDescription>
                                        This tool will analyze your reviewed transactions to find allocations that are inconsistent with how you've categorized similar items in the past. It will then suggest corrections. Do you want to proceed?
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction onClick={handleReviewConsistency}>Yes, Review Consistency</AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                         <Button onClick={() => handleSaveChanges(changes, Object.keys(changes))} disabled={isSaving || Object.keys(changes).length === 0}>
                            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                            Save Changes
                        </Button>
                    </div>
                     <div className="flex items-center gap-2 flex-wrap justify-end">
                        <DateRangePicker onDateChange={setDateRange} />
                        <Select value={accountFilter} onValueChange={setAccountFilter}>
                            <SelectTrigger className="w-full md:w-[200px]">
                                <SelectValue placeholder="Filter by account..." />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Accounts</SelectItem>
                                {accountsWithTransactions.map(acc => (
                                    <SelectItem key={acc.id} value={acc.id}>{acc.description}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <div className="relative w-full md:w-auto">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                type="search"
                                placeholder="Search descriptions..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-8 w-full md:w-48"
                            />
                        </div>
                     </div>
                </div>
            </CardHeader>
            <CardContent className="p-0">
                 <div className="overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableCell className="w-12 p-2">
                                     <Checkbox
                                        checked={displayedDocuments.length > 0 && selectedTransactions.length === displayedDocuments.length}
                                        onCheckedChange={(checked) => {
                                            setSelectedTransactions(checked ? displayedDocuments.map(tx => tx.id) : []);
                                        }}
                                    />
                                </TableCell>
                                <TableHead><Button variant="ghost" onClick={() => handleSort('date')}>Date <ArrowUpDown className="ml-2 h-4 w-4 inline" /></Button></TableHead>
                                <TableHead><Button variant="ghost" onClick={() => handleSort('description')}>Description <ArrowUpDown className="ml-2 h-4 w-4 inline" /></Button></TableHead>
                                <TableHead><Button variant="ghost" onClick={() => handleSort('allocatedTo')}>Allocated To <ArrowUpDown className="ml-2 h-4 w-4 inline" /></Button></TableHead>
                                {client?.isVatRegistered && <TableHead><Button variant="ghost" onClick={() => handleSort('vatType')}>VAT Type <ArrowUpDown className="ml-2 h-4 w-4 inline" /></Button></TableHead>}
                                <TableHead className="text-right"><Button variant="ghost" onClick={() => handleSort('amount')}>Amount <ArrowUpDown className="ml-2 h-4 w-4 inline" /></Button></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading || isSearching || isFetchingAll ? (
                                <TableRow><TableCell colSpan={6} className="text-center h-24"><Loader2 className="animate-spin mx-auto" /></TableCell></TableRow>
                            ) : displayedDocuments.length === 0 ? (
                                <TableRow><TableCell colSpan={6} className="text-center h-24 text-muted-foreground">No reviewed transactions found.</TableCell></TableRow>
                            ) : (
                                displayedDocuments.map(tx => (
                                    <TableRow key={tx.id} data-state={selectedTransactions.includes(tx.id) && "selected"}>
                                        <TableCell className="p-2">
                                            <Checkbox
                                                checked={selectedTransactions.includes(tx.id)}
                                                onCheckedChange={(checked) => {
                                                    setSelectedTransactions(prev =>
                                                        checked ? [...prev, tx.id] : prev.filter(id => id !== tx.id)
                                                    );
                                                }}
                                            />
                                        </TableCell>
                                        <TableCell>{new Date(tx.date).toLocaleDateString('en-GB')}</TableCell>
                                        <TableCell className="whitespace-normal break-words">{tx.description}</TableCell>
                                        <TableCell className="w-[250px]">
                                            <Select
                                                value={`${changes[tx.id]?.allocatedTo?.type || tx.allocatedTo?.type}:${changes[tx.id]?.allocatedTo?.value || tx.allocatedTo?.value}`}
                                                onValueChange={(value) => handleAllocationChange(tx.id, value)}
                                            >
                                                <SelectTrigger><SelectValue /></SelectTrigger>
                                                <SelectContent>
                                                     <Button variant="ghost" className="w-full justify-start text-primary" onClick={() => setIsCreateGeneralAccountOpen(true)}><PlusCircle className="mr-2 h-4 w-4"/>Create new account</Button>
                                                     <Separator className="my-1"/>
                                                    <SelectGroup>
                                                        <Label>Accounts</Label>
                                                        {uniqueChartOfAccounts.map(acc => (
                                                            <SelectItem key={acc.id} value={`account:${acc.id}`}>{acc.description}</SelectItem>
                                                        ))}
                                                    </SelectGroup>
                                                     <SelectGroup>
                                                        <Label>Customers</Label>
                                                        {customers.map(c => (
                                                            <SelectItem key={c.id} value={`customer:${c.id}`}>{c.name}</SelectItem>
                                                        ))}
                                                    </SelectGroup>
                                                </SelectContent>
                                            </Select>
                                        </TableCell>
                                        {client?.isVatRegistered && (
                                            <TableCell className="w-[200px]">
                                                <Select
                                                    value={changes[tx.id]?.vatType || tx.vatType}
                                                    onValueChange={(value) => handleVatChange(tx.id, value as VatType)}
                                                    disabled={tx.allocatedTo?.type === 'customer'}
                                                >
                                                    <SelectTrigger><SelectValue/></SelectTrigger>
                                                    <SelectContent>
                                                        {allVatTypes.map(vt => (
                                                            <SelectItem key={vt.name} value={vt.name}>{vt.label}</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </TableCell>
                                        )}
                                        <TableCell className="text-right font-mono">{formatPrice(tx.amount)}</TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
             <CardFooter className="flex items-center justify-between p-4">
                 <div className="flex items-center gap-2">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" disabled={selectedTransactions.length === 0}>
                                <span>Reallocate Selected</span><ChevronsUpDown className="ml-2 h-4 w-4"/>
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="w-64">
                            {client?.chartOfAccounts?.map(acc => (
                                <DropdownMenuSub key={acc.id}>
                                    <DropdownMenuSubTrigger><span>{acc.description}</span></DropdownMenuSubTrigger>
                                    <DropdownMenuSubContent>
                                        {client.isVatRegistered ? allVatTypes.map(vat => (
                                            <DropdownMenuItem key={vat.name} onSelect={() => handleBulkReallocate({value: acc.id, type: 'account'}, vat.name)}>
                                                {vat.label}
                                            </DropdownMenuItem>
                                        )) : (
                                            <DropdownMenuItem onSelect={() => handleBulkReallocate({value: acc.id, type: 'account'}, 'no_vat')}>
                                                No VAT
                                            </DropdownMenuItem>
                                        )}
                                    </DropdownMenuSubContent>
                                </DropdownMenuSub>
                            ))}
                        </DropdownMenuContent>
                    </DropdownMenu>

                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button variant="destructive" disabled={selectedTransactions.length === 0}>Delete Selected</Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                <AlertDialogDescription>This will permanently delete {selectedTransactions.length} selected transaction(s). This cannot be undone.</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={handleBulkDelete}>Yes, Delete</AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                 </div>
                <div className="flex items-center gap-2">
                    {!(searchTerm.trim() || accountFilter !== 'all') && (
                        <>
                        <Button variant="outline" size="sm" onClick={() => setShowAll(!showAll)}>
                            {showAll ? 'Show Paginated' : 'Show All'}
                        </Button>
                        {!showAll && (
                            <div className="flex items-center space-x-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={goToPreviousPage}
                                    disabled={!canGoPrev || isLoading}
                                >
                                    <ChevronLeft className="h-4 w-4" />
                                    Previous
                                </Button>
                                <span className="text-sm font-medium">
                                    Page {currentPage}
                                </span>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={goToNextPage}
                                    disabled={!canGoNext || isLoading}
                                >
                                    Next
                                    <ChevronRight className="h-4 w-4" />
                                </Button>
                            </div>
                        )}
                        </>
                    )}
                </div>
            </CardFooter>
        </Card>
    );
});
ReviewedTab.displayName = 'ReviewedTab';

const ForReviewTab = React.forwardRef<
    { refetch: () => void },
    { client: User | null; bankAccountId: string | null; fetchClientData: () => void; customers: ClientCustomer[] }
>(({ client, bankAccountId, fetchClientData, customers }, ref) => {
    const { toast } = useToast();
    const [activeSubTab, setActiveSubTab] = useState<'expenses' | 'income'>('expenses');
    const [selectedTransactions, setSelectedTransactions] = useState<string[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [isApprovingAll, setIsApprovingAll] = useState(false);
    const [isDownloading, setIsDownloading] = useState(false);
    const [showAll, setShowAll] = useState(false);
    const [allTransactions, setAllTransactions] = useState<ImportedTransaction[]>([]);
    const [isFetchingAll, setIsFetchingAll] = useState(false);
    
    type SortField = 'date' | 'description' | 'amount';
    type SortDirection = 'asc' | 'desc';
    const [sortField, setSortField] = useState<SortField>('date');
    const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

    const handleSort = (field: SortField) => {
        if (sortField === field) {
            setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDirection('asc');
        }
    };
    
    const reviewTransactionsQuery = useMemo(() => {
        if (!client?.uid || !bankAccountId) return null;
        
        let constraints: QueryConstraint[] = [
            where('bankAccountId', '==', bankAccountId),
            where('status', '==', 'review'),
        ];
        
        if (activeSubTab === 'expenses') {
            constraints.push(where('amount', '<', 0));
        } else {
            constraints.push(where('amount', '>=', 0));
        }

        if(sortField !== 'amount') {
             constraints.push(orderBy('amount', activeSubTab === 'expenses' ? 'asc' : 'desc'));
             constraints.push(orderBy(sortField, sortDirection));
        } else {
             constraints.push(orderBy('amount', sortDirection));
        }
        
        return query(collection(db, 'aiAccountantClients', client.uid, 'transactions'), ...constraints);
    }, [client?.uid, bankAccountId, activeSubTab, sortField, sortDirection]);

    const {
        documents,
        isLoading,
        goToNextPage,
        goToPreviousPage,
        canGoNext,
        canGoPrev,
        currentPage,
        refetch
    } = usePaginatedFirestore<ImportedTransaction>({ baseQuery: reviewTransactionsQuery, pageSize: PAGE_SIZE });

     const transactions = useMemo(() => {
        let docs = showAll ? allTransactions : (searchTerm ? documents.filter(tx => tx.description.toLowerCase().includes(searchTerm.toLowerCase())) : documents);
        
        if (sortField === 'description') {
            docs.sort((a, b) => {
                const comparison = a.description.localeCompare(b.description);
                return sortDirection === 'asc' ? comparison : -comparison;
            });
        }
        
        return docs;
    }, [documents, searchTerm, showAll, allTransactions, sortField, sortDirection]);
    
    React.useImperativeHandle(ref, () => ({
        refetch,
    }));
    
    useEffect(() => {
        refetch();
    }, [activeSubTab, refetch]);
    
    useEffect(() => {
        const fetchAll = async () => {
            if (!reviewTransactionsQuery) return;
            setIsFetchingAll(true);
            try {
                 // @ts-ignore
                const unlimitedQuery = query(reviewTransactionsQuery.firestore, reviewTransactionsQuery.path, ...reviewTransactionsQuery._query.constraints.filter((c: any) => c.type !== 'limit'));
                const snapshot = await getDocs(unlimitedQuery);
                const allDocs = snapshot.docs.map(d => ({id: d.id, ...d.data()}) as ImportedTransaction);
                setAllTransactions(allDocs);
            } catch (error) {
                console.error("Error fetching all transactions:", error);
                toast({ title: 'Error', description: 'Could not fetch all transactions.', variant: 'destructive' });
            } finally {
                setIsFetchingAll(false);
            }
        };

        if (showAll) {
            fetchAll();
        } else {
            setAllTransactions([]);
        }
    }, [showAll, reviewTransactionsQuery, toast]);

    const handleBulkAction = async (action: 'approve' | 'reject') => {
        if (!client || !client.uid || selectedTransactions.length === 0) return;

        toast({ title: "Processing...", description: `Updating ${selectedTransactions.length} transactions.` });
        
        const updatePromises: Promise<void>[] = [];
        for (let i = 0; i < selectedTransactions.length; i += BATCH_SIZE) {
            const batch = writeBatch(db);
            const chunk = selectedTransactions.slice(i, i + BATCH_SIZE);
            chunk.forEach(txId => {
                const tx = transactions.find(t => t.id === txId);
                if (!tx) return;
                const transactionRef = doc(db, 'aiAccountantClients', client.uid!, 'transactions', txId);
                if (action === 'approve') {
                    batch.update(transactionRef, { status: 'allocated', allocatedAt: new Date() });
                    if (tx.allocatedTo?.type === 'account' && !client.allocationRules?.some(rule => tx.description.toLowerCase().includes(rule.keywords[0]))) {
                         const coreKeyword = tx.description.split(/\s+/)[0].toLowerCase();
                        const newRule: Partial<AllocationRule> = {
                            description: `Auto-generated for: ${tx.description}`,
                            keywords: [coreKeyword],
                            accountId: tx.allocatedTo.value,
                            vatType: client.isVatRegistered ? tx.vatType || 'no_vat' : 'no_vat',
                            type: 'soft',
                        };
                        const clientRef = doc(db, 'aiAccountantClients', client.uid!);
                        batch.update(clientRef, { allocationRules: arrayUnion(newRule) });
                    }
                } else { // reject
                    batch.update(transactionRef, { status: 'new', allocatedTo: null, vatType: null, allocatedAt: null });
                }
            });
            updatePromises.push(batch.commit());
        }

        try {
            await Promise.all(updatePromises);
            toast({ title: `Transactions ${action === 'approve' ? 'Approved' : 'Rejected'}`, description: `${selectedTransactions.length} transactions have been updated.` });
            setSelectedTransactions([]);
            refetch();
            if (action === 'approve') fetchClientData();
        } catch (error) {
            console.error(`Error during bulk ${action}:`, error);
            toast({ title: "Action Failed", variant: "destructive" });
        }
    }
    
    const handleApproveAll = async () => {
        if (!client || !client.uid || !bankAccountId) return;
        
        setIsApprovingAll(true);
        toast({ title: "Approving All...", description: `Approving all pending ${activeSubTab}.` });

        try {
            let q = query(
                collection(db, 'aiAccountantClients', client.uid, 'transactions'), 
                where('bankAccountId', '==', bankAccountId), 
                where('status', '==', 'review')
            );
             if (activeSubTab === 'expenses') {
                q = query(q, where('amount', '<', 0));
            } else {
                q = query(q, where('amount', '>=', 0));
            }

            const snapshot = await getDocs(q);
            if (snapshot.empty) {
                toast({ title: "No Transactions to Approve", description: "There are no items pending review in this category." });
                setIsApprovingAll(false);
                return;
            }
            
            const allDocs = snapshot.docs;
            for(let i = 0; i < allDocs.length; i+= BATCH_SIZE) {
                const batch = writeBatch(db);
                const chunk = allDocs.slice(i, i + BATCH_SIZE);
                chunk.forEach(doc => {
                    batch.update(doc.ref, { status: 'allocated', allocatedAt: new Date() });
                });
                await batch.commit();
            }

            toast({ title: 'All Approved!', description: `${snapshot.size} transactions have been approved and allocated.` });
            refetch();
            fetchClientData();

        } catch (error) {
            console.error("Error approving all transactions:", error);
            toast({ title: "Approval Failed", description: "An error occurred while approving all transactions.", variant: "destructive" });
        } finally {
            setIsApprovingAll(false);
        }
    };

    const getAllocationDescription = (tx: ImportedTransaction) => {
        if (!tx.allocatedTo) return 'N/A';
        if (tx.allocatedTo.type === 'customer') {
            return customers.find(c => c.id === tx.allocatedTo?.value)?.name || 'Unknown Customer';
        }
        return client?.chartOfAccounts?.find(acc => acc.id === tx.allocatedTo?.value)?.description || 'Unknown Account';
    }
    
    const handleDownloadExcel = async () => {
        if (!client || !client.uid || !bankAccountId) return;
        setIsDownloading(true);
        toast({ title: "Preparing Download...", description: "Fetching all transactions for review." });

        try {
            const expensesQuery = query(
                collection(db, 'aiAccountantClients', client.uid, 'transactions'),
                where('bankAccountId', '==', bankAccountId),
                where('status', '==', 'review'),
                where('amount', '<', 0)
            );
            const incomeQuery = query(
                collection(db, 'aiAccountantClients', client.uid, 'transactions'),
                where('status', '==', 'review'),
                where('amount', '>=', 0)
            );
            
            const [expensesSnapshot, incomeSnapshot] = await Promise.all([
                getDocs(expensesQuery),
                getDocs(incomeQuery),
            ]);

            const mapToExport = (tx: ImportedTransaction) => ({
                'Date': format(new Date(tx.date), 'dd/MM/yyyy'),
                'Description': tx.description,
                'Suggested Allocation': getAllocationDescription(tx),
                'Suggested VAT': allVatTypes.find(v => v.name === tx.vatType)?.label || 'N/A',
                'Amount': tx.amount,
            });

            const expensesData = expensesSnapshot.docs.map(doc => mapToExport(doc.data() as ImportedTransaction));
            const incomeData = incomeSnapshot.docs.map(doc => mapToExport(doc.data() as ImportedTransaction));

            const wb = XLSX.utils.book_new();
            if (expensesData.length > 0) {
                const expensesSheet = XLSX.utils.json_to_sheet(expensesData);
                XLSX.utils.book_append_sheet(wb, expensesSheet, "Expenses For Review");
            }
            if (incomeData.length > 0) {
                const incomeSheet = XLSX.utils.json_to_sheet(incomeData);
                XLSX.utils.book_append_sheet(wb, incomeSheet, "Income For Review");
            }
            
            XLSX.writeFile(wb, `For_Review_Transactions_${client.name.replace(/\s/g, '_')}.xlsx`);

            toast({ title: 'Download Ready!', description: 'Your Excel file has been downloaded.' });
        } catch (error) {
            console.error("Error downloading excel:", error);
            toast({ title: 'Download Failed', description: 'Could not generate the Excel file.', variant: 'destructive' });
        } finally {
            setIsDownloading(false);
        }
    };


    return (
        <Card>
             <CardHeader className="p-0 border-b">
                 <Tabs value={activeSubTab} onValueChange={(value) => setActiveSubTab(value as 'expenses' | 'income')} className="w-full">
                    <TabsList className="grid w-full grid-cols-2 rounded-t-lg rounded-b-none h-auto">
                        <TabsTrigger value="expenses">Review Expenses</TabsTrigger>
                        <TabsTrigger value="income">Review Income</TabsTrigger>
                    </TabsList>
                </Tabs>
                 <div className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Button onClick={() => handleBulkAction('approve')} disabled={selectedTransactions.length === 0}>
                            <CheckCircle className="mr-2 h-4 w-4" />Approve Selected
                        </Button>
                         <Button onClick={handleApproveAll} disabled={isApprovingAll || isLoading || transactions.length === 0}>
                            {isApprovingAll ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <CheckCircle className="mr-2 h-4 w-4" />}
                            Approve All
                        </Button>
                        <Button variant="destructive" onClick={() => handleBulkAction('reject')} disabled={selectedTransactions.length === 0}>
                            <RotateCcw className="mr-2 h-4 w-4" />Reject Selected
                        </Button>
                        <Button variant="outline" onClick={handleDownloadExcel} disabled={isDownloading}>
                            {isDownloading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                            Download Excel
                        </Button>
                    </div>
                     <div className="relative">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            type="search"
                            placeholder="Search descriptions..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-8 w-64"
                        />
                    </div>
                 </div>
            </CardHeader>
            <CardContent className="p-0">
                 <div className="overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableCell className="w-12 p-2">
                                     <Checkbox
                                        checked={transactions.length > 0 && selectedTransactions.length === transactions.length}
                                        onCheckedChange={(checked) => {
                                            setSelectedTransactions(checked ? transactions.map(tx => tx.id) : []);
                                        }}
                                    />
                                </TableCell>
                                <TableHead><Button variant="ghost" onClick={() => handleSort('date')}>Date <ArrowUpDown className="ml-2 h-4 w-4 inline" /></Button></TableHead>
                                <TableHead><Button variant="ghost" onClick={() => handleSort('description')}>Description <ArrowUpDown className="ml-2 h-4 w-4 inline" /></Button></TableHead>
                                <TableHead>Suggested Allocation</TableHead>
                                {client?.isVatRegistered && <TableHead>Suggested VAT</TableHead>}
                                <TableHead className="text-right"><Button variant="ghost" onClick={() => handleSort('amount')}>Amount <ArrowUpDown className="ml-2 h-4 w-4 inline" /></Button></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading || isFetchingAll ? (
                                <TableRow><TableCell colSpan={6} className="text-center h-24"><Loader2 className="animate-spin mx-auto" /></TableCell></TableRow>
                            ) : transactions.length === 0 ? (
                                <TableRow><TableCell colSpan={6} className="text-center h-24 text-muted-foreground">No transactions are pending review.</TableCell></TableRow>
                            ) : (
                                transactions.map(tx => (
                                    <TableRow key={tx.id} data-state={selectedTransactions.includes(tx.id) && "selected"}>
                                        <TableCell className="p-2">
                                            <Checkbox
                                                checked={selectedTransactions.includes(tx.id)}
                                                onCheckedChange={(checked) => {
                                                    setSelectedTransactions(prev =>
                                                        checked ? [...prev, tx.id] : prev.filter(id => id !== tx.id)
                                                    );
                                                }}
                                            />
                                        </TableCell>
                                        <TableCell>{new Date(tx.date).toLocaleDateString('en-GB')}</TableCell>
                                        <TableCell className="whitespace-normal break-words">{tx.description}</TableCell>
                                        <TableCell>{getAllocationDescription(tx)}</TableCell>
                                        {client?.isVatRegistered && <TableCell>{allVatTypes.find(v => v.name === tx.vatType)?.label || 'N/A'}</TableCell>}
                                        <TableCell className="text-right font-mono">{formatPrice(tx.amount)}</TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
            <CardFooter className="flex items-center justify-center p-4">
                 <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => setShowAll(!showAll)}>
                        {showAll ? 'Show Paginated' : 'Show All'}
                    </Button>
                    {!searchTerm && !showAll && (
                        <div className="flex items-center space-x-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={goToPreviousPage}
                                disabled={!canGoPrev || isLoading}
                            >
                                <ChevronLeft className="h-4 w-4" />
                                Previous
                            </Button>
                            <span className="text-sm font-medium">
                                Page {currentPage}
                            </span>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={goToNextPage}
                                disabled={!canGoNext || isLoading}
                            >
                                Next
                                <ChevronRight className="h-4 w-4" />
                            </Button>
                        </div>
                    )}
                 </div>
            </CardFooter>
        </Card>
    );
});
ForReviewTab.displayName = 'ForReviewTab';


export default function BankTransactionsPage() {
    const [client, setClient] = useState<User | null>(null);
    const [customers, setCustomers] = useState<ClientCustomer[]>([]);
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [bankAccounts, setBankAccounts] = useState<ChartOfAccount[]>([]);
    const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const params = useParams();
    const searchParams = useSearchParams();
    const clientId = params.clientId as string;
    const { toast } = useToast();
    const [activeTab, setActiveTab] = useState<'new' | 'review' | 'ai_workflow' | 'reviewed'>('new');
    const [isCreateAccountOpen, setIsCreateAccountOpen] = useState(false);
    const [isEditAccountOpen, setIsEditAccountOpen] = useState(false);
    const newTransactionsTabRef = useRef<{ refetch: () => void }>(null);
    const forReviewTabRef = useRef<{ refetch: () => void }>(null);
    const reviewedTabRef = useRef<{ refetch: () => void; }>(null);
    const [allTransactions, setAllTransactions] = useState<(ImportedTransaction | AllocatedTransaction)[]>([]);
    const [globalRules, setGlobalRules] = useState<AllocationRule[]>([]);
    
    const fetchClientAndRelatedData = useCallback(async () => {
        if (!clientId) return;
        
        try {
            const clientRef = doc(db, 'aiAccountantClients', clientId);
            const clientSnap = await getDoc(clientRef);
            
            if (clientSnap.exists()) {
                const clientData = { id: clientSnap.id, ...clientSnap.data(), uid: clientSnap.id } as User;
                setClient(clientData);

                const cashbookAccounts = clientData.chartOfAccounts?.filter(
                    acc => acc.accountNumber.startsWith('8400-')
                ).sort((a, b) => a.accountNumber.localeCompare(b.accountNumber)) || [];

                setBankAccounts(cashbookAccounts);
                
                // Only set the selected account from query or default on initial load
                if (selectedAccountId === null) {
                    const accountIdFromQuery = searchParams.get('accountId');
                    if (accountIdFromQuery && cashbookAccounts.some(acc => acc.id === accountIdFromQuery)) {
                        setSelectedAccountId(accountIdFromQuery);
                    } else if (cashbookAccounts.length > 0) {
                        setSelectedAccountId(cashbookAccounts[0].id);
                    }
                }
            } else {
                toast({ title: 'Error', description: 'Client not found.', variant: 'destructive' });
            }

            const customersQuery = query(collection(db, `aiAccountantClients/${clientId}/customers`));
            const customersSnapshot = await getDocs(customersQuery);
            setCustomers(customersSnapshot.docs.map(d => ({id: d.id, ...d.data()} as ClientCustomer)));

            const invoicesQuery = query(collection(db, `aiAccountantClients/${clientId}/invoices`));
            const invoicesSnapshot = await getDocs(invoicesQuery);
            setInvoices(invoicesSnapshot.docs.map(d => ({id: d.id, ...d.data()} as Invoice)));

            const globalRulesQuery = query(collection(db, 'allocationRules'));
            const globalRulesSnapshot = await getDocs(globalRulesQuery);
            setGlobalRules(globalRulesSnapshot.docs.map(d => ({ id: d.id, ...d.data() } as AllocationRule)));

        } catch (e) {
            toast({ title: 'Error', description: 'Failed to fetch client data.', variant: 'destructive' });
        } finally {
            setIsLoading(false);
        }
    }, [clientId, toast, searchParams, selectedAccountId]);


    useEffect(() => {
        fetchClientAndRelatedData();
    }, [fetchClientAndRelatedData]);
    
    useEffect(() => {
        if (!clientId) return;
        const q = query(collection(db, "aiAccountantClients", clientId, "transactions"));
        const unsubscribe = onSnapshot(q, (querySnapshot) => {
            const transactions = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as (ImportedTransaction | AllocatedTransaction)));
            setAllTransactions(transactions);
        });
        return () => unsubscribe();
    }, [clientId]);


    const unallocatedCount = useMemo(() => {
        if (!selectedAccountId) return 0;
        return allTransactions.filter(tx => tx.bankAccountId === selectedAccountId && tx.status === 'new').length;
    }, [allTransactions, selectedAccountId]);
    
    const selectedAccount = useMemo(() => {
        return bankAccounts.find(acc => acc.id === selectedAccountId);
    }, [bankAccounts, selectedAccountId]);

    const selectedAccountBalance = useMemo(() => {
        if (!selectedAccount) return 0;
        return allTransactions
            .filter(tx => tx.bankAccountId === selectedAccount.id)
            .reduce((sum, tx) => sum + tx.amount, 0);
    }, [allTransactions, selectedAccountId]);
    
    const handleDeleteBankAccount = async () => {
        if (!client || !client.uid || !selectedAccountId) return;
        
        setIsLoading(true);
        toast({ title: "Deleting Account...", description: "Removing the bank account and all its transactions."});

        try {
            const batch = writeBatch(db);

            const updatedAccounts = client.chartOfAccounts?.filter(acc => acc.id !== selectedAccountId) || [];
            const clientRef = doc(db, 'aiAccountantClients', client.uid);
            batch.update(clientRef, { chartOfAccounts: updatedAccounts });

            const transactionsQuery = query(collection(db, 'aiAccountantClients', client.uid, 'transactions'), where('bankAccountId', '==', selectedAccountId));
            const transactionsSnapshot = await getDocs(transactionsQuery);
            transactionsSnapshot.forEach(doc => {
                batch.delete(doc.ref);
            });
            
            await batch.commit();

            toast({ title: "Bank Account Deleted", description: `Account and its ${transactionsSnapshot.size} transactions have been permanently removed.`});
            
            setSelectedAccountId(null);
            fetchClientAndRelatedData();

        } catch (error) {
            console.error("Error deleting bank account:", error);
            toast({ title: "Deletion Failed", variant: 'destructive'});
            setIsLoading(false);
        }
    };
    
    const handleClearBankTransactions = async () => {
        if (!client || !client.uid || !selectedAccountId) return;

        toast({ title: "Clearing Transactions...", description: "This may take a moment."});
        
        try {
            const transactionsQuery = query(collection(db, 'aiAccountantClients', client.uid, 'transactions'), where('bankAccountId', '==', selectedAccountId));
            const transactionsSnapshot = await getDocs(transactionsQuery);
            
            if (transactionsSnapshot.empty) {
                toast({ title: "No Transactions Found", description: "There are no transactions to clear for this account."});
                return;
            }

            for (let i = 0; i < transactionsSnapshot.docs.length; i += BATCH_SIZE) {
                const batch = writeBatch(db);
                const chunk = transactionsSnapshot.docs.slice(i, i + BATCH_SIZE);
                chunk.forEach(doc => {
                    batch.delete(doc.ref);
                });
                await batch.commit();
            }

            toast({ title: "Transactions Cleared", description: `Successfully deleted ${transactionsSnapshot.size} transaction(s).` });
            
            handleImportComplete();

        } catch(error) {
            console.error("Error clearing transactions:", error);
            toast({ title: "Error", description: "Could not clear transactions.", variant: "destructive"});
        }
    }


    const handleImportComplete = () => {
        if (newTransactionsTabRef.current) newTransactionsTabRef.current.refetch();
        if (forReviewTabRef.current) forReviewTabRef.current.refetch();
        if (reviewedTabRef.current) reviewedTabRef.current.refetch();
    }
    
    const currentAccountTransactions = useMemo(() => {
        return allTransactions.filter(tx => tx.bankAccountId === selectedAccountId) as ImportedTransaction[];
    }, [allTransactions, selectedAccountId]);
    
    return (
        <div className="space-y-4">
            <h1 className="text-2xl font-bold tracking-tight">Banking</h1>
             <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 p-4 bg-card border rounded-lg">
                <div className="flex w-full items-center justify-between md:w-auto md:justify-start md:gap-4">
                    <div className="grid gap-2">
                        <Label htmlFor="bank-account-selector">Bank Account</Label>
                        <div className="flex gap-2">
                            <Select
                                value={selectedAccountId || ''}
                                onValueChange={setSelectedAccountId}
                                disabled={bankAccounts.length === 0}
                            >
                                <SelectTrigger id="bank-account-selector" className="w-[200px] sm:w-[250px]">
                                    <SelectValue placeholder={bankAccounts.length > 0 ? "Select a bank account" : "No bank accounts found"} />
                                </SelectTrigger>
                                <SelectContent>
                                    {bankAccounts.map(account => (
                                        <SelectItem key={account.id} value={account.id}>
                                            {account.description}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="outline" size="icon"><Settings className="h-4 w-4" /></Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent>
                                    <DropdownMenuItem onSelect={() => setIsCreateAccountOpen(true)}><PlusCircle className="mr-2 h-4 w-4"/>Create New Account</DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem onSelect={() => setIsEditAccountOpen(true)} disabled={!selectedAccount}><Edit className="mr-2 h-4 w-4"/>Edit Selected Account</DropdownMenuItem>
                                    <AlertDialog>
                                        <AlertDialogTrigger asChild>
                                            <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-destructive" disabled={!selectedAccount}>
                                                <Trash2 className="mr-2 h-4 w-4"/>Delete Selected Account
                                            </DropdownMenuItem>
                                        </AlertDialogTrigger>
                                        <AlertDialogContent>
                                            <AlertDialogHeader>
                                                <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                                <AlertDialogDescription>This will permanently delete the account "{selectedAccount?.description}" and ALL of its associated transactions. This action cannot be undone.</AlertDialogDescription>
                                            </AlertDialogHeader>
                                            <AlertDialogFooter>
                                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                <AlertDialogAction onClick={handleDeleteBankAccount}>Yes, Delete Everything</AlertDialogAction>
                                            </AlertDialogFooter>
                                        </AlertDialogContent>
                                    </AlertDialog>
                                     <AlertDialog>
                                        <AlertDialogTrigger asChild>
                                            <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-destructive" disabled={!selectedAccount}>
                                                <Ban className="mr-2 h-4 w-4" />Clear Bank Transactions
                                            </DropdownMenuItem>
                                        </AlertDialogTrigger>
                                        <AlertDialogContent>
                                            <AlertDialogHeader>
                                                <AlertDialogTitle>Clear All Transactions?</AlertDialogTitle>
                                                <AlertDialogDescription>This will permanently delete ALL transactions associated with the account "{selectedAccount?.description}". The account itself will not be deleted. This action cannot be undone.</AlertDialogDescription>
                                            </AlertDialogHeader>
                                            <AlertDialogFooter>
                                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                <AlertDialogAction onClick={handleClearBankTransactions}>Yes, Clear All Transactions</AlertDialogAction>
                                            </AlertDialogFooter>
                                        </AlertDialogContent>
                                    </AlertDialog>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>
                    </div>
                     <div className="text-center">
                        <p className="text-xs text-muted-foreground">Unallocated</p>
                        <p className="text-lg font-semibold flex items-center gap-2 justify-center">
                            {unallocatedCount > 0 && <AlertTriangle className="h-4 w-4 text-destructive" />}
                            {unallocatedCount}
                        </p>
                    </div>
                     <div className="text-center">
                        <p className="text-xs text-muted-foreground">Current Balance</p>
                        <p className="text-lg font-semibold">{formatPrice(selectedAccountBalance)}</p>
                    </div>
                </div>

                <div className="flex items-center gap-2 sm:gap-4 w-full md:w-auto justify-end">
                    {client && selectedAccountId && <ImportDialog client={client} bankAccountId={selectedAccountId} currentBalance={selectedAccountBalance} onImportComplete={handleImportComplete} globalRules={globalRules} />}
                </div>
            </div>

            <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as any)}>
                <TabsList>
                    <TabsTrigger value="new">New Transactions</TabsTrigger>
                    <TabsTrigger value="ai_workflow">AI Workflow</TabsTrigger>
                    <TabsTrigger value="review">Pending Review</TabsTrigger>
                    <TabsTrigger value="reviewed">Reviewed Transactions</TabsTrigger>
                </TabsList>
                <TabsContent value="new" className="mt-0">
                   <NewTransactionsTab 
                        ref={newTransactionsTabRef}
                        client={client} 
                        customers={customers}
                        invoices={invoices}
                        bankAccountId={selectedAccountId} 
                        fetchClientData={fetchClientAndRelatedData}
                        globalRules={globalRules}
                        onAccountCreated={fetchClientAndRelatedData}
                    />
                </TabsContent>
                <TabsContent value="ai_workflow" className="mt-0">
                    <AIWorkflowTab client={client} bankAccountId={selectedAccountId} chartOfAccounts={client?.chartOfAccounts || []} fetchClientData={fetchClientAndRelatedData} />
                </TabsContent>
                 <TabsContent value="review" className="mt-0">
                   <ForReviewTab 
                        ref={forReviewTabRef}
                        client={client} 
                        bankAccountId={selectedAccountId} 
                        customers={customers}
                        fetchClientData={fetchClientAndRelatedData}
                    />
                </TabsContent>
                <TabsContent value="reviewed" className="mt-0">
                    <ReviewedTab 
                        ref={reviewedTabRef}
                        client={client} 
                        bankAccountId={selectedAccountId} 
                        customers={customers}
                        onAccountCreated={fetchClientAndRelatedData}
                    />
                </TabsContent>
            </Tabs>
            {client && <CreateAccountDialog client={client} onAccountCreated={fetchClientAndRelatedData} open={isCreateAccountOpen} onOpenChange={setIsCreateAccountOpen}/>}
            {client && selectedAccount && <EditAccountDialog client={client} account={selectedAccount} onAccountUpdated={fetchClientAndRelatedData} open={isEditAccountOpen} onOpenChange={setIsEditAccountOpen}/>}
        </div>
    );
}

const AIWorkflowTab = ({ client, bankAccountId, chartOfAccounts, fetchClientData }: { client: User | null; bankAccountId: string | null; chartOfAccounts: ChartOfAccount[], fetchClientData: () => void; }) => {
    const { toast, dismiss } = useToast();
    const [isProcessing, setIsProcessing] = useState(false);
    const [groupSuggestions, setGroupSuggestions] = useState<Record<string, AIAllocationResult>>({});
    
    const baseQuery = useMemo(() => {
        if (!client?.uid || !bankAccountId) return null;
        return query(
            collection(db, 'aiAccountantClients', client.uid, 'transactions'), 
            where('bankAccountId', '==', bankAccountId),
            where('status', 'in', ['ai_processing', 'ai_review'])
        );
    }, [client?.uid, bankAccountId]);

    const { documents: transactions, isLoading, refetch } = usePaginatedFirestore<ImportedTransaction>({ baseQuery, pageSize: 500 });
    
    const handleProcessWorkflow = async () => {
        if (!client || !client.uid || transactions.length === 0) return;
        const transactionsToProcess = transactions.filter(tx => tx.status === 'ai_processing');
        if (transactionsToProcess.length === 0) {
            toast({ title: 'No transactions to process.' });
            return;
        }

        setIsProcessing(true);
        const toastId = toast({ title: "Starting AI Workflow...", description: `Found ${transactionsToProcess.length} transactions to process.`, duration: Infinity }).id;

        try {
            // Step 1: Extract supplier names
            dismiss(toastId);
            toast({ id: toastId, title: "Step 1/3: Extracting Suppliers...", description: "AI is cleaning up descriptions." });
            const transactionsWithSuppliers = await Promise.all(transactionsToProcess.map(async (tx) => {
                try {
                    const { supplier } = await extractSupplierName({ description: tx.description });
                    return { ...tx, extractedSupplier: supplier };
                } catch (e) {
                    return { ...tx, extractedSupplier: tx.description.split(' ')[0].toUpperCase() }; // Fallback
                }
            }));
            
            // Step 2: Group by supplier
            const groupedBySupplier = transactionsWithSuppliers.reduce((acc, tx) => {
                const key = tx.extractedSupplier || 'UNKNOWN';
                if (!acc[key]) acc[key] = [];
                acc[key].push(tx);
                return acc;
            }, {} as Record<string, (ImportedTransaction & {extractedSupplier?: string})[]>);
            
            dismiss(toastId);
            toast({ id: toastId, title: `Step 2/3: Grouping Transactions...`, description: `Created ${Object.keys(groupedBySupplier).length} groups.` });
            
            // Step 3: Allocate each group
            const chartOfAccountsJson = JSON.stringify(chartOfAccounts.map(c => ({ id: c.id, accountNumber: c.accountNumber, description: c.description })));
            const allUpdatePromises: Promise<any>[] = [];
            let processedCount = 0;

            for (const supplier in groupedBySupplier) {
                const group = groupedBySupplier[supplier];
                const representativeTx = group[0];
                
                dismiss(toastId);
                toast({ id: toastId, title: `Step 3/3: Allocating Groups (${++processedCount}/${Object.keys(groupedBySupplier).length})`, description: `Analyzing: ${supplier}` });

                try {
                    const result = await suggestTransactionAllocation({
                        description: representativeTx.description,
                        chartOfAccounts: chartOfAccountsJson,
                        isVatRegistered: client.isVatRegistered || false,
                    });
                    
                    const batch = writeBatch(db);
                    group.forEach(tx => {
                        const txRef = doc(db, 'aiAccountantClients', client.uid!, 'transactions', tx.id);
                        batch.update(txRef, {
                            status: 'ai_review',
                            extractedSupplier: supplier,
                            aiAllocationResult: result || null,
                        });
                    });
                    allUpdatePromises.push(batch.commit());

                } catch (e) {
                    console.error(`Error allocating group ${supplier}:`, e);
                     const batch = writeBatch(db);
                     group.forEach(tx => {
                         const txRef = doc(db, 'aiAccountantClients', client.uid!, 'transactions', tx.id);
                         batch.update(txRef, { status: 'new', extractedSupplier: supplier });
                     });
                     allUpdatePromises.push(batch.commit());
                }
            }
            
            await Promise.all(allUpdatePromises);
            dismiss(toastId);
            toast({ title: 'AI Workflow Complete!', description: 'Review the suggestions below and approve or reject them.' });

        } catch (error) {
            console.error("AI Workflow failed:", error);
            dismiss(toastId);
            toast({ id: toastId, title: 'Workflow Failed', description: 'An unexpected error occurred.', variant: 'destructive'});
        } finally {
            setIsProcessing(false);
            refetch();
        }
    }

    const groupedForReview = useMemo(() => {
        const groups: { [key: string]: ImportedTransaction[] } = {};
        const reviewable = transactions.filter(t => t.status === 'ai_review');
        reviewable.forEach(tx => {
            const key = tx.extractedSupplier || 'UNKNOWN';
            if (!groups[key]) groups[key] = [];
            groups[key].push(tx);
        });
        
        // Initialize suggestions based on the first item in each group
        const initialSuggestions: Record<string, AIAllocationResult> = {};
        Object.entries(groups).forEach(([key, group]) => {
            if (group[0] && group[0].aiAllocationResult) {
                initialSuggestions[key] = group[0].aiAllocationResult;
            }
        });
        setGroupSuggestions(initialSuggestions);

        return Object.entries(groups).sort((a,b) => a[0].localeCompare(b[0]));
    }, [transactions]);
    
    const handleApprove = async (txIds: string[], supplierKey: string) => {
        if (!client || txIds.length === 0) return;
        const suggestion = groupSuggestions[supplierKey];
        if(!suggestion) {
            toast({ title: 'Error', description: 'No allocation suggested for this group.', variant: 'destructive'});
            return;
        }

        const batch = writeBatch(db);
        txIds.forEach(id => {
            const txRef = doc(db, 'aiAccountantClients', client.uid!, 'transactions', id);
            batch.update(txRef, {
                status: 'allocated',
                allocatedTo: { value: suggestion.accountId, type: 'account'},
                vatType: suggestion.vatType,
                allocatedAt: new Date(),
            });
        });
        await batch.commit();
        toast({ title: 'Approved!', description: `${txIds.length} transactions moved to Reviewed.`});
        refetch();
    };

    const handleReject = async (txIds: string[]) => {
         if (!client || txIds.length === 0) return;
        const batch = writeBatch(db);
        txIds.forEach(id => {
            const txRef = doc(db, 'aiAccountantClients', client.uid!, 'transactions', id);
            batch.update(txRef, {
                status: 'new',
                aiAllocationResult: null,
            });
        });
        await batch.commit();
        toast({ title: 'Rejected', description: `${txIds.length} transactions moved back to New.`});
        refetch();
    };

    const handleGroupSuggestionChange = (supplierKey: string, field: 'accountId' | 'vatType', value: string) => {
        setGroupSuggestions(prev => ({
            ...prev,
            [supplierKey]: {
                ...(prev[supplierKey] || { confidence: 0, accountId: '', vatType: 'no_vat' }),
                [field]: value
            }
        }))
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>AI Processing Workflow</CardTitle>
                <CardDescription>Transactions sent for AI allocation are processed here. You can review the AI's suggestions before approving.</CardDescription>
            </CardHeader>
            <CardContent>
                {isLoading ? (
                    <div className="flex justify-center items-center h-40"><Loader2 className="h-8 w-8 animate-spin" /></div>
                ) : transactions.filter(tx => tx.status === 'ai_processing').length > 0 ? (
                    <div>
                        <div className="flex justify-between items-center mb-4 p-4 bg-muted rounded-lg">
                            <p className="font-semibold">{transactions.filter(tx => tx.status === 'ai_processing').length} transaction(s) ready for processing.</p>
                            <Button onClick={handleProcessWorkflow} disabled={isProcessing}>
                                {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Sparkles className="mr-2 h-4 w-4" />}
                                {isProcessing ? 'Processing...' : 'Run AI Workflow'}
                            </Button>
                        </div>
                    </div>
                ) : groupedForReview.length === 0 ? (
                    <div className="text-center py-10 text-muted-foreground">No transactions are currently in the AI workflow.</div>
                ) : (
                    <div className="space-y-4 max-h-[70vh] overflow-y-auto">
                        {groupedForReview.map(([supplier, txs]) => {
                             const suggestion = groupSuggestions[supplier];
                             return (
                                <div key={supplier} className="border rounded-lg">
                                    <div className="p-3 bg-muted/50 flex justify-between items-center flex-wrap gap-4">
                                        <div className="flex-grow">
                                            <h3 className="font-bold">{supplier} <span className="text-sm font-normal text-muted-foreground">({txs.length} items)</span></h3>
                                            <div className="text-xs text-muted-foreground">
                                                Original AI Confidence: {suggestion?.confidence ? `${suggestion.confidence}%` : 'N/A'}
                                            </div>
                                        </div>
                                         <div className="flex items-center gap-2">
                                            <Select value={suggestion?.accountId} onValueChange={(value) => handleGroupSuggestionChange(supplier, 'accountId', value)}>
                                                <SelectTrigger className="h-8 w-[200px] text-xs"><SelectValue placeholder="Select Account..."/></SelectTrigger>
                                                <SelectContent>
                                                    {chartOfAccounts.map(acc => <SelectItem key={acc.id} value={acc.id}>{acc.description}</SelectItem>)}
                                                </SelectContent>
                                            </Select>
                                            <Select value={suggestion?.vatType} onValueChange={(value) => handleGroupSuggestionChange(supplier, 'vatType', value as VatType)}>
                                                <SelectTrigger className="h-8 w-[180px] text-xs"><SelectValue placeholder="Select VAT..."/></SelectTrigger>
                                                <SelectContent>
                                                    {allVatTypes.map(vt => <SelectItem key={vt.name} value={vt.name}>{vt.label}</SelectItem>)}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="flex gap-2">
                                            <Button size="sm" variant="destructive" onClick={() => handleReject(txs.map(t => t.id))}>Reject Group</Button>
                                            <Button size="sm" onClick={() => handleApprove(txs.map(t => t.id), supplier)} disabled={!suggestion}>Approve Group</Button>
                                        </div>
                                    </div>
                                    <div>
                                         <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead className="w-[120px]">Date</TableHead>
                                                    <TableHead>Description</TableHead>
                                                    <TableHead className="text-right w-[150px]">Amount</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {txs.map(tx => (
                                                     <TableRow key={tx.id}>
                                                        <TableCell className="text-xs">{format(new Date(tx.date), 'dd/MM/yyyy')}</TableCell>
                                                        <TableCell className="text-xs">{tx.description}</TableCell>
                                                        <TableCell className="text-right text-xs font-mono">{formatPrice(tx.amount)}</TableCell>
                                                     </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </div>
                                </div>
                             )
                        })}
                    </div>
                )}
            </CardContent>
        </Card>
    )
}
    
    

    