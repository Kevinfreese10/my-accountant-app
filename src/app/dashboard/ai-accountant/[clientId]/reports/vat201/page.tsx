
'use client';
import { redirect } from 'next/navigation';

export default function Vat201RedirectPage({ params }: { params: { clientId: string }}) {
  redirect(`/admin/ai-accountant/${params.clientId}/reports/vat201`);
  return null;
}
