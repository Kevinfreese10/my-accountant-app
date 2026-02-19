
'use server';
/**
 * @fileOverview An AI agent for optimizing allocation rules by expanding and simplifying keywords.
 * 
 * - optimizeAllocationRule - A function that suggests optimized keywords and settings for a rule.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';

const OptimizeAllocationRuleInputSchema = z.object({
  description: z.string().describe('The current description of the allocation rule.'),
  keywords: z.array(z.string()).describe('The current list of keywords for this rule.'),
});
export type OptimizeAllocationRuleInput = z.infer<typeof OptimizeAllocationRuleInputSchema>;

const OptimizeAllocationRuleOutputSchema = z.object({
  optimizedKeywords: z.array(z.string()).describe('A simplified and high-impact list of keywords (UPPERCASE).'),
  reasoning: z.string().describe('A brief, one-sentence explanation of why these keywords were suggested.'),
});
export type OptimizeAllocationRuleOutput = z.infer<typeof OptimizeAllocationRuleOutputSchema>;

export async function optimizeAllocationRule(
  input: OptimizeAllocationRuleInput
): Promise<OptimizeAllocationRuleOutput> {
  return optimizeAllocationRuleFlow(input);
}

const prompt = ai.definePrompt({
  name: 'optimizeAllocationRulePrompt',
  input: { schema: OptimizeAllocationRuleInputSchema },
  output: { schema: OptimizeAllocationRuleOutputSchema },
  prompt: `You are an expert South African bookkeeping assistant. Your goal is to optimize automated bank transaction allocation rules by identifying high-impact "root" keywords.

**Rule Description:** {{{description}}}
**Current Keywords:** {{#each keywords}}{{{this}}}{{#unless @last}}, {{/unless}}{{/each}}

**Instructions:**
1. **Identify the Core Nature**: Determine the logical category or merchant.
2. **Find Root Keywords**: Instead of long, specific strings, look for concise words that are common across many variations. 
   - Example: Instead of "MONTHLY SERVICE FEE", "STOP ORDER FEE", and "OVERDRAFT FEE", suggest "FEE" or "CHARGES".
   - Example: Instead of "VODACOM PYMNT 123", suggest "VODACOM".
3. **Broad but Safe**: Ensure keywords are specific enough to avoid false positives (e.g., don't use "STORE" for a clothing shop) but broad enough to cover bank statement noise.
4. **Prune Redundancy**: If a shorter keyword covers longer ones, only include the short one.
5. **Normalize**: All keywords must be in UPPERCASE.
6. **South African Context**: Use knowledge of SA banks (FNB, ABSA, Nedbank, Standard Bank, Capitec) and common merchants (PNP, Checkers, Shell, etc.).

Return the result as structured JSON.`,
});

const optimizeAllocationRuleFlow = ai.defineFlow(
  {
    name: 'optimizeAllocationRuleFlow',
    inputSchema: OptimizeAllocationRuleInputSchema,
    outputSchema: OptimizeAllocationRuleOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    return output!;
  }
);
