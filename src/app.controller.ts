import { Controller, Get, Post, Body, UseInterceptors, UploadedFile } from '@nestjs/common';
import { AppService } from './app.service';
import { VectorService } from './vector/vector.service';
import { FileInterceptor } from '@nestjs/platform-express';
import { SessionService } from './session/session.service';
import axios from 'axios';
import { OpenAiService } from './open-ai/open-ai.service';
import { TtsService } from './tts/tts.service';
import { IntentService } from './intent/intent.service';

const mammoth = require('mammoth');
const pdf = require('pdf-parse');

@Controller()
export class AppController {

  constructor(
    private vector: VectorService,
    private openai: OpenAiService,
    private app: AppService,
    private session: SessionService,
    private ttsService: TtsService,
    private intent: IntentService
  ) { }

  @Get()
  async getHello() {
    // await this.vector.addDocument('doc1', 'Our company allows 12 annual leaves per year.');
    // await this.vector.addDocument('doc2', 'Service Incentive Leave (SIL) : 5 days of paid leave per year after one year of service. This can be used for personal, vacation, or emergency purposes. Unused SIL may be converted to cash at year-end. ');
    return this.app.getHello();
  }

  @Get('deleteVectorData')
  async deleteVectorData() {
    return this.vector.deleteVectorData();
  }

  @Get('getVectorCount')
  async getVectorCount() {
    return this.vector.getVectorCount();
  }

  @Post('chat')
  async chat(@Body('message') message: string, @Body('userId') userId: string) {
    return await this.intent.processData(message, userId);
  }

  @Post('generateTTS')
  async generateTTS(@Body('text') text: string, @Body('type') type: string) {
    if (type == "openai") {
      const audioBase64 = await this.ttsService.textToSpeechOpenAI(text);
      return { audioBase64 };
    }
    else {
      const audioBase64 = await this.ttsService.textToSpeechGoogle(text);
      let resp = `data:audio/mp3;base64,${audioBase64}`
      return { audioBase64: resp };
    }
  }

  @Post('transcribe')
  async transcribe(@Body('base64Audio') base64Audio: string, @Body('userId') userId: string) {
    const text = await this.ttsService.speechToTextOpenAI(base64Audio);
    return await this.intent.processData(text, userId);
  }

  // Upload Word file
  @Post('upload-docx')
  @UseInterceptors(FileInterceptor('file'))
  async uploadDocx(@UploadedFile() file: Express.Multer.File) {
    // Extract text
    const result = await mammoth.extractRawText({ buffer: file.buffer });
    const chunks = this.chunkText(result.value);

    for (let i = 0; i < chunks.length; i++) {
      await this.vector.addDocument(`docx_${Date.now()}_${i}`, chunks[i]);
    }

    return { message: 'Word file indexed successfully', chunks: chunks.length };
  }

  @Post('upload-pdf')
  @UseInterceptors(FileInterceptor('file'))
  async uploadPdf(@UploadedFile() file: Express.Multer.File) {
    const data = await pdf(file.buffer);
    const text = data.text;
    const chunks = this.chunkText(text);

    for (let i = 0; i < chunks.length; i++) {
      await this.vector.addDocument(`pdf_${Date.now()}_${i}`, chunks[i]);
    }

    return { message: 'PDF file indexed successfully', chunks: chunks.length };
  }

  chunkText(text: string, chunkSize = 500) {
    const words = text.split(/\s+/);
    const chunks = [];
    for (let i = 0; i < words.length; i += chunkSize) {
      chunks.push(words.slice(i, i + chunkSize).join(' '));
    }
    return chunks;
  }

}
