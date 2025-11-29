
'use client';
import { redirect } from 'next/navigation';

export default function VatReconRedirectPage({ params }: { params: { clientId: string }}) {
  redirect(`/admin/ai-accountant/${params.clientId}/reports/vat-recon`);
  return null;
}
