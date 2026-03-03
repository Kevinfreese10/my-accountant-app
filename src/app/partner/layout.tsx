'use client';

import { ReactNode, useEffect, useState } from 'react';
import { ProtectedRoute, useAuth } from '@/contexts/AuthContext';
import { SidebarProvider, Sidebar, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import DashboardNav from '@/components/dashboard/DashboardNav';
import { Skeleton } from '@/components/ui/skeleton';
import { useRouter } from 'next/navigation';
import { getFirestore, doc, updateDoc, increment, serverTimestamp } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, Wallet2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';

const db = getFirestore(firebaseApp);

export default function PartnerLayout({ children }: { children: ReactNode }) {
  const { user, isAuthenticated } = useAuth();
  const router = useRouter();
  const [isBillingChecking, setIsBillingCheck] = useState(true);
  
  useEffect(() => {
    if (isAuthenticated && user?.role !== 'partner' && user?.role !== 'partner_staff') {
      router.push('/login');
    }
  }, [isAuthenticated, user, router]);

  useEffect(() => {
    const performBillingCheck = async () => {
        if (!user || user.role !== 'partner') {
            setIsBillingCheck(false);
            return;
        }

        // Default base subscription is R499 if not set
        const BASE_SUB = 499;
        const currentMonthlyTotal = user.subscription?.monthlyTotal || BASE_SUB;

        const now = new Date();
        const lastBillingDate = user.subscription?.lastBillingDate?.toDate ? user.subscription.lastBillingDate.toDate() : new Date(0);
        
        // Billing check: Is it a new month since the last deduction?
        // We trigger deduction if more than 28 days have passed since last billing
        const daysSinceLastBilling = (now.getTime() - lastBillingDate.getTime()) / (1000 * 60 * 60 * 24);
        const isNewBillingPeriod = daysSinceLastBilling > 28;

        if (isNewBillingPeriod) {
            const partnerRef = doc(db, 'users', user.uid);

            if ((user.creditBalance || 0) >= currentMonthlyTotal) {
                try {
                    await updateDoc(partnerRef, {
                        creditBalance: increment(-currentMonthlyTotal),
                        'subscription.lastBillingDate': serverTimestamp(),
                        'subscription.subscriptionStatus': 'active',
                        'subscription.monthlyTotal': currentMonthlyTotal // Ensure it's initialized
                    });
                    console.log('Automated monthly billing successful.');
                } catch (e) {
                    console.error('Automated billing failed:', e);
                }
            } else {
                try {
                    await updateDoc(partnerRef, {
                        'subscription.subscriptionStatus': 'lapsed'
                    });
                    console.warn('Subscription lapsed due to insufficient credits.');
                } catch (e) {
                    console.error('Failed to update lapsed status:', e);
                }
            }
        }
        setIsBillingCheck(false);
    };

    if (isAuthenticated && user) {
        performBillingCheck();
    }
  }, [isAuthenticated, user]);

  if (isAuthenticated === undefined || (isAuthenticated && user?.role !== 'partner' && user?.role !== 'partner_staff')) {
     return (
        <div className="flex min-h-screen">
            <Skeleton className="hidden md:block w-16 lg:w-64" />
            <div className="flex-1 p-4 sm:p-6 lg:p-8 space-y-4">
                <Skeleton className="h-12 w-1/3" />
                <Skeleton className="h-[60vh] w-full" />
            </div>
      </div>
     );
  }

  const isLapsed = user?.subscription?.subscriptionStatus === 'lapsed';
  const monthlyTotal = user?.subscription?.monthlyTotal || 499;

  return (
    <ProtectedRoute>
      <SidebarProvider>
        <div className="flex min-h-screen bg-background text-foreground">
          {user && (
            <Sidebar collapsible="icon" className="border-r">
              <DashboardNav user={user} />
            </Sidebar>
          )}
          <SidebarInset>
              <div className="p-4 sm:p-6 lg:p-8">
                  <div className="flex items-center gap-4 mb-6">
                      <SidebarTrigger className="md:hidden" />
                      {isLapsed && (
                          <div className="flex flex-col gap-1">
                              <Badge variant="destructive" className="w-fit text-[10px] h-4">Subscription Lapsed</Badge>
                          </div>
                      )}
                  </div>

                  {isLapsed && (
                      <Alert variant="destructive" className="mb-8 border-2 shadow-lg animate-in fade-in zoom-in-95">
                          <AlertCircle className="h-5 w-5" />
                          <AlertTitle className="font-bold">Practice Subscription Lapsed</AlertTitle>
                          <AlertDescription className="space-y-4">
                              <p>Your practice wallet has insufficient credits to cover your monthly subscription of <strong>R{monthlyTotal}</strong>. This fee covers your hosting, support, and included staff users. Please top up your wallet to resume service.</p>
                              <Button asChild variant="outline" className="border-destructive text-destructive hover:bg-destructive hover:text-white font-bold">
                                  <Link href="/partner/dashboard">
                                      <Wallet2 className="mr-2 h-4 w-4"/>
                                      Top Up Practice Wallet
                                  </Link>
                              </Button>
                          </AlertDescription>
                      </Alert>
                  )}

                  {children}
              </div>
          </SidebarInset>
        </div>
      </SidebarProvider>
    </ProtectedRoute>
  );
}
