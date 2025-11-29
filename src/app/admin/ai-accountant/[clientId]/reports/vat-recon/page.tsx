
'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function VatReconPage() {
    return (
        <Card>
            <CardHeader>
                <CardTitle>VAT Reconciliation Report</CardTitle>
                <CardDescription>Perform a reconciliation of your VAT control account.</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="text-center py-10 border-2 border-dashed rounded-lg">
                    <h3 className="text-lg font-medium">Coming Soon</h3>
                    <p className="text-sm text-muted-foreground">The VAT Reconciliation report will be available here.</p>
                </div>
            </CardContent>
        </Card>
    );
}
