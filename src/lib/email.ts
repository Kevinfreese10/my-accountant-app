
'use server';

import nodemailer from 'nodemailer';

type EmailPayload = {
    to: string | string[];
    cc?: string | string[];
    bcc?: string | string[];
    subject: string;
    html: string;
    from?: string;
    resellerId?: string;
    attachments?: { filename: string; path: string }[];
    replyTo?: string;
}

export async function sendEmail({ to, cc, bcc, subject, html, from, resellerId, attachments, replyTo }: EmailPayload) {
  
  const transportConfig = {
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    secure: true, // Use SSL
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    tls: {
      rejectUnauthorized: false
    }
  };
  
  if (!transportConfig.host || !transportConfig.port || !transportConfig.auth.user || !transportConfig.auth.pass) {
      console.error('SMTP configuration is missing from environment variables.');
      throw new Error('Email server is not configured.');
  }

  const fromAddress = from || `"My Accountant" <${transportConfig.auth.user}>`;

  const transporter = nodemailer.createTransport(transportConfig);

  try {
      const info = await transporter.sendMail({
          from: fromAddress,
          to: Array.isArray(to) ? to.join(', ') : to,
          cc: cc,
          bcc: bcc,
          subject: subject,
          html: html,
          attachments: attachments,
          replyTo: replyTo,
      });
      console.log('Email sent successfully:', info.messageId);
      return info;
  } catch (error: any) {
      console.error('Nodemailer Error:', error);
      throw new Error(`SMTP Error: ${error.code || 'Unknown'} - ${error.message}`);
  }
}
