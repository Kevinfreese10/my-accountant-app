import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle } from 'lucide-react';
import { Metadata } from 'next';
import { getStaticPageMetadata } from '@/lib/seo-utils';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function generateMetadata(): Promise<Metadata> {
    const defaults: Metadata = {
        title: 'Refund Policy | My Accountant',
        description: 'Understand the terms and conditions for refunds on services purchased from My Accountant.',
    };
    return getStaticPageMetadata('refund-policy', defaults);
}

export default function RefundPolicyPage() {
  return (
    <div className="container mx-auto max-w-2xl px-4 py-12">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            <AlertCircle className="h-6 w-6 text-primary" />
            Refund Policy
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
            <p className="text-muted-foreground">Our refund policy for accounting and compliance services is as follows:</p>
            <ul className="list-disc space-y-2 pl-6 text-muted-foreground">
                <li>All services are non-refundable once the work has begun.</li>
                <li>Refunds may be considered only if the service has not yet started.</li>
                <li>A processing fee of 10% will be deducted from any approved refund.</li>
                <li>Refund requests must be submitted within 48 hours of purchase.</li>
            </ul>
            <p className="font-semibold text-foreground">
                Please ensure you have all required documents ready before purchasing, as delays in providing documentation may affect service delivery times.
            </p>
        </CardContent>
      </Card>
    </div>
  );
}
