
import { NextRequest, NextResponse } from 'next/server';
import imaps from 'imap-simple';
import { simpleParser } from 'mailparser';

export const dynamic = 'force-dynamic'

const config = {
    imap: {
        user: 'info@myacc.co.za',
        password: 'KhaiFreese10$',
        host: 'mail.myacc.co.za',
        port: 993,
        tls: true,
        authTimeout: 10000,
        tlsOptions: {
            rejectUnauthorized: false
        }
    },
};

async function fetchUnseenEmails() {
    try {
        const connection = await imaps.connect(config);
        await connection.openBox('INBOX');

        const searchCriteria = ['UNSEEN'];
        const fetchOptions = {
            bodies: ['HEADER.FIELDS (FROM SUBJECT DATE)', 'TEXT'],
            markSeen: false,
        };

        const messages = await connection.search(searchCriteria, fetchOptions);
        connection.end();

        const emails = await Promise.all(
            messages.map(async (item) => {
                const all = item.parts.find(part => part.which === 'TEXT');
                const header = item.parts.find(part => part.which === 'HEADER.FIELDS (FROM SUBJECT DATE)');

                const parsedMail = await simpleParser(`From: ${header?.body.from[0]}\r\nSubject: ${header?.body.subject[0]}\r\nDate: ${header?.body.date[0]}\r\n\r\n${all?.body}`);
                
                return {
                    uid: item.attributes.uid,
                    from: parsedMail.from?.text || 'N/A',
                    subject: parsedMail.subject || 'No Subject',
                    body: parsedMail.text || '',
                    date: parsedMail.date?.toISOString() || new Date().toISOString(),
                };
            })
        );
        return emails.reverse();
    } catch (error) {
        console.error('IMAP Connection Error:', error);
        throw new Error('Failed to connect to IMAP server.');
    }
}

export async function GET(req: NextRequest) {
    try {
        const emails = await fetchUnseenEmails();
        return NextResponse.json({ emails });
    } catch (error: any) {
        return new NextResponse(JSON.stringify({ error: error.message }), { status: 500 });
    }
}
