'use client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { chartOfAccounts as masterChartOfAccounts, setMasterChartOfAccounts } from "@/lib/chart-of-accounts";
import { Input } from "@/components/ui/input";
import { useState, useMemo, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { PlusCircle, Edit, Trash2, Loader2, ChevronsUpDown, CheckCheck } from "lucide-react";
import { ChartOfAccount } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandInput, CommandGroup, CommandList, CommandItem } from "@/components/ui/command";
import { cn } from "@/lib/utils";

const accountFormSchema = z.object({
  id: z.string().optional(),
  accountNumber: z.string().min(1, "Account number is required."),
  description: z.string().min(3, "Description is required."),
  section: z.enum(['Income Statement', 'Balance Sheet']),
});

type AccountFormValues = z.infer<typeof accountFormSchema>;

function AccountForm({ account, onSave, onCancel }: { account: Partial<ChartOfAccount> | null, onSave: (data: AccountFormValues) => void, onCancel: () => void }) {
    const form = useForm<AccountFormValues>({
        resolver: zodResolver(accountFormSchema),
        defaultValues: account ? {
            ...account,
            section: account.section || 'Income Statement',
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

export default function AIASettingsPage() {
    const [searchTerm, setSearchTerm] = useState('');
    const { toast } = useToast();
    const [accounts, setAccounts] = useState<ChartOfAccount[]>([]);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingAccount, setEditingAccount] = useState<ChartOfAccount | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        // Deduplicate master list by account number
        const uniqueAccounts = Array.from(new Map(masterChartOfAccounts.map(item => [item.accountNumber, item])).values());
        setAccounts(uniqueAccounts.sort((a, b) => a.accountNumber.localeCompare(b.accountNumber)));
        setIsLoading(false);
    }, []);

    const filteredAccounts = useMemo(() => {
        if (!searchTerm) {
            return accounts;
        }
        return accounts.filter(account =>
            account.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
            account.accountNumber.includes(searchTerm)
        );
    }, [accounts, searchTerm]);
    
    const handleSaveAccount = (data: AccountFormValues) => {
        let updatedAccounts: ChartOfAccount[];
        if (editingAccount && data.id) { // Editing
            updatedAccounts = accounts.map(acc => acc.id === data.id ? { ...acc, ...data } : acc);
            toast({ title: 'Success', description: `Account updated successfully.` });
        } else { // Adding
            const existingAccount = accounts.find(acc => acc.accountNumber === data.accountNumber);
            if (existingAccount) {
                toast({ title: 'Duplicate Account', description: 'An account with this number already exists.', variant: 'destructive' });
                return;
            }
            const newAccount: ChartOfAccount = { ...data, id: data.accountNumber };
            updatedAccounts = [...accounts, newAccount];
            toast({ title: 'Success', description: `Account created successfully.` });
        }
        
        updatedAccounts.sort((a,b) => a.accountNumber.localeCompare(b.accountNumber));
        setMasterChartOfAccounts(updatedAccounts); // Update the shared master list
        setAccounts(updatedAccounts);

        setIsFormOpen(false);
        setEditingAccount(null);
    };

    const handleDeleteAccount = (accountId: string) => {
        const updatedAccounts = accounts.filter(acc => acc.id !== accountId);
        setMasterChartOfAccounts(updatedAccounts);
        setAccounts(updatedAccounts);
        toast({ title: 'Success', description: 'Account deleted successfully.', variant: 'destructive' });
    };

    return (
        <Dialog open={isFormOpen} onOpenChange={(open) => { setIsFormOpen(open); if(!open) setEditingAccount(null); }}>
            <div className="space-y-8">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">Master Chart of Accounts</h1>
                        <p className="text-muted-foreground">This is the default chart of accounts used for all new AI Accountant client profiles.</p>
                    </div>
                </div>

                <Card>
                    <CardHeader>
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                            <Input
                                placeholder="Search by account name or number..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="max-w-sm"
                            />
                            <DialogTrigger asChild>
                                <Button size="sm" onClick={() => setEditingAccount(null)}>
                                    <PlusCircle className="mr-2 h-4 w-4" /> Create Account
                                </Button>
                            </DialogTrigger>
                        </div>
                    </CardHeader>
                    <CardContent>
                         {isLoading ? (
                            <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin" /></div>
                        ) : (
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
                                {filteredAccounts.map(account => (
                                    <TableRow key={account.id}>
                                        <TableCell className="font-mono">{account.accountNumber}</TableCell>
                                        <TableCell>{account.description}</TableCell>
                                        <TableCell>{account.section}</TableCell>
                                        <TableCell className="text-right">
                                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditingAccount(account); setIsFormOpen(true);}}>
                                                <Edit className="h-4 w-4" />
                                            </Button>
                                            <AlertDialog>
                                                <AlertDialogTrigger asChild>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive">
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </AlertDialogTrigger>
                                                <AlertDialogContent>
                                                    <AlertDialogHeader>
                                                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                                        <AlertDialogDescription>This will permanently delete the master account: {account.accountNumber} - {account.description}. This will not affect existing clients.</AlertDialogDescription>
                                                    </AlertDialogHeader>
                                                    <AlertDialogFooter>
                                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                        <AlertDialogAction onClick={() => handleDeleteAccount(account.id)}>Delete</AlertDialogAction>
                                                    </AlertDialogFooter>
                                                </AlertDialogContent>
                                            </AlertDialog>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                        )}
                    </CardContent>
                </Card>
            </div>
             <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>{editingAccount ? 'Edit' : 'Create'} Master Account</DialogTitle>
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