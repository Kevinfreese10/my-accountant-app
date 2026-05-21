import { initializeApp } from 'firebase/app';
import { getFirestore, collection, query, where, getDocs } from 'firebase/firestore';

const firebaseConfig = {
  "projectId": "studio-2604127518-57889",
  "appId": "1:248831476160:web:4ad085282b5fd36518c825",
  "storageBucket": "studio-2604127518-57889.firebasestorage.app",
  "apiKey": "AIzaSyD6-yfkYDj_ONK_tZdHhQy3RITU8F9zrU8",
  "authDomain": "studio-2604127518-57889.firebaseapp.com",
  "messagingSenderId": "248831476160"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function run() {
  const orderId = '9890';
  console.log("Querying Firestore for orderId:", orderId);
  const ordersRef = collection(db, "orders");
  const q = query(ordersRef, where("id", "==", orderId));
  const querySnapshot = await getDocs(q);
  if (querySnapshot.empty) {
    console.log(`Order ${orderId} not found.`);
  } else {
    console.log("Order found:", JSON.stringify(querySnapshot.docs[0].data(), null, 2));
  }
}
run().catch(console.error);
