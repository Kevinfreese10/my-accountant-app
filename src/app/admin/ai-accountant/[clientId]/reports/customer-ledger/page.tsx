
'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useState, useEffect, useMemo } from "react";
import { User, AllocatedTransaction, ImportedTransaction, ClientCustomer, Invoice, ChartOfAccount } from "@/lib/types";
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


function CustomerLedgerReport({ 
    client, 
    customer, 
    transactions, 
    dateRange 
}: { 
    client: User;
    customer: ClientCustomer | undefined;
    transactions: (Invoice | AllocatedTransaction | ImportedTransaction)[];
    dateRange?: DateRange;
}) {
    
    const customerTransactions = useMemo(() => {
        if (!customer) return [];
        
        const customerControlAccountId = client.chartOfAccounts?.find(acc => acc.accountNumber === '8000-001')?.id;
        
        let filtered = transactions.filter(tx => {
            // Include Invoices for this customer
            if ('customerId' in tx && tx.customerId === customer.id) {
                return true;
            }
            // Include payments allocated to this customer
            if ('allocatedTo' in tx && tx.allocatedTo?.type === 'customer' && tx.allocatedTo.value === customer.id) {
                return true;
            }
             // Include journal entries that affect the customer control account and mention the customer
            if ('allocatedTo' in tx && tx.bankAccountId === 'JOURNAL' && tx.allocatedTo?.value === customerControlAccountId && tx.description.toLowerCase().includes(customer.name.toLowerCase())) {
                return true;
            }
            return false;
        });

        if (dateRange?.from) {
            filtered = filtered.filter(tx => new Date('date' in tx ? tx.date : tx.invoiceDate) >= dateRange.from!);
        }
        if (dateRange?.to) {
            filtered = filtered.filter(tx => new Date('date' in tx ? tx.date : tx.invoiceDate) <= dateRange.to!);
        }
        return filtered.sort((a, b) => new Date('date' in a ? a.date : a.invoiceDate).getTime() - new Date('date' in b ? b.date : b.invoiceDate).getTime());
    }, [transactions, customer, dateRange, client.chartOfAccounts]);

    const reportData = useMemo(() => {
        let runningBalance = 0;
        return customerTransactions.map(tx => {
            const isInvoice = 'customerId' in tx;
            const amount = isInvoice ? tx.total : tx.amount;
            runningBalance += amount;
            return {
                id: tx.id,
                date: isInvoice ? tx.invoiceDate : tx.date,
                description: isInvoice ? `Invoice #${tx.id}` : tx.description,
                reference: isInvoice ? tx.id : tx.reference,
                debit: amount > 0 ? amount : 0,
                credit: amount < 0 ? -amount : 0,
                balance: runningBalance
            };
        });
    }, [customerTransactions]);

    const totals = useMemo(() => {
        const totalDebits = reportData.reduce((sum, tx) => sum + tx.debit, 0);
        const totalCredits = reportData.reduce((sum, tx) => sum + tx.credit, 0);
        return { totalDebits, totalCredits };
    }, [reportData]);

    const handleDownloadExcel = () => {
        const dataToExport = reportData.map(tx => ({
            'Date': safeFormatDate(tx.date),
            'Reference': tx.reference,
            'Description': tx.description,
            'Debit': tx.debit,
            'Credit': tx.credit,
            'Balance': tx.balance,
        }));

        dataToExport.push({
            Date: 'Totals',
            Reference: '',
            Description: '',
            Debit: totals.totalDebits,
            Credit: totals.totalCredits,
            Balance: '',
        });

        const worksheet = XLSX.utils.json_to_sheet(dataToExport, { skipHeader: true });
        worksheet['!cols'] = [{ wch: 12 }, { wch: 20 }, { wch: 40 }, { wch: 15 }, { wch: 15 }, { wch: 15 }];
        
        Object.keys(worksheet).forEach(key => {
             if (/[D-F]\d+/.test(key)) { // Debit, Credit, Balance columns
                const cell = worksheet[key];
                if (cell.v !== null && typeof cell.v === 'number') {
                    cell.t = 'n';
                    cell.z = '#,##0.00';
                }
            }
        });

        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Customer Ledger");
        XLSX.writeFile(workbook, `${customer?.name}-Ledger.xlsx`);
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
                                No transactions found for this customer in the selected period.
                            </TableCell>
                        </TableRow>
                    ) : (
                        reportData.map((tx, index) => (
                            <TableRow key={index}>
                                <TableCell>{safeFormatDate(tx.date)}</TableCell>
                                <TableCell>{tx.reference}</TableCell>
                                <TableCell>{tx.description}</TableCell>
                                <TableCell className="text-right font-mono">{formatPrice(tx.debit)}</TableCell>
                                <TableCell className="text-right font-mono">{formatPrice(tx.credit)}</TableCell>
                                <TableCell className="text-right font-mono">{formatPrice(tx.balance)}</TableCell>
                            </TableRow>
                        ))
                    )}
                </TableBody>
                 <TableFooterComponent>
                    <TableRow>
                        <TableCell colSpan={3} className="font-bold">Totals</TableCell>
                        <TableCell className="text-right font-bold font-mono">{formatPrice(totals.totalDebits)}</TableCell>
                        <TableCell className="text-right font-bold font-mono">{formatPrice(totals.totalCredits)}</TableCell>
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


export default function CustomerLedgerPage() {
    const params = useParams();
    const clientId = params.clientId as string;
    const [client, setClient] = useState<User | null>(null);
    const [customers, setCustomers] = useState<ClientCustomer[]>([]);
    const [transactions, setTransactions] = useState<(Invoice | AllocatedTransaction | ImportedTransaction)[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
    const [selectedCustomerId, setSelectedCustomerId] = useState<string | undefined>();

    useEffect(() => {
        const fetchInitialData = async () => {
            if (!clientId) return;
            setIsLoading(true);
            try {
                const clientRef = doc(db, 'aiAccountantClients', clientId);
                const clientSnap = await getDoc(clientRef);
                if (clientSnap.exists()) setClient({ id: clientSnap.id, ...clientSnap.data() } as User);

                const customersQuery = query(collection(db, `aiAccountantClients/${clientId}/customers`), orderBy("name"));
                const customersSnapshot = await getDocs(customersQuery);
                setCustomers(customersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ClientCustomer)));
            } catch (error) {
                console.error("Error fetching initial data:", error);
            } finally {
                setIsLoading(false);
            }
        };
        fetchInitialData();
        
        const transUnsubscribe = onSnapshot(query(collection(db, 'aiAccountantClients', clientId, 'transactions')), snapshot => {
            const fetched = snapshot.docs.map(docSnap => {
                const data = docSnap.data();
                if ('customerId' in data) { // It's an Invoice
                     return { 
                        id: docSnap.id, 
                        ...data,
                        invoiceDate: data.invoiceDate?.toDate(),
                        dueDate: data.dueDate?.toDate(),
                    } as Invoice
                }
                return { id: docSnap.id, ...data } as (AllocatedTransaction | ImportedTransaction)
            });
            setTransactions(fetched);
        });
        
        return () => transUnsubscribe();
    }, [clientId]);

    const selectedCustomer = useMemo(() => customers.find(c => c.id === selectedCustomerId), [customers, selectedCustomerId]);
    
    return (
        <div>
            <Card>
                <CardHeader>
                    <CardTitle>Customer Ledger Report</CardTitle>
                    <CardDescription>View a detailed transaction history for a specific customer.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-6 max-w-4xl">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="grid gap-1.5">
                                <Label>Date Range</Label>
                                <DateRangePicker onDateChange={setDateRange} />
                            </div>
                            <div className="grid gap-1.5">
                                <Label>Customer</Label>
                                <Select value={selectedCustomerId} onValueChange={setSelectedCustomerId}>
                                    <SelectTrigger><SelectValue placeholder="Select a customer" /></SelectTrigger>
                                    <SelectContent>
                                        {customers.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div className="flex justify-start pt-4">
                            {isLoading ? (
                                <Loader2 className="animate-spin" />
                            ) : client && selectedCustomer ? (
                                <Dialog>
                                    <DialogTrigger asChild>
                                        <Button disabled={!selectedCustomerId}><Eye className="mr-2 h-4 w-4"/>View Report</Button>
                                    </DialogTrigger>
                                    <DialogContent className="sm:max-w-4xl">
                                        <DialogHeader className="text-center mb-4">
                                            <DialogTitle className="text-lg">{client.companyName || client.name}</DialogTitle>
                                            <DialogDescription>Customer Ledger for {selectedCustomer.name}</DialogDescription>
                                        </DialogHeader>
                                        <CustomerLedgerReport 
                                            client={client} 
                                            customer={selectedCustomer}
                                            transactions={transactions} 
                                            dateRange={dateRange}
                                        />
                                    </DialogContent>
                                </Dialog>
                            ) : (
                                <p>Please select a customer to view the report.</p>
                            )}
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
