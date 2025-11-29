
'use client';
import { redirect } from 'next/navigation';

export default function EMP201RedirectPage({ params }: { params: { clientId: string }}) {
  redirect(`/admin/ai-accountant/${params.clientId}/reports/emp201`);
  return null;
}
