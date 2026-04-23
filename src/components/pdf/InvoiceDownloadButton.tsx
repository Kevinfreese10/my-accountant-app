'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Download, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Invoice, User, ClientCustomer } from '@/lib/types';
import { format } from 'date-fns';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface InvoiceDownloadButtonProps {
  invoice: Invoice;
  client: User | null;
  customer: ClientCustomer | undefined;
}

export default function InvoiceDownloadButton({ invoice, client, customer }: InvoiceDownloadButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleDownload = async () => {
    if (!client || !customer) {
      toast({ title: 'Error', description: 'Client or customer data is missing.', variant: 'destructive' });
      return;
    }
    setIsLoading(true);

    try {
      const doc = new jsPDF();
      const primaryColor = [33, 67, 146]; // #214392 in RGB

      // Helper for clean currency formatting using en-GB to ensure dot decimals
      const formatCurrency = (val: number) => {
          return `R ${val.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      };

      // 1. Branding / Title
      doc.setTextColor(33, 67, 146);
      doc.setFontSize(22);
      doc.setFont('helvetica', 'bold');
      doc.text(client.companyName || client.name || 'Company', 20, 25);

      // 2. Company Details (Left)
      doc.setTextColor(100);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      
      let currentY = 32;
      const renderAddress = (address: any, startY: number) => {
          let currY = startY;
          if (typeof address === 'string') {
              const lines = address.split(',').map(part => part.trim()).filter(Boolean);
              lines.forEach((line: string) => {
                  doc.text(line, 20, currY);
                  currY += 5;
              });
          } else if (typeof address === 'object' && address !== null) {
              const lines = [address.street, address.suburb, address.city, address.province, address.zip]
                  .filter(Boolean);
              lines.forEach(line => {
                  doc.text(String(line), 20, currY);
                  currY += 5;
              });
          }
          return currY;
      };

      currentY = renderAddress(client.address, currentY);
      if (client.isVatRegistered && client.vatNumber) {
          doc.text(`VAT Reg: ${client.vatNumber}`, 20, currentY);
          currentY += 5;
      }

      // 3. Invoice Header Details (Right)
      doc.setTextColor(200);
      doc.setFontSize(28);
      doc.setFont('helvetica', 'bold');
      doc.text('TAX INVOICE', 190, 25, { align: 'right' });

      doc.setTextColor(100);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text(`Invoice Number:`, 140, 35);
      doc.text(`Date:`, 140, 40);
      doc.text(`Due Date:`, 140, 45);

      doc.setFont('helvetica', 'normal');
      doc.text(invoice.id, 190, 35, { align: 'right' });
      doc.text(format(new Date(invoice.invoiceDate), 'dd/MM/yyyy'), 190, 40, { align: 'right' });
      doc.text(format(new Date(invoice.dueDate), 'dd/MM/yyyy'), 190, 45, { align: 'right' });

      // 4. Bill To (Left) - Dynamically positioned after company info
      currentY = Math.max(currentY + 15, 75);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(100);
      doc.text('BILL TO:', 20, currentY);
      currentY += 6;
      doc.setFontSize(11);
      doc.setTextColor(0);
      doc.text(customer.name, 20, currentY);
      currentY += 6;
      doc.setFontSize(9);
      doc.setTextColor(100);
      currentY = renderAddress(customer.address, currentY);
      if (customer.vatNumber) {
          doc.text(`VAT Reg: ${customer.vatNumber}`, 20, currentY);
          currentY += 5;
      }

      // 5. Line Items Table
      const tableRows = invoice.lineItems.map(item => {
          const subtotal = item.rate * item.quantity;
          const vat = item.vatType === 'standard_rated_sales' ? subtotal * 0.15 : 0;
          const total = subtotal + vat;
          return [
              item.description,
              item.quantity.toString(),
              formatCurrency(item.rate),
              formatCurrency(vat),
              formatCurrency(total),
          ];
      });

      autoTable(doc, {
          startY: currentY + 10,
          head: [['Description', 'Qty', 'Rate (Excl)', 'VAT', 'Total (Incl)']],
          body: tableRows,
          theme: 'striped',
          headStyles: { 
              fillColor: primaryColor, 
              textColor: 255, 
              fontSize: 8, 
              fontStyle: 'bold',
          },
          bodyStyles: { fontSize: 9 },
          columnStyles: {
              0: { cellWidth: 'auto', halign: 'left' },
              1: { cellWidth: 15, halign: 'center' },
              2: { cellWidth: 35, halign: 'right' },
              3: { cellWidth: 35, halign: 'right' },
              4: { cellWidth: 35, halign: 'right' },
          },
          didParseCell: (data) => {
              // Ensure header text alignment matches body data alignment
              if (data.section === 'head') {
                  if (data.column.index === 1) data.cell.styles.halign = 'center';
                  if (data.column.index >= 2) data.cell.styles.halign = 'right';
              }
          }
      });

      // 6. Totals Section
      let finalY = (doc as any).lastAutoTable.finalY + 10;
      doc.setFontSize(10);
      doc.setTextColor(100);
      doc.setFont('helvetica', 'normal');
      
      const labelX = 130; // Shift labels left to avoid overlap
      const amountX = 190;

      doc.text('Subtotal (Excl):', labelX, finalY);
      doc.text(formatCurrency(invoice.subtotal), amountX, finalY, { align: 'right' });
      
      finalY += 7;
      doc.text('Total VAT (15%):', labelX, finalY);
      doc.text(formatCurrency(invoice.vat), amountX, finalY, { align: 'right' });
      
      finalY += 12;
      doc.setFontSize(14);
      doc.setTextColor(0);
      doc.setFont('helvetica', 'bold');
      doc.text('Grand Total:', labelX, finalY);
      doc.text(formatCurrency(invoice.total), amountX, finalY, { align: 'right' });

      // 7. Banking Details
      finalY += 20;
      if (client.bankingDetails?.bankName && client.bankingDetails?.accountNumber) {
          if (finalY > 240) { doc.addPage(); finalY = 20; }

          doc.setFillColor(250, 250, 250);
          doc.rect(20, finalY, 170, 35, 'F');
          doc.setDrawColor(230, 230, 230);
          doc.rect(20, finalY, 170, 35, 'S');
          
          let bankY = finalY + 8;
          doc.setFontSize(9);
          doc.setTextColor(100);
          doc.setFont('helvetica', 'bold');
          doc.text('BANKING DETAILS', 25, bankY);
          bankY += 6;
          doc.setFont('helvetica', 'normal');
          doc.text(`Bank: ${client.bankingDetails.bankName}`, 25, bankY);
          doc.text(`Account Holder: ${client.bankingDetails.accountHolder}`, 100, bankY);
          bankY += 5;
          doc.text(`Account: ${client.bankingDetails.accountNumber}`, 25, bankY);
          doc.text(`Branch: ${client.bankingDetails.branchCode}`, 100, bankY);
          finalY += 45;
      }

      // 8. Notes
      if (invoice.notes) {
          if (finalY > 260) { doc.addPage(); finalY = 20; }
          doc.setFontSize(8);
          doc.setTextColor(150);
          doc.setFont('helvetica', 'bold');
          doc.text('NOTES / PAYMENT INSTRUCTIONS', 20, finalY);
          finalY += 5;
          doc.setFont('helvetica', 'italic');
          doc.setTextColor(100);
          const splitNotes = doc.splitTextToSize(invoice.notes, 170);
          doc.text(splitNotes, 20, finalY);
      }

      // 9. Footer
      const pageCount = (doc as any).internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
          doc.setPage(i);
          doc.setFontSize(8);
          doc.setTextColor(150);
          doc.text('Generated by My Accountant AI Engine. Thank you for your business!', 105, 285, { align: 'center' });
          doc.text(`Page ${i} of ${pageCount}`, 190, 285, { align: 'right' });
      }

      doc.save(`Invoice-${invoice.id}.pdf`);
      toast({ title: 'Download Successful', description: `Invoice ${invoice.id} has been saved.` });

    } catch (err: any) {
      console.error('PDF Generation error:', err);
      toast({ title: 'Download Failed', description: 'An error occurred while generating your PDF.', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button onClick={handleDownload} disabled={isLoading}>
      {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
      {isLoading ? 'Generating...' : 'Download PDF'}
    </Button>
  );
}
