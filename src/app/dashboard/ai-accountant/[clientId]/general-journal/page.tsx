
'use client';

import { redirect } from 'next/navigation';

export default function GeneralJournalRedirectPage({ params }: { params: { clientId: string }}) {
  redirect(`/admin/ai-accountant/${params.clientId}/general-journal`);
  return null;
}
