import { forwardRef, Module } from '@nestjs/common';
import { PdfService } from './pdf.service';
import { PdfController } from './pdf.controller';
import { GeminiService } from 'src/gemini/gemini.service';
import { PineconeService } from 'src/pinecone/pinecone.service';
import { GeminiModule } from 'src/gemini/gemini.module';

@Module({
  imports: [forwardRef(() => GeminiModule)],
  controllers: [PdfController],
  providers: [PdfService, PineconeService],
  exports: [PdfService],
})
export class PdfModule {}
