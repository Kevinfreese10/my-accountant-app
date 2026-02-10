
'use client';

import { redirect, useParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2 } from 'lucide-react';

export default function AIAccountantClientDashboardPage() {
    const params = useParams();
    const { user } = useAuth();
    const clientId = params.clientId as string;

    if (!user) {
        return (
            <div className="flex justify-center items-center h-64">
                <Loader2 className="h-8 w-8 animate-spin" />
            </div>
        );
    }
    
    // Admins/staff go to the full dashboard, ai_accountant users go directly to the restricted bank view
    if (user.role === 'admin' || user.role === 'staff' || user.role === 'cap_staff' || user.role === 'cap_supervisor') {
        redirect(`/admin/ai-accountant/${clientId}/dashboard`);
    } else { // This would be the ai_accountant user
        redirect(`/admin/ai-accountant/${clientId}/bank/transactions`);
    }

    return null;
}
