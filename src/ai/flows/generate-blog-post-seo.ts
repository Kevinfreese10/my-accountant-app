'use server';
/**
 * @fileOverview An AI agent for generating blog post SEO content.
 * 
 * - generateBlogPostSeo - A function that creates SEO content for a blog post based on its title and optional content.
 * - GenerateBlogPostSeoInput - The input type for the generateBlogPostSeo function.
 * - GenerateBlogPostSeoOutput - The return type for the generateBlogPostSeo function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateBlogPostSeoInputSchema = z.object({
  title: z.string().describe('The title of the blog post or page.'),
  content: z.string().optional().describe('The full content of the page to analyze for deeper keyword context.'),
});
export type GenerateBlogPostSeoInput = z.infer<typeof GenerateBlogPostSeoInputSchema>;

const GenerateBlogPostSeoOutputSchema = z.object({
  metaTitle: z.string().describe('An SEO-optimized meta title. CRITICAL: It must be under 60 characters.'),
  metaDescription: z.string().describe('An SEO-optimized meta description. CRITICAL: It must be under 160 characters.'),
  metaKeywords: z.array(z.object({ value: z.string() })).describe('A list of 3-5 relevant SEO keywords or keyphrases.'),
});
export type GenerateBlogPostSeoOutput = z.infer<typeof GenerateBlogPostSeoOutputSchema>;

export async function generateBlogPostSeo(
  input: GenerateBlogPostSeoInput
): Promise<GenerateBlogPostSeoOutput> {
  return generateBlogPostSeoFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateBlogPostSeoPrompt',
  model: 'googleai/gemini-2.5-flash',
  input: {schema: GenerateBlogPostSeoInputSchema},
  output: {schema: GenerateBlogPostSeoOutputSchema},
  prompt: `You are an expert copywriter and SEO specialist for "My Accountant", a financial services company in South Africa.

  Your task is to generate compelling SEO content (Title, Description, and Keywords) for a page based on its title and provided content. 
  
  **INSTRUCTIONS**:
  1. Analyze the context: If content is provided, identify the most commercially relevant keywords from the text.
  2. South African Context: Ensure keywords and descriptions use SA spelling (e.g., "VAT Registration", "SME").
  3. Strict Metadata Lengths: 
     - Meta Title MUST be under 60 characters.
     - Meta Description MUST be under 160 characters.

  Page Title: {{{title}}}
  {{#if content}}
  Page Content Context:
  {{{content}}}
  {{/if}}

  Please generate the following content based on these strict guidelines:
  
  **SEO Information (Strict Guidelines):**

  - **Meta Title (Title Tag)**:
    - **Purpose**: The main clickable headline shown in search results.
    - **Rules**:
      - CRITICAL: Must be **under 60 characters**.
      - End with the brand name: " | My Accountant".
    - **Example**: Tax Tips for Freelancers in SA | My Accountant

  - **Meta Description**:
    - **Purpose**: The snippet below the title in search results.
    - **Rules**:
      - CRITICAL: Must be **under 160 characters long**.
      - Make it actionable and compelling.

  - **Meta Keywords**:
    - **Purpose**: For internal reference or other search engines.
    - **Rules**:
      - Provide a list of 3–5 relevant keywords or keyphrases as objects with a "value" property.
  `,
});

const generateBlogPostSeoFlow = ai.defineFlow(
  {
    name: 'generateBlogPostSeoFlow',
    inputSchema: GenerateBlogPostSeoInputSchema,
    outputSchema: GenerateBlogPostSeoOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
