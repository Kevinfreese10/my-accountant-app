
'use client';

import * as React from "react"
import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Download, Eye, Ban } from "lucide-react";
import { useParams } from 'next/navigation';
import { getFirestore, doc, getDoc, collection, onSnapshot, query, writeBatch, updateDoc } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { User, AllocatedTransaction, ImportedTransaction } from '@/lib/types';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter as TableFooterComponent } from "@/components/ui/table";
import { format, startOfDay, endOfDay } from 'date-fns';
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { DateRange } from "react-day-picker";
import * as XLSX from 'xlsx';
import { allVatTypes } from "@/lib/vat-types";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { Label } from "@/components/ui/label";

const db = getFirestore(firebaseApp);

const formatPrice = (price: number) => {
    if (price === 0) return '0.00';
    return new Intl.NumberFormat('en-GB', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(price);
};

function VatTransactionsReport({ client, transactions: allTransactions, dateRange }: { client: User, transactions: (ImportedTransaction | AllocatedTransaction)[], dateRange?: DateRange }) {
    const { toast } = useToast();
    const [selectedTransactions, setSelectedTransactions] = useState<string[]>([]);
    const [isUpdating, setIsUpdating] = useState(false);
    const [transactions, setTransactions] = useState(allTransactions);

    useEffect(() => {
        setTransactions(allTransactions);
    }, [allTransactions]);

    const vatTransactions = useMemo(() => {
        const reportStartDate = dateRange?.from ? startOfDay(dateRange.from) : new Date(0);
        const reportEndDate = dateRange?.to ? endOfDay(dateRange.to) : new Date();

        return transactions
            .filter(tx => {
                const txDate = tx.date instanceof Date ? tx.date : new Date(tx.date);
                const isWithinRange = txDate >= reportStartDate && txDate <= reportEndDate;
                const isVatApplicable = tx.vatType && tx.vatType !== 'no_vat' && tx.vatType !== 'exempt_purchases' && tx.vatType !== 'exempt_sales';
                return isWithinRange && isVatApplicable;
            })
            .map(tx => {
                const isStandardRate = tx.vatType === 'standard_rated_purchases' || tx.vatType === 'standard_rated_sales' || tx.vatType === 'capital_goods_purchases';
                const vatRate = isStandardRate ? 0.15 : 0;
                
                const isJournal = tx.bankAccountId === 'JOURNAL';
                const inclusiveAmount = isJournal ? tx.amount * (1 + vatRate) : tx.amount;
                const exclusiveAmount = isStandardRate ? inclusiveAmount / (1 + vatRate) : inclusiveAmount;
                const vatAmount = inclusiveAmount - exclusiveAmount;

                return {
                    ...tx,
                    date: tx.date,
                    exclusiveAmount: exclusiveAmount,
                    vatAmount: vatAmount,
                    inclusiveAmount: inclusiveAmount,
                };
            })
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    }, [transactions, dateRange]);

    const totals = useMemo(() => {
        return vatTransactions.reduce((acc, tx) => {
            acc.exclusive += tx.exclusiveAmount;
            acc.vat += tx.vatAmount;
            acc.inclusive += tx.inclusiveAmount;
            return acc;
        }, { exclusive: 0, vat: 0, inclusive: 0 });
    }, [vatTransactions]);
    
    const handleDownloadExcel = () => {
        const dataToExport = vatTransactions.map(tx => ({
            'Date': format(new Date(tx.date), 'dd/MM/yyyy'),
            'Reference': tx.reference,
            'Description': tx.description,
            'VAT Type': allVatTypes.find(v => v.name === tx.vatType)?.label || 'N/A',
            'Inclusive Amount': tx.inclusiveAmount,
            'Exclusive Amount': tx.exclusiveAmount,
            'VAT Amount': tx.vatAmount,
        }));

        dataToExport.push({
            'Date': 'Totals',
            'Reference': '',
            'Description': '',
            'VAT Type': '',
            'Inclusive Amount': totals.inclusive,
            'Exclusive Amount': totals.exclusive,
            'VAT Amount': totals.vat,
        });

        const worksheet = XLSX.utils.json_to_sheet(dataToExport);
        worksheet['!cols'] = [{ wch: 12 }, { wch: 15 }, { wch: 40 }, { wch: 30 }, { wch: 15 }, { wch: 15 }, { wch: 15 }];
        
        Object.keys(worksheet).forEach(key => {
             if (/[E-G]\d+/.test(key)) {
                const cell = worksheet[key];
                if (cell.v !== null && typeof cell.v === 'number') {
                    cell.t = 'n';
                    cell.z = '#,##0.00';
                }
            }
        });

        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "VAT Transactions");
        const today = new Date().toISOString().split('T')[0];
        const fileName = `${client.companyName || client.name}-VAT-Transactions-${today}.xlsx`;
        XLSX.writeFile(workbook, fileName);
    };

    const handleClearVat = async () => {
        if (selectedTransactions.length === 0) return;
        
        setIsUpdating(true);
        toast({ title: "Updating Transactions...", description: "Setting VAT to 'No VAT'." });

        try {
            const batch = writeBatch(db);
            selectedTransactions.forEach(txId => {
                const txRef = doc(db, 'aiAccountantClients', client.id, 'transactions', txId);
                batch.update(txRef, { vatType: 'no_vat' });
            });
            await batch.commit();
            
            // Optimistically update local state
            setTransactions(prev => prev.map(tx => selectedTransactions.includes(tx.id) ? { ...tx, vatType: 'no_vat' } : tx));
            setSelectedTransactions([]);

            toast({ title: "VAT Cleared", description: `${selectedTransactions.length} transactions have been updated.` });

        } catch (error) {
            console.error("Error clearing VAT:", error);
            toast({ title: 'Update Failed', variant: 'destructive' });
        } finally {
            setIsUpdating(false);
        }
    };

    return (
        <>
            {selectedTransactions.length > 0 && (
                <div className="flex items-center gap-4 mb-4 p-3 bg-muted rounded-lg">
                    <p className="text-sm font-semibold">{selectedTransactions.length} transaction(s) selected.</p>
                    <Button size="sm" onClick={handleClearVat} disabled={isUpdating}>
                        {isUpdating ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Ban className="mr-2 h-4 w-4"/>}
                        Clear VAT on Selected
                    </Button>
                </div>
            )}
            <div className="max-h-[60vh] overflow-y-auto">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-12 p-0 text-center">
                                <Checkbox
                                    checked={selectedTransactions.length > 0 && selectedTransactions.length === vatTransactions.length}
                                    onCheckedChange={(checked) => {
                                        setSelectedTransactions(checked ? vatTransactions.map(tx => tx.id) : []);
                                    }}
                                />
                            </TableHead>
                            <TableHead>Date</TableHead>
                            <TableHead>Description</TableHead>
                            <TableHead>Reference</TableHead>
                            <TableHead>VAT Type</TableHead>
                            <TableHead className="text-right">Total</TableHead>
                            <TableHead className="text-right">Exclusive</TableHead>
                            <TableHead className="text-right">VAT</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {vatTransactions.length === 0 ? (
                            <TableRow><TableCell colSpan={8} className="text-center h-24 text-muted-foreground">No VAT transactions found for this period.</TableCell></TableRow>
                        ) : (
                            vatTransactions.map((tx, index) => (
                                <TableRow key={index} data-state={selectedTransactions.includes(tx.id) && "selected"}>
                                    <TableCell className="p-0 text-center">
                                         <Checkbox
                                            checked={selectedTransactions.includes(tx.id)}
                                            onCheckedChange={(checked) => {
                                                setSelectedTransactions(prev => 
                                                    checked ? [...prev, tx.id] : prev.filter(id => id !== tx.id)
                                                );
                                            }}
                                        />
                                    </TableCell>
                                    <TableCell>{format(new Date(tx.date), 'dd/MM/yyyy')}</TableCell>
                                    <TableCell>{tx.description}</TableCell>
                                    <TableCell>{tx.reference}</TableCell>
                                    <TableCell>{allVatTypes.find(v => v.name === tx.vatType)?.label || 'N/A'}</TableCell>
                                    <TableCell className="text-right font-mono">{formatPrice(tx.inclusiveAmount)}</TableCell>
                                    <TableCell className="text-right font-mono">{formatPrice(tx.exclusiveAmount)}</TableCell>
                                    <TableCell className="text-right font-mono">{formatPrice(tx.vatAmount)}</TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                    <TableFooterComponent>
                        <TableRow>
                            <TableCell colSpan={5} className="font-bold">Totals</TableCell>
                            <TableCell className="text-right font-bold font-mono">{formatPrice(totals.inclusive)}</TableCell>
                            <TableCell className="text-right font-bold font-mono">{formatPrice(totals.exclusive)}</TableCell>
                            <TableCell className="text-right font-bold font-mono">{formatPrice(totals.vat)}</TableCell>
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
    )
}


export default function VatTransactionsPage() {
    const params = useParams();
    const clientId = params.clientId as string;
    const [client, setClient] = useState<User | null>(null);
    const [transactions, setTransactions] = useState<(ImportedTransaction | AllocatedTransaction)[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);

    useEffect(() => {
        const fetchInitialData = async () => {
            if (!clientId) return;
            setIsLoading(true);
            try {
                const clientRef = doc(db, 'aiAccountantClients', clientId);
                const clientSnap = await getDoc(clientRef);
                if (clientSnap.exists()) setClient(clientSnap.data() as User);
            } catch(e) { console.error(e); }
            
            const transUnsubscribe = onSnapshot(query(collection(db, 'aiAccountantClients', clientId, 'transactions')), snapshot => {
                const fetched = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as (ImportedTransaction | AllocatedTransaction)));
                setTransactions(fetched);
                setIsLoading(false);
            });

            return () => transUnsubscribe();
        }
        fetchInitialData();
    }, [clientId]);

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

    return (
        <Card>
            <CardHeader>
                <CardTitle>VAT Transactions Report</CardTitle>
                <CardDescription>Review all transactions relevant to your VAT return for a specific period.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="space-y-6 max-w-4xl">
                     <div className="grid grid-cols-1 md:grid-cols-[150px_1fr] items-center gap-4">
                        <Label>Date Range</Label>
                        <DateRangePicker onDateChange={setDateRange} financialYearEnd={client?.yearEnd} />
                    </div>
                     <div className="flex justify-start pt-4">
                        {isLoading ? (
                            <Loader2 className="animate-spin" />
                        ) : client ? (
                            <Dialog>
                                <DialogTrigger asChild>
                                    <Button><Eye className="mr-2 h-4 w-4"/>View Report</Button>
                                </DialogTrigger>
                                <DialogContent className="sm:max-w-5xl">
                                    <DialogHeader className="text-center mb-4">
                                        <DialogTitle className="text-lg">{client.companyName || client.name}</DialogTitle>
                                        <DialogDescription>
                                            VAT Transactions {getReportDateString()}
                                        </DialogDescription>
                                    </DialogHeader>
                                    <VatTransactionsReport client={client} transactions={transactions} dateRange={dateRange} />
                                </DialogContent>
                            </Dialog>
                        ) : (
                            <p>Client data could not be loaded.</p>
                        )}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
