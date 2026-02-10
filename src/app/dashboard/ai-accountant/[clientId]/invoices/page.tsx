
'use client';
import { redirect, useParams } from 'next/navigation';

// This is a temporary redirect. The actual page for client invoices in the dashboard
// will need to be implemented separately if the functionality differs from the admin view.
export default function ClientInvoicesRedirectPage() {
  const params = useParams();
  const clientId = params.clientId as string;
  redirect(`/admin/ai-accountant/${clientId}/invoices`);
  return null;
}
