
'use client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useState, useEffect, useMemo } from "react";
import { User, ChartOfAccount, AllocatedTransaction, ImportedTransaction, VatType } from "@/lib/types";
import { getFirestore, doc, getDoc, collection, query, onSnapshot, updateDoc, writeBatch, deleteDoc, where, getDocs } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { Loader2, Download, Eye, Edit, Trash2, Search, FileWarning, Scale } from "lucide-react";
import { useParams, useSearchParams } from 'next/navigation';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { format } from 'date-fns';
import { useToast } from "@/hooks/use-toast";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList, CommandGroup } from "@/components/ui/command";

const db = getFirestore(firebaseApp);

const formatPrice = (price: number) => {
    if (price === 0) return 'R 0.00';
    return new Intl.NumberFormat('en-ZA', {
      style: 'currency',
      currency: 'ZAR',
    }).format(price);
};

function UnbalancedTransactionsView({ transactions, accounts }: { transactions: (ImportedTransaction | AllocatedTransaction)[], accounts: ChartOfAccount[] }) {
    
    const unbalancedGroups = useMemo(() => {
        const groups: { [key: string]: { debit: number, credit: number, transactions: any[] } } = {};

        transactions.forEach(tx => {
            const ref = tx.reference;
            if (!ref) return;

            if (!groups[ref]) {
                groups[ref] = { debit: 0, credit: 0, transactions: [] };
            }
            
            const account = accounts.find(a => a.id === tx.allocatedTo?.value);

            const txDetail = {
                id: tx.id,
                date: tx.date,
                description: tx.description,
                accountName: account?.description || 'Unknown',
                amount: tx.amount,
            };

            if (tx.amount > 0) {
                groups[ref].debit += tx.amount;
            } else {
                groups[ref].credit += -tx.amount;
            }
            groups[ref].transactions.push(txDetail);
        });

        return Object.entries(groups)
            .filter(([ref, group]) => Math.abs(group.debit - group.credit) >= 0.01)
            .sort((a,b) => b[1].transactions[0].date.localeCompare(a[1].transactions[0].date));

    }, [transactions, accounts]);

    if (unbalancedGroups.length === 0) {
        return (
             <div className="flex flex-col items-center justify-center h-64 text-center text-muted-foreground border-2 border-dashed rounded-lg p-4">
                <Scale className="h-10 w-10 mb-4" />
                <p className="font-semibold">No Imbalances Found</p>
                <p className="text-sm mt-2">All transaction groups in this account are balanced.</p>
              </div>
        )
    }

    return (
        <div className="space-y-6">
            {unbalancedGroups.map(([ref, group]) => (
                <Card key={ref}>
                    <CardHeader>
                        <CardTitle className="flex justify-between items-center">
                            <span>Reference: {ref}</span>
                            <Badge variant="destructive">Imbalance: {formatPrice(group.debit - group.credit)}</Badge>
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                         <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Date</TableHead>
                                    <TableHead>Description</TableHead>
                                    <TableHead>Account</TableHead>
                                    <TableHead className="text-right">Debit</TableHead>
                                    <TableHead className="text-right">Credit</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {group.transactions.map(tx => (
                                    <TableRow key={tx.id}>
                                        <TableCell>{format(new Date(tx.date), 'dd/MM/yyyy')}</TableCell>
                                        <TableCell>{tx.description}</TableCell>
                                        <TableCell>{tx.accountName}</TableCell>
                                        <TableCell className="text-right font-mono">{tx.amount > 0 ? formatPrice(tx.amount) : ''}</TableCell>
                                        <TableCell className="text-right font-mono">{tx.amount < 0 ? formatPrice(-tx.amount) : ''}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                             <TableFooter>
                                <TableRow>
                                    <TableCell colSpan={3} className="font-bold">Totals</TableCell>
                                    <TableCell className="text-right font-bold font-mono">{formatPrice(group.debit)}</TableCell>
                                    <TableCell className="text-right font-bold font-mono">{formatPrice(group.credit)}</TableCell>
                                </TableRow>
                             </TableFooter>
                        </Table>
                    </CardContent>
                </Card>
            ))}
        </div>
    );
}

export default function GeneralLedgerReconPage() {
    const params = useParams();
    const clientId = params.clientId as string;
    const [client, setClient] = useState<User | null>(null);
    const [transactions, setTransactions] = useState<(ImportedTransaction | AllocatedTransaction)[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedAccountId, setSelectedAccountId] = useState<string | undefined>();
    const [isReportVisible, setIsReportVisible] = useState(false);
    
    useEffect(() => {
        const fetchInitialData = async () => {
            if (!clientId) return;
            setIsLoading(true);
            try {
                const clientRef = doc(db, 'aiAccountantClients', clientId);
                const clientSnap = await getDoc(clientRef);
                if (clientSnap.exists()) {
                    setClient({ id: clientSnap.id, ...clientSnap.data() } as User);
                }
            } catch (e) {
                console.error("Error fetching client data:", e);
            } finally {
                setIsLoading(false);
            }
        };
        fetchInitialData();
    }, [clientId]);

    const accountTransactions = useMemo(() => {
        if (!selectedAccountId) return [];
        return transactions.filter(tx => tx.allocatedTo?.value === selectedAccountId);
    }, [transactions, selectedAccountId]);
    
    const accounts = useMemo(() => client?.chartOfAccounts?.sort((a,b) => a.accountNumber.localeCompare(b.accountNumber)) || [], [client]);
    
    const handleViewReport = () => {
        if(!selectedAccountId) return;
        
        setIsLoading(true);
         const transUnsubscribe = onSnapshot(query(collection(db, 'aiAccountantClients', clientId, 'transactions'), where('allocatedTo.value', '==', selectedAccountId)), snapshot => {
            const fetched = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as (ImportedTransaction | AllocatedTransaction)));
            setTransactions(fetched);
            setIsReportVisible(true);
            setIsLoading(false);
        });
        
        return () => transUnsubscribe();
    }
    
    return (
        <div className="space-y-6">
             <Card>
                <CardHeader>
                    <CardTitle>General Ledger Reconciliation</CardTitle>
                    <CardDescription>Select an account to view and reconcile transactions, highlighting any imbalances.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                     <div className="flex flex-col sm:flex-row items-end gap-4">
                         <div className="grid gap-1.5 flex-grow">
                             <Label>Account to Reconcile</Label>
                                <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
                                    <SelectTrigger><SelectValue placeholder="Select an account..." /></SelectTrigger>
                                    <SelectContent>
                                        <Command>
                                            <CommandInput placeholder="Search account..." />
                                            <CommandList>
                                                <CommandEmpty>No account found.</CommandEmpty>
                                                {accounts.map(acc => (
                                                     <CommandItem key={acc.id} onSelect={() => setSelectedAccountId(acc.id)}>
                                                        {acc.accountNumber} - {acc.description}
                                                     </CommandItem>
                                                ))}
                                            </CommandList>
                                        </Command>
                                    </SelectContent>
                                </Select>
                        </div>
                        <Button onClick={handleViewReport} disabled={isLoading || !selectedAccountId}>
                            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Eye className="mr-2 h-4 w-4"/>}
                            View Reconciliation
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {isReportVisible && (
                <UnbalancedTransactionsView transactions={transactions} accounts={accounts} />
            )}
        </div>
    );
}
