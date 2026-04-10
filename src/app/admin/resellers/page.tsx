'use client';
import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { MoreHorizontal, Users, Loader2, Wallet2, Plus, Minus, CheckCircle2, Circle, Info, FileText, Download, Briefcase, GraduationCap, Globe, Mail, ExternalLink, XCircle, Settings, Wrench } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { User, Service } from '@/lib/types';
import { getFirestore, collection, getDocs, doc, deleteDoc, query, where, updateDoc, increment, orderBy, onSnapshot } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAuth } from '@/contexts/AuthContext';
import { sendEmail } from '@/lib/email';
import PartnerProfile from '@/components/partner/PartnerProfile';

const db = getFirestore(firebaseApp);

function PartnerProfileDialog({ 
    partner, 
    allServices, 
    open, 
    onOpenChange 
}: { 
    partner: User | null, 
    allServices: Service[], 
    open: boolean, 
    onOpenChange: (open: boolean) => void 
}) {
    if (!partner) return null;

    const expertise = partner.capableServices?.map(id => allServices.find(s => s.id === id)?.title).filter(Boolean) || [];

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
                <DialogHeader className="p-6 bg-primary/5 border-b">
                    <div className="flex justify-between items-start">
                        <div>
                            <DialogTitle className="text-2xl font-bold">{partner.companyName || partner.name}</DialogTitle>
                            <DialogDescription>Professional Practice Profile</DialogDescription>
                        </div>
                        <Badge variant={partner.status === 'Active' ? 'success' : 'secondary'} className="uppercase font-bold">
                            {partner.status}
                        </Badge>
                    </div>
                </DialogHeader>
                
                <ScrollArea className="flex-grow p-6">
                    <div className="space-y-8 pb-4">
                        <section className="space-y-4">
                            <div className="flex items-center gap-2 text-primary font-bold uppercase text-[10px] tracking-widest">
                                <Briefcase className="h-3.5 w-3.5" /> Outsourcing Application
                            </div>
                            <div className={cn(
                                "p-4 rounded-xl border flex items-start gap-4",
                                partner.wantsOutsourcedWork ? "bg-green-50 border-green-100" : "bg-muted border-muted"
                            )}>
                                <div className={cn(
                                    "h-10 w-10 rounded-full flex items-center justify-center shrink-0",
                                    partner.wantsOutsourcedWork ? "bg-green-100 text-green-600" : "bg-slate-200 text-slate-400"
                                )}>
                                    {partner.wantsOutsourcedWork ? <CheckCircle2 className="h-6 w-6" /> : <XCircle className="h-6 w-6" />}
                                </div>
                                <div className="space-y-1">
                                    <p className="font-bold text-sm">
                                        {partner.wantsOutsourcedWork ? 'Applied for Overflow Program' : 'Internal Management Only'}
                                    </p>
                                    <p className="text-xs text-muted-foreground leading-relaxed">
                                        {partner.wantsOutsourcedWork 
                                            ? 'This practice is seeking outsourced work from the My Accountant network.' 
                                            : 'This practice only uses the platform to manage their own clients.'}
                                    </p>
                                </div>
                            </div>
                        </section>

                        {partner.wantsOutsourcedWork && (
                            <section className="space-y-4">
                                <div className="flex items-center gap-2 text-primary font-bold uppercase text-[10px] tracking-widest">
                                    <FileText className="h-3.5 w-3.5" /> Compliance Documents
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <Card className="shadow-sm border-dashed">
                                        <CardContent className="p-4 flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className="h-8 w-8 bg-blue-50 text-blue-600 rounded flex items-center justify-center"><FileText className="h-4 w-4" /></div>
                                                <span className="text-xs font-semibold">Professional CV</span>
                                            </div>
                                            {partner.cvUrl ? (
                                                <Button size="xs" variant="outline" className="h-7" asChild>
                                                    <a href={partner.cvUrl} target="_blank" rel="noopener noreferrer"><Download className="h-3 w-3 mr-1" /> View</a>
                                                </Button>
                                            ) : <Badge variant="secondary" className="text-[10px] opacity-50">Missing</Badge>}
                                        </CardContent>
                                    </Card>
                                    <Card className="shadow-sm border-dashed">
                                        <CardContent className="p-4 flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className="h-8 w-8 bg-purple-50 text-purple-600 rounded flex items-center justify-center"><GraduationCap className="h-4 w-4" /></div>
                                                <span className="text-xs font-semibold">Certificates</span>
                                            </div>
                                            {partner.certificateUrl ? (
                                                <Button size="xs" variant="outline" className="h-7" asChild>
                                                    <a href={partner.certificateUrl} target="_blank" rel="noopener noreferrer"><Download className="h-3 w-3 mr-1" /> View</a>
                                                </Button>
                                            ) : <Badge variant="secondary" className="text-[10px] opacity-50">Missing</Badge>}
                                        </CardContent>
                                    </Card>
                                </div>
                            </section>
                        )}

                        {expertise.length > 0 && (
                            <section className="space-y-4">
                                <div className="flex items-center gap-2 text-primary font-bold uppercase text-[10px] tracking-widest">
                                    <Globe className="h-3.5 w-3.5" /> Capabilities & Expertise
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {expertise.map((item, idx) => (
                                        <Badge key={idx} variant="outline" className="bg-slate-50 text-slate-700 border-slate-200">
                                            {item}
                                        </Badge>
                                    ))}
                                </div>
                            </section>
                        )}

                        <Separator />

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <section className="space-y-3">
                                <h4 className="text-xs font-black uppercase text-muted-foreground tracking-widest">Contact Details</h4>
                                <div className="space-y-2 text-sm">
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Owner:</span>
                                        <span className="font-semibold">{partner.contactPerson || partner.name}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Email:</span>
                                        <span className="font-semibold">{partner.email}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Cell:</span>
                                        <span className="font-semibold">{partner.contactNumber || 'N/A'}</span>
                                    </div>
                                </div>
                            </section>
                            <section className="space-y-3">
                                <h4 className="text-xs font-black uppercase text-muted-foreground tracking-widest">Banking (For Payouts)</h4>
                                <div className="space-y-2 text-sm">
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Bank:</span>
                                        <span className="font-semibold">{partner.bankingDetails?.bankName || 'N/A'}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Account:</span>
                                        <span className="font-semibold">{partner.bankingDetails?.accountNumber || 'N/A'}</span>
                                    </div>
                                </div>
                            </section>
                        </div>
                    </div>
                </ScrollArea>
                
                <DialogFooter className="p-6 border-t bg-muted/30">
                    <Button variant="ghost" onClick={() => onOpenChange(false)}>Close Profile</Button>
                    {partner.landingPage?.slug && (
                        <Button asChild className="gap-2">
                            <Link href={`/p/${partner.landingPage.slug}`} target="_blank">
                                View Landing Page <ExternalLink className="h-4 w-4" />
                            </Link>
                        </Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

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
  const [allServices, setAllServices] = useState<Service[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedPartnerForCredits, setSelectedPartnerForCredits] = useState<User | null>(null);
  const [selectedPartnerForProfile, setSelectedPartnerForProfile] = useState<User | null>(null);
  const [selectedPartnerForConfiguration, setSelectedPartnerForConfiguration] = useState<User | null>(null);
  const [isCreditDialogOpen, setIsCreditDialogOpen] = useState(false);
  const [isProfileDialogOpen, setIsProfileDialogOpen] = useState(false);
  const [isConfigDialogOpen, setIsConfigDialogOpen] = useState(false);
  const { toast } = useToast();
  const { user: currentUser } = useAuth();

  const fetchInitialData = async () => {
    setIsLoading(true);
    try {
        const partnerQuery = query(collection(db, "users"), where('role', '==', 'partner'));
        const servicesQuery = query(collection(db, "services"));
        
        const [partnerSnap, servicesSnap] = await Promise.all([
            getDocs(partnerQuery),
            getDocs(servicesQuery)
        ]);

        setPartners(partnerSnap.docs.map(doc => ({ ...doc.data(), uid: doc.id, id: doc.id } as User)));
        setAllServices(servicesSnap.docs.map(doc => ({ ...doc.data(), id: doc.id } as Service)));
    } catch (error) {
        console.error("Error fetching admin data:", error);
        toast({ title: 'Error', description: 'Could not load practice records.', variant: 'destructive'});
    } finally {
        setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchInitialData();
  }, []);

  const handleSendAssistanceEmail = async (partner: User) => {
    if (!currentUser) return;
    
    toast({ title: 'Sending...', description: `Drafting assistance offer for ${partner.email}.` });
    
    try {
        await sendEmail({
            to: partner.email,
            subject: `Do you need assistance with your ${partner.companyName || 'practice'} setup?`,
            html: `
                <div style="font-family: sans-serif; line-height: 1.6; color: #333;">
                    <p>Hi ${partner.contactPerson?.split(' ')[0] || partner.name.split(' ')[0]},</p>
                    <p>I hope you're having a great week.</p>
                    <p>I noticed that your practice setup on the My Accountant BEI platform isn't quite complete yet. I'm reaching out to see if you need any assistance with the configuration, such as setting up your practice banking details or customizing your landing page content.</p>
                    <p>Our goal is to make sure you have everything you need to start scaling your firm efficiently. If you have any questions, please feel free to reply to this email.</p>
                    <br/>
                    <p>Regards,</p>
                    <p><strong>${currentUser.name}</strong><br/>My Accountant Support Team</p>
                </div>
            `,
            replyTo: currentUser.email,
        });
        toast({ title: 'Email Sent', description: `Assistance offer sent to ${partner.email}.` });
    } catch (error) {
        console.error("Failed to send assistance email:", error);
        toast({ title: 'Email Failed', description: 'Could not send the assistance email.', variant: 'destructive' });
    }
  };

  const handleDelete = async (partnerId: string) => {
    try {
        await deleteDoc(doc(db, "users", partnerId));
        fetchInitialData();
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
        onUpdate={fetchInitialData}
      />

      <PartnerProfileDialog 
        partner={selectedPartnerForProfile}
        allServices={allServices}
        open={isProfileDialogOpen}
        onOpenChange={setIsProfileDialogOpen}
      />

      {/* Admin Full Practice Configuration Modal */}
      <Dialog open={isConfigDialogOpen} onOpenChange={setIsConfigDialogOpen}>
          <DialogContent className="sm:max-w-5xl max-h-[90vh] flex flex-col p-0">
              <DialogHeader className="p-6 bg-slate-900 text-white border-b border-slate-800">
                  <DialogTitle className="text-xl flex items-center gap-2">
                      <Wrench className="h-5 w-5 text-primary" />
                      Configure Practice Settings: {selectedPartnerForConfiguration?.companyName}
                  </DialogTitle>
                  <DialogDescription className="text-slate-400">
                      Manage branding, banking, and landing page details on behalf of this partner.
                  </DialogDescription>
              </DialogHeader>
              <ScrollArea className="flex-grow p-6 bg-slate-50">
                  {selectedPartnerForConfiguration && (
                      <PartnerProfile partner={selectedPartnerForConfiguration} />
                  )}
              </ScrollArea>
              <DialogFooter className="p-4 border-t bg-white">
                  <Button variant="ghost" onClick={() => setIsConfigDialogOpen(false)}>Close Editor</Button>
              </DialogFooter>
          </DialogContent>
      </Dialog>

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
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Wallet Balance</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {partners.map(partner => (
                <TableRow key={partner.uid}>
                  <TableCell className="font-medium">{partner.companyName}</TableCell>
                  <TableCell>
                      <div className="flex flex-col">
                          <span>{partner.contactPerson || partner.name}</span>
                          <span className="text-[10px] text-muted-foreground">{partner.email}</span>
                      </div>
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
                            <DropdownMenuLabel>Management</DropdownMenuLabel>
                            <DropdownMenuItem onClick={() => { setSelectedPartnerForConfiguration(partner); setIsConfigDialogOpen(true); }}>
                                <Wrench className="mr-2 h-4 w-4" /> Configure Practice
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => { setSelectedPartnerForProfile(partner); setIsProfileDialogOpen(true); }}>
                                <FileText className="mr-2 h-4 w-4" /> View Profile & Docs
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleSendAssistanceEmail(partner)}>
                                <Mail className="mr-2 h-4 w-4" /> Send Assistance Email
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => { setSelectedPartnerForCredits(partner); setIsCreditDialogOpen(true); }}>
                                <Wallet2 className="mr-2 h-4 w-4" /> Manage Credits
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                             <AlertDialogTrigger asChild>
                                <DropdownMenuItem className="text-destructive">
                                    Delete Partner
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
                            <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDelete(partner.uid)}>
                                    Continue
                                </AlertDialogAction>
                            </AlertDialogFooter>
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
