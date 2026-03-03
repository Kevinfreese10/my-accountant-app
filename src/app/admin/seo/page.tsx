
'use client';
import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { useBlog } from '@/contexts/BlogContext';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Sparkles, Loader2, Save } from 'lucide-react';
import { generateBlogPostSeo } from '@/ai/flows/generate-blog-post-seo';
import { getFirestore, collection, getDocs, query, orderBy, doc, setDoc } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { Service } from '@/lib/types';
import SeoPageForm from '@/components/admin/SeoPageForm';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const db = getFirestore(firebaseApp);

const seoSchema = z.object({
  id: z.string(),
  path: z.string(),
  title: z.string().max(60, "Title must be 60 characters or less."),
  description: z.string().max(160, "Description must be 160 characters or less."),
  keywords: z.array(z.object({ value: z.string() })).optional(),
});

const formSchema = z.object({
  pages: z.array(seoSchema),
});

type SeoFormValues = z.infer<typeof formSchema>;

export default function SeoManagementPage() {
  const { blogPosts } = useBlog();
  const { toast } = useToast();
  const [services, setServices] = useState<Service[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAiUpdating, setIsAiUpdating] = useState<string | null>(null);
  
  const form = useForm<SeoFormValues>({
    defaultValues: {
      pages: [],
    },
    mode: 'onChange',
  });

  const { control, setValue, getValues } = form;

  useEffect(() => {
    const fetchData = async () => {
        setIsLoading(true);
        try {
            // 1. Fetch Services
            const sQuery = query(collection(db, "services"), orderBy("title"));
            const sSnap = await getDocs(sQuery);
            const fetchedServices = sSnap.docs.map(doc => ({ ...doc.data(), id: doc.id } as Service));
            setServices(fetchedServices);

            // 2. Fetch Static SEO Overrides
            const staticSnap = await getDocs(collection(db, 'staticSeo'));
            const staticOverrides: Record<string, any> = {};
            staticSnap.forEach(doc => {
                staticOverrides[doc.id] = doc.data();
            });

            // 3. Define Static Pages with Defaults
            const staticPagesConfig = [
                { id: 'home', path: '/', title: 'My Accountant | Professional Accounting & Tax Services', description: 'Professional Accounting & Tax Services for South Africa. We handle SARS, CIPC, and all your compliance needs so you can focus on your business.' },
                { id: 'about', path: '/about', title: 'About Us | My Accountant', description: 'Learn about My Accountant, our vision, mission, and the expertise that drives us to provide top-tier financial services in South Africa.' },
                { id: 'products', path: '/products', title: 'Our Products | My Accountant', description: 'Comprehensive solutions to meet all your financial needs. We offer a range of services for individuals and businesses.' },
                { id: 'cv-checker', path: '/cv-checker', title: 'Free AI CV Checker | My Accountant', description: 'Get an instant ATS compatibility score and professional achievement-based rewrites for your CV in seconds.' },
                { id: 'blog', path: '/blog', title: 'Tax Tip Blog | My Accountant', description: 'Stay informed with our latest articles, tips, and updates on tax-related topics relevant to South African individuals and businesses.' },
                { id: 'compliance', path: '/compliance', title: 'Free SARS & CIPC Compliance Check', description: 'Ensure your South African business is compliant. Get a free, no-obligation compliance assessment for CIPC and SARS.' },
                { id: 'sars-compromise', path: '/sars-compromise', title: 'SARS Compromise of Debt | My Accountant', description: 'Explore your options for a SARS Compromise of Debt. We help you negotiate a settlement with SARS to resolve outstanding tax debt.' },
                { id: 'liquidations', path: '/liquidations', title: 'Company Liquidations | My Accountant', description: 'Professional assistance with voluntary company liquidations in South Africa. Close your business legally and responsibly.' },
                { id: 'contact', path: '/contact', title: 'Contact Us | My Accountant', description: 'Get in touch with the My Accountant team. Fill out our contact form with your questions or inquiries.' },
                { id: 'become-a-partner', path: '/become-a-partner', title: 'Bookkeeper Empowerment Initiative | Partner Program', description: 'Partner with My Accountant to grow your practice. Our BEI program provides the tools, mentorship, and opportunities you need.' },
                { id: 'ai-accountant', path: '/ai-accountant', title: 'AI Accountant | Smart Financial Assistant', description: 'The AI Accountant automates your entire accounting workflow — from receipts to reconciliations — saving you hours of manual work.' },
                { id: 'ai-accountant-signup', path: '/ai-accountant-signup', title: 'AI Accountant Signup | Start Automating', description: 'Create your AI Accountant profile and start automating your bookkeeping today.' },
                { id: 'partner-signup', path: '/partner-signup', title: 'Partner Signup | Join the BEI', description: 'Join our partner network and get access to R5000 in starting credits and white-label tools.' },
                { id: 'popia', path: '/popia', title: 'POPIA Compliance Policy', description: 'Read the My Accountant (Pty) Ltd policy on the Protection of Personal Information Act (POPIA).' },
                { id: 'refund-policy', path: '/refund-policy', title: 'Refund Policy | My Accountant', description: 'Understand the terms and conditions for refunds on services purchased from My Accountant.' },
                { id: 'terms', path: '/terms', title: 'BEI Terms & Conditions', description: 'Review the official Terms and Conditions for participating in the My Accountant BEI partner program.' },
                { id: 'login', path: '/login', title: 'Portal Login | My Accountant', description: 'Access your secure client or partner dashboard to manage your orders and services.' },
                { id: 'signup', path: '/signup', title: 'Create an Account | My Accountant', description: 'Sign up for a My Accountant account to manage your tax and accounting services online.' },
            ];

            const staticPages = staticPagesConfig.map(page => ({
                id: page.id,
                path: page.path,
                title: staticOverrides[page.id]?.title || page.title,
                description: staticOverrides[page.id]?.description || page.description,
                keywords: staticOverrides[page.id]?.keywords?.map((k: string) => ({ value: k })) || [],
            }));

            const servicePages = fetchedServices.map(s => ({
                id: `service-${s.id}`,
                path: `/products/${s.slug}`,
                title: s.metaTitle || `${s.title} | My Accountant`,
                description: s.metaDescription || s.description,
                keywords: s.metaKeywords?.map(k => ({ value: k })) || [],
            }));
            
            const blogPages = blogPosts.map(p => ({
                id: `blog-${p.id}`,
                path: `/blog/${p.slug}`,
                title: p.metaTitle || `${p.title} | My Accountant`,
                description: p.metaDescription || p.excerpt,
                keywords: p.metaKeywords?.map(k => ({ value: k })) || [],
            }));

            setValue('pages', [...staticPages, ...servicePages, ...blogPages]);
        } catch(error) {
            console.error("Error fetching SEO data: ", error);
            toast({ title: 'Error', description: 'Could not fetch SEO data.', variant: 'destructive'});
        } finally {
            setIsLoading(false);
        }
    };
    fetchData();
  }, [blogPosts, setValue, toast]);


  const onSubmit = async (data: SeoFormValues) => {
    setIsLoading(true);
    toast({ title: 'Saving SEO data...', description: 'Please wait.' });

    try {
        const writePromises: Promise<void>[] = [];

        data.pages.forEach(page => {
            if (page.id.startsWith('service-')) {
                const serviceId = page.id.replace('service-', '');
                const serviceRef = doc(db, 'services', serviceId);
                writePromises.push(setDoc(serviceRef, {
                    metaTitle: page.title,
                    metaDescription: page.description,
                    metaKeywords: page.keywords?.map(k => k.value) || [],
                }, { merge: true }));
            } else if (page.id.startsWith('blog-')) {
                const blogId = page.id.replace('blog-', '');
                const blogRef = doc(db, 'blogPosts', blogId);
                 writePromises.push(setDoc(blogRef, {
                    metaTitle: page.title,
                    metaDescription: page.description,
                    metaKeywords: page.keywords?.map(k => k.value) || [],
                }, { merge: true }));
            } else {
                // Static Page Save
                const staticRef = doc(db, 'staticSeo', page.id);
                writePromises.push(setDoc(staticRef, {
                    title: page.title,
                    description: page.description,
                    keywords: page.keywords?.map(k => k.value) || [],
                    path: page.path
                }));
            }
        });
        
        await Promise.all(writePromises);

        toast({
            title: 'SEO Settings Saved',
            description: 'Your changes have been saved successfully across all pages.',
        });

    } catch (e) {
        console.error("Error saving SEO data:", e);
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
        if (!acc[title]) {
          acc[title] = [];
        }
        acc[title].push({ ...page, originalIndex: index });
      }
      return acc;
    }, {} as Record<string, (typeof pages[0] & { originalIndex: number })[]>)
  ).filter(group => group.length > 1);


  const handleAiUpdate = async (groupName: string) => {
    setIsAiUpdating(groupName);
    toast({
        title: `Optimizing ${groupName}...`,
        description: 'The AI is generating new SEO content. Please wait.',
    });

    try {
        const pagesToUpdate = pageGroups[groupName as keyof typeof pageGroups];
        const allPages = getValues('pages');

        for (const page of pagesToUpdate) {
            const originalIndex = allPages.findIndex(p => p.id === page.id);
            if (originalIndex === -1) continue;

            let result;
            let originalTitle = '';

            if (groupName === 'Service Pages') {
                const originalService = services.find(s => `service-${s.id}` === page.id);
                if (originalService) originalTitle = originalService.title;
            } else if (groupName === 'Blog Posts') {
                const originalPost = blogPosts.find(p => `blog-${p.id}` === page.id);
                 if (originalPost) originalTitle = originalPost.title;
            } else {
                // For static pages, use the path or ID as context
                originalTitle = page.id.replace(/-/g, ' ');
            }

            if (originalTitle) {
                const seoResult = await generateBlogPostSeo({ title: originalTitle });
                 if (seoResult) {
                    form.setValue(`pages.${originalIndex}.title`, seoResult.metaTitle);
                    form.setValue(`pages.${originalIndex}.description`, seoResult.metaDescription);
                    form.setValue(`pages.${originalIndex}.keywords`, seoResult.metaKeywords.map(k => ({ value: k })));
                }
            }
        }
        
        toast({
            title: 'Optimization Complete!',
            description: `${groupName} have been updated with AI-generated SEO content.`,
        });
    } catch (error) {
        console.error("AI Generation Error: ", error);
        toast({
            title: 'AI Update Failed',
            description: 'There was an error generating content. Please try again.',
            variant: 'destructive',
        });
    } finally {
        setIsAiUpdating(null);
    }
  }

  if (isLoading && pages.length === 0) {
      return (
          <div className="flex justify-center items-center h-64">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
      )
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-950">SEO Management</h1>
            <p className="text-sm text-muted-foreground">Manage metadata for all {pages.length} pages on the website.</p>
        </div>
        <Button onClick={form.handleSubmit(onSubmit)} disabled={isLoading} className="gap-2">
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin"/> : <Save className="h-4 w-4" />}
            Save All Changes
        </Button>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Page SEO Details</CardTitle>
          <CardDescription>Update the meta titles and descriptions. Use the AI button to auto-optimize sections.</CardDescription>
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
                                    {isAiUpdating === groupName ? <Loader2 className="animate-spin mr-2"/> : <Sparkles className="mr-2 h-4 w-4" />}
                                    Auto-Optimize with AI
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
                                        control={control}
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
                                <AlertDescription>
                                    Search engines prefer unique titles for every page. These pages currently share identical meta titles.
                                </AlertDescription>
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
                                                control={control}
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
                            <p className="text-muted-foreground">No duplicate titles found. Your site is well-optimized!</p>
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
