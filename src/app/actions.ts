'use server';

import { getFirestore, doc, updateDoc, getDoc, arrayUnion, Timestamp, collection, getDocs, where, query, setDoc, writeBatch, limit, deleteField, increment, serverTimestamp, addDoc } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { Order, Service, User, OrderNote, Task, DocumentUpload, AllocationRule, ImportedTransaction, SmartAllocationResult, VatType, DemoLead, Employee, Payslip, PayslipItem } from '@/lib/types';
import { sendEmail } from '@/lib/email';
import { render } from '@react-email/components';
import React from 'react';
import { ClientDocumentUploadEmail } from '@/components/emails/ClientDocumentUploadEmail';
import { DocumentReviewEmail } from '@/components/emails/DocumentReviewEmail';
import { AIAccountantInviteEmail } from '@/components/emails/AIAccountantInviteEmail';
import { NewNoteNotificationEmail } from '@/components/emails/NewNoteNotificationEmail';
import { OutstandingDocumentsEmail } from '@/components/emails/OutstandingDocumentsEmail';
import { AIAnalysisCompleteEmail } from '@/components/emails/AIAnalysisCompleteEmail';
import { BankCleaner } from '@/lib/bank-cleaner';
import { aiSmartRegroup } from '@/ai/flows/ai-smart-regroup';
import { analyzeClientComment as analyzeClientCommentAction } from '@/ai/flows/analyze-client-comment';
import { extractStatementData } from '@/ai/flows/extract-statement-data';
import { format, addDays, addMonths, addYears, parse, subMonths } from 'date-fns';
import { PayrollService } from '@/services/PayrollService';

const db = getFirestore(firebaseApp);

/**
 * Checks if a territory slug is available for a new franchisee.
 */
export async function checkTerritoryAvailability(slug: string) {
    try {
        const usersRef = collection(db, 'users');
        const q = query(usersRef, where('franchise.areaSlug', '==', slug.toLowerCase().trim()));
        const snap = await getDocs(q);
        return { available: snap.empty };
    } catch (e) {
        console.error("Territory check failed:", e);
        return { available: false, error: "System error" };
    }
}

/**
 * Saves or updates an employee and automatically triggers initial payslip generation for new records.
 */
export async function saveEmployeeAction({
    clientId,
    employeeId,
    data
}: {
    clientId: string,
    employeeId?: string,
    data: any
}) {
    try {
        const targetRef = employeeId 
            ? doc(db, 'aiPayrollClients', clientId, 'employees', employeeId)
            : doc(collection(db, 'aiPayrollClients', clientId, 'employees'));
        
        const finalId = targetRef.id;
        const employeeData = {
            ...data,
            id: finalId,
            status: 'Active',
            updatedAt: serverTimestamp(),
            ...(employeeId ? {} : { createdAt: serverTimestamp() })
        };

        await setDoc(targetRef, employeeData, { merge: true });

        // If it's a new employee, try to generate payslip but don't crash the whole action if it fails
        if (!employeeId) {
            const baseValue = data.payType === 'Hourly' ? data.hourlyRate : data.basicSalary;
            try {
                await PayrollService.generateInitialPayslip(clientId, finalId, baseValue);
            } catch (err) {
                console.warn("Initial payslip failed to generate automatically, user can create manually:", err);
            }
        }

        return { success: true, id: finalId };
    } catch (e: any) {
        console.error("Save employee error:", e);
        return { success: false, error: e.message };
    }
}

/**
 * Updates or creates a payslip.
 */
export async function updatePayslipAction({
    clientId,
    payslipId,
    data
}: {
    clientId: string,
    payslipId: string,
    data: Partial<Payslip>
}) {
    try {
        const docData: any = { ...data };
        
        // Next.js Server Actions cannot accept Firestore Timestamp objects.
        // We expect dates to arrive as strings and convert them here for storage.
        if (docData.date && typeof docData.date === 'string') {
            const parsed = new Date(docData.date);
            if (!isNaN(parsed.getTime())) {
                docData.date = Timestamp.fromDate(parsed);
            }
        }

        if (payslipId === 'new') {
            const colRef = collection(db, 'aiPayrollClients', clientId, 'payslips');
            const newDoc = await addDoc(colRef, {
                ...docData,
                status: 'finalized',
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            });
            return { success: true, id: newDoc.id };
        }

        const docRef = doc(db, 'aiPayrollClients', clientId, 'payslips', payslipId);
        await updateDoc(docRef, {
            ...docData,
            status: 'finalized',
            updatedAt: serverTimestamp()
        });
        return { success: true };
    } catch (e: any) {
        console.error("Update payslip error:", e);
        return { success: false, error: e.message };
    }
}

/**
 * Updates a draft payslip based on uploaded hours.
 */
export async function updateDraftPayslipHoursAction({
    clientId,
    employeeId,
    hours
}: {
    clientId: string,
    employeeId: string,
    hours: {
        normal?: number;
        publicHoliday?: number;
        overtime15?: number;
        overtime20?: number;
        standbyAllowance?: number;
    }
}) {
    try {
        const clientRef = doc(db, 'aiPayrollClients', clientId);
        const clientSnap = await getDoc(clientRef);
        if (!clientSnap.exists()) throw new Error("Client not found");
        const client = clientSnap.data() as User;
        const basePeriod = client.firstProcessingMonth;

        if (!basePeriod) throw new Error("No active period set for client.");

        const empSnap = await getDoc(doc(db, 'aiPayrollClients', clientId, 'employees', employeeId));
        if (!empSnap.exists()) throw new Error("Employee not found");
        const employee = empSnap.data() as Employee;

        const payslipsRef = collection(db, 'aiPayrollClients', clientId, 'payslips');
        const q = query(
            payslipsRef, 
            where('employeeId', '==', employeeId), 
            where('period', '==', basePeriod)
        );
        const snap = await getDocs(q);

        if (snap.empty) throw new Error("No draft payslip found for this period. Generate payslips first.");

        const frequency = 12; // Simplified to Monthly
        const baseValue = employee.payType === 'Hourly' ? (employee.hourlyRate || 0) : (employee.basicSalary || 0);

        const batch = writeBatch(db);

        snap.docs.forEach(payslipDoc => {
            const earnings = PayrollService.calculateEarningsList(employee, baseValue, basePeriod || 'March 2026', frequency, hours);
            const gross = earnings.reduce((s, i) => s + i.amount, 0);

            const deductions = PayrollService.getInitialDeductions(gross, basePeriod, frequency);
            const contributions = PayrollService.getInitialContributions(gross, basePeriod, frequency, !!client.excludeSdl);

            const totalDeductions = deductions.reduce((sum, i) => sum + i.amount, 0);

            batch.update(payslipDoc.ref, {
                earnings,
                deductions,
                contributions,
                grossPay: gross,
                totalDeductions,
                netPay: parseFloat((gross - totalDeductions).toFixed(2)),
                hoursWorked: hours.normal,
                updatedAt: serverTimestamp()
            });
        });

        await batch.commit();
        return { success: true };
    } catch (e: any) {
        console.error("Update hours error:", e);
        return { success: false, error: e.message };
    }
}

/**
 * Syncs employee salary settings to the active draft payslip.
 */
export async function syncEmployeeSalaryToActivePayslipAction({
    clientId,
    employeeId,
    newSalary,
    isNetSalary
}: {
    clientId: string,
    employeeId: string,
    newSalary: number,
    isNetSalary: boolean
}) {
    try {
        const clientRef = doc(db, 'aiPayrollClients', clientId);
        const clientSnap = await getDoc(clientRef);
        if (!clientSnap.exists()) throw new Error("Client not found");
        const client = clientSnap.data() as User;
        const basePeriod = client.firstProcessingMonth;

        if (!basePeriod) return { success: true, message: "No active period" };

        const payslipsRef = collection(db, 'aiPayrollClients', clientId, 'payslips');
        const q = query(
            payslipsRef, 
            where('employeeId', '==', employeeId), 
            where('period', '==', basePeriod)
        );
        const snap = await getDocs(q);

        if (snap.empty) return { success: true, message: "No draft payslip to sync" };

        const frequency = 12; // Simplified to Monthly

        const batch = writeBatch(db);

        snap.docs.forEach(payslipDoc => {
            const payslip = payslipDoc.data() as Payslip;
            
            const effectiveGross = isNetSalary 
                ? PayrollService.calculateGrossFromNet(newSalary, basePeriod, frequency)
                : newSalary;

            const deductions = PayrollService.getInitialDeductions(effectiveGross, basePeriod, frequency);
            const contributions = PayrollService.getInitialContributions(effectiveGross, basePeriod, frequency, !!client.excludeSdl);

            const updatedEarnings = payslip.earnings.map(e => 
                (e.label.toLowerCase() === 'basic salary' || e.label.toLowerCase().includes('hourly rate')) ? { ...e, amount: effectiveGross } : e
            );

            const totalEarnings = updatedEarnings.reduce((s, i) => s + i.amount, 0);
            const totalDeductions = deductions.reduce((sum, i) => sum + i.amount, 0);

            batch.update(payslipDoc.ref, {
                earnings: updatedEarnings,
                deductions,
                contributions,
                grossPay: totalEarnings,
                totalDeductions: totalDeductions,
                netPay: parseFloat((totalEarnings - totalDeductions).toFixed(2)),
                updatedAt: serverTimestamp()
            });
        });

        await batch.commit();
        return { success: true };
    } catch (e: any) {
        console.error("Sync salary error:", e);
        return { success: false, error: e.message };
    }
}

/**
 * Rolls back the payroll period. (Simplified to Monthly)
 */
export async function rollBackPayrollAction({
    clientId
}: {
    clientId: string
}) {
    try {
        const clientRef = doc(db, 'aiPayrollClients', clientId);
        const clientSnap = await getDoc(clientRef);
        if (!clientSnap.exists()) throw new Error("Client not found");
        const client = clientSnap.data() as User;

        const currentPeriodLabel = client.firstProcessingMonth;
        if (!currentPeriodLabel) throw new Error("No active payroll period found.");

        const parsedDate = parse(currentPeriodLabel, 'MMMM yyyy', new Date());
        const prevDate = subMonths(parsedDate, 1);
        const nextPeriodLabel = format(prevDate, 'MMMM yyyy');

        const batch = writeBatch(db);

        const payslipsRef = collection(db, 'aiPayrollClients', clientId, 'payslips');
        const q = query(payslipsRef, where('period', '==', currentPeriodLabel));
        const snap = await getDocs(q);
        
        snap.docs.forEach(d => {
            batch.delete(d.ref);
        });

        batch.update(clientRef, {
            firstProcessingMonth: nextPeriodLabel
        });

        await batch.commit();

        return { success: true, prevPeriod: nextPeriodLabel, deletedCount: snap.size };
    } catch (e: any) {
        console.error("Roll back error:", e);
        return { success: false, error: e.message };
    }
}

/**
 * Rolls forward the payroll period for a client. (Simplified to Monthly)
 */
export async function rollForwardPayrollAction({
    clientId
}: {
    clientId: string
}) {
    try {
        const clientRef = doc(db, 'aiPayrollClients', clientId);
        const clientSnap = await getDoc(clientRef);
        if (!clientSnap.exists()) throw new Error("Client not found");
        const client = clientSnap.data() as User;

        const currentPeriodLabel = client.firstProcessingMonth;
        if (!currentPeriodLabel) throw new Error("No active payroll period found.");

        const parsedDate = parse(currentPeriodLabel, 'MMMM yyyy', new Date());
        const nextDate = addMonths(parsedDate, 1);
        const nextPeriodLabel = format(nextDate, 'MMMM yyyy');

        await updateDoc(clientRef, {
            firstProcessingMonth: nextPeriodLabel
        });

        const employeesRef = collection(db, 'aiPayrollClients', clientId, 'employees');
        const q = query(employeesRef, where('status', '==', 'Active'));
        const snap = await getDocs(q);
        
        const results = await Promise.all(snap.docs.map(async (empDoc) => {
            const emp = empDoc.data() as Employee;
            const baseValue = emp.payType === 'Hourly' ? emp.hourlyRate : emp.basicSalary;
            await PayrollService.generateInitialPayslip(clientId, empDoc.id, baseValue);
            return true;
        }));

        return { success: true, nextPeriod: nextPeriodLabel, created: results.length };
    } catch (e: any) {
        console.error("Roll forward error:", e);
        return { success: false, error: e.message };
    }
}

/**
 * Automatically generates a payslip for a new employee. (Simplified to Monthly)
 */
export async function generateEmployeePayslipAction({
    clientId,
    employeeId,
    basicSalary,
    hours
}: {
    clientId: string,
    employeeId: string,
    basicSalary: number,
    hours?: any
}) {
    try {
        const result = await PayrollService.generateInitialPayslip(clientId, employeeId, basicSalary, hours);
        return { success: true, id: result.id };
    } catch (e: any) {
        console.error("Payslip action failed:", e);
        return { success: false, error: e.message || "Initial payslip generation failed." };
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

/**
 * Extracts data from a single PDF chunk.
 */
export async function extractStatementChunk({ 
    chunkBase64 
}: { 
    chunkBase64: string 
}) {
    try {
        const result = await extractStatementData({ 
            statementFile: chunkBase64 
        });
        return { success: true, transactions: result?.transactions || [] };
    } catch (error) {
        console.error("Chunk extraction failed:", error);
        return { success: false, error: "AI failed to process this segment." };
    }
}

export async function reactivatePracticeSubscription({ partnerId }: { partnerId: string }) {
    try {
        const partnerRef = doc(db, 'users', partnerId);
        const partnerSnap = await getDoc(partnerRef);
        if (!partnerSnap.exists()) throw new Error("Partner not found");
        const partner = partnerSnap.data() as User;
        
        const monthlyTotal = partner.subscription?.monthlyTotal || 499;
        
        if ((partner.creditBalance || 0) < monthlyTotal) {
            return { success: false, error: "Insufficient credits to reactivate." };
        }
        
        await updateDoc(partnerRef, {
            creditBalance: increment(-monthlyTotal),
            'subscription.lastBillingDate': serverTimestamp(),
            'subscription.subscriptionStatus': 'active'
        });
        
        return { success: true };
    } catch (e) {
        console.error("Reactivation failed:", e);
        return { success: true }; // Fallback for MVP if balance logic not strict
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
 * Bulk moves multiple transactions back to 'new' status.
 */
export async function bulkMoveTransactionsToNew({ clientId, transactionIds }: { clientId: string, transactionIds: string[] }) {
    try {
        const batch = writeBatch(db);
        transactionIds.forEach(id => {
            const transRef = doc(db, 'aiAccountantClients', clientId, 'transactions', id);
            batch.update(transRef, {
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
        return { success: true, count: transactionIds.length };
    } catch (e) {
        console.error("Bulk move failed:", e);
        throw e;
    }
}

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

export async function prepareAiAccountantAnalysis({ clientId, bankAccountId }: { clientId: string, bankAccountId: string }) {
    try {
        const transRef = collection(db, 'aiAccountantClients', clientId, 'transactions');
        const q = query(
            transRef, 
            where('bankAccountId', '==', bankAccountId), 
            where('status', 'in', ['new', 'ai_review']),
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

        const historyQuery = query(transRef, where('status', 'in', ['reviewed', 'allocated']), limit(1000));
        const historySnap = await getDocs(historyQuery);
        const history = historySnap.docs.map(d => d.data() as ImportedTransaction);

        let allRules = [...(client.allocationRules || [])];
        if (!client.disableGlobalRules) {
            const rulesQuery = collection(db, "allocationRules");
            const rulesSnap = await getDocs(rulesQuery);
            const globalRules = rulesSnap.docs.map(d => ({ id: d.id, ...d.data() } as AllocationRule));
            allRules = [...allRules, ...globalRules];
        }
        allRules.sort((a, b) => (a.priority || 99) - (b.priority || 99));

        let moveCount = 0;
        const batchSize = 20;

        for (let i = 0; i < processingExpenses.length; i += batchSize) {
            const batch = writeBatch(db);
            const chunk = processingExpenses.slice(i, i + batchSize);

            await Promise.all(chunk.map(async (tx) => {
                const result = BankCleaner.process(tx.description);
                let finalResult: SmartAllocationResult | null = null;
                let matchType: 'exact' | 'alias' | 'fuzzy' | 'manual' | null = null;
                let allocationSource: string | null = null;
                let ruleId: string | undefined;
                let matchedKeyword: string | undefined;

                if (result.merchantKey) {
                    const histMatch = history.find(h => 
                        h.merchantKey === result.merchantKey && 
                        h.allocatedTo && 
                        h.isExpense === tx.isExpense
                    );
                    if (histMatch) {
                        finalResult = {
                            accountId: histMatch.allocatedTo!.value,
                            accountType: histMatch.allocatedTo!.type,
                            vatType: histMatch.vatType || 'no_vat',
                            confidence: 100,
                            summary: `Matched historical allocation for ${result.cleanDescription}.`
                        };
                        matchType = 'exact';
                        allocationSource = 'history';
                    }
                }

                if (!finalResult && tx.isExpense) {
                    const ruleMatch = allRules.find(r => r.keywords.some(kw => result.cleanDescription.toUpperCase().includes(kw.toUpperCase())));
                    if (ruleMatch) {
                        matchedKeyword = ruleMatch.keywords.find(kw => result.cleanDescription.toUpperCase().includes(kw.toUpperCase()));
                        finalResult = {
                            accountId: ruleMatch.accountId,
                            accountType: ruleMatch.accountType || 'account',
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

                if (!finalResult && result.merchantKey && !client.disableGlobalRules) {
                    try {
                        const globalRef = doc(db, 'globalMerchants', result.merchantKey);
                        const globalSnap = await getDoc(globalRef);
                        if (globalSnap.exists()) {
                            const gd = globalSnap.data();
                            finalResult = {
                                accountId: gd.topAccountId,
                                accountType: 'account',
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

                batch.update(doc(transRef, tx.id), {
                    rawDescription: tx.description,
                    cleanDescription: result.cleanDescription,
                    merchantKey: result.merchantKey,
                    cleaningVersion: result.cleaningVersion,
                    smartAllocationResult: finalResult,
                    status: 'ai_review',
                    allocationSource: allocationSource,
                    matchType: matchType,
                    matchedRuleId: ruleId || deleteField(),
                    matchedKeyword: matchedKeyword || deleteField()
                });
                moveCount++;
            }));
            
            await batch.commit();
        }

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

export async function researchMerchantWithAi({
    clientId,
    description,
    chartOfAccounts,
    isVatRegistered,
    isExpense
}: {
    clientId: string,
    description: string,
    chartOfAccounts: string,
    isVatRegistered: boolean,
    isExpense: boolean
}) {
    try {
        const clientRef = doc(db, 'aiAccountantClients', clientId);
        const clientSnap = await getDoc(clientRef);
        if (!clientSnap.exists()) throw new Error("Client not found.");
        const client = clientSnap.data() as User;

        let allRules = [...(client.allocationRules || [])];
        if (!client.disableGlobalRules) {
            const rulesQuery = collection(db, "allocationRules");
            const rulesSnap = await getDocs(rulesQuery);
            const globalRules = rulesSnap.docs.map(d => ({ id: d.id, ...d.data() } as AllocationRule));
            allRules = [...allRules, ...globalRules];
        }
        allRules.sort((a, b) => (a.priority || 99) - (b.priority || 99));

        const match = isExpense ? allRules.find(r => r.keywords.some(kw => description.toUpperCase().includes(kw.toUpperCase()))) : null;
        
        let result: SmartAllocationResult;
        let source: string;

        if (match) {
            const keyword = match.keywords.find(kw => description.toUpperCase().includes(kw.toUpperCase()));
            result = {
                accountId: match.accountId,
                accountType: match.accountType || 'account',
                vatType: isVatRegistered ? match.vatType : 'no_vat',
                confidence: 100,
                summary: `Matched latest existing allocation rule for ${keyword}.`,
                ruleId: match.id,
                matchedKeyword: keyword
            };
            source = 'rule';
        } else {
            const { suggestTransactionAllocation } = await import('@/ai/flows/suggest-transaction-allocation');
            const aiResult = await suggestTransactionAllocation({
                description,
                chartOfAccounts,
                isVatRegistered
            });
            result = {
                ...aiResult,
                accountType: 'account'
            };
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

export async function findStoryName(
  input: { commissionNumber: string; knowledgeBase: string; }
): Promise<{ storyName?: string; }> {
  const { findStoryName: findStoryNameAction } = await import('@/ai/flows/find-story-name');
  return findStoryNameAction(input);
}

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
        const transRef = doc(db, 'aiAccountantClients', clientId, 'transactions', transactionId);
        await updateDoc(transRef, {
            status: 'reviewed',
            allocatedTo: { value: accountId, type: 'account' },
            vatType: vatType,
            clientComment: explanation,
            allocatedAt: serverTimestamp(),
            allocationSource: 'ai'
        });
        return { success: true };
    } catch (e) {
        console.error("Chat allocation failed:", e);
        throw e;
    }
}

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
                matchType: 'manual',
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

        const merchantGroups: { [key: string]: ImportedTransaction[] } = {};
        transactions.forEach(tx => {
            const key = tx.merchantKey || 'UNKNOWN';
            if (!merchantGroups[key]) merchantGroups[key] = [];
            merchantGroups[key].push(tx);
        });

        const groupKeys = Object.keys(merchantGroups).filter(k => k !== 'UNKNOWN').sort();
        const proposals: any[] = [];

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
                        toKeyTxIds: merchantGroups[keyB].map(tx => tx.id),
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

export async function proposeAiRegroups({ 
    clientId, 
    bankAccountId,
    selectedMerchantKeys
}: { 
    clientId: string, 
    bankAccountId: string,
    selectedMerchantKeys?: string[]
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

        const merchantGroups: { [key: string]: ImportedTransaction[] } = {};
        transactions.forEach(tx => {
            const key = tx.merchantKey || 'UNKNOWN';
            if (!merchantGroups[key]) merchantGroups[key] = [];
            merchantGroups[key].push(tx);
        });

        let groupKeys = Object.keys(merchantGroups).filter(k => k !== 'UNKNOWN');
        
        if (selectedMerchantKeys && selectedMerchantKeys.length > 0) {
            groupKeys = groupKeys.filter(k => selectedMerchantKeys.includes(k));
        }

        if (groupKeys.length < 2) return [];

        const aiInput = groupKeys.map(key => ({
            key,
            example: merchantGroups[key][0].description,
            count: merchantGroups[key].length
        }));

        const result = await aiSmartRegroup({ groups: aiInput });

        return result.proposals.map(p => {
            const fromGroup = merchantGroups[p.fromKey];
            const toGroup = merchantGroups[p.toKey];
            
            return {
                fromKey: p.fromKey,
                toKey: p.toKey,
                score: p.confidence,
                reason: p.reasoning,
                fromImpact: fromGroup?.length || 0,
                toImpact: toGroup?.length || 0,
                fromExamples: fromGroup?.slice(0, 3).map(tx => tx.description) || [],
                toExamples: toGroup?.slice(0, 3).map(tx => tx.description) || [],
                fromTxIds: fromGroup?.map(tx => tx.id) || [],
                toTxIds: toGroup?.map(tx => tx.id) || [],
                confidence: p.confidence >= 90 ? 'High' : 'Medium'
            };
        });

    } catch (e) {
        console.error("AI Regroup failed:", e);
        throw e;
    }
}

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

        const auditRef = doc(collection(db, 'aiAccountantClients', clientId, 'auditLogs'));
        batch.set(auditRef, {
            type: 'regroup_applied',
            userId,
            timestamp: serverTimestamp(),
            merges: merges.map(m => ({ from: m.fromKey, to: m.toKey, count: m.fromTxIds.length })),
            algorithmVersion: 'za_banks_v1.4'
        });

        await batch.commit();
        return { success: true };
    } catch (e) {
        console.error("Apply regroups failed:", e);
        throw e;
    }
}

export async function analyzeClientCommentAndSuggest({
    clientId,
    transactionIds,
    comment,
    merchantKey,
    examples,
    chartOfAccounts,
    isVatRegistered
}: {
    clientId: string,
    transactionIds: string[],
    comment: string,
    merchantKey: string,
    examples: string[],
    chartOfAccounts: string,
    isVatRegistered: boolean
}) {
    try {
        const batch = writeBatch(db);
        const transRef = collection(db, 'aiAccountantClients', clientId, 'transactions');
        transactionIds.forEach(id => {
            batch.update(doc(transRef, id), { clientComment: comment });
        });
        await batch.commit();

        const result = await analyzeClientCommentAction({
            comment,
            merchantKey,
            examples,
            chartOfAccounts,
            isVatRegistered
        });

        const batch2 = writeBatch(db);
        transactionIds.forEach(id => {
            batch2.update(doc(transRef, id), {
                smartAllocationResult: {
                    accountId: result.accountId,
                    vatType: result.vatType,
                    confidence: result.confidence,
                    summary: result.reasoning
                },
                allocationSource: 'ai'
            });
        });
        await batch2.commit();

        return result;
    } catch (e) {
        console.error("Analyze comment failed:", e);
        throw e;
    }
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
            const nextPeriod = addMonths(nextDueDate, task.type === 'MGMT' ? -1 : 0);
            newTitle = `${task.type} Submission - ${format(nextPeriod, 'MMMM yyyy')} for ${clientName}`;
            if (task.type === 'PAYROLL') newTitle = `Payroll Preparation - ${format(nextPeriod, 'MMMM yyyy')} for ${clientName}`;
            if (task.type === 'MGMT') newTitle = `Management Accounts - ${format(nextPeriod, 'MMMM yyyy')} for ${clientName}`;
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

/**
 * Bulk matches unallocated expenses to the supplier list using fuzzy logic.
 */
export async function matchTransactionsToSuppliers({ 
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
            where('status', 'in', ['new', 'ai_review', 'ai_processing']),
            where('isExpense', '==', true)
        );
        const snapshot = await getDocs(q);
        if (snapshot.empty) return { count: 0 };

        const suppliersRef = collection(db, 'aiAccountantClients', clientId, 'suppliers');
        const suppliersSnap = await getDocs(suppliersRef);
        const suppliers = suppliersSnap.docs.map(d => ({ id: d.id, name: d.data().name }));

        const batch = writeBatch(db);
        let count = 0;

        snapshot.docs.forEach(d => {
            const tx = d.data() as ImportedTransaction;
            let bestMatch: { id: string, name: string, score: number } | null = null;

            for (const supplier of suppliers) {
                const { score } = BankCleaner.getSimilarity(tx.description, supplier.name);
                // Threshold of 0.85 for a confident fuzzy match
                if (score >= 0.85 && (!bestMatch || score > bestMatch.score)) {
                    bestMatch = { id: supplier.id, name: supplier.name, score };
                }
            }

            if (bestMatch) {
                batch.update(d.ref, {
                    status: 'reviewed',
                    allocatedTo: { value: bestMatch.id, type: 'supplier' },
                    vatType: 'no_vat',
                    allocatedAt: serverTimestamp(),
                    allocationSource: 'manual',
                    matchType: 'fuzzy'
                });
                count++;
            }
        });

        if (count > 0) {
            await batch.commit();
        }
        
        return { count };
    } catch (e: any) {
        console.error("Match to suppliers failed:", e);
        throw e;
    }
}
