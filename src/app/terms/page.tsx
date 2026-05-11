
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';
import { Metadata } from 'next';
import { getStaticPageMetadata } from '@/lib/seo-utils';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function generateMetadata(): Promise<Metadata> {
    const defaults: Metadata = {
        title: 'Terms & Conditions | My Accountant',
        description: 'Review the official Terms and Conditions for My Accountant services and partner programs.',
    };
    return getStaticPageMetadata('terms', defaults);
}

export default function TermsAndConditionsPage() {
  return (
    <div className="container mx-auto max-w-4xl px-4 py-12">
      <div className="space-y-8">
        <div className="text-center">
          <h1 className="text-4xl font-bold tracking-tight">Terms & Conditions</h1>
          <p className="mt-2 text-lg text-muted-foreground">My Accountant (Pty) Ltd</p>
        </div>
        
        <Card>
            <CardHeader>
                <CardTitle>Effective Date: {new Date().toLocaleDateString('en-ZA')}</CardTitle>
                <div className="text-sm text-muted-foreground">
                    <p><strong>Operator:</strong> My Accountant (Pty) Ltd (“My Accountant”, “we”, “our”, or “us”)</p>
                    <p><strong>Website:</strong> <Link href="https://www.myacc.co.za" className="text-primary hover:underline">www.myacc.co.za</Link></p>
                    <p><strong>Email:</strong> <a href="mailto:info@myacc.co.za" className="text-primary hover:underline">info@myacc.co.za</a></p>
                    <p><strong>Address:</strong> Ground Floor, Waterstone Building, Stonemill Office Park, 300 Acacia Road, Darrenwood, Johannesburg, 2195</p>
                </div>
            </CardHeader>
            <CardContent className="space-y-6 text-muted-foreground">
                <section>
                    <h2 className="text-xl font-semibold text-foreground mb-2">1. Introduction</h2>
                    <p>Welcome to My Accountant (Pty) Ltd. By using our website or services, you agree to comply with the following Terms and Conditions (“Terms”).</p>
                    <p className="mt-2">These Terms govern the relationship between <strong>My Accountant</strong> and its clients in connection with:</p>
                     <ul className="list-disc pl-6 space-y-1 mt-2">
                        <li>The purchase of online accounting and tax services;</li>
                        <li>The use of our client dashboard;</li>
                        <li>Payment processing and refunds; and</li>
                        <li>Compliance with applicable laws, including POPIA.</li>
                    </ul>
                </section>
                <section>
                    <h2 className="text-xl font-semibold text-foreground mb-2">2. Services</h2>
                    <p>My Accountant provides specialized online services including, but not limited to, company registrations, SARS submissions, and financial reporting. All services are subject to the specific prerequisites listed on each product page.</p>
                </section>
                 <section>
                    <h2 className="text-xl font-semibold text-foreground mb-2">3. Client Responsibilities</h2>
                    <p>Clients must provide accurate information and all required documentation within a reasonable timeframe. Failure to provide documents may result in service delays.</p>
                </section>
                <section>
                    <h2 className="text-xl font-semibold text-foreground mb-2">4. Fees & Payments</h2>
                    <p>All service fees are payable in full before work commences. We use secure third-party payment gateways for all online transactions.</p>
                </section>
                <section>
                    <h2 className="text-xl font-semibold text-foreground mb-2">5. Governing Law</h2>
                    <p>These Terms are governed by the laws of the <strong>Republic of South Africa</strong>.</p>
                </section>
            </CardContent>
        </Card>
      </div>
    </div>
  );
}
