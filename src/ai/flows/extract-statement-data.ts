'use server';
/**
 * @fileOverview An AI agent for extracting transaction data from bank statements.
 *
 * - extractStatementData - A function that takes a bank statement and returns structured transaction data.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const ExtractStatementDataInputSchema = z.object({
  statementFile: z.string().describe(
    "A document of a bank statement (PDF or Image), as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
  ),
  apiKey: z.string().optional().describe("An optional Google AI API key to use for this specific extraction."),
});
export type ExtractStatementDataInput = z.infer<typeof ExtractStatementDataInputSchema>;

const TransactionLineSchema = z.object({
    date: z.string().describe("The transaction date in 'YYYY-MM-DD' format."),
    description: z.string().describe("The full transaction description."),
    amount: z.number().describe("The transaction amount. Use negative numbers for debits/payments and positive numbers for credits/receipts."),
});

const ExtractStatementDataOutputSchema = z.object({
  transactions: z.array(TransactionLineSchema).describe("An array of all transactions from the statement."),
});
export type ExtractStatementDataOutput = z.infer<typeof ExtractStatementDataOutputSchema>;

const prompt = ai.definePrompt({
  name: 'extractStatementDataPrompt',
  model: 'googleai/gemini-3.5-flash',
  input: { schema: ExtractStatementDataInputSchema },
  output: { schema: ExtractStatementDataOutputSchema },
  prompt: `You are an expert OCR and data extraction agent specializing in South African bank statements.

Your task is to analyze the provided bank statement (PDF or Image) and extract the following information for every single transaction with perfect accuracy:
1.  **Date**: The date the transaction occurred, formatted as YYYY-MM-DD.
2.  **Description**: The full, untruncated description of the transaction as it appears on the statement.
3.  **Amount**: The transaction amount. It is CRITICAL to use negative numbers for any debits, payments, or withdrawals, and positive numbers for any credits, deposits, or receipts.

If the document is a scanned image, use advanced OCR to ensure every character is read correctly.

Analyze the following bank statement:
{{media url=statementFile}}
  `,
});

const extractStatementDataFlow = ai.defineFlow(
  {
    name: 'extractStatementDataFlow',
    inputSchema: ExtractStatementDataInputSchema,
    outputSchema: ExtractStatementDataOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    return output!;
  }
);

/**
 * Wrapper function called by the application.
 */
export async function extractStatementData(
  input: ExtractStatementDataInput
): Promise<ExtractStatementDataOutput> {
  // Extract MIME type from data URI
  const mimeType = input.statementFile.split(';')[0].split(':')[1] || 'application/pdf';

  // If an API key is provided, we use a local genkit instance to perform the generation
  if (input.apiKey) {
    const { genkit } = await import('genkit');
    const { googleAI } = await import('@genkit-ai/google-genai');
    
    const customAi = genkit({
      plugins: [googleAI({ apiKey: input.apiKey })],
    });

    const { output } = await customAi.generate({
      model: 'googleai/gemini-3.5-flash',
      output: { schema: ExtractStatementDataOutputSchema },
      prompt: [
        { text: `You are an expert OCR and data extraction agent specializing in South African bank statements.

Your task is to analyze the provided bank statement (PDF or Image) and extract the following information for every single transaction with perfect accuracy:
1.  **Date**: The date the transaction occurred, formatted as YYYY-MM-DD.
2.  **Description**: The full, untruncated description of the transaction as it appears on the statement.
3.  **Amount**: The transaction amount. It is CRITICAL to use negative numbers for any debits, payments, or withdrawals, and positive numbers for any credits, deposits, or receipts.

If the document is a scanned image, use advanced OCR to ensure every character is read correctly.` },
        { media: { url: input.statementFile, contentType: mimeType } }
      ],
    });

    return output!;
  }

  return extractStatementDataFlow(input);
}
