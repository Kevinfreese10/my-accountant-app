
'use client';
import { redirect, useParams } from 'next/navigation';

export default function NumeraGeneralLedgerRedirectPage() {
  const params = useParams();
  const clientId = params.clientId as string;
  redirect(`/admin/ai-accountant/${clientId}/reports/general-ledger`);
  return null;
}
