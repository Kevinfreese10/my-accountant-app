
'use server';
/**
 * @fileOverview An AI agent for extracting a clean supplier name from a bank transaction description.
 *
 * - extractSupplierName: A function that takes a transaction description and returns a cleaned supplier name.
 * - ExtractSupplierNameInput - The input type for the extractSupplierName function.
 * - ExtractSupplierNameOutput - The return type for the extractSupplierName function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';

const ExtractSupplierNameInputSchema = z.object({
  description: z.string().describe(
    "The raw bank transaction description, e.g., 'VODACOM 0462814442 B0447335' or 'CHEQUE CARD PURCHASE SHELL STIGO'."
  ),
});
export type ExtractSupplierNameInput = z.infer<typeof ExtractSupplierNameInputSchema>;


const ExtractSupplierNameOutputSchema = z.object({
  supplier: z.string().describe('The cleaned, normalized, uppercase supplier name. E.g., "VODACOM", "SHELL", "INSURANCE".'),
});
export type ExtractSupplierNameOutput = z.infer<typeof ExtractSupplierNameOutputSchema>;

export async function extractSupplierName(
  input: ExtractSupplierNameInput
): Promise<ExtractSupplierNameOutput> {
  return extractSupplierNameFlow(input);
}

const prompt = ai.definePrompt({
  name: 'extractSupplierNamePrompt',
  input: { schema: ExtractSupplierNameInputSchema },
  output: { schema: ExtractSupplierNameOutputSchema },
  prompt: `You are an expert data normalization agent. Your only task is to extract the true supplier/merchant name from a noisy bank statement description.

**Instructions:**
1.  Identify the core merchant or supplier name.
2.  Remove all extra information like reference numbers, dates, branch codes, payment method prefixes (e.g., 'CHEQUE CARD PURCHASE', 'EFT'), and random characters.
3.  Normalize common variations (e.g., "VODACOM SA" and "VODACOM PTY LTD" should both become "VODACOM").
4.  Return the final, cleaned name in UPPERCASE.

**Examples:**
-   **Input:** "VODACOM 0462814442 B0447335" -> **Output:** "VODACOM"
-   **Input:** "UIA INSURANCEMAY25 7K3D0" -> **Output:** "INSURANCE"
-   **Input:** "CHEQUE CARD PURCHASE SHELL STIGO 4278 4642" -> **Output:** "SHELL"
-   **Input:** "Pnp Steeledale 1" -> **Output:** "PICK N PAY"
-   **Input:** "KFC GOLDFIELDS" -> **Output:** "KFC"

**Transaction Description:**
{{{description}}}
  `,
});

const extractSupplierNameFlow = ai.defineFlow(
  {
    name: 'extractSupplierNameFlow',
    inputSchema: ExtractSupplierNameInputSchema,
    outputSchema: ExtractSupplierNameOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    return output!;
  }
);
