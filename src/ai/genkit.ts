'use server';
import {genkit} from '@genkit-ai/core';
import {googleAI} from '@genkit-ai/googleai';

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
      defaultModel: 'gemini-1.5-flash-latest',
      defaultConfig: {
        temperature: 0.5,
      },
    }),
  ],
  // Log level and other settings are configured in genkit.config.js
  // or by setting environment variables.
});
