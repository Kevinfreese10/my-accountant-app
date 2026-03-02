'use client';
import { useState, useEffect, useMemo } from 'react';
import { Service } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Search, Edit3, RotateCcw, Save, Sparkles, CheckCircle2, AlertCircle } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { getFirestore, collection, query, orderBy, getDocs, doc, setDoc, onSnapshot, deleteDoc } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Textarea } from '@/components/ui/textarea';
import { brandService } from '@/ai/flows/brand-service';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';

const db = getFirestore(firebaseApp);

const overrideSchema = z.object({
  title: z.string().min(3, "Title is required"),
  price: z.preprocess(val => Number(val), z.number().min(0, "Price must be positive")),
  description: z.string().min(10, "Short description is required"),
  longDescription: z.string().min(20, "Long description is required"),
  turnaroundTime: z.string().min(1, "Turnaround time is required"),
  metaTitle: z.string().optional(),
  metaDescription: z.string().optional(),
  metaKeywords: z.array(z.string()).optional(),
});

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
        },
    });

    const handleSave = async (values: z.infer<typeof overrideSchema>) => {
        setIsSaving(true);
        try {
            const overrideRef = doc(db, 'users', partnerId, 'serviceOverrides', service.id);
            await setDoc(overrideRef, values);
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
                    <form onSubmit={form.handleSubmit(handleSave)} className="space-y-4 py-4">
                        <FormField control={form.control} name="title" render={({ field }) => ( <FormItem><FormLabel>Display Title</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                        <div className="grid grid-cols-2 gap-4">
                            <FormField control={form.control} name="price" render={({ field }) => ( <FormItem><FormLabel>Public Selling Price (R)</FormLabel><FormControl><Input type="number" step="0.01" {...field} /></FormControl><FormMessage /></FormItem> )} />
                            <FormField control={form.control} name="turnaroundTime" render={({ field }) => ( <FormItem><FormLabel>Turnaround Time</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                        </div>
                        <FormField control={form.control} name="description" render={({ field }) => ( <FormItem><FormLabel>Short Description</FormLabel><FormControl><Textarea {...field} rows={2} /></FormControl><FormMessage /></FormItem> )} />
                        <FormField control={form.control} name="longDescription" render={({ field }) => ( <FormItem><FormLabel>Full Description</FormLabel><FormControl><Textarea {...field} rows={5} /></FormControl><FormMessage /></FormItem> )} />
                        
                        <div className="pt-4 space-y-4">
                            <h4 className="text-sm font-bold uppercase tracking-wider text-primary">SEO Metadata</h4>
                            <FormField control={form.control} name="metaTitle" render={({ field }) => ( <FormItem><FormLabel className="text-xs">Branded Meta Title</FormLabel><FormControl><Input {...field} placeholder="Catchy Title | Practice Name" /></FormControl></FormItem> )} />
                            <FormField control={form.control} name="metaDescription" render={({ field }) => ( <FormItem><FormLabel className="text-xs">Meta Description</FormLabel><FormControl><Textarea {...field} rows={2} /></FormControl></FormItem> )} />
                        </div>

                        <DialogFooter className="flex justify-between items-center pt-4">
                            {override && (
                                <Button type="button" variant="outline" onClick={handleReset} className="text-destructive border-destructive/20 hover:bg-destructive/10">
                                    <RotateCcw className="mr-2 h-4 w-4" /> Reset to Global Default
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
  const [isBulkBranding, setIsBulkBranding] = useState(false);
  const [bulkStatus, setBulkStatus] = useState<Record<string, 'pending' | 'processing' | 'done' | 'error'>>({});
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

  const handleBulkBrand = async () => {
    if (!user?.geminiApiKey || !partnerId) {
        toast({ title: "API Key Required", description: "Please configure your Gemini API Key in your profile settings.", variant: "destructive" });
        return;
    }

    setIsBulkBranding(true);
    const initialStatus: Record<string, any> = {};
    services.forEach(s => initialStatus[s.id] = 'pending');
    setBulkStatus(initialStatus);

    try {
        for (const service of services) {
            setBulkStatus(prev => ({ ...prev, [service.id]: 'processing' }));
            
            try {
                const branded = await brandService({
                    service,
                    partnerName: user.companyName || user.name,
                    apiKey: user.geminiApiKey
                });

                const overrideRef = doc(db, 'users', partnerId, 'serviceOverrides', service.id);
                const currentOverride = overrides[service.id];
                
                await setDoc(overrideRef, {
                    ...branded,
                    // Preserve price and turnaround if they already exist, otherwise use global
                    price: currentOverride?.price ?? service.price,
                    turnaroundTime: currentOverride?.turnaroundTime ?? service.turnaroundTime
                }, { merge: true });

                setBulkStatus(prev => ({ ...prev, [service.id]: 'done' }));
            } catch (err) {
                console.error(`Branding failed for ${service.title}:`, err);
                setBulkStatus(prev => ({ ...prev, [service.id]: 'error' }));
            }
        }
        toast({ title: "Bulk Branding Complete", description: "All services have been updated with your practice branding and SEO metadata." });
    } catch (e) {
        console.error(e);
        toast({ title: "Bulk Process Failed", variant: "destructive" });
    } finally {
        setIsBulkBranding(false);
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

  const bulkProgress = useMemo(() => {
      const total = services.length;
      if (total === 0) return 0;
      const completed = Object.values(bulkStatus).filter(s => s === 'done' || s === 'error').length;
      return (completed / total) * 100;
  }, [bulkStatus, services]);

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <h1 className="text-3xl font-bold tracking-tight">Our Services</h1>
        <div className="flex gap-2 w-full md:w-auto">
            <Button 
                variant="outline" 
                onClick={handleBulkBrand} 
                disabled={isBulkBranding || !user?.geminiApiKey}
                className="font-bold border-primary/20 hover:bg-primary/5 text-primary w-full md:w-auto"
            >
                {isBulkBranding ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Sparkles className="mr-2 h-4 w-4" />}
                Bulk Brand with AI
            </Button>
        </div>
      </div>

      {isBulkBranding && (
          <Card className="border-primary bg-primary/5 animate-in fade-in slide-in-from-top-2">
              <CardContent className="p-4 space-y-3">
                  <div className="flex justify-between items-center text-sm font-bold text-primary">
                      <span>Branding Practice Catalog...</span>
                      <span>{Math.round(bulkProgress)}%</span>
                  </div>
                  <Progress value={bulkProgress} className="h-2" />
                  <p className="text-[10px] text-muted-foreground italic">Iterating through services and applying your practice branding to titles, descriptions, and SEO metadata using your Gemini API key.</p>
              </CardContent>
          </Card>
      )}

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
                <TableHead>Branding</TableHead>
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
                  const brandingStatus = bulkStatus[service.id];

                  return (
                  <TableRow key={service.id}>
                    <TableCell className="font-medium">
                        <div className="flex flex-col">
                            <span className="font-bold">{displayTitle}</span>
                            <span className="text-[10px] text-muted-foreground line-clamp-1">{override?.description || service.description}</span>
                        </div>
                    </TableCell>
                    <TableCell>
                        {brandingStatus === 'processing' ? (
                            <Badge variant="outline" className="animate-pulse h-5 text-[10px]"><Loader2 className="h-2 w-2 mr-1 animate-spin"/> Processing</Badge>
                        ) : brandingStatus === 'done' || override?.metaTitle ? (
                            <Badge variant="success" className="bg-green-100 text-green-800 border-green-200 h-5 text-[10px]">Branded</Badge>
                        ) : brandingStatus === 'error' ? (
                            <Badge variant="destructive" className="h-5 text-[10px]">Error</Badge>
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
