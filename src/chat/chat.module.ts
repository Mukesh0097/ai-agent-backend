import { Module } from '@nestjs/common';
import { ChatServiceWithOpenAi } from './chat.service';
import { ChatGateway } from './chat.gateway';
import { ConfigModule } from '@nestjs/config';
import { GeminiModule } from 'src/gemini/gemini.module';
import { PineconeModule } from 'src/pinecone/pinecone.module';

@Module({
  imports: [ConfigModule, GeminiModule, PineconeModule],
  providers: [ChatGateway, ChatServiceWithOpenAi],
})
export class ChatModule {}
