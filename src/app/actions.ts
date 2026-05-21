'use server';

import { getFirestore, doc, updateDoc, getDoc, arrayUnion, Timestamp, collection, getDocs, where, query, setDoc, writeBatch, serverTimestamp, addDoc, deleteField, increment, limit } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { Order, Service, User, OrderNote, Task, DocumentUpload, DemoLead, ImportedTransaction, SmartAllocationResult, AllocationRule, ClientCustomer, Employee, Payslip } from '@/lib/types';
import { sendEmail } from '@/lib/email';
import { render } from '@react-email/components';
import React from 'react';
import { ClientDocumentUploadEmail } from '@/components/emails/ClientDocumentUploadEmail';
import { DocumentReviewEmail } from '@/components/emails/DocumentReviewEmail';
import { NewNoteNotificationEmail } from '@/components/emails/NewNoteNotificationEmail';
import { OutstandingDocumentsEmail } from '@/components/emails/OutstandingDocumentsEmail';
import { OrderConfirmationEmail } from '@/components/emails/OrderConfirmationEmail';
import { AIAccountantWelcomeEmail } from '@/components/emails/AIAccountantWelcomeEmail';
import { PartnerWelcomeEmail } from '@/components/emails/PartnerWelcomeEmail';
import { WelcomeDiscountEmail } from '@/components/emails/WelcomeDiscountEmail';
import { format, addDays, addMonths, addYears } from 'date-fns';
import { BankCleaner } from '@/lib/bank-cleaner';

const db = getFirestore(firebaseApp);

/**
 * Checks if a territory slug is available for a new franchisee.
 */
export async function checkTerritoryAvailability(slug: string) {
    try {
        const usersRef = collection(db, 'users');
        const q = query(usersRef, where('franchise.areaSlug', '==', slug.toLowerCase().trim()), limit(1));
        const snap = await getDocs(q);
        return { available: snap.empty };
    } catch (e) {
        console.error("Territory check failed:", e);
        return { available: false, error: "System error" };
    }
}

export async function saveDemoLead(data: Omit<DemoLead, 'id' | 'createdAt'>) {
    try {
        const docRef = doc(collection(db, 'demoLeads'));
        await setDoc(docRef, {
            ...data,
            id: docRef.id,
            createdAt: serverTimestamp(),
        });
        return { success: true, id: docRef.id };
    } catch (e) {
        console.error("Save Demo lead failed:", e);
        return { success: false };
    }
}

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

export async function sendDocumentReviewFeedback({ orderId, clientName, clientEmail, documentUploads, resellerId }: { orderId: string, clientName: string, clientEmail: string, documentUploads: DocumentUpload[], resellerId?: string | null }) {
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
    resellerId?: string | null 
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

export async function sendOutstandingDocumentsReminder({ orderId, clientName, clientEmail, resellerId }: { orderId: string, clientName: string, clientEmail: string, resellerId?: string | null }) {
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

export async function generateNextTaskOccurrence(taskId: string) {
    const taskRef = doc(db, 'tasks', taskId);
    const taskSnap = await getDoc(taskRef);
    if (!taskSnap.exists()) return;
    const task = taskSnap.data() as Task;

    if (!task.recurrence || task.recurrence === 'None') return;

    let nextDueDate: Date;
    const currentDueDate = task.dueDate.toDate ? task.dueDate.toDate() : new Date(task.dueDate);

    switch (task.recurrence) {
        case 'Daily': nextDueDate = addDays(currentDueDate, 1); break;
        case 'Weekly': nextDueDate = addDays(currentDueDate, 7); break;
        case 'Monthly': nextDueDate = addMonths(currentDueDate, 1); break;
        case 'Bi-Monthly': nextDueDate = addMonths(currentDueDate, 2); break;
        case 'Semi-Annually': nextDueDate = addMonths(currentDueDate, 6); break;
        case 'Annually': nextDueDate = addYears(currentDueDate, 1); break;
        default: return;
    }

    const { id, ...rest } = task;
    
    let newTitle = task.title;
    if (task.createdBy === 'system' && task.type) {
        const clientNameMatch = task.title.match(/ for (.*)$/);
        const clientName = clientNameMatch ? clientNameMatch[1] : "";
        
        if (task.type === 'EMP201' || task.type === 'VAT201' || task.type === 'PAYROLL' || task.type === 'MGMT') {
            const periodDate = addMonths(nextDueDate, task.type === 'MGMT' ? -1 : 0);
            newTitle = `${task.type} Submission - ${format(periodDate, 'MMMM yyyy')} for ${clientName}`;
            if (task.type === 'PAYROLL') newTitle = `Payroll Preparation - ${format(periodDate, 'MMMM yyyy')} for ${clientName}`;
            if (task.type === 'MGMT') newTitle = `Management Accounts - ${format(periodDate, 'MMMM yyyy')} for ${clientName}`;
        } else if (task.type === 'AFS' || task.type === 'ITR') {
            newTitle = task.title.replace(/\d{4}/, (match) => (parseInt(match) + 1).toString());
        } else if (task.type === 'IRP6') {
            const periodMatch = task.title.match(/Period (\d)/);
            if (periodMatch) {
                const currentPeriod = parseInt(periodMatch[1]);
                const nextPeriod = currentPeriod === 1 ? 2 : 1;
                newTitle = task.title.replace(/Period \d/, `Period ${nextPeriod}`);
            }
        }
    }

    const newTaskData = {
        ...rest,
        title: newTitle,
        dueDate: Timestamp.fromDate(nextDueDate),
        status: 'To-Do' as const,
        createdAt: serverTimestamp(),
        comments: [],
    };

    await addDoc(collection(db, 'tasks'), newTaskData);
}

// AI ACCOUNTANT ACTIONS

export async function extractStatementChunk({ chunkBase64 }: { chunkBase64: string }) {
    try {
        const { extractStatementData } = await import('@/ai/flows/extract-statement-data');
        const result = await extractStatementData({ statementFile: chunkBase64 });
        return { success: true, transactions: result.transactions };
    } catch (e) {
        console.error("Chunk extraction failed:", e);
        return { success: false, error: "Failed to extract data" };
    }
}

export async function prepareAiAccountantAnalysis({ clientId, bankAccountId }: { clientId: string, bankAccountId: string }) {
    const transRef = collection(db, 'aiAccountantClients', clientId, 'transactions');
    const q = query(transRef, where('bankAccountId', '==', bankAccountId), where('status', '==', 'new'), where('isExpense', '==', true));
    const snap = await getDocs(q);
    
    if (snap.empty) return { count: 0 };

    const batch = writeBatch(db);
    snap.docs.forEach(d => batch.update(d.ref, { status: 'ai_processing' }));
    await batch.commit();

    return { count: snap.size };
}

export async function runAiAccountantAnalysis({ clientId, bankAccountId, initiatorEmail }: { clientId: string, bankAccountId: string, initiatorEmail: string }) {
    const transRef = collection(db, 'aiAccountantClients', clientId, 'transactions');
    const q = query(transRef, where('bankAccountId', '==', bankAccountId), where('status', '==', 'ai_processing'));
    const snap = await getDocs(q);

    if (snap.empty) return;

    const clientDoc = await getDoc(doc(db, 'aiAccountantClients', clientId));
    const clientData = clientDoc.data() as User;
    let allRules = [...(clientData.allocationRules || [])];
    if (!clientData.disableGlobalRules) {
        const globalSnap = await getDocs(collection(db, 'allocationRules'));
        allRules = [...allRules, ...globalSnap.docs.map(d => ({ ...d.data(), id: d.id } as AllocationRule))];
    }

    const getKeywordsArray = (keywords: string[] | string | undefined): string[] => {
        if (!keywords) return [];
        if (typeof keywords === 'string') return [keywords];
        if (Array.isArray(keywords)) return keywords;
        return [];
    };

    const batch = writeBatch(db);
    for (const d of snap.docs) {
        const tx = d.data() as ImportedTransaction;
        const result = BankCleaner.process(tx.description);
        
        const match = allRules.find(r => {
            const kws = getKeywordsArray(r.keywords);
            return kws.some(kw => result.cleanDescription.includes(kw.toUpperCase()));
        });
        
        if (match) {
            batch.update(d.ref, {
                ...result,
                status: 'ai_review',
                smartAllocationResult: {
                    accountId: match.accountId,
                    accountType: match.accountType || 'account',
                    vatType: match.vatType,
                    confidence: 100,
                    summary: `Match found for rule keyword.`,
                    ruleId: match.id,
                    matchedKeyword: getKeywordsArray(match.keywords).find(kw => result.cleanDescription.includes(kw.toUpperCase()))
                },
                allocationSource: 'rule'
            });
        } else {
            batch.update(d.ref, {
                ...result,
                status: 'ai_review',
                allocationSource: 'none'
            });
        }
    }

    await batch.commit();
}

export async function moveTransactionToNew({ clientId, transactionId }: { clientId: string, transactionId: string }) {
    const txRef = doc(db, 'aiAccountantClients', clientId, 'transactions', transactionId);
    await updateDoc(txRef, {
        status: 'new',
        allocatedTo: deleteField(),
        vatType: deleteField(),
        smartAllocationResult: deleteField(),
        allocationSource: deleteField(),
        merchantKey: deleteField(),
        cleanDescription: deleteField(),
        rawDescription: deleteField()
    });
}

export async function bulkMoveTransactionsToNew({ clientId, transactionIds }: { clientId: string, transactionIds: string[] }) {
    const batch = writeBatch(db);
    transactionIds.forEach(id => {
        const ref = doc(db, 'aiAccountantClients', clientId, 'transactions', id);
        batch.update(ref, {
            status: 'new',
            allocatedTo: deleteField(),
            vatType: deleteField(),
            smartAllocationResult: deleteField(),
            allocationSource: deleteField()
        });
    });
    await batch.commit();
    return { count: transactionIds.length };
}

export async function researchMerchantWithAi({ clientId, description, chartOfAccounts, isVatRegistered, isExpense }: any) {
    const { suggestTransactionAllocation } = await import('@/ai/flows/suggest-transaction-allocation');
    
    // Fetch custom client API key if configured in Firestore
    const clientRef = doc(db, 'aiAccountantClients', clientId);
    const clientDoc = await getDoc(clientRef);
    const geminiApiKey = clientDoc.data()?.geminiApiKey;

    const res = await suggestTransactionAllocation({
        description,
        chartOfAccounts,
        isVatRegistered,
        useWebSearch: true,
        apiKey: geminiApiKey
    });
    return res as SmartAllocationResult;
}

export async function researchAndAutoApproveGroup({
    clientId,
    merchantKey,
    description,
    chartOfAccounts,
    isVatRegistered,
    transactionIds
}: {
    clientId: string;
    merchantKey: string;
    description: string;
    chartOfAccounts: string;
    isVatRegistered: boolean;
    transactionIds: string[];
}) {
    const { suggestTransactionAllocation } = await import('@/ai/flows/suggest-transaction-allocation');
    
    // Fetch custom client API key if configured in Firestore
    const clientRef = doc(db, 'aiAccountantClients', clientId);
    const clientDoc = await getDoc(clientRef);
    const geminiApiKey = clientDoc.data()?.geminiApiKey;

    const suggestion = await suggestTransactionAllocation({
        description,
        chartOfAccounts,
        isVatRegistered,
        useWebSearch: true,
        apiKey: geminiApiKey
    });

    const batch = writeBatch(db);
    const transRef = collection(db, 'aiAccountantClients', clientId, 'transactions');
    const accuracy = suggestion.confidence;
    const isHighConfidence = accuracy > 90;

    transactionIds.forEach(id => {
        const updateData: any = {
            smartAllocationResult: {
                accountId: suggestion.accountId,
                vatType: isVatRegistered ? (suggestion.vatType || 'no_vat') : 'no_vat',
                confidence: suggestion.confidence,
                summary: isHighConfidence ? `[Suggested >90%] ${suggestion.summary}` : suggestion.summary,
                suggestedKeyword: suggestion.suggestedKeyword
            },
            allocationSource: 'ai',
            status: 'ai_review'
        };

        if (isHighConfidence) {
            updateData.allocatedTo = { value: suggestion.accountId, type: 'account' };
            updateData.vatType = isVatRegistered ? (suggestion.vatType || 'no_vat') : 'no_vat';
        }

        batch.update(doc(transRef, id), updateData);
    });

    await batch.commit();

    return {
        approved: false,
        highConfidence: isHighConfidence,
        suggestion
    };
}

export async function bulkAiResearchAndMatch({
    clientId,
    groups,
    chartOfAccounts,
    isVatRegistered
}: {
    clientId: string;
    groups: { merchantKey: string; description: string; transactionIds: string[] }[];
    chartOfAccounts: string;
    isVatRegistered: boolean;
}) {
    const results = [];
    for (const group of groups) {
        try {
            const res = await researchAndAutoApproveGroup({
                clientId,
                merchantKey: group.merchantKey,
                description: group.description,
                chartOfAccounts,
                isVatRegistered,
                transactionIds: group.transactionIds
            });
            results.push({ merchantKey: group.merchantKey, ...res });
        } catch (e) {
            console.error(`Failed research for ${group.merchantKey}:`, e);
            results.push({ merchantKey: group.merchantKey, approved: false, error: String(e) });
        }
    }
    return results;
}

export async function updateGlobalMerchantDb(data: any) {
    console.log("Global DB Update:", data);
}

export async function resetAiAccountantAnalysis({ clientId, bankAccountId }: { clientId: string, bankAccountId: string }) {
    const transRef = collection(db, 'aiAccountantClients', clientId, 'transactions');
    const q = query(transRef, where('bankAccountId', '==', bankAccountId), where('status', 'in', ['ai_processing', 'ai_review']));
    const snap = await getDocs(q);
    
    if (snap.empty) return { count: 0 };

    const batch = writeBatch(db);
    snap.docs.forEach(d => batch.update(d.ref, { status: 'new', smartAllocationResult: deleteField() }));
    await batch.commit();

    return { count: snap.size };
}

export async function proposeRegroups({ clientId, bankAccountId }: { clientId: string, bankAccountId: string }) {
    const transRef = collection(db, 'aiAccountantClients', clientId, 'transactions');
    const q = query(transRef, where('bankAccountId', '==', bankAccountId), where('status', '==', 'ai_review'));
    const snap = await getDocs(q);
    
    const txs = snap.docs.map(d => ({ ...d.data(), id: d.id } as ImportedTransaction));
    const groups: Record<string, string[]> = {};
    txs.forEach(t => {
        if (!groups[t.merchantKey!]) groups[t.merchantKey!] = [];
        groups[t.merchantKey!].push(t.id);
    });

    const proposals = [];
    const keys = Object.keys(groups);
    for (let i = 0; i < keys.length; i++) {
        for (let j = i + 1; j < keys.length; j++) {
            const sim = BankCleaner.getSimilarity(keys[i], keys[j]);
            if (sim.score > 0.85) {
                proposals.push({
                    fromKey: keys[j],
                    toKey: keys[i],
                    fromImpact: groups[keys[j]].length,
                    toImpact: groups[keys[i]].length,
                    score: Math.round(sim.score * 100),
                    confidence: 'High',
                    reason: sim.reason,
                    fromTxIds: groups[keys[j]],
                    fromExamples: [txs.find(t => t.merchantKey === keys[j])?.description],
                    toExamples: [txs.find(t => t.merchantKey === keys[i])?.description]
                });
            }
        }
    }
    return proposals;
}

export async function applyRegroups({ clientId, merges, userId }: { clientId: string, merges: any[], userId: string }) {
    const batch = writeBatch(db);
    merges.forEach(m => {
        m.fromTxIds.forEach((id: string) => {
            const ref = doc(db, 'aiAccountantClients', clientId, 'transactions', id);
            batch.update(ref, { merchantKey: m.toKey });
        });
    });
    await batch.commit();
}

export async function proposeAiRegroups({ clientId, bankAccountId, selectedMerchantKeys }: any) {
    const { aiSmartRegroup } = await import('@/ai/flows/ai-smart-regroup');
    const transRef = collection(db, 'aiAccountantClients', clientId, 'transactions');
    const q = query(transRef, where('bankAccountId', '==', bankAccountId), where('status', '==', 'ai_review'));
    const snap = await getDocs(q);
    
    const txs = snap.docs.map(d => ({ ...d.data(), id: d.id } as ImportedTransaction));
    const groupData: any[] = [];
    const merchantMap: Record<string, string[]> = {};

    txs.forEach(t => {
        if (!merchantMap[t.merchantKey!]) {
            merchantMap[t.merchantKey!] = [];
            groupData.push({ key: t.merchantKey, example: t.description, count: 0 });
        }
        merchantMap[t.merchantKey!].push(t.id);
    });

    groupData.forEach(g => g.count = merchantMap[g.key].length);

    const res = await aiSmartRegroup({ groups: groupData });
    return res.proposals.map(p => ({
        ...p,
        fromTxIds: merchantMap[p.fromKey],
        fromImpact: merchantMap[p.fromKey]?.length || 0,
        toImpact: merchantMap[p.toKey]?.length || 0,
        score: p.confidence,
        reason: p.reasoning,
        fromExamples: [txs.find(t => t.merchantKey === p.fromKey)?.description],
        toExamples: [txs.find(t => t.merchantKey === p.toKey)?.description]
    }));
}

export async function analyzeClientCommentAndSuggest({ clientId, transactionIds, comment, merchantKey, examples, chartOfAccounts, isVatRegistered }: any) {
    const { analyzeClientComment } = await import('@/ai/flows/analyze-client-comment');
    const res = await analyzeClientComment({
        comment,
        merchantKey,
        examples,
        chartOfAccounts,
        isVatRegistered
    });

    const batch = writeBatch(db);
    transactionIds.forEach((id: string) => {
        const ref = doc(db, 'aiAccountantClients', clientId, 'transactions', id);
        batch.update(ref, { 
            clientComment: comment,
            smartAllocationResult: {
                accountId: res.accountId,
                vatType: res.vatType,
                confidence: res.confidence,
                summary: `AI Analysis of client comment: ${res.reasoning}`
            }
        });
    });
    await batch.commit();

    return res;
}

export async function matchTransactionsToSuppliers({ clientId, bankAccountId }: { clientId: string, bankAccountId: string }) {
    const supSnap = await getDocs(collection(db, `aiAccountantClients/${clientId}/suppliers`));
    const suppliers = supSnap.docs.map(d => ({ id: d.id, name: d.data().name.toUpperCase() }));

    const transRef = collection(db, 'aiAccountantClients', clientId, 'transactions');
    const q = query(transRef, where('bankAccountId', '==', bankAccountId), where('status', 'in', ['new', 'ai_review']), where('isExpense', '==', true));
    const snap = await getDocs(q);

    const batch = writeBatch(db);
    let count = 0;

    snap.docs.forEach(d => {
        const tx = d.data() as ImportedTransaction;
        const match = suppliers.find(s => tx.description.toUpperCase().includes(s.name) || BankCleaner.getSimilarity(tx.description, s.name).score > 0.9);
        if (match) {
            batch.update(d.ref, {
                status: 'reviewed',
                allocatedTo: { value: match.id, type: 'supplier' },
                vatType: 'no_vat',
                allocatedAt: serverTimestamp(),
                allocationSource: 'manual'
            });
            count++;
        }
    });

    if (count > 0) await batch.commit();
    return { count };
}

export async function finalizeChatAllocation({ clientId, transactionId, accountId, vatType, explanation }: any) {
    const txRef = doc(db, 'aiAccountantClients', clientId, 'transactions', transactionId);
    await updateDoc(txRef, {
        status: 'reviewed',
        allocatedTo: { value: accountId, type: 'account' },
        vatType: vatType,
        clientExplanation: explanation,
        allocatedAt: serverTimestamp(),
        allocationSource: 'chat'
    });
}

// AI PAYROLL ACTIONS

export async function saveEmployeeAction({ clientId, employeeId, data }: { clientId: string, employeeId?: string, data: any }) {
    try {
        const targetRef = employeeId 
            ? doc(db, 'aiPayrollClients', clientId, 'employees', employeeId)
            : doc(collection(db, 'aiPayrollClients', clientId, 'employees'));
        
        await setDoc(targetRef, { ...data, updatedAt: serverTimestamp() }, { merge: true });
        
        if (!employeeId) {
            const { PayrollService } = await import('@/services/PayrollService');
            const baseValue = data.payType === 'Hourly' ? data.hourlyRate : data.basicSalary;
            await PayrollService.generateInitialPayslip(clientId, targetRef.id, baseValue);
        }

        return { success: true, id: targetRef.id };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

export async function generateEmployeePayslipAction({ clientId, employeeId, basicSalary, hours }: any) {
    try {
        const { PayrollService } = await import('@/services/PayrollService');
        return await PayrollService.generateInitialPayslip(clientId, employeeId, basicSalary, hours);
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

export async function updateDraftPayslipHoursAction({ clientId, employeeId, hours }: any) {
    const psRef = collection(db, 'aiPayrollClients', clientId, 'payslips');
    const q = query(psRef, where('employeeId', '==', employeeId), where('status', '==', 'draft'), limit(1));
    const snap = await getDocs(q);
    
    if (snap.empty) throw new Error("No draft payslip found");

    const ps = snap.docs[0].data() as Payslip;
    const empSnap = await getDoc(doc(db, 'aiPayrollClients', clientId, 'employees', employeeId));
    const employee = empSnap.data() as Employee;
    
    const { PayrollService } = await import('@/services/PayrollService');
    const freq = PayrollService.getFrequencyMultiplier(ps.frequency);
    const baseValue = (employee.payType === 'Hourly' ? employee.hourlyRate : employee.basicSalary) || 0;

    const earnings = PayrollService.calculateEarningsList(employee, baseValue, ps.period || '', freq, hours);
    const gross = earnings.reduce((s, i) => s + i.amount, 0);
    const deductions = PayrollService.getInitialDeductions(gross, ps.period || '', freq);
    const totalDeductions = deductions.reduce((s, i) => s + i.amount, 0);

    await updateDoc(snap.docs[0].ref, {
        earnings,
        deductions,
        grossPay: gross,
        totalDeductions,
        netPay: gross - totalDeductions,
        hoursWorked: hours.normal
    });

    return { success: true };
}

export async function syncEmployeeSalaryToActivePayslipAction({ clientId, employeeId, newSalary, isNetSalary }: any) {
    const psRef = collection(db, 'aiPayrollClients', clientId, 'payslips');
    const q = query(psRef, where('employeeId', '==', employeeId), where('status', '==', 'draft'), limit(1));
    const snap = await getDocs(q);
    
    if (snap.empty) return { success: false };

    const ps = snap.docs[0].data() as Payslip;
    const { PayrollService } = await import('@/services/PayrollService');
    const freq = PayrollService.getFrequencyMultiplier(ps.frequency);

    const empSnap = await getDoc(doc(db, 'aiPayrollClients', clientId, 'employees', employeeId));
    const employee = empSnap.data() as Employee;

    const earnings = PayrollService.calculateEarningsList(employee, newSalary, ps.period || '', freq);
    const gross = earnings.reduce((s, i) => s + i.amount, 0);
    const deductions = PayrollService.getInitialDeductions(gross, ps.period || '', freq);
    
    await updateDoc(snap.docs[0].ref, {
        earnings,
        deductions,
        grossPay: gross,
        netPay: gross - deductions.reduce((s, i) => s + i.amount, 0)
    });

    return { success: true };
}

export async function updatePayslipAction({ clientId, payslipId, data }: { clientId: string, payslipId: string, data: any }) {
    try {
        const psRef = doc(db, 'aiPayrollClients', clientId, 'payslips', payslipId);
        await updateDoc(psRef, { ...data, status: 'finalized', updatedAt: serverTimestamp() });
        return { success: true };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

export async function rollForwardPayrollAction({ clientId }: { clientId: string }) {
    const clientRef = doc(db, 'aiPayrollClients', clientId);
    const clientSnap = await getDoc(clientRef);
    const client = clientSnap.data() as User;

    const currentPeriod = client.firstProcessingMonth!;
    const nextPeriod = format(addMonths(parse(currentPeriod, 'MMMM yyyy', new Date()), 1), 'MMMM yyyy');

    const empsSnap = await getDocs(query(collection(db, 'aiPayrollClients', clientId, 'employees'), where('status', '==', 'Active')));
    
    const batch = writeBatch(db);
    let created = 0;

    for (const d of empsSnap.docs) {
        const emp = d.data() as Employee;
        const newPsRef = doc(collection(db, 'aiPayrollClients', clientId, 'payslips'));
        batch.set(newPsRef, {
            employeeId: d.id,
            employeeName: `${emp.name} ${emp.surname}`,
            period: nextPeriod,
            status: 'draft',
            createdAt: serverTimestamp(),
            earnings: [],
            deductions: [],
            contributions: [],
            fringeBenefits: [],
            grossPay: 0,
            totalDeductions: 0,
            netPay: 0,
            frequency: 'Monthly'
        });
        created++;
    }

    batch.update(clientRef, { firstProcessingMonth: nextPeriod });
    await batch.commit();

    return { success: true, nextPeriod, created };
}

export async function rollBackPayrollAction({ clientId }: { clientId: string }) {
    const clientRef = doc(db, 'aiPayrollClients', clientId);
    const clientSnap = await getDoc(clientRef);
    const client = clientSnap.data() as User;

    const currentPeriod = client.firstProcessingMonth!;
    const prevPeriod = format(addMonths(parse(currentPeriod, 'MMMM yyyy', new Date()), -1), 'MMMM yyyy');

    const psSnap = await getDocs(query(collection(db, 'aiPayrollClients', clientId, 'payslips'), where('period', '==', currentPeriod)));
    
    const batch = writeBatch(db);
    psSnap.forEach(d => batch.delete(d.ref));
    batch.update(clientRef, { firstProcessingMonth: prevPeriod });
    
    await batch.commit();

    return { success: true, prevPeriod, deletedCount: psSnap.size };
}

export async function reactivatePracticeSubscription({ userId }: { userId: string }) {
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, {
        'subscription.subscriptionStatus': 'active',
        'subscription.subscriptionEndDate': Timestamp.fromDate(addMonths(new Date(), 1))
    });
    return { success: true };
}

function parse(str: string, fmt: string, base: Date) {
    const parts = str.split(' ');
    const m = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"].indexOf(parts[0]);
    return new Date(parseInt(parts[1]), m, 1);
}

export async function sendOrderConfirmationEmailAction({
    order,
    resellerId,
    isNewUser,
    generatedPassword,
    showPaymentButton
}: {
    order: Order;
    resellerId?: string | null;
    isNewUser?: boolean;
    generatedPassword?: string | null;
    showPaymentButton?: boolean;
}) {
    // --- TEMPORARY DIAGNOSTIC LOGGING ---
    console.log("=== SEND ORDER CONFIRMATION EMAIL ACTION START ===");
    console.log("1. Input Payload parameters:", JSON.stringify({ resellerId, isNewUser, hasPassword: !!generatedPassword, showPaymentButton }, null, 2));
    console.log("2. Customer Info:", JSON.stringify({ name: order?.customerName, email: order?.customerEmail, phone: order?.customerPhone, endCustomerName: order?.endCustomerName, endCustomerEmail: order?.endCustomerEmail }, null, 2));
    console.log("3. Cart Items:", JSON.stringify(order?.items, null, 2));
    console.log("4. Calculated Totals:", JSON.stringify({ total: order?.total, clientTotal: order?.clientTotal, discountCode: order?.discountCode, discountAmount: order?.discountAmount }, null, 2));
    console.log("5. Full Firestore Document Data (passed order data):", JSON.stringify(order, null, 2));
    
    // Validated payload check
    const validationErrors = [];
    if (!order) validationErrors.push("Order object is null/undefined");
    else {
        if (!order.id) validationErrors.push("Missing order ID");
        if (!order.customerEmail) validationErrors.push("Missing customer email");
        if (!order.customerName) validationErrors.push("Missing customer name");
        if (!order.items || order.items.length === 0) validationErrors.push("Missing or empty order items");
    }
    
    console.log("6. Validated Payload Status:", validationErrors.length === 0 ? "VALID" : "INVALID: " + validationErrors.join(", "));
    // --- TEMPORARY DIAGNOSTIC LOGGING END ---

    try {
        if (validationErrors.length > 0) {
            throw new Error(`Order validation failed on server: ${validationErrors.join(", ")}`);
        }

        let resellerData: User | undefined;
        if (resellerId) {
            const resellerSnap = await getDoc(doc(db, 'users', resellerId));
            if (resellerSnap.exists()) {
                resellerData = { ...resellerSnap.data(), id: resellerSnap.id } as User;
            }
        }

        const emailHtml = render(
            React.createElement(OrderConfirmationEmail, {
                order,
                reseller: resellerData,
                isNewUser,
                generatedPassword,
                showPaymentButton
            })
        );

        const result = await sendEmail({
            to: order.customerEmail,
            subject: `Order Confirmation #${order.id}`,
            html: emailHtml,
            resellerId: resellerId || undefined,
        });

        console.log("7. Response returned to UI:", JSON.stringify(result, null, 2));
        console.log("=== SEND ORDER CONFIRMATION EMAIL ACTION END ===");
        return result;

    } catch (error: any) {
        console.error("FATAL SERVER-SIDE ERROR in sendOrderConfirmationEmailAction:");
        console.error("Full Server-Side Error Stack Trace:", error.stack || error);
        console.log("=== SEND ORDER CONFIRMATION EMAIL ACTION FAILED ===");
        
        return {
            success: false,
            error: error.message || 'Unknown server error rendering or sending confirmation email.',
            code: error.code || 'SERVER_ERROR'
        };
    }
}

export async function sendAIAccountantWelcomeEmailAction({
    email,
    name
}: {
    email: string;
    name: string;
}) {
    const emailHtml = render(
        React.createElement(AIAccountantWelcomeEmail, {
            name,
            loginUrl: `${process.env.NEXT_PUBLIC_APP_URL}/login`
        })
    );

    return await sendEmail({
        to: email,
        subject: `Welcome to My Accountant!`,
        html: emailHtml,
        bcc: 'kev@thinkestry.co.za'
    });
}

export async function sendPartnerWelcomeEmailAction({
    email,
    partnerName,
    password,
    loginUrl
}: {
    email: string;
    partnerName: string;
    password?: string;
    loginUrl: string;
}) {
    const emailHtml = render(
        React.createElement(PartnerWelcomeEmail, {
            partnerName,
            email,
            password,
            loginUrl
        })
    );

    return await sendEmail({
        to: email,
        cc: 'kev@thinkestry.co.za',
        subject: `Welcome to the My Accountant Partner Program!`,
        html: emailHtml
    });
}

export async function sendWelcomeDiscountEmailAction({
    email,
    name,
    discountCode
}: {
    email: string;
    name: string;
    discountCode: string;
}) {
    const emailHtml = render(
        React.createElement(WelcomeDiscountEmail, {
            name,
            discountCode
        })
    );

    return await sendEmail({
        to: email,
        subject: `Welcome to My Accountant!`,
        html: emailHtml
    });
}
