'use client';
import { useState, useEffect, useRef, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { MoreHorizontal, PlusCircle, Loader2, Edit, Trash2 } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { User } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { getFirestore, collection, addDoc, getDocs, doc, setDoc, deleteDoc, query, orderBy, where, serverTimestamp, Timestamp } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import ClientForm from '@/components/admin/ClientForm';
import { format } from 'date-fns';

const db = getFirestore(firebaseApp);

export default function PartnerClientsPage() {
  const [clients, setClients] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<User | null>(null);
  const { toast } = useToast();
  const { user: currentUser } = useAuth();
  
  const partnerId = currentUser?.role === 'partner' ? currentUser.uid : currentUser?.partnerId;

  const fetchClients = async () => {
    if (!partnerId) return;
    setIsLoading(true);
    try {
        const clientsRef = collection(db, "partnerClients");
        const q = query(clientsRef, where("partnerId", "==", partnerId), orderBy("name"));
        const snapshot = await getDocs(q);
        const fetchedClients = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as User));
        setClients(fetchedClients);
    } catch (error) {
        console.error("Error fetching clients:", error);
        toast({ title: 'Error', description: 'Could not fetch clients.', variant: 'destructive'});
    } finally {
        setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchClients();
  }, [partnerId]);

  const handleAdd = () => {
    setSelectedClient(null);
    setIsFormOpen(true);
  };

  const handleEdit = (client: User) => {
    setSelectedClient(client);
    setIsFormOpen(true);
  };
  
  const handleDelete = async (clientId: string) => {
    try {
        await deleteDoc(doc(db, "partnerClients", clientId));
        fetchClients();
        toast({ title: 'Client Deleted', variant: 'destructive' });
    } catch (error) {
        console.error("Error deleting client:", error);
        toast({ title: 'Error', variant: 'destructive' });
    }
  };

  const handleFormSubmit = async (data: any) => {
    if (!partnerId) return;
    
    const clientData = {
        name: data.name,
        status: data.status,
        entityType: data.entityType || 'Company',
        yearEnd: data.yearEnd ? data.yearEnd : null,
        partnerId: partnerId,
        role: 'client' as const,
        source: 'Partner Management',
        clientSource: 'partner',
    };
    
    try {
        if (selectedClient?.id) {
            await setDoc(doc(db, "partnerClients", selectedClient.id), clientData, { merge: true });
            toast({ title: 'Client Updated'});
        } else {
            await addDoc(collection(db, "partnerClients"), { 
                ...clientData, 
                createdAt: serverTimestamp(),
                createdBy: currentUser?.uid 
            });
            toast({ title: 'Client Created' });
        }
        fetchClients();
        setIsFormOpen(false);
        setSelectedClient(null);
    } catch (error) {
        console.error("Error saving client:", error);
        toast({ title: 'Error', description: 'Could not save client details.', variant: 'destructive'});
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Practice Clients</h1>
        <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
            <DialogTrigger asChild>
                <Button onClick={handleAdd}>
                    <PlusCircle className="mr-2 h-4 w-4" />
                    New Client
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-2xl">
                <DialogHeader>
                    <DialogTitle>{selectedClient ? 'Edit Client' : 'Add Client'}</DialogTitle>
                    <DialogDescription>Add a new client to your practice list.</DialogDescription>
                </DialogHeader>
                <ClientForm 
                    client={selectedClient} 
                    onSubmit={handleFormSubmit}
                    onCancel={() => setIsFormOpen(false)}
                    taskTemplates={[]} 
                />
            </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Clients</CardTitle>
          <CardDescription>Manage your practice's individual and business clients.</CardDescription>
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
                <TableHead>Client Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {clients.map(client => (
                <TableRow key={client.id}>
                  <TableCell className="font-medium">{client.name}</TableCell>
                  <TableCell>{client.entityType}</TableCell>
                  <TableCell>
                    <Badge variant={client.status === 'Active' ? 'success' : 'secondary'}>{client.status}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleEdit(client)}>Edit</DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <DropdownMenuItem className="text-destructive">Delete</DropdownMenuItem>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                              <AlertDialogDescription>This will permanently delete "{client.name}" from your practice.</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDelete(client.id)}>Delete</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </DropdownMenuContent>
                    </DropdownMenu>
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