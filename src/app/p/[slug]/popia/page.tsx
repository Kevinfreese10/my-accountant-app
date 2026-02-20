import { getFirestore, collection, query, where, getDocs } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { User } from '@/lib/types';
import { notFound } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const db = getFirestore(firebaseApp);

async function getPartnerBySlug(slug: string): Promise<User | null> {
  const q = query(
    collection(db, "users"), 
    where("landingPage.enabled", "==", true),
    where("landingPage.slug", "==", slug)
  );
  const snapshot = await getDocs(q);
  if (snapshot.empty) return null;
  const doc = snapshot.docs[0];
  return { ...doc.data(), id: doc.id } as User;
}

export default async function PartnerPopiaPage({ params }: { params: { slug: string } }) {
  const partner = await getPartnerBySlug(params.slug);

  if (!partner || !partner.landingPage?.popiaPolicy) {
    notFound();
  }

  return (
    <div className="container mx-auto max-w-4xl px-4 py-12">
      <div className="space-y-8">
        <div className="text-center">
          <h1 className="text-4xl font-bold tracking-tight">POPIA Compliance Policy</h1>
          <p className="mt-2 text-lg opacity-70">{partner.companyName || partner.name}</p>
        </div>
        
        <Card className="partner-card">
            <CardContent className="p-8">
                <div className="prose prose-sm max-w-none whitespace-pre-wrap opacity-80 leading-relaxed">
                    {partner.landingPage.popiaPolicy}
                </div>
            </CardContent>
        </Card>
      </div>
    </div>
  );
}