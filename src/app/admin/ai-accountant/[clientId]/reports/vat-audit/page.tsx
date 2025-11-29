
'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function VatAuditPage() {
    return (
        <Card>
            <CardHeader>
                <CardTitle>VAT Audit Report</CardTitle>
                <CardDescription>Prepare and review documents for a SARS VAT audit.</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="text-center py-10 border-2 border-dashed rounded-lg">
                    <h3 className="text-lg font-medium">Coming Soon</h3>
                    <p className="text-sm text-muted-foreground">The VAT Audit report will be available here.</p>
                </div>
            </CardContent>
        </Card>
    );
}
