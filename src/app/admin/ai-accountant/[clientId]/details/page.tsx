
'use client';
import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { User } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import ClientForm from '@/components/admin/ClientForm';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function CompanyDetailsPage() {
    const params = useParams();
    const clientId = params.clientId as string;
    const [client, setClient] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const { toast } = useToast();

    useEffect(() => {
        if (clientId) {
            const fetchClient = async () => {
                const docRef = doc(db, 'aiAccountantClients', clientId);
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    setClient({ id: docSnap.id, ...docSnap.data() } as User);
                }
                setIsLoading(false);
            };
            fetchClient();
        }
    }, [clientId]);

    const handleFormSubmit = async (data: any) => {
        if (!client) return;

        const { createAIProfile, ...clientFormData } = data;
        
        const updateData: Partial<User> = {
            ...clientFormData,
            name: data.name,
            companyName: data.name,
            yearEnd: data.yearEnd || null,
        };
        
        if (!data.isVatRegistered) {
            updateData.vatNumber = '';
            updateData.vatCategory = undefined;
        }

        try {
            await setDoc(doc(db, "aiAccountantClients", client.id), updateData, { merge: true });
            toast({ title: 'Client Updated' });
            // Optionally re-fetch client data
            const updatedDoc = await getDoc(doc(db, 'aiAccountantClients', client.id));
             if (updatedDoc.exists()) {
                setClient({ id: updatedDoc.id, ...updatedDoc.data() } as User);
            }
        } catch (error) {
            console.error("Error saving client:", error);
            toast({ title: 'Error', description: 'Could not save the client.', variant: 'destructive'});
        }
    };
    
    if (isLoading) {
        return (
            <div className="flex justify-center items-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }
    
    if (!client) {
        return <p>Client not found.</p>
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Company Details</CardTitle>
                <CardDescription>Manage the company information for this AI Accountant profile.</CardDescription>
            </CardHeader>
            <CardContent>
                <ClientForm 
                    client={client}
                    onSubmit={handleFormSubmit}
                    onCancel={() => {}} 
                    isAIClient={true}
                />
            </CardContent>
        </Card>
    );
}
