
'use server';
/**
 * @fileOverview An AI agent for generating full blog post content.
 * 
 * - generateBlogPost - A function that creates content for a blog post based on its title.
 * - GenerateBlogPostInput - The input type for the generateBlogPost function.
 * - GenerateBlogPostOutput - The return type for the generateBlogPostOutput function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateBlogPostInputSchema = z.object({
  primaryKeyword: z.string().describe('The primary keyword and topic for the blog post.'),
  searchIntent: z.enum(['Informational', 'Commercial', 'Transactional']).describe('The search intent for the blog post.'),
});
export type GenerateBlogPostInput = z.infer<typeof GenerateBlogPostInputSchema>;

const GenerateBlogPostOutputSchema = z.object({
  excerpt: z.string().describe('A short, one-paragraph excerpt or summary of the blog post (under 160 characters).'),
  content: z.string().describe('The full blog post content, formatted in clean, well-structured HTML. It must follow the provided SEO framework, including a single H1, multiple H2s and H3s, lists, links, and a call-to-action.'),
});
export type GenerateBlogPostOutput = z.infer<typeof GenerateBlogPostOutputSchema>;

export async function generateBlogPost(
  input: GenerateBlogPostInput
): Promise<GenerateBlogPostOutput> {
  return generateBlogPostFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateBlogPostPrompt',
  input: {schema: GenerateBlogPostInputSchema},
  output: {schema: GenerateBlogPostOutputSchema},
  prompt: `You are an expert copywriter and SEO specialist for "My Accountant", a financial services company in South Africa. Your audience consists of individuals and SMEs.

  Your task is to write a complete, engaging, and informative blog post based on the provided primary keyword and search intent. You must strictly adhere to the following SEO-first framework:

  **1. Foundation (From Keyword & Intent):**
  - The Primary Keyword is: \`{{{primaryKeyword}}}\`.
  - The Search Intent is \`{{{searchIntent}}}\`. You must write the content to match this intent.
    - Informational: Explain a topic, answer a question (e.g., "What is...?").
    - Commercial: Compare services, provide reviews, guide a decision (e.g., "Best service for...").
    - Transactional: Encourage a specific action, like buying a service (e.g., "Register online now").

  **2. Headings Structure (Critical):**
  - **H1:** Create a single, compelling H1 tag that includes the primary keyword. It should be similar to the post title but not identical.
  - **H2 & H3:** Structure the article logically using multiple H2 and H3 tags. Use secondary keywords and answer user questions within these headings. For example: "Who Must Register?", "Registration Requirements", "Common Mistakes".

  **3. Content Quality & Depth (Most Important):**
  - **Length:** Aim for 800–2,000 words, depending on the topic's complexity.
  - **Content:** Write original, expert-level content. Be the authority on the topic. Your tone must be professional, helpful, and clear for a non-expert.
  - **Answer Key Questions:** Your content must address: What, Why, Who, How, Cost, and common mistakes related to the topic.
  - **Formatting:** Use paragraphs (<p>), bulleted lists (<ul>), and numbered lists (<ol>) to make the content easy to read. Avoid keyword stuffing.

  **4. Internal & External Linking:**
  - **Internal Links:** Where relevant, include placeholder links to other services or pages. Format them as: \`<a href="/products/service-slug">Service Name</a>\`. Use descriptive anchor text. For example: "Learn more about our <a href="/products/vat-registration-service">VAT Registration Service</a>." Include 3-8 internal links.
  - **External Links:** Link to authoritative sources like SARS. Format them as: \`<a href="https://www.sars.gov.za/...">SARS guidelines</a>\`.

  **5. Call-to-Action (CTA):**
  - Every post must end with a clear call-to-action that guides the user to a relevant next step. Examples:
    - "Ready to register your company? <a href="/products/company-registration">Get started with our Company Registration service today</a>."
    - "Unsure about your compliance status? <a href="/compliance">Get a free SARS compliance check</a>."

  **6. Final Output:**
  - **Excerpt:** A short, compelling one-paragraph summary of the article (under 160 characters).
  - **Content:** The full blog post, formatted in clean HTML, following all the rules above.

  **Primary Keyword:** {{{primaryKeyword}}}
  **Search Intent:** {{{searchIntent}}}
  `,
});

const generateBlogPostFlow = ai.defineFlow(
  {
    name: 'generateBlogPostFlow',
    inputSchema: GenerateBlogPostInputSchema,
    outputSchema: GenerateBlogPostOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);

