'use server';
/**
 * @fileOverview An AI agent for optimizing allocation rules by expanding keywords.
 * 
 * - optimizeAllocationRule - A function that suggests optimized keywords and settings for a rule.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { allVatTypes } from '@/lib/vat-types';

const OptimizeAllocationRuleInputSchema = z.object({
  description: z.string().describe('The current description of the allocation rule.'),
  keywords: z.array(z.string()).describe('The current list of keywords for this rule.'),
});
export type OptimizeAllocationRuleInput = z.infer<typeof OptimizeAllocationRuleInputSchema>;

const OptimizeAllocationRuleOutputSchema = z.object({
  optimizedKeywords: z.array(z.string()).describe('An expanded and normalized list of keywords (UPPERCASE).'),
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
  prompt: `You are an expert South African bookkeeping assistant. Your goal is to help a Chartered Accountant optimize automated bank transaction allocation rules by researching common keywords found on bank statements.

**Rule Description:** {{{description}}}
**Current Keywords:** {{#each keywords}}{{{this}}}{{#unless @last}}, {{/unless}}{{/each}}

**Instructions:**
1. **Analyze the Description**: Identify the logical merchant category or nature of the transaction (e.g., if it says "Fuel", think of major South African fuel stations like SHELL, ENGEN, BP, TOTAL, SASOL).
2. **Expand Keywords**: Suggest a comprehensive list of keywords that would appear on a South African bank statement for this category. Include common abbreviations (e.g., "PNP" for "PICK N PAY"), common merchant names, and standard bank noise variations.
3. **Normalize**: All keywords must be in UPPERCASE.
4. **Filter**: Avoid generic terms that might cause false positives (e.g., don't use "STORE" if the rule is for a specific shop).
5. **Reasoning**: Provide a very short explanation of the research results.

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
