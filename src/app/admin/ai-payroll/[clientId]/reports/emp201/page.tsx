'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { getFirestore, collection, query, orderBy, onSnapshot, doc } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { Payslip, Employee, User } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import * as XLSX from 'xlsx';
import { Loader2, Download, Users, Calculator } from 'lucide-react';
import { format, startOfMonth, endOfMonth, isWithinInterval, parse } from 'date-fns';

const db = getFirestore(firebaseApp);

const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-ZA', {
        style: 'currency',
        currency: 'ZAR',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(val);
};

export default function Emp201ReportPage() {
    const params = useParams();
    const clientId = params.clientId as string;
    const { toast } = useToast();
    
    const [client, setClient] = useState<User | null>(null);
    const [payslips, setPayslips] = useState<Payslip[]>([]);
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedMonth, setSelectedMonth] = useState<string>('');

    // Fetch Initial Data
    useEffect(() => {
        if (!clientId) return;

        // 1. Fetch Client
        const unsubClient = onSnapshot(doc(db, 'aiPayrollClients', clientId), (snap) => {
            if (snap.exists()) {
                const data = snap.data() as User;
                setClient({ id: snap.id, ...data } as User);
                // Default to current month if not set
                if (!selectedMonth) {
                    setSelectedMonth(format(new Date(), 'MMMM yyyy'));
                }
            }
        });

        // 2. Fetch All Payslips
        const payslipsRef = collection(db, 'aiPayrollClients', clientId, 'payslips');
        const q = query(payslipsRef, orderBy('date', 'desc'));

        const unsubPayslips = onSnapshot(q, (snapshot) => {
            const fetched = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Payslip));
            setPayslips(fetched);
        });

        // 3. Fetch All Employees
        const employeesRef = collection(db, 'aiPayrollClients', clientId, 'employees');
        const unsubEmployees = onSnapshot(employeesRef, (snapshot) => {
            const fetched = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Employee));
            setEmployees(fetched);
            setIsLoading(false);
        });

        return () => {
            unsubClient();
            unsubPayslips();
            unsubEmployees();
        };
    }, [clientId]);

    // Available EMP201 months (Standard Monthly Declaration)
    const availableMonths = useMemo(() => {
        const months = new Set<string>();
        // Add current and past 12 months as options
        const now = new Date();
        for (let i = 0; i < 13; i++) {
            months.add(format(subMonths(now, i), 'MMMM yyyy'));
        }
        
        // Also add any months that have historical payslips
        payslips.forEach(ps => {
            const d = ps.date?.toDate ? ps.date.toDate() : new Date(ps.date || Date.now());
            months.add(format(d, 'MMMM yyyy'));
        });

        function subMonths(date: Date, months: number) {
            const d = new Date(date);
            d.setMonth(d.getMonth() - months);
            return d;
        }

        return Array.from(months).sort((a, b) => {
            const dateA = new Date(a);
            const dateB = new Date(b);
            return dateB.getTime() - dateA.getTime();
        });
    }, [payslips]);

    // Aggregation Logic: Find all payslips whose payment date is in the selected month
    const reportData = useMemo(() => {
        if (!selectedMonth) return { breakdown: [], totals: { gross: 0, paye: 0, uif: 0, sdl: 0, payable: 0 } };

        const targetDate = parse(selectedMonth, 'MMMM yyyy', new Date());
        const start = startOfMonth(targetDate);
        const end = endOfMonth(targetDate);

        // Filter for finalized payslips within the calendar month
        const periodPayslips = payslips.filter(ps => {
            if (ps.status !== 'finalized') return false;
            const psDate = ps.date?.toDate ? ps.date.toDate() : new Date(ps.date || Date.now());
            return isWithinInterval(psDate, { start, end });
        });
        
        let totalPaye = 0;
        let totalUif = 0;
        let totalSdl = 0;
        let totalGross = 0;

        const employeeAggregates: Record<string, any> = {};

        periodPayslips.forEach(ps => {
            const paye = ps.deductions.find(d => d.label.toLowerCase() === 'tax')?.amount || 0;
            const uifEmp = ps.deductions.find(d => d.label.toLowerCase().includes('unemployment'))?.amount || 0;
            const uifCo = ps.contributions.find(c => c.label.toLowerCase().includes('unemployment'))?.amount || 0;
            const sdl = ps.contributions.find(c => c.label.toLowerCase().includes('skills'))?.amount || 0;
            
            if (!employeeAggregates[ps.employeeId]) {
                employeeAggregates[ps.employeeId] = {
                    name: ps.employeeName,
                    gross: 0,
                    paye: 0,
                    uif: 0,
                    sdl: 0,
                    runs: 0
                };
            }

            employeeAggregates[ps.employeeId].gross += (ps.grossPay || 0);
            employeeAggregates[ps.employeeId].paye += paye;
            employeeAggregates[ps.employeeId].uif += (uifEmp + uifCo);
            employeeAggregates[ps.employeeId].sdl += sdl;
            employeeAggregates[ps.employeeId].runs += 1;

            totalPaye += paye;
            totalUif += (uifEmp + uifCo);
            totalSdl += sdl;
            totalGross += (ps.grossPay || 0);
        });

        return {
            breakdown: Object.values(employeeAggregates),
            totals: {
                gross: totalGross,
                paye: totalPaye,
                uif: totalUif,
                sdl: totalSdl,
                payable: totalPaye + totalUif + totalSdl
            }
        };
    }, [payslips, selectedMonth]);

    const handleDownloadExcel = () => {
        if (!client || !reportData || !selectedMonth) return;

        const wb = XLSX.utils.book_new();
        const summary = [
            ["EMP201 MONTHLY DECLARATION (AGGREGATED)"],
            ["Company", client.companyName || client.name],
            ["PAYE Reference", client.payeReference || "N/A"],
            ["Declaration Month", selectedMonth],
            [""],
            ["Tax Code", "Description", "Amount"],
            ["4101", "PAYE (Employees Tax)", reportData.totals.paye],
            ["4141", "UIF (Unemployment Insurance Fund)", reportData.totals.uif],
            ["4142", "SDL (Skills Development Levy)", reportData.totals.sdl],
            ["", "TOTAL PAYABLE TO SARS", reportData.totals.payable]
        ];
        const wsSummary = XLSX.utils.aoa_to_sheet(summary);
        XLSX.utils.book_append_sheet(wb, wsSummary, "EMP201 Summary");

        const details = reportData.breakdown.map(b => ({
            "Employee Name": b.name,
            "Total Gross": b.gross,
            "Total PAYE": b.paye,
            "Total UIF": b.uif,
            "Total SDL": b.sdl,
            "No. of Payslips": b.runs
        }));
        const wsDetails = XLSX.utils.json_to_sheet(details);
        XLSX.utils.book_append_sheet(wb, wsDetails, "Aggregated Breakdown");

        XLSX.writeFile(wb, `EMP201_${client.name.replace(/\s/g, '_')}_${selectedMonth.replace(/\s/g, '_')}.xlsx`);
    };

    if (isLoading) return <div className="flex justify-center py-20"><Loader2 className="animate-spin h-8 w-8 text-primary" /></div>;

    return (
        <div className="space-y-8">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight text-slate-900">EMP201 Aggregated Return</h2>
                    <p className="text-sm text-muted-foreground font-medium">Declaration for SARS based on all finalized payments in the selected month.</p>
                </div>
                <div className="flex items-center gap-3">
                    <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                        <SelectTrigger className="w-[220px] h-10 font-bold bg-white border-primary/20 shadow-sm">
                            <SelectValue placeholder="Select Month" />
                        </SelectTrigger>
                        <SelectContent>
                            {availableMonths.map(m => (
                                <SelectItem key={m} value={m}>{m}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Button variant="outline" className="h-10 gap-2 font-bold" onClick={handleDownloadExcel}>
                        <Download className="h-4 w-4" /> Export Excel
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <Card className="border-2 shadow-sm">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">PAYE (Tax)</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-2xl font-black text-slate-900">{formatCurrency(reportData.totals.paye)}</p>
                        <p className="text-[10px] font-medium text-muted-foreground mt-1">SARS Code: 4101</p>
                    </CardContent>
                </Card>

                <Card className="border-2 shadow-sm">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">UIF (Total)</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-2xl font-black text-slate-900">{formatCurrency(reportData.totals.uif)}</p>
                        <p className="text-[10px] font-medium text-muted-foreground mt-1">Employee + Employer</p>
                    </CardContent>
                </Card>

                <Card className="border-2 shadow-sm">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">SDL</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-2xl font-black text-slate-900">{formatCurrency(reportData.totals.sdl)}</p>
                        <p className="text-[10px] font-medium text-muted-foreground mt-1">SARS Code: 4142</p>
                    </CardContent>
                </Card>

                <Card className="bg-primary text-primary-foreground border-none shadow-lg">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-[10px] font-black uppercase tracking-widest opacity-80">Monthly Liability</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-3xl font-black tabular-nums">{formatCurrency(reportData.totals.payable)}</p>
                        <p className="text-[10px] font-bold mt-1 opacity-90">Due by the 7th of {format(addMonths(parse(selectedMonth, 'MMMM yyyy', new Date()), 1), 'MMMM')}</p>
                    </CardContent>
                </Card>
            </div>

            <Card className="border-2 overflow-hidden">
                <CardHeader className="bg-muted/30 border-b flex flex-row justify-between items-center">
                    <div className="flex items-center gap-2">
                        <Users className="h-5 w-5 text-primary" />
                        <div>
                            <CardTitle className="text-lg">Aggregated Employee Totals</CardTitle>
                            <CardDescription>Sum of all pay runs finalized in {selectedMonth}.</CardDescription>
                        </div>
                    </div>
                    {client?.payrollFrequency === 'Fortnightly' && (
                        <Badge variant="outline" className="bg-white border-primary/20 text-primary font-bold">Bi-Weekly Aggregation Active</Badge>
                    )}
                </CardHeader>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-muted/10">
                                <TableHead className="font-bold">Staff Member</TableHead>
                                <TableHead className="text-center font-bold">Runs</TableHead>
                                <TableHead className="text-right font-bold text-primary">PAYE</TableHead>
                                <TableHead className="text-right font-bold">UIF</TableHead>
                                <TableHead className="text-right font-bold">SDL</TableHead>
                                <TableHead className="text-right font-bold">Gross Total</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {reportData.breakdown.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center py-12 text-muted-foreground italic">
                                        No finalized payslips found with payment dates in this month.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                reportData.breakdown.map((row, idx) => (
                                    <TableRow key={idx} className="hover:bg-slate-50/50">
                                        <TableCell className="font-bold text-slate-900">{row.name}</TableCell>
                                        <TableCell className="text-center"><Badge variant="secondary" className="h-5">{row.runs}</Badge></TableCell>
                                        <TableCell className="text-right font-mono text-xs font-bold text-primary">{formatCurrency(row.paye)}</TableCell>
                                        <TableCell className="text-right font-mono text-xs">{formatCurrency(row.uif)}</TableCell>
                                        <TableCell className="text-right font-mono text-xs">{formatCurrency(row.sdl)}</TableCell>
                                        <TableCell className="text-right font-mono text-xs font-semibold">{formatCurrency(row.gross)}</TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                        <TableFooter className="bg-muted/20">
                            <TableRow>
                                <TableCell className="font-black text-slate-900 uppercase text-[10px]">Grand Totals</TableCell>
                                <TableCell></TableCell>
                                <TableCell className="text-right font-black text-primary">{formatCurrency(reportData.totals.paye)}</TableCell>
                                <TableCell className="text-right font-black text-slate-900">{formatCurrency(reportData.totals.uif)}</TableCell>
                                <TableCell className="text-right font-black text-slate-900">{formatCurrency(reportData.totals.sdl)}</TableCell>
                                <TableCell className="text-right font-black text-slate-900">{formatCurrency(reportData.totals.gross)}</TableCell>
                            </TableRow>
                        </TableFooter>
                    </Table>
                </CardContent>
            </Card>

            <Alert className="bg-muted/30 border-dashed border-2">
                <Calculator className="h-4 w-4" />
                <AlertTitle className="text-xs font-bold uppercase tracking-wider">SARS eFiling Aggregation</AlertTitle>
                <AlertDescription className="text-xs leading-relaxed mt-1">
                    When filing your <strong>EMP201</strong> for bi-weekly payrolls, you must sum all pay cycles paid during the calendar month. The totals provided above already combine all finalized runs detected for the selected period.
                </AlertDescription>
            </Alert>
        </div>
    );
}

function addMonths(date: Date, months: number) {
    const d = new Date(date);
    d.setMonth(d.getMonth() + months);
    return d;
}
