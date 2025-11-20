
'use client';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '../ui/textarea';

const formSchema = z.object({
  name: z.string().min(2, 'Customer name is required.'),
  contactPerson: z.string().optional(),
  email: z.string().email('A valid email address is required.').optional().or(z.literal('')),
  cellNumber: z.string().optional(),
  address: z.string().optional(),
  vatNumber: z.string().optional(),
});

export default function AICustomerForm({ 
    customer, 
    onSubmit, 
    onCancel, 
}: { 
    customer: Partial<{ id: string; name: string; contactPerson?: string; email?: string; cellNumber?: string; address?: string; vatNumber?: string; }> | null, 
    onSubmit: (data: any) => void, 
    onCancel: () => void, 
}) {
    
    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            name: customer?.name || '',
            contactPerson: customer?.contactPerson || '',
            email: customer?.email || '',
            cellNumber: customer?.cellNumber || '',
            address: customer?.address || '',
            vatNumber: customer?.vatNumber || '',
        },
    });

    const handleSubmit = (values: z.infer<typeof formSchema>) => {
        onSubmit(values);
    };
    
    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4 max-h-[60vh] overflow-y-auto p-1 pr-4">
                <FormField control={form.control} name="name" render={({ field }) => ( <FormItem><FormLabel>Customer / Company Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="contactPerson" render={({ field }) => ( <FormItem><FormLabel>Contact Person</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="email" render={({ field }) => ( <FormItem><FormLabel>Email Address</FormLabel><FormControl><Input type="email" {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="cellNumber" render={({ field }) => ( <FormItem><FormLabel>Cell Number</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="address" render={({ field }) => ( <FormItem><FormLabel>Address</FormLabel><FormControl><Textarea rows={3} {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="vatNumber" render={({ field }) => ( <FormItem><FormLabel>VAT Number</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                
                <div className="flex justify-end gap-2 pt-4">
                    <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>
                    <Button type="submit">Save Customer</Button>
                </div>
            </form>
        </Form>
    )
}
