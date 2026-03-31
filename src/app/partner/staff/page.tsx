'use client';
import { redirect } from 'next/navigation';

export default function PartnerStaffRedirectPage() {
  redirect('/partner/dashboard');
  return null;
}
