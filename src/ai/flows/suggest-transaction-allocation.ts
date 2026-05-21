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

const SuggestTransactionAllocationInputSchema = z.object({
  description: z.string().describe('The bank transaction description (e.g., "PICK N PAY RETAILERS").'),
  chartOfAccounts: z.string().describe('A JSON string of the chart of accounts, with "id", "accountNumber", and "description" fields.'),
  isVatRegistered: z.boolean().describe('Whether the client is registered for VAT.'),
  apiKey: z.string().optional().describe('An optional Google AI API key to use for this specific suggestion.'),
  useWebSearch: z.boolean().optional().describe('Whether to use Google Search grounding for this suggestion.'),
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

const CANDIDATE_MODELS = [
  'googleai/gemini-1.5-flash',
  'googleai/gemini-2.5-flash',
  'googleai/gemini-3.5-flash',
];

async function suggestWithoutWebSearch(
  activeAi: any,
  input: SuggestTransactionAllocationInput
): Promise<SuggestTransactionAllocationOutput> {
  let lastError: any = null;
  for (const modelName of CANDIDATE_MODELS) {
    try {
      console.log(`[AI Suggestion Non-Search] Generating allocation using model: ${modelName}`);
      const { output } = await activeAi.generate({
        model: modelName,
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
      if (output) return output;
    } catch (err: any) {
      console.warn(`[AI Suggestion Non-Search Warning] Failed with model ${modelName}:`, err.message || err);
      lastError = err;
    }
  }
  throw lastError || new Error("All Gemini models failed to generate transaction allocation suggestions.");
}

export async function suggestTransactionAllocation(
  input: SuggestTransactionAllocationInput
): Promise<SuggestTransactionAllocationOutput> {
  // Choose the Genkit instance to use: either the custom one with the provided apiKey, or the default global 'ai'
  let activeAi = ai;
  if (input.apiKey) {
    const { genkit } = await import('genkit');
    const { googleAI } = await import('@genkit-ai/google-genai');
    activeAi = genkit({
      plugins: [googleAI({ apiKey: input.apiKey })],
    });
  }

  // If we should use Google Search web grounding
  if (input.useWebSearch) {
    let researchResultText = '';
    let webSearchSuccess = false;

    // Try web search with each model in order
    for (const modelName of CANDIDATE_MODELS) {
      try {
        console.log(`[AI Research] Attempting web search with model: ${modelName}`);
        const result = await activeAi.generate({
          model: modelName,
          config: {
            // @ts-ignore
            tools: [{ googleSearch: {} }]
          },
          prompt: `You are a research assistant. Your task is to research the following merchant or company description using Google Search to understand their primary business activity, products/services, and country of operation.

Transaction Description: ${input.description}

Write a detailed summary of what you found about this merchant, including:
1. What kind of business/merchant is this?
2. What are the main products or services they sell/provide?
3. Where is this merchant located/operating (e.g. South Africa, Global, USA)?
4. Is it a retail store, utility company, digital service, restaurant, fuel station, bank fee, tax authority, or something else?

Be detailed, accurate, and objective.`,
        });
        
        if (result && result.text) {
          researchResultText = result.text;
          webSearchSuccess = true;
          break;
        }
      } catch (err: any) {
        console.warn(`[AI Research Warning] Web search failed with model ${modelName}:`, err.message || err);
      }
    }

    // If web search succeeded, proceed with using the research results to get the allocation suggestion
    if (webSearchSuccess) {
      for (const modelName of CANDIDATE_MODELS) {
        try {
          console.log(`[AI Suggestion] Generating allocation using research and model: ${modelName}`);
          const { output } = await activeAi.generate({
            model: modelName,
            output: { schema: SuggestTransactionAllocationOutputSchema },
            prompt: `You are an experienced South African Chartered Accountant. Your task is to analyze the research findings about a merchant from a bank transaction and suggest the correct general ledger account and VAT type from the provided Chart of Accounts.

**Client VAT Status**: The client is ${input.isVatRegistered ? 'REGISTERED' : 'NOT REGISTERED'} for VAT.

**CRITICAL INSTRUCTION**: If the client is NOT registered for VAT, you MUST set the 'vatType' to 'no_vat' for all transactions.

**Transaction Description**: ${input.description}

**Merchant Research Findings**:
${researchResultText}

**Chart of Accounts**:
\`\`\`json
${input.chartOfAccounts}
\`\`\`

Based on the research findings and transaction description, provide:
1. The most likely Account ID (which MUST exactly match an ID from the provided chart of accounts).
2. The correct VAT type (if client is registered for VAT, choose the most appropriate one; if not registered, it must be 'no_vat').
3. A confidence score between 0 and 100. Be realistic based on how certain you are of the match.
4. A brief CA summary of the transaction nature (explaining the merchant line of business and why the selected account was chosen).
5. A high-impact "root" keyword for future matching (e.g. "WOOLWORTHS", "AUTOENTRY", "VODACOM").`,
          });
          if (output) return output;
        } catch (err: any) {
          console.warn(`[AI Suggestion Warning] Failed using research with model ${modelName}:`, err.message || err);
        }
      }
    }

    // If we failed to get a suggestion using web search (either webSearch itself failed or output generation failed),
    // we fall back gracefully to the non-search suggest allocation using the candidate models loop.
    console.warn(`[AI Research Fallback] Google Search grounding failed or generated 429 errors. Falling back to non-search candidate loop.`);
    return await suggestWithoutWebSearch(activeAi, input);
  }

  // If we don't use web search, run standard candidate loop
  return await suggestWithoutWebSearch(activeAi, input);
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