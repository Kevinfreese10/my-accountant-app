
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
  
  // Default SMTP Configuration (My Accountant)
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

  // Use override if provided (useful for testing settings before saving)
  if (smtpOverride && smtpOverride.host && smtpOverride.user && smtpOverride.pass) {
      transportConfig = {
          host: smtpOverride.host,
          port: Number(smtpOverride.port || 465),
          secure: smtpOverride.port === '465',
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

  // Check for Reseller (Partner) details if no override is present
  if (resellerId && !smtpOverride) {
    try {
      // Check 'users' collection first
      let partnerRef = doc(db, 'users', resellerId);
      let partnerSnap = await getDoc(partnerRef);
      
      // Fallback to 'aiAccountantClients' if not found in 'users'
      if (!partnerSnap.exists()) {
          partnerRef = doc(db, 'aiAccountantClients', resellerId);
          partnerSnap = await getDoc(partnerRef);
      }
      
      if (partnerSnap.exists()) {
        const partner = partnerSnap.data() as User;
        
        // Set white-label name
        if (!fromNameOverride) {
            fromName = partner.companyName || partner.name;
        }

        // Always set Reply-To to partner email for white-labeling
        if (!finalReplyTo) {
            finalReplyTo = partner.email;
        }
        
        // If partner has configured SMTP, use it
        if (partner.smtpDetails?.host && partner.smtpDetails?.user && partner.smtpDetails?.pass) {
          transportConfig = {
            host: partner.smtpDetails.host,
            port: Number(partner.smtpDetails.port || 465),
            secure: String(partner.smtpDetails.port) === '465',
            auth: {
              user: partner.smtpDetails.user,
              pass: partner.smtpDetails.pass,
            },
            tls: {
              rejectUnauthorized: false
            }
          };
          // CRITICAL: Ensure the from email address matches the authenticated SMTP user
          fromEmail = partner.smtpDetails.user;
          
          // Also BCC the partner on all their outgoing emails
          if (!finalBcc.includes(partner.email)) {
            finalBcc.push(partner.email);
          }
        }
      }
    } catch (error) {
      console.error('Error fetching partner SMTP details:', error);
    }
  }
  
  if (!transportConfig.host || !transportConfig.port || !transportConfig.auth.user || !transportConfig.auth.pass) {
      console.error('SMTP configuration is missing.');
      throw new Error('Email server is not configured.');
  }

  // Construct the final from header
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
