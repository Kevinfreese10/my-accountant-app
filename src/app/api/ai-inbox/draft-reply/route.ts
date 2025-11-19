
import { NextResponse } from 'next/server';
import { websiteQAndA } from '@/ai/flows/website-q-and-a';

export async function POST(req: Request) {
    const { email } = await req.json();

    if (!email || !email.subject || !email.body || !email.from) {
        return NextResponse.json({ error: 'Missing or invalid email data.' }, { status: 400 });
    }

    try {
        const qaResponse = await websiteQAndA({
            question: `Subject: ${email.subject}\nBody: ${email.body}`,
            history: [],
        });
        
        const clientName = email.from.replace(/"/g, '').split('<')[0].trim().split(' ')[0] || 'there';

        let finalDraft = `Hi ${clientName},\n\nThank you for your email.\n\n${qaResponse.answer}`;

        if (qaResponse.serviceUrl) {
            const fullUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://www.myacc.co.za'}${qaResponse.serviceUrl}`;
            finalDraft += `\n\nYou can view and purchase this service directly from our website here: ${fullUrl}`;
        }
        
        finalDraft += `\n\nKind regards,\nWinifred Beukes\nExecutive Assistant to Kevin Freese`;

        return NextResponse.json({ draft: finalDraft });

    } catch (error: any) {
        console.error('Error drafting email reply:', error);
        return NextResponse.json({ error: `An unexpected error occurred during draft generation: ${error.message}` }, { status: 500 });
    }
}
