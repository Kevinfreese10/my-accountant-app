'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Send, Bot, User, CheckCircle2, AlertCircle, Info, Banknote, MessageSquareQuote, Play, RotateCcw } from 'lucide-react';
import { getFirestore, doc, getDoc, collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { processClientAllocationChat } from '@/ai/flows/client-allocation-chat';
import { finalizeChatAllocation } from '@/app/actions';
import { cn } from '@/lib/utils';
import ReactMarkdown from 'react-markdown';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { format } from 'date-fns';

const db = getFirestore(firebaseApp);

type Message = {
    role: 'bot' | 'user';
    content: string;
    timestamp: Date;
};

const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'ZAR',
    }).format(price);
};

export default function ClientAllocationChatPage() {
    const params = useParams();
    const clientId = params.clientId as string;
    const { user: currentUser } = useAuth();
    const { toast } = useToast();
    
    const [client, setClient] = useState<any>(null);
    const [pendingTransactions, setPendingTransactions] = useState<any[]>([]);
    const [queries, setQueries] = useState<any[]>([]);
    const [messages, setMessages] = useState<Message[]>([]);
    const [inputValue, setInputValue] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isPageLoading, setIsPageLoading] = useState(true);
    const [chatStarted, setChatStarted] = useState(false);
    
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    useEffect(() => {
        if (!clientId) return;

        const fetchData = async () => {
            const clientSnap = await getDoc(doc(db, 'aiAccountantClients', clientId));
            if (clientSnap.exists()) setClient(clientSnap.data());

            // Real-time listener for pending transactions (New + AI Review)
            const q = query(collection(db, 'aiAccountantClients', clientId, 'transactions'), where('status', 'in', ['new', 'ai_review']));
            const unsubscribeTxs = onSnapshot(q, (snap) => {
                const txs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
                setPendingTransactions(txs.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()));
                setIsPageLoading(false);
            });

            // Real-time listener for accountant queries
            const qQueries = query(collection(db, 'aiAccountantClients', clientId, 'allocationQueries'), where('status', '==', 'pending'), orderBy('sentAt', 'desc'));
            const unsubscribeQueries = onSnapshot(qQueries, (snap) => {
                const fetchedQueries = snap.docs.map(d => ({ id: d.id, ...d.data() }));
                setQueries(fetchedQueries);
            });

            return () => {
                unsubscribeTxs();
                unsubscribeQueries();
            };
        };

        fetchData();
    }, [clientId]);

    const handleStartChat = async () => {
        if (pendingTransactions.length === 0) {
            toast({ title: "No items to clarify", description: "You're all caught up!" });
            return;
        }
        
        setIsLoading(true);
        setChatStarted(true);
        try {
            const res = await processClientAllocationChat({
                history: [],
                pendingTransactions: pendingTransactions.slice(0, 5), 
                chartOfAccounts: client?.chartOfAccounts || [],
                isVatRegistered: !!client?.isVatRegistered
            });
            setMessages([{ role: 'bot', content: res.answer, timestamp: new Date() }]);
        } catch (e) {
            console.error(e);
            toast({ title: "Failed to start chat", variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    };

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!inputValue.trim() || isLoading) return;

        const userMsg: Message = { role: 'user', content: inputValue, timestamp: new Date() };
        const newHistory = [...messages, userMsg];
        setMessages(newHistory);
        setInputValue('');
        setIsLoading(true);

        try {
            const res = await processClientAllocationChat({
                history: newHistory.map(m => ({ role: m.role, content: m.content })),
                pendingTransactions: pendingTransactions.slice(0, 5),
                chartOfAccounts: client?.chartOfAccounts || [],
                isVatRegistered: !!client?.isVatRegistered
            });

            if (res.allocation) {
                await finalizeChatAllocation({
                    clientId,
                    transactionId: res.allocation.transactionId,
                    accountId: res.allocation.accountId,
                    vatType: res.allocation.vatType,
                    explanation: res.allocation.reasoning
                });
                toast({ title: "Transaction Allocated", description: "The records have been updated." });
            }

            setMessages(prev => [...prev, { role: 'bot', content: res.answer, timestamp: new Date() }]);
        } catch (e) {
            toast({ title: "Something went wrong", variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    };

    if (isPageLoading) return <div className="flex justify-center py-20"><Loader2 className="animate-spin h-10 w-10 text-primary"/></div>;

    return (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start max-w-6xl mx-auto">
            <div className="lg:col-span-4 space-y-6">
                {queries.length > 0 && (
                    <Card className="border-primary bg-primary/5">
                        <CardHeader className="py-3">
                            <CardTitle className="flex items-center gap-2 text-sm text-primary">
                                <MessageSquareQuote className="h-4 w-4" />
                                Active Requests
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="divide-y divide-primary/10">
                                {queries.map(q => (
                                    <div key={q.id} className="p-4 space-y-1">
                                        <div className="flex justify-between items-center">
                                            <Badge variant="default" className="text-[9px] uppercase font-bold px-1.5 h-4">Email Invite Sent</Badge>
                                            <span className="text-[10px] text-slate-950 font-bold">
                                                {format(q.sentAt?.toDate?.() || new Date(), 'dd MMM, HH:mm')}
                                            </span>
                                        </div>
                                        <p className="text-sm font-bold text-slate-950 leading-snug">
                                            Accountant needs info for {q.unallocatedCount} transactions.
                                        </p>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                )}

                <Card className="border-2">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-slate-950">
                            <Banknote className="h-5 w-5 text-primary" />
                            Pending Clarification
                        </CardTitle>
                        <CardDescription className="text-slate-900 font-medium">
                            {pendingTransactions.length} items waiting for your input.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <Button 
                            onClick={handleStartChat} 
                            disabled={isLoading || pendingTransactions.length === 0}
                            className="w-full font-bold h-12 gap-2"
                        >
                            {chatStarted ? <RotateCcw className="h-4 w-4" /> : <Play className="h-4 w-4 fill-current" />}
                            {chatStarted ? 'Restart Chat with Khai' : 'Start Chat with Khai'}
                        </Button>
                        
                        <Separator />
                        
                        <ScrollArea className="h-[300px]">
                            <div className="divide-y">
                                {pendingTransactions.map(tx => (
                                    <div key={tx.id} className="py-3 space-y-1">
                                        <div className="flex justify-between items-start">
                                            <p className="text-[10px] font-bold text-primary uppercase tracking-widest">{format(new Date(tx.date), 'dd MMM yyyy')}</p>
                                            <p className="text-xs font-mono font-bold text-slate-950">{formatPrice(tx.amount)}</p>
                                        </div>
                                        <p className="text-sm font-bold leading-tight text-slate-950 truncate" title={tx.description}>{tx.description}</p>
                                        {tx.status === 'ai_review' && <Badge variant="secondary" className="text-[9px] py-0 font-bold">AI Workflow</Badge>}
                                    </div>
                                ))}
                                {pendingTransactions.length === 0 && (
                                    <div className="p-8 text-center text-muted-foreground">
                                        <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-green-500" />
                                        <p className="text-sm font-bold text-slate-950">All caught up!</p>
                                    </div>
                                )}
                            </div>
                        </ScrollArea>
                    </CardContent>
                </Card>
                
                <Alert className="bg-primary/5 border-primary/20">
                    <Info className="h-4 w-4" />
                    <AlertTitle className="font-bold text-slate-950">How it works</AlertTitle>
                    <AlertDescription className="text-xs leading-relaxed font-bold text-slate-900">
                        Khai (your AI assistant) will ask you about these transactions one by one. Simply tell him what they were for and he'll handle the rest.
                    </AlertDescription>
                </Alert>
            </div>

            <div className="lg:col-span-8 h-[calc(100vh-12rem)] min-h-[600px] flex flex-col">
                <Card className="flex-grow flex flex-col overflow-hidden shadow-lg border-2 border-primary/10">
                    <CardHeader className="border-b bg-primary/5 py-4">
                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-full bg-primary flex items-center justify-center text-white shadow-sm">
                                <Bot className="h-6 w-6" />
                            </div>
                            <div>
                                <CardTitle className="text-lg font-bold text-slate-950">Chat with Khai</CardTitle>
                                <CardDescription className="text-xs font-bold text-primary">Your AI Assistant (He/Him)</CardDescription>
                            </div>
                        </div>
                    </CardHeader>
                    
                    <CardContent className="flex-grow overflow-hidden relative p-0 bg-white">
                        {!chatStarted ? (
                            <div className="flex flex-col items-center justify-center h-full text-center p-8 space-y-4">
                                <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center">
                                    <Bot className="h-10 w-10 text-primary" />
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold text-slate-950">Ready to start?</h3>
                                    <p className="text-sm text-muted-foreground max-w-sm mx-auto mt-2">
                                        Click the "Start Chat" button in the sidebar to begin clarifying your unallocated transactions with Khai.
                                    </p>
                                </div>
                            </div>
                        ) : (
                            <ScrollArea className="h-full px-6 py-6" ref={scrollRef}>
                                <div className="space-y-6">
                                    {messages.map((m, i) => (
                                        <div key={i} className={cn("flex w-full", m.role === 'user' ? "justify-end" : "justify-start")}>
                                            <div className={cn(
                                                "max-w-[80%] rounded-2xl px-4 py-3 shadow-sm",
                                                m.role === 'user' 
                                                    ? "bg-primary text-primary-foreground rounded-br-none" 
                                                    : "bg-muted border rounded-bl-none text-slate-950"
                                            )}>
                                                <div className={cn("prose prose-sm", m.role === 'user' ? "prose-invert" : "text-slate-950 font-bold")}>
                                                    <ReactMarkdown
                                                        components={{
                                                            p: ({node, ...props}) => <p className="text-sm my-0 leading-relaxed font-bold text-slate-950" {...props} />,
                                                            ul: ({node, ...props}) => <ul className="list-disc pl-4 my-2 font-bold text-slate-950" {...props} />,
                                                            li: ({node, ...props}) => <li className="my-1 font-bold text-slate-950" {...props} />,
                                                        }}
                                                    >{m.content}</ReactMarkdown>
                                                </div>
                                                <p className={cn("text-[10px] mt-1 font-bold", m.role === 'user' ? "text-right opacity-70" : "text-left text-slate-950 opacity-70")}>
                                                    {format(m.timestamp, 'HH:mm')}
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                    {isLoading && (
                                        <div className="flex justify-start">
                                            <div className="bg-muted px-4 py-3 rounded-2xl rounded-bl-none border flex items-center gap-2">
                                                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                                                <span className="text-xs font-bold text-slate-950 italic">Khai is thinking...</span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </ScrollArea>
                        )}
                    </CardContent>

                    <CardFooter className="p-4 border-t bg-muted/30">
                        <form onSubmit={handleSendMessage} className="flex w-full gap-2">
                            <Input 
                                placeholder={!chatStarted ? "Start the chat to begin..." : (pendingTransactions.length > 0 ? "Type your explanation here..." : "No items remaining.")}
                                value={inputValue}
                                onChange={(e) => setInputValue(e.target.value)}
                                disabled={isLoading || !chatStarted || pendingTransactions.length === 0}
                                className="flex-grow bg-background h-12 text-slate-950 font-bold border-primary/20 focus-visible:ring-primary"
                                autoComplete="off"
                            />
                            <Button type="submit" size="icon" disabled={isLoading || !chatStarted || !inputValue.trim() || pendingTransactions.length === 0} className="h-12 w-12 rounded-full">
                                <Send className="h-5 w-5" />
                            </Button>
                        </form>
                    </CardFooter>
                </Card>
            </div>
        </div>
    );
}
