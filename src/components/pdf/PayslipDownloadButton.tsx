'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Download, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Payslip, Employee, User, PayslipItem } from '@/lib/types';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface PayslipDownloadButtonProps {
  payslip: Payslip;
  employee: Employee;
  client: User;
  currentData?: {
      earnings: PayslipItem[];
      deductions: PayslipItem[];
      contributions: PayslipItem[];
      fringeBenefits: PayslipItem[];
      netPay: number;
      grossPay: number;
  }
}

export default function PayslipDownloadButton({ payslip, employee, client, currentData }: PayslipDownloadButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleDownload = async () => {
    setIsLoading(true);
    try {
      const doc = new jsPDF();
      const p = currentData || payslip; // Use current editor state if provided
      const primaryColor = [33, 67, 146]; // #214392

      // 1. Header & Branding
      doc.setTextColor(33, 67, 146);
      doc.setFontSize(22);
      doc.setFont('helvetica', 'bold');
      doc.text(client.companyName || client.name, 20, 25);

      doc.setFontSize(10);
      doc.setTextColor(150);
      doc.text('PAYSLIP • CONFIDENTIAL', 190, 25, { align: 'right' });

      // 2. Info Grid
      doc.setTextColor(100);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text('PAY PERIOD:', 140, 35);
      doc.setFont('helvetica', 'normal');
      doc.text(p.period, 190, 35, { align: 'right' });

      doc.setFont('helvetica', 'bold');
      doc.text('DATE ISSUED:', 140, 40);
      doc.setFont('helvetica', 'normal');
      doc.text(new Date().toLocaleDateString('en-ZA'), 190, 40, { align: 'right' });

      // Employee Column
      doc.setTextColor(0);
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text(`${employee.name} ${employee.surname}`, 20, 45);
      
      doc.setTextColor(100);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.text(`Employee Code: ${employee.employeeCode}`, 20, 52);
      doc.text(`ID Number: ${employee.idNumber}`, 20, 57);
      doc.text(`Job Title: ${employee.jobTitle}`, 20, 62);
      doc.text(`Department: ${employee.department}`, 20, 67);

      // 3. Tables
      const formatCurr = (num: number) => `R ${num.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}`;

      // Earnings Table
      autoTable(doc, {
          startY: 75,
          head: [['Earnings', 'Amount']],
          body: p.earnings.map(i => [i.label, formatCurr(i.amount)]),
          theme: 'striped',
          headStyles: { fillColor: primaryColor, fontSize: 9 },
          columnStyles: { 1: { halign: 'right', fontStyle: 'bold' } },
          margin: { left: 20, right: 20 }
      });

      // Deductions Table
      autoTable(doc, {
          startY: (doc as any).lastAutoTable.finalY + 10,
          head: [['Deductions', 'Amount']],
          body: p.deductions.map(i => [i.label, formatCurr(i.amount)]),
          theme: 'striped',
          headStyles: { fillColor: [185, 28, 28], fontSize: 9 }, // Red
          columnStyles: { 1: { halign: 'right', fontStyle: 'bold' } },
          margin: { left: 20, right: 20 }
      });

      // Contributions & Fringe Table (Combined for compact view)
      const otherBody = [
          ...p.contributions.map(i => [`Employer: ${i.label}`, formatCurr(i.amount)]),
          ...p.fringeBenefits.map(i => [`Fringe: ${i.label}`, formatCurr(i.amount)])
      ];

      if (otherBody.length > 0) {
          autoTable(doc, {
              startY: (doc as any).lastAutoTable.finalY + 10,
              head: [['Contributions & Benefits', 'Value']],
              body: otherBody,
              theme: 'striped',
              headStyles: { fillColor: [75, 85, 99], fontSize: 9 }, // Gray
              columnStyles: { 1: { halign: 'right' } },
              margin: { left: 20, right: 20 }
          });
      }

      // 4. Summary Box
      const finalY = (doc as any).lastAutoTable.finalY + 15;
      
      // Background for Net Pay
      doc.setFillColor(33, 67, 146);
      doc.rect(20, finalY, 170, 20, 'F');
      
      doc.setTextColor(255);
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('NET PAY', 25, finalY + 13);
      doc.setFontSize(18);
      doc.text(formatCurr(p.netPay), 185, finalY + 13, { align: 'right' });

      // 5. Banking
      const bankY = finalY + 35;
      doc.setTextColor(100);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.text('PAYMENT DETAILS', 20, bankY);
      doc.setFont('helvetica', 'normal');
      doc.text(`${employee.bankingDetails.bankName} • ${employee.bankingDetails.accountNumber} • ${employee.bankingDetails.accountType}`, 20, bankY + 5);

      // 6. Footer
      doc.setFontSize(8);
      doc.setTextColor(180);
      doc.text(`Generated by My Accountant AI Payroll Engine on ${new Date().toLocaleString()}`, 105, 285, { align: 'center' });

      doc.save(`Payslip-${employee.surname}-${p.period.replace(' ', '-')}.pdf`);
      toast({ title: 'Payslip Downloaded' });
    } catch (err) {
      console.error(err);
      toast({ title: 'Download Failed', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button variant="outline" onClick={handleDownload} disabled={isLoading} className="font-bold border-primary/20 text-primary hover:bg-primary/5">
      {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
      Download as PDF
    </Button>
  );
}
