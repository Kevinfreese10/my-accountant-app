
'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useState, useEffect, useMemo } from "react";
import { User, AllocatedTransaction, ImportedTransaction, ChartOfAccount } from "@/lib/types";
import { getFirestore, doc, getDoc, collection, query, onSnapshot, orderBy, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { firebaseApp } from '@/lib/firebase';
import { Loader2, Download, Eye, Upload, FileText, Paperclip, Trash2 } from "lucide-react";
import { useParams } from 'next/navigation';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter as TableFooterComponent } from "@/components/ui/table";
import { format, startOfMonth, endOfMonth, subMonths, getYear, getMonth, parseISO } from 'date-fns';
import * as XLSX from 'xlsx';
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";

const db = getFirestore(firebaseApp);
const storage = getStorage(firebaseApp);

const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-GB', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(price);
};

const generateVatPeriods = (vatCategory: 'A' | 'B' | 'C' | null | undefined) => {
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

function VatAuditReport({ client, transactions, period, onUpload, onDeleteFile }: { client: User, transactions: (ImportedTransaction | AllocatedTransaction)[], period: { from: string, to: string }, onUpload: (txId: string, file: File) => void, onDeleteFile: (txId: string, fileUrl: string) => void }) {
    
    const reportData = useMemo(() => {
        const fromDate = parseISO(period.from);
        const toDate = parseISO(period.to);
        const salesAccountIds = client.chartOfAccounts?.filter(acc => acc.accountNumber.startsWith('1000-')).map(acc => acc.id) || [];

        const vatTransactions = transactions.filter(tx => {
            const txDate = tx.date instanceof Date ? tx.date : new Date(tx.date);
            return tx.vatType && tx.vatType !== 'no_vat' && txDate >= fromDate && txDate <= toDate;
        }).map(tx => {
            const isJournal = tx.bankAccountId === 'JOURNAL';
            const isStandardRate = tx.vatType === 'standard_rated_sales' || tx.vatType === 'standard_rated_purchases' || tx.vatType === 'capital_goods_purchases';
            const vatRate = isStandardRate ? 0.15 : 0;

            let exclusiveAmount: number, inclusiveAmount: number, vatAmount: number;

            if (isJournal) {
                // For journals, the stored amount is EXCLUSIVE of VAT.
                exclusiveAmount = tx.amount;
                vatAmount = exclusiveAmount * vatRate;
                inclusiveAmount = exclusiveAmount + vatAmount;
            } else {
                // For bank transactions, the stored amount is INCLUSIVE of VAT.
                inclusiveAmount = tx.amount;
                exclusiveAmount = isStandardRate ? inclusiveAmount / (1 + vatRate) : inclusiveAmount;
                vatAmount = inclusiveAmount - exclusiveAmount;
            }

            return { ...tx, exclusiveAmount, vatAmount, inclusiveAmount };
        });

        const sales = vatTransactions
            .filter(tx => tx.allocatedTo?.value && salesAccountIds.includes(tx.allocatedTo.value))
            .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount))
            .slice(0, 10);

        const expenses = vatTransactions
            .filter(tx => tx.amount < 0 && (!tx.allocatedTo?.value || !salesAccountIds.includes(tx.allocatedTo.value)))
            .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount))
            .slice(0, 10);
            
        return { sales, expenses };
    }, [transactions, period, client.chartOfAccounts]);

    const handleDownloadExcel = () => {
        const wb = XLSX.utils.book_new();

        const createSheetData = (txs: typeof reportData.sales) => txs.map(tx => ({
            Date: format(new Date(tx.date), 'dd/MM/yyyy'),
            Description: tx.description,
            Inclusive: tx.inclusiveAmount,
            Exclusive: tx.exclusiveAmount,
            VAT: tx.vatAmount,
            Documents: tx.auditFiles?.map(f => f.url).join(', ') || '',
        }));

        const salesData = createSheetData(reportData.sales);
        const expensesData = createSheetData(reportData.expenses);

        const salesSheet = XLSX.utils.json_to_sheet(salesData);
        XLSX.utils.book_append_sheet(wb, salesSheet, "Top 10 Sales");

        const expensesSheet = XLSX.utils.json_to_sheet(expensesData);
        XLSX.utils.book_append_sheet(wb, expensesSheet, "Top 10 Expenses");
        
        XLSX.writeFile(wb, `VAT-Audit-${client.name}-${format(parseISO(period.from), 'yyyyMM')}.xlsx`);
    };

    const renderTable = (data: typeof reportData.sales, title: string) => (
        <div>
            <h3 className="text-lg font-semibold mb-2">{title}</h3>
            <Table>
                <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Description</TableHead><TableHead className="text-right">Exclusive</TableHead><TableHead className="text-right">VAT</TableHead><TableHead className="text-right">Inclusive</TableHead><TableHead className="w-1/4">Documents</TableHead></TableRow></TableHeader>
                <TableBody>
                    {data.length === 0 ? (
                        <TableRow><TableCell colSpan={6} className="text-center h-24 text-muted-foreground">No transactions found.</TableCell></TableRow>
                    ) : (
                        data.map((tx, index) => (
                            <TableRow key={index}>
                                <TableCell>{format(new Date(tx.date), 'dd/MM/yyyy')}</TableCell>
                                <TableCell>{tx.description}</TableCell>
                                <TableCell className="text-right font-mono">{formatPrice(tx.exclusiveAmount)}</TableCell>
                                <TableCell className="text-right font-mono">{formatPrice(tx.vatAmount)}</TableCell>
                                <TableCell className="text-right font-mono">{formatPrice(tx.inclusiveAmount)}</TableCell>
                                <TableCell>
                                    <div className="flex flex-col gap-2">
                                        {tx.auditFiles?.map(file => (
                                            <div key={file.url} className="flex items-center justify-between text-xs bg-muted p-1 rounded-md">
                                                <a href={file.url} target="_blank" rel="noopener noreferrer" className="truncate hover:underline flex-grow pr-2">{file.name}</a>
                                                <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => onDeleteFile(tx.id, file.url)}><Trash2 className="h-3 w-3 text-destructive"/></Button>
                                            </div>
                                        ))}
                                        <Input
                                            id={`file-upload-${tx.id}`}
                                            type="file"
                                            className="hidden"
                                            onChange={(e) => e.target.files?.[0] && onUpload(tx.id, e.target.files[0])}
                                        />
                                        <Button asChild variant="outline" size="xs">
                                            <Label htmlFor={`file-upload-${tx.id}`} className="cursor-pointer">
                                                <Upload className="mr-2 h-3 w-3"/> Upload File
                                            </Label>
                                        </Button>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))
                    )}
                </TableBody>
            </Table>
        </div>
    );

    return (
        <>
            <div className="max-h-[70vh] overflow-y-auto space-y-6 p-1">
                {renderTable(reportData.sales, 'Top 10 Sales Transactions (with VAT)')}
                {renderTable(reportData.expenses, 'Top 10 Expense Transactions (with VAT)')}
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

export default function VatAuditPage() {
    const params = useParams();
    const clientId = params.clientId as string;
    const { toast } = useToast();
    const [client, setClient] = useState<User | null>(null);
    const [transactions, setTransactions] = useState<(ImportedTransaction | AllocatedTransaction)[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isUploading, setIsUploading] = useState<string | null>(null);
    const [vatPeriods, setVatPeriods] = useState<{ label: string; from: Date; to: Date; }[]>([]);
    const [selectedPeriod, setSelectedPeriod] = useState<string | undefined>();
    
    useEffect(() => {
        if (!clientId) return;
        setIsLoading(true);
        const clientRef = doc(db, 'aiAccountantClients', clientId);
        
        const clientUnsubscribe = onSnapshot(clientRef, (docSnap) => {
            if (docSnap.exists()) {
                const clientData = docSnap.data() as User;
                setClient(clientData);
                if (clientData.isVatRegistered) {
                    const periods = generateVatPeriods(clientData.vatCategory);
                    setVatPeriods(periods);
                    if (periods.length > 0 && !selectedPeriod) {
                        setSelectedPeriod(JSON.stringify({
                            label: periods[0].label,
                            from: periods[0].from.toISOString(),
                            to: periods[0].to.toISOString(),
                        }));
                    }
                }
            } else {
                setClient(null);
            }
        });

        const transUnsubscribe = onSnapshot(query(collection(db, 'aiAccountantClients', clientId, 'transactions')), snapshot => {
            const fetched = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as (ImportedTransaction | AllocatedTransaction)));
            setTransactions(fetched);
            setIsLoading(false);
        });

        return () => {
            clientUnsubscribe();
            transUnsubscribe();
        };
    }, [clientId, selectedPeriod]);
    
    const handleFileUpload = async (txId: string, file: File) => {
        if (!client) return;
        setIsUploading(txId);
        toast({ title: 'Uploading file...', description: file.name });
        try {
            const uniqueFileName = `${Date.now()}-${file.name}`;
            const storageRef = ref(storage, `vat-audit-docs/${client.id}/${txId}/${uniqueFileName}`);
            const snapshot = await uploadBytes(storageRef, file);
            const downloadURL = await getDownloadURL(snapshot.ref);

            const txRef = doc(db, 'aiAccountantClients', client.id, 'transactions', txId);
            await updateDoc(txRef, {
                auditFiles: arrayUnion({ name: file.name, url: downloadURL })
            });

            toast({ title: 'Upload Complete', description: `${file.name} has been attached.` });
        } catch (error) {
            console.error("File upload failed:", error);
            toast({ title: 'Upload Failed', variant: 'destructive' });
        } finally {
            setIsUploading(null);
        }
    };
    
    const handleDeleteFile = async (txId: string, fileUrl: string) => {
        if(!client) return;
        const tx = transactions.find(t => t.id === txId);
        const fileToDelete = tx?.auditFiles?.find(f => f.url === fileUrl);
        if(!fileToDelete) return;

        try {
            const txRef = doc(db, 'aiAccountantClients', client.id, 'transactions', txId);
            await updateDoc(txRef, {
                auditFiles: arrayRemove(fileToDelete)
            });
            
            const fileStorageRef = ref(storage, fileUrl);
            await deleteObject(fileStorageRef);

            toast({ title: 'File Removed', variant: 'destructive' });
        } catch (error) {
             console.error("File deletion failed:", error);
            toast({ title: 'Deletion Failed', variant: 'destructive' });
        }
    }

    const parsedPeriod = useMemo(() => {
        try {
            return selectedPeriod ? JSON.parse(selectedPeriod) : null;
        } catch {
            return null;
        }
    }, [selectedPeriod]);

    return (
        <Card>
            <CardHeader>
                <CardTitle>VAT Audit Report</CardTitle>
                <CardDescription>Select a VAT period to view the top 10 largest sales and expense transactions with VAT.</CardDescription>
            </CardHeader>
            <CardContent>
                {isLoading ? (
                    <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /><span>Loading client data...</span></div>
                ) : !client?.isVatRegistered ? (
                    <p className="text-destructive">This client is not registered for VAT.</p>
                ) : (
                    <div className="space-y-6 max-w-4xl">
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
                        
                        {parsedPeriod && client && (
                            <Dialog>
                                <DialogTrigger asChild>
                                    <Button><Eye className="mr-2 h-4 w-4"/>View Report</Button>
                                </DialogTrigger>
                                <DialogContent className="sm:max-w-6xl">
                                    <DialogHeader className="text-center mb-4">
                                        <DialogTitle className="text-lg">{client.companyName || client.name}</DialogTitle>
                                        <DialogDescription>
                                            VAT Audit Report for {parsedPeriod.label}
                                        </DialogDescription>
                                    </DialogHeader>
                                    <VatAuditReport client={client} transactions={transactions} period={parsedPeriod} onUpload={handleFileUpload} onDeleteFile={handleDeleteFile} />
                                </DialogContent>
                            </Dialog>
                        )}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
