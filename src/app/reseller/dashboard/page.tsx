
'use client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useBlog } from '@/contexts/BlogContext';
import { Loader2 } from 'lucide-react';
import Image from 'next/image';
import { format } from 'date-fns';
import { Order, Service, User } from '@/lib/types';
import { useState, useEffect, useRef } from 'react';
import { getFirestore, collection, getDocs, orderBy, query, where, doc, updateDoc, setDoc, Timestamp } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { useToast } from '@/hooks/use-toast';
import CommunityQnA from '@/components/reseller/CommunityQnA';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

const db = getFirestore(firebaseApp);

export default function ResellerDashboardPage() {
    const { user } = useAuth();
    const { blogPosts, isLoading: isBlogLoading } = useBlog();
    const [isLoading, setIsLoading] = useState(true);
    const { toast } = useToast();
    
    useEffect(() => {
        if (!isBlogLoading) {
            setIsLoading(false);
        }
    }, [isBlogLoading]);

    const latestNews = blogPosts.slice(0, 3);
    
    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Welcome, {user?.contactPerson}!</h1>
                <p className="text-lg text-muted-foreground">{user?.companyName}</p>
            </div>
            
            <section>
              <CommunityQnA />
            </section>

            <section>
                <Card>
                    <CardHeader>
                        <CardTitle>Latest News</CardTitle>
                        <CardDescription>Stay up-to-date with the latest tax tips and articles.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {isBlogLoading ? (
                            <div className="flex justify-center items-center h-40">
                                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {latestNews.map(post => (
                                    <div key={post.id} className="group">
                                        <Link href={`/blog/${post.slug}`} className="block">
                                            <div className="relative h-40 w-full overflow-hidden rounded-lg">
                                                <Image
                                                    src={post.imageUrl}
                                                    alt={post.title}
                                                    fill
                                                    className="object-cover transition-transform duration-300 group-hover:scale-105"
                                                    data-ai-hint={post.imageHint}
                                                />
                                            </div>
                                            <div className="mt-3">
                                                <p className="text-sm font-semibold group-hover:text-primary">{post.title}</p>
                                                <p className="text-xs text-muted-foreground">{format(new Date(post.date), 'dd/MM/yyyy')}</p>
                                            </div>
                                        </Link>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </section>
        </div>
    );
}
