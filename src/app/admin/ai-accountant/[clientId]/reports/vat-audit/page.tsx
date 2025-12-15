

'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useState, useEffect, useMemo } from "react";
import { User, AllocatedTransaction, ImportedTransaction } from "@/lib/types";
import { getFirestore, doc, getDoc, collection, query, onSnapshot, orderBy, getDocs } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { Loader2, Download, Eye } from "lucide-react";
import { useParams } from 'next/navigation';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter as TableFooterComponent } from "@/components/ui/table";
import { format, startOfMonth, endOfMonth, subMonths, getYear, getMonth, parseISO } from 'date-fns';
import * as XLSX from 'xlsx';

const db = getFirestore(firebaseApp);

const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-GB', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(price);
};

const generateVatPeriods = (vatCategory: 'A' | 'B' | 'C' | undefined) => {
    const periods = [];
    const now = new Date();
    
    if (vatCategory === 'C') { // Monthly
        for (let i = 0; i < 12; i++) {
            const date = subMonths(now, i);
            const period = {
                label: format(date, 'MMMM yyyy'),
                from: startOfMonth(date),
                to: endOfMonth(date),
            };
            periods.push(period);
        }
    } else { // Bi-Monthly
        const isCatA = vatCategory === 'A'; // Odd months: Jan, Mar, etc.
        let currentMonth = now.getMonth();
        
        // Adjust start month for bi-monthly period
        if ((currentMonth % 2 === 1 && isCatA) || (currentMonth % 2 === 0 && !isCatA)) {
             // current month is the second month of a period, but not the right category
        }

        for (let i = 0; i < 6; i++) {
             const periodEndDate = subMonths(now, i * 2);
             const periodStartDate = startOfMonth(subMonths(periodEndDate, 1));

             const periodEndMonth = getMonth(periodEndDate);

            if ((isCatA && (periodEndMonth + 1) % 2 !== 0) || (!isCatA && (periodEndMonth + 1) % 2 === 0)) {
                 const label = `${format(periodStartDate, 'MMM')} / ${format(periodEndDate, 'MMM yyyy')}`;
                periods.push({
                    label,
                    from: periodStartDate,
                    to: endOfMonth(periodEndDate),
                });
            } else {
                 const correctedStartDate = startOfMonth(subMonths(periodEndDate, 2));
                 const correctedEndDate = endOfMonth(subMonths(periodEndDate, 1));
                 const label = `${format(correctedStartDate, 'MMM')} / ${format(correctedEndDate, 'MMM yyyy')}`;
                 periods.push({
                    label,
                    from: correctedStartDate,
                    to: correctedEndDate,
                });
            }
        }
    }
    return periods;
};

function VatAuditReport({ client, transactions, period }: { client: User, transactions: (ImportedTransaction | AllocatedTransaction)[], period: { from: string, to: string } }) {
    
    const reportData = useMemo(() => {
        const fromDate = parseISO(period.from);
        const toDate = parseISO(period.to);

        const vatTransactions = transactions.filter(tx => {
            const txDate = tx.date instanceof Date ? tx.date : new Date(tx.date);
            return tx.vatType && tx.vatType !== 'no_vat' && txDate >= fromDate && txDate <= toDate;
        });

        const sales = vatTransactions
            .filter(tx => tx.amount > 0)
            .sort((a, b) => b.amount - a.amount)
            .slice(0, 10);

        const expenses = vatTransactions
            .filter(tx => tx.amount < 0)
            .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount))
            .slice(0, 10);
            
        return { sales, expenses };
    }, [transactions, period]);

    const handleDownloadExcel = () => {
        const wb = XLSX.utils.book_new();

        const salesData = reportData.sales.map(tx => ({
            Date: format(new Date(tx.date), 'dd/MM/yyyy'),
            Description: tx.description,
            Amount: tx.amount
        }));

        const expensesData = reportData.expenses.map(tx => ({
            Date: format(new Date(tx.date), 'dd/MM/yyyy'),
            Description: tx.description,
            Amount: tx.amount
        }));

        const salesSheet = XLSX.utils.json_to_sheet(salesData, { header: ["Date", "Description", "Amount"] });
        XLSX.utils.book_append_sheet(wb, salesSheet, "Top 10 Sales");

        const expensesSheet = XLSX.utils.json_to_sheet(expensesData, { header: ["Date", "Description", "Amount"] });
        XLSX.utils.book_append_sheet(wb, expensesSheet, "Top 10 Expenses");
        
        XLSX.writeFile(wb, `VAT-Audit-${client.name}-${format(parseISO(period.from), 'yyyyMM')}.xlsx`);
    };

    const renderTable = (data: typeof reportData.sales, title: string) => (
        <div>
            <h3 className="text-lg font-semibold mb-2">{title}</h3>
            <Table>
                <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Description</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader>
                <TableBody>
                    {data.length === 0 ? (
                        <TableRow><TableCell colSpan={3} className="text-center h-24 text-muted-foreground">No transactions found.</TableCell></TableRow>
                    ) : (
                        data.map((tx, index) => (
                            <TableRow key={index}><TableCell>{format(new Date(tx.date), 'dd/MM/yyyy')}</TableCell><TableCell>{tx.description}</TableCell><TableCell className="text-right font-mono">{formatPrice(tx.amount)}</TableCell></TableRow>
                        ))
                    )}
                </TableBody>
            </Table>
        </div>
    );

    return (
        <>
            <div className="max-h-[70vh] overflow-y-auto space-y-6 p-1">
                {renderTable(reportData.sales, 'Top 10 Sales Transactions (with VAT)')}
                {renderTable(reportData.expenses, 'Top 10 Expense Transactions (with VAT)')}
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

export default function VatAuditPage() {
    const params = useParams();
    const clientId = params.clientId as string;
    const [client, setClient] = useState<User | null>(null);
    const [transactions, setTransactions] = useState<(ImportedTransaction | AllocatedTransaction)[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [vatPeriods, setVatPeriods] = useState<{ label: string; from: Date; to: Date; }[]>([]);
    const [selectedPeriod, setSelectedPeriod] = useState<string | undefined>();
    
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
                    if (clientData.isVatRegistered) {
                        const periods = generateVatPeriods(clientData.vatCategory);
                        setVatPeriods(periods);
                        if(periods.length > 0) {
                            setSelectedPeriod(JSON.stringify({
                                label: periods[0].label,
                                from: periods[0].from.toISOString(),
                                to: periods[0].to.toISOString(),
                            }));
                        }
                    }
                }
            } catch(e) { console.error(e); }
            
            const transUnsubscribe = onSnapshot(query(collection(db, 'aiAccountantClients', clientId, 'transactions')), snapshot => {
                const fetched = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as (ImportedTransaction | AllocatedTransaction)));
                setTransactions(fetched);
                setIsLoading(false);
            });
            
            return () => transUnsubscribe();
        };
        fetchInitialData();
    }, [clientId]);
    
    const parsedPeriod = useMemo(() => {
        try {
            return selectedPeriod ? JSON.parse(selectedPeriod) : null;
        } catch {
            return null;
        }
    }, [selectedPeriod]);

    return (
        <Card>
            <CardHeader>
                <CardTitle>VAT Audit Report</CardTitle>
                <CardDescription>Select a VAT period to view the top 10 largest sales and expense transactions with VAT.</CardDescription>
            </CardHeader>
            <CardContent>
                {isLoading ? (
                    <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /><span>Loading client data...</span></div>
                ) : !client?.isVatRegistered ? (
                    <p className="text-destructive">This client is not registered for VAT.</p>
                ) : (
                    <div className="space-y-6 max-w-4xl">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="grid gap-1.5">
                                <Label>VAT Period</Label>
                                <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                                    <SelectTrigger><SelectValue placeholder="Select a period..." /></SelectTrigger>
                                    <SelectContent>
                                        {vatPeriods.map((p, i) => <SelectItem key={i} value={JSON.stringify({ label: p.label, from: p.from.toISOString(), to: p.to.toISOString() })}>{p.label}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div className="flex justify-start pt-4">
                            {parsedPeriod && (
                                <Dialog>
                                    <DialogTrigger asChild>
                                        <Button><Eye className="mr-2 h-4 w-4"/>View Report</Button>
                                    </DialogTrigger>
                                    <DialogContent className="sm:max-w-4xl">
                                        <DialogHeader className="text-center mb-4">
                                            <DialogTitle className="text-lg">{client.companyName || client.name}</DialogTitle>
                                            <DialogDescription>
                                                VAT Audit Report for {parsedPeriod.label}
                                            </DialogDescription>
                                        </DialogHeader>
                                        <VatAuditReport client={client} transactions={transactions} period={parsedPeriod} />
                                    </DialogContent>
                                </Dialog>
                            )}
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
