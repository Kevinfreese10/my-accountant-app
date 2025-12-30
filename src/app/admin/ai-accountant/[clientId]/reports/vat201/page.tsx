
'use client';

import * as React from "react"
import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { User, AllocatedTransaction, ImportedTransaction, ChartOfAccount } from '@/lib/types';
import { getFirestore, doc, getDoc, collection, query, onSnapshot, writeBatch, Timestamp } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { Loader2, Download, Eye, Calculator } from "lucide-react";
import { useParams, useRouter } from 'next/navigation';
import { format, startOfMonth, endOfMonth, subMonths, getMonth, parseISO } from 'date-fns';
import * as XLSX from 'xlsx';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useToast } from "@/hooks/use-toast";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter as TableFooterComponent } from "@/components/ui/table";
import { Input } from "@/components/ui/input";

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
        
        for (let i = 0; i < 6; i++) {
             const periodEndDate = endOfMonth(subMonths(now, i * 2));
             
             let start, end;
             
             if(isCatA){ // Jan, Mar, May, Jul, Sep, Nov
                 if( (getMonth(periodEndDate)+1) % 2 !== 0){
                     start = startOfMonth(subMonths(periodEndDate, 1));
                     end = periodEndDate;
                 } else {
                     start = startOfMonth(subMonths(periodEndDate, 2));
                     end = endOfMonth(subMonths(periodEndDate, 1));
                 }
             } else { // Feb, Apr, Jun, Aug, Oct, Dec
                  if( (getMonth(periodEndDate)+1) % 2 === 0){
                     start = startOfMonth(subMonths(periodEndDate, 1));
                     end = periodEndDate;
                 } else {
                     start = startOfMonth(subMonths(periodEndDate, 2));
                     end = endOfMonth(subMonths(periodEndDate, 1));
                 }
             }

            const label = `${format(start, 'MMM')} / ${format(end, 'MMM yyyy')}`;
            periods.push({
                label,
                from: start,
                to: end,
            });
        }
    }
    return periods;
};

function TransactionDrilldown({ transactions, client }: { transactions: any[], client: User | null }) {
    if (!client) return null;
  
    const getAccountDescription = (accountId?: string) => {
      if (!accountId) return 'N/A';
      return client.chartOfAccounts?.find(acc => acc.id === accountId)?.description || accountId;
    };

    const sortedTransactions = [...transactions].sort((a, b) => Math.abs(b.vatAmount) - Math.abs(a.vatAmount));
  
    return (
        <div className="p-4 bg-muted/50">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Allocated To</TableHead>
                <TableHead className="text-right">Exclusive</TableHead>
                <TableHead className="text-right">VAT</TableHead>
                <TableHead className="text-right">Total (Incl.)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedTransactions.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center">No transactions</TableCell></TableRow>
              ) : (
                sortedTransactions.map((tx, i) => (
                  <TableRow key={i}>
                    <TableCell>{tx.date ? format(new Date(tx.date), 'dd/MM/yyyy') : 'N/A'}</TableCell>
                    <TableCell>{tx.description}</TableCell>
                    <TableCell>{getAccountDescription(tx.allocatedTo?.value)}</TableCell>
                    <TableCell className="text-right font-mono">{formatPrice(tx.exclusiveAmount || 0)}</TableCell>
                    <TableCell className="text-right font-mono">{formatPrice(tx.vatAmount || 0)}</TableCell>
                    <TableCell className="text-right font-mono">{formatPrice(tx.inclusiveAmount || 0)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
    );
}

const VAT201Field = ({ field, label, value, isVat = false, children }: { field: string, label: string, value: number, isVat?: boolean, children: React.ReactNode }) => {
    return (
        <AccordionItem value={`item-${field}`}>
            <div className="flex items-center justify-between p-3 border-b">
                <div className="flex items-center gap-4">
                    <div className="font-mono text-sm bg-muted text-muted-foreground w-8 h-8 flex items-center justify-center rounded-md">{field}</div>
                    <Label htmlFor={`field-${field}`} className="font-normal">{label}</Label>
                </div>
                <AccordionTrigger>
                    <span className={`font-mono text-base ${isVat ? 'font-bold' : ''}`}>{formatPrice(value)}</span>
                </AccordionTrigger>
            </div>
            <AccordionContent>
                {children}
            </AccordionContent>
        </AccordionItem>
    );
}

export default function Vat201ReportPage() {
    const params = useParams();
    const router = useRouter();
    const clientId = params.clientId as string;

    const [client, setClient] = useState<User | null>(null);
    const [transactions, setTransactions] = useState<(ImportedTransaction | AllocatedTransaction)[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [vatPeriods, setVatPeriods] = useState<{ label: string; from: Date; to: Date; }[]>([]);
    const [selectedPeriod, setSelectedPeriod] = useState<string | undefined>();
    const { toast } = useToast();
    
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

    const vatData = useMemo(() => {
        if (!parsedPeriod || !transactions) {
            return null;
        }
        
        const fromDate = parseISO(parsedPeriod.from);
        const toDate = parseISO(parsedPeriod.to);

        const vatTransactions = transactions.filter(tx => {
            const txDate = tx.date instanceof Date ? tx.date : new Date(tx.date);
            return txDate >= fromDate && txDate <= toDate && tx.status === 'allocated';
        });
        
        let totalStandardSales = 0;
        let totalZeroSales = 0;
        let totalExemptSales = 0;
        let totalCapitalPurchases = 0;
        let totalOtherPurchases = 0;
        
        let outputVat = 0;
        
        let standardSalesTxs: any[] = [], zeroSalesTxs: any[] = [], exemptSalesTxs: any[] = [], capitalPurchasesTxs: any[] = [], otherPurchasesTxs: any[] = [];

        vatTransactions.forEach(tx => {
            const isJournal = tx.bankAccountId === 'JOURNAL';
            const isStandardRate = tx.vatType === 'standard_rated_sales' || tx.vatType === 'standard_rated_purchases' || tx.vatType === 'capital_goods_purchases';
            const vatRate = isStandardRate ? 0.15 : 0;
            
            let exclusiveAmount, inclusiveAmount, vatAmount;

            if (isJournal) {
                exclusiveAmount = tx.amount;
                inclusiveAmount = isStandardRate ? tx.amount * (1 + vatRate) : tx.amount;
                vatAmount = inclusiveAmount - exclusiveAmount;
            } else {
                inclusiveAmount = tx.amount;
                exclusiveAmount = isStandardRate ? inclusiveAmount / (1 + vatRate) : inclusiveAmount;
                vatAmount = inclusiveAmount - exclusiveAmount;
            }
            
            const transactionDetails = {
                ...tx,
                inclusiveAmount: inclusiveAmount,
                exclusiveAmount: exclusiveAmount,
                vatAmount: vatAmount,
            };

            switch (tx.vatType) {
                case 'standard_rated_sales': 
                    totalStandardSales += inclusiveAmount;
                    outputVat += vatAmount;
                    standardSalesTxs.push(transactionDetails);
                    break;
                case 'zero_rated_sales': 
                    totalZeroSales += exclusiveAmount;
                    zeroSalesTxs.push(transactionDetails);
                    break;
                case 'exempt_sales': 
                    totalExemptSales += exclusiveAmount; 
                    exemptSalesTxs.push(transactionDetails);
                    break;
                case 'capital_goods_purchases': 
                    totalCapitalPurchases += exclusiveAmount;
                    capitalPurchasesTxs.push(transactionDetails);
                    break;
                case 'standard_rated_purchases': 
                    totalOtherPurchases += exclusiveAmount;
                    otherPurchasesTxs.push(transactionDetails);
                    break;
            }
        });

        const inputVatCapital = totalCapitalPurchases * 0.15;
        const inputVatOther = totalOtherPurchases * 0.15;
        const totalInputVat = Math.abs(inputVatCapital + inputVatOther);
        const vatPayable = outputVat - totalInputVat;


        return {
            field1: { value: totalStandardSales, txs: standardSalesTxs },
            field1A: { value: outputVat, txs: standardSalesTxs },
            field2: { value: totalZeroSales, txs: zeroSalesTxs },
            field3: { value: totalExemptSales, txs: exemptSalesTxs },
            field4: { value: 0, txs: [] }, // Manual for now
            totalOutput: { value: outputVat, txs: standardSalesTxs },
            field14: { value: totalCapitalPurchases, txs: capitalPurchasesTxs },
            field14A: { value: inputVatCapital, txs: capitalPurchasesTxs },
            field15: { value: totalOtherPurchases, txs: otherPurchasesTxs },
            field15A: { value: inputVatOther, txs: otherPurchasesTxs },
            field16: { value: 0, txs: [] }, // Manual for now
            totalInput: { value: totalInputVat, txs: [...capitalPurchasesTxs, ...otherPurchasesTxs] },
            vatPayable: { value: vatPayable, txs: [] },
        };
    }, [transactions, parsedPeriod]);

    const handleDownloadExcel = () => {
        if (!vatData || !client) return;

        const wb = XLSX.utils.book_new();

        const summaryData = [
            { Field: 'VAT201 Summary', Value: '' },
            { Field: '1. Standard-rated supplies (Incl. VAT)', Value: vatData.field1.value },
            { Field: '1A. VAT on standard-rated supplies', Value: vatData.field1A.value },
            { Field: '2. Zero-rated supplies', Value: vatData.field2.value },
            { Field: '3. Exempt supplies', Value: vatData.field3.value },
            { Field: '4. Adjustments', Value: vatData.field4.value },
            { Field: 'Total Output Tax', Value: vatData.totalOutput.value },
            {},
            { Field: '14. Capital goods', Value: vatData.field14.value },
            { Field: '14A. VAT on capital goods', Value: vatData.field14A.value },
            { Field: '15. Other goods & services', Value: vatData.field15.value },
            { Field: '15A. VAT on other goods & services', Value: vatData.field15A.value },
            { Field: '16. Adjustments', Value: vatData.field16.value },
            { Field: 'Total Input Tax', Value: vatData.totalInput.value },
            {},
            { Field: 'VAT Payable / (Refundable)', Value: vatData.vatPayable.value },
        ];
        const summarySheet = XLSX.utils.json_to_sheet(summaryData, { skipHeader: true });
        XLSX.utils.book_append_sheet(wb, summarySheet, 'VAT201 Summary');

        const createSheet = (title: string, transactions: any[]) => {
            if (transactions.length === 0) return;
            const data = transactions.map(tx => ({
                Date: tx.date ? format(new Date(tx.date), 'dd/MM/yyyy') : 'N/A',
                Description: tx.description,
                'Allocated To': client.chartOfAccounts?.find(acc => acc.id === tx.allocatedTo?.value)?.description || 'N/A',
                'Exclusive': tx.exclusiveAmount,
                'VAT': tx.vatAmount,
                'Inclusive': tx.inclusiveAmount,
            }));
            const sheet = XLSX.utils.json_to_sheet(data);
            XLSX.utils.book_append_sheet(wb, sheet, title);
        };
        
        createSheet('Standard Sales', vatData.field1.txs);
        createSheet('Capital Purchases', vatData.field14.txs);
        createSheet('Other Purchases', vatData.field15.txs);

        XLSX.writeFile(wb, `VAT201-Report-${client.name.replace(/\s/g, '_')}.xlsx`);
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>VAT201 Report</CardTitle>
                <CardDescription>Select a VAT period to view a calculated VAT201 return.</CardDescription>
            </CardHeader>
            <CardContent>
                 {isLoading ? (
                    <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /><span>Loading client data...</span></div>
                ) : !client?.isVatRegistered ? (
                    <p className="text-destructive">This client is not registered for VAT.</p>
                ) : (
                    <div className="space-y-6">
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
                        
                        {vatData && client && (
                            <>
                            <div className="space-y-8 pt-4">
                                <Accordion type="single" collapsible className="w-full">
                                    <div className="border rounded-lg">
                                        <div className="p-4 bg-muted/50 rounded-t-lg">
                                            <h3 className="font-semibold">1. Output Tax (Sales)</h3>
                                        </div>
                                        <VAT201Field field="1" label="Total value of standard-rated supplies (Incl. VAT)" value={vatData.field1.value}>
                                            <TransactionDrilldown transactions={vatData.field1.txs} client={client} />
                                        </VAT201Field>
                                        <VAT201Field field="1A" label="VAT on standard-rated supplies" value={vatData.field1A.value} isVat>
                                            <TransactionDrilldown transactions={vatData.field1A.txs} client={client} />
                                        </VAT201Field>
                                        <VAT201Field field="2" label="Value of zero-rated supplies" value={vatData.field2.value}>
                                            <TransactionDrilldown transactions={vatData.field2.txs} client={client} />
                                        </VAT201Field>
                                        <VAT201Field field="3" label="Value of exempt supplies" value={vatData.field3.value}>
                                            <TransactionDrilldown transactions={vatData.field3.txs} client={client} />
                                        </VAT201Field>
                                        <VAT201Field field="4" label="Adjustments (e.g. recoupments)" value={vatData.field4.value}>
                                            <TransactionDrilldown transactions={vatData.field4.txs} client={client} />
                                        </VAT201Field>
                                    </div>
                                    
                                    <div className="border rounded-lg">
                                        <div className="p-4 bg-muted/50 rounded-t-lg">
                                            <h3 className="font-semibold">2. Input Tax (Purchases)</h3>
                                        </div>
                                        <VAT201Field field="14" label="Value of capital goods" value={vatData.field14.value}>
                                             <TransactionDrilldown transactions={vatData.field14.txs} client={client} />
                                        </VAT201Field>
                                        <VAT201Field field="14A" label="VAT on capital goods" value={vatData.field14A.value} isVat>
                                             <TransactionDrilldown transactions={vatData.field14A.txs} client={client} />
                                        </VAT201Field>
                                        <VAT201Field field="15" label="Value of other goods & services" value={vatData.field15.value}>
                                            <TransactionDrilldown transactions={vatData.field15.txs} client={client} />
                                        </VAT201Field>
                                        <VAT201Field field="15A" label="VAT on other goods & services" value={vatData.field15A.value} isVat>
                                            <TransactionDrilldown transactions={vatData.field15A.txs} client={client} />
                                        </VAT201Field>
                                        <VAT201Field field="16" label="Adjustments" value={vatData.field16.value}>
                                             <TransactionDrilldown transactions={vatData.field16.txs} client={client} />
                                        </VAT201Field>
                                    </div>

                                    <div className="border rounded-lg">
                                        <div className="p-4 bg-muted/50 rounded-t-lg">
                                            <h3 className="font-semibold">3. VAT Payable / Refund Calculation</h3>
                                        </div>
                                        <VAT201Field field="18" label="Total Output Tax" value={vatData.totalOutput.value} isVat>
                                            <TransactionDrilldown transactions={vatData.totalOutput.txs} client={client} />
                                        </VAT201Field>
                                        <VAT201Field field="19" label="Total Input Tax" value={vatData.totalInput.value} isVat>
                                            <TransactionDrilldown transactions={vatData.totalInput.txs} client={client} />
                                        </VAT201Field>
                                        <div className={`flex items-center justify-between p-3 ${vatData.vatPayable.value >= 0 ? 'bg-destructive/10' : 'bg-green-500/10'}`}>
                                            <div className="flex items-center gap-4">
                                                <div className="font-mono text-sm bg-background text-foreground w-8 h-8 flex items-center justify-center rounded-md">20</div>
                                                <Label className="font-bold">{vatData.vatPayable.value >= 0 ? 'VAT Payable' : 'VAT Refundable'}</Label>
                                            </div>
                                            <Input value={formatPrice(Math.abs(vatData.vatPayable.value))} readOnly className="w-40 text-right font-mono font-bold" />
                                        </div>
                                    </div>
                                </Accordion>
                            </div>
                            <CardFooter className="gap-2">
                                 <Button onClick={handleDownloadExcel} variant="outline">
                                    <Download className="mr-2 h-4 w-4" />
                                    Download Excel
                                </Button>
                            </CardFooter>
                            </>
                        )}

                    </div>
                )}
            </CardContent>
        </Card>
    );
}
