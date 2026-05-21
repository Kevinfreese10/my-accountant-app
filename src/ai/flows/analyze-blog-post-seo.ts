'use server';
/**
 * @fileOverview An AI agent for analyzing blog post SEO.
 * 
 * - analyzeBlogPostSeo - A function that analyzes a blog post against an SEO checklist.
 * - AnalyzeBlogPostSeoInput - The input type for the analyzeBlogPostSeo function.
 * - AnalyzeBlogPostSeoOutput - The return type for the analyzeBlogPostSeo function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const AnalyzeBlogPostSeoInputSchema = z.object({
  title: z.string().describe('The title of the blog post.'),
  content: z.string().describe('The full HTML content of the blog post.'),
  metaTitle: z.string().optional().describe('The meta title of the post.'),
  metaDescription: z.string().optional().describe('The meta description of the post.'),
  url: z.string().optional().describe('The URL slug of the post.'),
  imageUrl: z.string().optional().describe('The main image URL for the post.'),
});
export type AnalyzeBlogPostSeoInput = z.infer<typeof AnalyzeBlogPostSeoInputSchema>;

const SeoChecklistItemSchema = z.object({
  pass: z.boolean().describe("Whether the check passed (true) or failed (false)."),
  feedback: z.string().describe("A concise, one-sentence explanation for the result. E.g., 'The title is under 60 characters.' or 'The meta description is too long.'"),
});

const AnalyzeBlogPostSeoOutputSchema = z.object({
    keywordAndIntent: z.object({
        primaryKeyword: SeoChecklistItemSchema,
        searchIntent: SeoChecklistItemSchema,
        supportingKeywords: SeoChecklistItemSchema,
    }),
    metadata: z.object({
        title: SeoChecklistItemSchema,
        metaDescription: SeoChecklistItemSchema,
        url: SeoChecklistItemSchema,
    }),
    structure: z.object({
        h1: SeoChecklistItemSchema,
        headings: SeoChecklistItemSchema,
    }),
    content: z.object({
        originality: SeoChecklistItemSchema,
        length: SeoChecklistItemSchema,
        formatting: SeoChecklistItemSchema,
    }),
    links: z.object({
        internal: SeoChecklistItemSchema,
        external: SeoChecklistItemSchema,
    }),
    media: z.object({
        optimization: SeoChecklistItemSchema,
    }),
    technical: z.object({
        mobileFriendly: SeoChecklistItemSchema,
        fastLoading: SeoChecklistItemSchema,
        indexable: SeoChecklistItemSchema,
    }),
    trust: z.object({
        authorCredibility: SeoChecklistItemSchema,
        cta: SeoChecklistItemSchema,
    }),
});
export type AnalyzeBlogPostSeoOutput = z.infer<typeof AnalyzeBlogPostSeoOutputSchema>;

export async function analyzeBlogPostSeo(
  input: AnalyzeBlogPostSeoInput
): Promise<AnalyzeBlogPostSeoOutput> {
  return analyzeBlogPostSeoFlow(input);
}

const prompt = ai.definePrompt({
  name: 'analyzeBlogPostSeoPrompt',
  model: 'googleai/gemini-3.5-flash',
  input: {schema: AnalyzeBlogPostSeoInputSchema},
  output: {schema: AnalyzeBlogPostSeoOutputSchema},
  prompt: `You are an expert SEO analyst. Your task is to analyze a blog post based on a provided checklist and return a structured report. For each item, you must determine if it passes and provide brief, specific feedback.

**Blog Post Details:**
- **Title:** {{{title}}}
- **URL Slug:** {{{url}}}
- **Meta Title:** {{{metaTitle}}}
- **Meta Description:** {{{metaDescription}}}
- **Image URL:** {{{imageUrl}}}
- **Content (HTML):** {{{content}}}

**SEO CHECKLIST & INSTRUCTIONS:**

**1. Keyword & Intent:**
   - **Primary Keyword:** Determine if a clear primary keyword is present in the title and H1. Assume the main topic is the primary keyword.
   - **Search Intent:** Assess if the content clearly matches an Informational, Commercial, or Transactional intent.
   - **Supporting Keywords:** Check if the content uses related phrases, synonyms, or long-tail keywords.

**2. Metadata:**
   - **Title:** Check if the meta title length is less than or equal to 60 characters.
   - **Meta Description:** Check if the meta description length is between 140 and 160 characters.
   - **URL:** Check if the URL is short, lowercase, and uses hyphens.

**3. Structure:**
   - **H1:** Verify there is exactly one \`<h1>\` tag in the content.
   - **Headings:** Check for a logical structure using \`<h2>\` and \`<h3>\` tags.

**4. Content:**
   - **Originality:** Based on the text, give a general assessment of its originality. You can assume it is original unless it's obviously generic boilerplate.
   - **Length:** Check if the word count is over 800 words.
   - **Formatting:** Verify the use of lists (\`<ul>\`, \`<ol>\`) or tables (\`<table>\`).

**5. Links:**
   - **Internal Links:** Check if there are any internal links (href starting with '/').
   - **External Links:** Check if there are any external links (href starting with 'http').

**6. Media:**
   - **Optimization:** Check if the \`<img>\` tag exists. Assume it is optimized and has ALT text for this analysis.

**7. Technical:**
   - **Mobile-Friendly:** Assume 'true'. This cannot be determined from text alone.
   - **Fast Loading:** Assume 'true'. This cannot be determined from text alone.
   - **Indexable:** Assume 'true'. This cannot be determined from text alone.

**8. Trust & Conversion:**
   - **Author Credibility:** Assume 'true' as the author is always specified.
   - **CTA:** Check if there is a clear call-to-action link, typically near the end of the content.

For each check, provide a boolean 'pass' status and a very short feedback string.
`,
});

const analyzeBlogPostSeoFlow = ai.defineFlow(
  {
    name: 'analyzeBlogPostSeoFlow',
    inputSchema: AnalyzeBlogPostSeoInputSchema,
    outputSchema: AnalyzeBlogPostSeoOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
