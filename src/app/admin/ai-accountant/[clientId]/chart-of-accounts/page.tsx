'use client';

import * as React from "react";
import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, PlusCircle, Edit, Trash2, ChevronsUpDown, CheckCheck, FileUp, Download } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getFirestore, doc, getDoc, updateDoc, collection, getDocs, query, where } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { useParams } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { User, ChartOfAccount, AllocatedTransaction } from '@/lib/types';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { chartOfAccounts as masterChartOfAccounts } from "@/lib/chart-of-accounts";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandInput, CommandGroup, CommandList, CommandItem } from "@/components/ui/command";
import { cn } from "@/lib/utils";
import * as XLSX from 'xlsx';
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

const db = getFirestore(firebaseApp);

const accountFormSchema = z.object({
  id: z.string().optional(),
  accountNumber: z.string().min(1, "Account number is required."),
  description: z.string().min(3, "Description is required."),
  section: z.enum(['Income Statement', 'Balance Sheet']),
});

type AccountFormValues = z.infer<typeof accountFormSchema>;

function ImportAccountsDialog({ client, onImportComplete }: { client: User | null; onImportComplete: () => void }) {
    const [isOpen, setIsOpen] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const { toast } = useToast();

    const handleDownloadTemplate = () => {
        const headers = [['Account Number', 'Description', 'Section']];
        const example = [['1000-001', 'Consulting Income', 'Income Statement'], ['3000-010', 'Office Rent', 'Income Statement'], ['8000-001', 'Bank Account', 'Balance Sheet']];
        const ws = XLSX.utils.aoa_to_sheet([...headers, ...example]);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "COA Template");
        XLSX.writeFile(wb, "coa_import_template.xlsx");
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !client?.id) return;

        setIsUploading(true);
        const reader = new FileReader();
        reader.readAsArrayBuffer(file);
        reader.onload = async (event) => {
            try {
                const data = new Uint8Array(event.target?.result as ArrayBuffer);
                const workbook = XLSX.read(data, { type: 'array' });
                const sheet = workbook.Sheets[workbook.SheetNames[0]];
                const json = XLSX.utils.sheet_to_json(sheet) as any[];

                const newAccounts = json.map(row => {
                    const accNum = String(row['Account Number'] || row['accountNumber'] || row['Code'] || '').trim();
                    const desc = String(row['Description'] || row['description'] || row['Name'] || '').trim();
                    const rawSection = String(row['Section'] || row['section'] || '').toLowerCase();
                    
                    let section: 'Income Statement' | 'Balance Sheet' = 'Income Statement';
                    if (rawSection.includes('balance') || rawSection.includes('bs') || rawSection.includes('asset') || rawSection.includes('liability')) {
                        section = 'Balance Sheet';
                    }

                    if (!accNum || !desc) return null;

                    return {
                        id: accNum,
                        accountNumber: accNum,
                        description: desc,
                        section: section
                    };
                }).filter(Boolean) as ChartOfAccount[];

                if (newAccounts.length === 0) {
                    toast({ title: "Import Failed", description: "No valid accounts found. Ensure headers match the template.", variant: "destructive" });
                    return;
                }

                const existingAccounts = client.chartOfAccounts || [];
                const combined = [...existingAccounts];
                
                newAccounts.forEach(newAcc => {
                    const idx = combined.findIndex(e => e.accountNumber === newAcc.accountNumber);
                    if (idx > -1) {
                        combined[idx] = newAcc; // Update existing
                    } else {
                        combined.push(newAcc); // Add new
                    }
                });

                const clientRef = doc(db, 'aiAccountantClients', client.id);
                await updateDoc(clientRef, { chartOfAccounts: combined });
                
                toast({ title: "Import Successful", description: `Added/Updated ${newAccounts.length} accounts.` });
                onImportComplete();
                setIsOpen(false);
            } catch (error) {
                console.error(error);
                toast({ title: "Import Failed", description: "An error occurred during the parsing.", variant: "destructive" });
            } finally {
                setIsUploading(false);
            }
        };
    };

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                    <FileUp className="mr-2 h-4 w-4" /> Import Excel/CSV
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Import Chart of Accounts</DialogTitle>
                    <DialogDescription>Bulk upload your GL accounts from an Excel or CSV file.</DialogDescription>
                </DialogHeader>
                <div className="space-y-6 py-4">
                    <div className="space-y-2">
                        <Label>1. Download the Template</Label>
                        <Button variant="secondary" className="w-full justify-start h-12 gap-3" onClick={handleDownloadTemplate}>
                            <Download className="h-5 w-5 text-primary" />
                            <div className="text-left">
                                <p className="text-sm font-bold">coa_template.xlsx</p>
                                <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-black">Use this format for best results</p>
                            </div>
                        </Button>
                    </div>
                    <Separator />
                    <div className="space-y-2">
                        <Label>2. Upload Your File</Label>
                        <Input type="file" accept=".xlsx,.xls,.csv" onChange={handleFileChange} disabled={isUploading} />
                        {isUploading && <div className="flex items-center gap-2 text-sm text-primary animate-pulse font-bold mt-2"><Loader2 className="h-4 w-4 animate-spin"/> Processing...</div>}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

function AccountForm({ account, onSave, onCancel }: { account: Partial<ChartOfAccount> | null, onSave: (data: AccountFormValues) => void, onCancel: () => void }) {
    const form = useForm<AccountFormValues>({
        resolver: zodResolver(accountFormSchema),
        defaultValues: account ? {
            ...account,
            section: (account.section === 'Income Statement' || account.section === 'Balance Sheet' ? account.section : 'Income Statement') as 'Income Statement' | 'Balance Sheet',
        } : {
            id: undefined,
            accountNumber: '',
            description: '',
            section: 'Income Statement',
        },
    });

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSave)} className="space-y-4">
                <FormField control={form.control} name="accountNumber" render={({ field }) => ( <FormItem><FormLabel>Account Number</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                <FormField control={form.control} name="description" render={({ field }) => ( <FormItem><FormLabel>Description</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                <FormField control={form.control} name="section" render={({ field }) => ( <FormItem><FormLabel>Section</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select a section" /></SelectTrigger></FormControl><SelectContent><SelectItem value="Income Statement">Income Statement</SelectItem><SelectItem value="Balance Sheet">Balance Sheet</SelectItem></SelectContent></Select><FormMessage /></FormItem> )} />
                <DialogFooter>
                    <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>
                    <Button type="submit">Save Account</Button>
                </DialogFooter>
            </form>
        </Form>
    );
}

export default function ChartOfAccountsPage() {
    const params = useParams();
    const clientId = params.clientId as string;
    const [client, setClient] = useState<User | null>(null);
    const [transactions, setTransactions] = useState<AllocatedTransaction[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const { toast } = useToast();
    const [filter, setFilter] = useState('');
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingAccount, setEditingAccount] = useState<ChartOfAccount | null>(null);

    const fetchClientData = async () => {
        if (!clientId) return;
        setIsLoading(true);
        try {
            const clientRef = doc(db, 'aiAccountantClients', clientId);
            const clientSnap = await getDoc(clientRef);
            if (clientSnap.exists()) {
                const clientData = { id: clientSnap.id, ...clientSnap.data() } as User;
                if (clientData.chartOfAccounts) {
                    // Deduplicate by account number to prevent duplicate key errors
                    const uniqueAccounts = Array.from(new Map(clientData.chartOfAccounts.map(item => [item.accountNumber, item])).values());
                    uniqueAccounts.sort((a, b) => a.accountNumber.localeCompare(b.accountNumber));
                    clientData.chartOfAccounts = uniqueAccounts;
                }
                setClient(clientData);
            }

            const transQuery = query(collection(db, 'aiAccountantClients', clientId, 'transactions'));
            const transSnap = await getDocs(transQuery);
            const fetchedTransactions = transSnap.docs.map(d => ({id: d.id, ...d.data()}) as AllocatedTransaction);
            setTransactions(fetchedTransactions);

        } catch (e) {
            toast({ title: 'Error', description: 'Failed to fetch client data.', variant: 'destructive' });
        } finally {
            setIsLoading(false);
        }
    }
  
    useEffect(() => {
        fetchClientData();
    }, [clientId]);

    const filteredAccounts = useMemo(() => {
        if (!client?.chartOfAccounts) return [];
        return client.chartOfAccounts.filter(acc => 
            acc.description.toLowerCase().includes(filter.toLowerCase()) || 
            acc.accountNumber.includes(filter)
        );
    }, [client, filter]);

    const handleSaveAccount = async (data: AccountFormValues) => {
        if (!client) return;
        
        let updatedAccounts: ChartOfAccount[];
        if (editingAccount && data.id) { // Editing existing account
            updatedAccounts = client.chartOfAccounts?.map(acc => acc.id === data.id ? { ...acc, ...data } : acc) || [];
        } else { // Adding new account
            const existingAccount = client.chartOfAccounts?.find(acc => acc.accountNumber === data.accountNumber);
            if(existingAccount) {
                toast({ title: 'Duplicate Account', description: 'An account with this number already exists.', variant: 'destructive' });
                return;
            }
            const newAccount: ChartOfAccount = { ...data, id: data.accountNumber };
            updatedAccounts = [...(client.chartOfAccounts || []), newAccount];
        }

        try {
            const clientRef = doc(db, 'aiAccountantClients', client.id);
            await updateDoc(clientRef, { chartOfAccounts: updatedAccounts });
            toast({ title: 'Success', description: `Account ${editingAccount ? 'updated' : 'created'} successfully.` });
            setIsFormOpen(false);
            setEditingAccount(null);
            await fetchClientData();
        } catch (error) {
            toast({ title: 'Error', description: 'Failed to save account.', variant: 'destructive' });
        }
    };
    
    const handleDeleteAccount = async (accountId: string) => {
        if (!client?.chartOfAccounts) return;
        
        const isAccountInUse = transactions.some(tx => tx.allocatedTo?.value === accountId);

        if(isAccountInUse) {
            toast({
                title: 'Cannot Delete Account',
                description: 'This account has transactions allocated to it and cannot be deleted.',
                variant: 'destructive',
            });
            return;
        }

        const updatedAccounts = client.chartOfAccounts.filter(acc => acc.id !== accountId);

        try {
            const clientRef = doc(db, 'aiAccountantClients', client.id);
            await updateDoc(clientRef, { chartOfAccounts: updatedAccounts });
            toast({ title: 'Success', description: 'Account deleted successfully.', variant: 'destructive' });
            await fetchClientData();
        } catch(error) {
            toast({ title: 'Error', description: 'Failed to delete account.', variant: 'destructive' });
        }
    }

    const handleResetToMaster = async () => {
        if (!client) return;

        try {
            const clientRef = doc(db, 'aiAccountantClients', client.id);
            await updateDoc(clientRef, { chartOfAccounts: masterChartOfAccounts });
            toast({ title: 'Chart of Accounts Reset', description: 'The accounts have been reset to the master list.' });
            await fetchClientData();
        } catch (error) {
             toast({ title: 'Error', description: 'Failed to reset accounts.', variant: 'destructive' });
        }
    }

    if (isLoading && !client) {
        return <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin" /></div>;
    }

    return (
        <Dialog open={isFormOpen} onOpenChange={(open) => { setIsFormOpen(open); if(!open) setEditingAccount(null); }}>
            <Card>
                <CardHeader>
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <div>
                            <CardTitle>Chart of Accounts</CardTitle>
                            <CardDescription>Manage the accounts for {client?.companyName || client?.name}.</CardDescription>
                        </div>
                         <div className="flex gap-2 flex-wrap">
                            <ImportAccountsDialog client={client} onImportComplete={fetchClientData} />
                             <DialogTrigger asChild>
                                <Button size="sm" onClick={() => setEditingAccount(null)}>
                                    <PlusCircle className="mr-2 h-4 w-4" /> Create Account
                                </Button>
                            </DialogTrigger>
                             <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button size="sm" variant="destructive">Reset to Master</Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                            This action will replace the current chart of accounts with the master template. Any custom accounts will be lost. This cannot be undone.
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                        <AlertDialogAction onClick={handleResetToMaster}>Yes, Reset</AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        </div>
                    </div>
                    <Input 
                        placeholder="Filter accounts..." 
                        value={filter} 
                        onChange={(e) => setFilter(e.target.value)}
                        className="mt-4 max-w-sm"
                    />
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Account Number</TableHead>
                                <TableHead>Description</TableHead>
                                <TableHead>Section</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredAccounts.map(acc => (
                                <TableRow key={acc.id}>
                                    <TableCell className="font-mono">{acc.accountNumber}</TableCell>
                                    <TableCell>{acc.description}</TableCell>
                                    <TableCell>{acc.section}</TableCell>
                                    <TableCell className="text-right">
                                         <AlertDialog>
                                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditingAccount(acc); setIsFormOpen(true);}}>
                                                <Edit className="h-4 w-4" />
                                            </Button>
                                            <AlertDialogTrigger asChild>
                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive">
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </AlertDialogTrigger>
                                            <AlertDialogContent>
                                                <AlertDialogHeader>
                                                    <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                                    <AlertDialogDescription>This will permanently delete the account: {acc.accountNumber} - {acc.description}.</AlertDialogDescription>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter>
                                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                    <AlertDialogAction onClick={() => handleDeleteAccount(acc.id)}>Delete</AlertDialogAction>
                                                </AlertDialogFooter>
                                            </AlertDialogContent>
                                        </AlertDialog>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>{editingAccount ? 'Edit' : 'Create'} Account</DialogTitle>
                </DialogHeader>
                <AccountForm 
                    account={editingAccount} 
                    onSave={handleSaveAccount} 
                    onCancel={() => setIsFormOpen(false)}
                />
            </DialogContent>
        </Dialog>
    );
}