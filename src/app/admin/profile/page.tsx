

'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useState } from 'react';
import { getFirestore, doc, updateDoc } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { Loader2 } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { getAuth, updatePassword, reauthenticateWithCredential, EmailAuthProvider } from 'firebase/auth';
import EmailSettingsForm from '@/components/admin/EmailSettingsForm';
import { Textarea } from '@/components/ui/textarea';

const db = getFirestore(firebaseApp);
const auth = getAuth(firebaseApp);

const profileFormSchema = z.object({
    name: z.string().min(2, 'Name is required.'),
    email: z.string().email(),
    emailSignature: z.string().optional(),
});

const passwordFormSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required to change it.'),
  newPassword: z.string().min(6, 'Password must be at least 6 characters.'),
  confirmPassword: z.string(),
}).refine(data => data.newPassword === data.confirmPassword, {
  message: "Passwords do not match.",
  path: ['confirmPassword'],
});


export default function ProfilePage() {
  const { user, updateUser, reauthenticate } = useAuth();
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const [isPasswordSaving, setIsPasswordSaving] = useState(false);

  const profileForm = useForm<z.infer<typeof profileFormSchema>>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      name: user?.name || '',
      email: user?.email || '',
      emailSignature: user?.emailSignature || '',
    },
  });

  const passwordForm = useForm<z.infer<typeof passwordFormSchema>>({
    resolver: zodResolver(passwordFormSchema),
    defaultValues: {
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    },
  });
  
  if (!user) {
    return <p>Loading...</p>;
  }

  const onProfileSubmit = async (values: z.infer<typeof profileFormSchema>) => {
    setIsSaving(true);
     try {
        const userRef = doc(db, 'users', user.uid);
        await updateDoc(userRef, { 
            name: values.name,
            emailSignature: values.emailSignature,
        });
        updateUser({ ...user, name: values.name, emailSignature: values.emailSignature });
        toast({ title: 'Profile Updated', description: 'Your information has been updated.' });
    } catch (error) {
        console.error("Error updating profile:", error);
        toast({ title: 'Error', description: 'Could not update your profile.', variant: 'destructive' });
    } finally {
        setIsSaving(false);
    }
  }

  const onPasswordSubmit = async (values: z.infer<typeof passwordFormSchema>) => {
    setIsPasswordSaving(true);
    const firebaseUser = auth.currentUser;
    if (!firebaseUser || !firebaseUser.email) {
        toast({ title: 'Error', description: 'You are not logged in properly.', variant: 'destructive' });
        setIsPasswordSaving(false);
        return;
    }

    try {
        const credential = EmailAuthProvider.credential(firebaseUser.email, values.currentPassword);
        await reauthenticateWithCredential(firebaseUser, credential);
        await updatePassword(firebaseUser, values.newPassword);
        toast({ title: 'Password Updated', description: 'Your password has been changed successfully.' });
        passwordForm.reset();
    } catch (error: any) {
        console.error("Error updating password:", error);
        let description = 'Could not update your password.';
        if(error.code === 'auth/wrong-password') {
            description = 'The current password you entered is incorrect.';
        } else if (error.code === 'auth/requires-recent-login') {
            description = 'This action is sensitive and requires recent authentication. Please log in again and retry.';
        }
        toast({ title: 'Error', description, variant: 'destructive' });
    } finally {
        setIsPasswordSaving(false);
    }
  };

  return (
    <div className="space-y-8 max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold tracking-tight">My Profile</h1>
        <Card>
            <CardHeader>
                <CardTitle>Your Details</CardTitle>
                <CardDescription>View and update your personal information.</CardDescription>
            </CardHeader>
            <CardContent>
                <Form {...profileForm}>
                    <form onSubmit={profileForm.handleSubmit(onProfileSubmit)} className="space-y-4">
                        <FormField control={profileForm.control} name="name" render={({ field }) => ( <FormItem><FormLabel>Full Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                        <FormField control={profileForm.control} name="email" render={({ field }) => ( <FormItem><FormLabel>Email Address</FormLabel><FormControl><Input {...field} readOnly disabled /></FormControl><FormMessage /></FormItem> )} />
                         <FormField control={profileForm.control} name="emailSignature" render={({ field }) => ( <FormItem><FormLabel>Email Signature</FormLabel><FormControl><Textarea {...field} rows={5} placeholder="e.g., Kind regards,&#10;John Doe" /></FormControl><FormMessage /></FormItem> )} />
                         <Button type="submit" disabled={isSaving}>
                            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Save Changes
                        </Button>
                    </form>
                </Form>
            </CardContent>
        </Card>
        
        <Card>
            <CardHeader>
                <CardTitle>Change Password</CardTitle>
                <CardDescription>Update your login password.</CardDescription>
            </CardHeader>
            <CardContent>
                 <Form {...passwordForm}>
                    <form onSubmit={passwordForm.handleSubmit(onPasswordSubmit)} className="space-y-4">
                        <FormField control={passwordForm.control} name="currentPassword" render={({ field }) => ( <FormItem><FormLabel>Current Password</FormLabel><FormControl><Input type="password" {...field} /></FormControl><FormMessage /></FormItem> )} />
                        <FormField control={passwordForm.control} name="newPassword" render={({ field }) => ( <FormItem><FormLabel>New Password</FormLabel><FormControl><Input type="password" {...field} /></FormControl><FormMessage /></FormItem> )} />
                        <FormField control={passwordForm.control} name="confirmPassword" render={({ field }) => ( <FormItem><FormLabel>Confirm New Password</FormLabel><FormControl><Input type="password" {...field} /></FormControl><FormMessage /></FormItem> )} />
                        <Button type="submit" disabled={isPasswordSaving}>
                            {isPasswordSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Update Password
                        </Button>
                    </form>
                </Form>
            </CardContent>
        </Card>
        
        {(user.role === 'admin' || user.role === 'staff') && (
            <Card>
                <CardHeader>
                    <CardTitle>Email Settings</CardTitle>
                    <CardDescription>Configure your email account to send and receive emails through the app.</CardDescription>
                </CardHeader>
                <CardContent>
                    <EmailSettingsForm />
                </CardContent>
            </Card>
        )}
    </div>
  );
}
