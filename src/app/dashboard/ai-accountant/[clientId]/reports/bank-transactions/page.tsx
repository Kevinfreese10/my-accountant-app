
'use client';
import { redirect } from 'next/navigation';

export default function BankTransactionsReportRedirectPage({ params }: { params: { clientId: string }}) {
  redirect(`/admin/ai-accountant/${params.clientId}/reports/bank-transactions`);
  return null;
}
