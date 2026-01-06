
'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';
import AIAccountantSignupForm from '@/components/auth/AIAccountantSignupForm';
import { Suspense } from 'react';
import { Loader2 } from 'lucide-react';

function SignupFormWrapper() {
  return (
    <Suspense fallback={<div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div>}>
      <AIAccountantSignupForm />
    </Suspense>
  );
}

export default function AIAccountantSignupPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4 sm:p-6 lg:p-8">
      <Card className="w-full max-w-2xl">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold tracking-tight">AI Accountant Signup</CardTitle>
          <CardDescription>Create an account to start automating your bookkeeping.</CardDescription>
        </CardHeader>
        <CardContent>
          <SignupFormWrapper />
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
