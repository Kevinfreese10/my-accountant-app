'use server';
/**
 * @fileOverview AI agent for generating social media advertising content.
 * 
 * - generateSocialAds - Creates high-converting Facebook ad copy for products.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const AdInputSchema = z.object({
  productName: z.string(),
  price: z.number(),
  turnaroundTime: z.string(),
  description: z.string(),
  category: z.string(),
  url: z.string(),
});

const SocialAdInputSchema = z.object({
  products: z.array(AdInputSchema).describe('List of products to generate ads for.'),
  tone: z.enum(['professional', 'friendly', 'urgent', 'educational']).default('professional'),
});
export type SocialAdInput = z.infer<typeof SocialAdInputSchema>;

const AdVariantSchema = z.object({
  productId: z.string(),
  hook: z.string().describe('A catchy opening line to stop the scroll.'),
  body: z.string().describe('The main ad copy, highlighting benefits and pain points.'),
  cta: z.string().describe('A clear call to action.'),
  hashtags: z.string().describe('Relevant hashtags for searchability.'),
});

const SocialAdOutputSchema = z.object({
  ads: z.array(AdVariantSchema),
});
export type SocialAdOutput = z.infer<typeof SocialAdOutputSchema>;

export async function generateSocialAds(input: SocialAdInput): Promise<SocialAdOutput> {
  return generateSocialAdFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateSocialAdPrompt',
  model: 'googleai/gemini-2.5-flash',
  input: { schema: SocialAdInputSchema },
  output: { schema: SocialAdOutputSchema },
  prompt: `You are an expert social media copywriter specializing in Facebook ads for the South African accounting and tax industry.
  
  Your goal is to generate high-converting ad copy for the following products. 
  The tone should be: {{{tone}}}.
  
  **INSTRUCTIONS**:
  1. **Hook**: Start with a relatable pain point or a bold statement (e.g., "Tired of SARS deadlines?" or "Did you know 70% of SMEs pay too much tax?").
  2. **Body**: Briefly explain how the service solves the problem. Focus on benefits like "Peace of Mind," "Saving Time," and "Compliance." Use emojis effectively.
  3. **Mandatory Info**: You MUST explicitly mention the price and the turnaround time immediately after the hook (at the very start of the body text). You must also include the direct product link within the ad copy text.
  4. **CTA**: Provide a clear call to action that directs users to the provided URL.
  5. **Context**: Use South African terminology (SARS, CIPC, Pty Ltd, etc.).
  
  **PRODUCTS TO ADVERTISE**:
  {{#each products}}
  - Product: "{{this.productName}}"
  - Price: R{{this.price}}
  - Turnaround: {{this.turnaroundTime}}
  - Link: {{{this.url}}}
  - Description: "{{this.description}}"
  ---
  {{/each}}
  
  Return a list of ads, one for each product.`,
});

const generateSocialAdFlow = ai.defineFlow(
  {
    name: 'generateSocialAdFlow',
    inputSchema: SocialAdInputSchema,
    outputSchema: SocialAdOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    return output!;
  }
);
