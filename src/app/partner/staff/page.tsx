'use client';
import { useState, useEffect } from 'react';
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
import { getFirestore, collection, addDoc, getDocs, doc, setDoc, deleteDoc, query, where, serverTimestamp } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import { useAuth } from '@/contexts/AuthContext';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const db = getFirestore(firebaseApp);
const auth = getAuth(firebaseApp);

const staffSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(2, 'Name is required.'),
  email: z.string().email('Valid email is required.'),
  password: z.string().min(6, 'Password must be at least 6 characters.').optional(),
});

export default function PartnerStaffPage() {
  const [staff, setStaff] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState<User | null>(null);
  const { toast } = useToast();
  const { user: currentUser, login } = useAuth();
  
  const form = useForm<z.infer<typeof staffSchema>>({
    resolver: zodResolver(staffSchema),
    defaultValues: { name: '', email: '', password: '' },
  });

  const fetchStaff = async () => {
    if (!currentUser) return;
    setIsLoading(true);
    try {
        const q = query(collection(db, "users"), where("partnerId", "==", currentUser.uid), where("role", "==", "partner_staff"));
        const snapshot = await getDocs(q);
        setStaff(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as User)));
    } catch (error) {
        console.error("Error fetching staff:", error);
    } finally {
        setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStaff();
  }, [currentUser]);

  const handleFormSubmit = async (values: z.infer<typeof staffSchema>) => {
    if (!currentUser) return;
    setIsLoading(true);

    try {
        if (values.id) {
            await setDoc(doc(db, "users", values.id), { name: values.name }, { merge: true });
            toast({ title: 'Staff Member Updated' });
        } else {
            // Create in Firebase Auth
            const userCredential = await createUserWithEmailAndPassword(auth, values.email, values.password!);
            const newUid = userCredential.user.uid;

            await setDoc(doc(db, "users", newUid), {
                id: newUid,
                uid: newUid,
                name: values.name,
                email: values.email,
                role: 'partner_staff',
                partnerId: currentUser.uid,
                status: 'Active',
                createdAt: serverTimestamp(),
            });

            // Re-authenticate partner
            if (currentUser.email && currentUser.password) {
                await login(currentUser.email, currentUser.password);
            }

            toast({ title: 'Staff Member Created' });
        }
        fetchStaff();
        setIsFormOpen(false);
        form.reset();
    } catch (error: any) {
        toast({ title: 'Operation Failed', description: error.message, variant: 'destructive' });
    } finally {
        setIsLoading(false);
    }
  };

  const handleDelete = async (staffId: string) => {
    try {
        await deleteDoc(doc(db, "users", staffId));
        fetchStaff();
        toast({ title: 'Staff Member Removed', variant: 'destructive' });
    } catch (error) {
        console.error("Error deleting staff:", error);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Practice Staff</h1>
        <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
            <DialogTrigger asChild>
                <Button onClick={() => { setSelectedStaff(null); form.reset({ name: '', email: '', password: '' }); }}>
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Add Staff Member
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{selectedStaff ? 'Edit Staff' : 'Add Staff'}</DialogTitle>
                    <DialogDescription>Create a staff login for your practice.</DialogDescription>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-4">
                        <FormField control={form.control} name="name" render={({ field }) => ( <FormItem><FormLabel>Full Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                        <FormField control={form.control} name="email" render={({ field }) => ( <FormItem><FormLabel>Email Address</FormLabel><FormControl><Input type="email" {...field} disabled={!!selectedStaff} /></FormControl><FormMessage /></FormItem> )} />
                        {!selectedStaff && (
                            <FormField control={form.control} name="password" render={({ field }) => ( <FormItem><FormLabel>Password</FormLabel><FormControl><Input type="password" {...field} /></FormControl><FormMessage /></FormItem> )} />
                        )}
                        <Button type="submit" className="w-full" disabled={isLoading}>
                            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {selectedStaff ? 'Update Staff' : 'Create Staff Member'}
                        </Button>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Practice Team</CardTitle>
          <CardDescription>Your staff members who can manage assigned clients and tasks.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin" /></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {staff.map(member => (
                  <TableRow key={member.id}>
                    <TableCell className="font-medium">{member.name}</TableCell>
                    <TableCell>{member.email}</TableCell>
                    <TableCell className="text-right">
                        <Button variant="ghost" size="icon" onClick={() => { setSelectedStaff(member); form.reset({ id: member.id, name: member.name, email: member.email }); setIsFormOpen(true); }}><Edit className="h-4 w-4" /></Button>
                        <AlertDialog>
                            <AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="text-destructive"><Trash2 className="h-4 w-4" /></Button></AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader><AlertDialogTitle>Remove Staff?</AlertDialogTitle></AlertDialogHeader>
                                <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => handleDelete(member.id)}>Remove</AlertDialogAction></AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
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
