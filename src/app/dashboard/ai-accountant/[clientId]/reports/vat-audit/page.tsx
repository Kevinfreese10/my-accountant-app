
'use client';
import { redirect } from 'next/navigation';

export default function VatAuditRedirectPage({ params }: { params: { clientId: string }}) {
  redirect(`/admin/ai-accountant/${params.clientId}/reports/vat-audit`);
  return null;
}
