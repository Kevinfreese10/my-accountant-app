
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

const db = getFirestore(firebaseApp);

const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-ZA', {
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


const VAT201Field = ({ field, label, value, isVat = false }: { field: string, label: string, value: number, isVat?: boolean }) => (
    <div className="flex items-center justify-between p-3 border-b">
        <div className="flex items-center gap-4">
            <div className="font-mono text-sm bg-muted text-muted-foreground w-8 h-8 flex items-center justify-center rounded-md">{field}</div>
            <Label htmlFor={`field-${field}`} className="font-normal">{label}</Label>
        </div>
        <Input id={`field-${field}`} value={formatPrice(value)} readOnly className={`w-40 text-right font-mono ${isVat ? 'font-bold' : ''}`} />
    </div>
);

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

        vatTransactions.forEach(tx => {
            // For journal entries, amount is already exclusive. For bank tx, it's inclusive.
            const isJournal = tx.bankAccountId === 'JOURNAL';
            let exclusiveAmount = 0;

            if(isJournal) {
                exclusiveAmount = tx.amount;
            } else {
                 const isStandardRate = tx.vatType === 'standard_rated_purchases' || tx.vatType === 'standard_rated_sales' || tx.vatType === 'capital_goods_purchases';
                 exclusiveAmount = isStandardRate ? tx.amount / 1.15 : tx.amount;
            }
            
            switch (tx.vatType) {
                case 'standard_rated_sales': totalStandardSales += -exclusiveAmount; break; // sales are credits
                case 'zero_rated_sales': totalZeroSales += -exclusiveAmount; break;
                case 'exempt_sales': totalExemptSales += -exclusiveAmount; break;
                case 'capital_goods_purchases': totalCapitalPurchases += exclusiveAmount; break;
                case 'standard_rated_purchases': totalOtherPurchases += exclusiveAmount; break;
            }
        });

        const outputVat = totalStandardSales * 0.15;
        const inputVatCapital = totalCapitalPurchases * 0.15;
        const inputVatOther = totalOtherPurchases * 0.15;
        const totalInputVat = inputVatCapital + inputVatOther;
        const vatPayable = outputVat - totalInputVat;

        return {
            field1: totalStandardSales,
            field1A: outputVat,
            field2: totalZeroSales,
            field3: totalExemptSales,
            field4: 0, // Manual for now
            totalOutput: outputVat,
            field14: totalCapitalPurchases,
            field14A: inputVatCapital,
            field15: totalOtherPurchases,
            field15A: inputVatOther,
            field16: 0, // Manual for now
            totalInput: totalInputVat,
            vatPayable: vatPayable,
        };
    }, [transactions, parsedPeriod]);

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
                        
                        {vatData && (
                            <div className="space-y-8 pt-4">
                                
                                <div className="border rounded-lg">
                                    <div className="p-4 bg-muted/50 rounded-t-lg">
                                        <h3 className="font-semibold">1. Output Tax (Sales)</h3>
                                    </div>
                                    <VAT201Field field="1" label="Total value of standard-rated supplies" value={vatData.field1} />
                                    <VAT201Field field="1A" label="VAT on standard-rated supplies" value={vatData.field1A} isVat />
                                    <VAT201Field field="2" label="Value of zero-rated supplies" value={vatData.field2} />
                                    <VAT201Field field="3" label="Value of exempt supplies" value={vatData.field3} />
                                    <VAT201Field field="4" label="Adjustments (e.g. recoupments)" value={vatData.field4} />
                                </div>
                                
                                <div className="border rounded-lg">
                                     <div className="p-4 bg-muted/50 rounded-t-lg">
                                        <h3 className="font-semibold">2. Input Tax (Purchases)</h3>
                                    </div>
                                    <VAT201Field field="14" label="Value of capital goods" value={vatData.field14} />
                                    <VAT201Field field="14A" label="VAT on capital goods" value={vatData.field14A} isVat />
                                    <VAT201Field field="15" label="Value of other goods & services" value={vatData.field15} />
                                    <VAT201Field field="15A" label="VAT on other goods & services" value={vatData.field15A} isVat />
                                    <VAT201Field field="16" label="Adjustments" value={vatData.field16} />
                                </div>

                                <div className="border rounded-lg">
                                     <div className="p-4 bg-muted/50 rounded-t-lg">
                                        <h3 className="font-semibold">3. VAT Payable / Refund Calculation</h3>
                                    </div>
                                    <VAT201Field field="18" label="Total Output Tax" value={vatData.totalOutput} isVat/>
                                    <VAT201Field field="19" label="Total Input Tax" value={vatData.totalInput} isVat/>
                                    <div className={`flex items-center justify-between p-3 ${vatData.vatPayable >= 0 ? 'bg-destructive/10' : 'bg-green-500/10'}`}>
                                        <div className="flex items-center gap-4">
                                            <div className="font-mono text-sm bg-background text-foreground w-8 h-8 flex items-center justify-center rounded-md">20</div>
                                            <Label className="font-bold">{vatData.vatPayable >= 0 ? 'VAT Payable' : 'VAT Refundable'}</Label>
                                        </div>
                                        <Input value={formatPrice(Math.abs(vatData.vatPayable))} readOnly className="w-40 text-right font-mono font-bold" />
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

