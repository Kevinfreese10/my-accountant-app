'use client';

import { useState, useEffect } from 'react';
import { notFound, useParams } from 'next/navigation';
import { getFirestore, doc, getDoc, updateDoc, arrayUnion, Timestamp, collection, query, where, getDocs } from 'firebase/firestore';
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { firebaseApp } from '@/lib/firebase';
import { Order, Service, User, OrderNote, DocumentUpload } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Loader2, Upload, ClipboardCheck, MessageSquare, Send, Mail, CheckCircle, AlertTriangle, Paperclip } from 'lucide-react';
import { format } from 'date-fns';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Form, FormControl, FormField, FormItem, FormMessage } from '@/components/ui/form';
import { Textarea } from '@/components/ui/textarea';
import { notifyStaffOfDocumentUpload, notifyOfNewNote } from '@/app/actions';


const db = getFirestore(firebaseApp);
const storage = getStorage(firebaseApp);

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
  attachment: z.any().optional(),
});

export default function ClientOrderDetailsPage() {
  const [order, setOrder] = useState<Order | null>(null);
  const [allServices, setAllServices] = useState<Service[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const params = useParams();
  const id = params.orderId as string;
  const { user: currentUser } = useAuth();
  const [allStaff, setAllStaff] = useState<User[]>([]);
  const { toast } = useToast();
  const [uploadingFiles, setUploadingFiles] = useState<{ [key: string]: number }>({});
  const [textInputs, setTextInputs] = useState<{ [key: string]: string }>({});


   const noteForm = useForm<z.infer<typeof noteFormSchema>>({
    resolver: zodResolver(noteFormSchema),
    defaultValues: { noteText: "" },
  });

  const fetchOrderAndServices = async () => {
      if (!id) return;
      setIsLoading(true);
      try {
        const staffQuery = query(collection(db, "users"), where('role', 'in', ['staff', 'admin', 'partner', 'partner_staff', 'ai_accountant']));
        const staffSnapshot = await getDocs(staffQuery);
        const fetchedStaff = staffSnapshot.docs.map(doc => ({ ...doc.data(), uid: doc.id, id: doc.id } as User));
        setAllStaff(fetchedStaff);

        const servicesQuery = query(collection(db, 'services'));
        const servicesSnapshot = await getDocs(servicesQuery);
        const fetchedServices = servicesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Service));
        setAllServices(fetchedServices);

        const docRef = doc(db, 'orders', id);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          setOrder({
            ...data,
            id: docSnap.id,
            date: data.date?.toDate ? data.date.toDate().toISOString() : new Date().toISOString(),
            notes: (data.notes || []).map((note: any) => ({...note, date: note.date?.toDate ? note.date.toDate() : new Date(note.date), attachments: note.attachments || null })),
            documentUploads: (data.documentUploads || []).map((doc: any) => ({...doc, uploadedAt: doc.uploadedAt?.toDate ? doc.uploadedAt.toDate().toISOString() : new Date().toISOString()})),
          } as Order);
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
    fetchOrderAndServices();
  }, [id]);
  
  const handleFileUpload = (file: File, serviceId: string, requirementLabel: string) => {
    if (!currentUser || !order) return;
    
    const uniqueFileName = `${Date.now()}-${file.name}`;
    const storageRef = ref(storage, `orders/${order.id}/${uniqueFileName}`);
    const uploadTask = uploadBytesResumable(storageRef, file);
    
    const uploadKey = `${serviceId}-${requirementLabel}`;
    setUploadingFiles(prev => ({ ...prev, [uploadKey]: 0 }));

    uploadTask.on('state_changed',
        (snapshot) => {
            const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
            setUploadingFiles(prev => ({ ...prev, [uploadKey]: progress }));
        },
        (error) => {
            console.error("Upload failed:", error);
            toast({ title: 'Upload Failed', description: 'Could not upload your file.', variant: 'destructive'});
            setUploadingFiles(prev => {
                const newUploading = { ...prev };
                delete newUploading[uploadKey];
                return newUploading;
            });
        },
        async () => {
            const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
            const newUpload: DocumentUpload = {
                serviceId,
                requirementLabel,
                type: 'file',
                fileUrl: downloadURL,
                fileName: file.name,
                uploadedAt: Timestamp.now(),
                status: 'pending',
            };
            
            const orderRef = doc(db, 'orders', order.id);
            await updateDoc(orderRef, {
                documentUploads: arrayUnion(newUpload)
            });

            toast({ title: 'File Uploaded', description: `${file.name} has been submitted for review.`});
            setUploadingFiles(prev => {
                const newUploading = { ...prev };
                delete newUploading[uploadKey];
                return newUploading;
            });
            fetchOrderAndServices(); // Re-fetch to update UI
        }
    );
  };
  
    const handleTextChange = (requirementLabel: string, value: string) => {
        setTextInputs(prev => ({ ...prev, [requirementLabel]: value }));
    };

    const handleTextSubmit = async (serviceId: string, requirementLabel: string) => {
        const text = textInputs[requirementLabel];
        if (!currentUser || !order || !text || !text.trim()) {
             toast({ title: "Cannot Submit", description: "The field cannot be empty.", variant: "destructive" });
             return;
        }

        const newUpload: DocumentUpload = {
            serviceId,
            requirementLabel,
            type: 'text',
            textValue: text,
            uploadedAt: Timestamp.now(),
            status: 'pending',
        };

        try {
            const orderRef = doc(db, 'orders', order.id);
            await updateDoc(orderRef, {
                documentUploads: arrayUnion(newUpload)
            });
            toast({ title: 'Information Submitted', description: 'Your information has been securely saved.' });
            setTextInputs(prev => ({...prev, [requirementLabel]: ''}));
            fetchOrderAndServices(); // Re-fetch to update UI
        } catch (error) {
            console.error("Error submitting text:", error);
            toast({ title: "Submission Failed", description: "Could not save the information.", variant: "destructive" });
        }
    };


  const onNoteSubmit = async (values: z.infer<typeof noteFormSchema>) => {
    if (!currentUser || !order) return;

    setIsSubmitting(true);
    let attachments: { name: string; url: string }[] = [];
    const file = values.attachment?.[0];

    if (file) {
      toast({ title: 'Uploading attachment...', description: 'Please wait.' });
      try {
        const uniqueFileName = `${Date.now()}-${file.name}`;
        const storageRef = ref(storage, `orders/${order.id}/notes/${uniqueFileName}`);
        const uploadTask = uploadBytesResumable(storageRef, file);
        const snapshot = await uploadTask;
        const downloadURL = await getDownloadURL(snapshot.ref);
        attachments = [{ name: file.name, url: downloadURL }];
        toast({ title: 'Attachment Uploaded' });
      } catch (error) {
        console.error('Attachment upload failed:', error);
        toast({ title: 'Attachment Upload Failed', variant: 'destructive' });
        setIsSubmitting(false);
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
      if (order.assignedTo && order.assignedTo.length > 0) {
          const assigneeId = order.assignedTo[0];
          const assigneeMember = allStaff.find(s => s.id === assigneeId);
          if (assigneeMember && assigneeMember.email) {
              notifyOfNewNote({
                  recipientEmail: assigneeMember.email,
                  recipientName: assigneeMember.name,
                  senderName: currentUser.name,
                  orderId: order.originalOrderId || order.id,
                  notePreview: values.noteText.substring(0, 150) + (values.noteText.length > 150 ? '...' : ''),
                  actionUrl: `${process.env.NEXT_PUBLIC_APP_URL}/admin/orders/${order.id}`,
                  isToClient: false
              }).catch(err => console.error("Failed to send note notification to staff:", err));
          }
      }

      toast({ title: "Note Added", description: "Your note has been saved." });
      noteForm.reset();
      await fetchOrderAndServices();
    } catch (error) {
      console.error("Error adding note:", error);
      toast({ title: "Error", description: "Failed to add note.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleNotifyConsultant = async () => {
    if (!currentUser || !order || !order.assignedTo || order.assignedTo.length === 0) {
      toast({ title: "Cannot Submit", description: "This order is not yet assigned to a consultant.", variant: "destructive" });
      return;
    }
    
    const assignedStaff = allStaff.find(s => s.id === order.assignedTo![0]);
    if (!assignedStaff || !assignedStaff.email) {
      toast({ title: "Cannot Submit", description: "The assigned consultant could not be found or does not have an email address.", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    toast({ title: "Notifying Consultant...", description: "Please wait a moment." });

    const noteText = "Client has submitted their documents for review.";
    const newNote: OrderNote = {
      text: noteText,
      authorId: currentUser.uid,
      date: Timestamp.now(),
      type: 'note',
      subject: null,
      attachments: null,
    };

    try {
      const orderRef = doc(db, 'orders', order.id);
      await updateDoc(orderRef, { notes: arrayUnion(newNote) });
      
      await notifyStaffOfDocumentUpload({
          orderId: order.id,
          clientName: currentUser.name,
          assignedStaffName: assignedStaff.name,
          assignedStaffEmail: assignedStaff.email,
      });

      toast({ title: "Documents Submitted!", description: "Your consultant has been notified." });
      fetchOrderAndServices();
    } catch(error) {
      console.error("Error submitting documents:", error);
      toast({ title: "Submission Failed", description: "Could not notify the consultant.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusVariant = (status: Order['status'] | 'Outsourced') => {
    switch (status) {
      case 'Completed': return 'success';
      case 'Processing':
      case 'Outsourced':
        return 'info';
      case 'Pending Payment': return 'warning';
      case 'Cancelled': return 'destructive';
      default: return 'secondary';
    }
  };

  const getAuthor = (authorId: string): { name: string } | undefined => {
    if (authorId === 'system') return { name: 'My Accountant (System)' };
    if (currentUser?.uid === authorId) return currentUser;
    if (order && authorId === order.userId) return { name: order.customerName };
    const staff = allStaff.find(u => u.uid === authorId || u.id === authorId);
    if (staff) return staff;
    return undefined;
  }
  
  if (isLoading) {
    return <div className="flex justify-center items-center h-screen"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>;
  }

  if (!order) return notFound();

   const orderedItemsWithServices = order.items.map(item => {
        const serviceDetails = allServices.find(s => s.id === item.id);
        return { ...item, service: serviceDetails };
    });

  const allRequirements = orderedItemsWithServices.flatMap(item => item.service?.informationToProvide || []);
  const allSubmitted = allRequirements.every(req => 
      order.documentUploads?.some(doc => doc.requirementLabel === req.label && doc.status !== 'rejected')
  );

  return (
    <div className="space-y-8">
        <div>
            <Button variant="outline" asChild>
                <Link href="/dashboard">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back to Dashboard
                </Link>
            </Button>
        </div>

        <div className="grid grid-cols-1 gap-8 items-start">
            <div className="space-y-8">
                <Card>
                    <CardHeader>
                        <CardTitle>Order {order.id}</CardTitle>
                        <div className="text-sm text-muted-foreground">
                        <span>Date: {format(new Date(order.date), 'dd MMMM yyyy')}</span> | <span>Status: </span><Badge variant={getStatusVariant(order.status)}>{order.status === 'Outsourced' ? 'Processing' : order.status}</Badge>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        {orderedItemsWithServices.map((item, index) => (
                            <div key={item.id}>
                                <div className="flex justify-between items-center">
                                    <div><p className="font-semibold text-lg">{item.title}</p></div>
                                    <p className="font-semibold text-lg">{formatPrice(item.price)}</p>
                                </div>
                                {item.service && item.service.informationToProvide && item.service.informationToProvide.length > 0 && (
                                    <div className="mt-4 pl-4 ml-4 border-l-2 space-y-4">
                                        <h4 className="font-medium text-md">Documents Required:</h4>
                                        {item.service.informationToProvide.map((info: { label: string; type?: 'text' | 'pdf' }, infoIndex: number) => {
                                            const upload = order.documentUploads?.find(d => d.serviceId === item.service?.id && d.requirementLabel === info.label);
                                            const uploadKey = `${item.service?.id}-${info.label}`;
                                            const isUploading = uploadingFiles[uploadKey] !== undefined;
                                            const isRejected = upload?.status === 'rejected';

                                            return (
                                            <div key={infoIndex} className="space-y-2 p-3 rounded-md border">
                                                <div className="flex justify-between items-center"><label className="text-sm font-medium flex items-center gap-2"><ClipboardCheck className="h-4 w-4" />{info.label}</label>{upload && ( <Badge variant={upload.status === 'approved' ? 'success' : upload.status === 'rejected' ? 'destructive' : 'warning'}>{upload.status === 'approved' && <CheckCircle className="mr-1 h-3 w-3" />}{upload.status === 'rejected' && <AlertTriangle className="mr-1 h-3 w-3" />}{upload.status.charAt(0).toUpperCase() + upload.status.slice(1).replace('_', ' ')}</Badge> )}</div>
                                                {isRejected && ( <p className="text-xs text-destructive mt-1 italic">Reason: {upload.rejectionReason}</p> )}
                                                {isRejected || !upload ? ( <> {isUploading ? ( <div className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin"/><p className="text-sm">Uploading... {Math.round(uploadingFiles[uploadKey])}%</p></div> ) : ( info.type === 'pdf' ? ( <Input type="file" accept="application/pdf" className="h-9" onChange={(e) => e.target.files && handleFileUpload(e.target.files[0], item.service!.id, info.label)} /> ) : ( <div className="flex items-center gap-2"><Input type="text" className="h-9" placeholder="Enter information here..." value={textInputs[info.label] || ''} onChange={(e) => handleTextChange(info.label, e.target.value)} /><Button size="sm" onClick={() => handleTextSubmit(item.service!.id, info.label)}>Save</Button></div> ) )} </> ) : ( <div className="p-2 bg-green-50 text-green-800 rounded-md border border-green-200 text-sm">{upload.type === 'file' ? `Submitted: ${upload.fileName}` : `Submitted: "${upload.textValue}"`}</div> )}
                                            </div>
                                        )})}
                                    </div>
                                )}
                                {index < orderedItemsWithServices.length - 1 && <Separator className="my-6" />}
                            </div>
                        ))}
                         <Separator className="my-4" /><div className="flex justify-between font-bold text-xl"><span>Total</span><span>{formatPrice(order.total)}</span></div>
                    </CardContent>
                    {allRequirements.length > 0 && ( <CardFooter><Button onClick={handleNotifyConsultant} disabled={isSubmitting || !allSubmitted}>{isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}Notify Consultant of All Submissions</Button></CardFooter> )}
                </Card>
                
                 <Card>
                    <CardHeader><CardTitle>Communication History</CardTitle><CardDescription>Notes and messages regarding this order.</CardDescription></CardHeader>
                    <CardContent className="space-y-4">
                         <div className="space-y-4 max-h-96 overflow-y-auto pr-2">
                            {order.notes && order.notes.length > 0 ? (
                                order.notes.slice().reverse().map((note, index) => {
                                    const author = getAuthor(note.authorId);
                                    const isEmail = note.type === 'email';
                                    return (
                                        <div key={index} className="flex items-start gap-3">
                                            <div className="p-3 rounded-lg w-full bg-muted">
                                                <div className="flex justify-between items-center mb-1"><p className="text-xs font-semibold">{author?.name || 'System'}</p><p className="text-xs text-muted-foreground">{format(new Date(note.date), 'dd/MM/yyyy, HH:mm')}</p></div>
                                                 {isEmail ? ( <div><div className="flex items-center gap-2 mb-1"><Mail className="h-4 w-4 text-muted-foreground" /><p className="text-sm font-semibold">{note.subject}</p></div><p className="text-sm italic text-muted-foreground">"{note.text}"</p></div> ) : ( <p className="text-sm" dangerouslySetInnerHTML={{ __html: note.text.replace(/\n/g, '<br />') }} /> )}
                                                 {note.attachments && note.attachments.length > 0 && ( <div className="mt-2 space-y-1">{note.attachments.map((att, i) => ( <a key={i} href={att.url} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline flex items-center gap-1"><Paperclip className="h-4 w-4"/>{att.name}</a> ))}</div> )}
                                            </div>
                                        </div>
                                    );
                                })
                            ) : ( <p className="text-xs text-muted-foreground text-center py-4">No notes for this order yet.</p> )}
                        </div>
                         <Form {...noteForm}>
                            <form onSubmit={noteForm.handleSubmit(onNoteSubmit)} className="space-y-4 pt-4">
                                <FormField control={noteForm.control} name="noteText" render={({ field }) => ( <FormItem><FormControl><Textarea placeholder="Add a new note..." {...field} rows={3} /></FormControl><FormMessage /></FormItem> )} />
                                <div className="flex items-center gap-2"><FormField control={noteForm.control} name="attachment" render={({ field }) => ( <FormItem><FormControl><Input type="file" onChange={(e) => field.onChange(e.target.files)} className="max-w-xs" /></FormControl><FormMessage /></FormItem> )} /><Button type="submit" size="sm" disabled={isSubmitting}><Send className="h-4 w-4 mr-2" />Post Note</Button></div>
                            </form>
                        </Form>
                    </CardContent>
                </Card>
            </div>
        </div>
    </div>
  );
}
