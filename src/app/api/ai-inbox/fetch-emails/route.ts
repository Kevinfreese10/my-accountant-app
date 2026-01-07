
import { NextRequest, NextResponse } from 'next/server';
import { getFirestore, doc, setDoc, getDoc, Timestamp, collection, where, query, updateDoc, getDocs } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { User, ProcessedEmail } from '@/lib/types';
import imaps from 'imap-simple';
import { simpleParser } from 'mailparser';
import { subDays, format } from 'date-fns';
import { SHA256 } from 'crypto-js';
import { categorizeSupportRequest } from '@/ai/flows/categorize-support-requests';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';

const db = getFirestore(firebaseApp);
const storage = getStorage(firebaseApp);

// Function to safely extract attachments by uploading them to Cloud Storage
const getAttachments = async (attachments: any[], userId: string, emailId: string): Promise<any[]> => {
    return Promise.all(attachments.map(async (attachment) => {
        let dataUrl = '';

        // Upload any attachment that has content to Cloud Storage
        if (attachment.content) {
            try {
                const uniqueFileName = `${Date.now()}-${attachment.filename || 'attachment'}`;
                const storageRef = ref(storage, `email-attachments/${userId}/${emailId}/${uniqueFileName}`);
                const snapshot = await uploadBytes(storageRef, attachment.content, { contentType: attachment.contentType });
                dataUrl = await getDownloadURL(snapshot.ref);
            } catch (uploadError) {
                console.error(`Failed to upload attachment "${attachment.filename}" to Cloud Storage:`, uploadError);
                dataUrl = ''; // Failsafe
            }
        }
        
        return {
            filename: attachment.filename || null,
            contentType: attachment.contentType || null,
            dataUrl: dataUrl || null,
            size: attachment.size || null,
        };
    }));
};

async function getUserIdFromRequestOrCron(req: NextRequest): Promise<string | null> {
    try {
        const body = await req.json();
        if (body.userId) {
            return body.userId;
        }
    } catch (e) {
        // Body is likely empty, which is expected for a cron job.
    }
    
    // If no userId in body, assume it's a cron job and fetch the default admin user.
    const adminEmail = 'kev@thinkestry.co.za';
    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('email', '==', adminEmail), where('role', '==', 'admin'));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
        console.error("Cron job failed: Default admin user not found.");
        return null;
    }
    
    return querySnapshot.docs[0].id;
}


export async function POST(req: NextRequest) {
    let userId: string | null = null;
    try {
        userId = await getUserIdFromRequestOrCron(req);

        if (!userId) {
            return NextResponse.json({ error: 'User ID could not be determined.' }, { status: 400 });
        }

        const userDocRef = doc(db, 'users', userId);
        const userDoc = await getDoc(userDocRef);

        if (!userDoc.exists() || !userDoc.data()?.imapDetails) {
            return NextResponse.json({ error: 'IMAP settings not found for this user.' }, { status: 404 });
        }

        const userData = userDoc.data() as User;
        const imapConfig: imaps.ImapSimpleOptions = {
            imap: {
                user: userData.imapDetails?.user || '',
                password: userData.imapDetails?.pass || '',
                host: userData.imapDetails?.host || '',
                port: Number(userData.imapDetails?.port) || 993,
                tls: userData.imapDetails?.secure === undefined ? true : userData.imapDetails.secure,
                authTimeout: 5000,
                tlsOptions: {
                    rejectUnauthorized: false
                }
            },
        };

        const connection = await imaps.connect(imapConfig);
        await connection.openBox('INBOX');

        let count = 0;
        const sinceDate = subDays(new Date(), 7);
        const searchCriteria = [['SINCE', format(sinceDate, 'yyyy-MM-dd')]];
        const fetchOptions = {
            bodies: ['HEADER.FIELDS (FROM TO SUBJECT DATE MESSAGE-ID)', ''],
            struct: true,
        };

        const messages = await connection.search(searchCriteria, fetchOptions);

        for (const item of messages) {
            const all = item.parts.find(part => part.which === '');
            const id = item.attributes.uid;
            const idHeader = "Imap-Id: " + id + "\r\n";
            const source = idHeader + all?.body;

            const parsedMail = await simpleParser(source);
            const messageId = parsedMail.messageId || `${parsedMail.date?.toISOString()}-${parsedMail.from?.value[0]?.address}`;
            const idHash = SHA256(messageId).toString();
            
            const emailDocRef = doc(db, 'processedEmails', idHash);
            const docSnap = await getDoc(emailDocRef);

            // If it's a PayFast email, process it for order status update
            if (parsedMail.from?.value[0]?.address === 'noreply@payfast.io') {
                const orderIdMatch = parsedMail.text?.match(/Order ID:\s*(\S+)/);
                const orderId = orderIdMatch ? orderIdMatch[1] : null;

                if (orderId) {
                    const orderQuery = query(collection(db, 'orders'), where('id', '==', orderId));
                    const orderSnapshot = await getDocs(orderQuery);
                    if (!orderSnapshot.empty) {
                        const orderDoc = orderSnapshot.docs[0];
                        if (orderDoc.data().status === 'Pending Payment') {
                            await updateDoc(orderDoc.ref, { status: 'Processing' });
                            console.log(`Order ${orderId} status updated to Processing.`);
                        }
                    }
                }
            }

            if (docSnap.exists() && docSnap.data().status !== 'new') {
                continue;
            }

            const attachments = parsedMail.attachments ? await getAttachments(parsedMail.attachments, userId, idHash) : [];
            
            let htmlContent = '';
            if (typeof parsedMail.html === 'string') {
                 htmlContent = parsedMail.html;
            }

            const emailData: Omit<ProcessedEmail, 'id'> = {
                uid: id,
                messageId: messageId,
                mailbox: 'INBOX',
                date: parsedMail.date ? Timestamp.fromDate(parsedMail.date) : Timestamp.now(),
                from: { name: parsedMail.from?.value[0]?.name || '', address: parsedMail.from?.value[0]?.address || '' },
                to: parsedMail.to?.value.map(t => ({ name: t.name, address: t.address || '' })) || [],
                subject: parsedMail.subject || '',
                snippet: parsedMail.text?.substring(0, 150) || '',
                text: parsedMail.text || '',
                html: htmlContent,
                status: 'new',
                ownerId: userId,
                attachments: attachments,
            };

            try {
                const aiResult = await categorizeSupportRequest({
                    request: `${parsedMail.subject || ''}\n\n${parsedMail.text || ''}`,
                    clientName: parsedMail.from?.value[0]?.name || parsedMail.from?.value[0]?.address || 'Unknown Sender',
                    attachments,
                });

                emailData.aiSummary = aiResult.summary;
                emailData.aiCategory = aiResult.category;
                emailData.aiPriority = aiResult.priority;
                emailData.aiSuggestedAction = aiResult.suggestedAction;
                emailData.aiDraftReply = aiResult.draftReply || null;

                if (aiResult.category === 'Spam/Promo') {
                    emailData.status = 'archived';
                }

                if(aiResult.task?.shouldCreate) {
                    emailData.aiTask = {
                        title: aiResult.task.title || 'Untitled Task',
                        description: aiResult.task.description || 'No description provided.',
                    }
                }
            } catch(aiError) {
                console.error(`AI categorization failed for email ${messageId}:`, aiError);
            }

            await setDoc(emailDocRef, emailData, { merge: true });
            count++;
        }

        connection.end();
        
        // After successful sync, update the status document
        const syncStatusRef = doc(db, 'system', 'emailSyncStatus');
        await setDoc(syncStatusRef, { lastSync: Timestamp.now(), status: 'success' }, { merge: true });

        return NextResponse.json({ success: true, message: `Synced ${count} emails from the last 7 days.` });

    } catch (error: any) {
        console.error('Email fetch API error:', error);
        
        if (userId) {
            const syncStatusRef = doc(db, 'system', 'emailSyncStatus');
            await setDoc(syncStatusRef, { lastSync: Timestamp.now(), status: 'error', errorMessage: error.message }, { merge: true });
        }
        
        let errorMessage = 'Failed to fetch emails. Please check your IMAP settings.';
        if (error.code === 'ETIMEDOUT') {
            errorMessage = 'Connection to the email server timed out.';
        } else if (error.message && error.message.includes('ECONNRESET')) {
             errorMessage = 'Connection was reset by the email server.';
        } else if (error.message) {
            errorMessage = error.message;
        }

        return NextResponse.json(
            { error: 'Failed to fetch emails.', details: errorMessage },
            { status: 500 }
        );
    }
}
