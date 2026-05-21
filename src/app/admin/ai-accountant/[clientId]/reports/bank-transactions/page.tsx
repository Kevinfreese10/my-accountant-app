

'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useState, useEffect, useMemo } from "react";
import { User, AllocatedTransaction, ImportedTransaction, ChartOfAccount } from "@/lib/types";
import { getFirestore, doc, getDoc, collection, query, onSnapshot, orderBy, where } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { Loader2, Download, Eye } from "lucide-react";
import { useParams } from 'next/navigation';
import { DateRange } from "react-day-picker";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter as TableFooterComponent } from "@/components/ui/table";
import { format } from 'date-fns';
import * as XLSX from 'xlsx';

const db = getFirestore(firebaseApp);

const formatPrice = (price: number) => {
    if (price === 0) return '0.00';
    return new Intl.NumberFormat('en-GB', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(price);
};

function BankTransactionReport({ 
    transactions, 
    bankAccounts,
    dateRange,
    selectedAccountId,
}: { 
    transactions: (ImportedTransaction | AllocatedTransaction)[];
    bankAccounts: ChartOfAccount[];
    dateRange?: DateRange;
    selectedAccountId?: string;
}) {
    const reportData = useMemo(() => {
        let filtered = transactions;

        if (selectedAccountId && selectedAccountId !== 'all') {
            filtered = filtered.filter(tx => tx.bankAccountId === selectedAccountId);
        }

        if (dateRange?.from) {
            filtered = filtered.filter(tx => new Date(tx.date) >= dateRange.from!);
        }
        if (dateRange?.to) {
            filtered = filtered.filter(tx => new Date(tx.date) <= dateRange.to!);
        }

        return filtered.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    }, [transactions, dateRange, selectedAccountId]);

    const getBankAccountName = (accountId: string) => {
        return bankAccounts.find(ba => ba.id === accountId)?.description || accountId;
    }

    const handleDownloadExcel = () => {
        const dataToExport = reportData.map(tx => ({
            'Date': format(new Date(tx.date), 'dd/MM/yyyy'),
            'Bank Account': getBankAccountName(tx.bankAccountId || ''),
            'Description': tx.description,
            'Reference': tx.reference,
            'Amount': tx.amount,
        }));

        const worksheet = XLSX.utils.json_to_sheet(dataToExport);
        worksheet['!cols'] = [{ wch: 12 }, { wch: 25 }, { wch: 40 }, { wch: 20 }, { wch: 15 }];
        
        Object.keys(worksheet).forEach(key => {
             if (key.startsWith('E')) {
                const cell = worksheet[key];
                if (cell.v !== null && typeof cell.v === 'number') {
                    cell.t = 'n';
                    cell.z = '#,##0.00';
                }
            }
        });

        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Bank Transactions");
        XLSX.writeFile(workbook, `Bank_Transactions_Report.xlsx`);
    };

    return (
        <>
        <div className="max-h-[70vh] overflow-y-auto space-y-6">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Bank Account</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>Reference</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {reportData.length === 0 ? (
                        <TableRow>
                            <TableCell colSpan={5} className="text-center h-24 text-muted-foreground">
                                No transactions found for the selected criteria.
                            </TableCell>
                        </TableRow>
                    ) : (
                        reportData.map((tx, index) => (
                            <TableRow key={index}>
                                <TableCell>{format(new Date(tx.date), 'dd/MM/yyyy')}</TableCell>
                                <TableCell>{getBankAccountName(tx.bankAccountId || '')}</TableCell>
                                <TableCell>{tx.description}</TableCell>
                                <TableCell>{tx.reference}</TableCell>
                                <TableCell className="text-right font-mono">{formatPrice(tx.amount)}</TableCell>
                            </TableRow>
                        ))
                    )}
                </TableBody>
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

export default function BankTransactionsReportPage() {
    const params = useParams();
    const clientId = params.clientId as string;
    const [client, setClient] = useState<User | null>(null);
    const [transactions, setTransactions] = useState<(ImportedTransaction | AllocatedTransaction)[]>([]);
    const [bankAccounts, setBankAccounts] = useState<ChartOfAccount[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
    const [selectedAccountId, setSelectedAccountId] = useState<string | undefined>('all');
    const [isReportOpen, setIsReportOpen] = useState(false);

    useEffect(() => {
        const fetchInitialData = async () => {
            if (!clientId) return;
            setIsLoading(true);
            try {
                const clientRef = doc(db, 'aiAccountantClients', clientId);
                const clientSnap = await getDoc(clientRef);
                if (clientSnap.exists()) {
                    const clientData = clientSnap.data() as User;
                    setClient(clientData);
                    setBankAccounts(clientData.chartOfAccounts?.filter(acc => acc.accountNumber.startsWith('8400-')) || []);
                }
            } catch (error) {
                console.error("Error fetching client data:", error);
            } finally {
                setIsLoading(false);
            }
        };
        fetchInitialData();
        
        const transUnsubscribe = onSnapshot(query(collection(db, 'aiAccountantClients', clientId, 'transactions')), snapshot => {
            const fetched = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as (ImportedTransaction | AllocatedTransaction)));
            setTransactions(fetched);
        });
        
        return () => transUnsubscribe();
    }, [clientId]);

    const getReportDateString = () => {
        if (!dateRange || (!dateRange.from && !dateRange.to)) {
            return `for all dates`;
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
        return `for all dates`;
    }

    return (
        <div>
            <Card>
                <CardHeader>
                    <CardTitle>Bank Transactions Report</CardTitle>
                    <CardDescription>Filter and view bank transactions.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-6 max-w-4xl">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="grid gap-1.5">
                                <Label>Date Range</Label>
                                <DateRangePicker onDateChange={setDateRange} />
                            </div>
                            <div className="grid gap-1.5">
                                <Label>Bank Account</Label>
                                <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
                                    <SelectTrigger><SelectValue placeholder="Select an account" /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All Bank Accounts</SelectItem>
                                        {bankAccounts.map(acc => <SelectItem key={acc.id} value={acc.id}>{acc.description}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div className="flex justify-start pt-4">
                            {isLoading ? (
                                <Loader2 className="animate-spin" />
                            ) : client ? (
                                <Dialog open={isReportOpen} onOpenChange={setIsReportOpen}>
                                    <DialogTrigger asChild>
                                        <Button><Eye className="mr-2 h-4 w-4"/>View Report</Button>
                                    </DialogTrigger>
                                    <DialogContent className="sm:max-w-4xl">
                                        <DialogHeader className="text-center mb-4">
                                            <DialogTitle className="text-lg">{client.companyName || client.name}</DialogTitle>
                                            <DialogDescription>
                                                Bank Transactions {getReportDateString()}
                                            </DialogDescription>
                                        </DialogHeader>
                                        <BankTransactionReport 
                                            transactions={transactions} 
                                            bankAccounts={bankAccounts}
                                            dateRange={dateRange}
                                            selectedAccountId={selectedAccountId}
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
