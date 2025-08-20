import { Controller, Get, Post, Body, UseInterceptors, UploadedFile } from '@nestjs/common';
import { AppService } from './app.service';
import { VectorService } from './vector/vector.service';
import { FileInterceptor } from '@nestjs/platform-express';
const mammoth = require('mammoth');
const pdf = require('pdf-parse');

@Controller()
export class AppController {

  constructor(
    private vector: VectorService,
    private openai: AppService,
  ) { }

  @Get()
  async getHello() {
    // await this.vector.addDocument('doc1', 'Our company allows 12 annual leaves per year.');
    // await this.vector.addDocument('doc2', 'Service Incentive Leave (SIL) : 5 days of paid leave per year after one year of service. This can be used for personal, vacation, or emergency purposes. Unused SIL may be converted to cash at year-end. ');
    return this.openai.getHello();
  }

  @Post()
  async chat(@Body('message') message: string) {
    const docs = await this.vector.query(message, 3);
    const context = docs.join('\n');
    const answer = await this.openai.chatWithContext(context, message);
    return { answer };
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

  @Get('deleteVectorData')
  async deleteVectorData() {
    return this.vector.deleteVectorData();
  }

  @Get('getVectorCount')
  async getVectorCount() {
    return this.vector.getVectorCount();
  }

}
