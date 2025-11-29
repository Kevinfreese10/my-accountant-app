
'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function VatTransactionsPage() {
    return (
        <Card>
            <CardHeader>
                <CardTitle>VAT Transactions Report</CardTitle>
                <CardDescription>Review all transactions relevant to your VAT return.</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="text-center py-10 border-2 border-dashed rounded-lg">
                    <h3 className="text-lg font-medium">Coming Soon</h3>
                    <p className="text-sm text-muted-foreground">The VAT Transactions report will be available here.</p>
                </div>
            </CardContent>
        </Card>
    );
}
