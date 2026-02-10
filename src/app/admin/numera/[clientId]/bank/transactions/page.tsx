
'use client';
import { redirect, useSearchParams, useParams } from 'next/navigation';

export default function NumeraBankTransactionsRedirectPage() {
  const params = useParams();
  const clientId = params.clientId as string;
  const redirectUrl = `/admin/ai-accountant/${clientId}/bank/transactions`;
  redirect(redirectUrl);
  return null;
}
