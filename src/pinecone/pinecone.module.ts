import { Module } from '@nestjs/common';
import { PineconeService } from './pinecone.service';
import { PineconeController } from './pinecone.controller';
import { GeminiModule } from 'src/gemini/gemini.module';

@Module({
  imports: [GeminiModule],
  controllers: [PineconeController],
  providers: [PineconeService],
  exports: [PineconeService],
})
export class PineconeModule {}
