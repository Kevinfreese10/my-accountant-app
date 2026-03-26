'use server';
/**
 * @fileOverview An AI agent for semantic regrouping of merchant groups.
 * 
 * - aiSmartRegroup - Identifies semantic similarities between unallocated merchant groups.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const GroupItemSchema = z.object({
  key: z.string(),
  example: z.string(),
  count: z.number(),
});

const AISmartRegroupInputSchema = z.object({
  groups: z.array(GroupItemSchema).describe('The unallocated merchant groups to analyze.'),
});
export type AISmartRegroupInput = z.infer<typeof AISmartRegroupInputSchema>;

const AISmartRegroupOutputSchema = z.object({
  proposals: z.array(z.object({
    fromKey: z.string(),
    toKey: z.string(),
    reasoning: z.string(),
    confidence: z.number().min(0).max(100),
  })).describe('Proposed semantic merges.'),
});
export type AISmartRegroupOutput = z.infer<typeof AISmartRegroupOutputSchema>;

export async function aiSmartRegroup(input: AISmartRegroupInput): Promise<AISmartRegroupOutput> {
  return aiSmartRegroupFlow(input);
}

const prompt = ai.definePrompt({
  name: 'aiSmartRegroupPrompt',
  model: 'googleai/gemini-2.5-flash',
  input: { schema: AISmartRegroupInputSchema },
  output: { schema: AISmartRegroupOutputSchema },
  prompt: `You are an expert South African data normalization agent for an accounting firm. 
  Your goal is to identify "redundant" merchant groups that should be merged because they refer to the same logical entity.
  
  **INSTRUCTIONS**:
  1. **Identify Semantic Matches**: Look for abbreviations, aliases, or common variations.
     - Example: "VODA" and "VODACOM" -> Merge into "VODACOM".
     - Example: "PNP" and "PICK N PAY" -> Merge into "PICK N PAY".
     - Example: "SHELL" and "SHELL PETROLEUM" -> Merge into "SHELL".
  2. **South African Context**: Use your knowledge of common SA retailers (PNP, Spar, Woolworths, Clicks), Telcos (Vodacom, MTN, Telkom), and fuel stations.
  3. **Be Safe**: Do NOT merge items that are clearly different even if they share words (e.g., "BUFFALO GRILL" and "BUFFALO LOGISTICS").
  4. **Propose Direction**: The 'toKey' should be the more descriptive or canonical name.
  5. **Confidence**: Only propose if confidence is 80% or higher.
  
  **GROUPS TO ANALYZE**:
  {{#each groups}}
  - Key: "{{this.key}}", Example Desc: "{{this.example}}", Count: {{this.count}}
  {{/each}}
  
  Return your findings as structured JSON with reasoning for each merge.`,
});

const aiSmartRegroupFlow = ai.defineFlow(
  {
    name: 'aiSmartRegroupFlow',
    inputSchema: AISmartRegroupInputSchema,
    outputSchema: AISmartRegroupOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    return output!;
  }
);
