'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CreditCard, Loader2, Wallet2, CheckCircle2, ArrowRight } from 'lucide-react';
import { User, Order } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { getFirestore, collection, query, where, getDocs } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { Badge } from "@/components/ui/badge";
import Link from 'next/link';

const db = getFirestore(firebaseApp);

export function PendingSetupScreen({ user }: { user: User }) {
    const { toast } = useToast();
    const [isProcessing, setIsProcessing] = useState(false);

    const handleCompleteSetup = async () => {
        setIsProcessing(true);
        toast({ title: "Retrieving setup order...", description: "Connecting to PayFast." });

        try {
            // Find the pending setup order for this user
            const ordersRef = collection(db, "orders");
            const q = query(
                ordersRef, 
                where("userId", "==", user.uid), 
                where("status", "==", "Pending Payment")
            );
            const snap = await getDocs(q);
            
            let setupOrder: Order | null = null;
            
            // Look for the specific setup fee item
            snap.docs.forEach(doc => {
                const data = doc.data() as Order;
                if (data.items.some(i => i.id === 'partner_setup_fee')) {
                    setupOrder = { ...data, id: doc.id };
                }
            });

            if (!setupOrder) {
                toast({ 
                    title: "Setup Order Not Found", 
                    description: "Please contact support to manually activate your account.",
                    variant: "destructive" 
                });
                setIsProcessing(false);
                return;
            }

            // Redirect to PayFast
            const payfastUrl = 'https://www.payfast.co.za/eng/process';
            const form = document.createElement('form');
            form.method = 'POST';
            form.action = payfastUrl;

            const data: { [key: string]: string } = {
                merchant_id: process.env.NEXT_PUBLIC_PAYFAST_MERCHANT_ID || '23836312',
                merchant_key: process.env.NEXT_PUBLIC_PAYFAST_MERCHANT_KEY || 'h4fkhz6ouoksx',
                return_url: `${process.env.NEXT_PUBLIC_APP_URL}/partner/dashboard`,
                cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/partner/dashboard`,
                notify_url: `${process.env.NEXT_PUBLIC_APP_URL}/api/payfast/notify`,
                name_first: user.name.split(' ')[0],
                name_last: user.name.split(' ').slice(1).join(' '),
                email_address: user.email,
                m_payment_id: setupOrder.id,
                amount: setupOrder.total.toFixed(2),
                item_name: `BEI Practice Setup & R2,475 Credits`,
            };

            for (const key in data) {
                const input = document.createElement('input');
                input.type = 'hidden';
                input.name = key;
                input.value = data[key];
                form.appendChild(input);
            }
            
            document.body.appendChild(form);
            form.submit();

        } catch (e) {
            console.error("Setup retrieval failed:", e);
            toast({ title: "Error", description: "Could not retrieve your setup order.", variant: "destructive" });
            setIsProcessing(false);
        }
    };

    return (
        <Card className="max-w-lg w-full border-primary/20 shadow-xl overflow-hidden">
            <CardHeader className="bg-primary/5 border-b border-primary/10 text-center py-8">
                <Badge className="w-fit mx-auto mb-4 bg-primary text-white uppercase font-black text-[10px] tracking-widest">Action Required</Badge>
                <CardTitle className="text-3xl font-black text-slate-900">Activate Your Practice</CardTitle>
                <CardDescription className="text-base mt-2">
                    Complete your setup payment to unlock the BEI dashboard.
                </CardDescription>
            </CardHeader>
            
            <CardContent className="py-8 space-y-6">
                <div className="bg-primary/5 p-6 rounded-xl border border-primary/10 space-y-4">
                    <h3 className="font-bold flex items-center gap-2 text-slate-900">
                        <Wallet2 className="h-5 w-5 text-primary" />
                        R4,950 Setup & Onboarding
                    </h3>
                    <div className="space-y-2 text-sm text-muted-foreground leading-relaxed">
                        <p>To begin using the Bookkeeper Empowerment Initiative, a <strong>R4,950</strong> activation fee is required. This includes:</p>
                        <ul className="space-y-2 mt-4">
                            <li className="flex items-start gap-2">
                                <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                                <span><strong>R2,475 (50%)</strong> is immediately added to your wallet as credits.</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                                <span>Platform setup and white-label branding configuration.</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                                <span>onboarding and professional platform training.</span>
                            </li>
                        </ul>
                    </div>
                </div>

                <div className="space-y-4">
                    <Button 
                        onClick={handleCompleteSetup} 
                        disabled={isProcessing} 
                        className="w-full h-14 text-lg font-bold shadow-lg"
                    >
                        {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CreditCard className="mr-2 h-5 w-5" />}
                        Complete Setup & Pay R4,950
                    </Button>
                    <p className="text-center text-[10px] text-muted-foreground uppercase font-bold tracking-widest">
                        Secure Payment via PayFast
                    </p>
                </div>
            </CardContent>

            <CardFooter className="bg-muted/30 border-t justify-center py-4">
                <Button variant="link" className="text-xs text-muted-foreground" asChild>
                    <Link href="/">Back to Website</Link>
                </Button>
            </CardFooter>
        </Card>
    );
}
