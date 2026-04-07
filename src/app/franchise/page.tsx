'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { CheckCircle2, TrendingUp, Wallet, ShieldCheck, Globe, Briefcase, Users, FileText, ArrowRight, Store, MapPin, Percent } from 'lucide-react';
import TrustIndexWidget from '@/components/shared/TrustIndexWidget';
import { Separator } from '@/components/ui/separator';

export default function FranchisePage() {
  const benefits = [
    {
      icon: Store,
      title: 'Local Area Store',
      description: 'Own a territory-locked root-level URL (e.g. myacc.co.za/sandton) dedicated to your region.',
    },
    {
      icon: Percent,
      title: '25% Wholesale Margin',
      description: 'Profit from every standardized service with a consistent 25% discount on internal outsourcing.',
    },
    {
      icon: ShieldCheck,
      title: 'Brand Consistency',
      description: 'Leverage the highly trusted My Accountant branding with standardized, high-converting product descriptions.',
    },
    {
      icon: Users,
      title: 'Full Support Engine',
      description: 'Access the same back-office team and AI tools that power our flagship branch.',
    },
  ];

  return (
    <div className="space-y-16 pb-16 bg-white">
      {/* Hero Section */}
      <section className="bg-slate-900 text-white py-24 relative overflow-hidden">
        <div className="container mx-auto px-4 text-center relative z-10">
          <Badge className="mb-4 bg-primary hover:bg-primary text-white border-none px-4 py-1 uppercase font-black tracking-widest">Franchise Opportunity</Badge>
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-black tracking-tight leading-tight">
            Own Your Territory. <br/><span className="text-primary">Scale with Confidence.</span>
          </h1>
          <p className="mt-8 text-xl text-slate-300 max-w-3xl mx-auto font-medium leading-relaxed">
            The My Accountant Franchise model gives you an exclusive local presence with a standardized, turn-key accounting store.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row justify-center gap-4">
            <Button asChild size="lg" className="h-14 px-10 text-lg font-bold shadow-2xl">
              <Link href="/franchise-signup">Get Started - R10,000 Setup</Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="h-14 px-10 text-lg font-bold border-2 border-slate-700 text-white hover:bg-white hover:text-slate-900 transition-all">
              <Link href="/contact">Speak to a Consultant</Link>
            </Button>
          </div>
        </div>
        {/* Abstract Background Decoration */}
        <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
            <div className="absolute top-10 left-10"><Briefcase size={200} /></div>
            <div className="absolute bottom-10 right-10"><TrendingUp size={200} /></div>
        </div>
      </section>

      <TrustIndexWidget />

      {/* Model Overview */}
      <section className="container mx-auto px-4 max-w-5xl">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
                <h2 className="text-3xl font-bold text-slate-900">Why the Franchise Model?</h2>
                <p className="text-lg text-muted-foreground leading-relaxed">
                    While our BEI partner program focuses on individual white-labeling, the **Franchise Model** is built for those who want to represent the My Accountant brand directly in their local community.
                </p>
                <div className="space-y-4">
                    <div className="flex gap-4 items-start">
                        <div className="h-6 w-6 rounded-full bg-green-100 flex items-center justify-center shrink-0 mt-1"><CheckCircle2 className="h-4 w-4 text-green-600" /></div>
                        <p className="text-sm font-medium text-slate-700"><strong>Standardized Products:</strong> No need to write descriptions or set up pricing. Everything is pre-configured to match our national standards.</p>
                    </div>
                    <div className="flex gap-4 items-start">
                        <div className="h-6 w-6 rounded-full bg-green-100 flex items-center justify-center shrink-0 mt-1"><CheckCircle2 className="h-4 w-4 text-green-600" /></div>
                        <p className="text-sm font-medium text-slate-700"><strong>Exclusive Territories:</strong> Claim your area slug (e.g. /sandton) and be the only franchisee in that region.</p>
                    </div>
                    <div className="flex gap-4 items-start">
                        <div className="h-6 w-6 rounded-full bg-green-100 flex items-center justify-center shrink-0 mt-1"><CheckCircle2 className="h-4 w-4 text-green-600" /></div>
                        <p className="text-sm font-medium text-slate-700"><strong>Direct Representation:</strong> Operate under the My Accountant name, gaining instant credibility with clients.</p>
                    </div>
                </div>
            </div>
            <Card className="bg-slate-50 border-2 border-primary/10 shadow-xl">
                <CardHeader>
                    <CardTitle className="text-center font-black uppercase text-xs tracking-widest text-primary">Franchise Economics</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="text-center space-y-1">
                        <p className="text-sm text-muted-foreground font-bold">Setup & License Fee</p>
                        <p className="text-5xl font-black text-slate-900">R10,000</p>
                        <p className="text-xs text-muted-foreground italic uppercase">Once-off payment</p>
                    </div>
                    <Separator />
                    <div className="text-center space-y-1">
                        <p className="text-sm text-muted-foreground font-bold">Management & Royalty Fee</p>
                        <p className="text-4xl font-black text-primary">10%</p>
                        <p className="text-xs text-muted-foreground uppercase font-bold tracking-tighter">Per Sale</p>
                    </div>
                    <div className="bg-white p-4 rounded-lg border border-dashed text-center">
                        <p className="text-xs font-medium text-muted-foreground">You receive a <span className="font-bold text-slate-900">25% Wholesale Discount</span> on all orders you outsource to our main branch, ensuring healthy margins on every client.</p>
                    </div>
                </CardContent>
            </Card>
        </div>
      </section>

      {/* Benefits Grid */}
      <section className="bg-slate-50 py-24 border-y">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16 space-y-4">
            <h2 className="text-4xl font-bold text-slate-900">Franchisee Benefits</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto text-lg">Everything you need to run a high-performance local branch.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {benefits.map((benefit, idx) => (
              <Card key={idx} className="border-none shadow-sm hover:shadow-md transition-shadow h-full bg-white">
                <CardHeader>
                  <div className="h-12 w-12 rounded-xl bg-primary/5 border border-primary/10 flex items-center justify-center mb-4">
                    <benefit.icon className="h-6 w-6 text-primary" />
                  </div>
                  <CardTitle className="text-xl font-bold">{benefit.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground leading-relaxed">{benefit.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Call to Action */}
      <section className="container mx-auto px-4 text-center">
        <div className="max-w-3xl mx-auto space-y-8 bg-slate-900 text-white p-12 rounded-3xl shadow-2xl relative overflow-hidden">
            <div className="relative z-10 space-y-6">
                <h2 className="text-4xl font-black">Ready to claim your territory?</h2>
                <p className="text-xl text-slate-300">
                    Join the My Accountant Franchise network today and start building your local legacy with our proven systems.
                </p>
                <Button asChild size="lg" className="h-14 px-12 text-lg font-bold shadow-xl">
                    <Link href="/franchise-signup">Apply for a Franchise Now</Link>
                </Button>
            </div>
            <div className="absolute top-0 right-0 p-4 opacity-10"><MapPin size={150} /></div>
        </div>
      </section>
    </div>
  );
}
