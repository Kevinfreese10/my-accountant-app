
import { NextResponse } from 'next/server';
import { ai } from '@/ai/genkit';
import { z } from 'zod';

const ImproveDraftInputSchema = z.object({
  draft: z.string(),
  query: z.string(),
});

const ImproveDraftOutputSchema = z.object({
  improvedDraft: z.string(),
});

const improveDraftPrompt = ai.definePrompt({
    name: 'improveDraftPrompt',
    input: { schema: ImproveDraftInputSchema },
    output: { schema: ImproveDraftOutputSchema },
    prompt: `You are an expert copy editor for a professional accounting firm. Your task is to take a draft email reply and improve its grammar, tone, and helpfulness.

    **Formatting Rules:**
    - Use paragraphs to separate ideas and make the email easy to read. Do not return a single block of text.
    - If you are requesting information, use a bulleted list for clarity.

    **Tone Rules:**
    - Professional but friendly.
    - Reassuring and helpful.
    - Proactive (e.g., if the user is asking how to do something, tell them what information you need to do it for them).
    
    **CRITICAL INSTRUCTION:** If the original query is about ordering a service, and the draft doesn't already ask for the necessary information, you MUST add a section asking for the client's full name, email, and cell number so an order can be generated for them.

    Original Query: {{{query}}}
    ---
    Original Draft to Improve:
    {{{draft}}}
    ---
    
    Now, provide the improved and well-formatted draft.
    `,
});

export async function POST(req: Request) {
    const { draft, query } = await req.json();

    if (!draft || !query) {
        return NextResponse.json({ error: 'Missing draft or original query.' }, { status: 400 });
    }

    try {
        const { output } = await improveDraftPrompt({ draft, query });
        
        if (!output?.improvedDraft) {
            throw new Error("AI failed to generate an improved draft.");
        }

        return NextResponse.json({ improvedDraft: output.improvedDraft });

    } catch (error: any) {
        console.error('Error improving draft:', error);
        return NextResponse.json({ error: `An unexpected error occurred during draft improvement: ${error.message}` }, { status: 500 });
    }
}
