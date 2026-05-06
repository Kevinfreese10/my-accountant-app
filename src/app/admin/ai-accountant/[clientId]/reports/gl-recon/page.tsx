'use client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useState, useEffect, useMemo } from "react";
import { User, ChartOfAccount, AllocatedTransaction, ImportedTransaction, VatType } from "@/lib/types";
import { getFirestore, doc, getDoc, collection, query, onSnapshot, where, orderBy, getDocs, writeBatch } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { Loader2, Download, Eye, Scale, CheckCircle, ChevronsUpDown, CheckCheck } from "lucide-react";
import { useParams } from 'next/navigation';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { format } from 'date-fns';
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList, CommandGroup } from "@/components/ui/command";
import * as XLSX from 'xlsx';
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import { allVatTypes } from "@/lib/vat-types";


const db = getFirestore(firebaseApp);

const formatPrice = (price: number) => {
    if (price === 0) return 'R 0.00';
    return new Intl.NumberFormat('en-ZA', {
      style: 'currency',
      currency: 'ZAR',
    }).format(price);
};

function AccountLedgerView({ transactions, account, client, onReallocate }: { 
    transactions: (ImportedTransaction | AllocatedTransaction)[], 
    account: ChartOfAccount,
    client: User,
    onReallocate: (txIds: string[], values: { accountId: string, vatType: VatType }) => void,
}) {
    
    const [hideMatched, setHideMatched] = useState(true);
    const [selectedTransactions, setSelectedTransactions] = useState<string[]>([]);
    const [reallocateTo, setReallocateTo] = useState<{accountId: string, vatType: VatType} | null>(null);
    const [open, setOpen] = useState(false)

    const cleanDisplayDescription = (description: string): string => {
        if (!description) return '';
        let cleaned = description.replace(/^(Contra:\s*|VAT on:?\s*)/i, '');
        if (cleaned.includes(': ')) {
            const parts = cleaned.split(': ');
            if (parts.length > 1) {
                cleaned = parts.slice(1).join(': ');
            }
        }
        return cleaned.trim();
    };

    const ledgerEntries = useMemo(() => {
        const processedTransactions = transactions
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
            .map(tx => ({
                ...tx,
                displayDescription: cleanDisplayDescription(tx.description),
                displayAmount: tx.allocatedTo?.value === account.id ? tx.amount : -tx.amount,
                matched: false, 
            }));

        const debits = processedTransactions.filter(tx => tx.displayAmount > 0);
        const credits = processedTransactions.filter(tx => tx.displayAmount < 0);
        
        const creditMatches = new Array(credits.length).fill(false);

        for (const debit of debits) {
            for (let i = 0; i < credits.length; i++) {
                if (!creditMatches[i] && Math.abs(debit.displayAmount + credits[i].displayAmount) < 0.01) {
                    debit.matched = true;
                    credits[i].matched = true;
                    creditMatches[i] = true;
                    break; 
                }
            }
        }
        
        const allLedgerEntries = [...debits, ...credits].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        
        let runningBalance = 0;
        return allLedgerEntries.map(entry => {
            runningBalance += entry.displayAmount;
            return {
                ...entry,
                balance: runningBalance,
            };
        });

    }, [transactions, account]);
    
    const visibleEntries = useMemo(() => {
        if (hideMatched) {
            return ledgerEntries.filter(e => !e.matched);
        }
        return ledgerEntries;
    }, [ledgerEntries, hideMatched]);
    
    useEffect(() => {
        setSelectedTransactions([]);
    }, [visibleEntries]);

    const handleSelectionChange = (id: string, checked: boolean) => {
        setSelectedTransactions(prev => {
            if (checked) {
                return [...prev, id];
            } else {
                return prev.filter(txId => txId !== id);
            }
        });
    };

    const handleDownloadExcel = () => {
        const dataToExport = visibleEntries.map(tx => ({
            'Date': format(new Date(tx.date), 'dd/MM/yyyy'),
            'Reference': tx.reference,
            'Description': tx.displayDescription,
            'Debit': tx.displayAmount > 0 ? tx.displayAmount : '',
            'Credit': tx.displayAmount < 0 ? -tx.displayAmount : '',
            'Balance': tx.balance,
        }));
        
        const totalDebit = visibleEntries.reduce((sum, tx) => sum + (tx.displayAmount > 0 ? tx.displayAmount : 0), 0);
        const totalCredit = visibleEntries.reduce((sum, tx) => sum + (tx.displayAmount < 0 ? -tx.displayAmount : 0), 0);

        XLSX.utils.sheet_add_aoa(dataToExport, [['', '', 'Totals', totalDebit, totalCredit, '']], { origin: -1 });

        const worksheet = XLSX.utils.json_to_sheet(dataToExport);
        worksheet['!cols'] = [{ wch: 12 }, { wch: 20 }, { wch: 40 }, { wch: 15 }, { wch: 15 }, { wch: 15 }];
        
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
                <div className="flex justify-between items-center">
                    <CardTitle>Ledger for: {account.description}</CardTitle>
                    <div className="flex items-center space-x-2">
                        <Checkbox id="hide-matched" checked={hideMatched} onCheckedChange={(checked) => setHideMatched(checked as boolean)} />
                        <Label htmlFor="hide-matched" className="text-sm font-medium">Hide Matched Transactions</Label>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                 {selectedTransactions.length > 0 && (
                    <div className="flex items-center gap-2 mb-4 p-2 bg-muted rounded-lg">
                        <p className="text-sm font-semibold">{selectedTransactions.length} selected</p>
                         <Popover open={open} onOpenChange={setOpen}>
                            <PopoverTrigger asChild>
                                <Button variant="outline" role="combobox" aria-expanded={open} className="w-[200px] justify-between h-8 text-xs font-bold">
                                    {reallocateTo ? client.chartOfAccounts?.find(acc => acc.id === reallocateTo.accountId)?.description : "Reallocate to..."}
                                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-[300px] p-0" align="start">
                                <Command>
                                    <CommandInput placeholder="Search account..." />
                                    <CommandList>
                                    <CommandEmpty>No account found.</CommandEmpty>
                                        <CommandGroup>
                                            {client.chartOfAccounts?.map((account) => (
                                            <CommandItem
                                                key={account.id}
                                                value={account.description}
                                                onSelect={() => {
                                                    setReallocateTo({accountId: account.id, vatType: 'no_vat'})
                                                    setOpen(false)
                                                }}
                                            >
                                                <CheckCheck className={cn("mr-2 h-4 w-4", account.id === reallocateTo?.accountId ? "opacity-100" : "opacity-0")} />
                                                {account.description}
                                            </CommandItem>
                                            ))}
                                        </CommandGroup>
                                    </CommandList>
                                </Command>
                            </PopoverContent>
                        </Popover>
                         <Select
                            value={reallocateTo?.vatType || 'no_vat'}
                            onValueChange={(value) => reallocateTo && setReallocateTo({...reallocateTo, vatType: value as VatType})}
                            disabled={!reallocateTo}
                        >
                            <SelectTrigger className="w-[180px] h-8 text-[11px] font-bold"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                {allVatTypes.map(vt => <SelectItem key={vt.name} value={vt.name}>{vt.label}</SelectItem>)}
                            </SelectContent>
                        </Select>
                        <Button 
                            size="sm"
                            className="h-8 font-bold"
                            onClick={() => {
                                if (reallocateTo) {
                                    onReallocate(selectedTransactions, reallocateTo);
                                    setSelectedTransactions([]);
                                }
                            }}
                            disabled={!reallocateTo}
                        >
                            Apply
                        </Button>
                    </div>
                )}
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-12"><Checkbox 
                                checked={selectedTransactions.length > 0 && selectedTransactions.length === visibleEntries.length}
                                onCheckedChange={(checked) => setSelectedTransactions(checked ? visibleEntries.map(e => e.id) : [])}
                            /></TableHead>
                            <TableHead>Date</TableHead>
                            <TableHead>Reference</TableHead>
                            <TableHead>Description</TableHead>
                            <TableHead className="text-right">Debit</TableHead>
                            <TableHead className="text-right">Credit</TableHead>
                            <TableHead className="text-right">Balance</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {visibleEntries.map((tx) => (
                            <TableRow key={tx.id} data-state={selectedTransactions.includes(tx.id) && 'selected'} className={cn(tx.matched && 'text-muted-foreground line-through')}>
                                <TableCell><Checkbox checked={selectedTransactions.includes(tx.id)} onCheckedChange={(checked) => handleSelectionChange(tx.id, !!checked)} /></TableCell>
                                <TableCell>
                                    <div className="flex items-center gap-2">
                                        {tx.matched && <CheckCircle className="h-4 w-4 text-green-500" />}
                                        {format(new Date(tx.date), 'dd/MM/yyyy')}
                                    </div>
                                </TableCell>
                                <TableCell>{tx.reference}</TableCell>
                                <TableCell>{tx.displayDescription}</TableCell>
                                <TableCell className="text-right font-mono">{tx.displayAmount > 0 ? formatPrice(tx.displayAmount) : ''}</TableCell>
                                <TableCell className="text-right font-mono">{tx.displayAmount < 0 ? formatPrice(-tx.displayAmount) : ''}</TableCell>
                                <TableCell className="text-right font-mono">{formatPrice(tx.balance)}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                    <TableFooter>
                        <TableRow>
                            <TableCell colSpan={6} className="font-bold">Closing Balance</TableCell>
                            <TableCell className="text-right font-bold font-mono">{formatPrice(visibleEntries[visibleEntries.length-1]?.balance || 0)}</TableCell>
                        </TableRow>
                    </TableFooter>
                </Table>
            </CardContent>
             <CardFooter>
                 <Button onClick={handleDownloadExcel} size="sm" variant="outline" className="font-bold">
                    <Download className="mr-2 h-4 w-4" />
                    Download as Excel
                </Button>
            </CardFooter>
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
    const [open, setOpen] = useState(false);
    const { toast } = useToast();
    
    const fetchAllData = async () => {
        if (!clientId) return;
        setIsLoading(true);
        try {
            const clientRef = doc(db, 'aiAccountantClients', clientId);
            const clientSnap = await getDoc(clientRef);
            if (clientSnap.exists()) {
                const clientData = { id: clientSnap.id, ...clientSnap.data() } as User;
                setClient(clientData);
            }
        } catch (error) {
            console.error("Error fetching client data:", error);
        } finally {
            setIsLoading(false);
        }
    }
    
    useEffect(() => {
        fetchAllData();
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

    const handleReallocate = async (txIds: string[], values: { accountId: string, vatType: VatType }) => {
        if (!client) return;
        
        const batch = writeBatch(db);
        txIds.forEach(id => {
            const txData = transactions.find(t => t.id === id);
            if(txData && txData.bankAccountId !== 'JOURNAL') { // Don't reallocate journal entries
                const docRef = doc(db, 'aiAccountantClients', client.id, 'transactions', id);
                batch.update(docRef, {
                    'allocatedTo.value': values.accountId,
                    'allocatedTo.type': 'account',
                    'vatType': values.vatType,
                    'status': 'allocated'
                });
            }
        });

        try {
            await batch.commit();
            toast({ title: 'Reallocation Successful', description: `${txIds.length} transactions have been updated.`});
            // Re-fetch transactions for the current view
            handleViewReport();
        } catch (error) {
            toast({ title: 'Error', description: 'Could not reallocate transactions.', variant: 'destructive'});
        }
    };
    
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
                                 <Popover open={open} onOpenChange={setOpen}>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant="outline"
                                            role="combobox"
                                            aria-expanded={open}
                                            className="w-full justify-between"
                                        >
                                            {selectedAccountId
                                                ? accounts.find((acc) => acc.id === selectedAccountId)?.description
                                                : "Select an account..."}
                                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                                        <Command>
                                            <CommandInput placeholder="Search account..." />
                                            <CommandList>
                                                <CommandEmpty>No account found.</CommandEmpty>
                                                <CommandGroup>
                                                    {accounts.map(acc => (
                                                        <CommandItem
                                                            key={acc.id}
                                                            value={`${acc.accountNumber} - ${acc.description}`}
                                                            onSelect={() => {
                                                                setSelectedAccountId(acc.id)
                                                                setOpen(false)
                                                            }}
                                                        >
                                                            <CheckCheck className={cn("mr-2 h-4 w-4", acc.id === selectedAccountId ? "opacity-100" : "opacity-0")} />
                                                            {acc.description}
                                                        </CommandItem>
                                                    ))}
                                                </CommandGroup>
                                            </CommandList>
                                        </Command>
                                    </PopoverContent>
                                </Popover>
                        </div>
                        <Button onClick={handleViewReport} disabled={isFetchingTransactions || !selectedAccountId} className="font-bold gap-2">
                            {isFetchingTransactions ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Eye className="mr-2 h-4 w-4"/>}
                            View Ledger
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {isReportVisible && selectedAccount && client && (
                <AccountLedgerView 
                    transactions={transactions} 
                    account={selectedAccount} 
                    client={client}
                    onReallocate={handleReallocate}
                />
            )}
        </div>
    );
}
