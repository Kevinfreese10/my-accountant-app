
'use client';
import { redirect, useParams } from 'next/navigation';

export default function VatTransactionsRedirectPage() {
  const params = useParams();
  const clientId = params.clientId as string;
  redirect(`/admin/ai-accountant/${clientId}/reports/vat-transactions`);
  return null;
}
