
'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useState, useEffect, useMemo, useCallback } from "react";
import { User, AllocatedTransaction, ImportedTransaction, Supplier } from "@/lib/types";
import { getFirestore, doc, getDoc, collection, query, onSnapshot, orderBy, getDocs, where } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { Loader2, Download, Eye, FileText, Calendar as CalendarIcon } from "lucide-react";
import { useParams } from 'next/navigation';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter as TableFooterComponent } from "@/components/ui/table";
import { format, endOfDay, parseISO } from 'date-fns';
import * as XLSX from 'xlsx';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import Link from "next/link";

const db = getFirestore(firebaseApp);

const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'ZAR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(price);
};

function SupplierBalancesReport({ 
    client, 
    suppliers, 
    transactions, 
    asAtDate 
}: { 
    client: User;
    suppliers: Supplier[];
    transactions: (AllocatedTransaction | ImportedTransaction)[];
    asAtDate: Date;
}) {
    
    const reportData = useMemo(() => {
        const dateLimit = endOfDay(asAtDate);
        const supplierControlAccountId = client.chartOfAccounts?.find(acc => acc.accountNumber === '7000-000')?.id;

        return suppliers.map(supplier => {
            let balance = 0;
            
            // Filter relevant transactions for this supplier up to the date
            const supplierTxs = transactions.filter(tx => {
                const txDate = new Date(tx.date);
                if (txDate > dateLimit) return false;

                // Match payments
                if (tx.allocatedTo?.type === 'supplier' && tx.allocatedTo.value === supplier.id) {
                    return true;
                }
                // Match journals
                if (tx.bankAccountId === 'JOURNAL' && tx.allocatedTo?.value === supplierControlAccountId && tx.description.toUpperCase().includes(supplier.name.toUpperCase())) {
                    return true;
                }
                return false;
            });

            supplierTxs.forEach(tx => {
                const isJournal = tx.bankAccountId === 'JOURNAL';
                if (isJournal) {
                    // Credit increases liability (negative amount)
                    // Debit decreases liability (positive amount)
                    balance += -tx.amount;
                } else {
                    // Bank payment decreases liability (negative amount)
                    balance += tx.amount;
                }
            });

            return {
                id: supplier.id,
                name: supplier.name,
                balance
            };
        }).filter(s => Math.abs(s.balance) > 0.01)
          .sort((a, b) => b.balance - a.balance);
    }, [client, suppliers, transactions, asAtDate]);

    const totalBalance = useMemo(() => reportData.reduce((sum, s) => sum + s.balance, 0), [reportData]);

    const handleDownloadExcel = () => {
        const dataToExport = reportData.map(s => ({
            'Supplier Name': s.name,
            'Balance': s.balance,
        }));

        dataToExport.push({
            'Supplier Name': 'Total Outstanding',
            'Balance': totalBalance,
        });

        const worksheet = XLSX.utils.json_to_sheet(dataToExport);
        worksheet['!cols'] = [{ wch: 40 }, { wch: 20 }];
        
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Supplier Balances");
        XLSX.writeFile(workbook, `Supplier_Balances_${format(asAtDate, 'yyyyMMdd')}.xlsx`);
    };

    return (
        <>
        <div className="max-h-[70vh] overflow-y-auto space-y-6">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Supplier Name</TableHead>
                        <TableHead className="text-right">Outstanding Balance</TableHead>
                        <TableHead className="w-20"></TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {reportData.length === 0 ? (
                        <TableRow>
                            <TableCell colSpan={3} className="text-center h-24 text-muted-foreground">
                                No outstanding balances found for the selected date.
                            </TableCell>
                        </TableRow>
                    ) : (
                        reportData.map((s) => (
                            <TableRow key={s.id}>
                                <TableCell className="font-bold text-slate-900">{s.name}</TableCell>
                                <TableCell className={cn("text-right font-mono font-bold", s.balance > 0 ? "text-primary" : "text-green-600")}>
                                    {formatPrice(s.balance)}
                                </TableCell>
                                <TableCell className="text-right">
                                    <Button variant="ghost" size="icon" asChild>
                                        <Link href={`/admin/ai-accountant/${client.id}/reports/supplier-ledger?supplierId=${s.id}`}>
                                            <Eye className="h-4 w-4" />
                                        </Link>
                                    </Button>
                                </TableCell>
                            </TableRow>
                        ))
                    )}
                </TableBody>
                 <TableFooterComponent>
                    <TableRow className="bg-muted/50">
                        <TableCell className="font-black uppercase text-xs tracking-wider">Total Practice Liability</TableCell>
                        <TableCell className="text-right font-black text-primary text-lg">{formatPrice(totalBalance)}</TableCell>
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

export default function SupplierBalancesPage() {
    const params = useParams();
    const clientId = params.clientId as string;
    const [client, setClient] = useState<User | null>(null);
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [transactions, setTransactions] = useState<(AllocatedTransaction | ImportedTransaction)[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [asAtDate, setAsAtDate] = useState<Date>(new Date());
    const [isReportOpen, setIsReportOpen] = useState(false);

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
            console.error("Error fetching data:", error);
        } finally {
            setIsLoading(false);
        }
    }, [clientId]);

    useEffect(() => {
        fetchInitialData();
        const transUnsubscribe = onSnapshot(query(collection(db, 'aiAccountantClients', clientId, 'transactions')), snapshot => {
            setTransactions(snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as any)));
        });
        return () => transUnsubscribe();
    }, [clientId, fetchInitialData]);

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                            <FileText className="h-5 w-5" />
                        </div>
                        <div>
                            <CardTitle>Supplier Balances Report</CardTitle>
                            <CardDescription>View total outstanding balances for all suppliers as of a specific date.</CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-6 max-w-sm">
                        <div className="grid gap-2">
                            <Label>Report As At Date</Label>
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !asAtDate && "text-muted-foreground")}>
                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                        {asAtDate ? format(asAtDate, "PPP") : <span>Pick a date</span>}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start">
                                    <Calendar mode="single" selected={asAtDate} onSelect={(d) => d && setAsAtDate(d)} initialFocus />
                                </PopoverContent>
                            </Popover>
                        </div>
                        
                        <div className="flex justify-start">
                            {isLoading ? (
                                <Loader2 className="animate-spin" />
                            ) : client ? (
                                <Dialog open={isReportOpen} onOpenChange={setIsReportOpen}>
                                    <DialogTrigger asChild>
                                        <Button size="lg" className="font-bold gap-2">
                                            <Eye className="h-4 w-4"/> Generate Report
                                        </Button>
                                    </DialogTrigger>
                                    <DialogContent className="sm:max-w-4xl">
                                        <DialogHeader className="text-center mb-4">
                                            <DialogTitle className="text-xl font-black">{client.companyName || client.name}</DialogTitle>
                                            <DialogDescription className="font-bold text-slate-900">
                                                Supplier Balances as at {format(asAtDate, 'dd MMMM yyyy')}
                                            </DialogDescription>
                                        </DialogHeader>
                                        <SupplierBalancesReport 
                                            client={client} 
                                            suppliers={suppliers}
                                            transactions={transactions} 
                                            asAtDate={asAtDate}
                                        />
                                    </DialogContent>
                                </Dialog>
                            ) : (
                                <p className="text-sm text-muted-foreground italic">Loading client profile...</p>
                            )}
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

