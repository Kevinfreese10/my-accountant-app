
'use client';

import * as React from "react"
import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Download, Eye, Calculator, Save, Trash2, FolderOpen } from "lucide-react";
import { useParams, useRouter } from 'next/navigation';
import { getFirestore, doc, getDoc, collection, onSnapshot, query, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { User, AllocatedTransaction, ImportedTransaction, ChartOfAccount, SavedReport } from '@/lib/types';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter,
} from "@/components/ui/table";
import { format, startOfDay, endOfDay, parseISO } from 'date-fns';
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { DateRange } from "react-day-picker";
import * as XLSX from 'xlsx';
import Link from "next/link";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { nanoid } from 'nanoid';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";


const db = getFirestore(firebaseApp);

const formatPrice = (price: number) => {
    if (price === 0) return 'R 0.00';
    return new Intl.NumberFormat('en-ZA', {
      style: 'currency',
      currency: 'ZAR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(price);
};

function getFinancialYearStart(date: Date, endMonthName?: string) {
    const endMonth = endMonthName ? new Date(`${endMonthName} 1, 2000`).getMonth() : 1; // Default to Feb if not provided
    const currentMonth = date.getMonth();
    let year = date.getFullYear();

    if (currentMonth > endMonth) {
        return new Date(year, endMonth + 1, 1);
    } else {
        return new Date(year - 1, endMonth + 1, 1);
    }
}

function calculateBalances(client: User, transactions: (ImportedTransaction | AllocatedTransaction)[], dateRange?: DateRange) {
    const balances = new Map<string, number>();
    client.chartOfAccounts?.forEach(acc => balances.set(acc.id, 0));

    const reportStartDate = dateRange?.from ? startOfDay(dateRange.from) : getFinancialYearStart(new Date(), client.yearEnd);
    const reportEndDate = dateRange?.to ? endOfDay(dateRange.to) : new Date();
    
    const retainedIncomeAccount = client.chartOfAccounts?.find(acc => acc.accountNumber === '9000-004');
    const vatControlAccount = client.chartOfAccounts?.find(acc => acc.accountNumber === '7000-008');
    
    let priorPeriodNetIncome = 0;

    transactions.forEach(tx => {
        const txDate = new Date(tx.date);
        const isPriorPeriod = txDate < reportStartDate;

        const processEntry = (accountId: string, amount: number) => {
            const account = client.chartOfAccounts?.find(a => a.id === accountId);
            if (!account) return;

            if (isPriorPeriod) {
                if (account.section === 'Income Statement') {
                    priorPeriodNetIncome -= amount; // Income is credit (negative), expenses are debit (positive)
                } else { // Balance Sheet accounts
                    balances.set(accountId, (balances.get(accountId) || 0) + amount);
                }
            } else if (txDate <= reportEndDate) {
                // For the current period, we affect ALL accounts directly
                balances.set(accountId, (balances.get(accountId) || 0) + amount);
            }
        };
        
        if (tx.bankAccountId === 'JOURNAL') {
            if (tx.allocatedTo?.value) {
                processEntry(tx.allocatedTo.value, tx.amount);
            }
        } 
        else { // Bank Transactions
            const inclusiveAmount = tx.amount;
            const isStandardVat = client.isVatRegistered && (tx.vatType === 'standard_rated_purchases' || tx.vatType === 'standard_rated_sales');
            
            let vatAmount = 0;
            let exclusiveAmount = inclusiveAmount;
            
            if (isStandardVat) {
                vatAmount = (inclusiveAmount / 1.15) * 0.15;
                exclusiveAmount = inclusiveAmount - vatAmount;
            }

            // 1. Bank Account Entry (always inclusive)
            processEntry(tx.bankAccountId, inclusiveAmount);

            // 2. Contra Account Entry (exclusive amount)
            const contraAccountId = tx.status === 'allocated' && tx.allocatedTo 
                ? tx.allocatedTo.value 
                : '9500-001'; // Suspense Account
            
            processEntry(contraAccountId, -exclusiveAmount);

            // 3. VAT Control Account Entry
            if (isStandardVat && vatControlAccount) {
                processEntry(vatControlAccount.id, -vatAmount);
            }
        }
    });
    
    if (retainedIncomeAccount) {
        balances.set(retainedIncomeAccount.id, (balances.get(retainedIncomeAccount.id) || 0) + priorPeriodNetIncome);
    }
    
    return balances;
}

function TrialBalanceReport({ client, transactions, dateRange, comparativeDateRange }: { client: User, transactions: (ImportedTransaction | AllocatedTransaction)[], dateRange?: DateRange, comparativeDateRange?: DateRange }) {
    
    const primaryBalances = useMemo(() => calculateBalances(client, transactions, dateRange), [client, transactions, dateRange]);
    const showComparison = !!comparativeDateRange;
    const comparativeBalances = useMemo(() => {
        return showComparison ? calculateBalances(client, transactions, comparativeDateRange) : new Map<string, number>();
    }, [client, transactions, comparativeDateRange, showComparison]);
    
    const trialBalanceData = useMemo(() => {
        return client.chartOfAccounts
          ?.map(account => ({
              ...account,
              balance: primaryBalances.get(account.id) || 0,
              comparativeBalance: showComparison ? (comparativeBalances.get(account.id) || 0) : 0,
          }))
          .filter(account => Math.abs(account.balance) >= 0.01 || (showComparison && Math.abs(account.comparativeBalance) >= 0.01))
          .sort((a, b) => a.accountNumber.localeCompare(b.accountNumber));
    }, [client.chartOfAccounts, primaryBalances, comparativeBalances, showComparison]);

    const totals = useMemo(() => {
        let primaryDebit = 0, primaryCredit = 0, compDebit = 0, compCredit = 0;
        trialBalanceData?.forEach(item => {
            if (item.balance > 0) primaryDebit += item.balance;
            else primaryCredit += -item.balance;
            if (showComparison) {
                if (item.comparativeBalance > 0) compDebit += item.comparativeBalance;
                else compCredit += -item.comparativeBalance;
            }
        });
        return { primaryDebit, primaryCredit, compDebit, compCredit };
    }, [trialBalanceData, showComparison]);

    const handleDownloadExcel = () => {
        const dataToExport = trialBalanceData?.map(item => {
            const row: any = {
                'Account Number': item.accountNumber,
                'Account Description': item.description,
                'Debit': item.balance > 0 ? item.balance : 0,
                'Credit': item.balance < 0 ? -item.balance : 0,
            };
            if (showComparison) {
                row['Comp. Debit'] = item.comparativeBalance > 0 ? item.comparativeBalance : 0;
                row['Comp. Credit'] = item.comparativeBalance < 0 ? -item.comparativeBalance : 0;
            }
            return row;
        });

        if (!dataToExport) return;
        
        const totalsRow: any = {
            'Account Number': 'Totals',
            'Account Description': '',
            'Debit': totals.primaryDebit,
            'Credit': totals.primaryCredit,
        };
         if (showComparison) {
            totalsRow['Comp. Debit'] = totals.compDebit;
            totalsRow['Comp. Credit'] = totals.compCredit;
        }
        dataToExport.push(totalsRow);

        const worksheet = XLSX.utils.json_to_sheet(dataToExport);
        worksheet['!cols'] = [
            { wch: 15 }, { wch: 40 }, { wch: 15 }, { wch: 15 },
            ...(showComparison ? [{ wch: 15 }, { wch: 15 }] : [])
        ];
        
        Object.keys(worksheet).forEach(key => {
             const columns = showComparison ? /[C-F]\d+/ : /[C-D]\d+/;
             if (columns.test(key)) {
                const cell = worksheet[key];
                if (cell.v !== null && typeof cell.v === 'number') {
                    cell.t = 'n';
                    cell.z = 'R #,##0.00';
                }
            }
        });

        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Trial Balance");

        const today = new Date().toISOString().split('T')[0];
        const fileName = `${client.companyName || client.name}-Trial-Balance-${today}.xlsx`;
        XLSX.writeFile(workbook, fileName);
    };
    
    return (
        <>
            <div className="max-h-[70vh] overflow-y-auto">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-[350px]">Account</TableHead>
                            <TableHead className="text-right">Debit</TableHead>
                            <TableHead className="text-right">Credit</TableHead>
                            {showComparison && (
                                <>
                                <TableHead className="text-right">Comp. Debit</TableHead>
                                <TableHead className="text-right">Comp. Credit</TableHead>
                                </>
                            )}
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {trialBalanceData?.map(item => {
                            const debitAmount = item.balance > 0 ? item.balance : 0;
                            const creditAmount = item.balance < 0 ? -item.balance : 0;
                            const compDebitAmount = item.comparativeBalance > 0 ? item.comparativeBalance : 0;
                            const compCreditAmount = item.comparativeBalance < 0 ? -item.comparativeBalance : 0;
                            
                            return (
                                <TableRow key={item.id}>
                                    <TableCell>
                                        <p className="font-medium">{item.accountNumber}</p>
                                        <p className="text-xs text-muted-foreground">{item.description}</p>
                                    </TableCell>
                                    <TableCell className="text-right font-mono">
                                        <Link href={`/admin/ai-accountant/${client.id}/reports/general-ledger?accountId=${item.id}`} className="hover:underline text-blue-600">
                                            {formatPrice(debitAmount)}
                                        </Link>
                                    </TableCell>
                                    <TableCell className="text-right font-mono">
                                         <Link href={`/admin/ai-accountant/${client.id}/reports/general-ledger?accountId=${item.id}`} className="hover:underline text-blue-600">
                                            {formatPrice(creditAmount)}
                                        </Link>
                                    </TableCell>
                                    {showComparison && (
                                        <>
                                        <TableCell className="text-right font-mono bg-muted/50">{formatPrice(compDebitAmount)}</TableCell>
                                        <TableCell className="text-right font-mono bg-muted/50">{formatPrice(compCreditAmount)}</TableCell>
                                        </>
                                    )}
                                </TableRow>
                            )
                        })}
                    </TableBody>
                    <TableFooter>
                        <TableRow>
                            <TableCell className="font-bold">Totals</TableCell>
                            <TableCell className="text-right font-bold font-mono">{formatPrice(totals.primaryDebit)}</TableCell>
                            <TableCell className="text-right font-bold font-mono">{formatPrice(totals.primaryCredit)}</TableCell>
                             {showComparison && (
                                <>
                                <TableCell className="text-right font-bold font-mono bg-muted/50">{formatPrice(totals.compDebit)}</TableCell>
                                <TableCell className="text-right font-bold font-mono bg-muted/50">{formatPrice(totals.compCredit)}</TableCell>
                                </>
                            )}
                        </TableRow>
                    </TableFooter>
                </Table>
            </div>
            <DialogFooter className="mt-4">
                <Button variant="outline" onClick={handleDownloadExcel}>
                    <Download className="mr-2 h-4 w-4" />
                    Download Excel
                </Button>
            </DialogFooter>
        </>
    );
}

export default function TrialBalancePage() {
    const params = useParams();
    const router = useRouter();
    const clientId = params.clientId as string;

    const [client, setClient] = useState<User | null>(null);
    const [transactions, setTransactions] = useState<(ImportedTransaction | AllocatedTransaction)[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [dateRange, setDateRange] = React.useState<DateRange | undefined>(undefined);
    const [comparativeDateRange, setComparativeDateRange] = React.useState<DateRange | undefined>(undefined);
    const [showComparison, setShowComparison] = useState(false);
    const { toast } = useToast();
    const [isSavingReport, setIsSavingReport] = useState(false);
    const [reportName, setReportName] = useState('');
    const [isSaveDialogOpen, setIsSaveDialogOpen] = useState(false);
    
    useEffect(() => {
        if (!clientId) return;

        const fetchClientData = async () => {
             const docRef = doc(db, 'aiAccountantClients', clientId);
             const docSnap = await getDoc(docRef);
             if (docSnap.exists()) {
                setClient({ id: docSnap.id, ...docSnap.data() } as User);
             }
             setIsLoading(false);
        };
        fetchClientData();

        const unsubscribe = onSnapshot(query(collection(db, 'aiAccountantClients', clientId, 'transactions')), 
            (snapshot) => {
                const fetchedTransactions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as (ImportedTransaction | AllocatedTransaction)));
                setTransactions(fetchedTransactions);
                if (isLoading) setIsLoading(false);
            },
            (error) => {
                console.error("Error fetching transactions:", error);
                if (isLoading) setIsLoading(false);
            }
        );
        
        return () => unsubscribe();
    }, [clientId, isLoading]);
    
    const handleSaveReport = async () => {
        if (!client || !reportName.trim()) {
            toast({ title: 'Error', description: 'Please enter a name for the report.', variant: 'destructive'});
            return;
        }
        setIsSavingReport(true);
        
        const newReport: SavedReport = {
            id: nanoid(),
            name: reportName,
            dateRange: dateRange?.from && dateRange.to ? { from: dateRange.from.toISOString(), to: dateRange.to.toISOString() } : undefined,
            comparativeDateRange: showComparison && comparativeDateRange?.from && comparativeDateRange.to ? { from: comparativeDateRange.from.toISOString(), to: comparativeDateRange.to.toISOString() } : undefined,
        };

        try {
            const clientRef = doc(db, 'aiAccountantClients', client.id);
            await updateDoc(clientRef, {
                savedReports: arrayUnion(newReport)
            });
            
            // Optimistically update local state
            setClient(prev => prev ? { ...prev, savedReports: [...(prev.savedReports || []), newReport] } : null);

            toast({ title: 'Report Saved!', description: `"${reportName}" has been saved.`});
            setReportName('');
            setIsSaveDialogOpen(false);
        } catch(e) {
            console.error(e);
            toast({ title: 'Error', description: 'Could not save the report.', variant: 'destructive'});
        } finally {
            setIsSavingReport(false);
        }
    };
    
    const handleLoadReport = (reportId: string) => {
        const report = client?.savedReports?.find(r => r.id === reportId);
        if (report) {
            setDateRange(report.dateRange ? { from: parseISO(report.dateRange.from), to: parseISO(report.dateRange.to) } : undefined);
            if (report.comparativeDateRange) {
                setShowComparison(true);
                setComparativeDateRange({ from: parseISO(report.comparativeDateRange.from), to: parseISO(report.comparativeDateRange.to) });
            } else {
                setShowComparison(false);
                setComparativeDateRange(undefined);
            }
            toast({ title: 'Report Loaded', description: `Loaded settings for "${report.name}".`});
        }
    };
    
    const handleDeleteReport = async (reportId: string) => {
        if (!client) return;
        const reportToDelete = client.savedReports?.find(r => r.id === reportId);
        if (!reportToDelete) return;
        
        try {
            const clientRef = doc(db, 'aiAccountantClients', client.id);
            await updateDoc(clientRef, {
                savedReports: arrayRemove(reportToDelete)
            });
            setClient(prev => prev ? { ...prev, savedReports: prev.savedReports?.filter(r => r.id !== reportId) } : null);
            toast({ title: 'Report Deleted', variant: 'destructive'});
        } catch(e) {
            toast({ title: 'Error', description: 'Could not delete report.', variant: 'destructive'});
        }
    };

    const getReportDateString = () => {
        if (!dateRange || (!dateRange.from && !dateRange.to)) {
            return `as at ${format(new Date(), "dd MMMM yyyy")}`;
        }
        if (dateRange.from && dateRange.to) {
            return `for the period ${format(dateRange.from, "dd MMMM yyyy")} to ${format(dateRange.to, "dd MMMM yyyy")}`;
        }
        if (dateRange.from) {
            return `from ${format(dateRange.from, "dd MMMM yyyy")}`;
        }
        if (dateRange.to) {
            return `up to ${format(dateRange.to, "dd MMMM yyyy")}`;
        }
        return `as at ${format(new Date(), "dd MMMM yyyy")}`;
    }

    const getComparativeDateString = () => {
        if (!showComparison || !comparativeDateRange || (!comparativeDateRange.from && !comparativeDateRange.to)) {
            return `no comparison period`;
        }
        if (comparativeDateRange.from && comparativeDateRange.to) {
            return `vs ${format(comparativeDateRange.from, "dd MMM yy")} to ${format(comparativeDateRange.to, "dd MMM yy")}`;
        }
        return `vs selected period`;
    }

    return (
        <div>
            <Card>
                <CardHeader>
                    <CardTitle>Trial Balance Report</CardTitle>
                    <CardDescription>
                        Generate a trial balance for a specific period and compare it against another.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                     <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-8 gap-y-4">
                         <div className="space-y-2">
                            <Label className="font-semibold">Primary Period</Label>
                            <DateRangePicker onDateChange={setDateRange} financialYearEnd={client?.yearEnd} />
                         </div>
                         <div className="space-y-2">
                            <div className="flex items-center space-x-2">
                                <Switch id="show-comparison" checked={showComparison} onCheckedChange={setShowComparison}/>
                                <Label htmlFor="show-comparison" className="font-semibold">Comparison Period</Label>
                            </div>
                            {showComparison && (
                                <DateRangePicker onDateChange={setComparativeDateRange} financialYearEnd={client?.yearEnd} />
                            )}
                         </div>
                     </div>
                     <Separator />
                    <div className="flex flex-col sm:flex-row gap-2">
                        {isLoading ? (
                            <Loader2 className="animate-spin" />
                        ) : client ? (
                            <Dialog>
                                <DialogTrigger asChild>
                                    <Button>View Report</Button>
                                </DialogTrigger>
                                 <DialogContent className="sm:max-w-4xl">
                                    <DialogHeader className="text-center mb-4">
                                        <DialogTitle className="text-lg">{client.companyName || client.name}</DialogTitle>
                                        <DialogDescription>
                                            Trial Balance {getReportDateString()} <br/> <span className="font-semibold">{getComparativeDateString()}</span>
                                        </DialogDescription>
                                    </DialogHeader>
                                    <TrialBalanceReport 
                                        client={client} 
                                        transactions={transactions} 
                                        dateRange={dateRange} 
                                        comparativeDateRange={showComparison ? comparativeDateRange : undefined}
                                    />
                                </DialogContent>
                            </Dialog>
                        ) : (
                            <p>Client data could not be loaded.</p>
                        )}
                         <Dialog open={isSaveDialogOpen} onOpenChange={setIsSaveDialogOpen}>
                            <DialogTrigger asChild>
                                <Button variant="outline"><Save className="mr-2 h-4 w-4"/>Save Report</Button>
                            </DialogTrigger>
                            <DialogContent>
                                <DialogHeader>
                                    <DialogTitle>Save Report Configuration</DialogTitle>
                                </DialogHeader>
                                <div className="space-y-2 py-4">
                                    <Label htmlFor="report-name">Report Name</Label>
                                    <Input id="report-name" value={reportName} onChange={(e) => setReportName(e.target.value)} placeholder="e.g., Q1 2024 vs Q1 2023"/>
                                </div>
                                <DialogFooter>
                                    <Button variant="ghost" onClick={() => setIsSaveDialogOpen(false)}>Cancel</Button>
                                    <Button onClick={handleSaveReport} disabled={isSavingReport}>
                                        {isSavingReport && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                                        Save
                                    </Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>
                         <Select onValueChange={handleLoadReport}>
                            <SelectTrigger className="w-full sm:w-[200px]">
                                <SelectValue placeholder="Load a saved report..." />
                            </SelectTrigger>
                            <SelectContent>
                                <p className="text-xs font-semibold px-2 py-1.5 text-muted-foreground">My Reports</p>
                                {client?.savedReports && client.savedReports.length > 0 ? (
                                    client.savedReports.map(report => (
                                        <SelectItem key={report.id} value={report.id}>{report.name}</SelectItem>
                                    ))
                                ) : (
                                    <p className="text-xs text-center text-muted-foreground p-2">No saved reports yet.</p>
                                )}
                            </SelectContent>
                        </Select>
                         <Dialog>
                            <DialogTrigger asChild>
                                <Button variant="outline"><FolderOpen className="mr-2 h-4 w-4"/>Manage Reports</Button>
                            </DialogTrigger>
                            <DialogContent>
                                <DialogHeader>
                                    <DialogTitle>Manage Saved Reports</DialogTitle>
                                </DialogHeader>
                                <div className="py-4 space-y-2">
                                {client?.savedReports && client.savedReports.length > 0 ? (
                                    client.savedReports.map(report => (
                                        <div key={report.id} className="flex justify-between items-center bg-muted p-2 rounded-md">
                                            <p className="text-sm font-medium">{report.name}</p>
                                            <AlertDialog>
                                                <AlertDialogTrigger asChild>
                                                     <Button variant="destructive" size="icon" className="h-7 w-7"><Trash2 className="h-4 w-4"/></Button>
                                                </AlertDialogTrigger>
                                                 <AlertDialogContent>
                                                    <AlertDialogHeader>
                                                        <AlertDialogTitle>Delete "{report.name}"?</AlertDialogTitle>
                                                        <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
                                                    </AlertDialogHeader>
                                                    <AlertDialogFooter>
                                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                        <AlertDialogAction onClick={() => handleDeleteReport(report.id)}>Delete</AlertDialogAction>
                                                    </AlertDialogFooter>
                                                </AlertDialogContent>
                                            </AlertDialog>
                                        </div>
                                    ))
                                ) : (
                                     <p className="text-center text-muted-foreground py-8">No saved reports to manage.</p>
                                )}
                                </div>
                            </DialogContent>
                        </Dialog>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
