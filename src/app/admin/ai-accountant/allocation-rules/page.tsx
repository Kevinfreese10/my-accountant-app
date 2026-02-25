'use client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { chartOfAccounts as masterChartOfAccounts } from "@/lib/chart-of-accounts";
import { Input } from "@/components/ui/input";
import { useState, useMemo, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { ArrowLeft, PlusCircle, Edit, Trash2, Loader2, ChevronsUpDown, CheckCheck, Search, Sparkles, Beaker, AlertTriangle, ArrowRight, User as UserIcon } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { getFirestore, collection, getDocs, query, orderBy, doc, setDoc, addDoc, deleteDoc, updateDoc, getDoc, arrayUnion } from "firebase/firestore";
import { firebaseApp } from "@/lib/firebase";
import { AllocationRule, ChartOfAccount, User } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
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
import { optimizeAllocationRule } from "@/ai/flows/optimize-allocation-rule";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const db = getFirestore(firebaseApp);

const ruleFormSchema = z.object({
  id: z.string().optional(),
  description: z.string().min(3, "Description is required"),
  keywords: z.string().min(2, "At least one keyword is required"),
  accountId: z.string().min(1, "Please select an account to allocate to."),
  vatType: z.string().default('no_vat'),
  isPriority: z.boolean().default(false),
  scope: z.enum(['global', 'client']).default('global'),
});

function RuleForm({ rule, onSave, onCancel, chartOfAccounts }: {
    rule: Partial<AllocationRule> | null;
    onSave: (values: z.infer<typeof ruleFormSchema>) => void;
    onCancel: () => void;
    chartOfAccounts: ChartOfAccount[];
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
            scope: rule?.scope || 'global',
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
                                    "w-full justify-between h-10",
                                    !field.value && "text-muted-foreground"
                                )}
                                >
                                {field.value
                                    ? chartOfAccounts.find(
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
                                        {chartOfAccounts.map((acc) => (
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
                
                <div className="grid grid-cols-2 gap-4">
                    <FormField control={form.control} name="vatType" render={({ field }) => ( <FormItem><FormLabel>VAT Treatment</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select VAT type" /></SelectTrigger></FormControl><SelectContent>{allVatTypes.map(vt => ( <SelectItem key={vt.name} value={vt.name}>{vt.label}</SelectItem>))}</SelectContent></Select><FormMessage /></FormItem>)}/>
                    <FormField
                        control={form.control}
                        name="isPriority"
                        render={({ field }) => (
                            <FormItem className="flex flex-row items-center space-x-3 space-y-0 rounded-md border p-3 mt-8">
                            <FormControl>
                                <Checkbox
                                    checked={field.value}
                                    onCheckedChange={field.onChange}
                                />
                            </FormControl>
                            <div className="space-y-1 leading-none">
                                <FormLabel className="text-xs">Priority</FormLabel>
                            </div>
                            </FormItem>
                        )}
                    />
                </div>

                <DialogFooter>
                    <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>
                    <Button type="submit">Save Allocation Rule</Button>
                </DialogFooter>
            </form>
        </Form>
    )
}

export default function AllocationRulesPage() {
    const [globalRules, setGlobalRules] = useState<AllocationRule[]>([]);
    const [clients, setClients] = useState<User[]>([]);
    const [selectedClient, setSelectedClient] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('global');
    const { toast } = useToast();
    
    const [isRuleFormOpen, setIsRuleFormOpen] = useState(false);
    const [editingRule, setEditingRule] = useState<Partial<AllocationRule> | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [testDescription, setTestDescription] = useState('');
    const [optimizingRuleId, setOptimizingRuleId] = useState<string | null>(null);
    const [isOptimizingAll, setIsOptimizingAll] = useState(false);

    const fetchInitialData = async () => {
        setIsLoading(true);
        try {
            // 1. Fetch Global Rules
            const rulesQuery = query(collection(db, "allocationRules"), orderBy("description"));
            const rulesSnapshot = await getDocs(rulesQuery);
            setGlobalRules(rulesSnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as AllocationRule)));

            // 2. Fetch Clients
            const clientsSnapshot = await getDocs(query(collection(db, "aiAccountantClients"), orderBy("name")));
            setClients(clientsSnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as User)));

        } catch (e) {
            toast({ title: 'Error', description: 'Failed to fetch rules or clients.', variant: 'destructive' });
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchInitialData();
    }, []);

    const handleSelectClient = async (clientId: string) => {
        if (clientId === 'none') {
            setSelectedClient(null);
            return;
        }
        const client = clients.find(c => c.id === clientId);
        if (client) setSelectedClient(client);
    };

    const currentRules = useMemo(() => {
        if (activeTab === 'global') return globalRules;
        return selectedClient?.allocationRules || [];
    }, [activeTab, globalRules, selectedClient]);

    const filteredRules = useMemo(() => {
        if (!searchTerm.trim()) return currentRules;
        return currentRules.filter(rule =>
            rule.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
            rule.keywords.some(kw => kw.toLowerCase().includes(searchTerm.toLowerCase()))
        );
    }, [currentRules, searchTerm]);

    const testResults = useMemo(() => {
        if (!testDescription.trim()) return [];
        const desc = testDescription.toUpperCase();
        
        const allTestableRules = [...globalRules, ...(selectedClient?.allocationRules || [])];
        
        return allTestableRules.filter(rule => 
            rule.keywords.some(kw => desc.includes(kw.toUpperCase()))
        ).map(rule => {
            const matchedKeyword = rule.keywords.find(kw => desc.includes(kw.toUpperCase()));
            return {
                ...rule,
                matchedKeyword
            };
        }).sort((a, b) => (a.priority || 99) - (b.priority || 99));
    }, [globalRules, selectedClient, testDescription]);

    const handleSaveRule = async (values: z.infer<typeof ruleFormSchema>) => {
        const keywordsArray = values.keywords.split(',').map(k => k.trim().toUpperCase()).filter(Boolean);
        const ruleData = {
            description: values.description,
            keywords: keywordsArray,
            accountId: values.accountId,
            vatType: values.vatType as any,
            type: 'hard' as const,
            priority: values.isPriority ? 1 : 99,
            scope: activeTab as 'global' | 'client'
        };

        try {
            if (activeTab === 'global') {
                if (values.id) {
                    await updateDoc(doc(db, 'allocationRules', values.id), ruleData);
                } else {
                    await addDoc(collection(db, 'allocationRules'), ruleData);
                }
                toast({ title: 'Global Rule Saved' });
            } else if (selectedClient) {
                const clientRef = doc(db, 'aiAccountantClients', selectedClient.id);
                let updatedRules = [...(selectedClient.allocationRules || [])];
                
                if (values.id) {
                    updatedRules = updatedRules.map(r => r.id === values.id ? { ...r, ...ruleData, id: r.id } : r);
                } else {
                    updatedRules.push({ ...ruleData, id: `rule_${Date.now()}` });
                }
                
                await updateDoc(clientRef, { allocationRules: updatedRules });
                setSelectedClient({ ...selectedClient, allocationRules: updatedRules });
                toast({ title: 'Client Rule Saved' });
            }
            
            fetchInitialData();
            setIsRuleFormOpen(false);
            setEditingRule(null);
        } catch (error) {
            toast({ title: 'Save Failed', variant: 'destructive'});
        }
    };
    
    const handleDeleteRule = async (ruleId: string) => {
        try {
            if (activeTab === 'global') {
                await deleteDoc(doc(db, "allocationRules", ruleId));
                toast({ title: 'Global Rule Deleted', variant: 'destructive' });
            } else if (selectedClient) {
                const updatedRules = selectedClient.allocationRules?.filter(r => r.id !== ruleId) || [];
                await updateDoc(doc(db, 'aiAccountantClients', selectedClient.id), { allocationRules: updatedRules });
                setSelectedClient({ ...selectedClient, allocationRules: updatedRules });
                toast({ title: 'Client Rule Deleted', variant: 'destructive' });
            }
            fetchInitialData();
        } catch (error) {
            toast({ title: 'Delete Failed', variant: 'destructive'});
        }
    }

    const currentChartOfAccounts = useMemo(() => {
        if (activeTab === 'client' && selectedClient?.chartOfAccounts) {
            return selectedClient.chartOfAccounts;
        }
        return masterChartOfAccounts;
    }, [activeTab, selectedClient]);

    const getAccountDescription = (accountId: string) => {
        const account = currentChartOfAccounts.find(acc => acc.id === accountId);
        return account ? `${account.accountNumber} - ${account.description}` : accountId;
    }

    return (
        <div className="space-y-8">
            <div className="flex items-center justify-between">
                <div>
                     <h1 className="text-3xl font-bold tracking-tight">Allocation Rules</h1>
                     <p className="text-muted-foreground">Manage the automated transaction mapping engine.</p>
                </div>
            </div>

            <Dialog open={isRuleFormOpen} onOpenChange={setIsRuleFormOpen}>
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>{editingRule?.id ? 'Edit' : 'Create'} {activeTab === 'global' ? 'Global Master' : 'Client Specific'} Rule</DialogTitle>
                        <DialogDescription>Rules clean bank descriptions and map them to ledger accounts.</DialogDescription>
                    </DialogHeader>
                    <RuleForm 
                        rule={editingRule} 
                        onSave={handleSaveRule}
                        onCancel={() => setIsRuleFormOpen(false)}
                        chartOfAccounts={currentChartOfAccounts}
                    />
                </DialogContent>
            </Dialog>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                <div className="lg:col-span-8 space-y-6">
                    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                        <TabsList className="grid w-full grid-cols-2">
                            <TabsTrigger value="global">Master Rules (Global)</TabsTrigger>
                            <TabsTrigger value="client">Practice Rules (Client Specific)</TabsTrigger>
                        </TabsList>
                        
                        <TabsContent value="client" className="pt-4">
                            <div className="mb-6 flex gap-4 items-end bg-muted/20 p-4 rounded-lg border border-dashed">
                                <div className="flex-grow space-y-2">
                                    <Label className="text-xs font-bold uppercase text-muted-foreground">Select Client to Manage</Label>
                                    <Select value={selectedClient?.id || 'none'} onValueChange={handleSelectClient}>
                                        <SelectTrigger className="bg-white">
                                            <SelectValue placeholder="Pick a client..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="none">No client selected</SelectItem>
                                            {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.companyName || c.name}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                                {selectedClient && (
                                    <Button onClick={() => setIsRuleFormOpen(true)} className="gap-2">
                                        <PlusCircle className="h-4 w-4" /> Create Client Rule
                                    </Button>
                                )}
                            </div>
                        </TabsContent>

                        <div className="flex justify-between items-center my-4">
                            <div className="relative flex-grow max-w-sm">
                                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Search keywords..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="pl-8"
                                />
                            </div>
                            {activeTab === 'global' && (
                                <Button size="sm" onClick={() => setIsRuleFormOpen(true)} className="gap-2">
                                    <PlusCircle className="h-4 w-4" /> Create Global Rule
                                </Button>
                            )}
                        </div>

                        <Card>
                            <CardContent className="p-0">
                                {isLoading ? (
                                    <div className="py-12 text-center"><Loader2 className="animate-spin mx-auto h-8 w-8 text-primary"/></div>
                                ) : activeTab === 'client' && !selectedClient ? (
                                    <div className="py-20 text-center text-muted-foreground">
                                        <UserIcon className="h-12 w-12 mx-auto mb-4 opacity-20" />
                                        <p>Select a client above to view their specific allocation rules.</p>
                                    </div>
                                ) : (
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Rule Name</TableHead>
                                                <TableHead>Keywords</TableHead>
                                                <TableHead>Allocation</TableHead>
                                                <TableHead className="text-right">Actions</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {filteredRules.length === 0 ? (
                                                <TableRow><TableCell colSpan={4} className="text-center py-10 text-muted-foreground">No rules found.</TableCell></TableRow>
                                            ) : filteredRules.map((rule) => (
                                                <TableRow key={rule.id}>
                                                    <TableCell className="font-medium">{rule.description}</TableCell>
                                                    <TableCell>
                                                        <div className="flex flex-wrap gap-1 max-w-xs">
                                                            {rule.keywords.map((kw, index) => <Badge key={index} variant="secondary" className="text-[10px] uppercase">{kw}</Badge>)}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        <p className="text-xs font-semibold">{getAccountDescription(rule.accountId)}</p>
                                                        <p className="text-[9px] text-muted-foreground uppercase">{rule.vatType}</p>
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        <div className="flex items-center justify-end gap-1">
                                                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditingRule(rule); setIsRuleFormOpen(true); }}><Edit className="h-4 w-4" /></Button>
                                                            <AlertDialog>
                                                                <AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="h-7 w-7 text-destructive"><Trash2 className="h-4 w-4" /></Button></AlertDialogTrigger>
                                                                <AlertDialogContent>
                                                                    <AlertDialogHeader><AlertDialogTitle>Delete Rule?</AlertDialogTitle><AlertDialogDescription>This will permanently remove the rule: "{rule.description}".</AlertDialogDescription></AlertDialogHeader>
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
                    </Tabs>
                </div>

                <div className="lg:col-span-4 space-y-6">
                    <Card className="border-primary/20 shadow-md sticky top-24">
                        <CardHeader className="bg-primary/5 pb-4">
                            <div className="flex items-center gap-2">
                                <Beaker className="h-5 w-5 text-primary" />
                                <CardTitle className="text-lg">Rule Simulator</CardTitle>
                            </div>
                            <CardDescription className="text-xs">Test bank strings against current rules.</CardDescription>
                        </CardHeader>
                        <CardContent className="pt-6 space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="test-desc" className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest">Transaction Description</Label>
                                <Textarea 
                                    id="test-desc"
                                    placeholder="e.g. POS PURCHASE CHECKERS SEAPOINT"
                                    value={testDescription}
                                    onChange={(e) => setTestDescription(e.target.value)}
                                    rows={3}
                                    className="resize-none text-sm font-medium bg-white"
                                />
                            </div>

                            {testDescription.trim() && (
                                <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                                    <Separator />
                                    <div className="flex items-center justify-between">
                                        <h4 className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest">Matches Found ({testResults.length})</h4>
                                    </div>

                                    {testResults.length > 0 ? (
                                        <div className="space-y-3">
                                            {testResults.map((result, idx) => (
                                                <div key={result.id} className={cn(
                                                    "p-3 rounded-lg border text-sm space-y-2 transition-all",
                                                    idx === 0 ? "bg-primary/5 border-primary/20 shadow-sm" : "bg-muted/30 opacity-70"
                                                )}>
                                                    <div className="flex justify-between items-start">
                                                        <span className="font-bold text-primary truncate pr-2">{result.description}</span>
                                                        <Badge className={cn("text-[9px] h-4", result.scope === 'global' ? 'bg-slate-500' : 'bg-indigo-600')}>
                                                            {result.scope === 'global' ? 'Master' : 'Client'} Rule
                                                        </Badge>
                                                    </div>
                                                    <div className="grid grid-cols-2 gap-2 text-[11px]">
                                                        <div>
                                                            <p className="text-muted-foreground font-bold uppercase text-[9px]">Account</p>
                                                            <p className="font-semibold truncate">{getAccountDescription(result.accountId)}</p>
                                                        </div>
                                                        <div>
                                                            <p className="text-muted-foreground font-bold uppercase text-[9px]">Matched On</p>
                                                            <Badge variant="outline" className="text-[10px] py-0 h-5 border-primary/30 text-primary font-bold">{result.matchedKeyword}</Badge>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="text-center py-8 rounded-lg border-2 border-dashed bg-muted/20">
                                            <Search className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                                            <p className="text-xs text-muted-foreground font-medium">No matches.</p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
