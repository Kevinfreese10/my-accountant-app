
'use client';
import { redirect, useParams } from 'next/navigation';

export default function NumeraRedirectLayout() {
  const params = useParams();
  const clientId = params.clientId as string;
  redirect(`/admin/ai-accountant/${clientId}/dashboard`);
  return null;
}
