
'use client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useState, useEffect, useMemo } from "react";
import { User, ChartOfAccount, AllocatedTransaction, ImportedTransaction, VatType } from "@/lib/types";
import { getFirestore, doc, getDoc, collection, getDocs, query, where, updateDoc, writeBatch } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { Loader2, Download, Eye, Edit, Trash2, Search, Link as LinkIcon, Scale, ChevronsUpDown } from "lucide-react";
import { useParams, useSearchParams } from 'next/navigation';
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { DateRange } from "react-day-picker";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { format } from 'date-fns';
import * as XLSX from 'xlsx';
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { allVatTypes } from "@/lib/vat-types";
import Link from "next/link";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList, CommandGroup } from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";


const db = getFirestore(firebaseApp);

const formatPrice = (price: number) => {
    if (price === 0) return 'R 0.00';
    return new Intl.NumberFormat('en-ZA', {
      style: 'currency',
      currency: 'ZAR',
    }).format(price);
};

function SearchResultsView({ 
    results, 
    client, 
    onReallocate, 
    selectedTransactions,
    onSelectionChange
}: { 
    results: (ImportedTransaction | AllocatedTransaction)[], 
    client: User, 
    onReallocate: (txIds: string[], values: { accountId: string, vatType: VatType }) => void,
    selectedTransactions: string[],
    onSelectionChange: (id: string, checked: boolean) => void
}) {
    const [reallocateTo, setReallocateTo] = useState<{accountId: string, vatType: VatType} | null>(null);
    const [open, setOpen] = useState(false)

    const getAllocationDescription = (tx: ImportedTransaction | AllocatedTransaction) => {
        if (!tx.allocatedTo?.value) return <Badge variant="outline">Unallocated</Badge>;
        return client.chartOfAccounts?.find(acc => acc.id === tx.allocatedTo?.value)?.description || 'Unknown';
    };

    return (
        <div>
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">Search Results ({results.length})</h3>
                <div className="flex items-center gap-2">
                    <Popover open={open} onOpenChange={setOpen}>
                        <PopoverTrigger asChild>
                            <Button variant="outline" role="combobox" aria-expanded={open} className="w-[200px] justify-between" disabled={selectedTransactions.length === 0}>
                                {reallocateTo ? client.chartOfAccounts?.find(acc => acc.id === reallocateTo.accountId)?.description : "Reallocate selected to..."}
                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[200px] p-0">
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
                                            setReallocateTo({accountId: account.id, vatType: 'standard_rated_purchases'})
                                            setOpen(false)
                                        }}
                                    >
                                        {account.description}
                                    </CommandItem>
                                    ))}
                                </CommandGroup>
                                </CommandList>
                            </Command>
                        </PopoverContent>
                    </Popover>

                     <Select 
                        value={reallocateTo?.vatType || ''}
                        onValueChange={(value) => reallocateTo && setReallocateTo({...reallocateTo, vatType: value as VatType})}
                        disabled={!reallocateTo}
                    >
                        <SelectTrigger className="w-[180px]"><SelectValue placeholder="Select VAT type" /></SelectTrigger>
                        <SelectContent>
                            {allVatTypes.map(vt => <SelectItem key={vt.name} value={vt.name}>{vt.label}</SelectItem>)}
                        </SelectContent>
                    </Select>
                    <Button 
                        onClick={() => reallocateTo && onReallocate(selectedTransactions, {accountId: reallocateTo.accountId, vatType: reallocateTo.vatType})}
                        disabled={selectedTransactions.length === 0 || !reallocateTo}
                    >
                        Apply
                    </Button>
                </div>
            </div>
            <div className="max-h-[60vh] overflow-y-auto">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-12"><Checkbox 
                                checked={selectedTransactions.length > 0 && selectedTransactions.length === results.length}
                                onCheckedChange={(checked) => {
                                    results.forEach(tx => onSelectionChange(tx.id, !!checked))
                                }}
                            /></TableHead>
                            <TableHead>Date</TableHead>
                            <TableHead>Description</TableHead>
                            <TableHead>Allocated To</TableHead>
                            <TableHead>Bank Account</TableHead>
                            <TableHead>Reference</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Amount</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {results.map(tx => (
                            <TableRow key={tx.id}>
                                <TableCell><Checkbox checked={selectedTransactions.includes(tx.id)} onCheckedChange={(checked) => onSelectionChange(tx.id, !!checked)} /></TableCell>
                                <TableCell>{new Date(tx.date).toLocaleDateString('en-ZA')}</TableCell>
                                <TableCell>{tx.description}</TableCell>
                                <TableCell>{getAllocationDescription(tx)}</TableCell>
                                <TableCell>{client.chartOfAccounts?.find(acc => acc.id === tx.bankAccountId)?.description}</TableCell>
                                <TableCell>{tx.reference}</TableCell>
                                <TableCell><Badge variant={tx.status === 'allocated' ? 'success' : tx.status === 'new' ? 'secondary' : 'default'}>{tx.status}</Badge></TableCell>
                                <TableCell className="text-right font-mono">{formatPrice(tx.amount)}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}

export default function TransactionSearchPage() {
    const params = useParams();
    const clientId = params.clientId as string;

    const [client, setClient] = useState<User | null>(null);
    const [transactions, setTransactions] = useState<(ImportedTransaction | AllocatedTransaction)[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [searchResults, setSearchResults] = useState<(ImportedTransaction | AllocatedTransaction)[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [selectedTransactions, setSelectedTransactions] = useState<string[]>([]);
    const { toast } = useToast();

    const fetchClientAndTransactions = async () => {
        if (!clientId) return;
        setIsLoading(true);
        try {
            const clientRef = doc(db, 'aiAccountantClients', clientId);
            const clientSnap = await getDoc(clientRef);
            if (clientSnap.exists()) {
                setClient({ id: clientSnap.id, ...clientSnap.data() } as User);
            }

            const transQuery = query(collection(db, 'aiAccountantClients', clientId, 'transactions'));
            const transSnap = await getDocs(transQuery);
            setTransactions(transSnap.docs.map(d => ({ id: d.id, ...d.data() } as (ImportedTransaction | AllocatedTransaction))));

        } catch (e) {
            toast({ title: 'Error', description: 'Failed to fetch client data.', variant: 'destructive' });
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchClientAndTransactions();
    }, [clientId]);
    
    useEffect(() => {
        if (searchTerm.length > 2) {
            setIsSearching(true);
            const results = transactions.filter(tx => tx.description.toLowerCase().includes(searchTerm.toLowerCase()));
            setSearchResults(results);
            setIsSearching(false);
        } else {
            setSearchResults([]);
        }
    }, [searchTerm, transactions]);

    const handleSelectionChange = (id: string, checked: boolean) => {
        setSelectedTransactions(prev => {
            if (checked) {
                return [...prev, id];
            } else {
                return prev.filter(txId => txId !== id);
            }
        });
    };

    const handleReallocate = async (txIds: string[], values: { accountId: string, vatType: VatType }) => {
        if (!client) return;
        
        const batch = writeBatch(db);
        txIds.forEach(id => {
            const docRef = doc(db, 'aiAccountantClients', client.id, 'transactions', id);
            batch.update(docRef, {
                'allocatedTo.value': values.accountId,
                'allocatedTo.type': 'account',
                'vatType': values.vatType,
                'status': 'allocated'
            });
        });

        try {
            await batch.commit();
            toast({ title: 'Reallocation Successful', description: `${txIds.length} transactions have been updated.`});
            // Refetch or update state locally
            fetchClientAndTransactions();
            setSelectedTransactions([]);
        } catch (error) {
            toast({ title: 'Error', description: 'Could not reallocate transactions.', variant: 'destructive'});
        }
    };

    if (isLoading) {
        return <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin" /></div>;
    }

    if (!client) {
        return <p>Client not found.</p>;
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Transaction Search</CardTitle>
                <CardDescription>Search for specific transactions by description and perform bulk actions.</CardDescription>
            </CardHeader>
            <CardContent>
                 <div className="flex w-full max-w-sm items-center space-x-2">
                    <Input 
                        type="text" 
                        placeholder="Enter search term (e.g., 'Telkom')" 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                
                <div className="mt-6">
                    {isSearching ? (
                         <div className="flex justify-center items-center h-40"><Loader2 className="h-8 w-8 animate-spin" /></div>
                    ) : searchResults.length > 0 ? (
                        <SearchResultsView 
                            results={searchResults} 
                            client={client} 
                            onReallocate={handleReallocate} 
                            selectedTransactions={selectedTransactions}
                            onSelectionChange={handleSelectionChange}
                        />
                    ) : searchTerm.length > 2 ? (
                        <p className="text-center text-muted-foreground py-8">No transactions found matching your search.</p>
                    ): (
                         <p className="text-center text-muted-foreground py-8">Enter at least 3 characters to start searching.</p>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
