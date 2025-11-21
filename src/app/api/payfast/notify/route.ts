
import { NextRequest, NextResponse } from 'next/server';
import { getFirestore, collection, query, where, getDocs, updateDoc, doc } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';

const db = getFirestore(firebaseApp);

export async function POST(req: NextRequest) {
  try {
    const bodyText = await req.text();
    console.log('Raw ITN body:', bodyText);

    const params = new URLSearchParams(bodyText);
    const data: { [key: string]: string } = {};
    params.forEach((value, key) => {
      data[key] = value;
    });

    console.log('Parsed ITN data:', data);

    const orderId = data.m_payment_id;
    const paymentStatus = data.payment_status;

    console.log(`Processing ITN for Order ID: ${orderId} with status: ${paymentStatus}`);

    if (!orderId) {
      console.error('ITN Error: No m_payment_id found in the request.');
      // Returning 200 OK as PayFast may retry on other statuses.
      // Logged the error for debugging.
      return new NextResponse('OK', { status: 200 });
    }

    if (paymentStatus === 'COMPLETE') {
      const ordersRef = collection(db, "orders");
      const q = query(ordersRef, where("id", "==", orderId));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        console.error(`Firestore Error: Order with ID ${orderId} not found.`);
        // Still return 200 OK to prevent PayFast retries for a non-existent order.
        return new NextResponse('OK', { status: 200 });
      }

      const orderDoc = querySnapshot.docs[0];
      const orderRef = doc(db, 'orders', orderDoc.id);

      await updateDoc(orderRef, {
        status: 'Processing',
      });

      console.log(`Firestore Success: Order ${orderId} (Doc ID: ${orderDoc.id}) status updated to Processing.`);

    } else {
      console.log(`Payment status for order ${orderId} is '${paymentStatus}'. No status update needed.`);
    }

    return new NextResponse('OK', { status: 200 });

  } catch (error) {
    console.error('PayFast ITN Handler - Uncaught Error:', error);
    // Return 500 to indicate a server-side issue.
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
