'use server';

import { getFirestore, doc, updateDoc, getDoc, arrayUnion, Timestamp, collection, getDocs, where, query, setDoc, writeBatch, limit, deleteField, increment, serverTimestamp } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { Order, Service, User, OrderNote, Task, DocumentUpload, AllocationRule, ImportedTransaction, AIAllocationResult, VatType } from '@/lib/types';
import { sendEmail } from '@/lib/email';
import { render } from '@react-email/components';
import React from 'react';
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
        React.createElement(ClientDocumentUploadEmail, {
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
        React.createElement(DocumentReviewEmail, {
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
        React.createElement(NewNoteNotificationEmail, {
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
        React.createElement(OutstandingDocumentsEmail, {
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
        React.createElement(AIAccountantInviteEmail, {
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
 * Moves a specific transaction back to 'new' status.
 */
export async function moveTransactionToNew({ clientId, transactionId }: { clientId: string, transactionId: string }) {
    try {
        const transRef = doc(db, 'aiAccountantClients', clientId, 'transactions', transactionId);
        await updateDoc(transRef, {
            status: 'new',
            merchantKey: deleteField(),
            aiAllocationResult: deleteField(),
            allocationSource: deleteField(),
            matchedRuleId: deleteField(),
            matchedRuleDescription: deleteField(),
            matchedKeyword: deleteField(),
            allocatedTo: deleteField(),
            vatType: deleteField(),
            allocatedAt: deleteField()
        });
        return { success: true };
    } catch (e) {
        console.error("Failed to move transaction back to new:", e);
        throw e;
    }
}

/**
 * Updates the global smart merchant database based on a user's approval.
 */
export async function updateGlobalMerchantDb({ merchantKey, accountId, vatType }: { merchantKey: string, accountId: string, vatType: string }) {
    if (!merchantKey || merchantKey === 'UNKNOWN') return;
    
    const globalRef = doc(db, 'globalMerchants', merchantKey.toUpperCase());
    const fieldKey = `${accountId.replace(/\//g, '_')}_${vatType}`;

    try {
        const snap = await getDoc(globalRef);
        if (!snap.exists()) {
            await setDoc(globalRef, {
                merchantKey: merchantKey.toUpperCase(),
                topAccountId: accountId,
                topVatType: vatType,
                topUsageCount: 1,
                allocations: { [fieldKey]: 1 },
                lastUpdated: serverTimestamp()
            });
        } else {
            const data = snap.data();
            const currentCount = (data.allocations?.[fieldKey] || 0) + 1;
            
            const updateData: any = {
                [`allocations.${fieldKey}`]: increment(1),
                lastUpdated: serverTimestamp()
            };

            if (currentCount > data.topUsageCount) {
                updateData.topAccountId = accountId;
                updateData.topVatType = vatType;
                updateData.topUsageCount = currentCount;
            }

            await updateDoc(globalRef, updateData);
        }
    } catch (e) {
        console.error("Global DB Update failed", e);
    }
}

/**
 * PHASE 1: Immediate Status Lock
 */
export async function prepareAiAccountantAnalysis({ clientId, bankAccountId }: { clientId: string, bankAccountId: string }) {
    try {
        const transRef = collection(db, 'aiAccountantClients', clientId, 'transactions');
        const q = query(
            transRef, 
            where('bankAccountId', '==', bankAccountId), 
            where('status', '==', 'new'),
            where('isExpense', '==', true)
        );
        const snapshot = await getDocs(q);
        if (snapshot.empty) return { count: 0 };

        const batch = writeBatch(db);
        snapshot.docs.forEach(d => {
            batch.update(d.ref, { status: 'ai_processing' });
        });
        await batch.commit();
        return { count: snapshot.size };
    } catch (e) {
        console.error("Locking failed", e);
        throw e;
    }
}

/**
 * PHASE 2: Group & 4-Tier Match Job (History + Rules + Global DB)
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
            where('status', '==', 'ai_processing'),
            where('isExpense', '==', true)
        );
        const snapshot = await getDocs(q);
        const processingExpenses = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as ImportedTransaction));

        if (processingExpenses.length === 0) return { success: true, count: 0 };

        // 1. Fetch Local Data
        const historyQuery = query(transRef, where('status', 'in', ['reviewed', 'allocated']), limit(1000));
        const historySnap = await getDocs(historyQuery);
        const history = historySnap.docs.map(d => d.data() as ImportedTransaction);

        const rulesQuery = collection(db, "allocationRules");
        const rulesSnap = await getDocs(rulesQuery);
        const globalRules = rulesSnap.docs.map(d => ({ id: d.id, ...d.data() } as AllocationRule));
        const allRules = [...(client.allocationRules || []), ...globalRules].sort((a, b) => (a.priority || 99) - (b.priority || 99));

        // 2. Group by description & Match
        const uniqueDescriptions = Array.from(new Set(processingExpenses.map(tx => tx.description)));
        const merchantAnalysis: { [key: string]: { merchantKey: string | null, result: AIAllocationResult | null, source: string | null, ruleId?: string, matchedKeyword?: string, ruleDescription?: string } } = {};

        for (const desc of uniqueDescriptions) {
            let merchantKey: string | null = null;
            let finalResult: AIAllocationResult | null = null;
            let finalSource: string | null = null;
            let ruleId: string | undefined;
            let matchedKeyword: string | undefined;
            let ruleDescription: string | undefined;

            try {
                const norm = await extractSupplierName({ description: desc });
                merchantKey = norm.supplier;

                if (!merchantKey || merchantKey.toUpperCase() === 'UNKNOWN') {
                    merchantKey = null; 
                }

                if (merchantKey) {
                    // TIER 1: History
                    const histMatch = history.find(h => h.merchantKey === merchantKey && h.allocatedTo);
                    if (histMatch) {
                        finalResult = {
                            accountId: histMatch.allocatedTo!.value,
                            vatType: histMatch.vatType || 'no_vat',
                            confidence: 100,
                            summary: `Matched historical allocation for ${merchantKey}.`
                        };
                        finalSource = 'history';
                    } else {
                        // TIER 2: Rules
                        const ruleMatch = allRules.find(r => r.keywords.some(kw => merchantKey!.includes(kw.toUpperCase())));
                        if (ruleMatch) {
                            matchedKeyword = ruleMatch.keywords.find(kw => merchantKey!.includes(kw.toUpperCase()));
                            ruleId = ruleMatch.id;
                            ruleDescription = ruleMatch.description;
                            finalResult = {
                                accountId: ruleMatch.accountId,
                                vatType: ruleMatch.vatType,
                                confidence: 95,
                                summary: `Matched active allocation rule for ${merchantKey}.`,
                                ruleId: ruleMatch.id,
                                matchedKeyword: matchedKeyword
                            };
                            finalSource = 'rule';
                        } else {
                            // TIER 3: Global Smart DB
                            const globalRef = doc(db, 'globalMerchants', merchantKey.toUpperCase());
                            const globalSnap = await getDoc(globalRef);
                            if (globalSnap.exists()) {
                                const gd = globalSnap.data();
                                finalResult = {
                                    accountId: gd.topAccountId,
                                    vatType: gd.topVatType,
                                    confidence: 85,
                                    summary: `Matched top global allocation used by other practitioners.`
                                };
                                finalSource = 'global_db';
                            }
                        }
                    }
                }
            } catch (e) {
                console.error(`Analysis failed for ${desc}`, e);
            }

            merchantAnalysis[desc] = { merchantKey, result: finalResult, source: finalSource, ruleId, matchedKeyword, ruleDescription };
        }

        // 3. Batch Update
        const batch = writeBatch(db);
        let moveCount = 0;
        processingExpenses.forEach(tx => {
            const analysis = merchantAnalysis[tx.description];
            if (analysis && analysis.merchantKey) {
                batch.update(doc(transRef, tx.id), {
                    merchantKey: analysis.merchantKey,
                    aiAllocationResult: analysis.result,
                    status: 'ai_review',
                    allocationSource: analysis.source,
                    matchedRuleId: analysis.ruleId || deleteField(),
                    matchedRuleDescription: analysis.ruleDescription || deleteField(),
                    matchedKeyword: analysis.matchedKeyword || deleteField()
                });
                moveCount++;
            } else {
                batch.update(doc(transRef, tx.id), { 
                    status: 'new',
                    merchantKey: deleteField(),
                    aiAllocationResult: deleteField(),
                    allocationSource: deleteField(),
                    matchedRuleId: deleteField(),
                    matchedRuleDescription: deleteField(),
                    matchedKeyword: deleteField()
                });
            }
        });

        await batch.commit();

        if (moveCount > 0) {
            const emailHtml = render(
                React.createElement(AIAnalysisCompleteEmail, {
                    clientName: client.companyName || client.name,
                    totalProcessed: moveCount,
                    dashboardUrl: `${process.env.NEXT_PUBLIC_APP_URL}/admin/ai-accountant/${clientId}/bank/transactions`
                })
            );

            await sendEmail({
                to: initiatorEmail,
                subject: `Smart Match Complete: ${client.companyName || client.name}`,
                html: emailHtml,
            });
        }

        return { success: true, count: moveCount };

    } catch (error) {
        console.error("AI Analysis Job Failed:", error);
        return { success: false, error: "Internal Server Error" };
    }
}

/**
 * Researches a specific merchant group with AI.
 */
export async function researchMerchantWithAi({
    clientId,
    description,
    chartOfAccounts,
    isVatRegistered
}: {
    clientId: string,
    description: string,
    chartOfAccounts: string,
    isVatRegistered: boolean
}) {
    try {
        const result = await suggestTransactionAllocation({
            description,
            chartOfAccounts,
            isVatRegistered
        });

        const transRef = collection(db, 'aiAccountantClients', clientId, 'transactions');
        const q = query(transRef, where('description', '==', description), where('status', 'in', ['ai_review', 'ai_processing']));
        const snapshot = await getDocs(q);

        const batch = writeBatch(db);
        snapshot.docs.forEach(d => {
            batch.update(d.ref, {
                aiAllocationResult: result,
                allocationSource: 'ai'
            });
        });
        await batch.commit();

        return result;
    } catch (error) {
        console.error("Single merchant research failed:", error);
        throw error;
    }
}
