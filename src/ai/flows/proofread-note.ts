'use server';
/**
 * @fileOverview An AI agent for proofreading text.
 * 
 * - proofreadNote - A function that corrects grammar, spelling, and tone of a given text.
 * - ProofreadNoteInput - The input type for the proofreadNote function.
 * - ProofreadNoteOutput - The return type for the proofreadNote function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';

const ProofreadNoteInputSchema = z.object({
  text: z.string().describe('The raw text of the note to be proofread.'),
});
export type ProofreadNoteInput = z.infer<typeof ProofreadNoteInputSchema>;

const ProofreadNoteOutputSchema = z.object({
  proofreadText: z.string().describe("The corrected and improved version of the note. It should be grammatically correct, spell-checked, and have a friendly yet professional tone suitable for client communication."),
});
export type ProofreadNoteOutput = z.infer<typeof ProofreadNoteOutputSchema>;

export async function proofreadNote(
  input: ProofreadNoteInput
): Promise<ProofreadNoteOutput> {
  return proofreadNoteFlow(input);
}

const prompt = ai.definePrompt({
  name: 'proofreadNotePrompt',
  model: 'googleai/gemini-3.5-flash',
  input: { schema: ProofreadNoteInputSchema },
  output: { schema: ProofreadNoteOutputSchema },
  prompt: `You are an expert editor for an accounting firm. Your task is to proofread the following note.

  **Instructions:**
  1.  Correct all spelling and grammatical errors.
  2.  Ensure the tone is friendly but professional.
  3.  Keep the message concise and clear.
  4.  Do NOT add any formal greetings or closings (like "Hi," or "Regards,"). Just return the corrected body of the note.

  **Original Note:**
  {{{text}}}
  `,
});

const proofreadNoteFlow = ai.defineFlow(
  {
    name: 'proofreadNoteFlow',
    inputSchema: ProofreadNoteInputSchema,
    outputSchema: ProofreadNoteOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    return output!;
  }
);
