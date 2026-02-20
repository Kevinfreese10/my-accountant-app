'use client';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { MoreHorizontal, PlusCircle, Loader2, Edit, Trash2, Crown, AlertCircle, Wallet2 } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { User } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { getFirestore, collection, getDocs, doc, setDoc, deleteDoc, query, where, serverTimestamp, getDoc, updateDoc, increment } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import { useAuth } from '@/contexts/AuthContext';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Link from 'next/link';

const db = getFirestore(firebaseApp);
const auth = getAuth(firebaseApp);

const staffSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(2, 'Name is required.'),
  email: z.string().email('Valid email is required.'),
  password: z.string().min(6, 'Password must be at least 6 characters.').optional(),
});

const STAFF_MONTHLY_FEE = 50;

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
        const partnerId = currentUser.role === 'partner' ? currentUser.uid : currentUser.partnerId;
        if (!partnerId) return;

        const partnerDoc = await getDoc(doc(db, "users", partnerId));
        const staffList: User[] = [];
        if (partnerDoc.exists()) {
            staffList.push({ ...partnerDoc.data(), id: partnerDoc.id, uid: partnerDoc.id } as User);
        }

        const q = query(collection(db, "users"), where("partnerId", "==", partnerId), where("role", "==", "partner_staff"));
        const snapshot = await getDocs(q);
        const fetchedStaff = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id, uid: doc.id } as User));
        
        setStaff([...staffList, ...fetchedStaff]);
    } catch (error) {
        console.error("Error fetching staff:", error);
        toast({ title: 'Error', description: 'Could not fetch practice staff.', variant: 'destructive'});
    } finally {
        setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStaff();
  }, [currentUser]);

  // Calculate pro-rata cost for current month
  const calculateProRata = () => {
    const now = new Date();
    const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const remainingDays = lastDayOfMonth - now.getDate() + 1;
    return parseFloat(((remainingDays / lastDayOfMonth) * STAFF_MONTHLY_FEE).toFixed(2));
  };

  const proRataAmount = calculateProRata();
  const canAffordStaff = (currentUser?.creditBalance || 0) >= proRataAmount;

  const handleFormSubmit = async (values: z.infer<typeof staffSchema>) => {
    if (!currentUser) return;
    setIsLoading(true);

    try {
        const partnerId = currentUser.role === 'partner' ? currentUser.uid : currentUser.partnerId;
        if (!partnerId) throw new Error("Partner ID not found.");

        if (values.id) {
            await updateDoc(doc(db, "users", values.id), { name: values.name });
            toast({ title: 'Staff Member Updated' });
        } else {
            // New Staff Billing Logic
            if (!canAffordStaff) {
                toast({ title: 'Insufficient Credits', description: `You need at least R${proRataAmount} in your wallet to add a staff member.`, variant: 'destructive' });
                setIsLoading(false);
                return;
            }

            const userCredential = await createUserWithEmailAndPassword(auth, values.email, values.password!);
            const newUid = userCredential.user.uid;

            // 1. Create staff record
            await setDoc(doc(db, "users", newUid), {
                id: newUid,
                uid: newUid,
                name: values.name,
                email: values.email,
                role: 'partner_staff',
                partnerId: partnerId,
                status: 'Active',
                createdAt: serverTimestamp(),
            });

            // 2. Deduct pro-rata from partner wallet & update monthly total
            const partnerRef = doc(db, 'users', partnerId);
            await updateDoc(partnerRef, {
                creditBalance: increment(-proRataAmount),
                'subscription.monthlyTotal': increment(STAFF_MONTHLY_FEE),
                'subscription.subscriptionStatus': 'active', // Ensure active if they just paid
            });

            // Re-authenticate partner if they were the one who signed up
            if (currentUser.email && currentUser.password) {
                await login(currentUser.email, currentUser.password);
            }

            toast({ title: 'Staff Member Added', description: `R${proRataAmount} has been deducted from your wallet for this month.` });
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

  const handleDelete = async (staffMember: User) => {
    try {
        const partnerId = currentUser?.role === 'partner' ? currentUser.uid : currentUser?.partnerId;
        if (!partnerId) return;

        await deleteDoc(doc(db, "users", staffMember.id));
        
        // Reduce monthly subscription total
        const partnerRef = doc(db, 'users', partnerId);
        await updateDoc(partnerRef, {
            'subscription.monthlyTotal': increment(-STAFF_MONTHLY_FEE)
        });

        fetchStaff();
        toast({ title: 'Staff Member Removed', variant: 'destructive' });
    } catch (error) {
        console.error("Error deleting staff:", error);
        toast({ title: 'Error', description: 'Could not remove staff member.', variant: 'destructive' });
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-ZA', {
      style: 'currency',
      currency: 'ZAR',
    }).format(price);
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
            <h1 className="text-3xl font-bold tracking-tight">Practice Staff</h1>
            <p className="text-sm text-muted-foreground mt-1">Manage your practice team members (R50 / member / month).</p>
        </div>
        <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
            <DialogTrigger asChild>
                <Button onClick={() => { setSelectedStaff(null); form.reset({ name: '', email: '', password: '' }); }}>
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Add Staff Member
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>{selectedStaff ? 'Edit Staff' : 'Add Staff member'}</DialogTitle>
                    <DialogDescription>
                        {selectedStaff ? 'Update this staff member\'s name.' : `Add a new member to your practice. A pro-rated fee of ${formatPrice(proRataAmount)} will be deducted from your wallet for the remainder of this month.`}
                    </DialogDescription>
                </DialogHeader>
                
                {!selectedStaff && !canAffordStaff && (
                    <div className="bg-destructive/10 p-4 rounded-lg border border-destructive/20 flex gap-3 items-start my-2">
                        <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                        <div className="space-y-2">
                            <p className="text-sm font-semibold text-destructive">Insufficient Wallet Balance</p>
                            <p className="text-xs text-muted-foreground">You need at least {formatPrice(proRataAmount)} to add a new staff member this month. Your current balance is {formatPrice(currentUser?.creditBalance || 0)}.</p>
                            <Button size="sm" variant="outline" className="border-destructive text-destructive hover:bg-destructive hover:text-white" asChild>
                                <Link href="/partner/dashboard"><Wallet2 className="mr-2 h-3 w-3"/>Top Up Now</Link>
                            </Button>
                        </div>
                    </div>
                )}

                <Form {...form}>
                    <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-4">
                        <FormField control={form.control} name="name" render={({ field }) => ( <FormItem><FormLabel>Full Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                        <FormField control={form.control} name="email" render={({ field }) => ( <FormItem><FormLabel>Email Address</FormLabel><FormControl><Input type="email" {...field} disabled={!!selectedStaff} /></FormControl><FormMessage /></FormItem> )} />
                        {!selectedStaff && (
                            <>
                            <FormField control={form.control} name="password" render={({ field }) => ( <FormItem><FormLabel>Password</FormLabel><FormControl><Input type="password" {...field} /></FormControl><FormMessage /></FormItem> )} />
                            <div className="p-3 bg-muted rounded-md border flex justify-between items-center text-sm">
                                <span className="text-muted-foreground font-medium">Billing Total:</span>
                                <span className="font-bold text-primary">{formatPrice(proRataAmount)}</span>
                            </div>
                            </>
                        )}
                        <Button type="submit" className="w-full" disabled={isLoading || (!selectedStaff && !canAffordStaff)}>
                            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {selectedStaff ? 'Update Staff' : 'Pay & Create Staff Member'}
                        </Button>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Practice Team</CardTitle>
          <CardDescription>Members with access to your client dashboard. The first R50/member is billed at the start of each month.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading && staff.length === 0 ? (
            <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin" /></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {staff.map(member => (
                  <TableRow key={member.id}>
                    <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                            {member.role === 'partner' && <Crown className="h-4 w-4 text-yellow-500" />}
                            {member.name}
                        </div>
                    </TableCell>
                    <TableCell>{member.email}</TableCell>
                    <TableCell>
                        <Badge variant={member.role === 'partner' ? 'default' : 'secondary'} className="capitalize">
                            {member.role === 'partner' ? 'Practice Owner' : 'Staff'}
                        </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                        <Button variant="ghost" size="icon" onClick={() => { setSelectedStaff(member); form.reset({ id: member.id, name: member.name, email: member.email }); setIsFormOpen(true); }}><Edit className="h-4 w-4" /></Button>
                        {member.role !== 'partner' && (
                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button variant="ghost" size="icon" className="text-destructive"><Trash2 className="h-4 w-4" /></Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>Remove Staff Member?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                            This will permanently delete the staff login for {member.name}. Their R50/month subscription will be cancelled immediately.
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                        <AlertDialogAction onClick={() => handleDelete(member)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Remove Member</AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        )}
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
