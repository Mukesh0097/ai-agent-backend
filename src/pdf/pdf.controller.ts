import {
  Controller,
  Get,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { PdfService } from './pdf.service';
import { FileInterceptor } from '@nestjs/platform-express';
import { extname } from 'path';
import { diskStorage } from 'multer';
import { v4 as uuidv4 } from 'uuid';
import { GeminiService } from 'src/gemini/gemini.service';
import { PineconeService } from 'src/pinecone/pinecone.service';

@Controller('pdf')
export class PdfController {
  constructor(
    private readonly pdfService: PdfService,
    private readonly geminiService: GeminiService,
    private readonly pineconeService: PineconeService,
  ) {}

  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './uploads',
        filename: (req, file, cb) => {
          const fileExt = extname(file.originalname);
          cb(null, `${uuidv4()}${fileExt}`);
        },
      }),
    }),
  )
  async uploadPdf(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      return { message: 'No file uploaded!' };
    }

    // Extract text from PDF
    const text = await this.pdfService.extractText(file.path);

    // Generate embeddings using Gemini
    const { embeddings, textChunks } =
      await this.geminiService.generateEmbedding(text);

    // Store embedding in Pinecone
    const docId = uuidv4();
    await this.pineconeService.storeEmbeddings(docId, embeddings, textChunks);

    return { message: 'PDF uploaded and stored successfully!', docId };
  }

  // Query stored PDFs
  @Get('query')
  async queryPdf(@Query('q') query: string) {
    if (!query) {
      return { message: 'Query is required!' };
    }

    // Generate embedding for the query
    // const queryEmbedding = await this.geminiService.generateEmbedding(query);

    // Search for the most relevant stored embeddings
    const matches = await this.pineconeService.searchEmbedding(query);

    // console.log(matches);

    const textGeminiresult = await this.geminiService.generateText(
      `here is my query: ${query} and here are the matches: ${JSON.stringify(matches, null, 2)} generate a response to my query based on the matches`,
    );

    return { matches, textGeminiresult };
  }
}
