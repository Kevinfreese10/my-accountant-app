'use client';

import { useState, useEffect, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { getFirestore, collection, onSnapshot, doc } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Users, Banknote, CalendarCheck, TrendingUp, Loader2, UserPlus, ArrowRight } from 'lucide-react';
import { Employee, Payslip, User } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';

const db = getFirestore(firebaseApp);

export default function PayrollDashboardPage() {
  const params = useParams();
  const clientId = params.clientId as string;
  
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [payslips, setPayslips] = useState<Payslip[]>([]);
  const [client, setClient] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!clientId) return;

    // Fetch client to know the active period
    const unsubClient = onSnapshot(doc(db, 'aiPayrollClients', clientId), (snap) => {
        if (snap.exists()) setClient({ id: snap.id, ...snap.data() } as User);
    });

    // Fetch employees
    const unsubEmployees = onSnapshot(collection(db, 'aiPayrollClients', clientId, 'employees'), (snap) => {
        setEmployees(snap.docs.map(d => ({ id: d.id, ...d.data() } as Employee)));
    });

    // Fetch payslips
    const unsubPayslips = onSnapshot(collection(db, 'aiPayrollClients', clientId, 'payslips'), (snap) => {
        setPayslips(snap.docs.map(d => ({ id: d.id, ...d.data() } as Payslip)));
        setIsLoading(false);
    });

    return () => {
        unsubClient();
        unsubEmployees();
        unsubPayslips();
    };
  }, [clientId]);

  const stats = useMemo(() => {
    const activeEmployees = employees.filter(e => e.status === 'Active').length;
    
    // Sort periods by creation date to find the "last" one
    const sortedPayslips = [...payslips].sort((a, b) => {
        const dateA = a.date?.toDate ? a.date.toDate().getTime() : 0;
        const dateB = b.date?.toDate ? b.date.toDate().getTime() : 0;
        return dateB - dateA;
    });

    const lastPeriod = sortedPayslips[0]?.period || null;
    const lastPayrollAmount = lastPeriod 
        ? payslips.filter(p => p.period === lastPeriod).reduce((sum, p) => sum + (p.netPay || 0), 0)
        : 0;

    return {
        activeEmployees,
        lastPayrollAmount,
        lastPeriod
    };
  }, [employees, payslips]);

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-ZA', {
      style: 'currency',
      currency: 'ZAR',
    }).format(price);
  };

  if (isLoading) return <div className="flex justify-center py-20"><Loader2 className="animate-spin h-8 w-8 text-primary" /></div>;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="border-2 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Total Employees</CardTitle>
            <Users className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-slate-900">{stats.activeEmployees}</div>
            <p className="text-[10px] font-medium text-muted-foreground uppercase mt-1">Active staff members</p>
          </CardContent>
        </Card>

        <Card className="border-2 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Last Payroll Total</CardTitle>
            <Banknote className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-slate-900">{formatPrice(stats.lastPayrollAmount)}</div>
            <p className="text-[10px] font-medium text-muted-foreground uppercase mt-1">
              {stats.lastPeriod ? `Total Net Pay for ${stats.lastPeriod}` : 'No processed payroll yet'}
            </p>
          </CardContent>
        </Card>

        <Card className="border-2 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Pending Leave</CardTitle>
            <CalendarCheck className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-slate-900">0</div>
            <p className="text-[10px] font-medium text-muted-foreground uppercase mt-1">Requests awaiting approval</p>
          </CardContent>
        </Card>

        <Card className="border-2 shadow-sm bg-primary/5">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-bold uppercase tracking-wider text-primary">Compliance Status</CardTitle>
            <TrendingUp className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-primary">Ready</div>
            <p className="text-[10px] font-medium text-primary/70 uppercase mt-1">SARS/UIF Reporting active</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Welcome to AI Payroll</CardTitle>
            <CardDescription>
                Everything you need to manage your workforce for <strong>{client?.name}</strong>.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl border-2 border-dashed flex flex-col items-center justify-center text-center space-y-2 group hover:border-primary/50 transition-colors">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-colors">
                        <UserPlus className="h-5 w-5" />
                    </div>
                    <div className="space-y-1">
                        <p className="font-bold text-sm">Expand Workforce</p>
                        <p className="text-xs text-muted-foreground">Add new staff members and setup their salaries.</p>
                    </div>
                    <Button variant="link" asChild className="h-auto p-0 text-xs font-bold">
                        <Link href={`/admin/ai-payroll/${clientId}/employees`}>Add Employee <ArrowRight className="ml-1 h-3 w-3" /></Link>
                    </Button>
                </div>

                <div className="p-4 rounded-xl border-2 border-dashed flex flex-col items-center justify-center text-center space-y-2 group hover:border-primary/50 transition-colors">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-colors">
                        <Banknote className="h-5 w-5" />
                    </div>
                    <div className="space-y-1">
                        <p className="font-bold text-sm">Process Cycle</p>
                        <p className="text-xs text-muted-foreground">Review and finalize the current payslips for {client?.firstProcessingMonth}.</p>
                    </div>
                    <Button variant="link" asChild className="h-auto p-0 text-xs font-bold">
                        <Link href={`/admin/ai-payroll/${clientId}/payslips`}>View Payslips <ArrowRight className="ml-1 h-3 w-3" /></Link>
                    </Button>
                </div>
            </div>
          </CardContent>
        </Card>

        <Card>
            <CardHeader>
                <CardTitle className="text-sm">Recent Activity</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
                <div className="divide-y text-[11px]">
                    {employees.slice(0, 5).map(emp => (
                        <div key={emp.id} className="p-3 flex justify-between items-center">
                            <span className="font-medium text-slate-700">{emp.name} {emp.surname}</span>
                            <Badge variant="outline" className="text-[9px] font-bold uppercase">{emp.status}</Badge>
                        </div>
                    ))}
                    {employees.length === 0 && (
                        <div className="p-8 text-center text-muted-foreground italic">No recent activity</div>
                    )}
                </div>
            </CardContent>
            <CardFooter className="bg-muted/30 border-t py-3">
                <Button variant="ghost" size="sm" asChild className="w-full text-xs font-bold text-muted-foreground">
                    <Link href={`/admin/ai-payroll/${clientId}/employees`}>View All Employees</Link>
                </Button>
            </CardFooter>
        </Card>
      </div>
    </div>
  );
}