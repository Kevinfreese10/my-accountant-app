'use client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { chartOfAccounts as masterChartOfAccounts, setMasterChartOfAccounts } from "@/lib/chart-of-accounts";
import { Input } from "@/components/ui/input";
import { useState, useMemo, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { ArrowLeft, PlusCircle, Edit, Trash2, Loader2, ChevronsUpDown, CheckCheck, Search, Sparkles } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { getFirestore, collection, getDocs, query, orderBy, doc, setDoc, addDoc, deleteDoc, updateDoc } from "firebase/firestore";
import { firebaseApp } from "@/lib/firebase";
import { AllocationRule, ChartOfAccount } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { allVatTypes } from "@/lib/vat-types";
import { Separator } from "@/components/ui/separator";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList, CommandGroup } from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { optimizeAllocationRule } from "@/ai/dev";


const db = getFirestore(firebaseApp);

const ruleFormSchema = z.object({
  id: z.string().optional(),
  description: z.string().min(3, "Description is required"),
  keywords: z.string().min(3, "At least one keyword is required"),
  accountId: z.string().min(1, "Please select an account to allocate to."),
  vatType: z.enum(allVatTypes.map(v => v.name) as [string, ...string[]]),
  isPriority: z.boolean().default(false),
});


function RuleForm({ rule, onSave, onCancel }: {
    rule: Partial<AllocationRule> | null;
    onSave: (values: z.infer<typeof ruleFormSchema>) => void;
    onCancel: () => void;
}) {
    const form = useForm<z.infer<typeof ruleFormSchema>>({
        resolver: zodResolver(ruleFormSchema),
        defaultValues: {
            id: rule?.id || '',
            description: rule?.description || '',
            keywords: rule?.keywords?.join(', ') || '',
            accountId: rule?.accountId || '',
            vatType: rule?.vatType || 'no_vat',
            isPriority: rule?.priority === 1,
        }
    });
    
    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSave)} className="space-y-4">
                <FormField control={form.control} name="description" render={({ field }) => ( <FormItem><FormLabel>Rule Description</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )}/>
                <FormField control={form.control} name="keywords" render={({ field }) => ( <FormItem><FormLabel>Keywords (comma-separated)</FormLabel><FormControl><Textarea {...field} rows={3} /></FormControl><FormMessage /></FormItem> )}/>
                 <FormField
                    control={form.control}
                    name="accountId"
                    render={({ field }) => (
                        <FormItem className="flex flex-col">
                        <FormLabel>Allocate To Account</FormLabel>
                        <Popover>
                            <PopoverTrigger asChild>
                            <FormControl>
                                <Button
                                variant="outline"
                                role="combobox"
                                className={cn(
                                    "w-full justify-between",
                                    !field.value && "text-muted-foreground"
                                )}
                                >
                                {field.value
                                    ? masterChartOfAccounts.find(
                                        (acc) => acc.id === field.value
                                    )?.description
                                    : "Select an account"}
                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                </Button>
                            </FormControl>
                            </PopoverTrigger>
                            <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                                <Command>
                                    <CommandInput placeholder="Search account..." />
                                    <CommandList>
                                    <CommandEmpty>No account found.</CommandEmpty>
                                    <CommandGroup>
                                        {masterChartOfAccounts.map((acc) => (
                                            <CommandItem
                                                value={acc.description}
                                                key={acc.id}
                                                onSelect={() => {
                                                    form.setValue("accountId", acc.id)
                                                }}
                                            >
                                                <CheckCheck className={cn("mr-2 h-4 w-4", acc.id === field.value ? "opacity-100" : "opacity-0")}/>
                                                {acc.description}
                                            </CommandItem>
                                        ))}
                                    </CommandGroup>
                                    </CommandList>
                                </Command>
                            </PopoverContent>
                        </Popover>
                        <FormMessage />
                        </FormItem>
                    )}
                    />
                <FormField control={form.control} name="vatType" render={({ field }) => ( <FormItem><FormLabel>VAT Type</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select VAT type" /></SelectTrigger></FormControl><SelectContent>{allVatTypes.map(vt => ( <SelectItem key={vt.name} value={vt.name}>{vt.label}</SelectItem>))}</SelectContent></Select><FormMessage /></FormItem>)}/>
                <FormField
                    control={form.control}
                    name="isPriority"
                    render={({ field }) => (
                        <FormItem className="flex flex-row items-center space-x-3 space-y-0 rounded-md border p-4">
                        <FormControl>
                            <Checkbox
                                checked={field.value}
                                onCheckedChange={field.onChange}
                            />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                            <FormLabel>
                            Priority Rule
                            </FormLabel>
                            <FormDescription>
                                Priority rules are processed first, before any other rules.
                            </FormDescription>
                        </div>
                        </FormItem>
                    )}
                />
                <DialogFooter>
                    <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>
                    <Button type="submit">Save Rule</Button>
                </DialogFooter>
            </form>
        </Form>
    )
}

export default function AllocationRulesPage() {
    const [globalRules, setGlobalRules] = useState<AllocationRule[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const { toast } = useToast();
    const [isRuleFormOpen, setIsRuleFormOpen] = useState(false);
    const [editingRule, setEditingRule] = useState<Partial<AllocationRule> | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [optimizingRuleId, setOptimizingRuleId] = useState<string | null>(null);

    const fetchGlobalRules = async () => {
        setIsLoading(true);
        try {
            const rulesQuery = query(collection(db, "allocationRules"), orderBy("description"));
            const rulesSnapshot = await getDocs(rulesQuery);
            const fetchedRules = rulesSnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as AllocationRule));
            setGlobalRules(fetchedRules);
        } catch (e) {
            toast({ title: 'Error', description: 'Failed to fetch global allocation rules.', variant: 'destructive' });
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchGlobalRules();
    }, []);

    const filteredRules = useMemo(() => {
        if (!searchTerm.trim()) {
            return globalRules;
        }
        return globalRules.filter(rule =>
            rule.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
            rule.keywords.some(kw => kw.toLowerCase().includes(searchTerm.toLowerCase()))
        );
    }, [globalRules, searchTerm]);

    const conflictingRuleGroups = useMemo(() => {
        const keywordToRules = new Map<string, AllocationRule[]>();

        globalRules.forEach(rule => {
            rule.keywords.forEach(kw => {
                const keyword = kw.toLowerCase();
                if (!keywordToRules.has(keyword)) {
                    keywordToRules.set(keyword, []);
                }
                keywordToRules.get(keyword)!.push(rule);
            });
        });

        const conflicts: { keyword: string; rules: AllocationRule[] }[] = [];
        keywordToRules.forEach((rules, keyword) => {
            if (rules.length > 1) {
                const uniqueAccounts = new Set(rules.map(r => r.accountId));
                if (uniqueAccounts.size > 1) {
                    conflicts.push({ keyword, rules });
                }
            }
        });

        return conflicts;
    }, [globalRules]);
    
    const getAccountDescription = (accountId: string) => {
        const account = masterChartOfAccounts.find(acc => acc.id === accountId);
        return account ? `${account.accountNumber} - ${account.description}` : accountId;
    }

    const handleOpenRuleForm = (rule: Partial<AllocationRule> | null) => {
        setEditingRule(rule);
        setIsRuleFormOpen(true);
    };

    const handleSaveRule = async (values: z.infer<typeof ruleFormSchema>) => {
        const ruleData = {
            description: values.description,
            keywords: values.keywords.split(',').map(k => k.trim().toUpperCase()),
            accountId: values.accountId,
            vatType: values.vatType,
            type: 'hard' as 'hard',
            priority: values.isPriority ? 1 : 99,
        };

        try {
            if (values.id) {
                const ruleRef = doc(db, 'allocationRules', values.id);
                await updateDoc(ruleRef, ruleData);
                toast({ title: 'Rule Updated' });
            } else {
                await addDoc(collection(db, 'allocationRules'), ruleData);
                toast({ title: 'Rule Created' });
            }
            setIsRuleFormOpen(false);
            setEditingRule(null);
            fetchGlobalRules();
        } catch (error) {
            toast({ title: 'Save Failed', description: 'Could not save the rule.', variant: 'destructive'});
            console.error(error);
        }
    };
    
    const handleDeleteRule = async (ruleId: string) => {
        try {
            await deleteDoc(doc(db, "allocationRules", ruleId));
            toast({ title: 'Rule Deleted', variant: 'destructive' });
            fetchGlobalRules();
        } catch (error) {
            toast({ title: 'Delete Failed', description: 'Could not delete the rule.', variant: 'destructive'});
            console.error(error);
        }
    }

    const handleOptimizeRule = async (rule: AllocationRule) => {
        setOptimizingRuleId(rule.id);
        toast({ title: 'AI Researching Keywords...', description: `Updating rule: ${rule.description}` });
        
        try {
            const result = await optimizeAllocationRule({
                description: rule.description,
                keywords: rule.keywords,
            });

            if (result && result.optimizedKeywords) {
                const ruleRef = doc(db, 'allocationRules', rule.id);
                
                // Replace with AI optimized keywords
                await updateDoc(ruleRef, {
                    keywords: result.optimizedKeywords.map(k => k.toUpperCase()),
                });

                toast({
                    title: 'Rule Optimized by AI',
                    description: result.reasoning || `Keywords have been simplified and normalized.`,
                });
                fetchGlobalRules();
            }
        } catch (e) {
            console.error("AI Rule Optimization Error:", e);
            toast({ title: 'AI Update Failed', description: 'There was an error researching keywords.', variant: 'destructive'});
        } finally {
            setOptimizingRuleId(null);
        }
    };

    return (
        <div className="space-y-8">
            <div className="flex items-center justify-between">
                <div>
                     <h1 className="text-3xl font-bold tracking-tight">Global Allocation Rules</h1>
                     <p className="text-muted-foreground">These are the default rules applied to all new AI Accountant clients for automatic transaction allocation.</p>
                </div>
            </div>

            <Dialog open={isRuleFormOpen} onOpenChange={setIsRuleFormOpen}>
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>{editingRule?.id ? 'Edit' : 'Create'} Global Rule</DialogTitle>
                        <DialogDescription>This rule will be applied as a default to all new clients.</DialogDescription>
                    </DialogHeader>
                    <RuleForm 
                        rule={editingRule} 
                        onSave={handleSaveRule}
                        onCancel={() => setIsRuleFormOpen(false)} 
                    />
                </DialogContent>
            </Dialog>

            {conflictingRuleGroups.length > 0 && (
                <Card className="border-destructive">
                    <CardHeader>
                        <CardTitle>Conflicting Rules Detected</CardTitle>
                        <CardDescription>
                            The following keywords are used in multiple rules that point to different accounts. This can cause unpredictable behavior during automatic allocation. Please resolve these conflicts by editing or deleting the rules.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Accordion type="single" collapsible className="w-full">
                            {conflictingRuleGroups.map(({ keyword, rules }) => (
                                <AccordionItem value={keyword} key={keyword}>
                                    <AccordionTrigger>
                                        <div className="flex items-center gap-2">
                                            <Badge variant="destructive">{keyword}</Badge>
                                            <span className="text-sm font-medium"> is assigned to {rules.length} different accounts.</span>
                                        </div>
                                    </AccordionTrigger>
                                    <AccordionContent>
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead>Rule Description</TableHead>
                                                    <TableHead>Allocated Account</TableHead>
                                                    <TableHead className="text-right">Actions</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {rules.map(rule => (
                                                    <TableRow key={rule.id}>
                                                        <TableCell>{rule.description}</TableCell>
                                                        <TableCell>{getAccountDescription(rule.accountId)}</TableCell>
                                                        <TableCell className="text-right">
                                                            <Button variant="outline" size="sm" onClick={() => handleOpenRuleForm(rule)}>
                                                                <Edit className="h-3 w-3 mr-2"/>
                                                                Edit
                                                            </Button>
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </AccordionContent>
                                </AccordionItem>
                            ))}
                        </Accordion>
                    </CardContent>
                </Card>
            )}

            <Card>
                <CardHeader>
                    <div className="flex justify-between items-center">
                        <Button size="sm" onClick={() => handleOpenRuleForm(null)}>
                            <PlusCircle className="mr-2 h-4 w-4" /> Create New Rule
                        </Button>
                         <div className="relative">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search by keyword..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-8 w-64"
                            />
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="py-8 text-center">
                            <Loader2 className="animate-spin mx-auto h-8 w-8 text-primary"/>
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Description</TableHead>
                                    <TableHead>Keywords</TableHead>
                                    <TableHead>Allocated Account</TableHead>
                                    <TableHead>VAT Type</TableHead>
                                    <TableHead>Priority</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredRules.map((rule) => (
                                    <TableRow key={rule.id}>
                                        <TableCell className="font-medium">{rule.description}</TableCell>
                                        <TableCell>
                                            <div className="flex flex-wrap gap-1 max-w-xs">
                                                {rule.keywords.map((kw, index) => (
                                                    <Badge key={`${kw}-${index}`} variant="secondary">
                                                        {kw}
                                                    </Badge>
                                                ))}
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-xs">{getAccountDescription(rule.accountId)}</TableCell>
                                        <TableCell>{rule.vatType}</TableCell>
                                        <TableCell>
                                            {rule.priority === 1 && <Badge variant="default">Priority</Badge>}
                                        </TableCell>
                                        <TableCell className="text-right">
                                             <div className="flex items-center justify-end gap-1">
                                                <Button 
                                                    variant="ghost" 
                                                    size="icon" 
                                                    className="h-7 w-7 text-primary" 
                                                    onClick={() => handleOptimizeRule(rule)}
                                                    disabled={optimizingRuleId === rule.id}
                                                >
                                                    {optimizingRuleId === rule.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                                                </Button>
                                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleOpenRuleForm(rule)}>
                                                    <Edit className="h-4 w-4" />
                                                </Button>
                                                <AlertDialog>
                                                    <AlertDialogTrigger asChild>
                                                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive">
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </AlertDialogTrigger>
                                                    <AlertDialogContent>
                                                        <AlertDialogHeader><AlertDialogTitle>Are you sure?</AlertDialogTitle><AlertDialogDescription>This action cannot be undone. This will permanently delete the rule: "{rule.description}".</AlertDialogDescription></AlertDialogHeader>
                                                        <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => handleDeleteRule(rule.id)}>Delete</AlertDialogAction></AlertDialogFooter>
                                                    </AlertDialogContent>
                                                </AlertDialog>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
