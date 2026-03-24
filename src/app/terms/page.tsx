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
                        <li>Practice credit management and wholesale service pricing; and</li>
                        <li>Compliance with applicable laws, including the <strong>Protection of Personal Information Act (POPIA)</strong>.</li>
                    </ul>
                </section>
                <section>
                    <h2 className="text-xl font-semibold text-foreground mb-2">2. BEI Practice Model</h2>
                    <p>The BEI operates as a professional partnership ecosystem designed for bookkeepers, accountants, and tax practitioners. All partners receive access to the full professional toolkit, including:</p>
                    <ul className="list-disc pl-6 space-y-2 mt-2">
                        <li><strong>Wholesale Pricing:</strong> A fixed 25% discount on My Accountant’s standard service fees (excluding third-party statutory costs).</li>
                        <li><strong>White-Label Dashboard:</strong> A secure portal for managing your clients, team members, and outsourced orders under your own brand.</li>
                        <li><strong>Custom Practice Landing Pages:</strong> A dedicated public URL preloaded with re-branded services for your firm.</li>
                    </ul>
                </section>
                <section>
                    <h2 className="text-xl font-semibold text-foreground mb-2">3. Eligibility for Receiving Overflow Work</h2>
                    <p>While any practitioner may join the BEI to manage their own clients, <strong>to receive outsourced work from the My Accountant network</strong>, a Partner must:</p>
                    <ul className="list-disc pl-6 space-y-1 mt-2">
                        <li>Be a registered member in good standing with a recognized Professional Body (SAICA, SAIT, CIBA, or SAIPA);</li>
                        <li>Submit proof of qualification and professional membership for verification;</li>
                        <li>Maintain professional indemnity insurance where applicable.</li>
                    </ul>
                    <p className="mt-2 text-xs italic">Note: Admission to the overflow program is discretionary and work allocation is merit-based. My Accountant does not guarantee any specific volume of work.</p>
                </section>
                <section>
                    <h2 className="text-xl font-semibold text-foreground mb-2">4. Program Fees & Practice Wallet</h2>
                    <h3 className="text-lg font-semibold text-foreground mt-4 mb-2">4.1 Onboarding & Setup Fee</h3>
                    <p>Joining the BEI requires a once-off setup and onboarding fee of <strong>R4,950</strong>. This fee covers the initial configuration of your white-label platform, landing page creation, and a professional training session.</p>
                    
                    <h3 className="text-lg font-semibold text-foreground mt-4 mb-2">4.2 Setup Credits</h3>
                    <p>Upon successful payment of the setup fee, <strong>50% of the fee (R2,475)</strong> will be credited to your <strong>Practice Wallet</strong>. These credits can be used to pay for the wholesale cost of any outsourced services through the platform.</p>

                    <h3 className="text-lg font-semibold text-foreground mt-4 mb-2">4.3 Ongoing Hosting & Support</h3>
                    <p>A monthly fee of <strong>R499</strong> is deducted from your practice credits for continuous platform hosting, AI tool access, and priority partner support. It is the Partner's responsibility to maintain a sufficient credit balance.</p>

                    <h3 className="text-lg font-semibold text-foreground mt-4 mb-2">4.4 Staff User Billing</h3>
                    <p>Every practice includes <strong>3 free additional staff users</strong>. Any staff members added beyond this limit cost <strong>R45 per user, per month</strong>, which is automatically deducted from your practice credits.</p>
                </section>
                 <section>
                    <h2 className="text-xl font-semibold text-foreground mb-2">5. White-Labeling & Client Ownership</h2>
                    <p>My Accountant respects the Partner’s ownership of their client relationships. When work is outsourced to us:</p>
                    <ul className="list-disc pl-6 space-y-1 mt-2">
                        <li>All system-generated emails will carry the Partner’s branding.</li>
                        <li>My Accountant will not market directly to the Partner’s clients.</li>
                        <li>The Partner remains the primary point of contact for the client unless direct contact is explicitly enabled by the Partner.</li>
                    </ul>
                </section>

                <section>
                    <h2 className="text-xl font-semibold text-foreground mb-2">6. Refunds & Cancellations</h2>
                    <ul className="list-disc pl-6 space-y-1 mt-2">
                        <li>The R4,950 setup fee is non-refundable once the onboarding or platform configuration has commenced.</li>
                        <li>Outsourced services are non-refundable once work has commenced.</li>
                        <li>Refunds for services not yet started will be credited back to the Practice Wallet, minus a 10% processing fee.</li>
                    </ul>
                </section>
                
                <section>
                    <h2 className="text-xl font-semibold text-foreground mb-2">7. Data Protection (POPIA)</h2>
                     <p>My Accountant and the Partner both act as responsible parties under POPIA. Partners must ensure they have obtained the necessary consent from their clients before uploading data or outsourcing work through the platform.</p>
                </section>

                <section>
                    <h2 className="text-xl font-semibold text-foreground mb-2">8. Governing Law</h2>
                    <p>These Terms are governed by the laws of the <strong>Republic of South Africa</strong>. Any disputes shall be subject to the jurisdiction of the courts in Johannesburg.</p>
                </section>

                <section>
                    <h2 className="text-xl font-semibold text-foreground mb-2">9. Contact</h2>
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
