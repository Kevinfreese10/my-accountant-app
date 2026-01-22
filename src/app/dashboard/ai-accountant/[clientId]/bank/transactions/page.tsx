
'use client';
import { redirect, useSearchParams } from 'next/navigation';

export default function NumeraBankTransactionsRedirectPage({ params }: { params: { clientId: string }}) {
  const searchParams = useSearchParams();
  const accountId = searchParams.get('accountId');
  const redirectUrl = `/admin/ai-accountant/${params.clientId}/bank/transactions${accountId ? `?accountId=${accountId}` : ''}`;
  redirect(redirectUrl);
  return null;
}

    