
'use client';
import { redirect, useParams } from 'next/navigation';

export default function NumeraAccountTransactionsRedirectPage() {
  const params = useParams();
  const clientId = params.clientId as string;
  redirect(`/admin/ai-accountant/${clientId}/reports/account-transactions`);
  return null;
}
