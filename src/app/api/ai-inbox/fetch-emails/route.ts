
import { NextRequest, NextResponse } from 'next/server';
import { getFirestore, doc, setDoc, getDoc, Timestamp } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { User, ProcessedEmail } from '@/lib/types';
import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import { subDays, format } from 'date-fns';
import { SHA256 } from 'crypto-js';
import { categorizeSupportRequest } from '@/ai/flows/categorize-support-requests';

const db = getFirestore(firebaseApp);

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
        const imapConfig = {
            host: userData.imapDetails?.host || '',
            port: Number(userData.imapDetails?.port) || 993,
            secure: userData.imapDetails?.secure === undefined ? true : userData.imapDetails.secure,
            auth: {
                user: userData.imapDetails?.user || '',
                pass: userData.imapDetails?.pass || '',
            },
            logger: false, // Set to true for verbose debugging
        };

        const client = new ImapFlow(imapConfig);
        await client.connect();

        let lock = await client.getMailboxLock('INBOX');
        let count = 0;
        try {
            const sinceDate = subDays(new Date(), 7);
            const searchCriteria = { since: format(sinceDate, 'yyyy-MM-dd') };

            for await (let msg of client.fetch(searchCriteria, { envelope: true, source: true, uid: true, bodyStructure: true })) {
                const parsedMail = await simpleParser(msg.source);
                const messageId = parsedMail.messageId || `${msg.envelope.date?.toISOString()}-${msg.envelope.from?.[0]?.address}`;
                const idHash = SHA256(messageId).toString();
                
                const emailDocRef = doc(db, 'processedEmails', idHash);
                const docSnap = await getDoc(emailDocRef);

                // Skip if email has been processed before, unless it's a new email
                if (docSnap.exists() && docSnap.data().status !== 'new') {
                    continue;
                }
                
                const emailData: Omit<ProcessedEmail, 'id'> = {
                    uid: msg.uid,
                    messageId: messageId,
                    mailbox: 'INBOX',
                    date: parsedMail.date ? Timestamp.fromDate(parsedMail.date) : Timestamp.now(),
                    from: { name: parsedMail.from?.value[0]?.name || '', address: parsedMail.from?.value[0]?.address || '' },
                    to: parsedMail.to?.value.map(t => ({ name: t.name, address: t.address || '' })) || [],
                    subject: parsedMail.subject || '',
                    snippet: parsedMail.text?.substring(0, 150) || '',
                    text: parsedMail.text || '',
                    html: typeof parsedMail.html === 'string' ? parsedMail.html : '',
                    status: 'new',
                    ownerId: userId,
                };
                
                // Call AI categorization flow
                try {
                    const aiResult = await categorizeSupportRequest({
                        request: `${parsedMail.subject || ''}\n\n${parsedMail.text || ''}`,
                        clientName: parsedMail.from?.value[0]?.name || parsedMail.from?.value[0]?.address || 'Unknown Sender',
                        attachments: parsedMail.attachments?.map(att => ({
                            filename: att.filename || null,
                            contentType: att.contentType || null,
                            dataUrl: `data:${att.contentType};base64,${att.content.toString('base64')}`,
                            size: att.size,
                        })) || []
                    });

                    emailData.aiSummary = aiResult.summary;
                    emailData.aiCategory = aiResult.category;
                    emailData.aiPriority = aiResult.priority;
                    emailData.aiSuggestedAction = aiResult.suggestedAction;
                    if(aiResult.task?.shouldCreate) {
                        emailData.aiTask = {
                            title: aiResult.task.title || 'Untitled Task',
                            description: aiResult.task.description || 'No description provided.',
                        }
                    }

                } catch(aiError) {
                    console.error(`AI categorization failed for email ${messageId}:`, aiError);
                    // Continue without AI data if it fails
                }

                await setDoc(emailDocRef, emailData, { merge: true });
                count++;
            }
        } finally {
            lock.release();
        }

        await client.logout();

        return NextResponse.json({ success: true, message: `Synced ${count} emails from the last 7 days.` });

    } catch (error: any) {
        console.error('Email fetch API error:', error);
        return NextResponse.json(
            { error: 'Failed to fetch emails.', details: error.message || 'An unknown error occurred.' },
            { status: 500 }
        );
    }
}
