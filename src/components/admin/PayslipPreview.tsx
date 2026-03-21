'use client';

import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Employee, Payslip, User } from "@/lib/types";
import { format } from 'date-fns';
import { Landmark, User as UserIcon, Calendar, ReceiptText, CreditCard } from 'lucide-react';

interface PayslipPreviewProps {
  payslip: Payslip;
  employee: Employee;
  client: User;
}

const formatPrice = (price: number) => {
  return new Intl.NumberFormat('en-ZA', {
    style: 'currency',
    currency: 'ZAR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(price);
};

export default function PayslipPreview({ payslip, employee, client }: PayslipPreviewProps) {
  const earnings = payslip.earnings;
  const deductions = payslip.deductions;

  return (
    <div className="bg-white text-slate-900 p-8 rounded-lg shadow-inner border max-h-[80vh] overflow-y-auto print:p-0 print:shadow-none print:border-none">
      {/* Header */}
      <div className="flex justify-between items-start mb-8">
        <div className="space-y-1">
          <h1 className="text-2xl font-black uppercase tracking-tight text-primary">{client.companyName || client.name}</h1>
          <div className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">Payslip • Confidential</div>
        </div>
        <div className="text-right">
          <div className="bg-primary/5 px-4 py-2 rounded-lg border border-primary/10">
            <p className="text-[10px] font-black text-primary uppercase tracking-widest">Pay Period</p>
            <p className="text-lg font-bold">{payslip.period}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
        {/* Employee Info */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-xs font-black uppercase text-muted-foreground tracking-widest">
            <UserIcon className="h-3 w-3" /> Employee Details
          </div>
          <div className="space-y-1.5 border-l-2 border-primary/20 pl-4">
            <p className="text-lg font-bold">{employee.name} {employee.surname}</p>
            <div className="grid grid-cols-2 gap-x-4 text-xs">
              <span className="text-muted-foreground">Employee Code:</span>
              <span className="font-semibold">{employee.employeeCode}</span>
              <span className="text-muted-foreground">ID Number:</span>
              <span className="font-semibold">{employee.idNumber}</span>
              <span className="text-muted-foreground">Job Title:</span>
              <span className="font-semibold">{employee.jobTitle}</span>
              <span className="text-muted-foreground">Tax Number:</span>
              <span className="font-semibold">{employee.taxNumber || 'N/A'}</span>
            </div>
          </div>
        </div>

        {/* Company Info */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-xs font-black uppercase text-muted-foreground tracking-widest">
            <Landmark className="h-3 w-3" /> Company Details
          </div>
          <div className="space-y-1.5 border-l-2 border-slate-200 pl-4 text-xs">
            <p className="font-bold">{client.companyName || client.name}</p>
            <p className="text-muted-foreground">{client.registrationNumber || 'N/A'}</p>
            <p className="text-muted-foreground">PAYE Ref: {client.payeReference || 'N/A'}</p>
            {client.address && (
              <p className="text-muted-foreground max-w-[200px]">
                {client.address.street}, {client.address.city}
              </p>
            )}
          </div>
        </div>
      </div>

      <Separator className="mb-8" />

      {/* Financials Table */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-0 border rounded-xl overflow-hidden mb-8">
        {/* Earnings Column */}
        <div className="p-6 space-y-4 bg-white">
          <h3 className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
            <ReceiptText className="h-4 w-4 text-green-600" /> Earnings
          </h3>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Basic Salary</span>
              <span className="font-bold">{formatPrice(earnings.basic)}</span>
            </div>
            {earnings.overtime && (
              <div className="flex justify-between text-sm">
                <span>Overtime</span>
                <span className="font-bold">{formatPrice(earnings.overtime)}</span>
              </div>
            )}
            {earnings.bonus && (
              <div className="flex justify-between text-sm">
                <span>Bonus</span>
                <span className="font-bold">{formatPrice(earnings.bonus)}</span>
              </div>
            )}
            {earnings.allowances && (
              <div className="flex justify-between text-sm">
                <span>Allowances</span>
                <span className="font-bold">{formatPrice(earnings.allowances)}</span>
              </div>
            )}
          </div>
        </div>

        {/* Deductions Column */}
        <div className="p-6 space-y-4 bg-slate-50 border-l md:border-l">
          <h3 className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
            <ReceiptText className="h-4 w-4 text-destructive" /> Deductions
          </h3>
          <div className="space-y-2">
            <div className="flex justify-between text-sm text-destructive font-medium">
              <span>PAYE (Income Tax)</span>
              <span>{formatPrice(deductions.paye)}</span>
            </div>
            <div className="flex justify-between text-sm text-destructive font-medium">
              <span>UIF</span>
              <span>{formatPrice(deductions.uif)}</span>
            </div>
            {deductions.sdl && (
              <div className="flex justify-between text-sm text-destructive font-medium">
                <span>SDL</span>
                <span>{formatPrice(deductions.sdl)}</span>
              </div>
            )}
            {deductions.pension && (
              <div className="flex justify-between text-sm text-destructive font-medium">
                <span>Pension Fund</span>
                <span>{formatPrice(deductions.pension)}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Net Pay Box */}
      <div className="bg-slate-900 rounded-xl p-6 text-white flex justify-between items-center mb-8">
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest opacity-60">Net Pay</p>
          <p className="text-xs opacity-80">Final amount to be paid</p>
        </div>
        <p className="text-4xl font-black tabular-nums">{formatPrice(payslip.netPay)}</p>
      </div>

      {/* Banking Info Footer */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-end">
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-[10px] font-black uppercase text-muted-foreground tracking-widest">
            <CreditCard className="h-3 w-3" /> Payment Destination
          </div>
          <div className="text-xs space-y-1">
            <p><span className="text-muted-foreground">Bank:</span> <span className="font-bold">{employee.bankingDetails.bankName}</span></p>
            <p><span className="text-muted-foreground">Account:</span> <span className="font-mono font-bold">{employee.bankingDetails.accountNumber}</span></p>
            <p><span className="text-muted-foreground">Type:</span> <span className="font-bold">{employee.bankingDetails.accountType}</span></p>
          </div>
        </div>
        <div className="text-right space-y-1">
          <p className="text-[10px] text-muted-foreground italic">Electronic Payslip Generated on {format(payslip.date.toDate(), 'PPP')}</p>
          <p className="text-[10px] text-muted-foreground font-bold">My Accountant AI Payroll</p>
        </div>
      </div>
    </div>
  );
}
