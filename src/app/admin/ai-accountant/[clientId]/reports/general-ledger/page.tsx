
'use client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useState, useEffect, useMemo } from "react";
import { User, ChartOfAccount, AllocatedTransaction, ImportedTransaction, VatType } from "@/lib/types";
import { getFirestore, doc, getDoc, collection, query, onSnapshot, updateDoc, writeBatch, deleteDoc, where, getDocs } from 'firebase/firestore';
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


const db = getFirestore(firebaseApp);

const reallocateSchema = z.object({
  accountId: z.string().min(1, "Please select an account."),
  vatType: z.string().min(1, "Please select a VAT type."),
});

const formatPrice = (price: number) => {
    if (price === 0) return 'R 0.00';
    return new Intl.NumberFormat('en-ZA', {
      style: 'currency',
      currency: 'ZAR',
    }).format(price);
};

function ReallocateDialog({ transaction, client, onSave, onOpenChange, open }: { transaction: any; client: User; onSave: (txId: string, values: z.infer<typeof reallocateSchema>) => void; onOpenChange: (open: boolean) => void; open: boolean }) {
    const { toast } = useToast();
    const [isSaving, setIsSaving] = useState(false);
    
    const form = useForm<z.infer<typeof reallocateSchema>>({
        resolver: zodResolver(reallocateSchema),
        defaultValues: {
            accountId: transaction?.allocatedTo?.value || '',
            vatType: transaction?.vatType || 'no_vat',
        },
    });

    const handleSave = async (values: z.infer<typeof reallocateSchema>) => {
        setIsSaving(true);
        await onSave(transaction.id, values);
        setIsSaving(false);
        onOpenChange(false);
    };
    
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Reallocate Transaction</DialogTitle>
                    <DialogDescription>
                        Change the allocation for: "{transaction?.description}"
                    </DialogDescription>
                </DialogHeader>
                 <Form {...form}>
                    <form onSubmit={form.handleSubmit(handleSave)} className="space-y-4">
                        <FormField
                            control={form.control}
                            name="accountId"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>New Account</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <FormControl><SelectTrigger><SelectValue placeholder="Select an account" /></SelectTrigger></FormControl>
                                        <SelectContent>
                                            {client.chartOfAccounts?.map(acc => (
                                                <SelectItem key={acc.id} value={acc.id}>{acc.description}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="vatType"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>New VAT Type</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <FormControl><SelectTrigger><SelectValue placeholder="Select VAT type" /></SelectTrigger></FormControl>
                                        <SelectContent>
                                            {allVatTypes.map(vt => (
                                                <SelectItem key={vt.name} value={vt.name}>{vt.label}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                         <DialogFooter>
                            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
                            <Button type="submit" disabled={isSaving}>
                                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Save Reallocation
                            </Button>
                        </DialogFooter>
                    </form>
                 </Form>
            </DialogContent>
        </Dialog>
    );
}

function GeneralLedgerReport({ client, transactions, dateRange, fromAccount, toAccount, onReallocate, onDelete }: { 
    client: User, 
    transactions: (ImportedTransaction | AllocatedTransaction)[], 
    dateRange?: DateRange, 
    fromAccount?: string, 
    toAccount?: string,
    onReallocate: (tx: any) => void, 
    onDelete: (journalRef: string) => void,
}) {
        
    const filteredTransactions = useMemo(() => {
        let filtered = transactions;
        
        if (dateRange) {
             if (dateRange.from) {
                filtered = filtered.filter(tx => new Date(tx.date) >= dateRange.from!);
            }
            if (dateRange.to) {
                filtered = filtered.filter(tx => new Date(tx.date) <= dateRange.to!);
            }
        }
        
        return filtered.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    }, [transactions, dateRange]);
    
    const accountsToDisplay = useMemo(() => {
        let accounts = client.chartOfAccounts || [];

        if (fromAccount) {
            const from = accounts.find(a => a.id === fromAccount);
            if(from) accounts = accounts.filter(acc => acc.accountNumber >= from.accountNumber);
        }
        if (toAccount) {
            const to = accounts.find(a => a.id === toAccount);
            if(to) accounts = accounts.filter(acc => acc.accountNumber <= to.accountNumber);
        }

        return accounts.sort((a,b) => a.accountNumber.localeCompare(b.accountNumber));
    }, [client.chartOfAccounts, fromAccount, toAccount]);


    const groupedTransactions = useMemo(() => {
        const suspenseAccountId = '9500-001';

        const grouped = new Map<string, { account: ChartOfAccount; transactions: any[], totalDebit: number; totalCredit: number }>();

        accountsToDisplay.forEach(acc => {
            grouped.set(acc.id, { account: acc, transactions: [], totalDebit: 0, totalCredit: 0 });
        });

        filteredTransactions.forEach(tx => {
            const txDate = new Date(tx.date);
            const isJournal = tx.bankAccountId === 'JOURNAL';

            if(isJournal) {
                 const entry = grouped.get(tx.allocatedTo!.value);
                 if (entry) {
                     entry.transactions.push({
                        id: tx.id,
                        isJournal,
                        date: txDate,
                        description: tx.description,
                        ref: tx.reference,
                        debit: tx.amount > 0 ? tx.amount : 0,
                        credit: tx.amount < 0 ? -tx.amount : 0,
                     });
                 }
            } else {
                 // Debit/Credit Bank Account
                const bankEntry = grouped.get(tx.bankAccountId);
                if (bankEntry) {
                    const contraAccount = tx.status === 'allocated' 
                        ? accountsToDisplay.find(a => a.id === tx.allocatedTo?.value)?.description || 'Unallocated'
                        : 'Suspense Account';
                    
                    bankEntry.transactions.push({
                        id: tx.id,
                        isJournal,
                        date: txDate,
                        description: `${tx.description} (Contra: ${contraAccount})`,
                        ref: tx.reference,
                        debit: tx.amount > 0 ? tx.amount : 0,
                        credit: tx.amount < 0 ? -tx.amount : 0,
                    });
                }
                
                 // Debit/Credit Contra Account
                const contraAccountId = tx.status === 'allocated' ? tx.allocatedTo!.value : suspenseAccountId;
                const contraEntry = grouped.get(contraAccountId);
                if(contraEntry) {
                    const bankAccountName = accountsToDisplay.find(a => a.id === tx.bankAccountId)?.description || 'Bank';
                    contraEntry.transactions.push({
                         id: tx.id,
                         isJournal,
                         date: txDate,
                         description: `${tx.description} (Bank: ${bankAccountName})`,
                         ref: tx.reference,
                         debit: tx.amount < 0 ? -tx.amount : 0,
                         credit: tx.amount > 0 ? tx.amount : 0,
                    });
                }
            }
        });
        
        grouped.forEach(group => {
            group.transactions.sort((a, b) => a.date.getTime() - b.date.getTime());
            let runningBalance = 0;
            group.transactions = group.transactions.map(tx => {
                runningBalance += tx.debit - tx.credit;
                return { ...tx, balance: runningBalance };
            });
            group.totalDebit = group.transactions.reduce((sum, tx) => sum + tx.debit, 0);
            group.totalCredit = group.transactions.reduce((sum, tx) => sum + tx.credit, 0);
        });

        return Array.from(grouped.values()).filter(g => g.transactions.length > 0);

    }, [filteredTransactions, accountsToDisplay]);

    const handleDownloadExcel = () => {
        let excelData: any[] = [];
        
        groupedTransactions.forEach(group => {
            excelData.push({
                Date: `${group.account.accountNumber} - ${group.account.description}`,
            });

            excelData.push({
                Date: "Date",
                Description: "Description",
                Debit: "Debit",
                Credit: "Credit",
                Balance: "Balance",
            });

            group.transactions.forEach(tx => {
                excelData.push({
                    Date: format(tx.date, 'dd/MM/yyyy'),
                    Description: tx.description,
                    Debit: tx.debit,
                    Credit: tx.credit,
                    Balance: tx.balance,
                });
            });

            excelData.push({
                Date: "Totals",
                Description: "",
                Debit: group.totalDebit,
                Credit: group.totalCredit,
                Balance: "",
            });
            
            excelData.push({}); // Add a blank row for spacing
        });

        const worksheet = XLSX.utils.json_to_sheet(excelData, { skipHeader: true });
        worksheet['!cols'] = [{ wch: 12 }, { wch: 40 }, { wch: 15 }, { wch: 15 }, { wch: 15 }];
        
        Object.keys(worksheet).forEach(key => {
            if (/[C-E]\d+/.test(key)) {
                const cell = worksheet[key];
                if (cell.v !== null && typeof cell.v === 'number') {
                    cell.t = 'n';
                    cell.z = 'R #,##0.00';
                }
            }
        });

        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "General Ledger");

        const today = new Date().toISOString().split('T')[0];
        const fileName = `${client.companyName || client.name}-General-Ledger-${today}.xlsx`;
        XLSX.writeFile(workbook, fileName);
    };

    return (
        <>
            <div className="max-h-[70vh] overflow-y-auto space-y-6">
                {groupedTransactions.map(group => (
                    <div key={group.account.id}>
                        <h3 className="font-bold text-lg mb-2">{group.account.accountNumber} - {group.account.description}</h3>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Date</TableHead>
                                    <TableHead>Description</TableHead>
                                    <TableHead className="text-right">Debit</TableHead>
                                    <TableHead className="text-right">Credit</TableHead>
                                    <TableHead className="text-right">Balance</TableHead>
                                    <TableHead className="w-[100px] text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {group.transactions.map((tx, index) => (
                                    <TableRow key={index}>
                                        <TableCell>{format(tx.date, 'dd/MM/yyyy')}</TableCell>
                                        <TableCell>{tx.description}</TableCell>
                                        <TableCell className="text-right font-mono">
                                            <Button variant="link" className="p-0 h-auto" onClick={() => onReallocate(tx)} disabled={tx.isJournal}>
                                                {formatPrice(tx.debit)}
                                            </Button>
                                        </TableCell>
                                        <TableCell className="text-right font-mono">
                                            <Button variant="link" className="p-0 h-auto" onClick={() => onReallocate(tx)} disabled={tx.isJournal}>
                                                {formatPrice(tx.credit)}
                                            </Button>
                                        </TableCell>
                                        <TableCell className="text-right font-mono">{formatPrice(tx.balance)}</TableCell>
                                        <TableCell className="text-right">
                                            {tx.isJournal && tx.ref?.startsWith('TAX-') && (
                                                <AlertDialog>
                                                    <AlertDialogTrigger asChild>
                                                        <Button variant="ghost" size="icon" className="h-7 w-7"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                                                    </AlertDialogTrigger>
                                                    <AlertDialogContent>
                                                        <AlertDialogHeader>
                                                            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                                            <AlertDialogDescription>This will delete the entire tax journal entry ({tx.ref}). This action cannot be undone.</AlertDialogDescription>
                                                        </AlertDialogHeader>
                                                        <AlertDialogFooter>
                                                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                            <AlertDialogAction onClick={() => onDelete(tx.ref)}>Delete Journal</AlertDialogAction>
                                                        </AlertDialogFooter>
                                                    </AlertDialogContent>
                                                </AlertDialog>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                            <TableFooter>
                                <TableRow>
                                    <TableCell colSpan={2} className="font-bold">Totals</TableCell>
                                    <TableCell className="text-right font-bold font-mono">{formatPrice(group.totalDebit)}</TableCell>
                                    <TableCell className="text-right font-bold font-mono">{formatPrice(group.totalCredit)}</TableCell>
                                    <TableCell colSpan={2}></TableCell>
                                </TableRow>
                            </TableFooter>
                        </Table>
                    </div>
                ))}
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

export default function GeneralLedgerPage() {
    const params = useParams();
    const searchParams = useSearchParams();
    const clientId = params.clientId as string;
    const accountIdFromQuery = searchParams.get('accountId');

    const [client, setClient] = useState<User | null>(null);
    const [transactions, setTransactions] = useState<(ImportedTransaction | AllocatedTransaction)[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
    const [fromAccount, setFromAccount] = useState<string | undefined>();
    const [toAccount, setToAccount] = useState<string | undefined>();
    const [isReportOpen, setIsReportOpen] = useState(false);
    const [isReallocateOpen, setIsReallocateOpen] = useState(false);
    const [selectedTransaction, setSelectedTransaction] = useState<any>(null);
    const { toast } = useToast();

    useEffect(() => {
        if (accountIdFromQuery) {
            setFromAccount(accountIdFromQuery);
            setToAccount(accountIdFromQuery);
        }
    }, [accountIdFromQuery]);


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
             const transUnsubscribe = onSnapshot(query(collection(db, 'aiAccountantClients', clientId, 'transactions')), snapshot => {
                const fetched = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as (ImportedTransaction | AllocatedTransaction)));
                setTransactions(fetched);
            });

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
    
    const handleReallocateClick = (tx: any) => {
        const originalTx = transactions.find(t => t.id === tx.id);
        if (originalTx) {
            setSelectedTransaction(originalTx);
            setIsReallocateOpen(true);
        }
    };
    
    const handleSaveReallocation = async (txId: string, values: z.infer<typeof reallocateSchema>) => {
        if(!client) return;
        try {
            const txRef = doc(db, 'aiAccountantClients', client.id!, 'transactions', txId);
            await updateDoc(txRef, {
                'allocatedTo.value': values.accountId,
                vatType: values.vatType,
            });
            toast({ title: "Success", description: "Transaction reallocated successfully." });
        } catch (error) {
            console.error("Error reallocating transaction:", error);
            toast({ title: "Error", description: "Could not save the changes.", variant: "destructive" });
        }
    };
    
     const handleDeleteJournal = async (journalReference: string) => {
      if (!client) return;
      
      const q = query(collection(db, "aiAccountantClients", client.id, "transactions"), where("reference", "==", journalReference));
      const journalsToDeleteSnapshot = await getDocs(q);

      if (journalsToDeleteSnapshot.empty) {
        toast({ title: 'Error', description: 'Could not find journal entries to delete.', variant: 'destructive'});
        return;
      }
      
      try {
        const batch = writeBatch(db);
        journalsToDeleteSnapshot.forEach(journalDoc => {
          batch.delete(journalDoc.ref);
        });
        await batch.commit();
        toast({ title: 'Journal Deleted', description: `Journal ${journalReference} has been deleted.`, variant: 'destructive'});
        // Data will refetch automatically due to onSnapshot listener
      } catch (error) {
        console.error("Error deleting journal:", error);
        toast({ title: 'Error', description: 'Failed to delete journal.', variant: 'destructive'});
      }
    };

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
        <div>
            <Card>
                <CardHeader>
                    <div className="flex justify-between items-start">
                        <div>
                            <CardTitle>General Ledger Report</CardTitle>
                            <CardDescription>
                                Filter and view the general ledger for a specific period.
                            </CardDescription>
                        </div>
                        <Button asChild variant="outline">
                            <Link href={`/admin/ai-accountant/${clientId}/reports/gl-recon`}>
                                <Scale className="mr-2 h-4 w-4"/>
                                Go to GL Recon Tool
                            </Link>
                        </Button>
                    </div>
                </CardHeader>
                <CardContent className="space-y-4">
                     <div className="space-y-6 max-w-4xl">
                        <div className="grid grid-cols-1 md:grid-cols-[150px_1fr] items-center gap-4">
                            <Label>Date Range</Label>
                            <DateRangePicker onDateChange={setDateRange} />
                        </div>
                         <div className="grid grid-cols-1 md:grid-cols-[150px_1fr] items-center gap-4">
                            <Label>Account</Label>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <Select value={fromAccount} onValueChange={setFromAccount}>
                                    <SelectTrigger><SelectValue placeholder="(From Account)" /></SelectTrigger>
                                    <SelectContent>
                                        {isLoading ? <Loader2 className="animate-spin" /> : accounts.map(acc => <SelectItem key={acc.id} value={acc.id}>{acc.description}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                                <Select value={toAccount} onValueChange={setToAccount}>
                                    <SelectTrigger><SelectValue placeholder="(To Account)" /></SelectTrigger>
                                    <SelectContent>
                                          {isLoading ? <Loader2 className="animate-spin" /> : accounts.map(acc => <SelectItem key={acc.id} value={acc.id}>{acc.description}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        
                        <div className="flex justify-start pt-4">
                             {isLoading ? (
                                <Loader2 className="animate-spin" />
                            ) : client ? (
                                <Dialog open={isReportOpen} onOpenChange={setIsReportOpen}>
                                    <DialogTrigger asChild>
                                        <Button>View Report</Button>
                                    </DialogTrigger>
                                    <DialogContent className="sm:max-w-4xl">
                                        <DialogHeader className="text-center mb-4">
                                            <DialogTitle className="text-lg">{client.companyName || client.name}</DialogTitle>
                                            <DialogDescription>
                                                General Ledger {getReportDateString()}
                                            </DialogDescription>
                                        </DialogHeader>
                                        <GeneralLedgerReport 
                                            client={client} 
                                            transactions={transactions} 
                                            dateRange={dateRange} 
                                            fromAccount={fromAccount} 
                                            toAccount={toAccount}
                                            onReallocate={handleReallocateClick}
                                            onDelete={handleDeleteJournal}
                                        />
                                    </DialogContent>
                                </Dialog>
                            ) : (
                                <p>Client data could not be loaded.</p>
                            )}
                        </div>
                    </div>
                </CardContent>
            </Card>
             {selectedTransaction && client && (
                <ReallocateDialog
                    transaction={selectedTransaction}
                    client={client}
                    onSave={handleSaveReallocation}
                    open={isReallocateOpen}
                    onOpenChange={setIsReallocateOpen}
                />
            )}
        </div>
    );
}
