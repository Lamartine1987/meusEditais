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
  subjectName: z.string().describe('The subject the question should be about.'),
  topicName: z.string().describe('The specific topic within the subject.'),
});
export type GenerateQuestionInput = z.infer<typeof GenerateQuestionInputSchema>;

const GenerateQuestionOutputSchema = z.object({
  question: z.string().describe('The generated question text.'),
  options: z.array(z.string()).length(4).describe('An array of 4 possible answers.'),
  correctAnswerIndex: z.number().min(0).max(3).describe('The index (0-3) of the correct answer in the options array.'),
  explanation: z.string().describe('A brief explanation for why the correct answer is right.'),
});
export type GenerateQuestionOutput = z.infer<typeof GenerateQuestionOutputSchema>;

export async function generateQuizQuestion(input: GenerateQuestionInput): Promise<GenerateQuestionOutput> {
  return generateQuestionFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateQuizQuestionPrompt',
  input: { schema: GenerateQuestionInputSchema },
  output: { schema: GenerateQuestionOutputSchema },
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
