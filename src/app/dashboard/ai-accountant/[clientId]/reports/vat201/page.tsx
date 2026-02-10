
'use client';
import { redirect, useParams } from 'next/navigation';

export default function Vat201RedirectPage() {
  const params = useParams();
  const clientId = params.clientId as string;
  redirect(`/admin/ai-accountant/${clientId}/reports/vat201`);
  return null;
}
