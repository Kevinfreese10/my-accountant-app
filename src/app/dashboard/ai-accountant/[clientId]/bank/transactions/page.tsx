
'use client';
import { redirect, useSearchParams, useParams } from 'next/navigation';

export default function NumeraBankTransactionsRedirectPage() {
  const params = useParams();
  const clientId = params.clientId as string;
  const searchParams = useSearchParams();
  const accountId = searchParams.get('accountId');
  const redirectUrl = `/admin/ai-accountant/${clientId}/bank/transactions${accountId ? `?accountId=${accountId}` : ''}`;
  redirect(redirectUrl);
  return null;
}
