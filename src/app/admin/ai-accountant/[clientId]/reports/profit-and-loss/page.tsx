
'use client';

import * as React from "react"
import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Download, Eye, Calculator } from "lucide-react";
import { useParams, useRouter } from 'next/navigation';
import { getFirestore, doc, getDoc, collection, onSnapshot, query, writeBatch, Timestamp } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { User, AllocatedTransaction, ImportedTransaction, ChartOfAccount } from '@/lib/types';
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
import { format, startOfDay, endOfDay } from 'date-fns';
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { DateRange } from "react-day-picker";
import * as XLSX from 'xlsx';
import Link from "next/link";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";

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


function ProfitAndLossReport({ client, transactions, dateRange, onPostJournal }: { client: User, transactions: (ImportedTransaction | AllocatedTransaction)[], dateRange?: DateRange, onPostJournal: (taxAmount: number) => void }) {
    
    const [isTaxDialogOpen, setIsTaxDialogOpen] = useState(false);
    
    const reportData = useMemo(() => {
        const balances = new Map<string, number>();
        client.chartOfAccounts?.forEach(acc => {
            if (acc.section === 'Income Statement') {
                balances.set(acc.id, 0);
            }
        });
        
        const reportStartDate = dateRange?.from ? startOfDay(dateRange.from) : getFinancialYearStart(new Date(), client.yearEnd);
        const reportEndDate = dateRange?.to ? endOfDay(dateRange.to) : new Date();

        const vatControlAccount = client.chartOfAccounts?.find(acc => acc.accountNumber === '7000-008');

        transactions.forEach(tx => {
            const txDate = new Date(tx.date);
            if (txDate < reportStartDate || txDate > reportEndDate) {
                return;
            }

            const processEntry = (accountId: string, amount: number) => {
                const account = client.chartOfAccounts?.find(a => a.id === accountId);
                if (account && account.section === 'Income Statement' && balances.has(accountId)) {
                    balances.set(accountId, (balances.get(accountId) || 0) + amount);
                }
            };
            
            if (tx.bankAccountId === 'JOURNAL') {
                if (tx.allocatedTo?.value) {
                    processEntry(tx.allocatedTo.value, tx.amount);
                }
            } else { // Bank Transactions
                const inclusiveAmount = tx.amount;
                const isStandardVat = tx.vatType === 'standard_rated_purchases' || tx.vatType === 'standard_rated_sales';
                
                let vatAmount = 0;
                let exclusiveAmount = inclusiveAmount;
                
                if (isStandardVat) {
                    vatAmount = (inclusiveAmount / 1.15) * 0.15;
                    exclusiveAmount = inclusiveAmount - vatAmount;
                }

                // We only care about the contra entry for P&L
                const contraAccountId = tx.status === 'allocated' && tx.allocatedTo 
                    ? tx.allocatedTo.value 
                    : '9500-001'; // Suspense Account
                
                processEntry(contraAccountId, -exclusiveAmount);
            }
        });

        const incomeAccounts = client.chartOfAccounts?.filter(acc => acc.accountNumber.startsWith('1000-')).sort((a,b) => a.accountNumber.localeCompare(b.accountNumber)) || [];
        const cosAccounts = client.chartOfAccounts?.filter(acc => acc.accountNumber.startsWith('2000-')).sort((a,b) => a.accountNumber.localeCompare(b.accountNumber)) || [];
        const expenseAccounts = client.chartOfAccounts?.filter(acc => acc.accountNumber.startsWith('3000-') || acc.accountNumber.startsWith('4000-')).sort((a,b) => a.accountNumber.localeCompare(b.accountNumber)) || [];

        const income = incomeAccounts.map(acc => ({ ...acc, balance: balances.get(acc.id) || 0 })).filter(a => a.balance !== 0);
        const costOfSales = cosAccounts.map(acc => ({ ...acc, balance: balances.get(acc.id) || 0 })).filter(a => a.balance !== 0);
        const expenses = expenseAccounts.map(acc => ({ ...acc, balance: balances.get(acc.id) || 0 })).filter(a => a.balance !== 0);

        const totalIncome = income.reduce((sum, acc) => sum - acc.balance, 0); // Income is credit, so balance is negative
        const totalCostOfSales = costOfSales.reduce((sum, acc) => sum + acc.balance, 0);
        const grossProfit = totalIncome - totalCostOfSales;
        const totalExpenses = expenses.reduce((sum, acc) => sum + acc.balance, 0);
        const netProfit = grossProfit - totalExpenses;

        return { income, costOfSales, expenses, totalIncome, totalCostOfSales, grossProfit, totalExpenses, netProfit };

    }, [client, dateRange, transactions]);
    
    const taxCalculation = useMemo(() => {
        const taxRate = 0.27; // 27%
        const taxableIncome = reportData.netProfit > 0 ? reportData.netProfit : 0;
        const taxAmount = taxableIncome * taxRate;
        return {
            taxRate,
            taxableIncome,
            taxAmount,
            netProfitAfterTax: reportData.netProfit - taxAmount,
        };
    }, [reportData.netProfit]);

     const handleDownloadExcel = () => {
        let excelData: any[] = [
            { A: 'Income', B: '' },
            ...reportData.income.map(item => ({ A: item.description, B: -item.balance })),
            { A: 'Total Income', B: reportData.totalIncome },
            {},
            { A: 'Cost of Sales', B: '' },
            ...reportData.costOfSales.map(item => ({ A: item.description, B: item.balance })),
            { A: 'Total Cost of Sales', B: reportData.totalCostOfSales },
            {},
            { A: 'Gross Profit', B: reportData.grossProfit },
            {},
            { A: 'Expenses', B: '' },
            ...reportData.expenses.map(item => ({ A: item.description, B: item.balance })),
            { A: 'Total Expenses', B: reportData.totalExpenses },
            {},
            { A: 'Net Profit / (Loss) Before Tax', B: reportData.netProfit },
             {},
            { A: 'Income Tax Expense (27%)', B: -taxCalculation.taxAmount },
            { A: 'Net Profit / (Loss) After Tax', B: taxCalculation.netProfitAfterTax },
        ];
        
        const worksheet = XLSX.utils.json_to_sheet(excelData, { skipHeader: true });
        worksheet['!cols'] = [{ wch: 40 }, { wch: 20 }];
        
        Object.keys(worksheet).forEach(key => {
             if (key.startsWith('B')) {
                const cell = worksheet[key];
                if (cell.v !== null && typeof cell.v === 'number') {
                    cell.t = 'n';
                    cell.z = '"R" #,##0.00';
                }
            }
        });

        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Profit and Loss");
        const today = new Date().toISOString().split('T')[0];
        const fileName = `${client.companyName || client.name}-Profit-Loss-${today}.xlsx`;
        XLSX.writeFile(workbook, fileName);
    };

    return (
        <>
            <div className="max-h-[70vh] overflow-y-auto space-y-6">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Description</TableHead>
                            <TableHead className="text-right">Amount</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        <TableRow className="font-bold bg-muted/50"><TableCell colSpan={2}>Income</TableCell></TableRow>
                        {reportData.income.map(item => (
                            <TableRow key={item.id}><TableCell className="pl-8">{item.description}</TableCell><TableCell className="text-right font-mono">{formatPrice(-item.balance)}</TableCell></TableRow>
                        ))}
                        <TableRow className="font-semibold border-t"><TableCell className="pl-8">Total Income</TableCell><TableCell className="text-right font-mono">{formatPrice(reportData.totalIncome)}</TableCell></TableRow>
                        
                        <TableRow><TableCell colSpan={2}>&nbsp;</TableCell></TableRow>

                        <TableRow className="font-bold bg-muted/50"><TableCell colSpan={2}>Cost of Sales</TableCell></TableRow>
                        {reportData.costOfSales.map(item => (
                             <TableRow key={item.id}><TableCell className="pl-8">{item.description}</TableCell><TableCell className="text-right font-mono">{formatPrice(item.balance)}</TableCell></TableRow>
                        ))}
                         <TableRow className="font-semibold border-t"><TableCell className="pl-8">Total Cost of Sales</TableCell><TableCell className="text-right font-mono">{formatPrice(reportData.totalCostOfSales)}</TableCell></TableRow>
                         
                        <TableRow className="font-bold text-lg bg-muted/50 border-t-2 border-b-2"><TableCell>Gross Profit</TableCell><TableCell className="text-right font-mono">{formatPrice(reportData.grossProfit)}</TableCell></TableRow>
                        
                        <TableRow><TableCell colSpan={2}>&nbsp;</TableCell></TableRow>
                        
                        <TableRow className="font-bold bg-muted/50"><TableCell colSpan={2}>Operating Expenses</TableCell></TableRow>
                        {reportData.expenses.map(item => (
                            <TableRow key={item.id}><TableCell className="pl-8">{item.description}</TableCell><TableCell className="text-right font-mono">{formatPrice(item.balance)}</TableCell></TableRow>
                        ))}
                         <TableRow className="font-semibold border-t"><TableCell className="pl-8">Total Expenses</TableCell><TableCell className="text-right font-mono">{formatPrice(reportData.totalExpenses)}</TableCell></TableRow>

                    </TableBody>
                    <TableFooter>
                         <TableRow className="font-bold text-lg bg-muted/50 border-t-2"><TableCell>Net Profit / (Loss) Before Tax</TableCell><TableCell className="text-right font-mono">{formatPrice(reportData.netProfit)}</TableCell></TableRow>
                    </TableFooter>
                </Table>
            </div>
             <DialogFooter className="mt-4 flex justify-between">
                <Button variant="outline" onClick={handleDownloadExcel}>
                    <Download className="mr-2 h-4 w-4" />
                    Download Excel
                </Button>
                <Dialog open={isTaxDialogOpen} onOpenChange={setIsTaxDialogOpen}>
                    <DialogTrigger asChild>
                        <Button variant="secondary" disabled={reportData.netProfit <= 0}><Calculator className="mr-2 h-4 w-4"/>Calculate Tax & Post Journal</Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Income Tax Calculation</DialogTitle>
                            <DialogDescription>Based on a corporate income tax rate of {taxCalculation.taxRate * 100}%. This is an estimate for provisioning purposes only.</DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                            <div className="flex justify-between items-center"><span className="text-muted-foreground">Net Profit Before Tax:</span><span className="font-semibold">{formatPrice(taxCalculation.taxableIncome)}</span></div>
                            <div className="flex justify-between items-center"><span className="text-muted-foreground">Tax Rate:</span><span className="font-semibold">{taxCalculation.taxRate * 100}%</span></div>
                            <Separator />
                            <div className="flex justify-between items-center text-lg"><span className="font-bold">Estimated Tax Expense:</span><span className="font-bold text-destructive">{formatPrice(taxCalculation.taxAmount)}</span></div>
                            <Separator />
                            <div className="flex justify-between items-center"><span className="text-muted-foreground">Net Profit After Tax:</span><span className="font-semibold">{formatPrice(taxCalculation.netProfitAfterTax)}</span></div>
                        </div>
                        <DialogFooter>
                            <Button variant="ghost" onClick={() => setIsTaxDialogOpen(false)}>Cancel</Button>
                            <Button onClick={() => { onPostJournal(taxCalculation.taxAmount); setIsTaxDialogOpen(false); }}>Post Tax Journal</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </DialogFooter>
        </>
    );
}

export default function ProfitAndLossPage() {
    const params = useParams();
    const router = useRouter();
    const clientId = params.clientId as string;

    const [client, setClient] = useState<User | null>(null);
    const [transactions, setTransactions] = useState<(ImportedTransaction | AllocatedTransaction)[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
    const { toast } = useToast();
    
    useEffect(() => {
        const fetchClientData = async () => {
            if (!clientId) return;
            setIsLoading(true);
            try {
                const clientRef = doc(db, 'aiAccountantClients', clientId);
                const clientSnap = await getDoc(clientRef);
                if (clientSnap.exists()) {
                    setClient({ id: clientSnap.id, ...clientSnap.data() } as User);
                }
            } catch (error) {
                console.error("Error fetching client data:", error);
            } finally {
                setIsLoading(false);
            }
        };
        fetchClientData();
        
        const transUnsubscribe = onSnapshot(query(collection(db, 'aiAccountantClients', clientId, 'transactions')), snapshot => {
            const fetched = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as (ImportedTransaction | AllocatedTransaction)));
            setTransactions(fetched);
        });
        
        return () => transUnsubscribe();
    }, [clientId]);
    
    const handleGoToJournal = (taxAmount: number) => {
        if (!client || taxAmount <= 0) return;

        const taxExpenseAccount = client.chartOfAccounts?.find(acc => acc.accountNumber === '3000-056');
        const taxPayableAccount = client.chartOfAccounts?.find(acc => acc.accountNumber === '7000-015');

        if (!taxExpenseAccount || !taxPayableAccount) {
            toast({ title: 'Error', description: 'Tax accounts not found in Chart of Accounts.', variant: 'destructive'});
            return;
        }

        const journalDate = (dateRange?.to || new Date()).toISOString();
        const journalRef = `TAX-${format(dateRange?.to || new Date(), 'yyyy-MM-dd')}`;
        
        const params = new URLSearchParams({
            date: journalDate,
            reference: journalRef,
            line1_debit: taxAmount.toFixed(2),
            line1_desc: 'Income Tax Expense Provision',
            line1_acc: taxExpenseAccount.id,
            line2_credit: taxAmount.toFixed(2),
            line2_desc: 'Income Tax Provision',
            line2_acc: taxPayableAccount.id,
        });

        router.push(`/admin/ai-accountant/${clientId}/general-journal?${params.toString()}`);
    };


    const getReportDateString = () => {
        if (!dateRange || (!dateRange.from && !dateRange.to)) {
            return `for the current financial year`;
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
        return `for the current financial year`;
    }

    return (
        <div>
            <Card>
                <CardHeader>
                    <CardTitle>Profit & Loss Statement</CardTitle>
                    <CardDescription>
                        Generate an income statement for a specific period.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                     <div className="space-y-6 max-w-4xl">
                        <div className="grid grid-cols-1 md:grid-cols-[150px_1fr] items-center gap-4">
                            <p className="text-sm font-medium">Date Range</p>
                            <DateRangePicker onDateChange={setDateRange} financialYearEnd={client?.yearEnd} />
                        </div>
                        <div className="flex justify-start pt-4">
                             {isLoading ? (
                                <Loader2 className="animate-spin" />
                            ) : client ? (
                                <Dialog>
                                    <DialogTrigger asChild>
                                        <Button>View Report</Button>
                                    </DialogTrigger>
                                    <DialogContent className="sm:max-w-3xl">
                                        <DialogHeader className="text-center mb-4">
                                            <DialogTitle className="text-lg">{client.companyName || client.name}</DialogTitle>
                                            <DialogDescription>
                                                Profit & Loss Statement {getReportDateString()}
                                            </DialogDescription>
                                        </DialogHeader>
                                        <ProfitAndLossReport 
                                            client={client} 
                                            transactions={transactions} 
                                            dateRange={dateRange} 
                                            onPostJournal={handleGoToJournal}
                                        />
                                    </DialogContent>
                                </Dialog>
                            ) : (
                                <p>Client data could not be loaded.</p>
                            )}
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
