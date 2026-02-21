
'use client';
import { useForm, useFieldArray } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { User, AllocationRule, ChartOfAccount } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '../ui/separator';
import { Switch } from '../ui/switch';
import { Textarea } from '../ui/textarea';
import { useState, useEffect } from 'react';
import { Loader2, Trash2, CheckCircle2, AlertCircle } from 'lucide-react';
import { getFirestore, collection, getDocs, query, orderBy } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { useToast } from '@/hooks/use-toast';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '../ui/accordion';
import { allVatTypes } from '@/lib/vat-types';
import { chartOfAccounts as masterChartOfAccounts } from '@/lib/chart-of-accounts';

const db = getFirestore(firebaseApp);

const clientStatuses: ('Active' | 'Inactive' | 'Archived')[] = ['Active', 'Inactive', 'Archived'];
const months = [ "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December" ];
const vatCategories: { value: 'A' | 'B' | 'C'; label: string }[] = [
    { value: 'A', label: 'Category A (Odd Months)' },
    { value: 'B', label: 'Category B (Even Months)' },
    { value: 'C', label: 'Category C (Monthly)' },
];

const ruleSchema = z.object({
    id: z.string(),
    description: z.string(),
    keywords: z.string(),
    accountId: z.string(),
    vatType: z.string(),
});

const formSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(2, 'Client/Company name is required.'),
  yearEnd: z.string().optional(),
  isVatRegistered: z.boolean().default(false),
  vatCategory: z.enum(['A', 'B', 'C']).optional().nullable(),
  status: z.enum(clientStatuses).optional(),
  useGlobalRules: z.boolean().default(false),
  initialRules: z.array(ruleSchema).optional(),
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
    const { toast } = useToast();
    const [isLoadingRules, setIsLoadingRules] = useState(false);
    
    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            id: client?.id || '',
            name: client?.name || client?.companyName || '',
            yearEnd: client?.yearEnd || undefined,
            isVatRegistered: client?.isVatRegistered || false,
            vatCategory: client?.vatCategory || undefined,
            status: client?.status || 'Active',
            useGlobalRules: false,
            initialRules: [],
        },
    });

    const { fields, replace, remove } = useFieldArray({
        control: form.control,
        name: "initialRules"
    });

    const isVatRegistered = form.watch('isVatRegistered');
    const useGlobalRules = form.watch('useGlobalRules');

    useEffect(() => {
        if (!client?.id && isAIClient) {
            const fetchGlobalRules = async () => {
                setIsLoadingRules(true);
                try {
                    const rulesRef = collection(db, 'allocationRules');
                    const q = query(rulesRef, orderBy('description'));
                    const snapshot = await getDocs(q);
                    const rules = snapshot.docs.map(doc => {
                        const data = doc.data() as AllocationRule;
                        return {
                            id: doc.id,
                            description: data.description,
                            keywords: data.keywords.join(', '),
                            accountId: data.accountId,
                            vatType: data.vatType,
                        };
                    });
                    replace(rules);
                } catch (e) {
                    console.error("Error fetching global rules:", e);
                    toast({ title: 'Error', description: 'Could not load global rules.', variant: 'destructive'});
                } finally {
                    setIsLoadingRules(false);
                }
            };
            fetchGlobalRules();
        }
    }, [client?.id, isAIClient, replace, toast]);

    const handleSubmit = (values: z.infer<typeof formSchema>) => {
        // Convert initialRules string keywords back to arrays for the main page handler
        const processedRules = values.useGlobalRules ? values.initialRules?.map(r => ({
            ...r,
            keywords: r.keywords.split(',').map(k => k.trim().toUpperCase()).filter(Boolean),
            type: 'hard' as const,
            scope: 'client' as const,
            priority: 99
        })) : [];

        onSubmit({
            ...values,
            allocationRules: processedRules
        });
    };
    
    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6 max-h-[75vh] overflow-y-auto p-1 pr-4">
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
                            <FormField control={form.control} name="vatCategory" render={({ field }) => ( <FormItem><FormLabel>VAT Category</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value || ''}><FormControl><SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger></FormControl><SelectContent>{vatCategories.map(cat => <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                         </div>
                    )}
                </div>

                {isAIClient && !client?.id && (
                    <div className="space-y-4 border-t pt-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="text-lg font-medium">Automation Setup</h3>
                                <p className="text-sm text-muted-foreground">Import default rules to automatically categorize transactions.</p>
                            </div>
                            <FormField
                                control={form.control}
                                name="useGlobalRules"
                                render={({ field }) => (
                                    <FormControl>
                                        <Switch 
                                            checked={field.value} 
                                            onCheckedChange={field.onChange} 
                                        />
                                    </FormControl>
                                )}
                            />
                        </div>

                        {useGlobalRules && (
                            <div className="space-y-4">
                                {isLoadingRules ? (
                                    <div className="flex items-center justify-center py-8">
                                        <Loader2 className="h-6 w-6 animate-spin text-primary mr-2" />
                                        <span className="text-sm text-muted-foreground">Fetching global rules...</span>
                                    </div>
                                ) : fields.length > 0 ? (
                                    <Accordion type="single" collapsible className="w-full border rounded-lg overflow-hidden">
                                        {fields.map((field, index) => (
                                            <AccordionItem key={field.id} value={field.id} className="border-b last:border-0 px-4">
                                                <AccordionTrigger className="hover:no-underline py-3">
                                                    <div className="flex items-center gap-2 text-left">
                                                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                                                        <span className="font-medium text-sm">{form.watch(`initialRules.${index}.description`)}</span>
                                                    </div>
                                                </AccordionTrigger>
                                                <AccordionContent className="space-y-4 pb-4">
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                        <FormField
                                                            control={form.control}
                                                            name={`initialRules.${index}.description`}
                                                            render={({ field }) => (
                                                                <FormItem>
                                                                    <FormLabel className="text-xs">Rule Name</FormLabel>
                                                                    <FormControl><Input {...field} className="h-8 text-xs" /></FormControl>
                                                                </FormItem>
                                                            )}
                                                        />
                                                        <FormField
                                                            control={form.control}
                                                            name={`initialRules.${index}.accountId`}
                                                            render={({ field }) => (
                                                                <FormItem>
                                                                    <FormLabel className="text-xs">Allocate To</FormLabel>
                                                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                                        <FormControl><SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger></FormControl>
                                                                        <SelectContent>
                                                                            {masterChartOfAccounts.map(acc => (
                                                                                <SelectItem key={acc.id} value={acc.id}>{acc.description}</SelectItem>
                                                                            ))}
                                                                        </SelectContent>
                                                                    </Select>
                                                                </FormItem>
                                                            )}
                                                        />
                                                    </div>
                                                    <FormField
                                                        control={form.control}
                                                        name={`initialRules.${index}.keywords`}
                                                        render={({ field }) => (
                                                            <FormItem>
                                                                <FormLabel className="text-xs">Keywords (comma-separated)</FormLabel>
                                                                <FormControl><Input {...field} className="h-8 text-xs" /></FormControl>
                                                            </FormItem>
                                                        )}
                                                    />
                                                    <div className="flex justify-between items-center">
                                                        <FormField
                                                            control={form.control}
                                                            name={`initialRules.${index}.vatType`}
                                                            render={({ field }) => (
                                                                <FormItem className="flex-grow mr-4">
                                                                    <FormLabel className="text-xs">VAT Treatment</FormLabel>
                                                                    <Select onValueChange={field.onChange} defaultValue={field.value} disabled={!isVatRegistered}>
                                                                        <FormControl><SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger></FormControl>
                                                                        <SelectContent>
                                                                            {allVatTypes.map(vt => (
                                                                                <SelectItem key={vt.name} value={vt.name}>{vt.label}</SelectItem>
                                                                            ))}
                                                                        </SelectContent>
                                                                    </Select>
                                                                </FormItem>
                                                            )}
                                                        />
                                                        <Button 
                                                            type="button" 
                                                            variant="ghost" 
                                                            size="sm" 
                                                            className="text-destructive mt-6"
                                                            onClick={() => remove(index)}
                                                        >
                                                            <Trash2 className="h-4 w-4 mr-1" />
                                                            Don't Import
                                                        </Button>
                                                    </div>
                                                </AccordionContent>
                                            </AccordionItem>
                                        ))}
                                    </Accordion>
                                ) : (
                                    <div className="text-center py-6 bg-muted/30 rounded-lg border-2 border-dashed">
                                        <AlertCircle className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                                        <p className="text-sm text-muted-foreground">No global rules found to import.</p>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}
                
                <div className="flex justify-end gap-2 pt-4">
                    <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>
                    <Button type="submit">Save Changes</Button>
                </div>
            </form>
        </Form>
    )
}
