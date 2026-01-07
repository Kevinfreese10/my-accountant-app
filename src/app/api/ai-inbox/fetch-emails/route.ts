
import { NextRequest, NextResponse } from 'next/server';
import { getFirestore, doc, setDoc, getDoc, Timestamp, collection, where, query } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { User, ProcessedEmail } from '@/lib/types';
import imaps from 'imap-simple';
import { simpleParser } from 'mailparser';
import { subDays, format } from 'date-fns';
import { SHA256 } from 'crypto-js';
import { categorizeSupportRequest } from '@/ai/flows/categorize-support-requests';

const db = getFirestore(firebaseApp);

// Firestore's 1MiB limit, with a small buffer.
const MAX_FIELD_SIZE = 1048000;

// Function to safely extract attachments
const getAttachments = async (attachments: any[]): Promise<any[]> => {
    return Promise.all(attachments.map(async (attachment) => {
        const dataUrl = attachment.content ? `data:${attachment.contentType || 'application/octet-stream'};base64,${attachment.content.toString('base64')}` : '';
        return {
            filename: attachment.filename || '',
            contentType: attachment.contentType || '',
            dataUrl: dataUrl,
            size: attachment.size || 0,
        };
    }));
};

export async function POST(req: NextRequest) {
    try {
        const { userId } = await req.json();
        if (!userId) {
            return NextResponse.json({ error: 'User ID is required.' }, { status: 400 });
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

            if (docSnap.exists() && docSnap.data().status !== 'new') {
                continue;
            }

            const attachments = parsedMail.attachments ? await getAttachments(parsedMail.attachments) : [];
            
            let htmlContent = '';
            if (typeof parsedMail.html === 'string') {
                // Check if the html content exceeds Firestore's limit
                if (new Blob([parsedMail.html]).size > MAX_FIELD_SIZE) {
                    htmlContent = ''; // Set to empty if too large
                } else {
                    htmlContent = parsedMail.html;
                }
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
                status: 'new', // Default status
                ownerId: userId,
                attachments: attachments, // Save attachments with dataUrl
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

        return NextResponse.json({ success: true, message: `Synced ${count} emails from the last 7 days.` });

    } catch (error: any) {
        console.error('Email fetch API error:', error);
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
