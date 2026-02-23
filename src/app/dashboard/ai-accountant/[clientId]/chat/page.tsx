'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Send, Bot, User, CheckCircle2, AlertCircle, Info, Banknote, MessageSquareQuote } from 'lucide-react';
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

            // Real-time listener for pending transactions
            const q = query(collection(db, 'aiAccountantClients', clientId, 'transactions'), where('status', 'in', ['new', 'ai_review']));
            const unsubscribeTxs = onSnapshot(q, (snap) => {
                const txs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
                setPendingTransactions(txs);
                setIsPageLoading(false);
            });

            // Real-time listener for accountant queries (pending invites)
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

    useEffect(() => {
        if (!isPageLoading && messages.length === 0 && pendingTransactions.length > 0) {
            handleStartChat();
        }
    }, [isPageLoading, pendingTransactions.length]);

    const handleStartChat = async () => {
        setIsLoading(true);
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
                                            <span className="text-[10px] text-muted-foreground font-bold">
                                                {format(q.sentAt?.toDate?.() || new Date(), 'dd MMM, HH:mm')}
                                            </span>
                                        </div>
                                        <p className="text-sm font-bold text-slate-900 leading-snug">
                                            Accountant needs info for {q.unallocatedCount} transactions.
                                        </p>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                )}

                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Banknote className="h-5 w-5 text-primary" />
                            Pending Clarification
                        </CardTitle>
                        <CardDescription>
                            The following {pendingTransactions.length} items need your attention.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="p-0">
                        <ScrollArea className="h-[400px]">
                            <div className="divide-y">
                                {pendingTransactions.map(tx => (
                                    <div key={tx.id} className="p-4 space-y-1 hover:bg-muted/30 transition-colors border-l-2 border-transparent hover:border-primary">
                                        <div className="flex justify-between items-start">
                                            <p className="text-xs font-bold text-slate-900 uppercase tracking-widest">{format(new Date(tx.date), 'dd MMM yyyy')}</p>
                                            <p className="text-sm font-mono font-bold text-slate-950">{formatPrice(tx.amount)}</p>
                                        </div>
                                        <p className="text-sm font-semibold leading-tight text-slate-900">{tx.description}</p>
                                        {tx.status === 'ai_review' && <Badge variant="secondary" className="text-[10px] py-0 font-bold">Reviewing Group</Badge>}
                                    </div>
                                ))}
                                {pendingTransactions.length === 0 && (
                                    <div className="p-8 text-center text-muted-foreground">
                                        <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-green-500" />
                                        <p className="text-sm font-bold text-slate-900">All caught up!</p>
                                        <p className="text-xs">No transactions need clarification.</p>
                                    </div>
                                )}
                            </div>
                        </ScrollArea>
                    </CardContent>
                </Card>
                
                <Alert className="bg-primary/5 border-primary/20">
                    <Info className="h-4 w-4" />
                    <AlertTitle className="font-bold">How it works</AlertTitle>
                    <AlertDescription className="text-xs leading-relaxed font-medium">
                        Khai (your AI assistant) will ask you about these transactions one by one. Simply tell her what they were for (e.g., "Lunch with client" or "Office rental") and she'll handle the accounting mapping for you.
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
                                <CardTitle className="text-lg font-bold">Chat with Khai</CardTitle>
                                <CardDescription className="text-xs font-semibold text-primary">Secure Transaction Assistant</CardDescription>
                            </div>
                        </div>
                    </CardHeader>
                    
                    <CardContent className="flex-grow overflow-hidden relative p-0 bg-white">
                        <ScrollArea className="h-full px-6 py-6" ref={scrollRef}>
                            <div className="space-y-6">
                                {messages.map((m, i) => (
                                    <div key={i} className={cn("flex w-full", m.role === 'user' ? "justify-end" : "justify-start")}>
                                        <div className={cn(
                                            "max-w-[80%] rounded-2xl px-4 py-3 shadow-sm",
                                            m.role === 'user' 
                                                ? "bg-primary text-primary-foreground rounded-br-none" 
                                                : "bg-muted border rounded-bl-none text-foreground"
                                        )}>
                                            <div className={cn("prose prose-sm", m.role === 'user' ? "prose-invert" : "text-slate-950 font-semibold")}>
                                                <ReactMarkdown>{m.content}</ReactMarkdown>
                                            </div>
                                            <p className={cn("text-[10px] mt-1 font-bold", m.role === 'user' ? "text-right opacity-70" : "text-left text-slate-900 opacity-50")}>
                                                {format(m.timestamp, 'HH:mm')}
                                            </p>
                                        </div>
                                    </div>
                                ))}
                                {isLoading && (
                                    <div className="flex justify-start">
                                        <div className="bg-muted px-4 py-3 rounded-2xl rounded-bl-none border flex items-center gap-2">
                                            <Loader2 className="h-4 w-4 animate-spin text-primary" />
                                            <span className="text-xs font-bold text-slate-900 italic">Khai is thinking...</span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </ScrollArea>
                    </CardContent>

                    <CardFooter className="p-4 border-t bg-muted/30">
                        <form onSubmit={handleSendMessage} className="flex w-full gap-2">
                            <Input 
                                placeholder={pendingTransactions.length > 0 ? "Type your explanation here..." : "No items remaining."}
                                value={inputValue}
                                onChange={(e) => setInputValue(e.target.value)}
                                disabled={isLoading || pendingTransactions.length === 0}
                                className="flex-grow bg-background h-12 text-slate-950 font-bold border-primary/20 focus-visible:ring-primary"
                                autoComplete="off"
                            />
                            <Button type="submit" size="icon" disabled={isLoading || !inputValue.trim() || pendingTransactions.length === 0} className="h-12 w-12 rounded-full">
                                <Send className="h-5 w-5" />
                            </Button>
                        </form>
                    </CardFooter>
                </Card>
            </div>
        </div>
    );
}