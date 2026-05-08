
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { BlogPost, Service } from '@/lib/types';
import { getFirestore, collection, getDocs, query, where, Timestamp } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { format } from 'date-fns';
import { Metadata, ResolvingMetadata } from 'next';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowRight, Clock } from 'lucide-react';
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
  params: Promise<{ slug: string }>
}

export async function generateMetadata(
  { params }: Props,
  parent: ResolvingMetadata
): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPost(slug);
  const siteUrl = 'https://www.myacc.co.za';
  const globalFallbackImg = `${siteUrl}/og-image.jpg`;
 
  if (!post) {
    return { title: 'Post Not Found' }
  }

  const canonicalUrl = `${siteUrl}/blog/${post.slug}`;
  const title = post.metaTitle || `${post.title} | My Accountant`;
  const description = post.metaDescription || post.excerpt;
  
  let ogImage = post.seoImageUrl || post.imageUrl || globalFallbackImg;
  if (ogImage.startsWith('/')) {
    ogImage = `${siteUrl}${ogImage}`;
  }
 
  return {
    title: title,
    description: description,
    alternates: {
        canonical: canonicalUrl,
    },
    openGraph: {
      title: title,
      description: description,
      url: canonicalUrl,
      siteName: 'My Accountant',
      locale: 'en_ZA',
      type: 'article',
      images: [{
        url: ogImage,
        width: 1200,
        height: 630,
        alt: post.seoImageLabel || post.title
      }],
    },
    twitter: {
      card: 'summary_large_image',
      title: title,
      description: description,
      images: [ogImage],
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

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params;
  const post = await getPost(slug);

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
        suppressHydrationWarning
      />
      
      {relatedServices.length > 0 && (
        <section className="mt-16">
            <h2 className="text-2xl font-bold text-center mb-8">Related Products</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {relatedServices.map(service => (
                    <Card
                    key={service.id}
                    className="flex flex-col overflow-hidden transition-all duration-300 hover:shadow-xl hover:-translate-y-1"
                    >
                    <CardHeader>
                        <CardTitle>{service.title}</CardTitle>
                        {service.isPriceTbc ? (
                            <p className="text-xl font-bold text-muted-foreground pt-2">Price on request</p>
                        ) : (
                            <p className="text-2xl font-bold text-primary pt-2">{formatPrice(service.price)}</p>
                        )}
                        <div className="flex items-center text-muted-foreground pt-1">
                            <Clock className="h-4 w-4 mr-1.5" />
                            <span className="text-xs font-medium">{service.turnaroundTime}</span>
                        </div>
                    </CardHeader>
                    <CardContent className="flex-grow">
                        <CardDescription>{service.description}</CardDescription>
                    </CardContent>
                    <CardFooter>
                        <Button asChild className="w-full">
                        <Link href={`/products/${service.slug}`}>Learn More</Link>
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
