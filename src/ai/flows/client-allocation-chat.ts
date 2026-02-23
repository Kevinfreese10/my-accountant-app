'use server';
/**
 * @fileOverview An AI agent for conversing with clients to allocate transactions.
 * 
 * - processClientAllocationChat - Handles the conversation logic and suggests allocations.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { ChartOfAccount, ImportedTransaction, VatType } from '@/lib/types';

const ChatMessageSchema = z.object({
  role: z.enum(['user', 'bot']),
  content: z.string(),
});

const ClientAllocationChatInputSchema = z.object({
  history: z.array(ChatMessageSchema).describe('The conversation history.'),
  pendingTransactions: z.array(z.any()).describe('List of unallocated transactions.'),
  chartOfAccounts: z.array(z.any()).describe('The client\'s chart of accounts.'),
  isVatRegistered: z.boolean().describe('Whether the client is VAT registered.'),
});
export type ClientAllocationChatInput = z.infer<typeof ClientAllocationChatInputSchema>;

const ClientAllocationChatOutputSchema = z.object({
  answer: z.string().describe('The AI response to the client.'),
  allocation: z.object({
    transactionId: z.string(),
    accountId: z.string(),
    vatType: z.string(),
    confidence: z.number(),
    reasoning: z.string(),
  }).optional().describe('Populated if the AI has enough info to allocate a specific transaction.'),
  nextTransactionId: z.string().optional().describe('The ID of the next transaction the AI wants to ask about.'),
});
export type ClientAllocationChatOutput = z.infer<typeof ClientAllocationChatOutputSchema>;

export async function processClientAllocationChat(
  input: ClientAllocationChatInput
): Promise<ClientAllocationChatOutput> {
  return processClientAllocationChatFlow(input);
}

const prompt = ai.definePrompt({
  name: 'clientAllocationChatPrompt',
  input: { schema: ClientAllocationChatInputSchema },
  output: { schema: ClientAllocationChatOutputSchema },
  prompt: `You are 'Khai', a professional and friendly AI Accountant. Your goal is to help the client identify the nature of unallocated bank transactions so they can be correctly recorded.

**CONTEXT:**
- **Client VAT Status**: {{#if isVatRegistered}}Registered for VAT{{else}}NOT Registered for VAT{{/if}}
- **Pending Transactions**: 
{{#each pendingTransactions}}
  - ID: {{this.id}}, Date: {{this.date}}, Desc: {{this.description}}, Amount: {{this.amount}}
{{/each}}

- **Chart of Accounts**:
{{#each chartOfAccounts}}
  - {{this.accountNumber}}: {{this.description}} ({{this.section}})
{{/each}}

**INSTRUCTIONS:**
1. **Be Conversational**: Start with a warm greeting if the history is empty. 
2. **One-by-One**: Only ask about ONE transaction at a time. Pick the oldest one first.
3. **Analyze Response**: If the client just answered a question, map their explanation to the most logical Account ID from the Chart of Accounts provided.
4. **Immediate Allocation**: If you have enough info to allocate, populate the 'allocation' object. Use 'no_vat' for all if the client is not VAT registered.
5. **Handle Ambiguity**: If the client's answer is vague (e.g., "I don't know"), ask if it might be personal drawings or a specific type of expense.
6. **Plain Text**: Do not use HTML. Use Markdown for emphasis.

**CONVERSATION HISTORY:**
{{#each history}}
  {{role}}: {{{content}}}
{{/each}}

If the client just responded, analyze their message against the last transaction you asked about. If you are starting, pick the first transaction from the list.
`,
});

const processClientAllocationChatFlow = ai.defineFlow(
  {
    name: 'processClientAllocationChatFlow',
    inputSchema: ClientAllocationChatInputSchema,
    outputSchema: ClientAllocationChatOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    return output!;
  }
);
