
'use client';
import { redirect, useParams } from 'next/navigation';

// This is a temporary redirect. The actual page for client customers in the dashboard
// will need to be implemented separately if the functionality differs from the admin view.
export default function ClientCustomersRedirectPage() {
  const params = useParams();
  const clientId = params.clientId as string;
  redirect(`/admin/ai-accountant/${clientId}/customers`);
  return null;
}
