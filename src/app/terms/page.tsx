
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'BEI Terms & Conditions',
  description: 'Review the official Terms and Conditions for participating in the My Accountant Bookkeeper Empowerment Initiative (BEI) partner program.',
};

export default function TermsAndConditionsPage() {
  return (
    <div className="container mx-auto max-w-4xl px-4 py-12">
      <div className="space-y-8">
        <div className="text-center">
          <h1 className="text-4xl font-bold tracking-tight">Bookkeeper Empowerment Initiative (BEI) – Terms & Conditions</h1>
          <p className="mt-2 text-lg text-muted-foreground">My Accountant (Pty) Ltd</p>
        </div>
        
        <Card>
            <CardHeader>
                <CardTitle>Effective Date: {new Date().toLocaleDateString('en-ZA')}</CardTitle>
                <div className="text-sm text-muted-foreground">
                    <p><strong>Operator:</strong> My Accountant (Pty) Ltd (“My Accountant”, “we”, “our”, or “us”)</p>
                    <p><strong>Website:</strong> <Link href="https://www.myacc.co.za" className="text-primary hover:underline">www.myacc.co.za</Link></p>
                    <p><strong>Email:</strong> <a href="mailto:info@myacc.co.za" className="text-primary hover:underline">info@myacc.co.za</a></p>
                </div>
            </CardHeader>
            <CardContent className="space-y-6 text-muted-foreground">
                <section>
                    <h2 className="text-xl font-semibold text-foreground mb-2">1. Introduction</h2>
                    <p>Welcome to the <strong>Bookkeeper Empowerment Initiative (BEI)</strong>, a program operated by <strong>My Accountant (Pty) Ltd</strong>. By registering as a BEI Partner, accessing your practice dashboard, or outsourcing/accepting work through the BEI platform, you agree to comply with the following Terms and Conditions (“Terms”).</p>
                    <p className="mt-2">These Terms govern the relationship between <strong>My Accountant</strong>, <strong>BEI Partners</strong>, and <strong>Clients</strong> in connection with:</p>
                     <ul className="list-disc pl-6 space-y-1 mt-2">
                        <li>The creation and outsourcing of client orders;</li>
                        <li>The use of the white-labeled practice dashboard and landing pages;</li>
                        <li>Payment, credit management, and subscription billing; and</li>
                        <li>Compliance with applicable laws, including the <strong>Protection of Personal Information Act (POPIA)</strong>.</li>
                    </ul>
                </section>
                <section>
                    <h2 className="text-xl font-semibold text-foreground mb-2">2. Definitions</h2>
                     <ul className="list-disc pl-6 space-y-1 mt-2">
                        <li><strong>“Partner”</strong> means any bookkeeper, accountant, tax practitioner, or consultant approved for the BEI program.</li>
                        <li><strong>“Practice Wallet”</strong> refers to the prepaid credit balance maintained by the Partner.</li>
                        <li><strong>“Outsourced Work”</strong> means any order assigned by a Partner to My Accountant for fulfillment.</li>
                        <li><strong>“Professional Body”</strong> refers to SAICA, SAIT, CIBA, or SAIPA.</li>
                    </ul>
                </section>
                <section>
                    <h2 className="text-xl font-semibold text-foreground mb-2">3. Eligibility for Outsourcing</h2>
                    <p>While anyone may join the BEI to use the software and tools, <strong>to receive outsourced work from My Accountant</strong>, a Partner must:</p>
                    <ul className="list-disc pl-6 space-y-1 mt-2">
                        <li>Be a registered member in good standing with a recognized Professional Body (SAICA, SAIT, CIBA, or SAIPA);</li>
                        <li>Submit proof of qualification and professional membership for verification;</li>
                        <li>Maintain professional indemnity insurance where applicable.</li>
                    </ul>
                </section>
                <section>
                    <h2 className="text-xl font-semibold text-foreground mb-2">4. Program Benefits</h2>
                    <p>BEI Partners in good standing are entitled to:</p>
                    <ul className="list-disc pl-6 space-y-1 mt-2">
                        <li>A <strong>25% Wholesale Discount</strong> on My Accountant’s standard service fees (excluding third-party costs like CIPC or CIDB fees).</li>
                        <li>A white-labeled practice dashboard and customizable online store.</li>
                        <li>Automated CRM tools and practice templates.</li>
                        <li>Mentorship and technical support from senior Chartered Accountants.</li>
                    </ul>
                </section>
                <section>
                    <h2 className="text-xl font-semibold text-foreground mb-2">5. Fee Structure & Practice Wallet</h2>
                    <h3 className="text-lg font-semibold text-foreground mt-4 mb-2">5.1 Setup Fee & Credits</h3>
                    <p>Activation of a BEI Partner account requires a <strong>R5,000.00 setup fee</strong>. This entire amount is immediately converted into <strong>Practice Credits</strong> and loaded into the Partner’s wallet. These credits can be used to pay for monthly subscriptions or outsourced services.</p>
                    
                    <h3 className="text-lg font-semibold text-foreground mt-4 mb-2">5.2 Monthly Subscription</h3>
                    <p>A monthly platform fee of <strong>R499.00</strong> is deducted from the Practice Wallet. This covers app hosting, AI tools, and priority partner support. If the wallet balance is insufficient to cover the subscription, access to the dashboard will be restricted until the wallet is topped up.</p>

                    <h3 className="text-lg font-semibold text-foreground mt-4 mb-2">5.3 Staff User Billing</h3>
                    <p>Each practice includes <strong>3 free additional staff users</strong> (plus the practice owner). Any staff members added beyond this limit will be billed at <strong>R45.00 per user, per month</strong>, deducted from the Practice Wallet.</p>
                </section>
                 <section>
                    <h2 className="text-xl font-semibold text-foreground mb-2">6. White-Labeling & Client Ownership</h2>
                    <p>My Accountant respects the Partner’s ownership of their client relationships. When work is outsourced to us:</p>
                    <ul className="list-disc pl-6 space-y-1 mt-2">
                        <li>All system-generated emails will carry the Partner’s branding.</li>
                        <li>My Accountant will not market directly to the Partner’s clients.</li>
                        <li>If the Partner configures custom SMTP settings, emails will be sent directly from the Partner’s domain.</li>
                    </ul>
                </section>

                <section>
                    <h2 className="text-xl font-semibold text-foreground mb-2">7. Refunds & Cancellations</h2>
                    <ul className="list-disc pl-6 space-y-1 mt-2">
                        <li>The R5,000 setup fee is non-refundable as it is immediately converted into usable practice credits.</li>
                        <li>Outsourced services are non-refundable once work has commenced.</li>
                        <li>Refunds for services not yet started will be credited back to the Practice Wallet, minus a 10% processing fee.</li>
                    </ul>
                </section>
                
                <section>
                    <h2 className="text-xl font-semibold text-foreground mb-2">8. Data Protection (POPIA)</h2>
                     <p>My Accountant and the Partner both act as responsible parties under POPIA. Partners must ensure they have obtained the necessary consent from their clients before uploading data or outsourcing work through the platform.</p>
                </section>

                <section>
                    <h2 className="text-xl font-semibold text-foreground mb-2">9. Governing Law</h2>
                    <p>These Terms are governed by the laws of the <strong>Republic of South Africa</strong>. Any disputes shall be subject to the jurisdiction of the courts in Johannesburg.</p>
                </section>

                <section>
                    <h2 className="text-xl font-semibold text-foreground mb-2">10. Contact</h2>
                    <p>For questions regarding the BEI program or these Terms, please contact:</p>
                     <div className="mt-2 text-sm">
                        <p>📧 <a href="mailto:info@myacc.co.za" className="text-primary hover:underline">info@myacc.co.za</a></p>
                        <p>🏢 369 Oak Avenue, Ferndale, Randburg, South Africa</p>
                    </div>
                </section>

            </CardContent>
        </Card>
      </div>
    </div>
  );
}
