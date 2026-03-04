
'use client';

import { ReactNode, useEffect, useState } from 'react';
import { ProtectedRoute, useAuth } from '@/contexts/AuthContext';
import { SidebarProvider, Sidebar, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import DashboardNav from '@/components/dashboard/DashboardNav';
import { Skeleton } from '@/components/ui/skeleton';
import { useRouter, usePathname } from 'next/navigation';
import { getFirestore, doc, updateDoc, increment, serverTimestamp } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { LapsedSubscriptionScreen } from '@/components/partner/LapsedSubscriptionScreen';

const db = getFirestore(firebaseApp);

export default function PartnerLayout({ children }: { children: ReactNode }) {
  const { user, isAuthenticated } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
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
                        'subscription.monthlyTotal': currentMonthlyTotal
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
                  </div>

                  {isLapsed ? (
                      <div className="flex items-center justify-center min-h-[70vh]">
                        <LapsedSubscriptionScreen user={user} />
                      </div>
                  ) : (
                      children
                  )}
              </div>
          </SidebarInset>
        </div>
      </SidebarProvider>
    </ProtectedRoute>
  );
}
