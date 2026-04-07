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
    const [selectedPeriod, setSelectedPeriod] = useState<string>('');

    // Fetch Initial Data
    useEffect(() => {
        if (!clientId) return;

        // 1. Fetch Client
        const unsubClient = onSnapshot(doc(db, 'aiPayrollClients', clientId), (snap) => {
            if (snap.exists()) {
                const data = snap.data() as User;
                setClient({ id: snap.id, ...data } as User);
                // If no period is selected, default to the client's current processing month
                if (!selectedPeriod && data.firstProcessingMonth) {
                    setSelectedPeriod(data.firstProcessingMonth);
                }
            }
        });

        // 2. Fetch All Payslips
        const payslipsRef = collection(db, 'aiPayrollClients', clientId, 'payslips');
        const q = query(payslipsRef, orderBy('createdAt', 'desc'));

        const unsubPayslips = onSnapshot(q, (snapshot) => {
            const fetched = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Payslip));
            setPayslips(fetched);
        });

        // 3. Fetch All Employees (to filter for active ones)
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
    }, [clientId, selectedPeriod]);

    // Unique periods from payslips, normalized to base months
    const availablePeriods = useMemo(() => {
        const p = new Set<string>();
        if (client?.firstProcessingMonth) p.add(client.firstProcessingMonth);
        
        payslips.forEach(ps => {
            if (ps.status === 'finalized' && ps.period && typeof ps.period === 'string') {
                // If the period has a " - Run X" suffix, extract just the month part
                const baseMonth = ps.period.split(' - ')[0];
                if (baseMonth) p.add(baseMonth);
            }
        });
        
        return Array.from(p)
            .filter(Boolean)
            .sort((a, b) => {
                const dateA = new Date(a);
                const dateB = new Date(b);
                if (!isNaN(dateA.getTime()) && !isNaN(dateB.getTime())) {
                    return dateB.getTime() - dateA.getTime();
                }
                return b.localeCompare(a);
            });
    }, [payslips, client]);

    // Calculations for the selected period
    const reportData = useMemo(() => {
        if (!selectedPeriod) return { breakdown: [], totals: { gross: 0, paye: 0, uif: 0, sdl: 0, payable: 0 } };

        // Find active employees
        const activeEmployeeIds = new Set(employees.filter(e => e.status === 'Active').map(e => e.id));
        
        // Filter payslips by period (handling multi-run matches) AND by active status AND status finalized
        const periodPayslips = payslips.filter(ps => 
            ps.period && 
            (ps.period === selectedPeriod || ps.period.startsWith(`${selectedPeriod} -`)) && 
            activeEmployeeIds.has(ps.employeeId) &&
            ps.status === 'finalized'
        );
        
        let totalPaye = 0;
        let totalUifEmployee = 0;
        let totalUifEmployer = 0;
        let totalSdl = 0;
        let totalGross = 0;

        // Group by employee to handle multiple runs in one month
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
                    sdl: 0
                };
            }

            employeeAggregates[ps.employeeId].gross += (ps.grossPay || 0);
            employeeAggregates[ps.employeeId].paye += paye;
            employeeAggregates[ps.employeeId].uif += (uifEmp + uifCo);
            employeeAggregates[ps.employeeId].sdl += sdl;

            totalPaye += paye;
            totalUifEmployee += uifEmp;
            totalUifEmployer += uifCo;
            totalSdl += sdl;
            totalGross += (ps.grossPay || 0);
        });

        const breakdown = Object.values(employeeAggregates);
        const totalUif = totalUifEmployee + totalUifEmployer;
        const totalPayable = totalPaye + totalUif + totalSdl;

        return {
            breakdown,
            totals: {
                gross: totalGross,
                paye: totalPaye,
                uif: totalUif,
                sdl: totalSdl,
                payable: totalPayable
            }
        };
    }, [payslips, employees, selectedPeriod]);

    const handleDownloadExcel = () => {
        if (!client || !reportData || !selectedPeriod) return;

        const wb = XLSX.utils.book_new();
        
        // Summary Sheet
        const summary = [
            ["EMP201 MONTHLY DECLARATION"],
            ["Company", client.companyName || client.name],
            ["Registration No", client.registrationNumber || "N/A"],
            ["PAYE Reference", client.payeReference || "N/A"],
            ["Period", selectedPeriod],
            [""],
            ["Tax Code", "Description", "Amount"],
            ["4101", "PAYE (Employees Tax)", reportData.totals.paye],
            ["4141", "UIF (Unemployment Insurance Fund)", reportData.totals.uif],
            ["4142", "SDL (Skills Development Levy)", reportData.totals.sdl],
            ["", "TOTAL PAYABLE TO SARS", reportData.totals.payable]
        ];
        const wsSummary = XLSX.utils.aoa_to_sheet(summary);
        XLSX.utils.book_append_sheet(wb, wsSummary, "EMP201 Summary");

        // Employee Breakdown Sheet
        const details = reportData.breakdown.map(b => ({
            "Employee Name": b.name,
            "Gross Earnings": b.gross,
            "PAYE": b.paye,
            "UIF (Total)": b.uif,
            "SDL": b.sdl
        }));
        const wsDetails = XLSX.utils.json_to_sheet(details);
        XLSX.utils.book_append_sheet(wb, wsDetails, "Employee Breakdown");

        XLSX.writeFile(wb, `EMP201_${client.name.replace(/\s/g, '_')}_${selectedPeriod.replace(/\s/g, '_')}.xlsx`);
    };

    if (isLoading) return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-primary" /></div>;

    return (
        <div className="space-y-8">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight text-slate-900">EMP201 Declaration</h2>
                    <p className="text-sm text-muted-foreground font-medium">Monthly payroll tax return summary for SARS.</p>
                </div>
                <div className="flex items-center gap-3">
                    <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                        <SelectTrigger className="w-[200px] h-10 font-bold bg-white border-primary/20">
                            <SelectValue placeholder="Select Period" />
                        </SelectTrigger>
                        <SelectContent>
                            {availablePeriods.map(p => (
                                <SelectItem key={p} value={p}>
                                    {p}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Button variant="outline" className="h-10 gap-2 font-bold" onClick={handleDownloadExcel}>
                        <Download className="h-4 w-4" /> Export CSV/Excel
                    </Button>
                </div>
            </div>

            {/* Summary Cards */}
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
                        <p className="text-[10px] font-medium text-muted-foreground mt-1">SARS Code: 4141</p>
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
                        <CardTitle className="text-[10px] font-black uppercase tracking-widest opacity-80">Total Payable</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-3xl font-black tabular-nums">{formatCurrency(reportData.totals.payable)}</p>
                        <p className="text-[10px] font-bold mt-1 opacity-90">Payment Reference: {client?.payeReference || 'N/A'}</p>
                    </CardContent>
                </Card>
            </div>

            {/* Employee Breakdown */}
            <Card className="border-2 overflow-hidden">
                <CardHeader className="bg-muted/30 border-b">
                    <div className="flex items-center gap-2">
                        <Users className="h-5 w-5 text-primary" />
                        <div>
                            <CardTitle className="text-lg">Detailed Breakdown</CardTitle>
                            <CardDescription>Aggregate contributions for the {selectedPeriod} cycle.</CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-muted/10">
                                <TableHead className="font-bold">Employee Name</TableHead>
                                <TableHead className="text-right font-bold">Gross Earnings</TableHead>
                                <TableHead className="text-right font-bold text-primary">PAYE</TableHead>
                                <TableHead className="text-right font-bold">UIF (2%)</TableHead>
                                <TableHead className="text-right font-bold">SDL (1%)</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {reportData.breakdown.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center py-12 text-muted-foreground italic">
                                        No finalized payslips found for this period.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                reportData.breakdown.map((row, idx) => (
                                    <TableRow key={idx} className="hover:bg-slate-50/50">
                                        <TableCell className="font-bold text-slate-900">{row.name}</TableCell>
                                        <TableCell className="text-right font-mono text-xs">{formatCurrency(row.gross)}</TableCell>
                                        <TableCell className="text-right font-mono text-xs font-bold text-primary">{formatCurrency(row.paye)}</TableCell>
                                        <TableCell className="text-right font-mono text-xs">{formatCurrency(row.uif)}</TableCell>
                                        <TableCell className="text-right font-mono text-xs">{formatCurrency(row.sdl)}</TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                        <TableFooter className="bg-muted/20">
                            <TableRow>
                                <TableCell className="font-black text-slate-900 uppercase text-[10px]">Grand Totals</TableCell>
                                <TableCell className="text-right font-black text-slate-900">{formatCurrency(reportData.totals.gross)}</TableCell>
                                <TableCell className="text-right font-black text-primary">{formatCurrency(reportData.totals.paye)}</TableCell>
                                <TableCell className="text-right font-black text-slate-900">{formatCurrency(reportData.totals.uif)}</TableCell>
                                <TableCell className="text-right font-black text-slate-900">{formatCurrency(reportData.totals.sdl)}</TableCell>
                            </TableRow>
                        </TableFooter>
                    </Table>
                </CardContent>
            </Card>

            <Alert className="bg-muted/30 border-dashed border-2">
                <Calculator className="h-4 w-4" />
                <AlertTitle className="text-xs font-bold uppercase tracking-wider">SARS Submission Guide</AlertTitle>
                <AlertDescription className="text-xs leading-relaxed mt-1">
                    When submitting your <strong>EMP201</strong> on eFiling, use the totals provided above. Ensure that your 
                    <strong> Payment Reference Number (PRN)</strong> matches your PAYE reference ({client?.payeReference || 'N/A'}) 
                    concatenated with the period code.
                </AlertDescription>
            </Alert>
        </div>
    );
}
