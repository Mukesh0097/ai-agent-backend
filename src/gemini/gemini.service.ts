import { Injectable } from '@nestjs/common';
import { GoogleGenerativeAI, Part } from '@google/generative-ai';

function chunkText(text: string, chunkSize: number = 512): string[] {
  const words = text.split(/\s+/);
  const chunks: string[] = [];

  for (let i = 0; i < words.length; i += chunkSize) {
    chunks.push(words.slice(i, i + chunkSize).join(' '));
  }

  return chunks;
}

@Injectable()
export class GeminiService {
  private readonly genAI: GoogleGenerativeAI;

  constructor() {
    this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  }

  async generateEmbedding(
    text: string,
  ): Promise<{ embeddings: number[][]; textChunks: string[] }> {
    const chunks = chunkText(text, 512); // Chunk the text before embedding
    const embeddings: number[][] = [];
    const textChunks: string[] = [];
    for (const chunk of chunks) {
      const model = this.genAI.getGenerativeModel({
        model: 'text-embedding-004',
      });
      const result = await model.embedContent(chunk);

      if (result.embedding?.values) {
        embeddings.push(result.embedding.values);
        textChunks.push(chunk);
      }
    }

    return { embeddings, textChunks }; // Returns an array of embeddings
  }

  async generateText(query: string) {
    const model = this.genAI.getGenerativeModel({
      model: 'gemini-2.0-flash-lite',
    });
    const result = await model.generateContent(query);
    return result.response.candidates[0].content.parts[0].text;
  }
}
