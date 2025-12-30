
'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { User, AllocatedTransaction, ImportedTransaction, VatType } from "@/lib/types";
import { getFirestore, doc, getDoc, collection, query, onSnapshot } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { Loader2, Download, Eye, Calculator } from "lucide-react";
import { useParams } from 'next/navigation';
import { format, startOfMonth, endOfMonth, subMonths, getMonth, parseISO } from 'date-fns';
import * as XLSX from 'xlsx';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

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
        let currentMonth = getMonth(now);
        
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

const VAT201Field = ({ field, label, value, isVat = false, transactions, client }: { field: string, label: string, value: number, isVat?: boolean, transactions: (ImportedTransaction | AllocatedTransaction)[], client: User | null }) => {
    const [isOpen, setIsOpen] = useState(false);

    const getAccountDescription = (accountId?: string) => {
        if (!accountId || !client?.chartOfAccounts) return 'N/A';
        return client.chartOfAccounts.find(acc => acc.id === accountId)?.description || accountId;
    }

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <div className="flex items-center justify-between p-3 border-b">
                <div className="flex items-center gap-4">
                    <div className="font-mono text-sm bg-muted text-muted-foreground w-8 h-8 flex items-center justify-center rounded-md">{field}</div>
                    <Label htmlFor={`field-${field}`} className="font-normal">{label}</Label>
                </div>
                <DialogTrigger asChild>
                    <Button variant="link" className={`h-auto p-0 font-mono text-base ${isVat ? 'font-bold' : ''}`}>
                        {formatPrice(value)}
                    </Button>
                </DialogTrigger>
            </div>
             <DialogContent className="max-w-3xl">
                <DialogHeader>
                    <DialogTitle>Transactions for: {label}</DialogTitle>
                </DialogHeader>
                <div className="max-h-[60vh] overflow-y-auto">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Date</TableHead>
                                <TableHead>Description</TableHead>
                                <TableHead>Allocated To</TableHead>
                                <TableHead className="text-right">Amount</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {transactions.length === 0 ? (
                                <TableRow><TableCell colSpan={4} className="text-center">No transactions</TableCell></TableRow>
                            ) : (
                                transactions.map((tx, i) => (
                                    <TableRow key={i}>
                                        <TableCell>{tx.date ? format(new Date(tx.date), 'dd/MM/yyyy') : 'N/A'}</TableCell>
                                        <TableCell>{tx.description}</TableCell>
                                        <TableCell>{getAccountDescription(tx.allocatedTo?.value)}</TableCell>
                                        <TableCell className="text-right">{formatPrice(tx.amount)}</TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>
            </DialogContent>
        </Dialog>
    );
}

export default function Vat201ReportPage() {
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
        
        let totalStandardSales = 0, totalZeroSales = 0, totalExemptSales = 0;
        let totalCapitalPurchases = 0, totalOtherPurchases = 0;
        
        let standardSalesTxs: (ImportedTransaction | AllocatedTransaction)[] = [];
        let zeroSalesTxs: (ImportedTransaction | AllocatedTransaction)[] = [];
        let exemptSalesTxs: (ImportedTransaction | AllocatedTransaction)[] = [];
        let capitalPurchasesTxs: (ImportedTransaction | AllocatedTransaction)[] = [];
        let otherPurchasesTxs: (ImportedTransaction | AllocatedTransaction)[] = [];

        vatTransactions.forEach(tx => {
            const isJournal = tx.bankAccountId === 'JOURNAL';
            let exclusiveAmount = 0;
            let inclusiveAmount = tx.amount;

            if(isJournal) {
                const isStandardRate = tx.vatType === 'standard_rated_sales' || tx.vatType === 'standard_rated_purchases' || tx.vatType === 'capital_goods_purchases';
                exclusiveAmount = tx.amount;
                if (isStandardRate) {
                    inclusiveAmount = exclusiveAmount * 1.15;
                }
            } else {
                 const isStandardRate = tx.vatType === 'standard_rated_purchases' || tx.vatType === 'standard_rated_sales' || tx.vatType === 'capital_goods_purchases';
                 exclusiveAmount = isStandardRate ? tx.amount / 1.15 : tx.amount;
            }
            
            switch (tx.vatType) {
                case 'standard_rated_sales': 
                    totalStandardSales += -inclusiveAmount;
                    standardSalesTxs.push({ ...tx, amount: -tx.amount });
                    break;
                case 'zero_rated_sales': 
                    totalZeroSales += -exclusiveAmount;
                    zeroSalesTxs.push({ ...tx, amount: -tx.amount });
                    break;
                case 'exempt_sales': 
                    totalExemptSales += -exclusiveAmount; 
                    exemptSalesTxs.push({ ...tx, amount: -tx.amount });
                    break;
                case 'capital_goods_purchases': 
                    totalCapitalPurchases += exclusiveAmount;
                    capitalPurchasesTxs.push(tx);
                    break;
                case 'standard_rated_purchases': 
                    totalOtherPurchases += exclusiveAmount;
                    otherPurchasesTxs.push(tx);
                    break;
            }
        });

        const outputVat = totalStandardSales / 1.15 * 0.15;
        const inputVatCapital = totalCapitalPurchases * 0.15;
        const inputVatOther = totalOtherPurchases * 0.15;
        const totalInputVat = inputVatCapital + inputVatOther;
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
    }, [transactions, parsedPeriod, client]);

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
                            <div className="space-y-8 pt-4">
                                
                                <div className="border rounded-lg">
                                    <div className="p-4 bg-muted/50 rounded-t-lg">
                                        <h3 className="font-semibold">1. Output Tax (Sales)</h3>
                                    </div>
                                    <VAT201Field client={client} field="1" label="Total value of standard-rated supplies" value={vatData.field1.value} transactions={vatData.field1.txs}/>
                                    <VAT201Field client={client} field="1A" label="VAT on standard-rated supplies" value={vatData.field1A.value} transactions={vatData.field1A.txs} isVat />
                                    <VAT201Field client={client} field="2" label="Value of zero-rated supplies" value={vatData.field2.value} transactions={vatData.field2.txs}/>
                                    <VAT201Field client={client} field="3" label="Value of exempt supplies" value={vatData.field3.value} transactions={vatData.field3.txs}/>
                                    <VAT201Field client={client} field="4" label="Adjustments (e.g. recoupments)" value={vatData.field4.value} transactions={vatData.field4.txs}/>
                                </div>
                                
                                <div className="border rounded-lg">
                                     <div className="p-4 bg-muted/50 rounded-t-lg">
                                        <h3 className="font-semibold">2. Input Tax (Purchases)</h3>
                                    </div>
                                    <VAT201Field client={client} field="14" label="Value of capital goods" value={vatData.field14.value} transactions={vatData.field14.txs}/>
                                    <VAT201Field client={client} field="14A" label="VAT on capital goods" value={vatData.field14A.value} transactions={vatData.field14A.txs} isVat />
                                    <VAT201Field client={client} field="15" label="Value of other goods & services" value={vatData.field15.value} transactions={vatData.field15.txs}/>
                                    <VAT201Field client={client} field="15A" label="VAT on other goods & services" value={vatData.field15A.value} transactions={vatData.field15A.txs} isVat />
                                    <VAT201Field client={client} field="16" label="Adjustments" value={vatData.field16.value} transactions={vatData.field16.txs}/>
                                </div>

                                <div className="border rounded-lg">
                                     <div className="p-4 bg-muted/50 rounded-t-lg">
                                        <h3 className="font-semibold">3. VAT Payable / Refund Calculation</h3>
                                    </div>
                                    <VAT201Field client={client} field="18" label="Total Output Tax" value={vatData.totalOutput.value} transactions={vatData.totalOutput.txs} isVat/>
                                    <VAT201Field client={client} field="19" label="Total Input Tax" value={vatData.totalInput.value} transactions={vatData.totalInput.txs} isVat/>
                                    <div className={`flex items-center justify-between p-3 ${vatData.vatPayable.value >= 0 ? 'bg-destructive/10' : 'bg-green-500/10'}`}>
                                        <div className="flex items-center gap-4">
                                            <div className="font-mono text-sm bg-background text-foreground w-8 h-8 flex items-center justify-center rounded-md">20</div>
                                            <Label className="font-bold">{vatData.vatPayable.value >= 0 ? 'VAT Payable' : 'VAT Refundable'}</Label>
                                        </div>
                                        <Input value={formatPrice(Math.abs(vatData.vatPayable.value))} readOnly className="w-40 text-right font-mono font-bold" />
                                    </div>
                                </div>
                                
                            </div>
                        )}

                    </div>
                )}
            </CardContent>
        </Card>
    );
}
