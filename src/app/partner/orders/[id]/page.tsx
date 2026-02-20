'use client';

import { useState, useEffect } from 'react';
import { notFound, useParams } from 'next/navigation';
import { getFirestore, doc, getDoc, updateDoc, arrayUnion, Timestamp, collection, getDocs, where, query, setDoc } from 'firebase/firestore';
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { firebaseApp } from '@/lib/firebase';
import { Order, Service, User, OrderNote, DocumentUpload } from '@/lib/types';
import { useAuth } from '@/contexts/AuthContext';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Loader2, User as UserIcon, Mail, Phone, Send, MessageSquare, Users, Sparkles, Paperclip, CheckCircle, AlertTriangle, XCircle, Download, Star, Percent, Clock, ClipboardCheck, FileText } from 'lucide-react';
import { format } from 'date-fns';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { sendEmail } from '@/lib/email';
import { render } from '@react-email/components';
import DocumentRequestEmail from '@/components/emails/DocumentRequestEmail';
import ReviewRequestEmail from '@/components/emails/ReviewRequestEmail';
import PaymentFollowUpEmail from '@/components/emails/PaymentFollowUpEmail';
import { Input } from '@/components/ui/input';
import { proofreadNote } from '@/ai/flows/proofread-note';
import { customAlphabet } from 'nanoid';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { notifyOfNewNote, sendDocumentReviewFeedback, sendOutstandingDocumentsReminder } from '@/app/actions';

const db = getFirestore(firebaseApp);
const storage = getStorage(firebaseApp);
const nanoid = customAlphabet('0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ', 8);

type OrderItemWithService = {
  id: string;
  title: string;
  price: number;
  quantity: number;
  service: Service;
};

const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-ZA', {
      style: 'currency',
      currency: 'ZAR',
      minimumFractionDigits: price % 1 === 0 ? 0 : 2,
      maximumFractionDigits: 2,
    }).format(price);
};

const noteFormSchema = z.object({
  noteText: z.string().min(3, "Note must be at least 3 characters."),
  attachments: z.any().optional(),
});

const rejectionFormSchema = z.object({
  reason: z.string().min(10, 'Please provide a reason for rejection.'),
});

export default function PartnerOrderDetailsPage() {
  const [order, setOrder] = useState<Order | null>(null);
  const [orderItemsWithServices, setOrderItemsWithServices] = useState<OrderItemWithService[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const params = useParams();
  const id = params.id as string;
  const { user: currentUser } = useAuth();
  const { toast } = useToast();
  const [allStaff, setAllStaff] = useState<User[]>([]);
  const [allServices, setAllServices] = useState<Service[]>([]);
  const [isProofreading, setIsProofreading] = useState(false);
  const [isGeneratingDiscount, setIsGeneratingDiscount] = useState(false);
  const [isSendingReminder, setIsSendingReminder] = useState(false);
  const [isSendingFeedback, setIsSendingFeedback] = useState(false);
  const [isRejectionDialogOpen, setIsRejectionDialogOpen] = useState(false);
  const [documentToReject, setDocumentToReject] = useState<DocumentUpload | null>(null);

  const noteForm = useForm<z.infer<typeof noteFormSchema>>({
    resolver: zodResolver(noteFormSchema),
    defaultValues: { noteText: "" },
  });

  const rejectionForm = useForm<z.infer<typeof rejectionFormSchema>>({
    resolver: zodResolver(rejectionFormSchema),
    defaultValues: { reason: '' },
  });

  const fetchOrder = async () => {
      if (!id || !currentUser) return;
      setIsLoading(true);
      try {
        const staffQuery = query(collection(db, "users"), where('partnerId', '==', currentUser.partnerId || currentUser.uid));
        const staffSnapshot = await getDocs(staffQuery);
        const fetchedStaff = staffSnapshot.docs.map(doc => ({ ...doc.data(), uid: doc.id, id: doc.id } as User));
        
        // Add current user to staff list if not present
        if (!fetchedStaff.some(s => s.id === currentUser.id)) {
            fetchedStaff.push(currentUser);
        }
        setAllStaff(fetchedStaff);

        const servicesQuery = query(collection(db, 'services'));
        const servicesSnapshot = await getDocs(servicesQuery);
        const fetchedServices = servicesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Service));
        setAllServices(fetchedServices);

        const docRef = doc(db, 'orders', id);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          
          if (data.resellerId !== (currentUser.partnerId || currentUser.uid)) {
             notFound();
             return;
          }

          const fetchedOrder = {
            ...data,
            id: docSnap.id,
            date: data.date?.toDate ? data.date.toDate().toISOString() : new Date().toISOString(),
            notes: (data.notes || []).map((note: any) => ({...note, date: note.date?.toDate ? note.date.toDate() : new Date(note.date), attachments: note.attachments || null})),
            documentUploads: (data.documentUploads || []).map((doc: any) => ({...doc, uploadedAt: doc.uploadedAt?.toDate ? doc.uploadedAt.toDate().toISOString() : new Date().toISOString()})),
          } as Order;

          setOrder(fetchedOrder);

          const itemsWithServices = fetchedOrder.items.map(item => {
            const serviceDetails = fetchedServices.find(s => s.id === item.id);
            if (!serviceDetails) return { ...item, service: null };
            return { ...item, service: serviceDetails };
          }).filter(item => item.service !== null) as OrderItemWithService[];

          setOrderItemsWithServices(itemsWithServices);

        } else {
          notFound();
        }
      } catch (error) {
        console.error("Error fetching order details: ", error);
        notFound();
      } finally {
        setIsLoading(false);
      }
    };

  useEffect(() => {
    fetchOrder();
  }, [id, currentUser]);
  
  const onNoteSubmit = async (values: z.infer<typeof noteFormSchema>) => {
    if (!currentUser || !order) return;

    let isLoadingToast = toast({ title: 'Adding note...', description: 'Please wait.' });
    let attachments: { name: string; url: string }[] = [];
    const files = values.attachments || [];

    if (files.length > 0) {
      isLoadingToast.update({ id: isLoadingToast.id, title: `Uploading ${files.length} file(s)...` });
      try {
        const uploadPromises = Array.from(files).map(async (file: any) => {
            const uniqueFileName = `${Date.now()}-${file.name}`;
            const storageRef = ref(storage, `orders/${order.id}/notes/${uniqueFileName}`);
            const uploadTask = uploadBytesResumable(storageRef, file);
            const snapshot = await uploadTask;
            const downloadURL = await getDownloadURL(snapshot.ref);
            return { name: file.name, url: downloadURL };
        });

        attachments = await Promise.all(uploadPromises);
        isLoadingToast.update({ id: isLoadingToast.id, title: 'Attachments Uploaded' });
      } catch (error) {
        console.error('Attachment upload failed:', error);
        toast({ title: 'Attachment Upload Failed', variant: 'destructive' });
        isLoadingToast.dismiss();
        return;
      }
    }

    const newNote: OrderNote = {
      text: values.noteText,
      authorId: currentUser.uid,
      date: Timestamp.now(),
      type: 'note',
      subject: null,
      attachments: attachments.length > 0 ? attachments : null,
    };

    try {
      const orderRef = doc(db, 'orders', order.id);
      await updateDoc(orderRef, {
        notes: arrayUnion(newNote),
      });

      // Notification logic
      const emailTo = order.endCustomerEmail || order.customerEmail;
      const recipientName = order.endCustomerName || order.customerName;

      if (emailTo && recipientName) {
          notifyOfNewNote({
              recipientEmail: emailTo,
              recipientName: recipientName,
              senderName: currentUser.name,
              orderId: order.originalOrderId || order.id,
              notePreview: values.noteText.substring(0, 150) + (values.noteText.length > 150 ? '...' : ''),
              actionUrl: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/orders/${order.id}`,
              isToClient: true,
              resellerId: order.resellerId
          }).catch(err => console.error("Failed to send note notification:", err));
      }

      toast({ title: "Note Added", description: "Your note has been saved." });
      noteForm.reset();
      await fetchOrder();
    } catch (error) {
      console.error("Error adding note:", error);
      toast({ title: "Error", description: "Failed to add note.", variant: "destructive" });
    } finally {
        isLoadingToast.dismiss();
    }
  };

  const handleProofread = async () => {
    const currentNote = noteForm.getValues('noteText');
    if (!currentNote || currentNote.trim().length < 10) {
      toast({ title: "Not enough text", description: "Please write a longer note to proofread.", variant: "destructive" });
      return;
    }
    setIsProofreading(true);
    try {
      const result = await proofreadNote({ text: currentNote });
      noteForm.setValue('noteText', result.proofreadText);
      toast({ title: "Note Proofread", description: "Your note has been improved by AI." });
    } catch (e) {
      console.error(e);
      toast({ title: "Proofreading Failed", variant: "destructive" });
    } finally {
      setIsProofreading(false);
    }
  };

  const generateNoteTemplate = (type: 'docs' | 'payment' | 'review') => {
      const contactName = order?.endCustomerName || order?.customerName;
      let text = `Hi ${contactName?.split(' ')[0]},\n\n`;
      const orderId = order?.originalOrderId || order?.id;

      if (type === 'payment') {
          text += `This is a friendly reminder that your invoice for order #${orderId} is still outstanding. Please make payment at your earliest convenience to proceed.\n\n`;
      } else if (type === 'docs') {
          text += `This is a reminder to please upload the required documents for your order #${orderId} so that we can begin processing it.\n\n`;
      } else if (type === 'review') {
          text += `We hope you were happy with our service for order #${orderId}. If you have a moment, we would greatly appreciate it if you could leave us a review on Google at the link below:\n\n<a href="https://g.page/r/CVIOzn2bYoiaEAE/review" target="_blank" style="color: blue;">https://g.page/r/CVIOzn2bYoiaEAE/review</a>\n\n`;
      }
      text += 'Kind regards,\nThe My Accountant Team';
      noteForm.setValue('noteText', text);
  };

  const handleGenerateDiscount = async () => {
    if (!order) return;
    const contactName = order?.endCustomerName || order?.customerName;
    
    if (order.discountCode) {
      toast({ title: 'Discount Already Generated', description: `This order already has a discount code: ${order.discountCode}`, variant: 'destructive' });
      const text = `Hi ${contactName?.split(' ')[0]},\n\nAs a token of our appreciation for your business, here is your 10% discount code for your next order: ${order.discountCode}\n\nKind regards,\n${currentUser?.companyName || 'The My Accountant Team'}`;
      noteForm.setValue('noteText', text);
      return;
    }

    setIsGeneratingDiscount(true);
    toast({ title: 'Generating Discount...', description: 'Please wait a moment.' });

    const newDiscountCode = `WELCOME-${nanoid()}`;
    const discountData = {
        percentage: 10,
        status: 'active',
        clientEmail: order.customerEmail,
        createdAt: Timestamp.now(),
        orderId: order.id,
    };
    
    try {
      await setDoc(doc(db, "discounts", newDiscountCode), discountData);
      const orderRef = doc(db, 'orders', order.id);
      await updateDoc(orderRef, { discountCode: newDiscountCode });
      
      setOrder(prev => prev ? { ...prev, discountCode: newDiscountCode } : null);
      
      const text = `Hi ${contactName?.split(' ')[0]},\n\nAs a token of our appreciation for your business, here is your 10% discount code for your next order: ${newDiscountCode}\n\nKind regards,\n${currentUser?.companyName || 'The My Accountant Team'}`;
      noteForm.setValue('noteText', text);
      toast({ title: 'Discount Generated!', description: `Code ${newDiscountCode} has been created and saved.` });
    } catch (e) {
      console.error(e);
      toast({ title: 'Failed to generate discount', variant: 'destructive' });
    } finally {
      setIsGeneratingDiscount(false);
    }
  };

  const handleDocumentStatusUpdate = async (identifier: string, status: 'approved' | 'rejected', reason?: string) => {
    if (!order) return;
    const updatedUploads = (order.documentUploads || []).map(doc => {
      const docIdentifier = doc.type === 'file' ? doc.fileUrl : doc.textValue;
      if (docIdentifier === identifier) {
        return { ...doc, status, rejectionReason: reason || null };
      }
      return doc;
    });

    try {
      const orderRef = doc(db, 'orders', order.id);
      await updateDoc(orderRef, { documentUploads: updatedUploads });
      toast({ title: 'Document Status Updated', description: `The document has been ${status}.`});
      fetchOrder();
    } catch (error) {
      console.error("Error updating document status:", error);
      toast({ title: 'Error', description: 'Failed to update document status.', variant: "destructive" });
    }
  };

  const handleOpenRejectionDialog = (doc: DocumentUpload) => {
    setDocumentToReject(doc);
    rejectionForm.reset();
    setIsRejectionDialogOpen(true);
  };
  
  const handleRejectionSubmit = async (values: z.infer<typeof rejectionFormSchema>) => {
    if (documentToReject) {
        const identifier = documentToReject.type === 'file' ? documentToReject.fileUrl! : documentToReject.textValue!;
        await handleDocumentStatusUpdate(identifier, 'rejected', values.reason);
        setIsRejectionDialogOpen(false);
        setDocumentToReject(null);
    }
  };

  const handleSendFeedback = async () => {
    if (!order || !order.documentUploads) return;
    const emailTo = order.endCustomerEmail || order.customerEmail;
    const clientName = order.endCustomerName || order.customerName;

    setIsSendingFeedback(true);
    toast({ title: "Sending Feedback...", description: "Notifying the client of the review status." });

    try {
        await sendDocumentReviewFeedback({
            orderId: order.originalOrderId || order.id,
            clientName: clientName,
            clientEmail: emailTo,
            documentUploads: order.documentUploads,
            resellerId: order.resellerId
        });

        const emailNote: OrderNote = {
            text: `Sent 'Document Review Feedback' email to ${emailTo}.`,
            subject: `Feedback on Your Submitted Documents for Order #${order.originalOrderId || order.id}`,
            authorId: currentUser?.uid || 'system',
            date: Timestamp.now(),
            type: 'email',
            attachments: null,
        };

        const orderRef = doc(db, 'orders', order.id);
        await updateDoc(orderRef, { notes: arrayUnion(emailNote) });
        await fetchOrder();

        toast({ title: "Feedback Sent!", description: "The client has been notified." });
    } catch(e) {
        console.error(e);
        toast({ title: "Failed to Send Feedback", variant: "destructive" });
    } finally {
        setIsSendingFeedback(false);
    }
  };

  const handleSendFollowUp = async () => {
    if (!order) return;
    const emailTo = order.endCustomerEmail || order.customerEmail;
    const clientName = order.endCustomerName || order.customerName;

    setIsSendingReminder(true);
    toast({ title: "Sending Reminder...", description: "Notifying the client of outstanding documents." });

    try {
        await sendOutstandingDocumentsReminder({
            orderId: order.originalOrderId || order.id,
            clientName: clientName,
            clientEmail: emailTo,
            resellerId: order.resellerId
        });

        const emailNote: OrderNote = {
            text: `Sent 'Outstanding Documents Reminder' email to ${emailTo}.`,
            subject: `Action Required: Outstanding Documents for Order #${order.originalOrderId || order.id}`,
            authorId: currentUser?.uid || 'system',
            date: Timestamp.now(),
            type: 'email',
            attachments: null,
        };

        const orderRef = doc(db, 'orders', order.id);
        await updateDoc(orderRef, { notes: arrayUnion(emailNote) });
        await fetchOrder();

        toast({ title: "Reminder Sent!", description: "The client has been notified." });
    } catch(e) {
        console.error(e);
        toast({ title: "Failed to Send Reminder", variant: "destructive" });
    } finally {
        setIsSendingReminder(false);
    }
  };

  const getAuthor = (authorId: string): User | undefined => {
    return allStaff.find(u => u.uid === authorId || u.id === authorId);
  }

  const getStatusVariant = (status: Order['status']) => {
    switch (status) {
      case 'Completed': return 'success';
      case 'Processing': return 'info';
      case 'Outsourced': return 'info';
      case 'Pending Payment': return 'warning';
      case 'Cancelled': return 'destructive';
      default: return 'secondary';
    }
  };

  const allDocumentsReviewed = order?.documentUploads && order.documentUploads.length > 0 && order.documentUploads.every(d => d.status !== 'pending');

  if (isLoading) {
    return (
        <div className="flex justify-center items-center h-screen">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
        </div>
    );
  }

  if (!order) return notFound();

  return (
    <div className="space-y-8">
        <Dialog open={isRejectionDialogOpen} onOpenChange={setIsRejectionDialogOpen}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Reject Document</DialogTitle>
                    <DialogDescription>Please provide a clear reason for rejecting this document.</DialogDescription>
                </DialogHeader>
                <Form {...rejectionForm}>
                    <form onSubmit={rejectionForm.handleSubmit(handleRejectionSubmit)} className="space-y-4">
                        <FormField
                            control={rejectionForm.control}
                            name="reason"
                            render={({ field }) => (
                                <FormItem>
                                    <FormControl><Textarea {...field} rows={4} /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <div className="flex justify-end gap-2">
                            <Button type="button" variant="ghost" onClick={() => setIsRejectionDialogOpen(false)}>Cancel</Button>
                            <Button type="submit" variant="destructive">Reject</Button>
                        </div>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>

        <div>
            <Button variant="outline" asChild>
                <Link href="/partner/orders">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back to Orders
                </Link>
            </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
            <div className="lg:col-span-2 space-y-8">
                <Card>
                    <CardHeader>
                        <CardTitle>Order {order.id}</CardTitle>
                        <div className="text-sm text-muted-foreground">
                            Date: {format(new Date(order.date), 'dd MMMM yyyy')} | Status: <Badge variant={getStatusVariant(order.status)}>{order.status}</Badge>
                        </div>
                    </CardHeader>
                    <CardContent>
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <h3 className="font-semibold text-muted-foreground mb-2">Order Items</h3>
                                <div className="space-y-4">
                                {order.items.map((item: any) => (
                                    <div key={item.id} className="flex justify-between items-center">
                                    <div>
                                        <p className="font-semibold">{item.title}</p>
                                        <p className="text-sm text-muted-foreground">Quantity: {item.quantity}</p>
                                    </div>
                                    <p>{formatPrice(item.clientPrice || 0)}</p>
                                    </div>
                                ))}
                                </div>
                                <Separator className="my-4" />
                                <div className="flex justify-between font-bold text-lg">
                                <span>Total</span>
                                <span>{formatPrice(order.clientTotal || 0)}</span>
                                </div>
                            </div>
                            <div>
                                <h3 className="font-semibold text-muted-foreground mb-2">Client Details</h3>
                                <div className="space-y-3">
                                    <p className="font-semibold text-lg">{order.endCustomerName || order.customerName}</p>
                                    {(order.endCustomerEmail || order.customerEmail) && (
                                        <div className="flex items-center gap-2 text-sm">
                                            <Mail className="h-4 w-4 text-muted-foreground" />
                                            <a href={`mailto:${order.endCustomerEmail || order.customerEmail}`} className="text-primary hover:underline">{order.endCustomerEmail || order.customerEmail}</a>
                                        </div>
                                    )}
                                    {order.customerPhone && (
                                        <div className="flex items-center gap-2 text-sm">
                                            <Phone className="h-4 w-4 text-muted-foreground" />
                                            <span>{order.customerPhone}</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle>Required Information</CardTitle>
                                <CardDescription>Documents and information needed from your client.</CardDescription>
                            </div>
                            <Button variant="outline" size="sm" onClick={handleSendFollowUp} disabled={isSendingReminder}>
                                {isSendingReminder ? <Loader2 className="h-4 w-4 animate-spin mr-2"/> : <MessageSquare className="h-4 w-4 mr-2"/>}
                                Follow Up
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent>
                         <div className="space-y-4">
                            {orderItemsWithServices.map(item => (
                                <div key={item.id}>
                                    <h4 className="font-semibold">{item.title}</h4>
                                    {item.service.informationToProvide.length > 0 ? (
                                        <ul className="mt-2 space-y-3 pl-4 border-l">
                                            {item.service.informationToProvide.map((req, index) => {
                                                const upload = order.documentUploads?.find(d => d.serviceId === item.id && d.requirementLabel === req.label);
                                                const identifier = upload ? (upload.type === 'file' ? upload.fileUrl! : upload.textValue!) : '';
                                                return (
                                                    <li key={index} className="pt-3">
                                                        <div className="flex items-center justify-between">
                                                            <p className="font-medium text-sm">{req.label}</p>
                                                            {upload ? (
                                                                 <Badge variant={upload.status === 'approved' ? 'success' : upload.status === 'rejected' ? 'destructive' : 'warning'}>
                                                                    {upload.status === 'approved' && <CheckCircle className="mr-1 h-3 w-3" />}
                                                                    {upload.status === 'rejected' && <AlertTriangle className="mr-1 h-3 w-3" />}
                                                                    {upload.status}
                                                                </Badge>
                                                            ) : <Badge variant="secondary">Pending</Badge>}
                                                        </div>
                                                        {upload ? (
                                                            <div className="mt-2 space-y-2">
                                                                {upload.type === 'file' ? (
                                                                    <a href={upload.fileUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline flex items-center gap-1">
                                                                        <Download className="h-4 w-4" /> {upload.fileName}
                                                                    </a>
                                                                ) : (
                                                                    <p className="text-sm p-2 bg-muted rounded-md mt-1">"{upload.textValue}"</p>
                                                                )}
                                                                {upload.status === 'pending' && (
                                                                    <div className="flex items-center gap-2">
                                                                        <Button size="xs" variant="outline" onClick={() => handleDocumentStatusUpdate(identifier, 'approved')}>Approve</Button>
                                                                        <Button size="xs" variant="destructive" onClick={() => handleOpenRejectionDialog(upload)}>Reject</Button>
                                                                    </div>
                                                                )}
                                                                 {upload.status === 'rejected' && upload.rejectionReason && (
                                                                    <p className="text-xs text-destructive italic">Reason: {upload.rejectionReason}</p>
                                                                )}
                                                            </div>
                                                        ) : (
                                                            <p className="text-xs text-muted-foreground mt-1">Awaiting client submission.</p>
                                                        )}
                                                    </li>
                                                )
                                            })}
                                        </ul>
                                    ) : <p className="text-sm text-muted-foreground mt-2 pl-4">No specific information required.</p>}
                                </div>
                            ))}
                         </div>
                    </CardContent>
                     {order.documentUploads && order.documentUploads.length > 0 && allDocumentsReviewed && (
                        <CardFooter>
                            <Button onClick={handleSendFeedback} disabled={isSendingFeedback}>
                                {isSendingFeedback && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Notify Client of Review
                            </Button>
                        </CardFooter>
                    )}
                </Card>

                 <Card>
                    <CardHeader>
                        <CardTitle>Communication History</CardTitle>
                        <CardDescription>Internal notes and sent emails for this order.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                         <div className="flex flex-wrap gap-2">
                            <Button size="sm" variant="outline" onClick={() => generateNoteTemplate('payment')}><Phone className="h-4 w-4 mr-2"/>Payment Follow-up</Button>
                            <Button size="sm" variant="outline" onClick={() => generateNoteTemplate('docs')}><FileText className="h-4 w-4 mr-2"/>Request Documents</Button>
                            <Button size="sm" variant="outline" onClick={() => generateNoteTemplate('review')}><Star className="h-4 w-4 mr-2"/>Request Review</Button>
                            <Button size="sm" variant="outline" onClick={handleGenerateDiscount} disabled={isGeneratingDiscount || !!order.discountCode}>
                                {isGeneratingDiscount ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Percent className="h-4 w-4 mr-2"/>}
                                {order.discountCode ? 'Discount Generated' : 'Generate 10% Discount'}
                            </Button>
                        </div>
                        <Separator className="my-4" />
                        <Form {...noteForm}>
                            <form onSubmit={noteForm.handleSubmit(onNoteSubmit)} className="space-y-4">
                                <FormField
                                    control={noteForm.control}
                                    name="noteText"
                                    render={({ field }) => (
                                        <FormItem>
                                            <Textarea placeholder="Add a new note..." {...field} rows={4} />
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={noteForm.control}
                                    name="attachments"
                                    render={({ field: { onChange, value, ...rest }}) => (
                                        <FormItem>
                                            <FormLabel>Attachments (optional)</FormLabel>
                                            <FormControl>
                                                <Input type="file" multiple onChange={(e) => onChange(e.target.files)} {...rest} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <div className="flex gap-2">
                                    <Button type="submit" size="sm" disabled={isLoading}>
                                        {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
                                        Post Note
                                    </Button>
                                    <Button type="button" variant="outline" size="sm" onClick={handleProofread} disabled={isProofreading}>
                                        {isProofreading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Sparkles className="h-4 w-4 mr-2" />}
                                        Proofread
                                    </Button>
                                </div>
                            </form>
                        </Form>
                        <Separator className="my-4" />
                        <div className="space-y-4 max-h-96 overflow-y-auto pr-2">
                            {order.notes && order.notes.length > 0 ? (
                                order.notes.slice().reverse().map((note, index) => {
                                    const author = getAuthor(note.authorId);
                                    const isEmail = note.type === 'email';
                                    return (
                                        <div key={index} className="flex items-start gap-3">
                                            <div className="p-3 rounded-lg w-full bg-muted">
                                                <div className="flex justify-between items-center mb-1">
                                                    <p className="text-xs font-semibold">{author?.name || 'System'}</p>
                                                    <p className="text-xs text-muted-foreground">{format(new Date(note.date), 'dd/MM/yyyy, HH:mm')}</p>
                                                </div>
                                                {isEmail ? (
                                                    <div>
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <Mail className="h-4 w-4 text-muted-foreground" />
                                                            <p className="text-sm font-semibold">{note.subject}</p>
                                                        </div>
                                                        <p className="text-sm italic text-muted-foreground">"{note.text}"</p>
                                                    </div>
                                                ) : (
                                                    <p className="text-sm" dangerouslySetInnerHTML={{ __html: note.text.replace(/\n/g, '<br />') }} />
                                                )}
                                                 {note.attachments && note.attachments.length > 0 && (
                                                    <div className="mt-2 space-y-1">
                                                        {note.attachments.map((att, i) => (
                                                            <a key={i} href={att.url} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline flex items-center gap-1">
                                                                <Paperclip className="h-4 w-4"/>
                                                                {att.name}
                                                            </a>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })
                            ) : (
                                <p className="text-xs text-muted-foreground text-center py-4">No notes for this order yet.</p>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    </div>
  );
}
