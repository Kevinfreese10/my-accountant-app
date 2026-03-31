'use client';
import { redirect } from 'next/navigation';

export default function PartnerTasksRedirectPage() {
  redirect('/partner/dashboard');
  return null;
}
