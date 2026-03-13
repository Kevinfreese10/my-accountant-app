/**
 * @fileOverview Layout for the Become a Partner flow.
 * Forces dynamic rendering to ensure fresh content delivery.
 */
import { ReactNode } from 'react';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function BecomeAPartnerLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
