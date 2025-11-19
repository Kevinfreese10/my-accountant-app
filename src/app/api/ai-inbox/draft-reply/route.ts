
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
        
        const clientName = email.from.split('<')[0].trim().split(' ')[0] || 'there';

        // Format the Q&A answer into a more email-friendly format.
        const finalDraft = `Hi ${clientName},\n\nThank you for your email.\n\n${qaResponse.answer}\n\nKind regards,\nWinifred Beukes\nExecutive Assistant to Kevin Freese`;

        return NextResponse.json({ draft: finalDraft });

    } catch (error: any) {
        console.error('Error drafting email reply:', error);
        return NextResponse.json({ error: `An unexpected error occurred during draft generation: ${error.message}` }, { status: 500 });
    }
}
