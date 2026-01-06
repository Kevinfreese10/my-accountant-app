
import { NextRequest, NextResponse } from 'next/server';
import { getFirestore, doc, setDoc, getDoc } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { firebaseApp } from '@/lib/firebase';
import { User, ProcessedEmail } from '@/lib/types';
import imaps from 'imap-simple';
import { simpleParser } from 'mailparser';
import crypto from 'crypto';

const db = getFirestore(firebaseApp);
const auth = getAuth(firebaseApp);

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
            imap: {
                user: userData.imapDetails?.user || '',
                password: userData.imapDetails?.pass || '',
                host: userData.imapDetails?.host || '',
                port: Number(userData.imapDetails?.port) || 993,
                tls: true,
                authTimeout: 3000
            }
        };

        const connection = await imaps.connect(imapConfig);
        await connection.openBox('INBOX');

        // Fetch last 10 emails for demonstration purposes
        const searchCriteria = ['ALL'];
        const fetchOptions = {
            bodies: ['HEADER.FIELDS (FROM TO SUBJECT DATE MESSAGE-ID)', 'TEXT'],
            struct: true,
        };
        
        const messages = await connection.search(searchCriteria, fetchOptions);

        for (const item of messages) {
            const all = item.parts.find(part => part.which === 'TEXT');
            const headers = item.parts.find(part => part.which === 'HEADER.FIELDS (FROM TO SUBJECT DATE MESSAGE-ID)');
            const parsedMail = await simpleParser(headers!.body + all!.body);

            const messageId = parsedMail.messageId || `no-id-${item.attributes.uid}`;
            const idHash = crypto.createHash('sha256').update(messageId).digest('hex');
            
            const emailDocRef = doc(db, 'processedEmails', idHash);

            const emailData: Omit<ProcessedEmail, 'id'> = {
                uid: item.attributes.uid,
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

            await setDoc(emailDocRef, emailData, { merge: true });
        }

        connection.end();

        return NextResponse.json({ success: true, message: `Fetched ${messages.length} emails.` });

    } catch (error: any) {
        console.error('Email fetch error:', error);
        return NextResponse.json(
            { error: 'Failed to fetch emails.', details: error.message },
            { status: 500 }
        );
    }
}
