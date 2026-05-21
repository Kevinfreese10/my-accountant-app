'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Loader2, ArrowRight, Search, Building, PlusCircle, Edit, Trash2 } from 'lucide-react';
import { getFirestore, collection, query, orderBy, onSnapshot, doc, setDoc, deleteDoc, Timestamp } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { User } from '@/lib/types';
import Link from 'next/link';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import ClientForm from '@/components/admin/ClientForm';
import { chartOfAccounts as initialChartOfAccounts } from '@/lib/chart-of-accounts';
import { allocationRules as initialAllocationRules } from '@/lib/allocation-rules';

const db = getFirestore(firebaseApp);

export default function AIAccountantClientsPage() {
    const [clients, setClients] = useState<User[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [selectedClient, setSelectedClient] = useState<User | null>(null);
    const { toast } = useToast();
    const { user: currentUser } = useAuth();

    useEffect(() => {
        const q = query(collection(db, 'aiAccountantClients'), orderBy('name'));
        const unsubscribe = onSnapshot(q, (snap) => {
            const fetchedClients = snap.docs.map(d => ({ ...d.data(), id: d.id } as User));
            setClients(fetchedClients);
            setIsLoading(false);
        }, (error) => {
            console.error("Error fetching AI Accountant clients:", error);
            setIsLoading(false);
        });
        return () => unsubscribe();
    }, []);

    const handleAddClick = () => {
        setSelectedClient(null);
        setIsFormOpen(true);
    };

    const handleEditClick = (client: User) => {
        setSelectedClient(client);
        setIsFormOpen(true);
    };

    const handleDelete = async (clientId: string) => {
        try {
            await deleteDoc(doc(db, "aiAccountantClients", clientId));
            toast({
                title: 'Client Deleted',
                description: 'The AI Accountant profile has been successfully removed.',
                variant: 'destructive',
            });
        } catch (error) {
            console.error("Error deleting client:", error);
            toast({
                title: 'Error',
                description: 'Could not delete client profile.',
                variant: 'destructive'
            });
        }
    };

    const handleFormSubmit = async (data: any) => {
        try {
            if (selectedClient?.id) {
                // Edit / Update Client details
                const { createAIProfile, ...clientFormData } = data;
                const updateData: Partial<User> = {
                    ...clientFormData,
                    name: data.name,
                    companyName: data.name,
                    yearEnd: data.yearEnd || null,
                    clientSource: 'ai_accountant',
                };
                
                if (!data.isVatRegistered) {
                    updateData.vatNumber = '';
                    updateData.vatCategory = null;
                } else {
                    updateData.vatCategory = data.vatCategory || null;
                }

                await setDoc(doc(db, "aiAccountantClients", selectedClient.id), updateData, { merge: true });
                toast({ title: 'Client Updated', description: `Successfully updated ${data.name}.` });
            } else {
                // Create New Client
                const { createAIProfile, ...clientFormData } = data;
                const newClientData: Partial<User> = {
                    ...clientFormData,
                    name: data.name,
                    companyName: data.name,
                    yearEnd: data.yearEnd || null,
                    role: 'client',
                    source: 'AI Accountant',
                    clientSource: 'ai_accountant',
                    hasNumeraProfile: true,
                    chartOfAccounts: initialChartOfAccounts,
                    allocationRules: initialAllocationRules,
                };

                if (!data.isVatRegistered) {
                    newClientData.vatNumber = '';
                    newClientData.vatCategory = null;
                } else {
                    newClientData.vatCategory = data.vatCategory || null;
                }

                const newDocRef = doc(collection(db, 'aiAccountantClients'));
                await setDoc(newDocRef, {
                    ...newClientData,
                    id: newDocRef.id,
                    uid: newDocRef.id,
                    createdAt: Timestamp.now(),
                    createdBy: currentUser?.uid || 'admin',
                    sharedWith: [],
                });
                toast({ title: 'Client Created', description: `Successfully created ${data.name}.` });
            }
            setIsFormOpen(false);
            setSelectedClient(null);
        } catch (error) {
            console.error("Error saving client:", error);
            toast({
                title: 'Error',
                description: 'Could not save the client.',
                variant: 'destructive',
            });
        }
    };

    const filteredClients = clients.filter(c => 
        c.name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
        c.companyName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.email?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-slate-900">AI Accountant Clients</h1>
                    <p className="text-sm text-muted-foreground font-medium uppercase tracking-widest">Administrative Overview</p>
                </div>
                
                <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
                    <DialogTrigger asChild>
                        <Button onClick={handleAddClick} className="font-bold flex items-center gap-2">
                            <PlusCircle className="h-4 w-4" />
                            Create Client
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col p-6">
                        <DialogHeader className="pb-4">
                            <DialogTitle className="text-xl font-bold">{selectedClient ? 'Edit Client' : 'Create New Client'}</DialogTitle>
                            <DialogDescription>
                                {selectedClient ? 'Update the details for this AI Accountant client profile.' : 'Add a new client company profile to the AI Accountant administrative database.'}
                            </DialogDescription>
                        </DialogHeader>
                        <div className="flex-grow overflow-hidden">
                            <ClientForm 
                                client={selectedClient} 
                                onSubmit={handleFormSubmit}
                                onCancel={() => setIsFormOpen(false)}
                                isAIClient={true}
                            />
                        </div>
                    </DialogContent>
                </Dialog>
            </div>

            <Card className="border-2 shadow-sm">
                <CardHeader className="bg-muted/30 pb-4 border-b">
                    <div className="flex items-center gap-4">
                        <div className="relative flex-grow max-w-md">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input 
                                placeholder="Search by name, company or email..." 
                                className="pl-8 h-10" 
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    {isLoading ? (
                        <div className="flex justify-center py-20"><Loader2 className="animate-spin text-primary h-8 w-8" /></div>
                    ) : filteredClients.length === 0 ? (
                        <div className="text-center py-20 text-muted-foreground font-medium">
                            <Building className="h-12 w-12 mx-auto mb-4 opacity-20" />
                            <p>No AI Accountant clients found.</p>
                        </div>
                    ) : (
                        <Table>
                            <TableHeader className="bg-muted/10">
                                <TableRow>
                                    <TableHead className="font-bold">Client / Company</TableHead>
                                    <TableHead className="font-bold">VAT Status</TableHead>
                                    <TableHead className="font-bold">Status</TableHead>
                                    <TableHead className="text-right font-bold pr-6">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredClients.map(client => (
                                    <TableRow key={client.id} className="hover:bg-muted/5 transition-colors">
                                        <TableCell className="font-bold text-slate-900 pl-6">
                                            <div className="flex flex-col">
                                                <span>{client.companyName || client.name}</span>
                                                {client.companyName && client.name !== client.companyName && (
                                                    <span className="text-[10px] text-muted-foreground font-medium">{client.name}</span>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            {client.isVatRegistered ? (
                                                <Badge variant="success" className="text-[10px] font-bold px-2 py-0">Registered</Badge>
                                            ) : (
                                                <Badge variant="secondary" className="text-[10px] font-bold px-2 py-0 opacity-50">Not Registered</Badge>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant={client.status === 'Active' ? 'default' : 'secondary'} className="text-[10px] uppercase font-bold">
                                                {client.status || 'Active'}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right pr-6">
                                            <div className="flex justify-end items-center gap-2">
                                                <Button variant="outline" size="sm" asChild className="font-bold border-primary/20 text-primary hover:bg-primary hover:text-white transition-all">
                                                    <Link href={`/admin/ai-accountant/${client.id}/dashboard`}>
                                                        Open Dashboard <ArrowRight className="ml-2 h-4 w-4" />
                                                    </Link>
                                                </Button>
                                                
                                                <Button variant="outline" size="icon" onClick={() => handleEditClick(client)} className="h-9 w-9 text-slate-600 hover:text-primary hover:border-primary transition-all" title="Edit Client">
                                                    <Edit className="h-4 w-4" />
                                                </Button>

                                                <AlertDialog>
                                                    <AlertDialogTrigger asChild>
                                                        <Button variant="outline" size="icon" className="h-9 w-9 text-destructive hover:bg-destructive/10 hover:text-destructive hover:border-destructive transition-all" title="Delete Client">
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </AlertDialogTrigger>
                                                    <AlertDialogContent>
                                                        <AlertDialogHeader>
                                                            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                                            <AlertDialogDescription>
                                                                This will permanently delete the AI Accountant profile for <strong>{client.companyName || client.name}</strong> and all associated data. This action cannot be undone.
                                                            </AlertDialogDescription>
                                                        </AlertDialogHeader>
                                                        <AlertDialogFooter>
                                                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                            <AlertDialogAction onClick={() => handleDelete(client.id)} className="bg-destructive hover:bg-destructive/90 text-white font-bold">
                                                                Delete Client
                                                            </AlertDialogAction>
                                                        </AlertDialogFooter>
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
                <CardFooter className="bg-muted/30 border-t py-3 text-right justify-end pr-6">
                    <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">
                        Total {filteredClients.length} clients detected
                    </p>
                </CardFooter>
            </Card>
        </div>
    );
}
