
'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Inbox, Loader2, RefreshCw, Send, Trash, Archive, Bot, MoreHorizontal, Eye, PlusCircle, Mail, Send as SendIcon } from "lucide-react";
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { collection, query, where, orderBy, onSnapshot, getFirestore, doc, updateDoc, Timestamp, arrayUnion } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { OrderNote, ProcessedEmail } from '@/lib/types';
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
import { generateEmailReply } from '@/ai/flows/generate-email-reply';
import { Textarea } from '@/components/ui/textarea';


const db = getFirestore(firebaseApp);

export default function AIEmailInboxPage() {
    const { user } = useAuth();
    const { toast } = useToast();
    const [isSyncing, setIsSyncing] = useState(false);
    const [emails, setEmails] = useState<ProcessedEmail[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedEmail, setSelectedEmail] = useState<ProcessedEmail | null>(null);
    const [isViewOpen, setIsViewOpen] = useState(false);
    const [isDrafting, setIsDrafting] = useState<string | null>(null);
    const [draftReplies, setDraftReplies] = useState<Record<string, string>>({});

    useEffect(() => {
        if (user?.uid) {
            setIsLoading(true);
            const q = query(
                collection(db, 'processedEmails'),
                where('ownerId', '==', user.uid),
                where('status', '==', 'new'),
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
    
    const handleArchiveEmail = async (emailId: string) => {
        try {
            const emailRef = doc(db, 'processedEmails', emailId);
            await updateDoc(emailRef, { status: 'archived' });
            toast({ title: 'Email Archived' });
            if (selectedEmail?.id === emailId) {
                setIsViewOpen(false);
            }
        } catch (error) {
            toast({ title: 'Error', description: 'Could not archive email.', variant: 'destructive' });
        }
    };

    const handleReplyToEmail = (email: ProcessedEmail) => {
        let body = `\n\n\n--- Original Message ---\nFrom: ${email.from.name} <${email.from.address}>\nDate: ${new Date(email.date.seconds * 1000).toUTCString()}\nSubject: ${email.subject}\n\n${email.text}`;
        
        const draft = draftReplies[email.id] || email.aiDraftReply;
        if (draft) {
            body = `${draft.replace(/\n/g, '\n')}${body}`;
        }
        
        const mailtoLink = `mailto:${email.from.address}?subject=Re: ${encodeURIComponent(email.subject)}&body=${encodeURIComponent(body)}`;
        window.location.href = mailtoLink;
    };


    const handleDraftReply = async (email: ProcessedEmail) => {
        setIsDrafting(email.id);
        try {
            const result = await generateEmailReply({
                subject: email.subject,
                body: email.text,
                sender: email.from.name || email.from.address,
            });
            await updateDoc(doc(db, 'processedEmails', email.id), { aiDraftReply: result.draft });
            setDraftReplies(prev => ({...prev, [email.id]: result.draft}));
             if (selectedEmail?.id === email.id) {
                setSelectedEmail(prev => prev ? { ...prev, aiDraftReply: result.draft } : null);
            }
        } catch (e) {
            toast({ title: 'Failed to draft reply', variant: 'destructive' });
        } finally {
            setIsDrafting(null);
        }
    };
    
     const handleSendReply = async (email: ProcessedEmail) => {
        const draft = draftReplies[email.id] || email.aiDraftReply;
        if (!draft || !user) return;
        
        const orderIdMatch = email.subject.match(/ORD-\d+/);
        if (!orderIdMatch) {
            toast({ title: "Cannot Post Note", description: "Could not find an Order ID in the email subject.", variant: "destructive" });
            return;
        }
        const orderId = orderIdMatch[0];

        try {
            const newNote: OrderNote = {
                text: draft,
                authorId: user.uid,
                date: Timestamp.now(),
                type: 'note',
                subject: `Re: ${email.subject}`,
            };
            const orderRef = doc(db, 'orders', orderId);
            await updateDoc(orderRef, {
                notes: arrayUnion(newNote),
            });

            toast({ title: "Reply Sent!", description: "Your note has been posted to the order." });
            await handleArchiveEmail(email.id);
        } catch (e) {
            toast({ title: "Failed to post note", description: "Could not find a matching order to post the note to.", variant: "destructive" });
        }
    };


    const ActionButton = ({ email }: { email: ProcessedEmail}) => {
        const action = email.aiSuggestedAction;
        if (!action) return null;

        const actionMap: { [key: string]: { icon: React.ReactNode, label: string, onClick?: () => void } } = {
            create_task: { icon: <PlusCircle className="mr-2 h-4 w-4" />, label: 'Create Task', onClick: () => alert('Create task functionality coming soon!') },
            draft_reply: { 
                icon: isDrafting === email.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Mail className="mr-2 h-4 w-4" />, 
                label: isDrafting === email.id ? 'Drafting...' : 'Draft Reply',
                onClick: () => handleDraftReply(email),
            },
            archive: { icon: <Archive className="mr-2 h-4 w-4" />, label: 'Archive', onClick: () => handleArchiveEmail(email.id) },
            none: { icon: <></>, label: '', onClick: undefined }
        };
        
        const actionDetails = actionMap[action];
        if (!actionDetails || !actionDetails.onClick) return null;

        return (
            <Button size="sm" variant="outline" onClick={actionDetails.onClick} disabled={isDrafting === email.id}>
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
                                        className={cn("w-full text-left p-4 space-y-2 cursor-pointer hover:bg-muted/50", selectedEmail?.id === email.id && "bg-muted")}
                                        onClick={() => handleViewEmail(email)}
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
                                        </div>
                                         {email.aiSummary && (
                                            <div className="p-3 bg-background rounded-md border space-y-2">
                                                 <div className="flex items-center gap-2">
                                                    <Bot className="h-4 w-4 text-primary" />
                                                    <h4 className="text-sm font-semibold">AI Summary & Actions</h4>
                                                 </div>
                                                 <ReactMarkdown className="text-xs"
                                                  components={{ p: ({node, ...props}) => <p className="my-0" {...props} /> }}
                                                 >{email.aiSummary}</ReactMarkdown>
                                                 {(draftReplies[email.id] || email.aiDraftReply) && (
                                                     <div className="p-2 border-l-2 border-primary bg-primary/10 space-y-2">
                                                        <p className="text-xs font-semibold">Suggested Reply:</p>
                                                         <Textarea 
                                                            defaultValue={draftReplies[email.id] || email.aiDraftReply}
                                                            onChange={(e) => setDraftReplies(prev => ({...prev, [email.id]: e.target.value}))}
                                                            className="text-xs h-auto bg-white"
                                                            rows={4}
                                                          />
                                                          <Button size="sm" onClick={(e) => { e.stopPropagation(); handleSendReply(email); }}>
                                                            <SendIcon className="mr-2 h-4 w-4"/>Post Note Reply
                                                          </Button>
                                                     </div>
                                                 )}
                                                 <div className="flex items-center gap-2 pt-2">
                                                    <ActionButton email={email} />
                                                    {email.aiCategory && <Badge variant="secondary">{email.aiCategory}</Badge>}
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
                    <div className="flex gap-2 pt-2">
                        {selectedEmail && (
                           <>
                             <Button size="sm" onClick={() => handleReplyToEmail(selectedEmail)}><Send className="mr-2 h-4 w-4" />Reply</Button>
                             <Button size="sm" variant="outline" onClick={() => handleArchiveEmail(selectedEmail.id)}><Archive className="mr-2 h-4 w-4" />Archive</Button>
                           </>
                        )}
                    </div>
                </DialogHeader>
                 <div className="flex-1 -m-6 mt-2">
                    {selectedEmail?.html ? (
                        <iframe
                            srcDoc={selectedEmail.html}
                            className="w-full h-full border-0"
                            sandbox=""
                        />
                    ) : (
                        <pre className="w-full h-full text-sm whitespace-pre-wrap p-6">{selectedEmail?.text}</pre>
                    )}
                 </div>
            </DialogContent>
        </Dialog>
    );
}
