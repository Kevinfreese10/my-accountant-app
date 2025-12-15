
'use client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useState, useEffect, useMemo } from "react";
import { User, ChartOfAccount, AllocatedTransaction, ImportedTransaction } from "@/lib/types";
import { getFirestore, doc, getDoc, collection, query, onSnapshot, where, orderBy, getDocs } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { Loader2, Download, Eye, Scale } from "lucide-react";
import { useParams } from 'next/navigation';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { format } from 'date-fns';
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import * as XLSX from 'xlsx';


const db = getFirestore(firebaseApp);

const formatPrice = (price: number) => {
    if (price === 0) return 'R 0.00';
    return new Intl.NumberFormat('en-ZA', {
      style: 'currency',
      currency: 'ZAR',
    }).format(price);
};

function AccountLedgerView({ transactions, account }: { transactions: (ImportedTransaction | AllocatedTransaction)[], account: ChartOfAccount }) {
    
    const ledgerEntries = useMemo(() => {
        let runningBalance = 0;
        return transactions
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
            .map(tx => {
                const amount = tx.allocatedTo?.value === account.id ? tx.amount : -tx.amount;
                runningBalance += amount;
                return {
                    ...tx,
                    displayAmount: amount,
                    balance: runningBalance,
                };
            });
    }, [transactions, account]);

    const handleDownloadExcel = () => {
        const dataToExport = ledgerEntries.map(tx => ({
            'Date': format(new Date(tx.date), 'dd/MM/yyyy'),
            'Reference': tx.reference,
            'Description': tx.description,
            'Debit': tx.displayAmount > 0 ? tx.displayAmount : '',
            'Credit': tx.displayAmount < 0 ? -tx.displayAmount : '',
            'Balance': tx.balance,
        }));
        
        const worksheet = XLSX.utils.json_to_sheet(dataToExport);
        worksheet['!cols'] = [{ wch: 12 }, { wch: 20 }, { wch: 40 }, { wch: 15 }, { wch: 15 }, { wch: 15 }];
        
        const totalDebit = ledgerEntries.reduce((sum, tx) => sum + (tx.displayAmount > 0 ? tx.displayAmount : 0), 0);
        const totalCredit = ledgerEntries.reduce((sum, tx) => sum + (tx.displayAmount < 0 ? -tx.displayAmount : 0), 0);

        XLSX.utils.sheet_add_aoa(worksheet, [['', '', 'Totals', totalDebit, totalCredit, '']], { origin: -1 });

        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, account.description);
        XLSX.writeFile(workbook, `Ledger-${account.accountNumber}.xlsx`);
    };

    if (ledgerEntries.length === 0) {
        return (
             <div className="flex flex-col items-center justify-center h-64 text-center text-muted-foreground border-2 border-dashed rounded-lg p-4">
                <Scale className="h-10 w-10 mb-4" />
                <p className="font-semibold">No Transactions Found</p>
                <p className="text-sm mt-2">There are no transactions for this account in the selected period.</p>
              </div>
        )
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Ledger for: {account.description}</CardTitle>
                 <Button onClick={handleDownloadExcel} size="sm" variant="outline" className="ml-auto">
                    <Download className="mr-2 h-4 w-4" />
                    Download Excel
                </Button>
            </CardHeader>
            <CardContent>
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
                        {ledgerEntries.map(tx => (
                            <TableRow key={tx.id}>
                                <TableCell>{format(new Date(tx.date), 'dd/MM/yyyy')}</TableCell>
                                <TableCell>{tx.reference}</TableCell>
                                <TableCell>{tx.description}</TableCell>
                                <TableCell className="text-right font-mono">{tx.displayAmount > 0 ? formatPrice(tx.displayAmount) : ''}</TableCell>
                                <TableCell className="text-right font-mono">{tx.displayAmount < 0 ? formatPrice(-tx.displayAmount) : ''}</TableCell>
                                <TableCell className="text-right font-mono">{formatPrice(tx.balance)}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                    <TableFooter>
                        <TableRow>
                            <TableCell colSpan={3} className="font-bold">Closing Balance</TableCell>
                            <TableCell colSpan={3} className="text-right font-bold font-mono">{formatPrice(ledgerEntries[ledgerEntries.length-1]?.balance || 0)}</TableCell>
                        </TableRow>
                    </TableFooter>
                </Table>
            </CardContent>
        </Card>
    );
}

export default function GeneralLedgerReconPage() {
    const params = useParams();
    const clientId = params.clientId as string;
    const [client, setClient] = useState<User | null>(null);
    const [transactions, setTransactions] = useState<(ImportedTransaction | AllocatedTransaction)[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isFetchingTransactions, setIsFetchingTransactions] = useState(false);
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

    const accounts = useMemo(() => client?.chartOfAccounts?.sort((a,b) => a.accountNumber.localeCompare(b.accountNumber)) || [], [client]);
    const selectedAccount = useMemo(() => accounts.find(acc => acc.id === selectedAccountId), [accounts, selectedAccountId]);
    
    const handleViewReport = () => {
        if(!selectedAccountId) return;
        
        setIsFetchingTransactions(true);
        setIsReportVisible(false); // Hide old report while fetching

        const bankTxQuery = query(collection(db, 'aiAccountantClients', clientId, 'transactions'), where('bankAccountId', '==', selectedAccountId));
        const allocatedTxQuery = query(collection(db, 'aiAccountantClients', clientId, 'transactions'), where('allocatedTo.value', '==', selectedAccountId));
        
        Promise.all([getDocs(bankTxQuery), getDocs(allocatedTxQuery)])
            .then(([bankSnap, allocatedSnap]) => {
                const combined = new Map<string, ImportedTransaction | AllocatedTransaction>();
                bankSnap.forEach(doc => combined.set(doc.id, { id: doc.id, ...doc.data() } as ImportedTransaction));
                allocatedSnap.forEach(doc => combined.set(doc.id, { id: doc.id, ...doc.data() } as AllocatedTransaction));
                
                setTransactions(Array.from(combined.values()));
                setIsReportVisible(true);
            })
            .catch(error => {
                console.error("Error fetching transactions for reconciliation:", error);
            })
            .finally(() => {
                setIsFetchingTransactions(false);
            });
    }
    
    return (
        <div className="space-y-6">
             <Card>
                <CardHeader>
                    <CardTitle>General Ledger Reconciliation</CardTitle>
                    <CardDescription>Select an account to view its transaction ledger and running balance.</CardDescription>
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
                        <Button onClick={handleViewReport} disabled={isFetchingTransactions || !selectedAccountId}>
                            {isFetchingTransactions ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Eye className="mr-2 h-4 w-4"/>}
                            View Ledger
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {isReportVisible && selectedAccount && (
                <AccountLedgerView transactions={transactions} account={selectedAccount} />
            )}
        </div>
    );
}
    

    