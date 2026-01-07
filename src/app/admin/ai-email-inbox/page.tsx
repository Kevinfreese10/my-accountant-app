
'use client';

import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Inbox, Loader2, RefreshCw, Send, Trash, Archive, Bot, MoreHorizontal, Eye, PlusCircle, Mail, Send as SendIcon, Forward, CheckCircle, Pencil, Paperclip } from "lucide-react";
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { collection, query, where, orderBy, onSnapshot, getFirestore, doc, updateDoc, Timestamp, arrayUnion, addDoc, getDocs } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { OrderNote, ProcessedEmail, User, Task } from '@/lib/types';
import { format, isToday, isThisWeek, isThisYear } from 'date-fns';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import ReactMarkdown from 'react-markdown';
import { generateEmailReply } from '@/ai/flows/generate-email-reply';
import { Textarea } from '@/components/ui/textarea';
import { sendEmail } from '@/lib/email';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import TaskForm from '@/components/admin/TaskForm'; 

const db = getFirestore(firebaseApp);

export default function AIEmailInboxPage() {
    const { user } = useAuth();
    const { toast } = useToast();
    const [isSyncing, setIsSyncing] = useState(false);
    const [emails, setEmails] = useState<ProcessedEmail[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedEmailId, setSelectedEmailId] = useState<string | null>(null);
    const [isDrafting, setIsDrafting] = useState<string | null>(null);
    const [draftReplies, setDraftReplies] = useState<Record<string, string>>({});
    const [isSending, setIsSending] = useState<string | null>(null);
    const [allStaff, setAllStaff] = useState<User[]>([]);
    const [staffByDept, setStaffByDept] = useState<Record<string, User[]>>({});
    const [isTaskFormOpen, setIsTaskFormOpen] = useState(false);
    const [selectedTask, setSelectedTask] = useState<Task | null>(null);


    useEffect(() => {
        if (user?.uid) {
            setIsLoading(true);
            const staffQuery = query(collection(db, "users"), where('role', 'in', ['staff', 'admin']));
            getDocs(staffQuery).then(staffSnapshot => {
                const fetchedStaff = staffSnapshot.docs.map(doc => ({ ...doc.data(), uid: doc.id, id: doc.id } as User));
                setAllStaff(fetchedStaff);
                
                const byDept: Record<string, User[]> = {};
                fetchedStaff.forEach(staff => {
                    if (staff.department) {
                        if (!byDept[staff.department]) {
                            byDept[staff.department] = [];
                        }
                        byDept[staff.department].push(staff);
                    }
                });
                setStaffByDept(byDept);
            });

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
                throw new Error(data.details || 'Failed to sync emails.');
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
    
    const handleArchiveEmail = async (emailId: string) => {
        try {
            const emailRef = doc(db, 'processedEmails', emailId);
            await updateDoc(emailRef, { status: 'archived' });
            toast({ title: 'Email Archived' });
            if (selectedEmailId === emailId) {
                setSelectedEmailId(null);
            }
        } catch (error) {
            toast({ title: 'Error', description: 'Could not archive email.', variant: 'destructive' });
        }
    };

    const handleReplyToEmail = (email: ProcessedEmail) => {
        const mailtoLink = `mailto:${email.from.address}?subject=Re: ${encodeURIComponent(email.subject)}`;
        window.location.href = mailtoLink;
    };

    const handleForwardEmail = (email: ProcessedEmail) => {
        const body = `\n\n\n--- Original Message ---\nFrom: ${email.from.name} <${email.from.address}>\nDate: ${new Date(email.date.seconds * 1000).toUTCString()}\nSubject: ${email.subject}\n\n${email.text}`;
        const mailtoLink = `mailto:?subject=Fwd: ${encodeURIComponent(email.subject)}&body=${encodeURIComponent(body)}`;
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
        } catch (e) {
            toast({ title: 'Failed to draft reply', variant: 'destructive' });
        } finally {
            setIsDrafting(null);
        }
    };
    
    const handleSendReply = async (email: ProcessedEmail) => {
        const draft = draftReplies[email.id] || email.aiDraftReply;
        if (!draft || !user || !user.email) return;

        setIsSending(email.id);
        toast({ title: 'Sending Email...', description: `Sending reply to ${email.from.address}.` });

        try {
            const emailHtml = draft.replace(/\n\n/g, '<br/><br/>').replace(/\n/g, '<br/>');

            await sendEmail({
                to: email.from.address,
                subject: `Re: ${email.subject}`,
                html: emailHtml,
                replyTo: user.email,
            });

            const emailRef = doc(db, 'processedEmails', email.id);
            await updateDoc(emailRef, { replySent: true });

            toast({ title: "Reply Sent!", description: "Your email has been sent successfully." });

        } catch (e) {
            console.error(e);
            toast({ title: "Failed to send email", description: "Could not send the email. Please check your SMTP settings in your profile.", variant: "destructive" });
        } finally {
            setIsSending(null);
        }
    };
    
    const handleCreateTask = async (task: Partial<Task>, emailId: string) => {
        if (!user?.id) return;
        try {
            await addDoc(collection(db, 'tasks'), {
                ...task,
                status: 'To-Do',
                createdBy: user.id,
                createdAt: Timestamp.now(),
                comments: [],
            });
            
            // Flag the email as task created
            await updateDoc(doc(db, 'processedEmails', emailId), {
                taskCreated: true,
            });

            toast({ title: 'Task Created Successfully' });
            setIsTaskFormOpen(false);
            setSelectedTask(null);
        } catch (error) {
            console.error(error);
            toast({ title: 'Error', description: 'Could not create task.', variant: 'destructive' });
        }
    };


    const ActionButton = ({ email }: { email: ProcessedEmail}) => {

        const handleCreateTaskClick = () => {
            if (email.aiTask) {
                setSelectedTask({
                    title: email.aiTask.title,
                    description: email.aiTask.description,
                    id: email.id, // Pass email id to link it
                } as unknown as Task);
                setIsTaskFormOpen(true);
            }
        };

        if (email.taskCreated) {
            return <Badge variant="secondary"><CheckCircle className="mr-2 h-4 w-4" />Task Created</Badge>;
        }

        return (
            <div className="flex items-center gap-2 pt-2">
                {email.aiSuggestedAction === 'create_task' && (
                    <Button size="sm" variant="default" onClick={handleCreateTaskClick}>
                        <PlusCircle className="mr-2 h-4 w-4" /> Create Task
                    </Button>
                )}
                <Button size="sm" variant="outline" onClick={() => handleDraftReply(email)} disabled={isDrafting === email.id}>
                    {isDrafting === email.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Mail className="mr-2 h-4 w-4" />}
                    {isDrafting === email.id ? 'Drafting...' : 'Draft Reply'}
                </Button>
            </div>
        );
    }

    return (
        <div className="space-y-8">
             <Dialog open={isTaskFormOpen} onOpenChange={setIsTaskFormOpen}>
                <DialogContent className="sm:max-w-xl">
                    <DialogHeader>
                        <DialogTitle>Create New Task</DialogTitle>
                        <DialogDescription>
                            A new task will be created based on the AI's suggestion. You can edit the details below.
                        </DialogDescription>
                    </DialogHeader>
                    <TaskForm 
                        task={selectedTask}
                        onSubmit={(taskData) => {
                            if(selectedTask?.id) handleCreateTask(taskData, selectedTask.id);
                        }}
                        onCancel={() => setIsTaskFormOpen(false)}
                        onCommentSubmit={() => {}} // Not needed for new task
                        allStaff={allStaff}
                        staffByDept={staffByDept}
                    />
                </DialogContent>
            </Dialog>
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
                                    className="w-full text-left p-4 space-y-2"
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
                                             <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <Bot className="h-4 w-4 text-primary" />
                                                    <h4 className="text-sm font-semibold">AI Summary & Actions</h4>
                                                </div>
                                                 <div className="flex items-center gap-2">
                                                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleReplyToEmail(email)}><Mail className="h-4 w-4" /></Button>
                                                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleForwardEmail(email)}><Forward className="h-4 w-4" /></Button>
                                                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleArchiveEmail(email.id)}><Archive className="h-4 w-4" /></Button>
                                                </div>
                                             </div>
                                             <ReactMarkdown className="text-xs prose prose-sm max-w-none"
                                              components={{ p: ({node, ...props}) => <p className="my-1" {...props} /> }}
                                             >{email.aiSummary}</ReactMarkdown>
                                             
                                             {email.attachments && email.attachments.length > 0 && (
                                                <div className="pt-2">
                                                     <p className="text-xs font-semibold mb-1">Attachments:</p>
                                                     <div className="flex flex-wrap gap-2">
                                                        {email.attachments.filter(att => att.filename && !att.filename.toLowerCase().endsWith('.png')).map((att, index) => (
                                                             <a
                                                                key={index}
                                                                href={att.dataUrl || '#'}
                                                                download={att.filename || 'attachment'}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="text-xs flex items-center gap-1.5 bg-muted p-1.5 rounded-md hover:bg-muted/80"
                                                            >
                                                                <Paperclip className="h-3 w-3"/>
                                                                {att.filename || 'download'}
                                                            </a>
                                                        ))}
                                                     </div>
                                                </div>
                                             )}

                                             {(draftReplies[email.id] || email.aiDraftReply) && (
                                                 <div className="p-2 border-l-2 border-primary bg-primary/10 space-y-2">
                                                    <p className="text-xs font-semibold">Suggested Reply:</p>
                                                      <Textarea 
                                                          defaultValue={draftReplies[email.id] || email.aiDraftReply}
                                                          onChange={(e) => setDraftReplies(prev => ({...prev, [email.id]: e.target.value}))}
                                                          rows={5}
                                                          className="text-xs bg-white"
                                                      />
                                                      <div className="flex items-center gap-2">
                                                          {email.replySent ? (
                                                              <Badge variant="success"><CheckCircle className="mr-2 h-4 w-4"/> Reply Sent</Badge>
                                                          ) : (
                                                            <Button size="sm" onClick={(e) => { e.stopPropagation(); handleSendReply(email); }} disabled={isSending === email.id}>
                                                              {isSending === email.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <SendIcon className="mr-2 h-4 w-4" />}
                                                              Send Email Reply
                                                            </Button>
                                                          )}
                                                      </div>
                                                 </div>
                                             )}
                                             <ActionButton email={email} />
                                             <div className="flex items-center gap-2 pt-2">
                                                {email.aiCategory && <Badge variant="secondary">{email.aiCategory}</Badge>}
                                                {email.aiPriority && <Badge variant={email.aiPriority === 'High' ? 'destructive' : 'outline'}>{email.aiPriority}</Badge>}
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
    );
}
