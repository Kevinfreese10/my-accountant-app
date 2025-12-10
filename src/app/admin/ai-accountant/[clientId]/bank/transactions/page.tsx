

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
import { FileUp, Loader2, PlusCircle, Search, Settings, Trash2, Edit, List, ArrowRightLeft, Paperclip, X, Plus, Minus, Download, Cog, BookOpen, Sparkles, ArrowUpDown, Ban, ChevronLeft, ChevronRight, CheckCircle, RotateCcw, Upload, AlertTriangle, Mail, Scale, CheckCheck } from 'lucide-react';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { ImportedTransaction, ChartOfAccount, User, VatType, AllocatedTransaction, AllocationRule, AIAllocationJob, ClientCustomer, Invoice } from '@/lib/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { getFirestore, doc, updateDoc, arrayUnion, getDoc, arrayRemove, addDoc, collection, getDocs, query, orderBy, where, writeBatch, onSnapshot, Unsubscribe, Query, DocumentData, QueryDocumentSnapshot, limit, startAfter, QueryConstraint } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useParams, useSearchParams } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { MoreHorizontal } from 'lucide-react';
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
import { Progress } from '@/components/ui/progress';
import { usePaginatedFirestore } from '@/hooks/use-paginated-firestore';
import { Command, CommandInput, CommandList, CommandEmpty, CommandItem, CommandGroup } from '@/components/ui/command';
import { ScrollArea } from '@/components/ui/scroll-area';
import { format, startOfMonth, endOfMonth, eachMonthOfInterval, getYear, getMonth, parseISO, addMonths, isSameMonth, addDays, differenceInDays, isAfter, subDays, startOfDay, endOfDay } from 'date-fns';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { requestMissingStatements } from '@/app/actions';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Slider } from '@/components/ui/slider';


const PAGE_SIZE = 50;
const BATCH_SIZE = 400; // Firestore batch limit is 500

const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-ZA', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(price);
};

// #region Upload Statement Dialog
type ExtractedTransaction = {
    date: string;
    description: string;
    amount: number;
};

type PeriodAnalysisResult = {
    fileName: string;
    startDate: string;
    endDate: string;
    openingBalance: number;
    closingBalance: number;
};

function UploadStatementDialog({ client, bankAccountId, existingTransactions, onImportComplete, globalRules, currentBalance }: { client: User | null, bankAccountId: string, existingTransactions: ImportedTransaction[], onImportComplete: () => void, globalRules: AllocationRule[], currentBalance: number }) {
    const [isOpen, setIsOpen] = useState(false);
    const [files, setFiles] = useState<File[]>([]);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [isExtracting, setIsExtracting] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [periodAnalysis, setPeriodAnalysis] = useState<PeriodAnalysisResult[]>([]);
    const [missingPeriods, setMissingPeriods] = useState<string[]>([]);
    const [extractedTransactions, setExtractedTransactions] = useState<ExtractedTransaction[]>([]);
    const [finalTransactions, setFinalTransactions] = useState<ExtractedTransaction[]>([]);
    const { toast } = useToast();
    const [importStartDate, setImportStartDate] = useState<string>('');
    const [potentialAllocations, setPotentialAllocations] = useState(0);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const missingFileInputRef = useRef<HTMLInputElement>(null);
    const [editableOpeningBalance, setEditableOpeningBalance] = useState<number>(0);


    const resetState = () => {
        setFiles([]);
        setPeriodAnalysis([]);
        setMissingPeriods([]);
        setExtractedTransactions([]);
        setFinalTransactions([]);
        setImportStartDate('');
        setPotentialAllocations(0);
        setIsAnalyzing(false);
        setIsExtracting(false);
        setIsUploading(false);
        setEditableOpeningBalance(0);
        if (fileInputRef.current) fileInputRef.current.value = '';
        if (missingFileInputRef.current) missingFileInputRef.current.value = '';
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>, append = false) => {
        const selectedFiles = e.target.files;
        if (selectedFiles && selectedFiles.length > 0) {
            const newFiles = Array.from(selectedFiles);
            if (append) {
                // Combine and remove duplicates based on file name
                const combined = [...files, ...newFiles];
                const uniqueFiles = combined.filter((file, index, self) =>
                    index === self.findIndex((f) => f.name === file.name)
                );
                setFiles(uniqueFiles);
            } else {
                setFiles(newFiles);
                // Reset states for a new upload batch
                setPeriodAnalysis([]);
                setMissingPeriods([]);
                setExtractedTransactions([]);
                setFinalTransactions([]);
                setImportStartDate('');
                setPotentialAllocations(0);
                setEditableOpeningBalance(0);
            }
        }
    };
    
    useEffect(() => {
        if (files.length > 0 && !isAnalyzing && periodAnalysis.length === 0) {
            handlePeriodAnalysis();
        }
    }, [files]);
    
    const handlePeriodAnalysis = async () => {
        if (files.length === 0) return;
        setIsAnalyzing(true);
        toast({ title: `Analyzing ${files.length} file(s)...`, description: "The AI is checking the statement periods." });

        const analysisResults = await Promise.all(files.map(async (file) => {
            const reader = new FileReader();
            return new Promise<PeriodAnalysisResult | null>((resolve) => {
                reader.readAsDataURL(file);
                reader.onload = async () => {
                    const dataUrl = reader.result as string;
                    try {
                        const result = await extractStatementPeriod({ statementPdf: dataUrl });
                        if (result && result.startDate && result.endDate) {
                            resolve({ fileName: file.name, ...result });
                        } else {
                            toast({ title: `Analysis Error`, description: `Could not determine date range for ${file.name}.`, variant: 'destructive'});
                            resolve(null);
                        }
                    } catch (error) {
                        toast({ title: `Analysis Error`, description: `Failed to analyze ${file.name}.`, variant: 'destructive'});
                        console.error(`Statement analysis error for ${file.name}:`, error);
                        resolve(null);
                    }
                };
                reader.onerror = () => {
                    toast({ title: `File Error`, description: `Could not read ${file.name}.`, variant: 'destructive'});
                    resolve(null);
                };
            });
        }));
        
        const validResults = analysisResults.filter((r): r is PeriodAnalysisResult => r !== null);
        
        if (validResults.length > 0) {
            const sortedResults = [...validResults].sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
            setPeriodAnalysis(sortedResults);
            
            if (sortedResults.length > 1) {
                 const gaps: string[] = [];
                for (let i = 0; i < sortedResults.length - 1; i++) {
                    const end = endOfDay(parseISO(sortedResults[i].endDate));
                    const nextStart = startOfDay(parseISO(sortedResults[i + 1].startDate));
                    
                    if (differenceInDays(nextStart, end) > 1) {
                        const gapStart = addDays(end, 1);
                        const gapEnd = addDays(nextStart, -1);
                        gaps.push(`${format(gapStart, 'dd MMMM yyyy')} to ${format(gapEnd, 'dd MMMM yyyy')}`);
                    }
                }
                setMissingPeriods(gaps);
            } else {
                setMissingPeriods([]);
            }
             handleExtractTransactions(files); // Auto-trigger extraction
        } else {
             setIsAnalyzing(false);
        }
    };

    const handleExtractTransactions = async (filesToProcess: File[]) => {
        setIsAnalyzing(false);
        setIsExtracting(true);
        toast({ title: 'Extracting Transactions...', description: `The AI is now reading all transaction data from ${filesToProcess.length} file(s).` });
        
        const allTransactions: ExtractedTransaction[] = [];
        await Promise.all(filesToProcess.map(file => new Promise<void>((resolve) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = async () => {
                const dataUrl = reader.result as string;
                try {
                    const result = await extractStatementData({ statementPdf: dataUrl });
                    if (result && result.transactions && result.transactions.length > 0) {
                        allTransactions.push(...result.transactions);
                    }
                } catch (error) {
                    console.error(`Transaction extraction error for ${file.name}:`, error);
                } finally {
                    resolve();
                }
            };
             reader.onerror = () => {
                 toast({ title: `File Error for ${file.name}`, description: 'Could not read the selected file.', variant: 'destructive' });
                 resolve();
            };
        })));
        
        if (allTransactions.length > 0) {
            const sortedTransactions = allTransactions.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
            
            setExtractedTransactions(sortedTransactions);
            
            if(sortedTransactions.length > 0) {
                setImportStartDate(sortedTransactions[0].date);
            }

        } else {
             toast({ title: 'Extraction Failed', description: 'No transactions could be found in any of the provided files.', variant: 'destructive' });
        }
        
        setIsExtracting(false);
    };

    useEffect(() => {
        if(extractedTransactions.length > 0) {
            // Duplicate check
            const existingTransactionSignatures = new Set(existingTransactions.map(tx => `${format(new Date(tx.date), 'yyyy-MM-dd')}_${tx.description}_${tx.amount.toFixed(2)}`));
            const uniqueNewTransactions = extractedTransactions.filter(tx => !existingTransactionSignatures.has(`${format(new Date(tx.date), 'yyyy-MM-dd')}_${tx.description}_${tx.amount.toFixed(2)}`));
            
            setFinalTransactions(uniqueNewTransactions);

            // Set initial editable opening balance
            const initialOpeningBalance = periodAnalysis.length > 0 ? periodAnalysis[0].openingBalance : 0;
            setEditableOpeningBalance(initialOpeningBalance);
            
             // Rule allocation check
            let ruleAllocationCount = 0;
            const allRules = [...(client?.allocationRules || []), ...globalRules];
            if (allRules.length > 0) {
                for (const tx of uniqueNewTransactions) {
                    const txDescriptionLower = tx.description.toLowerCase();
                    const matchedRule = allRules.find(rule => 
                        rule.keywords.some(kw => txDescriptionLower.includes(kw.toLowerCase()))
                    );
                    if (matchedRule) {
                        ruleAllocationCount++;
                    }
                }
            }
            setPotentialAllocations(ruleAllocationCount);

        }
    }, [extractedTransactions, existingTransactions, periodAnalysis, client, globalRules]);

    const reconciliationDetails = useMemo(() => {
        if (finalTransactions.length === 0 || periodAnalysis.length === 0) return null;

        const transactionsForCalc = finalTransactions.filter(tx => !importStartDate || !isAfter(startOfDay(parseISO(importStartDate)), startOfDay(new Date(tx.date))));

        const openingBalance = editableOpeningBalance;
        const closingBalance = periodAnalysis[periodAnalysis.length - 1].closingBalance;
        
        const totalCredits = transactionsForCalc.reduce((sum, tx) => tx.amount > 0 ? sum + tx.amount : sum, 0);
        const totalDebits = transactionsForCalc.reduce((sum, tx) => tx.amount < 0 ? sum + tx.amount : sum, 0);
        
        const calculatedClosingBalance = openingBalance + totalCredits + totalDebits;

        return {
            openingBalance,
            totalCredits,
            totalDebits,
            calculatedClosingBalance,
            closingBalance,
            difference: calculatedClosingBalance - closingBalance,
        };
    }, [finalTransactions, importStartDate, editableOpeningBalance, periodAnalysis]);
    
    const transactionsToImport = useMemo(() => {
        if (!importStartDate) return finalTransactions;
        return finalTransactions.filter(tx => !isAfter(startOfDay(parseISO(importStartDate)), startOfDay(new Date(tx.date))));
    }, [finalTransactions, importStartDate]);

    const handleImport = async () => {
        if (!client || !client.uid || !bankAccountId || transactionsToImport.length === 0 || !reconciliationDetails) return;
        setIsUploading(true);
        toast({ title: "Importing...", description: "Saving extracted transactions."});

        try {
            const allRules = [...(client.allocationRules || []), ...globalRules];
            
            let allDbOperations: ((batch: ReturnType<typeof writeBatch>) => void)[] = [];
            const dailyCounters: { [key: string]: number } = {};
            
            // Add Opening Balance if the account is currently empty
            if (Math.abs(currentBalance) < 0.01 && periodAnalysis.length > 0) {
                 const openingBalanceDate = subDays(startOfDay(new Date(periodAnalysis[0].startDate)), 1);
                 const openingBalanceValue = periodAnalysis[0].openingBalance;

                 if (openingBalanceValue !== 0) {
                     const dateString = openingBalanceDate.toISOString().split('T')[0].replace(/-/g, '');
                     const reference = `${dateString}00`;
                     
                     allDbOperations.push((batch) => {
                        const newTransactionRef = doc(collection(db, 'aiAccountantClients', client.uid!, 'transactions'));
                         batch.set(newTransactionRef, {
                             clientId: client.uid,
                             date: openingBalanceDate.toISOString(),
                             reference: reference,
                             description: 'Opening Balance',
                             amount: openingBalanceValue,
                             bankAccountId: bankAccountId,
                             status: 'allocated',
                             allocatedTo: { value: '9500-002', type: 'account' },
                             vatType: 'no_vat',
                         });
                     });
                 }
            }


            transactionsToImport.forEach((row) => {
                 const parsedDate = new Date(row.date);
                 if (isNaN(parsedDate.getTime())) {
                    console.warn(`Skipping row with invalid date:`, row);
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
                    description: row.description,
                    amount: row.amount,
                    bankAccountId: bankAccountId,
                    status: 'new'
                };
                
                 const txDescriptionLower = row.description.toLowerCase();
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

            toast({ title: "Import Successful", description: `${transactionsToImport.length} new transactions have been imported.`});
            onImportComplete();
            setIsOpen(false);
            resetState();
        } catch (error) {
            console.error("Error importing extracted transactions:", error);
            toast({ title: "Import Failed", description: "An error occurred during the import process.", variant: "destructive"});
        } finally {
            setIsUploading(false);
        }
    };
    
    const handleRequestStatements = async () => {
        if (!client || !client.email || missingPeriods.length === 0) {
            toast({ title: "Cannot Send Request", description: "Client email or missing periods are not defined.", variant: "destructive"});
            return;
        }
        toast({ title: "Sending Request...", description: `Emailing ${client.name} for missing statements.` });
        try {
            await requestMissingStatements({
                clientName: client.name,
                clientEmail: client.email,
                missingPeriods: missingPeriods,
            });
            toast({ title: "Request Sent!", description: "An email has been sent to the client."});
        } catch (error) {
            console.error("Error sending missing statement request:", error);
            toast({ title: "Request Failed", description: "Could not send the email.", variant: "destructive"});
        }
    }
    
    const importPreviewTransactions = useMemo(() => {
        let preview: { date: string, description: string, amount: number }[] = [];
        if (Math.abs(currentBalance) < 0.01 && periodAnalysis.length > 0 && periodAnalysis[0].openingBalance !== 0) {
            preview.push({
                date: format(subDays(startOfDay(new Date(periodAnalysis[0].startDate)), 1), 'yyyy-MM-dd'),
                description: 'Opening Balance',
                amount: periodAnalysis[0].openingBalance,
            });
        }
        return [...preview, ...transactionsToImport];
    }, [currentBalance, periodAnalysis, transactionsToImport]);

    return (
        <Dialog open={isOpen} onOpenChange={(open) => { setIsOpen(open); if(!open) resetState(); }}>
            <DialogTrigger asChild>
                <Button variant="outline"><Upload className="mr-2 h-4 w-4" /> Upload Statement(s)</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-4xl">
                <DialogHeader>
                    <DialogTitle>Upload Bank Statement (AI Extraction)</DialogTitle>
                    <DialogDescription>
                       Select one or more PDF or image files of a bank statement. The AI will extract, reconcile and check for duplicates.
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                     <Input ref={fileInputRef} id="ai-statement-file" type="file" accept="application/pdf,image/jpeg,image/png" onChange={(e) => handleFileChange(e, false)} disabled={isAnalyzing || isExtracting} multiple />
                     
                     {(isAnalyzing || isExtracting) && 
                        <div className="flex items-center gap-2 text-primary">
                            <Loader2 className="animate-spin"/>
                            <span>{isAnalyzing ? "Analyzing periods..." : "Extracting transactions..."}</span>
                        </div>
                     }
                     
                    {periodAnalysis.length > 0 && extractedTransactions.length === 0 && !isExtracting && (
                        <div className="pt-4 space-y-4">
                            <Card>
                                <CardHeader>
                                    <CardTitle>Period Analysis</CardTitle>
                                    <CardDescription>The AI is now extracting transactions. This may take a moment.</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>File Name</TableHead>
                                                <TableHead>Start Date</TableHead>
                                                <TableHead>End Date</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {periodAnalysis.map((p, i) => (
                                                <TableRow key={i}>
                                                    <TableCell>{p.fileName}</TableCell>
                                                    <TableCell>{format(parseISO(p.startDate), 'dd MMMM yyyy')}</TableCell>
                                                    <TableCell>{format(parseISO(p.endDate), 'dd MMMM yyyy')}</TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </CardContent>
                            </Card>
                        </div>
                     )}

                     {reconciliationDetails && 
                        <div className="pt-4 space-y-4">
                             <Card>
                                <CardHeader>
                                    <CardTitle className="flex items-center"><Scale className="mr-2 h-5 w-5"/> Reconciliation Summary</CardTitle>
                                    <CardDescription>This is a summary of the transactions to be imported.</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    {missingPeriods.length > 0 && (
                                        <Alert variant="destructive" className="mb-4">
                                            <AlertTriangle className="h-4 w-4" />
                                            <div className="flex justify-between items-center gap-4">
                                                <div>
                                                    <AlertTitle>Missing Statement Periods Detected</AlertTitle>
                                                    <AlertDescription>
                                                        The following periods appear to be missing: {missingPeriods.join(', ')}
                                                    </AlertDescription>
                                                </div>
                                                 <div className="flex gap-2 flex-shrink-0">
                                                    <input
                                                        ref={missingFileInputRef}
                                                        type="file"
                                                        accept="application/pdf,image/jpeg,image/png"
                                                        onChange={(e) => handleFileChange(e, true)}
                                                        className="hidden"
                                                        id="missing-file-input"
                                                        multiple
                                                    />
                                                    <Button variant="secondary" size="sm" onClick={() => missingFileInputRef.current?.click()}><Upload className="mr-2 h-4 w-4"/> Upload Missing</Button>
                                                    <Button variant="outline" size="sm" onClick={handleRequestStatements}><Mail className="mr-2 h-4 w-4"/> Request from Client</Button>
                                                 </div>
                                            </div>
                                        </Alert>
                                    )}
                                     <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                                        <div className="space-y-1 p-3 rounded-lg bg-muted">
                                            <Label htmlFor="opening-balance-input" className="text-xs text-muted-foreground">Opening Balance</Label>
                                            <Input 
                                                id="opening-balance-input"
                                                type="number"
                                                step="0.01"
                                                className="font-semibold text-center h-8"
                                                value={editableOpeningBalance}
                                                onChange={(e) => setEditableOpeningBalance(Number(e.target.value))}
                                            />
                                        </div>
                                         <div className="space-y-1 p-3 rounded-lg bg-muted">
                                            <p className="text-xs text-muted-foreground">Total Income</p>
                                            <p className="font-semibold text-green-600">{formatPrice(reconciliationDetails.totalCredits)}</p>
                                        </div>
                                         <div className="space-y-1 p-3 rounded-lg bg-muted">
                                            <p className="text-xs text-muted-foreground">Total Payments</p>
                                            <p className="font-semibold text-red-600">{formatPrice(reconciliationDetails.totalDebits)}</p>
                                        </div>
                                         <div className="space-y-1 p-3 rounded-lg bg-muted">
                                            <p className="text-xs text-muted-foreground">Calculated Balance</p>
                                            <p className="font-semibold">{formatPrice(reconciliationDetails.calculatedClosingBalance)}</p>
                                        </div>
                                     </div>
                                      <div className="mt-4 grid grid-cols-2 gap-4">
                                        <Alert>
                                            <AlertTitle>Actual Closing Balance</AlertTitle>
                                            <AlertDescription className="text-lg font-bold">{formatPrice(reconciliationDetails.closingBalance)}</AlertDescription>
                                        </Alert>
                                        <Alert variant={Math.abs(reconciliationDetails.difference) < 0.01 ? 'default' : 'destructive'}>
                                            <AlertTitle>Difference</AlertTitle>
                                            <AlertDescription className="text-lg font-bold">{formatPrice(reconciliationDetails.difference)}</AlertDescription>
                                        </Alert>
                                    </div>
                                </CardContent>
                            </Card>
                            
                             <div className="flex flex-col sm:flex-row items-end gap-4 justify-between pt-4">
                                 <div>
                                     <Label htmlFor="start-date-import">Start Import From</Label>
                                     <Input 
                                        id="start-date-import"
                                        type="date" 
                                        value={importStartDate ? format(parseISO(importStartDate), 'yyyy-MM-dd') : ''}
                                        onChange={(e) => setImportStartDate(e.target.value)}
                                        className="w-full sm:w-auto"
                                     />
                                 </div>
                                 <div className="text-sm font-semibold space-y-1 text-right">
                                    <p className="text-green-600">{transactionsToImport.length} new transactions found to import. ({extractedTransactions.length - finalTransactions.length} duplicates were excluded).</p>
                                     {potentialAllocations > 0 && <p className="text-blue-600">{potentialAllocations} transaction(s) will be automatically allocated by rules.</p>}
                                 </div>
                            </div>

                             <Card className="mt-4">
                                <CardHeader>
                                    <CardTitle>Transactions to be Imported</CardTitle>
                                </CardHeader>
                                <CardContent className="max-h-64 overflow-y-auto">
                                    <ScrollArea>
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead>Date</TableHead>
                                                    <TableHead>Description</TableHead>
                                                    <TableHead className="text-right">Amount</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {importPreviewTransactions.length > 0 ? importPreviewTransactions.map((tx, index) => (
                                                    <TableRow key={index}>
                                                        <TableCell>{format(parseISO(tx.date), 'dd/MM/yyyy')}</TableCell>
                                                        <TableCell>{tx.description}</TableCell>
                                                        <TableCell className="text-right font-mono">{formatPrice(tx.amount)}</TableCell>
                                                    </TableRow>
                                                )) : (
                                                    <TableRow>
                                                        <TableCell colSpan={3} className="text-center">No new transactions to import.</TableCell>
                                                    </TableRow>
                                                )}
                                            </TableBody>
                                        </Table>
                                    </ScrollArea>
                                </CardContent>
                            </Card>
                        </div>
                     }
                </div>
                <DialogFooter>
                    <Button type="button" variant="ghost" onClick={() => setIsOpen(false)}>Cancel</Button>
                    {reconciliationDetails && (
                        <Button type="button" onClick={handleImport} disabled={isUploading || Math.abs(reconciliationDetails.difference) > 0.01}>
                            {isUploading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Save {importPreviewTransactions.length} Transactions
                        </Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
// #endregion

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
            const allRules = [...(client.allocationRules || []), ...globalRules];

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
                                    <p className="text-lg font-bold">{new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' }).format(newBalance)}</p>
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

            const nextNumber = existingNumbers.length > 0 ? Math.max(...existingNumbers) + 1 : 1;
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
        
        // Check for duplicate account number
        const existingAccount = client.chartOfAccounts?.find(acc => acc.accountNumber === values.accountNumber);
        if (existingAccount) {
            form.setError('accountNumber', { message: 'This account number already exists.' });
            return;
        }

        setIsSaving(true);
        try {
            const newAccount: ChartOfAccount = {
                id: values.accountNumber, // Use account number as ID for new accounts
                accountNumber: values.accountNumber,
                description: values.description,
                section: values.section,
            };

            const clientRef = doc(db, 'aiAccountantClients', client.uid);
            await updateDoc(clientRef, { chartOfAccounts: arrayUnion(newAccount) });
            
            toast({ title: 'Account Created', description: `Account "${values.description}" has been added.` });
            onAccountCreated(); // This should trigger a refetch of client data
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
    const [searchAccountTerm, setSearchAccountTerm] = useState('');
    const [isCreateRuleOpen, setIsCreateRuleOpen] = useState(false);
    const [isCreateGeneralAccountOpen, setIsCreateGeneralAccountOpen] = useState(false);
    const [ruleDefaultValues, setRuleDefaultValues] = useState<Partial<z.infer<typeof ruleFormSchema>>>({ description: '', keywords: '', accountId: '', vatType: 'standard_rated_purchases', scope: 'client' });
    const [isAiAllocating, setIsAiAllocating] = useState(false);
    const [isRuleAllocating, setIsRuleAllocating] = useState(false);
    const [isDownloading, setIsDownloading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [isSearching, setIsSearching] = useState(false);
    const [searchResults, setSearchResults] = useState<ImportedTransaction[] | null>(null);
    const [isConfidenceDialogOpen, setIsConfidenceDialogOpen] = useState(false);
    const [aiConfidenceThreshold, setAiConfidenceThreshold] = useState(70);
    const [isSaving, setIsSaving] = useState(false);

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
    
    const newTransactionsQuery = useMemo(() => {
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
    
        if(constraints.some(c => c.type === 'where' && (c as any)._op === '<')) {
            constraints.push(orderBy('amount', sortDirection === 'asc' ? 'desc' : 'asc')); // Amount < 0, so sorting visually asc means firestore desc
        } else {
             constraints.push(orderBy(sortField, sortDirection));
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
    } = usePaginatedFirestore<ImportedTransaction>({ baseQuery: newTransactionsQuery, pageSize: PAGE_SIZE });

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
        return searchResults !== null ? searchResults : paginatedDocuments;
    }, [searchResults, paginatedDocuments]);
    
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


    const handleAiExpenseAllocate = async () => {
        if (!client || !client.uid || !client.chartOfAccounts || selectedTransactions.length === 0) return;
        setIsAiAllocating(true);
        
        const transactionsToAllocate = transactions.filter(tx => selectedTransactions.includes(tx.id));
        const totalToProcess = transactionsToAllocate.length;
        const chartOfAccountsJson = JSON.stringify(client.chartOfAccounts.map(c => ({ id: c.id, accountNumber: c.accountNumber, description: c.description })));
        
        let successCount = 0;
        let processedCount = 0;

        for (const tx of transactionsToAllocate) {
            processedCount++;
            try {
                const result = await suggestTransactionAllocation({
                    description: tx.description,
                    chartOfAccounts: chartOfAccountsJson,
                    isVatRegistered: client.isVatRegistered || false,
                });

                if (result.accountId && result.confidence > 70) {
                    const transactionRef = doc(db, 'aiAccountantClients', client.uid, 'transactions', tx.id);
                    await updateDoc(transactionRef, {
                        status: 'review',
                        allocatedTo: { value: result.accountId, type: 'account' },
                        vatType: client.isVatRegistered ? result.vatType : 'no_vat',
                        allocatedAt: new Date(),
                    });
                    successCount++;
                    
                    const accountName = client.chartOfAccounts.find(a => a.id === result.accountId)?.description || 'Unknown';
                    
                    toast({
                        title: `Allocated ${processedCount} of ${totalToProcess}`,
                        description: (
                            <div>
                                <p>Transaction: <span className="font-semibold">{tx.description}</span></p>
                                <p>Account: <span className="font-semibold">{accountName}</span></p>
                                {client.isVatRegistered && <p>VAT Type: <span className="font-semibold">{result.vatType}</span></p>}
                                <p>AI Confidence: <span className="font-semibold">{result.confidence}%</span></p>
                            </div>
                        ),
                        duration: 5000,
                    });
                }
            } catch (error) {
                console.error(`AI allocation failed for tx ${tx.id}:`, error);
                 toast({
                    title: `Processing Failed for Tx ${processedCount}`,
                    description: 'The AI could not allocate this transaction.',
                    variant: 'destructive',
                 });
            }
        }
        
        toast({
            title: "AI Allocation Complete",
            description: `${successCount} out of ${totalToProcess} transactions were confidently allocated for review.`
        });
        
        setSelectedTransactions([]);
        refetch();
        setIsAiAllocating(false);
    };
    
   const handleAiAllocateAllExpenses = async (confidenceThreshold: number) => {
        if (!client || !client.uid || !client.chartOfAccounts || !bankAccountId) return;
        setIsAiAllocating(true);
        const { id: toastId } = toast({ title: "Step 1: Fetching Transactions...", description: "Gathering all new expenses." });

        try {
            const q = query(
                collection(db, 'aiAccountantClients', client.uid, 'transactions'),
                where('bankAccountId', '==', bankAccountId),
                where('status', '==', 'new'),
                where('amount', '<', 0)
            );
            const snapshot = await getDocs(q);
            const allNewExpenseTransactions = snapshot.docs.map(d => ({id: d.id, ...d.data()}) as ImportedTransaction);

            if (allNewExpenseTransactions.length === 0) {
                toast({ title: "No Transactions", description: "There are no new expenses to allocate." });
                setIsAiAllocating(false);
                dismiss(toastId);
                return;
            }
            
            toast({ id: toastId, title: "Step 2: Grouping Similar Transactions...", description: `Found ${allNewExpenseTransactions.length} transactions to process.`});

            const chartOfAccountsJson = JSON.stringify(client.chartOfAccounts.map(c => ({ id: c.id, accountNumber: c.accountNumber, description: c.description })));
            
            const groups: { [key: string]: ImportedTransaction[] } = {};
            allNewExpenseTransactions.forEach(tx => {
                const key = tx.description.replace(/\d+/g, '').trim(); 
                if (!groups[key]) {
                    groups[key] = [];
                }
                groups[key].push(tx);
            });
            const totalGroups = Object.keys(groups).length;

            let allUpdatePromises: Promise<void>[] = [];
            let batch = writeBatch(db);
            let batchCount = 0;
            let overallAllocatedCount = 0;
            let groupsProcessed = 0;

            for (const key in groups) {
                groupsProcessed++;
                toast({ id: toastId, title: `Step 3: Analyzing Group ${groupsProcessed} of ${totalGroups}...`, description: `Processing transactions for "${key}"` });
                
                const group = groups[key];
                const representativeTx = group[0];
        
                try {
                    const result = await suggestTransactionAllocation({
                        description: representativeTx.description,
                        chartOfAccounts: chartOfAccountsJson,
                        isVatRegistered: client.isVatRegistered || false,
                    });
        
                    if (result.accountId && result.confidence >= confidenceThreshold) {
                        group.forEach(similarTx => {
                            if (batchCount >= BATCH_SIZE) {
                                allUpdatePromises.push(batch.commit());
                                batch = writeBatch(db);
                                batchCount = 0;
                            }
                            const transactionRef = doc(db, 'aiAccountantClients', client.uid!, 'transactions', similarTx.id);
                            batch.update(transactionRef, {
                                status: 'review',
                                allocatedTo: { value: result.accountId, type: 'account' },
                                vatType: client.isVatRegistered ? result.vatType : 'no_vat',
                                allocatedAt: new Date(),
                            });
                            batchCount++;
                            overallAllocatedCount++;
                        });
                    }
                } catch (error) {
                    console.error(`AI allocation failed for group ${key}:`, error);
                }
            }
            
            if (batchCount > 0) {
                allUpdatePromises.push(batch.commit());
            }
            
            toast({ id: toastId, title: "Step 4: Saving Allocations...", description: "Committing changes to the database." });

            await Promise.all(allUpdatePromises);
            
            dismiss(toastId);
            if (overallAllocatedCount > 0) {
                 toast({
                    title: "AI Bulk Allocation Complete!",
                    description: `${overallAllocatedCount} out of ${allNewExpenseTransactions.length} transactions were confidently allocated for review.`
                });
            } else {
                 toast({
                    title: "AI Bulk Allocation Complete",
                    description: `The AI did not find any transactions to allocate above your confidence threshold of ${confidenceThreshold}%.`
                });
            }
            
        } catch (error) {
            console.error("Error during AI bulk allocation:", error);
            toast({ id: toastId, title: "Error", description: "An error occurred during the AI allocation process.", variant: "destructive" });
        } finally {
            dismiss(toastId);
        }
        
        refetch();
        setIsAiAllocating(false);
        setIsConfidenceDialogOpen(false);
    };

    const handleAiIncomeAllocate = async () => {
        if (!client || !client.uid || selectedTransactions.length === 0) return;
        setIsAiAllocating(true);
        toast({ title: "AI is allocating...", description: `Processing ${selectedTransactions.length} income transactions.` });
        
        const transactionsToAllocate = transactions.filter(tx => selectedTransactions.includes(tx.id));
        const customersWithInvoices = customers.map(c => ({
            id: c.id,
            name: c.name,
            invoiceNumbers: invoices.filter(inv => inv.customerId === c.id).map(inv => inv.id),
        }));

        let successCount = 0;
        const allUpdatePromises: Promise<void>[] = [];
        let batch = writeBatch(db);
        let batchCount = 0;

        for (const tx of transactionsToAllocate) {
            try {
                const result = await suggestIncomeAllocation({
                    description: tx.description,
                    customers: JSON.stringify(customersWithInvoices)
                });

                if (result.customerId && result.confidence > 70) {
                    if (batchCount >= BATCH_SIZE) {
                        allUpdatePromises.push(batch.commit());
                        batch = writeBatch(db);
                        batchCount = 0;
                    }
                    const transactionRef = doc(db, 'aiAccountantClients', client.uid, 'transactions', tx.id);
                    batch.update(transactionRef, {
                        status: 'review', 
                        allocatedTo: { value: result.customerId, type: 'customer' },
                        vatType: 'no_vat',
                        allocatedAt: new Date(),
                    });
                    batchCount++;
                    successCount++;
                }
            } catch (error) {
                console.error(`AI allocation failed for tx ${tx.id}:`, error);
            }
        }
        
        if (batchCount > 0) {
            allUpdatePromises.push(batch.commit());
        }

        try {
            await Promise.all(allUpdatePromises);
            if(successCount > 0) {
              toast({ title: "AI Allocation Complete", description: `${successCount} out of ${selectedTransactions.length} transactions were confidently allocated for review.` });
            } else {
               toast({ title: "AI Allocation", description: `The AI could not confidently allocate any of the selected transactions.`, variant: 'destructive'});
            }
            setSelectedTransactions([]);
            refetch();
        } catch (error) {
            console.error("Error committing AI allocations:", error);
            toast({ title: "AI Allocation Failed", description: "An error occurred while saving the allocations.", variant: "destructive" });
        } finally {
            setIsAiAllocating(false);
        }
    };


    const handleBulkDelete = async () => {
        if (!client || !client.uid || selectedTransactions.length === 0) return;

        try {
            for (let i = 0; i < selectedTransactions.length; i += BATCH_SIZE) {
                const batch = writeBatch(db);
                const chunk = selectedTransactions.slice(i, i + BATCH_SIZE);
                chunk.forEach(txId => {
                    const docRef = doc(db, 'aiAccountantClients', client!.uid, 'transactions', txId);
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
            
            // Re-run the search to show remaining items
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

    const allocationOptions = useMemo(() => {
        const accounts = client?.chartOfAccounts?.filter(acc => acc.description.toLowerCase().includes(searchAccountTerm.toLowerCase())) || [];
        const customerOptions = customers.filter(c => c.name.toLowerCase().includes(searchAccountTerm.toLowerCase()));

        return { accounts, customers: customerOptions };
    }, [client?.chartOfAccounts, customers, searchAccountTerm]);
    
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

            <Dialog open={isConfidenceDialogOpen} onOpenChange={setIsConfidenceDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Set AI Confidence Level</DialogTitle>
                        <DialogDescription>
                            Choose the minimum confidence level the AI must have to automatically allocate a transaction. Higher values mean fewer, but more accurate, automatic allocations.
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
                        <Button type="button" variant="ghost" onClick={() => setIsConfidenceDialogOpen(false)}>Cancel</Button>
                        <Button type="button" onClick={() => handleAiAllocateAllExpenses(aiConfidenceThreshold)} disabled={isAiAllocating}>
                            {isAiAllocating ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Sparkles className="mr-2 h-4 w-4" />}
                            Start Allocation
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
                                <Button variant="outline">Actions <MoreHorizontal className="ml-2 h-4 w-4"/></Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent>
                                <DropdownMenuSub>
                                    <DropdownMenuSubTrigger disabled={selectedTransactions.length === 0}>Allocate Selected</DropdownMenuSubTrigger>
                                    <DropdownMenuSubContent className="p-0">
                                        <Command>
                                            <CommandInput placeholder="Search..." value={searchAccountTerm} onValueChange={setSearchAccountTerm} />
                                            <CommandList>
                                                <ScrollArea className="h-72">
                                                <CommandEmpty>No results found.</CommandEmpty>
                                                <CommandGroup heading="Customers">
                                                    {allocationOptions.customers.map(c => (
                                                        <DropdownMenuItem key={c.id} onSelect={() => handleBulkAllocate({value: c.id, type: 'customer'}, 'no_vat')}>
                                                            {c.name}
                                                        </DropdownMenuItem>
                                                    ))}
                                                </CommandGroup>
                                                 <CommandGroup heading="Accounts">
                                                    {allocationOptions.accounts.map(acc => (
                                                        <DropdownMenuSub key={acc.id}>
                                                            <DropdownMenuSubTrigger>{acc.description}</DropdownMenuSubTrigger>
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
                                                </ScrollArea>
                                            </CommandList>
                                        </Command>
                                    </DropdownMenuSubContent>
                                </DropdownMenuSub>
                                <DropdownMenuSeparator />
                                <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                        <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-destructive" disabled={selectedTransactions.length === 0}>
                                            Delete Selected
                                        </DropdownMenuItem>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                        <AlertDialogHeader>
                                            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                            <AlertDialogDescription>
                                                This action will permanently delete {selectedTransactions.length} selected transaction(s). This cannot be undone.
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

                        {activeSubTab === 'expenses' ? (
                            <>
                            <Button variant="outline" onClick={() => setIsConfidenceDialogOpen(true)} disabled={isAiAllocating || isLoading || transactions.length === 0}>
                                {isAiAllocating ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Sparkles className="mr-2 h-4 w-4"/>}
                                AI Allocate All
                            </Button>
                            <Button variant="outline" onClick={handleAiExpenseAllocate} disabled={isAiAllocating || selectedTransactions.length === 0}>
                                {isAiAllocating ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Sparkles className="mr-2 h-4 w-4"/>}
                                AI Allocate Selected
                            </Button>
                            </>
                        ) : (
                            <Button variant="outline" onClick={handleAiIncomeAllocate} disabled={isAiAllocating || selectedTransactions.length === 0}>
                            {isAiAllocating ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Sparkles className="mr-2 h-4 w-4"/>}
                            AI Allocate Selected
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
                                        <TableCell className="whitespace-normal break-words">{tx.description}</TableCell>
                                        <TableCell className="font-mono">{tx.reference}</TableCell>
                                        <TableCell>
                                            <Popover>
                                                <PopoverTrigger asChild>
                                                    <Button variant="outline" className="w-full justify-start text-left font-normal">
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
                                                                {customers.map(c => <CommandItem key={c.id} onSelect={() => setAllocations(prev => ({...prev, [tx.id]: { value: c.id, type: 'customer' }}))}>{c.name}</CommandItem>)}
                                                            </CommandGroup>
                                                            <CommandGroup heading="Accounts">
                                                                {client?.chartOfAccounts?.map(acc => <CommandItem key={acc.id} onSelect={() => setAllocations(prev => ({...prev, [tx.id]: { value: acc.id, type: 'account' }}))}>{acc.description}</CommandItem>)}
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
                                                    <SelectTrigger><SelectValue placeholder="Select VAT type" /></SelectTrigger>
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
             </CardFooter>
        </Card>
    )
});
NewTransactionsTab.displayName = 'NewTransactionsTab';


const ReviewedTab = React.forwardRef<
    { refetch: () => void; },
    { client: User | null; bankAccountId: string | null; customers: ClientCustomer[], onAccountCreated: () => void; }
>(({ client, bankAccountId, customers, onAccountCreated }, ref) => {
    
    const [searchTerm, setSearchTerm] = useState('');
    const [searchAmount, setSearchAmount] = useState('');
    const [searchAccount, setSearchAccount] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const { toast } = useToast();
    const [changes, setChanges] = useState<{ [txId: string]: Partial<ImportedTransaction> }>({});
    const [isDownloading, setIsDownloading] = useState(false);
    const [isCreateGeneralAccountOpen, setIsCreateGeneralAccountOpen] = useState(false);
    const [searchResults, setSearchResults] = useState<ImportedTransaction[] | null>(null);
    const [isSearching, setIsSearching] = useState(false);
    const [selectedTransactions, setSelectedTransactions] = useState<string[]>([]);
    const [searchAccountTerm, setSearchAccountTerm] = useState('');

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

        const sortableFields: SortField[] = ['date', 'description', 'amount'];
        if (sortableFields.includes(sortField)) {
            constraints.push(orderBy(sortField, sortDirection));
        }
        
        return query(collection(db, 'aiAccountantClients', client.uid, 'transactions'), ...constraints);
    }, [client?.uid, bankAccountId, sortField, sortDirection]);

    const {
        documents: paginatedDocuments,
        setDocuments: setPaginatedDocuments,
        isLoading,
        goToNextPage,
        goToPreviousPage,
        canGoNext,
        canGoPrev,
        currentPage,
        refetch
    } = usePaginatedFirestore<ImportedTransaction>({ baseQuery: reviewedTransactionsQuery, pageSize: PAGE_SIZE });

     useEffect(() => {
        const handleSearch = async () => {
            if (!searchTerm.trim() && !searchAmount.trim() && !searchAccount) {
                setSearchResults(null);
                return;
            }
            if (!client?.uid || !bankAccountId) return;
            
            setIsSearching(true);
            const searchConstraints: QueryConstraint[] = [
                where('bankAccountId', '==', bankAccountId),
                where('status', 'in', ['reviewed', 'allocated']),
            ];
             if (searchAccount) {
                searchConstraints.push(where('allocatedTo.value', '==', searchAccount));
            }

            const q = query(collection(db, 'aiAccountantClients', client.uid, 'transactions'), ...searchConstraints);

            try {
                const snapshot = await getDocs(q);
                let allDocs = snapshot.docs.map(d => ({ id: d.id, ...d.data() }) as ImportedTransaction);

                if (searchTerm.trim()) {
                    allDocs = allDocs.filter(tx => tx.description.toLowerCase().includes(searchTerm.toLowerCase()));
                }
                if (searchAmount.trim()) {
                    const amountValue = parseFloat(searchAmount);
                    if (!isNaN(amountValue)) {
                        allDocs = allDocs.filter(tx => Math.abs(tx.amount - amountValue) < 0.01);
                    }
                }
                
                setSearchResults(allDocs);
            } catch (error) {
                console.error("Error during search:", error);
                toast({ title: "Search Error", variant: "destructive" });
            } finally {
                setIsSearching(false);
            }
        };

        const debounce = setTimeout(() => {
            handleSearch();
        }, 500);

        return () => clearTimeout(debounce);
    }, [searchTerm, searchAmount, searchAccount, client, bankAccountId, toast]);
    
    React.useImperativeHandle(ref, () => ({
        refetch,
    }));
    
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
                    const docRef = doc(db, 'aiAccountantClients', client!.uid, 'transactions', txId);
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

    const handleBulkReallocate = async (allocation: { value: string, type: 'account' | 'customer' | 'supplier' }, vatType: VatType) => {
        if (!client || !client.uid || selectedTransactions.length === 0) return;
        toast({ title: "Reallocating...", description: `Reallocating ${selectedTransactions.length} transactions.` });

        const newChanges: { [key: string]: Partial<ImportedTransaction> } = {};
        selectedTransactions.forEach(txId => {
            newChanges[txId] = {
                allocatedTo: allocation,
                vatType: client.isVatRegistered ? vatType : 'no_vat',
            };
        });

        await handleSaveChanges(newChanges, selectedTransactions);
        setSelectedTransactions([]);
    };


    const handleSaveChanges = async (changesToSave: typeof changes, transactionIds: string[]) => {
        if (!client || transactionIds.length === 0) return;
        setIsSaving(true);
        toast({ title: 'Saving changes...', description: 'Please wait.' });

        try {
            for (let i = 0; i < transactionIds.length; i += BATCH_SIZE) {
                const batch = writeBatch(db);
                const chunkIds = transactionIds.slice(i, i + BATCH_SIZE);
    
                chunkIds.forEach(txId => {
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
            }
    
            toast({ title: 'Success!', description: 'Your changes have been saved.' });
            
            const updateLocalState = (docs: ImportedTransaction[]) => 
                docs.map(tx => {
                    const change = changesToSave[tx.id];
                    return change ? { ...tx, ...change } : tx;
                });

            if (searchResults !== null) {
                setSearchResults(prev => updateLocalState(prev || []));
            } else {
                setPaginatedDocuments(prevDocs => updateLocalState(prevDocs));
            }

            setChanges({});
            setSelectedTransactions([]);
            // Do not refetch immediately to allow user to see optimistic update
    
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
    
    const documents = useMemo(() => {
        let docs = searchResults !== null ? searchResults : paginatedDocuments;

        if (!sortField) return docs;
        
        return [...docs].sort((a, b) => {
            let aVal: any;
            let bVal: any;
            
            switch (sortField) {
                case 'allocatedTo':
                    aVal = getAllocationDescription(a);
                    bVal = getAllocationDescription(b);
                    break;
                case 'vatType':
                    aVal = a.vatType || '';
                    bVal = b.vatType || '';
                    break;
                default:
                    aVal = a[sortField];
                    bVal = b[sortField];
            }

            if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
            if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
            return 0;
        });

    }, [searchResults, paginatedDocuments, sortField, sortDirection]);

    return (
        <Card>
             <CreateGeneralAccountDialog 
                client={client}
                onAccountCreated={onAccountCreated}
                open={isCreateGeneralAccountOpen}
                onOpenChange={setIsCreateGeneralAccountOpen}
             />
            <CardHeader className="p-4 border-b">
                 <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2">
                         <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" disabled={selectedTransactions.length === 0}>
                                    Actions <MoreHorizontal className="ml-2 h-4 w-4"/>
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent>
                                <DropdownMenuSub>
                                    <DropdownMenuSubTrigger>Reallocate Selected</DropdownMenuSubTrigger>
                                    <DropdownMenuSubContent className="p-0">
                                         <Command>
                                            <CommandInput placeholder="Search..." value={searchAccountTerm} onValueChange={setSearchAccountTerm} />
                                            <CommandList>
                                                <ScrollArea className="h-72">
                                                <CommandEmpty>No results found.</CommandEmpty>
                                                <CommandGroup heading="Customers">
                                                    {customers.filter(c => c.name.toLowerCase().includes(searchAccountTerm.toLowerCase())).map(c => (
                                                        <DropdownMenuItem key={c.id} onSelect={() => handleBulkReallocate({value: c.id, type: 'customer'}, 'no_vat')}>
                                                            {c.name}
                                                        </DropdownMenuItem>
                                                    ))}
                                                </CommandGroup>
                                                 <CommandGroup heading="Accounts">
                                                    {uniqueChartOfAccounts.filter(acc => acc.description.toLowerCase().includes(searchAccountTerm.toLowerCase())).map(acc => (
                                                        <DropdownMenuSub key={acc.id}>
                                                            <DropdownMenuSubTrigger>{acc.description}</DropdownMenuSubTrigger>
                                                            <DropdownMenuSubContent>
                                                                {client?.isVatRegistered ? allVatTypes.map(vat => (
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
                                                </CommandGroup>
                                                </ScrollArea>
                                            </CommandList>
                                        </Command>
                                    </DropdownMenuSubContent>
                                </DropdownMenuSub>
                                <DropdownMenuSeparator />
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
                         <Button variant="outline" onClick={handleDownloadExcel} disabled={isDownloading}>
                            {isDownloading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                            Download Excel
                        </Button>
                    </div>
                     <div className="flex items-center gap-2">
                        <div className="relative">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                type="search"
                                placeholder="Search descriptions..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-8 w-48"
                            />
                        </div>
                         <div className="relative">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                type="number"
                                placeholder="Search amount..."
                                value={searchAmount}
                                onChange={(e) => setSearchAmount(e.target.value)}
                                className="pl-8 w-32"
                            />
                        </div>
                        <Select value={searchAccount} onValueChange={setSearchAccount}>
                            <SelectTrigger className="w-[200px]">
                                <SelectValue placeholder="Filter by account..." />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Accounts</SelectItem>
                                <SelectGroup>
                                    <Label>Accounts</Label>
                                    {uniqueChartOfAccounts.map(acc => (
                                        <SelectItem key={acc.id} value={acc.id}>{acc.description}</SelectItem>
                                    ))}
                                </SelectGroup>
                                <SelectGroup>
                                    <Label>Customers</Label>
                                    {customers.map(c => (
                                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                                    ))}
                                </SelectGroup>
                            </SelectContent>
                        </Select>
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
                                        checked={documents.length > 0 && selectedTransactions.length === documents.length}
                                        onCheckedChange={(checked) => {
                                            setSelectedTransactions(checked ? documents.map(tx => tx.id) : []);
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
                            ) : documents.length === 0 ? (
                                <TableRow><TableCell colSpan={6} className="text-center h-24 text-muted-foreground">No reviewed transactions found.</TableCell></TableRow>
                            ) : (
                                documents.map(tx => (
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
                 <Button onClick={() => handleSaveChanges(changes, Object.keys(changes))} disabled={isSaving || Object.keys(changes).length === 0}>
                    {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Save Changes
                </Button>
                {(!searchTerm && !searchAmount) && (
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
    const [isInconsistentGroups, setIsInconsistentGroups] = useState<any[]>([]);
    const [isConsistencyCheckOpen, setIsConsistencyCheckOpen] = useState(false);
    
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

        if(constraints.some(c => c.type === 'where' && (c as any)._op === '<')) {
            constraints.push(orderBy('amount', sortDirection === 'asc' ? 'desc' : 'asc'));
        } else {
             constraints.push(orderBy(sortField, sortDirection));
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
      if (!searchTerm) return documents;
      return documents.filter(tx => tx.description.toLowerCase().includes(searchTerm.toLowerCase()));
    }, [documents, searchTerm]);
    
    React.useImperativeHandle(ref, () => ({
        refetch,
    }));
    
    useEffect(() => {
        refetch();
    }, [activeSubTab, refetch]);
    
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
    
    const handleConsistencyCheck = () => {
        if (!client) return;
        
        const normalizeDescription = (desc: string) => {
            return desc.toLowerCase().replace(/[^a-z\s]/g, '').replace(/\s+/g, ' ').trim();
        };

        const groups: { [key: string]: ImportedTransaction[] } = {};
        documents.forEach(tx => {
            const key = normalizeDescription(tx.description);
            if (!groups[key]) {
                groups[key] = [];
            }
            groups[key].push(tx);
        });

        const inconsistencies: any[] = [];
        for (const key in groups) {
            const group = groups[key];
            if (group.length > 1) {
                const firstAllocation = group[0].allocatedTo?.value;
                const firstVatType = group[0].vatType;
                
                const isConsistent = group.every(tx => 
                    tx.allocatedTo?.value === firstAllocation && tx.vatType === firstVatType
                );
                
                if (!isConsistent) {
                    const uniqueAllocations = [...new Set(group.map(tx => `${client.chartOfAccounts?.find(a => a.id === tx.allocatedTo?.value)?.description} (${tx.vatType})`))];
                    inconsistencies.push({
                        description: group[0].description, // Show original description
                        count: group.length,
                        allocations: uniqueAllocations,
                    });
                }
            }
        }
        
        setIsInconsistentGroups(inconsistencies);
        setIsConsistencyCheckOpen(true);
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
                XLSX.utils.book_append_sheet(wb, wb.SheetNames.length > 0 ? expensesSheet : wb.Sheets[0], "Expenses For Review");
            }
            if (incomeData.length > 0) {
                const incomeSheet = XLSX.utils.json_to_sheet(incomeData);
                XLSX.utils.book_append_sheet(wb, wb.SheetNames.length > 0 ? incomeSheet : wb.Sheets[0], "Income For Review");
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
            <Dialog open={isConsistencyCheckOpen} onOpenChange={setIsConsistencyCheckOpen}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Allocation Consistency Review</DialogTitle>
                        <DialogDescription>
                            The following groups of similar transactions have inconsistent allocations. Please review and correct them in the "Reviewed" tab before approving.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="max-h-[60vh] overflow-y-auto mt-4 space-y-4">
                        {isInconsistentGroups.length === 0 ? (
                            <div className="text-center py-8 text-muted-foreground">
                                <CheckCheck className="h-8 w-8 mx-auto mb-2 text-green-500"/>
                                <p>No inconsistencies found!</p>
                            </div>
                        ) : (
                            isInconsistentGroups.map((group, index) => (
                                <Alert key={index} variant="destructive">
                                    <AlertTitle>Inconsistent Group: "{group.description}" ({group.count} transactions)</AlertTitle>
                                    <AlertDescription>
                                        <ul className="list-disc pl-5 mt-2">
                                            {group.allocations.map((alloc: string, i: number) => <li key={i}>{alloc}</li>)}
                                        </ul>
                                    </AlertDescription>
                                </Alert>
                            ))
                        )}
                    </div>
                    <DialogFooter>
                        <Button onClick={() => setIsConsistencyCheckOpen(false)}>Close</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
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
                        <Button variant="secondary" onClick={handleConsistencyCheck} disabled={isLoading || transactions.length === 0}>
                            <CheckCheck className="mr-2 h-4 w-4" />Review Consistency
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
            </CardContent>
            <CardFooter className="flex items-center justify-center p-4">
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
    const [activeTab, setActiveTab] = useState<'new' | 'review' | 'reviewed'>('new');
    const [isCreateAccountOpen, setIsCreateAccountOpen] = useState(false);
    const [isEditAccountOpen, setIsEditAccountOpen] = useState(false);
    const newTransactionsTabRef = useRef<{ refetch: () => void }>(null);
    const forReviewTabRef = useRef<{ refetch: () => void }>(null);
    const reviewedTabRef = useRef<{ refetch: () => void; }>(null);
    const [allTransactions, setAllTransactions] = useState<(ImportedTransaction | AllocatedTransaction)[]>([]);
    const [globalRules, setGlobalRules] = useState<AllocationRule[]>([]);
    
    const fetchClientAndRelatedData = useCallback(async () => {
        if (!clientId) return;
        setIsLoading(true);
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
                
                const accountIdFromQuery = searchParams.get('accountId');

                if (accountIdFromQuery && cashbookAccounts.some(acc => acc.id === accountIdFromQuery)) {
                    setSelectedAccountId(accountIdFromQuery);
                } else if (cashbookAccounts.length > 0 && !selectedAccountId) {
                    setSelectedAccountId(cashbookAccounts[0].id);
                } else if (cashbookAccounts.length === 0) {
                    setSelectedAccountId(null);
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
    }, [clientId, toast, searchParams]);


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
    }, [allTransactions, selectedAccount]);
    
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
                    {client && selectedAccountId && <UploadStatementDialog client={client} bankAccountId={selectedAccountId} existingTransactions={currentAccountTransactions} onImportComplete={handleImportComplete} globalRules={globalRules} currentBalance={selectedAccountBalance} />}
                    {client && selectedAccountId && <ImportDialog client={client} bankAccountId={selectedAccountId} currentBalance={selectedAccountBalance} onImportComplete={handleImportComplete} globalRules={globalRules} />}
                </div>
            </div>

            <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as any)}>
                <TabsList>
                    <TabsTrigger value="new">New Transactions</TabsTrigger>
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
    
    

    




    











    
