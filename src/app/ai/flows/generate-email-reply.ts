'use server';
/**
 * @fileOverview An AI agent for drafting email replies.
 * 
 * - generateEmailReply - A function that drafts a reply to an email.
 * - GenerateEmailReplyInput - The input type for the generateEmailReply function.
 * - GenerateEmailReplyOutput - The return type for the generateEmailReply function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { fetchKnowledgeBase } from '@/lib/knowledge-base';
import { getFirestore, collection, query, orderBy, getDocs } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { Service, BlogPost } from '@/lib/types';

const db = getFirestore(firebaseApp);

const GenerateEmailReplyInputSchema = z.object({
  subject: z.string().describe('The subject of the original email.'),
  body: z.string().describe('The body of the original email.'),
  sender: z.string().describe('The name and/or email of the original sender.'),
});
export type GenerateEmailReplyInput = z.infer<typeof GenerateEmailReplyInputSchema>;

const GenerateEmailReplyOutputSchema = z.object({
  draft: z.string().describe("A professionally written draft reply. It should be helpful, concise, and maintain a friendly but professional tone. It should address the sender's query or comment directly."),
});
export type GenerateEmailReplyOutput = z.infer<typeof GenerateEmailReplyOutputSchema>;

export async function generateEmailReply(
  input: GenerateEmailReplyInput
): Promise<GenerateEmailReplyOutput> {
  return generateEmailReplyFlow(input);
}

const generateEmailReplyFlow = ai.defineFlow(
  {
    name: 'generateEmailReplyFlow',
    inputSchema: GenerateEmailReplyInputSchema,
    outputSchema: GenerateEmailReplyOutputSchema,
  },
  async (input) => {
    
    // Fetch live data from Firestore
    const servicesSnapshot = await getDocs(query(collection(db, 'services'), orderBy('title')));
    const services = servicesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Service));

    const blogPostsSnapshot = await getDocs(query(collection(db, 'blogPosts'), orderBy('date', 'desc')));
    const blogPosts = blogPostsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as BlogPost));
    
    const knowledgeBaseItems = await fetchKnowledgeBase();

    const websiteContent = `
        SERVICES:
        ${services.map(s => `Title: ${s.title}, URL: /services/${s.slug}, Description: ${s.longDescription}, Price: R${s.price}, Turnaround Time: ${s.turnaroundTime}, Prerequisites: ${s.clientRequirements.join(', ')}`).join('\n\n')}

        BLOG POSTS:
        ${blogPosts.map(p => `Title: ${p.title}, Excerpt: ${p.excerpt}`).join('\n\n')}

        KNOWLEDGE BASE:
        ${knowledgeBaseItems.map(item => `Question: ${item.question}, Answer: ${item.answer}`).join('\n\n')}
    `;

    const prompt = ai.definePrompt({
        name: 'generateEmailReplyPrompt',
        model: 'googleai/gemini-3.5-flash',
        input: { schema: GenerateEmailReplyInputSchema },
        output: { schema: GenerateEmailReplyOutputSchema },
        prompt: `You are an expert administrative assistant for an accounting firm called "My Accountant". Your name is Winifred Beukes.

        Your task is to draft a professional and helpful reply to an email.
        
        **CRITICAL INSTRUCTIONS:**
        1.  **NO HTML**: Your entire response MUST be plain text. Do NOT use any HTML tags like <p>, <h3>, <section>, etc.
        2.  **MARKDOWN FORMATTING**: Use Markdown for any formatting. For paragraphs, use double newlines (\n\n). For lists, use a hyphen (-) for each bullet point.
        3.  **STRUCTURE**: The email MUST follow this exact structure:
            - Greeting (e.g., "Hi John,").
            - A single blank line.
            - The main content of the email.
            - A single blank line.
            - The signature, which must be:
                Kind regards,
                Winifred Beukes
                Executive Assistant to Kevin Freese

        **REPLY LOGIC:**
        - Address the sender by their name if it's available.
        - If the user asks about a specific service (like 'VAT Registration' or 'Company Registration'), find that service in the CONTEXT below. Your reply MUST state the exact price, turnaround time, and ALL prerequisites using a Markdown bulleted list. Do NOT ask for more information if the details are in the context. Be direct.
        - If they are asking a general question, use the CONTEXT to find the answer.
        - If they are sending documents, acknowledge receipt.
        - Keep the reply concise.

        CONTEXT:
        ---
        ${websiteContent}
        ---

        **Original Email:**
        **From:** {{{sender}}}
        **Subject:** {{{subject}}}

        **Body:**
        {{{body}}}
        ---
        `,
    });

    const { output } = await prompt(input);
    return output!;
  }
);
