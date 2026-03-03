'use client';
import { useState, useEffect, useMemo } from 'react';
import { Service } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { MoreHorizontal, PlusCircle, Loader2, Copy, Info, AlertTriangle, Download, RefreshCw } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
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
    return services.filter(service => {
        const titleMatch = service.title.toLowerCase().includes(titleFilter.toLowerCase());
        const categoryMatch = categoryFilter === 'all' || service.category === categoryFilter;
        const departmentMatch = departmentFilter === 'all' || service.department === departmentFilter;
        return titleMatch && categoryMatch && departmentMatch;
    });
  }, [services, titleFilter, categoryFilter, departmentFilter]);


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

  const handleDownloadCsv = () => {
    const dataForCsv = services.map(service => ({
      id: service.id,
      title: service.title,
      description: service.longDescription,
      price: !service.isPriceTbc ? `${service.price.toFixed(2)} ${service.currency || 'ZAR'}` : '',
      availability: service.availability,
      condition: service.condition,
      link: `${process.env.NEXT_PUBLIC_APP_URL}/products/${service.slug}`,
      image_link: service.imageUrl,
      brand: service.brand || 'My Accountant',
      google_product_category: service.google_product_category || 'Business & Industrial > Business Services',
      product_type: service.product_type || `Accounting > ${service.category}`,
    }));

    const csv = Papa.unparse(dataForCsv);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', 'google-merchant-products.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  
    const handleUpdateDefaults = async () => {
        setIsUpdatingDefaults(true);
        toast({ title: 'Updating Products...', description: 'This may take a moment.' });
        
        try {
            const batch = writeBatch(db);
            let updatedCount = 0;

            services.forEach(service => {
                const newResellerPrice = service.price * 0.75;
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
                toast({ title: 'Success!', description: `${updatedCount} products were updated with default values and the 25% partner discount.` });
                fetchServices(); // Refetch to show updated data
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


  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Manage Products</h1>
        <div className="flex items-center gap-2">
            <Button variant="outline" onClick={handleDownloadCsv} disabled={services.length === 0}>
              <Download className="mr-2 h-4 w-4" />
              Download CSV
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
                            <AlertDialogAction onClick={handleUpdateDefaults}>Yes, Apply Discount</AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
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
                <TableHead>Title</TableHead>
                <TableHead>Condition</TableHead>
                <TableHead>Availability</TableHead>
                <TableHead className="text-right">Price</TableHead>
                <TableHead className="text-right">Partner Cost (25% off)</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredServices.map(service => {
                const missingSchemaFields: string[] = [];
                if (!service.title) missingSchemaFields.push('Title');
                if (!service.description) missingSchemaFields.push('Description');
                if (!service.longDescription) missingSchemaFields.push('Long Description');
                if (!service.price || service.price <= 0) missingSchemaFields.push('Price');
                if (!service.imageUrl) missingSchemaFields.push('Image URL');

                return (
                <TableRow key={service.id}>
                   <TableCell>
                      <Image src={service.imageUrl} alt={service.title} width={40} height={40} className="rounded-md object-cover" />
                  </TableCell>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <span>{service.title}</span>
                      {missingSchemaFields.length > 0 && (
                          <TooltipProvider>
                              <Tooltip>
                                  <TooltipTrigger>
                                      <AlertTriangle className="h-4 w-4 text-destructive" />
                                  </TooltipTrigger>
                                  <TooltipContent>
                                      <p className="font-semibold">Missing Schema Info:</p>
                                      <ul className="list-disc pl-4 text-xs">
                                          {missingSchemaFields.map(field => <li key={field}>{field}</li>)}
                                      </ul>
                                  </TooltipContent>
                              </Tooltip>
                          </TooltipProvider>
                      )}
                    </div>
                  </TableCell>
                   <TableCell className="capitalize">
                      {service.condition || 'new'}
                  </TableCell>
                  <TableCell className="capitalize">
                      {service.availability?.replace('_', ' ') || 'in stock'}
                  </TableCell>
                  <TableCell className="text-right">
                    {service.isPriceTbc ? 'TBC' : `R ${service.price.toFixed(2)}`}
                  </TableCell>
                  <TableCell className="text-right">
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
