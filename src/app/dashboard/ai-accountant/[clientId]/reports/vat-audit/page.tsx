
'use client';
import { redirect, useParams } from 'next/navigation';

export default function VatAuditRedirectPage() {
  const params = useParams();
  const clientId = params.clientId as string;
  redirect(`/admin/ai-accountant/${clientId}/reports/vat-audit`);
  return null;
}
