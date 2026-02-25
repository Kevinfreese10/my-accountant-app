
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

function toErrorMessage(x: unknown): string {
  if (typeof x === "string") return x;
  if (x instanceof Error) return x.message;
  if (x && typeof x === "object") {
    // common API shapes: { message }, { error }, { errors: [...] }
    const anyX = x as any;
    if (typeof anyX.message === "string") return anyX.message;
    if (typeof anyX.error === "string") return anyX.error;
    try { return JSON.stringify(x); } catch {}
  }
  return "Something went wrong while generating the invoice.";
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
        let serverError: unknown = "Failed to generate invoice PDF.";

        try {
          const data = await response.json();
          serverError = data?.message ?? data?.error ?? data ?? serverError;
        } catch {
          // response wasn't JSON
          try {
            const text = await response.text();
            if (text) serverError = text;
          } catch {}
        }

        throw new Error(toErrorMessage(serverError));
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

    } catch (err: any) {
      console.error('Download error:', err);
      
      const displayMessage = toErrorMessage(err);

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
