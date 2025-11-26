
'use client';
import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { MoreHorizontal, PlusCircle, Loader2, ArrowRight, Edit, Share2, Copy, Archive, RotateCcw } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { User } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { getFirestore, collection, addDoc, getDocs, doc, setDoc, deleteDoc, writeBatch, Timestamp, query, orderBy, where, updateDoc, arrayUnion, arrayRemove, getDoc, collectionGroup } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import ClientForm from '@/components/admin/ClientForm';
import { chartOfAccounts as initialChartOfAccounts } from '@/lib/chart-of-accounts';
import { allocationRules as initialAllocationRules } from '@/lib/allocation-rules';
import Link from 'next/link';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import * as XLSX from 'xlsx';


const db = getFirestore(firebaseApp);

function ShareClientDialog({ client, onShare, allUsers }: { client: User | null, onShare: (email: string, action: 'add' | 'remove') => void, allUsers: User[] }) {
    const [email, setEmail] = useState('');
    if (!client) return null;

    const sharedWithDetails = client.sharedWith?.map(uid => allUsers.find(u => u.uid === uid)).filter(Boolean) as User[] || [];

    return (
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Share "{client.name}"</DialogTitle>
                <DialogDescription>
                    Grant other users access to manage this client profile.
                </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
                <div className="flex gap-2">
                    <Input 
                        placeholder="Enter user's email to add"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                    />
                    <Button onClick={() => { onShare(email, 'add'); setEmail(''); }}>Add User</Button>
                </div>
                <Separator />
                 <div>
                    <h4 className="font-medium text-sm mb-2">Users with Access</h4>
                    <div className="space-y-2">
                        {sharedWithDetails.length > 0 ? sharedWithDetails.map(user => (
                            <div key={user.uid} className="flex justify-between items-center bg-muted p-2 rounded-md">
                                <div>
                                    <p className="font-semibold text-sm">{user.name}</p>
                                    <p className="text-xs text-muted-foreground">{user.email}</p>
                                </div>
                                <Button variant="destructive" size="sm" onClick={() => onShare(user.email, 'remove')}>Remove</Button>
                            </div>
                        )) : (
                            <p className="text-xs text-muted-foreground text-center py-2">Not shared with anyone yet.</p>
                        )}
                    </div>
                </div>
            </div>
        </DialogContent>
    )
}

const duplicateFormSchema = z.object({
  newCompanyName: z.string().min(2, 'A new company name is required.'),
});

function DuplicateClientDialog({ client, onDuplicate }: { client: User | null, onDuplicate: (newCompanyName: string) => void }) {
    const [isDuplicating, setIsDuplicating] = useState(false);
    
    const form = useForm<z.infer<typeof duplicateFormSchema>>({
        resolver: zodResolver(duplicateFormSchema),
        defaultValues: { newCompanyName: '' },
    });
    
    const handleFormSubmit = async (values: z.infer<typeof duplicateFormSchema>) => {
        setIsDuplicating(true);
        await onDuplicate(values.newCompanyName);
        setIsDuplicating(false);
    };

    if (!client) return null;

    return (
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Duplicate Client Profile</DialogTitle>
                <DialogDescription>
                    Create a complete copy of "{client.name}" including all transactions, customers, and settings. Enter a new name for the duplicate company.
                </DialogDescription>
            </DialogHeader>
             <Form {...form}>
                <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-4">
                    <FormField
                        control={form.control}
                        name="newCompanyName"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>New Company Name</FormLabel>
                                <FormControl><Input placeholder="e.g., Cloned Company (Pty) Ltd" {...field} /></FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <DialogFooter>
                        <Button type="submit" disabled={isDuplicating}>
                            {isDuplicating ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Copy className="mr-2 h-4 w-4" />}
                            {isDuplicating ? 'Duplicating...' : 'Create Duplicate'}
                        </Button>
                    </DialogFooter>
                </form>
            </Form>
        </DialogContent>
    );
}

function BackupClientDialog({ client }: { client: User | null }) {
    const [isBackingUp, setIsBackingUp] = useState(false);
    const { toast } = useToast();

    const handleBackup = async () => {
        if (!client) return;
        setIsBackingUp(true);
        toast({ title: 'Backup Started', description: `Creating a backup for ${client.name}. This may take a moment.` });

        try {
            // This would be a server-side function in a real app
            const backupData: any = {
                client: { ...client, id: undefined, uid: undefined }, // Don't backup IDs
                subCollections: {}
            };
            
            const subCollections = ['transactions', 'customers', 'suppliers', 'invoices'];
            for (const sub of subCollections) {
                const snapshot = await getDocs(collection(db, 'aiAccountantClients', client.id, sub));
                backupData.subCollections[sub] = snapshot.docs.map(d => d.data());
            }

            const jsonString = JSON.stringify(backupData, null, 2);
            const blob = new Blob([jsonString], { type: 'application/json' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = `backup-${client.name.replace(/\s/g, '_')}-${new Date().toISOString()}.json`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            toast({ title: 'Backup Complete', description: 'Your backup file has been downloaded.' });

        } catch (error) {
            console.error("Backup failed:", error);
            toast({ title: 'Backup Failed', variant: 'destructive' });
        } finally {
            setIsBackingUp(false);
        }
    };

    if (!client) return null;

    return (
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Backup Client Data</DialogTitle>
                <DialogDescription>Create a downloadable JSON backup of all data for "{client.name}".</DialogDescription>
            </DialogHeader>
            <div className="py-4">
                <Button onClick={handleBackup} disabled={isBackingUp} className="w-full">
                    {isBackingUp ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Archive className="mr-2 h-4 w-4"/>}
                    Download Backup File
                </Button>
            </div>
        </DialogContent>
    );
}


export default function AIAccountantClientsPage() {
  const [myClients, setMyClients] = useState<User[]>([]);
  const [sharedClients, setSharedClients] = useState<User[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [isDuplicateOpen, setIsDuplicateOpen] = useState(false);
  const [isBackupOpen, setIsBackupOpen] = useState(false);
  const [isRestoreOpen, setIsRestoreOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<User | null>(null);
  const { toast } = useToast();
  const { user: currentUser } = useAuth();
  
  const fetchClients = async () => {
    if (!currentUser?.uid) return;
    setIsLoading(true);
    try {
        const usersSnapshot = await getDocs(collection(db, "users"));
        const allUsersData = usersSnapshot.docs.map(doc => ({ ...doc.data(), uid: doc.id, id: doc.id } as User));
        setAllUsers(allUsersData);
        
        const clientsRef = collection(db, "aiAccountantClients");
        
        let createdQuery;
        
        if (currentUser.role === 'admin') {
            createdQuery = query(clientsRef, where("createdBy", "==", currentUser.uid), orderBy("name"));
        } else {
            createdQuery = query(clientsRef, where("createdBy", "==", currentUser.uid), orderBy("name"));
        }
        
        const sharedQuery = query(clientsRef, where("sharedWith", "array-contains", currentUser.uid), orderBy("name"));
        
        const [createdSnapshot, sharedSnapshot] = await Promise.all([
             getDocs(createdQuery),
             getDocs(sharedQuery)
        ]);
        
        const fetchedMyClients = createdSnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as User));
        const fetchedSharedClients = sharedSnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as User));

        setMyClients(fetchedMyClients);
        setSharedClients(fetchedSharedClients);

    } catch (error) {
        console.error("Error fetching data:", error);
        toast({ title: 'Error', description: 'Could not fetch AI Accountant clients.', variant: 'destructive'});
    } finally {
        setIsLoading(false);
    }
  };

  useEffect(() => {
    if(currentUser) {
        fetchClients();
    }
  }, [currentUser]);

  const handleAddClick = () => {
    setSelectedClient(null);
    setIsFormOpen(true);
  };
  
  const handleEdit = (client: User) => {
    setSelectedClient(client);
    setIsFormOpen(true);
  };
  
  const handleShareClick = (client: User) => {
    setSelectedClient(client);
    setIsShareOpen(true);
  }
  
  const handleDuplicateClick = (client: User) => {
    setSelectedClient(client);
    setIsDuplicateOpen(true);
  };
  
  const handleBackupClick = (client: User) => {
    setSelectedClient(client);
    setIsBackupOpen(true);
  }
  
   const handleRestoreClick = (client: User) => {
    setSelectedClient(client);
    toast({ title: 'Coming Soon', description: 'Restore functionality is not yet implemented.' });
  }

  const handleShareAction = async (email: string, action: 'add' | 'remove') => {
    if (!selectedClient) return;

    const userToShareWith = allUsers.find(u => u.email.toLowerCase() === email.toLowerCase());

    if (!userToShareWith) {
        toast({ title: 'User Not Found', description: `No user with the email "${email}" exists.`, variant: 'destructive'});
        return;
    }

    const clientRef = doc(db, 'aiAccountantClients', selectedClient.id);

    try {
        if (action === 'add') {
            await updateDoc(clientRef, { sharedWith: arrayUnion(userToShareWith.uid) });
            toast({ title: 'Client Shared', description: `${selectedClient.name} has been shared with ${userToShareWith.name}.` });
        } else {
            await updateDoc(clientRef, { sharedWith: arrayRemove(userToShareWith.uid) });
            toast({ title: 'Access Removed', description: `Access for ${userToShareWith.name} has been removed from ${selectedClient.name}.` });
        }
        fetchClients(); // Refetch to update the list
    } catch(e) {
        console.error("Error sharing client:", e);
        toast({ title: 'Error', description: 'Could not update sharing settings.', variant: 'destructive'});
    }
  }
  
  const handleDelete = async (clientId: string) => {
    try {
        await deleteDoc(doc(db, "aiAccountantClients", clientId));
        fetchClients();
        toast({
            title: 'Client Deleted',
            description: `The AI Accountant profile has been removed.`,
            variant: 'destructive',
        });
    } catch (error) {
        console.error("Error deleting client:", error);
        toast({ title: 'Error', description: 'Could not delete client profile.', variant: 'destructive' });
    }
  };

  const handleDuplicateClient = async (newCompanyName: string) => {
    if (!selectedClient || !currentUser) return;

    toast({ title: "Duplication in Progress", description: "This may take a few moments..."});

    try {
        const batch = writeBatch(db);

        // 1. Create new client document
        const { id, uid, ...originalClientData } = selectedClient;
        const newClientDocRef = doc(collection(db, 'aiAccountantClients'));
        const newClientData = {
            ...originalClientData,
            name: newCompanyName,
            companyName: newCompanyName,
            email: `copy-${Date.now()}@myacc.co.za`, // Assign a temporary unique email
            id: newClientDocRef.id,
            uid: newClientDocRef.id,
            createdAt: Timestamp.now(),
            createdBy: currentUser.uid,
            sharedWith: [], // Don't copy sharing settings
        };
        batch.set(newClientDocRef, newClientData);

        // 2. Deep copy all sub-collections
        const subCollections = ['transactions', 'customers', 'suppliers', 'invoices']; // Add any other sub-collections here
        for (const subCollection of subCollections) {
            const sourceCollectionRef = collection(db, 'aiAccountantClients', selectedClient.id, subCollection);
            const sourceSnapshot = await getDocs(sourceCollectionRef);
            
            sourceSnapshot.forEach(sourceDoc => {
                const newSubDocRef = doc(collection(db, 'aiAccountantClients', newClientDocRef.id, subCollection), sourceDoc.id);
                batch.set(newSubDocRef, sourceDoc.data());
            });
        }
        
        await batch.commit();

        toast({ title: "Client Duplicated Successfully!", description: `A copy named "${newCompanyName}" has been created.` });
        setIsDuplicateOpen(false);
        fetchClients();

    } catch (error) {
        console.error("Error duplicating client:", error);
        toast({ title: "Duplication Failed", description: "An error occurred during the duplication process.", variant: "destructive" });
    }
  }


  const handleFormSubmit = async (data: any) => {
    if (!currentUser) return;
    
    const clientData: Partial<User> = {
        ...data,
        yearEnd: data.yearEnd || null,
        role: 'client',
        source: 'AI Accountant',
        hasNumeraProfile: true,
        chartOfAccounts: initialChartOfAccounts,
        allocationRules: initialAllocationRules,
    };

    if (!data.isVatRegistered) {
      clientData.vatNumber = null;
      clientData.vatCategory = null;
    }
    
    try {
        if (selectedClient?.id) {
            await setDoc(doc(db, "aiAccountantClients", selectedClient.id), clientData, { merge: true });
            toast({ title: 'Client Updated'});
        } else {
            const newDocRef = doc(collection(db, 'aiAccountantClients'));
            await setDoc(newDocRef, {
              ...clientData,
              id: newDocRef.id,
              uid: newDocRef.id,
              createdAt: Timestamp.now(),
              createdBy: currentUser.uid,
              sharedWith: [],
            });
            toast({ title: 'Client Created' });
        }

        fetchClients();
        setIsFormOpen(false);
        setSelectedClient(null);
    } catch (error) {
        console.error("Error saving client:", error);
        toast({ title: 'Error', description: 'Could not save the client.', variant: 'destructive'});
    }
  };


  const renderClientTable = (clients: User[], title: string) => (
     <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Client</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>VAT Registered</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {clients.map(client => {
                const basePath = currentUser?.role === 'admin' ? '/admin' : '/dashboard';
                return (
                    <TableRow key={client.id}>
                    <TableCell className="font-medium">
                        <div>
                            <span>{client.name}</span>
                            {client.contactPerson && <p className="text-xs text-muted-foreground">{client.contactPerson}</p>}
                        </div>
                    </TableCell>
                    <TableCell>{client.email}</TableCell>
                    <TableCell>
                        {client.isVatRegistered ? (
                            <Badge variant="success">Yes</Badge>
                        ) : (
                            <Badge variant="secondary">No</Badge>
                        )}
                    </TableCell>
                    <TableCell className="text-right">
                       <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                                <span className="sr-only">Open menu</span>
                                <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent>
                                <DropdownMenuItem asChild>
                                     <Link href={`${basePath}/ai-accountant/${client.id}/dashboard`}>
                                        Manage Client <ArrowRight className="ml-auto h-4 w-4" />
                                    </Link>
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleEdit(client)}>
                                    <Edit className="mr-2 h-4 w-4" /> Edit
                                </DropdownMenuItem>
                                 <DropdownMenuItem onClick={() => handleShareClick(client)}>
                                    <Share2 className="mr-2 h-4 w-4" /> Share Access
                                </DropdownMenuItem>
                                 <DropdownMenuItem onClick={() => handleDuplicateClick(client)}>
                                    <Copy className="mr-2 h-4 w-4" /> Duplicate
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => handleBackupClick(client)}>
                                    <Archive className="mr-2 h-4 w-4" /> Backup Company
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleRestoreClick(client)}>
                                    <RotateCcw className="mr-2 h-4 w-4" /> Restore from Backup
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                        <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-destructive">Delete</DropdownMenuItem>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                        <AlertDialogHeader>
                                            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                            <AlertDialogDescription>This will permanently delete the AI Accountant profile for {client.name}. This action cannot be undone.</AlertDialogDescription>
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
                )
            })}
            </TableBody>
          </Table>
          {clients.length === 0 && <p className="text-center text-muted-foreground py-4">No clients found in this section.</p>}
        </CardContent>
      </Card>
  )


  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">AI Accountant Clients</h1>
        <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
            <DialogTrigger asChild>
                <Button onClick={handleAddClick}>
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Create Client
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>{selectedClient ? 'Edit Client' : 'Create New Client'}</DialogTitle>
                        <DialogDescription>
                            {selectedClient ? 'Update the details for this client.' : 'Fill out the form to add a new client to the AI Accountant module.'}
                        </DialogDescription>
                    </DialogHeader>
                    <ClientForm 
                        client={selectedClient} 
                        onSubmit={handleFormSubmit}
                        onCancel={() => setIsFormOpen(false)}
                        isAIClient={true}
                    />
            </DialogContent>
        </Dialog>
      </div>

       <Dialog open={isShareOpen} onOpenChange={setIsShareOpen}>
          <ShareClientDialog client={selectedClient} onShare={handleShareAction} allUsers={allUsers} />
       </Dialog>

        <Dialog open={isDuplicateOpen} onOpenChange={setIsDuplicateOpen}>
          <DuplicateClientDialog client={selectedClient} onDuplicate={handleDuplicateClient} />
       </Dialog>
       
       <Dialog open={isBackupOpen} onOpenChange={setIsBackupOpen}>
            <BackupClientDialog client={selectedClient} />
       </Dialog>
      
      {isLoading ? (
        <div className="flex justify-center items-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <div className="space-y-8">
            {renderClientTable(myClients, "My Clients")}
            {currentUser?.role === 'admin' && renderClientTable(sharedClients, "Shared With Me")}
        </div>
      )}
    </div>
  );
}
