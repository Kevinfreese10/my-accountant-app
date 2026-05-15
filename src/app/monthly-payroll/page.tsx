import MonthlyPayrollPageClient from '@/components/payroll/MonthlyPayrollPageClient';
import { getStaticPageMetadata } from '@/lib/seo-utils';
import { Metadata } from 'next';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function generateMetadata(): Promise<Metadata> {
    const defaults: Metadata = {
        title: 'Monthly Payroll Services | My Accountant',
        description: 'Professional monthly payroll management for South African businesses. Digital payslips, EMP201 submissions, and UIF declarations.',
    };
    return getStaticPageMetadata('monthly-payroll', defaults);
}

export default function MonthlyPayrollPage() {
  return <MonthlyPayrollPageClient />;
}
