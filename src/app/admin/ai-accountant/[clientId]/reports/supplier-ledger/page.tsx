
'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useState, useEffect, useMemo, useCallback } from "react";
import { User, AllocatedTransaction, ImportedTransaction, Supplier, ChartOfAccount } from "@/lib/types";
import { getFirestore, doc, getDoc, collection, query, onSnapshot, orderBy, getDocs, where } from 'firebase/firestore';
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
    return new Intl.NumberFormat('en-GB', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(price);
};

const safeFormatDate = (date: any): string => {
    if (!date) return 'N/A';
    try {
        const d = date?.toDate ? date.toDate() : new Date(date);
        return format(d, 'dd/MM/yyyy');
    } catch (e) {
        return 'Invalid Date';
    }
};

function SupplierLedgerReport({ 
    client, 
    supplier, 
    transactions, 
    dateRange 
}: { 
    client: User;
    supplier: Supplier | undefined;
    transactions: (AllocatedTransaction | ImportedTransaction)[];
    dateRange?: DateRange;
}) {
    
    const supplierTransactions = useMemo(() => {
        if (!supplier) return [];
        
        const supplierControlAccountId = client.chartOfAccounts?.find(acc => acc.accountNumber === '7000-000')?.id;
        
        let filtered = transactions.filter(tx => {
            // Include payments allocated to this supplier
            if (tx.allocatedTo?.type === 'supplier' && tx.allocatedTo.value === supplier.id) {
                return true;
            }
            // Include journal entries that affect the supplier control account and mention the supplier
            if (tx.bankAccountId === 'JOURNAL' && tx.allocatedTo?.value === supplierControlAccountId && tx.description.toUpperCase().includes(supplier.name.toUpperCase())) {
                return true;
            }
            return false;
        });

        if (dateRange?.from) {
            filtered = filtered.filter(tx => new Date(tx.date) >= dateRange.from!);
        }
        if (dateRange?.to) {
            filtered = filtered.filter(tx => new Date(tx.date) <= dateRange.to!);
        }
        
        return filtered.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    }, [transactions, supplier, dateRange, client.chartOfAccounts]);

    const reportData = useMemo(() => {
        let runningBalance = 0;
        return supplierTransactions.map(tx => {
            const isJournal = tx.bankAccountId === 'JOURNAL';
            let debit = 0;
            let credit = 0;

            if (isJournal) {
                // Journal: Debit increases (negative amount in our system logic?), Credit reduces
                // Wait, in general-journal.tsx: Debit is positive, Credit is negative.
                // For a Supplier (Liability):
                // Credit increases liability (negative amount)
                // Debit decreases liability (positive amount)
                if (tx.amount < 0) credit = Math.abs(tx.amount);
                else debit = tx.amount;
            } else {
                // Bank: Expense is negative amount.
                // A payment to a supplier (expense) is a DEBIT to the supplier (decreases liability).
                if (tx.amount < 0) debit = Math.abs(tx.amount);
                else credit = tx.amount; // Refund
            }
            
            runningBalance += credit - debit;

            return {
                id: tx.id,
                date: tx.date,
                description: tx.description,
                reference: tx.reference,
                debit,
                credit,
                balance: runningBalance
            };
        });
    }, [supplierTransactions]);

    const totals = useMemo(() => {
        const totalDebits = reportData.reduce((sum, tx) => sum + tx.debit, 0);
        const totalCredits = reportData.reduce((sum, tx) => sum + tx.credit, 0);
        return { totalDebits, totalCredits };
    }, [reportData]);

    const handleDownloadExcel = () => {
        if (!supplier) return;
        const dataToExport = reportData.map(tx => ({
            'Date': safeFormatDate(tx.date),
            'Reference': tx.reference,
            'Description': tx.description,
            'Debit (Decrease)': tx.debit,
            'Credit (Increase)': tx.credit,
            'Balance': tx.balance,
        }));

        dataToExport.push({
            Date: 'Totals',
            Reference: '',
            Description: '',
            'Debit (Decrease)': totals.totalDebits,
            'Credit (Increase)': totals.totalCredits,
            'Balance': 0,
        } as any);

        const worksheet = XLSX.utils.json_to_sheet(dataToExport);
        worksheet['!cols'] = [{ wch: 12 }, { wch: 20 }, { wch: 40 }, { wch: 15 }, { wch: 15 }, { wch: 15 }];
        
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Supplier Ledger");
        XLSX.writeFile(workbook, `${supplier.name}_Ledger_${format(new Date(), 'yyyyMMdd')}.xlsx`);
    };

    return (
        <>
        <div className="max-h-[70vh] overflow-y-auto space-y-6">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Reference</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead className="text-right">Debit</TableHead>
                        <TableHead className="text-right">Credit</TableHead>
                        <TableHead className="text-right">Balance</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {reportData.length === 0 ? (
                        <TableRow>
                            <TableCell colSpan={6} className="text-center h-24 text-muted-foreground">
                                No transactions found for this supplier in the selected period.
                            </TableCell>
                        </TableRow>
                    ) : (
                        reportData.map((tx, index) => (
                            <TableRow key={index}>
                                <TableCell>{safeFormatDate(tx.date)}</TableCell>
                                <TableCell>{tx.reference}</TableCell>
                                <TableCell>{tx.description}</TableCell>
                                <TableCell className="text-right font-mono text-destructive">{tx.debit > 0 ? formatPrice(tx.debit) : ''}</TableCell>
                                <TableCell className="text-right font-mono text-green-600">{tx.credit > 0 ? formatPrice(tx.credit) : ''}</TableCell>
                                <TableCell className="text-right font-mono font-bold">{formatPrice(tx.balance)}</TableCell>
                            </TableRow>
                        ))
                    )}
                </TableBody>
                 <TableFooterComponent>
                    <TableRow>
                        <TableCell colSpan={3} className="font-bold">Totals</TableCell>
                        <TableCell className="text-right font-bold font-mono text-destructive">{formatPrice(totals.totalDebits)}</TableCell>
                        <TableCell className="text-right font-bold font-mono text-green-600">{formatPrice(totals.totalCredits)}</TableCell>
                        <TableCell></TableCell>
                    </TableRow>
                </TableFooterComponent>
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


export default function SupplierLedgerPage() {
    const params = useParams();
    const clientId = params.clientId as string;
    const [client, setClient] = useState<User | null>(null);
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [transactions, setTransactions] = useState<(AllocatedTransaction | ImportedTransaction)[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
    const [selectedSupplierId, setSelectedSupplierId] = useState<string | undefined>();

    const fetchInitialData = useCallback(async () => {
        if (!clientId) return;
        setIsLoading(true);
        try {
            const clientRef = doc(db, 'aiAccountantClients', clientId);
            const clientSnap = await getDoc(clientRef);
            if (clientSnap.exists()) setClient({ id: clientSnap.id, ...clientSnap.data() } as User);

            const suppliersQuery = query(collection(db, `aiAccountantClients/${clientId}/suppliers`), orderBy("name"));
            const suppliersSnapshot = await getDocs(suppliersQuery);
            setSuppliers(suppliersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Supplier)));
        } catch (error) {
            console.error("Error fetching initial data:", error);
        } finally {
            setIsLoading(false);
        }
    }, [clientId]);

    useEffect(() => {
        fetchInitialData();
        
        const transUnsubscribe = onSnapshot(query(collection(db, 'aiAccountantClients', clientId, 'transactions')), snapshot => {
            const fetched = snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as any));
            setTransactions(fetched);
        });
        
        return () => transUnsubscribe();
    }, [clientId, fetchInitialData]);

    const selectedSupplier = useMemo(() => suppliers.find(s => s.id === selectedSupplierId), [suppliers, selectedSupplierId]);
    
    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Supplier Ledger Report</CardTitle>
                    <CardDescription>View a detailed transaction history and running balance for a specific supplier.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-6 max-w-4xl">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="grid gap-1.5">
                                <Label>Date Range</Label>
                                <DateRangePicker onDateChange={setDateRange} />
                            </div>
                            <div className="grid gap-1.5">
                                <Label>Supplier</Label>
                                <Select value={selectedSupplierId} onValueChange={setSelectedSupplierId}>
                                    <SelectTrigger><SelectValue placeholder="Select a supplier" /></SelectTrigger>
                                    <SelectContent>
                                        {suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div className="flex justify-start pt-4">
                            {isLoading ? (
                                <Loader2 className="animate-spin" />
                            ) : client && selectedSupplier ? (
                                <Dialog>
                                    <DialogTrigger asChild>
                                        <Button disabled={!selectedSupplierId}><Eye className="mr-2 h-4 w-4"/>View Report</Button>
                                    </DialogTrigger>
                                    <DialogContent className="sm:max-w-5xl">
                                        <DialogHeader className="text-center mb-4">
                                            <DialogTitle className="text-lg">{client.companyName || client.name}</DialogTitle>
                                            <DialogDescription>Supplier Ledger for {selectedSupplier.name}</DialogDescription>
                                        </DialogHeader>
                                        <SupplierLedgerReport 
                                            client={client} 
                                            supplier={selectedSupplier}
                                            transactions={transactions} 
                                            dateRange={dateRange}
                                        />
                                    </DialogContent>
                                </Dialog>
                            ) : (
                                <p className="text-sm text-muted-foreground italic">Please select a supplier to generate the ledger.</p>
                            )}
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

