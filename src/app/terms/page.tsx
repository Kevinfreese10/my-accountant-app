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
                    <p>Welcome to the <strong>Bookkeeper Empowerment Initiative (BEI)</strong>, a program operated by <strong>My Accountant (Pty) Ltd</strong>. By registering as a BEI Partner, accessing your practice dashboard, or outsourcing work through the BEI platform, you agree to comply with the following Terms and Conditions (“Terms”).</p>
                    <p className="mt-2">These Terms govern the relationship between <strong>My Accountant</strong> and <strong>BEI Partners</strong> in connection with:</p>
                     <ul className="list-disc pl-6 space-y-1 mt-2">
                        <li>The creation and outsourcing of client orders;</li>
                        <li>The use of the white-labeled practice dashboard and landing pages;</li>
                        <li>Tiered benefits and practice credit management; and</li>
                        <li>Compliance with applicable laws, including the <strong>Protection of Personal Information Act (POPIA)</strong>.</li>
                    </ul>
                </section>
                <section>
                    <h2 className="text-xl font-semibold text-foreground mb-2">2. Partner Tiers</h2>
                    <p>The BEI offers two entry levels for practitioners:</p>
                    <ul className="list-disc pl-6 space-y-2 mt-2">
                        <li><strong>Starter Partner:</strong> Designed for freelancers and referral-based bookkeepers. Offers a 10% wholesale discount and basic order management. All orders are auto-outsourced to My Accountant.</li>
                        <li><strong>Full Practice:</strong> Designed for professional firms. Offers a 25% wholesale discount, full white-label tools, staff management, and custom practice landing pages.</li>
                    </ul>
                </section>
                <section>
                    <h2 className="text-xl font-semibold text-foreground mb-2">3. Eligibility for Receiving Overflow Work</h2>
                    <p>While any practitioner may join the BEI, <strong>to receive outsourced work from the My Accountant network</strong>, a Partner must:</p>
                    <ul className="list-disc pl-6 space-y-1 mt-2">
                        <li>Be on the <strong>Full Practice</strong> tier;</li>
                        <li>Be a registered member in good standing with a recognized Professional Body (SAICA, SAIT, CIBA, or SAIPA);</li>
                        <li>Submit proof of qualification and professional membership for verification;</li>
                        <li>Maintain professional indemnity insurance where applicable.</li>
                    </ul>
                    <p className="mt-2 text-xs italic">Note: Admission to the overflow program is discretionary and work allocation is merit-based.</p>
                </section>
                <section>
                    <h2 className="text-xl font-semibold text-foreground mb-2">4. Program Benefits</h2>
                    <p>BEI Partners in good standing are entitled to tiered discounts and platform access as described in their selected model. Full Practices enjoy an enhanced 25% wholesale discount on My Accountant’s standard service fees (excluding third-party costs like CIPC or CIDB fees).</p>
                </section>
                <section>
                    <h2 className="text-xl font-semibold text-foreground mb-2">5. Fee Structure & Practice Wallet</h2>
                    <h3 className="text-lg font-semibold text-foreground mt-4 mb-2">5.1 Free Entry Model</h3>
                    <p>There is currently <strong>no setup fee or monthly subscription cost</strong> to join the BEI on either the Starter or Full Practice tiers. Access to the basic dashboard and white-label tools is provided free of charge.</p>
                    
                    <h3 className="text-lg font-semibold text-foreground mt-4 mb-2">5.2 Practice Credits</h3>
                    <p>Partners load credits into a <strong>Practice Wallet</strong> via PayFast. These credits are used to pay for outsourced services at the applicable wholesale rate. Credits do not expire but are non-refundable once loaded.</p>

                    <h3 className="text-lg font-semibold text-foreground mt-4 mb-2">5.3 Staff User Billing (Full Tier Only)</h3>
                    <p>Full Practice accounts include <strong>3 free additional staff users</strong>. Any staff members added beyond this limit may be subject to a nominal monthly hosting fee as indicated in the dashboard.</p>
                </section>
                 <section>
                    <h2 className="text-xl font-semibold text-foreground mb-2">6. White-Labeling & Client Ownership</h2>
                    <p>My Accountant respects the Partner’s ownership of their client relationships. When work is outsourced to us:</p>
                    <ul className="list-disc pl-6 space-y-1 mt-2">
                        <li>All system-generated emails will carry the Partner’s branding.</li>
                        <li>My Accountant will not market directly to the Partner’s clients.</li>
                        <li>The Partner remains the primary point of contact for the client unless direct contact is explicitly enabled (Full Practice only).</li>
                    </ul>
                </section>

                <section>
                    <h2 className="text-xl font-semibold text-foreground mb-2">7. Refunds & Cancellations</h2>
                    <ul className="list-disc pl-6 space-y-1 mt-2">
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
