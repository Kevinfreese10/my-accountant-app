
'use client';
import { redirect, useParams } from 'next/navigation';

export default function VatReconRedirectPage() {
  const params = useParams();
  const clientId = params.clientId as string;
  redirect(`/admin/ai-accountant/${clientId}/reports/vat-recon`);
  return null;
}
