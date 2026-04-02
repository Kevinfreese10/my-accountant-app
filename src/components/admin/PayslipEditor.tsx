'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Payslip, PayslipItem, Employee, User } from "@/lib/types";
import { Plus, Trash2, Loader2, Save, Calculator, Landmark, ShieldCheck, User as UserIcon, Briefcase, RefreshCw, Clock } from 'lucide-react';
import { Separator } from "@/components/ui/separator";
import { PayrollService } from '@/services/PayrollService';
import { useToast } from '@/hooks/use-toast';
import { updatePayslipAction } from '@/app/actions';
import { Badge } from "@/components/ui/badge";
import PayslipDownloadButton from '@/components/pdf/PayslipDownloadButton';
import { Label } from '../ui/label';

const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-ZA', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(val);
};

export default function PayslipEditor({ 
    payslip, 
    employee, 
    client,
    onSave 
}: { 
    payslip: Payslip, 
    employee: Employee, 
    client: User,
    onSave: () => void 
}) {
    const { toast } = useToast();
    const [earnings, setEarnings] = useState<PayslipItem[]>(payslip.earnings || []);
    const [deductions, setDeductions] = useState<PayslipItem[]>(payslip.deductions || []);
    const [contributions, setContributions] = useState<PayslipItem[]>(payslip.contributions || []);
    const [fringeBenefits, setFringeBenefits] = useState<PayslipItem[]>(payslip.fringeBenefits || []);
    const [hoursWorked, setHoursWorked] = useState<number>(payslip.hoursWorked || 0);
    const [isSaving, setIsSaving] = useState(false);

    const frequency = payslip.frequency === 'Monthly' ? 12 : payslip.frequency === 'Fortnightly' ? 26 : 52;

    // Synchronize basic pay if hourly rated
    useEffect(() => {
        if (employee.payType === 'Hourly') {
            const calculatedBasic = (employee.hourlyRate || 0) * hoursWorked;
            setEarnings(prev => {
                const updated = [...prev];
                const basicIdx = updated.findIndex(item => 
                    item.label.toLowerCase().includes('hourly rate') || 
                    item.label.toLowerCase().includes('normal hours')
                );
                if (basicIdx > -1) {
                    updated[basicIdx].amount = calculatedBasic;
                }
                return updated;
            });
        }
    }, [hoursWorked, employee.payType, employee.hourlyRate]);

    const handleSyncFromProfile = () => {
        const basePeriod = client.firstProcessingMonth || 'Current Period';
        const baseValue = employee.payType === 'Hourly' ? (employee.hourlyRate || 0) : (employee.basicSalary || 0);
        
        const freshEarnings = PayrollService.calculateEarningsList(employee, baseValue, basePeriod, frequency, { normal: hoursWorked });
        setEarnings(freshEarnings);
        
        const gross = freshEarnings.reduce((s, i) => s + i.amount, 0);
        setDeductions(PayrollService.getInitialDeductions(gross, basePeriod, frequency));
        setContributions(PayrollService.getInitialContributions(gross, basePeriod, !!client.excludeSdl));
        
        toast({ title: "Synced with Profile", description: "Basic salary and statutory items refreshed." });
    };

    // Dynamic Recalculation logic
    const totals = useMemo(() => {
        const gross = earnings.reduce((sum, item) => sum + item.amount, 0);
        const period = client.firstProcessingMonth;
        
        const updatedDeductions = [...deductions];
        const updatedContributions = [...contributions];

        const payeIdx = updatedDeductions.findIndex(d => d.label === 'Tax' && d.isStatutory);
        const uifIdx = updatedDeductions.findIndex(d => d.label === 'Unemployment insurance fund' && d.isStatutory);
        const uifContribIdx = updatedContributions.findIndex(c => c.label === 'Unemployment insurance fund' && c.isStatutory);
        const sdlIdx = updatedContributions.findIndex(c => c.label === 'Skills development levy' && c.isStatutory);

        if (payeIdx > -1) updatedDeductions[payeIdx].amount = PayrollService.calculatePaye(gross, period, frequency);
        if (uifIdx > -1) updatedDeductions[uifIdx].amount = PayrollService.calculateUif(gross, period);
        if (uifContribIdx > -1) updatedContributions[uifContribIdx].amount = PayrollService.calculateUif(gross, period);
        if (sdlIdx > -1) updatedContributions[sdlIdx].amount = parseFloat((gross * 0.01).toFixed(2));

        const totalDeductions = updatedDeductions.reduce((sum, item) => sum + item.amount, 0);
        const totalContrib = updatedContributions.reduce((sum, item) => sum + item.amount, 0);
        const totalFringe = fringeBenefits.reduce((sum, item) => sum + item.amount, 0);

        return {
            gross,
            totalDeductions,
            totalContrib,
            totalFringe,
            netPay: gross - totalDeductions,
            updatedDeductions,
            updatedContributions
        };
    }, [earnings, deductions, contributions, fringeBenefits, client.firstProcessingMonth, frequency]);

    const handleAddItem = (type: 'earning' | 'deduction' | 'contribution' | 'fringe') => {
        const newItem = { label: 'New item', amount: 0 };
        if (type === 'earning') setEarnings([...earnings, newItem]);
        else if (type === 'deduction') setDeductions([...deductions, newItem]);
        else if (type === 'contribution') setContributions([...contributions, newItem]);
        else setFringeBenefits([...fringeBenefits, newItem]);
    };

    const handleRemoveItem = (index: number, type: 'earning' | 'deduction' | 'contribution' | 'fringe') => {
        if (type === 'earning') setEarnings(earnings.filter((_, i) => i !== index));
        else if (type === 'deduction') setDeductions(deductions.filter((_, i) => i !== index));
        else if (type === 'contribution') setContributions(contributions.filter((_, i) => i !== index));
        else setFringeBenefits(fringeBenefits.filter((_, i) => i !== index));
    };

    const handleUpdateItem = (index: number, field: 'label' | 'amount', value: any, type: 'earning' | 'deduction' | 'contribution' | 'fringe') => {
        const setter = type === 'earning' ? setEarnings : type === 'deduction' ? setDeductions : type === 'contribution' ? setContributions : setFringeBenefits;
        const list = type === 'earning' ? earnings : type === 'deduction' ? deductions : type === 'contribution' ? contributions : fringeBenefits;
        
        const updated = [...list];
        updated[index] = { ...updated[index], [field]: field === 'amount' ? (parseFloat(value) || 0) : value };
        setter(updated);
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const finalData: Partial<Payslip> = {
                earnings,
                deductions: totals.updatedDeductions,
                contributions: totals.updatedContributions,
                fringeBenefits,
                grossPay: totals.gross,
                totalDeductions: totals.totalDeductions,
                netPay: totals.netPay,
                hoursWorked
            };

            const res = await updatePayslipAction({
                clientId: client.id,
                payslipId: payslip.id,
                data: finalData
            });

            if (res.success) {
                toast({ title: "Payslip Saved", description: `Updated record for ${employee.name} ${employee.surname}.` });
                onSave();
            } else {
                toast({ title: "Save Failed", description: res.error, variant: "destructive" });
            }
        } catch (e) {
            toast({ title: "Error", description: "Could not save payslip.", variant: "destructive" });
        } finally {
            setIsSaving(false);
        }
    };

    const ColumnHeader = ({ title, onAdd }: { title: string, onAdd: () => void }) => (
        <div className="bg-[#EFEFEF] p-2 flex justify-between items-center border-b border-[#CCCCCC]">
            <span className="text-[11px] font-bold text-[#666666] uppercase tracking-wide">{title}</span>
            <Button variant="ghost" size="icon" className="h-5 w-5 text-[#999999] hover:text-primary" onClick={onAdd}>
                <Plus className="h-3 w-3" />
            </Button>
        </div>
    );

    const ItemRow = ({ item, index, type }: { item: PayslipItem, index: number, type: 'earning' | 'deduction' | 'contribution' | 'fringe' }) => (
        <div className="flex items-center gap-2 group py-1 px-2 border-b border-gray-100 last:border-0 hover:bg-slate-50/50 transition-colors">
            <Input 
                value={item.label} 
                onChange={(e) => handleUpdateItem(index, 'label', e.target.value, type)}
                disabled={item.isStatutory || (type === 'earning' && employee.payType === 'Hourly' && (item.label.toLowerCase().includes('hourly rate') || item.label.toLowerCase().includes('normal hours')))}
                className="h-7 text-[11px] border-none bg-transparent shadow-none focus-visible:ring-0 p-0 flex-grow font-medium"
            />
            <div className="flex items-center gap-1">
                <span className="text-[10px] text-muted-foreground font-mono">R</span>
                <Input 
                    type="number"
                    step="0.01"
                    value={item.amount}
                    onChange={(e) => handleUpdateItem(index, 'amount', e.target.value, type)}
                    disabled={item.isStatutory || (type === 'earning' && employee.payType === 'Hourly' && (item.label.toLowerCase().includes('hourly rate') || item.label.toLowerCase().includes('normal hours')))}
                    className="h-7 w-24 text-right text-[11px] border-none bg-transparent shadow-none focus-visible:ring-0 p-0 font-mono font-bold"
                />
                {!item.isStatutory && (
                    <Button variant="ghost" size="icon" className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity text-destructive" onClick={() => handleRemoveItem(index, type)}>
                        <Trash2 className="h-3 w-3" />
                    </Button>
                )}
            </div>
        </div>
    );

    return (
        <div className="space-y-6 max-w-6xl mx-auto">
            <div className="flex justify-between items-center bg-white p-4 rounded-xl border shadow-sm">
                <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-lg">
                        {employee.name.charAt(0)}{employee.surname.charAt(0)}
                    </div>
                    <div>
                        <h2 className="text-lg font-bold text-slate-900">{employee.name} {employee.surname}</h2>
                        <div className="flex gap-3 text-xs text-muted-foreground font-medium">
                            <span className="flex items-center gap-1"><Briefcase className="h-3 w-3" /> {employee.jobTitle}</span>
                            <span className="flex items-center gap-1"><Landmark className="h-3 w-3" /> {employee.department}</span>
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-6">
                    {employee.payType === 'Hourly' && (
                        <div className="p-2 px-4 rounded-lg bg-primary/5 border border-primary/10 space-y-1">
                            <Label className="text-[10px] font-black uppercase text-primary tracking-widest leading-none">Hours Worked</Label>
                            <div className="flex items-center gap-2">
                                <Clock className="h-4 w-4 text-primary" />
                                <Input 
                                    type="number" 
                                    value={hoursWorked} 
                                    onChange={(e) => setHoursWorked(parseFloat(e.target.value) || 0)}
                                    className="h-8 w-20 font-bold text-sm bg-white"
                                />
                            </div>
                        </div>
                    )}
                    <div className="text-right">
                        <Badge variant="outline" className="mb-1 font-bold uppercase tracking-widest text-[9px]">{payslip.period}</Badge>
                        <p className="text-sm font-black text-slate-900">Rate: {formatCurrency(employee.payType === 'Hourly' ? (employee.hourlyRate || 0) : (employee.basicSalary || 0))}{employee.payType === 'Hourly' ? '/hr' : '/mo'}</p>
                    </div>
                </div>
            </div>

            <Card className="border shadow-lg rounded-none overflow-hidden">
                <div className="grid grid-cols-1 md:grid-cols-3 divide-x divide-[#CCCCCC]">
                    <div className="flex flex-col min-h-[350px]">
                        <ColumnHeader title="Earnings" onAdd={() => handleAddItem('earning')} />
                        <div className="flex-grow bg-white">
                            {earnings.map((item, i) => <ItemRow key={i} item={item} index={i} type="earning" />)}
                        </div>
                        <div className="bg-[#F9F9F9] p-2 flex justify-between items-center border-t border-[#E5E5E5] text-[11px]">
                            <span className="font-bold text-[#666666]">Total</span>
                            <span className="font-bold font-mono">R {formatCurrency(totals.gross)}</span>
                        </div>
                    </div>

                    <div className="flex flex-col min-h-[350px]">
                        <ColumnHeader title="Deductions" onAdd={() => handleAddItem('deduction')} />
                        <div className="flex-grow bg-white">
                            {totals.updatedDeductions.map((item, i) => <ItemRow key={i} item={item} index={i} type="deduction" />)}
                        </div>
                        <div className="bg-[#F9F9F9] p-2 flex justify-between items-center border-t border-[#E5E5E5] text-[11px]">
                            <span className="font-bold text-[#666666]">Total</span>
                            <span className="font-bold font-mono">R {formatCurrency(totals.totalDeductions)}</span>
                        </div>
                    </div>

                    <div className="flex flex-col min-h-[350px]">
                        <ColumnHeader title="Company Contributions" onAdd={() => handleAddItem('contribution')} />
                        <div className="bg-white">
                            {totals.updatedContributions.map((item, i) => <ItemRow key={i} item={item} index={i} type="contribution" />)}
                        </div>
                        <div className="bg-[#F9F9F9] p-2 flex justify-between items-center border-b border-[#E5E5E5] text-[11px]">
                            <span className="font-bold text-[#666666]">Total</span>
                            <span className="font-bold font-mono">R {formatCurrency(totals.totalContrib)}</span>
                        </div>

                        <ColumnHeader title="Fringe Benefits" onAdd={() => handleAddItem('fringe')} />
                        <div className="flex-grow bg-white">
                            {fringeBenefits.map((item, i) => <ItemRow key={i} item={item} index={i} type="fringe" />)}
                        </div>
                        <div className="bg-[#F9F9F9] p-2 flex justify-between items-center border-t border-[#E5E5E5] text-[11px]">
                            <span className="font-bold text-[#666666]">Total</span>
                            <span className="font-bold font-mono">R {formatCurrency(totals.totalFringe)}</span>
                        </div>
                    </div>
                </div>

                <div className="bg-[#EFEFEF] border-t border-[#CCCCCC] p-3 flex justify-between items-center">
                    <span className="text-sm font-black text-[#333333] uppercase italic tracking-tighter">Nett pay</span>
                    <span className="text-2xl font-black text-slate-900 tabular-nums font-mono">
                        R {formatCurrency(totals.netPay)}
                    </span>
                </div>
            </Card>

            <div className="flex justify-between items-center">
                <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={handleSyncFromProfile} className="font-bold text-xs gap-2">
                        <RefreshCw className="h-3 w-3" /> Sync with Profile
                    </Button>
                    <PayslipDownloadButton 
                        client={client}
                        employee={employee}
                        payslip={payslip}
                        currentData={{
                            earnings,
                            deductions: totals.updatedDeductions,
                            contributions: totals.updatedContributions,
                            fringeBenefits,
                            netPay: totals.netPay,
                            grossPay: totals.gross
                        }}
                    />
                </div>
                <div className="flex gap-3">
                    <Button variant="outline" className="font-bold" onClick={onSave}>Discard Changes</Button>
                    <Button className="font-black px-8 gap-2 shadow-lg" onClick={handleSave} disabled={isSaving}>
                        {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                        Save & Finalize Payslip
                    </Button>
                </div>
            </div>
        </div>
    );
}
