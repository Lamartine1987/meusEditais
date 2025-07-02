'use server';
/**
 * @fileOverview A flow for generating quiz questions.
 *
 * - generateQuizQuestion - A function that creates a multiple-choice question.
 * - GenerateQuestionInput - The input type for the function.
 * - GenerateQuestionOutput - The return type for the function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';

const GenerateQuestionInputSchema = z.object({
  subjectName: z.string().describe('A matéria sobre a qual a questão deve ser.'),
  topicName: z.string().describe('O tópico específico dentro da matéria.'),
});
export type GenerateQuestionInput = z.infer<typeof GenerateQuestionInputSchema>;

const GenerateQuestionOutputSchema = z.object({
  question: z.string().describe('O texto da pergunta gerada.'),
  options: z.array(z.string()).length(4).describe('Um array com 4 respostas possíveis.'),
  correctAnswerIndex: z.number().min(0).max(3).describe('O índice (0-3) da resposta correta no array de opções.'),
  explanation: z.string().describe('Uma breve explicação do porquê a resposta correta está certa.'),
});
export type GenerateQuestionOutput = z.infer<typeof GenerateQuestionOutputSchema>;

export async function generateQuizQuestion(input: GenerateQuestionInput): Promise<GenerateQuestionOutput> {
  return generateQuestionFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateQuizQuestionPrompt',
  model: 'googleai/gemini-1.5-flash-latest',
  input: { schema: GenerateQuestionInputSchema },
  output: { schema: GenerateQuestionOutputSchema },
  config: {
    temperature: 0.5,
    safetySettings: [
      {
        category: 'HARM_CATEGORY_HATE_SPEECH',
        threshold: 'BLOCK_NONE',
      },
      {
        category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
        threshold: 'BLOCK_NONE',
      },
      {
        category: 'HARM_CATEGORY_HARASSMENT',
        threshold: 'BLOCK_NONE',
      },
      {
        category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
        threshold: 'BLOCK_NONE',
      },
    ],
  },
  prompt: `Você é uma "Banca Examinadora" especialista em criar questões para concursos públicos brasileiros.
  Sua tarefa é gerar uma questão de múltipla escolha (com 4 alternativas) sobre o tópico "{{topicName}}" dentro da matéria "{{subjectName}}".

  A questão deve ser desafiadora, clara e no formato típico de concursos.
  As alternativas devem ser plausíveis, mas apenas uma pode ser a correta.
  Forneça também uma breve explicação para a resposta correta.

  Gere a questão e as opções no idioma Português (Brasil).
  `,
});

const generateQuestionFlow = ai.defineFlow(
  {
    name: 'generateQuestionFlow',
    inputSchema: GenerateQuestionInputSchema,
    outputSchema: GenerateQuestionOutputSchema,
  },
  async (input: GenerateQuestionInput) => {
    const { output } = await prompt(input);
    if (!output) {
      throw new Error('Failed to generate quiz question.');
    }
    return output;
  }
);
