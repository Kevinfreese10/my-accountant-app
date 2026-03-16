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
import { PendingSetupScreen } from '@/components/partner/PendingSetupScreen';

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

  // Automated billing check removed - BEI is now free-to-join with zero monthly subscription.
  useEffect(() => {
    setIsBillingCheck(false);
  }, [user]);

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

  // Pending setup and lapsed statuses are deprecated in the free model
  const isLapsed = user?.subscription?.subscriptionStatus === 'lapsed';
  const isPendingSetup = user?.status === 'Pending Setup Payment';

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

                  {isPendingSetup ? (
                      <div className="flex items-center justify-center min-h-[70vh]">
                        <PendingSetupScreen user={user} />
                      </div>
                  ) : isLapsed ? (
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
