import { NextRequest, NextResponse } from 'next/server';
import { getFirestore, doc, updateDoc, getDoc, collection, query, where, getDocs, arrayUnion, Timestamp, increment } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import crypto from 'crypto';
import { ItnLog, Order, User } from '@/lib/types';
import ipaddr from 'ipaddr.js';
import { render } from '@react-email/components';
import React from 'react';
import DocumentRequestEmail from '@/components/emails/DocumentRequestEmail';
import { sendEmail } from '@/lib/email';
import { services as allServices } from '@/lib/data';

const db = getFirestore(firebaseApp);

// PayFast's valid IP ranges
const PAYFAST_IP_RANGES = [
    '197.97.183.80/28',
    '196.25.7.240/28',
    '197.242.144.240/28',
    '41.74.178.192/28',
];

function isIpAllowed(req: NextRequest): boolean {
    // Priority check for x-forwarded-for in proxy environments
    let ipStr = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || req.ip;
    
    if (!ipStr) {
        console.warn('ITN Warning: Could not determine request IP address.');
        return false;
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

/**
 * Verifies the PayFast signature by processing the RAW body string.
 * This is the only way to guarantee parameter order and encoding match.
 */
function verifyPayFastSignature(rawBody: string, receivedSignature: string, passphrase?: string): boolean {
    const params = rawBody.split('&');
    let signatureString = '';

    for (const param of params) {
        const [key, value] = param.split('=');
        if (key !== 'signature') {
            signatureString += `${key}=${value}&`;
        }
    }

    // Remove trailing ampersand
    let finalString = signatureString.slice(0, -1);
    
    if (passphrase) {
        // Passphrase must be encoded exactly as PayFast expects (standard urlencode)
        const encodedPassphrase = encodeURIComponent(passphrase.trim()).replace(/%20/g, '+');
        finalString += `&passphrase=${encodedPassphrase}`;
    }

    const calculatedSignature = crypto.createHash('md5').update(finalString).digest('hex');
    return calculatedSignature === receivedSignature;
}

export async function POST(req: NextRequest) {
    console.log(`ITN Processing: ${new Date().toISOString()}`);
  
    // 1. IP Validation
    if (!isIpAllowed(req)) {
        console.error('ITN Error: Invalid IP address access attempt.');
        return new NextResponse('Forbidden', { status: 403 });
    }

    try {
        const rawBody = await req.text();
        const searchParams = new URLSearchParams(rawBody);
        const data: { [key: string]: string } = {};
        searchParams.forEach((value, key) => {
            data[key] = value;
        });

        const orderId = data.m_payment_id;
        if (!orderId) {
            console.error('ITN Error: m_payment_id missing.');
            return new NextResponse('OK', { status: 200 });
        }

        // Find the order
        const ordersRef = collection(db, "orders");
        const q = query(ordersRef, where("id", "==", orderId));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            console.error(`Order ${orderId} not found.`);
            return new NextResponse('OK', { status: 200 });
        }
        
        const orderDoc = querySnapshot.docs[0];
        const orderRef = orderDoc.ref;
        const currentOrderData = orderDoc.data() as Order;

        // Idempotency: Ignore if already processed
        if (currentOrderData.status !== 'Pending Payment') {
            console.log(`ITN Info: Order ${orderId} already processed (Status: ${currentOrderData.status}).`);
            return new NextResponse('OK', { status: 200 });
        }

        // 2. Signature Validation using the RAW body
        const isValid = verifyPayFastSignature(rawBody, data.signature, process.env.PAYFAST_PASSPHRASE);
        
        if (!isValid) {
            console.error('Signature mismatch for order:', orderId);
            await updateDoc(orderRef, { 
                itnHistory: arrayUnion({ 
                    status: 'Failed', 
                    message: 'Signature verification failed. Check passphrase.', 
                    receivedAt: Timestamp.now(),
                    payload: data
                }) 
            });
            return new NextResponse('Signature mismatch', { status: 400 });
        }
        
        // 3. Amount Validation
        const orderTotal = parseFloat((currentOrderData.clientTotal || currentOrderData.total).toFixed(2));
        const receivedAmount = parseFloat(data.amount_gross);
        if (Math.abs(orderTotal - receivedAmount) > 0.01) {
             console.error(`Amount mismatch. Expected: ${orderTotal}, Received: ${receivedAmount}`);
             await updateDoc(orderRef, { 
                itnHistory: arrayUnion({ 
                    status: 'Failed', 
                    message: `Amount mismatch. Expected ${orderTotal}, got ${receivedAmount}`, 
                    receivedAt: Timestamp.now(),
                    payload: data
                }) 
            });
            return new NextResponse('Amount mismatch', { status: 400 });
        }

        // 4. Update Order Status
        if (data.payment_status === 'COMPLETE') {
          await updateDoc(orderRef, { status: 'Processing' });
          
          // Handle Partner Credit Top-ups
          const isSetup = currentOrderData.items.some(i => i.id === 'partner_setup_fee');
          const isTopup = currentOrderData.items.some(i => i.id === 'partner_credit_topup');
          
          if (isSetup || isTopup) {
              const partnerId = currentOrderData.resellerId || currentOrderData.userId;
              if (partnerId) {
                  const partnerRef = doc(db, 'users', partnerId);
                  const creditAmount = isSetup ? 5000 : currentOrderData.total;
                  await updateDoc(partnerRef, {
                      creditBalance: increment(creditAmount),
                      status: 'Active'
                  });
              }
          }

          // 5. Send Document Request Email (Automated)
          const isOutsourced = !!currentOrderData.resellerId;
          const recipientEmail = isOutsourced && currentOrderData.endCustomerEmail 
              ? currentOrderData.endCustomerEmail 
              : currentOrderData.customerEmail;

          // Only send if not already notified
          const alreadyNotified = currentOrderData.notes?.some(n => n.subject === `Action Required for Your Order #${orderId}`);

          if (recipientEmail && !alreadyNotified) {
              const itemsWithServices = currentOrderData.items.map(item => {
                  const service = allServices.find(s => s.id === item.id);
                  return { ...item, service };
              }).filter(item => item.service) as { service: Service }[];

              const emailHtml = render(React.createElement(DocumentRequestEmail, {
                  order: { ...currentOrderData, id: orderId! },
                  items: itemsWithServices,
                  replyTo: 'info@myacc.co.za'
              }));

              await sendEmail({
                  to: recipientEmail,
                  subject: `Action Required for Your Order #${orderId}`,
                  html: emailHtml,
                  resellerId: currentOrderData.resellerId || undefined,
              });

              await updateDoc(orderRef, { 
                  notes: arrayUnion({
                      text: `Sent "Request Documents" email to ${recipientEmail} (Automated via PayFast ITN).`,
                      date: Timestamp.now(),
                      authorId: 'system',
                      type: 'email',
                      subject: `Action Required for Your Order #${orderId}`,
                      attachments: null,
                  }) 
              });
          }

          await updateDoc(orderRef, { 
              itnHistory: arrayUnion({ 
                  status: 'Success', 
                  message: 'Payment verified and order set to Processing.', 
                  receivedAt: Timestamp.now(),
                  payload: data
              }) 
          });
        } else {
          await updateDoc(orderRef, { 
              itnHistory: arrayUnion({ 
                  status: 'Failed', 
                  message: `Payment status was ${data.payment_status}`, 
                  receivedAt: Timestamp.now(),
                  payload: data
              }) 
          });
        }

        return new NextResponse('OK', { status: 200 });
    } catch (error) {
        console.error('Critical ITN Error:', error);
        return new NextResponse('Error', { status: 500 });
    }
}