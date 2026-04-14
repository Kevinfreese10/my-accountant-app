'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Sparkles, Megaphone, Copy, Facebook, Share2, Info, ArrowRight, RefreshCw, Trash2 } from 'lucide-react';
import { getFirestore, collection, getDocs, query, orderBy } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { Service } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { generateSocialAds, SocialAdOutput } from '@/ai/flows/generate-social-ad';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { cn } from '@/lib/utils';

const db = getFirestore(firebaseApp);

export default function SocialMarketingPage() {
    const { toast } = useToast();
    const [services, setServices] = useState<Service[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isGenerating, setIsGenerating] = useState(false);
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [generatedAds, setGeneratedAds] = useState<SocialAdOutput | null>(null);
    const [tone, setTone] = useState<'professional' | 'friendly' | 'urgent' | 'educational'>('professional');

    useEffect(() => {
        const fetchServices = async () => {
            try {
                const q = query(collection(db, "services"), orderBy("title"));
                const snap = await getDocs(q);
                setServices(snap.docs.map(doc => ({ ...doc.data(), id: doc.id } as Service)));
            } catch (e) {
                console.error(e);
            } finally {
                setIsLoading(false);
            }
        };
        fetchServices();
    }, []);

    const handleGenerate = async () => {
        if (selectedIds.length === 0) return;
        
        setIsGenerating(true);
        const productsToAd = services
            .filter(s => selectedIds.includes(s.id))
            .map(s => ({
                productName: s.title,
                price: s.price,
                description: s.description,
                category: s.category,
                url: `${process.env.NEXT_PUBLIC_APP_URL}/products/${s.slug}`
            }));

        try {
            const result = await generateSocialAds({ products: productsToAd, tone });
            setGeneratedAds(result);
            toast({ title: "Ads Generated!", description: `Created marketing content for ${selectedIds.length} products.` });
        } catch (e) {
            toast({ title: "Generation Failed", variant: "destructive" });
        } finally {
            setIsGenerating(false);
        }
    };

    const handleCopy = (text: string) => {
        navigator.clipboard.writeText(text);
        toast({ title: "Copied to clipboard" });
    };

    const toggleSelect = (id: string) => {
        setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
    };

    if (isLoading) return <div className="flex justify-center py-20"><Loader2 className="animate-spin h-8 w-8 text-primary" /></div>;

    return (
        <div className="space-y-8">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-slate-900">AI Social Marketing</h1>
                    <p className="text-sm text-muted-foreground font-medium">Bulk generate high-converting ad copy for your services.</p>
                </div>
                <div className="flex items-center gap-3">
                    <Select value={tone} onValueChange={(v: any) => setTone(v)}>
                        <SelectTrigger className="w-[180px] bg-white h-10 font-bold border-primary/20">
                            <SelectValue placeholder="Select Tone" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="professional">Professional & Trustworthy</SelectItem>
                            <SelectItem value="friendly">Friendly & Approachable</SelectItem>
                            <SelectItem value="urgent">Urgent (Limited Time)</SelectItem>
                            <SelectItem value="educational">Educational / Info-heavy</SelectItem>
                        </SelectContent>
                    </Select>
                    <Button 
                        onClick={handleGenerate} 
                        disabled={selectedIds.length === 0 || isGenerating}
                        className="h-10 font-black px-6 gap-2 shadow-lg"
                    >
                        {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                        {isGenerating ? 'Generating...' : `Generate ${selectedIds.length > 0 ? selectedIds.length : ''} Ads`}
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                <Card className="lg:col-span-4 border-2">
                    <CardHeader className="bg-muted/30 border-b">
                        <CardTitle className="text-sm flex items-center gap-2">
                            <Megaphone className="h-4 w-4 text-primary" />
                            Select Services
                        </CardTitle>
                        <CardDescription className="text-[10px]">Pick the services you want to promote.</CardDescription>
                    </CardHeader>
                    <CardContent className="p-0">
                        <ScrollArea className="h-[500px]">
                            <div className="divide-y">
                                {services.map(service => (
                                    <div 
                                        key={service.id} 
                                        className={cn(
                                            "flex items-center gap-3 p-3 hover:bg-slate-50 transition-colors cursor-pointer",
                                            selectedIds.includes(service.id) && "bg-primary/5"
                                        )}
                                        onClick={() => toggleSelect(service.id)}
                                    >
                                        <Checkbox checked={selectedIds.includes(service.id)} onCheckedChange={() => toggleSelect(service.id)} />
                                        <div className="flex-grow min-w-0">
                                            <p className="text-xs font-bold text-slate-900 truncate">{service.title}</p>
                                            <p className="text-[9px] text-muted-foreground uppercase font-black tracking-tighter">{service.category}</p>
                                        </div>
                                        <Badge variant="outline" className="text-[9px] font-mono">R{service.price}</Badge>
                                    </div>
                                ))}
                            </div>
                        </ScrollArea>
                    </CardContent>
                    <CardFooter className="p-3 border-t bg-muted/10 justify-between items-center">
                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{selectedIds.length} selected</span>
                        <Button variant="ghost" size="sm" className="h-7 text-[10px] uppercase font-black" onClick={() => setSelectedIds([])}>Clear All</Button>
                    </CardFooter>
                </Card>

                <div className="lg:col-span-8 space-y-6">
                    {!generatedAds ? (
                        <div className="h-[600px] border-2 border-dashed rounded-2xl flex flex-col items-center justify-center text-center p-12 bg-muted/5">
                            <Sparkles className="h-16 w-16 text-primary opacity-10 mb-4" />
                            <h3 className="text-xl font-bold text-slate-900">Campaign Content Creator</h3>
                            <p className="text-sm text-muted-foreground max-w-sm mx-auto mt-2">
                                Select products from the list and choose a tone to generate optimized Facebook ad variants.
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-6 animate-in fade-in zoom-in-95 duration-500">
                            <Alert className="bg-primary/5 border-primary/20 border-2">
                                <Info className="h-4 w-4 text-primary" />
                                <AlertTitle className="text-xs font-black uppercase text-primary tracking-widest">Automation Info</AlertTitle>
                                <AlertDescription className="text-xs font-medium text-slate-700 leading-relaxed mt-1">
                                    Facebook Auto-Posting requires a Meta Business App review. For now, use the "Copy" buttons below to post directly to your Facebook Page.
                                </AlertDescription>
                            </Alert>

                            <div className="grid grid-cols-1 gap-6">
                                {generatedAds.ads.map((ad, idx) => {
                                    const service = services.find(s => s.title === ad.productId) || services.find(s => s.id === ad.productId);
                                    return (
                                        <Card key={idx} className="border-2 shadow-sm overflow-hidden">
                                            <CardHeader className="bg-muted/30 border-b py-3 flex flex-row justify-between items-center">
                                                <Badge className="bg-primary font-black text-[9px] uppercase tracking-widest">{service?.title || 'Ad Variant'}</Badge>
                                                <Button 
                                                    variant="outline" 
                                                    size="sm" 
                                                    className="h-8 gap-2 font-bold text-xs"
                                                    onClick={() => handleCopy(`${ad.hook}\n\n${ad.body}\n\n${ad.cta}\n\n${ad.hashtags}`)}
                                                >
                                                    <Copy className="h-3 w-3" /> Copy All
                                                </Button>
                                            </CardHeader>
                                            <CardContent className="p-6 space-y-4">
                                                <div className="space-y-1">
                                                    <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">The Hook</p>
                                                    <p className="text-sm font-bold text-slate-900">{ad.hook}</p>
                                                </div>
                                                <Separator />
                                                <div className="space-y-1">
                                                    <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Ad Body</p>
                                                    <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap font-medium">{ad.body}</p>
                                                </div>
                                                <Separator />
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                    <div className="space-y-1">
                                                        <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Call to Action</p>
                                                        <p className="text-xs font-bold text-primary">{ad.cta}</p>
                                                    </div>
                                                    <div className="space-y-1">
                                                        <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Hashtags</p>
                                                        <p className="text-xs text-muted-foreground font-mono">{ad.hashtags}</p>
                                                    </div>
                                                </div>
                                            </CardContent>
                                            <CardFooter className="bg-slate-50 border-t py-3 flex justify-between">
                                                <div className="flex items-center gap-2 text-xs text-muted-foreground font-bold">
                                                    <Facebook className="h-4 w-4 text-[#1877F2]" />
                                                    Facebook Optimized
                                                </div>
                                                <Button size="sm" variant="secondary" className="font-bold h-8 text-[10px] uppercase gap-2">
                                                    Post Now <Share2 className="h-3 w-3" />
                                                </Button>
                                            </CardFooter>
                                        </Card>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
