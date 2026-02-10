
'use client';
import { redirect, useParams } from 'next/navigation';

export default function NumeraTrialBalanceRedirectPage() {
  const params = useParams();
  const clientId = params.clientId as string;
  redirect(`/admin/ai-accountant/${clientId}/reports/trial-balance`);
  return null;
}
