
'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calculator, Loader2, FileText, ReceiptText, CheckCircle2, AlertCircle } from 'lucide-react';
import { getFirestore, collection, query, orderBy, onSnapshot, doc, getDoc, getDocs, where } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { Payslip, Employee, User } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format } from 'date-fns';
import { runPayrollAction } from '@/app/actions';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import PayslipPreview from '@/components/admin/PayslipPreview';
import { Badge } from '@/components/ui/badge';

const db = getFirestore(firebaseApp);

export default function PayslipsPage() {
  const params = useParams();
  const clientId = params.clientId as string;
  const { toast } = useToast();
  
  const [payslips, setPayslips] = useState<Payslip[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [client, setClient] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRunning, setIsRunning] = useState(false);

  // Preview states
  const [isPayslipOpen, setIsPayslipOpen] = useState(false);
  const [viewingPayslip, setViewingPayslip] = useState<Payslip | null>(null);
  const [payslipEmployee, setPayslipEmployee] = useState<Employee | null>(null);

  useEffect(() => {
    if (!clientId) return;

    // Fetch client
    getDoc(doc(db, 'aiPayrollClients', clientId)).then(snap => {
        if (snap.exists()) setClient({ id: snap.id, ...snap.data() } as User);
    });

    // Fetch employees (needed for names in preview)
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

    return () => unsubscribe();
  }, [clientId]);

  const handleRunPayroll = async () => {
    if (!client) return;
    setIsRunning(true);
    toast({ title: "Running Payroll", description: `Processing payslips for ${client.firstProcessingMonth || 'current period'}...` });

    try {
        const res = await runPayrollAction({
            clientId,
            period: client.firstProcessingMonth || format(new Date(), 'MMMM yyyy')
        });

        if (res.success) {
            toast({ 
                title: "Payroll Complete", 
                description: `Generated ${res.created} new payslips. ${res.skipped} items were skipped (already processed).` 
            });
        } else {
            toast({ title: "Payroll Failed", description: res.error, variant: "destructive" });
        }
    } catch (e) {
        toast({ title: "Error", description: "Internal server error.", variant: "destructive" });
    } finally {
        setIsRunning(false);
    }
  };

  const handleViewPayslip = (payslip: Payslip) => {
      const employee = employees.find(e => e.id === payslip.employeeId);
      if (!employee) {
          toast({ title: "Employee Not Found", description: "Could not link payslip to employee record.", variant: "destructive" });
          return;
      }
      setViewingPayslip(payslip);
      setPayslipEmployee(employee);
      setIsPayslipOpen(true);
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
          <h2 className="text-xl font-bold text-slate-900">Payslips</h2>
          <p className="text-sm text-muted-foreground">Generate and manage employee earnings and deductions.</p>
        </div>
        <Button 
            className="bg-primary hover:bg-primary/90 font-bold"
            onClick={handleRunPayroll}
            disabled={isRunning || isLoading}
        >
          {isRunning ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Calculator className="mr-2 h-4 w-4" />}
          Run Payroll
        </Button>
      </div>

      <Dialog open={isPayslipOpen} onOpenChange={setIsPayslipOpen}>
          <DialogContent className="sm:max-w-4xl p-0 overflow-hidden">
              <DialogHeader className="p-6 pb-0">
                  <DialogTitle className="flex items-center gap-2"><ReceiptText className="h-5 w-5 text-primary" /> Payslip Record</DialogTitle>
                  <DialogDescription>Official payroll document for {payslipEmployee?.name} {payslipEmployee?.surname}.</DialogDescription>
              </DialogHeader>
              <div className="p-6">
                {viewingPayslip && payslipEmployee && client && (
                    <PayslipPreview payslip={viewingPayslip} employee={payslipEmployee} client={client} />
                )}
              </div>
          </DialogContent>
      </Dialog>

      <Card>
        <CardHeader>
          <CardTitle>Payroll History</CardTitle>
          <CardDescription>A record of all processed payslips for this client.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="animate-spin text-primary" /></div>
          ) : payslips.length === 0 ? (
            <div className="h-60 flex flex-col items-center justify-center border-2 border-dashed rounded-lg text-muted-foreground m-6 mt-0 p-8">
              <ReceiptText className="h-12 w-12 opacity-20 mb-4" />
              <p className="font-semibold text-slate-900">No payroll runs found.</p>
              <p className="text-sm">Start by running payroll for the current period.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Period</TableHead>
                  <TableHead className="text-right">Gross Pay</TableHead>
                  <TableHead className="text-right">Net Pay</TableHead>
                  <TableHead className="text-right">Processed</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payslips.map((ps) => (
                  <TableRow key={ps.id}>
                    <TableCell className="font-bold text-slate-900">{ps.employeeName}</TableCell>
                    <TableCell>
                        <Badge variant="secondary" className="text-[10px] font-bold uppercase">{ps.period}</Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs">{formatPrice(ps.earnings.basic)}</TableCell>
                    <TableCell className="text-right font-bold text-primary font-mono">{formatPrice(ps.netPay)}</TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground">
                        {ps.date?.toDate ? format(ps.date.toDate(), 'dd MMM yyyy') : 'N/A'}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => handleViewPayslip(ps)}>
                        <FileText className="h-4 w-4 mr-2" /> View
                      </Button>
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
