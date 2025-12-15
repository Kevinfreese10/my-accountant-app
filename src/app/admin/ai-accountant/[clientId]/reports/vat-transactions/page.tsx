

'use client';

import * as React from "react"
import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Download, Eye } from "lucide-react";
import { useParams } from 'next/navigation';
import { getFirestore, doc, getDoc, collection, onSnapshot, query } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { User, AllocatedTransaction, ImportedTransaction, ChartOfAccount } from '@/lib/types';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter as TableFooterComponent } from "@/components/ui/table";
import { format, startOfDay, endOfDay } from 'date-fns';
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { DateRange } from "react-day-picker";
import * as XLSX from 'xlsx';
import { allVatTypes } from "@/lib/vat-types";

const db = getFirestore(firebaseApp);

const formatPrice = (price: number) => {
    if (price === 0) return '0.00';
    return new Intl.NumberFormat('en-GB', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(price);
};

function VatTransactionsReport({ client, transactions, dateRange }: { client: User, transactions: (ImportedTransaction | AllocatedTransaction)[], dateRange?: DateRange }) {

    const vatTransactions = useMemo(() => {
        const reportStartDate = dateRange?.from ? startOfDay(dateRange.from) : new Date(0);
        const reportEndDate = dateRange?.to ? endOfDay(dateRange.to) : new Date();

        return transactions
            .filter(tx => {
                const txDate = new Date(tx.date);
                const isWithinRange = txDate >= reportStartDate && txDate <= reportEndDate;
                const isVatApplicable = tx.vatType && tx.vatType !== 'no_vat' && tx.vatType !== 'exempt_purchases' && tx.vatType !== 'exempt_sales';
                return isWithinRange && isVatApplicable;
            })
            .map(tx => {
                const isStandardRate = tx.vatType === 'standard_rated_purchases' || tx.vatType === 'standard_rated_sales' || tx.vatType === 'capital_goods_purchases';
                const vatRate = isStandardRate ? 0.15 : 0;
                
                // For journal entries, amount is already exclusive. For bank tx, it's inclusive.
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

    return (
        <>
            <div className="max-h-[70vh] overflow-y-auto">
                <Table>
                    <TableHeader>
                        <TableRow>
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
                            <TableRow><TableCell colSpan={7} className="text-center h-24 text-muted-foreground">No VAT transactions found for this period.</TableCell></TableRow>
                        ) : (
                            vatTransactions.map((tx, index) => (
                                <TableRow key={index}>
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
                            <TableCell colSpan={4} className="font-bold">Totals</TableCell>
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
                        <p className="text-sm font-medium">Date Range</p>
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
                                <DialogContent className="sm:max-w-4xl">
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
