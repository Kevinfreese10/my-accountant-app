'use server';
/**
 * @fileOverview An AI agent for analyzing client comments to suggest transaction allocations.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { allVatTypes } from '@/lib/vat-types';

const AnalyzeClientCommentInputSchema = z.object({
  comment: z.string().describe('The plain-English explanation from the client.'),
  merchantKey: z.string().describe('The identified merchant name.'),
  examples: z.array(z.string()).describe('Raw bank statement description examples.'),
  chartOfAccounts: z.string().describe('JSON string of the chart of accounts.'),
  isVatRegistered: z.boolean().describe('Whether the client is VAT registered.'),
});
export type AnalyzeClientCommentInput = z.infer<typeof AnalyzeClientCommentInputSchema>;

const AnalyzeClientCommentOutputSchema = z.object({
  accountId: z.string().describe("The ID of the suggested account from the chart of accounts."),
  vatType: z.enum(allVatTypes.map(v => v.name) as [string, ...string[]]).describe("The suggested VAT type."),
  confidence: z.number().min(0).max(100).describe('Confidence score.'),
  reasoning: z.string().describe('Short explanation of why this was chosen.'),
});
export type AnalyzeClientCommentOutput = z.infer<typeof AnalyzeClientCommentOutputSchema>;

export async function analyzeClientComment(
  input: AnalyzeClientCommentInput
): Promise<AnalyzeClientCommentOutput> {
  return analyzeClientCommentFlow(input);
}

const prompt = ai.definePrompt({
  name: 'analyzeClientCommentPrompt',
  input: { schema: AnalyzeClientCommentInputSchema },
  output: { schema: AnalyzeClientCommentOutputSchema },
  prompt: `You are an expert South African Chartered Accountant. Your task is to analyze a "Client Comment" and suggest the correct general ledger account and VAT type.

**PRIORITY**: The "Client Comment" is the absolute highest source of truth. If the client says a payment to a grocery store was for "Cleaning materials," ignore the default "Groceries" category and suggest "Cleaning."

**CONTEXT:**
- **Client Comment**: "{{{comment}}}"
- **Merchant Key**: "{{{merchantKey}}}"
- **Raw Examples**: {{#each examples}}"{{this}}" {{/each}}
- **VAT Status**: {{#if isVatRegistered}}Registered{{else}}NOT Registered{{/if}}

**Chart of Accounts**:
\`\`\`json
{{{chartOfAccounts}}}
\`\`\`

**INSTRUCTIONS:**
1. Pick the most specific Account ID from the list provided.
2. If the client is NOT registered for VAT, set 'vatType' to 'no_vat'.
3. Use the comment to override generic merchant assumptions.
4. Provide a brief reasoning (e.g., "Client confirmed this was for generator fuel").

Return your suggestion as structured JSON.`,
});

const analyzeClientCommentFlow = ai.defineFlow(
  {
    name: 'analyzeClientCommentFlow',
    inputSchema: AnalyzeClientCommentInputSchema,
    outputSchema: AnalyzeClientCommentOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    return output!;
  }
);
