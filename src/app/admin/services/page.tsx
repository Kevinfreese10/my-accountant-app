'use client';
import { useState, useEffect, useMemo } from 'react';
import { Service } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { MoreHorizontal, PlusCircle, Loader2, Copy, Info, AlertTriangle, Download, RefreshCw, Calculator, ArrowUp, ArrowUpDown, CheckCircle2, XCircle } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import ServiceForm from '@/components/admin/ServiceForm';
import { useToast } from '@/hooks/use-toast';
import ServicePreview from '@/components/admin/ServicePreview';
import { getFirestore, collection, getDocs, doc, setDoc, deleteDoc, addDoc, serverTimestamp, query, orderBy, writeBatch } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import Image from 'next/image';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import Papa from 'papaparse';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

const db = getFirestore(firebaseApp);

const serviceCategories = [
    "SARS Services",
    "Entity Registrations",
    "CIPC Services",
    "COIDA Services",
    "NCR Registrations",
    "Accounting Services",
    "CIDB Services",
];

const departments = ['Accounting and Tax', 'Administration', 'CAP'] as const;

function BulkPriceAdjustmentDialog({ 
    servicesCount, 
    onUpdate, 
    isLoading 
}: { 
    servicesCount: number, 
    onUpdate: (amount: number) => Promise<void>, 
    isLoading: boolean 
}) {
    const [amount, setAmount] = useState<string>('');
    const [isOpen, setIsOpen] = useState(false);

    const handleApply = async () => {
        const num = parseFloat(amount);
        if (isNaN(num) || num === 0) return;
        await onUpdate(num);
        setIsOpen(false);
        setAmount('');
    };

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" className="gap-2">
                    <Calculator className="h-4 w-4" />
                    Bulk Price Adj.
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Bulk Price Adjustment</DialogTitle>
                    <DialogDescription>
                        Update the price of <strong>{servicesCount}</strong> products by a fixed amount. 
                        Partner reseller prices will be auto-recalculated based on current settings.
                    </DialogDescription>
                </DialogHeader>
                <div className="py-4 space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="adj-amount">Adjustment Amount (ZAR)</Label>
                        <Input 
                            id="adj-amount"
                            type="number"
                            placeholder="e.g. 200 or -50"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                        />
                        <p className="text-[10px] text-muted-foreground italic">
                            Enter a positive number to increase prices, or a negative number to decrease.
                        </p>
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="ghost" onClick={() => setIsOpen(false)}>Cancel</Button>
                    <Button onClick={handleApply} disabled={isLoading || !amount}>
                        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Apply to {servicesCount} Products
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

export default function AdminServicesPage() {
  const [services, setServices] = useState<Service[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [viewingService, setViewingService] = useState<Service | null>(null);
  const { toast } = useToast();
  const [isUpdatingDefaults, setIsUpdatingDefaults] = useState(false);

  const [titleFilter, setTitleFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  
  const [sortField, setSortField] = useState<'title' | 'price'>('title');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const fetchServices = async () => {
    setIsLoading(true);
    try {
        const q = query(collection(db, "services"), orderBy("title"));
        const querySnapshot = await getDocs(q);
        const fetchedServices = querySnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Service));
        setServices(fetchedServices);
    } catch (error) {
        console.error("Error fetching services:", error);
        toast({ title: 'Error', description: 'Could not fetch services from the database.', variant: 'destructive'});
    } finally {
        setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchServices();
  }, []);

  const filteredServices = useMemo(() => {
    let result = services.filter(service => {
        const titleMatch = service.title.toLowerCase().includes(titleFilter.toLowerCase());
        const categoryMatch = categoryFilter === 'all' || service.category === categoryFilter;
        const departmentMatch = departmentFilter === 'all' || service.department === departmentFilter;
        return titleMatch && categoryMatch && departmentMatch;
    });

    result.sort((a, b) => {
        if (sortField === 'price') {
            return sortOrder === 'asc' ? a.price - b.price : b.price - a.price;
        } else {
            return sortOrder === 'asc' 
                ? a.title.localeCompare(b.title) 
                : b.title.localeCompare(a.title);
        }
    });

    return result;
  }, [services, titleFilter, categoryFilter, departmentFilter, sortField, sortOrder]);


  const handleAddService = () => {
    setSelectedService(null);
    setIsFormOpen(true);
  };

  const handleEditService = (service: Service) => {
    setSelectedService(service);
    setIsFormOpen(true);
  };
  
  const handleDeleteService = async (serviceId: string) => {
    try {
        await deleteDoc(doc(db, "services", serviceId));
        fetchServices();
        toast({
            title: 'Product Deleted',
            description: 'The product has been successfully removed.',
            variant: 'destructive',
        });
    } catch (error) {
        console.error("Error deleting service:", error);
        toast({ title: 'Error', description: 'Could not delete the product.', variant: 'destructive' });
    }
  };

  const handleCopyService = async (service: Service) => {
    const newTitle = `Copy of ${service.title}`;
    const newSlug = newTitle.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]+/g, '');
    const { id, slug, title, ...restOfServiceData } = service;

    const newServiceData = {
        ...restOfServiceData,
        title: newTitle,
        slug: newSlug,
        createdAt: serverTimestamp(),
    };
    
    try {
      await addDoc(collection(db, "services"), newServiceData);
      toast({ title: 'Product Copied', description: `A copy of "${service.title}" has been created.` });
      fetchServices();
    } catch (error) {
      console.error("Error copying product:", error);
      toast({ title: 'Error', description: 'Could not copy the product.', variant: 'destructive'});
    }
  };

  const handleFormSubmit = async (serviceData: Omit<Service, 'id'> & { id?: string }) => {
    const { id, ...data } = serviceData;
    
    // Applying the 25% partner discount
    const finalData = {
        ...data,
        resellerPrice: data.price * 0.75,
    };
    
    try {
        if (id) {
            await setDoc(doc(db, "services", id), finalData, { merge: true });
            toast({ title: 'Product Updated', description: 'The product details have been saved.' });
        } else {
            await addDoc(collection(db, "services"), { ...finalData, createdAt: serverTimestamp() });
            toast({ title: 'Product Created', description: 'The new product has been added successfully.' });
        }
        fetchServices();
        setIsFormOpen(false);
        setSelectedService(null);
    } catch (error) {
        console.error("Error saving service:", error);
        toast({ title: 'Error', description: 'Could not save the product.', variant: 'destructive'});
    }
  };

  const handleDownloadTsv = () => {
    const dataForTsv = services.map(service => ({
      id: service.id,
      title: service.title,
      description: service.longDescription,
      link: `${process.env.NEXT_PUBLIC_APP_URL}/products/${service.slug}`,
      image_link: service.imageUrl,
      availability: service.availability === 'in_stock' ? 'in_stock' : 'out_of_stock',
      price: !service.isPriceTbc ? `${service.price.toFixed(2)} ${service.currency || 'ZAR'}` : '0.00 ZAR',
      condition: service.condition || 'new',
      brand: service.brand || 'My Accountant',
      google_product_category: service.google_product_category || 'Business & Industrial > Business Services',
      product_type: service.product_type || `Accounting > ${service.category}`,
    }));

    const tsv = Papa.unparse(dataForTsv, {
      delimiter: '\t',
      header: true,
    });
    
    const blob = new Blob([tsv], { type: 'text/tab-separated-values;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', 'google-merchant-products.tsv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast({
      title: 'Feed Exported',
      description: 'Tab-delimited file ready for Google Merchant Center upload.',
    });
  };
  
    const handleUpdateDefaults = async (discountPercentage: number) => {
        setIsUpdatingDefaults(true);
        const multiplier = (100 - discountPercentage) / 100;
        toast({ title: 'Updating Products...', description: `Applying ${discountPercentage}% discount to partner prices.` });
        
        try {
            const batch = writeBatch(db);
            let updatedCount = 0;

            services.forEach(service => {
                const newResellerPrice = service.price * multiplier;
                if (service.availability !== 'in_stock' || service.condition !== 'new' || Math.abs((service.resellerPrice || 0) - newResellerPrice) > 0.01) {
                    const serviceRef = doc(db, 'services', service.id);
                    batch.update(serviceRef, {
                        availability: 'in_stock',
                        condition: 'new',
                        resellerPrice: newResellerPrice
                    });
                    updatedCount++;
                }
            });

            if (updatedCount > 0) {
                await batch.commit();
                toast({ title: 'Success!', description: `${updatedCount} products were updated with default values and the ${discountPercentage}% partner discount.` });
                fetchServices(); 
            } else {
                toast({ title: 'No Updates Needed', description: 'All products already have the correct default values.' });
            }

        } catch (error) {
            console.error("Error updating product defaults:", error);
            toast({ title: 'Update Failed', variant: 'destructive' });
        } finally {
            setIsUpdatingDefaults(false);
        }
    };

    const handleBulkPriceUpdate = async (amount: number) => {
        setIsUpdatingDefaults(true);
        toast({ title: 'Updating Prices...', description: `Applying R${amount} adjustment to ${filteredServices.length} products.` });

        try {
            const batch = writeBatch(db);
            let updatedCount = 0;

            filteredServices.forEach(service => {
                const newPrice = Math.max(0, service.price + amount);
                const newResellerPrice = newPrice * 0.75;

                const serviceRef = doc(db, 'services', service.id);
                batch.update(serviceRef, {
                    price: newPrice,
                    resellerPrice: newResellerPrice
                });
                updatedCount++;
            });

            await batch.commit();
            toast({ title: 'Prices Updated', description: `${updatedCount} products updated successfully.` });
            fetchServices();
        } catch (error) {
            console.error("Bulk price update failed:", error);
            toast({ title: 'Update Failed', variant: 'destructive' });
        } finally {
            setIsUpdatingDefaults(false);
        }
    };

    const handleSort = (field: 'title' | 'price') => {
        if (sortField === field) {
            setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortOrder('asc');
        }
    };

  const getSeoStatus = (service: Service) => {
      const errors: string[] = [];
      const warnings: string[] = [];

      // Critical GSC Errors
      if (!service.isPriceTbc && (service.price === undefined || service.price === null || service.price === 0)) {
          errors.push("Missing Price: Fixed-price services must have a numeric price. Use 'Price to be confirmed' if it varies.");
      }
      if (!service.isPriceTbc && (!service.returnPolicyCategory || service.returnPolicyCategory === 'none' || service.returnPolicyCategory === '')) {
          errors.push("Missing Return Policy: Google requires this for rich snippets. Select one in the 'Marketing & SEO' section.");
      }

      // Warnings
      if (!service.metaTitle || service.metaTitle.length > 60) {
          warnings.push("Shorten Title: Meta Title should be present and under 60 characters to avoid truncation.");
      }
      if (!service.metaDescription || service.metaDescription.length > 160) {
          warnings.push("Shorten Description: Meta Description should be under 160 characters for best display.");
      }
      if (!service.imageUrl) {
          warnings.push("Missing Image: A display image is required for rich search results.");
      }

      if (errors.length > 0) return { status: 'Error', color: 'text-destructive', icon: <XCircle className="h-4 w-4" />, items: errors };
      if (warnings.length > 0) return { status: 'Warning', color: 'text-warning', icon: <AlertTriangle className="h-4 w-4" />, items: warnings };
      return { status: 'Valid', color: 'text-green-600', icon: <CheckCircle2 className="h-4 w-4" />, items: ['The product schema is fully optimized and compliant.'] };
  }


  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight text-slate-950">Manage Products</h1>
        <div className="flex items-center gap-2">
            <Button variant="outline" onClick={handleDownloadTsv} disabled={services.length === 0}>
              <Download className="mr-2 h-4 w-4" />
              Download Feed (TSV)
            </Button>
            <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
            <DialogTrigger asChild>
                    <Button onClick={handleAddService}>
                        <PlusCircle className="mr-2 h-4 w-4" />
                        Create Product
                    </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-xl">
                    <DialogHeader>
                        <DialogTitle>{selectedService ? 'Edit Product' : 'Create New Product'}</DialogTitle>
                        <DialogDescription>
                            {selectedService ? 'Update the details of this product.' : 'Fill out the form to add a new product.'}
                        </DialogDescription>
                    </DialogHeader>
                    <ServiceForm 
                        service={selectedService} 
                        allServices={services}
                        onSubmit={handleFormSubmit}
                    />
            </DialogContent>
            </Dialog>
        </div>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>All Products</CardTitle>
          <CardDescription>View, edit, and delete your company's products.</CardDescription>
           <div className="flex flex-col sm:flex-row gap-4 pt-4">
                <Input
                    placeholder="Filter by title..."
                    value={titleFilter}
                    onChange={(e) => setTitleFilter(e.target.value)}
                    className="max-w-sm"
                />
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                    <SelectTrigger className="w-full sm:w-[180px]">
                        <SelectValue placeholder="Filter by category..." />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Categories</SelectItem>
                        {serviceCategories.map(cat => (
                            <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                 <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
                    <SelectTrigger className="w-full sm:w-[180px]">
                        <SelectValue placeholder="Filter by department..." />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Departments</SelectItem>
                        {departments.map(dep => (
                            <SelectItem key={dep} value={dep}>{dep}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                
                <div className="flex items-center gap-2">
                    <BulkPriceAdjustmentDialog 
                        servicesCount={filteredServices.length} 
                        onUpdate={handleBulkPriceUpdate}
                        isLoading={isUpdatingDefaults}
                    />

                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button variant="outline" disabled={isUpdatingDefaults}>
                                {isUpdatingDefaults ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                                Sync 10% Discount
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>Apply 10% Partner Discount?</AlertDialogTitle>
                                <AlertDialogDescription>
                                    This will scan all products and update the `resellerPrice` to 90% of the public price. It also ensures availability is "in_stock" and condition is "new".
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleUpdateDefaults(10)}>Yes, Apply 10%</AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>

                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button variant="outline" disabled={isUpdatingDefaults}>
                                {isUpdatingDefaults ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                                Sync 25% Discount
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>Apply 25% Partner Discount?</AlertDialogTitle>
                                <AlertDialogDescription>
                                    This will scan all products and update the `resellerPrice` to 75% of the public price. It also ensures availability is "in_stock" and condition is "new".
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleUpdateDefaults(25)}>Yes, Apply 25%</AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                </div>
            </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center items-center h-64">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">Image</TableHead>
                <TableHead>
                    <Button variant="ghost" onClick={() => handleSort('title')} className="hover:bg-transparent p-0 font-bold">
                        Title
                        {sortField === 'title' ? (
                            <ArrowUp className={cn("ml-2 h-4 w-4 transition-transform", sortOrder === 'desc' && "rotate-180")} />
                        ) : <ArrowUpDown className="ml-2 h-4 w-4 opacity-50" />}
                    </Button>
                </TableHead>
                <TableHead>SEO Status</TableHead>
                <TableHead className="text-right">
                    <Button variant="ghost" onClick={() => handleSort('price')} className="hover:bg-transparent p-0 font-bold ml-auto block text-right">
                        Price
                        {sortField === 'price' ? (
                            <ArrowUp className={cn("ml-2 h-4 w-4 inline transition-transform", sortOrder === 'desc' && "rotate-180")} />
                        ) : <ArrowUpDown className="ml-2 h-4 w-4 inline opacity-50" />}
                    </Button>
                </TableHead>
                <TableHead className="text-right">Partner Cost</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredServices.map(service => {
                const seoInfo = getSeoStatus(service);

                return (
                <TableRow key={service.id}>
                   <TableCell>
                      <Image src={service.imageUrl} alt={service.title} width={40} height={40} className="rounded-md object-cover" />
                  </TableCell>
                  <TableCell className="font-medium">
                    <span>{service.title}</span>
                  </TableCell>
                   <TableCell>
                       <TooltipProvider>
                           <Tooltip>
                               <TooltipTrigger asChild>
                                   <div className={cn("flex items-center gap-1.5 cursor-help font-bold text-[11px]", seoInfo.color)}>
                                       {seoInfo.icon}
                                       {seoInfo.status}
                                   </div>
                               </TooltipTrigger>
                               <TooltipContent className="max-w-xs shadow-xl">
                                   <div className="space-y-2 p-1">
                                       <p className="font-bold border-b pb-1 mb-1 text-xs">SEO Improvement Plan:</p>
                                       {seoInfo.items.map((item, i) => (
                                           <div key={i} className="flex items-start gap-1.5 text-[10px] leading-tight">
                                               <span className="text-primary font-bold">•</span>
                                               <span>{item}</span>
                                           </div>
                                       ))}
                                   </div>
                               </TooltipContent>
                           </Tooltip>
                       </TooltipProvider>
                  </TableCell>
                  <TableCell className="text-right">
                    {service.isPriceTbc ? 'TBC' : `R ${service.price.toFixed(2)}`}
                  </TableCell>
                  <TableCell className="text-right font-semibold">
                    {service.isPriceTbc ? 'TBC' : service.resellerPrice ? `R ${service.resellerPrice.toFixed(2)}` : 'N/A'}
                  </TableCell>
                  <TableCell className="text-right">
                    <Dialog onOpenChange={(isOpen) => !isOpen && setViewingService(null)}>
                      <AlertDialog>
                          <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                              <Button variant="ghost" className="h-8 w-8 p-0">
                              <span className="sr-only">Open menu</span>
                              <MoreHorizontal className="h-4 w-4" />
                              </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                              <DropdownMenuLabel>Actions</DropdownMenuLabel>
                               <DialogTrigger asChild>
                                <DropdownMenuItem onSelect={() => setViewingService(service)}>
                                    View Preview
                                </DropdownMenuItem>
                               </DialogTrigger>
                              <DropdownMenuItem onClick={() => handleEditService(service)}>
                                  Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleCopyService(service)}>
                                <Copy className="mr-2 h-4 w-4" />
                                Copy Product
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <AlertDialogTrigger asChild>
                                  <DropdownMenuItem className="text-destructive">
                                      Delete
                                  </DropdownMenuItem>
                              </AlertDialogTrigger>
                          </DropdownMenuContent>
                          </DropdownMenu>
                          <AlertDialogContent>
                              <AlertDialogHeader>
                                  <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                  This action cannot be undone. This will permanently delete the product
                                  <span className="font-semibold"> {service.title}</span>.
                                  </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => handleDeleteService(service.id)}>
                                      Continue
                                  </AlertDialogAction>
                              </AlertDialogFooter>
                          </AlertDialogContent>
                      </AlertDialog>
                      <DialogContent className="sm:max-w-2xl">
                          <DialogHeader>
                              <DialogTitle>Product Preview</DialogTitle>
                              <DialogDescription>
                                  This is how clients will see the product page.
                              </DialogDescription>
                          </DialogHeader>
                          {viewingService && <ServicePreview service={viewingService} />}
                      </DialogContent>
                    </Dialog>
                  </TableCell>
                </TableRow>
              )})}
            </TableBody>
          </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
