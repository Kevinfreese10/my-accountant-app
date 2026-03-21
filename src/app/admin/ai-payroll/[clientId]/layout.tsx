'use client';

import { ReactNode, useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams, usePathname } from 'next/navigation';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { User } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronDown, Users, Calculator, CalendarCheck, FileText, Settings } from 'lucide-react';
import {
  Menubar,
  MenubarContent,
  MenubarItem,
  MenubarMenu,
  MenubarSeparator,
  MenubarTrigger,
} from "@/components/ui/menubar";

const db = getFirestore(firebaseApp);

export default function AIPayrollClientLayout({ children }: { children: ReactNode }) {
  const params = useParams();
  const clientId = params.clientId as string;
  const [client, setClient] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (clientId) {
      getDoc(doc(db, 'aiPayrollClients', clientId)).then(snap => {
        if (snap.exists()) setClient({ id: snap.id, ...snap.data() } as User);
        setIsLoading(false);
      });
    }
  }, [clientId]);

  if (isLoading) return <div className="p-8"><Loader2 className="animate-spin h-8 w-8 mx-auto" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <Button variant="outline" size="sm" asChild className="mb-4">
            <Link href="/admin/ai-payroll/clients">
              <ChevronLeft className="mr-2 h-4 w-4" />
              Back to Payroll Clients
            </Link>
          </Button>
          <h1 className="text-2xl font-bold tracking-tight">{client?.name || 'Loading...'}</h1>
          <p className="text-muted-foreground text-sm uppercase tracking-widest font-bold">AI Payroll Module</p>
        </div>
      </div>

      <Menubar className="w-full bg-card">
        <MenubarMenu>
          <MenubarTrigger asChild>
            <Link href={`/admin/ai-payroll/${clientId}/dashboard`} className="cursor-pointer">Overview</Link>
          </MenubarTrigger>
        </MenubarMenu>
        
        <MenubarMenu>
          <MenubarTrigger>Employees <ChevronDown className="h-4 w-4 ml-1" /></MenubarTrigger>
          <MenubarContent>
            <MenubarItem asChild><Link href={`/admin/ai-payroll/${clientId}/employees`}>Employee List</Link></MenubarItem>
            <MenubarItem>Employee Contracts</MenubarItem>
            <MenubarSeparator />
            <MenubarItem>Bulk Upload</MenubarItem>
          </MenubarContent>
        </MenubarMenu>

        <MenubarMenu>
          <MenubarTrigger>Payroll <ChevronDown className="h-4 w-4 ml-1" /></MenubarTrigger>
          <MenubarContent>
            <MenubarItem asChild><Link href={`/admin/ai-payroll/${clientId}/payslips`}>Payslip Generation</Link></MenubarItem>
            <MenubarItem>Batch Processing</MenubarItem>
            <MenubarItem>Payment Files (ABA/EFT)</MenubarItem>
          </MenubarContent>
        </MenubarMenu>

        <MenubarMenu>
          <MenubarTrigger>Leave <ChevronDown className="h-4 w-4 ml-1" /></MenubarTrigger>
          <MenubarContent>
            <MenubarItem asChild><Link href={`/admin/ai-payroll/${clientId}/leave`}>Leave Tracker</Link></MenubarItem>
            <MenubarItem>Annual Leave Cycle</MenubarItem>
          </MenubarContent>
        </MenubarMenu>

        <MenubarMenu>
          <MenubarTrigger>Compliance <ChevronDown className="h-4 w-4 ml-1" /></MenubarTrigger>
          <MenubarContent>
            <MenubarItem asChild><Link href={`/admin/ai-payroll/${clientId}/reports/emp201`}>EMP201 Return</Link></MenubarItem>
            <MenubarItem>UIF Declaration</MenubarItem>
            <MenubarItem>EMP501 Recon</MenubarItem>
          </MenubarContent>
        </MenubarMenu>

        <MenubarMenu>
          <MenubarTrigger>Settings <ChevronDown className="h-4 w-4 ml-1" /></MenubarTrigger>
          <MenubarContent>
            <MenubarItem>Payroll Cycles</MenubarItem>
            <MenubarItem>Allowances & Deductions</MenubarItem>
            <MenubarSeparator />
            <MenubarItem>Company Details</MenubarItem>
          </MenubarContent>
        </MenubarMenu>
      </Menubar>

      <main>{children}</main>
    </div>
  );
}

import { Loader2 } from 'lucide-react';
