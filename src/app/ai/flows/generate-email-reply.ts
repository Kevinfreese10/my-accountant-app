
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
        input: { schema: GenerateEmailReplyInputSchema },
        output: { schema: GenerateEmailReplyOutputSchema },
        prompt: `You are an expert administrative assistant for an accounting firm called "My Accountant". Your name is Winifred Beukes.

        Your task is to draft a professional and helpful reply to the following email.
        - Your tone should be friendly, professional, and reassuring.
        - Address the sender by their name if it's available.
        - Directly address the main point of their email.
        
        CRITICAL INSTRUCTION: If the user is asking about a specific service (like 'VAT Registration' or 'Company Registration'), you MUST find that service in the CONTEXT provided below. Your reply MUST state the exact price, turnaround time, and ALL prerequisites for that service, formatted clearly for the user. Do NOT ask for more information or offer to discuss it further if the details are in the context. Be direct and provide the answer.

        - If they are asking a general question, try to find an answer in the CONTEXT.
        - If they are sending documents, acknowledge receipt.
        - Keep the reply concise.
        - End with a friendly closing (e.g., "Kind regards,") followed by your name "Winifred Beukes" and your title "Executive Assistant to Kevin Freese".

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
