'use client';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2, BrainCircuit } from 'lucide-react';
import { useState } from 'react';
import { getFirestore, doc, updateDoc } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';

const db = getFirestore(firebaseApp);

const formSchema = z.object({
  companyName: z.string().min(2, 'Company name is required.'),
  name: z.string().min(2, 'Contact name is required.'),
  surname: z.string().min(2, 'Contact surname is required.'),
  email: z.string().email('Please enter a valid email.'),
  contactNumber: z.string().min(10, 'A valid contact number is required.'),
  geminiApiKey: z.string().optional(),
  address: z.object({
      street: z.string().min(3, 'Street address is required.'),
      city: z.string().min(2, 'City is required.'),
      province: z.string().min(2, 'Province is required.'),
      zip: z.string().min(4, 'Postal code is required.'),
  }),
  bankingDetails: z.object({
      bankName: z.string().min(3, 'Bank name is required.'),
      accountHolder: z.string().min(2, 'Account holder name is required.'),
      accountNumber: z.string().min(5, 'A valid account number is required.'),
      branchCode: z.string().min(6, 'A valid branch code is required.'),
  }),
});

export default function PartnerProfile() {
  const { user, updateUser } = useAuth();
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      companyName: user?.companyName || '',
      name: user?.name?.split(' ')[0] || user?.contactPerson?.split(' ')[0] || '',
      surname: user?.name?.split(' ').slice(1).join(' ') || user?.contactPerson?.split(' ').slice(1).join(' ') || '',
      email: user?.email || '',
      contactNumber: user?.contactNumber || '',
      geminiApiKey: user?.geminiApiKey || '',
      address: { 
          street: user?.address?.street || '', 
          city: user?.address?.city || '', 
          province: user?.address?.province || '', 
          zip: user?.address?.zip || ''
      },
      bankingDetails: { 
          bankName: user?.bankingDetails?.bankName || '', 
          accountHolder: user?.bankingDetails?.accountHolder || '', 
          accountNumber: user?.bankingDetails?.accountNumber || '', 
          branchCode: user?.bankingDetails?.branchCode || ''
      },
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    if (!user) return;
    setIsSaving(true);
    
    try {
        const userRef = doc(db, 'users', user.uid);
        const updateData = {
            companyName: values.companyName,
            contactNumber: values.contactNumber,
            geminiApiKey: values.geminiApiKey || '',
            address: values.address,
            bankingDetails: values.bankingDetails,
            name: `${values.name} ${values.surname}`,
        };

        await updateDoc(userRef, updateData);
        updateUser({ ...user, ...updateData });
        
        toast({
            title: 'Profile Updated!',
            description: `Your company details and AI settings have been saved.`,
        });
    } catch (error) {
        console.error("Error updating partner profile:", error);
        toast({
            title: 'Update Failed',
            description: 'Could not save your profile. Please try again.',
            variant: 'destructive',
        });
    } finally {
        setIsSaving(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        
        <div className="space-y-4">
             <h3 className="text-lg font-medium">Company Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField control={form.control} name="companyName" render={({ field }) => ( <FormItem><FormLabel>Company Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="name" render={({ field }) => ( <FormItem><FormLabel>Contact Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="surname" render={({ field }) => ( <FormItem><FormLabel>Contact Surname</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="email" render={({ field }) => ( <FormItem><FormLabel>Email Address</FormLabel><FormControl><Input {...field} readOnly disabled /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="contactNumber" render={({ field }) => ( <FormItem><FormLabel>Contact Number</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
            </div>
        </div>

        <div className="space-y-4">
            <h3 className="text-lg font-medium">AI Configuration</h3>
            <Card className="border-primary/20 bg-primary/5">
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                        <BrainCircuit className="h-4 w-4 text-primary"/>
                        Gemini AI Integration
                    </CardTitle>
                    <CardDescription className="text-xs">
                        Provide your own Google Gemini API key to enable AI-powered features for your client dashboard.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <FormField 
                        control={form.control} 
                        name="geminiApiKey" 
                        render={({ field }) => ( 
                            <FormItem>
                                <FormLabel className="text-xs">Google Gemini API Key</FormLabel>
                                <FormControl>
                                    <Input 
                                        type="password" 
                                        placeholder="Enter your API key..." 
                                        {...field} 
                                        className="bg-white"
                                    />
                                </FormControl>
                                <FormDescription className="text-[10px]">
                                    Your key is stored securely and never shared. Get a key from the <a href="https://aistudio.google.com/app/apikey" target="_blank" className="text-primary hover:underline">Google AI Studio</a>.
                                </FormDescription>
                                <FormMessage />
                            </FormItem>
                        )} 
                    />
                </CardContent>
            </Card>
        </div>

        <div className="space-y-4">
            <h3 className="text-lg font-medium">Physical Address</h3>
            <FormField control={form.control} name="address.street" render={({ field }) => ( <FormItem><FormLabel>Street Address</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField control={form.control} name="address.city" render={({ field }) => ( <FormItem><FormLabel>City</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="address.province" render={({ field }) => ( <FormItem><FormLabel>Province</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="address.zip" render={({ field }) => ( <FormItem><FormLabel>Postal Code</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
            </div>
        </div>

        <Separator />

        <div className="space-y-4">
            <h3 className="text-lg font-medium">Banking Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 <FormField control={form.control} name="bankingDetails.bankName" render={({ field }) => ( <FormItem><FormLabel>Bank Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                 <FormField control={form.control} name="bankingDetails.accountHolder" render={({ field }) => ( <FormItem><FormLabel>Account Holder</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                 <FormField control={form.control} name="bankingDetails.accountNumber" render={({ field }) => ( <FormItem><FormLabel>Account Number</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                 <FormField control={form.control} name="bankingDetails.branchCode" render={({ field }) => ( <FormItem><FormLabel>Branch Code</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
            </div>
        </div>
        
        <Separator />
        
        <Button type="submit" disabled={isSaving}>
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Changes
        </Button>
      </form>
    </Form>
  );
}
