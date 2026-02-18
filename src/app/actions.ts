'use server';

import { getFirestore, doc, updateDoc, getDoc, arrayUnion, Timestamp, collection, getDocs, where, query, setDoc, writeBatch } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { Order, Service, User, OrderNote, Task, DocumentUpload, AllocationRule, ImportedTransaction, AIAllocationResult, VatType, AIAllocationJob } from '@/lib/types';
import { services as allServices } from '@/lib/data';
import { sendEmail } from '@/lib/email';
import { render } from '@react-email/components';
import DocumentRequestEmail from '@/components/emails/DocumentRequestEmail';
import NewTaskEmail from '@/components/emails/NewTaskEmail';
import { format } from 'date-fns';
import ClientDocumentUploadEmail from '@/components/emails/ClientDocumentUploadEmail';
import DocumentReviewEmail from '@/components/emails/DocumentReviewEmail';
import AIAccountantInviteEmail from '@/components/emails/AIAccountantInviteEmail';
import NewNoteNotificationEmail from '@/components/emails/NewNoteNotificationEmail';
import OutstandingDocumentsEmail from '@/components/emails/OutstandingDocumentsEmail';


const db = getFirestore(firebaseApp);


export async function notifyStaffOfDocumentUpload({ orderId, clientName, assignedStaffName, assignedStaffEmail }: { orderId: string, clientName: string, assignedStaffName: string, assignedStaffEmail: string }) {
    const emailHtml = render(
        ClientDocumentUploadEmail({
            assigneeName: assignedStaffName,
            clientName: clientName,
            orderId: orderId,
            orderUrl: `${process.env.NEXT_PUBLIC_APP_URL}/admin/orders/${orderId}`,
        })
    );

    await sendEmail({
        to: assignedStaffEmail,
        subject: `Documents Uploaded for Order #${orderId}`,
        html: emailHtml,
    });
}

export async function sendDocumentReviewFeedback({ orderId, clientName, clientEmail, documentUploads, resellerId }: { orderId: string, clientName: string, clientEmail: string, documentUploads: DocumentUpload[], resellerId?: string }) {
    const emailHtml = render(
        DocumentReviewEmail({
            clientName,
            orderId,
            documentUploads,
            orderUrl: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/orders/${orderId}`,
        })
    );

    await sendEmail({
        to: clientEmail,
        subject: `Feedback on Your Submitted Documents for Order #${orderId}`,
        html: emailHtml,
        resellerId: resellerId,
    });
}

export async function notifyOfNewNote({ 
    recipientEmail, 
    recipientName, 
    senderName, 
    orderId, 
    notePreview, 
    actionUrl, 
    isToClient,
    resellerId 
}: { 
    recipientEmail: string, 
    recipientName: string, 
    senderName: string, 
    orderId: string, 
    notePreview: string, 
    actionUrl: string, 
    isToClient: boolean,
    resellerId?: string 
}) {
    const emailHtml = render(
        NewNoteNotificationEmail({
            recipientName,
            senderName,
            orderId,
            notePreview,
            actionUrl,
            isToClient
        })
    );

    await sendEmail({
        to: recipientEmail,
        subject: `New Note on Order #${orderId}`,
        html: emailHtml,
        resellerId: resellerId,
    });
}

export async function sendOutstandingDocumentsReminder({ orderId, clientName, clientEmail, resellerId }: { orderId: string, clientName: string, clientEmail: string, resellerId?: string }) {
    const emailHtml = render(
        OutstandingDocumentsEmail({
            clientName,
            orderId,
            orderUrl: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/orders/${orderId}`,
        })
    );

    await sendEmail({
        to: clientEmail,
        subject: `Action Required: Outstanding Documents for Order #${orderId}`,
        html: emailHtml,
        resellerId: resellerId,
    });
}

export async function sendAiUserInvite(email: string, name: string, password_do_not_expose: string, clientName: string, clientId: string) {
    const loginUrl = `${process.env.NEXT_PUBLIC_APP_URL}/login`;

    const emailHtml = render(
        AIAccountantInviteEmail({
            name: name.split(' ')[0],
            email: email,
            password: password_do_not_expose,
            clientName: clientName,
            loginUrl: loginUrl,
        })
    );

    await sendEmail({
        to: email,
        subject: `You've been invited to collaborate on ${clientName}`,
        html: emailHtml,
    });
}