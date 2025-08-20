import { Injectable } from '@nestjs/common';
import OpenAI from 'openai';

@Injectable()
export class AppService {
  private client: OpenAI;

  constructor() {
    this.client = new OpenAI({
      apiKey: process.env.API_KEY,
    });
  }

  getHello(): string {
    return 'Hello World!';
  }

  async getEmbedding(text: string): Promise<number[]> {
    const response = await this.client.embeddings.create({
      model: 'text-embedding-3-small',
      input: text,
    });
    return response.data[0].embedding;
  }

  async chatWithContext(context: string, question: string): Promise<string> {
    const completion = await this.client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are a helpful assistant. Use only provided context to answer.' },
        { role: 'user', content: `Context:\n${context}\n\nQuestion: ${question}` },
      ],
    });

    return completion.choices[0].message.content || '';
    // const messages: { role: 'system' | 'user' | 'assistant'; content: string }[] = [];

    // if (context && context.trim().length > 0) {
    //   messages.push(
    //     { role: 'system', content: 'Answer only from the provided context.' },
    //     { role: 'user', content: `Context:\n${context}\n\nQuestion: ${question}` }
    //   );
    // } else {
    //   messages.push(
    //     { role: 'system', content: 'You are a helpful assistant.' },
    //     { role: 'user', content: question }
    //   );
    // }

    // const completion = await this.client.chat.completions.create({
    //   model: 'gpt-4o-mini',
    //   messages,
    // });

    // return completion.choices[0].message.content || '';
  }
}
