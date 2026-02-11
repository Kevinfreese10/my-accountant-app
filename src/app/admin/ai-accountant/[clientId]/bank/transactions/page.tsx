
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
import { useAuth } from '@/contexts/AuthContext';


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
  referenceTokens: string[];
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  overrideRequired: boolean;
};

const PAYMENT_KEYWORDS = ['CHEQUE CARD PURCHASE', 'CARD PURCHASE', 'POS PURCHASE', 'POS', 'PURCH', 'EFT', 'IB PAY', 'IB TRF', 'DEBIT ORDER', 'D/O', 'NAEDO', 'DO-', 'ATM WITHDRAWAL', 'CASH WD', 'TRANSFER', 'PAYMENT', 'INTERNET PAYMENT'];
const GATEWAYS = ['FLW', 'PAYFAST', 'PAYPAL', 'STRIPE', 'OZOW', 'YCO', 'DPO', 'PAYU'];
const EXACT_MERCHANTS = [
    'UBER', 'CANVA', 'GOOGLE', 'TAKEALOT', 'NETFLIX', 'VODACOM', 'MTN', 'CELL C', 'TELKOM',
    'DISCOVERY', 'SANLAM', 'OLD MUTUAL', 'MOMENTUM', 'HOLLARD', 'OUTSURANCE', 'MIWAY', 'KING PRICE',
    'AFRIHOST', 'AQUAZANIA', 'DISCINSURE', 'BOOKING.COM', 'SHELL', 'BP', 'ENGEN', 'TOTAL', 'SASOL',
    'PICK N PAY', 'CHECKERS', 'WOOLWORTHS', 'SHOPRITE', 'SPAR', 'CLICKS', 'DISCHEM', 'MR D',
    'UBER EATS', 'KFC', 'HERONS', 'GELMAR', 'GOSFORTH'
];
const ALIASES: { [key: string]: string } = {
    'PNP': 'PICK N PAY',
    'P N P': 'PICK N PAY',
    'PICKNPAY': 'PICK N PAY',
    'VODA': 'VODACOM',
    'VODACOMSA': 'VODACOM',
    'TAKEALOT.COM': 'TAKEALOT',
    'CHECKERSHYP': 'CHECKERS',
    'WWW.GOOGLE.COM': 'GOOGLE',
    'WWW.TAKEALOT.COM': 'TAKEALOT',
    'UBER.CO': 'UBER',
    'CANVAS': 'CANVA',
};
const MULTI_WORD_MERCHANTS = [
    'PICK N PAY', 'UBER EATS', 'CHECKERS HYPER', 'KING PRICE', 'OLD MUTUAL', 'DISC INSURE', 'CELL C', 'MR D'
];
const DESCRIPTOR_STOPWORDS = [
    'NEW', 'ONLINE', 'TRIPS', 'EATS', 'STORE', 'SHOP', 'SERVICE', 'SERVICES', 'GROUP', 'TRADING',
    'LIMITED', 'PROPRIETARY', 'INC', 'CC', 'FROM', 'TO',
    'PURCHASE', 'CHEQUE', 'CARD', 'DEBIT', 'ORDER', 'INTERNET', 'TRANSFER', 'PAYMENT',
    'AND'
];
const LEGAL_SUFFIXES = ['PTY', 'LTD', 'CO', 'COMPANY', 'SOC'];
const FORBIDDEN_TOKENS = [...PAYMENT_KEYWORDS, ...GATEWAYS, ...DESCRIPTOR_STOPWORDS, ...LEGAL_SUFFIXES];

const REFERENCE_REGEX = [
    /\b[A-Z]{1,3}\d{3,}\b/g,      // e.g., I04539, INV12345
    /\b\d{4,}-\d{4,}\b/g,       // e.g., 04539-35779
    /\b\d{8,}\b/g,              // Long numeric strings (8+ digits)
    /\b\*{6,}\d{4,}\b/g,         // Masked card numbers e.g. 400568******7600
];

function cleanDescription(description: string): CleanResult {
    if (!description) {
        return {
            cleanedDescription: '',
            merchantKey: 'UNKNOWN',
            paymentChannel: 'UNKNOWN',
            referenceTokens: [],
            confidence: 'LOW',
            overrideRequired: true,
        };
    }
    
    // STAGE 1: Normalization
    const originalForClean = description;
    let workingDesc = description.toUpperCase().replace(/\s+/g, ' ').trim();

    let paymentChannel: CleanResult['paymentChannel'] = 'UNKNOWN';
    let merchantKey = 'UNKNOWN';
    let confidence: CleanResult['confidence'] = 'LOW';
    const referenceTokens: string[] = [];

    // STAGE 2: Detect & REMOVE Payment Keywords
    for (const keyword of PAYMENT_KEYWORDS) {
        if (workingDesc.startsWith(keyword)) {
            if (['PURCH', 'CARD', 'POS'].some(k => keyword.includes(k))) paymentChannel = 'CARD';
            else if (['EFT', 'IB PAY'].some(k => keyword.includes(k))) paymentChannel = 'EFT';
            else if (['DEBIT ORDER', 'D/O'].some(k => keyword.includes(k))) paymentChannel = 'DEBIT_ORDER';
            else if (['ATM'].some(k => keyword.includes(k))) paymentChannel = 'ATM';
            else if (['TRANSFER', 'PAYMENT'].some(k => keyword.includes(k))) paymentChannel = 'TRANSFER';
            
            workingDesc = workingDesc.substring(keyword.length).trim();
            break;
        }
    }

    // NEW STAGE: URL Handling
    const urlRegex = /https?:\/\/(www\.)?([a-zA-Z0-9-]+)(\.[a-zA-Z.]{2,5})+/gi;
    const urlMatches = workingDesc.match(urlRegex);
    if (urlMatches && urlMatches.length > 0) {
        const url = urlMatches[0];
        const domain = url.replace(/https?:\/\//, '').replace('www.', '');
        const mainDomain = domain.split('.')[0];
        if (mainDomain) {
            merchantKey = mainDomain.toUpperCase();
            confidence = 'HIGH';
            workingDesc = workingDesc.replace(url, ' ');
        }
    }
    
    // STAGE 3: Gateway + Star Handling
    if (workingDesc.includes('*')) {
        const parts = workingDesc.split('*');
        const leftPart = parts[0].trim();
        const rightPart = parts.slice(1).join('*').trim();
        
        if (GATEWAYS.includes(leftPart)) {
            workingDesc = rightPart; // Discard gateway, process the rest
        } else {
            if(leftPart.length > 2 && merchantKey === 'UNKNOWN') {
              merchantKey = leftPart;
              workingDesc = rightPart;
              confidence = 'MEDIUM'; 
            } else {
              workingDesc = rightPart; 
            }
        }
    }
    
    // STAGE 4: Remove Reference Patterns
    REFERENCE_REGEX.forEach(regex => {
        const matches = workingDesc.match(regex);
        if (matches) {
            matches.forEach(match => {
                referenceTokens.push(match);
                workingDesc = workingDesc.replace(match, ' ');
            });
        }
    });
    
    // Further cleaning of the working string
    workingDesc = workingDesc.replace(/[^A-Z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();

    // STAGE 5: Anchor Lock (only if a merchant wasn't found in STAGE 3 or URL stage)
    if (merchantKey === 'UNKNOWN') {
        
        // Multi-word first (on semi-cleaned string)
        for (const multi of MULTI_WORD_MERCHANTS) {
            if (workingDesc.includes(multi)) {
                merchantKey = multi;
                confidence = 'HIGH';
                break;
            }
        }
        
        if (merchantKey === 'UNKNOWN') {
            // If no multi-word match, THEN remove stopwords and check for single words.
            const tokens = workingDesc.split(' ').filter(token => !DESCRIPTOR_STOPWORDS.includes(token));
            const singleWordWorkingDesc = tokens.join(' ');
            
            for (const token of tokens) {
                if (EXACT_MERCHANTS.includes(token)) {
                    merchantKey = token;
                    confidence = 'HIGH';
                    break;
                }
                if (ALIASES[token]) {
                    merchantKey = ALIASES[token];
                    confidence = 'MEDIUM';
                    break;
                }
            }
        }
    }
    
    // STAGE 6: Fallback (if still no good merchant)
    if (merchantKey === 'UNKNOWN') {
        const significantTokens = workingDesc.split(' ').filter(token => 
            token.length >= 3 &&
            !/^\d+$/.test(token) &&
            !FORBIDDEN_TOKENS.includes(token)
        );
        if (significantTokens.length > 0) {
            merchantKey = significantTokens[0];
            confidence = 'LOW';
        }
    }

    // STAGE 9: Self-Check Validation Loop
    if (merchantKey !== 'UNKNOWN') {
        const finalKeyLower = merchantKey.toLowerCase();
        if (FORBIDDEN_TOKENS.map(f => f.toLowerCase()).includes(finalKeyLower) || /^\d+$/.test(merchantKey)) {
            merchantKey = 'UNKNOWN';
            confidence = 'LOW';
        } else if (confidence === 'MEDIUM' || confidence === 'HIGH') {
             const finalTokens = merchantKey.split(' ');
             const cleanedTokens = finalTokens.filter(t => !DESCRIPTOR_STOPWORDS.includes(t) && !LEGAL_SUFFIXES.includes(t));
             merchantKey = cleanedTokens.join(' ');
        }
    }

    if (ALIASES[merchantKey]) {
      merchantKey = ALIASES[merchantKey];
    }
    
    if (merchantKey === '') merchantKey = 'UNKNOWN';
    
    return {
        cleanedDescription: originalForClean,
        merchantKey,
        paymentChannel,
        referenceTokens: [...new Set(referenceTokens)],
        confidence,
        overrideRequired: confidence === 'LOW' || merchantKey === 'UNKNOWN',
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
                    referenceTokens: cleanResult.referenceTokens,
                    confidence: cleanResult.confidence,
                    overrideRequired: cleanResult.overrideRequired,
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
            constraints.push(where('amount', '&lt;', 0));
        } else {
             constraints.push(where('amount', '&gt;=', 0));
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
    } = usePaginatedFirestore&lt;ImportedTransaction&gt;({ baseQuery: baseQuery, pageSize: PAGE_SIZE });

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
            searchConstraints.push(where('amount', '&lt;', 0));
        } else {
            searchConstraints.push(where('amount', '&gt;=', 0));
        }
        const q = query(collection(db, 'aiAccountantClients', client.uid, 'transactions'), ...searchConstraints);

        try {
            const snapshot = await getDocs(q);
            const allDocs = snapshot.docs.map(d =&gt; ({id: d.id, ...d.data()}) as ImportedTransaction);
            const filtered = allDocs.filter(tx =&gt; tx.description.toLowerCase().includes(searchTerm.toLowerCase()));
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

        return () =&gt; clearTimeout(debounce);
    }, [searchTerm, handleSearch]);

    const transactions = useMemo(() =&gt; {
        let docs = searchResults !== null ? searchResults : paginatedDocuments;
        
        if (sortField === 'description') {
            docs.sort((a, b) =&gt; {
                const comparison = a.description.localeCompare(b.description);
                return sortDirection === 'asc' ? comparison : -comparison;
            });
        }
        return docs;
    }, [searchResults, paginatedDocuments, sortField, sortDirection]);
    
    React.useImperativeHandle(ref, () =&gt; ({
        refetch,
    }));

    useEffect(() =&gt; {
        refetch();
        setSearchTerm('');
        setSearchResults(null);
    }, [activeSubTab, refetch]);
    
    const handleAllocateByRules = useCallback(async () =&gt; {
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
                baseQuery = query(baseQuery, where('amount', '&lt;', 0));
            } else {
                baseQuery = query(baseQuery, where('amount', '&gt;=', 0));
            }

            const snapshot = await getDocs(baseQuery);
            const allNewTransactions = snapshot.docs.map(d =&gt; ({id: d.id, ...d.data()}) as ImportedTransaction);

            if (allNewTransactions.length === 0) {
                toast({ title: 'No New Transactions', description: 'No transactions to allocate.' });
                setIsRuleAllocating(false);
                return;
            }
            
            let allocatedCount = 0;
            const updatePromises = [];
            for (let i = 0; i &lt; allNewTransactions.length; i += BATCH_SIZE) {
                const batch = writeBatch(db);
                const chunk = allNewTransactions.slice(i, i + BATCH_SIZE);
                chunk.forEach(tx =&gt; {
                    const txDescriptionLower = tx.description.toLowerCase();
                    const matchedRule = allRules.find(rule =&gt;
                        rule.keywords.some(kw =&gt; txDescriptionLower.includes(kw.toLowerCase()))
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

            if (allocatedCount &gt; 0) {
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

    const handleRuleCreated = useCallback(() =&gt; {
        fetchClientData();
        setTimeout(() =&gt; {
            handleAllocateByRules();
        }, 1000);
    }, [fetchClientData, handleAllocateByRules]);


    const handleAiAllocateSelected = async () =&gt; {
        if (!client || !client.uid || selectedTransactions.length === 0) return;
        setIsAiAllocating(true);
        toast({ title: "Preparing AI Workflow...", description: "Moving selected transactions to the AI workflow tab." });

        try {
            for (let i = 0; i &lt; selectedTransactions.length; i += BATCH_SIZE) {
                const batch = writeBatch(db);
                const chunk = selectedTransactions.slice(i, i + BATCH_SIZE);
                chunk.forEach(txId =&gt; {
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
    
    const handleAiAllocateAll = async () =&gt; {
        if (!client || !client.uid || !bankAccountId) return;
        setIsAiAllDialogOpen(false);
        
        const q = query(
            collection(db, 'aiAccountantClients', client.uid, 'transactions'),
            where('bankAccountId', '==', bankAccountId),
            where('status', '==', 'new'),
            where('amount', '&lt;', 0) // Only expenses
        );

        const snapshot = await getDocs(q);
        const transactionsToProcess = snapshot.docs.map(d =&gt; d.id);
        
        if (transactionsToProcess.length === 0) {
            toast({ title: "No new expense transactions found." });
            return;
        }

        const toastId = toast({ title: "Gathering transactions...", description: `Found ${transactionsToProcess.length} expenses to process.`}).id;
        
        try {
            for (let i = 0; i &lt; transactionsToProcess.length; i += BATCH_SIZE) {
                const batch = writeBatch(db);
                const chunk = transactionsToProcess.slice(i, i + BATCH_SIZE);
                chunk.forEach(txId =&gt; {
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


    const handleBulkDelete = async () =&gt; {
        if (!client || !client.uid || selectedTransactions.length === 0) return;

        try {
            for (let i = 0; i &lt; selectedTransactions.length; i += BATCH_SIZE) {
                const batch = writeBatch(db);
                const chunk = selectedTransactions.slice(i, i + BATCH_SIZE);
                chunk.forEach(txId =&gt; {
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

    const handleBulkAllocate = async (allocation: { value: string, type: 'account' | 'customer' | 'supplier' }, vatType: VatType) =&gt; {
        if (!client || !client.uid || selectedTransactions.length === 0) return;
        toast({ title: "Allocating...", description: `Allocating ${selectedTransactions.length} transactions.` });
    
        const transactionsToAllocate = selectedTransactions;
    
        try {
            for (let i = 0; i &lt; transactionsToAllocate.length; i += BATCH_SIZE) {
                const batch = writeBatch(db);
                const chunk = transactionsToAllocate.slice(i, i + BATCH_SIZE);
                chunk.forEach(txId =&gt; {
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
    
    const handleRefreshDescriptions = async () =&gt; {
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

            for (let i = 0; i &lt; transactionsToRefresh.length; i += BATCH_SIZE) {
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
                            referenceTokens: cleanResult.referenceTokens,
                            confidence: cleanResult.confidence,
                            overrideRequired: cleanResult.overrideRequired,
                        });
                        refreshedCount++;
                    }
                }
                await batch.commit();
            }

            if (refreshedCount &gt; 0) {
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


    const handleDownloadExcel = async () =&gt; {
        if (!client || !client.uid || !bankAccountId) return;
        setIsDownloading(true);
        toast({ title: "Preparing Download...", description: "Fetching all new transactions." });
    
        try {
            const incomeQuery = query(
                collection(db, 'aiAccountantClients', client.uid, 'transactions'),
                where('bankAccountId', '==', bankAccountId),
                where('status', '==', 'new'),
                where('amount', '&gt;=', 0)
            );
            const expensesQuery = query(
                collection(db, 'aiAccountantClients', client.uid, 'transactions'),
                where('status', '==', 'new'),
                where('amount', '&lt;', 0)
            );
    
            const [incomeSnapshot, expensesSnapshot] = await Promise.all([
                getDocs(incomeQuery),
                getDocs(expensesQuery)
            ]);
    
            const incomeData = incomeSnapshot.docs
                .map(doc =&gt; doc.data() as ImportedTransaction)
                .map(({ date, description, amount }) =&gt; ({ Date: format(new Date(date), 'dd/MM/yyyy'), Description: description, Amount: amount }));
    
            const expensesData = expensesSnapshot.docs
                .map(doc =&gt; doc.data() as ImportedTransaction)
                .map(({ date, description, amount }) =&gt; ({ Date: format(new Date(date), 'dd/MM/yyyy'), Description: description, Amount: amount }));
    
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
    
    const handleSaveAllocations = async () =&gt; {
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
        &lt;Card&gt;
            &lt;CreateRuleDialog
                client={client}
                onRuleCreated={handleRuleCreated}
                open={isCreateRuleOpen}
                onOpenChange={(isOpen) =&gt; {
                    setIsCreateRuleOpen(isOpen);
                    if (!isOpen) {
                        setRuleDefaultValues({ description: '', keywords: '', accountId: '', vatType: 'standard_rated_purchases' });
                    }
                }}
                defaultValues={ruleDefaultValues}
            /&gt;
             &lt;CreateGeneralAccountDialog 
                client={client}
                onAccountCreated={onAccountCreated}
                open={isCreateGeneralAccountOpen}
                onOpenChange={setIsCreateGeneralAccountOpen}
             /&gt;

             &lt;Dialog open={isAiSelectedDialogOpen} onOpenChange={setIsAiSelectedDialogOpen}&gt;
                &lt;DialogContent&gt;
                    &lt;DialogHeader&gt;
                        &lt;DialogTitle&gt;AI Allocate Selected&lt;/DialogTitle&gt;
                        &lt;DialogDescription&gt;
                            The selected transaction(s) will be moved to the AI workflow tab for processing.
                        &lt;/DialogDescription&gt;
                    &lt;/DialogHeader&gt;
                    &lt;DialogFooter&gt;
                        &lt;Button type="button" variant="ghost" onClick={() =&gt; setIsAiSelectedDialogOpen(false)}&gt;Cancel&lt;/Button&gt;
                        &lt;Button type="button" onClick={handleAiAllocateSelected} disabled={isAiAllocating}&gt;
                            {isAiAllocating ? &lt;Loader2 className="mr-2 h-4 w-4 animate-spin"/&gt; : &lt;Sparkles className="mr-2 h-4 w-4" /&gt;}
                            Allocate Selected
                        &lt;/Button&gt;
                    &lt;/DialogFooter&gt;
                &lt;/DialogContent&gt;
            &lt;/Dialog&gt;

             &lt;Dialog open={isAiAllDialogOpen} onOpenChange={setIsAiAllDialogOpen}&gt;
                &lt;DialogContent&gt;
                    &lt;DialogHeader&gt;
                        &lt;DialogTitle&gt;AI Allocate All&lt;/DialogTitle&gt;
                        &lt;DialogDescription&gt;
                            This will send ALL new expenses in this bank account to the AI workflow for processing. Are you sure?
                        &lt;/DialogDescription&gt;
                    &lt;/DialogHeader&gt;
                    &lt;DialogFooter&gt;
                        &lt;Button type="button" variant="ghost" onClick={() =&gt; setIsAiAllDialogOpen(false)}&gt;Cancel&lt;/Button&gt;
                        &lt;Button type="button" onClick={handleAiAllocateAll} disabled={isAiAllocating}&gt;
                            {isAiAllocating ? &lt;Loader2 className="mr-2 h-4 w-4 animate-spin"/&gt; : &lt;Sparkles className="mr-2 h-4 w-4" /&gt;}
                            Yes, Allocate All Expenses
                        &lt;/Button&gt;
                    &lt;/DialogFooter&gt;
                &lt;/DialogContent&gt;
            &lt;/Dialog&gt;

            &lt;CardHeader className="p-0"&gt;
                &lt;Tabs value={activeSubTab} onValueChange={(value) =&gt; setActiveSubTab(value as 'expenses' | 'income')} className="w-full"&gt;
                    &lt;TabsList className="grid w-full grid-cols-2 rounded-t-lg rounded-b-none h-auto"&gt;
                        &lt;TabsTrigger value="expenses"&gt;Expenses&lt;/TabsTrigger&gt;
                        &lt;TabsTrigger value="income"&gt;Income&lt;/TabsTrigger&gt;
                    &lt;/TabsList&gt;
                &lt;/Tabs&gt;
                 &lt;div className="p-4 border-b flex items-center justify-between gap-2 flex-wrap"&gt;
                    &lt;div className="flex items-center gap-2"&gt;
                        {bankAccountId &amp;&amp; client &amp;&amp; &lt;ImportDialog 
                            client={client}
                            bankAccountId={bankAccountId}
                            currentBalance={currentBalance} 
                            onImportComplete={refetch}
                            globalRules={globalRules}
                        /&gt;}
                         &lt;DropdownMenu&gt;
                            &lt;DropdownMenuTrigger asChild&gt;
                                &lt;Button variant="outline" disabled={selectedTransactions.length === 0}&gt;
                                    Manual Allocate &lt;ChevronsUpDown className="ml-2 h-4 w-4"/&gt;
                                &lt;/Button&gt;
                            &lt;/DropdownMenuTrigger&gt;
                            &lt;DropdownMenuContent className="w-64 p-0"&gt;
                               &lt;Command&gt;
                                 &lt;CommandInput placeholder="Search accounts..." /&gt;
                                 &lt;ScrollArea className="h-72"&gt;
                                 &lt;CommandList&gt;
                                    &lt;CommandEmpty&gt;No results found.&lt;/CommandEmpty&gt;
                                    &lt;CommandGroup&gt;
                                        &lt;CommandItem onSelect={() =&gt; {setIsCreateGeneralAccountOpen(true);}} className="text-primary cursor-pointer"&gt;
                                            &lt;PlusCircle className="mr-2 h-4 w-4"/&gt;Create new account...
                                        &lt;/CommandItem&gt;
                                    &lt;/CommandGroup&gt;
                                    &lt;DropdownMenuSeparator /&gt;
                                    {activeSubTab === 'income' &amp;&amp; customers.length &gt; 0 &amp;&amp; (
                                        &lt;CommandGroup heading="Customers"&gt;
                                            {customers.map(c =&gt; (
                                                &lt;CommandItem key={c.id} onSelect={() =&gt; handleBulkAllocate({value: c.id, type: 'customer'}, 'no_vat')}&gt;
                                                    {c.name}
                                                &lt;/CommandItem&gt;
                                            ))}
                                        &lt;/CommandGroup&gt;
                                    )}
                                    &lt;CommandGroup heading="Accounts"&gt;
                                        {client?.chartOfAccounts?.map(acc =&gt; (
                                            &lt;DropdownMenuSub key={acc.id}&gt;
                                                &lt;DropdownMenuSubTrigger&gt;
                                                    &lt;CommandItem onSelect={(e) =&gt; e.preventDefault()} className="w-full"&gt;
                                                        &lt;span&gt;{acc.description}&lt;/span&gt;
                                                    &lt;/CommandItem&gt;
                                                &lt;/DropdownMenuSubTrigger&gt;
                                                &lt;DropdownMenuSubContent&gt;
                                                    {client?.isVatRegistered ? allVatTypes.map(vat =&gt; (
                                                        &lt;DropdownMenuItem key={vat.name} onSelect={() =&gt; handleBulkAllocate({value: acc.id, type: 'account'}, vat.name)}&gt;
                                                            {vat.label}
                                                        &lt;/DropdownMenuItem&gt;
                                                    )) : (
                                                        &lt;DropdownMenuItem onSelect={() =&gt; handleBulkAllocate({value: acc.id, type: 'account'}, 'no_vat')}&gt;
                                                            No VAT
                                                        &lt;/DropdownMenuItem&gt;
                                                    )}
                                                &lt;/DropdownMenuSubContent&gt;
                                            &lt;/DropdownMenuSub&gt;
                                        ))}
                                    &lt;/CommandGroup&gt;
                                 &lt;/CommandList&gt;
                                 &lt;/ScrollArea&gt;
                               &lt;/Command&gt;
                            &lt;/DropdownMenuContent&gt;
                        &lt;/DropdownMenu&gt;
                         &lt;Button variant="outline" onClick={handleRefreshDescriptions} disabled={isRefreshing}&gt;
                            {isRefreshing ? &lt;Loader2 className="mr-2 h-4 w-4 animate-spin"/&gt; : &lt;RefreshCw className="mr-2 h-4 w-4" /&gt;}
                            Refresh All Descriptions
                        &lt;/Button&gt;
                        &lt;DropdownMenu&gt;
                            &lt;DropdownMenuTrigger asChild&gt;
                                &lt;Button variant="outline" disabled={selectedTransactions.length === 0}&gt;
                                    Actions &lt;MoreHorizontal className="ml-2 h-4 w-4"/&gt;
                                &lt;/Button&gt;
                            &lt;/DropdownMenuTrigger&gt;
                            &lt;DropdownMenuContent&gt;
                                &lt;AlertDialog&gt;
                                    &lt;AlertDialogTrigger asChild&gt;
                                        &lt;DropdownMenuItem onSelect={(e) =&gt; e.preventDefault()} className="text-destructive"&gt;
                                            Delete Selected
                                        &lt;/DropdownMenuItem&gt;
                                    &lt;/AlertDialogTrigger&gt;
                                    &lt;AlertDialogContent&gt;
                                        &lt;AlertDialogHeader&gt;
                                            &lt;AlertDialogTitle&gt;Are you sure?&lt;/AlertDialogTitle&gt;
                                            &lt;AlertDialogDescription&gt;
                                                This will permanently delete {selectedTransactions.length} selected transaction(s). This cannot be undone.
                                            &lt;/AlertDialogDescription&gt;
                                        &lt;/AlertDialogHeader&gt;
                                        &lt;AlertDialogFooter&gt;
                                            &lt;AlertDialogCancel&gt;Cancel&lt;/AlertDialogCancel&gt;
                                            &lt;AlertDialogAction onClick={handleBulkDelete}&gt;Yes, Delete&lt;/AlertDialogAction&gt;
                                        &lt;/AlertDialogFooter&gt;
                                    &lt;/AlertDialogContent&gt;
                                &lt;/AlertDialog&gt;
                            &lt;/DropdownMenuContent&gt;
                        &lt;/DropdownMenu&gt;

                         &lt;Button variant="outline" onClick={() =&gt; setIsAiSelectedDialogOpen(true)} disabled={isAiAllocating || selectedTransactions.length === 0 || activeSubTab === 'income'}&gt;
                            &lt;Sparkles className="mr-2 h-4 w-4"/&gt; AI Allocate Selected
                        &lt;/Button&gt;
                        &lt;Button variant="outline" onClick={() =&gt; setIsAiAllDialogOpen(true)} disabled={isAiAllocating || activeSubTab === 'income'}&gt;
                            &lt;Sparkles className="mr-2 h-4 w-4"/&gt; AI Allocate All
                        &lt;/Button&gt;
                        &lt;Button variant="outline" onClick={handleDownloadExcel} disabled={isDownloading}&gt;
                            {isDownloading ? &lt;Loader2 className="mr-2 h-4 w-4 animate-spin" /&gt; : &lt;Download className="mr-2 h-4 w-4" /&gt;}
                            Download Excel
                        &lt;/Button&gt;
                    &lt;/div&gt;
                    &lt;div className="relative"&gt;
                        &lt;Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" /&gt;
                        &lt;Input
                            type="search"
                            placeholder="Search descriptions..."
                            value={searchTerm}
                            onChange={(e) =&gt; setSearchTerm(e.target.value)}
                            className="pl-8 w-64"
                        /&gt;
                    &lt;/div&gt;
                &lt;/div&gt;
            &lt;/CardHeader&gt;
            &lt;CardContent className="p-0"&gt;
                &lt;div className="overflow-x-auto"&gt;
                    &lt;Table&gt;
                        &lt;TableHeader&gt;
                            &lt;TableRow&gt;
                                &lt;TableCell className="w-12 p-2"&gt;
                                     &lt;Checkbox
                                        checked={transactions.length &gt; 0 &amp;&amp; selectedTransactions.length === transactions.length}
                                        onCheckedChange={(checked) =&gt; {
                                            setSelectedTransactions(checked ? transactions.map(tx =&gt; tx.id) : []);
                                        }}
                                    /&gt;
                                &lt;/TableCell&gt;
                                &lt;TableHead&gt;
                                    &lt;Button variant="ghost" onClick={() =&gt; handleSort('date')}&gt;Date &lt;ArrowUpDown className="ml-2 h-4 w-4 inline" /&gt;&lt;/Button&gt;
                                &lt;/TableHead&gt;
                                &lt;TableHead&gt;
                                     &lt;Button variant="ghost" onClick={() =&gt; handleSort('description')}&gt;Description &lt;ArrowUpDown className="ml-2 h-4 w-4 inline" /&gt;&lt;/Button&gt;
                                &lt;/TableHead&gt;
                                &lt;TableHead&gt;Reference&lt;/TableHead&gt;
                                &lt;TableHead className="w-[250px]"&gt;Allocate To&lt;/TableHead&gt;
                                {client?.isVatRegistered &amp;&amp; &lt;TableHead className="w-[180px]"&gt;VAT Type&lt;/TableHead&gt;}
                                &lt;TableHead className="text-right"&gt;
                                     &lt;Button variant="ghost" onClick={() =&gt; handleSort('amount')}&gt;Amount &lt;ArrowUpDown className="ml-2 h-4 w-4 inline" /&gt;&lt;/Button&gt;
                                &lt;/TableHead&gt;
                                &lt;TableHead className="text-right"&gt;Actions&lt;/TableHead&gt;
                            &lt;/TableRow&gt;
                        &lt;/TableHeader&gt;
                        &lt;TableBody&gt;
                            {isLoading || isSearching ? (
                                &lt;TableRow&gt;&lt;TableCell colSpan={8} className="text-center h-24"&gt;&lt;Loader2 className="animate-spin mx-auto" /&gt;&lt;/TableCell&gt;&lt;/TableRow&gt;
                            ) : transactions.length === 0 ? (
                                &lt;TableRow&gt;&lt;TableCell colSpan={8} className="text-center h-24 text-muted-foreground"&gt;No new transactions found.&lt;/TableCell&gt;&lt;/TableRow&gt;
                            ) : (
                                transactions.map(tx =&gt; (
                                    &lt;TableRow key={tx.id} data-state={selectedTransactions.includes(tx.id) &amp;&amp; "selected"}&gt;
                                        &lt;TableCell className="p-2"&gt;
                                            &lt;Checkbox
                                                checked={selectedTransactions.includes(tx.id)}
                                                onCheckedChange={(checked) =&gt; {
                                                    setSelectedTransactions(prev =&gt;
                                                        checked ? [...prev, tx.id] : prev.filter(id =&gt; id !== tx.id)
                                                    );
                                                }}
                                            /&gt;
                                        &lt;/TableCell&gt;
                                        &lt;TableCell&gt;{new Date(tx.date).toLocaleDateString('en-GB')}&lt;/TableCell&gt;
                                        &lt;TableCell className="whitespace-normal break-words"&gt;
                                            &lt;p&gt;{tx.description}&lt;/p&gt;
                                            {tx.merchantKey &amp;&amp; &lt;p className="text-xs text-muted-foreground font-mono bg-muted p-1 rounded-sm mt-1"&gt;{tx.merchantKey}&lt;/p&gt;}
                                        &lt;/TableCell&gt;
                                        &lt;TableCell className="font-mono"&gt;{tx.reference}&lt;/TableCell&gt;
                                        &lt;TableCell&gt;
                                            &lt;Popover&gt;
                                                &lt;PopoverTrigger asChild&gt;
                                                    &lt;Button variant="outline" className="w-full justify-start text-left font-normal h-8"&gt;
                                                        {allocations[tx.id] ? [...(client?.chartOfAccounts || []), ...customers].find(o =&gt; o.id === allocations[tx.id].value)?.description || [...(client?.chartOfAccounts || []), ...customers].find(o =&gt; o.id === allocations[tx.id].value)?.name : "Select..."}
                                                    &lt;/Button&gt;
                                                &lt;/PopoverTrigger&gt;
                                                &lt;PopoverContent className="w-[--radix-popover-trigger-width] p-0"&gt;
                                                    &lt;Command&gt;
                                                        &lt;CommandInput placeholder="Search..." /&gt;
                                                        &lt;CommandList&gt;
                                                            &lt;CommandEmpty&gt;No results found.&lt;/CommandEmpty&gt;
                                                            &lt;CommandItem onSelect={() =&gt; setIsCreateGeneralAccountOpen(true)} className="text-primary cursor-pointer"&gt;&lt;PlusCircle className="mr-2 h-4 w-4"/&gt;Create new account...&lt;/CommandItem&gt;
                                                            &lt;CommandGroup heading="Customers"&gt;
                                                                {customers.map(c =&gt; &lt;CommandItem key={c.id} onSelect={() =&gt; setAllocations(prev =&gt; ({...prev, [tx.id]: { value: c.id, type: 'customer', vatType: 'no_vat' }}))}&gt;{c.name}&lt;/CommandItem&gt;)}
                                                            &lt;/CommandGroup&gt;
                                                            &lt;CommandGroup heading="Accounts"&gt;
                                                                {client?.chartOfAccounts?.map(acc =&gt; &lt;CommandItem key={acc.id} onSelect={() =&gt; setAllocations(prev =&gt; ({...prev, [tx.id]: { value: acc.id, type: 'account', vatType: prev[tx.id]?.vatType || (client.isVatRegistered ? 'standard_rated_purchases' : 'no_vat') }}))}&gt;{acc.description}&lt;/CommandItem&gt;)}
                                                            &lt;/CommandGroup&gt;
                                                        &lt;/CommandList&gt;
                                                    &lt;/Command&gt;
                                                &lt;/PopoverContent&gt;
                                            &lt;/Popover&gt;
                                        &lt;/TableCell&gt;
                                        {client?.isVatRegistered &amp;&amp; (
                                            &lt;TableCell&gt;
                                                &lt;Select
                                                   value={allocations[tx.id]?.vatType}
                                                   onValueChange={(value) =&gt; setAllocations(prev =&gt; ({...prev, [tx.id]: {...prev[tx.id], vatType: value as VatType}}))}
                                                   disabled={!allocations[tx.id] || allocations[tx.id]?.type === 'customer'}
                                                &gt;
                                                    &lt;SelectTrigger className="h-8"&gt;&lt;SelectValue placeholder="Select VAT type" /&gt;&lt;/SelectTrigger&gt;
                                                    &lt;SelectContent&gt;
                                                        {allVatTypes.map(vat =&gt; (
                                                            &lt;SelectItem key={vat.name} value={vat.name}&gt;{vat.label}&lt;/SelectItem&gt;
                                                        ))}
                                                    &lt;/SelectContent&gt;
                                                &lt;/Select&gt;
                                            &lt;/TableCell&gt;
                                        )}
                                        &lt;TableCell className="text-right font-mono"&gt;{formatPrice(tx.amount)}&lt;/TableCell&gt;
                                        &lt;TableCell className="text-right"&gt;
                                            &lt;DropdownMenu&gt;
                                                &lt;DropdownMenuTrigger asChild&gt;
                                                    &lt;Button variant="ghost" size="icon"&gt;&lt;MoreHorizontal className="h-4 w-4" /&gt;&lt;/Button&gt;
                                                &lt;/DropdownMenuTrigger&gt;
                                                &lt;DropdownMenuContent&gt;
                                                     &lt;DropdownMenuItem onSelect={() =&gt; {
                                                        const firstKeyword = tx.description.split(/\s+/)[0];
                                                        setIsCreateRuleOpen(true);
                                                        setRuleDefaultValues({ 
                                                            description: '', 
                                                            keywords: firstKeyword, 
                                                            accountId: '', 
                                                            vatType: 'standard_rated_purchases',
                                                        });
                                                     }}&gt;
                                                        Create Rule from Transaction
                                                    &lt;/DropdownMenuItem&gt;
                                                &lt;/DropdownMenuContent&gt;
                                            &lt;/DropdownMenu&gt;
                                        &lt;/TableCell&gt;
                                    &lt;/TableRow&gt;
                                ))
                            )}
                        &lt;/TableBody&gt;
                    &lt;/Table&gt;
                &lt;/div&gt;
            &lt;/CardContent&gt;
             &lt;CardFooter className="flex items-center justify-between p-4"&gt;
                 &lt;Button onClick={handleSaveAllocations} disabled={isSaving || Object.keys(allocations).length === 0}&gt;
                    {isSaving ? &lt;Loader2 className="mr-2 h-4 w-4 animate-spin" /&gt; : null}
                    Save Allocations
                &lt;/Button&gt;
                 &lt;div className="flex items-center gap-2"&gt;
                    
                    {!searchTerm &amp;&amp; (
                        &lt;div className="flex items-center space-x-2"&gt;
                            &lt;Button
                                variant="outline"
                                size="sm"
                                onClick={goToPreviousPage}
                                disabled={!canGoPrev || isLoading}
                            &gt;
                                &lt;ChevronLeft className="h-4 w-4" /&gt;
                                Previous
                            &lt;/Button&gt;
                            &lt;span className="text-sm font-medium"&gt;
                                Page {currentPage}
                            &lt;/span&gt;
                            &lt;Button
                                variant="outline"
                                size="sm"
                                onClick={goToNextPage}
                                disabled={!canGoNext || isLoading}
                            &gt;
                                Next
                                &lt;ChevronRight className="h-4 w-4" /&gt;
                            &lt;/Button&gt;
                        &lt;/div&gt;
                    )}
                 &lt;/div&gt;
            &lt;/CardFooter&gt;
        &lt;/Card&gt;
    );
});
NewTransactionsTab.displayName = 'NewTransactionsTab';


const ReviewedTab = React.forwardRef&lt;
    { refetch: () =&gt; void; },
    { client: User | null; bankAccountId: string | null; customers: ClientCustomer[], onAccountCreated: () =&gt; void; }
&gt;(({ client, bankAccountId, customers, onAccountCreated }, ref) =&gt; {
    
    const [dateRange, setDateRange] = useState&lt;DateRange | undefined&gt;(undefined);
    const [isSaving, setIsSaving] = useState(false);
    const { toast } = useToast();
    const [changes, setChanges] = useState&lt;{ [txId: string]: Partial&lt;ImportedTransaction&gt; }&gt;({});
    const [isDownloading, setIsDownloading] = useState(false);
    const [isCreateGeneralAccountOpen, setIsCreateGeneralAccountOpen] = useState(false);
    const [searchResults, setSearchResults] = useState&lt;ImportedTransaction[] | null&gt;(null);
    const [isSearching, setIsSearching] = useState(false);
    const [selectedTransactions, setSelectedTransactions] = useState&lt;string[]&gt;([]);
    const [isConsistencyCheckOpen, setIsConsistencyCheckOpen] = useState(false);
    const [inconsistencies, setInconsistencies] = useState&lt;any[]&gt;([]);
    const [selectedCorrections, setSelectedCorrections] = useState&lt;string[]&gt;([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [accountFilter, setAccountFilter] = useState('all');
    const [activeSubTab, setActiveSubTab] = useState&lt;'expenses' | 'income'&gt;('expenses');


    type SortField = 'date' | 'description' | 'amount' | 'allocatedTo' | 'vatType';
    type SortDirection = 'asc' | 'desc';
    const [sortField, setSortField] = useState&lt;SortField&gt;('date');
    const [sortDirection, setSortDirection] = useState&lt;SortDirection&gt;('desc');
    
    const uniqueChartOfAccounts = useMemo(() =&gt; {
        if (!client?.chartOfAccounts) return [];
        const seen = new Set();
        return client.chartOfAccounts.filter(el =&gt; {
            const duplicate = seen.has(el.id);
            seen.add(el.id);
            return !duplicate;
        });
    }, [client?.chartOfAccounts]);

    const handleSort = (field: SortField) =&gt; {
        if (sortField === field) {
            setSortDirection(prev =&gt; prev === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDirection('asc');
        }
    };
    
    const reviewedTransactionsQuery = useMemo(() =&gt; {
        if (!client?.uid || !bankAccountId) return null;
        
        let constraints: QueryConstraint[] = [
            where('bankAccountId', '==', bankAccountId),
            where('status', 'in', ['reviewed', 'allocated']),
        ];

        if (activeSubTab === 'expenses') {
            constraints.push(where('amount', '&lt;', 0));
        } else {
             constraints.push(where('amount', '&gt;=', 0));
        }

        if (dateRange?.from) {
            constraints.push(where('date', '&gt;=', dateRange.from.toISOString()));
        }
        if (dateRange?.to) {
            constraints.push(where('date', '&lt;=', dateRange.to.toISOString()));
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
    } = usePaginatedFirestore&lt;ImportedTransaction&gt;({ baseQuery: reviewedTransactionsQuery, pageSize: PAGE_SIZE });
    
    useEffect(() =&gt; {
        const handleSearchAndFilter = async () =&gt; {
            if (!client?.uid || !bankAccountId) return;
            
            const hasSearch = searchTerm.trim().length &gt; 0;
            const hasFilter = accountFilter !== 'all';

            if (!hasSearch &amp;&amp; !hasFilter) {
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
                    baseConstraints.push(where('amount', '&lt;', 0));
                } else {
                    baseConstraints.push(where('amount', '&gt;=', 0));
                }
                
                let finalQuery;
                if (hasFilter) {
                    finalQuery = query(collection(db, 'aiAccountantClients', client.uid, 'transactions'), ...baseConstraints, where('allocatedTo.value', '==', accountFilter));
                } else {
                    finalQuery = query(collection(db, 'aiAccountantClients', client.uid, 'transactions'), ...baseConstraints);
                }

                const snapshot = await getDocs(finalQuery);
                let allDocs = snapshot.docs.map(d =&gt; ({ id: d.id, ...d.data() }) as ImportedTransaction);

                if (hasSearch) {
                    allDocs = allDocs.filter(tx =&gt; tx.description.toLowerCase().includes(searchTerm.toLowerCase()));
                }
                
                setSearchResults(allDocs);
            } catch (error) {
                console.error("Error during search/filter:", error);
                toast({ title: "Search/Filter Error", variant: "destructive" });
            } finally {
                setIsSearching(false);
            }
        };

        const debounce = setTimeout(() =&gt; {
            handleSearchAndFilter();
        }, 500);

        return () =&gt; clearTimeout(debounce);
    }, [searchTerm, accountFilter, client, bankAccountId, activeSubTab, toast, refetch]);


    React.useImperativeHandle(ref, () =&gt; ({
        refetch,
    }));

     useEffect(() =&gt; {
        setSearchTerm('');
        setSearchResults(null);
        setAccountFilter('all');
        refetch();
    }, [activeSubTab, refetch]);
    
    const displayedDocuments = useMemo(() =&gt; {
        if (searchResults !== null) {
            return searchResults;
        }
        return paginatedDocuments;
    }, [searchResults, paginatedDocuments]);

    const accountsWithTransactions = useMemo(() =&gt; {
        if (!client || !client.chartOfAccounts) return [];

        const getAccounts = (transactions: ImportedTransaction[]) =&gt; {
            const accountIdsInDocs = new Set(transactions.map(tx =&gt; tx.allocatedTo?.value));
            return uniqueChartOfAccounts.filter(acc =&gt; accountIdsInDocs.has(acc.id));
        }

        if (searchResults !== null) return getAccounts(searchResults);
        return getAccounts(paginatedDocuments);

    }, [paginatedDocuments, searchResults, uniqueChartOfAccounts, client]);

    const getAllocationDescription = (tx: ImportedTransaction) =&gt; {
        const changedTx = changes[tx.id];
        const allocatedTo = changedTx?.allocatedTo || tx.allocatedTo;

        if (!allocatedTo) return 'N/A';
        if (allocatedTo.type === 'customer') {
            return customers.find(c =&gt; c.id === allocatedTo.value)?.name || 'Unknown Customer';
        }
        return uniqueChartOfAccounts?.find(acc =&gt; acc.id === allocatedTo.value)?.description || 'Unknown Account';
    }

    const handleAllocationChange = (txId: string, value: string) =&gt; {
        const [type, val] = value.split(':');
        setChanges(prev =&gt; ({
            ...prev,
            [txId]: {
                ...prev[txId],
                allocatedTo: { value: val, type: type as 'account' | 'customer' }
            }
        }));
    }

    const handleVatChange = (txId: string, value: VatType) =&gt; {
        setChanges(prev =&gt; ({
            ...prev,
            [txId]: {
                ...(prev[txId] || {}), // Ensure the object exists before spreading
                vatType: value
            }
        }));
    }
    
    const handleBulkDelete = async () =&gt; {
        if (!client || !client.uid || selectedTransactions.length === 0) return;
        
        try {
             for (let i = 0; i &lt; selectedTransactions.length; i += BATCH_SIZE) {
                const batch = writeBatch(db);
                const chunk = selectedTransactions.slice(i, i + BATCH_SIZE);
                chunk.forEach(txId =&gt; {
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
    
    const handleSaveChanges = async (changesToSave: typeof changes, transactionIds: string[]) =&gt; {
        if (!client || !client.uid || transactionIds.length === 0) return;
        setIsSaving(true);
        toast({ title: 'Saving changes...', description: 'Please wait.' });
    
        try {
            const batch = writeBatch(db);
            transactionIds.forEach(txId =&gt; {
                const changeData = changesToSave[txId];
                if (changeData) {
                    const txRef = doc(db, 'aiAccountantClients', client.uid!, 'transactions', txId);
                    const updateData: { [key: string]: any } = {};
                    if (changeData.allocatedTo) updateData.allocatedTo = changeData.allocatedTo;
                    if (changeData.vatType) updateData.vatType = changeData.vatType;
                    if (Object.keys(updateData).length &gt; 0) {
                        batch.update(txRef, updateData);
                    }
                }
            });
            await batch.commit();
    
            toast({ title: 'Success!', description: 'Your changes have been saved.' });
            
            setChanges({});
            setSelectedTransactions([]);
            
             if(searchTerm.trim() || accountFilter !== 'all') {
                const hasSearch = searchTerm.trim().length &gt; 0;
                const hasFilter = accountFilter !== 'all';
                let searchConstraints: QueryConstraint[] = [ where('bankAccountId', '==', bankAccountId!), where('status', 'in', ['reviewed', 'allocated']), ];
                if (activeSubTab === 'expenses') { searchConstraints.push(where('amount', '&lt;', 0)); } else { searchConstraints.push(where('amount', '&gt;=', 0)); }
                if (hasFilter) { searchConstraints.push(where('allocatedTo.value', '==', accountFilter)); }

                const q = query(collection(db, 'aiAccountantClients', client.uid, 'transactions'), ...searchConstraints);
                const snapshot = await getDocs(q);
                let allDocs = snapshot.docs.map(d =&gt; ({ id: d.id, ...d.data() }) as ImportedTransaction);

                if (hasSearch) {
                    allDocs = allDocs.filter(tx =&gt; tx.description.toLowerCase().includes(searchTerm.toLowerCase()));
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
    
    const handleDownloadExcel = async () =&gt; {
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

            const mapToExport = (tx: ImportedTransaction) =&gt; ({
                'Date': format(new Date(tx.date), 'dd/MM/yyyy'),
                'Description': tx.description,
                'Allocated To': getAllocationDescription(tx),
                'VAT Type': allVatTypes.find(v =&gt; v.name === tx.vatType)?.label || 'N/A',
                'Amount': tx.amount,
            });

            const dataToExport = snapshot.docs.map(doc =&gt; mapToExport(doc.data() as ImportedTransaction));

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
    
    
    const handleReviewConsistency = async () =&gt; {
        if (!client || !bankAccountId) return;
        setIsConsistencyCheckOpen(false);
        toast({ title: "Analyzing Transactions...", description: "Checking for allocation inconsistencies." });

        let q = query(
            collection(db, 'aiAccountantClients', client.uid!, 'transactions'),
            where('bankAccountId', '==', bankAccountId),
            where('status', 'in', ['reviewed', 'allocated'])
        );
        if (activeSubTab === 'expenses') {
            q = query(q, where('amount', '&lt;', 0));
        } else {
            q = query(q, where('amount', '&gt;=', 0));
        }

        const snapshot = await getDocs(q);
        const allReviewed = snapshot.docs.map(d =&gt; ({id: d.id, ...d.data()}) as ImportedTransaction);
        
        const getGroupKey = (description: string): string =&gt; {
            const lowerDesc = description.toLowerCase();
            const commonKeywords = ['shell', 'engen', 'pnp', 'pick n pay', 'checkers', 'shoprite', 'woolworths', 'clicks', 'dischem', 'bp', 'total', 'sasol'];
            
            for (const keyword of commonKeywords) {
                if (lowerDesc.includes(keyword)) {
                    return keyword;
                }
            }
            
            const words = lowerDesc.replace(/[^a-z\s]/g, '').split(/\s+/);
            const significantWords = words.filter(w =&gt; w.length &gt; 3 &amp;&amp; !['cheque', 'card', 'purchase', 'payment', 'debit', 'order', 'eft', 'from', 'pty', 'ltd'].includes(w));
            
            if (significantWords.length &gt; 0) {
                 const wordCounts = significantWords.reduce((acc, word) =&gt; {
                    acc[word] = (acc[word] || 0) + 1;
                    return acc;
                }, {} as {[key: string]: number});

                let mostSignificantWord = '';
                let maxCount = 0;

                for (const word of significantWords) {
                    const totalOccurrences = allReviewed.filter(tx =&gt; tx.description.toLowerCase().includes(word)).length;
                    if (totalOccurrences &gt; maxCount &amp;&amp; totalOccurrences &gt; 1) {
                        maxCount = totalOccurrences;
                        mostSignificantWord = word;
                    }
                }
                if (mostSignificantWord) return mostSignificantWord;
            }
            
            return lowerDesc.slice(0, 15);
        };


        const groups: { [key: string]: ImportedTransaction[] } = {};
        allReviewed.forEach(tx =&gt; {
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
            'total': '3000-033', // Fuel,
        };

        Object.entries(groups).forEach(([groupKey, group]) =&gt; {
            if (group.length &lt; 2) return;
    
            const allocationCounts: { [key: string]: number } = {};
            group.forEach(tx =&gt; {
                if (tx.allocatedTo?.value) {
                    const key = `${tx.allocatedTo.value}_${tx.vatType || 'no_vat'}`;
                    allocationCounts[key] = (allocationCounts[key] || 0) + 1;
                }
            });
            
            const [mostCommonKey] = Object.entries(allocationCounts).reduce((a, b) =&gt; a[1] &gt; b[1] ? a : b);
            const [correctAccountId, correctVatType] = mostCommonKey.split('_');
    
            group.forEach(tx =&gt; {
                const currentAllocationId = tx.allocatedTo?.value;
                const currentVatType = tx.vatType || 'no_vat';
                let isConsistent = currentAllocationId === correctAccountId &amp;&amp; currentVatType === correctVatType;
                
                // Hard Override Rule Check
                const hardRuleAccountId = hardRules[groupKey];
                if (hardRuleAccountId &amp;&amp; currentAllocationId !== hardRuleAccountId) {
                     foundInconsistencies.push({
                        ...tx,
                        groupKey,
                        suggestedAccountId: hardRuleAccountId,
                        suggestedVatType: 'standard_rated_purchases',
                        reason: `Critical: Merchant rule violation (should be Fuel).`
                    });
                } else if (!isConsistent &amp;&amp; currentAllocationId) {
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
        if (foundInconsistencies.length &gt; 0) {
            setSelectedCorrections(foundInconsistencies.map(inc =&gt; inc.id));
            setIsConsistencyCheckOpen(true);
        } else {
            toast({ title: 'No Inconsistencies Found!', description: 'All your allocations look consistent.' });
        }
    };
    
    const handleApplyCorrections = async () =&gt; {
        if (!client || selectedCorrections.length === 0) return;
        
        setIsSaving(true);
        toast({ title: "Applying Corrections...", description: "Updating transactions." });

        try {
            const batch = writeBatch(db);
            selectedCorrections.forEach(txId =&gt; {
                const inconsistency = inconsistencies.find(inc =&gt; inc.id === txId);
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

    const handleInconsistencyChange = (txId: string, field: 'accountId' | 'vatType', value: string) =&gt; {
        setInconsistencies(prev =&gt;
            prev.map(inc =&gt; {
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

    const handleBulkReallocate = (allocation: { value: string; type: "account" | "customer" | "supplier"; }, vatType: VatType) =&gt; {
      const changesToSave: { [key: string]: Partial&lt;ImportedTransaction&gt; } = {};
        selectedTransactions.forEach(txId =&gt; {
            changesToSave[txId] = {
                allocatedTo: allocation,
                vatType: client?.isVatRegistered ? vatType : 'no_vat',
            };
        });
        handleSaveChanges(changesToSave, selectedTransactions);
    };


    return (
        &lt;Card&gt;
            &lt;CreateGeneralAccountDialog 
                client={client}
                onAccountCreated={onAccountCreated}
                open={isCreateGeneralAccountOpen}
                onOpenChange={setIsCreateGeneralAccountOpen}
            /&gt;
            &lt;Dialog open={isConsistencyCheckOpen} onOpenChange={setIsConsistencyCheckOpen}&gt;
                &lt;DialogContent className="sm:max-w-4xl"&gt;
                     &lt;DialogHeader&gt;
                        &lt;DialogTitle&gt;Allocation Consistency Review&lt;/DialogTitle&gt;
                        &lt;DialogDescription&gt;
                            The AI found the following inconsistencies. Select the corrections you want to apply.
                        &lt;/DialogDescription&gt;
                    &lt;/DialogHeader&gt;
                    {inconsistencies.length &gt; 0 ? (
                        &lt;div className="max-h-[60vh] overflow-y-auto pr-4"&gt;
                            &lt;Table&gt;
                                &lt;TableHeader&gt;
                                    &lt;TableRow&gt;
                                        &lt;TableCell className="w-12 p-2"&gt;
                                            &lt;Checkbox
                                                checked={selectedCorrections.length === inconsistencies.length}
                                                onCheckedChange={(checked) =&gt; setSelectedCorrections(checked ? inconsistencies.map(i =&gt; i.id) : [])}
                                            /&gt;
                                        &lt;/TableCell&gt;
                                        &lt;TableHead&gt;Description&lt;/TableHead&gt;
                                        &lt;TableHead&gt;Current Allocation&lt;/TableHead&gt;
                                        &lt;TableHead className="w-[250px]"&gt;Suggested Account&lt;/TableHead&gt;
                                        &lt;TableHead className="w-[200px]"&gt;Suggested VAT&lt;/TableHead&gt;
                                    &lt;/TableRow&gt;
                                &lt;/TableHeader&gt;
                                &lt;TableBody&gt;
                                    {inconsistencies.map(tx =&gt; (
                                        &lt;TableRow key={tx.id}&gt;
                                            &lt;TableCell className="p-2"&gt;
                                                &lt;Checkbox
                                                    checked={selectedCorrections.includes(tx.id)}
                                                    onCheckedChange={(checked) =&gt; {
                                                        setSelectedCorrections(prev =&gt;
                                                            checked ? [...prev, tx.id] : prev.filter(id =&gt; id !== tx.id)
                                                        );
                                                    }}
                                                /&gt;
                                            &lt;/TableCell&gt;
                                            &lt;TableCell&gt;
                                                &lt;p className="font-semibold"&gt;{tx.description}&lt;/p&gt;
                                                &lt;p className="text-xs text-muted-foreground"&gt;{format(new Date(tx.date), 'dd MMMM yyyy')}&lt;/p&gt;
                                            &lt;/TableCell&gt;
                                             &lt;TableCell&gt;
                                                &lt;p className="text-xs"&gt;{getAllocationDescription(tx)}&lt;/p&gt;
                                                &lt;p className="text-xs font-mono"&gt;{tx.vatType}&lt;/p&gt;
                                            &lt;/TableCell&gt;
                                            &lt;TableCell&gt;
                                                 &lt;Select value={tx.suggestedAccountId} onValueChange={(value) =&gt; handleInconsistencyChange(tx.id, 'accountId', value)}&gt;
                                                    &lt;SelectTrigger className="h-8 text-xs"&gt;&lt;SelectValue/&gt;&lt;/SelectTrigger&gt;
                                                    &lt;SelectContent&gt;
                                                        {uniqueChartOfAccounts.map(acc =&gt; (
                                                            &lt;SelectItem key={acc.id} value={acc.id}&gt;{acc.description}&lt;/SelectItem&gt;
                                                        ))}
                                                    &lt;/SelectContent&gt;
                                                &lt;/Select&gt;
                                            &lt;/TableCell&gt;
                                            &lt;TableCell&gt;
                                                 &lt;Select value={tx.suggestedVatType} onValueChange={(value) =&gt; handleInconsistencyChange(tx.id, 'vatType', value as VatType)}&gt;
                                                    &lt;SelectTrigger className="h-8 text-xs"&gt;&lt;SelectValue/&gt;&lt;/SelectTrigger&gt;
                                                    &lt;SelectContent&gt;
                                                        {allVatTypes.map(vt =&gt; (
                                                            &lt;SelectItem key={vt.name} value={vt.name}&gt;{vt.label}&lt;/SelectItem&gt;
                                                        ))}
                                                    &lt;/SelectContent&gt;
                                                &lt;/Select&gt;
                                            &lt;/TableCell&gt;
                                        &lt;/TableRow&gt;
                                    ))}
                                &lt;/TableBody&gt;
                            &lt;/Table&gt;
                        &lt;/div&gt;
                    ) : (
                        &lt;p className="text-center text-muted-foreground py-8"&gt;No inconsistencies were found.&lt;/p&gt;
                    )}
                     &lt;DialogFooter&gt;
                        &lt;Button variant="ghost" onClick={() =&gt; setIsConsistencyCheckOpen(false)}&gt;Cancel&lt;/Button&gt;
                        &lt;Button onClick={handleApplyCorrections} disabled={isSaving || selectedCorrections.length === 0}&gt;
                            {isSaving ? &lt;Loader2 className="mr-2 h-4 w-4 animate-spin"/&gt; : null}
                            Apply {selectedCorrections.length} Corrections
                        &lt;/Button&gt;
                    &lt;/DialogFooter&gt;
                &lt;/DialogContent&gt;
            &lt;/Dialog&gt;
            &lt;CardHeader className="p-0 border-b"&gt;
                 &lt;Tabs value={activeSubTab} onValueChange={(value) =&gt; setActiveSubTab(value as 'expenses' | 'income')} className="w-full"&gt;
                    &lt;TabsList className="grid w-full grid-cols-2 rounded-t-lg rounded-b-none h-auto"&gt;
                        &lt;TabsTrigger value="expenses"&gt;Reviewed Expenses&lt;/TabsTrigger&gt;
                        &lt;TabsTrigger value="income"&gt;Reviewed Income&lt;/TabsTrigger&gt;
                    &lt;/TabsList&gt;
                &lt;/Tabs&gt;
                 &lt;div className="p-4 flex flex-col md:flex-row items-center justify-between gap-4"&gt;
                    &lt;div className="flex items-center gap-2 flex-wrap"&gt;
                        &lt;Button onClick={() =&gt; handleSaveChanges(changes, Object.keys(changes))} disabled={isSaving || Object.keys(changes).length === 0}&gt;
                            {isSaving ? &lt;Loader2 className="mr-2 h-4 w-4 animate-spin" /&gt; : null}
                            Save Changes
                        &lt;/Button&gt;
                         &lt;Button variant="outline" onClick={handleDownloadExcel} disabled={isDownloading}&gt;
                            {isDownloading ? &lt;Loader2 className="mr-2 h-4 w-4 animate-spin" /&gt; : &lt;Download className="mr-2 h-4 w-4" /&gt;}
                            Download Excel
                        &lt;/Button&gt;
                         &lt;AlertDialog&gt;
                            &lt;AlertDialogTrigger asChild&gt;
                                &lt;Button variant="outline"&gt;
                                    &lt;Sparkles className="mr-2 h-4 w-4" /&gt; Review Consistency
                                &lt;/Button&gt;
                            &lt;/AlertDialogTrigger&gt;
                            &lt;AlertDialogContent&gt;
                                &lt;AlertDialogHeader&gt;
                                    &lt;AlertDialogTitle&gt;Review Allocation Consistency&lt;/AlertDialogTitle&gt;
                                    &lt;AlertDialogDescription&gt;
                                        This tool will analyze your reviewed transactions to find allocations that are inconsistent with how you've categorized similar items in the past. It will then suggest corrections. Do you want to proceed?
                                    &lt;/AlertDialogDescription&gt;
                                &lt;/AlertDialogHeader&gt;
                                &lt;AlertDialogFooter&gt;
                                    &lt;AlertDialogCancel&gt;Cancel&lt;/AlertDialogCancel&gt;
                                    &lt;AlertDialogAction onClick={handleReviewConsistency}&gt;Yes, Review Consistency&lt;/AlertDialogAction&gt;
                                &lt;/AlertDialogFooter&gt;
                            &lt;/AlertDialogContent&gt;
                        &lt;/AlertDialog&gt;
                         &lt;DropdownMenu&gt;
                            &lt;DropdownMenuTrigger asChild&gt;
                                &lt;Button variant="outline" size="sm" disabled={selectedTransactions.length === 0}&gt;
                                    &lt;span&gt;Reallocate Selected&lt;/span&gt;&lt;ChevronsUpDown className="ml-2 h-4 w-4"/&gt;
                                &lt;/Button&gt;
                            &lt;/DropdownMenuTrigger&gt;
                            &lt;DropdownMenuContent className="w-64"&gt;
                                {client?.chartOfAccounts?.map(acc =&gt; (
                                    &lt;DropdownMenuSub key={acc.id}&gt;
                                        &lt;DropdownMenuSubTrigger&gt;&lt;span&gt;{acc.description}&lt;/span&gt;&lt;/DropdownMenuSubTrigger&gt;
                                        &lt;DropdownMenuSubContent&gt;
                                            {client.isVatRegistered ? allVatTypes.map(vat =&gt; (
                                                &lt;DropdownMenuItem key={vat.name} onSelect={() =&gt; handleBulkReallocate({value: acc.id, type: 'account'}, vat.name)}&gt;
                                                    {vat.label}
                                                &lt;/DropdownMenuItem&gt;
                                            )) : (
                                                &lt;DropdownMenuItem onSelect={() =&gt; handleBulkReallocate({value: acc.id, type: 'account'}, 'no_vat')}&gt;
                                                    No VAT
                                                &lt;/DropdownMenuItem&gt;
                                            )}
                                        &lt;/DropdownMenuSubContent&gt;
                                    &lt;/DropdownMenuSub&gt;
                                ))}
                            &lt;/DropdownMenuContent&gt;
                        &lt;/DropdownMenu&gt;
                        &lt;AlertDialog&gt;
                            &lt;AlertDialogTrigger asChild&gt;
                                &lt;Button variant="destructive" size="sm" disabled={selectedTransactions.length === 0}&gt;Delete Selected&lt;/Button&gt;
                            &lt;/AlertDialogTrigger&gt;
                            &lt;AlertDialogContent&gt;
                                &lt;AlertDialogHeader&gt;
                                    &lt;AlertDialogTitle&gt;Are you sure?&lt;/AlertDialogTitle&gt;
                                    &lt;AlertDialogDescription&gt;This will permanently delete {selectedTransactions.length} selected transaction(s). This cannot be undone.&lt;/AlertDialogDescription&gt;
                                &lt;/AlertDialogHeader&gt;
                                &lt;AlertDialogFooter&gt;
                                    &lt;AlertDialogCancel&gt;Cancel&lt;/AlertDialogCancel&gt;
                                    &lt;AlertDialogAction onClick={handleBulkDelete}&gt;Yes, Delete All&lt;/AlertDialogAction&gt;
                                &lt;/AlertDialogFooter&gt;
                            &lt;/AlertDialogContent&gt;
                        &lt;/AlertDialog&gt;
                    &lt;/div&gt;
                     &lt;div className="flex items-center gap-2 flex-wrap justify-end"&gt;
                        &lt;DateRangePicker onDateChange={setDateRange} /&gt;
                        &lt;Select value={accountFilter} onValueChange={setAccountFilter}&gt;
                            &lt;SelectTrigger className="w-full md:w-[200px]"&gt;
                                &lt;SelectValue placeholder="Filter by account..." /&gt;
                            &lt;/SelectTrigger&gt;
                            &lt;SelectContent&gt;
                                &lt;SelectItem value="all"&gt;All Accounts&lt;/SelectItem&gt;
                                {accountsWithTransactions.map(acc =&gt; (
                                    &lt;SelectItem key={acc.id} value={acc.id}&gt;{acc.description}&lt;/SelectItem&gt;
                                ))}
                            &lt;/SelectContent&gt;
                        &lt;/Select&gt;
                        &lt;div className="relative w-full md:w-auto"&gt;
                            &lt;Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" /&gt;
                            &lt;Input
                                type="search"
                                placeholder="Search descriptions..."
                                value={searchTerm}
                                onChange={(e) =&gt; setSearchTerm(e.target.value)}
                                className="pl-8 w-full md:w-48"
                            /&gt;
                        &lt;/div&gt;
                     &lt;/div&gt;
                &lt;/div&gt;
            &lt;/CardHeader&gt;
            &lt;CardContent className="p-0"&gt;
                 &lt;div className="overflow-x-auto"&gt;
                    &lt;Table&gt;
                        &lt;TableHeader&gt;
                            &lt;TableRow&gt;
                                &lt;TableCell className="w-12 p-2"&gt;
                                     &lt;Checkbox
                                        checked={displayedDocuments.length &gt; 0 &amp;&amp; selectedTransactions.length === displayedDocuments.length}
                                        onCheckedChange={(checked) =&gt; {
                                            setSelectedTransactions(checked ? displayedDocuments.map(tx =&gt; tx.id) : []);
                                        }}
                                    /&gt;
                                &lt;/TableCell&gt;
                                &lt;TableHead&gt;&lt;Button variant="ghost" onClick={() =&gt; handleSort('date')}&gt;Date &lt;ArrowUpDown className="ml-2 h-4 w-4 inline" /&gt;&lt;/Button&gt;&lt;/TableHead&gt;
                                &lt;TableHead&gt;&lt;Button variant="ghost" onClick={() =&gt; handleSort('description')}&gt;Description &lt;ArrowUpDown className="ml-2 h-4 w-4 inline" /&gt;&lt;/Button&gt;&lt;/TableHead&gt;
                                &lt;TableHead&gt;&lt;Button variant="ghost" onClick={() =&gt; handleSort('allocatedTo')}&gt;Allocated To &lt;ArrowUpDown className="ml-2 h-4 w-4 inline" /&gt;&lt;/Button&gt;&lt;/TableHead&gt;
                                {client?.isVatRegistered &amp;&amp; &lt;TableHead&gt;&lt;Button variant="ghost" onClick={() =&gt; handleSort('vatType')}&gt;VAT Type &lt;ArrowUpDown className="ml-2 h-4 w-4 inline" /&gt;&lt;/Button&gt;&lt;/TableHead&gt;}
                                &lt;TableHead className="text-right"&gt;&lt;Button variant="ghost" onClick={() =&gt; handleSort('amount')}&gt;Amount &lt;ArrowUpDown className="ml-2 h-4 w-4 inline" /&gt;&lt;/Button&gt;&lt;/TableHead&gt;
                            &lt;/TableRow&gt;
                        &lt;/TableHeader&gt;
                        &lt;TableBody&gt;
                            {isLoading || isSearching ? (
                                &lt;TableRow&gt;&lt;TableCell colSpan={6} className="text-center h-24"&gt;&lt;Loader2 className="animate-spin mx-auto" /&gt;&lt;/TableCell&gt;&lt;/TableRow&gt;
                            ) : displayedDocuments.length === 0 ? (
                                &lt;TableRow&gt;&lt;TableCell colSpan={6} className="text-center h-24 text-muted-foreground"&gt;No reviewed transactions found.&lt;/TableCell&gt;&lt;/TableRow&gt;
                            ) : (
                                displayedDocuments.map(tx =&gt; (
                                    &lt;TableRow key={tx.id} data-state={selectedTransactions.includes(tx.id) &amp;&amp; "selected"}&gt;
                                        &lt;TableCell className="p-2"&gt;
                                            &lt;Checkbox
                                                checked={selectedTransactions.includes(tx.id)}
                                                onCheckedChange={(checked) =&gt; {
                                                    setSelectedTransactions(prev =&gt;
                                                        checked ? [...prev, tx.id] : prev.filter(id =&gt; id !== tx.id)
                                                    );
                                                }}
                                            /&gt;
                                        &lt;/TableCell&gt;
                                        &lt;TableCell&gt;{new Date(tx.date).toLocaleDateString('en-GB')}&lt;/TableCell&gt;
                                        &lt;TableCell className="whitespace-normal break-words"&gt;{tx.description}&lt;/TableCell&gt;
                                        &lt;TableCell className="w-[250px]"&gt;
                                            &lt;Popover&gt;
                                                &lt;PopoverTrigger asChild&gt;
                                                    &lt;Button variant="outline" className="w-full justify-start text-left font-normal h-8"&gt;
                                                        {changes[tx.id] ? [...(client?.chartOfAccounts || []), ...customers].find(o =&gt; o.id === changes[tx.id]?.allocatedTo?.value)?.description || [...(client?.chartOfAccounts || []), ...customers].find(o =&gt; o.id === changes[tx.id]?.allocatedTo?.value)?.name : getAllocationDescription(tx)}
                                                    &lt;/Button&gt;
                                                &lt;/PopoverTrigger&gt;
                                                &lt;PopoverContent className="w-[--radix-popover-trigger-width] p-0"&gt;
                                                    &lt;Command&gt;
                                                        &lt;CommandInput placeholder="Search..." /&gt;
                                                        &lt;CommandList&gt;
                                                            &lt;CommandEmpty&gt;No results found.&lt;/CommandEmpty&gt;
                                                            &lt;CommandItem onSelect={() =&gt; setIsCreateGeneralAccountOpen(true)} className="text-primary cursor-pointer"&gt;&lt;PlusCircle className="mr-2 h-4 w-4"/&gt;Create new account...&lt;/CommandItem&gt;
                                                            &lt;CommandGroup heading="Customers"&gt;
                                                                {customers.map(c =&gt; &lt;CommandItem key={c.id} onSelect={() =&gt; handleAllocationChange(tx.id, `customer:${c.id}`)}&gt;{c.name}&lt;/CommandItem&gt;)}
                                                            &lt;/CommandGroup&gt;
                                                            &lt;CommandGroup heading="Accounts"&gt;
                                                                {uniqueChartOfAccounts.map(acc =&gt; &lt;CommandItem key={acc.id} onSelect={() =&gt; handleAllocationChange(tx.id, `account:${acc.id}`)}&gt;{acc.description}&lt;/CommandItem&gt;)}
                                                            &lt;/CommandGroup&gt;
                                                        &lt;/CommandList&gt;
                                                    &lt;/Command&gt;
                                                &lt;/PopoverContent&gt;
                                            &lt;/Popover&gt;
                                        &lt;/TableCell&gt;
                                        {client?.isVatRegistered &amp;&amp; (
                                            &lt;TableCell className="w-[200px]"&gt;
                                                &lt;Select
                                                    value={changes[tx.id]?.vatType || tx.vatType}
                                                    onValueChange={(value) =&gt; handleVatChange(tx.id, value as VatType)}
                                                    disabled={tx.allocatedTo?.type === 'customer'}
                                                &gt;
                                                    &lt;SelectTrigger&gt;&lt;SelectValue/&gt;&lt;/SelectTrigger&gt;
                                                    &lt;SelectContent&gt;
                                                        {allVatTypes.map(vt =&gt; (
                                                            &lt;SelectItem key={vt.name} value={vt.name}&gt;{vt.label}&lt;/SelectItem&gt;
                                                        ))}
                                                    &lt;/SelectContent&gt;
                                                &lt;/Select&gt;
                                            &lt;/TableCell&gt;
                                        )}
                                        &lt;TableCell className="text-right font-mono"&gt;{formatPrice(tx.amount)}&lt;/TableCell&gt;
                                    &lt;/TableRow&gt;
                                ))
                            )}
                        &lt;/TableBody&gt;
                    &lt;/Table&gt;
                &lt;/div&gt;
            &lt;/CardContent&gt;
             &lt;CardFooter className="flex items-center justify-end p-4"&gt;
                 &lt;div className="flex items-center gap-2"&gt;
                    {!searchTerm.trim() &amp;&amp; (
                        &lt;div className="flex items-center space-x-2"&gt;
                            &lt;Button
                                variant="outline"
                                size="sm"
                                onClick={goToPreviousPage}
                                disabled={!canGoPrev || isLoading}
                            &gt;
                                &lt;ChevronLeft className="h-4 w-4" /&gt;
                                Previous
                            &lt;/Button&gt;
                            &lt;span className="text-sm font-medium"&gt;
                                Page {currentPage}
                            &lt;/span&gt;
                            &lt;Button
                                variant="outline"
                                size="sm"
                                onClick={goToNextPage}
                                disabled={!canGoNext || isLoading}
                            &gt;
                                Next
                                &lt;ChevronRight className="h-4 w-4" /&gt;
                            &lt;/Button&gt;
                        &lt;/div&gt;
                    )}
                 &lt;/div&gt;
            &lt;/CardFooter&gt;
        &lt;/Card&gt;
    );
});
ReviewedTab.displayName = 'ReviewedTab';


const ForReviewTab = React.forwardRef&lt;
    { refetch: () =&gt; void },
    { client: User | null; bankAccountId: string | null; fetchClientData: () =&gt; void; customers: ClientCustomer[] }
&gt;(({ client, bankAccountId, fetchClientData, customers }, ref) =&gt; {
    const { toast } = useToast();
    const [activeSubTab, setActiveSubTab] = useState&lt;'expenses' | 'income'&gt;('expenses');
    const [selectedTransactions, setSelectedTransactions] = useState&lt;string[]&gt;([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [isApprovingAll, setIsApprovingAll] = useState(false);
    const [isDownloading, setIsDownloading] = useState(false);
    
    const [viewMode, setViewMode] = useState&lt;'list' | 'group'&gt;('list');
    const [groupedTransactions, setGroupedTransactions] = useState&lt;Record&lt;string, ImportedTransaction[]&gt;&gt;({});
    const [isGrouping, setIsGrouping] = useState(false);

    
    type SortField = 'date' | 'description' | 'amount';
    type SortDirection = 'asc' | 'desc';
    const [sortField, setSortField] = useState&lt;SortField&gt;('date');
    const [sortDirection, setSortDirection] = useState&lt;SortDirection&gt;('desc');

    const handleSort = (field: SortField) =&gt; {
        if (sortField === field) {
            setSortDirection(prev =&gt; prev === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDirection('asc');
        }
    };
    
    const reviewTransactionsQuery = useMemo(() =&gt; {
        if (!client?.uid || !bankAccountId) return null;
        
        let constraints: QueryConstraint[] = [
            where('bankAccountId', '==', bankAccountId),
            where('status', '==', 'review'),
        ];
        
        if (activeSubTab === 'expenses') {
            constraints.push(where('amount', '&lt;', 0));
        } else {
            constraints.push(where('amount', '&gt;=', 0));
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
    } = usePaginatedFirestore&lt;ImportedTransaction&gt;({ baseQuery: reviewTransactionsQuery, pageSize: PAGE_SIZE });

     const transactions = useMemo(() =&gt; {
        let docs = searchTerm ? documents.filter(tx =&gt; tx.description.toLowerCase().includes(searchTerm.toLowerCase())) : documents;
        
        if (sortField === 'description') {
            docs.sort((a, b) =&gt; {
                const comparison = a.description.localeCompare(b.description);
                return sortDirection === 'asc' ? comparison : -comparison;
            });
        }
        
        return docs;
    }, [documents, searchTerm, sortField, sortDirection]);
    
    React.useImperativeHandle(ref, () =&gt; ({
        refetch,
    }));
    
    useEffect(() =&gt; {
        refetch();
        setViewMode('list');
    }, [activeSubTab, refetch]);
    
    const handleGroupReview = async () =&gt; {
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
                queryConstraints.push(where('amount', '&lt;', 0));
            } else {
                queryConstraints.push(where('amount', '&gt;=', 0));
            }
            const q = query(collection(db, 'aiAccountantClients', client.uid, 'transactions'), ...queryConstraints);

            const snapshot = await getDocs(q);
            const allReviewTransactions = snapshot.docs.map(d =&gt; ({ id: d.id, ...d.data() }) as ImportedTransaction);

            const transactionsWithSuppliers = await Promise.all(allReviewTransactions.map(async (tx) =&gt; {
                try {
                    const { supplier } = await extractSupplierName({ description: tx.description });
                    return { ...tx, extractedSupplier: supplier };
                } catch (e) {
                    return { ...tx, extractedSupplier: tx.description.split(' ')[0].toUpperCase() }; // Fallback
                }
            }));
            
            const groups: Record&lt;string, ImportedTransaction[]&gt; = {};
            transactionsWithSuppliers.forEach(tx =&gt; {
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

    const handleBulkAction = async (action: 'approve' | 'reject') =&gt; {
        if (!client || !client.uid || selectedTransactions.length === 0) return;

        toast({ title: "Processing...", description: `Updating ${selectedTransactions.length} transactions.` });
        
        const updatePromises: Promise&lt;void&gt;[] = [];
        for (let i = 0; i &lt; selectedTransactions.length; i += BATCH_SIZE) {
            const batch = writeBatch(db);
            const chunk = selectedTransactions.slice(i, i + BATCH_SIZE);
            chunk.forEach(txId =&gt; {
                const tx = transactions.find(t =&gt; t.id === txId);
                if (!tx) return;
                const transactionRef = doc(db, 'aiAccountantClients', client.uid!, 'transactions', txId);
                if (action === 'approve') {
                    batch.update(transactionRef, { status: 'allocated', allocatedAt: new Date() });
                    if (tx.allocatedTo?.type === 'account' &amp;&amp; !client.allocationRules?.some(rule =&gt; tx.description.toLowerCase().includes(rule.keywords[0]))) {
                         const coreKeyword = tx.description.split(/\s+/)[0].toLowerCase();
                        const newRule: Partial&lt;AllocationRule&gt; = {
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
    
    const handleApproveAll = async () =&gt; {
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
                q = query(q, where('amount', '&lt;', 0));
            } else {
                q = query(q, where('amount', '&gt;=', 0));
            }

            const snapshot = await getDocs(q);
            if (snapshot.empty) {
                toast({ title: "No Transactions to Approve", description: "There are no items pending review in this category." });
                setIsApprovingAll(false);
                return;
            }
            
            const allDocs = snapshot.docs;
            for(let i = 0; i &lt; allDocs.length; i+= BATCH_SIZE) {
                const batch = writeBatch(db);
                const chunk = allDocs.slice(i, i + BATCH_SIZE);
                chunk.forEach(doc =&gt; {
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

    const getAllocationDescription = (tx: ImportedTransaction) =&gt; {
        if (!tx.allocatedTo) return 'N/A';
        if (tx.allocatedTo.type === 'customer') {
            return customers.find(c =&gt; c.id === tx.allocatedTo?.value)?.name || 'Unknown Customer';
        }
        return client?.chartOfAccounts?.find(acc =&gt; acc.id === tx.allocatedTo?.value)?.description || 'Unknown Account';
    }
    
    const handleDownloadExcel = async () =&gt; {
        if (!client || !client.uid || !bankAccountId) return;
        setIsDownloading(true);
        toast({ title: "Preparing Download...", description: "Fetching all transactions for review." });

        try {
            const expensesQuery = query(
                collection(db, 'aiAccountantClients', client.uid, 'transactions'),
                where('bankAccountId', '==', bankAccountId),
                where('status', '==', 'review'),
                where('amount', '&lt;', 0)
            );
            const incomeQuery = query(
                collection(db, 'aiAccountantClients', client.uid, 'transactions'),
                where('status', '==', 'review'),
                where('amount', '&gt;=', 0)
            );
            
            const [expensesSnapshot, incomeSnapshot] = await Promise.all([
                getDocs(expensesQuery),
                getDocs(incomeQuery),
            ]);

            const mapToExport = (tx: ImportedTransaction) =&gt; ({
                'Date': format(new Date(tx.date), 'dd/MM/yyyy'),
                'Description': tx.description,
                'Suggested Allocation': getAllocationDescription(tx),
                'Suggested VAT': allVatTypes.find(v =&gt; v.name === tx.vatType)?.label || 'N/A',
                'Amount': tx.amount,
            });

            const expensesData = expensesSnapshot.docs.map(doc =&gt; mapToExport(doc.data() as ImportedTransaction));
            const incomeData = incomeSnapshot.docs.map(doc =&gt; mapToExport(doc.data() as ImportedTransaction));

            const wb = XLSX.utils.book_new();
            if (expensesData.length &gt; 0) {
                const expensesSheet = XLSX.utils.json_to_sheet(expensesData);
                XLSX.utils.book_append_sheet(wb, expensesSheet, "Expenses For Review");
            }
            if (incomeData.length &gt; 0) {
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


    const isGroupInconsistent = (group: ImportedTransaction[]): boolean =&gt; {
        if (group.length &lt;= 1) return false;
        const firstAccountId = group[0].allocatedTo?.value;
        const firstVatType = group[0].vatType;
        return group.some(tx =&gt; tx.allocatedTo?.value !== firstAccountId || tx.vatType !== firstVatType);
    };

    return (
        &lt;Card&gt;
             &lt;CardHeader className="p-0 border-b"&gt;
                 &lt;Tabs value={activeSubTab} onValueChange={(value) =&gt; setActiveSubTab(value as 'expenses' | 'income')} className="w-full"&gt;
                    &lt;TabsList className="grid w-full grid-cols-2 rounded-t-lg rounded-b-none h-auto"&gt;
                        &lt;TabsTrigger value="expenses"&gt;Review Expenses&lt;/TabsTrigger&gt;
                        &lt;TabsTrigger value="income"&gt;Review Income&lt;/TabsTrigger&gt;
                    &lt;/TabsList&gt;
                &lt;/Tabs&gt;
                 &lt;div className="p-4 flex items-center justify-between"&gt;
                    &lt;div className="flex items-center gap-2"&gt;
                        &lt;Button onClick={handleGroupReview} disabled={isGrouping}&gt;
                            {isGrouping ? &lt;Loader2 className="mr-2 h-4 w-4 animate-spin"/&gt; : &lt;Group className="mr-2 h-4 w-4"/&gt;}
                            {viewMode === 'group' ? 'List View' : 'Group Review'}
                        &lt;/Button&gt;
                        &lt;Button onClick={() =&gt; handleBulkAction('approve')} disabled={selectedTransactions.length === 0}&gt;
                            &lt;CheckCircle className="mr-2 h-4 w-4" /&gt;Approve Selected
                        &lt;/Button&gt;
                         &lt;Button onClick={handleApproveAll} disabled={isApprovingAll || isLoading || transactions.length === 0}&gt;
                            {isApprovingAll ? &lt;Loader2 className="mr-2 h-4 w-4 animate-spin"/&gt; : &lt;CheckCircle className="mr-2 h-4 w-4" /&gt;}
                            Approve All
                        &lt;/Button&gt;
                        &lt;Button variant="destructive" onClick={() =&gt; handleBulkAction('reject')} disabled={selectedTransactions.length === 0}&gt;
                            &lt;RotateCcw className="mr-2 h-4 w-4" /&gt;Reject Selected
                        &lt;/Button&gt;
                        &lt;Button variant="outline" onClick={handleDownloadExcel} disabled={isDownloading}&gt;
                            {isDownloading ? &lt;Loader2 className="mr-2 h-4 w-4 animate-spin" /&gt; : &lt;Download className="mr-2 h-4 w-4" /&gt;}
                            Download Excel
                        &lt;/Button&gt;
                    &lt;/div&gt;
                     &lt;div className="relative"&gt;
                        &lt;Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" /&gt;
                        &lt;Input
                            type="search"
                            placeholder="Search descriptions..."
                            value={searchTerm}
                            onChange={(e) =&gt; setSearchTerm(e.target.value)}
                            className="pl-8 w-64"
                        /&gt;
                    &lt;/div&gt;
                 &lt;/div&gt;
            &lt;/CardHeader&gt;
            &lt;CardContent className="p-0"&gt;
                 {viewMode === 'group' ? (
                     &lt;div className="space-y-4 p-4 max-h-[70vh] overflow-y-auto"&gt;
                        {Object.entries(groupedTransactions).sort((a,b) =&gt; a[0].localeCompare(b[0])).map(([supplier, txs]) =&gt; (
                             &lt;div key={supplier} className="border rounded-lg"&gt;
                                &lt;div className={cn("p-3 bg-muted/50 flex justify-between items-center", isGroupInconsistent(txs) &amp;&amp; "bg-destructive/10")}&gt;
                                    &lt;h3 className="font-bold flex items-center gap-2"&gt;
                                        {isGroupInconsistent(txs) &amp;&amp; &lt;AlertTriangle className="h-4 w-4 text-destructive"/&gt;}
                                        {supplier} &lt;span className="text-sm font-normal text-muted-foreground"&gt;({txs.length} items)&lt;/span&gt;
                                    &lt;/h3&gt;
                                    &lt;div className="flex gap-2"&gt;
                                        &lt;Button size="sm" variant="destructive" onClick={() =&gt; handleBulkAction('reject')}&gt;Reject Group&lt;/Button&gt;
                                        &lt;Button size="sm" onClick={() =&gt; handleBulkAction('approve')}&gt;Approve Group&lt;/Button&gt;
                                    &lt;/div&gt;
                                &lt;/div&gt;
                                &lt;Table&gt;
                                    &lt;TableBody&gt;
                                        {txs.map(tx =&gt; (
                                            &lt;TableRow key={tx.id}&gt;
                                                &lt;TableCell className="text-xs w-[100px]"&gt;{format(new Date(tx.date), 'dd/MM/yyyy')}&lt;/TableCell&gt;
                                                &lt;TableCell className="text-xs"&gt;{tx.description}&lt;/TableCell&gt;
                                                &lt;TableCell className="text-xs"&gt;{getAllocationDescription(tx)}&lt;/TableCell&gt;
                                                &lt;TableCell className="text-xs"&gt;{allVatTypes.find(v =&gt; v.name === tx.vatType)?.label || 'N/A'}&lt;/TableCell&gt;
                                                &lt;TableCell className="text-right text-xs font-mono"&gt;{formatPrice(tx.amount)}&lt;/TableCell&gt;
                                            &lt;/TableRow&gt;
                                        ))}
                                    &lt;/TableBody&gt;
                                &lt;/Table&gt;
                             &lt;/div&gt;
                        ))}
                    &lt;/div&gt;
                 ) : (
                    &lt;div className="overflow-x-auto"&gt;
                        &lt;Table&gt;
                            &lt;TableHeader&gt;
                                &lt;TableRow&gt;
                                    &lt;TableCell className="w-12 p-2"&gt;
                                         &lt;Checkbox
                                            checked={transactions.length &gt; 0 &amp;&amp; selectedTransactions.length === transactions.length}
                                            onCheckedChange={(checked) =&gt; {
                                                setSelectedTransactions(checked ? transactions.map(tx =&gt; tx.id) : []);
                                            }}
                                        /&gt;
                                    &lt;/TableCell&gt;
                                    &lt;TableHead&gt;&lt;Button variant="ghost" onClick={() =&gt; handleSort('date')}&gt;Date &lt;ArrowUpDown className="ml-2 h-4 w-4 inline" /&gt;&lt;/Button&gt;&lt;/TableHead&gt;
                                    &lt;TableHead&gt;&lt;Button variant="ghost" onClick={() =&gt; handleSort('description')}&gt;Description &lt;ArrowUpDown className="ml-2 h-4 w-4 inline" /&gt;&lt;/Button&gt;&lt;/TableHead&gt;
                                    &lt;TableHead&gt;Suggested Allocation&lt;/TableHead&gt;
                                    {client?.isVatRegistered &amp;&amp; &lt;TableHead&gt;Suggested VAT&lt;/TableHead&gt;}
                                    &lt;TableHead className="text-right"&gt;&lt;Button variant="ghost" onClick={() =&gt; handleSort('amount')}&gt;Amount &lt;ArrowUpDown className="ml-2 h-4 w-4 inline" /&gt;&lt;/Button&gt;&lt;/TableHead&gt;
                                &lt;/TableRow&gt;
                            &lt;/TableHeader&gt;
                            &lt;TableBody&gt;
                                {isLoading ? (
                                    &lt;TableRow&gt;&lt;TableCell colSpan={6} className="text-center h-24"&gt;&lt;Loader2 className="animate-spin mx-auto" /&gt;&lt;/TableCell&gt;&lt;/TableRow&gt;
                                ) : transactions.length === 0 ? (
                                    &lt;TableRow&gt;&lt;TableCell colSpan={6} className="text-center h-24 text-muted-foreground"&gt;No transactions are pending review.&lt;/TableCell&gt;&lt;/TableRow&gt;
                                ) : (
                                    transactions.map(tx =&gt; (
                                        &lt;TableRow key={tx.id} data-state={selectedTransactions.includes(tx.id) &amp;&amp; "selected"}&gt;
                                            &lt;TableCell className="p-2"&gt;
                                                &lt;Checkbox
                                                    checked={selectedTransactions.includes(tx.id)}
                                                    onCheckedChange={(checked) =&gt; {
                                                        setSelectedTransactions(prev =&gt;
                                                            checked ? [...prev, tx.id] : prev.filter(id =&gt; id !== tx.id)
                                                        );
                                                    }}
                                                /&gt;
                                            &lt;/TableCell&gt;
                                            &lt;TableCell&gt;{new Date(tx.date).toLocaleDateString('en-GB')}&lt;/TableCell&gt;
                                            &lt;TableCell className="whitespace-normal break-words"&gt;{tx.description}&lt;/TableCell&gt;
                                            &lt;TableCell&gt;{getAllocationDescription(tx)}&lt;/TableCell&gt;
                                            {client?.isVatRegistered &amp;&amp; &lt;TableCell&gt;{allVatTypes.find(v =&gt; v.name === tx.vatType)?.label || 'N/A'}&lt;/TableCell&gt;}
                                            &lt;TableCell className="text-right font-mono"&gt;{formatPrice(tx.amount)}&lt;/TableCell&gt;
                                        &lt;/TableRow&gt;
                                    ))
                                )}
                            &lt;/TableBody&gt;
                        &lt;/Table&gt;
                    &lt;/div&gt;
                )}
            &lt;/CardContent&gt;
            &lt;CardFooter className="flex items-center justify-center p-4"&gt;
                 &lt;div className="flex items-center gap-2"&gt;
                    
                    {!searchTerm &amp;&amp; (
                        &lt;div className="flex items-center space-x-2"&gt;
                            &lt;Button
                                variant="outline"
                                size="sm"
                                onClick={goToPreviousPage}
                                disabled={!canGoPrev || isLoading}
                            &gt;
                                &lt;ChevronLeft className="h-4 w-4" /&gt;
                                Previous
                            &lt;/Button&gt;
                            &lt;span className="text-sm font-medium"&gt;
                                Page {currentPage}
                            &lt;/span&gt;
                            &lt;Button
                                variant="outline"
                                size="sm"
                                onClick={goToNextPage}
                                disabled={!canGoNext || isLoading}
                            &gt;
                                Next
                                &lt;ChevronRight className="h-4 w-4" /&gt;
                            &lt;/Button&gt;
                        &lt;/div&gt;
                    )}
                 &lt;/div&gt;
            &lt;/CardFooter&gt;
        &lt;/Card&gt;
    );
});
ForReviewTab.displayName = 'ForReviewTab';


const AIWorkflowTab = ({ client, bankAccountId, chartOfAccounts, fetchClientData, globalRules, onRuleCreated }: { 
    client: User | null; 
    bankAccountId: string | null; 
    chartOfAccounts: ChartOfAccount[], 
    fetchClientData: () =&gt; void;
    globalRules: AllocationRule[];
    onRuleCreated: () =&gt; void;
}) =&gt; {
    const { toast } = useToast();
    const [transactions, setTransactions] = useState&lt;ImportedTransaction[]&gt;([]);
    const [isLoading, setIsLoading] = useState(true);
    
    const [job, setJob] = useState&lt;AIAllocationJob | null&gt;(null);
    const [isLoadingJob, setIsLoadingJob] = useState(true);
    
    const [groupedTransactions, setGroupedTransactions] = useState&lt;Record&lt;string, ImportedTransaction[]&gt;&gt;({});
    const [groupAllocations, setGroupAllocations] = useState&lt;Record&lt;string, AIAllocationResult | null&gt;&gt;({});
    const [activeApprovalGroup, setActiveApprovalGroup] = useState&lt;{ supplier: string; txs: ImportedTransaction[]; suggestion: AIAllocationResult | null } | null&gt;(null);

    const [isSaving, setIsSaving] = useState(false);
    const [selectedGroups, setSelectedGroups] = useState&lt;string[]&gt;([]);

    const [lastApprovedTxIds, setLastApprovedTxIds] = useState&lt;string[] | null&gt;(null);
    
    // Pagination state
    const [currentPage, setCurrentPage] = useState(1);
    const GROUPS_PER_PAGE = 20;

    useEffect(() =&gt; {
        if (!client?.uid || !bankAccountId) {
            setIsLoading(false);
            return;
        }

        const transQuery = query(
            collection(db, 'aiAccountantClients', client.uid, 'transactions'), 
            where('bankAccountId', '==', bankAccountId),
            where('status', 'in', ['ai_processing', 'ai_review'])
        );
        const transUnsubscribe = onSnapshot(transQuery, (snapshot) =&gt; {
            const fetched = snapshot.docs.map(doc =&gt; ({ id: doc.id, ...doc.data() }) as ImportedTransaction);
            setTransactions(fetched);
            setIsLoading(false);
        }, (error) =&gt; {
            console.error(error);
            setIsLoading(false);
            toast({ title: "Error", description: "Could not load workflow transactions.", variant: "destructive" });
        });

        const jobsQuery = query(
            collection(db, 'aiAccountantClients', client.uid, 'jobs'),
            orderBy('createdAt', 'desc'),
            limit(1)
        );
        const jobUnsubscribe = onSnapshot(jobsQuery, (snapshot) =&gt; {
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

        return () =&gt; { 
            transUnsubscribe();
            jobUnsubscribe();
        };
    }, [client?.uid, bankAccountId, toast]);
    
    useEffect(() =&gt; {
        const groups = transactions.reduce((acc, tx) =&gt; {
            const key = tx.merchantKey || 'Unassigned';
            if (tx.status === 'ai_review') {
                if (!acc[key]) acc[key] = [];
                acc[key].push(tx);
            }
            return acc;
        }, {} as Record&lt;string, ImportedTransaction[]&gt;);
        setGroupedTransactions(groups);

        const initialAllocations: Record&lt;string, AIAllocationResult | null&gt; = {};
        Object.values(groups).forEach(txs =&gt; {
            if (txs.length &gt; 0) {
                const supplier = txs[0].merchantKey;
                if(supplier) {
                    initialAllocations[supplier] = txs[0].aiAllocationResult || null;
                }
            }
        });
        setGroupAllocations(initialAllocations);
    }, [transactions]);
    
    // Pagination logic
    const sortedGroupEntries = useMemo(() =&gt; Object.entries(groupedTransactions).sort((a,b) =&gt; a[0].localeCompare(b[0])), [groupedTransactions]);
    
    const paginatedGroupEntries = useMemo(() =&gt; {
        const startIndex = (currentPage - 1) * GROUPS_PER_PAGE;
        return sortedGroupEntries.slice(startIndex, startIndex + GROUPS_PER_PAGE);
    }, [sortedGroupEntries, currentPage]);

    const totalPages = Math.ceil(sortedGroupEntries.length / GROUPS_PER_PAGE);
    
    const handleRunAiAllocation = async (reanalyse = false) =&gt; {
        if (!client || !bankAccountId) return;
        toast({ title: 'Starting AI Allocation Job...', description: 'The process will run in the background. Please keep this tab open.' });
        try {
            await startAiAllocationJob(client.uid, bankAccountId, reanalyse);
        } catch (e) {
            toast({ title: 'Failed to start job', variant: 'destructive'});
        }
    };
    
    const handleUndoAction = async (txIds: string[]) =&gt; {
        if (!client || txIds.length === 0) return;
        toast({ title: "Undoing...", description: "Reverting transactions."});
        try {
            const batch = writeBatch(db);
            txIds.forEach(id =&gt; {
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
    
    const handleRejectSelected = async (txIdsToReject: string[]) =&gt; {
        if (!client || txIdsToReject.length === 0) return;
        toast({ title: 'Rejecting transactions...' });
        try {
            const batch = writeBatch(db);
            txIdsToReject.forEach(txId =&gt; {
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
    
    const handleConfirmApprovalAndRuleCreation = async (ruleValues: RuleFormValues, groupTxs: ImportedTransaction[]) =&gt; {
      if (!client || !client.uid) return;
      
      const newRule: Omit&lt;AllocationRule, 'id'&gt; = {
        description: ruleValues.description,
        keywords: ruleValues.keywords.split(','),
        accountId: ruleValues.accountId,
        vatType: ruleValues.vatType,
        type: 'hard',
        scope: ruleValues.scope,
      };

      try {
        const batch = writeBatch(db);
        const txIds = groupTxs.map(tx =&gt; tx.id);

        txIds.forEach(txId =&gt; {
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
        toast({ title: 'Transactions Approved &amp; Rule Created', description: `${groupTxs.length} transactions approved and new rule created.`, action: &lt;ToastAction altText="Undo" onClick={() =&gt; handleUndoAction(txIds)}&gt;Undo&lt;/ToastAction&gt; });
        setActiveApprovalGroup(null);
        fetchClientData();

      } catch (error) {
        console.error("Error in confirm and create rule:", error);
        toast({ title: 'Error', description: 'Could not approve and create rule.', variant: 'destructive'});
      }
    };
    
    const handleSaveChanges = async () =&gt; {
        if (!client || Object.keys(groupAllocations).length === 0) return;
        
        setIsSaving(true);
        toast({ title: 'Saving allocation suggestions...' });

        try {
            const batch = writeBatch(db);
            let updatedCount = 0;
            
            for (const supplier in groupAllocations) {
                const allocation = groupAllocations[supplier];
                const txs = groupedTransactions[supplier];
                if (txs &amp;&amp; allocation) {
                    txs.forEach(tx =&gt; {
                        const txRef = doc(db, 'aiAccountantClients', client.uid!, 'transactions', tx.id);
                        batch.update(txRef, { aiAllocationResult: allocation });
                        updatedCount++;
                    });
                }
            }

            if(updatedCount &gt; 0) {
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

    const handleApproveSelected = async () =&gt; {
        if (!client || selectedGroups.length === 0) return;
        
        const txsToApprove = selectedGroups.flatMap(supplier =&gt; groupedTransactions[supplier] || []);
        const allocations = selectedGroups.map(supplier =&gt; groupAllocations[supplier]);
        
        if (allocations.some(alloc =&gt; !alloc || !alloc.accountId)) {
            toast({ title: 'Cannot Approve', description: 'One or more selected groups do not have an account allocated.', variant: 'destructive'});
            return;
        }

        toast({ title: "Approving Selected...", description: `Approving ${txsToApprove.length} transactions.` });
        try {
            const batch = writeBatch(db);
            const txIds = txsToApprove.map(tx =&gt; tx.id);
            
            selectedGroups.forEach(supplier =&gt; {
                const groupTxs = groupedTransactions[supplier];
                const allocation = groupAllocations[supplier];
                if (groupTxs &amp;&amp; allocation &amp;&amp; allocation.accountId) {
                    groupTxs.forEach(tx =&gt; {
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
                action: &lt;ToastAction altText="Undo" onClick={() =&gt; handleUndoAction(txIds)}&gt;Undo&lt;/ToastAction&gt;,
            });
            setSelectedGroups([]);
        } catch (e) {
            console.error(e);
            toast({ title: 'Error', description: 'Could not approve selected transactions.', variant: 'destructive'});
        }
    };

    const handleAllocationChange = (supplier: string, field: 'accountId' | 'vatType', value: string) =&gt; {
        setGroupAllocations(prev =&gt; {
            const current = prev[supplier] || { accountId: '', vatType: 'no_vat', confidence: 0 };
            return {
                ...prev,
                [supplier]: { ...current, [field]: value } as AIAllocationResult
            };
        });
    };

    const handleApproveGroup = async (supplier: string) =&gt; {
        if (!client) return;
        const groupTxs = groupedTransactions[supplier];
        const allocation = groupAllocations[supplier];
        if (!groupTxs || !allocation || !allocation.accountId) {
             toast({ title: 'Cannot Approve', description: 'Please select an account to allocate to first.', variant: 'destructive'});
            return;
        }

        try {
            const batch = writeBatch(db);
            const txIds = groupTxs.map(tx =&gt; tx.id);
            txIds.forEach(txId =&gt; {
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
                action: &lt;ToastAction altText="Undo" onClick={() =&gt; handleUndoAction(txIds)}&gt;Undo&lt;/ToastAction&gt;
            });
        } catch (e) {
            console.error(e);
            toast({ title: 'Error', description: 'Could not approve group.', variant: 'destructive'});
        }
    };

    const handleDownloadExcel = () =&gt; {
        if (Object.keys(groupedTransactions).length === 0) {
            toast({ title: "No data to download." });
            return;
        }

        const dataToExport = Object.entries(groupedTransactions).flatMap(([supplier, txs]) =&gt; 
            txs.map(tx =&gt; ({
                'Group (Supplier)': supplier,
                'Date': format(new Date(tx.date), 'dd/MM/yyyy'),
                'Description': tx.description,
                'Amount': tx.amount,
                'Suggested Account': chartOfAccounts.find(acc =&gt; acc.id === tx.aiAllocationResult?.accountId)?.description || 'N/A',
                'Suggested VAT': allVatTypes.find(vat =&gt; vat.name === tx.aiAllocationResult?.vatType)?.label || 'N/A',
                'Allocate to Account': '',
                'Allocate VAT Type': '',
            }))
        );
        const ws = XLSX.utils.json_to_sheet(dataToExport);

        const accountsList = chartOfAccounts.map(acc =&gt; [acc.description]);
        const vatList = allVatTypes.map(vat =&gt; [vat.label]);
        
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
    const progress = job &amp;&amp; job.total &gt; 0 ? (job.processed / job.total) * 100 : 0;
    const transactionsInProcessing = transactions.filter(tx =&gt; tx.status === 'ai_processing').length;

    return (
        &lt;React.Fragment&gt;
             &lt;ApproveAndCreateRuleDialog
                isOpen={!!activeApprovalGroup}
                onOpenChange={(open) =&gt; setActiveApprovalGroup(open ? activeApprovalGroup : null)}
                groupData={activeApprovalGroup || { supplier: '', txs: [], suggestion: null }}
                client={client}
                onConfirm={handleConfirmApprovalAndRuleCreation}
            /&gt;
            &lt;Card&gt;
                 &lt;CardHeader className="p-4 border-b"&gt;
                     &lt;div className="flex items-center justify-between"&gt;
                        &lt;h2&gt;AI Workflow ({Object.keys(groupedTransactions).length} groups)&lt;/h2&gt;
                         &lt;div className="flex gap-2"&gt;
                            &lt;Button onClick={() =&gt; handleRunAiAllocation()} disabled={isLoading || isProcessing || transactionsInProcessing === 0}&gt;
                                {isProcessing ? &lt;Loader2 className="mr-2 h-4 w-4 animate-spin"/&gt; : &lt;Sparkles className="mr-2 h-4 w-4" /&gt;}
                                Run AI Allocation
                            &lt;/Button&gt;
                            &lt;Button onClick={() =&gt; handleRunAiAllocation(true)} disabled={isLoading || isProcessing} variant="outline"&gt;
                                &lt;RefreshCw className="mr-2 h-4 w-4"/&gt;
                                Re-analyse Groupings
                            &lt;/Button&gt;
                            &lt;Button variant="outline" onClick={handleSaveChanges} disabled={isSaving || isProcessing}&gt;
                                {isSaving ? &lt;Loader2 className="mr-2 h-4 w-4 animate-spin" /&gt; : null}
                                Save Changes
                            &lt;/Button&gt;
                            &lt;Button onClick={handleApproveSelected} disabled={selectedGroups.length === 0 || isProcessing}&gt;
                                Approve Selected ({selectedGroups.length})
                            &lt;/Button&gt;
                            &lt;Button onClick={handleDownloadExcel} variant="outline" disabled={isLoading || isProcessing || Object.keys(groupedTransactions).length === 0}&gt;
                                &lt;Download className="mr-2 h-4 w-4"/&gt;
                                Download Excel
                            &lt;/Button&gt;
                             &lt;Button
                                variant="ghost"
                                onClick={() =&gt; lastApprovedTxIds &amp;&amp; handleUndoAction(lastApprovedTxIds)}
                                disabled={!lastApprovedTxIds || isProcessing}
                            &gt;
                                &lt;RotateCcw className="mr-2 h-4 w-4" /&gt;
                                Undo Last Approval
                            &lt;/Button&gt;
                         &lt;/div&gt;
                     &lt;/div&gt;
                 &lt;/CardHeader&gt;
                 &lt;CardContent className="p-4 space-y-4"&gt;
                    {isProcessing &amp;&amp; job &amp;&amp; (
                         &lt;div className="space-y-2 p-4 border rounded-lg bg-muted"&gt;
                            &lt;h3 className="font-semibold text-center"&gt;AI Allocation in Progress...&lt;/h3&gt;
                            &lt;Progress value={progress} /&gt;
                            &lt;p className="text-sm text-muted-foreground text-center"&gt;Processing group {job.processed} of {job.total}. Please keep this tab open for the process to complete.&lt;/p&gt;
                        &lt;/div&gt;
                    )}
                    {job?.status === 'failed' &amp;&amp; (
                        &lt;Alert variant="destructive"&gt;
                            &lt;AlertTriangle className="h-4 w-4"/&gt;
                            &lt;AlertTitle&gt;Last Job Failed&lt;/AlertTitle&gt;
                            &lt;AlertDescription&gt;{job.error || 'An unknown error occurred.'}&lt;/AlertDescription&gt;
                        &lt;/Alert&gt;
                    )}
                    {isLoading || isLoadingJob ? (
                        &lt;div className="text-center py-8"&gt;
                            &lt;Loader2 className="animate-spin mx-auto" /&gt;
                        &lt;/div&gt;
                    ) : transactions.length === 0 ? (
                        &lt;div className="text-center py-8 text-muted-foreground"&gt;
                            No transactions are in the AI Workflow. Go to the 'New Transactions' tab to send some for processing.
                        &lt;/div&gt;
                    ) : (
                        &lt;div className="space-y-4"&gt;
                             {paginatedGroupEntries.map(([supplier, txs]) =&gt; {
                                const suggestion = groupAllocations[supplier];
                                return (
                                &lt;Collapsible key={supplier} className="border rounded-lg" defaultOpen={true}&gt;
                                    &lt;div className="flex items-center justify-between p-3 bg-muted/50 rounded-t-lg"&gt;
                                        &lt;CollapsibleTrigger asChild&gt;
                                             &lt;div className="flex items-center gap-4 text-left pr-4 flex-grow cursor-pointer"&gt;
                                                &lt;Checkbox
                                                    checked={selectedGroups.includes(supplier)}
                                                    onCheckedChange={(checked) =&gt; {
                                                        setSelectedGroups(prev =&gt; checked ? [...prev, supplier] : prev.filter(s =&gt; s !== supplier))
                                                    }}
                                                    onClick={(e) =&gt; e.stopPropagation()}
                                                    className="ml-2"
                                                /&gt;
                                                &lt;h3 className="font-bold"&gt;{supplier} &lt;span className="font-normal text-muted-foreground"&gt;({txs.length} items)&lt;/span&gt;&lt;/h3&gt;
                                                {suggestion &amp;&amp; &lt;p className="text-xs text-muted-foreground"&gt;AI Confidence: {suggestion.confidence}%&lt;/p&gt;}
                                            &lt;/div&gt;
                                        &lt;/CollapsibleTrigger&gt;
                                        &lt;div className="flex items-center gap-2 flex-shrink-0"&gt;
                                            &lt;Select onValueChange={(value) =&gt; handleAllocationChange(supplier, 'accountId', value)} value={suggestion?.accountId || ''}&gt;
                                                &lt;SelectTrigger className="h-8 w-[200px] bg-white"&gt;&lt;SelectValue placeholder="Select Account..." /&gt;&lt;/SelectTrigger&gt;
                                                &lt;SelectContent&gt;
                                                    {chartOfAccounts.map(acc =&gt; &lt;SelectItem key={acc.id} value={acc.id}&gt;{acc.description}&lt;/SelectItem&gt;)}
                                                &lt;/SelectContent&gt;
                                            &lt;/Select&gt;
                                            &lt;Select onValueChange={(value) =&gt; handleAllocationChange(supplier, 'vatType', value as VatType)} value={suggestion?.vatType || 'no_vat'}&gt;
                                                &lt;SelectTrigger className="h-8 w-[200px] bg-white"&gt;&lt;SelectValue placeholder="Select VAT..." /&gt;&lt;/SelectTrigger&gt;
                                                &lt;SelectContent&gt;
                                                    {allVatTypes.map(vt =&gt; &lt;SelectItem key={vt.name} value={vt.name}&gt;{vt.label}&lt;/SelectItem&gt;)}
                                                &lt;/SelectContent&gt;
                                            &lt;/Select&gt;
                                            &lt;div className="flex items-center gap-1"&gt;
                                                &lt;Button size="sm" variant="destructive" onClick={() =&gt; handleRejectSelected(txs.map(t =&gt; t.id))}&gt;Reject&lt;/Button&gt;
                                                &lt;Button size="sm" onClick={() =&gt; handleApproveGroup(supplier)}&gt;Approve&lt;/Button&gt;
                                                &lt;Button size="sm" onClick={() =&gt; setActiveApprovalGroup({ supplier, txs, suggestion })}&gt;Create Rule&lt;/Button&gt;
                                            &lt;/div&gt;
                                        &lt;/div&gt;
                                    &lt;/div&gt;
                                    &lt;CollapsibleContent&gt;
                                        &lt;Table&gt;
                                            &lt;TableHeader&gt;
                                                &lt;TableRow&gt;
                                                    &lt;TableHead className="w-12"&gt;&lt;Checkbox/&gt;&lt;/TableHead&gt;
                                                    &lt;TableHead className="w-[120px]"&gt;Date&lt;/TableHead&gt;
                                                    &lt;TableHead&gt;Description&lt;/TableHead&gt;
                                                    &lt;TableHead className="text-right w-[150px]"&gt;Amount&lt;/TableHead&gt;
                                                &lt;/TableRow&gt;
                                            &lt;/TableHeader&gt;
                                            &lt;TableBody&gt;
                                                {txs.map(tx =&gt; (
                                                    &lt;TableRow key={tx.id}&gt;
                                                        &lt;TableCell&gt;&lt;Checkbox /&gt;&lt;/TableCell&gt;
                                                        &lt;TableCell className="text-xs"&gt;{format(new Date(tx.date), 'dd/MM/yyyy')}&lt;/TableCell&gt;
                                                        &lt;TableCell className="text-xs"&gt;{tx.description}&lt;/TableCell&gt;
                                                        &lt;TableCell className="text-right font-mono text-xs"&gt;{formatPrice(tx.amount)}&lt;/TableCell&gt;
                                                    &lt;/TableRow&gt;
                                                ))}
                                            &lt;/TableBody&gt;
                                        &lt;/Table&gt;
                                    &lt;/CollapsibleContent&gt;
                                &lt;/Collapsible&gt;
                            ))}
                        &lt;/div&gt;
                    )}
                 &lt;/CardContent&gt;
                 &lt;CardFooter className="flex justify-center items-center p-4"&gt;
                    &lt;Button variant="outline" size="sm" onClick={() =&gt; setCurrentPage(p =&gt; Math.max(p - 1, 1))} disabled={currentPage === 1}&gt;Previous&lt;/Button&gt;
                    &lt;span className="text-sm mx-4"&gt;Page {currentPage} of {totalPages}&lt;/span&gt;
                    &lt;Button variant="outline" size="sm" onClick={() =&gt; setCurrentPage(p =&gt; Math.min(p + 1, totalPages))} disabled={currentPage &gt;= totalPages}&gt;Next&lt;/Button&gt;
                &lt;/CardFooter&gt;
            &lt;/Card&gt;
        &lt;/React.Fragment&gt;
    );
};

function BankTransactionsPage() {
    const params = useParams();
    const router = useRouter();
    const accountIdFromUrl = useSearchParams().get('accountId');
    const { user: currentUser } = useAuth();
    
    const [client, setClient] = useState&lt;User | null&gt;(null);
    const [allAccountTransactions, setAllAccountTransactions] = useState&lt;(ImportedTransaction | AllocatedTransaction)[]&gt;([]);
    const [isNewAccountDialogOpen, setIsNewAccountDialogOpen] = useState(false);
    const { toast } = useToast();
    const [isEditAccountDialogOpen, setIsEditAccountDialogOpen] = useState(false);
    const [selectedAccountForEdit, setSelectedAccountForEdit] = useState&lt;ChartOfAccount | null&gt;(null);
    const [customers, setCustomers] = useState&lt;ClientCustomer[]&gt;([]);
    const [invoices, setInvoices] = useState&lt;Invoice[]&gt;([]);
    const [globalRules, setGlobalRules] = useState&lt;AllocationRule[]&gt;([]);
    const [activeTab, setActiveTab] = useState(currentUser?.role === 'ai_accountant' ? 'ai-workflow' : 'new-transactions');
    const [accountId, setAccountId] = useState&lt;string | null&gt;(accountIdFromUrl);

    const newTransactionsTabRef = useRef&lt;{ refetch: () =&gt; void }&gt;(null);
    const reviewedTabRef = useRef&lt;{ refetch: () =&gt; void }&gt;(null);
    const forReviewTabRef = useRef&lt;{ refetch: () =&gt; void }&gt;(null);

    const fetchClientData = useCallback(async () =&gt; {
        const clientId = params.clientId as string;
        if (!clientId) return;
        try {
            const clientRef = doc(db, 'aiAccountantClients', clientId);
            const clientSnap = await getDoc(clientRef);
            if (clientSnap.exists()) {
                const clientData = clientSnap.data() as User;
                 setClient(clientData);
                 const bankAccounts = clientData.chartOfAccounts?.filter(acc =&gt; acc.accountNumber.startsWith('8400-'));
                 if(!accountId &amp;&amp; bankAccounts &amp;&amp; bankAccounts.length &gt; 0) {
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

    useEffect(() =&gt; {
        fetchClientData();
    }, [fetchClientData]);
    
    useEffect(() =&gt; {
        const clientId = params.clientId as string;
        if (!clientId || !accountId) return;
        const q = query(collection(db, 'aiAccountantClients', clientId, 'transactions'), where('bankAccountId', '==', accountId));
        const unsubscribe = onSnapshot(q, (snapshot) =&gt; {
            const fetched = snapshot.docs.map(d =&gt; ({id: d.id, ...d.data()}) as (ImportedTransaction | AllocatedTransaction));
            setAllAccountTransactions(fetched);
        });
        return () =&gt; unsubscribe();
    }, [params.clientId, accountId]);
    
    const accountStats = useMemo(() =&gt; {
        if (allAccountTransactions.length === 0) {
            return { balance: 0, unallocatedCount: 0 };
        }
        const balance = allAccountTransactions.reduce((sum, tx) =&gt; sum + tx.amount, 0);
        const unallocatedCount = allAccountTransactions.filter(tx =&gt; tx.status === 'new').length;
        return { balance, unallocatedCount };
    }, [allAccountTransactions]);

    useEffect(() =&gt; {
        const clientId = params.clientId as string;
        if (!clientId) return;
        const fetchCustomersAndInvoices = async () =&gt; {
            try {
                const custQuery = query(collection(db, `aiAccountantClients/${clientId}/customers`));
                const custSnapshot = await getDocs(custQuery);
                setCustomers(custSnapshot.docs.map(doc =&gt; ({ id: doc.id, ...doc.data() })) as ClientCustomer[]);

                const invQuery = query(collection(db, `aiAccountantClients/${clientId}/invoices`));
                const invSnapshot = await getDocs(invQuery);
                setInvoices(invSnapshot.docs.map(doc =&gt; ({ id: doc.id, ...doc.data() })) as Invoice[]);
            } catch (error) {
                console.error("Error fetching sub-collections:", error);
            }
        };
        fetchCustomersAndInvoices();
    }, [params.clientId]);

    useEffect(() =&gt; {
        const fetchGlobalRules = async () =&gt; {
            try {
                const q = query(collection(db, 'allocationRules'));
                const querySnapshot = await getDocs(q);
                setGlobalRules(querySnapshot.docs.map(doc =&gt; ({ id: doc.id, ...doc.data() })) as AllocationRule[]);
            } catch (error) {
                console.error("Error fetching global rules:", error);
            }
        };
        fetchGlobalRules();
    }, []);


    const handleAccountCreated = useCallback(() =&gt; {
        fetchClientData();
    }, [fetchClientData]);

    const handleRefreshAll = () =&gt; {
        newTransactionsTabRef.current?.refetch();
        reviewedTabRef.current?.refetch();
        forReviewTabRef.current?.refetch();
    };

    const handleClearTransactions = async () =&gt; {
        if (!client || !accountId) return;

        toast({ title: "Clearing transactions...", description: "This might take a moment." });
        
        const q = query(collection(db, 'aiAccountantClients', client.uid!, 'transactions'), where('bankAccountId', '==', accountId));
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            toast({ title: "No transactions to clear." });
            return;
        }

        try {
            for (let i = 0; i &lt; snapshot.docs.length; i += BATCH_SIZE) {
                const batch = writeBatch(db);
                const chunk = snapshot.docs.slice(i, i + BATCH_SIZE);
                chunk.forEach(doc =&gt; {
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
        return &lt;div className="text-center mt-8"&gt;&lt;Loader2 className="h-8 w-8 animate-spin" /&gt;&lt;/div&gt;;
    }
    
    const bankAccounts = client.chartOfAccounts?.filter(acc =&gt; acc.accountNumber.startsWith('8400-')) || [];
    
    if (bankAccounts.length &gt; 0 &amp;&amp; !accountId) {
      setAccountId(bankAccounts[0].id);
      return &lt;div className="text-center mt-8"&gt;&lt;Loader2 className="h-8 w-8 animate-spin" /&gt;&lt;/div&gt;;
    }
    
    const selectedBankAccount = accountId ? bankAccounts.find(acc =&gt; acc.id === accountId) : undefined;
    
    if (bankAccounts.length === 0) {
        return (
             &lt;div className="text-center mt-8"&gt;
                &lt;Alert variant="destructive" className="max-w-md mx-auto"&gt;
                    &lt;AlertTitle&gt;No Bank Accounts Found&lt;/AlertTitle&gt;
                    &lt;AlertDescription&gt;Please create a bank account first to manage transactions.&lt;/AlertDescription&gt;
                &lt;/Alert&gt;
                 &lt;CreateAccountDialog client={client} onAccountCreated={handleAccountCreated} open={isNewAccountDialogOpen} onOpenChange={setIsNewAccountDialogOpen} /&gt;
            &lt;/div&gt;
        );
    }
    
    const canSeeAllTabs = currentUser?.role === 'admin' || currentUser?.role === 'staff' || currentUser?.role === 'ai_accountant';

    return (
        &lt;div&gt;
            {selectedAccountForEdit &amp;&amp; &lt;EditAccountDialog
                account={selectedBankAccountForEdit}
                client={client}
                onAccountUpdated={handleAccountCreated}
                open={isEditAccountDialogOpen}
                onOpenChange={(open) =&gt; {
                    setIsEditAccountDialogOpen(open);
                    if (!open) setSelectedAccountForEdit(null);
                }}
            /&gt;}
            &lt;div className="md:flex items-start justify-between"&gt;
                &lt;div className="flex items-center gap-4"&gt;
                    &lt;Select value={accountId || ''} onValueChange={(val) =&gt; setAccountId(val)}&gt;
                        &lt;SelectTrigger className="w-[280px]"&gt;
                            &lt;SelectValue placeholder="Select a bank account" /&gt;
                        &lt;/SelectTrigger&gt;
                        &lt;SelectContent&gt;
                            {bankAccounts.map(acc =&gt; &lt;SelectItem key={acc.id} value={acc.id}&gt;{acc.description}&lt;/SelectItem&gt;)}
                        &lt;/SelectContent&gt;
                    &lt;/Select&gt;
                     &lt;div className="flex gap-4 mt-2 text-sm"&gt;
                        &lt;div&gt;
                            &lt;span className="text-muted-foreground"&gt;Balance: &lt;/span&gt;
                            &lt;span className="font-semibold"&gt;{formatPrice(accountStats.balance)}&lt;/span&gt;
                        &lt;/div&gt;
                        &lt;div&gt;
                            &lt;span className="text-muted-foreground"&gt;Unallocated: &lt;/span&gt;
                            &lt;span className="font-semibold"&gt;{accountStats.unallocatedCount}&lt;/span&gt;
                        &lt;/div&gt;
                    &lt;/div&gt;
                &lt;/div&gt;
                &lt;div className="flex items-center gap-2 mt-4 md:mt-0"&gt;
                     &lt;Button variant="outline" onClick={handleRefreshAll}&gt;&lt;RotateCcw className="mr-2 h-4 w-4"/&gt; Refresh&lt;/Button&gt;
                     &lt;AlertDialog&gt;
                        &lt;AlertDialogTrigger asChild&gt;
                            &lt;Button variant="destructive" disabled={!accountId}&gt;&lt;Trash2 className="mr-2 h-4 w-4" /&gt; Clear Transactions&lt;/Button&gt;
                        &lt;/AlertDialogTrigger&gt;
                        &lt;AlertDialogContent&gt;
                            &lt;AlertDialogHeader&gt;
                                &lt;AlertDialogTitle&gt;Are you sure?&lt;/AlertDialogTitle&gt;
                                &lt;AlertDialogDescription&gt;This will permanently delete all transactions in this bank account. This action cannot be undone.&lt;/AlertDialogDescription&gt;
                            &lt;/AlertDialogHeader&gt;
                            &lt;AlertDialogFooter&gt;
                                &lt;AlertDialogCancel&gt;Cancel&lt;/AlertDialogCancel&gt;
                                &lt;AlertDialogAction onClick={handleClearTransactions}&gt;Yes, Delete All&lt;/AlertDialogAction&gt;
                            &lt;/AlertDialogFooter&gt;
                        &lt;/AlertDialogContent&gt;
                    &lt;/AlertDialog&gt;
                     &lt;DropdownMenu&gt;
                         &lt;DropdownMenuTrigger asChild&gt;
                            &lt;Button&gt;&lt;Settings className="mr-2 h-4 w-4" /&gt; Manage Bank Account&lt;/Button&gt;
                         &lt;/DropdownMenuTrigger&gt;
                         &lt;DropdownMenuContent&gt;
                            &lt;DropdownMenuItem onClick={() =&gt; setIsNewAccountDialogOpen(true)}&gt;Create New Bank Account&lt;/DropdownMenuItem&gt;
                            &lt;DropdownMenuItem disabled={!selectedBankAccount} onClick={() =&gt; { setSelectedAccountForEdit(selectedBankAccount || null); setIsEditAccountDialogOpen(true); }}&gt;Edit Selected Account&lt;/DropdownMenuItem&gt;
                         &lt;/DropdownMenuContent&gt;
                     &lt;/DropdownMenu&gt;
                &lt;/div&gt;
            &lt;/div&gt;
            &lt;div className="border rounded-lg mt-4"&gt;
                 &lt;Tabs value={activeTab} onValueChange={(value) =&gt; setActiveTab(value as string)} className="w-full"&gt;
                    {canSeeAllTabs ? (
                        &lt;TabsList className="grid w-full grid-cols-4 rounded-t-lg rounded-b-none h-auto"&gt;
                            &lt;TabsTrigger value="new-transactions"&gt;New Transactions&lt;/TabsTrigger&gt;
                            &lt;TabsTrigger value="ai-workflow"&gt;AI Workflow&lt;/TabsTrigger&gt;
                            &lt;TabsTrigger value="for-review"&gt;For Review&lt;/TabsTrigger&gt;
                            &lt;TabsTrigger value="reviewed"&gt;Reviewed&lt;/TabsTrigger&gt;
                        &lt;/TabsList&gt;
                    ) : (
                        &lt;TabsList className="grid w-full grid-cols-1 rounded-t-lg rounded-b-none h-auto"&gt;
                            &lt;TabsTrigger value="ai-workflow"&gt;AI Workflow&lt;/TabsTrigger&gt;
                        &lt;/TabsList&gt;
                    )}
                    &lt;TabsContent value="new-transactions" className="p-0"&gt;
                        &lt;NewTransactionsTab
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
                        /&gt;
                    &lt;/TabsContent&gt;
                     &lt;TabsContent value="ai-workflow" className="p-0"&gt;
                        &lt;AIWorkflowTab
                            client={client}
                            bankAccountId={accountId}
                            chartOfAccounts={client.chartOfAccounts || []}
                            fetchClientData={fetchClientData}
                            globalRules={globalRules}
                            onRuleCreated={handleAccountCreated}
                        /&gt;
                    &lt;/TabsContent&gt;
                    &lt;TabsContent value="for-review" className="p-0"&gt;
                        &lt;ForReviewTab
                            ref={forReviewTabRef}
                            client={client}
                            bankAccountId={accountId}
                            fetchClientData={fetchClientData}
                            customers={customers}
                        /&gt;
                    &lt;/TabsContent&gt;
                    &lt;TabsContent value="reviewed" className="p-0"&gt;
                        &lt;ReviewedTab
                            ref={reviewedTabRef}
                            client={client}
                            bankAccountId={accountId}
                            customers={customers}
                            onAccountCreated={handleAccountCreated}
                        /&gt;
                    &lt;/TabsContent&gt;
                &lt;/Tabs&gt;
            &lt;/div&gt;
        &lt;/div&gt;
    );
}

export default BankTransactionsPage;


    