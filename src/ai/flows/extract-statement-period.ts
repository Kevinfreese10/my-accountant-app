'use server';
/**
 * @fileOverview An AI agent for extracting the date range and balances from bank statements.
 *
 * - extractStatementPeriod - A function that takes a bank statement and returns its start date, end date, and balances.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const ExtractStatementPeriodInputSchema = z.object({
  statementPdf: z.string().describe(
    "A document of a bank statement (image or PDF), as a data URI."
  ),
});
export type ExtractStatementPeriodInput = z.infer<typeof ExtractStatementPeriodInputSchema>;

const ExtractStatementPeriodOutputSchema = z.object({
  startDate: z.string().describe("The start date of the statement period in 'YYYY-MM-DD' format."),
  endDate: z.string().describe("The end date of the statement period in 'YYYY-MM-DD' format."),
  openingBalance: z.number().describe("The opening balance from the statement."),
  closingBalance: z.number().describe("The closing balance from the statement."),
  balanceConfidence: z.number().min(0).max(100).describe("A confidence score (0-100) on the accuracy of the extracted opening and closing balances."),
});
export type ExtractStatementPeriodOutput = z.infer<typeof ExtractStatementPeriodOutputSchema>;

const prompt = ai.definePrompt({
  name: 'extractStatementPeriodPrompt',
  model: 'googleai/gemini-2.5-flash',
  input: { schema: ExtractStatementPeriodInputSchema },
  output: { schema: ExtractStatementPeriodOutputSchema },
  prompt: `You are an expert financial OCR agent. Your only task is to find the start date, end date, opening balance, and closing balance of the provided bank statement document.
  
  The start date is usually the first transaction date or a clearly labeled 'Statement From' date.
  The end date is usually the last transaction date or a clearly labeled 'Statement To' date.
  The opening balance is the balance at the beginning of the statement period.
  The closing balance is the balance at the end of the statement period.
  
  Format the dates as YYYY-MM-DD.
  Return balances as numbers, without currency symbols or commas.
  Provide a confidence score for the balances.

  Analyze the following document:
  {{media url=statementPdf}}
  `,
});

const extractStatementPeriodFlow = ai.defineFlow(
  {
    name: 'extractStatementPeriodFlow',
    inputSchema: ExtractStatementPeriodInputSchema,
    outputSchema: ExtractStatementPeriodOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    return output!;
  }
);

/**
 * Wrapper function called by the application.
 */
export async function extractStatementPeriod(
  input: ExtractStatementPeriodInput
): Promise<ExtractStatementPeriodOutput> {
  return extractStatementPeriodFlow(input);
}
