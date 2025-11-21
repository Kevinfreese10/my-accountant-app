
import { NextRequest, NextResponse } from 'next/server';
import { getFirestore, doc, updateDoc, getDoc, arrayUnion, Timestamp } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import crypto from 'crypto';

const db = getFirestore(firebaseApp);

function rfc3986Encode(str: string) {
    return encodeURIComponent(str).replace(/[!'()*]/g, (c) => {
        return '%' + c.charCodeAt(0).toString(16).toUpperCase();
    }).replace(/%20/g, '+');
}

function generateSignature(data: { [key: string]: any }, passphrase?: string): string {
    let pfOutput = '';
    
    // Order the keys alphabetically
    const orderedKeys = Object.keys(data)
      .filter(key => key !== 'signature')
      .sort();

    orderedKeys.forEach(key => {
        if (data[key] !== '' && data[key] !== null && data[key] !== undefined) {
             pfOutput += `${key}=${rfc3986Encode(String(data[key]).trim())}&`;
        }
    });

    // Remove last ampersand
    let getString = pfOutput.slice(0, -1);
    
    if (passphrase) {
        getString += `&passphrase=${rfc3986Encode(passphrase.trim())}`;
    }

    return crypto.createHash('md5').update(getString).digest('hex');
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const data: { [key:string]: any } = {};
    formData.forEach((value, key) => {
        data[key] = value;
    });

    console.log('Received PayFast ITN:', data);

    const receivedSignature = data.signature;
    const passphrase = process.env.PAYFAST_PASSPHRASE;

    const calculatedSignature = generateSignature(data, passphrase);

    if (receivedSignature !== calculatedSignature) {
        console.error('Signature mismatch on ITN');
        console.error('Received:', receivedSignature);
        console.error('Expected:', calculatedSignature);
        // Log the string that was hashed for debugging
        let pfOutput = '';
        const orderedKeys = Object.keys(data).filter(key => key !== 'signature').sort();
        orderedKeys.forEach(key => {
          if (data[key] !== '' && data[key] !== null && data[key] !== undefined) {
            pfOutput += `${key}=${rfc3986Encode(String(data[key]).trim())}&`;
          }
        });
        let getString = pfOutput.slice(0, -1);
        if (passphrase) {
          getString += `&passphrase=${rfc3986Encode(passphrase.trim())}`;
        }
        console.error('String to hash:', getString);

        return new NextResponse('Signature mismatch', { status: 400 });
    }
    
    const orderId = data.m_payment_id;
    const orderRef = doc(db, 'orders', orderId);

    const itnLog = {
      receivedAt: Timestamp.now(),
      status: 'Success',
      message: 'ITN received and signature verified.',
      payload: data,
    };
    await updateDoc(orderRef, {
        itnHistory: arrayUnion(itnLog)
    });
    
    if (data.payment_status === 'COMPLETE') {
      await updateDoc(orderRef, {
        status: 'Processing',
      });
      console.log(`Order ${orderId} updated to Processing.`);

    } else {
      console.log(`Payment for order ${orderId} not complete. Status: ${data.payment_status}`);
    }

    return new NextResponse('OK', { status: 200 });
  } catch (error) {
    console.error('PayFast ITN Error:', error);
     const orderId = (await req.formData()).get('m_payment_id');
     if (orderId) {
        const orderRef = doc(db, 'orders', orderId as string);
         const itnLog = {
            receivedAt: Timestamp.now(),
            status: 'Failed',
            message: `Error processing ITN: ${error instanceof Error ? error.message : String(error)}`,
            payload: {},
        };
        try {
            await updateDoc(orderRef, { itnHistory: arrayUnion(itnLog) });
        } catch (dbError) {
            console.error("Failed to log ITN error to Firestore:", dbError);
        }
     }
    return new NextResponse('Error processing ITN', { status: 500 });
  }
}
