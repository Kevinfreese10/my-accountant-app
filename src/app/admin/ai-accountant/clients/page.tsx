'use client';
import { useState, useEffect, useRef, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { MoreHorizontal, PlusCircle, Loader2, ArrowRight, Edit, Share2, Copy, Archive, RotateCcw } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { User, Task, AllocationRule } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { getFirestore, collection, addDoc, getDocs, doc, setDoc, deleteDoc, writeBatch, Timestamp, query, orderBy, where, updateDoc, arrayUnion, arrayRemove, getDoc, collectionGroup, serverTimestamp } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import ClientForm from '@/components/admin/ClientForm';
import { chartOfAccounts as initialChartOfAccounts } from '@/lib/chart-of-accounts';
import Link from 'next/link';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import * as XLSX from 'xlsx';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { format } from 'date-fns';
import { sendAiUserInvite } from '@/app/actions';
import { Label } from '@/components/ui/label';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError, type SecurityRuleContext } from '@/firebase/errors';


const db = getFirestore(firebaseApp);
const auth = getAuth(firebaseApp);

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
        toast({ title: 'Backup Started' });

        try {
            const backupData: any = {
                client: { ...client, id: undefined, uid: undefined },
                subCollections: {}
            };
            
            const subCollections = ['transactions', 'customers', 'suppliers', 'invoices'];
            for (const sub of subCollections) {
                const subRef = collection(db, 'aiAccountantClients', client.id, sub);
                const snapshot = await getDocs(subRef);
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
            
            toast({ title: 'Backup Complete' });

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

const inviteUserSchema = z.object({
  name: z.string().min(2, "First name is required."),
  surname: z.string().min(2, "Surname is required."),
  email: z.string().email("A valid email is required."),
  password: z.string().min(6, "Password must be at least 6 characters."),
});

function InviteUserDialog({ client, onCreateAndInvite }: { client: User | null; onCreateAndInvite: (values: z.infer<typeof inviteUserSchema>) => Promise<void> }) {
    const form = useForm<z.infer<typeof inviteUserSchema>>({
        resolver: zodResolver(inviteUserSchema),
        defaultValues: { name: "", surname: "", email: "", password: "" },
    });
    const [isInviting, setIsInviting] = useState(false);

    const handleFormSubmit = async (values: z.infer<typeof inviteUserSchema>) => {
        setIsInviting(true);
        await onCreateAndInvite(values);
        setIsInviting(false);
    };
    
    if (!client) return null;

    return (
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Invite User to "{client.name}"</DialogTitle>
                <DialogDescription>Create a new user with the 'AI Accountant' role and grant them access to this client.</DialogDescription>
            </DialogHeader>
            <Form {...form}>
                <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-4">
                     <FormField control={form.control} name="name" render={({ field }) => ( <FormItem><FormLabel>First Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )}/>
                     <FormField control={form.control} name="surname" render={({ field }) => ( <FormItem><FormLabel>Surname</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )}/>
                     <FormField control={form.control} name="email" render={({ field }) => ( <FormItem><FormLabel>Email</FormLabel><FormControl><Input type="email" {...field} /></FormControl><FormMessage /></FormItem> )}/>
                     <FormField control={form.control} name="password" render={({ field }) => ( <FormItem><FormLabel>Temporary Password</FormLabel><FormControl><Input type="password" {...field} /></FormControl><FormMessage /></FormItem> )}/>
                    <DialogFooter>
                         <Button type="submit" disabled={isInviting}>
                            {isInviting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Create & Invite User
                        </Button>
                    </DialogFooter>
                </form>
            </Form>
        </DialogContent>
    );
}

export default function AIAccountantClientsPage() {
  const [allClients, setAllClients] = useState<User[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [isDuplicateOpen, setIsDuplicateOpen] = useState(false);
  const [isBackupOpen, setIsBackupOpen] = useState(false);
  const [isRestoreOpen, setIsRestoreOpen] = useState(false);
  const [isInviteUserOpen, setIsInviteUserOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<User | null>(null);
  const { toast } = useToast();
  const { user: currentUser, reauthenticate } = useAuth();
  
  const fetchClients = async () => {
    if (!currentUser?.uid) return;
    setIsLoading(true);
    try {
        const usersRef = collection(db, "users");
        const usersSnapshot = await getDocs(usersRef);
        const allUsersData = usersSnapshot.docs.map(doc => ({ ...doc.data(), uid: doc.id, id: doc.id } as User));
        setAllUsers(allUsersData);
        
        const clientsRef = collection(db, "aiAccountantClients");
        const clientsQuery = query(clientsRef, orderBy("name"));
        const clientsSnapshot = await getDocs(clientsQuery);
        const fetchedClients = clientsSnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as User));
        setAllClients(fetchedClients);

    } catch (error) {
        console.error("Error fetching data:", error);
        toast({ title: 'Error', variant: 'destructive'});
    } finally {
        setIsLoading(false);
    }
  };

  useEffect(() => {
    if(currentUser) {
        fetchClients();
    }
  }, [currentUser]);

  const { myClients, sharedClients, archivedClients } = useMemo(() => {
    if (!currentUser) return { myClients: [], sharedClients: [], archivedClients: [] };
  
    const activeClients = allClients.filter(c => c.status !== 'Archived');
    let archived = allClients.filter(c => c.status === 'Archived');
    
    if (currentUser.role === 'admin') {
      return { myClients: activeClients, sharedClients: [], archivedClients: archived };
    }
    
    const my = activeClients.filter(c => c.createdBy === currentUser.uid);
    const shared = activeClients.filter(c => c.sharedWith?.includes(currentUser.uid) && c.createdBy !== currentUser.uid);
    archived = archived.filter(c => c.createdBy === currentUser.uid);
  
    return { myClients: my, sharedClients: shared, archivedClients: archived };
  }, [allClients, currentUser]);

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

  const handleInviteUserClick = (client: User) => {
    setSelectedClient(client);
    setIsInviteUserOpen(true);
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
    toast({ title: 'Coming Soon' });
  }

  const handleShareAction = async (email: string, action: 'add' | 'remove') => {
    if (!selectedClient) return;

    const userToShareWith = allUsers.find(u => u.email.toLowerCase() === email.toLowerCase());

    if (!userToShareWith) {
        toast({ title: 'User Not Found', variant: 'destructive'});
        return;
    }

    const clientRef = doc(db, 'aiAccountantClients', selectedClient.id);

    try {
        const updateData = action === 'add' ? { sharedWith: arrayUnion(userToShareWith.uid) } : { sharedWith: arrayRemove(userToShareWith.uid) };
        await updateDoc(clientRef, updateData);
        toast({ title: action === 'add' ? 'Client Shared' : 'Access Removed' });
        fetchClients();
    } catch(e) {
        console.error("Error sharing client:", e);
        toast({ title: 'Error', description: 'Could not update sharing settings.', variant: 'destructive'});
    }
  }
  
  const handleDelete = async (clientId: string) => {
    const clientRef = doc(db, "aiAccountantClients", clientId);
    try {
        await deleteDoc(clientRef);
        fetchClients();
        toast({ title: 'Client Deleted', variant: 'destructive' });
    } catch (error) {
        console.error("Error deleting client:", error);
    }
  };

  const handleArchive = async (clientId: string, archive: boolean) => {
    const clientRef = doc(db, 'aiAccountantClients', clientId);
    const updateData = { status: archive ? 'Archived' : 'Active' };
    try {
        await updateDoc(clientRef, updateData);
        toast({ title: `Client ${archive ? 'Archived' : 'Restored'}` });
        fetchClients();
    } catch (error) {
        console.error("Error archiving client:", error);
    }
  };
  
    const handleCreateAndInviteUser = async (values: z.infer<typeof inviteUserSchema>) => {
    if (!selectedClient || !currentUser) return;

    const q = query(collection(db, "users"), where("email", "==", values.email));
    const existingUserSnap = await getDocs(q);
    if (!existingUserSnap.empty) {
        toast({ title: "User Already Exists", variant: "destructive"});
        return;
    }

    try {
        const userCredential = await createUserWithEmailAndPassword(auth, values.email, values.password);
        const newFirebaseUser = userCredential.user;
        
        if (auth.currentUser) {
            await reauthenticate(auth.currentUser);
        }

        const newUserDocRef = doc(db, "users", newFirebaseUser.uid);
        const userData = {
            id: newFirebaseUser.uid,
            uid: newFirebaseUser.uid,
            name: `${values.name} ${values.surname}`,
            email: values.email,
            role: 'ai_accountant' as const,
            createdAt: serverTimestamp(),
        };
        await setDoc(newUserDocRef, userData);

        const clientRef = doc(db, 'aiAccountantClients', selectedClient.id);
        const updateData = { sharedWith: arrayUnion(newFirebaseUser.uid) };
        await updateDoc(clientRef, updateData);

        await sendAiUserInvite(values.email, values.name, values.password, selectedClient.name, selectedClient.id);

        toast({ title: 'User Invited!' });
        setIsInviteUserOpen(false);
        fetchClients();

    } catch (error: any) {
        console.error("Error creating and inviting user:", error);
        toast({ title: 'Invitation Failed', variant: 'destructive' });
    }
  };

  const handleDuplicateClient = async (newCompanyName: string) => {
    if (!selectedClient || !currentUser) return;

    toast({ title: "Duplication in Progress" });

    try {
        const batch = writeBatch(db);

        const { id, uid, ...originalClientData } = selectedClient;
        const newClientDocRef = doc(collection(db, 'aiAccountantClients'));
        const newClientData = {
            ...originalClientData,
            name: newCompanyName,
            companyName: newCompanyName,
            email: `copy-${Date.now()}@myacc.co.za`,
            id: newClientDocRef.id,
            uid: newClientDocRef.id,
            createdAt: Timestamp.now(),
            createdBy: currentUser.uid,
            sharedWith: [],
            clientSource: 'ai_accountant',
        };
        batch.set(newClientDocRef, newClientData);

        const subCollections = ['transactions', 'customers', 'suppliers', 'invoices'];
        for (const subCollection of subCollections) {
            const sourceRef = collection(db, 'aiAccountantClients', selectedClient.id, subCollection);
            const sourceSnapshot = await getDocs(sourceRef);
            
            sourceSnapshot.forEach(sourceDoc => {
                const newSubDocRef = doc(collection(db, 'aiAccountantClients', newClientDocRef.id, subCollection), sourceDoc.id);
                batch.set(newSubDocRef, sourceDoc.data());
            });
        }
        
        await batch.commit();

        toast({ title: "Client Duplicated Successfully!" });
        setIsDuplicateOpen(false);
        fetchClients();

    } catch (error) {
        console.error("Error duplicating client:", error);
        toast({ title: "Duplication Failed", variant: "destructive" });
    }
  }

  const handleFormSubmit = async (data: any) => {
    if (!currentUser) return;
    
    const clientDataForDb: Partial<User> = {
        name: data.name,
        companyName: data.name,
        yearEnd: data.yearEnd || null,
        isVatRegistered: data.isVatRegistered,
        vatCategory: data.isVatRegistered ? data.vatCategory : null,
        clientSource: 'ai_accountant',
    };
    
    try {
        if (selectedClient?.id) {
            const clientRef = doc(db, "aiAccountantClients", selectedClient.id);
            await updateDoc(clientRef, clientDataForDb);
            toast({ title: 'Client Updated'});
        } else {
            const newClientData: Partial<User> = {
                ...clientDataForDb,
                email: `new-${Date.now()}@my-company.ai`,
                role: 'client' as const,
                source: 'AI Accountant' as const,
                hasNumeraProfile: true,
                chartOfAccounts: initialChartOfAccounts,
                allocationRules: data.allocationRules || [],
                status: 'Active',
            };
            const newDocRef = doc(collection(db, 'aiAccountantClients'));
            const finalData = {
              ...newClientData,
              id: newDocRef.id,
              uid: newDocRef.id,
              createdAt: Timestamp.now(),
              createdBy: currentUser.uid,
              sharedWith: [],
            };
            await setDoc(newDocRef, finalData);
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
  
    const formatYearEnd = (yearEnd: any): string => {
        if (!yearEnd) return 'N/A';
        if (typeof yearEnd === 'string') {
          return yearEnd;
        }
        if (yearEnd.toDate && typeof yearEnd.toDate === 'function') {
          const date = yearEnd.toDate();
          return format(date, 'MMMM');
        }
        try {
            const d = new Date(yearEnd);
            if (!isNaN(d.getTime())) {
                 return format(d, 'MMMM');
            }
        } catch (e) {}
        return 'Invalid Date';
    };


  const renderClientTable = (clients: User[], title: string, allowDelete: boolean, isArchived: boolean = false) => {
    const getCreatorName = (uid: string) => {
        return allUsers.find(u => u.uid === uid)?.name || 'Unknown';
    }

    return (
     <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Client</TableHead>
                <TableHead>Created By</TableHead>
                <TableHead>Year End</TableHead>
                <TableHead>VAT Registered</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {clients.map(client => {
                const basePath = '/admin';
                return (
                    <TableRow key={client.id}>
                    <TableCell className="font-medium">
                        <div>
                            <span>{client.name}</span>
                        </div>
                    </TableCell>
                    <TableCell>{getCreatorName(client.createdBy || '')}</TableCell>
                    <TableCell>{formatYearEnd(client.yearEnd)}</TableCell>
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
                                 <DropdownMenuItem onClick={() => handleInviteUserClick(client)}>
                                    <Share2 className="mr-2 h-4 w-4" /> Invite Allocate User
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
                                {allowDelete && (
                                    <>
                                        <DropdownMenuSeparator />
                                         <DropdownMenuItem onClick={() => handleArchive(client.id, !isArchived)}>
                                            {isArchived ? <RotateCcw className="mr-2 h-4 w-4" /> : <Archive className="mr-2 h-4 w-4" />}
                                            {isArchived ? 'Restore Client' : 'Archive Client'}
                                        </DropdownMenuItem>
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
                                    </>
                                )}
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
  }


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
            <DialogContent className="sm:max-w-3xl">
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
       
       <Dialog open={isInviteUserOpen} onOpenChange={setIsInviteUserOpen}>
          <InviteUserDialog client={selectedClient} onCreateAndInvite={handleCreateAndInviteUser} />
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
            {(myClients.length > 0 || currentUser?.role === 'admin') && renderClientTable(myClients, currentUser?.role === 'admin' ? "All Clients" : "My Clients", true, false)}
            {(currentUser?.role !== 'admin' && sharedClients.length > 0) && renderClientTable(sharedClients, "Shared With Me", false, false)}
             {archivedClients.length > 0 && (
                <Accordion type="single" collapsible>
                    <AccordionItem value="archived-clients">
                        <AccordionTrigger>
                            <h2 className="text-lg font-semibold">Archived Clients ({archivedClients.length})</h2>
                        </AccordionTrigger>
                        <AccordionContent>
                           {renderClientTable(archivedClients, "", true, true)}
                        </AccordionContent>
                    </AccordionItem>
                </Accordion>
            )}
        </div>
      )}
    </div>
  );
}