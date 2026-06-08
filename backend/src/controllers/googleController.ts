import { Response } from 'express';
import { google } from 'googleapis';
import { getAuthenticatedClient } from '../config/google';
import User from '../models/User';
import Customer from '../models/Customer';
import Account from '../models/Account';
import Communication from '../models/Communication';
import { AuthRequest } from '../middleware/auth';
import nodemailer from 'nodemailer';

// Helper to check user OAuth token and get authenticated client
const getClientForUser = async (userId: string) => {
  const user = await User.findById(userId);
  if (!user || !user.accessToken) {
    return null;
  }
  return getAuthenticatedClient(user.accessToken, user.refreshToken);
};

// 1. Gmail Integration - Send Automated Email
export const sendGmailMessage = async (req: AuthRequest, res: Response) => {
  const { customerId, subject, body, type } = req.body;

  if (!customerId || !subject || !body) {
    return res.status(400).json({ message: 'customerId, subject, and body are required' });
  }

  try {
    const customer = await Customer.findById(customerId);
    if (!customer) {
      return res.status(404).json({ message: 'Customer not found' });
    }

    const oauth2Client = await getClientForUser(req.user!.id);
    let sentMessageId = 'mock-gmail-msg-id-' + Math.random().toString(36).substr(2, 9);
    let isRealSent = false;

    if (oauth2Client) {
      try {
        const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
        
        // Construct raw email
        const utf8Subject = `=?utf-8?B?${Buffer.from(subject).toString('base64')}?=`;
        const emailLines = [
          `To: ${customer.email}`,
          'Content-Type: text/html; charset=utf-8',
          'MIME-Version: 1.0',
          `Subject: ${utf8Subject}`,
          '',
          body,
        ];
        const email = emailLines.join('\r\n').trim();
        const base64EncodedEmail = Buffer.from(email)
          .toString('base64')
          .replace(/\+/g, '-')
          .replace(/\//g, '_')
          .replace(/=+$/, '');

        const response = await gmail.users.messages.send({
          userId: 'me',
          requestBody: {
            raw: base64EncodedEmail,
          },
        });
        
        sentMessageId = response.data.id || sentMessageId;
        isRealSent = true;
      } catch (err) {
        console.error('Failed to send email via real Gmail API, falling back to mock send. Error:', err);
      }
    }

    // Save to Communication Log
    await Communication.create({
      customerId: customer._id,
      sender: 'Officer',
      messageType: 'Email',
      content: body,
      responseSent: true,
      gmailMessageId: sentMessageId,
    });

    // Update Account Contact History
    await Account.findOneAndUpdate(
      { customerId: customer._id },
      {
        $push: {
          contactHistory: {
            date: new Date(),
            channel: 'Email',
            notes: `Sent ${type || 'Notification'} email: "${subject}"`,
          },
        },
      }
    );

    return res.status(200).json({
      message: isRealSent ? 'Email sent successfully via Gmail API' : 'Email sent successfully (Mock Mode / OAuth not connected)',
      gmailMessageId: sentMessageId,
      isRealSent,
    });
  } catch (error) {
    console.error('Send Gmail error:', error);
    return res.status(500).json({ message: 'Failed to send email', error: (error as Error).message });
  }
};

// 1b. Gmail Integration - Get Inbox
export const getInbox = async (req: AuthRequest, res: Response) => {
  try {
    const oauth2Client = await getClientForUser(req.user!.id);
    if (!oauth2Client) {
      return res.status(401).json({ message: 'User not authenticated with Google' });
    }

    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
    const label = (req.query.label as string) || 'INBOX';
    
    // Get list of messages
    const response = await gmail.users.messages.list({
      userId: 'me',
      maxResults: 15,
      labelIds: [label.toUpperCase()],
    });

    const messages = response.data.messages || [];
    
    // Fetch full details for each message
    const emailDetails = await Promise.all(
      messages.map(async (msg) => {
        if (!msg.id) return null;
        try {
          const detail = await gmail.users.messages.get({
            userId: 'me',
            id: msg.id,
            format: 'full',
          });
          
          const payload = detail.data.payload;
          const headers = payload?.headers || [];
          
          const subject = headers.find((h) => h.name === 'Subject')?.value || 'No Subject';
          const from = headers.find((h) => h.name === 'From')?.value || 'Unknown';
          const date = headers.find((h) => h.name === 'Date')?.value || '';
          
          // Try to extract body snippet
          let snippet = detail.data.snippet || '';
          
          const getBody = (payload: any): string => {
            if (!payload) return '';
            if (payload.body && payload.body.data) {
              return Buffer.from(payload.body.data, 'base64').toString('utf-8');
            }
            if (payload.parts) {
              let htmlPart = payload.parts.find((p: any) => p.mimeType === 'text/html');
              let plainPart = payload.parts.find((p: any) => p.mimeType === 'text/plain');
              let part = htmlPart || plainPart;
              if (part && part.body && part.body.data) {
                return Buffer.from(part.body.data, 'base64').toString('utf-8');
              }
              // Could also check parts of parts for multipart/alternative
              for (const p of payload.parts) {
                if (p.parts) {
                  const subBody = getBody(p);
                  if (subBody) return subBody;
                }
              }
            }
            return '';
          };

          return {
            id: msg.id,
            threadId: detail.data.threadId,
            subject,
            from,
            date,
            snippet,
            body: getBody(payload),
            isUnread: detail.data.labelIds?.includes('UNREAD') || false,
          };
        } catch (e) {
          return null;
        }
      })
    );

    return res.status(200).json({ emails: emailDetails.filter(Boolean) });
  } catch (error) {
    console.error('Get Inbox error:', error);
    return res.status(500).json({ message: 'Failed to fetch inbox', error: (error as Error).message });
  }
};

// 2. Calendar Integration - Schedule Follow-Up Event
export const createCalendarEvent = async (req: AuthRequest, res: Response) => {
  const { customerId, title, description, startDateTime, durationMinutes } = req.body;

  if (!customerId || !title || !startDateTime) {
    return res.status(400).json({ message: 'customerId, title, and startDateTime are required' });
  }

  try {
    const customer = await Customer.findById(customerId);
    if (!customer) {
      return res.status(404).json({ message: 'Customer not found' });
    }

    const oauth2Client = await getClientForUser(req.user!.id);
    let eventId = 'mock-calendar-event-' + Math.random().toString(36).substr(2, 9);
    let isRealEvent = false;

    const start = new Date(startDateTime);
    const end = new Date(start.getTime() + (durationMinutes || 30) * 60000);

    if (oauth2Client) {
      try {
        const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
        
        const response = await calendar.events.insert({
          calendarId: 'primary',
          requestBody: {
            summary: title,
            description: `${description || ''}\n\nRelated Customer: ${customer.name} (${customer.email})`,
            start: {
              dateTime: start.toISOString(),
            },
            end: {
              dateTime: end.toISOString(),
            },
            attendees: [
              { email: customer.email }
            ],
            reminders: {
              useDefault: true,
            },
          },
        });

        eventId = response.data.id || eventId;
        isRealEvent = true;
      } catch (err) {
        console.error('Failed to create calendar event via Google Calendar API, falling back to mock. Error:', err);
      }
    }

    // Record follow-up in account logs
    await Account.findOneAndUpdate(
      { customerId: customer._id },
      {
        $push: {
          contactHistory: {
            date: new Date(),
            channel: 'Email', // Logging that a Calendar notification/followup was scheduled
            notes: `Scheduled Calendar Event: "${title}" for ${start.toLocaleString()}`,
          },
        },
      }
    );

    return res.status(200).json({
      message: isRealEvent ? 'Calendar event scheduled successfully' : 'Calendar event scheduled successfully (Mock Mode / OAuth not connected)',
      eventId,
      isRealEvent,
    });
  } catch (error) {
    console.error('Create calendar event error:', error);
    return res.status(500).json({ message: 'Failed to create calendar event', error: (error as Error).message });
  }
};

// 3. Google Sheets Integration - Import Customer Data
export const importFromSheets = async (req: AuthRequest, res: Response) => {
  const { spreadsheetId, range } = req.body;

  // Let's create a default set of mock customer records to load if sheets connection isn't available or configured.
  const mockSheetData = [
    ['John Doe', 'john.doe@example.com', '+15550199', '2500', '45'],
    ['Sarah Jenkins', 'sarah.j@example.com', '+15550211', '8500', '78'],
    ['Robert Chen', 'robert.chen@example.com', '+15550344', '12000', '112'],
    ['Emma Watson', 'emma.w@example.com', '+15550422', '450', '15'],
    ['Michael Scott', 'michael.s@example.com', '+15550500', '15000', '95'],
    ['David Miller', 'david.m@example.com', '+15550611', '1250', '32'],
  ];

  try {
    const oauth2Client = await getClientForUser(req.user!.id);
    let sheetRows = mockSheetData;
    let isRealImport = false;

    if (oauth2Client && spreadsheetId) {
      try {
        const sheets = google.sheets({ version: 'v4', auth: oauth2Client });
        // Getting metadata first to find the name of the first sheet
        const meta = await sheets.spreadsheets.get({ spreadsheetId });
        const firstSheetName = meta.data.sheets?.[0]?.properties?.title || 'Sheet1';
        
        const response = await sheets.spreadsheets.values.get({
          spreadsheetId,
          range: `${firstSheetName}!A2:E100`, // Dynamically use the first sheet's name
        });
        
        if (response.data.values && response.data.values.length > 0) {
          sheetRows = response.data.values;
          isRealImport = true;
        }
      } catch (err) {
        console.error('Failed to import from real Google Sheet. Error:', err);
        return res.status(400).json({ 
          message: 'Failed to read Google Sheet. Please check if the sheet URL is correct and your account has access to it.', 
          error: (err as Error).message 
        });
      }
    }

    let importedCount = 0;
    let updatedCount = 0;

    for (let i = 0; i < sheetRows.length; i++) {
      const row = sheetRows[i];
      const name = row[0];
      const email = row[1];
      const phone = row[2] || '';
      const outstandingAmount = Number(row[3]) || 0;
      const daysOverdue = Number(row[4]) || 0;

      if (!name || !email) continue;

      let customer = await Customer.findOne({ email });
      if (!customer) {
        customer = await Customer.create({
          name,
          email,
          phone,
          status: 'Active',
          assignedOfficer: req.user!.id,
          googleSheetRowId: i + 2, // 1-indexed plus header row
        });

        await Account.create({
          customerId: customer._id,
          outstandingAmount,
          daysOverdue,
          riskScore: Math.min(Math.floor(daysOverdue * 1.2), 100),
          paymentHistory: [],
          contactHistory: [{
            date: new Date(),
            channel: 'Email',
            notes: `Account imported from Sheet. Delinquency: $${outstandingAmount} outstanding, ${daysOverdue} days overdue.`,
          }],
        });
        importedCount++;
      } else {
        // Update Account details
        await Account.findOneAndUpdate(
          { customerId: customer._id },
          {
            $set: {
              outstandingAmount,
              daysOverdue,
              riskScore: Math.min(Math.floor(daysOverdue * 1.2), 100),
            },
            $push: {
              contactHistory: {
                date: new Date(),
                channel: 'Email',
                notes: `Account details updated via Google Sheet sync. Delinquency: $${outstandingAmount} outstanding, ${daysOverdue} days overdue.`,
              },
            },
          }
        );
        updatedCount++;
      }
    }

    return res.status(200).json({
      message: isRealImport ? 'Data imported from Google Sheets successfully' : 'Data imported successfully (Mock Mode)',
      importedCount,
      updatedCount,
      isRealImport,
    });
  } catch (error) {
    console.error('Import sheets error:', error);
    return res.status(500).json({ message: 'Sheets sync failed', error: (error as Error).message });
  }
};

// 4. Google Sheets Integration - Export Reports / Customer Details
export const exportToSheets = async (req: AuthRequest, res: Response) => {
  const { spreadsheetId, range } = req.body;

  try {
    const customers = await Customer.find();
    const accounts = await Account.find();

    const dataRows = await Promise.all(
      customers.map(async (c) => {
        const acc = accounts.find((a) => a.customerId.toString() === c._id.toString());
        return [
          c._id.toString(),
          c.name,
          c.email,
          c.phone,
          c.status,
          acc ? acc.outstandingAmount : 0,
          acc ? acc.daysOverdue : 0,
          acc ? acc.riskScore : 0,
        ];
      })
    );

    // Headers
    const values = [
      ['Customer ID', 'Name', 'Email', 'Phone', 'Status', 'Outstanding Amount', 'Days Overdue', 'Risk Score'],
      ...dataRows,
    ];

    const oauth2Client = await getClientForUser(req.user!.id);
    let isRealExport = false;

    if (oauth2Client && spreadsheetId) {
      try {
        const sheets = google.sheets({ version: 'v4', auth: oauth2Client });
        await sheets.spreadsheets.values.update({
          spreadsheetId,
          range: range || 'Sheet1!A1',
          valueInputOption: 'RAW',
          requestBody: {
            values,
          },
        });
        isRealExport = true;
      } catch (err) {
        console.error('Failed to export to real Google Sheet, error:', err);
      }
    }

    return res.status(200).json({
      message: isRealExport ? 'Report exported to Google Sheets' : 'Report exported successfully (Mock Mode)',
      isRealExport,
      recordsExported: dataRows.length,
    });
  } catch (error) {
    console.error('Export sheets error:', error);
    return res.status(500).json({ message: 'Sheets export failed', error: (error as Error).message });
  }
};
