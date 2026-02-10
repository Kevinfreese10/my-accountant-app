
'use client';
import { redirect, useParams } from 'next/navigation';

export default function BankTransactionsReportRedirectPage() {
  const params = useParams();
  const clientId = params.clientId as string;
  redirect(`/admin/ai-accountant/${clientId}/reports/bank-transactions`);
  return null;
}
