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
import { suggestTransactionAllocation } from '@/ai/flows/suggest-transaction-allocation';
import AIAllocationCompleteEmail from '@/components/emails/AIAllocationCompleteEmail';
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

async function runAllocationProcess(clientId: string, bankAccountId: string, jobId: string, reanalyse: boolean) {
    const jobRef = doc(db, 'aiAccountantClients', clientId, 'jobs', jobId);
    try {
        const clientRef = doc(db, 'aiAccountantClients', clientId);
        const clientSnap = await getDoc(clientRef);
        if (!clientSnap.exists()) throw new Error("Client not found");
        const client = clientSnap.data() as User;
        
        const chartOfAccounts = client.chartOfAccounts || [];
        const isVatRegistered = client.isVatRegistered || false;
        
        // BYOK: Fetch the partner's API key if this client was created by a partner
        let partnerApiKey: string | undefined;
        if (client.createdBy) {
            const partnerSnap = await getDoc(doc(db, 'users', client.createdBy));
            if (partnerSnap.exists()) {
                partnerApiKey = partnerSnap.data().geminiApiKey;
            }
        }

        const globalRulesQuery = query(collection(db, 'allocationRules'));
        const globalRulesSnap = await getDocs(globalRulesQuery);
        const globalRules = globalRulesSnap.docs.map(d => d.data() as AllocationRule);

        const statusToQuery = reanalyse ? ['ai_review'] : ['ai_processing'];
        const transactionsQuery = query(
            collection(db, 'aiAccountantClients', clientId, 'transactions'),
            where('bankAccountId', '==', bankAccountId),
            where('status', 'in', statusToQuery)
        );
        const transactionsSnap = await getDocs(transactionsQuery);
        const transactionsToProcess = transactionsSnap.docs.map(d => ({id: d.id, ...d.data()}) as ImportedTransaction);

        if(transactionsToProcess.length === 0) {
            await updateDoc(jobRef, { status: 'completed', completedAt: Timestamp.now(), total: 0, processed: 0, error: 'No transactions to process.' });
            return;
        }

        const groups = transactionsToProcess.reduce((acc, tx) => {
            const key = tx.merchantKey || 'UNKNOWN';
            if (!acc[key]) acc[key] = [];
            acc[key].push(tx);
            return acc;
        }, {} as Record<string, ImportedTransaction[]>);
        
        const totalGroups = Object.keys(groups).length;
        await updateDoc(jobRef, { total: totalGroups });

        let groupsProcessed = 0;
        const allocationCache = new Map<string, AIAllocationResult>();
        
        for (const [description, txs] of Object.entries(groups)) {
            let allocationResult: AIAllocationResult | null = null;
            if (allocationCache.has(description)) {
                allocationResult = allocationCache.get(description)!;
            } else {
                try {
                    const aiResponse = await suggestTransactionAllocation({ 
                        description, 
                        chartOfAccounts: JSON.stringify(chartOfAccounts), 
                        isVatRegistered,
                        apiKey: partnerApiKey // Pass the partner's API key
                    });
                    const confidence = aiResponse?.confidence ?? 0;
                    
                    if (confidence >= 80 && aiResponse.accountId) {
                        const rule = globalRules.find(r => r.accountId === aiResponse.accountId);
                        const finalVatType = isVatRegistered ? (rule ? rule.vatType : aiResponse.vatType) : 'no_vat';
                        allocationResult = { accountId: aiResponse.accountId, vatType: finalVatType, confidence };
                    } else {
                        allocationResult = { accountId: '', vatType: 'no_vat', confidence };
                    }
                    allocationCache.set(description, allocationResult);
                } catch (e: any) {
                    console.error(`Failed to get suggestion for ${description}:`, e);
                    allocationResult = null;
                }
            }
            
            const batch = writeBatch(db);
            txs.forEach(tx => {
                const txRef = doc(db, 'aiAccountantClients', client.uid!, 'transactions', tx.id);
                batch.update(txRef, {
                    status: 'ai_review',
                    extractedSupplier: description,
                    aiAllocationResult: allocationResult,
                });
            });
            await batch.commit();

            groupsProcessed++;
            await updateDoc(jobRef, { processed: groupsProcessed });
        }
        
        await updateDoc(jobRef, { status: 'completed', completedAt: Timestamp.now() });

        const usersToNotify: string[] = [];
        if (client.createdBy) usersToNotify.push(client.createdBy);
        if (client.sharedWith) usersToNotify.push(...client.sharedWith);
        
        const uniqueUserIds = [...new Set(usersToNotify)].filter(Boolean);
        if (uniqueUserIds.length > 0) {
            const usersQuery = query(collection(db, 'users'), where('uid', 'in', uniqueUserIds));
            const usersSnap = await getDocs(usersQuery);
            const emails = usersSnap.docs.map(d => d.data().email).filter(Boolean);
            
            if (emails.length > 0) {
                 const emailHtml = render(AIAllocationCompleteEmail({ clientName: client.name || 'your client', totalProcessed: transactionsToProcess.length }));
                await sendEmail({
                    to: emails,
                    subject: `AI Accountant Job Complete for ${client.name}`,
                    html: emailHtml,
                });
            }
        }

    } catch (e: any) {
        console.error("AI Allocation process failed:", e);
        await updateDoc(jobRef, { status: 'failed', error: e.message, completedAt: Timestamp.now() });
    }
}

export async function startAiAllocationJob(clientId: string, bankAccountId: string, reanalyse: boolean) {
    const jobRef = doc(collection(db, 'aiAccountantClients', clientId, 'jobs'));
    const jobData: Partial<AIAllocationJob> = { 
        id: jobRef.id, 
        clientId, 
        status: 'running', 
        total: 0, 
        processed: 0, 
        createdAt: Timestamp.now() 
    };
    await setDoc(jobRef, jobData);
    
    // Don't await this. Let it run in the background.
    runAllocationProcess(clientId, bankAccountId, jobRef.id, reanalyse);

    return { jobId: jobRef.id };
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
