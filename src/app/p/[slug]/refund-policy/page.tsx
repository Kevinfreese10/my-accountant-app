
import { getFirestore, collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
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
  const data = doc.data();

  const serializedPartner = {
    ...data,
    id: doc.id,
    uid: doc.id,
  } as any;

  if (data.createdAt instanceof Timestamp) {
    serializedPartner.createdAt = data.createdAt.toDate().toISOString();
  }
  if (data.yearEnd instanceof Timestamp) {
    serializedPartner.yearEnd = data.yearEnd.toDate().toISOString();
  }
  if (data.subscription) {
    serializedPartner.subscription = { ...data.subscription };
    if (data.subscription.lastBillingDate instanceof Timestamp) {
      serializedPartner.subscription.lastBillingDate = data.subscription.lastBillingDate.toDate().toISOString();
    }
    if (data.subscription.subscriptionEndDate instanceof Timestamp) {
      serializedPartner.subscription.subscriptionEndDate = data.subscription.subscriptionEndDate.toDate().toISOString();
    }
  }

  return serializedPartner as User;
}

export default async function PartnerRefundPolicyPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const partner = await getPartnerBySlug(slug);

  if (!partner || !partner.landingPage?.refundPolicy) {
    notFound();
  }

  return (
    <div className="container mx-auto max-w-4xl px-4 py-12">
      <div className="space-y-8">
        <div className="text-center">
          <h1 className="text-4xl font-bold tracking-tight">Refund Policy</h1>
          <p className="mt-2 text-lg opacity-70">{partner.companyName || partner.name}</p>
        </div>
        
        <Card className="partner-card">
            <CardContent className="p-8">
                <div className="prose prose-sm max-w-none whitespace-pre-wrap opacity-80 leading-relaxed">
                    {partner.landingPage.refundPolicy}
                </div>
            </CardContent>
        </Card>
      </div>
    </div>
  );
}
