'use client';
import { redirect } from 'next/navigation';

export default function PartnerToolsRedirectPage() {
  redirect('/partner/dashboard');
  return null;
}
