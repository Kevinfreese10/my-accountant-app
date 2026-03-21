'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlusCircle, Search } from 'lucide-react';
import { Input } from "@/components/ui/input";

export default function EmployeesPage() {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold">Employees</h2>
          <p className="text-sm text-muted-foreground">Manage your workforce and compensation details.</p>
        </div>
        <Button>
          <PlusCircle className="mr-2 h-4 w-4" /> Add Employee
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="relative flex-grow">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search employees..." className="pl-8 max-w-sm" />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-60 flex flex-col items-center justify-center border-2 border-dashed rounded-lg text-muted-foreground">
            <p className="font-semibold">No employees found.</p>
            <p className="text-sm">Click "Add Employee" to register your first staff member.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
