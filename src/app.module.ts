import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ChatModule } from './chat/chat.module';
import { ConfigModule } from '@nestjs/config';
import { PdfModule } from './pdf/pdf.module';
import { GeminiModule } from './gemini/gemini.module';
import { PineconeModule } from './pinecone/pinecone.module';

@Module({
  imports: [ChatModule, ConfigModule.forRoot(), PdfModule, GeminiModule, PineconeModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
