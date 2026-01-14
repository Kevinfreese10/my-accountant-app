
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
import { Checkbox } from '../ui/checkbox';

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
  yearEnd: z.string().optional(),
  isVatRegistered: z.boolean().default(false),
  vatCategory: z.enum(['A', 'B', 'C']).optional(),
  status: z.enum(clientStatuses).optional(),
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
            yearEnd: client?.yearEnd || undefined,
            isVatRegistered: client?.isVatRegistered || false,
            vatCategory: (client as any)?.vatCategory || undefined,
            status: client?.status || 'Active',
        },
    });

    const isVatRegistered = form.watch('isVatRegistered');

    const handleSubmit = (values: z.infer<typeof formSchema>) => {
        onSubmit(values);
    };
    
    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6 max-h-[70vh] overflow-y-auto p-1 pr-4">
                <div className="space-y-4">
                    <h3 className="text-lg font-medium">Company Details</h3>
                    <FormField control={form.control} name="name" render={({ field }) => ( <FormItem><FormLabel>Company Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="status" render={({ field }) => ( <FormItem><FormLabel>Status</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select a status" /></SelectTrigger></FormControl><SelectContent>{clientStatuses.map(status => <SelectItem key={status} value={status}>{status}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                    <Separator />
                    <FormField control={form.control} name="yearEnd" render={({ field }) => ( <FormItem><FormLabel>Financial Year End</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select a month" /></SelectTrigger></FormControl><SelectContent>{months.map(month => <SelectItem key={month} value={month}>{month}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                     <FormField control={form.control} name="isVatRegistered" render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                            <div className="space-y-0.5"><FormLabel>Is the client registered for VAT?</FormLabel></div>
                            <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                        </FormItem>
                    )} />
                     {isVatRegistered && (
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <FormField control={form.control} name="vatCategory" render={({ field }) => ( <FormItem><FormLabel>VAT Category</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger></FormControl><SelectContent>{vatCategories.map(cat => <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                         </div>
                    )}
                </div>
                
                <div className="flex justify-end gap-2 pt-4">
                    <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>
                    <Button type="submit">Save Changes</Button>
                </div>
            </form>
        </Form>
    )
}
