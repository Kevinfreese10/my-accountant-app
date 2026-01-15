
'use client';
import { useState } from 'react';
import { BlogPost, Service } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { MoreHorizontal, PlusCircle, Loader2, FileText, CheckCircle, XCircle } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import BlogForm from '@/components/admin/BlogForm';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import Image from 'next/image';
import Link from 'next/link';
import { useBlog } from '@/contexts/BlogContext';
import { analyzeBlogPostSeo, AnalyzeBlogPostSeoOutput } from '@/ai/flows/analyze-blog-post-seo';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

function SeoReportDialog({ result, postTitle }: { result: AnalyzeBlogPostSeoOutput | null, postTitle: string }) {
  if (!result) return null;

  const renderChecklist = (items: Record<string, { pass: boolean; feedback: string }>) => (
    <ul className="space-y-2">
      {Object.entries(items).map(([key, item]) => (
        <li key={key} className="flex items-center gap-3">
          {item.pass ? <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0" /> : <XCircle className="h-5 w-5 text-destructive flex-shrink-0" />}
          <div>
            <p className="font-medium text-sm capitalize">{key.replace(/([A-Z])/g, ' $1')}</p>
            <p className="text-xs text-muted-foreground">{item.feedback}</p>
          </div>
        </li>
      ))}
    </ul>
  );

  return (
    <DialogContent className="sm:max-w-3xl">
      <DialogHeader>
        <DialogTitle>SEO Analysis for: {postTitle}</DialogTitle>
        <DialogDescription>
          This report analyzes the post against key SEO best practices.
        </DialogDescription>
      </DialogHeader>
      <div className="max-h-[70vh] overflow-y-auto pr-4">
        <Accordion type="multiple" defaultValue={['keywordAndIntent', 'metadata', 'structure']} className="w-full space-y-4">
          <AccordionItem value="keywordAndIntent">
            <AccordionTrigger className="text-lg font-semibold">Keyword & Intent</AccordionTrigger>
            <AccordionContent>{renderChecklist(result.keywordAndIntent)}</AccordionContent>
          </AccordionItem>
          <AccordionItem value="metadata">
            <AccordionTrigger className="text-lg font-semibold">Metadata</AccordionTrigger>
            <AccordionContent>{renderChecklist(result.metadata)}</AccordionContent>
          </AccordionItem>
          <AccordionItem value="structure">
            <AccordionTrigger className="text-lg font-semibold">Structure</AccordionTrigger>
            <AccordionContent>{renderChecklist(result.structure)}</AccordionContent>
          </AccordionItem>
          <AccordionItem value="content">
            <AccordionTrigger className="text-lg font-semibold">Content</AccordionTrigger>
            <AccordionContent>{renderChecklist(result.content)}</AccordionContent>
          </AccordionItem>
          <AccordionItem value="links">
            <AccordionTrigger className="text-lg font-semibold">Links</AccordionTrigger>
            <AccordionContent>{renderChecklist(result.links)}</AccordionContent>
          </AccordionItem>
          <AccordionItem value="media">
            <AccordionTrigger className="text-lg font-semibold">Media</AccordionTrigger>
            <AccordionContent>{renderChecklist(result.media)}</AccordionContent>
          </AccordionItem>
           <AccordionItem value="technical">
            <AccordionTrigger className="text-lg font-semibold">Technical</AccordionTrigger>
            <AccordionContent>{renderChecklist(result.technical)}</AccordionContent>
          </AccordionItem>
           <AccordionItem value="trust">
            <AccordionTrigger className="text-lg font-semibold">Trust & Conversion</AccordionTrigger>
            <AccordionContent>{renderChecklist(result.trust)}</AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>
    </DialogContent>
  );
}


export default function AdminBlogPage() {
  const { blogPosts, addPost, updatePost, deletePost, isLoading } = useBlog();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedPost, setSelectedPost] = useState<BlogPost | null>(null);
  const { toast } = useToast();
  const [isAnalysisOpen, setIsAnalysisOpen] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AnalyzeBlogPostSeoOutput | null>(null);
  const [analyzingPost, setAnalyzingPost] = useState<BlogPost | null>(null);


  const handleAddPost = () => {
    setSelectedPost(null);
    setIsFormOpen(true);
  };

  const handleEditPost = (post: BlogPost) => {
    setSelectedPost(post);
    setIsFormOpen(true);
  };
  
  const handleDeletePost = async (postId: string) => {
    try {
        await deletePost(postId);
        toast({
            title: 'Blog Post Deleted',
            description: 'The post has been successfully removed.',
            variant: 'destructive',
        })
    } catch(e) {
        toast({
            title: 'Error',
            description: 'Could not delete the blog post.',
            variant: 'destructive',
        })
    }
  };

  const handleFormSubmit = async (postData: BlogPost) => {
    try {
        if (selectedPost) {
            await updatePost(postData);
            toast({
                title: 'Post Updated',
                description: 'The blog post has been saved.',
            });
        } else {
            const { id, slug, date, ...newPostData } = postData;
            await addPost(newPostData);
            toast({
                title: 'Post Created',
                description: 'The new blog post has been added successfully.',
            });
        }
        setIsFormOpen(false);
        setSelectedPost(null);
    } catch(e) {
         toast({
            title: 'Error',
            description: 'Could not save the blog post.',
            variant: 'destructive',
        });
    }
  };

  const handleAnalyze = async (post: BlogPost) => {
    setAnalyzingPost(post);
    setIsAnalysisOpen(true);
    setAnalysisResult(null); // Clear previous result
    try {
        const result = await analyzeBlogPostSeo({
            title: post.title,
            content: post.content,
            metaTitle: post.metaTitle,
            metaDescription: post.metaDescription,
            url: post.slug,
            imageUrl: post.imageUrl,
        });
        setAnalysisResult(result);
    } catch (e) {
        console.error("Analysis error", e);
        toast({ title: 'Analysis Failed', description: 'Could not analyze the blog post.', variant: 'destructive'});
        setIsAnalysisOpen(false);
    }
  };


  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Manage Blog</h1>
        <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
           <DialogTrigger asChild>
                <Button onClick={handleAddPost}>
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Create Post
                </Button>
           </DialogTrigger>
           <DialogContent className="sm:max-w-3xl">
                <DialogHeader>
                    <DialogTitle>{selectedPost ? 'Edit Blog Post' : 'Create New Blog Post'}</DialogTitle>
                    <DialogDescription>
                        {selectedPost ? 'Update the details of this blog post.' : 'Fill out the form to add a new post.'}
                    </DialogDescription>
                </DialogHeader>
                <BlogForm 
                    post={selectedPost} 
                    onSubmit={handleFormSubmit}
                />
           </DialogContent>
        </Dialog>
      </div>

       <Dialog open={isAnalysisOpen} onOpenChange={setIsAnalysisOpen}>
            {analyzingPost && (
                <SeoReportDialog result={analysisResult} postTitle={analyzingPost.title} />
            )}
        </Dialog>

      <Card>
        <CardHeader>
          <CardTitle>All Blog Posts</CardTitle>
          <CardDescription>View, edit, and delete your blog posts.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
             <div className="flex justify-center items-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Image</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Author</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {blogPosts.map(post => (
                <TableRow key={post.id}>
                  <TableCell>
                      <Image src={post.imageUrl} alt={post.title} width={64} height={40} className="rounded-md object-cover" />
                  </TableCell>
                  <TableCell className="font-medium">
                      <Link href={`/blog/${post.slug}`} className="hover:underline" target="_blank">{post.title}</Link>
                  </TableCell>
                  <TableCell>{post.author}</TableCell>
                  <TableCell>{format(new Date(post.date), 'dd/MM/yyyy')}</TableCell>
                  <TableCell className="text-right">
                    <AlertDialog>
                        <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                            <span className="sr-only">Open menu</span>
                            <MoreHorizontal className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                             <DropdownMenuItem asChild>
                                <Link href={`/blog/${post.slug}`} target="_blank">View Post</Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleEditPost(post)}>
                                Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleAnalyze(post)}>
                                <FileText className="mr-2 h-4 w-4" />
                                Analyze SEO
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                             <AlertDialogTrigger asChild>
                                <DropdownMenuItem className="text-destructive">
                                    Delete
                                </DropdownMenuItem>
                            </AlertDialogTrigger>
                        </DropdownMenuContent>
                        </DropdownMenu>
                         <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                <AlertDialogDescription>
                                This action cannot be undone. This will permanently delete the post:
                                <span className="font-semibold"> {post.title}</span>.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDeletePost(post.id)}>
                                    Continue
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
