/**
 * @fileOverview Layout for the BEI flow.
 * Forces dynamic rendering to ensure fresh content delivery.
 */
import { ReactNode } from 'react';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function BEILayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
