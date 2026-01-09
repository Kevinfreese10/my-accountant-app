
import { collection, getDocs, orderBy, query, getFirestore, Timestamp } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { Service } from '@/lib/types';
import HomePageClient from '@/components/home/HomePageClient';

const db = getFirestore(firebaseApp);

type Category = { 
    id: string; 
    name: string; 
    description: string; 
    order: number; 
};

async function getServicesAndCategories() {
    const servicesQuery = query(collection(db, 'services'), orderBy('title'));
    const servicesSnapshot = await getDocs(servicesQuery);
    const services = servicesSnapshot.docs.map(doc => {
        const data = doc.data();
        // Convert Timestamp to a serializable format (ISO string)
        const serviceData = {
            id: doc.id,
            ...data,
        } as any;

        if (data.createdAt && data.createdAt instanceof Timestamp) {
            serviceData.createdAt = data.createdAt.toDate().toISOString();
        }
        return serviceData as Service;
    });

    const categoriesQuery = query(collection(db, 'categories'), orderBy('order'));
    const categoriesSnapshot = await getDocs(categoriesQuery);
    const categories = categoriesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Category));
    
    return { services, categories };
}

export default async function Home() {
  const { services, categories } = await getServicesAndCategories();

  return <HomePageClient services={services} categories={categories} />;
}
