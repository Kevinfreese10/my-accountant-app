import { redirect } from 'next/navigation';

export default function OldSeoRedirectPage() {
  redirect('/admin/pages');
  return null;
}
