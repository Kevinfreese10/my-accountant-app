'use client';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2, BrainCircuit, Globe, Layout, Palette, ExternalLink, ShieldCheck, Mail, Upload, Image as ImageIcon } from 'lucide-react';
import { useState, useEffect } from 'react';
import { getFirestore, doc, updateDoc } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { firebaseApp } from '@/lib/firebase';
import { Switch } from '../ui/switch';
import { Textarea } from '../ui/textarea';
import Link from 'next/link';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { cn } from '@/lib/utils';
import { sendEmail } from '@/lib/email';
import { Slider } from '../ui/slider';

const db = getFirestore(firebaseApp);
const storage = getStorage(firebaseApp);

const formSchema = z.object({
  companyName: z.string().min(2, 'Company name is required.'),
  name: z.string().min(2, 'Contact name is required.'),
  surname: z.string().min(2, 'Contact surname is required.'),
  email: z.string().email('Please enter a valid email.'),
  contactNumber: z.string().min(10, 'A valid contact number is required.'),
  geminiApiKey: z.string().optional(),
  smtpDetails: z.object({
      host: z.string().optional(),
      port: z.string().optional(),
      user: z.string().optional(),
      pass: z.string().optional(),
  }).optional(),
  address: z.object({
      street: z.string().optional(),
      city: z.string().optional(),
      province: z.string().optional(),
      zip: z.string().optional(),
  }).optional(),
  bankingDetails: z.object({
      bankName: z.string().optional(),
      accountHolder: z.string().optional(),
      accountNumber: z.string().optional(),
      branchCode: z.string().optional(),
  }).optional(),
  landingPage: z.object({
    enabled: z.boolean().default(false),
    slug: z.string().min(3, "Slug must be at least 3 characters").regex(/^[a-z0-9-]+$/, "Slug can only contain lowercase letters, numbers, and hyphens"),
    heroTitle: z.string().min(5, "Hero title is too short"),
    heroSubtitle: z.string().min(10, "Hero subtitle is too short"),
    aboutUs: z.string().min(20, "About Us text is too short"),
    themePreset: z.enum(['custom', 'my_accountant', 'futuristic', 'tech_blue']).default('custom'),
    primaryColor: z.string().regex(/^#[0-9A-F]{6}$/i, "Must be a valid hex color"),
    secondaryColor: z.string().regex(/^#[0-9A-F]{6}$/i, "Must be a valid hex color").optional(),
    backgroundColor: z.string().regex(/^#[0-9A-F]{6}$/i, "Must be a valid hex color").optional(),
    textColor: z.string().regex(/^#[0-9A-F]{6}$/i, "Must be a valid hex color").optional(),
    cardBackgroundColor: z.string().regex(/^#[0-9A-F]{6}$/i, "Must be a valid hex color").optional(),
    cardBorderColor: z.string().regex(/^#[0-9A-F]{6}$/i, "Must be a valid hex color").optional(),
    showLogo: z.boolean().default(true),
    hideHeaderBranding: z.boolean().default(false),
    logoUrl: z.string().url().optional().or(z.literal('')),
    logoHeight: z.preprocess(val => Number(val) || 40, z.number().min(20).max(120)),
    heroImageUrl: z.string().url().optional().or(z.literal('')),
    heroOverlayOpacity: z.preprocess(val => Number(val) || 0, z.number().min(0).max(100)),
    heroLayout: z.enum(['centered', 'split-left', 'split-right', 'background']).default('centered'),
    heroTextPosition: z.enum(['inside', 'below']).default('inside'),
    refundPolicy: z.string().optional(),
    popiaPolicy: z.string().optional(),
    termsAndConditions: z.string().optional(),
    heroTitleColor: z.string().regex(/^#[0-9A-F]{6}$/i, "Must be a valid hex color").optional(),
    heroSubtitleColor: z.string().regex(/^#[0-9A-F]{6}$/i, "Must be a valid hex color").optional(),
    servicesHeroImageUrl: z.string().url().optional().or(z.literal('')),
    servicesHeroOverlayOpacity: z.preprocess(val => Number(val) || 0, z.number().min(0).max(100)),
    servicesHeroLayout: z.enum(['centered', 'split-left', 'split-right', 'background']).default('centered'),
  })
});

const THEMES = {
    my_accountant: {
        primaryColor: '#214392',
        secondaryColor: '#f3f4f6',
        backgroundColor: '#ffffff',
        textColor: '#111827',
        cardBackgroundColor: '#ffffff',
        cardBorderColor: '#e5e7eb',
    },
    futuristic: {
        primaryColor: '#8b5cf6',
        secondaryColor: '#1e1b4b',
        backgroundColor: '#020617',
        textColor: '#ffffff',
        cardBackgroundColor: '#0f172a',
        cardBorderColor: '#1e293b',
    },
    tech_blue: {
        primaryColor: '#0ea5e9',
        secondaryColor: '#f0f9ff',
        backgroundColor: '#f8fafc',
        textColor: '#0f172a',
        cardBackgroundColor: '#ffffff',
        cardBorderColor: '#e2e8f0',
    }
};

const QUICK_COLORS = [
    '#214392', // My Accountant Blue
    '#0ea5e9', // Sky Blue
    '#4f46e5', // Indigo
    '#8b5cf6', // Violet
    '#d946ef', // Fuchsia
    '#e11d48', // Rose
    '#f43f5e', // Rose Red
    '#f97316', // Orange
    '#d97706', // Amber
    '#059669', // Emerald
    '#10b981', // Green
    '#1e293b', // Slate
    '#0f172a', // Deep Navy
    '#ffffff', // White
    '#f3f4f6', // Light Gray
    '#e5e7eb', // Border Gray
    '#000000', // Black
];

export default function PartnerProfile() {
  const { user, updateUser } = useAuth();
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const [isTestingSmtp, setIsTestingSmtp] = useState(false);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [isUploadingHero, setIsUploadingHero] = useState(false);
  const [isUploadingServicesHero, setIsUploadingServicesHero] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      companyName: user?.companyName || '',
      name: user?.name?.split(' ')[0] || user?.contactPerson?.split(' ')[0] || '',
      surname: user?.name?.split(' ').slice(1).join(' ') || user?.contactPerson?.split(' ').slice(1).join(' ') || '',
      email: user?.email || '',
      contactNumber: user?.contactNumber || '',
      geminiApiKey: user?.geminiApiKey || '',
      smtpDetails: {
          host: user?.smtpDetails?.host || '',
          port: user?.smtpDetails?.port || '465',
          user: user?.smtpDetails?.user || '',
          pass: user?.smtpDetails?.pass || '',
      },
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
      landingPage: {
        enabled: user?.landingPage?.enabled || false,
        slug: user?.landingPage?.slug || '',
        heroTitle: user?.landingPage?.heroTitle || `Professional Accounting Services for your Business`,
        heroSubtitle: user?.landingPage?.heroSubtitle || `Expert tax, accounting, and compliance solutions tailored to your needs.`,
        aboutUs: user?.landingPage?.aboutUs || `We are a dedicated team of accounting professionals committed to helping small businesses grow through accurate financial management and strategic advice.`,
        themePreset: user?.landingPage?.themePreset || 'custom',
        primaryColor: user?.landingPage?.primaryColor || '#214392',
        secondaryColor: user?.landingPage?.secondaryColor || '#f3f4f6',
        backgroundColor: user?.landingPage?.backgroundColor || '#ffffff',
        textColor: user?.landingPage?.textColor || '#111827',
        cardBackgroundColor: user?.landingPage?.cardBackgroundColor || '#ffffff',
        cardBorderColor: user?.landingPage?.cardBorderColor || '#e5e7eb',
        showLogo: user?.landingPage?.showLogo !== undefined ? user?.landingPage?.showLogo : true,
        hideHeaderBranding: user?.landingPage?.hideHeaderBranding || false,
        logoUrl: user?.landingPage?.logoUrl || '',
        logoHeight: user?.landingPage?.logoHeight || 40,
        heroImageUrl: user?.landingPage?.heroImageUrl || '',
        heroOverlayOpacity: user?.landingPage?.heroOverlayOpacity || 0,
        heroLayout: user?.landingPage?.heroLayout || 'centered',
        heroTextPosition: user?.landingPage?.heroTextPosition || 'inside',
        refundPolicy: user?.landingPage?.refundPolicy || '',
        popiaPolicy: user?.landingPage?.popiaPolicy || '',
        termsAndConditions: user?.landingPage?.termsAndConditions || '',
        heroTitleColor: user?.landingPage?.heroTitleColor || '#111827',
        heroSubtitleColor: user?.landingPage?.heroSubtitleColor || '#4b5563',
        servicesHeroImageUrl: user?.landingPage?.servicesHeroImageUrl || '',
        servicesHeroOverlayOpacity: user?.landingPage?.servicesHeroOverlayOpacity || 0,
        servicesHeroLayout: user?.landingPage?.servicesHeroLayout || 'centered',
      }
    },
  });

  const { setValue, watch } = form;
  const themePreset = watch('landingPage.themePreset');

  useEffect(() => {
    if (themePreset && themePreset !== 'custom') {
        const theme = THEMES[themePreset as keyof typeof THEMES];
        if (theme) {
            Object.entries(theme).forEach(([key, value]) => {
                setValue(`landingPage.${key as any}`, value, { shouldDirty: true });
            });
        }
    }
  }, [themePreset, setValue]);

  const handleColorChange = (field: any, value: string) => {
      field.onChange(value);
      if (themePreset !== 'custom') {
          setValue('landingPage.themePreset', 'custom');
      }
  };

  const handleFileUpload = async (file: File, type: 'logo' | 'hero' | 'servicesHero') => {
      if (!user) return;
      if (type === 'logo') setIsUploadingLogo(true); 
      else if (type === 'hero') setIsUploadingHero(true);
      else setIsUploadingServicesHero(true);

      try {
          const path = `partners/${user.uid}/${type}/${Date.now()}-${file.name}`;
          const storageRef = ref(storage, path);
          await uploadBytes(storageRef, file);
          const url = await getDownloadURL(storageRef);
          
          if (type === 'logo') {
              setValue('landingPage.logoUrl', url, { shouldDirty: true });
          } else if (type === 'hero') {
              setValue('landingPage.heroImageUrl', url, { shouldDirty: true });
          } else {
              setValue('landingPage.servicesHeroImageUrl', url, { shouldDirty: true });
          }
          toast({ title: 'Upload Successful' });
      } catch (e) {
          console.error(e);
          toast({ title: 'Upload Failed', variant: 'destructive' });
      } finally {
          if (type === 'logo') setIsUploadingLogo(false); 
          else if (type === 'hero') setIsUploadingHero(false);
          else setIsUploadingServicesHero(false);
      }
  }

  async function onSubmit(values: z.infer<typeof formSchema>) {
    if (!user) return;
    setIsSaving(true);
    
    try {
        const userRef = doc(db, 'users', user.uid);
        const updateData = {
            companyName: values.companyName,
            contactNumber: values.contactNumber,
            geminiApiKey: values.geminiApiKey || '',
            smtpDetails: values.smtpDetails,
            address: values.address,
            bankingDetails: values.bankingDetails,
            name: `${values.name} ${values.surname}`,
            landingPage: values.landingPage,
        };

        await updateDoc(userRef, updateData);
        updateUser({ ...user, ...updateData });
        
        toast({
            title: 'Profile Updated!',
            description: `Your details have been saved.`,
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

  const handleTestSmtp = async () => {
      const values = form.getValues();
      if (!values.smtpDetails?.host || !values.smtpDetails?.user || !values.smtpDetails?.pass) {
          toast({ title: 'Configuration Incomplete', description: 'Please fill in all SMTP fields before testing.', variant: 'destructive' });
          return;
      }

      setIsTestingSmtp(true);
      toast({ title: 'Sending Test Email...', description: 'Please wait while we verify your SMTP settings.' });

      try {
          await sendEmail({
              to: values.email,
              subject: `SMTP Test from ${values.companyName}`,
              html: `<p>This is a test email to confirm your practice's SMTP settings are working correctly.</p><p>Sent from: <strong>${values.companyName}</strong></p>`,
              smtpOverride: {
                  host: values.smtpDetails.host,
                  port: values.smtpDetails.port || '465',
                  user: values.smtpDetails.user,
                  pass: values.smtpDetails.pass,
              },
              fromNameOverride: values.companyName
          });
          toast({ title: 'Test Successful!', description: `A test email has been sent to ${values.email}. Please check your inbox.` });
      } catch (e: any) {
          console.error(e);
          toast({ title: 'SMTP Test Failed', description: e.message || 'Could not connect to your SMTP server.', variant: 'destructive' });
      } finally {
          setIsTestingSmtp(false);
      }
  }

  const landingPageEnabled = watch('landingPage.enabled');
  const landingPageSlug = watch('landingPage.slug');

  const ColorField = ({ name, label, description }: { name: any, label: string, description?: string }) => (
    <FormField
        control={form.control}
        name={name}
        render={({ field }) => (
            <FormItem className="space-y-3">
                <div>
                    <FormLabel className="text-xs font-bold uppercase text-muted-foreground">{label}</FormLabel>
                    {description && <p className="text-[10px] text-muted-foreground">{description}</p>}
                </div>
                <div className="flex flex-col gap-3">
                    <div className="flex items-center gap-2">
                        <FormControl>
                            <div className="flex items-center gap-2 border rounded-md px-2 py-1 flex-grow bg-background">
                                <input 
                                    type="color" 
                                    value={field.value || '#ffffff'} 
                                    onChange={(e) => handleColorChange(field, e.target.value)}
                                    className="w-6 h-6 rounded-sm cursor-pointer border-0 bg-transparent p-0"
                                />
                                <Input 
                                    {...field} 
                                    className="border-0 h-7 text-xs font-mono uppercase focus-visible:ring-0 focus-visible:ring-offset-0 px-1" 
                                    onChange={(e) => handleColorChange(field, e.target.value)}
                                />
                            </div>
                        </FormControl>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                        {QUICK_COLORS.map((color) => (
                            <button
                                key={color}
                                type="button"
                                onClick={() => handleColorChange(field, color)}
                                className={cn(
                                    "w-5 h-5 rounded-full border border-muted-foreground/20 transition-all hover:scale-125",
                                    field.value === color && "ring-2 ring-primary ring-offset-1 scale-110"
                                )}
                                style={{ backgroundColor: color }}
                                title={color}
                            />
                        ))}
                    </div>
                </div>
                <FormMessage />
            </FormItem>
        )}
    />
  );

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

        <Separator />

        <div className="space-y-4">
            <h3 className="text-lg font-medium flex items-center gap-2">
                <Mail className="h-5 w-5 text-primary" />
                Email SMTP Settings
            </h3>
            <Card className="bg-muted/30">
                <CardHeader>
                    <CardTitle className="text-sm">Outgoing Mail Server</CardTitle>
                    <CardDescription className="text-xs">
                        Configure your SMTP server to send emails directly from your practice address.
                    </CardDescription>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField control={form.control} name="smtpDetails.host" render={({ field }) => ( <FormItem><FormLabel className="text-xs">SMTP Host</FormLabel><FormControl><Input placeholder="e.g. smtp.gmail.com" {...field} /></FormControl></FormItem>)} />
                    <FormField control={form.control} name="smtpDetails.port" render={({ field }) => ( <FormItem><FormLabel className="text-xs">SMTP Port</FormLabel><FormControl><Input placeholder="e.g. 465" {...field} /></FormControl></FormItem>)} />
                    <FormField control={form.control} name="smtpDetails.user" render={({ field }) => ( <FormItem><FormLabel className="text-xs">SMTP Username (Email)</FormLabel><FormControl><Input placeholder="your@email.com" {...field} /></FormControl></FormItem>)} />
                    <FormField control={form.control} name="smtpDetails.pass" render={({ field }) => ( <FormItem><FormLabel className="text-xs">SMTP Password</FormLabel><FormControl><Input type="password" placeholder="••••••••" {...field} /></FormControl></FormItem>)} />
                </CardContent>
                <CardFooter className="bg-muted/50 justify-between py-3">
                    <p className="text-[10px] text-muted-foreground italic">Required for white-label notifications.</p>
                    <Button type="button" variant="outline" size="sm" onClick={handleTestSmtp} disabled={isTestingSmtp}>
                        {isTestingSmtp && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Send Test Email
                    </Button>
                </CardFooter>
            </Card>
        </div>

        <Separator />

        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium flex items-center gap-2">
                    <Globe className="h-5 w-5 text-primary" />
                    White-Label Landing Page
                </h3>
                <FormField
                    control={form.control}
                    name="landingPage.enabled"
                    render={({ field }) => (
                        <FormItem className="flex items-center space-x-2 space-y-0">
                            <FormControl>
                                <Switch
                                    checked={field.value}
                                    onCheckedChange={field.onChange}
                                />
                            </FormControl>
                            <FormLabel className="text-xs uppercase font-bold text-muted-foreground">Enabled</FormLabel>
                        </FormItem>
                    )}
                />
            </div>

            {landingPageEnabled ? (
                <div className="grid grid-cols-1 gap-6">
                    <Card className="border-primary/20">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-sm font-semibold">Public Link</CardTitle>
                            <CardDescription className="text-xs">Your custom URL for clients.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="flex items-center gap-2">
                                <div className="bg-muted px-3 py-2 rounded-md font-mono text-sm flex-grow">
                                    /p/{landingPageSlug || 'your-slug'}
                                </div>
                                {landingPageSlug && (
                                    <Button variant="outline" size="sm" asChild>
                                        <Link href={`/p/${landingPageSlug}`} target="_blank">
                                            <ExternalLink className="h-4 w-4 mr-2"/>
                                            Visit Page
                                        </Link>
                                    </Button>
                                )}
                            </div>
                            <FormField
                                control={form.control}
                                name="landingPage.slug"
                                render={({ field }) => (
                                    <FormItem className="mt-4">
                                        <FormLabel className="text-xs">Custom Slug</FormLabel>
                                        <FormControl><Input {...field} placeholder="e.g. smith-accounting" /></FormControl>
                                        <FormDescription className="text-[10px]">Lowercase letters and hyphens only.</FormDescription>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </CardContent>
                    </Card>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-sm flex items-center gap-2">
                                    <Layout className="h-4 w-4" /> Content & Images
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <div className="space-y-4">
                                    <FormField
                                        control={form.control}
                                        name="landingPage.heroTitle"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel className="text-xs">Hero Title</FormLabel>
                                                <FormControl><Input {...field} /></FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <ColorField name="landingPage.heroTitleColor" label="Hero Title Color" />
                                </div>

                                <Separator />

                                <div className="space-y-4">
                                    <FormField
                                        control={form.control}
                                        name="landingPage.heroSubtitle"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel className="text-xs">Hero Subtitle</FormLabel>
                                                <FormControl><Textarea {...field} rows={2} /></FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <ColorField name="landingPage.heroSubtitleColor" label="Hero Subtitle Color" />
                                </div>
                                
                                <Separator />

                                <FormField
                                    control={form.control}
                                    name="landingPage.heroTextPosition"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-xs font-bold uppercase text-muted-foreground">Text Position</FormLabel>
                                            <Select onValueChange={field.onChange} value={field.value}>
                                                <FormControl><SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger></FormControl>
                                                <SelectContent>
                                                    <SelectItem value="inside">Inside Image (Overlay)</SelectItem>
                                                    <SelectItem value="below">Below Image</SelectItem>
                                                </SelectContent>
                                            </Select>
                                            <FormDescription className="text-[10px]">Choose if title and subtitle appear over the image or underneath it.</FormDescription>
                                        </FormItem>
                                    )}
                                />

                                <Separator />
                                
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <div className="space-y-0.5">
                                            <FormLabel className="text-xs font-bold uppercase text-muted-foreground">Practice Logo</FormLabel>
                                            <div className="flex flex-col gap-2">
                                                <FormField
                                                    control={form.control}
                                                    name="landingPage.showLogo"
                                                    render={({ field }) => (
                                                        <FormItem className="flex items-center space-x-2 space-y-0">
                                                            <FormControl>
                                                                <Switch
                                                                    checked={field.value}
                                                                    onCheckedChange={field.onChange}
                                                                />
                                                            </FormControl>
                                                            <span className="text-[10px] text-muted-foreground uppercase font-bold">Show Logo Image</span>
                                                        </FormItem>
                                                    )}
                                                />
                                                <FormField
                                                    control={form.control}
                                                    name="landingPage.hideHeaderBranding"
                                                    render={({ field }) => (
                                                        <FormItem className="flex items-center space-x-2 space-y-0">
                                                            <FormControl>
                                                                <Switch
                                                                    checked={field.value}
                                                                    onCheckedChange={field.onChange}
                                                                />
                                                            </FormControl>
                                                            <span className="text-[10px] text-destructive uppercase font-bold">Hide All Header Branding</span>
                                                        </FormItem>
                                                    )}
                                                />
                                            </div>
                                        </div>
                                        <Button variant="outline" size="xs" className="h-7" asChild disabled={isUploadingLogo}>
                                            <label className="cursor-pointer">
                                                {isUploadingLogo ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3 mr-1" />}
                                                Upload Logo
                                                <input type="file" className="hidden" accept="image/*" onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0], 'logo')} />
                                            </label>
                                        </Button>
                                    </div>
                                    <FormField
                                        control={form.control}
                                        name="landingPage.logoUrl"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormControl><Input {...field} placeholder="https://..." className="text-xs h-8" /></FormControl>
                                                <FormDescription className="text-[9px]">URL to your logo (PNG/SVG recommended).</FormDescription>
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="landingPage.logoHeight"
                                        render={({ field }) => (
                                            <FormItem className="space-y-3">
                                                <div className="flex justify-between items-center">
                                                    <FormLabel className="text-xs">Logo Height (px)</FormLabel>
                                                    <span className="text-[10px] font-bold text-primary">{field.value}px</span>
                                                </div>
                                                <FormControl>
                                                    <Slider 
                                                        min={20} 
                                                        max={120} 
                                                        step={5} 
                                                        value={[field.value]} 
                                                        onValueChange={(v) => field.onChange(v[0])} 
                                                    />
                                                </FormControl>
                                            </FormItem>
                                        )}
                                    />
                                </div>

                                <Separator />

                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <FormLabel className="text-xs font-bold uppercase text-muted-foreground">Hero Background Image</FormLabel>
                                        <Button variant="outline" size="xs" className="h-7" asChild disabled={isUploadingHero}>
                                            <label className="cursor-pointer">
                                                {isUploadingHero ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3 mr-1" />}
                                                Upload Hero
                                                <input type="file" className="hidden" accept="image/*" onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0], 'hero')} />
                                            </label>
                                        </Button>
                                    </div>
                                    <FormField
                                        control={form.control}
                                        name="landingPage.heroImageUrl"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormControl><Input {...field} placeholder="https://..." className="text-xs h-8" /></FormControl>
                                                <FormDescription className="text-[9px]">URL to a background image for the hero section.</FormDescription>
                                            </FormItem>
                                        )}
                                    />
                                    <div className="grid grid-cols-2 gap-4">
                                        <FormField
                                            control={form.control}
                                            name="landingPage.heroLayout"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel className="text-[10px]">Layout Style</FormLabel>
                                                    <Select onValueChange={field.onChange} value={field.value}>
                                                        <FormControl><SelectTrigger className="h-8 text-[10px]"><SelectValue /></SelectTrigger></FormControl>
                                                        <SelectContent>
                                                            <SelectItem value="centered">Centered</SelectItem>
                                                            <SelectItem value="split-left">Left Align</SelectItem>
                                                            <SelectItem value="split-right">Right Align</SelectItem>
                                                            <SelectItem value="background">Full Background</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </FormItem>
                                            )}
                                        />
                                        <FormField
                                            control={form.control}
                                            name="landingPage.heroOverlayOpacity"
                                            render={({ field }) => (
                                                <FormItem className="space-y-2">
                                                    <div className="flex justify-between items-center">
                                                        <FormLabel className="text-[10px]">Overlay Opacity</FormLabel>
                                                        <span className="text-[10px] font-bold text-primary">{field.value}%</span>
                                                    </div>
                                                    <FormControl>
                                                        <Slider 
                                                            min={0} 
                                                            max={90} 
                                                            step={5} 
                                                            value={[field.value]} 
                                                            onValueChange={(v) => field.onChange(v[0])} 
                                                        />
                                                    </FormControl>
                                                </FormItem>
                                            )}
                                        />
                                    </div>
                                </div>

                                <Separator />

                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <FormLabel className="text-xs font-bold uppercase text-muted-foreground">Services Section Hero</FormLabel>
                                        <Button variant="outline" size="xs" className="h-7" asChild disabled={isUploadingServicesHero}>
                                            <label className="cursor-pointer">
                                                {isUploadingServicesHero ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3 mr-1" />}
                                                Upload Banner
                                                <input type="file" className="hidden" accept="image/*" onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0], 'servicesHero')} />
                                            </label>
                                        </Button>
                                    </div>
                                    <FormField
                                        control={form.control}
                                        name="landingPage.servicesHeroImageUrl"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormControl><Input {...field} placeholder="https://..." className="text-xs h-8" /></FormControl>
                                                <FormDescription className="text-[9px]">Banner image displayed above the services grid.</FormDescription>
                                            </FormItem>
                                        )}
                                    />
                                    <div className="grid grid-cols-2 gap-4">
                                        <FormField
                                            control={form.control}
                                            name="landingPage.servicesHeroLayout"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel className="text-[10px]">Layout Style</FormLabel>
                                                    <Select onValueChange={field.onChange} value={field.value}>
                                                        <FormControl><SelectTrigger className="h-8 text-[10px]"><SelectValue /></SelectTrigger></FormControl>
                                                        <SelectContent>
                                                            <SelectItem value="centered">Centered</SelectItem>
                                                            <SelectItem value="split-left">Left Align</SelectItem>
                                                            <SelectItem value="split-right">Right Align</SelectItem>
                                                            <SelectItem value="background">Full Background</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </FormItem>
                                            )}
                                        />
                                        <FormField
                                            control={form.control}
                                            name="landingPage.servicesHeroOverlayOpacity"
                                            render={({ field }) => (
                                                <FormItem className="space-y-2">
                                                    <div className="flex justify-between items-center">
                                                        <FormLabel className="text-[10px]">Overlay Opacity</FormLabel>
                                                        <span className="text-[10px] font-bold text-primary">{field.value}%</span>
                                                    </div>
                                                    <FormControl>
                                                        <Slider 
                                                            min={0} 
                                                            max={90} 
                                                            step={5} 
                                                            value={[field.value]} 
                                                            onValueChange={(v) => field.onChange(v[0])} 
                                                        />
                                                    </FormControl>
                                                </FormItem>
                                            )}
                                        />
                                    </div>
                                </div>

                                <Separator />

                                <FormField
                                    control={form.control}
                                    name="landingPage.aboutUs"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-xs">About Us Paragraph</FormLabel>
                                            <FormControl><Textarea {...field} rows={4} /></FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                
                                <Separator />
                                <h4 className="text-xs font-bold uppercase text-muted-foreground flex items-center gap-2">
                                    <ShieldCheck className="h-3 w-3" /> Legal Documents
                                </h4>
                                <FormField
                                    control={form.control}
                                    name="landingPage.refundPolicy"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-xs">Refund Policy</FormLabel>
                                            <FormControl><Textarea {...field} rows={3} placeholder="Enter your practice's refund policy..." /></FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="landingPage.popiaPolicy"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-xs">POPIA Policy</FormLabel>
                                            <FormControl><Textarea {...field} rows={3} placeholder="Enter your POPIA/Privacy policy..." /></FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="landingPage.termsAndConditions"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-xs">Terms & Conditions</FormLabel>
                                            <FormControl><Textarea {...field} rows={3} placeholder="Enter your terms and conditions..." /></FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle className="text-sm flex items-center gap-2">
                                    <Palette className="h-4 w-4" /> Branding & Theme
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <FormField
                                    control={form.control}
                                    name="landingPage.themePreset"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-xs">Theme Preset</FormLabel>
                                            <Select onValueChange={field.onChange} value={field.value}>
                                                <FormControl><SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger></FormControl>
                                                <SelectContent>
                                                    <SelectItem value="custom">Custom (Fine-tuned)</SelectItem>
                                                    <SelectItem value="my_accountant">My Accountant (Master)</SelectItem>
                                                    <SelectItem value="tech_blue">Tech Professional (Light)</SelectItem>
                                                    <SelectItem value="futuristic">Modern Midnight (Dark)</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </FormItem>
                                    )}
                                />
                                <Separator className="my-2" />
                                <div className="space-y-6">
                                    <ColorField name="landingPage.primaryColor" label="Primary Color" description="Buttons, icons, and highlights." />
                                    <ColorField name="landingPage.secondaryColor" label="Secondary Color" description="Badges and secondary accents." />
                                    <ColorField name="landingPage.backgroundColor" label="Page Background" description="Overall backdrop of your site." />
                                    <ColorField name="landingPage.textColor" label="Text Color" description="Primary font color." />
                                    <ColorField name="landingPage.cardBackgroundColor" label="Card Background" description="Service listing card surface." />
                                    <ColorField name="landingPage.cardBorderColor" label="Card Border" description="Outline around service cards." />
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            ) : (
                <div className="p-8 text-center border-2 border-dashed rounded-lg bg-muted/30">
                    <p className="text-muted-foreground text-sm">Enable your landing page to start sharing your custom practice URL with clients.</p>
                </div>
            )}
        </div>

        <Separator />

        <div className="space-y-4">
            <h3 className="text-lg font-medium flex items-center gap-2">
                <BrainCircuit className="h-5 w-5 text-primary" />
                AI Configuration
            </h3>
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
            <h3 className="text-lg font-medium">Physical Address (Optional)</h3>
            <FormField control={form.control} name="address.street" render={({ field }) => ( <FormItem><FormLabel>Street Address</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField control={form.control} name="address.city" render={({ field }) => ( <FormItem><FormLabel>City</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="address.province" render={({ field }) => ( <FormItem><FormLabel>Province</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="address.zip" render={({ field }) => ( <FormItem><FormLabel>Postal Code</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
            </div>
        </div>

        <Separator />

        <div className="space-y-4">
            <h3 className="text-lg font-medium">Banking Details (Optional)</h3>
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
