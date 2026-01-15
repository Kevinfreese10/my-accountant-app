

import Image from 'next/image';
import { notFound } from 'next/navigation';
import { BlogPost, Service } from '@/lib/types';
import { getFirestore, collection, getDocs, query, where, Timestamp } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { format } from 'date-fns';
import { Metadata, ResolvingMetadata } from 'next';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';

const db = getFirestore(firebaseApp);

export const dynamic = 'force-dynamic';

async function getPost(slug: string): Promise<BlogPost | null> {
    const q = query(collection(db, "blogPosts"), where("slug", "==", slug));
    const querySnapshot = await getDocs(q);
    if (querySnapshot.empty) {
        return null;
    }
    const docData = querySnapshot.docs[0].data();
    
    const date = docData.date?.toDate ? docData.date.toDate().toISOString() : docData.date;
    
    return {
        ...docData,
        id: querySnapshot.docs[0].id,
        date: date,
    } as BlogPost;
}

async function getRelatedServices(serviceIds: string[]): Promise<Service[]> {
  if (!serviceIds || serviceIds.length === 0) {
    return [];
  }
  const servicesRef = collection(db, 'services');
  const q = query(servicesRef, where('__name__', 'in', serviceIds));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Service));
}

type Props = {
  params: { slug: string }
}

export async function generateMetadata(
  { params }: Props,
  parent: ResolvingMetadata
): Promise<Metadata> {
  const post = await getPost(params.slug);
 
  if (!post) {
    return {
      title: 'Post Not Found'
    }
  }

  const canonicalUrl = `${process.env.NEXT_PUBLIC_APP_URL}/blog/${post.slug}`;
 
  return {
    title: post.metaTitle || post.title,
    description: post.metaDescription || post.excerpt,
    alternates: {
        canonical: canonicalUrl,
    },
    openGraph: {
      title: post.metaTitle || post.title,
      description: post.metaDescription || post.excerpt,
      images: [post.imageUrl],
      url: canonicalUrl,
    },
    twitter: {
      card: 'summary_large_image',
      title: post.metaTitle || post.title,
      description: post.metaDescription || post.excerpt,
      images: [post.imageUrl],
    },
  }
}

const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-ZA', {
      style: 'currency',
      currency: 'ZAR',
      minimumFractionDigits: price % 1 === 0 ? 0 : 2,
      maximumFractionDigits: 2,
    }).format(price);
};

export default async function BlogPostPage({ params }: { params: { slug: string } }) {
  const post = await getPost(params.slug);

  if (!post) {
    notFound();
  }

  const relatedServices = await getRelatedServices(post.relatedProducts || []);

  return (
    <article className="container mx-auto max-w-4xl px-4 py-12">
      <header className="mb-8">
        <h1 className="text-4xl font-bold tracking-tight md:text-5xl">{post.title}</h1>
        <div className="mt-6 flex items-center gap-4">
          <div>
            <p className="font-semibold">{post.author}</p>
            <p className="text-sm text-muted-foreground">
              Published on {format(new Date(post.date), 'dd/MM/yyyy')}
            </p>
          </div>
        </div>
      </header>
      
      <div className="relative my-8 h-64 md:h-96 w-full">
        <Image
          src={post.imageUrl}
          alt={post.title}
          fill
          className="rounded-lg object-cover shadow-lg"
          data-ai-hint={post.imageHint}
        />
      </div>

      <div
        className="prose prose-lg max-w-none prose-h3:font-headline prose-h3:text-xl prose-h3:font-semibold prose-p:text-foreground/80 prose-a:text-primary"
        dangerouslySetInnerHTML={{ __html: post.content }}
      />
      
      {relatedServices.length > 0 && (
        <section className="mt-16">
            <h2 className="text-2xl font-bold text-center mb-8">Related Products</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {relatedServices.map(service => (
                     <Card key={service.id} className="flex flex-col overflow-hidden">
                        <Link href={`/products/${service.slug}`} className="block">
                            <div className="relative h-40 w-full">
                                <Image
                                src={service.imageUrl}
                                alt={service.title}
                                fill
                                className="object-cover"
                                data-ai-hint={service.imageHint}
                                />
                            </div>
                        </Link>
                        <CardHeader>
                            <CardTitle className="text-lg leading-tight hover:text-primary transition-colors">
                                <Link href={`/products/${service.slug}`}>{service.title}</Link>
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="flex-grow">
                             <p className="text-lg font-bold text-primary">{formatPrice(service.price)}</p>
                        </CardContent>
                        <CardFooter>
                            <Button variant="link" asChild className="p-0">
                                <Link href={`/products/${service.slug}`}>
                                View Product <ArrowRight className="ml-2 h-4 w-4" />
                                </Link>
                            </Button>
                        </CardFooter>
                    </Card>
                ))}
            </div>
        </section>
      )}

    </article>
  );
}
