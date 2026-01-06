
'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Inbox } from "lucide-react";

export default function AIEmailInboxPage() {
    return (
        <div className="space-y-8">
            <div className="flex items-center justify-between">
                <h1 className="text-3xl font-bold tracking-tight">AI Email Inbox</h1>
            </div>
            <Card>
                <CardHeader>
                    <CardTitle>Inbox</CardTitle>
                    <CardDescription>View, categorize, and take action on incoming emails.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="text-center py-16 border-2 border-dashed rounded-lg">
                        <Inbox className="mx-auto h-12 w-12 text-muted-foreground" />
                        <h2 className="mt-4 text-xl font-semibold">Coming Soon</h2>
                        <p className="mt-2 text-muted-foreground">The AI Email Inbox feature is under construction.</p>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
