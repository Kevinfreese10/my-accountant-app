
'use client';
import { redirect, useSearchParams } from 'next/navigation';

export default function NumeraJournalsRedirectPage({ params }: { params: { clientId: string }}) {
  const searchParams = useSearchParams();
  const type = searchParams.get('type') || 'customer';
  const actorId = searchParams.get('actorId');
  
  let redirectUrl = `/admin/ai-accountant/${params.clientId}/journals?type=${type}`;
  if (actorId) {
    redirectUrl += `&actorId=${actorId}`;
  }
  
  redirect(redirectUrl);
  return null;
}
