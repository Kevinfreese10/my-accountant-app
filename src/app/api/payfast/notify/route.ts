
import { NextRequest, NextResponse } from 'next/server';
import { getFirestore, collection, query, where, getDocs, updateDoc, doc, arrayUnion, Timestamp } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { ItnLog } from '@/lib/types';
import crypto from 'crypto';

const db = getFirestore(firebaseApp);

function rfc3986Encode(str: string) {
    return encodeURIComponent(str).replace(/[!'()*]/g, (c) => {
        return '%' + c.charCodeAt(0).toString(16).toUpperCase();
    });
}

function generateSignature(data: { [key: string]: any }, passphrase?: string): string {
    let pfOutput = '';
    for (let key in data) {
        if (data.hasOwnProperty(key) && key !== 'signature') {
            pfOutput += `${key}=${rfc3986Encode(data[key]).replace(/%20/g, '+')}&`;
        }
    }

    // Remove last ampersand
    let getString = pfOutput.slice(0, -1);
    if (passphrase) {
        getString += `&passphrase=${rfc3986Encode(passphrase.trim()).replace(/%20/g, '+')}`;
    }

    return crypto.createHash('md5').update(getString).digest('hex');
}

export async function POST(req: NextRequest) {
    console.log(`ITN HIT: ${new Date().toISOString()}`, { headers: Object.fromEntries(req.headers.entries()) });
  
    let log: Omit<ItnLog, 'receivedAt'>;
    let orderId: string | null = null;
    let orderDocId: string | null = null;
  
    try {
        const formData = await req.formData();
        const data: { [key: string]: any } = {};
        formData.forEach((value, key) => {
            data[key] = value;
        });

        console.log('Parsed ITN form data:', data);

        orderId = data.m_payment_id;

        if (!orderId) {
            console.error('ITN Error: No m_payment_id (m_payment_id) found in the request.');
            return new NextResponse('OK', { status: 200 });
        }

        const ordersRef = collection(db, "orders");
        const q = query(ordersRef, where("id", "==", orderId));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            console.error(`Order ${orderId} not found in database.`);
            return new NextResponse('OK', { status: 200 });
        }
        
        orderDocId = querySnapshot.docs[0].id;
        const orderRef = doc(db, 'orders', orderDocId);

        const receivedSignature = data.signature;
        const expectedSignature = generateSignature(data, process.env.PAYFAST_PASSPHRASE);
        
        if (receivedSignature !== expectedSignature) {
            console.error('Signature mismatch on ITN for order:', orderId);
            log = {
                status: 'Failed',
                message: `Signature mismatch. Received: ${receivedSignature}, Expected: ${expectedSignature}`,
                payload: data,
            };
            await updateDoc(orderRef, { itnHistory: arrayUnion({ ...log, receivedAt: Timestamp.now() }) });
            return new NextResponse('Signature mismatch', { status: 400 });
        }
        
        if (data.payment_status === 'COMPLETE') {
          await updateDoc(orderRef, {
            status: 'Processing',
          });
          console.log(`Order ${orderId} updated to Processing.`);
          log = {
              status: 'Success',
              message: `Order status updated to Processing.`,
              payload: data,
          };
        } else {
          console.log(`Payment for order ${orderId} not complete. Status: ${data.payment_status}`);
          log = {
                status: 'Failed',
                message: `Payment status was "${data.payment_status}", not "COMPLETE". No status update performed.`,
                payload: data,
          };
        }
        
        await updateDoc(orderRef, { itnHistory: arrayUnion({ ...log, receivedAt: Timestamp.now() }) });

        return new NextResponse('OK', { status: 200 });
    } catch (error) {
        console.error('PayFast ITN Error:', error);
        
        if (orderDocId) {
            log = {
                status: 'Failed',
                message: `Internal Server Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
                payload: {},
            };
           try {
                const orderRef = doc(db, 'orders', orderDocId);
                await updateDoc(orderRef, { itnHistory: arrayUnion({ ...log, receivedAt: Timestamp.now() }) });
           } catch (loggingError) {
               console.error("Failed to log error to Firestore document:", loggingError);
           }
        }
        return new NextResponse('Error processing ITN', { status: 500 });
    }
}
