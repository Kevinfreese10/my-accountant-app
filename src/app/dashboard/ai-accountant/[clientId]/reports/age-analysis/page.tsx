
'use client';

import { redirect, useParams } from 'next/navigation';

export default function AgeAnalysisRedirectPage() {
  const params = useParams();
  const clientId = params.clientId as string;
  redirect(`/admin/ai-accountant/${clientId}/reports/age-analysis`);
  return null;
}
