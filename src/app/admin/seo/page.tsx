'use client';

import { useState, useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { useBlog } from '@/contexts/BlogContext';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Sparkles, Loader2, Save, CheckCircle2, RefreshCw } from 'lucide-react';
import { generateBlogPostSeo } from '@/ai/flows/generate-blog-post-seo';
import { getFirestore, collection, getDocs, query, orderBy, doc, setDoc } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { Service, BlogPost } from '@/lib/types';
import SeoPageForm from '@/components/admin/SeoPageForm';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

const db = getFirestore(firebaseApp);

export const dynamic = 'force-dynamic';
export const revalidate = 0;

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

export default function SeoManagementPage() {
  const { blogPosts: contextBlogPosts } = useBlog();
  const { toast } = useToast();
  const [services, setServices] = useState<Service[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isAiUpdating, setIsAiUpdating] = useState<string | null>(null);
  
  const form = useForm<SeoFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      pages: [],
    },
    mode: 'onChange',
  });

  const { setValue, getValues } = form;

  const refreshAllData = useCallback(async (showToast = false) => {
    if (showToast) setIsRefreshing(true);
    else setIsLoading(true);

    try {
        const sSnap = await getDocs(query(collection(db, "services"), orderBy("title")));
        const fetchedServices = sSnap.docs.map(doc => ({ ...doc.data(), id: doc.id } as Service));
        setServices(fetchedServices);

        const bSnap = await getDocs(query(collection(db, "blogPosts"), orderBy("date", "desc")));
        const fetchedBlogPosts = bSnap.docs.map(doc => ({ ...doc.data(), id: doc.id } as BlogPost));

        const staticSnap = await getDocs(collection(db, 'staticSeo'));
        const staticOverrides: Record<string, any> = {};
        staticSnap.forEach(doc => {
            staticOverrides[doc.id] = doc.data();
        });

        const staticPagesConfig = [
            { id: 'home', path: '/', title: 'My Accountant | Professional Accounting & Tax Services', description: 'Professional Accounting & Tax Services for South Africa. We handle SARS, CIPC, and all your compliance needs so you can focus on your business.' },
            { id: 'about', path: '/about', title: 'About Us | My Accountant', description: 'Learn about My Accountant, our vision, mission, and the expertise that drives us to provide top-tier financial services in South Africa.' },
            { id: 'products', path: '/products', title: 'Our Products | My Accountant', description: 'Comprehensive solutions to meet all your financial needs. We offer a range of services for individuals and businesses.' },
            { id: 'blog', path: '/blog', title: 'Tax Tip Blog | My Accountant', description: 'Stay informed with our latest articles, tips, and updates on tax-related topics relevant to South African individuals and businesses.' },
            { id: 'compliance', path: '/compliance', title: 'Free SARS & CIPC Compliance Check', description: 'Ensure your South African business is compliant. Get a free, no-obligation compliance assessment for CIPC and SARS.' },
            { id: 'sars-compromise', path: '/sars-compromise', title: 'SARS Compromise of Debt | My Accountant', description: 'Explore your options for a SARS Compromise of Debt. We help you negotiate a settlement with SARS to resolve outstanding tax debt.' },
            { id: 'sars-disputes', path: '/sars-disputes', title: 'SARS Disputes & Objections | My Accountant', description: 'Professional assistance with SARS disputes, objections (Section 104), and appeals.' },
            { id: 'remission-of-fines', path: '/remission-of-fines', title: 'Remission of Fines & Penalties | My Accountant', description: 'Apply for a SARS Request for Remission (RFR) to remove or reduce administrative and understatement penalties.' },
            { id: 'liquidations', path: '/liquidations', title: 'Company Liquidations | My Accountant', description: 'Professional assistance with voluntary company liquidations in South Africa. Close your business legally and responsibly.' },
            { id: 'contact', path: '/contact', title: 'Contact Us | My Accountant', description: 'Get in touch with the My Accountant team. Fill out our contact form with your questions or inquiries.' },
            { id: 'BEI', path: '/BEI', title: 'Bookkeeper Empowerment Initiative | Partner Program', description: 'Empowering small and growing bookkeepers in South Africa. Joining is free. Partners get 25% off My Accountant standard service fees.' },
            { id: 'become-a-partner', path: '/become-a-partner', title: 'Become a Partner | My Accountant', description: 'Partner with My Accountant to grow your practice. Access the mentorship and technology you need.' },
            { id: 'ai-accountant', path: '/ai-accountant', title: 'AI Accountant | Smart Financial Assistant', description: 'The AI Accountant automates your entire accounting workflow — from receipts to reconciliations — saving you hours of manual work.' },
            { id: 'ai-accountant-signup', path: '/ai-accountant-signup', title: 'AI Accountant Signup | Start Automating', description: 'Create your AI Accountant profile and start automating your bookkeeping today.' },
            { id: 'partner-signup', path: '/partner-signup', title: 'Partner Signup | Join the BEI', description: 'Join our partner network and get access to starting credits and white-label tools.' },
            { id: 'franchise', path: '/franchise', title: 'Own a My Accountant Franchise', description: 'Explore exclusive territory opportunities with the My Accountant Franchise model.' },
            { id: 'franchise-signup', path: '/franchise-signup', title: 'Franchise Signup | My Accountant', description: 'Apply to own your exclusive My Accountant territory and scale with our proven systems.' },
            { id: 'popia', path: '/popia', title: 'POPIA Compliance Policy', description: 'Read the My Accountant (Pty) Ltd policy on the Protection of Personal Information Act (POPIA).' },
            { id: 'refund-policy', path: '/refund-policy', title: 'Refund Policy | My Accountant', description: 'Understand the terms and conditions for refunds on services purchased from My Accountant.' },
            { id: 'terms', path: '/terms', title: 'Terms & Conditions', description: 'Review the official Terms and Conditions for My Accountant services and partner programs.' },
            { id: 'login', path: '/login', title: 'Portal Login | My Accountant', description: 'Access your secure client or partner dashboard to manage your orders and services.' },
            { id: 'signup', path: '/signup', title: 'Create an Account | My Accountant', description: 'Sign up for a My Accountant account to manage your tax and accounting services online.' },
        ];

        const staticPages = staticPagesConfig.map(page => ({
            id: page.id,
            path: page.path,
            title: staticOverrides[page.id]?.title || page.title,
            description: staticOverrides[page.id]?.description || page.description,
            keywords: staticOverrides[page.id]?.keywords?.map((k: string) => ({ value: k })) || [],
            seoImageUrl: staticOverrides[page.id]?.seoImageUrl || '',
            seoImageLabel: staticOverrides[page.id]?.seoImageLabel || '',
            fallbackImageUrl: '', 
            fallbackImageLabel: '',
            pageContent: '', 
        }));

        const servicePages = fetchedServices.map(s => ({
            id: `service-${s.id}`,
            path: `/products/${s.slug}`,
            title: s.metaTitle || `${s.title} | My Accountant`,
            description: s.metaDescription || s.description,
            keywords: s.metaKeywords?.map(k => ({ value: k })) || [],
            seoImageUrl: s.seoImageUrl || '',
            seoImageLabel: s.seoImageLabel || '',
            fallbackImageUrl: s.imageUrl,
            fallbackImageLabel: s.imageHint,
            pageContent: s.longDescription,
        }));
        
        const blogPages = fetchedBlogPosts.map(p => ({
            id: `blog-${p.id}`,
            path: `/blog/${p.slug}`,
            title: p.metaTitle || `${p.title} | My Accountant`,
            description: p.metaDescription || p.excerpt,
            keywords: p.metaKeywords?.map(k => ({ value: k })) || [],
            seoImageUrl: p.seoImageUrl || '',
            seoImageLabel: p.seoImageLabel || '',
            fallbackImageUrl: p.imageUrl,
            fallbackImageLabel: p.imageHint,
            pageContent: p.content,
        }));

        setValue('pages', [...staticPages, ...servicePages, ...blogPages]);
        
        if (showToast) {
            toast({ title: "Data Refreshed", description: "Successfully fetched latest pages and SEO data from server." });
        }
    } catch(error) {
        console.error("Error fetching SEO data: ", error);
        toast({ title: 'Error', description: 'Could not fetch latest SEO data.', variant: 'destructive'});
    } finally {
        setIsLoading(false);
        setIsRefreshing(false);
    }
  }, [setValue, toast]);

  useEffect(() => {
    refreshAllData();
  }, [refreshAllData]);

  const onSubmit = async (data: SeoFormValues) => {
    setIsLoading(true);
    toast({ title: 'Saving SEO data...', description: 'Please wait.' });

    try {
        const writePromises: Promise<void>[] = [];
        data.pages.forEach(page => {
            const commonData = {
                metaTitle: page.title,
                metaDescription: page.description,
                metaKeywords: page.keywords?.map(k => k.value) || [],
                seoImageUrl: page.seoImageUrl || '',
                seoImageLabel: page.seoImageLabel || '',
            };

            if (page.id.startsWith('service-')) {
                const serviceId = page.id.replace('service-', '');
                writePromises.push(setDoc(doc(db, 'services', serviceId), commonData, { merge: true }));
            } else if (page.id.startsWith('blog-')) {
                const blogId = page.id.replace('blog-', '');
                writePromises.push(setDoc(doc(db, 'blogPosts', blogId), commonData, { merge: true }));
            } else {
                writePromises.push(setDoc(doc(db, 'staticSeo', page.id), {
                    ...commonData,
                    path: page.path
                }));
            }
        });
        
        await Promise.all(writePromises);
        toast({ title: 'SEO Settings Saved', description: 'Your changes are now live.' });
    } catch (e) {
        console.error(e);
        toast({ title: 'Save Failed', variant: 'destructive'});
    } finally {
        setIsLoading(false);
    }
  };

  const pages = form.watch('pages');
  const pageGroups = {
    'Static Pages': pages.filter(f => !f.path.startsWith('/products/') && !f.path.startsWith('/blog/')),
    'Service Pages': pages.filter(f => f.path.startsWith('/products/')),
    'Blog Posts': pages.filter(f => f.path.startsWith('/blog/')),
  };

  const duplicateTitleGroups = Object.values(
    pages.reduce((acc, page, index) => {
      const title = page.title.trim().toLowerCase();
      if (title) {
        if (!acc[title]) acc[title] = [];
        acc[title].push({ ...page, originalIndex: index });
      }
      return acc;
    }, {} as Record<string, (typeof pages[0] & { originalIndex: number })[]>)
  ).filter(group => group.length > 1);

  const handleAiUpdate = async (groupName: string) => {
    setIsAiUpdating(groupName);
    toast({ title: `Optimizing ${groupName}...`, description: 'Generating new SEO content.' });

    try {
        const pagesToUpdate = pageGroups[groupName as keyof typeof pageGroups];
        const allPages = getValues('pages');

        for (const page of pagesToUpdate) {
            const originalIndex = allPages.findIndex(p => p.id === page.id);
            if (originalIndex === -1) continue;

            let originalTitle = '';
            let content = '';

            if (groupName === 'Service Pages') {
                const originalService = services.find(s => `service-${s.id}` === page.id);
                if (originalService) {
                    originalTitle = originalService.title;
                    content = originalService.longDescription;
                }
            } else if (groupName === 'Blog Posts') {
                const originalPost = contextBlogPosts.find(p => `blog-${p.id}` === page.id);
                 if (originalPost) {
                    originalTitle = originalPost.title;
                    content = originalPost.content;
                 }
            } else {
                originalTitle = page.id.replace(/-/g, ' ');
            }

            if (originalTitle) {
                const seoResult = await generateBlogPostSeo({ title: originalTitle, content });
                if (seoResult) {
                    form.setValue(`pages.${originalIndex}.title`, seoResult.metaTitle);
                    form.setValue(`pages.${originalIndex}.description`, seoResult.metaDescription);
                    if (seoResult.metaKeywords) {
                        form.setValue(`pages.${originalIndex}.keywords`, seoResult.metaKeywords);
                    }
                }
            }
        }
        toast({ title: 'Optimization Complete!' });
    } catch (error) {
        toast({ title: 'AI Update Failed', variant: 'destructive' });
    } finally {
        setIsAiUpdating(null);
    }
  }

  if (isLoading && pages.length === 0) {
      return <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-950">SEO Management</h1>
            <p className="text-sm text-muted-foreground">Manage metadata for all {pages.length} live routes.</p>
        </div>
        <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => refreshAllData(true)} disabled={isRefreshing || isLoading} className="gap-2">
                {isRefreshing ? <Loader2 className="h-4 w-4 animate-spin"/> : <RefreshCw className="h-4 w-4" />}
                Fetch Latest
            </Button>
            <Button onClick={form.handleSubmit(onSubmit)} disabled={isLoading} className="gap-2 shadow-lg">
                {isLoading && !isRefreshing ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Save className="h-4 w-4" />}
                Save All Changes
            </Button>
        </div>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Page SEO Details</CardTitle>
          <CardDescription>Update the meta titles and descriptions for pages on your site.</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <Tabs defaultValue="all">
                <TabsList className="mb-4">
                    <TabsTrigger value="all">All Pages ({pages.length})</TabsTrigger>
                    <TabsTrigger value="duplicates">Duplicate Titles ({duplicateTitleGroups.length})</TabsTrigger>
                </TabsList>
                <TabsContent value="all" className="p-0">
                    <form className="space-y-8">
                    <Accordion type="multiple" defaultValue={['Static Pages']} className="w-full">
                        {Object.entries(pageGroups).map(([groupName, groupPages]) => (
                        <AccordionItem key={groupName} value={groupName}>
                            <div className="flex items-center">
                            <AccordionTrigger className="text-xl font-semibold flex-grow">{groupName} ({groupPages.length})</AccordionTrigger>
                            <Button type="button" onClick={() => handleAiUpdate(groupName)} size="sm" variant="ghost" disabled={!!isAiUpdating} className="text-primary font-bold">
                                {isAiUpdating === groupName ? <Loader2 className="animate-spin mr-2"/> : <Sparkles className="mr-2" />}
                                Auto-Optimize
                            </Button>
                            </div>
                            <AccordionContent className="space-y-6 pt-4">
                            {groupPages.map((page) => {
                                const originalIndex = pages.findIndex(p => p.id === page.id);
                                if (originalIndex === -1) return null;
                                return (
                                    <SeoPageForm
                                        key={page.id}
                                        form={form}
                                        control={form.control}
                                        index={originalIndex}
                                        page={page}
                                    />
                                )})}
                            </AccordionContent>
                        </AccordionItem>
                        ))}
                    </Accordion>
                    </form>
                </TabsContent>
                 <TabsContent value="duplicates" className="p-0">
                     {duplicateTitleGroups.length > 0 ? (
                        <div className="space-y-4 pt-4">
                            <Alert variant="destructive">
                                <AlertTitle>Duplicate Titles Found</AlertTitle>
                                <AlertDescription>Ensure each page has a unique title for optimal search indexing.</AlertDescription>
                            </Alert>
                            <Accordion type="multiple" className="w-full">
                            {duplicateTitleGroups.map((group, index) => (
                                <AccordionItem key={index} value={`duplicate-${index}`}>
                                    <AccordionTrigger className="text-lg font-semibold flex-grow">
                                        "{group[0].title}" ({group.length} pages)
                                    </AccordionTrigger>
                                    <AccordionContent className="space-y-6 pt-4">
                                        {group.map(page => (
                                            <SeoPageForm
                                                key={page.id}
                                                form={form}
                                                control={form.control}
                                                index={page.originalIndex}
                                                page={page}
                                            />
                                        ))}
                                    </AccordionContent>
                                </AccordionItem>
                            ))}
                            </Accordion>
                        </div>
                     ) : (
                        <div className="text-center py-20 bg-muted/20 rounded-lg border-2 border-dashed">
                            <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-4 opacity-20" />
                            <p className="text-muted-foreground">No duplicate titles found!</p>
                        </div>
                     )}
                </TabsContent>
            </Tabs>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
