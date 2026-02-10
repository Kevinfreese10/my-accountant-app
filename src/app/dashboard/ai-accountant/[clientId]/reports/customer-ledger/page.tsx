
'use client';

import { redirect, useParams } from 'next/navigation';

export default function CustomerLedgerRedirectPage() {
  const params = useParams();
  const clientId = params.clientId as string;
  redirect(`/admin/ai-accountant/${clientId}/reports/customer-ledger`);
  return null;
}
