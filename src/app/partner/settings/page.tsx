
'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";

export default function PartnerSettingsPage() {
  return (
    <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold tracking-tight mb-8">Practice Settings</h1>
        <Card>
            <CardHeader>
                <CardTitle>Email & Branding</CardTitle>
                <CardDescription>Configure how your practice communicates with clients.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="bg-primary/5 p-4 rounded-lg border border-primary/10">
                    <p className="text-sm">
                        You can now configure your own <strong>SMTP server</strong> to send emails directly from your practice address. 
                        This ensures a fully white-labeled experience for your clients.
                    </p>
                    <p className="text-sm mt-4">
                        To set this up, go to your <Link href="/partner/profile" className="text-primary font-bold hover:underline">Company Profile</Link> and scroll down to the "Email SMTP Settings" section.
                    </p>
                </div>
                <p className="text-xs text-muted-foreground">
                    If no custom SMTP details are provided, the system will use My Accountant's default mailing server, but will still use your Company Name as the sender.
                </p>
            </CardContent>
        </Card>
    </div>
  );
}
