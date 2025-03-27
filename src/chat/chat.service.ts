import { DeepgramClient } from '@deepgram/sdk';
import { Injectable } from '@nestjs/common';
import { OpenAI } from 'openai';
import { ChatCompletionMessageParam } from 'openai/resources/chat';
import { Stream } from 'openai/streaming';
import { Socket } from 'socket.io';

@Injectable()
export class ChatServiceWithOpenAi {
  private openai: OpenAI;
  private assistantId: string; // Store in environment variables
  private threadId: string;
  private runId: string;
  private history: ChatCompletionMessageParam[] = [];
  private processKilled = false;
  private stream: Stream<OpenAI.Beta.Assistants.AssistantStreamEvent> & {
    _request_id?: string | null;
  };
  private num: number;
  private runActive = false;
  private userInput: string;
  private ttsQueue: string[] = []; // Queue to store text in correct order
  private isPlaying = false;
  private runState: string;

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  killProcess() {
    console.log('killProcess called');
    // this.num = 0;
    this.processKilled = true;
  }

  async handleUserInput(
    userMessage: string,
    socket: Socket,
    ttsFunction,
    deepgram,
  ) {
    let fullText = '';
    let ttsBuffer = '';
    if (this.history.length === 0) {
      this.history.push({
        role: 'system',
        content: `You are an AI voice assistant, specializing in inventory management. Your role is to help users check stock levels, notify about low stock, and suggest alternative products when necessary. You have access to live inventory data and can assist with stock inquiries efficiently. If a product is out of stock, you can provide similar alternatives or notify the user about the restocking schedule. Keep responses clear, concise, and helpful.`,
      });

      this.history.push({
        role: 'user',
        content: `i am owning a company which has this product so when i tell you to update the you should update the product {
  "inventory": [
    {
      "product_id": "P001",
      "name": "Wireless Headphones",
      "category": "Electronics",
      "stock": 5,
      "reorder_level": 2,
      "price": 79.99,
      "alternatives": ["Bluetooth Earbuds", "Wired Headphones"]
    },
    {
      "product_id": "P002",
      "name": "Gaming Keyboard",
      "category": "Accessories",
      "stock": 2,
      "reorder_level": 3,
      "price": 49.99,
      "alternatives": ["Mechanical Keyboard", "Standard Keyboard"]
    },
    {
      "product_id": "P003",
      "name": "Mechanical Keyboard",
      "category": "Accessories",
      "stock": 10,
      "reorder_level": 3,
      "price": 69.99,
      "alternatives": ["Gaming Keyboard", "Standard Keyboard"]
    },
    {
      "product_id": "P004",
      "name": "Bluetooth Mouse",
      "category": "Accessories",
      "stock": 0,
      "reorder_level": 5,
      "price": 29.99,
      "alternatives": ["Wireless Mouse", "USB Optical Mouse"]
    },
    {
      "product_id": "P005",
      "name": "USB-C Charger",
      "category": "Chargers",
      "stock": 7,
      "reorder_level": 3,
      "price": 19.99,
      "alternatives": ["Wireless Charger", "Fast Charger"]
    },
    {
      "product_id": "P006",
      "name": "Laptop Stand",
      "category": "Office Supplies",
      "stock": 1,
      "reorder_level": 2,
      "price": 34.99,
      "alternatives": ["Adjustable Laptop Stand", "Cooling Pad"]
    },
    {
      "product_id": "P007",
      "name": "Noise Cancelling Earbuds",
      "category": "Electronics",
      "stock": 4,
      "reorder_level": 2,
      "price": 59.99,
      "alternatives": ["Wireless Earbuds", "Over-Ear Headphones"]
    },
    {
      "product_id": "P008",
      "name": "Smartphone Tripod",
      "category": "Photography",
      "stock": 6,
      "reorder_level": 3,
      "price": 24.99,
      "alternatives": ["Flexible Tripod", "Gimbal Stabilizer"]
    },
    {
      "product_id": "P009",
      "name": "External Hard Drive",
      "category": "Storage",
      "stock": 3,
      "reorder_level": 2,
      "price": 89.99,
      "alternatives": ["SSD External Drive", "USB Flash Drive"]
    },
    {
      "product_id": "P010",
      "name": "Smartwatch",
      "category": "Wearables",
      "stock": 8,
      "reorder_level": 3,
      "price": 149.99,
      "alternatives": ["Fitness Band", "Analog Smartwatch"]
    }
  ]
}`,
      });
    }

    this.history.push({ role: 'user', content: userMessage });

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: this.history,
        stream: true,
      });

      for await (const chunk of response) {
        if (this.processKilled) {
          console.log('Process killed. Stopping AI response.');
          this.processKilled = false;
          response.controller.abort();
          return;
        }

        const chunkText = chunk.choices[0]?.delta?.content || '';
        if (chunkText) {
          fullText += chunkText;
          ttsBuffer += chunkText;

          if (/(?<!\d)\.(?!\d|\w)|[!?]\s*$/.test(chunkText)) {
            this.ttsQueue.push(ttsBuffer);
            ttsBuffer = '';

            // console.log('Response:', fullText);
            if (this.processKilled) {
              console.log('Process killed. Stopping AI response.');
              this.processKilled = false;
              return;
            }

            await this.processTTSQueue(
              socket,
              ttsFunction,
              deepgram,
              this.processKilled ? 'killed' : 'notKilled',
            );
            this.userInput = '';
          }
        }
      }

      // Ensure last part of the response is spoken
      // if (ttsBuffer) {
      //   this.ttsQueue.push(ttsBuffer);
      //   await this.processTTSQueue(socket, ttsFunction, deepgram);
      // }

      this.history.push({ role: 'assistant', content: fullText });
    } catch (error) {
      console.error('❌ Error in AI response:', error);
      socket.emit('error', 'An error occurred while processing your request.');
    }
  }

  async processTTSQueue(
    socket: Socket,
    ttsFunction,
    deepgram: DeepgramClient,
    processKilled: string,
  ) {
    if (this.isPlaying || this.ttsQueue.length === 0) return;

    this.isPlaying = true;
    while (this.ttsQueue.length > 0) {
      const nextText = this.ttsQueue.shift();
      if (nextText)
        await ttsFunction(socket, nextText, deepgram, processKilled);
    }
    this.isPlaying = false;
  }

  async chatWithAI(
    userInput: string,
    socket: Socket,
    ttsFunction,
    deepgram: DeepgramClient,
  ) {
    try {
      // const runId = await this.startRun(threadId);

      this.userInput = userInput;

      await this.handleUserInput(this.userInput, socket, ttsFunction, deepgram);
    } catch (error) {
      console.error('❌ Error in AI response:', error);
      socket.emit('error', 'An error occurred while processing your request.');
    }
  }
}
