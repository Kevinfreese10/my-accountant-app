'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Inbox, RefreshCw, Bot, Send, ArrowRight, BookUser, Archive, Edit } from "lucide-react";
import { useToast } from "@/hooks/use-toast';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { categorizeSupportRequest } from '@/ai/flows/categorize-support-requests';
import { generateEmailReply } from '@/ai/flows/generate-email-reply';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { addDoc, collection, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Task } from '@/lib/types';
import Link from 'next/link';

type Email = {
    uid: number;
    from: string;
    subject: string;
    body: string;
    date: string;
    analysis?: {
        summary: string;
        category: string;
        priority: 'High' | 'Medium' | 'Low';
        suggestedAction: 'create_task' | 'draft_reply' | 'archive' | 'none';
        task?: {
            shouldCreate: boolean;
            title?: string;
            description?: string;
        };
    };
    draft?: string;
};

export default function AIEmailInboxPage() {
    const [emails, setEmails] = useState<Email[]>([]);
    const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isAnalyzing, setIsAnalyzing] = useState<number | null>(null);
    const [isDrafting, setIsDrafting] = useState<number | null>(null);
    const [isCreatingTask, setIsCreatingTask] = useState<number | null>(null);

    const { toast } = useToast();
    const { user } = useAuth();

    const fetchEmails = useCallback(async (showToast = true) => {
        setIsLoading(true);
        if(showToast) {
            toast({ title: "Fetching Emails...", description: "Connecting to the mail server." });
        }
        try {
            const response = await fetch('/api/ai-inbox/fetch-emails');
            if (!response.ok) throw new Error('Failed to fetch emails');
            const data = await response.json();
            setEmails(data.emails);
            if(showToast) {
                toast({ title: "Success!", description: `Found ${data.emails.length} new emails.` });
            }
        } catch (error) {
            console.error("Error fetching emails:", error);
            if(showToast) {
                toast({ title: 'Error', description: 'Could not connect to the mail server.', variant: 'destructive' });
            }
        } finally {
            setIsLoading(false);
        }
    }, [toast]);
    
    useEffect(() => {
        fetchEmails(false);
    }, []);

    const handleRefresh = () => {
        setSelectedEmail(null);
        fetchEmails(true);
    };
    
    const handleAnalyze = async (email: Email) => {
        if (!email) return;
        setIsAnalyzing(email.uid);
        toast({ title: "Analyzing Email...", description: "The AI is processing the content." });
        try {
            const result = await categorizeSupportRequest({
                request: `Subject: ${email.subject}\n\n${email.body}`,
                clientName: email.from,
            });
            
            const updatedEmails = emails.map(e => e.uid === email.uid ? { ...e, analysis: result } : e);
            setEmails(updatedEmails);
            setSelectedEmail(prev => prev && prev.uid === email.uid ? { ...prev, analysis: result } : prev);
            
            toast({ title: "Analysis Complete!", description: `Category: ${result.category}, Priority: ${result.priority}` });
        } catch (error) {
            toast({ title: "Analysis Failed", variant: "destructive" });
        } finally {
            setIsAnalyzing(null);
        }
    };
    
    const handleDraftReply = async (email: Email) => {
        if (!email) return;
        setIsDrafting(email.uid);
        toast({ title: "Drafting Reply...", description: "The AI is writing a response." });

        try {
            const result = await generateEmailReply({
                subject: email.subject,
                body: email.body,
                sender: email.from,
            });
            
             const updatedEmails = emails.map(e => e.uid === email.uid ? { ...e, draft: result.draft } : e);
             setEmails(updatedEmails);
             setSelectedEmail(prev => prev && prev.uid === email.uid ? { ...prev, draft: result.draft } : prev);

            toast({ title: "Draft Created!" });
        } catch (error) {
            toast({ title: "Draft Failed", variant: "destructive" });
        } finally {
            setIsDrafting(null);
        }
    };
    
    const handleCreateTask = async (email: Email) => {
        if (!email?.analysis?.task?.shouldCreate || !user) return;
        setIsCreatingTask(email.uid);
        toast({ title: 'Creating Task...', description: 'Please wait.'});

        try {
            const taskData: Omit<Task, 'id'> = {
                title: email.analysis.task.title || `Follow up on email from ${email.from}`,
                description: email.analysis.task.description || `Original email subject: ${email.subject}`,
                assignedTo: [user.id],
                status: 'To-Do',
                priority: email.analysis.priority || 'Medium',
                dueDate: Timestamp.fromDate(new Date(Date.now() + 2 * 24 * 60 * 60 * 1000)), // 2 days from now
                createdBy: 'ai_inbox',
                createdAt: Timestamp.now(),
                comments: [],
            };
            await addDoc(collection(db, 'tasks'), taskData);
            toast({ title: 'Task Created!', description: 'The task has been added to your dashboard.'});
        } catch(error) {
            toast({ title: 'Task Creation Failed', variant: 'destructive'});
        } finally {
            setIsCreatingTask(null);
        }
    };
    
    const getPriorityBadgeVariant = (priority: 'High' | 'Medium' | 'Low') => {
        switch (priority) {
            case 'High': return 'destructive';
            case 'Medium': return 'warning';
            case 'Low': return 'secondary';
        }
    };

    return (
        <div className="space-y-8">
            <h1 className="text-3xl font-bold tracking-tight">AI Email Inbox</h1>
            <div className="grid grid-cols-1 md:grid-cols-[350px_1fr] gap-6 items-start h-[calc(100vh-20rem)]">
                 <Card className="h-full flex flex-col">
                    <CardHeader className="flex flex-row items-center justify-between p-4">
                        <CardTitle className="flex items-center gap-2"><Inbox/>Inbox</CardTitle>
                         <Button variant="ghost" size="icon" onClick={handleRefresh} disabled={isLoading}>
                            <RefreshCw className={cn(isLoading && "animate-spin")} />
                        </Button>
                    </CardHeader>
                    <CardContent className="flex-1 overflow-y-auto p-0">
                        {isLoading ? (
                            <div className="flex justify-center items-center h-full">
                                <Loader2 className="animate-spin" />
                            </div>
                        ) : emails.length === 0 ? (
                            <div className="text-center text-muted-foreground p-8">
                                <p>No unread emails found.</p>
                            </div>
                        ) : (
                            <ul className="divide-y">
                                {emails.map(email => (
                                    <li key={email.uid}>
                                        <button 
                                            className={cn("w-full text-left p-4 hover:bg-muted/50", selectedEmail?.uid === email.uid && 'bg-muted')}
                                            onClick={() => setSelectedEmail(email)}
                                        >
                                            <div className="flex justify-between items-center text-xs">
                                                <p className="font-semibold truncate">{email.from}</p>
                                                <p className="text-muted-foreground">{new Date(email.date).toLocaleDateString()}</p>
                                            </div>
                                            <p className="font-medium truncate text-sm">{email.subject}</p>
                                            {email.analysis && (
                                                <div className="flex items-center gap-2 mt-1">
                                                    <Badge variant="secondary">{email.analysis.category}</Badge>
                                                    <Badge variant={getPriorityBadgeVariant(email.analysis.priority)}>{email.analysis.priority}</Badge>
                                                </div>
                                            )}
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </CardContent>
                </Card>

                <Card className="h-full flex flex-col">
                    {selectedEmail ? (
                        <>
                            <CardHeader className="p-4 border-b">
                                <p className="text-sm text-muted-foreground">{selectedEmail.from}</p>
                                <CardTitle className="text-lg">{selectedEmail.subject}</CardTitle>
                                <div className="flex items-center gap-2 pt-2">
                                    <Button size="sm" variant="outline" onClick={() => handleAnalyze(selectedEmail)} disabled={isAnalyzing === selectedEmail.uid}>
                                        {isAnalyzing === selectedEmail.uid ? <Loader2 className="mr-2 animate-spin"/> : <Bot className="mr-2"/>} Analyze
                                    </Button>
                                </div>
                            </CardHeader>
                            <CardContent className="flex-1 overflow-y-auto p-4 space-y-4">
                                <div className="text-sm whitespace-pre-wrap">{selectedEmail.body}</div>
                                {selectedEmail.analysis && (
                                    <>
                                        <Separator />
                                        <div className="space-y-4">
                                            <h4 className="font-semibold">AI Analysis</h4>
                                            <p className="text-sm border p-3 rounded-md bg-muted/50"><strong>Summary:</strong> {selectedEmail.analysis.summary}</p>
                                            
                                            {selectedEmail.analysis.task?.shouldCreate && (
                                                <div className="p-4 border rounded-md bg-green-50 border-green-200">
                                                    <div className="flex justify-between items-center">
                                                        <div>
                                                            <h5 className="font-bold text-green-800">Suggested Task</h5>
                                                            <p className="text-sm text-green-700">{selectedEmail.analysis.task.title}</p>
                                                        </div>
                                                        <Button size="sm" onClick={() => handleCreateTask(selectedEmail)} disabled={isCreatingTask === selectedEmail.uid}>
                                                            {isCreatingTask === selectedEmail.uid ? <Loader2 className="animate-spin" /> : <BookUser className="mr-2"/>} Create Task
                                                        </Button>
                                                    </div>
                                                </div>
                                            )}

                                            {selectedEmail.analysis.suggestedAction === 'draft_reply' && (
                                                 <div className="p-4 border rounded-md bg-blue-50 border-blue-200 space-y-2">
                                                    <div className="flex justify-between items-center">
                                                        <h5 className="font-bold text-blue-800">Suggested Action: Draft Reply</h5>
                                                        <Button size="sm" onClick={() => handleDraftReply(selectedEmail)} disabled={isDrafting === selectedEmail.uid}>
                                                            {isDrafting === selectedEmail.uid ? <Loader2 className="animate-spin" /> : <Edit className="mr-2"/>} Draft
                                                        </Button>
                                                    </div>
                                                     {selectedEmail.draft && (
                                                        <div className="pt-2">
                                                            <p className="text-sm bg-white p-3 border rounded-md whitespace-pre-wrap">{selectedEmail.draft}</p>
                                                        </div>
                                                     )}
                                                </div>
                                            )}
                                        </div>
                                    </>
                                )}
                            </CardContent>
                        </>
                    ) : (
                        <div className="flex justify-center items-center h-full text-muted-foreground">
                            <p>Select an email to view its content.</p>
                        </div>
                    )}
                </Card>
            </div>
        </div>
    )
}
