
'use client';

import { useState, useEffect } from 'react';
import { notFound, useParams } from 'next/navigation';
import { getFirestore, doc, getDoc, updateDoc, arrayUnion, Timestamp, collection, getDocs, where, query } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { Order, Service, User, OrderNote, DocumentUpload, ItnLog } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Loader2, User as UserIcon, Mail, Phone, Send, FileText, Star, MessageSquare, Percent, CheckCircle, AlertTriangle, XCircle, Download, Info, Server } from 'lucide-react';
import { format } from 'date-fns';
import { useAuth } from '@/contexts/AuthContext';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { sendEmail } from '@/lib/email';
import { render } from '@react-email/components';
import DocumentRequestEmail from '@/components/emails/DocumentRequestEmail';
import ReviewRequestEmail from '@/components/emails/ReviewRequestEmail';
import PaymentFollowUpEmail from '@/components/emails/PaymentFollowUpEmail';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { sendDocumentReviewFeedback } from '@/app/actions';
import { ScrollArea } from '@/components/ui/scroll-area';


const db = getFirestore(firebaseApp);

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

const emailFormSchema = z.object({
    subject: z.string().min(5, 'Subject must be at least 5 characters long.'),
    message: z.string().min(20, 'Message must be at least 20 characters long.'),
});

function BackendSummaryModal({ order }: { order: Order }) {
  if (!order.itnHistory || order.itnHistory.length === 0) {
    return (
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Backend Summary for Order {order.id}</DialogTitle>
          <DialogDescription>No backend notifications have been received for this order yet.</DialogDescription>
        </DialogHeader>
      </DialogContent>
    )
  }

  return (
    <DialogContent className="max-w-2xl">
      <DialogHeader>
        <DialogTitle>Backend Summary for Order {order.id}</DialogTitle>
        <DialogDescription>History of notifications received from PayFast.</DialogDescription>
      </DialogHeader>
      <ScrollArea className="max-h-[60vh] pr-6">
        <div className="space-y-4">
          {order.itnHistory.slice().reverse().map((log, index) => (
            <Card key={index}>
              <CardHeader>
                <CardTitle className="text-base flex justify-between items-center">
                  <span>
                    Status: <Badge variant={log.status === 'Success' ? 'success' : 'destructive'}>{log.status}</Badge>
                  </span>
                   <span className="text-xs font-normal text-muted-foreground">
                    {log.receivedAt ? format(log.receivedAt.toDate(), 'dd/MM/yyyy, HH:mm:ss') : 'N/A'}
                  </span>
                </CardTitle>
                <CardDescription className="pt-2">{log.message}</CardDescription>
              </CardHeader>
              <CardContent>
                <h4 className="font-semibold text-sm mb-2">Received Payload:</h4>
                <pre className="text-xs bg-muted p-2 rounded-md overflow-x-auto">
                  {JSON.stringify(log.payload, null, 2)}
                </pre>
              </CardContent>
            </Card>
          ))}
        </div>
      </ScrollArea>
    </DialogContent>
  );
}


function EmailClientDialog({ order, user, allStaff, onEmailSent, contactEmail, contactName }: { order: Order, user: User | null, allStaff: User[], onEmailSent: (subject: string, message: string) => Promise<void>, contactEmail: string, contactName: string }) {
    const { toast } = useToast();
    const [isOpen, setIsOpen] = useState(false);
    const [isSending, setIsSending] = useState(false);

    const form = useForm<z.infer<typeof emailFormSchema>>({
        resolver: zodResolver(emailFormSchema),
        defaultValues: {
            subject: `My Accountant | Regarding Your Order: ${order.originalOrderId || order.id}`,
            message: '',
        },
    });

    const onSubmit = async (values: z.infer<typeof emailFormSchema>) => {
        if (!contactEmail) {
            toast({ title: "Recipient Error", description: "No recipient email address found for this order.", variant: "destructive" });
            return;
        }
        setIsSending(true);
        try {
            await sendEmail({
                to: contactEmail,
                subject: values.subject,
                html: `<p>${values.message.replace(/\n/g, '<br>')}</p>`,
                resellerId: order.resellerId
            });
            await onEmailSent(values.subject, values.message);
            toast({
                title: 'Email Sent!',
                description: 'Your message has been sent to the client.',
            });
            form.reset();
            setIsOpen(false);
        } catch (error) {
            console.error("Failed to send email:", error);
            toast({
                title: 'Error',
                description: 'Failed to send the email. Please try again.',
                variant: 'destructive',
            });
        } finally {
            setIsSending(false);
        }
    };
    
    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                 <Button variant="outline" className="w-full justify-start">
                    <Mail className="mr-2 h-4 w-4" />
                    Compose Custom Email
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-xl">
                <DialogHeader>
                    <DialogTitle>Send Email to {contactName}</DialogTitle>
                    <DialogDescription>
                        Recipient: <span className="font-semibold">{contactEmail}</span>
                        <br/>
                        {order.resellerId ? "This will be sent from the reseller's email." : "The email will be sent from the default company address."}
                    </DialogDescription>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <FormField
                            control={form.control}
                            name="subject"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Subject</FormLabel>
                                    <FormControl><Input {...field} /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="message"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Message</FormLabel>
                                    <FormControl><Textarea {...field} rows={8} placeholder={`Hi ${contactName}...`}/></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                         <div className="flex justify-end items-center pt-4">
                            <div className="flex gap-2">
                                <Button type="button" variant="ghost" onClick={() => setIsOpen(false)}>Cancel</Button>
                                <Button type="submit" disabled={isSending}>
                                    {isSending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Send Email
                                </Button>
                            </div>
                        </div>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}

const noteFormSchema = z.object({
  noteText: z.string().min(3, "Note must be at least 3 characters."),
});

const rejectionFormSchema = z.object({
  reason: z.string().min(10, 'Please provide a reason for rejection.'),
});

export default function AdminOrderDetailsPage() {
  const [order, setOrder] = useState<Order | null>(null);
  const [orderItemsWithServices, setOrderItemsWithServices] = useState<OrderItemWithService[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const params = useParams();
  const id = params.id as string;
  const [assignee, setAssignee] = useState<User | null>(null);
  const { user: currentUser } = useAuth();
  const { toast } = useToast();
  const [allStaff, setAllStaff] = useState<User[]>([]);
  const [allServices, setAllServices] = useState<Service[]>([]);
  const [viewingBackendSummary, setViewingBackendSummary] = useState<Order | null>(null);
  
  const [isRejectionDialogOpen, setIsRejectionDialogOpen] = useState(false);
  const [documentToReject, setDocumentToReject] = useState<DocumentUpload | null>(null);
  const [isSendingFeedback, setIsSendingFeedback] = useState(false);

  const noteForm = useForm<z.infer<typeof noteFormSchema>>({
    resolver: zodResolver(noteFormSchema),
    defaultValues: { noteText: "" },
  });

  const rejectionForm = useForm<z.infer<typeof rejectionFormSchema>>({
    resolver: zodResolver(rejectionFormSchema),
    defaultValues: { reason: '' },
  });


  const fetchOrderAndStaff = async () => {
      if (!id) return;
      setIsLoading(true);
      try {
        const staffQuery = query(collection(db, "users"), where('role', 'in', ['staff', 'admin', 'reseller']));
        const staffSnapshot = await getDocs(staffQuery);
        const fetchedStaff = staffSnapshot.docs.map(doc => ({ ...doc.data(), uid: doc.id } as User));
        setAllStaff(fetchedStaff);

        const servicesQuery = query(collection(db, "services"));
        const servicesSnapshot = await getDocs(servicesQuery);
        const fetchedServices = servicesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Service));
        setAllServices(fetchedServices);

        const docRef = doc(db, 'orders', id);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          const data = docSnap.data();
          let fetchedOrder = {
            ...data,
            id: docSnap.id,
            date: data.date.toDate(),
            notes: (data.notes || []).map((note: any) => ({...note, date: note.date.toDate()})),
            documentUploads: (data.documentUploads || []).map((doc: any) => ({...doc, uploadedAt: doc.uploadedAt.toDate()})),
            itnHistory: (data.itnHistory || []).map((log: any) => ({ ...log, receivedAt: log.receivedAt.toDate() })),
          } as Order;
          
          if (fetchedOrder.resellerId && fetchedOrder.originalOrderId && !fetchedOrder.endCustomerEmail) {
            const originalOrderRef = doc(db, 'orders', fetchedOrder.originalOrderId);
            const originalOrderSnap = await getDoc(originalOrderRef);
            if (originalOrderSnap.exists()) {
                const originalOrderData = originalOrderSnap.data();
                fetchedOrder.endCustomerName = originalOrderData.customerName;
                fetchedOrder.endCustomerEmail = originalOrderData.customerEmail;
                fetchedOrder.customerPhone = originalOrderData.customerPhone; // Corrected to use customerPhone
            }
          }

          setOrder(fetchedOrder);
          
          if (fetchedOrder.assignedTo && fetchedOrder.assignedTo.length > 0) {
            const assignedUser = fetchedStaff.find(u => u.uid === fetchedOrder.assignedTo![0]);
            setAssignee(assignedUser || null);
          }

          const itemsWithServices = fetchedOrder.items.map(item => {
            const serviceDetails = fetchedServices.find(s => s.id === item.id);
            if (!serviceDetails) {
              console.warn(`Service with id ${item.id} not found.`);
              return { ...item, service: null };
            }
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
    fetchOrderAndStaff();
  }, [id]);

   const onNoteSubmit = async (values: z.infer<typeof noteFormSchema>) => {
    if (!currentUser || !order) return;

    const newNote: OrderNote = {
      text: values.noteText,
      authorId: currentUser.uid,
      date: Timestamp.now(),
      type: 'note',
    };

    try {
      const orderRef = doc(db, 'orders', order.id);
      await updateDoc(orderRef, {
        notes: arrayUnion(newNote),
      });

      toast({ title: "Note Added", description: "Your note has been saved." });
      noteForm.reset();
      await fetchOrderAndStaff(); 
    } catch (error) {
      console.error("Error adding note:", error);
      toast({ title: "Error", description: "Failed to add note.", variant: "destructive" });
    }
  };

  const addEmailToHistory = async (subject: string, message: string) => {
    if (!currentUser || !order) return;

     const emailNote: OrderNote = {
      text: message,
      subject: subject || null,
      authorId: currentUser.uid,
      date: Timestamp.now(),
      type: 'email',
    };

    try {
      const orderRef = doc(db, 'orders', order.id);
      await updateDoc(orderRef, {
        notes: arrayUnion(emailNote),
      });
      await fetchOrderAndStaff();
    } catch (error) {
        console.error("Error logging email to history:", error);
    }
  };

   const handleDocumentStatusUpdate = async (fileUrlOrTextValue: string, status: 'approved' | 'rejected', reason?: string) => {
    if (!order) return;
    const updatedUploads = (order.documentUploads || []).map(doc => {
      if (doc.fileUrl === fileUrlOrTextValue || doc.textValue === fileUrlOrTextValue) {
        return { ...doc, status, rejectionReason: reason || '' };
      }
      return doc;
    });

    try {
      const orderRef = doc(db, 'orders', order.id);
      await updateDoc(orderRef, { documentUploads: updatedUploads });
      toast({ title: 'Document Status Updated', description: `The document has been ${status}.`});
      fetchOrderAndStaff();
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

  const getStatusVariant = (status: Order['status']) => {
    switch (status) {
      case 'Completed':
        return 'success';
      case 'Processing':
        return 'info';
      case 'Pending Payment':
        return 'warning';
      case 'Cancelled':
        return 'destructive';
      default:
        return 'secondary';
    }
  };
  
  const getAuthor = (authorId: string): User | undefined => {
    return allStaff.find(u => u.uid === authorId);
  }

  const handleQuickActionEmail = async (type: 'docs' | 'payment' | 'review') => {
    if (!order || !currentUser) return;
    
    const isOutsourced = !!order.resellerId;
    const contactIsClient = isOutsourced && order.documentContact === 'client';
    const resellerDetails = isOutsourced ? allStaff.find(u => u.uid === order.resellerId) : null;

    let emailTo: string | undefined;
    let customerName: string;

    if (contactIsClient) {
        emailTo = order.endCustomerEmail;
        customerName = order.endCustomerName || 'Valued Customer';
    } else if (isOutsourced) {
        emailTo = resellerDetails?.email;
        customerName = resellerDetails?.companyName || resellerDetails?.name || 'Valued Partner';
    } else {
        emailTo = order.customerEmail;
        customerName = order.customerName;
    }
    
    if (!emailTo) {
        toast({ title: "Recipient Error", description: "No recipient email address could be determined for this action.", variant: "destructive" });
        return;
    }

    let emailHtml = '';
    let subject = '';
    let message = '';
    const orderForEmail = { ...order, customerName, id: order.originalOrderId || order.id };

    if (type === 'docs') {
        const itemsWithServices = order.items.map(item => {
            const service = allServices.find(s => s.id === item.id);
            return { ...item, service };
        }).filter(item => item.service) as { service: Service }[];
        
        emailHtml = render(<DocumentRequestEmail order={orderForEmail} items={itemsWithServices} reseller={resellerDetails || undefined} replyTo={currentUser.email || 'info@myacc.co.za'} />);
        subject = `Action Required for Your Order #${orderForEmail.id}`;
        message = `Sent 'Request Documents' email to ${emailTo}.`;
    } else if (type === 'payment') {
         emailHtml = render(<PaymentFollowUpEmail order={orderForEmail} reseller={resellerDetails || undefined} />);
         subject = `Payment Reminder for Your Order: #${orderForEmail.id}`;
         message = `Sent 'Payment Follow-up' email to ${emailTo}.`;
    } else if (type === 'review') {
         emailHtml = render(<ReviewRequestEmail order={orderForEmail} reseller={resellerDetails || undefined} />);
         subject = `We'd love your feedback on order #${orderForEmail.id}`;
         message = `Sent 'Request a Review' email to ${emailTo}.`;
    }

    toast({ title: 'Sending email...', description: 'Please wait a moment.' });
    
     try {
          await sendEmail({ to: emailTo, subject, html: emailHtml, resellerId: order.resellerId });
          await addEmailToHistory(subject, message);
          toast({ title: 'Email Sent!', description: `The email has been successfully sent to ${emailTo}.` });
      } catch (error) {
          console.error(`Failed to send ${type} email:`, error);
          toast({ title: 'Error', description: 'Failed to send the email.', variant: 'destructive' });
      }
  };
  
    const allDocumentsReviewed = order?.documentUploads && order.documentUploads.length > 0 && order.documentUploads.every(d => d.status !== 'pending');

    const handleSendFeedback = async () => {
        if (!order || !order.documentUploads) return;
        
        const isOutsourced = !!order.resellerId;
        const emailTo = isOutsourced && order.documentContact === 'client' ? order.endCustomerEmail : order.customerEmail;
        const clientName = isOutsourced && order.documentContact === 'client' ? order.endCustomerName : order.customerName;

        if (!emailTo || !clientName) {
            toast({ title: "Cannot send feedback", description: "Missing client contact details.", variant: "destructive" });
            return;
        }

        setIsSendingFeedback(true);
        toast({ title: "Sending Feedback...", description: "Notifying the client of the document review status." });

        try {
            await sendDocumentReviewFeedback({
                orderId: order.originalOrderId || order.id,
                clientName: clientName,
                clientEmail: emailTo,
                documentUploads: order.documentUploads,
                resellerId: order.resellerId
            });

            await addEmailToHistory(
                `Feedback on Your Submitted Documents for Order #${order.originalOrderId || order.id}`,
                `Sent 'Document Review Feedback' email to ${emailTo}.`
            );

            toast({ title: "Feedback Sent!", description: "The client has been notified of the review outcome." });
        } catch(e) {
            console.error(e);
            toast({ title: "Failed to Send Feedback", variant: "destructive" });
        } finally {
            setIsSendingFeedback(false);
        }
    }
  
  if (currentUser && currentUser.role === 'client') {
      return (
          <div className="flex justify-center items-center h-screen">
              <p>Access Denied.</p>
          </div>
      )
  }

  if (isLoading) {
    return (
        <div className="flex justify-center items-center h-screen">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
        </div>
    );
  }

  if (!order) {
    return notFound();
  }
  
  const isOutsourced = !!order.resellerId;
  const resellerDetails = isOutsourced ? allStaff.find(s => s.uid === order.resellerId) : null;
  const contactIsClient = isOutsourced && order.documentContact === 'client';
  
  let contactName = order.customerName;
  let contactEmail = order.customerEmail;
  let contactPhone = order.customerPhone;
  
  if (isOutsourced) {
    if (contactIsClient) {
        contactName = order.endCustomerName || 'N/A';
        contactEmail = order.endCustomerEmail || 'N/A';
        contactPhone = order.customerPhone;
    } else {
        contactName = resellerDetails?.companyName || resellerDetails?.name || 'N/A';
        contactEmail = resellerDetails?.email || 'N/A';
        contactPhone = resellerDetails?.contactNumber;
    }
  }


  return (
    <Dialog onOpenChange={(isOpen) => !isOpen && setViewingBackendSummary(null)}>
        <div className="space-y-8">
            <Dialog open={isRejectionDialogOpen} onOpenChange={setIsRejectionDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Reject Document</DialogTitle>
                        <DialogDescription>Please provide a clear reason for rejecting this document. This will be visible to the client.</DialogDescription>
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
                    <Link href="/admin/orders">
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Back to Orders
                    </Link>
                </Button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
                <div className="lg:col-span-2 space-y-8">
                    <Card>
                        <CardHeader>
                            <div className="flex justify-between items-start">
                                <div>
                                    <CardTitle>Order {order.id}</CardTitle>
                                    <div className="text-sm text-muted-foreground">
                                        Date: {format(new Date(order.date), 'dd/MM/yyyy')} | Status: <Badge variant={getStatusVariant(order.status)}>{order.status}</Badge>
                                        {isOutsourced && resellerDetails && <span className="ml-2">| Reseller: {resellerDetails.companyName || resellerDetails.name}</span>}
                                        {order.originalOrderId && <span className="ml-2">| Original Order: <Link href={`/reseller/orders/${order.originalOrderId}`} className="text-primary hover:underline">{order.originalOrderId}</Link></span>}
                                    </div>
                                </div>
                                <DialogTrigger asChild>
                                    <Button variant="outline" size="sm" onClick={() => setViewingBackendSummary(order)}>
                                        <Server className="mr-2 h-4 w-4" />
                                        Backend Summary
                                    </Button>
                                </DialogTrigger>
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
                                        <p>{formatPrice(item.price)}</p>
                                        </div>
                                    ))}
                                    </div>
                                    <Separator className="my-4" />
                                    <div className="flex justify-between font-bold text-lg">
                                    <span>Total</span>
                                    <span>{formatPrice(order.total)}</span>
                                    </div>
                                </div>
                                <div>
                                     <h3 className="font-semibold text-muted-foreground mb-2">Contact Details</h3>
                                    <div className="space-y-3">
                                        <p className="font-semibold text-lg">{contactName}</p>
                                        {contactEmail && (
                                            <div className="flex items-center gap-2 text-sm">
                                                <Mail className="h-4 w-4 text-muted-foreground" />
                                                <a href={`mailto:${contactEmail}`} className="text-primary hover:underline">{contactEmail}</a>
                                            </div>
                                        )}
                                        {contactPhone && (
                                            <div className="flex items-center gap-2 text-sm">
                                                <Phone className="h-4 w-4 text-muted-foreground" />
                                                <span>{contactPhone}</span>
                                            </div>
                                        )}
                                    </div>
                                    {isOutsourced && !contactIsClient && order.endCustomerName && (
                                        <div className="mt-4 pt-4 border-t">
                                            <h3 className="font-semibold text-muted-foreground mb-2">End Client Details</h3>
                                            <div className="space-y-3">
                                                <p className="font-semibold text-lg">{order.endCustomerName}</p>
                                                {order.endCustomerEmail && (
                                                    <div className="flex items-center gap-2 text-sm">
                                                        <Mail className="h-4 w-4 text-muted-foreground" />
                                                        <span className="text-primary">{order.endCustomerEmail}</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                     )}
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Uploaded Documents</CardTitle>
                            <CardDescription>Documents uploaded by the client for this order.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            {order.documentUploads && order.documentUploads.length > 0 ? (
                                <ul className="space-y-3">
                                    {order.documentUploads.map((doc, index) => {
                                        const identifier = doc.type === 'file' ? doc.fileUrl! : doc.textValue!;
                                        return (
                                            <li key={index} className="flex items-center justify-between p-2 border rounded-md">
                                                <div>
                                                    <p className="font-medium text-sm">{doc.requirementLabel}</p>
                                                    {doc.type === 'file' ? (
                                                        <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline flex items-center gap-1">
                                                            <Download className="h-3 w-3" /> {doc.fileName}
                                                        </a>
                                                    ) : (
                                                        <p className="text-sm p-2 bg-muted rounded-md mt-1">"{doc.textValue}"</p>
                                                    )}

                                                    {doc.status === 'rejected' && doc.rejectionReason && (
                                                        <p className="text-xs text-destructive mt-1">Reason: {doc.rejectionReason}</p>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    {doc.status === 'pending' ? (
                                                        <>
                                                            <Button size="sm" variant="outline" onClick={() => handleDocumentStatusUpdate(identifier, 'approved')}>
                                                                <CheckCircle className="mr-2 h-4 w-4 text-green-500" />Approve
                                                            </Button>
                                                            <Button size="sm" variant="destructive" onClick={() => handleOpenRejectionDialog(doc)}>
                                                                <XCircle className="mr-2 h-4 w-4" />Reject
                                                            </Button>
                                                        </>
                                                    ) : doc.status === 'approved' ? (
                                                        <Badge variant="success" className="text-sm"><CheckCircle className="mr-2 h-4 w-4"/>Approved</Badge>
                                                    ) : (
                                                        <Badge variant="destructive" className="text-sm"><AlertTriangle className="mr-2 h-4 w-4"/>Rejected</Badge>
                                                    )}
                                                </div>
                                            </li>
                                        )
                                    })}
                                </ul>
                            ) : (
                                <p className="text-sm text-muted-foreground text-center py-4">No documents have been uploaded for this order yet.</p>
                            )}
                        </CardContent>
                        {allDocumentsReviewed && (
                            <CardFooter>
                                <Button onClick={handleSendFeedback} disabled={isSendingFeedback}>
                                    {isSendingFeedback && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Provide Client with Feedback
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
                                                        <p className="text-sm">{note.text}</p>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })
                                ) : (
                                    <p className="text-xs text-muted-foreground text-center py-4">No notes for this order yet.</p>
                                )}
                            </div>
                            <Form {...noteForm}>
                            <form onSubmit={noteForm.handleSubmit(onNoteSubmit)} className="flex items-start gap-2 pt-4">
                                <FormField
                                control={noteForm.control}
                                name="noteText"
                                render={({ field }) => (
                                    <FormItem className="flex-grow">
                                    <FormControl>
                                        <Textarea placeholder="Add a new note..." {...field} rows={2} />
                                    </FormControl>
                                    <FormMessage />
                                    </FormItem>
                                )}
                                />
                                <Button type="submit" size="icon" className="flex-shrink-0 mt-1">
                                <Send className="h-4 w-4" />
                                </Button>
                            </form>
                            </Form>
                        </CardContent>
                    </Card>

                </div>
                <div className="lg:col-span-1 space-y-6 sticky top-24">
                    {assignee && (
                        <Card>
                            <CardHeader className="flex flex-row items-center gap-3 space-y-0">
                            <UserIcon className="h-5 w-5 text-muted-foreground"/>
                            <CardTitle className="text-lg">Assigned To</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="flex items-center gap-4">
                                    <div>
                                        <p className="font-semibold">{assignee.name}</p>
                                        <p className="text-sm text-muted-foreground">{assignee.department}</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    )}
                    <Card>
                        <CardHeader>
                            <CardTitle>Quick Actions</CardTitle>
                            <CardDescription>Send pre-made emails to the client.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-2">
                            <Button variant="outline" className="w-full justify-start" onClick={() => handleQuickActionEmail('payment')}>
                                <Phone className="mr-2 h-4 w-4" /> Follow Up On Payment
                            </Button>
                            <Button variant="outline" className="w-full justify-start" onClick={() => handleQuickActionEmail('docs')}>
                                <FileText className="mr-2 h-4 w-4" /> Request Documents
                            </Button>
                            <Separator className="my-2" />
                            <EmailClientDialog order={order} user={null} allStaff={allStaff} onEmailSent={addEmailToHistory} contactEmail={contactEmail || ''} contactName={contactName || ''}/>
                            <Separator className="my-2" />
                            <Button variant="outline" className="w-full justify-start" onClick={() => handleQuickActionEmail('review')}>
                                <Star className="mr-2 h-4 w-4" /> Request a Review
                            </Button>
                            <Button variant="outline" className="w-full justify-start">
                                <Percent className="mr-2 h-4 w-4" /> Generate 10% discount
                            </Button>
                        </CardContent>
                    </Card>
                </div>
            </div>
             {viewingBackendSummary && <BackendSummaryModal order={viewingBackendSummary} />}
        </div>
    </Dialog>
  );
}
