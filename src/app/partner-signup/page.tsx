
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';
import PartnerSignupForm from '@/components/auth/PartnerSignupForm';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Become a Partner',
  description: 'Join the My Accountant partner program to grow your practice, access new opportunities, and leverage our expert team and technology.',
};

export default function PartnerSignupPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4 sm:p-6 lg:p-8">
      <Card className="w-full max-w-3xl">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold tracking-tight">Become a Partner</CardTitle>
          <CardDescription>Fill out the form below to join our partner program.</CardDescription>
        </CardHeader>
        <CardContent>
          <PartnerSignupForm />
          <div className="mt-6 text-center text-sm text-muted-foreground">
            Already have an account?{' '}
            <Link href="/login" className="font-semibold text-primary underline-offset-4 hover:underline">
              Log in
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
