'use client';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { MoreHorizontal, PlusCircle, Loader2, Edit, Trash2, Crown, AlertCircle, Wallet2, Tags, Plus, X } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { User } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { getFirestore, collection, getDocs, doc, setDoc, deleteDoc, query, where, serverTimestamp, getDoc, updateDoc, increment, arrayUnion, arrayRemove } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import { useAuth } from '@/contexts/AuthContext';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Link from 'next/link';
import { format, startOfMonth, addMonths } from 'date-fns';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const db = getFirestore(firebaseApp);
const auth = getAuth(firebaseApp);

const staffSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(2, 'Name is required.'),
  email: z.string().email('Valid email is required.'),
  password: z.string().min(6, 'Password must be at least 6 characters.').optional(),
  department: z.string().optional(),
});

const STAFF_MONTHLY_FEE = 50;

function StaffForm({ 
    staffMember, 
    onSubmit, 
    onCancel, 
    isLoading, 
    canAfford, 
    proRata, 
    departments 
}: { 
    staffMember: User | null, 
    onSubmit: (values: any) => void, 
    onCancel: () => void,
    isLoading: boolean,
    canAfford: boolean,
    proRata: number,
    departments: string[]
}) {
    const form = useForm<z.infer<typeof staffSchema>>({
        resolver: zodResolver(staffSchema),
        defaultValues: {
            id: staffMember?.id || '',
            name: staffMember?.name || '',
            email: staffMember?.email || '',
            password: '',
            department: staffMember?.department || '',
        },
    });

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField control={form.control} name="name" render={({ field }) => ( <FormItem><FormLabel>Full Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                <FormField control={form.control} name="email" render={({ field }) => ( <FormItem><FormLabel>Email Address</FormLabel><FormControl><Input type="email" {...field} disabled={!!staffMember} /></FormControl><FormMessage /></FormItem> )} />
                
                <FormField control={form.control} name="department" render={({ field }) => (
                    <FormItem>
                        <FormLabel>Department</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl><SelectTrigger><SelectValue placeholder="Select department..." /></SelectTrigger></FormControl>
                            <SelectContent>
                                {departments.map(dept => <SelectItem key={dept} value={dept}>{dept}</SelectItem>)}
                            </SelectContent>
                        </Select>
                        <FormMessage />
                    </FormItem>
                )} />

                {!staffMember && (
                    <>
                    <FormField control={form.control} name="password" render={({ field }) => ( <FormItem><FormLabel>Password</FormLabel><FormControl><Input type="password" {...field} /></FormControl><FormMessage /></FormItem> )} />
                    
                    <div className="p-4 bg-primary/5 rounded-lg border border-primary/10 space-y-2 text-sm mt-4">
                        <h4 className="font-bold text-primary text-xs uppercase tracking-wider mb-3">Billing Summary</h4>
                        <div className="flex justify-between items-center text-xs">
                            <span className="text-muted-foreground">Pro-rata billing (Today):</span>
                            <span className="font-semibold text-destructive">R{proRata.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between items-center text-xs">
                            <span className="text-muted-foreground">Monthly recurrence:</span>
                            <span className="font-semibold">R{STAFF_MONTHLY_FEE.toFixed(2)}</span>
                        </div>
                    </div>
                    </>
                )}

                <div className="flex justify-end gap-2 pt-4">
                    <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>
                    <Button type="submit" disabled={isLoading || (!staffMember && !canAfford)}>
                        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {staffMember ? 'Update Staff' : 'Confirm & Create Member'}
                    </Button>
                </div>
            </form>
        </Form>
    );
}

export default function PartnerStaffPage() {
  const [staff, setStaff] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDeptDialogOpen, setIsDeptDialogOpen] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState<User | null>(null);
  const [newDeptName, setNewDeptName] = useState('');
  const { toast } = useToast();
  const { user: currentUser, login } = useAuth();
  
  const partnerId = currentUser?.role === 'partner' ? currentUser.uid : currentUser?.partnerId;
  const partnerDepartments = currentUser?.departments || ['General'];

  const fetchStaff = async () => {
    if (!partnerId) return;
    setIsLoading(true);
    try {
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
  }, [partnerId]);

  const calculateProRata = () => {
    const now = new Date();
    const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const remainingDays = lastDayOfMonth - now.getDate() + 1;
    return parseFloat(((remainingDays / lastDayOfMonth) * STAFF_MONTHLY_FEE).toFixed(2));
  };

  const proRataAmount = calculateProRata();
  const canAffordStaff = (currentUser?.creditBalance || 0) >= proRataAmount;

  const handleFormSubmit = async (values: any) => {
    if (!partnerId) return;
    setIsLoading(true);

    try {
        if (values.id) {
            await updateDoc(doc(db, "users", values.id), { name: values.name, department: values.department });
            toast({ title: 'Staff Member Updated' });
        } else {
            if (!canAffordStaff) {
                toast({ title: 'Insufficient Credits', description: `Need R${proRataAmount} in wallet.`, variant: 'destructive' });
                return;
            }

            const userCredential = await createUserWithEmailAndPassword(auth, values.email, values.password!);
            const newUid = userCredential.user.uid;

            await setDoc(doc(db, "users", newUid), {
                id: newUid,
                uid: newUid,
                name: values.name,
                email: values.email,
                role: 'partner_staff',
                partnerId: partnerId,
                department: values.department,
                status: 'Active',
                createdAt: serverTimestamp(),
            });

            const partnerRef = doc(db, 'users', partnerId);
            await updateDoc(partnerRef, {
                creditBalance: increment(-proRataAmount),
                'subscription.monthlyTotal': increment(STAFF_MONTHLY_FEE),
                'subscription.subscriptionStatus': 'active',
            });

            toast({ title: 'Staff Member Added', description: `R${proRataAmount} pro-rata fee applied.` });
        }
        fetchStaff();
        setIsFormOpen(false);
    } catch (error: any) {
        toast({ title: 'Operation Failed', description: error.message, variant: 'destructive' });
    } finally {
        setIsLoading(false);
    }
  };

  const handleAddDept = async () => {
      if (!newDeptName.trim() || !partnerId) return;
      try {
          const partnerRef = doc(db, 'users', partnerId);
          await updateDoc(partnerRef, {
              departments: arrayUnion(newDeptName.trim())
          });
          toast({ title: 'Department Added' });
          setNewDeptName('');
      } catch (e) {
          toast({ title: 'Error adding department', variant: 'destructive' });
      }
  };

  const handleRemoveDept = async (dept: string) => {
      if (!partnerId) return;
      try {
          const partnerRef = doc(db, 'users', partnerId);
          await updateDoc(partnerRef, {
              departments: arrayRemove(dept)
          });
          toast({ title: 'Department Removed' });
      } catch (e) {
          toast({ title: 'Error removing department', variant: 'destructive' });
      }
  }

  const handleDelete = async (staffMember: User) => {
    try {
        if (!partnerId) return;
        await deleteDoc(doc(db, "users", staffMember.id));
        const partnerRef = doc(db, 'users', partnerId);
        await updateDoc(partnerRef, {
            'subscription.monthlyTotal': increment(-STAFF_MONTHLY_FEE)
        });
        fetchStaff();
        toast({ title: 'Staff Member Removed', variant: 'destructive' });
    } catch (error) {
        toast({ title: 'Error', description: 'Could not remove member.', variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
            <h1 className="text-3xl font-bold tracking-tight">Practice Team</h1>
            <p className="text-sm text-muted-foreground mt-1">Manage staff access and organizational structure.</p>
        </div>
        <div className="flex gap-2 w-full md:w-auto">
            <Dialog open={isDeptDialogOpen} onOpenChange={setIsDeptDialogOpen}>
                <DialogTrigger asChild>
                    <Button variant="outline" className="gap-2">
                        <Tags className="h-4 w-4" /> Manage Departments
                    </Button>
                </DialogTrigger>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Departments</DialogTitle>
                        <DialogDescription>Define your internal team categories.</DialogDescription>
                    </DialogHeader>
                    <div className="py-4 space-y-4">
                        <div className="flex gap-2">
                            <Input 
                                placeholder="e.g. Tax Support" 
                                value={newDeptName} 
                                onChange={(e) => setNewDeptName(e.target.value)} 
                            />
                            <Button onClick={handleAddDept} disabled={!newDeptName.trim()}><Plus className="h-4 w-4"/></Button>
                        </div>
                        <div className="space-y-2">
                            {partnerDepartments.map(dept => (
                                <div key={dept} className="flex justify-between items-center p-2 rounded border bg-muted/30">
                                    <span className="text-sm font-medium">{dept}</span>
                                    <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => handleRemoveDept(dept)}>
                                        <X className="h-4 w-4" />
                                    </Button>
                                </div>
                            ))}
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
                <DialogTrigger asChild>
                    <Button onClick={() => setSelectedStaff(null)} className="gap-2">
                        <PlusCircle className="h-4 w-4" /> Add Staff
                    </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                        <DialogTitle>{selectedStaff ? 'Edit Staff member' : 'Add Staff member'}</DialogTitle>
                    </DialogHeader>
                    <StaffForm 
                        staffMember={selectedStaff} 
                        onSubmit={handleFormSubmit}
                        onCancel={() => setIsFormOpen(false)}
                        isLoading={isLoading}
                        canAfford={canAffordStaff}
                        proRata={proRataAmount}
                        departments={partnerDepartments}
                    />
                </DialogContent>
            </Dialog>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Team Members</CardTitle>
          <CardDescription>Practice login accounts and their assigned departments.</CardDescription>
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
                  <TableHead>Department</TableHead>
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
                    <TableCell className="text-xs">{member.email}</TableCell>
                    <TableCell>
                        {member.department ? (
                            <Badge variant="outline" className="text-[10px] uppercase">{member.department}</Badge>
                        ) : (
                            <span className="text-xs text-muted-foreground italic">None</span>
                        )}
                    </TableCell>
                    <TableCell>
                        <Badge variant={member.role === 'partner' ? 'default' : 'secondary'} className="capitalize text-[10px]">
                            {member.role === 'partner' ? 'Practice Owner' : 'Staff'}
                        </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setSelectedStaff(member); setIsFormOpen(true); }}><Edit className="h-4 w-4" /></Button>
                            {member.role !== 'partner' && (
                                <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                        <Button variant="ghost" size="icon" className="text-destructive h-8 w-8"><Trash2 className="h-4 w-4" /></Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                        <AlertDialogHeader>
                                            <AlertDialogTitle>Remove Staff Member?</AlertDialogTitle>
                                            <AlertDialogDescription>Permanently delete access for {member.name}. Subscription billing will stop immediately.</AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                                            <AlertDialogAction onClick={() => handleDelete(member)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Remove Member</AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                            )}
                        </div>
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
