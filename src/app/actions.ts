'use server';

import { getFirestore, doc, updateDoc, getDoc, arrayUnion, Timestamp, collection, getDocs, where, query, setDoc, writeBatch, limit, deleteField, increment, serverTimestamp } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { Order, Service, User, OrderNote, Task, DocumentUpload, AllocationRule, ImportedTransaction, SmartAllocationResult, VatType } from '@/lib/types';
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
import { AllocationQueryEmail } from '@/components/emails/AllocationQueryEmail';
import { suggestTransactionAllocation } from '@/ai/flows/suggest-transaction-allocation';
import { BankCleaner } from '@/lib/bank-cleaner';


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
            merchantKey2: deleteField(),
            smartAllocationResult: deleteField(),
            allocationSource: deleteField(),
            matchType: deleteField(),
            matchedOn: deleteField(),
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
 * PHASE 2: Deterministic Grouping & Precedence Matching (REGEX-FIRST)
 * Processes in batches to provide real-time progress.
 * THIS IS AN APP-BASED PROCESS (DETERMINISTIC CODE), NOT AI-BASED.
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

        // 1. Fetch Dictionaries & Rules once
        const historyQuery = query(transRef, where('status', 'in', ['reviewed', 'allocated']), limit(1000));
        const historySnap = await getDocs(historyQuery);
        const history = historySnap.docs.map(d => d.data() as ImportedTransaction);

        const rulesQuery = collection(db, "allocationRules");
        const rulesSnap = await getDocs(rulesQuery);
        const globalRules = rulesSnap.docs.map(d => ({ id: d.id, ...d.data() } as AllocationRule));
        const allRules = [...(client.allocationRules || []), ...globalRules].sort((a, b) => (a.priority || 99) - (b.priority || 99));

        // 2. Process transactions in batches of 20
        let moveCount = 0;
        const batchSize = 20;

        for (let i = 0; i < processingExpenses.length; i += batchSize) {
            const batch = writeBatch(db);
            const chunk = processingExpenses.slice(i, i + batchSize);

            // Process identifying logic for each item in parallel for speed
            await Promise.all(chunk.map(async (tx) => {
                const result = BankCleaner.process(tx.description);
                let finalResult: SmartAllocationResult | null = null;
                let matchType: 'exact' | 'alias' | 'fuzzy' | 'manual' | null = null;
                let allocationSource: string | null = null;
                let ruleId: string | undefined;
                let matchedKeyword: string | undefined;

                // PRECEDENCE MATCHING (Deterministic logic tree)
                
                // TIER 1: History Match (By exact MerchantKey)
                if (result.merchantKey) {
                    const histMatch = history.find(h => h.merchantKey === result.merchantKey && h.allocatedTo);
                    if (histMatch) {
                        finalResult = {
                            accountId: histMatch.allocatedTo!.value,
                            vatType: histMatch.vatType || 'no_vat',
                            confidence: 100,
                            summary: `Matched historical allocation for ${result.cleanDescription}.`
                        };
                        matchType = 'exact';
                        allocationSource = 'history';
                    }
                }

                // TIER 2: Rules Match
                if (!finalResult) {
                    const ruleMatch = allRules.find(r => r.keywords.some(kw => result.cleanDescription.toUpperCase().includes(kw.toUpperCase())));
                    if (ruleMatch) {
                        matchedKeyword = ruleMatch.keywords.find(kw => result.cleanDescription.toUpperCase().includes(kw.toUpperCase()));
                        finalResult = {
                            accountId: ruleMatch.accountId,
                            vatType: client.isVatRegistered ? ruleMatch.vatType : 'no_vat',
                            confidence: 95,
                            summary: `Matched active allocation rule for ${matchedKeyword}.`,
                            ruleId: ruleMatch.id,
                            matchedKeyword: matchedKeyword
                        };
                        matchType = 'alias';
                        allocationSource = 'rule';
                        ruleId = ruleMatch.id;
                    }
                }

                // TIER 3: Global Smart DB (Exact Key Match)
                if (!finalResult && result.merchantKey) {
                    try {
                        const globalRef = doc(db, 'globalMerchants', result.merchantKey);
                        const globalSnap = await getDoc(globalRef);
                        if (globalSnap.exists()) {
                            const gd = globalSnap.data();
                            finalResult = {
                                accountId: gd.topAccountId,
                                vatType: gd.topVatType,
                                confidence: 85,
                                summary: `Matched top global allocation used by other practitioners.`
                            };
                            matchType = 'exact';
                            allocationSource = 'global_db';
                        }
                    } catch (e) {
                        console.error(`Global DB lookup failed for key: ${result.merchantKey}`, e);
                    }
                }

                // UPDATE TRANSACTION IN BATCH
                batch.update(doc(transRef, tx.id), {
                    rawDescription: tx.description,
                    cleanDescription: result.cleanDescription,
                    merchantKey: result.merchantKey,
                    cleaningVersion: result.cleaningVersion,
                    smartAllocationResult: finalResult,
                    status: 'ai_review', // Transition to review status
                    allocationSource: allocationSource,
                    matchType: matchType,
                    matchedRuleId: ruleId || deleteField(),
                    matchedKeyword: matchedKeyword || deleteField()
                });
                moveCount++;
            }));
            
            // Commit batch of 20
            await batch.commit();
        }

        // 3. Notify Initiator
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
        console.error("Smart Match Job Failed:", error);
        return { success: false, error: "Internal Server Error" };
    }
}

/**
 * Researches a specific merchant group with AI.
 * THIS IS THE ONLY PART THAT USES GENAI.
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
        const clientRef = doc(db, 'aiAccountantClients', clientId);
        const clientSnap = await getDoc(clientRef);
        if (!clientSnap.exists()) throw new Error("Client not found.");
        const client = clientSnap.data() as User;

        const rulesQuery = collection(db, "allocationRules");
        const rulesSnap = await getDocs(rulesQuery);
        const globalRules = rulesSnap.docs.map(d => ({ id: d.id, ...d.data() } as AllocationRule));
        const allRules = [...(client.allocationRules || []), ...globalRules].sort((a, b) => (a.priority || 99) - (b.priority || 99));

        const match = allRules.find(r => r.keywords.some(kw => description.toUpperCase().includes(kw.toUpperCase())));
        
        let result: SmartAllocationResult;
        let source: string;

        if (match) {
            const keyword = match.keywords.find(kw => description.toUpperCase().includes(kw.toUpperCase()));
            result = {
                accountId: match.accountId,
                vatType: isVatRegistered ? match.vatType : 'no_vat',
                confidence: 100,
                summary: `Matched latest existing allocation rule for ${keyword}.`,
                ruleId: match.id,
                matchedKeyword: keyword
            };
            source = 'rule';
        } else {
            // Manual per-merchant research call to LLM
            const aiResult = await suggestTransactionAllocation({
                description,
                chartOfAccounts,
                isVatRegistered
            });
            result = aiResult;
            source = 'ai';
        }

        const transRef = collection(db, 'aiAccountantClients', clientId, 'transactions');
        const q = query(transRef, where('description', '==', description), where('status', 'in', ['ai_review', 'ai_processing']));
        const snapshot = await getDocs(q);

        const batch = writeBatch(db);
        snapshot.docs.forEach(d => {
            batch.update(d.ref, {
                smartAllocationResult: result,
                allocationSource: source,
                matchedRuleId: result.ruleId || deleteField(),
                matchedKeyword: result.matchedKeyword || deleteField(),
                status: 'ai_review'
            });
        });
        await batch.commit();

        return result;
    } catch (error) {
        console.error("Single merchant research failed:", error);
        throw error;
    }
}

/**
 * Sends an email to the client asking them to clarify unallocated transactions.
 */
export async function sendAllocationQueryEmail({ clientId, clientEmail, unallocatedCount }: { clientId: string, clientEmail: string, unallocatedCount: number }) {
    try {
        const clientRef = doc(db, 'aiAccountantClients', clientId);
        const clientSnap = await getDoc(clientRef);
        if (!clientSnap.exists()) throw new Error("Client not found.");
        const client = clientSnap.data() as User;

        const chatUrl = `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/ai-accountant/${clientId}/chat`;

        const emailHtml = render(
            React.createElement(AllocationQueryEmail, {
                clientName: client.companyName || client.name,
                unallocatedCount,
                chatUrl
            })
        );

        await sendEmail({
            to: clientEmail,
            subject: `Action Required: Clarification needed for ${unallocatedCount} transactions`,
            html: emailHtml,
        });

        // Log the query in Firestore for the client to see in their chat
        const queriesRef = collection(db, 'aiAccountantClients', clientId, 'allocationQueries');
        await setDoc(doc(queriesRef), {
            emailSentTo: clientEmail,
            unallocatedCount,
            sentAt: serverTimestamp(),
            status: 'pending'
        });

        return { success: true };
    } catch (error) {
        console.error("Failed to send allocation query email:", error);
        throw error;
    }
}

/**
 * Finalizes an allocation from the AI Chat.
 */
export async function finalizeChatAllocation({
    clientId,
    transactionId,
    accountId,
    vatType,
    explanation
}: {
    clientId: string,
    transactionId: string,
    accountId: string,
    vatType: string,
    explanation: string
}) {
    try {
        const txRef = doc(db, 'aiAccountantClients', clientId, 'transactions', transactionId);
        await updateDoc(txRef, {
            status: 'reviewed',
            allocatedTo: { value: accountId, type: 'account' },
            vatType: vatType as VatType,
            allocatedAt: serverTimestamp(),
            allocationSource: 'ai',
            chatExplanation: explanation,
            confidence: 100
        });
        return { success: true };
    } catch (e) {
        console.error("Chat allocation failed:", e);
        throw e;
    }
}

/**
 * Resets any transactions locked in 'ai_processing' back to 'new'.
 */
export async function resetAiAccountantAnalysis({ clientId, bankAccountId }: { clientId: string, bankAccountId: string }) {
    try {
        const transRef = collection(db, 'aiAccountantClients', clientId, 'transactions');
        const q = query(
            transRef, 
            where('bankAccountId', '==', bankAccountId), 
            where('status', '==', 'ai_processing')
        );
        const snapshot = await getDocs(q);
        if (snapshot.empty) return { count: 0 };

        const batch = writeBatch(db);
        snapshot.docs.forEach(d => {
            batch.update(d.ref, { 
                status: 'new',
                merchantKey: deleteField(),
                merchantKey2: deleteField(),
                smartAllocationResult: deleteField(),
                allocationSource: deleteField(),
                matchedRuleId: deleteField(),
                matchedKeyword: deleteField(),
                matchType: deleteField(),
                cleaningVersion: deleteField()
            });
        });
        await batch.commit();
        return { count: snapshot.size };
    } catch (e) {
        console.error("Reset failed", e);
        throw e;
    }
}

/**
 * Combines multiple merchant groups into one target group.
 */
export async function combineMerchantGroups({
    clientId,
    transactionIds,
    newMerchantKey,
    newCleanDescription
}: {
    clientId: string,
    transactionIds: string[],
    newMerchantKey: string,
    newCleanDescription: string
}) {
    try {
        const batch = writeBatch(db);
        const transRef = collection(db, 'aiAccountantClients', clientId, 'transactions');
        
        transactionIds.forEach(id => {
            batch.update(doc(transRef, id), {
                merchantKey: newMerchantKey,
                cleanDescription: newCleanDescription,
                matchType: 'manual', // Mark as manual merge
                allocationSource: 'manual'
            });
        });
        
        await batch.commit();
        return { success: true };
    } catch (e) {
        console.error("Combine groups failed:", e);
        throw e;
    }
}

/**
 * Analyzes unallocated merchant groups and proposes merges based on similarity.
 */
export async function proposeRegroups({ 
    clientId, 
    bankAccountId 
}: { 
    clientId: string, 
    bankAccountId: string 
}) {
    try {
        const transRef = collection(db, 'aiAccountantClients', clientId, 'transactions');
        const q = query(
            transRef, 
            where('bankAccountId', '==', bankAccountId), 
            where('status', '==', 'ai_review')
        );
        const snapshot = await getDocs(q);
        const transactions = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as ImportedTransaction));

        // 1. Build initial groups
        const merchantGroups: { [key: string]: ImportedTransaction[] } = {};
        transactions.forEach(tx => {
            const key = tx.merchantKey || 'UNKNOWN';
            if (!merchantGroups[key]) merchantGroups[key] = [];
            merchantGroups[key].push(tx);
        });

        const groupKeys = Object.keys(merchantGroups).filter(k => k !== 'UNKNOWN').sort();
        const proposals: any[] = [];

        // 2. Pairwise comparison
        for (let i = 0; i < groupKeys.length; i++) {
            for (let j = i + 1; j < groupKeys.length; j++) {
                const keyA = groupKeys[i];
                const keyB = groupKeys[j];
                
                const { score, reason } = BankCleaner.getSimilarity(keyA, keyB);

                if (score >= 0.88) {
                    proposals.push({
                        fromKey: keyA,
                        toKey: keyB,
                        score: Math.round(score * 100),
                        reason,
                        fromImpact: merchantGroups[keyA].length,
                        toImpact: merchantGroups[keyB].length,
                        fromExamples: merchantGroups[keyA].slice(0, 3).map(tx => tx.description),
                        toExamples: merchantGroups[keyB].slice(0, 3).map(tx => tx.description),
                        fromTxIds: merchantGroups[keyA].map(tx => tx.id),
                        toTxIds: merchantGroups[keyB].map(tx => tx.id),
                        confidence: score >= 0.95 ? 'High' : 'Medium'
                    });
                }
            }
        }

        return proposals.sort((a, b) => b.score - a.score);
    } catch (e) {
        console.error("Propose regroups failed:", e);
        throw e;
    }
}

/**
 * Applies approved regroups permanently.
 */
export async function applyRegroups({
    clientId,
    merges,
    userId
}: {
    clientId: string,
    merges: { fromKey: string, toKey: string, fromTxIds: string[] }[],
    userId: string
}) {
    try {
        const batch = writeBatch(db);
        const transRef = collection(db, 'aiAccountantClients', clientId, 'transactions');
        
        merges.forEach(merge => {
            merge.fromTxIds.forEach(id => {
                batch.update(doc(transRef, id), {
                    merchantKey: merge.toKey,
                    matchType: 'manual',
                    allocationSource: 'manual'
                });
            });
        });

        // Log audit event
        const auditRef = doc(collection(db, 'aiAccountantClients', clientId, 'auditLogs'));
        batch.set(auditRef, {
            type: 'regroup_applied',
            userId,
            timestamp: serverTimestamp(),
            merges: merges.map(m => ({ from: m.fromKey, to: m.toKey, count: m.fromTxIds.length })),
            algorithmVersion: 'za_banks_v1.2'
        });

        await batch.commit();
        return { success: true };
    } catch (e) {
        console.error("Apply regroups failed:", e);
        throw e;
    }
}
