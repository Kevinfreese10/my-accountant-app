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
    smtpOverride?: { host: string; port: string; user: string; pass: string };
    fromNameOverride?: string;
}

/**
 * Sends an email using either global or partner-specific SMTP settings.
 * Ensures white-labeling by adjusting 'From' name and 'Reply-To' for partner orders.
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
  let fromEmail = process.env.SMTP_USER || 'info@myacc.co.za';
  let finalBcc = Array.isArray(bcc) ? [...bcc] : (bcc ? [bcc] : []);
  let finalReplyTo = replyTo;

  // 2. Apply explicit SMTP overrides (e.g., from profile test button)
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

  // 3. Handle Partner White-Labeling (If resellerId provided)
  if (resellerId && !smtpOverride) {
    try {
      // Fetch partner profile to get branding and custom SMTP if available
      // Note: We check both 'users' and 'aiAccountantClients' for maximum compatibility
      let partnerData: User | null = null;
      const userRef = doc(db, 'users', resellerId);
      const userSnap = await getDoc(userRef);
      
      if (userSnap.exists()) {
          partnerData = userSnap.data() as User;
      } else {
          const aiClientRef = doc(db, 'aiAccountantClients', resellerId);
          const aiClientSnap = await getDoc(aiClientRef);
          if (aiClientSnap.exists()) {
              partnerData = aiClientSnap.data() as User;
          }
      }
      
      if (partnerData) {
        // Set white-label Display Name
        if (!fromNameOverride) {
            fromName = partnerData.companyName || partnerData.name;
        }

        // Set Reply-To to partner email so client responses go to them
        if (!finalReplyTo) {
            finalReplyTo = partnerData.email;
        }
        
        // If partner has configured their own SMTP, use it for true white-label delivery
        if (partnerData.smtpDetails?.host && partnerData.smtpDetails?.user && partnerData.smtpDetails?.pass) {
          transportConfig = {
            host: partnerData.smtpDetails.host,
            port: Number(partnerData.smtpDetails.port || 465),
            secure: String(partnerData.smtpDetails.port) === '465',
            auth: {
              user: partnerData.smtpDetails.user,
              pass: partnerData.smtpDetails.pass,
            },
            tls: {
              rejectUnauthorized: false
            }
          };
          // Update the authenticated sender address
          fromEmail = partnerData.smtpDetails.user;
          
          // Blind-copy the partner on their own client notifications for their records
          if (!finalBcc.includes(partnerData.email)) {
            finalBcc.push(partnerData.email);
          }
        }
      }
    } catch (error) {
      console.error('Error fetching partner details for email:', error);
      // Non-blocking: falls back to default SMTP if lookup fails
    }
  }
  
  if (!transportConfig.host || !transportConfig.auth.user || !transportConfig.auth.pass) {
      console.error('SMTP configuration is missing. Cannot send email.');
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
          replyTo: finalReplyTo,
      });
      console.log('Email sent successfully:', info.messageId, 'from:', fromAddress);
      return info;
  } catch (error: any) {
      console.error('Nodemailer Error:', error);
      throw new Error(`SMTP Error: ${error.code || 'Unknown'} - ${error.message}`);
  }
}