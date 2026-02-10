
'use client';

import { redirect, useParams } from 'next/navigation';

export default function QuotesRedirectPage() {
  const params = useParams();
  const clientId = params.clientId as string;
  redirect(`/admin/ai-accountant/${clientId}/quotes`);
  return null;
}
