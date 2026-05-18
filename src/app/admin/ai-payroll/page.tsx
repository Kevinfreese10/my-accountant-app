'use client';

import { redirect } from 'next/navigation';

export default function AIPayrollRedirectPage() {
    redirect('/admin/ai-payroll/clients');
}
