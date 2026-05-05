
'use client';

import { ReactNode, useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useParams } from 'next/navigation';
import { cn } from '@/lib/utils';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { User } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { ChevronLeft, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Menubar,
  MenubarContent,
  MenubarItem,
  MenubarMenu,
  MenubarSeparator,
  MenubarTrigger,
} from "@/components/ui/menubar";
import { useAuth } from '@/contexts/AuthContext';


const db = getFirestore(firebaseApp);

export default function AIAccountantClientLayout({ children }: { children: ReactNode }) {
    const pathname = usePathname();
    const params = useParams();
    const clientId = params.clientId as string;
    const [client, setClient] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const { user: currentUser } = useAuth();
    
    useEffect(() => {
        if (clientId) {
            const fetchClient = async () => {
                const docRef = doc(db, 'aiAccountantClients', clientId);
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    setClient({ id: docSnap.id, ...docSnap.data() } as User);
                }
                setIsLoading(false);
            };
            fetchClient();
        }
    }, [clientId]);


    if (isLoading) {
        return (
            <div className="space-y-8">
                <Skeleton className="h-10 w-48" />
                <div className="space-y-4">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-96 w-full" />
                </div>
            </div>
        );
    }
    
    const backLink = currentUser?.role === 'ai_accountant' ? '/admin/ai-accountant/clients' : '/admin/ai-accountant';

    return (
        <div className="space-y-4">
             <div>
                 <Button variant="outline" size="sm" asChild className="mb-4">
                    <Link href={backLink}>
                        <ChevronLeft className="mr-2 h-4 w-4" />
                        Back to All Clients
                    </Link>
                </Button>
                <h1 className="text-2xl font-bold tracking-tight">{client?.companyName || client?.name}</h1>
                <p className="text-muted-foreground">AI Accountant Module</p>
            </div>

            <Menubar className="w-full bg-card text-[12px] h-auto flex-wrap">
                 <MenubarMenu>
                    <MenubarTrigger className="py-2">Company <ChevronDown className="h-3 w-3 ml-1" /></MenubarTrigger>
                    <MenubarContent>
                        <MenubarItem asChild><Link href={`/admin/ai-accountant/${clientId}/details`}>Company Details</Link></MenubarItem>
                        <MenubarItem asChild><Link href={`/admin/ai-accountant/${clientId}/chart-of-accounts`}>Chart of Accounts</Link></MenubarItem>
                        <MenubarItem asChild><Link href={`/admin/ai-accountant/allocation-rules`}>Allocation Rules</Link></MenubarItem>
                    </MenubarContent>
                </MenubarMenu>
                <MenubarMenu>
                    <MenubarTrigger className="py-2">Customers <ChevronDown className="h-3 w-3 ml-1" /></MenubarTrigger>
                    <MenubarContent>
                        <MenubarItem asChild><Link href={`/admin/ai-accountant/${clientId}/customers`}>Customer List</Link></MenubarItem>
                        <MenubarItem asChild><Link href={`/admin/ai-accountant/${clientId}/invoices`}>Invoices</Link></MenubarItem>
                        <MenubarItem asChild><Link href={`/admin/ai-accountant/${clientId}/quotes`}>Quotes</Link></MenubarItem>
                        <MenubarItem asChild><Link href={`/admin/ai-accountant/${clientId}/credit-notes`}>Credit Notes</Link></MenubarItem>
                        <MenubarSeparator />
                        <MenubarItem asChild><Link href={`/admin/ai-accountant/${clientId}/journals?type=customer`}>Customer Journals</Link></MenubarItem>
                        <MenubarItem asChild><Link href={`/admin/ai-accountant/${clientId}/reports/customer-ledger`}>Customer Ledger</Link></MenubarItem>
                    </MenubarContent>
                </MenubarMenu>
                <MenubarMenu>
                    <MenubarTrigger className="py-2">Suppliers <ChevronDown className="h-3 w-3 ml-1" /></MenubarTrigger>
                     <MenubarContent>
                        <MenubarItem asChild><Link href={`/admin/ai-accountant/${clientId}/suppliers`}>Supplier List</Link></MenubarItem>
                        <MenubarSeparator />
                        <MenubarItem asChild><Link href={`/admin/ai-accountant/${clientId}/journals?type=supplier`}>Supplier Journals</Link></MenubarItem>
                        <MenubarItem asChild><Link href={`/admin/ai-accountant/${clientId}/reports/supplier-balances`}>Supplier Balances</Link></MenubarItem>
                        <MenubarItem asChild><Link href={`/admin/ai-accountant/${clientId}/reports/supplier-ledger`}>Supplier Ledger</Link></MenubarItem>
                    </MenubarContent>
                </MenubarMenu>
                 <MenubarMenu>
                    <MenubarTrigger className="py-2">General Journal</MenubarTrigger>
                     <MenubarContent>
                         <MenubarItem asChild><Link href={`/admin/ai-accountant/${clientId}/general-journal`}>Post General Journal</Link></MenubarItem>
                    </MenubarContent>
                </MenubarMenu>
                <MenubarMenu><MenubarTrigger className="py-2">Items</MenubarTrigger></MenubarMenu>
                <MenubarMenu>
                     <MenubarTrigger className="py-2">Banking <ChevronDown className="h-3 w-3 ml-1" /></MenubarTrigger>
                     <MenubarContent>
                        <MenubarItem asChild><Link href={`/admin/ai-accountant/${clientId}/bank/transactions`}>Bank & Credit Cards</Link></MenubarItem>
                         <MenubarItem asChild><Link href={`/admin/ai-accountant/${clientId}/reports/bank-transactions`}>Bank Transaction Report</Link></MenubarItem>
                     </MenubarContent>
                </MenubarMenu>
                <MenubarMenu>
                    <MenubarTrigger className="py-2">VAT <ChevronDown className="h-3 w-3 ml-1" /></MenubarTrigger>
                    <MenubarContent>
                        <MenubarItem asChild><Link href={`/admin/ai-accountant/${clientId}/reports/vat201`}>VAT201</Link></MenubarItem>
                        <MenubarItem asChild><Link href={`/admin/ai-accountant/${clientId}/reports/vat-transactions`}>VAT Transactions</Link></MenubarItem>
                        <MenubarItem asChild><Link href={`/admin/ai-accountant/${clientId}/reports/vat-recon`}>VAT Recon</Link></MenubarItem>
                        <MenubarItem asChild><Link href={`/admin/ai-accountant/${clientId}/reports/vat-audit`}>VAT Audit</Link></MenubarItem>
                    </MenubarContent>
                </MenubarMenu>
                <MenubarMenu>
                    <MenubarTrigger className="py-2">Reports <ChevronDown className="h-3 w-3 ml-1" /></MenubarTrigger>
                    <MenubarContent>
                        <MenubarItem asChild><Link href={`/admin/ai-accountant/${clientId}/reports/profit-and-loss`}>Profit & Loss</Link></MenubarItem>
                        <MenubarItem asChild><Link href={`/admin/ai-accountant/${clientId}/reports/trial-balance`}>Trial Balance</Link></MenubarItem>
                        <MenubarItem asChild><Link href={`/admin/ai-accountant/${clientId}/reports/general-ledger`}>General Ledger</Link></MenubarItem>
                        <MenubarItem asChild><Link href={`/admin/ai-accountant/${clientId}/reports/transaction-search`}>Transaction Search</Link></MenubarItem>
                        <MenubarItem asChild><Link href={`/admin/ai-accountant/${clientId}/reports/gl-recon`}>GL Recon</Link></MenubarItem>
                        <MenubarItem asChild><Link href={`/admin/ai-accountant/${clientId}/reports/age-analysis`}>Age Analysis</Link></MenubarItem>
                        <MenubarSeparator />
                        <MenubarItem asChild><Link href={`/admin/ai-accountant/${clientId}/reports/customer-ledger`}>Customer Ledger</Link></MenubarItem>
                        <MenubarItem asChild><Link href={`/admin/ai-accountant/${clientId}/reports/supplier-balances`}>Supplier Balances</Link></MenubarItem>
                        <MenubarItem asChild><Link href={`/admin/ai-accountant/${clientId}/reports/supplier-ledger`}>Supplier Ledger</Link></MenubarItem>
                        <MenubarSeparator />
                        <MenubarItem asChild><Link href={`/admin/ai-accountant/${clientId}/reports/account-transactions`}>Account Transactions</Link></MenubarItem>
                    </MenubarContent>
                </MenubarMenu>
            </Menubar>
            
            <main>
                {children}
            </main>
        </div>
    );
}

