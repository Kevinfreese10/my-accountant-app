import { NextRequest, NextResponse } from 'next/server';
import { getFirestore, doc, updateDoc, getDoc, collection, query, where, getDocs, arrayUnion, Timestamp, increment, addDoc } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import crypto from 'crypto';
import { ItnLog, Order, OrderStatusHistoryEntry, User, Service } from '@/lib/types';
import ipaddr from 'ipaddr.js';
import { render } from '@react-email/components';
import React from 'react';
import DocumentRequestEmail from '@/components/emails/DocumentRequestEmail';
import { sendEmail } from '@/lib/email';
import { services as allServices } from '@/lib/data';
import { getPayFastConfig } from '@/lib/payfast';

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
    let ipStr = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || (req as any).ip;
    
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
 * Verifies the PayFast signature by processing the RAW body string in a timing-safe manner.
 */
function verifyPayFastSignature(rawBody: string, receivedSignature: string, passphrase?: string): boolean {
    if (!receivedSignature) return false;

    const params = rawBody.split('&');
    let signatureString = '';

    for (const param of params) {
        const eqIndex = param.indexOf('=');
        if (eqIndex === -1) continue;
        const key = param.substring(0, eqIndex);
        const value = param.substring(eqIndex + 1);

        if (key === 'signature') continue;

        // Skip blank / empty values, complying with official PayFast signature guidelines
        if (!value || value.trim() === '') continue;

        signatureString += `${key}=${value}&`;
    }

    // Remove trailing ampersand
    let finalString = signatureString.slice(0, -1);
    
    if (passphrase) {
        // Passphrase must be encoded exactly as PayFast expects (standard urlencode)
        const encodedPassphrase = encodeURIComponent(passphrase.trim()).replace(/%20/g, '+');
        finalString += `&passphrase=${encodedPassphrase}`;
    }

    const calculatedSignature = crypto.createHash('md5').update(finalString).digest('hex');
    
    try {
        const calculatedBuf = Buffer.from(calculatedSignature, 'hex');
        const receivedBuf = Buffer.from(receivedSignature, 'hex');
        
        if (calculatedBuf.length !== receivedBuf.length) {
            return false;
        }
        return crypto.timingSafeEqual(calculatedBuf, receivedBuf);
    } catch (e) {
        console.error('ITN Signature timing-safe verification error:', e);
        return false;
    }
}

/**
 * Validates the authenticity of the payload by querying PayFast directly (POST postback validation).
 */
async function validateWithPayFast(rawBody: string): Promise<boolean> {
    try {
        const { isProduction } = getPayFastConfig();
        const host = isProduction ? 'www.payfast.co.za' : 'sandbox.payfast.co.za';
        const url = `https://${host}/eng/query/validate`;
        
        console.log(`ITN Validation: Performing postback to ${url}`);
        
        const response = await fetch(url, {
            method: 'POST',
            body: rawBody,
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
        });
        
        const responseText = await response.text();
        console.log(`ITN Validation response from PayFast: ${responseText}`);
        return responseText.trim() === 'VALID';
    } catch (error) {
        console.error('ITN Validation postback failed:', error);
        return false;
    }
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

        // Find the order — use direct document lookup (orderId IS the Firestore document ID)
        const orderRef = doc(db, 'orders', orderId);
        const orderSnap = await getDoc(orderRef);

        if (!orderSnap.exists()) {
            console.error(`Order ${orderId} not found.`);
            return new NextResponse('OK', { status: 200 });
        }
        
        const currentOrderData = orderSnap.data() as Order;

        // Idempotency: Ignore if already processed
        if (currentOrderData.status !== 'Pending Payment') {
            console.log(`ITN Info: Order ${orderId} already processed (Status: ${currentOrderData.status}).`);
            return new NextResponse('OK', { status: 200 });
        }

        // 2. Validation: Try timing-safe local signature verification first.
        // If it fails, fall back to secure, official PayFast postback validation.
        const isValidSignature = verifyPayFastSignature(rawBody, data.signature, process.env.PAYFAST_PASSPHRASE);
        let isAuthentic = false;

        if (isValidSignature) {
            console.log(`ITN Success: Local signature verified successfully for order ${orderId}.`);
            isAuthentic = true;
        } else {
            console.warn(`ITN Warning: Local signature verification failed for order ${orderId}. Attempting secure postback validation fallback...`);
            isAuthentic = await validateWithPayFast(rawBody);
            if (isAuthentic) {
                console.log(`ITN Success: Postback validation verified successfully for order ${orderId}.`);
            }
        }

        if (!isAuthentic) {
            console.error('ITN Error: Validation failed both locally and via postback for order:', orderId);
            await updateDoc(orderRef, { 
                itnHistory: arrayUnion({ 
                    status: 'Failed', 
                    message: `ITN validation failed. Local signature mismatch and postback validation returned INVALID. Received signature: ${data.signature}`, 
                    receivedAt: Timestamp.now(),
                    payload: data
                }) 
            });
            return new NextResponse('Validation failed', { status: 400 });
        }

        // 4. Merchant ID Verification
        const { merchantId: fallbackMerchantId } = getPayFastConfig();
        const expectedMerchantId = process.env.PAYFAST_MERCHANT_ID || process.env.NEXT_PUBLIC_PAYFAST_MERCHANT_ID || fallbackMerchantId;
        if (expectedMerchantId && data.merchant_id && data.merchant_id.trim() !== expectedMerchantId.trim()) {
            console.error(`Merchant ID mismatch. Expected: ${expectedMerchantId}, Got: ${data.merchant_id}`);
            await updateDoc(orderRef, { 
                itnHistory: arrayUnion({ 
                    status: 'Failed', 
                    message: `Merchant ID mismatch. Expected ${expectedMerchantId}, got ${data.merchant_id}`, 
                    receivedAt: Timestamp.now(),
                    payload: data
                }) 
            });
            return new NextResponse('Merchant ID mismatch', { status: 400 });
        }
        
        // 5. Amount Validation
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

        // 6. Update Order Status & Automate Assignment/Tasks
        if (data.payment_status === 'COMPLETE') {
          // Handle Round-Robin / Load-Balancing Assignment if not assigned yet
          let assignedStaffIds: string[] = currentOrderData.assignedTo || [];
          
          const isSetup = currentOrderData.items.some(i => i.id === 'partner_setup_fee');
          const isTopup = currentOrderData.items.some(i => i.id === 'partner_credit_topup');

          if (!isSetup && !isTopup && !assignedStaffIds.length) {
              const department = currentOrderData.department;
              if (department) {
                  const staffQuery = query(
                      collection(db, "users"),
                      where('role', '==', 'staff'),
                      where('department', '==', department)
                  );
                  const staffSnapshot = await getDocs(staffQuery);
                  
                  if (!staffSnapshot.empty) {
                      let selectedStaff = staffSnapshot.docs[0];
                      let minTasks = Infinity;
                      
                      for (const staffDoc of staffSnapshot.docs) {
                          const tasksQuery = query(
                              collection(db, 'tasks'),
                              where('assignedTo', 'array-contains', staffDoc.id),
                              where('status', '!=', 'Done')
                          );
                          const tasksSnapshot = await getDocs(tasksQuery);
                          if (tasksSnapshot.size < minTasks) {
                              minTasks = tasksSnapshot.size;
                              selectedStaff = staffDoc;
                          }
                      }
                      
                      assignedStaffIds = [selectedStaff.id];
                  }
              }
          }

          // Automatically set status to "Processing" (Paid)
          const itnHistoryEntry: OrderStatusHistoryEntry = {
              status: 'Processing',
              changedAt: Timestamp.now(),
              changedBy: 'payfast_itn',
              changedByName: 'PayFast ITN (Automatic)',
              notes: `Payment of R${data.amount_gross} verified via PayFast ITN. Order automatically set to Processing.`,
          };

          await updateDoc(orderRef, { 
              status: 'Processing',
              assignedTo: assignedStaffIds.length ? assignedStaffIds : null,
              statusHistory: arrayUnion(itnHistoryEntry),
          });

          // Sync status to original customer order if outsourced
          if (currentOrderData.originalOrderId) {
              const originalRef = doc(db, 'orders', currentOrderData.originalOrderId);
              await updateDoc(originalRef, { 
                  status: 'Processing',
                  statusHistory: arrayUnion(itnHistoryEntry),
              });
          }

          // Automatically generate task for assigned staff member
          if (assignedStaffIds.length) {
              const taskData = {
                  title: `Process Order: ${orderId}`,
                  description: `Fulfill the services for order ${orderId}. Services include: ${currentOrderData.items.map((i: any) => i.title).join(', ')}.`,
                  assignedTo: assignedStaffIds,
                  createdBy: 'system',
                  dueDate: Timestamp.fromDate(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)), // 7 days from now
                  priority: 'Medium',
                  status: 'To-Do',
                  orderId: orderId,
                  comments: [],
              };
              await addDoc(collection(db, 'tasks'), taskData);
          }
          
          // Handle Partner Credit Top-ups & Setup Fees
          if (isSetup || isTopup) {
              const partnerId = currentOrderData.resellerId || currentOrderData.userId;
              if (partnerId) {
                  const partnerRef = doc(db, 'users', partnerId);
                  // Setup logic: R4950 setup adds R2475 (50%) to wallet
                  const creditAmount = isSetup ? 2475 : currentOrderData.total;
                  await updateDoc(partnerRef, {
                      creditBalance: increment(creditAmount),
                      status: 'Active'
                  });
              }
          }

          // 7. Send Document Request Email (Automated)
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
                  message: 'Payment verified and order automatically set to Processing (Paid) with staff and tasks assigned.', 
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
