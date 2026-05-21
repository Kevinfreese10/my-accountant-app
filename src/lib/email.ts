'use server';

import nodemailer from 'nodemailer';
import { User } from './types';
import { fetchDocumentRest } from './firestore-rest';

type EmailPayload = {
    to: string | string[];
    cc?: string | string[];
    bcc?: string | string[];
    subject: string;
    html: string;
    from?: string;
    resellerId?: string | null;
    attachments?: { filename: string; path: string }[];
    replyTo?: string;
    smtpOverride?: { host: string; port: string; user: string; pass: string };
    fromNameOverride?: string;
}

/**
 * Sends an email using global store credentials.
 * Ensures white-labeling by adjusting 'From' name and 'Reply-To' based on resellerId.
 */
export async function sendEmail({ 
    to, 
    cc, 
    bcc, 
    subject, 
    html, 
    from, 
    resellerId, 
    attachments, 
    replyTo,
    smtpOverride,
    fromNameOverride
}: EmailPayload) {
  
  // 1. Default SMTP Configuration (My Accountant Master)
  let transportConfig: any = {
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 465),
    secure: process.env.SMTP_PORT === '465',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    tls: {
      rejectUnauthorized: false
    }
  };

  let fromName = fromNameOverride || "My Accountant";
  let fromEmail = process.env.SMTP_USER || 'no_reply@myacc.co.za';
  let finalBcc = Array.isArray(bcc) ? [...bcc] : (bcc ? [bcc] : []);
  let finalReplyTo = replyTo;

  // 2. Apply explicit SMTP overrides (primarily for admin internal tests)
  if (smtpOverride && smtpOverride.host && smtpOverride.user && smtpOverride.pass) {
      transportConfig = {
          host: smtpOverride.host,
          port: Number(smtpOverride.port || 465),
          secure: String(smtpOverride.port) === '465',
          auth: {
              user: smtpOverride.user,
              pass: smtpOverride.pass,
          },
          tls: {
              rejectUnauthorized: false
          }
      };
      fromEmail = smtpOverride.user;
  }

  // 3. Handle Reseller White-Labeling (Stateless REST fetches)
  if (resellerId && !smtpOverride) {
    try {
      let partnerData: User | null = null;
      partnerData = await fetchDocumentRest('users', resellerId);
      
      if (!partnerData) {
          partnerData = await fetchDocumentRest('aiAccountantClients', resellerId);
      }
      
      if (partnerData) {
        // Set white-label Display Name (e.g. "Acme Consulting")
        if (!fromNameOverride) {
            fromName = partnerData.companyName || partnerData.name;
        }

        // Set Reply-To to partner email so client responses go to the partner, not the master store
        if (!finalReplyTo) {
            finalReplyTo = partnerData.email;
        }
        
        // Use system SMTP for delivery (no_reply@myacc.co.za)
        // But BCC the partner so they have a copy of the notification sent to their client
        if (!finalBcc.includes(partnerData.email)) {
            finalBcc.push(partnerData.email);
        }
      }
    } catch (error) {
      console.error('Error fetching reseller details for email branding:', error);
    }
  }
  
  if (!transportConfig.host || !transportConfig.auth.user || !transportConfig.auth.pass) {
      console.error('Master SMTP configuration is missing.');
      return {
          success: false,
          error: 'Email server is not configured.',
          code: 'CONFIG_ERROR'
      };
  }

  const fromAddress = from || `"${fromName}" <${fromEmail}>`;
  const transporter = nodemailer.createTransport(transportConfig);

  try {
      console.log('Sending email through Nodemailer...', {
          to: Array.isArray(to) ? to.join(', ') : to,
          subject,
          from: fromAddress,
          cc: cc ? (Array.isArray(cc) ? cc.join(', ') : cc) : undefined,
          bcc: finalBcc.length > 0 ? finalBcc.join(', ') : undefined,
      });

      const info = await transporter.sendMail({
          from: fromAddress,
          to: Array.isArray(to) ? to.join(', ') : to,
          cc: Array.isArray(cc) ? cc.join(', ') : cc,
          bcc: finalBcc.length > 0 ? finalBcc.join(', ') : undefined,
          subject: subject,
          html: html,
          attachments: attachments,
          replyTo: finalReplyTo,
      });

      console.log('Nodemailer SMTP Send Success:', { messageId: info.messageId });

      return {
          success: true,
          messageId: info.messageId,
          response: info.response,
      };
  } catch (error: any) {
      console.error('Nodemailer SMTP Error:', error);
      return {
          success: false,
          error: error.message || 'Unknown SMTP error',
          code: error.code || 'Unknown',
      };
  }
}