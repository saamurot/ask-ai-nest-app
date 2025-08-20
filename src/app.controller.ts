import { Controller, Get, Post, Body, UseInterceptors, UploadedFile } from '@nestjs/common';
import { AppService } from './app.service';
import { VectorService } from './vector/vector.service';
import { FileInterceptor } from '@nestjs/platform-express';
import { SessionService } from './session/session.service';
import axios from 'axios';
const mammoth = require('mammoth');
const pdf = require('pdf-parse');

@Controller()
export class AppController {

  constructor(
    private vector: VectorService,
    private openai: AppService,
    private session: SessionService,
  ) { }

  @Get()
  async getHello() {
    // await this.vector.addDocument('doc1', 'Our company allows 12 annual leaves per year.');
    // await this.vector.addDocument('doc2', 'Service Incentive Leave (SIL) : 5 days of paid leave per year after one year of service. This can be used for personal, vacation, or emergency purposes. Unused SIL may be converted to cash at year-end. ');
    return this.openai.getHello();
  }

  @Post('chat')
  async chat(@Body('message') message: string, @Body('userId') userId: string) {

    const lower = message.toLowerCase().trim();
    if (['cancel', 'stop', 'reset'].includes(lower)) {
      this.session.clearSession(userId);
      return { answer: 'I’ve cleared the current request. How can I assist you further?' };
    }

    const session = this.session.getSession(userId);

    // If user is in leave workflow
    if (session.intent === 'apply_leave') {
      if (session.status === 'waiting_for_dates') {
        const dateRegex = /\d{4}-\d{2}-\d{2}/g;
        const dates = message.match(dateRegex);

        if (dates) {
          session.collectedData['dates'] = dates;
          this.session.updateSession(userId, { status: 'done' });
          return { answer: `✅ Leave applied for: ${dates.join(', ')}` };
        } else {
          return { answer: 'Please provide leave dates in YYYY-MM-DD format. If you would like to cancel the request, Just reply cancel.' };
        }
      }
    }

    if (session.intent === 'apply_ot') {
      if (session.status === 'waiting_for_ot_date') {
        const dateRegex = /\d{4}-\d{2}-\d{2}/g;
        const dates = message.match(dateRegex);
        if (dates) {
          session.collectedData['date'] = dates[0];
          this.session.updateSession(userId, { status: 'waiting_for_ot_hours' });
          return { answer: 'Got it 👍 Now tell me how many hours of OT you worked. If you would like to cancel the request, Just reply cancel.' };
        } else {
          return { answer: 'Please provide the OT date in YYYY-MM-DD format. If you would like to cancel the request, Just reply cancel.' };
        }
      }

      if (session.status === 'waiting_for_ot_hours') {
        const hoursRegex = /\d+/;
        const hours = message.match(hoursRegex);
        if (hours) {
          session.collectedData['hours'] = hours[0];
          this.session.updateSession(userId, { status: 'done' });
          return { answer: `✅ Overtime applied for ${session.collectedData['date']} with ${hours[0]} hours.` };
        } else {
          return { answer: 'Please provide OT hours as a number (e.g., 3). If you would like to cancel the request, Just reply cancel.' };
        }
      }
    }

    // Detect intent
    const intent = this.openai.detectIntent(message);

    if (intent === 'apply_leave') {
      this.session.updateSession(userId, { intent: 'apply_leave', status: 'waiting_for_dates' });
      return { answer: 'Sure! Please provide your leave dates (e.g., 2025-08-21 to 2025-08-23). If you would like to cancel the request, Just reply cancel.' };
    }

    if (intent === 'leave_balance') {
      const res = await axios.get(`${process.env.API_HOST}Requests/GetStaffLeaveBalanceByEmployeeID?EmployeeID=${userId}`);
      let html = 'Your leave balances are as follows<br><table border="1" cellspacing="0" cellpadding="5">';
      html += '<thead><tr>';

      // Table headers
      Object.keys(res.data[0]).forEach((key) => {
        html += `<th style='text-transform: capitalize;border: 1px solid black;'>${key}</th>`;
      });
      html += '</tr></thead>';

      // Table rows
      html += '<tbody>';
      res.data.forEach((row) => {
        html += '<tr>';
        Object.values(row).forEach((val) => {
          html += `<td style='border: 1px solid black;'>${val}</td>`;
        });
        html += '</tr>';
      });
      html += '</tbody></table>';

      return { answer: html };
    }

    if (intent === 'leave_list') {
      const res = await axios.get(`${process.env.API_HOST}Requests/GetStaffLeavesByEmployeeID?EmployeeID=${userId}`);
      let html = 'Your leaves are as follows<br><table border="1" cellspacing="0" cellpadding="5">';
      html += '<thead><tr>';

      // Table headers
      Object.keys(res.data[0]).forEach((key) => {
        html += `<th style='text-transform: capitalize;border: 1px solid black;'>${key}</th>`;
      });
      html += '</tr></thead>';

      // Table rows
      html += '<tbody>';
      res.data.forEach((row) => {
        html += '<tr>';
        Object.values(row).forEach((val) => {
          html += `<td style='border: 1px solid black;'>${val}</td>`;
        });
        html += '</tr>';
      });
      html += '</tbody></table>';

      return { answer: html };
    }

    if (intent === 'notification_list') {
      const res = await axios.get(`${process.env.API_HOST}Attendence/GetNotificationsByEmployeeID?EmployeeID=${userId}`);
      let html = 'Your notifications are as follows<br><table border="1" cellspacing="0" cellpadding="5">';
      html += '<thead><tr>';

      // Table headers
      Object.keys(res.data[0]).forEach((key) => {
        html += `<th style='text-transform: capitalize;border: 1px solid black;'>${key}</th>`;
      });
      html += '</tr></thead>';

      // Table rows
      html += '<tbody>';
      res.data.forEach((row) => {
        html += '<tr>';
        Object.values(row).forEach((val) => {
          html += `<td style='border: 1px solid black;'>${val}</td>`;
        });
        html += '</tr>';
      });
      html += '</tbody></table>';

      return { answer: html };
    }

    if (intent === 'apply_ot') {
      this.session.updateSession(userId, { intent: 'apply_ot', status: 'waiting_for_ot_date' });
      return { answer: 'Okay! Please provide the OT date (e.g., 2025-08-21). If you would like to cancel the request, Just reply cancel.' };
    }

    // Otherwise → RAG + OpenAI fallback
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
