'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calculator } from 'lucide-react';

export default function PayslipsPage() {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold">Payslips</h2>
          <p className="text-sm text-muted-foreground">Generate and manage employee earnings and deductions.</p>
        </div>
        <Button className="bg-primary hover:bg-primary/90">
          <Calculator className="mr-2 h-4 w-4" /> Run Payroll
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Payroll History</CardTitle>
          <CardDescription>A record of all processed payslips for this client.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-60 flex flex-col items-center justify-center border-2 border-dashed rounded-lg text-muted-foreground">
            <p className="font-semibold">No payroll runs found.</p>
            <p className="text-sm">Start by running payroll for the current period.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
