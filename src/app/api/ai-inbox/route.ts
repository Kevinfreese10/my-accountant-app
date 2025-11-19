
// /src/app/api/ai-inbox/route.ts
import { NextResponse } from 'next/server';
import imaps from 'imap-simple';
import { simpleParser } from 'mailparser';
import { getFirestore, collection, getDocs, doc, setDoc, serverTimestamp, query, where, writeBatch, deleteDoc, orderBy, addDoc, Timestamp } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { categorizeSupportRequest } from '@/ai/flows/categorize-support-requests';

const db = getFirestore(firebaseApp);

async function connectToImap() {
    const config = {
      imap: {
        user: 'info@myacc.co.za',
        password: 'Thinkestry10$',
        host: 'mail.myacc.co.za',
        port: 993,
        tls: true,
        authTimeout: 3000,
        tlsOptions: { rejectUnauthorized: false } 
      },
    };
    return await imaps.connect(config);
}


export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const shouldSync = searchParams.get('sync') === 'true';

    let connection;
    try {
        if (shouldSync) {
            // Step 1: Fetch existing email UIDs from Firestore
            const inboxEmailsSnapshot = await getDocs(query(collection(db, 'inboxEmails'), orderBy('uid', 'desc')));
            const existingUids = new Set(inboxEmailsSnapshot.docs.map(doc => doc.data().uid));

            // Step 2: Connect to IMAP and get all email UIDs from server
            connection = await connectToImap();
            await connection.openBox('INBOX');
            const serverMessages = await connection.search(['ALL'], { bodies: [], headers: ['message-id'] });
            const serverUids = new Set(serverMessages.map(msg => msg.attributes.uid));
            
            // Step 3: Determine which emails are new
            const newUids = Array.from(serverUids).filter(uid => !existingUids.has(uid));
            
            // Step 4: Fetch only the new emails from the server
            if (newUids.length > 0) {
                const newMessages = await connection.search([['UID', newUids.join(',')]], { bodies: [''], markSeen: false });
                const batch = writeBatch(db);

                for (const item of newMessages) {
                    const all = item.parts.find((part) => part.which === '');
                    const mail = await simpleParser(all?.body || '');
                    
                    const attachments = await Promise.all(mail.attachments.map(async (att) => {
                      if (att.content) {
                          const dataUrl = `data:${att.contentType};base64,${att.content.toString('base64')}`;
                          return {
                            filename: att.filename || null,
                            contentType: att.contentType || null,
                            dataUrl: dataUrl,
                            size: att.size || null,
                          };
                      }
                      return {
                          filename: att.filename || null,
                          contentType: att.contentType || null,
                          dataUrl: null,
                          size: att.size || null,
                      };
                    }));

                    const emailData: any = {
                      uid: item.attributes.uid,
                      from: mail.from?.text || 'No Sender',
                      subject: mail.subject || 'No Subject',
                      date: mail.date?.toISOString() || new Date().toISOString(),
                      body: mail.html || mail.textAsHtml || '',
                      attachments: attachments,
                      createdAt: serverTimestamp(),
                      processedAction: null,
                    };
                    
                    // --- AUTOMATIC ANALYSIS ON SYNC ---
                    const requestText = `Subject: ${emailData.subject}\n\nBody: ${emailData.body.replace(/<[^>]*>?/gm, ' ')}`;
                    const clientName = emailData.from.split('<')[0].trim();

                    try {
                        const analysis = await categorizeSupportRequest({
                            request: requestText,
                            clientName,
                            attachments: emailData.attachments,
                        });
                        
                        // Merge analysis results into emailData
                        emailData.summary = analysis.summary || null;
                        emailData.category = analysis.category || null;
                        emailData.priority = analysis.priority || null;
                        emailData.sla = analysis.sla || null;
                        emailData.suggestedAction = analysis.suggestedAction || 'none';
                        emailData.draftReply = analysis.draftReply || null;

                        if (analysis.task?.shouldCreate && analysis.task.title) {
                            const dueDate = new Date();
                            dueDate.setHours(dueDate.getHours() + (analysis.sla || 48));
                            
                            // Do not use batch for this, add directly to avoid transaction size limits
                            await addDoc(collection(db, 'tasks'), {
                                title: analysis.task.title,
                                description: analysis.task.description || 'Generated from email.',
                                status: 'To-Do',
                                priority: analysis.priority,
                                dueDate: Timestamp.fromDate(dueDate),
                                createdAt: serverTimestamp(),
                                createdBy: 'ai_system',
                                assignedTo: [],
                            });
                            emailData.isProcessed = true;
                            emailData.processedAction = 'processed';
                        }
                    } catch (aiError) {
                        console.error(`AI analysis failed for email UID ${emailData.uid}:`, aiError);
                        // Still save the email, but without AI data
                        emailData.suggestedAction = 'none'; 
                    }
                    // --- END AUTOMATIC ANALYSIS ---

                    const docRef = doc(db, 'inboxEmails', String(emailData.uid));
                    batch.set(docRef, emailData);
                }
                await batch.commit();
            }
        }

        // Step 5: Fetch all emails (new and old) from Firestore and combine with processed status
        const allEmailsSnapshot = await getDocs(query(collection(db, 'inboxEmails'), orderBy('date', 'desc')));
        const allEmails = allEmailsSnapshot.docs.map(doc => doc.data());
        
        return NextResponse.json(allEmails);

    } catch (error: any) {
        console.error('AI Inbox API Error:', error);
        return NextResponse.json({ error: `Failed to sync with mail server: ${error.message}` }, { status: 500 });
    } finally {
        if(connection) connection.end();
    }
}

export async function POST(req: Request) {
    const { uids, action } = await req.json();
    if (!uids || !action) {
      return NextResponse.json({ error: 'Missing UIDs or action.' }, { status: 400 });
    }

    try {
        const batch = writeBatch(db);

        if (action === 'delete') {
            uids.forEach((uid: number) => {
                const docRef = doc(db, 'inboxEmails', String(uid));
                batch.delete(docRef);
            });
        } else if (action === 'unarchive') {
             uids.forEach((uid: number) => {
                const docRef = doc(db, 'inboxEmails', String(uid));
                batch.update(docRef, { processedAction: null });
            });
        } else { // process or archive
             uids.forEach((uid: number) => {
                const docRef = doc(db, 'inboxEmails', String(uid));
                batch.update(docRef, { isProcessed: true, processedAction: action });
            });
        }
        
        await batch.commit();

        return NextResponse.json({ message: 'Action completed successfully.' });
    } catch (error: any) {
        console.error('Error performing email action:', error);
        return NextResponse.json({ error: `An unexpected error occurred: ${error.message}` }, { status: 500 });
    }
}
