'use server';
/**
 * @fileOverview AI agent for analyzing CVs/Resumes.
 *
 * - checkCV - A function that analyzes a CV PDF and returns scores and suggestions.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const CVAnalysisInputSchema = z.object({
  cvBase64: z.string().describe("The CV PDF as a data URI. Expected format: 'data:application/pdf;base64,<encoded_data>'."),
  targetRole: z.string().optional().describe("The user's preferred job title."),
  jobDescription: z.string().optional().describe("A full job description to match against."),
});
export type CVAnalysisInput = z.infer<typeof CVAnalysisInputSchema>;

const CVAnalysisOutputSchema = z.object({
  scores: z.object({
    atsReadiness: z.number().min(0).max(100),
    impactAndAchievements: z.number().min(0).max(100),
    structureAndReadability: z.number().min(0).max(100),
    roleFit: z.number().min(0).max(100),
    overallScore: z.number().min(0).max(100),
  }),
  rationales: z.object({
    atsReadiness: z.string(),
    impactAndAchievements: z.string(),
    structureAndReadability: z.string(),
    roleFit: z.string(),
  }),
  missingInformation: z.array(z.string()).describe("Information like DOB, Location, or specific certifications that are missing but expected."),
  suggestions: z.array(z.string()).describe("General improvements for the CV."),
  improvedSummary: z.string().describe("An AI-generated professional summary tailored to the target role."),
  bulletPointRewrites: z.array(z.object({
    original: z.string(),
    improved: z.string(),
    reason: z.string(),
  })).describe("3-5 examples of achievement-based bullet point rewrites."),
});
export type CVAnalysisOutput = z.infer<typeof CVAnalysisOutputSchema>;

export async function checkCV(input: CVAnalysisInput): Promise<CVAnalysisOutput> {
  return checkCVFlow(input);
}

const prompt = ai.definePrompt({
  name: 'checkCVPrompt',
  input: { schema: CVAnalysisInputSchema },
  output: { schema: CVAnalysisOutputSchema },
  prompt: `You are an expert Executive Recruiter and ATS (Applicant Tracking System) specialist. 
  Your goal is to evaluate the provided CV and provide a score out of 100 based on standard recruitment benchmarks.

  **CONTEXT:**
  - **Target Role:** {{{targetRole}}}
  - **Job Description:** {{{jobDescription}}}
  - **Document:** {{media url=cvBase64}}

  **SCORING LOGIC:**
  1. **ATS Readiness**: How well will parsing software read this? (Use of headers, standard fonts, keyword density).
  2. **Impact & Achievements**: Are there numbers, percentages, and clear results? (e.g., "Increased sales by 20%") vs just listing duties.
  3. **Structure & Readability**: Layout, flow, and visual hierarchy.
  4. **Role Fit**: How well does the profile match the Target Role/JD provided?
  
  **WEIGHTING RULES (Calculated by you for the 'overallScore'):**
  - If Job Description is provided: 25% each for all 4 categories.
  - If ONLY Target Role provided: ATS 30%, Impact 25%, Readability 25%, Role Fit 20%.
  - If NEITHER provided: ATS 34%, Impact 33%, Readability 33%, Role Fit 0.

  **SPECIFIC TASKS:**
  - Identify missing info: Look for common South African requirements like Date of Birth, Driver's License, or Current Location if not present.
  - Improved Summary: Write a punchy, 3-sentence summary that highlights their value for the specific role.
  - Bullet Rewrites: Pick the 3 weakest or most "duty-heavy" bullets and rewrite them to be "result-heavy".

  Return your analysis as structured JSON.`,
});

const checkCVFlow = ai.defineFlow(
  {
    name: 'checkCVFlow',
    inputSchema: CVAnalysisInputSchema,
    outputSchema: CVAnalysisOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    return output!;
  }
);
