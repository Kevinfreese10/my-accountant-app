
'use client';
import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { MoreHorizontal, Users, Loader2, Wallet2, Plus, Minus, CheckCircle2, Circle, Info } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { User } from '@/lib/types';
import { getFirestore, collection, getDocs, doc, deleteDoc, query, where, updateDoc, increment } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

const db = getFirestore(firebaseApp);

function ManualCreditDialog({ partner, onUpdate, open, onOpenChange }: { partner: User | null, onUpdate: () => void, open: boolean, onOpenChange: (open: boolean) => void }) {
    const [amount, setAmount] = useState<string>('');
    const [isProcessing, setIsProcessing] = useState(false);
    const { toast } = useToast();

    if (!partner) return null;

    const handleUpdateBalance = async (type: 'add' | 'deduct') => {
        const numericAmount = parseFloat(amount);
        if (isNaN(numericAmount) || numericAmount <= 0) {
            toast({ title: 'Invalid Amount', description: 'Please enter a positive numeric value.', variant: 'destructive' });
            return;
        }

        setIsProcessing(true);
        try {
            const finalAmount = type === 'add' ? numericAmount : -numericAmount;
            const userRef = doc(db, 'users', partner.uid);
            await updateDoc(userRef, {
                creditBalance: increment(finalAmount)
            });

            toast({ title: 'Balance Updated', description: `Successfully ${type === 'add' ? 'added' : 'deducted'} ${new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' }).format(numericAmount)}.` });
            onUpdate();
            onOpenChange(false);
            setAmount('');
        } catch (error) {
            console.error("Error updating credits:", error);
            toast({ title: 'Update Failed', variant: 'destructive' });
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Manage Credits: {partner.companyName || partner.name}</DialogTitle>
                    <DialogDescription>
                        Manually adjust the practice's credit balance. Current balance: <strong>{new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' }).format(partner.creditBalance || 0)}</strong>
                    </DialogDescription>
                </DialogHeader>
                <div className="py-4 space-y-4">
                    <div className="grid gap-2">
                        <Label htmlFor="adj-amount">Adjustment Amount (ZAR)</Label>
                        <Input 
                            id="adj-amount" 
                            type="number" 
                            placeholder="e.g. 500" 
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                        />
                    </div>
                </div>
                <DialogFooter className="grid grid-cols-2 gap-2">
                    <Button variant="outline" onClick={() => handleUpdateBalance('deduct')} disabled={isProcessing}>
                        <Minus className="mr-2 h-4 w-4" /> Deduct
                    </Button>
                    <Button onClick={() => handleUpdateBalance('add')} disabled={isProcessing}>
                        <Plus className="mr-2 h-4 w-4" /> Add Credits
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

export default function AdminPartnersPage() {
  const [partners, setPartners] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedPartnerForCredits, setSelectedPartnerForCredits] = useState<User | null>(null);
  const [isCreditDialogOpen, setIsCreditDialogOpen] = useState(false);
  const { toast } = useToast();

  const fetchPartners = async () => {
    setIsLoading(true);
    try {
        const q = query(collection(db, "users"), where('role', '==', 'partner'));
        const querySnapshot = await getDocs(q);
        const fetchedPartners = querySnapshot.docs.map(doc => ({ ...doc.data(), uid: doc.id } as User));
        setPartners(fetchedPartners);
    } catch (error) {
        console.error("Error fetching partners:", error);
        toast({ title: 'Error', description: 'Could not fetch partners from the database.', variant: 'destructive'});
    } finally {
        setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPartners();
  }, []);

  const getSetupChecklist = (p: User) => {
      return [
          { label: 'SMTP', done: !!(p.smtpDetails?.host && p.smtpDetails?.user) },
          { label: 'AI Key', done: !!p.geminiApiKey },
          { label: 'Bank Info', done: !!(p.bankingDetails?.bankName && p.bankingDetails?.accountNumber) },
          { label: 'Landing Page', done: !!(p.landingPage?.enabled && p.landingPage?.slug) },
          { label: 'Branding', done: p.landingPage?.themePreset !== 'custom' || p.landingPage?.primaryColor !== '#214392' },
          { label: 'Content', done: (p.landingPage?.aboutUs?.length || 0) > 50 },
      ];
  };

  const calculateProgress = (p: User) => {
      const list = getSetupChecklist(p);
      const completed = list.filter(i => i.done).length;
      return Math.round((completed / list.length) * 100);
  };

  const handleDelete = async (partnerId: string) => {
    try {
        await deleteDoc(doc(db, "users", partnerId));
        fetchPartners();
        toast({
            title: 'Partner Deleted',
            description: 'The partner has been removed from Firestore.',
            variant: 'destructive',
        });
    } catch (error) {
        console.error("Error deleting partner:", error);
        toast({ title: 'Error', description: 'Could not delete partner.', variant: 'destructive' });
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-ZA', {
      style: 'currency',
      currency: 'ZAR',
      minimumFractionDigits: price % 1 === 0 ? 0 : 2,
      maximumFractionDigits: 2,
    }).format(price);
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Manage Partners</h1>
         <Button asChild>
            <Link href="/partner-signup">
                Add New Partner
            </Link>
        </Button>
      </div>

      <ManualCreditDialog 
        partner={selectedPartnerForCredits}
        open={isCreditDialogOpen}
        onOpenChange={setIsCreditDialogOpen}
        onUpdate={fetchPartners}
      />

      <Card>
        <CardHeader>
          <CardTitle>All Partners</CardTitle>
          <CardDescription>View and manage all approved partner accounts and their setup progress.</CardDescription>
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
                <TableHead>Company Name</TableHead>
                <TableHead>Contact Person</TableHead>
                <TableHead>Setup Progress</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Wallet Balance</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {partners.map(partner => {
                const progress = calculateProgress(partner);
                const checklist = getSetupChecklist(partner);
                
                return (
                <TableRow key={partner.uid}>
                  <TableCell className="font-medium">{partner.companyName}</TableCell>
                  <TableCell>
                      <div className="flex flex-col">
                          <span>{partner.contactPerson}</span>
                          <span className="text-[10px] text-muted-foreground">{partner.email}</span>
                      </div>
                  </TableCell>
                  <TableCell className="w-[200px]">
                      <TooltipProvider>
                          <Tooltip>
                              <TooltipTrigger asChild>
                                  <div className="space-y-1.5 cursor-help">
                                      <div className="flex justify-between items-center text-[10px] font-bold text-muted-foreground uppercase">
                                          <span>Configuration</span>
                                          <span className={cn(progress === 100 ? "text-green-600" : "text-primary")}>{progress}%</span>
                                      </div>
                                      <Progress value={progress} className="h-1.5" />
                                  </div>
                              </TooltipTrigger>
                              <TooltipContent className="w-64 p-0 overflow-hidden" side="bottom">
                                  <div className="bg-muted/50 p-2 border-b text-[10px] font-black uppercase tracking-widest text-muted-foreground">Setup Checklist</div>
                                  <div className="p-2 space-y-1.5">
                                      {checklist.map((item, i) => (
                                          <div key={i} className="flex items-center gap-2 text-xs">
                                              {item.done ? <CheckCircle2 className="h-3 w-3 text-green-500" /> : <Circle className="h-3 w-3 text-muted-foreground opacity-30" />}
                                              <span className={cn(item.done ? "text-foreground" : "text-muted-foreground")}>{item.label}</span>
                                          </div>
                                      ))}
                                  </div>
                              </TooltipContent>
                          </Tooltip>
                      </TooltipProvider>
                  </TableCell>
                  <TableCell>
                      <Badge variant={partner.status === 'Active' ? 'success' : 'secondary'} className="text-[10px] uppercase font-bold">
                          {partner.status}
                      </Badge>
                  </TableCell>
                  <TableCell className="text-right font-mono font-bold text-primary">
                      {formatPrice(partner.creditBalance || 0)}
                  </TableCell>
                  <TableCell className="text-right">
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
                            <DropdownMenuItem onClick={() => { setSelectedPartnerForCredits(partner); setIsCreditDialogOpen(true); }}>
                                <Wallet2 className="mr-2 h-4 w-4" /> Manage Credits
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
                                This action cannot be undone. This will permanently delete the partner account for:
                                <span className="font-semibold"> {partner.companyName}</span>. This only removes them from Firestore.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter className="flex-col gap-4 sm:flex-row">
                                <Accordion type="single" collapsible className="w-full">
                                    <AccordionItem value="delete-warning" className="border-0">
                                        <AccordionTrigger className="text-destructive py-0 hover:no-underline font-semibold text-xs">Advanced Warning</AccordionTrigger>
                                        <AccordionContent className="pt-2 text-xs">
                                            Deleting this user profile does not remove their account from Firebase Authentication. You must manually remove them from the Firebase Console if you wish to prevent future logins.
                                        </AccordionContent>
                                    </AccordionItem>
                                </Accordion>
                                <div className="flex gap-2">
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => handleDelete(partner.uid)}>
                                        Continue
                                    </AlertDialogAction>
                                </div>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
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
