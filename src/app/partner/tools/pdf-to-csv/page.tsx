'use client';
import { redirect } from 'next/navigation';

export default function PartnerPdfToCsvRedirectPage() {
  redirect('/partner/dashboard');
  return null;
}
