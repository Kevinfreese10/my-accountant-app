
'use client';
import { redirect } from 'next/navigation';

export default function VatTransactionsRedirectPage({ params }: { params: { clientId: string }}) {
  redirect(`/admin/ai-accountant/${params.clientId}/reports/vat-transactions`);
  return null;
}
