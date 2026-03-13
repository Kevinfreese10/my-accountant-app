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

/**
 * Safely converts any unknown error type into a displayable string.
 * Prevents React Error #31 by ensuring objects/React elements are not returned.
 */
function toErrorMessage(x: unknown): string {
  try {
    if (typeof x === "string") return x;
    if (!x) return "An unexpected error occurred.";
    
    const anyX = x as any;

    // Specifically catch React elements or objects with React-like properties
    // which cause Error #31 when rendered as children in the toast.
    if (anyX.$$typeof || anyX._owner || anyX.props) {
      return "A service error occurred (rendering element detected).";
    }

    if (x instanceof Error) {
      return typeof x.message === "string" ? x.message : String(x.message);
    }
    
    if (typeof x === "object") {
      if (typeof anyX.message === "string") return anyX.message;
      if (typeof anyX.error === "string") return anyX.error;
      
      const stringified = JSON.stringify(x);
      return (stringified && stringified !== '{}') ? stringified : String(x);
    }
    
    return String(x);
  } catch {
    return "Something went wrong while processing the error.";
  }
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
          // Attempt to parse JSON error first
          const data = await response.json();
          serverError = data?.message ?? data?.error ?? data ?? serverError;
        } catch {
          // Fallback to text if JSON parsing fails
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
      
      // Ensure the message passed to the toast is strictly a string
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
