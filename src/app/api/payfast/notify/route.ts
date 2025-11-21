
import { NextRequest, NextResponse } from 'next/server';
import { getFirestore, collection, query, where, getDocs, updateDoc, doc, arrayUnion, Timestamp } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { ItnLog } from '@/lib/types';

const db = getFirestore(firebaseApp);

export async function POST(req: NextRequest) {
  let log: Omit<ItnLog, 'receivedAt'>;
  let orderId: string | null = null;
  let orderDocId: string | null = null;

  try {
    const bodyText = await req.text();
    console.log('Raw ITN body:', bodyText);

    const params = new URLSearchParams(bodyText);
    const data: { [key: string]: any } = {};
    params.forEach((value, key) => {
      data[key] = value;
    });

    console.log('Parsed ITN data:', data);

    orderId = data.m_payment_id;
    const paymentStatus = data.payment_status;

    if (!orderId) {
      console.error('ITN Error: No m_payment_id found in the request.');
      return new NextResponse('OK', { status: 200 });
    }
    
    // Find the order document ID
    const ordersRef = collection(db, "orders");
    const q = query(ordersRef, where("id", "==", orderId));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
        log = {
            status: 'Failed',
            message: `Order with ID ${orderId} not found in database.`,
            payload: data,
        };
        // Even if order not found, we can't log to a doc that doesn't exist.
        // Returning OK to stop PayFast retries.
        return new NextResponse('OK', { status: 200 });
    }
    
    orderDocId = querySnapshot.docs[0].id;
    const orderRef = doc(db, 'orders', orderDocId);

    if (paymentStatus === 'COMPLETE') {
      await updateDoc(orderRef, {
        status: 'Processing',
      });
      
      log = {
          status: 'Success',
          message: `Order status updated to Processing.`,
          payload: data,
      };

    } else {
        log = {
            status: 'Failed',
            message: `Payment status was "${paymentStatus}", not "COMPLETE". No status update performed.`,
            payload: data,
        };
    }
    
    // Log the ITN attempt to the order document
    await updateDoc(orderRef, {
        itnHistory: arrayUnion({ ...log, receivedAt: Timestamp.now() }),
    });

    return new NextResponse('OK', { status: 200 });

  } catch (error) {
    console.error('PayFast ITN Handler - Uncaught Error:', error);
    
    // Attempt to log the failure to the order if we have an ID
    if (orderId && orderDocId) {
       log = {
            status: 'Failed',
            message: `Internal Server Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
            payload: {},
        };
       try {
            const orderRef = doc(db, 'orders', orderDocId);
            await updateDoc(orderRef, {
                itnHistory: arrayUnion({ ...log, receivedAt: Timestamp.now() }),
            });
       } catch (loggingError) {
           console.error("Failed to log error to Firestore document:", loggingError);
       }
    }

    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
