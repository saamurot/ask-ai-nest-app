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

    // Detect intent
    const intent = this.openai.detectIntent(message);

    if (intent === 'holiday_list') {
      const res = await axios.get(`${process.env.API_HOST}Requests/GetHolidaysByDate?Startdate=2024-03-20&Enddate=2025-03-20`);
      if (res.data.length > 0) {
        let html = 'Your holidays are as follows<br><table border="1" cellspacing="0" cellpadding="5">';
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
      else {
        return { answer: "No data available." };
      }
    }

    if (intent === 'announcement_list') {
      const res = await axios.get(`${process.env.API_HOST}Requests/GetAnnouncementsBySDate?Startdate=2024-03-20&Enddate=2025-03-20`);
      if (res.data.length > 0) {
        let html = 'Below are the announcements<br><table border="1" cellspacing="0" cellpadding="5">';
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
      else {
        return { answer: "No data available." };
      }
    }

    if (intent === 'notification_list') {
      const res = await axios.get(`${process.env.API_HOST}Attendence/GetNotificationsByEmployeeID?EmployeeID=${userId}`);
      if (res.data.length > 0) {
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
      else {
        return { answer: "No data available." };
      }
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

    if (intent === 'apply_leave') {
      // this.session.updateSession(userId, { intent: 'apply_leave', status: 'waiting_for_dates' });
      // return { answer: 'Sure! Please provide your leave dates (e.g., 2025-08-21 to 2025-08-23). If you would like to cancel the request, Just reply cancel.' };
      this.session.updateSession(userId, { intent: 'apply_leave', status: 'waiting_for_leavetype' });
      return { answer: `Sure! Please provide what type of leave you want to apply. Here is the leave type list : <br><b>${this.getleaveTypes().map(x => x.leaveType).join(", ")}</b>.<br><br> If you would like to cancel the request, Just reply cancel.` };
    }

    if (session.intent === 'apply_leave') {

      if (session.status === 'waiting_for_leavetype') {
        let leaveTypeID = this.isLeaveTypeAvailable(message);
        if (leaveTypeID) {
          session.collectedData['leaveTypeID'] = leaveTypeID.id;
          session.collectedData['leaveType'] = leaveTypeID.leaveType;
          this.session.updateSession(userId, { intent: 'apply_leave', status: 'waiting_for_dates' });
          return { answer: 'Sure! Please provide your leave dates (e.g., 2025-08-21 to 2025-08-23).<br><br> If you would like to cancel the request, Just reply cancel.' };
        } else {
          return { answer: 'Please provide a valid leave type from the list. <br><br>If you would like to cancel the request, Just reply cancel.' };
        }
      }

      if (session.status === 'waiting_for_dates') {
        const dateRegex = /\d{4}-\d{2}-\d{2}/g;
        const dates = message.match(dateRegex);

        if (dates) {
          session.collectedData['dates'] = dates;
          this.session.updateSession(userId, { intent: 'apply_leave', status: 'waiting_for_reason' });
          return { answer: 'Sure! Please provide reason for you leave.<br><br> If you would like to cancel the request, Just reply cancel.' };
        } else {
          return { answer: 'Please provide leave dates in YYYY-MM-DD format. If you would like to cancel the request, Just reply cancel.' };
        }
      }

      if (session.status === 'waiting_for_reason') {

        if (message) {
          session.collectedData['reason'] = message;
          if (session.collectedData['dates'][0] == session.collectedData['dates'][1]) {
            this.session.updateSession(userId, { intent: 'apply_leave', status: 'waiting_for_halfday' });
            return { answer: 'Perfect! Is this a half day leave<br>Reply <b>Yes</b> or <b>No</b>.<br><br> If you would like to cancel the request, Just reply cancel.' };
          }
          else {
            this.session.updateSession(userId, { status: 'done' });
            await this.applyLeave(userId, session.collectedData);
            return { answer: `✅ Leave applied with below details: <br><b>Leave Type</b> : ${session.collectedData['leaveType']}<br><b>Date</b> : ${session.collectedData['dates'].join(' to ')}<br><b>Date</b> : ${session.collectedData['reason']}` };
          }
        } else {
          return { answer: 'Please provide a valid reason.<br><br> If you would like to cancel the request, Just reply cancel.' };
        }
      }

      if (session.status === 'waiting_for_halfday') {
        if (message.toLowerCase() == "yes") {
          session.collectedData['halfDay'] = message.toLowerCase();
          this.session.updateSession(userId, { intent: 'apply_leave', status: 'waiting_for_halfdaytype' });
          return { answer: 'Noted! Is this leave for the first half or second half?<br>Reply <b>First</b> or <b>Second</b>.<br><br> If you would like to cancel the request, Just reply cancel.' };

        }
        else if (message.toLowerCase() == "no") {
          session.collectedData['halfDay'] = message.toLowerCase();
          this.session.updateSession(userId, { status: 'done' });
          await this.applyLeave(userId, session.collectedData);
          return { answer: `✅ Leave applied with below details: <br><b>Leave Type</b> : ${session.collectedData['leaveType']}<br><b>Date</b> : ${session.collectedData['dates'].join(' to ')}<br><b>Date</b> : ${session.collectedData['reason']}` };
        } else {
          return { answer: 'Please provide a valid reply.<br><br> If you would like to cancel the request, Just reply cancel.' };
        }
      }

      if (session.status === 'waiting_for_halfdaytype') {
        if (message.toLowerCase() == "first" || message.toLowerCase() == "second") {
          session.collectedData['halfdaytype'] = message.toLowerCase();
          this.session.updateSession(userId, { status: 'done' });
          await this.applyLeave(userId, session.collectedData);
          return { answer: `✅ Leave applied with below details: <br><b>Leave Type</b> : ${session.collectedData['leaveType']}<br><b>Date</b> : ${session.collectedData['dates'].join(' to ')}<br><b>Date</b> : ${session.collectedData['reason']}<br><b>Half Day</b> : ${session.collectedData['halfDay']}<br><b>Half Day Type</b> : ${session.collectedData['halfdaytype']}` };
        } else {
          return { answer: 'Please provide a valid reply.<br><br> If you would like to cancel the request, Just reply cancel.' };
        }
      }
      console.log(JSON.stringify(session.collectedData));
    }

    if (intent === 'apply_ot') {
      this.session.updateSession(userId, { intent: 'apply_ot', status: 'waiting_for_ot_date' });
      return { answer: 'Okay! Please provide the OT date (e.g., 2025-08-21). If you would like to cancel the request, Just reply cancel.' };
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
          return { answer: `✅ Overtime applied for ${session.collectedData['date']} with ${hours[0]} hours.<br><b>This api is yet to be binded. OT is just a UX flow</b>` };
        } else {
          return { answer: 'Please provide OT hours as a number (e.g., 3). If you would like to cancel the request, Just reply cancel.' };
        }
      }
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

  getleaveTypes() {
    return [
      { id: 1, leaveType: "Sick Leave" },
      { id: 2, leaveType: "Vacation Leave" },
      { id: 3, leaveType: "Maternity Leave" },
      { id: 4, leaveType: "Paternity Leave" },
      { id: 5, leaveType: "Bereavement Leave" },
      { id: 6, leaveType: "Solo Parent Leave" },
      { id: 7, leaveType: "Special Leave for Women" },
      { id: 8, leaveType: "Leave for Victims against Women and their Children" },
      { id: 9, leaveType: "Authorized Leave without Pay" },
      { id: 11, leaveType: "Work From Home" },
      { id: 12, leaveType: "Maternity Leave (Miscarriage)" },
      { id: 13, leaveType: "Leave Without Pay" },
      { id: 14, leaveType: "Time Off In Lieu" },
      { id: 15, leaveType: "Business Trip" },
      { id: 16, leaveType: "Compensatory Leave" }
    ];
  }

  isLeaveTypeAvailable(input) {
    let leaveTypes = this.getleaveTypes();
    return leaveTypes.find(leave => leave.leaveType.toLowerCase() === input.toLowerCase()) || null;
  }

  async applyLeave(userId: string, data: any) {
    let numberODays: any;
    let halfDayType: any;
    const d1: any = new Date(data["dates"][0]);
    const d2: any = new Date(data["dates"][1]);

    // Difference in milliseconds
    const diffTime = d2 - d1;

    // Convert to days and add 1 for inclusiveness
    if (data["dates"][0] != data["dates"][1]) {
      numberODays = diffTime / (1000 * 60 * 60 * 24) + 1;
    }
    else {
      numberODays = 0.5; // For half-day leave
    }

    if (numberODays == 0.5) {
      halfDayType = data["halfdaytype"] == "first" ? "First Half" : "Second Half";
    }
    else {
      halfDayType = "NA"
    }

    var etty = {
      "EmployeeID": userId,
      "LeaveTypeID": data['leaveTypeID'],
      "StartDate": data["dates"][0],
      "EndDate": data["dates"][1],
      "LeaveReason": data['reason'],
      "AttachmentURL": "NA",
      "StatusID": 1,
      "NumberofDays": numberODays,
      "HalfDayType": halfDayType
    };
    console.log("leave body", etty);
    const res = await axios.post(`${process.env.API_HOST}Requests/InsertStaffLeavesByEmployeeID`, etty);
    return;
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
