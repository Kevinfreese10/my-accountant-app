'use client';
import { redirect } from 'next/navigation';

export default function TransactionSearchRedirectPage({ params }: { params: { clientId: string }}) {
  redirect(`/admin/ai-accountant/${params.clientId}/reports/transaction-search`);
  return null;
}
