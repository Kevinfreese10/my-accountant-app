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

      // 1. Branding / Logo Placeholder or Title
      doc.setTextColor(33, 67, 146);
      doc.setFontSize(22);
      doc.setFont('helvetica', 'bold');
      doc.text(client.companyName || client.name || 'Company', 20, 25);

      // 2. Company Details (Left)
      doc.setTextColor(100);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      
      let companyY = 32;
      const renderAddress = (address: any, startY: number) => {
          let currY = startY;
          if (typeof address === 'string') {
              address.split(',').forEach(line => {
                  doc.text(line.trim(), 20, currY);
                  currY += 5;
              });
          } else if (typeof address === 'object') {
              [address.street, address.suburb, address.city, address.province, address.zip]
                  .filter(Boolean)
                  .forEach(line => {
                      doc.text(line, 20, currY);
                      currY += 5;
                  });
          }
          return currY;
      };

      companyY = renderAddress(client.address, companyY);
      if (client.isVatRegistered && client.vatNumber) {
          doc.text(`VAT Reg: ${client.vatNumber}`, 20, companyY);
          companyY += 5;
      }

      // 3. Invoice Header Details (Right)
      doc.setTextColor(200);
      doc.setFontSize(28);
      doc.setFont('helvetica', 'bold');
      doc.text('TAX INVOICE', 190, 25, { align: 'right' });

      doc.setTextColor(100);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text(`Invoice Number:`, 150, 35);
      doc.text(`Date:`, 150, 40);
      doc.text(`Due Date:`, 150, 45);

      doc.setFont('helvetica', 'normal');
      doc.text(invoice.id, 190, 35, { align: 'right' });
      doc.text(format(new Date(invoice.invoiceDate), 'dd/MM/yyyy'), 190, 40, { align: 'right' });
      doc.text(format(new Date(invoice.dueDate), 'dd/MM/yyyy'), 190, 45, { align: 'right' });

      // 4. Bill To (Left)
      let customerY = 70;
      doc.setFont('helvetica', 'bold');
      doc.text('BILL TO:', 20, customerY);
      customerY += 6;
      doc.setFontSize(11);
      doc.setTextColor(0);
      doc.text(customer.name, 20, customerY);
      customerY += 6;
      doc.setFontSize(9);
      doc.setTextColor(100);
      customerY = renderAddress(customer.address, customerY);
      if (customer.vatNumber) {
          doc.text(`VAT Reg: ${customer.vatNumber}`, 20, customerY);
      }

      // 5. Line Items Table
      const tableRows = invoice.lineItems.map(item => {
          const subtotal = item.rate * item.quantity;
          const vat = item.vatType === 'standard_rated_sales' ? subtotal * 0.15 : 0;
          const total = subtotal + vat;
          return [
              item.description,
              item.quantity.toString(),
              new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' }).format(item.rate),
              new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' }).format(vat),
              new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' }).format(total),
          ];
      });

      autoTable(doc, {
          startY: 100,
          head: [['Description', 'Qty', 'Rate (Excl)', 'VAT', 'Total (Incl)']],
          body: tableRows,
          theme: 'striped',
          headStyles: { fillColor: primaryColor, textColor: 255, fontSize: 8, fontStyle: 'bold' },
          bodyStyles: { fontSize: 9 },
          columnStyles: {
              0: { cellWidth: 'auto' },
              1: { cellWidth: 15, halign: 'center' },
              2: { cellWidth: 35, halign: 'right' },
              3: { cellWidth: 35, halign: 'right' },
              4: { cellWidth: 35, halign: 'right' },
          },
      });

      // 6. Totals
      let finalY = (doc as any).lastAutoTable.finalY + 10;
      doc.setFontSize(10);
      doc.setTextColor(100);
      doc.text('Subtotal (Excl):', 150, finalY);
      doc.text(new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' }).format(invoice.subtotal), 190, finalY, { align: 'right' });
      finalY += 6;
      doc.text('Total VAT (15%):', 150, finalY);
      doc.text(new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' }).format(invoice.vat), 190, finalY, { align: 'right' });
      finalY += 10;
      doc.setFontSize(14);
      doc.setTextColor(0);
      doc.setFont('helvetica', 'bold');
      doc.text('Grand Total:', 150, finalY);
      doc.text(new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' }).format(invoice.total), 190, finalY, { align: 'right' });

      // 7. Banking Details (Footerish)
      finalY += 20;
      if (client.bankingDetails?.bankName && client.bankingDetails?.accountNumber) {
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

      // 9. Page Numbers & Legal
      const pageCount = (doc as any).internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
          doc.setPage(i);
          doc.setFontSize(8);
          doc.setTextColor(150);
          doc.text('Thank you for your business! Generated by My Accountant AI.', 105, 285, { align: 'center' });
          doc.text(`Page ${i} of ${pageCount}`, 190, 285, { align: 'right' });
      }

      doc.save(`Invoice-${invoice.id}.pdf`);
      toast({ title: 'Download Successful', description: `Invoice ${invoice.id} saved to your device.` });

    } catch (err: any) {
      console.error('PDF Generation error:', err);
      toast({
        title: 'Download Failed',
        description: 'An error occurred while generating your PDF.',
        variant: 'destructive',
      });
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
