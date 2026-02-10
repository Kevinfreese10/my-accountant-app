
'use client';

import { redirect, useParams } from 'next/navigation';

export default function GeneralJournalRedirectPage() {
  const params = useParams();
  const clientId = params.clientId as string;
  redirect(`/admin/ai-accountant/${clientId}/general-journal`);
  return null;
}
