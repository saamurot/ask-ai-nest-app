import { Injectable } from '@nestjs/common';
import OpenAI from 'openai';

@Injectable()
export class TtsService {
    private openai: OpenAI;

    constructor() {
        this.openai = new OpenAI({
            apiKey: process.env.API_KEY,
        });
    }

    async textToSpeech(text: string): Promise<string> {
        const response = await this.openai.audio.speech.create({
            model: "gpt-4o-mini-tts",
            voice: "alloy",
            input: text,
        });

        // Convert to base64 string
        const buffer = Buffer.from(await response.arrayBuffer());
        const base64 = buffer.toString("base64");

        return `data:audio/mpeg;base64,${base64}`;
    }
}
