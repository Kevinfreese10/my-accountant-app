'use server';
/**
 * @fileOverview An AI agent for branding services for a specific partner.
 * 
 * - brandService - A function that re-brands service content and generates SEO metadata.
 * - BrandServiceInput - The input type for the brandService function.
 * - BrandServiceOutput - The return type for the brandService function.
 */

import { z } from 'genkit';

const BrandServiceInputSchema = z.object({
  service: z.any().describe('The global service object to brand.'),
  partnerName: z.string().describe('The name of the partner practice.'),
  apiKey: z.string().describe('The partner\'s Gemini API Key.'),
});
export type BrandServiceInput = z.infer<typeof BrandServiceInputSchema>;

const BrandServiceOutputSchema = z.object({
  title: z.string().describe('The branded service title.'),
  description: z.string().describe('The branded short description.'),
  longDescription: z.string().describe('The branded long description.'),
  metaTitle: z.string().describe('A catchy, branded SEO title under 60 chars.'),
  metaDescription: z.string().describe('A branded, compelling meta description under 160 chars.'),
  metaKeywords: z.array(z.string()).describe('3-5 relevant keywords.'),
});
export type BrandServiceOutput = z.infer<typeof BrandServiceOutputSchema>;

export async function brandService(input: BrandServiceInput): Promise<BrandServiceOutput> {
    const { genkit } = await import('genkit');
    const { googleAI } = await import('@genkit-ai/google-genai');
    
    // Create a custom genkit instance using the partner's provided API key
    const customAi = genkit({
      plugins: [googleAI({ apiKey: input.apiKey })],
    });

    const { output } = await customAi.generate({
      model: 'googleai/gemini-2.5-flash',
      output: { schema: BrandServiceOutputSchema },
      prompt: `You are a professional branding and SEO expert for an accounting practice named "${input.partnerName}".
      
      Your task is to take the provided service details and "re-brand" them for this specific practice.
      
      **STRICT RULES**:
      1. **Branding Swap**: Replace ALL occurrences of "My Accountant" with "${input.partnerName}" in the title, short description, and long description. Do NOT change other technical details.
      2. **Catchy Meta Title**: Generate a unique and compelling SEO title. It MUST be in the format: "[Catchy Service Hook] | ${input.partnerName}". Ensure it is under 60 characters.
      3. **Compelling Meta Description**: Rewrite the meta description to be professional, branded, and action-oriented. Ensure it is under 160 characters.
      
      **SERVICE TO RE-BRAND**:
      Current Title: ${input.service.title}
      Short Description: ${input.service.description}
      Long Description: ${input.service.longDescription}
      `
    });

    if (!output) throw new Error("The AI failed to generate branded content. Please check your API key and try again.");
    return output;
}
