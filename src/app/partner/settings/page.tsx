'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { Mail, ShieldCheck, Globe } from "lucide-react";

export default function PartnerSettingsPage() {
  return (
    <div className="max-w-4xl mx-auto space-y-8">
        <h1 className="text-3xl font-bold tracking-tight mb-8 text-slate-950">Practice Configuration</h1>
        
        <div className="grid grid-cols-1 gap-6">
            <Card className="border-2 shadow-sm">
                <CardHeader>
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                            <Mail className="h-5 w-5" />
                        </div>
                        <div>
                            <CardTitle>White-Label Email Engine</CardTitle>
                            <CardDescription>Managed automated delivery for your practice.</CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="space-y-4">
                    <p className="text-sm text-slate-600 leading-relaxed">
                        To ensure maximum reliability and ease of use, all practice emails are delivered using My Accountant's secure mail servers. 
                        <strong> White-labeling is automatically applied</strong> based on your company profile:
                    </p>
                    <ul className="space-y-3 pl-2">
                        <li className="flex items-start gap-3 text-sm font-medium">
                            <ShieldCheck className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                            <span><strong>Display Name:</strong> Emails arrive from your Practice Name.</span>
                        </li>
                        <li className="flex items-start gap-3 text-sm font-medium">
                            <ShieldCheck className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                            <span><strong>Reply Routing:</strong> All client replies are directed straight to your professional email address.</span>
                        </li>
                    </ul>
                </CardContent>
            </Card>

            <Card className="border-2 shadow-sm">
                <CardHeader>
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                            <Globe className="h-5 w-5" />
                        </div>
                        <div>
                            <CardTitle>Public Landing Page</CardTitle>
                            <CardDescription>Manage your practice's online presence.</CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="space-y-4">
                    <p className="text-sm text-slate-600 leading-relaxed">
                        Your public practice page is where clients browse your services and place orders. You can customize the branding, 
                        content, and layout in your profile settings.
                    </p>
                    <div className="flex gap-3 pt-2">
                        <Button asChild className="font-bold">
                            <Link href="/partner/profile">Customize Branding</Link>
                        </Button>
                        <Button variant="outline" asChild className="font-bold">
                            <Link href="/partner/services">Update Pricing & Markups</Link>
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    </div>
  );
}
