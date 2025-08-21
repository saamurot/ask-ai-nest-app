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
    return 'Server is Alive!';
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

  detectIntent(message: string): string {
    const lower = message.toLowerCase();

    if (lower.includes('holiday')) return 'holiday_list';
    if (lower.includes('announcement')) return 'announcement_list';
    if (lower.includes('notification')) return 'notification_list';
    if (lower.includes('leave') && lower.includes('balance')) return 'leave_balance';
    if (lower.includes('apply') && lower.includes('leave')) return 'apply_leave';
    if (lower.includes('leaves')) return 'leave_list';
    if (lower.includes('apply') && (lower.includes('overtime') || lower.includes('ot'))) return 'apply_ot';
    if (lower.includes('apply') && (lower.includes('acr') || lower.includes('attendance correction'))) return 'apply_acr';

    return 'general';
  }

}
