'use server';
/**
 * @fileOverview An AI agent for suggesting transaction allocations.
 * 
 * - suggestTransactionAllocation - A function that suggests a GL account and VAT type for a transaction.
 * - SuggestTransactionAllocationInput - The input type for the suggestTransactionAllocation function.
 * - SuggestTransactionAllocationOutput - The return type for the suggestTransactionAllocation function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'zod';
import { allVatTypes } from '@/lib/vat-types';
import { googleAI } from '@genkit-ai/google-genai';
import { genkit } from 'genkit';

const SuggestTransactionAllocationInputSchema = z.object({
  description: z.string().describe('The bank transaction description (e.g., "PICK N PAY RETAILERS").'),
  chartOfAccounts: z.string().describe('A JSON string of the chart of accounts, with "id", "accountNumber", and "description" fields.'),
  isVatRegistered: z.boolean().describe('Whether the client is registered for VAT.'),
  apiKey: z.string().optional().describe('An optional Google AI API key to use for this specific suggestion.'),
});
export type SuggestTransactionAllocationInput = z.infer<typeof SuggestTransactionAllocationInputSchema>;

const SuggestTransactionAllocationOutputSchema = z.object({
  accountId: z.string().describe("The ID of the suggested account from the chart of accounts (e.g., '3800/000'). This must exactly match an ID from the provided chart of accounts."),
  vatType: z.enum(allVatTypes.map(v => v.name) as [string, ...string[]]).describe("The suggested VAT type for this transaction. If isVatRegistered is false, this must be 'no_vat'."),
  confidence: z.number().min(0).max(100).describe('A confidence score (0-100) of how certain you are about the allocation. A higher score means more confidence. Base confidence on how clear the description is (e.g., "PICK N PAY" is high, "DEBIT ORDER" is low).'),
  summary: z.string().describe('A brief, one-sentence summary of the transaction nature from a CA perspective (e.g., "Looks like a recurring software subscription" or "Likely a local retail purchase").'),
  suggestedKeyword: z.string().describe('A concise, uppercase "root" keyword derived from the description to be used for a future allocation rule (e.g., "VODACOM" or "SHELL").'),
});
export type SuggestTransactionAllocationOutput = z.infer<typeof SuggestTransactionAllocationOutputSchema>;

export async function suggestTransactionAllocation(
  input: SuggestTransactionAllocationInput
): Promise<SuggestTransactionAllocationOutput> {
  // If an API key is provided, we use a local genkit instance to perform the generation
  if (input.apiKey) {
    const customAi = genkit({
      plugins: [googleAI({ apiKey: input.apiKey })],
    });

    const { output } = await customAi.generate({
      model: 'googleai/gemini-2.5-flash',
      output: { schema: SuggestTransactionAllocationOutputSchema },
      prompt: `You are an experienced South African Chartered Accountant. Your task is to perform research on a bank transaction description and suggest the correct general ledger account and VAT type.

Analyze the transaction description and choose the most appropriate account from the provided chart of accounts. Also, determine the correct VAT treatment.

**Client VAT Status**: The client is ${input.isVatRegistered ? 'REGISTERED' : 'NOT REGISTERED'} for VAT.

**CRITICAL INSTRUCTION**: If the client is NOT registered for VAT, you MUST set the 'vatType' to 'no_vat' for all transactions.

**Transaction Description**: ${input.description}

**Chart of Accounts**:
\`\`\`json
${input.chartOfAccounts}
\`\`\`

Based on the description, provide:
1. The most likely Account ID.
2. The correct VAT type.
3. A confidence score.
4. A brief CA summary of the transaction nature.
5. A high-impact "root" keyword for future matching.

Use your vast knowledge of South African merchants (e.g., PNP, Checkers, Shell, Vodacom, Telkom, etc.) and global digital services (e.g., Google, Microsoft, AWS, Netflix) to provide accurate results.`,
    });

    return output!;
  }

  return suggestTransactionAllocationFlow(input);
}

const prompt = ai.definePrompt({
  name: 'suggestTransactionAllocationPrompt',
  input: { schema: SuggestTransactionAllocationInputSchema },
  output: { schema: SuggestTransactionAllocationOutputSchema },
  prompt: `You are an experienced South African Chartered Accountant. Your task is to perform research on a bank transaction description and suggest the correct general ledger account and VAT type.

Analyze the transaction description and choose the most appropriate account from the provided chart of accounts. Also, determine the correct VAT treatment.

**Client VAT Status**: The client is {{#if isVatRegistered}}REGISTERED{{else}}NOT REGISTERED{{/if}} for VAT.

**CRITICAL INSTRUCTION**: If the client is NOT registered for VAT, you MUST set the 'vatType' to 'no_vat' for all transactions.

**Transaction Description**: {{{description}}}

**Chart of Accounts**:
\`\`\`json
{{{chartOfAccounts}}}
\`\`\`

Based on the description, provide:
1. The most likely Account ID.
2. The correct VAT type.
3. A confidence score.
4. A brief CA summary of the transaction nature.
5. A high-impact "root" keyword for future matching.

Use your vast knowledge of South African merchants (e.g., PNP, Checkers, Shell, Vodacom, Telkom, etc.) and global digital services (e.g., Google, Microsoft, AWS, Netflix) to provide accurate results.
  `,
});

const suggestTransactionAllocationFlow = ai.defineFlow(
  {
    name: 'suggestTransactionAllocationFlow',
    inputSchema: SuggestTransactionAllocationInputSchema,
    outputSchema: SuggestTransactionAllocationOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    return output!;
  }
);
