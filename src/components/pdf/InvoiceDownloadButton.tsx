
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Download, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Invoice, User, ClientCustomer } from '@/lib/types';

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
      const response = await fetch(`/api/invoices/${invoice.id}/pdf`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ invoice, client, customer }),
      });

      if (!response.ok) {
        let serverError = 'Failed to generate PDF';
        try {
          const errorData = await response.json();
          serverError = typeof errorData.error === 'string' ? errorData.error : serverError;
        } catch (parseError) {
          // If response is not JSON (e.g. HTML error page), use default message
        }
        throw new Error(serverError);
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Invoice-${invoice.id}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);

    } catch (error: any) {
      console.error('Download error:', error);
      
      // CRITICAL: Ensure description is always a primitive string to avoid React error #31
      let displayMessage = 'An unexpected error occurred while generating the PDF.';
      if (error && typeof error.message === 'string') {
        displayMessage = error.message;
      } else if (typeof error === 'string') {
        displayMessage = error;
      }

      toast({
        title: 'Download Failed',
        description: displayMessage,
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
