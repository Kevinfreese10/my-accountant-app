'use client';
import { redirect } from 'next/navigation';

export default function PartnerClientsRedirectPage() {
  redirect('/partner/dashboard');
  return null;
}
