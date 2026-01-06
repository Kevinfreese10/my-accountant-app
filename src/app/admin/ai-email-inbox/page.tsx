
'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Inbox, Loader2, RefreshCw, Send, Trash, Archive, Bot, MoreHorizontal, Eye, PlusCircle } from "lucide-react";
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { collection, query, where, orderBy, onSnapshot, getFirestore } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { ProcessedEmail } from '@/lib/types';
import { format, isToday, isThisWeek, isThisYear } from 'date-fns';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import ReactMarkdown from 'react-markdown';


const db = getFirestore(firebaseApp);

export default function AIEmailInboxPage() {
    const { user } = useAuth();
    const { toast } = useToast();
    const [isSyncing, setIsSyncing] = useState(false);
    const [emails, setEmails] = useState<ProcessedEmail[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedEmail, setSelectedEmail] = useState<ProcessedEmail | null>(null);
    const [isViewOpen, setIsViewOpen] = useState(false);

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

    const handleViewEmail = (email: ProcessedEmail) => {
        setSelectedEmail(email);
        setIsViewOpen(true);
    }
    
    const getPriorityBadgeVariant = (priority?: 'High' | 'Medium' | 'Low') => {
        switch(priority) {
            case 'High': return 'destructive';
            case 'Medium': return 'warning';
            case 'Low': return 'secondary';
            default: return 'outline';
        }
    }

    const ActionButton = ({ action }: { action: ProcessedEmail['aiSuggestedAction']}) => {
        if (!action) return null;

        const actionMap = {
            create_task: { icon: <PlusCircle className="mr-2 h-4 w-4" />, label: 'Create Task' },
            draft_reply: { icon: <Send className="mr-2 h-4 w-4" />, label: 'Draft Reply' },
            archive: { icon: <Archive className="mr-2 h-4 w-4" />, label: 'Archive' },
            none: null
        }
        
        const actionDetails = actionMap[action];
        if (!actionDetails) return null;

        return (
            <Button size="sm" variant="outline">
                {actionDetails.icon}
                {actionDetails.label}
            </Button>
        )
    }

    return (
        <Dialog open={isViewOpen} onOpenChange={setIsViewOpen}>
            <div className="space-y-8">
                <div className="flex items-center justify-between">
                    <h1 className="text-3xl font-bold tracking-tight">AI Email Inbox</h1>
                    <Button onClick={handleSyncEmails} disabled={isSyncing}>
                        {isSyncing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                        Sync Emails
                    </Button>
                </div>
                <Card>
                    <CardHeader className="p-4 border-b">
                        <h2 className="text-lg font-semibold">Inbox ({emails.length})</h2>
                    </CardHeader>
                    <CardContent className="p-0">
                        <ScrollArea className="h-[calc(100vh-18rem)]">
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
                                    <div 
                                        key={email.id} 
                                        className={cn("w-full text-left p-4 space-y-2")}
                                    >
                                        <div className="flex justify-between items-start gap-4">
                                            <div className="flex-grow space-y-1 overflow-hidden">
                                                <div className="flex justify-between items-start">
                                                    <p className="font-semibold truncate">{email.from.name || email.from.address}</p>
                                                    <p className="text-xs text-muted-foreground flex-shrink-0 ml-2">{formatDate(email.date)}</p>
                                                </div>
                                                <p className="text-sm truncate font-medium">{email.subject}</p>
                                                <p className="text-xs text-muted-foreground truncate">{email.snippet}</p>
                                            </div>
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" size="icon" className="flex-shrink-0 h-8 w-8">
                                                        <MoreHorizontal className="h-4 w-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent>
                                                    <DropdownMenuItem onSelect={() => handleViewEmail(email)}>
                                                        <Eye className="mr-2 h-4 w-4" /> View Email
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem>
                                                        <Send className="mr-2 h-4 w-4" /> Reply
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem>
                                                        <Archive className="mr-2 h-4 w-4" /> Archive
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </div>
                                         {email.aiSummary && (
                                            <div className="p-3 bg-muted/50 rounded-md border space-y-2">
                                                 <div className="flex items-center gap-2">
                                                    <Bot className="h-4 w-4 text-primary" />
                                                    <h4 className="text-sm font-semibold">AI Summary & Actions</h4>
                                                 </div>
                                                 <ReactMarkdown className="text-xs"
                                                  components={{ p: ({node, ...props}) => <p className="my-0" {...props} /> }}
                                                 >{email.aiSummary}</ReactMarkdown>
                                                 <div className="flex items-center gap-2 pt-2">
                                                    <ActionButton action={email.aiSuggestedAction} />
                                                    {email.aiCategory && <Badge variant="secondary">{email.aiCategory}</Badge>}
                                                    {email.aiPriority && <Badge variant={getPriorityBadgeVariant(email.aiPriority)}>{email.aiPriority}</Badge>}
                                                 </div>
                                            </div>
                                         )}
                                    </div>
                                ))}
                            </div>
                        )}
                        </ScrollArea>
                    </CardContent>
                </Card>
            </div>
            <DialogContent className="sm:max-w-3xl h-[80vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle className="truncate">{selectedEmail?.subject}</DialogTitle>
                    <DialogDescription>From: {selectedEmail?.from.name} ({selectedEmail?.from.address})</DialogDescription>
                </DialogHeader>
                 <div className="flex-1 -m-6 mt-2">
                    {selectedEmail?.html ? (
                        <iframe
                            srcDoc={selectedEmail.html}
                            className="w-full h-full border-0"
                            sandbox="allow-popups allow-popups-to-escape-sandbox"
                        />
                    ) : (
                        <pre className="w-full h-full text-sm whitespace-pre-wrap p-6">{selectedEmail?.text}</pre>
                    )}
                 </div>
            </DialogContent>
        </Dialog>
    );
}
