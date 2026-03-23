
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
      const p = currentData || payslip;
      
      const primaryColor = [0, 0, 0];
      const grayColor = [100, 100, 100];
      const lightGray = [240, 240, 240];

      const formatCurr = (num: number) => {
          if (num === 0) return '0.00';
          // South African formatting: R 100 000,00 (space for thousands, comma for decimals)
          return num.toLocaleString('en-ZA', { 
              minimumFractionDigits: 2, 
              maximumFractionDigits: 2 
          }).replace(',', ' ').replace('.', ',');
      };

      // --- 1. Company Header (Top Left) ---
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text(String(client.companyName || client.name).toUpperCase(), 15, 15);
      
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      let currentY = 20;
      
      if (client.address) {
          const addr = client.address;
          const addrLines = [addr.street, addr.suburb, addr.city, addr.zip].filter(Boolean);
          addrLines.forEach(line => {
              doc.text(String(line), 15, currentY);
              currentY += 5;
          });
      }

      // --- 2. Pay Date (Top Center) ---
      doc.setFont('helvetica', 'bold');
      doc.text('Pay Date', 80, 15);
      doc.setFont('helvetica', 'normal');
      doc.text(format(new Date(), 'yyyy/MM/dd'), 105, 15);

      // --- 3. Logo (Top Right) ---
      if (client.logoUrl) {
          try {
              doc.addImage(client.logoUrl, 'PNG', 160, 10, 35, 15);
          } catch (e) {
              console.warn("Logo failed to load for PDF");
          }
      }

      currentY = 45;
      doc.setDrawColor(200);
      doc.line(15, currentY, 195, currentY);
      currentY += 7;

      // --- 4. Employee Info Grid (3 Columns) ---
      const col1X = 15;
      const col2X = 80;
      const col3X = 140;

      const drawLabelValue = (label: string, value: string, x: number, y: number) => {
          doc.setFont('helvetica', 'bold');
          doc.text(label, x, y);
          doc.setFont('helvetica', 'normal');
          doc.text(value, x + 30, y);
      };

      // Row 1
      drawLabelValue('Employee', `${employee.name} ${employee.surname}`, col1X, currentY);
      drawLabelValue('Employee Code', employee.employeeCode, col2X, currentY);
      drawLabelValue('Pay Method', 'EFT', col3X, currentY);
      currentY += 6;

      // Row 2
      drawLabelValue('Job title', employee.jobTitle || 'N/A', col1X, currentY);
      drawLabelValue('Identity Number', employee.idNumber, col2X, currentY);
      drawLabelValue('Bank Name', employee.bankingDetails?.bankName || 'N/A', col3X, currentY);
      currentY += 6;

      // Row 3
      drawLabelValue('Address', '', col1X, currentY);
      drawLabelValue('Employed from', employee.joinDate?.toDate ? format(employee.joinDate.toDate(), 'yyyy/MM/dd') : 'N/A', col2X, currentY);
      drawLabelValue('Branch Code', employee.bankingDetails?.branchCode || 'N/A', col3X, currentY);
      
      let addrY = currentY;
      if (employee.address) {
          const lines = [employee.address.street, employee.address.suburb, employee.address.city, employee.address.zip].filter(Boolean);
          lines.forEach(line => {
              doc.text(String(line), col1X + 30, addrY);
              addrY += 5;
          });
      }
      
      const hourlyRate = p.grossPay / 160;
      drawLabelValue('Rate per hour', formatCurr(hourlyRate), col2X, currentY + 6);
      drawLabelValue('Account Number', employee.bankingDetails?.accountNumber || 'N/A', col3X, currentY + 6);

      currentY = Math.max(addrY, currentY + 15);
      doc.line(15, currentY, 195, currentY);
      currentY += 2;

      // --- 5. Main Financial Tables ---
      const tableStartY = currentY;

      // Table 1: Earnings (Left)
      autoTable(doc, {
          startY: tableStartY,
          margin: { left: 15, right: 105 },
          head: [['Earnings', 'Units', 'Amount']],
          body: p.earnings.map(i => [i.label, '', formatCurr(i.amount)]),
          theme: 'plain',
          headStyles: { fontStyle: 'bold', fontSize: 9, textColor: 0, lineWidth: { bottom: 0.1 } },
          columnStyles: { 
              0: { cellWidth: 45, halign: 'left' }, 
              1: { cellWidth: 20, halign: 'right' }, 
              2: { cellWidth: 25, halign: 'right' } 
          },
          didParseCell: (data) => {
              if (data.section === 'head' && data.column.index >= 1) {
                  data.cell.styles.halign = 'right';
              }
          }
      });

      const earningsY = (doc as any).lastAutoTable.finalY;

      doc.setFillColor(240, 240, 240);
      doc.rect(15, earningsY, 90, 7, 'F');
      doc.setFont('helvetica', 'bold');
      doc.text('Total earnings', 17, earningsY + 5);
      doc.text(formatCurr(p.grossPay), 103, earningsY + 5, { align: 'right' });

      // Table 2: Deductions (Right)
      autoTable(doc, {
          startY: tableStartY,
          margin: { left: 105, right: 15 },
          head: [['Deductions', 'Opening balance', 'Amount']],
          body: p.deductions.map(i => [i.label, '', formatCurr(i.amount)]),
          theme: 'plain',
          headStyles: { fontStyle: 'bold', fontSize: 9, textColor: 0, lineWidth: { bottom: 0.1 } },
          columnStyles: { 
              0: { cellWidth: 40, halign: 'left' }, 
              1: { cellWidth: 25, halign: 'right' }, 
              2: { cellWidth: 25, halign: 'right' } 
          },
          didParseCell: (data) => {
              if (data.section === 'head' && data.column.index >= 1) {
                  data.cell.styles.halign = 'right';
              }
          }
      });

      const deductionsY = (doc as any).lastAutoTable.finalY;

      doc.setFillColor(240, 240, 240);
      doc.rect(105, deductionsY, 90, 7, 'F');
      doc.setFont('helvetica', 'bold');
      doc.text('Total deductions', 107, deductionsY + 5);
      doc.text(formatCurr(p.grossPay - p.netPay), 193, deductionsY + 5, { align: 'right' });

      doc.setFillColor(220, 220, 220);
      doc.rect(105, deductionsY + 7, 90, 7, 'F');
      doc.text('Nett pay', 107, deductionsY + 12);
      doc.text(formatCurr(p.netPay), 193, deductionsY + 12, { align: 'right' });

      currentY = Math.max(earningsY + 20, deductionsY + 25);

      // --- 6. Secondary Financial Tables ---
      
      // Table 3: Company Contributions (Left)
      autoTable(doc, {
          startY: currentY,
          margin: { left: 15, right: 105 },
          head: [['Company Contributions', 'Amount']],
          body: p.contributions.map(i => [i.label, formatCurr(i.amount)]),
          theme: 'plain',
          headStyles: { fontStyle: 'bold', fontSize: 9, textColor: 0, lineWidth: { bottom: 0.1 } },
          columnStyles: { 
              0: { cellWidth: 65, halign: 'left' }, 
              1: { cellWidth: 25, halign: 'right' } 
          },
          didParseCell: (data) => {
              if (data.section === 'head' && data.column.index === 1) {
                  data.cell.styles.halign = 'right';
              }
          }
      });

      // Table 4: YTD Totals (Right)
      const taxPaid = p.deductions.find(d => d.label === 'Tax')?.amount || 0;
      autoTable(doc, {
          startY: currentY,
          margin: { left: 105, right: 15 },
          head: [['YTD Totals', 'Amount']],
          body: [
              ['Taxable earnings', formatCurr(p.grossPay)],
              ['Taxable company contributions', formatCurr(0)],
              ['Taxable fringe benefits', formatCurr(0)],
              ['Provision for tax on annual bonus', formatCurr(0)],
              ['Tax paid', formatCurr(taxPaid)],
          ],
          theme: 'plain',
          headStyles: { fontStyle: 'bold', fontSize: 9, textColor: 0, lineWidth: { bottom: 0.1 } },
          columnStyles: { 
              0: { cellWidth: 65, halign: 'left' }, 
              1: { cellWidth: 25, halign: 'right' } 
          },
          didParseCell: (data) => {
              if (data.section === 'head' && data.column.index === 1) {
                  data.cell.styles.halign = 'right';
              }
          }
      });

      // Footer
      doc.setFontSize(7);
      doc.setTextColor(150);
      doc.text('Generated by My Accountant AI Payroll', 105, 285, { align: 'center' });

      doc.save(`Payslip-${employee.surname}-${(p.period || 'Current').replace(/\s/g, '-')}.pdf`);
      toast({ title: 'Download Successful' });
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
