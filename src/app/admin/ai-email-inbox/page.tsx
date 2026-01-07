

'use client';

import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Inbox, Loader2, RefreshCw, Send, Trash, Archive, Bot, MoreHorizontal, Eye, PlusCircle, Mail, Send as SendIcon, Forward, CheckCircle, Pencil, Paperclip, ArchiveRestore, Sparkles } from "lucide-react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { proofreadNote } from '@/ai/flows/proofread-note';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';


const db = getFirestore(firebaseApp);

const newEmailFormSchema = z.object({
  to: z.string().email('A valid recipient email is required.'),
  cc: z.string().optional(),
  bcc: z.string().optional(),
  subject: z.string().min(3, 'Subject is required.'),
  body: z.string().min(10, 'Email body is required.'),
});


export default function AIEmailInboxPage() {
    const { user } = useAuth();
    const { toast } = useToast();
    const [isSyncing, setIsSyncing] = useState(false);
    const [inboxEmails, setInboxEmails] = useState<ProcessedEmail[]>([]);
    const [archivedEmails, setArchivedEmails] = useState<ProcessedEmail[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedEmailId, setSelectedEmailId] = useState<string | null>(null);
    const [isDrafting, setIsDrafting] = useState<string | null>(null);
    const [draftReplies, setDraftReplies] = useState<Record<string, { reply: string, cc?: string, bcc?: string }>>({});
    const [isSending, setIsSending] = useState<string | null>(null);
    const [allStaff, setAllStaff] = useState<User[]>([]);
    const [staffByDept, setStaffByDept] = useState<Record<string, User[]>>({});
    const [isTaskFormOpen, setIsTaskFormOpen] = useState(false);
    const [selectedTask, setSelectedTask] = useState<Task | null>(null);
    const [isNewEmailOpen, setIsNewEmailOpen] = useState(false);
    const [isSendingNew, setIsSendingNew] = useState(false);
    const [isProofreading, setIsProofreading] = useState(false);

    const newEmailForm = useForm<z.infer<typeof newEmailFormSchema>>({
        resolver: zodResolver(newEmailFormSchema),
        defaultValues: { to: '', cc: '', bcc: '', subject: '', body: '' },
    });


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

            const newEmailsQuery = query(
                collection(db, 'processedEmails'),
                where('ownerId', '==', user.uid),
                where('status', '==', 'new'),
                orderBy('date', 'desc')
            );
            const newUnsubscribe = onSnapshot(newEmailsQuery, (snapshot) => {
                const fetchedEmails = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ProcessedEmail));
                setInboxEmails(fetchedEmails);
                setIsLoading(false);
            }, (error) => {
                console.error("Error fetching new emails:", error);
                toast({ title: 'Error', description: 'Could not fetch new emails.', variant: 'destructive'});
                setIsLoading(false);
            });

            const archivedEmailsQuery = query(
                collection(db, 'processedEmails'),
                where('ownerId', '==', user.uid),
                where('status', '==', 'archived'),
                orderBy('date', 'desc')
            );
            const archivedUnsubscribe = onSnapshot(archivedEmailsQuery, (snapshot) => {
                const fetchedEmails = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ProcessedEmail));
                setArchivedEmails(fetchedEmails);
            }, (error) => {
                console.error("Error fetching archived emails:", error);
                toast({ title: 'Error', description: 'Could not fetch archived emails.', variant: 'destructive'});
            });

            return () => {
                newUnsubscribe();
                archivedUnsubscribe();
            };
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
    
    const handleUpdateStatus = async (emailId: string, status: 'new' | 'archived') => {
        try {
            const emailRef = doc(db, 'processedEmails', emailId);
            await updateDoc(emailRef, { status: status });
            const action = status === 'archived' ? 'Archived' : 'Restored';
            toast({ title: `Email ${action}` });
            if (selectedEmailId === emailId) {
                setSelectedEmailId(null);
            }
        } catch (error) {
            toast({ title: 'Error', description: 'Could not update email status.', variant: 'destructive' });
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
            const draft = result.draft + `\n\n${user?.emailSignature || ''}`;
            await updateDoc(doc(db, 'processedEmails', email.id), { aiDraftReply: draft });
            setDraftReplies(prev => ({...prev, [email.id]: { reply: draft, cc: '', bcc: '' }}));
        } catch (e) {
            toast({ title: 'Failed to draft reply', variant: 'destructive' });
        } finally {
            setIsDrafting(null);
        }
    };
    
    const handleSendReply = async (email: ProcessedEmail) => {
        const draftData = draftReplies[email.id] || { reply: email.aiDraftReply || '' };
        if (!draftData.reply || !user || !user.email) return;

        setIsSending(email.id);
        toast({ title: 'Sending Email...', description: `Sending reply to ${email.from.address}.` });

        try {
            const emailHtml = draftData.reply.replace(/\n\n/g, '<br/><br/>').replace(/\n/g, '<br/>');

            await sendEmail({
                to: email.from.address,
                cc: draftData.cc?.split(',').map(e => e.trim()).filter(Boolean),
                bcc: draftData.bcc?.split(',').map(e => e.trim()).filter(Boolean),
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
    
    const onNewEmailSubmit = async (values: z.infer<typeof newEmailFormSchema>) => {
        if (!user?.email) return;
        setIsSendingNew(true);
        toast({ title: 'Sending New Email...', description: 'Please wait.' });
        try {
            const emailHtml = values.body.replace(/\n\n/g, '<br/><br/>').replace(/\n/g, '<br/>');
            await sendEmail({
                to: values.to,
                cc: values.cc?.split(',').map(e => e.trim()).filter(Boolean),
                bcc: values.bcc?.split(',').map(e => e.trim()).filter(Boolean),
                subject: values.subject,
                html: emailHtml,
                replyTo: user.email,
            });
            toast({ title: 'Email Sent!', description: `Your email to ${values.to} has been sent.` });
            setIsNewEmailOpen(false);
            newEmailForm.reset();
        } catch (e) {
            toast({ title: 'Failed to send email', variant: 'destructive' });
        } finally {
            setIsSendingNew(false);
        }
    }

    const handleProofread = async (isNew: boolean, text?: string, formUpdater?: (newText: string) => void) => {
      const currentText = text;
      if (!currentText || currentText.trim().length < 10) {
        toast({ title: "Not enough text", description: "Please write a longer message to proofread.", variant: "destructive" });
        return;
      }
      setIsProofreading(true);
      try {
        const result = await proofreadNote({ text: currentText });
        if (formUpdater) {
          formUpdater(result.proofreadText);
        }
        toast({ title: "Note Proofread", description: "Your message has been improved by AI." });
      } catch (e) {
        console.error(e);
        toast({ title: "Proofreading Failed", variant: "destructive" });
      } finally {
        setIsProofreading(false);
      }
    };


    const EmailItem = ({ email }: { email: ProcessedEmail }) => (
        <div className="w-full text-left p-4 space-y-2">
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
             <div className="p-3 bg-background rounded-md border space-y-2">
                 <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Bot className="h-4 w-4 text-primary" />
                        <h4 className="text-sm font-semibold">AI Summary & Actions</h4>
                    </div>
                     <div className="flex items-center gap-2">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleReplyToEmail(email)}><Mail className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleForwardEmail(email)}><Forward className="h-4 w-4" /></Button>
                        {email.status === 'new' && (
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleUpdateStatus(email.id, 'archived')}><Archive className="h-4 w-4" /></Button>
                        )}
                        {email.status === 'archived' && (
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleUpdateStatus(email.id, 'new')}><ArchiveRestore className="h-4 w-4" /></Button>
                        )}
                    </div>
                 </div>

                 {email.aiSummary ? (
                    <ReactMarkdown className="text-xs prose prose-sm max-w-none"
                    components={{ p: ({node, ...props}) => <p className="my-1" {...props} /> }}
                    >{email.aiSummary}</ReactMarkdown>
                 ) : (
                    <p className="text-xs text-muted-foreground">No AI summary available for this email.</p>
                 )}
                 
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
                            defaultValue={draftReplies[email.id]?.reply || email.aiDraftReply}
                            onChange={(e) => setDraftReplies(prev => ({...prev, [email.id]: {...(prev[email.id] || {reply:''}), reply: e.target.value}}))}
                            rows={5}
                            className="text-xs bg-white"
                        />
                        <div className="grid grid-cols-2 gap-2">
                             <Input placeholder="CC" className="text-xs h-8" value={draftReplies[email.id]?.cc || ''} onChange={(e) => setDraftReplies(prev => ({...prev, [email.id]: {...(prev[email.id] || {reply:''}), cc: e.target.value}}))} />
                            <Input placeholder="BCC" className="text-xs h-8" value={draftReplies[email.id]?.bcc || ''} onChange={(e) => setDraftReplies(prev => ({...prev, [email.id]: {...(prev[email.id] || {reply:''}), bcc: e.target.value}}))} />
                        </div>
                        <div className="flex items-center gap-2">
                            {email.replySent ? (
                                <Badge variant="success"><CheckCircle className="mr-2 h-4 w-4"/> Reply Sent</Badge>
                            ) : (
                              <Button size="sm" onClick={(e) => { e.stopPropagation(); handleSendReply(email); }} disabled={isSending === email.id}>
                                {isSending === email.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <SendIcon className="mr-2 h-4 w-4" />}
                                Send Email Reply
                              </Button>
                            )}
                             <Button size="sm" variant="outline" onClick={() => handleProofread(false, draftReplies[email.id]?.reply, (newText) => setDraftReplies(prev => ({...prev, [email.id]: {...(prev[email.id] || {reply:''}), reply: newText}})))} disabled={isProofreading}>
                                {isProofreading ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Sparkles className="mr-2 h-4 w-4" />}
                                Proofread
                            </Button>
                        </div>
                     </div>
                 )}

                 <div className="flex items-center gap-2 pt-2">
                    <Button size="sm" variant="default" onClick={() => {
                        const taskTitle = email.aiTask?.title || email.subject;
                        const taskDescription = email.aiTask?.description || `Follow up on email from ${email.from.name || email.from.address}:\n\n${email.text}`;
                        setSelectedTask({
                            title: taskTitle,
                            description: taskDescription,
                            id: email.id,
                        } as unknown as Task);
                        setIsTaskFormOpen(true);
                    }}
                    disabled={email.taskCreated}
                    >
                        {email.taskCreated ? <><CheckCircle className="mr-2 h-4 w-4" />Task Created</> : <><PlusCircle className="mr-2 h-4 w-4" />Create Task</>}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => handleDraftReply(email)} disabled={isDrafting === email.id}>
                        {isDrafting === email.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Mail className="mr-2 h-4 w-4" />}
                        {isDrafting === email.id ? 'Drafting...' : 'Draft Reply'}
                    </Button>
                </div>
                 <div className="flex items-center gap-2 pt-2">
                    {email.aiCategory && <Badge variant="secondary">{email.aiCategory}</Badge>}
                    {email.aiPriority && <Badge variant={email.aiPriority === 'High' ? 'destructive' : 'outline'}>{email.aiPriority}</Badge>}
                 </div>
            </div>
        </div>
    );

    return (
        <div className="space-y-8">
             <Dialog open={isTaskFormOpen} onOpenChange={setIsTaskFormOpen}>
                <DialogContent className="sm:max-w-xl">
                    <DialogHeader>
                        <DialogTitle>Create New Task</DialogTitle>
                        <DialogDescription>
                            A new task will be created based on the email content. You can edit the details below.
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
            <Dialog open={isNewEmailOpen} onOpenChange={setIsNewEmailOpen}>
                <DialogContent className="sm:max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Compose New Email</DialogTitle>
                    </DialogHeader>
                    <Form {...newEmailForm}>
                        <form onSubmit={newEmailForm.handleSubmit(onNewEmailSubmit)} className="space-y-4">
                             <FormField control={newEmailForm.control} name="to" render={({ field }) => ( <FormItem><FormLabel>To</FormLabel><FormControl><Input placeholder="recipient@example.com" {...field} /></FormControl><FormMessage /></FormItem>)} />
                             <FormField control={newEmailForm.control} name="cc" render={({ field }) => ( <FormItem><FormLabel>CC</FormLabel><FormControl><Input placeholder="Optional: cc@example.com" {...field} /></FormControl><FormMessage /></FormItem>)} />
                             <FormField control={newEmailForm.control} name="bcc" render={({ field }) => ( <FormItem><FormLabel>BCC</FormLabel><FormControl><Input placeholder="Optional: bcc@example.com" {...field} /></FormControl><FormMessage /></FormItem>)} />
                             <FormField control={newEmailForm.control} name="subject" render={({ field }) => ( <FormItem><FormLabel>Subject</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                             <FormField control={newEmailForm.control} name="body" render={({ field }) => ( <FormItem><FormLabel>Body</FormLabel><FormControl><Textarea rows={8} {...field} /></FormControl><FormMessage /></FormItem>)} />
                            <DialogFooter>
                                <Button type="button" variant="outline" onClick={() => handleProofread(true, newEmailForm.getValues('body'), (newText) => newEmailForm.setValue('body', newText))} disabled={isProofreading}>
                                    {isProofreading ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Sparkles className="mr-2 h-4 w-4" />}
                                    Proofread
                                </Button>
                                <Button type="submit" disabled={isSendingNew}>
                                    {isSendingNew ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <SendIcon className="mr-2 h-4 w-4"/>}
                                    Send Email
                                </Button>
                            </DialogFooter>
                        </form>
                    </Form>
                </DialogContent>
            </Dialog>
            <div className="flex items-center justify-between">
                <h1 className="text-3xl font-bold tracking-tight">AI Email Inbox</h1>
                <div className="flex gap-2">
                    <Button onClick={() => setIsNewEmailOpen(true)}>
                        <Pencil className="mr-2 h-4 w-4" /> New Email
                    </Button>
                    <Button onClick={handleSyncEmails} disabled={isSyncing}>
                        {isSyncing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                        Sync Emails
                    </Button>
                </div>
            </div>
            <Tabs defaultValue="inbox">
                 <TabsList>
                    <TabsTrigger value="inbox">Inbox ({inboxEmails.length})</TabsTrigger>
                    <TabsTrigger value="archived">Archived ({archivedEmails.length})</TabsTrigger>
                </TabsList>
                <TabsContent value="inbox">
                    <Card>
                        <CardContent className="p-0">
                            <ScrollArea className="h-[calc(100vh-18rem)]">
                            {isLoading ? (
                                <div className="flex justify-center items-center h-full">
                                    <Loader2 className="h-6 w-6 animate-spin"/>
                                </div>
                            ) : inboxEmails.length === 0 ? (
                                <div className="text-center p-8 text-muted-foreground">
                                    <Inbox className="mx-auto h-12 w-12" />
                                    <p className="mt-4 text-sm">Your inbox is empty.</p>
                                    <p className="text-xs">Click "Sync Emails" to get started.</p>
                                </div>
                            ) : (
                                <div className="divide-y">
                                    {inboxEmails.map(email => <EmailItem key={email.id} email={email} />)}
                                </div>
                            )}
                            </ScrollArea>
                        </CardContent>
                    </Card>
                </TabsContent>
                <TabsContent value="archived">
                     <Card>
                        <CardContent className="p-0">
                            <ScrollArea className="h-[calc(100vh-18rem)]">
                            {isLoading ? (
                                <div className="flex justify-center items-center h-full">
                                    <Loader2 className="h-6 w-6 animate-spin"/>
                                </div>
                            ) : archivedEmails.length === 0 ? (
                                <div className="text-center p-8 text-muted-foreground">
                                    <Archive className="mx-auto h-12 w-12" />
                                    <p className="mt-4 text-sm">No archived emails.</p>
                                </div>
                            ) : (
                                <div className="divide-y">
                                    {archivedEmails.map(email => <EmailItem key={email.id} email={email} />)}
                                </div>
                            )}
                            </ScrollArea>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
