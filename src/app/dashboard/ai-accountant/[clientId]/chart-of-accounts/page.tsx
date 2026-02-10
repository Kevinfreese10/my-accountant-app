
'use client';
import { redirect, useParams } from 'next/navigation';

export default function NumeraChartOfAccountsRedirectPage() {
  const params = useParams();
  const clientId = params.clientId as string;
  redirect(`/admin/ai-accountant/${clientId}/chart-of-accounts`);
  return null;
}
