import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import {
  createClient,
  DeepgramClient,
  ListenLiveClient,
  LiveTTSEvents,
} from '@deepgram/sdk';
import { ConfigService } from '@nestjs/config';
import { ChatServiceWithOpenAi } from './chat.service';

@WebSocketGateway({ cors: { origin: '*' } })
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() io: Server;
  private deepgramLive: ListenLiveClient;
  private deepgram: DeepgramClient;
  private fullscript = '';
  private isstarts = false;
  private isTexting = false;
  private num = 0;
  constructor(
    private configService: ConfigService,
    private readonly chatService: ChatServiceWithOpenAi,
  ) {
    if (!this.deepgram) {
      const deepgramApiKey = this.configService.get<string>('DEEPGRAM_API_KEY');
      if (!deepgramApiKey) {
        console.error('❌ Deepgram API Key is missing');
        return;
      }
      this.deepgram = createClient(deepgramApiKey);
      this.isstarts = false;
    }
  }

  async handleConnection(socket: Socket) {
    console.log('✅ Client connected:', socket.id);
    console.log(this.isstarts);
    if (!this.isstarts) {
      this.isstarts = true;
      socket.emit('transcriptStarted');
      await this.chatService.chatWithAI(
        'introduce yourself in one line. your name is Auburn',
        socket,
        this.sendTTS,
        this.deepgram,
      );
      socket.emit('transcriptEnded');
      socket.emit('introEnd');
    }
  }

  @SubscribeMessage('audio')
  handleAudio(@MessageBody() audioData: Uint8Array) {
    if (this.deepgramLive) {
      // Send audio data to Deepgram which is initilized in getready event
      this.deepgramLive.send(Buffer.from(audioData));
    }
  }

  @SubscribeMessage('killProcess')
  killProcess(socket: Socket) {
    this.chatService.killProcess();

    socket.emit('transcriptEnded');
    this.fullscript = '';
  }
  // Send text prompt to AI service and get response
  @SubscribeMessage('sendTextPrompt')
  async handleTextPrompt(
    @MessageBody() data: string,
    @ConnectedSocket() socket: Socket,
  ) {
    console.log(data);
    this.num++;
    // socket.emit('transcript', data);
    socket.emit('transcriptStarted');
    await this.chatService.chatWithAI(
      data,
      socket,
      this.sendTTS,
      this.deepgram,
    );
    socket.emit('transcriptEnded');
    // this.sendTTS(socket, response);
  }

  // Close the microphone
  @SubscribeMessage('closemic')
  handleDisconnectEvent() {
    if (this.deepgramLive) {
      this.deepgramLive.disconnect();
      this.isstarts = false;
      console.log('🎤 Microphone closed by client');
    }
  }

  // Handle client disconnection
  async handleDisconnect(socket: Socket) {
    console.log('❌ Client disconnected:', socket.id);
    this.isstarts = false;
    if (this.deepgramLive) {
      this.deepgramLive.disconnect();
    }
  }

  // Send TTS response to client
  async sendTTS(
    socket: Socket,
    text: string,
    deepgram: DeepgramClient,
    processKilled: string,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      // Initialize Deepgram TTS connection
      const dgConnection = deepgram.speak.live({
        model: 'aura-stella-en',
        encoding: 'linear16',
        sample_rate: 48000,
      });

      const audioChunks: Uint8Array[] = [];

      dgConnection.on(LiveTTSEvents.Open, () => {
        dgConnection.sendText(text);
        dgConnection.flush();
        // setTimeout(() => dgConnection.flush(), 1000);
      });

      dgConnection.on(LiveTTSEvents.Audio, (data) => {
        audioChunks.push(new Uint8Array(data));
      });

      dgConnection.on(LiveTTSEvents.Flushed, () => {
        const audioBuffer = Buffer.concat(audioChunks);
        if (audioBuffer.length > 0) {
          socket.emit('ttsAudio', audioBuffer.buffer);
          socket.emit('stream', { data: text, status: processKilled });
        }
        // dgConnection.close();
        resolve(); // Signal that TTS processing is done
      });

      dgConnection.on(LiveTTSEvents.Error, (err) => {
        console.error('❌ TTS Error:', err);
        // dgConnection.close();
        reject(err);
      });
    });
  }
}
