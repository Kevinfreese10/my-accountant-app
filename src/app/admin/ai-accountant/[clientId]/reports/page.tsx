
import { redirect } from 'next/navigation';

export default async function ReportsRedirectPage({ params }: { params: Promise<{ clientId: string }> }) {
  const { clientId } = await params;
  redirect(`/admin/ai-accountant/${clientId}/reports/trial-balance`);
  return null;
}
