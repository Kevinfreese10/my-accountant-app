
'use client';
import { redirect, useSearchParams, useParams } from 'next/navigation';
import { Suspense } from 'react';

function Redirector() {
  const params = useParams();
  const clientId = params.clientId as string;
  const searchParams = useSearchParams();
  const type = searchParams.get('type') || 'customer';
  const actorId = searchParams.get('actorId');
  
  let redirectUrl = `/admin/ai-accountant/${clientId}/journals?type=${type}`;
  if (actorId) {
    redirectUrl += `&actorId=${actorId}`;
  }
  
  redirect(redirectUrl);
  return null;
}

export default function NumeraJournalsRedirectPage() {
  return (
    <Suspense fallback={null}>
      <Redirector />
    </Suspense>
  );
}
