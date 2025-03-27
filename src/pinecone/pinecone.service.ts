import { Injectable } from '@nestjs/common';
import { Pinecone } from '@pinecone-database/pinecone';
import { GeminiService } from 'src/gemini/gemini.service';

@Injectable()
export class PineconeService {
  constructor(private readonly geminiService: GeminiService) {}

  private readonly pinecone = new Pinecone({
    apiKey: process.env.PINECONE_API_KEY,
  });

  async storeEmbeddings(
    fileId: string,
    embeddings: number[][],
    textChunks: string[],
  ) {
    const index = this.pinecone.Index('pdf-embeddings');

    const vectors = embeddings.map((embedding, idx) => ({
      id: `${fileId}_${idx}`, // Unique ID per chunk
      values: embedding,
      metadata: { fileId, text: textChunks[idx] }, // Store text in metadata
    }));

    await index.upsert(vectors);
    console.log(`Stored ${vectors.length} embeddings for ${fileId}`);
  }

  async searchEmbedding(query: string) {
    const { embeddings } = await this.geminiService.generateEmbedding(query);
    const index = this.pinecone.Index('pdf-embeddings');

    let results: any[] = [];

    for (const embedding of embeddings) {
      const result = await index.query({
        topK: 5,
        vector: embedding,
        includeMetadata: true,
      });

      //   console.log(result);

      results = [...results, ...result.matches];
    }

    // Extract text from metadata
    return results.map((match) => ({
      id: match.id,
      text: match.metadata?.text || 'No text found',
      score: match.score,
      metadata: match.metadata,
    }));
  }
}
