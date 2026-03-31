'use client';
import { useState, useEffect, useMemo } from 'react';
import { Service } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Search, Edit3, RotateCcw, Save, Plus, Trash2, RefreshCw } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { getFirestore, collection, query, orderBy, getDocs, doc, setDoc, onSnapshot, deleteDoc, writeBatch } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

const db = getFirestore(firebaseApp);

function EditServiceDialog({ 
    service, 
    override, 
    partnerId, 
    onSuccess 
}: { 
    service: Service, 
    override: any, 
    partnerId: string,
    onSuccess: () => void 
}) {
    const { toast } = useToast();
    const [isSaving, setIsSaving] = useState(false);
    const [isOpen, setIsOpen] = useState(false);

    const overrideSchema = z.object({
      title: z.string().min(3, "Title is required"),
      price: z.preprocess(val => Number(val), z.number().min(service.price, `Public price cannot be lower than the main store minimum of R${service.price.toFixed(2)}`)),
      description: z.string().min(10, "Short description is required"),
      longDescription: z.string().min(20, "Long description is required"),
      turnaroundTime: z.string().min(1, "Turnaround time is required"),
      metaTitle: z.string().optional(),
      metaDescription: z.string().optional(),
      metaKeywords: z.array(z.string()).optional(),
      whatsIncluded: z.array(z.object({ value: z.string().min(1, "Item cannot be empty") })),
      clientRequirements: z.array(z.object({ value: z.string().min(1, "Prerequisite cannot be empty") })),
    });

    const form = useForm<z.infer<typeof overrideSchema>>({
        resolver: zodResolver(overrideSchema),
        defaultValues: {
            title: override?.title || service.title,
            price: override?.price ?? service.price,
            description: override?.description || service.description,
            longDescription: override?.longDescription || service.longDescription,
            turnaroundTime: override?.turnaroundTime || service.turnaroundTime,
            metaTitle: override?.metaTitle || '',
            metaDescription: override?.metaDescription || '',
            metaKeywords: override?.metaKeywords || [],
            whatsIncluded: (override?.whatsIncluded || service.whatsIncluded || []).map((v: string) => ({ value: v })),
            clientRequirements: (override?.clientRequirements || service.clientRequirements || []).map((v: string) => ({ value: v })),
        },
    });

    const { fields: includedFields, append: appendIncluded, remove: removeIncluded } = useFieldArray({
        control: form.control,
        name: "whatsIncluded"
    });

    const { fields: prereqFields, append: appendPrereq, remove: removePrereq } = useFieldArray({
        control: form.control,
        name: "clientRequirements"
    });

    const handleSave = async (values: z.infer<typeof overrideSchema>) => {
        setIsSaving(true);
        try {
            const finalValues = {
                ...values,
                whatsIncluded: values.whatsIncluded.map(v => v.value),
                clientRequirements: values.clientRequirements.map(v => v.value),
            };
            const overrideRef = doc(db, 'users', partnerId, 'serviceOverrides', service.id);
            await setDoc(overrideRef, finalValues);
            toast({ title: "Service Updated", description: "Changes will reflect on your public landing page." });
            onSuccess();
            setIsOpen(false);
        } catch (e) {
            toast({ title: "Error", description: "Failed to save overrides.", variant: "destructive" });
        } finally {
            setIsSaving(false);
        }
    };

    const handleReset = async () => {
        setIsSaving(true);
        try {
            const overrideRef = doc(db, 'users', partnerId, 'serviceOverrides', service.id);
            await deleteDoc(overrideRef);
            toast({ title: "Reset Successful", description: "Reverted to global default settings." });
            onSuccess();
            setIsOpen(false);
        } catch (e) {
            toast({ title: "Error", description: "Failed to reset.", variant: "destructive" });
        } finally {
            setIsSaving(false);
        }
    }

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 gap-2 font-bold">
                    <Edit3 className="h-4 w-4" /> Edit Details
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-2xl">
                <DialogHeader>
                    <DialogTitle>Edit Service Details</DialogTitle>
                    <DialogDescription>
                        Customize how this service appears on your public practice landing page. 
                        Cost to you: <strong>{new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' }).format(service.resellerPrice || service.price)}</strong>
                    </DialogDescription>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(handleSave)} className="space-y-4 py-4 max-h-[70vh] overflow-y-auto p-1 pr-4">
                        <FormField control={form.control} name="title" render={({ field }) => ( <FormItem><FormLabel>Display Title</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                        <div className="grid grid-cols-2 gap-4">
                            <FormField control={form.control} name="price" render={({ field }) => ( <FormItem><FormLabel>Public Selling Price (R)</FormLabel><FormControl><Input type="number" step="0.01" {...field} /></FormControl><FormMessage /></FormItem> )} />
                            <FormField control={form.control} name="turnaroundTime" render={({ field }) => ( <FormItem><FormLabel>Turnaround Time</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                        </div>
                        <FormField control={form.control} name="description" render={({ field }) => ( <FormItem><FormLabel>Short Description</FormLabel><FormControl><Textarea {...field} rows={2} /></FormControl><FormMessage /></FormItem> )} />
                        <FormField control={form.control} name="longDescription" render={({ field }) => ( <FormItem><FormLabel>Full Description</FormLabel><FormControl><Textarea {...field} rows={5} /></FormControl><FormMessage /></FormItem> )} />
                        
                        <Separator />
                        
                        {/* Whats Included */}
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <h4 className="text-sm font-bold uppercase tracking-wider text-primary">What's Included</h4>
                                <Button type="button" variant="outline" size="sm" onClick={() => appendIncluded({ value: '' })}>
                                    <Plus className="h-3 w-3 mr-1" /> Add Item
                                </Button>
                            </div>
                            <div className="space-y-2">
                                {includedFields.map((field, index) => (
                                    <FormField
                                        key={field.id}
                                        control={form.control}
                                        name={`whatsIncluded.${index}.value`}
                                        render={({ field }) => (
                                            <FormItem className="flex items-center gap-2">
                                                <FormControl><Input {...field} className="h-8 text-xs" /></FormControl>
                                                <Button type="button" variant="ghost" size="icon" onClick={() => removeIncluded(index)} className="h-8 w-8 text-destructive"><Trash2 className="h-4 w-4"/></Button>
                                            </FormItem>
                                        )}
                                    />
                                ))}
                            </div>
                        </div>

                        <Separator />

                        {/* Prerequisites */}
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <h4 className="text-sm font-bold uppercase tracking-wider text-primary">Prerequisites</h4>
                                <Button type="button" variant="outline" size="sm" onClick={() => appendPrereq({ value: '' })}>
                                    <Plus className="h-3 w-3 mr-1" /> Add Prerequisite
                                </Button>
                            </div>
                            <div className="space-y-2">
                                {prereqFields.map((field, index) => (
                                    <FormField
                                        key={field.id}
                                        control={form.control}
                                        name={`clientRequirements.${index}.value`}
                                        render={({ field }) => (
                                            <FormItem className="flex items-center gap-2">
                                                <FormControl><Input {...field} className="h-8 text-xs" /></FormControl>
                                                <Button type="button" variant="ghost" size="icon" onClick={() => removePrereq(index)} className="h-8 w-8 text-destructive"><Trash2 className="h-4 w-4"/></Button>
                                            </FormItem>
                                        )}
                                    />
                                ))}
                            </div>
                        </div>

                        <Separator />

                        <div className="pt-4 space-y-4">
                            <h4 className="text-sm font-bold uppercase tracking-wider text-primary">SEO Metadata</h4>
                            <FormField control={form.control} name="metaTitle" render={({ field }) => ( <FormItem><FormLabel className="text-xs">Branded Meta Title</FormLabel><FormControl><Input {...field} placeholder="Catchy Title | Practice Name" /></FormControl></FormItem> )} />
                            <FormField control={form.control} name="metaDescription" render={({ field }) => ( <FormItem><FormLabel className="text-xs">Meta Description</FormLabel><FormControl><Textarea {...field} rows={2} /></FormControl></FormItem> )} />
                        </div>

                        <DialogFooter className="flex justify-between items-center pt-4 sticky bottom-0 bg-background pb-2 border-t mt-4">
                            {override && (
                                <Button type="button" variant="outline" onClick={handleReset} className="text-destructive border-destructive/20 hover:bg-destructive/10">
                                    <RotateCcw className="mr-2 h-4 w-4" /> Reset to Default
                                </Button>
                            )}
                            <Button type="submit" disabled={isSaving}>
                                {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                                Save Customizations
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}

export default function PartnerServicesPage() {
  const { user } = useAuth();
  const [services, setServices] = useState<Service[]>([]);
  const [overrides, setOverrides] = useState<Record<string, any>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isApplyingBranding, setIsApplyingBranding] = useState(false);
  const { toast } = useToast();

  const partnerId = user?.role === 'partner' ? user.uid : user?.partnerId;

  const fetchServices = async () => {
    setIsLoading(true);
    try {
        const q = query(collection(db, "services"), orderBy("title"));
        const querySnapshot = await getDocs(q);
        const fetchedServices = querySnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Service));
        setServices(fetchedServices);
    } catch (error) {
        console.error("Error fetching services:", error);
        toast({ title: "Error", description: "Could not load products.", variant: "destructive" });
    } finally {
        setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchServices();
  }, [toast]);

  useEffect(() => {
    if (!partnerId) return;
    const overridesRef = collection(db, 'users', partnerId, 'serviceOverrides');
    const unsubscribe = onSnapshot(overridesRef, (snap) => {
        const data: Record<string, any> = {};
        snap.docs.forEach(doc => data[doc.id] = doc.data());
        setOverrides(data);
    });
    return () => unsubscribe();
  }, [partnerId]);

  const handleBulkSearchReplace = async () => {
    if (!partnerId || !user) return;
    const practiceName = user.companyName || user.name;
    
    setIsApplyingBranding(true);
    toast({ title: 'Applying Branding...', description: `Replacing "My Accountant" with "${practiceName}" across all services and SEO metadata.` });

    try {
        const batch = writeBatch(db);
        let count = 0;

        services.forEach(service => {
            const currentOverride = overrides[service.id] || {};
            
            // Text sources
            const title = currentOverride.title || service.title;
            const desc = currentOverride.description || service.description;
            const longDesc = currentOverride.longDescription || service.longDescription;
            const metaTitle = currentOverride.metaTitle || service.metaTitle || `${title} | My Accountant`;
            const metaDesc = currentOverride.metaDescription || service.metaDescription || desc;

            // Simple case-insensitive search and replace
            const regex = /My Accountant/gi;
            const newTitle = title.replace(regex, practiceName);
            const newDesc = desc.replace(regex, practiceName);
            const newLongDesc = longDesc.replace(regex, practiceName);
            const newMetaTitle = metaTitle.replace(regex, practiceName);
            const newMetaDesc = metaDesc.replace(regex, practiceName);

            // Only update if something changed
            if (newTitle !== title || newDesc !== desc || newLongDesc !== longDesc || newMetaTitle !== metaTitle || newMetaDesc !== metaDesc) {
                const overrideRef = doc(db, 'users', partnerId, 'serviceOverrides', service.id);
                batch.set(overrideRef, {
                    ...currentOverride,
                    title: newTitle,
                    description: newDesc,
                    longDescription: newLongDesc,
                    metaTitle: newMetaTitle,
                    metaDescription: newMetaDesc,
                    // Ensure mandatory fields are present if it's a new override
                    price: currentOverride.price ?? service.price,
                    turnaroundTime: currentOverride.turnaroundTime ?? service.turnaroundTime,
                    whatsIncluded: currentOverride.whatsIncluded || service.whatsIncluded || [],
                    clientRequirements: currentOverride.clientRequirements || service.clientRequirements || [],
                }, { merge: true });
                count++;
            }
        });

        if (count > 0) {
            await batch.commit();
            toast({ title: 'Branding Applied', description: `Successfully updated ${count} services including SEO metadata.` });
        } else {
            toast({ title: 'No Changes Needed', description: 'All services and metadata are already branded.' });
        }
    } catch (e) {
        console.error(e);
        toast({ title: 'Branding Failed', description: 'Could not apply bulk branding. Please try again.', variant: 'destructive' });
    } finally {
        setIsApplyingBranding(false);
    }
  };

  const filteredServices = useMemo(() => {
    if (!searchTerm) return services;
    return services.filter(service =>
      service.title.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [services, searchTerm]);

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-ZA', {
      style: 'currency',
      currency: 'ZAR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(price);
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <h1 className="text-3xl font-bold tracking-tight">Our Services</h1>
        <div className="flex gap-2 w-full md:w-auto">
            <Button 
                variant="outline" 
                onClick={handleBulkSearchReplace} 
                disabled={isApplyingBranding}
                className="font-bold border-primary/20 hover:bg-primary/5 text-primary w-full md:w-auto shadow-sm"
            >
                {isApplyingBranding ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <RefreshCw className="mr-2 h-4 w-4" />}
                Apply Practice Branding
            </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <CardTitle>Service & Price List</CardTitle>
              <CardDescription>View global products and customize branding/pricing for your public landing page.</CardDescription>
            </div>
            <div className="relative w-full sm:max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search for a service..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
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
                <TableHead>Title</TableHead>
                <TableHead>Branding Status</TableHead>
                <TableHead>Cost to You</TableHead>
                <TableHead>Public Price</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredServices.length > 0 ? (
                filteredServices.map(service => {
                  const override = overrides[service.id];
                  const displayPrice = override?.price ?? service.price;
                  const displayTitle = override?.title ?? service.title;
                  const isBranded = !!override?.title && (override.title !== service.title || override.description !== service.description);

                  return (
                  <TableRow key={service.id}>
                    <TableCell className="font-medium">
                        <div className="flex flex-col">
                            <span className="font-bold text-slate-900">{displayTitle}</span>
                            <span className="text-[10px] text-muted-foreground line-clamp-1">{override?.description || service.description}</span>
                        </div>
                    </TableCell>
                    <TableCell>
                        {isBranded ? (
                            <Badge variant="success" className="bg-green-100 text-green-800 border-green-200 h-5 text-[10px]">Branded</Badge>
                        ) : (
                            <Badge variant="secondary" className="opacity-50 h-5 text-[10px]">Default</Badge>
                        )}
                    </TableCell>
                    <TableCell className="opacity-70 text-xs">{formatPrice(service.resellerPrice || service.price)}</TableCell>
                    <TableCell>
                        <div className="flex items-center gap-2">
                            <span className="font-bold text-primary">{formatPrice(displayPrice)}</span>
                            {override?.price !== undefined && override?.price !== service.price && <Badge variant="outline" className="text-[9px] h-4">Markup</Badge>}
                        </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        {partnerId && (
                            <EditServiceDialog 
                                service={service} 
                                override={override} 
                                partnerId={partnerId} 
                                onSuccess={() => {}} 
                            />
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                )})
              ) : (
                 <TableRow>
                    <TableCell colSpan={5} className="text-center h-24 text-muted-foreground">
                        No services found.
                    </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
