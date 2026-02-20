
'use server';

import nodemailer from 'nodemailer';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { User } from './types';

const db = getFirestore(firebaseApp);

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
  
  // Default SMTP Configuration
  let transportConfig = {
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

  let fromName = "My Accountant";
  let fromEmail = process.env.SMTP_USER || 'info@myacc.co.za';
  let finalBcc = Array.isArray(bcc) ? [...bcc] : (bcc ? [bcc] : []);

  // Check for Reseller (Partner) SMTP override
  if (resellerId) {
    try {
      const partnerRef = doc(db, 'users', resellerId);
      const partnerSnap = await getDoc(partnerRef);
      
      if (partnerSnap.exists()) {
        const partner = partnerSnap.data() as User;
        
        // If partner has configured SMTP, use it
        if (partner.smtpDetails?.host && partner.smtpDetails?.user && partner.smtpDetails?.pass) {
          transportConfig = {
            host: partner.smtpDetails.host,
            port: Number(partner.smtpDetails.port || 465),
            secure: partner.smtpDetails.port === '465',
            auth: {
              user: partner.smtpDetails.user,
              pass: partner.smtpDetails.pass,
            },
            tls: {
              rejectUnauthorized: false
            }
          };
          fromName = partner.companyName || partner.name;
          fromEmail = partner.smtpDetails.user;
          
          // Also BCC the partner on all their outgoing emails
          if (!finalBcc.includes(partner.email)) {
            finalBcc.push(partner.email);
          }
        }
      }
    } catch (error) {
      console.error('Error fetching partner SMTP details:', error);
      // Fallback to default config is already set
    }
  }
  
  if (!transportConfig.host || !transportConfig.port || !transportConfig.auth.user || !transportConfig.auth.pass) {
      console.error('SMTP configuration is missing from environment variables.');
      throw new Error('Email server is not configured.');
  }

  const fromAddress = from || `"${fromName}" <${fromEmail}>`;

  const transporter = nodemailer.createTransport(transportConfig);

  try {
      const info = await transporter.sendMail({
          from: fromAddress,
          to: Array.isArray(to) ? to.join(', ') : to,
          cc: Array.isArray(cc) ? cc.join(', ') : cc,
          bcc: finalBcc.length > 0 ? finalBcc.join(', ') : undefined,
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
