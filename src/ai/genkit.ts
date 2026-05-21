import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/google-genai';

export const ai = genkit({
  plugins: [googleAI({ apiKey: process.env.GEMINI_API_KEY || 'AIzaSyB1a77Wn8MZF0N4SeF3rCRp5xpIUMte3zU' })],
  model: 'googleai/gemini-3.5-flash',
});

