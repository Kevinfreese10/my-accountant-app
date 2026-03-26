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
  model: 'googleai/gemini-2.5-flash',
  input: { schema: ExtractSupplierNameInputSchema },
  output: { schema: ExtractSupplierNameOutputSchema },
  prompt: `You are an expert data normalization agent. Your only task is to extract the true supplier/merchant name from a noisy bank statement description.

**Instructions:**
1.  Identify the core merchant or supplier name. If it is a person's name, extract the FULL NAME (first and last).
2.  Remove all extra information like reference numbers, dates, branch codes, card numbers, and prefixes (e.g., 'CHEQUE CARD PURCHASE', 'EFT PAYMENT', 'POS PURCHASE', 'DEBIT ORDER', 'IB PAYMENT TO').
3.  Normalize common variations (e.g., "VODACOM SA" and "VODACOM PTY LTD" should both become "VODACOM"; "PNP" or "P N P" should become "PICK N PAY").
4.  Return the final, cleaned name in UPPERCASE.

**Examples:**
-   **Input:** "VODACOM 0462814442 B0447335" -> **Output:** "VODACOM"
-   **Input:** "UIA INSURANCEMAY25 7K3D0" -> **Output:** "INSURANCE"
-   **Input:** "CHEQUE CARD PURCHASE SHELL STIGO 4278 4642" -> **Output:** "SHELL"
-   **Input:** "CHEQUE CARD PURCHASE GELMAR PTYL 4278 1363 02 JUN" -> **Output:** "GELMAR"
-   **Input:** "Pnp Steeledale 1" -> **Output:** "PICK N PAY"
-   **Input:** "KFC GOLDFIELDS" -> **Output:** "KFC"
-   **Input:** "IB PAYMENT TO HERONS@RIVERSIDE" -> **Output:** "HERONS"
-   **Input:** "CHEQUE CARD PURCHASE GOSFORTH EAST 4278193241571363" -> **Output:** "GOSFORTH"
-   **Input:** "IB PAYMENT TO ASISIPHO MBINGELELI" -> **Output:** "ASISIPHO MBINGELELI"

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
