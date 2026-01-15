

'use client';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { BlogPost, Service } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Trash, Sparkles, Loader2, Images, Check, ChevronsUpDown } from 'lucide-react';
import { generateBlogPostSeo } from '@/ai/flows/generate-blog-post-seo';
import { generateBlogPost } from '@/ai/flows/generate-blog-post';
import { useToast } from '@/hooks/use-toast';
import { useState, useEffect } from 'react';
import { Separator } from '../ui/separator';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/dialog';
import MediaLibrary from './MediaLibrary';
import Image from 'next/image';
import { getFirestore, collection, getDocs, query, orderBy } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '../ui/command';
import { cn } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';

const db = getFirestore(firebaseApp);

const formSchema = z.object({
  id: z.string().optional(),
  title: z.string().min(10, 'Title must be at least 10 characters.'),
  primaryKeyword: z.string().min(3, 'Primary keyword is required.'),
  searchIntent: z.enum(['Informational', 'Commercial', 'Transactional']),
  excerpt: z.string().min(20, 'Excerpt must be at least 20 characters.'),
  content: z.string().min(50, 'Content must be at least 50 characters.'),
  author: z.string().min(2, "Author's name is required."),
  imageUrl: z.string().url('Must be a valid URL.'),
  imageHint: z.string().min(1, 'Image hint is required.'),
  metaTitle: z.string().optional(),
  metaDescription: z.string().optional(),
  metaKeywords: z.array(z.object({ value: z.string() })).optional(),
  relatedProducts: z.array(z.string()).max(3, "You can select up to 3 products.").optional(),
});

type BlogFormProps = {
  post: BlogPost | null;
  onSubmit: (data: any) => void;
};

export default function BlogForm({ post, onSubmit }: BlogFormProps) {
  const { toast } = useToast();
  const [isAiContentUpdating, setIsAiContentUpdating] = useState(false);
  const [isAiSeoUpdating, setIsAiSeoUpdating] = useState(false);
  const [isMediaLibraryOpen, setIsMediaLibraryOpen] = useState(false);
  const [allServices, setAllServices] = useState<Service[]>([]);

  useEffect(() => {
    const fetchServices = async () => {
        try {
            const q = query(collection(db, "services"), orderBy("title"));
            const querySnapshot = await getDocs(q);
            const fetchedServices = querySnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Service));
            setAllServices(fetchedServices);
        } catch (error) {
            toast({ title: "Error", description: "Could not fetch services.", variant: "destructive"});
        }
    };
    fetchServices();
  }, [toast]);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      id: post?.id || '',
      title: post?.title || '',
      primaryKeyword: post?.title || '', // Default keyword to title for existing posts
      searchIntent: 'Informational', // Default intent
      excerpt: post?.excerpt || '',
      content: post?.content || '',
      author: post?.author || 'Kevin Freese',
      imageUrl: post?.imageUrl || 'https://picsum.photos/seed/new-post/800/400',
      imageHint: post?.imageHint || 'business office',
      metaTitle: post?.metaTitle || '',
      metaDescription: post?.metaDescription || '',
      metaKeywords: post?.metaKeywords?.map(v => ({value: v})) || [{ value: '' }],
      relatedProducts: post?.relatedProducts || [],
    },
  });

  const { fields: keywordFields, append: appendKeyword, remove: removeKeyword } = useFieldArray({
    control: form.control,
    name: 'metaKeywords',
  });

  const handleAiContentUpdate = async () => {
    const primaryKeyword = form.getValues('primaryKeyword');
    const searchIntent = form.getValues('searchIntent');
    if (!primaryKeyword) {
        toast({
            title: 'Keyword is missing',
            description: 'Please enter a primary keyword before using AI.',
            variant: 'destructive',
        });
        return;
    }
    
    setIsAiContentUpdating(true);
    toast({
        title: 'Generating Blog Content...',
        description: 'The AI is writing your blog post. Please wait.',
    });

    try {
        const result = await generateBlogPost({ primaryKeyword, searchIntent });
        form.setValue('excerpt', result.excerpt);
        form.setValue('content', result.content);
        toast({
            title: 'Blog Content Generated',
            description: 'The excerpt and main content fields have been populated by AI.',
        });
    } catch (error) {
        console.error("AI Content Generation Error: ", error);
        toast({
            title: 'AI Update Failed',
            description: 'There was an error generating content. Please try again.',
            variant: 'destructive',
        });
    } finally {
        setIsAiContentUpdating(false);
    }
  };

  const handleAiSeoUpdate = async () => {
    const title = form.getValues('title');
    if (!title) {
        toast({
            title: 'Title is missing',
            description: 'Please enter a post title before using AI.',
            variant: 'destructive',
        });
        return;
    }
    
    setIsAiSeoUpdating(true);
    toast({
        title: 'Generating SEO Content...',
        description: 'The AI is creating SEO data for your post. Please wait.',
    });

    try {
        const result = await generateBlogPostSeo({ title });
        form.setValue('metaTitle', result.metaTitle);
        form.setValue('metaDescription', result.metaDescription);
        form.setValue('metaKeywords', result.metaKeywords.map(k => ({ value: k })));
        toast({
            title: 'SEO Content Updated',
            description: 'The SEO fields have been populated by AI.',
        });
    } catch (error) {
        console.error("AI SEO Generation Error: ", error);
        toast({
            title: 'AI Update Failed',
            description: 'There was an error generating SEO content. Please try again.',
            variant: 'destructive',
        });
    } finally {
        setIsAiSeoUpdating(false);
    }
  };


  const handleSubmit = (values: z.infer<typeof formSchema>) => {
    const postData = {
        ...values,
        metaKeywords: values.metaKeywords?.map(v => v.value),
    }
    onSubmit(postData);
  };
  
  const currentImageUrl = form.watch('imageUrl');

  return (
    <Form {...form}>
      <Dialog open={isMediaLibraryOpen} onOpenChange={setIsMediaLibraryOpen}>
            <DialogContent className="max-w-4xl">
                <DialogHeader>
                    <DialogTitle>Media Library</DialogTitle>
                    <DialogDescription>Select an image for this blog post.</DialogDescription>
                </DialogHeader>
                <MediaLibrary onSelectImage={(url) => {
                    form.setValue('imageUrl', url);
                    setIsMediaLibraryOpen(false);
                }} />
            </DialogContent>
        </Dialog>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6 max-h-[70vh] overflow-y-auto p-1 pr-4">
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Post Title</FormLabel>
              <FormControl><Input {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <Separator/>

        <div className="space-y-4 rounded-lg border p-4">
            <h3 className="text-lg font-medium">AI Content Generation</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
                <FormField
                    control={form.control}
                    name="primaryKeyword"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Primary Keyword</FormLabel>
                        <FormControl><Input {...field} placeholder="e.g., VAT registration South Africa" /></FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                />
                 <FormField
                    control={form.control}
                    name="searchIntent"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Search Intent</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                            <SelectContent>
                                <SelectItem value="Informational">Informational</SelectItem>
                                <SelectItem value="Commercial">Commercial</SelectItem>
                                <SelectItem value="Transactional">Transactional</SelectItem>
                            </SelectContent>
                        </Select>
                        <FormMessage />
                        </FormItem>
                    )}
                />
            </div>
            <Button type="button" size="sm" onClick={handleAiContentUpdate} disabled={isAiContentUpdating}>
                {isAiContentUpdating ? <Loader2 className="animate-spin mr-2" /> : <Sparkles className="mr-2" />}
                Generate Content with AI
            </Button>
        </div>


        <FormField
        control={form.control}
        name="excerpt"
        render={({ field }) => (
            <FormItem>
            <FormLabel>Excerpt</FormLabel>
            <FormControl><Textarea {...field} rows={3} placeholder="A short summary of the post..." /></FormControl>
            <FormMessage />
            </FormItem>
        )}
        />
        <FormField
        control={form.control}
        name="content"
        render={({ field }) => (
            <FormItem>
            <FormLabel>Main Content (HTML)</FormLabel>
            <FormControl><Textarea {...field} rows={10} placeholder="The main content of the blog post. HTML is supported." /></FormControl>
            <FormMessage />
            </FormItem>
        )}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField control={form.control} name="author" render={({ field }) => ( <FormItem><FormLabel>Author</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
            <FormField
                control={form.control}
                name="imageUrl"
                render={({ field }) => (
                    <FormItem>
                        <FormLabel>Image URL</FormLabel>
                         <div className="flex items-center gap-4">
                             <div className="relative h-24 w-24 flex-shrink-0 border rounded-md overflow-hidden">
                                {currentImageUrl && <Image src={currentImageUrl} alt="Current blog post image" fill className="object-cover"/>}
                            </div>
                            <div className="flex-grow space-y-2">
                                <FormControl><Input {...field} placeholder="https://example.com/image.jpg" /></FormControl>
                                <Button type="button" variant="outline" size="sm" onClick={() => setIsMediaLibraryOpen(true)}>
                                    <Images className="mr-2 h-4 w-4"/>
                                    Select from Media Library
                                </Button>
                            </div>
                        </div>
                        <FormMessage />
                    </FormItem>
                )}
            />
        </div>
        <FormField control={form.control} name="imageHint" render={({ field }) => ( <FormItem><FormLabel>Image AI Hint</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />

        <Separator />

        <div className="space-y-4 rounded-lg border p-4">
             <h3 className="text-lg font-medium">Related Products</h3>
             <FormField
                control={form.control}
                name="relatedProducts"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Select up to 3 relevant products</FormLabel>
                    <Popover>
                        <PopoverTrigger asChild>
                        <FormControl>
                            <Button
                            variant="outline"
                            role="combobox"
                            className={cn("w-full justify-between", !field.value?.length && "text-muted-foreground")}
                            >
                            {field.value?.length ? `${field.value.length} selected` : "Select products..."}
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                        </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                        <Command>
                            <CommandInput placeholder="Search products..." />
                            <CommandList>
                            <CommandEmpty>No products found.</CommandEmpty>
                            <CommandGroup>
                                {allServices.map((service) => (
                                <CommandItem
                                    key={service.id}
                                    value={service.title}
                                    onSelect={() => {
                                        const selection = new Set(field.value);
                                        if (selection.has(service.id)) {
                                            selection.delete(service.id);
                                        } else if (selection.size < 3) {
                                            selection.add(service.id);
                                        } else {
                                            toast({ title: "Limit Reached", description: "You can only select up to 3 products.", variant: "destructive" });
                                        }
                                        field.onChange(Array.from(selection));
                                    }}
                                >
                                    <div className={cn("mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary",
                                        field.value?.includes(service.id) ? "bg-primary text-primary-foreground" : "opacity-50 [&_svg]:invisible"
                                    )}>
                                        <Check className={cn("h-4 w-4")} />
                                    </div>
                                    <span>{service.title}</span>
                                </CommandItem>
                                ))}
                            </CommandGroup>
                            </CommandList>
                        </Command>
                        </PopoverContent>
                    </Popover>
                    <FormMessage />
                    </FormItem>
                )}
                />
        </div>

        <Separator />

        <div className="space-y-4 rounded-lg border p-4">
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium">SEO Information</h3>
                 <Button type="button" onClick={handleAiSeoUpdate} disabled={isAiSeoUpdating}>
                    {isAiSeoUpdating ? <Loader2 className="animate-spin mr-2" /> : <Sparkles className="mr-2" />}
                    Update SEO with AI
                </Button>
            </div>
            <FormField
                control={form.control}
                name="metaTitle"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Meta Title</FormLabel>
                    <FormControl><Input {...field} /></FormControl>
                    <FormMessage />
                    </FormItem>
                )}
            />
            <FormField
                control={form.control}
                name="metaDescription"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Meta Description</FormLabel>
                    <FormControl><Textarea {...field} rows={2} /></FormControl>
                    <FormMessage />
                    </FormItem>
                )}
            />
            <div>
                <FormLabel>Meta Keywords</FormLabel>
                {keywordFields.map((field, index) => (
                    <FormField
                        key={field.id}
                        control={form.control}
                        name={`metaKeywords.${index}.value`}
                        render={({ field }) => (
                            <FormItem className="flex items-center gap-2 mt-2">
                                <FormControl><Input {...field} /></FormControl>
                                <Button type="button" variant="destructive" size="icon" onClick={() => removeKeyword(index)}><Trash className="h-4 w-4"/></Button>
                            </FormItem>
                        )}
                    />
                ))}
                <Button type="button" variant="outline" size="sm" className="mt-2" onClick={() => appendKeyword({ value: '' })}>Add Keyword</Button>
            </div>
        </div>

        <Button type="submit" className="w-full">Save Post</Button>
      </form>
    </Form>
  );
}
