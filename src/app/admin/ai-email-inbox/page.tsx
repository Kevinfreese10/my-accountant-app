
'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Inbox, Loader2, RefreshCw, Send, Trash, Archive, Bot, Mail } from "lucide-react";
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { collection, query, where, orderBy, onSnapshot, getFirestore } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { ProcessedEmail } from '@/lib/types';
import { format, isToday, isThisWeek, isThisYear } from 'date-fns';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import ReactMarkdown from 'react-markdown';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

const db = getFirestore(firebaseApp);

export default function AIEmailInboxPage() {
    const { user } = useAuth();
    const { toast } = useToast();
    const [isSyncing, setIsSyncing] = useState(false);
    const [emails, setEmails] = useState<ProcessedEmail[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedEmail, setSelectedEmail] = useState<ProcessedEmail | null>(null);

    useEffect(() => {
        if (user?.uid) {
            setIsLoading(true);
            const q = query(
                collection(db, 'processedEmails'),
                where('ownerId', '==', user.uid),
                orderBy('date', 'desc')
            );
            const unsubscribe = onSnapshot(q, (snapshot) => {
                const fetchedEmails = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ProcessedEmail));
                setEmails(fetchedEmails);
                setIsLoading(false);
            }, (error) => {
                console.error("Error fetching emails:", error);
                toast({ title: 'Error', description: 'Could not fetch emails.', variant: 'destructive'});
                setIsLoading(false);
            });

            return () => unsubscribe();
        }
    }, [user, toast]);

    const handleSyncEmails = async () => {
        if (!user?.uid) {
            toast({ title: 'Error', description: 'You must be logged in to sync emails.', variant: 'destructive' });
            return;
        }

        setIsSyncing(true);
        toast({ title: 'Syncing Emails...', description: 'Please wait, this may take a moment.' });

        try {
            const response = await fetch('/api/ai-inbox/fetch-emails', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: user.uid }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to sync emails.');
            }

            toast({ title: 'Sync Complete', description: data.message });
        } catch (error: any) {
            toast({ title: 'Sync Failed', description: error.message, variant: 'destructive' });
        } finally {
            setIsSyncing(false);
        }
    };
    
    const formatDate = (timestamp: any): string => {
        if (!timestamp) return 'N/A';
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        if (isToday(date)) {
            return format(date, 'HH:mm');
        }
        if (isThisWeek(date, { weekStartsOn: 1 })) {
            return format(date, 'EEE');
        }
        if (isThisYear(date)) {
            return format(date, 'dd MMM');
        }
        return format(date, 'dd/MM/yyyy');
    };

    return (
        <div className="space-y-8">
            <div className="flex items-center justify-between">
                <h1 className="text-3xl font-bold tracking-tight">AI Email Inbox</h1>
                <Button onClick={handleSyncEmails} disabled={isSyncing}>
                    {isSyncing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                    Sync Emails
                </Button>
            </div>
            <Card className="h-[calc(100vh-12rem)]">
                <div className="grid grid-cols-1 md:grid-cols-[350px_1fr] h-full">
                    <div className="border-r">
                        <div className="p-4 border-b">
                            <h2 className="text-lg font-semibold">Inbox ({emails.length})</h2>
                        </div>
                        <ScrollArea className="h-[calc(100vh-16rem)]">
                        {isLoading ? (
                            <div className="flex justify-center items-center h-full">
                                <Loader2 className="h-6 w-6 animate-spin"/>
                            </div>
                        ) : emails.length === 0 ? (
                            <div className="text-center p-8 text-muted-foreground">
                                <Inbox className="mx-auto h-12 w-12" />
                                <p className="mt-4 text-sm">Your inbox is empty.</p>
                                <p className="text-xs">Click "Sync Emails" to get started.</p>
                            </div>
                        ) : (
                            <div className="divide-y">
                                {emails.map(email => (
                                    <button 
                                        key={email.id} 
                                        className={cn("w-full text-left p-4 hover:bg-muted/50", selectedEmail?.id === email.id && "bg-muted")}
                                        onClick={() => setSelectedEmail(email)}
                                    >
                                        <div className="flex justify-between items-start">
                                            <p className="font-semibold truncate">{email.from.name || email.from.address}</p>
                                            <p className="text-xs text-muted-foreground flex-shrink-0 ml-2">{formatDate(email.date)}</p>
                                        </div>
                                        <p className="text-sm truncate font-medium">{email.subject}</p>
                                        <p className="text-xs text-muted-foreground truncate">{email.snippet}</p>
                                    </button>
                                ))}
                            </div>
                        )}
                        </ScrollArea>
                    </div>
                    <div className="flex flex-col">
                        {selectedEmail ? (
                            <div className="p-4 border-b space-y-2">
                                <h3 className="text-xl font-bold">{selectedEmail.subject}</h3>
                                <div className="flex justify-between items-center">
                                    <div>
                                        <p className="text-sm font-semibold">{selectedEmail.from.name}</p>
                                        <p className="text-xs text-muted-foreground">{selectedEmail.from.address}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-xs text-muted-foreground">{formatDate(selectedEmail.date)}</p>
                                    </div>
                                </div>
                                <div className="flex gap-2 pt-2">
                                    <Button size="sm" variant="outline"><Send className="mr-2 h-4 w-4"/>Reply</Button>
                                    <Button size="sm" variant="outline"><Trash className="mr-2 h-4 w-4"/>Delete</Button>
                                    <Button size="sm" variant="outline"><Archive className="mr-2 h-4 w-4"/>Archive</Button>
                                </div>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                                <Mail className="h-16 w-16 mb-4"/>
                                <p>Select an email to read</p>
                            </div>
                        )}
                    </div>
                </div>
            </Card>
        </div>
    );
}
