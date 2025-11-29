
'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function EMP201Page() {
    return (
        <Card>
            <CardHeader>
                <CardTitle>EMP201 Report</CardTitle>
                <CardDescription>View and manage your EMP201 submissions.</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="text-center py-10 border-2 border-dashed rounded-lg">
                    <h3 className="text-lg font-medium">Coming Soon</h3>
                    <p className="text-sm text-muted-foreground">The EMP201 report will be available here.</p>
                </div>
            </CardContent>
        </Card>
    );
}
