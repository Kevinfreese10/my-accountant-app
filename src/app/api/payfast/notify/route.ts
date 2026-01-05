
import { NextRequest, NextResponse } from 'next/server';
import { getFirestore, doc, updateDoc, getDoc, collection, query, where, getDocs, arrayUnion, Timestamp } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import crypto from 'crypto';
import { ItnLog, Order } from '@/lib/types';
import ipaddr from 'ipaddr.js';

const db = getFirestore(firebaseApp);

// PayFast's valid IP ranges
const PAYFAST_IP_RANGES = [
    '197.97.183.80/28',
    '196.25.7.240/28',
    '197.242.144.240/28',
    '41.74.178.192/28',
];

function isIpAllowed(req: NextRequest): boolean {
    let ipStr = req.ip; // Vercel provides this
    
    if (!ipStr) {
        const forwardedFor = req.headers.get('x-forwarded-for');
        if (forwardedFor) {
            ipStr = forwardedFor.split(',')[0].trim();
        }
    }

    if (!ipStr) {
        console.warn('ITN Warning: Could not determine request IP address.');
        return false; // Fail safe
    }

    try {
        const reqIp = ipaddr.parse(ipStr);
        return PAYFAST_IP_RANGES.some(range => {
            const cidr = ipaddr.parseCIDR(range);
            return reqIp.match(cidr);
        });
    } catch (e) {
        console.error('ITN IP parsing error:', e);
        return false;
    }
}


function rfc3986Encode(str: string) {
    return encodeURIComponent(str).replace(/[!'()*]/g, (c) => {
        return '%' + c.charCodeAt(0).toString(16).toUpperCase();
    }).replace(/%20/g, '+');
}


function generateSignature(data: { [key: string]: any }, passphrase?: string): string {
    let pfOutput = '';
    
    // Create a string from the data object
    for (const key in data) {
        if (data.hasOwnProperty(key) && key !== 'signature') {
            pfOutput += `${key}=${rfc3986Encode(String(data[key]).trim())}&`;
        }
    }

    // Remove last ampersand
    let getString = pfOutput.slice(0, -1);
    
    if (passphrase) {
        getString += `&passphrase=${rfc3986Encode(passphrase.trim())}`;
    }

    return crypto.createHash('md5').update(getString).digest('hex');
}

export async function POST(req: NextRequest) {
    // 1. Early logging
    console.log(`ITN HIT: ${new Date().toISOString()}`, { headers: Object.fromEntries(req.headers.entries()) });
  
    // 2. IP Validation
    if (!isIpAllowed(req)) {
        console.error('ITN Error: Request received from an invalid IP address:', req.ip || req.headers.get('x-forwarded-for'));
        return new NextResponse('Forbidden: IP address not allowed', { status: 403 });
    }

    let orderDocId: string | null = null;
    let orderId: string | null = null;
  
    try {
        const bodyText = await req.text();
        const searchParams = new URLSearchParams(bodyText);
        const data: { [key: string]: any } = {};
        searchParams.forEach((value, key) => {
            data[key] = value;
        });

        console.log('ITN Parsed Body:', data);
        orderId = data.m_payment_id;

        if (!orderId) {
            console.error('ITN Error: No m_payment_id found in the request body.');
            return new NextResponse('OK', { status: 200 }); // Still return 200 to prevent PayFast retries
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
        const orderDoc = await getDoc(orderRef);
        const currentOrderData = orderDoc.data() as Order;

        // Idempotency check: if status is already beyond 'Pending Payment', log and exit.
        if (currentOrderData && currentOrderData.status !== 'Pending Payment') {
            console.log(`ITN Info: Order ${orderId} is already processed (Status: ${currentOrderData.status}). Ignoring duplicate notification.`);
            return new NextResponse('OK', { status: 200 });
        }

        // 3. Signature Validation
        const receivedSignature = data.signature;
        const expectedSignature = generateSignature(data, process.env.PAYFAST_PASSPHRASE);
        
        if (receivedSignature !== expectedSignature) {
            console.error('Signature mismatch on ITN for order:', orderId);
            const log: Omit<ItnLog, 'receivedAt'> = {
                status: 'Failed',
                message: `Signature mismatch.`,
                payload: data,
            };
            await updateDoc(orderRef, { itnHistory: arrayUnion({ ...log, receivedAt: Timestamp.now() }) });
            return new NextResponse('Signature mismatch', { status: 400 });
        }
        
        // 4. Amount Validation (optional but recommended)
        const orderTotal = parseFloat(currentOrderData.total.toFixed(2));
        const receivedAmount = parseFloat(data.amount_gross);
        if (Math.abs(orderTotal - receivedAmount) > 0.01) {
             console.error(`Amount mismatch for order ${orderId}. Expected: ${orderTotal}, Received: ${receivedAmount}`);
             const log: Omit<ItnLog, 'receivedAt'> = {
                status: 'Failed',
                message: `Amount mismatch. Expected: ${orderTotal}, Received: ${receivedAmount}`,
                payload: data,
            };
            await updateDoc(orderRef, { itnHistory: arrayUnion({ ...log, receivedAt: Timestamp.now() }) });
            return new NextResponse('Amount mismatch', { status: 400 });
        }

        // 5. Payment Status Handling
        let log: Omit<ItnLog, 'receivedAt'>;
        if (data.payment_status === 'COMPLETE') {
          await updateDoc(orderRef, { status: 'Processing' });
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
            const log: Omit<ItnLog, 'receivedAt'> = {
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
