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
    const [isReactivating, setIsReactivating] = useState(false);
    const [isTopUpLoading, setIsTopUpLoading] = useState(false);
    const [topUpAmount, setTopUpAmount] = useState<string>('1000');

    const monthlyTotal = user.subscription?.monthlyTotal || 499;
    const currentBalance = user.creditBalance || 0;
    const canAffordReactivation = currentBalance >= monthlyTotal;
    const isStaff = user.role === 'partner_staff';

    const handleReactivate = async () => {
        setIsReactivating(true);
        try {
            const res = await reactivatePracticeSubscription({ partnerId: user.uid });
            if (res.success) {
                toast({ title: "Subscription Reactivated", description: "Your practice is now active. Please refresh the page." });
                window.location.reload();
            } else {
                toast({ title: "Reactivation Failed", description: res.error, variant: "destructive" });
            }
        } catch (e) {
            toast({ title: "Error", description: "An unexpected error occurred.", variant: "destructive" });
        } finally {
            setIsReactivating(false);
        }
    };

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
                    title: 'Practice Credit Top-up (Manual Reactivation)',
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

    if (isStaff) {
        return (
            <Card className="max-w-md w-full border-destructive shadow-lg">
                <CardHeader className="text-center pb-2">
                    <Badge variant="destructive" className="w-fit mx-auto mb-4 uppercase font-black text-[10px] tracking-widest">Access Restricted</Badge>
                    <CardTitle className="text-destructive flex items-center justify-center gap-2">
                        <AlertCircle className="h-6 w-6" />
                        Subscription Lapsed
                    </CardTitle>
                </CardHeader>
                <CardContent className="text-center py-6">
                    <p className="text-sm text-muted-foreground leading-relaxed">
                        Your practice's subscription has lapsed due to insufficient credits. Dashboard access is temporarily disabled.
                    </p>
                    <p className="text-sm font-bold text-slate-900 mt-4">
                        Please contact your Practice Manager to reactivate.
                    </p>
                </CardContent>
                <CardFooter>
                    <Button variant="outline" className="w-full" asChild>
                        <Link href="/">Back to Website</Link>
                    </Button>
                </CardFooter>
            </Card>
        );
    }

    return (
        <Card className="max-w-lg w-full border-destructive shadow-xl">
            <CardHeader className="bg-destructive/5 border-b border-destructive/10 rounded-t-lg text-center">
                <Badge variant="destructive" className="w-fit mx-auto mb-2 uppercase font-black text-[10px] tracking-widest">Subscription Lapsed</Badge>
                <CardTitle className="text-destructive font-black text-2xl">Practice Access Restricted</CardTitle>
            </CardHeader>
            <CardContent className="py-8 space-y-6">
                <Alert variant="destructive" className="bg-destructive/5 border-destructive/20">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle className="font-bold">Insufficient Practice Credits</AlertTitle>
                    <AlertDescription className="text-xs leading-relaxed font-medium">
                        Your practice wallet balance (<strong>R{currentBalance.toFixed(2)}</strong>) is below your monthly subscription of <strong>R{monthlyTotal.toFixed(2)}</strong>.
                    </AlertDescription>
                </Alert>

                <div className="space-y-4">
                    <p className="text-sm text-muted-foreground leading-relaxed">
                        The monthly subscription covers your hosting, support, and included staff users. Please reactivate your practice to continue using the BEI dashboard.
                    </p>
                    
                    {canAffordReactivation ? (
                        <div className="bg-green-50 border border-green-100 p-4 rounded-lg space-y-3">
                            <p className="text-xs font-bold text-green-800 flex items-center gap-2">
                                <CheckCircle2 className="h-4 w-4" /> Credits Available
                            </p>
                            <p className="text-xs text-green-700">You have enough credits in your wallet to reactivate immediately.</p>
                            <Button onClick={handleReactivate} disabled={isReactivating} className="w-full bg-green-600 hover:bg-green-700 text-white font-bold">
                                {isReactivating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                                Reactivate Practice Now
                            </Button>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="p-4 bg-muted rounded-lg border flex flex-col gap-4">
                                <div className="flex justify-between items-center">
                                    <div>
                                        <p className="text-[10px] font-bold text-muted-foreground uppercase">Current Balance</p>
                                        <p className="text-xl font-bold text-destructive">R{currentBalance.toFixed(2)}</p>
                                    </div>
                                    <ArrowRight className="h-5 w-5 text-muted-foreground" />
                                    <div className="text-right">
                                        <p className="text-[10px] font-bold text-muted-foreground uppercase">Required</p>
                                        <p className="text-xl font-bold">R{monthlyTotal.toFixed(2)}</p>
                                    </div>
                                </div>
                                <Separator />
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
                                    <p className="text-[10px] text-muted-foreground italic">Minimum R100. Price inclusive of VAT.</p>
                                </div>
                            </div>
                            <Button onClick={handleTopUpRedirect} disabled={isTopUpLoading} className="w-full h-12 text-lg font-bold gap-2">
                                {isTopUpLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Wallet2 className="h-5 w-5" />}
                                Top Up & Pay
                            </Button>
                        </div>
                    )}
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