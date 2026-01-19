
'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ShieldCheck, Rocket, Wallet, Building, Landmark, CheckCircle, FileWarning, Mail, Phone } from 'lucide-react';
import TrustIndexWidget from '@/components/shared/TrustIndexWidget';

export default function CompliancePage() {

  const sarsServices = [
    { title: "Tax Clearance Pins:", description: "Same-day issue for R250." },
    { title: "Income Tax Registration:", description: "Register your business and directors with SARS." },
    { title: "VAT Registration:", description: "For businesses earning over R1 million or voluntarily from R50 000+." },
    { title: "PAYE, UIF & SDL Registration:", description: "Stay compliant with employment laws." },
    { title: "Tax Returns & Submissions:", description: "Including Income Tax, VAT, PAYE, and Provisional Tax." },
    { title: "SARS Compliance Review:", description: "Identify risks, outstanding returns, and penalties." },
    { title: "Remission of Fines & Penalties:", description: "We negotiate with SARS to reduce or remove penalties." },
  ];

  const cipcServices = [
    { title: "Company Registration:", description: "Fast online setup with documents delivered to your inbox." },
    { title: "Amendments:", description: "Update director details, company name, or address." },
    { title: "Beneficial Ownership Declaration:", description: "Compliant with the new CIPC requirements." },
    { title: "Annual Returns:", description: "Ensure your company remains in good standing." },
    { title: "Reinstatements:", description: "Restore deregistered companies quickly and legally." },
    { title: "Securities Register:", description: "Issued in terms of the Companies Act for transparency." },
  ];


  const whyChooseUs = [
    {
      title: 'Same-day service options',
      description: 'for urgent SARS or CIPC filings.',
      icon: Rocket,
    },
    {
      title: 'Affordable pricing',
      description: 'no hidden fees, just transparent packages.',
      icon: Wallet,
    },
    {
      title: 'Trusted experts',
      description: 'over 150 five-star reviews from South African businesses.',
      icon: ShieldCheck,
    },
      {
      title: 'Free compliance assessment',
      description: 'includes a SARS & CIPC health check (valued at R250).',
      icon: CheckCircle,
    },
    {
      title: 'All-in-one platform',
      description: 'track orders, upload documents, and get instant updates online.',
      icon: Building,
    },
     {
      title: 'Common mistakes fixed',
      description: 'We identify and correct issues before they affect your business.',
      icon: FileWarning,
    },
  ];

  return (
    <div className="space-y-6 pb-16">
      <section>
        <div className="container mx-auto grid grid-cols-1 items-center gap-12 px-4 py-16 lg:py-24">
          <div className="space-y-6 text-center">
            <h1 className="text-4xl font-bold tracking-tight md:text-5xl lg:text-6xl text-foreground">
              Free <span className="text-gradient">#Compliance</span> Check
            </h1>
            <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
              Ensure your business is compliant with CIPC and SARS. Contact us today for a free, no-obligation compliance assessment.
            </p>
            <div className="flex flex-col gap-4 sm:flex-row sm:justify-center">
              <Button asChild size="lg">
                <Link href="/contact">Get My Free Assessment</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      <TrustIndexWidget />

      <section className="bg-background py-16">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold">🧾 SARS &amp; CIPC Compliance</h2>
            <p className="text-muted-foreground mt-2 max-w-2xl mx-auto">
              Stay compliant. Stay confident.
            </p>
          </div>
          <p className="text-lg text-center max-w-3xl mx-auto text-muted-foreground">
            Running a business in South Africa means keeping up with both SARS (South African Revenue Service) and CIPC (Companies and Intellectual Property Commission) regulations. At My Accountant, we take the stress out of compliance — so you can focus on growth while we handle the paperwork.
          </p>

          <div className="mt-12 space-y-8">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-3"><Landmark className="h-6 w-6 text-primary"/> SARS Compliance</CardTitle>
                <CardDescription>We make sure your business meets all SARS tax obligations — on time, every time.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <ul className="space-y-4 text-sm">
                  {sarsServices.map((service, index) => (
                    <li key={index} className="grid grid-cols-1 sm:grid-cols-[1fr_2fr] items-start gap-x-4">
                      <div className="flex items-start gap-2 font-semibold text-foreground">
                        <CheckCircle className="h-4 w-4 mt-0.5 text-green-500 flex-shrink-0"/> 
                        <span>{service.title}</span>
                      </div>
                      <div className="text-muted-foreground sm:pl-6">{service.description}</div>
                    </li>
                  ))}
                </ul>
                <p className="text-xs text-muted-foreground pt-4">📍 All SARS services are handled electronically and are 100% trackable through your online dashboard.</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-3"><Building className="h-6 w-6 text-primary"/> CIPC Compliance</CardTitle>
                <CardDescription>Keep your company active and legally protected with our CIPC services.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <ul className="space-y-4 text-sm">
                  {cipcServices.map((service, index) => (
                    <li key={index} className="grid grid-cols-1 sm:grid-cols-[1fr_2fr] items-start gap-x-4">
                      <div className="flex items-start gap-2 font-semibold text-foreground">
                        <CheckCircle className="h-4 w-4 mt-0.5 text-green-500 flex-shrink-0"/> 
                        <span>{service.title}</span>
                      </div>
                      <div className="text-muted-foreground sm:pl-6">{service.description}</div>
                    </li>
                  ))}
                </ul>
                <p className="text-xs text-muted-foreground pt-4">⚙️ We handle submissions directly with CIPC and keep you updated every step of the way.</p>
              </CardContent>
            </Card>
          </div>

          <div className="text-center mt-16 max-w-4xl mx-auto">
            <h2 className="text-3xl font-bold">💡 Why Choose My Accountant?</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 mt-8">
              {whyChooseUs.map((item) => (
                <div key={item.title} className="text-center">
                  <div className="flex justify-center mb-4">
                    <div className="bg-primary/10 rounded-full h-16 w-16 flex items-center justify-center">
                      <item.icon className="h-8 w-8 text-primary" />
                    </div>
                  </div>
                  <h4 className="font-bold text-lg">{item.title}</h4>
                  <p className="text-muted-foreground text-sm">{item.description}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="text-center mt-16 max-w-3xl mx-auto">
            <h2 className="text-3xl font-bold">🚀 Ready to Get Compliant?</h2>
            <p className="text-lg text-muted-foreground mt-4">Take the hassle out of SARS and CIPC compliance with professionals who care. Start your compliance journey today — fast, affordable, and fully online.</p>
            <div className="mt-8">
                <Button asChild size="lg">
                    <Link href="/contact">Book a Free Compliance Check</Link>
                </Button>
                <p className="mt-4 text-sm text-muted-foreground">
                    Or contact us: <Phone className="inline h-4 w-4 mr-1"/> <a href="tel:0101091625" className="hover:underline">010 109 1625</a> | <Mail className="inline h-4 w-4 ml-2 mr-1"/> <a href="mailto:info@myacc.co.za" className="hover:underline">info@myacc.co.za</a>
                </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
