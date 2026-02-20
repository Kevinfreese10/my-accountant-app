'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Rocket, ShieldCheck, Wallet, UserCheck, Cpu, Briefcase, Users, FileText, BotMessageSquare, LifeBuoy, GraduationCap, CheckCircle2, ArrowRight, Wallet2 } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import WebsiteAIWidget from '@/components/shared/WebsiteAIWidget';
import dynamic from 'next/dynamic';

const TrustIndexWidget = dynamic(() => import('@/components/shared/TrustIndexWidget'), {
  ssr: false,
});

const FaqSection = () => {
    const faqs = [
    {
        question: "Who should join the Bookkeeper Empowerment Initiative?",
        answer: "BEI is ideal for passionate professionals who want to grow their business without stress, including:\n- Freelance Bookkeepers\n- Startup Accounting Firms\n- Tax Practitioners\n- Business Consultants\n- Payroll Administrators"
    },
    {
        question: "What does it cost to join?",
        answer: "Joining requires a R5000 setup fee (Incl. VAT). This entire amount is immediately converted into R5000 credits in your practice wallet.\n\nYou can use these credits towards monthly AI Accountant subscriptions or paying for outsourced services. There are no hidden monthly fees — you only top up your credits when needed."
    },
    {
        question: "How does the credit system work?",
        answer: "Your initial R5000 setup fee provides you with R5000 in starting credits. When you outsource a service or activate an AI Accountant subscription, the cost is deducted from your balance. Once your credits are finished, you can top up your wallet with any custom amount to keep your services active."
    },
    {
        question: "How does outsourcing work?",
        answer: "We communicate with you — you communicate with your client. All updates, queries, and deliverables are sent directly to you, ensuring that you remain the sole point of contact with your client. Your clients never know the service has been outsourced, ensuring total confidentiality and trust."
    },
    {
        question: "How It Works",
        answer: "Joining is simple and straightforward. Follow these steps to start growing your practice:\n\n1. Apply Online & Pay Setup Fee\n2. Access Your Dashboard with R5000 Credits\n3. Outsource or Accept Work\n4. Learn & Grow",
    },
    {
        question: "Do I need to be a registered accountant?",
        answer: "No. Everyone is welcome — including business owners who do not work in the accounting or tax space but would like to offer these services to their clients.\n\nHowever, to qualify for opportunities where My Accountant outsources work to you, you must belong to a recognized professional accounting or tax body such as SAICA, SAIT, CIBA, or SAIPA. This ensures we maintain consistent quality and professional standards across all client work."
    },
    {
        question: "How do I get support?",
        answer: "You’ll have access to a dedicated partner support team, mentorship network, and helpdesk through your dashboard."
    }
  ];

  return (
      <section className="container mx-auto px-4 max-w-4xl">
         <div className="text-center mb-12">
            <h2 className="text-3xl font-bold">Frequently Asked Questions</h2>
        </div>
         <Accordion type="single" collapsible className="w-full">
            {faqs.map((faq, index) => (
              <AccordionItem key={index} value={`item-${index}`}>
                <AccordionTrigger>{faq.question}</AccordionTrigger>
                <AccordionContent className="whitespace-pre-line">{faq.answer}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
      </section>
  )
}

const DynamicFaqSection = dynamic(() => Promise.resolve(FaqSection), {
    ssr: false,
});


export default function BecomeAPartnerPage() {

  const challenges = [
    {
      title: 'Limited Service Range',
      description: 'Offering only bookkeeping services limits your earning potential.',
      icon: Briefcase,
      solution: "Through BEI, you can sell My Accountant’s full suite of services — from company registration to VAT, COIDA, CIDB, NCR, and more.",
    },
    {
      title: 'Lack of Mentorship',
      description: 'Many bookkeepers work alone, with no guidance from experienced professionals.',
      icon: GraduationCap,
      solution: 'We provide mentorship from senior accountants and industry experts who help you grow your confidence and capabilities.',
    },
    {
      title: 'Technology Gaps',
      description: 'Without proper systems, managing clients and documents becomes messy.',
      icon: Cpu,
      solution: 'You get access to our cloud-based reseller dashboard to manage, track, and outsource client orders seamlessly.',
    },
    {
      title: 'Capacity Constraints',
      description: 'Handling large clients or complex projects alone isn’t easy.',
      icon: Users,
      solution: 'We’re a qualified team of accountants and tax professionals — when you outsource overflow work to us, it’s handled securely, accurately, and on time.',
    },
     {
      title: 'Compliance Overwhelm',
      description: 'Complex tax and statutory rules can deter small practitioners from taking on advanced clients.',
      icon: ShieldCheck,
      solution: 'We provide ready-to-use templates, compliance guides, and ongoing training to help you stay compliant and confident.',
    },
  ];

  const benefits = [
    {
        icon: <Wallet2 className="h-6 w-6 text-primary" />,
        title: 'Credit-Based Model',
        description: 'Your R5000 setup fee is returned to you as R5000 in credits. Use these to pay for services as you grow, with no fixed monthly overheads.',
    },
    {
        icon: <Users className="h-6 w-6 text-primary" />,
        title: 'Reseller Dashboard',
        description: 'Access your dedicated reseller dashboard to create and manage client orders, track progress in real time, and outsource orders directly to My Accountant through a secure platform.',
    },
    {
        icon: <ArrowRight className="h-6 w-6 text-primary" />,
        title: 'Outsourcing Opportunities',
        description: 'Join a growing pool of bookkeepers and accountants who share work through the BEI network. Get access to new outsourcing projects and earn more.',
    },
    {
        icon: <UserCheck className="h-6 w-6 text-primary" />,
        title: 'Seamless White-Labeling',
        description: 'We communicate with you — you communicate with your client. All deliverables are sent directly to you, ensuring you remain the sole point of contact.',
    },
    {
        icon: <GraduationCap className="h-6 w-6 text-primary" />,
        title: 'Mentorship & Training',
        description: 'Get practical guidance from experienced accountants. Join monthly training webinars and Q&A sessions to grow your capabilities.',
    },
    {
        icon: <FileText className="h-6 w-6 text-primary" />,
        title: 'Compliance Tools',
        description: 'Save time with professional templates for engagement letters, contracts, and onboarding forms, all available in your dashboard.',
    },
  ];

  return (
    <div className="space-y-16 pb-16">
      <section className="bg-background border-b">
        <div className="container mx-auto px-4 py-16 text-center">
            <h1 className="text-4xl font-bold tracking-tight md:text-5xl lg:text-6xl">
                Bookkeeper <span className="text-gradient">#Empowerment</span> Initiative
            </h1>
            <h2 className="mt-4 text-2xl md:text-3xl font-semibold">Empower Your Accounting Practice in South Africa</h2>
            <p className="mt-6 text-lg text-muted-foreground max-w-3xl mx-auto">
                Partner with My Accountant – R5000 Setup fee (returned as R5000 credits). Grow Smarter, Earn More, Work Freely.
            </p>
            <Button asChild size="lg" className="mt-8">
            <Link href="/partner-signup">Join the Initiative & Get R5000 Credits</Link>
            </Button>
        </div>
      </section>

      <TrustIndexWidget />

      <section className="container mx-auto px-4">
        <div className="max-w-4xl mx-auto text-center space-y-4">
            <h2 className="text-3xl font-bold">About the Initiative</h2>
            <p className="text-muted-foreground text-lg">
                The Bookkeeper Empowerment Initiative by My Accountant was created to empower small and growing bookkeepers across South Africa. We know what it’s like to start out — you have the skills, but limited clients, tools, and support. 
            </p>
             <p className="text-muted-foreground text-lg">
                That's why we've introduced our <strong>Credit-Based Growth Model</strong>. Your R5000 setup fee is immediately loaded into your Practice Wallet as R5000 in credits. Use these credits to outsource work, manage subscriptions, and scale your firm at your own pace.
            </p>
        </div>
      </section>
      
      <section className="container mx-auto px-4">
        <div className="text-center mb-12">
            <h2 className="text-3xl font-bold">The Challenges We’re Solving</h2>
        </div>
        <div className="space-y-8 max-w-4xl mx-auto">
            {challenges.map((challenge, index) => (
                <div key={challenge.title} className="space-y-3">
                    <div className="flex items-center gap-4">
                        <div className="bg-primary/10 rounded-full h-12 w-12 flex items-center justify-center flex-shrink-0">
                            <challenge.icon className="h-6 w-6 text-primary" />
                        </div>
                        <div>
                            <h3 className="text-xl font-bold">{challenge.title}</h3>
                            <p className="text-muted-foreground">{challenge.description}</p>
                        </div>
                    </div>
                    <div className="flex items-start gap-4 pl-16">
                        <CheckCircle2 className="h-5 w-5 text-green-500 mt-1 flex-shrink-0"/>
                        <p className="font-medium">{challenge.solution}</p>
                    </div>
                </div>
            ))}
        </div>
      </section>
      
      <section className="bg-muted/30 py-16">
        <div className="container mx-auto px-4">
            <div className="text-center mb-12">
                <h2 className="text-3xl font-bold">Key Benefits of Joining</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {benefits.map(benefit => (
                <div key={benefit.title} className="flex items-start gap-4 bg-background p-6 rounded-lg border shadow-sm">
                    <div className="mt-1">{benefit.icon}</div>
                    <div>
                        <h3 className="text-lg font-semibold">{benefit.title}</h3>
                        <p className="text-sm text-muted-foreground mt-1">{benefit.description}</p>
                    </div>
                </div>
                ))}
            </div>
        </div>
      </section>

      <DynamicFaqSection />
      
      <section className="container mx-auto px-4">
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button asChild size="lg">
                <Link href="/partner-signup">Sign Up & Claim R5000 Credits</Link>
            </Button>
            <Button asChild variant="outline" size="lg">
                <Link href="/login">Access Portal</Link>
            </Button>
        </div>
      </section>

      <section id="ai-assistant" className="container mx-auto px-4 scroll-m-20">
        <WebsiteAIWidget />
      </section>
    </div>
  );
}
