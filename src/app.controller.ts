import { Controller, Get, Post, Body, UseInterceptors, UploadedFile } from '@nestjs/common';
import { AppService } from './app.service';
import { VectorService } from './vector/vector.service';
import { FileInterceptor } from '@nestjs/platform-express';
import { SessionService } from './session/session.service';
import axios from 'axios';
import { OpenAiService } from './open-ai/open-ai.service';
import { TtsService } from './tts/tts.service';
const mammoth = require('mammoth');
const pdf = require('pdf-parse');

@Controller()
export class AppController {

  constructor(
    private vector: VectorService,
    private openai: OpenAiService,
    private app: AppService,
    private session: SessionService,
    private ttsService: TtsService
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

    const lower = message.toLowerCase().trim();
    if (['cancel', 'stop', 'reset'].includes(lower)) {
      this.session.clearSession(userId);
      return { answer: 'I’ve cleared the current request. How can I assist you further?' };
    }

    const session = this.session.getSession(userId);

    // Detect intent
    const intent = this.openai.detectIntent(message);

    if (intent === 'holiday_list') {
      const res = await axios.get(`${process.env.API_HOST}Chat/GetHolidaysByDate?Startdate=2024-03-20&Enddate=2025-03-20`);
      if (res.data.length > 0) {
        let formattedData = await this.formatData(res.data);
        return { answer: `Your holidays are as follows<br>${formattedData}` };
      }
      else {
        return { answer: "No data available." };
      }
    }

    if (intent === 'announcement_list') {
      const res = await axios.get(`${process.env.API_HOST}Chat/GetAnnouncementsBySDate?Startdate=2024-03-20&Enddate=2025-03-20`);
      if (res.data.length > 0) {
        let formattedData = await this.formatData(res.data);
        return { answer: `Your announcements are as follows<br>${formattedData}` };
      }
      else {
        return { answer: "No data available." };
      }
    }

    if (intent === 'notification_list') {
      const res = await axios.get(`${process.env.API_HOST}Chat/GetNotificationsByEmployeeID?EmployeeID=${userId}`);
      if (res.data.length > 0) {
        let formattedData = await this.formatData(res.data, 'small_card');
        return { answer: `Your notifications are as follows<br>${formattedData}` };
      }
      else {
        return { answer: "No data available." };
      }
    }

    if (intent === 'leave_balance') {
      const res = await axios.get(`${process.env.API_HOST}Chat/GetStaffLeaveBalanceByEmployeeID?EmployeeID=${userId}`);
      if (res.data.length > 0) {
        let formattedData = await this.formatData(res.data);
        return { answer: `Your leave balances are as follows<br>${formattedData}` };
      }
      else {
        return { answer: "No data available." };
      }
    }

    if (intent === 'leave_list') {
      const res = await axios.get(`${process.env.API_HOST}Chat/GetStaffLeavesByEmployeeID?EmployeeID=${userId}`);
      if (res.data.length > 0) {
        let formattedData = await this.formatData(res.data);
        return { answer: `Your leaves are as follows<br>${formattedData}` };
      }
      else {
        return { answer: "No data available." };
      }
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
            return { answer: `✅ Leave applied with below details: <br><b>Leave Type</b> : ${session.collectedData['leaveType']}<br><b>Date</b> : ${session.collectedData['dates'].join(' to ')}<br><b>Reason</b> : ${session.collectedData['reason']}` };
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
          return { answer: `✅ Leave applied with below details: <br><b>Leave Type</b> : ${session.collectedData['leaveType']}<br><b>Date</b> : ${session.collectedData['dates'].join(' to ')}<br><b>Reason</b> : ${session.collectedData['reason']}` };
        } else {
          return { answer: 'Please provide a valid reply.<br><br> If you would like to cancel the request, Just reply cancel.' };
        }
      }

      if (session.status === 'waiting_for_halfdaytype') {
        if (message.toLowerCase() == "first" || message.toLowerCase() == "second") {
          session.collectedData['halfdaytype'] = message.toLowerCase();
          this.session.updateSession(userId, { status: 'done' });
          await this.applyLeave(userId, session.collectedData);
          return { answer: `✅ Leave applied with below details: <br><b>Leave Type</b> : ${session.collectedData['leaveType']}<br><b>Date</b> : ${session.collectedData['dates'].join(' to ')}<br><b>Reason</b> : ${session.collectedData['reason']}<br><b>Half Day</b> : ${session.collectedData['halfDay']}<br><b>Half Day Type</b> : ${session.collectedData['halfdaytype']}` };
        } else {
          return { answer: 'Please provide a valid reply.<br><br> If you would like to cancel the request, Just reply cancel.' };
        }
      }
      console.log(JSON.stringify(session.collectedData));
    }

    if (intent === 'ot_list') {
      const res = await axios.get(`${process.env.API_HOST}Chat/GetEmployeeOTDetailsByEmployeeID?EmployeeID=${userId}`);
      if (res.data.length > 0) {
        let formattedData = await this.formatData(res.data);
        return { answer: `Your OT requests are as follows<br>${formattedData}` };
      }
      else {
        return { answer: "No data available." };
      }
    }

    if (intent === 'apply_ot') {
      this.session.updateSession(userId, { intent: 'apply_ot', status: 'waiting_for_ot_date' });
      return { answer: 'Okay! Please provide the OT date (e.g., 2025-08-21).<br><br> If you would like to cancel the request, Just reply cancel.' };
    }

    if (session.intent === 'apply_ot') {
      if (session.status === 'waiting_for_ot_date') {
        const dateRegex = /\d{4}-\d{2}-\d{2}/g;
        const dates = message.match(dateRegex);
        if (dates) {
          session.collectedData['date'] = dates[0];
          this.session.updateSession(userId, { status: 'waiting_for_ot_starttime' });
          return { answer: 'Got it 👍 Now tell me the start time of ot in HH:MM format. <br><br> If you would like to cancel the request, Just reply cancel.' };
        } else {
          return { answer: 'Please provide the OT date in YYYY-MM-DD format.<br><br> If you would like to cancel the request, Just reply cancel.' };
        }
      }

      if (session.status === 'waiting_for_ot_starttime') {
        const regex = /^([01]\d|2[0-3]):([0-5]\d)$/;
        let starttime = regex.test(message);
        if (starttime) {
          session.collectedData['starttime'] = message;
          this.session.updateSession(userId, { status: 'waiting_for_ot_endtime' });
          return { answer: 'Got it 👍 Now tell me the end time of ot in HH:MM (24 hour) format. <br><br> If you would like to cancel the request, Just reply cancel.' };
        } else {
          return { answer: 'Please provide start time of ot in HH:MM (24 hour) format.<br><br> If you would like to cancel the request, Just reply cancel.' };
        }
      }

      if (session.status === 'waiting_for_ot_endtime') {
        const regex = /^([01]\d|2[0-3]):([0-5]\d)$/;
        let endtime = regex.test(message);
        if (endtime) {
          session.collectedData['endtime'] = message;
          this.session.updateSession(userId, { status: 'waiting_for_ot_reason' });
          return { answer: 'Got it 👍 Now tell me the reason for OT.<br><br> If you would like to cancel the request, Just reply cancel.' };
        } else {
          return { answer: 'Please provide end time of ot in HH:MM (24 hour) format.<br><br> If you would like to cancel the request, Just reply cancel.' };
        }
      }

      if (session.status === 'waiting_for_ot_reason') {
        if (message) {
          session.collectedData['reason'] = message;
          await this.applyOT(userId, session.collectedData);
          this.session.updateSession(userId, { status: 'done' });
          return { answer: `✅ Overtime applied for ${session.collectedData['date']} from ${session.collectedData['starttime']} to ${session.collectedData['endtime']}.` };
        } else {
          return { answer: 'Please provide end time of ot in HH:MM (24 hour) format.<br><br> If you would like to cancel the request, Just reply cancel.' };
        }
      }
    }

    if (intent === 'acr_list') {
      const res = await axios.get(`${process.env.API_HOST}Chat/GetAttendenceCorrectionByEmployeeID?EmployeeID=${userId}`);
      if (res.data.length > 0) {
        let formattedData = await this.formatData(res.data);
        return { answer: `Your ACR requests are as follows<br>${formattedData}` };
      }
      else {
        return { answer: "No data available." };
      }
    }

    if (intent === 'apply_acr') {
      this.session.updateSession(userId, { intent: 'apply_acr', status: 'waiting_for_acr_date' });
      return { answer: 'Okay! Please provide the ACR date (e.g., 2025-08-21).<br><br> If you would like to cancel the request, Just reply cancel.' };
    }

    if (session.intent === 'apply_acr') {
      if (session.status === 'waiting_for_acr_date') {
        const dateRegex = /\d{4}-\d{2}-\d{2}/g;
        const dates = message.match(dateRegex);
        if (dates) {
          session.collectedData['date'] = dates[0];
          this.session.updateSession(userId, { status: 'waiting_for_acr_starttime' });
          return { answer: 'Got it 👍 Now tell me the start time of ACR in HH:MM format. <br><br> If you would like to cancel the request, Just reply cancel.' };
        } else {
          return { answer: 'Please provide the ACR date in YYYY-MM-DD format.<br><br> If you would like to cancel the request, Just reply cancel.' };
        }
      }

      if (session.status === 'waiting_for_acr_starttime') {
        const regex = /^([01]\d|2[0-3]):([0-5]\d)$/;
        let starttime = regex.test(message);
        if (starttime) {
          session.collectedData['starttime'] = message;
          this.session.updateSession(userId, { status: 'waiting_for_acr_endtime' });
          return { answer: 'Got it 👍 Now tell me the end time of ACR in HH:MM (24 hour) format. <br><br> If you would like to cancel the request, Just reply cancel.' };
        } else {
          return { answer: 'Please provide start time of ACR in HH:MM (24 hour) format.<br><br> If you would like to cancel the request, Just reply cancel.' };
        }
      }

      if (session.status === 'waiting_for_acr_endtime') {
        const regex = /^([01]\d|2[0-3]):([0-5]\d)$/;
        let endtime = regex.test(message);
        if (endtime) {
          session.collectedData['endtime'] = message;
          this.session.updateSession(userId, { status: 'waiting_for_acr_reason' });
          return { answer: 'Got it 👍 Now tell me the reason for ACR.<br><br> If you would like to cancel the request, Just reply cancel.' };
        } else {
          return { answer: 'Please provide end time of ACR in HH:MM (24 hour) format.<br><br> If you would like to cancel the request, Just reply cancel.' };
        }
      }

      if (session.status === 'waiting_for_acr_reason') {
        if (message) {
          session.collectedData['reason'] = message;
          await this.applyACR(userId, session.collectedData);
          this.session.updateSession(userId, { status: 'done' });
          return { answer: `✅ ACR applied for ${session.collectedData['date']} from ${session.collectedData['starttime']} to ${session.collectedData['endtime']}.` };
        } else {
          return { answer: 'Please provide end time of ACR in HH:MM (24 hour) format.<br><br> If you would like to cancel the request, Just reply cancel.' };
        }
      }
    }

    if (intent === 'pay_slip') {
      this.session.updateSession(userId, { intent: 'pay_slip', status: 'waiting_for_pay_slip_year' });
      return { answer: 'Okay! Please provide the year (e.g., 2025).<br><br> If you would like to cancel the request, Just reply cancel.' };
    }

    if (session.intent === 'pay_slip') {
      if (session.status === 'waiting_for_pay_slip_year') {
        const regex = /^(19|20)\d{2}$/;
        if (regex.test(message)) {
          session.collectedData['year'] = message;
          this.session.updateSession(userId, { status: 'waiting_for_pay_slip_month' });
          return { answer: 'Got it 👍 Now tell me the month you want the pay slip for (e.g., January, February, March). <br><br> If you would like to cancel the request, Just reply cancel.' };
        } else {
          return { answer: 'Please provide the valid year in YYYY format.<br><br> If you would like to cancel the request, Just reply cancel.' };
        }
      }

      if (session.status === 'waiting_for_pay_slip_month') {
        const months = [
          "january", "february", "march", "april", "may", "june",
          "july", "august", "september", "october", "november", "december"
        ];
        if (months.includes(message.toLowerCase())) {
          const index = months.indexOf(message.toLowerCase());
          const monthMap: Record<string, string> = {
            january: "1",
            february: "2",
            march: "3",
            april: "4",
            may: "5",
            june: "6",
            july: "7",
            august: "8",
            september: "9",
            october: "10",
            november: "11",
            december: "12"
          };
          session.collectedData['monthnumber'] = monthMap[message.toLowerCase()]
          const res = await this.getPaySlip(userId, session.collectedData);
          this.session.updateSession(userId, { status: 'done' });
          return { answer: res };
        } else {
          return { answer: 'Please provide valid month.<br><br> If you would like to cancel the request, Just reply cancel.' };
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

  @Post('generateTTS')
  async generateTTS(@Body('text') text: string) {
    const audioBase64 = await this.ttsService.textToSpeech(text);
    return { audioBase64 };
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
    console.log("leave payload", etty);
    const res = await axios.post(`${process.env.API_HOST}Chat/InsertStaffLeavesByEmployeeID`, etty);
    return;
  }

  async applyOT(userId: string, data: any) {
    var etty = {
      "OTDate": data["date"],
      "StartTime": data["date"] + " " + data["starttime"],
      "EndTime": data["date"] + " " + data["endtime"],
      "AttachmentURL": "NA",
      "Purpose": data['reason'],
      "EmployeeID": userId,
      "AppliedBy": "Self"
    };
    console.log("ot payload", etty);
    const res = await axios.post(`${process.env.API_HOST}Chat/InsertEmployeeOTDetailsByEmployeeID`, etty);
  }

  async applyACR(userId: string, data: any) {
    var etty = {
      "EmployeeID": userId,
      "Date": data["date"],
      "StartTime": data["date"] + " " + data["starttime"],
      "EndTime": data["date"] + " " + data["endtime"],
      "Comments": data['reason'],
      "Status": "Manager Pending",
      "WorkType": "Work From Home"
    };
    console.log("acr payload", etty);
    const res = await axios.post(`${process.env.API_HOST}Chat/InsertAttendenceCorrectionByEmployeeID`, etty);
  }

  async getPaySlip(userId: string, data: any) {
    try {
      let month = String(data["monthnumber"]).trim();
      let year = String(data["year"]).trim();
      let url = `${process.env.API_HOST}Chat/CheckPayslipByEmployeeID?EmployeeID=${userId}&Year=${year}&Month=${month}`;
      console.log("check url", url);
      // const res = await axios.get(url);
      const res = await axios.get(url, {
        headers: {
          Accept: "application/json",
        },
      });
      console.log("payslip response", res.data);
      if (res.data.message == "Success") {
        let resp = `<label><a href="${process.env.API_HOST}Payslips/${userId}/${year}/${month}/${userId}Payslip.pdf" target="_blank">Click here</a> to download the pay slip</label>`;
        console.log("pdf url", resp);
        return resp;
      }
      else {
        return "Pay slip is not available for the given year and month.";
      }
    }
    catch (ex) {
      return "Pay slip is not available for the given year and month.";
    }
  }





  //to be moved to app.service.ts later once all the logic is done
  formatData(data: any, type: any = "table") {
    if (type == "table") {
      let html = '<table border="1" cellspacing="0" cellpadding="5" style="width: 100%;">';
      html += '<thead><tr>';

      // Table headers
      Object.keys(data[0]).forEach((key) => {
        html += `<th style='text-transform: capitalize;border: 1px solid black;'>${key.replace(/([a-z])([A-Z])/g, '$1 $2')}</th>`;
      });
      html += '</tr></thead>';

      // Table rows
      html += '<tbody>';
      data.forEach((row) => {
        html += '<tr>';
        Object.values(row).forEach((val) => {
          html += `<td style='border: 1px solid black;'>${val}</td>`;
        });
        html += '</tr>';
      });
      html += '</tbody></table>';

      return html;
    }
    else if (type == 'small_card') {
      let html = `<div style="display: flex; flex-direction: row; flex-wrap: wrap; gap: 2%;">`;
      data.forEach(item => {
        let carditems = `<div class="card p-2 mb-3" style="width: 32%;"><table border="1" cellspacing="0" cellpadding="5">`;
        for (let key in item) {
          if (item.hasOwnProperty(key) && item[key] !== null) {
            carditems += "<tr>"
            carditems += `
             <th style='text-transform: capitalize;border: 1px solid black;'>
                ${key.replace(/([a-z])([A-Z])/g, '$1 $2')}:
              </th>
              <td style='border: 1px solid black;'>
                ${item[key]}
              </td>
          `;
            carditems += "</tr>"
          }
        }
        html += carditems + "</table></div>";
      });

      html += `</div>`;
      console.log(html);
      return html;
    }
  }

}
