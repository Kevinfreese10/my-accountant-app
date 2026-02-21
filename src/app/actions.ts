
'use server';

import { getFirestore, doc, updateDoc, getDoc, arrayUnion, Timestamp, collection, getDocs, where, query, setDoc, writeBatch, limit } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { Order, Service, User, OrderNote, Task, DocumentUpload, AllocationRule, ImportedTransaction, AIAllocationResult, VatType, AIAllocationJob } from '@/lib/types';
import { services as allServices } from '@/lib/data';
import { sendEmail } from '@/lib/email';
import { render } from '@react-email/components';
import { DocumentRequestEmail } from '@/components/emails/DocumentRequestEmail';
import { NewTaskEmail } from '@/components/emails/NewTaskEmail';
import { format } from 'date-fns';
import { ClientDocumentUploadEmail } from '@/components/emails/ClientDocumentUploadEmail';
import { DocumentReviewEmail } from '@/components/emails/DocumentReviewEmail';
import { AIAccountantInviteEmail } from '@/components/emails/AIAccountantInviteEmail';
import { NewNoteNotificationEmail } from '@/components/emails/NewNoteNotificationEmail';
import { OutstandingDocumentsEmail } from '@/components/emails/OutstandingDocumentsEmail';
import { AIAnalysisCompleteEmail } from '@/components/emails/AIAnalysisCompleteEmail';
import { extractSupplierName } from '@/ai/flows/extract-supplier-name';
import { suggestTransactionAllocation } from '@/ai/flows/suggest-transaction-allocation';


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
    let resellerName = 'The My Accountant Team';
    if (resellerId) {
        const resellerSnap = await getDoc(doc(db, 'users', resellerId));
        if (resellerSnap.exists()) {
            resellerName = resellerSnap.data().companyName || resellerSnap.data().name;
        }
    }

    const emailHtml = render(
        DocumentReviewEmail({
            clientName,
            orderId,
            documentUploads,
            orderUrl: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/orders/${orderId}`,
            resellerName: `The ${resellerName} Team`
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
    let resellerName = 'My Accountant';
    if (resellerId && isToClient) {
        const resellerSnap = await getDoc(doc(db, 'users', resellerId));
        if (resellerSnap.exists()) {
            resellerName = resellerSnap.data().companyName || resellerSnap.data().name;
        }
    }

    const emailHtml = render(
        NewNoteNotificationEmail({
            recipientName,
            senderName,
            orderId,
            notePreview,
            actionUrl,
            isToClient,
            resellerName: isToClient ? `The ${resellerName} Team` : undefined
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
    let resellerName = 'The My Accountant Team';
    if (resellerId) {
        const resellerSnap = await getDoc(doc(db, 'users', resellerId));
        if (resellerSnap.exists()) {
            resellerName = resellerSnap.data().companyName || resellerSnap.data().name;
        }
    }

    const emailHtml = render(
        OutstandingDocumentsEmail({
            clientName,
            orderId,
            orderUrl: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/orders/${orderId}`,
            resellerName: `The ${resellerName} Team`
        })
    );

    await sendEmail({
        to: clientEmail,
        subject: `Action Required: Outstanding Documents for Order #${orderId}`,
        html: emailHtml,
        resellerId: resellerId,
    });
}

export async function sendAiUserInvite(email: string, name: string, password_do_not_expose: string, clientName: string, clientId: string, resellerId?: string) {
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
        resellerId: resellerId,
    });
}

/**
 * Runs the full AI Analysis process on the server.
 * Normalizes merchants -> Researches (History -> Rules -> AI) -> Updates Firestore -> Emails User
 */
export async function runAiAccountantAnalysis({ 
    clientId, 
    bankAccountId, 
    initiatorEmail 
}: { 
    clientId: string, 
    bankAccountId: string, 
    initiatorEmail: string 
}) {
    try {
        const clientRef = doc(db, 'aiAccountantClients', clientId);
        const clientSnap = await getDoc(clientRef);
        if (!clientSnap.exists()) throw new Error("Client not found.");
        const client = clientSnap.data() as User;

        const transRef = collection(db, 'aiAccountantClients', clientId, 'transactions');
        const q = query(
            transRef, 
            where('bankAccountId', '==', bankAccountId), 
            where('status', '==', 'new'),
            where('isExpense', '==', true)
        );
        const snapshot = await getDocs(q);
        const newExpenses = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as ImportedTransaction));

        if (newExpenses.length === 0) return { success: true, count: 0 };

        // 1. Fetch History & Rules
        const historyQuery = query(transRef, where('status', '==', 'reviewed'), limit(500));
        const historySnap = await getDocs(historyQuery);
        const history = historySnap.docs.map(d => d.data() as ImportedTransaction);

        const rulesQuery = collection(db, "allocationRules");
        const rulesSnap = await getDocs(rulesQuery);
        const globalRules = rulesSnap.docs.map(d => ({ id: d.id, ...d.data() } as AllocationRule));
        const allRules = [...(client.allocationRules || []), ...globalRules].sort((a, b) => (a.priority || 99) - (b.priority || 99));

        // 2. Group by description
        const uniqueDescriptions = Array.from(new Set(newExpenses.map(tx => tx.description)));
        const merchantAnalysis: { [key: string]: { merchantKey: string | null, result: AIAllocationResult | null } } = {};

        for (const desc of uniqueDescriptions) {
            let merchantKey: string | null = null;
            let finalResult: AIAllocationResult | null = null;

            try {
                // Step A: Normalize
                const norm = await extractSupplierName({ description: desc });
                merchantKey = norm.supplier;

                if (merchantKey) {
                    // Step B: Tier 1 - History
                    const histMatch = history.find(h => h.merchantKey === merchantKey && h.allocatedTo);
                    if (histMatch) {
                        finalResult = {
                            accountId: histMatch.allocatedTo!.value,
                            vatType: histMatch.vatType || 'no_vat',
                            confidence: 100,
                            summary: `Matched historical allocation for ${merchantKey}.`
                        };
                    } else {
                        // Step C: Tier 2 - Rules
                        const ruleMatch = allRules.find(r => r.keywords.some(kw => merchantKey!.includes(kw.toUpperCase())));
                        if (ruleMatch) {
                            finalResult = {
                                accountId: ruleMatch.accountId,
                                vatType: ruleMatch.vatType,
                                confidence: 95,
                                summary: `Matched active allocation rule for ${merchantKey}.`
                            };
                        } else {
                            // Step D: Tier 3 - AI Research
                            const aiRes = await suggestTransactionAllocation({
                                description: desc,
                                chartOfAccounts: JSON.stringify(client.chartOfAccounts || []),
                                isVatRegistered: !!client.isVatRegistered,
                            });
                            finalResult = aiRes;
                        }
                    }
                }
            } catch (e) {
                console.error(`Analysis failed for ${desc}`, e);
            }

            merchantAnalysis[desc] = { merchantKey, result: finalResult };
        }

        // 3. Batch Update Firestore
        const batch = writeBatch(db);
        let moveCount = 0;
        newExpenses.forEach(tx => {
            const analysis = merchantAnalysis[tx.description];
            if (analysis && analysis.merchantKey) {
                batch.update(doc(transRef, tx.id), {
                    merchantKey: analysis.merchantKey,
                    aiAllocationResult: analysis.result,
                    status: 'ai_review',
                    allocationSource: 'ai'
                });
                moveCount++;
            }
        });

        if (moveCount > 0) {
            await batch.commit();

            // 4. Send Email Confirmation
            const emailHtml = render(
                AIAnalysisCompleteEmail({
                    clientName: client.companyName || client.name,
                    totalProcessed: moveCount,
                    dashboardUrl: `${process.env.NEXT_PUBLIC_APP_URL}/admin/ai-accountant/${clientId}/bank/transactions`
                })
            );

            await sendEmail({
                to: initiatorEmail,
                subject: `AI Analysis Complete: ${client.companyName || client.name}`,
                html: emailHtml,
            });
        }

        return { success: true, count: moveCount };

    } catch (error) {
        console.error("AI Analysis Job Failed:", error);
        return { success: false, error: "Internal Server Error" };
    }
}
