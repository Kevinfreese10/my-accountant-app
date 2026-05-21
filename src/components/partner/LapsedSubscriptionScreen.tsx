'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertCircle, Wallet2, Loader2, RefreshCw, CheckCircle2, ArrowRight } from 'lucide-react';
import { User, Order } from '@/lib/types';
import { reactivatePracticeSubscription } from '@/app/actions';
import { useToast } from '@/hooks/use-toast';
import { getNextOrderId } from '@/lib/sequence';
import { doc, setDoc, Timestamp, getFirestore } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import Link from 'next/link';
import { cn } from '@/lib/utils';

const db = getFirestore(firebaseApp);

export function LapsedSubscriptionScreen({ user }: { user: User }) {
    const { toast } = useToast();
    const [isTopUpLoading, setIsTopUpLoading] = useState(false);
    const [topUpAmount, setTopUpAmount] = useState<string>('1000');

    const currentBalance = user.creditBalance || 0;

    const handleTopUpRedirect = async () => {
        const numericAmount = parseFloat(topUpAmount);
        if (isNaN(numericAmount) || numericAmount < 100) {
            toast({ title: "Invalid Amount", description: "Minimum top-up is R100.", variant: "destructive" });
            return;
        }

        setIsTopUpLoading(true);
        try {
            const orderId = await getNextOrderId();
            
            const topupOrder: Order = {
                id: orderId,
                userId: user.uid,
                customerName: user.companyName || user.name,
                customerEmail: user.email,
                items: [{
                    id: 'partner_credit_topup',
                    title: 'Practice Credit Top-up',
                    price: numericAmount,
                    quantity: 1,
                }],
                total: numericAmount,
                discountCode: null,
                discountAmount: null,
                status: 'Pending Payment',
                date: Timestamp.now(),
                source: 'Partner',
                resellerId: user.uid,
            };
            
            await setDoc(doc(db, 'orders', orderId), topupOrder);

            const payfastUrl = process.env.NEXT_PUBLIC_PAYFAST_PROCESS_URL || 'https://www.payfast.co.za/eng/process';
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
                m_payment_id: orderId,
                amount: numericAmount.toFixed(2),
                item_name: `Practice Credit Top-up`,
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
            toast({ title: "Redirect Failed", variant: "destructive" });
            setIsTopUpLoading(false);
        }
    };

    return (
        <Card className="max-w-lg w-full border-primary/20 shadow-xl">
            <CardHeader className="bg-primary/5 border-b border-primary/10 rounded-t-lg text-center">
                <Badge variant="outline" className="w-fit mx-auto mb-2 uppercase font-black text-[10px] tracking-widest text-primary border-primary/30">Low Practice Credits</Badge>
                <CardTitle className="text-primary font-black text-2xl">Wallet Top-up Required</CardTitle>
            </CardHeader>
            <CardContent className="py-8 space-y-6">
                <Alert className="bg-primary/5 border-primary/20">
                    <AlertCircle className="h-4 w-4 text-primary" />
                    <AlertTitle className="font-bold text-primary">Insufficient Credits</AlertTitle>
                    <AlertDescription className="text-xs leading-relaxed font-medium">
                        Your current balance is <strong>R{currentBalance.toFixed(2)}</strong>. You need to top up your wallet to continue outsourcing services to My Accountant.
                    </AlertDescription>
                </Alert>

                <div className="space-y-4">
                    <p className="text-sm text-muted-foreground leading-relaxed">
                        Joining and using the BEI platform is free. However, a credit balance is required to pay for the wholesale cost of any work you choose to outsource to us.
                    </p>
                    
                    <div className="space-y-4">
                        <div className="p-4 bg-muted rounded-lg border space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="topup-amount" className="text-xs font-bold uppercase text-muted-foreground">Top-up Amount (ZAR)</Label>
                                <Input 
                                    id="topup-amount"
                                    type="number"
                                    min="100"
                                    value={topUpAmount}
                                    onChange={(e) => setTopUpAmount(e.target.value)}
                                    className="h-10 font-bold"
                                />
                                <p className="text-[10px] text-muted-foreground italic">Minimum R100.</p>
                            </div>
                        </div>
                        <Button onClick={handleTopUpRedirect} disabled={isTopUpLoading} className="w-full h-12 text-lg font-bold gap-2 shadow-lg">
                            {isTopUpLoading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Wallet2 className="h-5 w-5" />}
                            Top Up Wallet Now
                        </Button>
                    </div>
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
