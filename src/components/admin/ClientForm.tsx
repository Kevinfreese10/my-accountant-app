
'use client';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { User } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '../ui/separator';
import { Switch } from '../ui/switch';
import { Textarea } from '../ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/dialog';
import MediaLibrary from './MediaLibrary';
import { useState } from 'react';
import { Images, Loader2 } from 'lucide-react';
import Image from 'next/image';
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { firebaseApp } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

const storage = getStorage(firebaseApp);

const clientStatuses: ('Active' | 'Inactive' | 'Archived')[] = ['Active', 'Inactive', 'Archived'];
const months = [ "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December" ];
const vatCategories: { value: 'A' | 'B' | 'C'; label: string }[] = [
    { value: 'A', label: 'Category A (Odd Months)' },
    { value: 'B', label: 'Category B (Even Months)' },
    { value: 'C', label: 'Category C (Monthly)' },
];


const formSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(2, 'Client/Company name is required.'),
  contactPerson: z.string().optional(),
  email: z.string().email('A valid email address is required.').optional().or(z.literal('')),
  
  yearEnd: z.string().optional(),
  isVatRegistered: z.boolean().default(false),
  vatNumber: z.string().optional(),
  vatCategory: z.enum(['A', 'B', 'C']).optional(),
  cellNumber: z.string().optional(),
  status: z.enum(clientStatuses).optional(),
  
  createAIProfile: z.boolean().default(false),
  
  address: z.object({
      street: z.string().optional(),
      suburb: z.string().optional(),
      city: z.string().optional(),
      province: z.string().optional(),
      zip: z.string().optional(),
  }).optional(),
  
  bankingDetails: z.object({
      bankName: z.string().optional(),
      accountHolder: z.string().optional(),
      accountNumber: z.string().optional(),
      branchCode: z.string().optional(),
  }).optional(),
  
  nextInvoiceNumber: z.preprocess(
    (val) => (val === '' ? undefined : Number(val)),
    z.number().min(1, 'Must be a positive number.').optional()
  ),
  logoUrl: z.string().url().optional().or(z.literal('')),
});

export default function ClientForm({ 
    client, 
    onSubmit, 
    onCancel, 
    isAIClient = false 
}: { 
    client: Partial<User> | null, 
    onSubmit: (data: any) => void, 
    onCancel: () => void, 
    isAIClient?: boolean,
}) {
    const { user } = useAuth();
    const { toast } = useToast();
    
    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            id: client?.id || '',
            name: client?.name || client?.companyName || '',
            contactPerson: client?.contactPerson || '',
            email: client?.email || '',
            
            yearEnd: client?.yearEnd || undefined,
            isVatRegistered: client?.isVatRegistered || false,
            vatNumber: (client as any)?.vatNumber || '',
            vatCategory: (client as any)?.vatCategory || undefined,
            cellNumber: client?.contactNumber || '',
            status: client?.status || 'Active',
            
            createAIProfile: isAIClient || client?.hasNumeraProfile || false,

            address: {
                street: client?.address?.street || '',
                suburb: client?.address?.suburb || '',
                city: client?.address?.city || '',
                province: client?.address?.province || '',
                zip: client?.address?.zip || '',
            },
            bankingDetails: {
                bankName: client?.bankingDetails?.bankName || '',
                accountHolder: client?.bankingDetails?.accountHolder || '',
                accountNumber: client?.bankingDetails?.accountNumber || '',
                branchCode: client?.bankingDetails?.branchCode || '',
            },
            nextInvoiceNumber: client?.nextInvoiceNumber || 1000,
            logoUrl: client?.logoUrl || '',
        },
    });

    const isVatRegistered = form.watch('isVatRegistered');
    const [isMediaLibraryOpen, setIsMediaLibraryOpen] = useState(false);
    const currentLogoUrl = form.watch('logoUrl');

    const handleSubmit = (values: z.infer<typeof formSchema>) => {
        const finalValues = {
            ...values,
            email: (isAIClient && !values.email) 
                ? `${values.name.toLowerCase().replace(/[^a-z0-9]/g, '')}${Date.now()}@my-company.ai`
                : values.email,
        }
        onSubmit(finalValues);
    };
    
    return (
        <Form {...form}>
            <Dialog open={isMediaLibraryOpen} onOpenChange={setIsMediaLibraryOpen}>
                <DialogContent className="max-w-4xl">
                    <DialogHeader>
                        <DialogTitle>Media Library</DialogTitle>
                        <DialogDescription>Select an image for the company logo.</DialogDescription>
                    </DialogHeader>
                    <MediaLibrary onSelectImage={(url) => {
                        form.setValue('logoUrl', url);
                        setIsMediaLibraryOpen(false);
                    }} 
                    accept="image/*"
                    />
                </DialogContent>
            </Dialog>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6 max-h-[70vh] overflow-y-auto p-1 pr-4">
                <div className="space-y-4">
                    <h3 className="text-lg font-medium">Company Details</h3>
                    <FormField control={form.control} name="name" render={({ field }) => ( <FormItem><FormLabel>Company Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                    {!isAIClient && (
                         <>
                            <FormField control={form.control} name="contactPerson" render={({ field }) => ( <FormItem><FormLabel>Contact Person Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                            <FormField control={form.control} name="email" render={({ field }) => ( <FormItem><FormLabel>Email Address</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                            <FormField control={form.control} name="cellNumber" render={({ field }) => ( <FormItem><FormLabel>Cell Number</FormLabel><FormControl><Input placeholder="e.g. 0821234567" {...field} /></FormControl><FormMessage /></FormItem>)} />
                         </>
                    )}
                    <FormField control={form.control} name="status" render={({ field }) => ( <FormItem><FormLabel>Status</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select a status" /></SelectTrigger></FormControl><SelectContent>{clientStatuses.map(status => <SelectItem key={status} value={status}>{status}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                </div>
                 <div className="space-y-4 pt-4">
                    <h3 className="text-lg font-medium">Company Address</h3>
                    <FormField control={form.control} name="address.street" render={({ field }) => ( <FormItem><FormLabel>Street Address</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        <FormField control={form.control} name="address.suburb" render={({ field }) => ( <FormItem><FormLabel>Suburb</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                        <FormField control={form.control} name="address.city" render={({ field }) => ( <FormItem><FormLabel>City</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                        <FormField control={form.control} name="address.zip" render={({ field }) => ( <FormItem><FormLabel>Postal Code</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                    </div>
                </div>

                <Separator />
                <div className="space-y-4">
                     <h3 className="text-lg font-medium">Financial & Invoicing Setup</h3>
                     
                     {!isAIClient && (
                         <FormField control={form.control} name="createAIProfile" render={({ field }) => (
                            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                                <div className="space-y-0.5"><FormLabel>Create AI Accountant Profile?</FormLabel><FormDescription>This will give the client access to the AI Accountant module.</FormDescription></div>
                                <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                            </FormItem>
                         )}/>
                     )}

                    <FormField control={form.control} name="yearEnd" render={({ field }) => ( <FormItem><FormLabel>Financial Year End</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select a month" /></SelectTrigger></FormControl><SelectContent>{months.map(month => <SelectItem key={month} value={month}>{month}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                    
                    <FormField control={form.control} name="isVatRegistered" render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                            <div className="space-y-0.5"><FormLabel>Is the client registered for VAT?</FormLabel></div>
                            <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                        </FormItem>
                    )} />
                     {isVatRegistered && (
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <FormField control={form.control} name="vatNumber" render={({ field }) => ( <FormItem><FormLabel>VAT Registration Number</FormLabel><FormControl><Input placeholder="4..." {...field} /></FormControl><FormMessage /></FormItem>)} />
                            <FormField control={form.control} name="vatCategory" render={({ field }) => ( <FormItem><FormLabel>VAT Category</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger></FormControl><SelectContent>{vatCategories.map(cat => <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                         </div>
                    )}
                     <FormField control={form.control} name="nextInvoiceNumber" render={({ field }) => ( <FormItem><FormLabel>Next Invoice Number</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormDescription>Set the starting number for the next generated invoice.</FormDescription><FormMessage /></FormItem>)} />
                    <FormField
                        control={form.control}
                        name="logoUrl"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Company Logo</FormLabel>
                                 <div className="flex items-center gap-4">
                                     <div className="relative h-24 w-24 flex-shrink-0 border rounded-md overflow-hidden bg-muted">
                                        {currentLogoUrl && <Image src={currentLogoUrl} alt="Company logo" fill className="object-contain"/>}
                                    </div>
                                    <div className="flex-grow">
                                        <Button type="button" variant="outline" size="sm" onClick={() => setIsMediaLibraryOpen(true)}>
                                            <Images className="mr-2 h-4 w-4"/>
                                            Select from Media Library
                                        </Button>
                                    </div>
                                </div>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                </div>
                 <div className="space-y-4 pt-4">
                    <h3 className="text-lg font-medium">Banking Details</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField control={form.control} name="bankingDetails.bankName" render={({ field }) => ( <FormItem><FormLabel>Bank Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                        <FormField control={form.control} name="bankingDetails.accountHolder" render={({ field }) => ( <FormItem><FormLabel>Account Holder</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                        <FormField control={form.control} name="bankingDetails.accountNumber" render={({ field }) => ( <FormItem><FormLabel>Account Number</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                        <FormField control={form.control} name="bankingDetails.branchCode" render={({ field }) => ( <FormItem><FormLabel>Branch Code</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                    </div>
                </div>
                
                <div className="flex justify-end gap-2 pt-4">
                    <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>
                    <Button type="submit">Save Changes</Button>
                </div>
            </form>
        </Form>
    )
}
