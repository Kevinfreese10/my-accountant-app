
'use client';
import { redirect, useSearchParams, useParams } from 'next/navigation';
import { Suspense } from 'react';

function Redirector() {
  const params = useParams();
  const clientId = params.clientId as string;
  const searchParams = useSearchParams();
  const accountId = searchParams.get('accountId');
  const redirectUrl = `/admin/ai-accountant/${clientId}/bank/transactions${accountId ? `?accountId=${accountId}` : ''}`;
  redirect(redirectUrl);
  return null;
}

export default function NumeraBankTransactionsRedirectPage() {
  return (
    <Suspense fallback={null}>
      <Redirector />
    </Suspense>
  );
}
