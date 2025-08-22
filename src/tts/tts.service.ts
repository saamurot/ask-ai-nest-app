import { Injectable } from '@nestjs/common';
import OpenAI from 'openai';
const gTTS = require("gtts");
import { Readable } from "stream";

@Injectable()
export class TtsService {
    private openai: OpenAI;

    constructor() {
        this.openai = new OpenAI({
            apiKey: process.env.API_KEY,
        });
    }

    async textToSpeechOpenAI(text: string): Promise<string> {
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

    async textToSpeechGoogle(text: string): Promise<string> {
        return new Promise((resolve, reject) => {
            try {
                const gtts = new gTTS(text, "en", false); // "en" = English
                const chunks: Buffer[] = [];

                const stream: Readable = gtts.stream();
                stream.on("data", (chunk: Buffer) => chunks.push(chunk));
                stream.on("end", () => {
                    const buffer = Buffer.concat(chunks);
                    const base64 = buffer.toString("base64");
                    resolve(base64);
                });
                stream.on("error", (err) => reject(err));
            } catch (error) {
                reject(error);
            }
        });
    }
}
