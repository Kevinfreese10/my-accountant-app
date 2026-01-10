
'use client';
import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { useBlog } from '@/contexts/BlogContext';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Sparkles, Loader2 } from 'lucide-react';
import { generateServiceDetails } from '@/ai/flows/generate-service-details';
import { generateBlogPostSeo } from '@/ai/flows/generate-blog-post-seo';
import { getFirestore, collection, getDocs, query, orderBy, doc, setDoc } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { Service } from '@/lib/types';
import SeoPageForm from '@/components/admin/SeoPageForm';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import Link from 'next/link';

const db = getFirestore(firebaseApp);

const seoSchema = z.object({
  id: z.string(),
  path: z.string(),
  title: z.string().max(70, "Title should be 70 characters or less."),
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
    resolver: zodResolver(formSchema),
    defaultValues: {
      pages: [],
    },
    mode: 'onChange',
  });

  const { control, setValue, getValues } = form;

  useEffect(() => {
    const fetchServices = async () => {
        setIsLoading(true);
        try {
            const q = query(collection(db, "services"), orderBy("title"));
            const querySnapshot = await getDocs(q);
            const fetchedServices = querySnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Service));
            setServices(fetchedServices);
        } catch(error) {
            console.error("Error fetching services: ", error);
            toast({ title: 'Error', description: 'Could not fetch services.', variant: 'destructive'});
        } finally {
            setIsLoading(false);
        }
    };
    fetchServices();
  }, [toast]);
  
  useEffect(() => {
    const staticPages = [
        { id: 'home', path: '/', title: 'My Accountant | Professional Accounting & Tax Services', description: 'Professional Accounting & Tax Services for South Africa. We handle SARS, CIPC, and all your compliance needs so you can focus on your business.', keywords: [{value: 'accounting'}, {value: 'tax services'}] },
        { id: 'about', path: '/about', title: 'About Us | My Accountant', description: 'Learn about My Accountant, our vision, mission, and the expertise that drives us to provide top-tier financial services in South Africa.', keywords: [] },
        { id: 'products', path: '/products', title: 'Our Products | My Accountant', description: 'Comprehensive solutions to meet all your financial needs. We offer a range of services for individuals and businesses.', keywords: [] },
        { id: 'blog', path: '/blog', title: 'Tax Tip Blog', description: 'Stay informed with our latest articles, tips, and updates on tax-related topics relevant to South African individuals and businesses.', keywords: [] },
        { id: 'compliance', path: '/compliance', title: 'Free SARS & CIPC Compliance Check', description: 'Ensure your South African business is compliant. Get a free, no-obligation compliance assessment for CIPC and SARS, plus a 5% discount on your next service.', keywords: [] },
        { id: 'contact', path: '/contact', title: 'Contact Us', description: 'Get in touch with the My Accountant team. Fill out our contact form with your questions or inquiries, and we will get back to you shortly.', keywords: [] },
        { id: 'become-a-partner', path: '/become-a-partner', title: 'Bookkeeper Empowerment Initiative', description: 'Partner with My Accountant to grow your practice. Our Bookkeeper Empowerment Initiative (BEI) provides the tools, mentorship, and opportunities you need.', keywords: [] },
        { id: 'ai-accountant', path: '/ai-accountant', title: 'AI Accountant | Smart Financial Assistant', description: 'The AI Accountant automates your entire accounting workflow — from receipts to reconciliations — saving you hours of manual work every month.', keywords: [] },
        { id: 'popia', path: '/popia', title: 'POPIA Compliance Policy', description: 'Read the My Accountant (Pty) Ltd policy on the Protection of Personal Information Act (POPIA), detailing how we collect, process, and safeguard your data.', keywords: [] },
        { id: 'refund-policy', path: '/refund-policy', title: 'Refund Policy', description: 'Understand the terms and conditions for refunds on services purchased from My Accountant. Learn about our 48-hour request window and non-refundable policy once work has commenced.', keywords: [] },
        { id: 'terms', path: '/terms', title: 'BEI Terms & Conditions', description: 'Review the official Terms and Conditions for participating in the My Accountant Bookkeeper Empowerment Initiative (BEI) partner program.', keywords: [] },
    ];
    
    const servicePages = services.map(s => ({
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
  }, [services, blogPosts, setValue]);


  const onSubmit = async (data: SeoFormValues) => {
    setIsLoading(true);
    toast({ title: 'Saving SEO data...', description: 'Please wait.' });

    try {
        const batch = getFirestore(firebaseApp);
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
            }
        });
        
        await Promise.all(writePromises);

        toast({
            title: 'SEO Settings Saved',
            description: 'Your changes have been saved successfully.',
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
                 originalTitle = page.title.split('|')[0].trim();
            }

            if (originalTitle) {
                result = await generateBlogPostSeo({ title: originalTitle });
                 if (result) {
                    form.setValue(`pages.${originalIndex}.title`, result.metaTitle);
                    form.setValue(`pages.${originalIndex}.description`, result.metaDescription);
                    form.setValue(`pages.${originalIndex}.keywords`, result.metaKeywords.map(k => ({ value: k })));
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

  if (isLoading) {
      return (
          <div className="flex justify-center items-center h-64">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
      )
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">SEO Management</h1>
        <Button onClick={form.handleSubmit(onSubmit)} disabled={isLoading}>
            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : null}
            Save All Changes
        </Button>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Page SEO Details</CardTitle>
          <CardDescription>Update the meta titles and descriptions for pages on your site.</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <Tabs defaultValue="all">
                <TabsList>
                    <TabsTrigger value="all">All Pages ({pages.length})</TabsTrigger>
                    <TabsTrigger value="duplicates">Duplicate Titles ({duplicateTitleGroups.length})</TabsTrigger>
                </TabsList>
                <TabsContent value="all" className="pt-4">
                    <form className="space-y-8">
                    <Accordion type="multiple" defaultValue={['Static Pages']} className="w-full">
                        {Object.entries(pageGroups).map(([groupName, groupPages]) => (
                        <AccordionItem key={groupName} value={groupName}>
                            <div className="flex items-center">
                            <AccordionTrigger className="text-xl font-semibold flex-grow">{groupName} ({groupPages.length})</AccordionTrigger>
                           
                                <Button type="button" onClick={() => handleAiUpdate(groupName)} size="sm" variant="ghost" disabled={!!isAiUpdating}>
                                    {isAiUpdating === groupName ? <Loader2 className="animate-spin mr-2"/> : <Sparkles className="mr-2" />}
                                    Update with AI
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
                 <TabsContent value="duplicates" className="pt-4">
                     {duplicateTitleGroups.length > 0 ? (
                        <Accordion type="multiple" className="w-full">
                        {duplicateTitleGroups.map((group, index) => (
                            <AccordionItem key={index} value={`duplicate-${index}`}>
                                <AccordionTrigger className="text-lg font-semibold flex-grow">
                                    {group[0].title} ({group.length} pages)
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
                     ) : (
                        <p className="text-center text-muted-foreground py-8">No duplicate titles found. Great job!</p>
                     )}
                </TabsContent>
            </Tabs>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
