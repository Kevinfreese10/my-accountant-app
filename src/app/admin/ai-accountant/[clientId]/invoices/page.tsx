

'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm, useFieldArray, useWatch } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, Plus, Trash2, CalendarIcon, PlusCircle, MoreHorizontal, Eye, Copy, FileText, Mail, Download, CheckCircle, ChevronsUpDown } from 'lucide-react';
import { getFirestore, doc, addDoc, getDoc, collection, query, orderBy, getDocs, updateDoc, writeBatch, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useParams } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { User, Invoice, ClientCustomer, ChartOfAccount } from '@/lib/types';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { allVatTypes } from '@/lib/vat-types';
import { Calendar } from "@/components/ui/calendar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import InvoicePreview from '@/components/admin/InvoicePreview';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';

const lineItemSchema = z.object({
    accountId: z.string().min(1, "Please select an account."),
    description: z.string().min(1, "Description is required."),
    quantity: z.preprocess((val) => Number(val), z.number().min(1)),
    rate: z.preprocess((val) => Number(val), z.number().min(0)),
    vatType: z.string().default('standard_rated_sales'),
});

const invoiceFormSchema = z.object({
    customerId: z.string().min(1, "Please select a customer."),
    invoiceDate: z.date({ required_error: "Invoice date is required." }),
    dueDate: z.date({ required_error: "Due date is required." }),
    lineItems: z.array(lineItemSchema).min(1, "At least one line item is required."),
    notes: z.string().optional(),
});

type InvoiceFormValues = z.infer<typeof invoiceFormSchema>;

const formatPrice = (price: number) => new Intl.NumberFormat('en-GB', { style: 'decimal', minimumFractionDigits: 2 }).format(price);

// A new component to calculate and display totals
function InvoiceTotals({ control, isVatRegistered }: { control: any, isVatRegistered: boolean | undefined }) {
  const watchedLines = useWatch({
    control,
    name: "lineItems",
  });

  const totals = useMemo(() => {
    let subtotal = 0;
    let vat = 0;
    watchedLines.forEach((line: any) => {
      const lineSubtotal = (line.quantity || 0) * (line.rate || 0);
      subtotal += lineSubtotal;
      if (isVatRegistered && line.vatType === 'standard_rated_sales') {
        vat += lineSubtotal * 0.15;
      }
    });
    const total = subtotal + vat;
    return { subtotal, vat, total };
  }, [watchedLines, isVatRegistered]);

  return (
    <CardFooter className="p-4 bg-muted rounded-lg mt-4 flex flex-col items-end gap-2 max-w-sm ml-auto">
        <div className="flex justify-between w-full text-sm"><span className="text-muted-foreground">Subtotal:</span><span>{formatPrice(totals.subtotal)}</span></div>
        {isVatRegistered && <div className="flex justify-between w-full text-sm"><span className="text-muted-foreground">VAT (15%):</span><span>{formatPrice(totals.vat)}</span></div>}
        <div className="flex justify-between w-full font-bold text-lg"><span >Total:</span><span>{formatPrice(totals.total)}</span></div>
    </CardFooter>
  );
}

export default function InvoicesPage() {
    const params = useParams();
    const clientId = params.clientId as string;
    const [client, setClient] = useState<User | null>(null);
    const [customers, setCustomers] = useState<ClientCustomer[]>([]);
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const { toast } = useToast();
    const [accounts, setAccounts] = useState<ChartOfAccount[]>([]);
    const [viewingInvoice, setViewingInvoice] = useState<Invoice | null>(null);


    const handleDownloadPdf = async (invoiceToDownload: Invoice) => {
        const customer = customers.find(c => c.id === invoiceToDownload.customerId);
        if (!client || !customer) {
            toast({ title: "Error", description: "Cannot generate PDF without client or customer data.", variant: "destructive" });
            return;
        }

        const element = document.createElement("div");
        element.style.position = 'absolute';
        element.style.left = '-9999px';
        element.style.top = '0';
        element.style.width = '800px'; 
        document.body.appendChild(element);

        const root = createRoot(element);
        flushSync(() => {
            root.render(<InvoicePreview invoice={invoiceToDownload} client={client} customer={customer} />);
        });
        
        await new Promise(resolve => setTimeout(resolve, 100));
        
        const invoiceElement = element.children[0] as HTMLElement;

        const canvas = await html2canvas(invoiceElement, {
            scale: 2,
            useCORS: true,
            width: invoiceElement.scrollWidth,
            height: invoiceElement.scrollHeight + 20, // Add a small buffer to height
            windowWidth: invoiceElement.scrollWidth,
            windowHeight: invoiceElement.scrollHeight + 20,
        });

        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF('p', 'mm', 'a4');
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = pdf.internal.pageSize.getHeight();
        const imgProps = pdf.getImageProperties(imgData);
        const imgHeight = (imgProps.height * pdfWidth) / imgProps.width;

        let heightLeft = imgHeight;
        let position = 0;

        pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, imgHeight, undefined, 'FAST');
        heightLeft -= pdfHeight;

        while (heightLeft > 0) {
            position = position - pdfHeight;
            pdf.addPage();
            pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, imgHeight, undefined, 'FAST');
            heightLeft -= pdfHeight;
        }

        pdf.save(`Invoice-${invoiceToDownload.id}.pdf`);

        root.unmount();
        document.body.removeChild(element);
    };


    const form = useForm<InvoiceFormValues>({
        resolver: zodResolver(invoiceFormSchema),
        defaultValues: {
            invoiceDate: new Date(),
            dueDate: new Date(new Date().setDate(new Date().getDate() + 30)),
            lineItems: [{ accountId: '', description: '', quantity: 1, rate: 0, vatType: 'standard_rated_sales' }],
            notes: '',
        },
    });

    const { fields, append, remove, update } = useFieldArray({
        control: form.control,
        name: "lineItems",
    });

    const handleAccountChange = (value: string, index: number) => {
        const selectedAccount = accounts.find(acc => acc.id === value);
        if (selectedAccount) {
            const currentLine = form.getValues(`lineItems.${index}`);
            const newVatType = selectedAccount.accountNumber === '1000-001' ? 'zero_rated_sales' : 'standard_rated_sales';
            update(index, {
                ...currentLine,
                accountId: value,
                description: currentLine.description || selectedAccount.description,
                vatType: client?.isVatRegistered ? newVatType : 'no_vat'
            });
        }
    };

    const fetchData = async () => {
        if (!clientId) return;
        setIsLoading(true);
        try {
            const clientRef = doc(db, 'aiAccountantClients', clientId);
            const clientSnap = await getDoc(clientRef);
            if (clientSnap.exists()) {
                const clientData = clientSnap.data() as User;
                setClient(clientData);
                setAccounts(clientData.chartOfAccounts?.filter(acc => acc.accountNumber.startsWith('1000-')).sort((a,b) => a.accountNumber.localeCompare(b.accountNumber)) || []);
                // If client is not VAT registered, default all lines to 'no_vat'
                if (!clientData.isVatRegistered) {
                    form.getValues('lineItems').forEach((_, index) => {
                        form.setValue(`lineItems.${index}.vatType`, 'no_vat');
                    });
                }
            }
            
            const customersQuery = query(collection(db, `aiAccountantClients/${clientId}/customers`), orderBy("name"));
            const customersSnapshot = await getDocs(customersQuery);
            setCustomers(customersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ClientCustomer)));
            
            const invoicesQuery = query(collection(db, `aiAccountantClients/${clientId}/invoices`), orderBy("invoiceDate", "desc"));
            const invoicesSnapshot = await getDocs(invoicesQuery);
            setInvoices(invoicesSnapshot.docs.map(docSnap => {
                const data = docSnap.data();
                return { 
                    id: docSnap.id, 
                    ...data,
                    invoiceDate: data.invoiceDate.toDate(),
                    dueDate: data.dueDate.toDate(),
                } as Invoice
            }));

        } catch (e) {
            toast({ title: 'Error', description: 'Failed to fetch data.', variant: 'destructive' });
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [clientId, toast]);

    const onSubmit = async (data: InvoiceFormValues) => {
        if (!client || !client.id) return;
        
        const isVatPayer = client?.isVatRegistered;
        let subtotal = 0;
        let vat = 0;
        data.lineItems.forEach(line => {
            const lineSubtotal = (line.quantity || 0) * (line.rate || 0);
            subtotal += lineSubtotal;
            if (isVatPayer && line.vatType === 'standard_rated_sales') {
                vat += lineSubtotal * 0.15;
            }
        });
        const total = subtotal + vat;

        const nextInvoiceNumber = client.nextInvoiceNumber || 9000;
        const invoiceId = String(nextInvoiceNumber);
        
        try {
            const batch = writeBatch(db);
            const invoiceRef = doc(db, `aiAccountantClients/${clientId}/invoices`, invoiceId);

            batch.set(invoiceRef, {
                ...data,
                status: 'final',
                subtotal: subtotal,
                vat: vat,
                total: total,
                createdAt: new Date(),
            });

            // Increment invoice number on client profile
            const clientRef = doc(db, 'aiAccountantClients', clientId);
            batch.update(clientRef, { nextInvoiceNumber: nextInvoiceNumber + 1 });

            const customerControlAccount = client.chartOfAccounts?.find(acc => acc.accountNumber === '8000-001')?.id;
            const vatControlAccount = client.chartOfAccounts?.find(acc => acc.accountNumber === '7000-008')?.id;

            if (!customerControlAccount || (client.isVatRegistered && !vatControlAccount)) {
                throw new Error("Control accounts not found in Chart of Accounts.");
            }
            
            // 1. Debit Customer Control
            const debitTxRef = doc(collection(db, 'aiAccountantClients', client.id, 'transactions'));
            batch.set(debitTxRef, {
                clientId: client.id,
                date: data.invoiceDate.toISOString(),
                reference: `INV-${invoiceId}`,
                description: `Invoice to ${customers.find(c => c.id === data.customerId)?.name}`,
                amount: total,
                bankAccountId: 'JOURNAL',
                allocatedTo: { value: customerControlAccount, type: 'account' },
                vatType: 'no_vat',
                vatAmount: 0,
                status: 'allocated',
                allocatedAt: new Date(),
            });

            // 2. Credit Sales Accounts
            data.lineItems.forEach(line => {
                const lineTotal = line.quantity * line.rate;
                const salesCreditRef = doc(collection(db, 'aiAccountantClients', client.id, 'transactions'));
                batch.set(salesCreditRef, {
                    clientId: client.id,
                    date: data.invoiceDate.toISOString(),
                    reference: `INV-${invoiceId}`,
                    description: line.description,
                    amount: -lineTotal,
                    bankAccountId: 'JOURNAL',
                    allocatedTo: { value: line.accountId, type: 'account' },
                    vatType: line.vatType as any,
                    vatAmount: 0,
                    status: 'allocated',
                    allocatedAt: new Date(),
                });
            });
            
            // 3. Credit VAT Control
            if (vat > 0 && vatControlAccount) {
                 const vatCreditRef = doc(collection(db, 'aiAccountantClients', client.id, 'transactions'));
                batch.set(vatCreditRef, {
                    clientId: client.id,
                    date: data.invoiceDate.toISOString(),
                    reference: `INV-${invoiceId}`,
                    description: `VAT on Invoice`,
                    amount: -vat,
                    bankAccountId: 'JOURNAL',
                    allocatedTo: { value: vatControlAccount, type: 'account' },
                    vatType: 'no_vat',
                    vatAmount: 0,
                    status: 'allocated',
                    allocatedAt: new Date(),
                });
            }

            await batch.commit();

            toast({ title: 'Invoice Finalized', description: 'The invoice has been created and posted to the general ledger.' });
            form.reset({
                 invoiceDate: new Date(),
                 dueDate: new Date(new Date().setDate(new Date().getDate() + 30)),
                 lineItems: [{ accountId: '', description: '', quantity: 1, rate: 0, vatType: client?.isVatRegistered ? 'standard_rated_sales' : 'no_vat' }],
                 notes: '',
            });
            fetchData();
        } catch (error) {
            toast({ title: 'Error', description: 'Failed to create invoice.', variant: 'destructive' });
            console.error(error);
        }
    };
    
    const vatTypes = allVatTypes.filter(vt => vt.category === 'Output Tax');

    return (
        <Dialog onOpenChange={(isOpen) => !isOpen && setViewingInvoice(null)}>
            <div className="space-y-8">
                <Card>
                    <CardHeader>
                        <CardTitle>Invoices</CardTitle>
                        <CardDescription>A list of invoices created for {client?.name}.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {isLoading ? (
                            <div className="flex justify-center items-center h-40">
                                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                            </div>
                        ) : (
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Invoice #</TableHead>
                                        <TableHead>Customer</TableHead>
                                        <TableHead>Date</TableHead>
                                        <TableHead>Due Date</TableHead>
                                        <TableHead className="text-right">Total</TableHead>
                                        <TableHead className="text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {invoices.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={6} className="text-center h-24 text-muted-foreground">
                                                No invoices created yet.
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        invoices.map((invoice) => (
                                            <TableRow key={invoice.id}>
                                                <TableCell className="font-mono">{invoice.id}</TableCell>
                                                <TableCell>{customers.find(c => c.id === invoice.customerId)?.name}</TableCell>
                                                <TableCell>{format(invoice.invoiceDate, "dd/MM/yyyy")}</TableCell>
                                                <TableCell>{format(invoice.dueDate, "dd/MM/yyyy")}</TableCell>
                                                <TableCell className="text-right">{formatPrice(invoice.total)}</TableCell>
                                                <TableCell className="text-right">
                                                    <Dialog>
                                                        <DropdownMenu>
                                                            <DropdownMenuTrigger asChild>
                                                                <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
                                                            </DropdownMenuTrigger>
                                                            <DropdownMenuContent>
                                                                <DialogTrigger asChild>
                                                                    <DropdownMenuItem onSelect={() => setViewingInvoice(invoice)}>
                                                                        <Eye className="mr-2 h-4 w-4" />View
                                                                    </DropdownMenuItem>
                                                                </DialogTrigger>
                                                                <DropdownMenuItem><Copy className="mr-2 h-4 w-4" />Duplicate</DropdownMenuItem>
                                                                <DropdownMenuItem><FileText className="mr-2 h-4 w-4" />Issue Credit Note</DropdownMenuItem>
                                                                <DropdownMenuItem><Mail className="mr-2 h-4 w-4" />Email to Client</DropdownMenuItem>
                                                            </DropdownMenuContent>
                                                        </DropdownMenu>
                                                        <DialogContent className="sm:max-w-4xl">
                                                            <DialogHeader>
                                                                <DialogTitle>Tax Invoice Preview</DialogTitle>
                                                            </DialogHeader>
                                                            {viewingInvoice && (
                                                                <>
                                                                <InvoicePreview
                                                                    invoice={viewingInvoice}
                                                                    client={client}
                                                                    customer={customers.find(c => c.id === viewingInvoice.customerId)}
                                                                />
                                                                <DialogFooter>
                                                                    <Button onClick={() => handleDownloadPdf(viewingInvoice)}><Download className="mr-2 h-4 w-4"/>Download PDF</Button>
                                                                </DialogFooter>
                                                                </>
                                                            )}
                                                        </DialogContent>
                                                    </Dialog>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        )}
                    </CardContent>
                </Card>

                <Separator />

                <Card>
                    <CardHeader>
                        <CardTitle>Create New Invoice</CardTitle>
                        <CardDescription>Generate a new invoice for a customer.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Form {...form}>
                            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                                    <FormField
                                        control={form.control}
                                        name="customerId"
                                        render={({ field }) => (
                                            <FormItem className="flex flex-col">
                                            <FormLabel>Customer</FormLabel>
                                            <Popover>
                                                <PopoverTrigger asChild>
                                                <FormControl>
                                                    <Button
                                                    variant="outline"
                                                    role="combobox"
                                                    className={cn("w-full justify-between", !field.value && "text-muted-foreground")}
                                                    >
                                                    {field.value ? customers.find(c => c.id === field.value)?.name : "Select a customer"}
                                                    </Button>
                                                </FormControl>
                                                </PopoverTrigger>
                                                <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                                                    <Command>
                                                        <CommandInput placeholder="Search customer..."/>
                                                        <CommandList>
                                                            <CommandEmpty>No customers found.</CommandEmpty>
                                                            {customers.map(c => (
                                                                <CommandItem key={c.id} onSelect={() => { form.setValue("customerId", c.id) }}>{c.name}</CommandItem>
                                                            ))}
                                                        </CommandList>
                                                    </Command>
                                                </PopoverContent>
                                            </Popover>
                                            <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <div className="grid grid-cols-2 gap-4">
                                        <FormField control={form.control} name="invoiceDate" render={({ field }) => ( <FormItem className="flex flex-col"><FormLabel>Invoice Date</FormLabel><Popover><PopoverTrigger asChild><FormControl><Button variant={"outline"} className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")}><CalendarIcon className="mr-2 h-4 w-4" />{field.value ? format(field.value, "PPP") : <span>Pick a date</span>}</Button></FormControl></PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus /></PopoverContent></Popover><FormMessage /></FormItem> )}/>
                                        <FormField control={form.control} name="dueDate" render={({ field }) => ( <FormItem className="flex flex-col"><FormLabel>Due Date</FormLabel><Popover><PopoverTrigger asChild><FormControl><Button variant={"outline"} className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")}><CalendarIcon className="mr-2 h-4 w-4" />{field.value ? format(field.value, "PPP") : <span>Pick a date</span>}</Button></FormControl></PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus /></PopoverContent></Popover><FormMessage /></FormItem> )}/>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <div className="hidden md:grid gap-x-3 text-xs font-semibold px-2 grid-cols-[2fr_3fr_1fr_1fr_1.5fr_1fr_0.5fr]">
                                        <span className="text-left">Account</span>
                                        <span className="text-left">Description</span>
                                        <span className="text-center">Qty</span>
                                        <span className="text-center">Unit Price</span>
                                        {client?.isVatRegistered && <span className="text-center">Tax Code</span>}
                                        <span className="text-right">Total</span>
                                        <span></span>
                                    </div>
                                    {fields.map((field, index) => {
                                        const watchedLine = form.watch(`lineItems.${index}`);
                                        return (
                                            <div key={field.id} className={`grid grid-cols-1 md:gap-x-3 gap-y-2 items-start p-2 border rounded-md ${client?.isVatRegistered ? 'md:grid-cols-[2fr_3fr_1fr_1fr_1.5fr_1fr_0.5fr]' : 'md:grid-cols-[2fr_4fr_1fr_2fr_1fr_0.5fr]'}`}>
                                                <FormField control={form.control} name={`lineItems.${index}.accountId`} render={({ field }) => ( <FormItem><FormLabel className="md:hidden">Account</FormLabel><Popover><PopoverTrigger asChild><FormControl><Button variant="outline" role="combobox" className="w-full justify-between h-9 text-xs">{field.value ? accounts.find(a => a.id === field.value)?.description : "Select account..."}<ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" /></Button></FormControl></PopoverTrigger><PopoverContent className="w-[--radix-popover-trigger-width] p-0"><Command><CommandInput placeholder="Search account..." /><CommandList><CommandEmpty>No account found.</CommandEmpty>{accounts.map((acc) => (<CommandItem value={acc.description} key={acc.id} onSelect={() => handleAccountChange(acc.id, index)}>{acc.description}</CommandItem>))}</CommandList></Command></PopoverContent></Popover><FormMessage /></FormItem> )}/>
                                                <FormField control={form.control} name={`lineItems.${index}.description`} render={({ field }) => ( <FormItem><FormLabel className="md:hidden">Description</FormLabel><FormControl><Input {...field} className="h-9 text-xs" /></FormControl><FormMessage /></FormItem> )}/>
                                                <FormField control={form.control} name={`lineItems.${index}.quantity`} render={({ field }) => ( <FormItem><FormLabel className="md:hidden">Qty</FormLabel><FormControl><Input type="number" {...field} className="h-9 text-xs text-center" /></FormControl><FormMessage /></FormItem> )}/>
                                                <FormField control={form.control} name={`lineItems.${index}.rate`} render={({ field }) => ( <FormItem><FormLabel className="md:hidden">Unit Price</FormLabel><FormControl><Input type="number" step="0.01" {...field} className="h-9 text-xs text-right" /></FormControl><FormMessage /></FormItem> )}/>
                                                {client?.isVatRegistered && 
                                                    <FormField 
                                                        control={form.control} 
                                                        name={`lineItems.${index}.vatType`} 
                                                        render={({ field }) => ( 
                                                            <FormItem>
                                                                <FormLabel className="md:hidden">Tax Code</FormLabel>
                                                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                                    <FormControl><SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger></FormControl>
                                                                    <SelectContent>{vatTypes.map(vt => <SelectItem key={vt.name} value={vt.name}>{vt.label}</SelectItem>)}</SelectContent>
                                                                </Select>
                                                                <FormMessage />
                                                            </FormItem> 
                                                        )}
                                                    />
                                                }
                                                <FormItem><FormLabel className="md:hidden">Total</FormLabel><div className="h-9 text-xs text-right bg-muted flex items-center justify-end px-3 rounded-md font-mono">{formatPrice((watchedLine.quantity || 0) * (watchedLine.rate || 0))}</div></FormItem>
                                                <div className="flex justify-end items-end h-9">
                                                    <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => remove(index)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                                                </div>
                                            </div>
                                        )
                                    })}
                                    <Button type="button" variant="outline" size="sm" onClick={() => append({ accountId: '', description: '', quantity: 1, rate: 0, vatType: client?.isVatRegistered ? 'standard_rated_sales' : 'no_vat' })}>
                                        <Plus className="mr-2 h-4 w-4" /> Add Line
                                    </Button>
                                </div>
                                
                                <InvoiceTotals control={form.control} isVatRegistered={client?.isVatRegistered} />

                                <FormField control={form.control} name="notes" render={({ field }) => ( <FormItem><FormLabel>Notes</FormLabel><FormControl><Textarea {...field} placeholder="Optional notes to appear on the invoice" /></FormControl><FormMessage /></FormItem> )}/>
                                
                                <Button type="submit">
                                    <PlusCircle className="mr-2 h-4 w-4"/>
                                    Create Invoice
                                </Button>
                            </form>
                        </Form>
                    </CardContent>
                </Card>
            </div>
            
        </Dialog>
    );
}
    

    
