'use client';

import { useState, useEffect, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calculator, Loader2, FileText, ReceiptText, CheckCircle2, AlertCircle, ArrowRightLeft, CalendarClock, ChevronRight, RotateCcw, History, Filter } from 'lucide-react';
import { getFirestore, collection, query, orderBy, onSnapshot, doc, getDoc, getDocs, where, limit } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { Payslip, Employee, User } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format } from 'date-fns';
import { rollForwardPayrollAction, rollBackPayrollAction, generateEmployeePayslipAction } from '@/app/actions';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import PayslipEditor from '@/components/admin/PayslipEditor';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PayrollService } from '@/services/PayrollService';

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
  const [isRollingBack, setIsRollingBack] = useState(false);
  const [historyFilter, setHistoryFilter] = useState<string>('all');

  // Editor states
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingPayslip, setEditingPayslip] = useState<Payslip | null>(null);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [isFetchingPayslip, setIsFetchingPayslip] = useState(false);

  useEffect(() => {
    if (!clientId) return;

    // Fetch client
    const unsubClient = onSnapshot(doc(db, 'aiPayrollClients', clientId), (snap) => {
        if (snap.exists()) setClient({ id: snap.id, ...snap.data() } as User);
    });

    // Fetch employees
    const empRef = collection(db, 'aiPayrollClients', clientId, 'employees');
    const unsubEmp = onSnapshot(empRef, (snap) => {
        setEmployees(snap.docs.map(d => ({ id: d.id, ...d.data() } as Employee)));
    });

    // Fetch payslips
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
        unsubEmp();
    };
  }, [clientId]);

  // Derived data: Map active employees to their current period payslip
  const activeEmployeesWithPayslips = useMemo(() => {
      const active = employees.filter(e => e.status === 'Active');
      const basePeriod = client?.firstProcessingMonth || '';
      
      return active.map(emp => {
          const ps = payslips.find(p => 
            p.employeeId === emp.id && 
            (p.period === basePeriod || (p.period && p.period.startsWith(`${basePeriod} -`)))
          );
          
          return {
              employee: emp,
              payslip: ps || null
          };
      });
  }, [employees, payslips, client?.firstProcessingMonth]);

  const filteredHistory = useMemo(() => {
      const currentPeriod = client?.firstProcessingMonth;
      return payslips
        .filter(p => 
            p.status === 'finalized' && 
            p.period !== currentPeriod && 
            (historyFilter === 'all' || p.employeeId === historyFilter)
        )
        .sort((a, b) => {
            const dateA = a.date?.toDate ? a.date.toDate().getTime() : new Date(a.date || 0).getTime();
            const dateB = b.date?.toDate ? b.date.toDate().getTime() : new Date(b.date || 0).getTime();
            return dateB - dateA;
        })
        .slice(0, 10);
  }, [payslips, client?.firstProcessingMonth, historyFilter]);

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

  const handleRollBack = async () => {
    if (!client) return;
    setIsRollingBack(true);
    
    try {
        const res = await rollBackPayrollAction({ clientId });
        if (res.success) {
            toast({ 
                title: "Month Rolled Back", 
                description: `Successfully moved back to ${res.prevPeriod}. Deleted ${res.deletedCount} draft records.` 
            });
        } else {
            toast({ title: "Roll Back Failed", description: res.error, variant: "destructive" });
        }
    } catch (e) {
        toast({ title: "Error", description: "Internal server error.", variant: "destructive" });
    } finally {
        setIsRollingBack(false);
    }
  };

  const handleEditDetails = async (employee: Employee, existingPayslip: Payslip | null) => {
      setIsFetchingPayslip(true);
      setEditingEmployee(employee);
      
      const periodLabel = client?.firstProcessingMonth || format(new Date(), 'MMMM yyyy');

      try {
          if (existingPayslip) {
              setEditingPayslip(existingPayslip);
          } else {
              const payslipsRef = collection(db, 'aiPayrollClients', clientId, 'payslips');
              const q = query(
                  payslipsRef, 
                  where('employeeId', '==', employee.id), 
                  where('period', '>=', periodLabel), 
                  where('period', '<=', `${periodLabel}\uf8ff`),
                  limit(1)
              );
              
              const snap = await getDocs(q);
              if (!snap.empty) {
                  const data = snap.docs[0].data();
                  setEditingPayslip({ id: snap.docs[0].id, ...data } as Payslip);
              } else {
                  const baseValue = employee.payType === 'Hourly' ? (employee.hourlyRate || 0) : (employee.basicSalary || 0);
                  const res = await generateEmployeePayslipAction({
                      clientId,
                      employeeId: employee.id,
                      basicSalary: baseValue
                  });
                  
                  if (res.success && res.id) {
                      const newSnap = await getDoc(doc(db, 'aiPayrollClients', clientId, 'payslips', res.id));
                      if (newSnap.exists()) {
                          setEditingPayslip({ id: newSnap.id, ...newSnap.data() } as Payslip);
                      }
                  } else {
                      const frequencyLabel = 'Monthly';
                      const freqNum = 12;
                      
                      const initialEarnings = PayrollService.calculateEarningsList(employee, baseValue, periodLabel, freqNum);
                      const initialGross = initialEarnings.reduce((s, i) => s + i.amount, 0);

                      const stub: Payslip = {
                          id: 'new',
                          employeeId: employee.id,
                          employeeName: `${employee.name} ${employee.surname}`,
                          period: periodLabel,
                          date: new Date().toISOString() as any,
                          earnings: initialEarnings,
                          deductions: PayrollService.getInitialDeductions(initialGross, periodLabel, freqNum),
                          contributions: PayrollService.getInitialContributions(initialGross, periodLabel, freqNum, !!client?.excludeSdl),
                          fringeBenefits: [],
                          grossPay: initialGross,
                          totalDeductions: 0,
                          netPay: 0,
                          frequency: 'Monthly',
                          status: 'draft'
                      };
                      setEditingPayslip(stub);
                  }
              }
          }
          setIsEditorOpen(true);
      } catch (error) {
          console.error("Error fetching payslip:", error);
          toast({ title: "Error", description: "Failed to load payslip data.", variant: "destructive" });
      } finally {
          setIsFetchingPayslip(false);
      }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-ZA', {
      style: 'currency',
      currency: 'ZAR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(price);
  };

  const safeFormatDate = (date: any): string => {
    if (!date) return 'N/A';
    try {
        const d = date?.toDate ? date.toDate() : new Date(date);
        return isNaN(d.getTime()) ? 'N/A' : format(d, 'dd MMM yy');
    } catch (e) {
        return 'N/A';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Payroll Processing</h2>
          <p className="text-sm text-muted-foreground font-medium">Review and adjust staff payments for the active cycle.</p>
        </div>
        <div className="flex gap-2">
            <AlertDialog>
                <AlertDialogTrigger asChild>
                    <Button 
                        variant="outline"
                        className="font-bold border-destructive/20 text-destructive hover:bg-destructive/5"
                        disabled={isRollingBack || isLoading}
                    >
                        {isRollingBack ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RotateCcw className="mr-2 h-4 w-4" />}
                        Roll Back Period
                    </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will return the system to the previous month and **PERMANENTLY DELETE** all payslips and changes made in the current period ({client?.firstProcessingMonth}). This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleRollBack} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                            Confirm Roll Back
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

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
              <div className="p-8 overflow-y-auto max-h-[80vh]">
                {editingPayslip && editingEmployee && client && (
                    <PayslipEditor 
                        payslip={editingPayslip} 
                        employee={editingEmployee} 
                        client={client} 
                        allPayslips={payslips}
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
                    <CardDescription>Review and finalize staff payments for all active employees.</CardDescription>
                </div>
            </CardHeader>
            <CardContent className="p-0">
            {isLoading ? (
                <div className="flex justify-center py-12"><Loader2 className="animate-spin text-primary" /></div>
            ) : activeEmployeesWithPayslips.length === 0 ? (
                <div className="h-40 flex flex-col items-center justify-center border-2 border-dashed rounded-lg text-muted-foreground m-6 mt-0 p-8">
                    <ReceiptText className="h-10 w-10 opacity-20 mb-2" />
                    <p className="font-semibold text-sm">No active employees found.</p>
                    <p className="text-xs">Add active employees to begin processing the current cycle.</p>
                </div>
            ) : (
                <Table>
                <TableHeader>
                    <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead className="text-right">Gross Earnings</TableHead>
                    <TableHead className="text-right">Tax (PAYE)</TableHead>
                    <TableHead className="text-right">Net Pay</TableHead>
                    <TableHead className="text-right">Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {activeEmployeesWithPayslips.map((row) => {
                        const { employee, payslip } = row;
                        
                        let displayGross = 0;
                        let displayTax = 0;
                        let displayNet = 0;

                        if (payslip) {
                            displayGross = payslip.grossPay;
                            displayTax = payslip.deductions.find(d => d.label === 'Tax')?.amount || 0;
                            displayNet = payslip.netPay;
                        } else {
                            const frequency = 12;
                            const period = client?.firstProcessingMonth;
                            const baseValue = employee.payType === 'Hourly' ? (employee.hourlyRate || 0) * 160 : (employee.basicSalary || 0);
                            
                            displayGross = employee.isNetSalary ? PayrollService.calculateGrossFromNet(baseValue, period, frequency) : baseValue;
                            displayTax = PayrollService.calculatePaye(displayGross, period, frequency);
                            displayNet = displayGross - displayTax - PayrollService.calculateUif(displayGross, period, frequency);
                        }

                        const isProcessing = isFetchingPayslip && editingEmployee?.id === employee.id;

                        return (
                        <TableRow key={employee.id}>
                            <TableCell className="font-bold text-slate-900">
                                <div className="flex flex-col">
                                    <span>{employee.name} {employee.surname}</span>
                                    <span className="text-[10px] text-muted-foreground font-mono uppercase">{employee.employeeCode}</span>
                                </div>
                            </TableCell>
                            <TableCell className="text-right font-mono text-xs">
                                {formatPrice(displayGross)}
                            </TableCell>
                            <TableCell className="text-right font-mono text-xs text-destructive">
                                {formatPrice(displayTax)}
                            </TableCell>
                            <TableCell className="text-right font-black text-primary font-mono">
                                {formatPrice(displayNet)}
                            </TableCell>
                            <TableCell className="text-right">
                                {payslip?.status === 'finalized' ? (
                                    <Badge variant="success" className="text-[9px] uppercase font-bold px-2 py-0.5">Finalized</Badge>
                                ) : (
                                    <Badge variant="secondary" className="text-[9px] uppercase font-bold px-2 py-0.5 opacity-50">Pending</Badge>
                                )}
                            </TableCell>
                            <TableCell className="text-right">
                                <Button 
                                    variant="secondary" 
                                    size="sm" 
                                    className="font-bold" 
                                    onClick={() => handleEditDetails(employee, payslip)}
                                    disabled={isProcessing}
                                >
                                    {isProcessing ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
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
            <CardHeader className="flex flex-row items-center justify-between pb-4">
                <div>
                    <CardTitle className="text-sm flex items-center gap-2">
                        <History className="h-4 w-4 text-primary" />
                        Historical Records
                    </CardTitle>
                    <CardDescription className="text-[10px]">Previously finalized runs for the practice.</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                    <Filter className="h-3 w-3 text-muted-foreground" />
                    <Select value={historyFilter} onValueChange={setHistoryFilter}>
                        <SelectTrigger className="h-8 text-[10px] w-[180px] bg-white">
                            <SelectValue placeholder="Filter by Employee" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Employees</SelectItem>
                            {employees.map(emp => (
                                <SelectItem key={emp.id} value={emp.id}>{emp.name} {emp.surname}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </CardHeader>
            <CardContent className="p-0">
                <Table>
                    <TableHeader className="text-[10px] uppercase font-bold text-muted-foreground bg-muted/30">
                        <TableRow>
                            <TableHead>Period</TableHead>
                            <TableHead>Employee</TableHead>
                            <TableHead className="text-right">Net Paid</TableHead>
                            <TableHead className="text-right">Date</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredHistory.map((ps) => (
                            <TableRow key={ps.id} className="opacity-70 grayscale hover:grayscale-0 transition-all">
                                <TableCell className="text-xs font-bold">{ps.period || 'N/A'}</TableCell>
                                <TableCell className="text-xs font-medium">{ps.employeeName || 'Unknown Employee'}</TableCell>
                                <TableCell className="text-right text-xs font-black text-primary font-mono">{formatPrice(ps.netPay)}</TableCell>
                                <TableCell className="text-right text-[10px] font-medium">{safeFormatDate(ps.date)}</TableCell>
                            </TableRow>
                        ))}
                        {filteredHistory.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={4} className="text-center py-12 text-muted-foreground italic text-xs">
                                    No finalized historical records found for the selected criteria.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
      </div>
    </div>
  );
}
