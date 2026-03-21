'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calculator, Loader2, FileText, ReceiptText, CheckCircle2, AlertCircle, ArrowRightLeft, CalendarClock, ChevronRight } from 'lucide-react';
import { getFirestore, collection, query, orderBy, onSnapshot, doc, getDoc, getDocs, where } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { Payslip, Employee, User } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format } from 'date-fns';
import { rollForwardPayrollAction } from '@/app/actions';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import PayslipEditor from '@/components/admin/PayslipEditor';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

const db = getFirestore(firebaseApp);

export default function PayslipsPage() {
  const params = useParams();
  const clientId = params.clientId as string;
  const { toast } = useToast();
  
  const [payslips, setPayslips] = useState<Payslip[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [client, setClient] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRolling, setIsRolling] = useState(false);

  // Editor states
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingPayslip, setEditingPayslip] = useState<Payslip | null>(null);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);

  useEffect(() => {
    if (!clientId) return;

    // Fetch client
    const unsubClient = onSnapshot(doc(db, 'aiPayrollClients', clientId), (snap) => {
        if (snap.exists()) setClient({ id: snap.id, ...snap.data() } as User);
    });

    // Fetch employees
    const empRef = collection(db, 'aiPayrollClients', clientId, 'employees');
    getDocs(empRef).then(snap => {
        setEmployees(snap.docs.map(d => ({ id: d.id, ...d.data() } as Employee)));
    });

    const payslipsRef = collection(db, 'aiPayrollClients', clientId, 'payslips');
    const q = query(payslipsRef, orderBy('createdAt', 'desc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetched = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Payslip));
      setPayslips(fetched);
      setIsLoading(false);
    }, (error) => {
      console.error("Error fetching payslips:", error);
      setIsLoading(false);
    });

    return () => {
        unsubscribe();
        unsubClient();
    };
  }, [clientId]);

  const handleRollForward = async () => {
    if (!client) return;
    setIsRolling(true);
    
    try {
        const res = await rollForwardPayrollAction({ clientId });
        if (res.success) {
            toast({ 
                title: "Month Rolled Forward", 
                description: `Successfully moved to ${res.nextPeriod}. Generated ${res.created} draft payslips.` 
            });
        } else {
            toast({ title: "Roll Forward Failed", description: res.error, variant: "destructive" });
        }
    } catch (e) {
        toast({ title: "Error", description: "Internal server error.", variant: "destructive" });
    } finally {
        setIsRolling(false);
    }
  };

  const handleEditPayslip = (payslip: Payslip) => {
      const employee = employees.find(e => e.id === payslip.employeeId);
      if (!employee) {
          toast({ title: "Employee Not Found", variant: "destructive" });
          return;
      }
      setEditingPayslip(payslip);
      setEditingEmployee(employee);
      setIsEditorOpen(true);
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-ZA', {
      style: 'currency',
      currency: 'ZAR',
    }).format(price);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Payroll Processing</h2>
          <p className="text-sm text-muted-foreground font-medium">Currently processing: <Badge className="ml-2 bg-primary font-black uppercase tracking-widest">{client?.firstProcessingMonth || 'N/A'}</Badge></p>
        </div>
        <div className="flex gap-2">
            <Button 
                variant="outline"
                className="font-bold border-primary/20 text-primary hover:bg-primary/5"
                onClick={handleRollForward}
                disabled={isRolling || isLoading}
            >
                {isRolling ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CalendarClock className="mr-2 h-4 w-4" />}
                Roll Forward to Next Month
            </Button>
        </div>
      </div>

      {/* Payslip Editor Dialog */}
      <Dialog open={isEditorOpen} onOpenChange={setIsEditorOpen}>
          <DialogContent className="sm:max-w-6xl p-0 overflow-hidden bg-[#F5F5F5]">
              <DialogHeader className="p-6 bg-white border-b">
                  <div className="flex justify-between items-center">
                      <div>
                        <DialogTitle className="flex items-center gap-2"><Calculator className="h-5 w-5 text-primary" /> Interactive Payslip Editor</DialogTitle>
                        <DialogDescription>Adjust earnings and deductions for the current period.</DialogDescription>
                      </div>
                      <Badge variant="outline" className="text-[10px] font-black uppercase tracking-widest bg-muted border-none px-3 py-1">Confidential Payroll Data</Badge>
                  </div>
              </DialogHeader>
              <div className="p-8">
                {editingPayslip && editingEmployee && client && (
                    <PayslipEditor 
                        payslip={editingPayslip} 
                        employee={editingEmployee} 
                        client={client} 
                        onSave={() => setIsEditorOpen(false)}
                    />
                )}
              </div>
          </DialogContent>
      </Dialog>

      <div className="grid grid-cols-1 gap-6">
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <div>
                    <CardTitle>Draft Payslips - {client?.firstProcessingMonth}</CardTitle>
                    <CardDescription>Review and finalize staff payments before issuing.</CardDescription>
                </div>
            </CardHeader>
            <CardContent className="p-0">
            {isLoading ? (
                <div className="flex justify-center py-12"><Loader2 className="animate-spin text-primary" /></div>
            ) : payslips.filter(p => p.period === client?.firstProcessingMonth).length === 0 ? (
                <div className="h-40 flex flex-col items-center justify-center border-2 border-dashed rounded-lg text-muted-foreground m-6 mt-0 p-8">
                    <ReceiptText className="h-10 w-10 opacity-20 mb-2" />
                    <p className="font-semibold text-sm">No draft payslips found for this period.</p>
                    <p className="text-xs">Add employees or roll forward to the next month to begin.</p>
                </div>
            ) : (
                <Table>
                <TableHeader>
                    <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead className="text-right">Gross Earnings</TableHead>
                    <TableHead className="text-right">Tax (PAYE)</TableHead>
                    <TableHead className="text-right">Net Pay</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {payslips.filter(p => p.period === client?.firstProcessingMonth).map((ps) => {
                        const tax = ps.deductions.find(d => d.label === 'Tax')?.amount || 0;
                        return (
                        <TableRow key={ps.id}>
                            <TableCell className="font-bold text-slate-900">{ps.employeeName}</TableCell>
                            <TableCell className="text-right font-mono text-xs">{formatPrice(ps.grossPay || 0)}</TableCell>
                            <TableCell className="text-right font-mono text-xs text-destructive">{formatPrice(tax)}</TableCell>
                            <TableCell className="text-right font-black text-primary font-mono">{formatPrice(ps.netPay)}</TableCell>
                            <TableCell className="text-right">
                                <Button variant="secondary" size="sm" className="font-bold" onClick={() => handleEditPayslip(ps)}>
                                    Edit Details <ChevronRight className="h-4 w-4 ml-1" />
                                </Button>
                            </TableCell>
                        </TableRow>
                    )})}
                </TableBody>
                </Table>
            )}
            </CardContent>
        </Card>

        <Card className="bg-muted/20">
            <CardHeader>
                <CardTitle className="text-sm">Historical Records</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
                <Table>
                    <TableHeader className="text-[10px] uppercase font-bold text-muted-foreground">
                        <TableRow>
                            <TableHead>Period</TableHead>
                            <TableHead>Employee</TableHead>
                            <TableHead className="text-right">Net Paid</TableHead>
                            <TableHead className="text-right">Date</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {payslips.filter(p => p.period !== client?.firstProcessingMonth).slice(0, 10).map((ps) => (
                            <TableRow key={ps.id} className="opacity-70 grayscale hover:grayscale-0 transition-all">
                                <TableCell className="text-xs font-bold">{ps.period}</TableCell>
                                <TableCell className="text-xs font-medium">{ps.employeeName}</TableCell>
                                <TableCell className="text-right text-xs font-mono">{formatPrice(ps.netPay)}</TableCell>
                                <TableCell className="text-right text-[10px]">{ps.date?.toDate ? format(ps.date.toDate(), 'dd MMM yy') : 'N/A'}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
      </div>
    </div>
  );
}
