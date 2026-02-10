
'use client';

import { redirect, useParams } from 'next/navigation';

export default function CreditNotesRedirectPage() {
  const params = useParams();
  const clientId = params.clientId as string;
  redirect(`/admin/ai-accountant/${clientId}/credit-notes`);
  return null;
}
