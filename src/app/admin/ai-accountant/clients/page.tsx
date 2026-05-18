'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Loader2, ArrowRight, Search, Building } from 'lucide-react';
import { getFirestore, collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { User } from '@/lib/types';
import Link from 'next/link';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

const db = getFirestore(firebaseApp);

export default function AIAccountantClientsPage() {
    const [clients, setClients] = useState<User[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        const q = query(collection(db, 'aiAccountantClients'), orderBy('name'));
        const unsubscribe = onSnapshot(q, (snap) => {
            const fetchedClients = snap.docs.map(d => ({ ...d.data(), id: d.id } as User));
            setClients(fetchedClients);
            setIsLoading(false);
        }, (error) => {
            console.error("Error fetching AI Accountant clients:", error);
            setIsLoading(false);
        });
        return () => unsubscribe();
    }, []);

    const filteredClients = clients.filter(c => 
        c.name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
        c.companyName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.email?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-slate-900">AI Accountant Clients</h1>
                    <p className="text-sm text-muted-foreground font-medium uppercase tracking-widest">Administrative Overview</p>
                </div>
            </div>

            <Card className="border-2 shadow-sm">
                <CardHeader className="bg-muted/30 pb-4 border-b">
                    <div className="flex items-center gap-4">
                        <div className="relative flex-grow max-w-md">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input 
                                placeholder="Search by name, company or email..." 
                                className="pl-8 h-10" 
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    {isLoading ? (
                        <div className="flex justify-center py-20"><Loader2 className="animate-spin text-primary h-8 w-8" /></div>
                    ) : filteredClients.length === 0 ? (
                        <div className="text-center py-20 text-muted-foreground font-medium">
                            <Building className="h-12 w-12 mx-auto mb-4 opacity-20" />
                            <p>No AI Accountant clients found.</p>
                        </div>
                    ) : (
                        <Table>
                            <TableHeader className="bg-muted/10">
                                <TableRow>
                                    <TableHead className="font-bold">Client / Company</TableHead>
                                    <TableHead className="font-bold">Email Address</TableHead>
                                    <TableHead className="font-bold">VAT Status</TableHead>
                                    <TableHead className="font-bold">Status</TableHead>
                                    <TableHead className="text-right font-bold">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredClients.map(client => (
                                    <TableRow key={client.id} className="hover:bg-muted/5 transition-colors">
                                        <TableCell className="font-bold text-slate-900">
                                            <div className="flex flex-col">
                                                <span>{client.companyName || client.name}</span>
                                                {client.companyName && client.name !== client.companyName && (
                                                    <span className="text-[10px] text-muted-foreground font-medium">{client.name}</span>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-sm text-slate-600">{client.email}</TableCell>
                                        <TableCell>
                                            {client.isVatRegistered ? (
                                                <Badge variant="success" className="text-[10px] font-bold px-2 py-0">Registered</Badge>
                                            ) : (
                                                <Badge variant="secondary" className="text-[10px] font-bold px-2 py-0 opacity-50">Not Registered</Badge>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant={client.status === 'Active' ? 'default' : 'secondary'} className="text-[10px] uppercase font-bold">
                                                {client.status || 'Active'}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Button variant="outline" size="sm" asChild className="font-bold border-primary/20 text-primary hover:bg-primary hover:text-white transition-all">
                                                <Link href={`/admin/ai-accountant/${client.id}/dashboard`}>
                                                    Open Dashboard <ArrowRight className="ml-2 h-4 w-4" />
                                                </Link>
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
                <CardFooter className="bg-muted/30 border-t py-3 text-right justify-end">
                    <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">
                        Total {filteredClients.length} clients detected
                    </p>
                </CardFooter>
            </Card>
        </div>
    );
}
