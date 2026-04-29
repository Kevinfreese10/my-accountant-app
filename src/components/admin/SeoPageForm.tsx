'use client';

import { useFieldArray, Control, UseFormReturn } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { FormField, FormItem, FormLabel, FormControl, FormMessage, FormDescription } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Trash, Sparkles, Loader2, Images, Info, Image as ImageIcon } from 'lucide-react';
import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import MediaLibrary from './MediaLibrary';
import Image from 'next/image';
import { useToast } from '@/hooks/use-toast';
import { generateBlogPostSeo } from '@/ai/flows/generate-blog-post-seo';
import { Separator } from '../ui/separator';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

// Schema without .max constraints to allow saving over-length tags
const seoSchema = z.object({
  id: z.string(),
  path: z.string(),
  title: z.string(),
  description: z.string(),
  keywords: z.array(z.object({ value: z.string() })).optional(),
  seoImageUrl: z.string().optional(),
  seoImageLabel: z.string().optional(),
  fallbackImageUrl: z.string().optional(),
  fallbackImageLabel: z.string().optional(),
  pageContent: z.string().optional(),
});

const formSchema = z.object({
  pages: z.array(seoSchema),
});

type SeoFormValues = z.infer<typeof formSchema>;
type PageSeo = z.infer<typeof seoSchema>;

interface SeoPageFormProps {
    control: Control<SeoFormValues>;
    index: number;
    page: PageSeo;
    form: UseFormReturn<SeoFormValues>;
}

export default function SeoPageForm({ control, index, page, form }: SeoPageFormProps) {
    const { toast } = useToast();
    const [isMediaLibraryOpen, setIsMediaLibraryOpen] = useState(false);
    const [isGeneratingKeywords, setIsGeneratingKeywords] = useState(false);

    const { fields: keywordFields, append: appendKeyword, remove: removeKeyword, replace: replaceKeywords } = useFieldArray({
        control,
        name: `pages.${index}.keywords`,
    });

    const titleLength = form.watch(`pages.${index}.title`)?.length || 0;
    const descLength = form.watch(`pages.${index}.description`)?.length || 0;
    const currentSeoImage = form.watch(`pages.${index}.seoImageUrl`);
    const displayImage = currentSeoImage || page.fallbackImageUrl;

    const handleGenerateKeywords = async () => {
        const title = form.getValues(`pages.${index}.title`);
        const content = page.pageContent;
        
        if (!title) {
            toast({ title: "Title Required", description: "Please enter a meta title first.", variant: "destructive" });
            return;
        }

        setIsGeneratingKeywords(true);
        toast({ title: "Analyzing Content", description: "Generating relevant keywords with AI..." });

        try {
            const result = await generateBlogPostSeo({ title, content });
            if (result.metaKeywords) {
                replaceKeywords(result.metaKeywords);
                toast({ title: "Keywords Generated", description: "Meta keywords updated based on page content." });
            }
        } catch (e) {
            console.error(e);
            toast({ title: "AI Generation Failed", variant: "destructive" });
        } finally {
            setIsGeneratingKeywords(false);
        }
    };

    return (
        <div className="p-6 border rounded-xl bg-card shadow-sm space-y-6">
            <Dialog open={isMediaLibraryOpen} onOpenChange={setIsMediaLibraryOpen}>
                <DialogContent className="max-w-4xl">
                    <DialogHeader>
                        <DialogTitle>Select SEO Social Image</DialogTitle>
                        <DialogDescription>This image will be used when the page is shared on social media.</DialogDescription>
                    </DialogHeader>
                    <MediaLibrary onSelectImage={(url) => {
                        form.setValue(`pages.${index}.seoImageUrl`, url, { shouldDirty: true });
                        setIsMediaLibraryOpen(false);
                    }} />
                </DialogContent>
            </Dialog>

            <div className="flex items-center justify-between">
                <div className="space-y-1">
                    <h3 className="font-bold text-lg text-primary">{page.path}</h3>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-black">Page Identifier: {page.id}</p>
                </div>
                <Badge variant="outline" className="h-6 text-[10px] uppercase font-bold text-muted-foreground border-muted-foreground/30">Active Route</Badge>
            </div>

            <Separator />

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                <div className="lg:col-span-8 space-y-6">
                    <FormField
                        control={control}
                        name={`pages.${index}.title`}
                        render={({ field }) => (
                        <FormItem>
                            <div className="flex justify-between items-end mb-1">
                                <FormLabel className="text-xs font-bold uppercase text-muted-foreground">Meta Title</FormLabel>
                                <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded", titleLength > 60 ? 'bg-orange-100 text-orange-800' : 'bg-green-100 text-green-800')}>
                                    {titleLength}/60 chars
                                </span>
                            </div>
                            <FormControl>
                                <Input {...field} className="font-medium" placeholder="Catchy SEO Title | My Accountant" />
                            </FormControl>
                            <FormDescription className="text-[10px]">The title shown in search results. Over 60 chars may be truncated.</FormDescription>
                            <FormMessage />
                        </FormItem>
                        )}
                    />

                    <FormField
                        control={control}
                        name={`pages.${index}.description`}
                        render={({ field }) => (
                        <FormItem>
                            <div className="flex justify-between items-end mb-1">
                                <FormLabel className="text-xs font-bold uppercase text-muted-foreground">Meta Description</FormLabel>
                                <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded", descLength > 160 ? 'bg-orange-100 text-orange-800' : 'bg-green-100 text-green-800')}>
                                    {descLength}/160 chars
                                </span>
                            </div>
                            <FormControl>
                                <Textarea {...field} rows={3} className="resize-none" placeholder="Provide a brief summary for search snippets..." />
                            </FormControl>
                            <FormDescription className="text-[10px]">Summarize the page for users. Over 160 chars will be cut off by Google.</FormDescription>
                            <FormMessage />
                        </FormItem>
                        )}
                    />

                    <div className="space-y-4 pt-4 border-t border-dashed">
                        <div className="flex items-center justify-between">
                            <FormLabel className="text-xs font-bold uppercase text-muted-foreground">Meta Keywords</FormLabel>
                            <Button 
                                type="button" 
                                variant="ghost" 
                                size="sm" 
                                onClick={handleGenerateKeywords} 
                                disabled={isGeneratingKeywords}
                                className="text-primary font-bold h-7 text-[10px] gap-1"
                            >
                                {isGeneratingKeywords ? <Loader2 className="h-3 w-3 animate-spin"/> : <Sparkles className="h-3 w-3" />}
                                Generate with AI
                            </Button>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {keywordFields.map((kwField, kwIndex) => (
                                <div key={kwField.id} className="flex items-center gap-1 bg-muted p-1 rounded-md border shadow-sm group">
                                    <FormField
                                        control={control}
                                        name={`pages.${index}.keywords.${kwIndex}.value`}
                                        render={({ field }) => (
                                            <Input {...field} className="h-6 text-[10px] border-none bg-transparent w-24 focus-visible:ring-0 p-0 px-1 font-semibold uppercase" />
                                        )}
                                    />
                                    <Button type="button" variant="ghost" size="icon" className="h-5 w-5 opacity-0 group-hover:opacity-100 text-destructive" onClick={() => removeKeyword(kwIndex)}><Trash className="h-3 w-3"/></Button>
                                </div>
                            ))}
                            <Button type="button" variant="outline" size="sm" className="h-8 text-[10px] uppercase font-bold border-dashed" onClick={() => appendKeyword({ value: '' })}>+ Add Keyword</Button>
                        </div>
                    </div>
                </div>

                <div className="lg:col-span-4 space-y-4">
                    <FormLabel className="text-xs font-bold uppercase text-muted-foreground">Social Sharing Image</FormLabel>
                    <div className="relative aspect-video w-full rounded-lg border-2 border-dashed bg-muted/20 overflow-hidden group">
                        {displayImage ? (
                            <Image src={displayImage} alt="SEO Preview" fill className="object-cover" />
                        ) : (
                            <div className="flex flex-col items-center justify-center h-full text-muted-foreground/40">
                                <ImageIcon className="h-8 w-8 mb-2" />
                                <span className="text-[10px] uppercase font-bold">No Image</span>
                            </div>
                        )}
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <Button type="button" variant="secondary" size="sm" onClick={() => setIsMediaLibraryOpen(true)} className="gap-2 font-bold shadow-lg">
                                <Images className="h-4 w-4" /> Change Image
                            </Button>
                        </div>
                        {currentSeoImage && (
                            <Badge className="absolute top-2 left-2 bg-primary text-[9px]">Custom SEO Image</Badge>
                        )}
                        {!currentSeoImage && displayImage && (
                            <Badge className="absolute top-2 left-2 bg-slate-500 text-[9px]">Main Image Fallback</Badge>
                        )}
                    </div>
                    
                    <FormField
                        control={control}
                        name={`pages.${index}.seoImageLabel`}
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Image Alt Text (Label)</FormLabel>
                                <FormControl>
                                    <Input {...field} placeholder={page.fallbackImageLabel || "Describe the image for SEO..."} className="h-8 text-xs" />
                                </FormControl>
                                <FormDescription className="text-[9px] italic">Used as the image alt attribute for indexing.</FormDescription>
                            </FormItem>
                        )}
                    />

                    {!currentSeoImage && (
                        <div className="p-3 rounded-lg bg-primary/5 border border-primary/10 flex items-start gap-2">
                            <Info className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                            <p className="text-[10px] text-muted-foreground leading-relaxed">
                                Currently using the <strong>Main Product/Blog Image</strong>. Upload a specific image above to override it for social media sharing.
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
