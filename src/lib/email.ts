
'use server';

import nodemailer from 'nodemailer';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { User } from '@/lib/types';

const db = getFirestore(firebaseApp);

type EmailPayload = {
    to: string | string[];
    subject: string;
    html: string;
    from?: string;
    bcc?: string | string[];
    resellerId?: string;
    attachments?: { filename: string; path: string }[];
    replyTo?: string;
}

export async function sendEmail({ to, subject, html, from, bcc, resellerId, attachments, replyTo }: EmailPayload) {
  
  let fromAddress: string;
  let transportConfig: any;

  // Use system environment variables for SMTP
  const systemSmtpConfig = {
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  };
  
  if (!systemSmtpConfig.host || !systemSmtpConfig.port || !systemSmtpConfig.user || !systemSmtpConfig.pass) {
      console.error('SMTP configuration is missing from environment variables.');
      throw new Error('Email server is not configured.');
  }

  transportConfig = {
    host: systemSmtpConfig.host,
    port: parseInt(systemSmtpConfig.port, 10),
    secure: true, // Use SSL
    auth: {
      user: systemSmtpConfig.user,
      pass: systemSmtpConfig.pass,
    },
    tls: {
      rejectUnauthorized: false
    }
  };
  fromAddress = `"My Accountant" <${systemSmtpConfig.user}>`;
  
  if (from) {
      fromAddress = from;
  }

  const transporter = nodemailer.createTransport(transportConfig);

  try {
      const info = await transporter.sendMail({
          from: fromAddress,
          to: Array.isArray(to) ? to.join(', ') : to,
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
