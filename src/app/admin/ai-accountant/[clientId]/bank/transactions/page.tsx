
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
import { FileUp, Loader2, PlusCircle, Search, Settings, Trash2, Edit, List, ArrowRightLeft, Paperclip, X, Plus, Minus, Download, Cog, BookOpen, Sparkles, ArrowUpDown, Ban, ChevronLeft, ChevronRight, CheckCircle, RotateCcw, Upload, AlertTriangle, Mail, Scale, CheckCheck, ChevronsUpDown, ChevronRight as ChevronRightIcon, MoreHorizontal, Group, RefreshCw } from 'lucide-react';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { ImportedTransaction, ChartOfAccount, User, VatType, AllocatedTransaction, AllocationRule, AIAllocationJob, ClientCustomer, Invoice, AIAllocationResult } from '@/lib/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { getFirestore, doc, updateDoc, arrayUnion, getDoc, arrayRemove, addDoc, collection, getDocs, query, orderBy, where, writeBatch, onSnapshot, Unsubscribe, Query, DocumentData, QueryDocumentSnapshot, limit, startAfter, QueryConstraint, setDoc, Timestamp, deleteField } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { ToastAction } from "@/components/ui/toast";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuSeparator, DropdownMenuGroup, DropdownMenuLabel } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup } from '@/components/ui/select';
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
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { startAiAllocationJob } from '@/app/actions';


const PAGE_SIZE = 50;
const BATCH_SIZE = 400; // Firestore batch limit is 500

const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-GB', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(price);
};

// #region Description Cleaning

type CleanResult = {
  cleanedDescription: string;
  merchantKey: string;
  paymentChannel: "CARD" | "EFT" | "DEBIT_ORDER" | "ATM" | "TRANSFER" | "UNKNOWN";
  merchantMethod: "anchor" | "alias" | "regex" | "fallback";
  referenceTokens: string[];
};

function cleanDescription(description: string): CleanResult {
    if (!description) {
        return {
            cleanedDescription: '',
            merchantKey: 'UNKNOWN',
            paymentChannel: 'UNKNOWN',
            merchantMethod: 'fallback',
            referenceTokens: [],
        };
    }
    
    const originalUpper = description.toUpperCase().trim();
    let cleaned = originalUpper;
    const referenceTokens: string[] = [];
    let merchantMethod: CleanResult['merchantMethod'] = 'fallback';
    let merchantKey: string = '';

    // 1. Detect Payment Channel
    let paymentChannel: CleanResult['paymentChannel'] = 'UNKNOWN';
    if (/\b(CHEQUE CARD|CARD PURCHASE|POS|CREDIT CARD)\b/.test(originalUpper)) paymentChannel = 'CARD';
    else if (/\b(EFT)\b/.test(originalUpper)) paymentChannel = 'EFT';
    else if (/\b(DEBIT ORDER|D\/O)\b/.test(originalUpper)) paymentChannel = 'DEBIT_ORDER';
    else if (/\b(ATM)\b/.test(originalUpper)) paymentChannel = 'ATM';
    else if (/\b(TRANSFER|TRF)\b/.test(originalUpper)) paymentChannel = 'TRANSFER';

    // 2. Extract reference tokens before cleaning
    const refRegex = /\b(REF|AUTH|TXN|TRN)[\s\-]*([A-Z0-9]+)\b/gi;
    let match;
    while ((match = refRegex.exec(cleaned)) !== null) {
        if (match[2]) referenceTokens.push(match[2]);
    }
    const codeRegex = /\b([A-Z]*\d+[A-Z\d]*)\b/g;
    while ((match = codeRegex.exec(cleaned)) !== null) {
         if (match[0].length > 8 && !/^[A-Z]+$/.test(match[0])) { // More than 8 chars, contains numbers
            referenceTokens.push(match[0]);
        }
    }
    
    // 3. Strip prefixes
    const prefixes = ['CHEQUE CARD PURCHASE', 'CARD PURCHASE', 'POS PURCHASE', 'DEBIT CARD PURCH', 'PURCH', 'EFT PAYMENT', 'INTERNET TRANSFER', 'IB PAYMENT', 'ONLINE PAYMENT', 'PAYMENT TO', 'PAYMENT FROM', 'PAYMENT', 'TRF', 'TRANSFER', 'XFER', 'IB', 'DEBIT ORDER', 'D/O', 'NAEDO COLLECTION', 'COLLECTION', 'DEBIT ORD', 'DO', 'ATM WITHDRAWAL', 'CASH WITHDRAWAL', 'ATM', 'CASH WD', 'BANK CHARGES', 'SERVICE FEE', 'MONTHLY FEE', 'LEDGER FEE', 'ADMIN FEE', 'COMMISSION', 'CHARGES', 'DEBIT', 'CREDIT' ];
    const prefixRegex = new RegExp(`^\\s*(${prefixes.join('|').replace(/\s/g, '\\s*')})\\s*`, 'i');
    cleaned = cleaned.replace(prefixRegex, '').trim();

    // 4. Remove noise (dates, times, locations)
    cleaned = cleaned.replace(refRegex, '');
    cleaned = cleaned.replace(/\b\d{2}[\/\-]\d{2}[\/\-]\d{2,4}\b/g, ''); 
    cleaned = cleaned.replace(/\b\d{4}[\/\-]\d{2}[\/\-]\d{2}\b/g, ''); 
    cleaned = cleaned.replace(/\b\d{1,2}\s*(?:JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)\b/gi, '');
    cleaned = cleaned.replace(/\b(?:JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)\s*\d{1,2}\b/gi, '');
    cleaned = cleaned.replace(/\b\d{2}:\d{2}(:\d{2})?\b/g, ''); 
    cleaned = cleaned.replace(/\b(JHB|CPT|DBN|ZA|SOUTH AFRICA|S A)\b/gi, '');
    
    // 5. Remove legal entities
    const legalSuffixes = /\b(PTY|LTD|LIMITED|CC|INC|CO|COMPANY|SOC|PROPRIETARY)\b/gi;
    cleaned = cleaned.replace(legalSuffixes, '');
    
    // 6. Final normalization
    cleaned = cleaned.replace(/[*\/#_\-.,']/g, ' ').replace(/\s+/g, ' ').trim();
    
    const cleanedDescriptionForReturn = cleaned;

    // 7. Derive merchantKey
    const anchorMap: { [key: string]: string } = { 'DISCOVERY': 'DISCOVERY', 'SANLAM': 'SANLAM', 'OLD MUTUAL': 'OLD MUTUAL', 'MOMENTUM': 'MOMENTUM', 'HOLLARD': 'HOLLARD', 'AFRIHOST': 'AFRIHOST', 'AQUAZANIA': 'AQUAZANIA', 'DISCINSURE': 'DISCINSURE', 'OUTSURANCE': 'OUTSURANCE', 'MIWAY': 'MIWAY', 'KING PRICE': 'KING PRICE', 'BOOKING.COM': 'BOOKING.COM', 'TELKOM': 'TELKOM', 'CREDIT CARD': 'CREDIT CARD', 'SDS PROTECT': 'SDS PROTECT' };
    const aliasMap: { [key: string]: string } = { 'PNP': 'PICK N PAY', 'PICKNPAY': 'PICK N PAY', 'VODA': 'VODACOM', 'VODACOMSA': 'VODACOM', 'TAKEALOT.COM': 'TAKEALOT' };
    const genericBlacklist = ["PAYMENT","PURCHASE","TRANSFER","TRF","ONLINE","EFT","CARD","POS","DEBIT","ORDER","ATM","WITHDRAWAL","REF","REFERENCE","BANK","FEE","CHARGE"];

    for (const anchor in anchorMap) {
        if (originalUpper.startsWith(anchor)) {
            merchantKey = anchorMap[anchor];
            merchantMethod = 'anchor';
            break;
        }
    }
    if (!merchantKey) {
        for (const anchor in anchorMap) {
            if (cleaned.includes(anchor)) {
                merchantKey = anchorMap[anchor];
                merchantMethod = 'anchor';
                break;
            }
        }
    }

    if (!merchantKey) {
        const words = cleaned.split(' ');
        for (const word of words) {
            if (aliasMap[word]) {
                merchantKey = aliasMap[word];
                merchantMethod = 'alias';
                break;
            }
        }
    }
    
    if (!merchantKey) {
        const tokens = cleaned.split(' ').filter(token => 
            token && 
            token.length >= 3 && 
            !/^\d+$/.test(token) &&
            !genericBlacklist.includes(token)
        );
        if (tokens.length > 0) {
            if (tokens.indexOf('PICK') !== -1 && tokens.indexOf('N') !== -1 && tokens.indexOf('PAY') !== -1) {
                merchantKey = 'PICK N PAY';
            } else {
                 merchantKey = tokens.slice(0, 2).join(' ');
            }
            merchantMethod = 'regex';
        }
    }

    if (!merchantKey || genericBlacklist.includes(merchantKey.trim())) {
        merchantKey = 'UNKNOWN';
        merchantMethod = 'fallback';
    }

    return {
        cleanedDescription: cleanedDescriptionForReturn,
        merchantKey: merchantKey.trim(),
        paymentChannel,
        merchantMethod,
        referenceTokens: [...new Set(referenceTokens)],
    };
}
// #endregion

// #region Import Dialog
const importFormSchema = z.object({
  file: z.any().refine(file => file instanceof File, "A CSV or Excel file is required."),
});

type ParsedTransaction = {
    Date: string;
    Description: string;
    CleanResult: CleanResult;
    Amount: number;
}

function ImportDialog({ client, bankAccountId, currentBalance, onImportComplete, globalRules }: { client: User | null, bankAccountId: string, currentBalance: number, onImportComplete: () => void, globalRules: AllocationRule[] }) {
    const [isOpen, setIsOpen] = useState(false);
    const [file, setFile] = useState<File | null>(null);
    const [parsedTransactions, setParsedTransactions] = useState<ParsedTransaction[]>([]);
    const [isParsing, setIsParsing] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const { toast } = useToast();
    const [importError, setImportError] = useState<string | null>(null);

    const resetState = useCallback(() => {
        setFile(null);
        setParsedTransactions([]);
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
                        if (results.data.length > 5000) {
                            setImportError('File is too large. Please import no more than 5000 lines at a time.');
                            setParsedTransactions([]);
                            setIsParsing(false);
                            return;
                        }
                        
                        const data = results.data as any[];
                        const transactions: ParsedTransaction[] = data.map(row => ({
                            Date: row.Date,
                            Description: row.Description,
                            CleanResult: cleanDescription(row.Description || ''),
                            Amount: parseFloat(row.Amount)
                        })).filter(tx => tx.Date && tx.Description && !isNaN(tx.Amount));
                        
                        setParsedTransactions(transactions);
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
        toast({ title: "Importing...", description: "Processing your file."});

        try {
            const allRules = [...(client?.allocationRules || []), ...globalRules];
            allRules.sort((a, b) => (a.priority || 99) - (b.priority || 99));

            const allDbOperations: ((batch: ReturnType<typeof writeBatch>) => void)[] = [];
            const dailyCounters: { [key: string]: number } = {};
            let allocatedCount = 0;
            
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
                
                const cleanResult = row.CleanResult;
                let transaction: Omit<ImportedTransaction, 'id'> & { allocatedAt?: Date } = {
                    clientId: client.uid!,
                    date: parsedDate.toISOString(),
                    reference: reference,
                    description: row.Description,
                    cleanedDescription: cleanResult.cleanedDescription,
                    merchantKey: cleanResult.merchantKey,
                    paymentChannel: cleanResult.paymentChannel,
                    merchantMethod: cleanResult.merchantMethod,
                    referenceTokens: cleanResult.referenceTokens,
                    amount: row.Amount,
                    bankAccountId: bankAccountId,
                    status: 'new'
                };
                
                if (transaction.amount < 0 && allRules.length > 0) {
                    const merchantKeyLower = transaction.merchantKey?.toLowerCase() || '';
                    if(merchantKeyLower) {
                        const matchedRule = allRules.find(rule => 
                            rule.keywords.some(kw => merchantKeyLower.includes(kw.toLowerCase()))
                        );

                        if (matchedRule) {
                            transaction.status = 'review';
                            transaction.allocatedTo = { value: matchedRule.accountId, type: 'account' };
                            transaction.vatType = client.isVatRegistered ? matchedRule.vatType : 'no_vat';
                            transaction.allocatedAt = new Date();
                            allocatedCount++;
                        }
                    }
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

            let toastDescription = `${parsedTransactions.length} transactions have been imported.`;
            if (allocatedCount > 0) {
                toastDescription += ` ${allocatedCount} expense(s) were automatically allocated for review.`;
            }

            toast({ title: "Import Successful", description: toastDescription});
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

    return (
        <Dialog open={isOpen} onOpenChange={(open) => { setIsOpen(open); if(!open) resetState(); }}>
            <DialogTrigger asChild>
                <Button><FileUp className="mr-2 h-4 w-4" /> Import CSV</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-xl">
                <DialogHeader>
                    <DialogTitle>Import Bank Statement</DialogTitle>
                    <DialogDescription>
                        Upload a CSV file to import transactions.
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

function EditAccountDialog({ account, client, onAccountUpdated, onOpenChange, open }: { account: ChartOfAccount | null, client: User | null, onAccountUpdated: () => void, open: boolean, onOpenChange: (open: boolean) => void }) {
    const { toast } = useToast();
    const [isSaving, setIsSaving] = useState(false);
    
    const form = useForm<z.infer<typeof editAccountSchema>>({
        resolver: zodResolver(editAccountSchema),
        defaultValues: account ? { id: account.id, name: account.description } : {id: '', name: ''},
    });
    
    useEffect(() => {
        if (account) {
            form.reset({ id: account.id, name: account.description });
        }
    }, [account, form]);


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

    if (!account) return null;

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
  scope: z.enum(['global', 'client']).default('client'),
});
type RuleFormValues = z.infer<typeof ruleFormSchema>;

const RuleForm = ({ chartOfAccounts, defaultValues, onSave, onCancel }: {
    chartOfAccounts: ChartOfAccount[],
    defaultValues: Partial<RuleFormValues>,
    onSave: (values: RuleFormValues) => void,
    onCancel: () => void,
}) => {
    const form = useForm<RuleFormValues>({
        resolver: zodResolver(ruleFormSchema),
        defaultValues: defaultValues,
    });
    return (
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSave)} className="space-y-4">
            <FormField control={form.control} name="description" render={({ field }) => ( <FormItem><FormLabel>Rule Description</FormLabel><FormControl><Input placeholder="e.g., Monthly bank charges" {...field} /></FormControl><FormMessage /></FormItem> )} />
            <FormField control={form.control} name="keywords" render={({ field }) => ( <FormItem><FormLabel>Keywords (comma-separated)</FormLabel><FormControl><Input placeholder="e.g., monthly account fee, service fee" {...field} /></FormControl><FormMessage /></FormItem> )} />
            <FormField
                control={form.control}
                name="accountId"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Allocate To Account</FormLabel>
                    <Popover>
                        <PopoverTrigger asChild>
                        <FormControl>
                            <Button variant="outline" role="combobox" className={cn("w-full justify-between", !field.value && "text-muted-foreground")}>
                            {field.value ? chartOfAccounts?.find((acc) => acc.id === field.value)?.description : "Select account"}
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                        </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                        <Command>
                            <CommandInput placeholder="Search account..." />
                            <CommandList>
                            <CommandEmpty>No account found.</CommandEmpty>
                            <CommandGroup>
                                {chartOfAccounts?.map((acc) => (
                                <CommandItem value={acc.description} key={acc.id} onSelect={() => form.setValue("accountId", acc.id)}>
                                    <CheckCheck className={cn("mr-2 h-4 w-4", acc.id === field.value ? "opacity-100" : "opacity-0")} />
                                    {acc.description}
                                </CommandItem>
                                ))}
                            </CommandGroup>
                            </CommandList>
                        </Command>
                        </PopoverContent>
                    </Popover>
                    <FormMessage />
                    </FormItem>
                )}
            />
            <FormField control={form.control} name="vatType" render={({ field }) => ( <FormItem><FormLabel>VAT Type</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select VAT type" /></SelectTrigger></FormControl><SelectContent>{allVatTypes.map(vt => ( <SelectItem key={vt.name} value={vt.name}>{vt.label}</SelectItem>))}</SelectContent></Select><FormMessage /></FormItem>)}/>
            <FormField control={form.control} name="scope" render={({ field }) => (
                <FormItem>
                    <FormLabel>Rule Scope</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl><SelectTrigger><SelectValue/></SelectTrigger></FormControl>
                        <SelectContent>
                            <SelectItem value="client">Client Only</SelectItem>
                            <SelectItem value="global">Global (All Clients)</SelectItem>
                        </SelectContent>
                    </Select>
                </FormItem>
            )} />
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>
              <Button type="submit">Save Rule</Button>
            </DialogFooter>
          </form>
        </Form>
    )
}

function CreateRuleDialog({ client, onRuleCreated, open, onOpenChange, defaultValues }: {
    client: User | null;
    onRuleCreated: () => void;
    open: boolean;
    onOpenChange: (isOpen: boolean) => void;
    defaultValues: Partial<RuleFormValues>;
}) {
    const { toast } = useToast();
    
    const handleSave = async (values: RuleFormValues) => {
        if (!client) return;

        const newRule: Omit<AllocationRule, 'id'> = {
            description: values.description,
            keywords: values.keywords.split(',').map(k => k.trim().toLowerCase()),
            accountId: values.accountId,
            vatType: values.vatType,
            type: 'hard', // All rules created from UI are hard rules for now
            scope: values.scope,
        };
        
        try {
            if (values.scope === 'global') {
                await addDoc(collection(db, 'allocationRules'), newRule);
                toast({ title: 'Global Rule Created', description: 'This rule will apply to all clients.' });
            } else {
                const clientRef = doc(db, 'aiAccountantClients', client.uid!);
                await updateDoc(clientRef, {
                    allocationRules: arrayUnion(newRule)
                });
                toast({ title: 'Client Rule Created', description: 'This rule will apply to this client only.' });
            }
            onRuleCreated();
            onOpenChange(false);
        } catch(e) {
            console.error(e);
            toast({ title: 'Error', description: 'Could not create rule.', variant: 'destructive'});
        }
    };
    
    if (!client) return null;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Create New Allocation Rule</DialogTitle>
                </DialogHeader>
                <RuleForm 
                    chartOfAccounts={client.chartOfAccounts || []}
                    defaultValues={defaultValues}
                    onSave={handleSave}
                    onCancel={() => onOpenChange(false)}
                />
            </DialogContent>
        </Dialog>
    );
}

function ApproveAndCreateRuleDialog({
  isOpen,
  onOpenChange,
  groupData,
  client,
  onConfirm,
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  groupData: { supplier: string; txs: ImportedTransaction[]; suggestion: AIAllocationResult | null };
  client: User | null;
  onConfirm: (ruleValues: RuleFormValues, groupTxs: ImportedTransaction[]) => void;
}) {
  if (!isOpen || !client) return null;

  const defaultValues = {
    description: `Rule for ${groupData.supplier}`,
    keywords: groupData.supplier,
    accountId: groupData.suggestion?.accountId || '',
    vatType: groupData.suggestion?.vatType || (client.isVatRegistered ? 'standard_rated_purchases' : 'no_vat'),
    scope: 'client' as 'client' | 'global',
  };

  const handleSave = (values: RuleFormValues) => {
    onConfirm(values, groupData.txs);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Approve & Create Rule</DialogTitle>
          <DialogDescription>
            Confirm the details below to create a new rule for '{groupData.supplier}' and approve all {groupData.txs.length} transactions in this group.
          </DialogDescription>
        </DialogHeader>
        <RuleForm
          chartOfAccounts={client.chartOfAccounts || []}
          defaultValues={defaultValues}
          onSave={handleSave}
          onCancel={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

// #endregion

const NewTransactionsTab = React.forwardRef<
    { refetch: () => void },
    { 
        client: User | null; 
        bankAccountId: string | null; 
        customers: ClientCustomer[]; 
        invoices: Invoice[]; 
        fetchClientData: () => void; 
        globalRules: AllocationRule[]; 
        onAccountCreated: () => void; 
        setActiveTab: (tab: string) => void;
        currentBalance: number;
    }
>(({ client, bankAccountId, customers, invoices, fetchClientData, globalRules, onAccountCreated, setActiveTab, currentBalance }, ref) => {
    const { toast, dismiss } = useToast();
    const [activeSubTab, setActiveSubTab] = useState<'expenses' | 'income'>('expenses');
    const [selectedTransactions, setSelectedTransactions] = useState<string[]>([]);
    const [allocations, setAllocations] = useState<{ [txId: string]: { value: string, type: 'account' | 'customer' | 'supplier', vatType?: VatType } }>({});
    const [isCreateRuleOpen, setIsCreateRuleOpen] = useState(false);
    const [isCreateGeneralAccountOpen, setIsCreateGeneralAccountOpen] = useState(false);
    const [ruleDefaultValues, setRuleDefaultValues] = useState<Partial<z.infer<typeof ruleFormSchema>>>({ description: '', keywords: '', accountId: '', vatType: 'standard_rated_purchases' });
    const [isAiAllocating, setIsAiAllocating] = useState(false);
    const [isRuleAllocating, setIsRuleAllocating] = useState(false);
    const [isDownloading, setIsDownloading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [isSearching, setIsSearching] = useState(false);
    const [searchResults, setSearchResults] = useState<ImportedTransaction[] | null>(null);
    const [isAiSelectedDialogOpen, setIsAiSelectedDialogOpen] = useState(false);
    const [isAiAllDialogOpen, setIsAiAllDialogOpen] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isRefreshing, setIsRefreshing] = useState(false);
    


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

    const transactions = useMemo(() => {
        let docs = searchResults !== null ? searchResults : paginatedDocuments;
        
        if (sortField === 'description') {
            docs.sort((a, b) => {
                const comparison = a.description.localeCompare(b.description);
                return sortDirection === 'asc' ? comparison : -comparison;
            });
        }
        return docs;
    }, [searchResults, paginatedDocuments, sortField, sortDirection]);
    
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


    const handleAiAllocateSelected = async () => {
        if (!client || !client.uid || selectedTransactions.length === 0) return;
        setIsAiAllocating(true);
        toast({ title: "Preparing AI Workflow...", description: "Moving selected transactions to the AI workflow tab." });

        try {
            for (let i = 0; i < selectedTransactions.length; i += BATCH_SIZE) {
                const batch = writeBatch(db);
                const chunk = selectedTransactions.slice(i, i + BATCH_SIZE);
                chunk.forEach(txId => {
                    const txRef = doc(db, 'aiAccountantClients', client.uid!, 'transactions', txId);
                    batch.update(txRef, { status: 'ai_processing' });
                });
                await batch.commit();
            }

            toast({ title: "Transactions Moved", description: `${selectedTransactions.length} transactions sent for AI processing.` });
            setSelectedTransactions([]);
            refetch();
            setActiveTab('ai-workflow');
        } catch (error) {
            console.error("Error moving transactions:", error);
            toast({ title: "Error", description: "Could not move selected transactions.", variant: 'destructive' });
        } finally {
            setIsAiAllocating(false);
            setIsAiSelectedDialogOpen(false);
        }
    };
    
    const handleAiAllocateAll = async () => {
        if (!client || !client.uid || !bankAccountId) return;
        setIsAiAllDialogOpen(false);
        
        const q = query(
            collection(db, 'aiAccountantClients', client.uid, 'transactions'),
            where('bankAccountId', '==', bankAccountId),
            where('status', '==', 'new'),
            where('amount', '<', 0) // Only expenses
        );

        const snapshot = await getDocs(q);
        const transactionsToProcess = snapshot.docs.map(d => d.id);
        
        if (transactionsToProcess.length === 0) {
            toast({ title: "No new expense transactions found." });
            return;
        }

        const toastId = toast({ title: "Gathering transactions...", description: `Found ${transactionsToProcess.length} expenses to process.`}).id;
        
        try {
            for (let i = 0; i < transactionsToProcess.length; i += BATCH_SIZE) {
                const batch = writeBatch(db);
                const chunk = transactionsToProcess.slice(i, i + BATCH_SIZE);
                chunk.forEach(txId => {
                    const txRef = doc(db, 'aiAccountantClients', client.uid!, 'transactions', txId);
                    batch.update(txRef, { status: 'ai_processing' });
                });
                await batch.commit();
            }
            dismiss(toastId);
            refetch(); 
            setActiveTab('ai-workflow');
        } catch (error) {
            console.error("Error in AI Allocate All:", error);
            dismiss(toastId);
            toast({ title: 'Error', description: 'Could not move all transactions.', variant: 'destructive'});
        }
    };


    const handleBulkDelete = async () => {
        if (!client || !client.uid || selectedTransactions.length === 0) return;

        try {
            for (let i = 0; i < selectedTransactions.length; i += BATCH_SIZE) {
                const batch = writeBatch(db);
                const chunk = selectedTransactions.slice(i, i + BATCH_SIZE);
                chunk.forEach(txId => {
                    const docRef = doc(db, 'aiAccountantClients', client.uid!, 'transactions', txId);
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
    
    const handleRefreshDescriptions = async () => {
        if (!client || !client.uid || !bankAccountId) return;
        setIsRefreshing(true);
        toast({ title: `Refreshing all new transactions...`, description: "This may take a moment." });
    
        try {
            const q = query(
                collection(db, 'aiAccountantClients', client.uid, 'transactions'),
                where('bankAccountId', '==', bankAccountId),
                where('status', '==', 'new')
            );
            const snapshot = await getDocs(q);

            if (snapshot.empty) {
                toast({ title: "No new transactions to refresh." });
                setIsRefreshing(false);
                return;
            }
            
            const transactionsToRefresh = snapshot.docs;
            let refreshedCount = 0;

            for (let i = 0; i < transactionsToRefresh.length; i += BATCH_SIZE) {
                const batch = writeBatch(db);
                const chunk = transactionsToRefresh.slice(i, i + BATCH_SIZE);
                
                for (const docSnap of chunk) {
                    const tx = docSnap.data() as ImportedTransaction;
                    if (tx.description) {
                        const cleanResult = cleanDescription(tx.description);
                        batch.update(docSnap.ref, {
                            cleanedDescription: cleanResult.cleanedDescription,
                            merchantKey: cleanResult.merchantKey,
                            paymentChannel: cleanResult.paymentChannel,
                            merchantMethod: cleanResult.merchantMethod,
                            referenceTokens: cleanResult.referenceTokens,
                        });
                        refreshedCount++;
                    }
                }
                await batch.commit();
            }

            if (refreshedCount > 0) {
                toast({ title: "Refresh Complete", description: `${refreshedCount} transactions have been re-processed.` });
                refetch(); // This will refetch paginated data
                setSelectedTransactions([]); // Clear selection as a good practice
            } else {
                 toast({ title: 'No Changes', description: 'No transactions needed refreshing.'});
            }
            
        } catch (error) {
            console.error("Error refreshing descriptions:", error);
            toast({ title: "Refresh Failed", variant: "destructive" });
        } finally {
            setIsRefreshing(false);
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
                        setRuleDefaultValues({ description: '', keywords: '', accountId: '', vatType: 'standard_rated_purchases' });
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

             <Dialog open={isAiSelectedDialogOpen} onOpenChange={setIsAiSelectedDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>AI Allocate Selected</DialogTitle>
                        <DialogDescription>
                            The selected transaction(s) will be moved to the AI workflow tab for processing.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button type="button" variant="ghost" onClick={() => setIsAiSelectedDialogOpen(false)}>Cancel</Button>
                        <Button type="button" onClick={handleAiAllocateSelected} disabled={isAiAllocating}>
                            {isAiAllocating ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Sparkles className="mr-2 h-4 w-4" />}
                            Allocate Selected
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

             <Dialog open={isAiAllDialogOpen} onOpenChange={setIsAiAllDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>AI Allocate All</DialogTitle>
                        <DialogDescription>
                            This will send ALL new expenses in this bank account to the AI workflow for processing. Are you sure?
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button type="button" variant="ghost" onClick={() => setIsAiAllDialogOpen(false)}>Cancel</Button>
                        <Button type="button" onClick={handleAiAllocateAll} disabled={isAiAllocating}>
                            {isAiAllocating ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Sparkles className="mr-2 h-4 w-4" />}
                            Yes, Allocate All Expenses
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
                        {bankAccountId && client && <ImportDialog 
                            client={client}
                            bankAccountId={bankAccountId}
                            currentBalance={currentBalance} 
                            onImportComplete={refetch}
                            globalRules={globalRules}
                        />}
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
                         <Button variant="outline" onClick={handleRefreshDescriptions} disabled={isRefreshing}>
                            {isRefreshing ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <RefreshCw className="mr-2 h-4 w-4" />}
                            Refresh All Descriptions
                        </Button>
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

                         <Button variant="outline" onClick={() => setIsAiSelectedDialogOpen(true)} disabled={isAiAllocating || selectedTransactions.length === 0 || activeSubTab === 'income'}>
                            <Sparkles className="mr-2 h-4 w-4"/> AI Allocate Selected
                        </Button>
                        <Button variant="outline" onClick={() => setIsAiAllDialogOpen(true)} disabled={isAiAllocating || activeSubTab === 'income'}>
                            <Sparkles className="mr-2 h-4 w-4"/> AI Allocate All
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
                            {isLoading || isSearching ? (
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
                                        <TableCell className="whitespace-normal break-words">
                                            <p>{tx.description}</p>
                                            {tx.merchantKey && <p className="text-xs text-muted-foreground font-mono bg-muted p-1 rounded-sm mt-1">{tx.merchantKey}</p>}
                                        </TableCell>
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
                    
                    {!searchTerm && (
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
    
    const displayedDocuments = useMemo(() => {
        if (searchResults !== null) {
            return searchResults;
        }
        return paginatedDocuments;
    }, [searchResults, paginatedDocuments]);

    const accountsWithTransactions = useMemo(() => {
        if (!client || !client.chartOfAccounts) return [];

        const getAccounts = (transactions: ImportedTransaction[]) => {
            const accountIdsInDocs = new Set(transactions.map(tx => tx.allocatedTo?.value));
            return uniqueChartOfAccounts.filter(acc => accountIdsInDocs.has(acc.id));
        }

        if (searchResults !== null) return getAccounts(searchResults);
        return getAccounts(paginatedDocuments);

    }, [paginatedDocuments, searchResults, uniqueChartOfAccounts, client]);

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
                ...(prev[txId] || {}), // Ensure the object exists before spreading
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
                    const docRef = doc(db, 'aiAccountantClients', client.uid!, 'transactions', txId);
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
             toast({ title: 'Error', description: 'Could not apply corrections.', variant: 'destructive'});
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
                        <Button onClick={() => handleSaveChanges(changes, Object.keys(changes))} disabled={isSaving || Object.keys(changes).length === 0}>
                            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                            Save Changes
                        </Button>
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
                         <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" size="sm" disabled={selectedTransactions.length === 0}>
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
                                <Button variant="destructive" size="sm" disabled={selectedTransactions.length === 0}>Delete Selected</Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                    <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                    <AlertDialogDescription>This will permanently delete {selectedTransactions.length} selected transaction(s). This cannot be undone.</AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction onClick={handleBulkDelete}>Yes, Delete All</AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
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
                            {isLoading || isSearching ? (
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
                                            <Popover>
                                                <PopoverTrigger asChild>
                                                    <Button variant="outline" className="w-full justify-start text-left font-normal h-8">
                                                        {changes[tx.id] ? [...(client?.chartOfAccounts || []), ...customers].find(o => o.id === changes[tx.id]?.allocatedTo?.value)?.description || [...(client?.chartOfAccounts || []), ...customers].find(o => o.id === changes[tx.id]?.allocatedTo?.value)?.name : getAllocationDescription(tx)}
                                                    </Button>
                                                </PopoverTrigger>
                                                <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                                                    <Command>
                                                        <CommandInput placeholder="Search..." />
                                                        <CommandList>
                                                            <CommandEmpty>No results found.</CommandEmpty>
                                                            <CommandItem onSelect={() => setIsCreateGeneralAccountOpen(true)} className="text-primary cursor-pointer"><PlusCircle className="mr-2 h-4 w-4"/>Create new account...</CommandItem>
                                                            <CommandGroup heading="Customers">
                                                                {customers.map(c => <CommandItem key={c.id} onSelect={() => handleAllocationChange(tx.id, `customer:${c.id}`)}>{c.name}</CommandItem>)}
                                                            </CommandGroup>
                                                            <CommandGroup heading="Accounts">
                                                                {uniqueChartOfAccounts.map(acc => <CommandItem key={acc.id} onSelect={() => handleAllocationChange(tx.id, `account:${acc.id}`)}>{acc.description}</CommandItem>)}
                                                            </CommandGroup>
                                                        </CommandList>
                                                    </Command>
                                                </PopoverContent>
                                            </Popover>
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
             <CardFooter className="flex items-center justify-end p-4">
                 <div className="flex items-center gap-2">
                    {!searchTerm.trim() && (
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
    
    const [viewMode, setViewMode] = useState<'list' | 'group'>('list');
    const [groupedTransactions, setGroupedTransactions] = useState<Record<string, ImportedTransaction[]>>({});
    const [isGrouping, setIsGrouping] = useState(false);

    
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
        let docs = searchTerm ? documents.filter(tx => tx.description.toLowerCase().includes(searchTerm.toLowerCase())) : documents;
        
        if (sortField === 'description') {
            docs.sort((a, b) => {
                const comparison = a.description.localeCompare(b.description);
                return sortDirection === 'asc' ? comparison : -comparison;
            });
        }
        
        return docs;
    }, [documents, searchTerm, sortField, sortDirection]);
    
    React.useImperativeHandle(ref, () => ({
        refetch,
    }));
    
    useEffect(() => {
        refetch();
        setViewMode('list');
    }, [activeSubTab, refetch]);
    
    const handleGroupReview = async () => {
        if (viewMode === 'group') {
            setViewMode('list');
            return;
        }

        if (!client || !bankAccountId) return;
        setIsGrouping(true);
        toast({ title: 'Grouping Transactions...', description: 'AI is analyzing descriptions.' });

        try {
            const queryConstraints: QueryConstraint[] = [
                where('bankAccountId', '==', bankAccountId),
                where('status', '==', 'review')
            ];
            if (activeSubTab === 'expenses') {
                queryConstraints.push(where('amount', '<', 0));
            } else {
                queryConstraints.push(where('amount', '>=', 0));
            }
            const q = query(collection(db, 'aiAccountantClients', client.uid, 'transactions'), ...queryConstraints);

            const snapshot = await getDocs(q);
            const allReviewTransactions = snapshot.docs.map(d => ({ id: d.id, ...d.data() }) as ImportedTransaction);

            const transactionsWithSuppliers = await Promise.all(allReviewTransactions.map(async (tx) => {
                try {
                    const { supplier } = await extractSupplierName({ description: tx.description });
                    return { ...tx, extractedSupplier: supplier };
                } catch (e) {
                    return { ...tx, extractedSupplier: tx.description.split(' ')[0].toUpperCase() }; // Fallback
                }
            }));
            
            const groups: Record<string, ImportedTransaction[]> = {};
            transactionsWithSuppliers.forEach(tx => {
                const key = tx.extractedSupplier || 'UNKNOWN';
                if (!groups[key]) groups[key] = [];
                groups[key].push(tx);
            });
            
            setGroupedTransactions(groups);
            setViewMode('group');

        } catch (error) {
            console.error("Grouping failed:", error);
            toast({ title: 'Grouping Failed', variant: 'destructive' });
        } finally {
            setIsGrouping(false);
        }
    };

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


    const isGroupInconsistent = (group: ImportedTransaction[]): boolean => {
        if (group.length <= 1) return false;
        const firstAccountId = group[0].allocatedTo?.value;
        const firstVatType = group[0].vatType;
        return group.some(tx => tx.allocatedTo?.value !== firstAccountId || tx.vatType !== firstVatType);
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
                        <Button onClick={handleGroupReview} disabled={isGrouping}>
                            {isGrouping ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Group className="mr-2 h-4 w-4"/>}
                            {viewMode === 'group' ? 'List View' : 'Group Review'}
                        </Button>
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
                 {viewMode === 'group' ? (
                     <div className="space-y-4 p-4 max-h-[70vh] overflow-y-auto">
                        {Object.entries(groupedTransactions).sort((a,b) => a[0].localeCompare(b[0])).map(([supplier, txs]) => (
                             <div key={supplier} className="border rounded-lg">
                                <div className={cn("p-3 bg-muted/50 flex justify-between items-center", isGroupInconsistent(txs) && "bg-destructive/10")}>
                                    <h3 className="font-bold flex items-center gap-2">
                                        {isGroupInconsistent(txs) && <AlertTriangle className="h-4 w-4 text-destructive"/>}
                                        {supplier} <span className="text-sm font-normal text-muted-foreground">({txs.length} items)</span>
                                    </h3>
                                    <div className="flex gap-2">
                                        <Button size="sm" variant="destructive" onClick={() => handleBulkAction('reject')}>Reject Group</Button>
                                        <Button size="sm" onClick={() => handleBulkAction('approve')}>Approve Group</Button>
                                    </div>
                                </div>
                                <Table>
                                    <TableBody>
                                        {txs.map(tx => (
                                            <TableRow key={tx.id}>
                                                <TableCell className="text-xs w-[100px]">{format(new Date(tx.date), 'dd/MM/yyyy')}</TableCell>
                                                <TableCell className="text-xs">{tx.description}</TableCell>
                                                <TableCell className="text-xs">{getAllocationDescription(tx)}</TableCell>
                                                <TableCell className="text-xs">{allVatTypes.find(v => v.name === tx.vatType)?.label || 'N/A'}</TableCell>
                                                <TableCell className="text-right text-xs font-mono">{formatPrice(tx.amount)}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                             </div>
                        ))}
                    </div>
                 ) : (
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
                                {isLoading ? (
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
                )}
            </CardContent>
            <CardFooter className="flex items-center justify-center p-4">
                 <div className="flex items-center gap-2">
                    
                    {!searchTerm && (
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


const AIWorkflowTab = ({ client, bankAccountId, chartOfAccounts, fetchClientData, globalRules, onRuleCreated }: { 
    client: User | null; 
    bankAccountId: string | null; 
    chartOfAccounts: ChartOfAccount[], 
    fetchClientData: () => void;
    globalRules: AllocationRule[];
    onRuleCreated: () => void;
}) => {
    const { toast } = useToast();
    const [transactions, setTransactions] = useState<ImportedTransaction[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    
    const [job, setJob] = useState<AIAllocationJob | null>(null);
    const [isLoadingJob, setIsLoadingJob] = useState(true);
    
    const [groupedTransactions, setGroupedTransactions] = useState<Record<string, ImportedTransaction[]>>({});
    const [groupAllocations, setGroupAllocations] = useState<Record<string, AIAllocationResult | null>>({});
    const [activeApprovalGroup, setActiveApprovalGroup] = useState<{ supplier: string; txs: ImportedTransaction[]; suggestion: AIAllocationResult | null } | null>(null);

    const [isSaving, setIsSaving] = useState(false);
    const [selectedGroups, setSelectedGroups] = useState<string[]>([]);

    const [lastApprovedTxIds, setLastApprovedTxIds] = useState<string[] | null>(null);

    useEffect(() => {
        if (!client?.uid || !bankAccountId) {
            setIsLoading(false);
            return;
        }

        const transQuery = query(
            collection(db, 'aiAccountantClients', client.uid, 'transactions'), 
            where('bankAccountId', '==', bankAccountId),
            where('status', 'in', ['ai_processing', 'ai_review'])
        );
        const transUnsubscribe = onSnapshot(transQuery, (snapshot) => {
            const fetched = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as ImportedTransaction);
            setTransactions(fetched);
            setIsLoading(false);
        }, (error) => {
            console.error(error);
            setIsLoading(false);
            toast({ title: "Error", description: "Could not load workflow transactions.", variant: "destructive" });
        });

        const jobsQuery = query(
            collection(db, 'aiAccountantClients', client.uid, 'jobs'),
            orderBy('createdAt', 'desc'),
            limit(1)
        );
        const jobUnsubscribe = onSnapshot(jobsQuery, (snapshot) => {
            if (!snapshot.empty) {
                const latestJob = snapshot.docs[0].data() as AIAllocationJob;
                if (latestJob.status === 'running') {
                    setJob(latestJob);
                } else {
                    setJob(null); // Clear job if it's completed or failed
                }
            } else {
                setJob(null);
            }
            setIsLoadingJob(false);
        });

        return () => { 
            transUnsubscribe();
            jobUnsubscribe();
        };
    }, [client?.uid, bankAccountId, toast]);
    
    useEffect(() => {
        const groups = transactions.reduce((acc, tx) => {
            const key = tx.merchantKey || 'Unassigned';
            if (tx.status === 'ai_review') {
                if (!acc[key]) acc[key] = [];
                acc[key].push(tx);
            }
            return acc;
        }, {} as Record<string, ImportedTransaction[]>);
        setGroupedTransactions(groups);

        const initialAllocations: Record<string, AIAllocationResult | null> = {};
        Object.values(groups).forEach(txs => {
            if (txs.length > 0) {
                const supplier = txs[0].merchantKey;
                if(supplier) {
                    initialAllocations[supplier] = txs[0].aiAllocationResult || null;
                }
            }
        });
        setGroupAllocations(initialAllocations);
    }, [transactions]);
    
    const handleRunAiAllocation = async (reanalyse = false) => {
        if (!client || !bankAccountId) return;
        toast({ title: 'Starting AI Allocation Job...', description: 'The process will run in the background. Please keep this tab open.' });
        try {
            await startAiAllocationJob(client.uid, bankAccountId, reanalyse);
        } catch (e) {
            toast({ title: 'Failed to start job', variant: 'destructive'});
        }
    };
    
    const handleUndoAction = async (txIds: string[]) => {
        if (!client || txIds.length === 0) return;
        toast({ title: "Undoing...", description: "Reverting transactions."});
        try {
            const batch = writeBatch(db);
            txIds.forEach(id => {
                const txRef = doc(db, 'aiAccountantClients', client.uid!, 'transactions', id);
                batch.update(txRef, { 
                    status: 'ai_review',
                    allocatedTo: null, 
                    allocatedAt: null,
                });
            });
            await batch.commit();
            setLastApprovedTxIds(null);
            toast({ title: 'Action Undone', description: `${txIds.length} transactions reverted to AI Workflow.`});
        } catch (error) {
            console.error("Error undoing action:", error);
            toast({ title: 'Undo Failed', variant: 'destructive' });
        }
    };
    
    const handleRejectSelected = async (txIdsToReject: string[]) => {
        if (!client || txIdsToReject.length === 0) return;
        toast({ title: 'Rejecting transactions...' });
        try {
            const batch = writeBatch(db);
            txIdsToReject.forEach(txId => {
                const txRef = doc(db, 'aiAccountantClients', client.uid!, 'transactions', txId);
                batch.update(txRef, { status: 'new', aiAllocationResult: deleteField() });
            });
            await batch.commit();
            toast({ title: 'Transactions Rejected', description: `${txIdsToReject.length} items moved back to 'New'` });
        } catch (error) {
            console.error(error);
            toast({ title: 'Error', description: 'Could not reject transactions.', variant: 'destructive'});
        }
    };
    
    const handleConfirmApprovalAndRuleCreation = async (ruleValues: RuleFormValues, groupTxs: ImportedTransaction[]) => {
      if (!client || !client.uid) return;
      
      const newRule: Omit<AllocationRule, 'id'> = {
        description: ruleValues.description,
        keywords: ruleValues.keywords.split(','),
        accountId: ruleValues.accountId,
        vatType: ruleValues.vatType,
        type: 'hard',
        scope: ruleValues.scope,
      };

      try {
        const batch = writeBatch(db);
        const txIds = groupTxs.map(tx => tx.id);

        txIds.forEach(txId => {
          const txRef = doc(db, 'aiAccountantClients', client.uid!, 'transactions', txId);
          batch.update(txRef, {
            status: 'allocated',
            allocatedTo: { value: ruleValues.accountId, type: 'account' },
            vatType: client.isVatRegistered ? ruleValues.vatType : 'no_vat',
            allocatedAt: new Date(),
          });
        });

        if (ruleValues.scope === 'global') {
            const newRuleRef = doc(collection(db, 'allocationRules'));
            batch.set(newRuleRef, newRule);
            toast({ title: 'Global Rule Created', description: 'This rule will apply to all clients.' });
        } else {
            const clientRef = doc(db, 'aiAccountantClients', client.uid!);
            batch.update(clientRef, {
                allocationRules: arrayUnion(newRule)
            });
            toast({ title: 'Client Rule Created', description: 'This rule will apply to this client only.' });
        }

        await batch.commit();
        setLastApprovedTxIds(txIds);
        toast({ title: 'Transactions Approved & Rule Created', description: `${groupTxs.length} transactions approved and new rule created.`, action: <ToastAction altText="Undo" onClick={() => handleUndoAction(txIds)}>Undo</ToastAction> });
        setActiveApprovalGroup(null);
        fetchClientData();

      } catch (error) {
        console.error("Error in confirm and create rule:", error);
        toast({ title: 'Error', description: 'Could not approve and create rule.', variant: 'destructive'});
      }
    };
    
    const handleSaveChanges = async () => {
        if (!client || Object.keys(groupAllocations).length === 0) return;
        
        setIsSaving(true);
        toast({ title: 'Saving allocation suggestions...' });

        try {
            const batch = writeBatch(db);
            let updatedCount = 0;
            
            for (const supplier in groupAllocations) {
                const allocation = groupAllocations[supplier];
                const txs = groupedTransactions[supplier];
                if (txs && allocation) {
                    txs.forEach(tx => {
                        const txRef = doc(db, 'aiAccountantClients', client.uid!, 'transactions', tx.id);
                        batch.update(txRef, { aiAllocationResult: allocation });
                        updatedCount++;
                    });
                }
            }

            if(updatedCount > 0) {
                await batch.commit();
                toast({ title: 'Changes Saved', description: 'AI allocation suggestions have been updated.' });
            } else {
                 toast({ title: 'No Changes to Save', description: 'No modifications were detected.' });
            }
        } catch (error) {
            console.error("Error saving changes:", error);
            toast({ title: 'Save Failed', variant: 'destructive' });
        } finally {
            setIsSaving(false);
        }
    };

    const handleApproveSelected = async () => {
        if (!client || selectedGroups.length === 0) return;
        
        const txsToApprove = selectedGroups.flatMap(supplier => groupedTransactions[supplier] || []);
        const allocations = selectedGroups.map(supplier => groupAllocations[supplier]);
        
        if (allocations.some(alloc => !alloc || !alloc.accountId)) {
            toast({ title: 'Cannot Approve', description: 'One or more selected groups do not have an account allocated.', variant: 'destructive'});
            return;
        }

        toast({ title: "Approving Selected...", description: `Approving ${txsToApprove.length} transactions.` });
        try {
            const batch = writeBatch(db);
            const txIds = txsToApprove.map(tx => tx.id);
            
            selectedGroups.forEach(supplier => {
                const groupTxs = groupedTransactions[supplier];
                const allocation = groupAllocations[supplier];
                if (groupTxs && allocation && allocation.accountId) {
                    groupTxs.forEach(tx => {
                        const txRef = doc(db, 'aiAccountantClients', client.uid!, 'transactions', tx.id);
                        batch.update(txRef, {
                            status: 'allocated',
                            allocatedTo: { value: allocation.accountId, type: 'account' },
                            vatType: allocation.vatType,
                            allocatedAt: new Date(),
                        });
                    });
                }
            });
            
            await batch.commit();
            setLastApprovedTxIds(txIds);
            toast({ 
                title: "Success!", 
                description: `${txsToApprove.length} transactions have been moved to Reviewed.`,
                action: <ToastAction altText="Undo" onClick={() => handleUndoAction(txIds)}>Undo</ToastAction>,
            });
            setSelectedGroups([]);
        } catch (e) {
            console.error(e);
            toast({ title: 'Error', description: 'Could not approve selected transactions.', variant: 'destructive'});
        }
    };

    const handleAllocationChange = (supplier: string, field: 'accountId' | 'vatType', value: string) => {
        setGroupAllocations(prev => {
            const current = prev[supplier] || { accountId: '', vatType: 'no_vat', confidence: 0 };
            return {
                ...prev,
                [supplier]: { ...current, [field]: value } as AIAllocationResult
            };
        });
    };

    const handleApproveGroup = async (supplier: string) => {
        if (!client) return;
        const groupTxs = groupedTransactions[supplier];
        const allocation = groupAllocations[supplier];
        if (!groupTxs || !allocation || !allocation.accountId) {
             toast({ title: 'Cannot Approve', description: 'Please select an account to allocate to first.', variant: 'destructive'});
            return;
        }

        try {
            const batch = writeBatch(db);
            const txIds = groupTxs.map(tx => tx.id);
            txIds.forEach(txId => {
                const txRef = doc(db, 'aiAccountantClients', client.uid!, 'transactions', txId);
                batch.update(txRef, {
                    status: 'allocated',
                    allocatedTo: { value: allocation.accountId, type: 'account' },
                    vatType: allocation.vatType,
                    allocatedAt: new Date(),
                });
            });
            await batch.commit();
            setLastApprovedTxIds(txIds);
            toast({ 
                title: 'Group Approved', 
                description: `${groupTxs.length} transactions for '${supplier}' moved to Reviewed.`,
                action: <ToastAction altText="Undo" onClick={() => handleUndoAction(txIds)}>Undo</ToastAction>
            });
        } catch (e) {
            console.error(e);
            toast({ title: 'Error', description: 'Could not approve group.', variant: 'destructive'});
        }
    };

    const handleDownloadExcel = () => {
        if (Object.keys(groupedTransactions).length === 0) {
            toast({ title: "No data to download." });
            return;
        }

        const dataToExport = Object.entries(groupedTransactions).flatMap(([supplier, txs]) => 
            txs.map(tx => ({
                'Group (Supplier)': supplier,
                'Date': format(new Date(tx.date), 'dd/MM/yyyy'),
                'Description': tx.description,
                'Amount': tx.amount,
                'Suggested Account': chartOfAccounts.find(acc => acc.id === tx.aiAllocationResult?.accountId)?.description || 'N/A',
                'Suggested VAT': allVatTypes.find(vat => vat.name === tx.aiAllocationResult?.vatType)?.label || 'N/A',
                'Allocate to Account': '',
                'Allocate VAT Type': '',
            }))
        );
        const ws = XLSX.utils.json_to_sheet(dataToExport);

        const accountsList = chartOfAccounts.map(acc => [acc.description]);
        const vatList = allVatTypes.map(vat => [vat.label]);
        
        const ws_accounts = XLSX.utils.aoa_to_sheet(accountsList);
        const ws_vat = XLSX.utils.aoa_to_sheet(vatList);

        if (!ws['!dataValidations']) {
            ws['!dataValidations'] = [];
        }

        const numRows = dataToExport.length;
        ws['!dataValidations'].push({
            sqref: `G2:G${numRows + 1}`,
            type: 'list',
            allowBlank: true,
            showDropDown: true,
            formula1: `AccountsList!$A$1:$A$${accountsList.length}`
        });
        
        ws['!dataValidations'].push({
            sqref: `H2:H${numRows + 1}`,
            type: 'list',
            allowBlank: true,
            showDropDown: true,
            formula1: `VATList!$A$1:$A$${vatList.length}`
        });

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "AI Workflow");
        XLSX.utils.book_append_sheet(wb, ws_accounts, "AccountsList");
        XLSX.utils.book_append_sheet(wb, ws_vat, "VATList");
        
        if (wb.Sheets['AccountsList']) wb.Sheets['AccountsList']['!props'] = { hidden: true };
        if (wb.Sheets['VATList']) wb.Sheets['VATList']['!props'] = { hidden: true };

        XLSX.writeFile(wb, `AI_Workflow_Export_${client?.name?.replace(/\s+/g, '_')}.xlsx`);
        
        toast({ title: 'Download Started', description: 'Your Excel file is being generated.' });
    };

    const isProcessing = job?.status === 'running';
    const progress = job && job.total > 0 ? (job.processed / job.total) * 100 : 0;
    const transactionsInProcessing = transactions.filter(tx => tx.status === 'ai_processing').length;

    return (
        <React.Fragment>
             <ApproveAndCreateRuleDialog
                isOpen={!!activeApprovalGroup}
                onOpenChange={(open) => setActiveApprovalGroup(open ? activeApprovalGroup : null)}
                groupData={activeApprovalGroup || { supplier: '', txs: [], suggestion: null }}
                client={client}
                onConfirm={handleConfirmApprovalAndRuleCreation}
            />
            <Card>
                 <CardHeader className="p-4 border-b">
                     <div className="flex items-center justify-between">
                        <h2>AI Workflow ({Object.keys(groupedTransactions).length} groups)</h2>
                         <div className="flex gap-2">
                            <Button onClick={() => handleRunAiAllocation()} disabled={isLoading || isProcessing || transactionsInProcessing === 0}>
                                {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Sparkles className="mr-2 h-4 w-4" />}
                                Run AI Allocation
                            </Button>
                            <Button onClick={() => handleRunAiAllocation(true)} disabled={isLoading || isProcessing} variant="outline">
                                <RefreshCw className="mr-2 h-4 w-4"/>
                                Re-analyse Groupings
                            </Button>
                            <Button variant="outline" onClick={handleSaveChanges} disabled={isSaving || isProcessing}>
                                {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                Save Changes
                            </Button>
                            <Button onClick={handleApproveSelected} disabled={selectedGroups.length === 0 || isProcessing}>
                                Approve Selected ({selectedGroups.length})
                            </Button>
                            <Button onClick={handleDownloadExcel} variant="outline" disabled={isLoading || isProcessing || Object.keys(groupedTransactions).length === 0}>
                                <Download className="mr-2 h-4 w-4"/>
                                Download Excel
                            </Button>
                             <Button
                                variant="ghost"
                                onClick={() => lastApprovedTxIds && handleUndoAction(lastApprovedTxIds)}
                                disabled={!lastApprovedTxIds || isProcessing}
                            >
                                <RotateCcw className="mr-2 h-4 w-4" />
                                Undo Last Approval
                            </Button>
                         </div>
                     </div>
                 </CardHeader>
                 <CardContent className="p-4 space-y-4">
                    {isProcessing && job && (
                         <div className="space-y-2 p-4 border rounded-lg bg-muted">
                            <h3 className="font-semibold text-center">AI Allocation in Progress...</h3>
                            <Progress value={progress} />
                            <p className="text-sm text-muted-foreground text-center">Processing group {job.processed} of {job.total}. Please keep this tab open for the process to complete.</p>
                        </div>
                    )}
                    {job?.status === 'failed' && (
                        <Alert variant="destructive">
                            <AlertTriangle className="h-4 w-4"/>
                            <AlertTitle>Last Job Failed</AlertTitle>
                            <AlertDescription>{job.error || 'An unknown error occurred.'}</AlertDescription>
                        </Alert>
                    )}
                    {isLoading || isLoadingJob ? (
                        <div className="text-center py-8">
                            <Loader2 className="animate-spin mx-auto" />
                        </div>
                    ) : transactions.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                            No transactions are in the AI Workflow. Go to the 'New Transactions' tab to send some for processing.
                        </div>
                    ) : (
                        <div className="space-y-4">
                             {Object.entries(groupedTransactions).map(([supplier, txs]) => {
                                const suggestion = groupAllocations[supplier];
                                return (
                                <Collapsible key={supplier} className="border rounded-lg" defaultOpen={true}>
                                    <div className="flex items-center justify-between p-3 bg-muted/50 rounded-t-lg">
                                        <CollapsibleTrigger asChild>
                                             <div className="flex items-center gap-4 text-left pr-4 flex-grow cursor-pointer">
                                                <Checkbox
                                                    checked={selectedGroups.includes(supplier)}
                                                    onCheckedChange={(checked) => {
                                                        setSelectedGroups(prev => checked ? [...prev, supplier] : prev.filter(s => s !== supplier))
                                                    }}
                                                    onClick={(e) => e.stopPropagation()}
                                                    className="ml-2"
                                                />
                                                <h3 className="font-bold">{supplier} <span className="font-normal text-muted-foreground">({txs.length} items)</span></h3>
                                                {suggestion && <p className="text-xs text-muted-foreground">AI Confidence: {suggestion.confidence}%</p>}
                                            </div>
                                        </CollapsibleTrigger>
                                        <div className="flex items-center gap-2 flex-shrink-0">
                                            <Select onValueChange={(value) => handleAllocationChange(supplier, 'accountId', value)} value={suggestion?.accountId || ''}>
                                                <SelectTrigger className="h-8 w-[200px] bg-white"><SelectValue placeholder="Select Account..." /></SelectTrigger>
                                                <SelectContent>
                                                    {chartOfAccounts.map(acc => <SelectItem key={acc.id} value={acc.id}>{acc.description}</SelectItem>)}
                                                </SelectContent>
                                            </Select>
                                            <Select onValueChange={(value) => handleAllocationChange(supplier, 'vatType', value as VatType)} value={suggestion?.vatType || 'no_vat'}>
                                                <SelectTrigger className="h-8 w-[200px] bg-white"><SelectValue placeholder="Select VAT..." /></SelectTrigger>
                                                <SelectContent>
                                                    {allVatTypes.map(vt => <SelectItem key={vt.name} value={vt.name}>{vt.label}</SelectItem>)}
                                                </SelectContent>
                                            </Select>
                                            <div className="flex items-center gap-1">
                                                <Button size="sm" variant="destructive" onClick={() => handleRejectSelected(txs.map(t => t.id))}>Reject</Button>
                                                <Button size="sm" onClick={() => handleApproveGroup(supplier)}>Approve</Button>
                                                <Button size="sm" onClick={() => setActiveApprovalGroup({ supplier, txs, suggestion })}>Create Rule</Button>
                                            </div>
                                        </div>
                                    </div>
                                    <CollapsibleContent>
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead className="w-12"><Checkbox/></TableHead>
                                                    <TableHead className="w-[120px]">Date</TableHead>
                                                    <TableHead>Description</TableHead>
                                                    <TableHead className="text-right w-[150px]">Amount</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {txs.map(tx => (
                                                    <TableRow key={tx.id}>
                                                        <TableCell><Checkbox /></TableCell>
                                                        <TableCell className="text-xs">{format(new Date(tx.date), 'dd/MM/yyyy')}</TableCell>
                                                        <TableCell className="text-xs">{tx.description}</TableCell>
                                                        <TableCell className="text-right font-mono text-xs">{formatPrice(tx.amount)}</TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </CollapsibleContent>
                                </Collapsible>
                            )})}
                        </div>
                    )}
                 </CardContent>
            </Card>
        </React.Fragment>
    );
};

function BankTransactionsPage() {
    const params = useParams();
    const router = useRouter();
    const accountIdFromUrl = useSearchParams().get('accountId');
    
    const [client, setClient] = useState<User | null>(null);
    const [allAccountTransactions, setAllAccountTransactions] = useState<(ImportedTransaction | AllocatedTransaction)[]>([]);
    const [isNewAccountDialogOpen, setIsNewAccountDialogOpen] = useState(false);
    const { toast } = useToast();
    const [isEditAccountDialogOpen, setIsEditAccountDialogOpen] = useState(false);
    const [selectedAccountForEdit, setSelectedAccountForEdit] = useState<ChartOfAccount | null>(null);
    const [customers, setCustomers] = useState<ClientCustomer[]>([]);
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [globalRules, setGlobalRules] = useState<AllocationRule[]>([]);
    const [activeTab, setActiveTab] = useState('new-transactions');
    const [accountId, setAccountId] = useState<string | null>(accountIdFromUrl);

    const newTransactionsTabRef = useRef<{ refetch: () => void }>(null);
    const reviewedTabRef = useRef<{ refetch: () => void }>(null);
    const forReviewTabRef = useRef<{ refetch: () => void }>(null);

    const fetchClientData = useCallback(async () => {
        const clientId = params.clientId as string;
        if (!clientId) return;
        try {
            const clientRef = doc(db, 'aiAccountantClients', clientId);
            const clientSnap = await getDoc(clientRef);
            if (clientSnap.exists()) {
                const clientData = clientSnap.data() as User;
                 setClient(clientData);
                 const bankAccounts = clientData.chartOfAccounts?.filter(acc => acc.accountNumber.startsWith('8400-'));
                 if(!accountId && bankAccounts && bankAccounts.length > 0) {
                    setAccountId(bankAccounts[0].id);
                 }
            } else {
                toast({ title: 'Client Not Found', description: 'Could not load client data.', variant: 'destructive' });
            }
        } catch (error) {
            console.error("Error fetching client data:", error);
            toast({ title: 'Error', description: 'Failed to fetch client data.', variant: 'destructive' });
        }
    }, [params.clientId, toast, accountId]);

    useEffect(() => {
        fetchClientData();
    }, [fetchClientData]);
    
    useEffect(() => {
        const clientId = params.clientId as string;
        if (!clientId || !accountId) return;
        const q = query(collection(db, 'aiAccountantClients', clientId, 'transactions'), where('bankAccountId', '==', accountId));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const fetched = snapshot.docs.map(d => ({id: d.id, ...d.data()}) as (ImportedTransaction | AllocatedTransaction));
            setAllAccountTransactions(fetched);
        });
        return () => unsubscribe();
    }, [params.clientId, accountId]);
    
    const accountStats = useMemo(() => {
        if (allAccountTransactions.length === 0) {
            return { balance: 0, unallocatedCount: 0 };
        }
        const balance = allAccountTransactions.reduce((sum, tx) => sum + tx.amount, 0);
        const unallocatedCount = allAccountTransactions.filter(tx => tx.status === 'new').length;
        return { balance, unallocatedCount };
    }, [allAccountTransactions]);

    useEffect(() => {
        const clientId = params.clientId as string;
        if (!clientId) return;
        const fetchCustomersAndInvoices = async () => {
            try {
                const custQuery = query(collection(db, `aiAccountantClients/${clientId}/customers`));
                const custSnapshot = await getDocs(custQuery);
                setCustomers(custSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as ClientCustomer[]);

                const invQuery = query(collection(db, `aiAccountantClients/${clientId}/invoices`));
                const invSnapshot = await getDocs(invQuery);
                setInvoices(invSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Invoice[]);
            } catch (error) {
                console.error("Error fetching sub-collections:", error);
            }
        };
        fetchCustomersAndInvoices();
    }, [params.clientId]);

    useEffect(() => {
        const fetchGlobalRules = async () => {
            try {
                const q = query(collection(db, 'allocationRules'));
                const querySnapshot = await getDocs(q);
                setGlobalRules(querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as AllocationRule[]);
            } catch (error) {
                console.error("Error fetching global rules:", error);
            }
        };
        fetchGlobalRules();
    }, []);


    const handleAccountCreated = useCallback(() => {
        fetchClientData();
    }, [fetchClientData]);

    const handleRefreshAll = () => {
        newTransactionsTabRef.current?.refetch();
        reviewedTabRef.current?.refetch();
        forReviewTabRef.current?.refetch();
    };

    const handleClearTransactions = async () => {
        if (!client || !accountId) return;

        toast({ title: "Clearing transactions...", description: "This might take a moment." });
        
        const q = query(collection(db, 'aiAccountantClients', client.uid!, 'transactions'), where('bankAccountId', '==', accountId));
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            toast({ title: "No transactions to clear." });
            return;
        }

        try {
            for (let i = 0; i < snapshot.docs.length; i += BATCH_SIZE) {
                const batch = writeBatch(db);
                const chunk = snapshot.docs.slice(i, i + BATCH_SIZE);
                chunk.forEach(doc => {
                    batch.delete(doc.ref);
                });
                await batch.commit();
            }
            toast({ title: "Transactions Cleared", description: `Removed ${snapshot.size} transactions.`, variant: 'destructive' });
        } catch (e) {
            console.error(e);
            toast({ title: "Error", description: "Failed to clear transactions.", variant: 'destructive' });
        }
    }

    if (!client) {
        return <div className="text-center mt-8"><Loader2 className="h-8 w-8 animate-spin" /></div>;
    }
    
    const bankAccounts = client.chartOfAccounts?.filter(acc => acc.accountNumber.startsWith('8400-')) || [];
    
    if (bankAccounts.length > 0 && !accountId) {
      setAccountId(bankAccounts[0].id);
      return <div className="text-center mt-8"><Loader2 className="h-8 w-8 animate-spin" /></div>;
    }
    
    const selectedBankAccount = accountId ? bankAccounts.find(acc => acc.id === accountId) : undefined;
    
    if (bankAccounts.length === 0) {
        return (
             <div className="text-center mt-8">
                <Alert variant="destructive" className="max-w-md mx-auto">
                    <AlertTitle>No Bank Accounts Found</AlertTitle>
                    <AlertDescription>Please create a bank account first to manage transactions.</AlertDescription>
                </Alert>
                 <CreateAccountDialog client={client} onAccountCreated={handleAccountCreated} open={isNewAccountDialogOpen} onOpenChange={setIsNewAccountDialogOpen} />
            </div>
        );
    }

    return (
        <div>
            {selectedAccountForEdit && <EditAccountDialog
                account={selectedAccountForEdit}
                client={client}
                onAccountUpdated={handleAccountCreated}
                open={isEditAccountDialogOpen}
                onOpenChange={(open) => {
                    setIsEditAccountDialogOpen(open);
                    if (!open) setSelectedAccountForEdit(null);
                }}
            />}
            <div className="md:flex items-start justify-between">
                <div className="flex items-center gap-4">
                    <Select value={accountId || ''} onValueChange={(val) => setAccountId(val)}>
                        <SelectTrigger className="w-[280px]">
                            <SelectValue placeholder="Select a bank account" />
                        </SelectTrigger>
                        <SelectContent>
                            {bankAccounts.map(acc => <SelectItem key={acc.id} value={acc.id}>{acc.description}</SelectItem>)}
                        </SelectContent>
                    </Select>
                     <div className="flex gap-4 mt-2 text-sm">
                        <div>
                            <span className="text-muted-foreground">Balance: </span>
                            <span className="font-semibold">{formatPrice(accountStats.balance)}</span>
                        </div>
                        <div>
                            <span className="text-muted-foreground">Unallocated: </span>
                            <span className="font-semibold">{accountStats.unallocatedCount}</span>
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-2 mt-4 md:mt-0">
                     <Button variant="outline" onClick={handleRefreshAll}><RotateCcw className="mr-2 h-4 w-4"/> Refresh</Button>
                     <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button variant="destructive" disabled={!accountId}><Trash2 className="mr-2 h-4 w-4" /> Clear Transactions</Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                <AlertDialogDescription>This will permanently delete all transactions in this bank account. This action cannot be undone.</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={handleClearTransactions}>Yes, Delete All</AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                     <DropdownMenu>
                         <DropdownMenuTrigger asChild>
                            <Button><Settings className="mr-2 h-4 w-4" /> Manage Bank Account</Button>
                         </DropdownMenuTrigger>
                         <DropdownMenuContent>
                            <DropdownMenuItem onClick={() => setIsNewAccountDialogOpen(true)}>Create New Bank Account</DropdownMenuItem>
                            <DropdownMenuItem disabled={!selectedBankAccount} onClick={() => { setSelectedAccountForEdit(selectedBankAccount || null); setIsEditAccountDialogOpen(true); }}>Edit Selected Account</DropdownMenuItem>
                         </DropdownMenuContent>
                     </DropdownMenu>
                </div>
            </div>
            <div className="border rounded-lg mt-4">
                 <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as string)} className="w-full">
                    <TabsList className="grid w-full grid-cols-4 rounded-t-lg rounded-b-none h-auto">
                        <TabsTrigger value="new-transactions">New Transactions</TabsTrigger>
                        <TabsTrigger value="ai-workflow">AI Workflow</TabsTrigger>
                        <TabsTrigger value="for-review">For Review</TabsTrigger>
                        <TabsTrigger value="reviewed">Reviewed</TabsTrigger>
                    </TabsList>
                    <TabsContent value="new-transactions" className="p-0">
                        <NewTransactionsTab
                            ref={newTransactionsTabRef}
                            client={client}
                            bankAccountId={accountId}
                            currentBalance={accountStats.balance}
                            customers={customers}
                            invoices={invoices}
                            fetchClientData={fetchClientData}
                            globalRules={globalRules}
                            onAccountCreated={handleAccountCreated}
                            setActiveTab={setActiveTab}
                        />
                    </TabsContent>
                     <TabsContent value="ai-workflow" className="p-0">
                        <AIWorkflowTab
                            client={client}
                            bankAccountId={accountId}
                            chartOfAccounts={client.chartOfAccounts || []}
                            fetchClientData={fetchClientData}
                            globalRules={globalRules}
                            onRuleCreated={handleAccountCreated}
                        />
                    </TabsContent>
                    <TabsContent value="for-review" className="p-0">
                        <ForReviewTab
                            ref={forReviewTabRef}
                            client={client}
                            bankAccountId={accountId}
                            fetchClientData={fetchClientData}
                            customers={customers}
                        />
                    </TabsContent>
                    <TabsContent value="reviewed" className="p-0">
                        <ReviewedTab
                            ref={reviewedTabRef}
                            client={client}
                            bankAccountId={accountId}
                            customers={customers}
                            onAccountCreated={handleAccountCreated}
                        />
                    </TabsContent>
                </Tabs>
            </div>
        </div>
    );
}

export default BankTransactionsPage;
