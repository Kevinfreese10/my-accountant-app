'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PlusCircle, Loader2, ArrowRight, Edit, Users } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { getFirestore, collection, getDocs, query, orderBy, where, doc, setDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { User } from '@/lib/types';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import ClientForm from '@/components/admin/ClientForm';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';

const db = getFirestore(firebaseApp);

export default function AIPayrollClientsPage() {
  const [clients, setClients] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<User | null>(null);
  const { toast } = useToast();
  const { user: currentUser } = useAuth();

  const fetchClients = async () => {
    setIsLoading(true);
    try {
      const q = query(collection(db, "aiPayrollClients"), orderBy("name"));
      const snapshot = await getDocs(q);
      setClients(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as User)));
    } catch (error) {
      console.error("Error fetching payroll clients:", error);
      toast({ title: 'Error', description: 'Could not load payroll clients.', variant: 'destructive'});
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchClients();
  }, []);

  const handleFormSubmit = async (data: any) => {
    if (!currentUser) return;
    
    const clientData = {
      ...data,
      clientSource: 'ai_payroll',
      role: 'client',
      source: 'AI Payroll',
    };

    try {
      if (selectedClient?.id) {
        await setDoc(doc(db, "aiPayrollClients", selectedClient.id), clientData, { merge: true });
        toast({ title: 'Client Updated' });
      } else {
        const newRef = doc(collection(db, "aiPayrollClients"));
        await setDoc(newRef, {
          ...clientData,
          id: newRef.id,
          uid: newRef.id,
          createdAt: serverTimestamp(),
          createdBy: currentUser.uid,
        });
        toast({ title: 'Client Created' });
      }
      fetchClients();
      setIsFormOpen(false);
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to save client.', variant: 'destructive'});
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">AI Payroll Clients</h1>
          <p className="text-muted-foreground">Manage companies and employees for payroll processing.</p>
        </div>
        <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => setSelectedClient(null)}>
              <PlusCircle className="mr-2 h-4 w-4" />
              New Payroll Client
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>{selectedClient ? 'Edit Client' : 'Add Payroll Client'}</DialogTitle>
            </DialogHeader>
            <ClientForm 
              client={selectedClient} 
              onSubmit={handleFormSubmit}
              onCancel={() => setIsFormOpen(false)}
              isPayrollClient={true}
            />
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Practice Payroll List</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="animate-spin" /></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Company</TableHead>
                  <TableHead>PAYE Ref</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clients.map(client => (
                  <TableRow key={client.id}>
                    <TableCell>
                        <div className="flex flex-col">
                            <span className="font-bold">{client.name}</span>
                            <span className="text-[10px] text-muted-foreground">{client.registrationNumber || 'No Reg Number'}</span>
                        </div>
                    </TableCell>
                    <TableCell className="text-xs font-mono">{client.payeReference || 'N/A'}</TableCell>
                    <TableCell><Badge variant="outline">Active</Badge></TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="icon" onClick={() => { setSelectedClient(client); setIsFormOpen(true); }}>
                            <Edit className="h-4 w-4" />
                        </Button>
                        <Button asChild variant="ghost" size="sm">
                            <Link href={`/admin/ai-payroll/${client.id}/dashboard`}>
                            Manage Payroll <ArrowRight className="ml-2 h-4 w-4" />
                            </Link>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {clients.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-12 text-muted-foreground">
                      No payroll clients found. Create one to get started.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
