
'use client';
import { redirect, useParams } from 'next/navigation';

export default function TransactionSearchRedirectPage() {
  const params = useParams();
  const clientId = params.clientId as string;
  redirect(`/admin/ai-accountant/${clientId}/reports/transaction-search`);
  return null;
}
