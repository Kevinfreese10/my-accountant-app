
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Download, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Payslip, Employee, User, PayslipItem } from '@/lib/types';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';

interface PayslipDownloadButtonProps {
  payslip: Payslip;
  employee: Employee;
  client: User;
  currentData?: {
      earnings: PayslipItem[];
      metricDeductions?: any;
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

      // Helper for clean currency formatting
      const formatCurr = (num: number) => `R ${num.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

      // 1. Header & Branding
      doc.setTextColor(33, 67, 146);
      doc.setFontSize(22);
      doc.setFont('helvetica', 'bold');
      doc.text(String(client.companyName || client.name || 'Practice'), 20, 25);

      doc.setFontSize(10);
      doc.setTextColor(150);
      doc.text('PAYSLIP • CONFIDENTIAL', 190, 25, { align: 'right' });

      // 2. Company Details (Left - Dynamic)
      doc.setFontSize(8);
      doc.setTextColor(100);
      doc.setFont('helvetica', 'normal');
      let currentLeftY = 32;
      
      if (client.registrationNumber) {
          doc.text(`Registration No: ${client.registrationNumber}`, 20, currentLeftY);
          currentLeftY += 5;
      }
      if (client.payeReference) {
          doc.text(`PAYE Ref: ${client.payeReference}`, 20, currentLeftY);
          currentLeftY += 5;
      }
      if (client.address) {
          const addr = client.address;
          const addrLines = [addr.street, addr.suburb, addr.city, addr.zip].filter(Boolean);
          if (addrLines.length > 0) {
              const addrStr = addrLines.join(', ');
              const splitAddr = doc.splitTextToSize(addrStr, 80);
              doc.text(splitAddr, 20, currentLeftY);
              currentLeftY += (splitAddr.length * 4);
          }
      }

      // 3. Info Grid (Right)
      doc.setTextColor(100);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text('PAY PERIOD:', 140, 35);
      doc.setFont('helvetica', 'normal');
      doc.text(String(payslip.period || 'N/A'), 190, 35, { align: 'right' });

      doc.setFont('helvetica', 'bold');
      doc.text('DATE ISSUED:', 140, 40);
      doc.setFont('helvetica', 'normal');
      doc.text(String(new Date().toLocaleDateString('en-ZA')), 190, 40, { align: 'right' });

      // 4. Employee Column
      const startY = Math.max(currentLeftY + 10, 55);
      doc.setTextColor(0);
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text(`${String(employee.name || '')} ${String(employee.surname || '')}`, 20, startY);
      
      doc.setTextColor(100);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      
      const joinDate = employee.joinDate?.toDate ? employee.joinDate.toDate() : new Date(employee.joinDate);
      const formattedJoinDate = !isNaN(joinDate.getTime()) ? format(joinDate, 'dd MMM yyyy') : 'N/A';

      let empInfoY = startY + 7;
      doc.text(`Employee Code: ${String(employee.employeeCode || 'N/A')}`, 20, empInfoY);
      doc.text(`ID Number: ${String(employee.idNumber || 'N/A')}`, 20, empInfoY + 5);
      doc.text(`Start Date: ${formattedJoinDate}`, 20, empInfoY + 10);
      doc.text(`Job Title: ${String(employee.jobTitle || 'N/A')}`, 20, empInfoY + 15);
      doc.text(`Department: ${String(employee.department || 'N/A')}`, 20, empInfoY + 20);

      // 5. Tables
      // Earnings Table
      autoTable(doc, {
          startY: empInfoY + 30,
          head: [['Earnings', 'Amount']],
          body: p.earnings.map(i => [String(i.label), formatCurr(i.amount)]),
          theme: 'striped',
          headStyles: { fillColor: primaryColor, fontSize: 9 },
          columnStyles: { 1: { halign: 'right', fontStyle: 'bold' } },
          margin: { left: 20, right: 20 },
          didParseCell: (data) => {
              if (data.section === 'head' && data.column.index === 1) {
                  data.cell.styles.halign = 'right';
              }
          }
      });

      // Deductions Table
      autoTable(doc, {
          startY: (doc as any).lastAutoTable.finalY + 10,
          head: [['Deductions', 'Amount']],
          body: p.deductions.map(i => [String(i.label), formatCurr(i.amount)]),
          theme: 'striped',
          headStyles: { fillColor: [185, 28, 28], fontSize: 9 }, // Red
          columnStyles: { 1: { halign: 'right', fontStyle: 'bold' } },
          margin: { left: 20, right: 20 },
          didParseCell: (data) => {
              if (data.section === 'head' && data.column.index === 1) {
                  data.cell.styles.halign = 'right';
              }
          }
      });

      // Contributions & Fringe Table
      const otherBody = [
          ...p.contributions.map(i => [`Employer: ${String(i.label)}`, formatCurr(i.amount)]),
          ...p.fringeBenefits.map(i => [`Fringe: ${String(i.label)}`, formatCurr(i.amount)])
      ];

      if (otherBody.length > 0) {
          autoTable(doc, {
              startY: (doc as any).lastAutoTable.finalY + 10,
              head: [['Contributions & Benefits', 'Value']],
              body: otherBody,
              theme: 'striped',
              headStyles: { fillColor: [75, 85, 99], fontSize: 9 }, // Gray
              columnStyles: { 1: { halign: 'right' } },
              margin: { left: 20, right: 20 },
              didParseCell: (data) => {
                  if (data.section === 'head' && data.column.index === 1) {
                      data.cell.styles.halign = 'right';
                  }
              }
          });
      }

      // 6. Summary Box
      const finalY = (doc as any).lastAutoTable.finalY + 15;
      
      doc.setFillColor(33, 67, 146);
      doc.rect(20, finalY, 170, 20, 'F');
      
      doc.setTextColor(255);
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('NET PAY', 25, finalY + 13);
      doc.setFontSize(18);
      doc.text(formatCurr(p.netPay), 185, finalY + 13, { align: 'right' });

      // 7. Banking
      const bankY = finalY + 35;
      doc.setTextColor(100);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.text('PAYMENT DETAILS', 20, bankY);
      doc.setFont('helvetica', 'normal');
      doc.text(`${String(employee.bankingDetails?.bankName || 'N/A')} • ${String(employee.bankingDetails?.accountNumber || '')} • ${String(employee.bankingDetails?.accountType || '')}`, 20, bankY + 5);

      // 8. Footer
      doc.setFontSize(8);
      doc.setTextColor(180);
      doc.text(`Generated by My Accountant AI Payroll Engine on ${new Date().toLocaleString()}`, 105, 285, { align: 'center' });

      doc.save(`Payslip-${String(employee.surname || 'Employee')}-${payslip.period.replace(/\s/g, '-')}.pdf`);
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
      {isLoading ? 'Generating...' : 'Download PDF'}
    </Button>
  );
}
