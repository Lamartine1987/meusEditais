'use server';
import genkitImport from '@genkit-ai/ai';
import {googleAI} from '@genkit-ai/googleai';

// Workaround for CJS/ESM module resolution issue
const genkit = (genkitImport as any).default || genkitImport;

export const ai = genkit({
  plugins: [
    googleAI({
      // The Gemini 1.5 Pro model is great for complex reasoning.
      // The Gemini 1.5 Flash model is faster and cheaper.
      // Both support a 1M token context window.
      // FMI: https://ai.google.dev/models/gemini
      // Supported models: https://ai.google.dev/gemini-api/docs/models/generative
      // gemini-1.5-flash-latest is an alias for the latest flash model.
      // Use of "latest" is not recommended for production.
      // Model selection and configuration are now handled within each prompt definition.
    }),
  ],
  // Log level and other settings are configured in genkit.config.js
  // or by setting environment variables.
});
