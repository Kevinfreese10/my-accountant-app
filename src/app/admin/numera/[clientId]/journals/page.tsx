
'use client';
import { redirect, useParams } from 'next/navigation';

export default function NumeraJournalsRedirectPage() {
  const params = useParams();
  const clientId = params.clientId as string;
  redirect(`/admin/ai-accountant/${clientId}/journals`);
  return null;
}
