'use client';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Separator } from '../ui/separator';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { 
  Loader2, 
  Globe, 
  Layout, 
  Palette, 
  ExternalLink as ExternalLinkIcon, 
  Upload, 
  Image as ImageIcon, 
  CheckCircle2, 
  Circle, 
  PartyPopper, 
  MapPin, 
  Building,
  Gavel,
  Settings,
  MousePointer2
} from 'lucide-react';
import { useState, useEffect, useMemo } from 'react';
import { getFirestore, doc, updateDoc, collection, getDocs, onSnapshot } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { firebaseApp } from '@/lib/firebase';
import { Switch } from '../ui/switch';
import { Textarea } from '../ui/textarea';
import Link from 'next/link';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { Slider } from '../ui/slider';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';

const db = getFirestore(firebaseApp);
const storage = getStorage(firebaseApp);

const RESERVED_SLUGS = ['admin', 'login', 'signup', 'api', 'dashboard', 'partner', 'p', 'products', 'blog', 'about', 'contact', 'compliance', 'terms', 'popia', 'refund-policy', 'support'];

const formSchema = z.object({
  companyName: z.string().min(2, 'Company name is required.'),
  name: z.string().min(2, 'Contact name is required.'),
  surname: z.string().min(2, 'Contact surname is required.'),
  email: z.string().email('Please enter a valid email.'),
  contactNumber: z.string().min(10, 'A valid contact number is required.'),
  address: z.object({
      street: z.string().optional(),
      suburb: z.string().optional(),
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
    slug: z.string()
        .min(3, "Slug must be at least 3 characters")
        .regex(/^[a-z0-9-]+$/, "Slug can only contain lowercase letters, numbers, and hyphens")
        .refine(val => !RESERVED_SLUGS.includes(val), { message: "This slug is reserved for system use." }),
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
    buttonColor: z.string().regex(/^#[0-9A-F]{6}$/i, "Must be a valid hex color").optional(),
    buttonTextColor: z.string().regex(/^#[0-9A-F]{6}$/i, "Must be a valid hex color").optional(),
    buttonStyle: z.enum(['solid', 'outline']).default('solid'),
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
    showServicesHero: z.boolean().default(true),
    servicesHeroImageUrl: z.string().url().optional().or(z.literal('')),
    servicesHeroOverlayOpacity: z.preprocess(val => Number(val) || 0, z.number().min(0).max(100)),
    servicesHeroLayout: z.enum(['centered', 'split-left', 'split-right', 'background']).default('centered'),
    servicesHeroTitle: z.string().optional(),
    servicesHeroSubtitle: z.string().optional(),
    servicesHeroTextPosition: z.enum(['inside', 'below']).default('inside'),
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
        buttonColor: '#214392',
        buttonTextColor: '#ffffff',
        buttonStyle: 'solid',
    },
    futuristic: {
        primaryColor: '#8b5cf6',
        secondaryColor: '#1e1b4b',
        backgroundColor: '#020617',
        textColor: '#ffffff',
        cardBackgroundColor: '#0f172a',
        cardBorderColor: '#1e293b',
        buttonColor: '#8b5cf6',
        buttonTextColor: '#ffffff',
        buttonStyle: 'solid',
    },
    tech_blue: {
        primaryColor: '#0ea5e9',
        secondaryColor: '#f0f9ff',
        backgroundColor: '#f8fafc',
        textColor: '#0f172a',
        cardBackgroundColor: '#ffffff',
        cardBorderColor: '#e2e8f0',
        buttonColor: '#0ea5e9',
        buttonTextColor: '#ffffff',
        buttonStyle: 'solid',
    }
};

const QUICK_COLORS = [
    '#214392', '#0ea5e9', '#4f46e5', '#8b5cf6', '#d946ef', '#e11d48', '#f43f5e', '#f97316', '#d97706', '#059669', '#10b981', '#1e293b', '#0f172a', '#ffffff', '#f3f4f6', '#e5e7eb', '#000000',
];

export default function PartnerProfile() {
  const { user, updateUser } = useAuth();
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [isUploadingHero, setIsUploadingHero] = useState(false);
  const [isUploadingServicesHero, setIsUploadingServicesHero] = useState(false);
  const [overrideCount, setOverrideCount] = useState(0);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      companyName: user?.companyName || '',
      name: user?.name?.split(' ')[0] || user?.contactPerson?.split(' ')[0] || '',
      surname: user?.name?.split(' ').slice(1).join(' ') || user?.contactPerson?.split(' ').slice(1).join(' ') || '',
      email: user?.email || '',
      contactNumber: user?.contactNumber || '',
      address: { 
          street: user?.address?.street || '', 
          suburb: user?.address?.suburb || '', 
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
        buttonColor: user?.landingPage?.buttonColor || '#214392',
        buttonTextColor: user?.landingPage?.buttonTextColor || '#ffffff',
        buttonStyle: user?.landingPage?.buttonStyle || 'solid',
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
        showServicesHero: user?.landingPage?.showServicesHero !== undefined ? user?.landingPage?.showServicesHero : true,
        servicesHeroImageUrl: user?.landingPage?.servicesHeroImageUrl || '',
        servicesHeroOverlayOpacity: user?.landingPage?.servicesHeroOverlayOpacity || 0,
        servicesHeroLayout: user?.landingPage?.servicesHeroLayout || 'centered',
        servicesHeroTitle: user?.landingPage?.servicesHeroTitle || 'Accounting & Tax Solutions',
        servicesHeroSubtitle: user?.landingPage?.servicesHeroSubtitle || 'Comprehensive professional services for individuals and SMEs.',
        servicesHeroTextPosition: user?.landingPage?.servicesHeroTextPosition || 'inside',
      }
    },
  });

  const { setValue, watch } = form;
  const watchedBanking = watch('bankingDetails');
  const watchedLp = watch('landingPage');
  const themePreset = watch('landingPage.themePreset');

  useEffect(() => {
      const pId = user?.role === 'partner' ? user.uid : user?.partnerId;
      if (!pId) return;
      
      // REAL-TIME LISTENER FOR OVERRIDES
      const overridesRef = collection(db, 'users', pId, 'serviceOverrides');
      const unsubscribe = onSnapshot(overridesRef, (snap) => {
          setOverrideCount(snap.size);
      });
      return () => unsubscribe();
  }, [user]);

  const checklist = useMemo(() => {
      return [
          { label: 'Update Pricing', done: overrideCount > 0, description: 'Set your markups in the Services tab.' },
          { label: 'Update Banking Details', done: !!(watchedBanking?.bankName && watchedBanking?.accountNumber), description: 'Required for client EFT payments.' },
          { label: 'Edit Landing Content & Images', done: !!(watchedLp.heroImageUrl && watchedLp.aboutUs && watchedLp.aboutUs.length > 50), description: 'Customize your public practice website.' },
          { 
              label: 'Branding & Theme', 
              done: !!watchedLp.themePreset && (watchedLp.themePreset !== 'custom' || (watchedLp.primaryColor && watchedLp.primaryColor !== '#214392')), 
              description: 'Apply your custom colors and styling.' 
          },
      ];
  }, [watchedBanking, watchedLp, overrideCount]);

  const progressPercentage = useMemo(() => {
      const completed = checklist.filter(i => i.done).length;
      const total = checklist.length;
      if (total === 0) return 0;
      return Math.round((completed / total) * 100);
  }, [checklist]);

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
          
          if (type === 'logo') setValue('landingPage.logoUrl', url, { shouldDirty: true });
          else if (type === 'hero') setValue('landingPage.heroImageUrl', url, { shouldDirty: true });
          else setValue('landingPage.servicesHeroImageUrl', url, { shouldDirty: true });
          toast({ title: 'Upload Successful' });
      } catch (e) {
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
            address: values.address,
            bankingDetails: values.bankingDetails,
            name: `${values.name} ${values.surname}`,
            landingPage: values.landingPage,
        };
        await updateDoc(userRef, updateData);
        updateUser({ ...user, ...updateData });
        toast({ title: 'Profile Updated!' });
    } catch (error) {
        console.error("Profile update failed:", error);
        toast({ title: 'Update Failed', description: "There was a problem saving your profile settings.", variant: 'destructive' });
    } finally {
        setIsSaving(false);
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
                <div className="flex justify-between items-center">
                    <FormLabel className="text-xs font-bold uppercase text-muted-foreground">{label}</FormLabel>
                    {description && <p className="text-[10px] text-muted-foreground">{description}</p>}
                </div>
                <div className="flex flex-col gap-3">
                    <div className="flex items-center gap-2">
                        <FormControl>
                            <div className="flex items-center gap-2 border rounded-md px-2 py-1 flex-grow bg-background shadow-sm">
                                <input type="color" value={field.value || '#ffffff'} onChange={(e) => { field.onChange(e.target.value); setValue('landingPage.themePreset', 'custom'); }} className="w-6 h-6 rounded-sm cursor-pointer border-0 bg-transparent p-0" />
                                <Input {...field} className="border-0 h-7 text-xs font-mono uppercase focus-visible:ring-0 focus-visible:ring-offset-0 px-1" onChange={(e) => { field.onChange(e.target.value); setValue('landingPage.themePreset', 'custom'); }} />
                            </div>
                        </FormControl>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                        {QUICK_COLORS.map((color) => (
                            <button key={color} type="button" onClick={() => { field.onChange(color); setValue('landingPage.themePreset', 'custom'); }} className={cn("w-5 h-5 rounded-full border border-muted-foreground/20 transition-all hover:scale-125", field.value === color && "ring-2 ring-primary ring-offset-1 scale-110")} style={{ backgroundColor: color }} title={color} />
                        ))}
                    </div>
                </div>
                <FormMessage />
            </FormItem>
        )}
    />
  );

  return (
    <div className="max-w-4xl mx-auto space-y-10">
        <Card className="border-2 border-primary/20 shadow-lg overflow-hidden">
            <CardHeader className="bg-primary/5 pb-4">
                <div className="flex justify-between items-center">
                    <CardTitle className="text-lg flex items-center gap-2"><CheckCircle2 className="h-5 w-5 text-primary" /> Practice Setup Progress</CardTitle>
                    <Badge variant={progressPercentage === 100 ? "success" : "secondary"} className="font-bold">
                        {progressPercentage === 100 && <PartyPopper className="h-3 w-3 mr-1" />}
                        {progressPercentage}% Complete
                    </Badge>
                </div>
                <Progress value={progressPercentage} className="h-2.5 mt-4" />
            </CardHeader>
            <CardContent className="pt-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {checklist.map((item, idx) => (
                        <div key={idx} className={cn("p-3 rounded-lg border flex flex-col gap-1 transition-all", item.done ? "bg-green-50/50 border-green-200" : "bg-muted/30 border-muted opacity-70")}>
                            <div className="flex items-center gap-2">
                                {item.done ? <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" /> : <Circle className="h-4 w-4 text-muted-foreground shrink-0" />}
                                <span className={cn("text-xs font-bold truncate", item.done ? "text-green-800" : "text-slate-600")}>{item.label}</span>
                            </div>
                            <p className="text-[9px] text-muted-foreground leading-tight italic ml-6">{item.description}</p>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>

        <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            <div className="space-y-6">
                <h3 className="text-xl font-bold flex items-center gap-2">
                    <Building className="h-5 w-5 text-primary" />
                    Company Details
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                    <FormField control={form.control} name="companyName" render={({ field }) => ( <FormItem><FormLabel>Company Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="contactNumber" render={({ field }) => ( <FormItem><FormLabel>Contact Number</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="name" render={({ field }) => ( <FormItem><FormLabel>Contact Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="surname" render={({ field }) => ( <FormItem><FormLabel>Contact Surname</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                    <div className="md:col-span-2">
                        <FormField control={form.control} name="email" render={({ field }) => ( <FormItem><FormLabel>Login Email Address</FormLabel><FormControl><Input {...field} readOnly disabled className="bg-muted/50" /></FormControl><FormMessage /></FormItem>)} />
                    </div>
                </div>

                <div className="pt-4 space-y-4">
                    <div className="flex items-center gap-2 text-sm font-bold text-muted-foreground uppercase tracking-wider">
                        <MapPin className="h-4 w-4" /> Physical Address
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField control={form.control} name="address.street" render={({ field }) => ( <FormItem className="md:col-span-2"><FormLabel className="text-xs">Street Address</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                        <FormField control={form.control} name="address.suburb" render={({ field }) => ( <FormItem><FormLabel className="text-xs">Suburb</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>)} />
                        <FormField control={form.control} name="address.city" render={({ field }) => ( <FormItem><FormLabel className="text-xs">City</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>)} />
                        <FormField control={form.control} name="address.province" render={({ field }) => ( <FormItem><FormLabel className="text-xs">Province</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>)} />
                        <FormField control={form.control} name="address.zip" render={({ field }) => ( <FormItem><FormLabel className="text-xs">ZIP / Postal Code</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>)} />
                    </div>
                </div>
            </div>

            <Separator />

            <div className="space-y-6">
                <h3 className="text-xl font-bold flex items-center gap-2">
                    <ImageIcon className="h-5 w-5 text-primary" />
                    Banking Details (For Client EFTs)
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                     <FormField control={form.control} name="bankingDetails.bankName" render={({ field }) => ( <FormItem><FormLabel>Bank Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                     <FormField control={form.control} name="bankingDetails.accountNumber" render={({ field }) => ( <FormItem><FormLabel>Account Number</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                     <FormField control={form.control} name="bankingDetails.accountHolder" render={({ field }) => ( <FormItem><FormLabel>Account Holder</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                     <FormField control={form.control} name="bankingDetails.branchCode" render={({ field }) => ( <FormItem><FormLabel>Branch Code</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                </div>
            </div>

            <Separator />

            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <h3 className="text-xl font-bold flex items-center gap-2"><Globe className="h-5 w-5 text-primary" /> White-Label Landing Page</h3>
                    <FormField control={form.control} name="landingPage.enabled" render={({ field }) => ( <FormItem className="flex items-center space-x-2 space-y-0"><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl><FormLabel className="text-xs uppercase font-bold text-muted-foreground">Enabled</FormLabel></FormItem> )} />
                </div>

                {landingPageEnabled && (
                    <div className="grid grid-cols-1 gap-6 animate-in fade-in zoom-in-95 duration-300">
                        <Card className="border-primary/20">
                            <CardHeader className="pb-3"><CardTitle className="text-sm">Public Link</CardTitle></CardHeader>
                            <CardContent>
                                <div className="flex items-center gap-2">
                                    <div className="bg-muted px-3 py-2 rounded-md font-mono text-sm flex-grow">/p/{landingPageSlug || 'your-slug'}</div>
                                    {landingPageSlug && <Button variant="outline" size="sm" asChild><Link href={`/p/${landingPageSlug}`} target="_blank"><ExternalLinkIcon className="h-4 w-4 mr-2"/>Visit Page</Link></Button>}
                                </div>
                                <FormField control={form.control} name="landingPage.slug" render={({ field }) => ( 
                                    <FormItem className="mt-4">
                                        <FormLabel className="text-xs">Custom Slug</FormLabel>
                                        <FormControl><Input {...field} /></FormControl>
                                        <FormDescription className="text-[10px]">
                                            Must be unique, lowercase, no spaces. Avoid reserved keywords like 'admin', 'api', or 'login'.
                                        </FormDescription>
                                        <FormMessage />
                                    </FormItem> 
                                )} />
                            </CardContent>
                        </Card>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <Card className="border-2">
                                <CardHeader className="bg-muted/30"><CardTitle className="text-sm flex items-center gap-2"><Layout className="h-4 w-4" /> Content & Images</CardTitle></CardHeader>
                                <CardContent className="space-y-6 pt-6">
                                    <FormField control={form.control} name="landingPage.heroTitle" render={({ field }) => ( <FormItem><FormLabel className="text-xs">Hero Title</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                                    <ColorField name="landingPage.heroTitleColor" label="Hero Title Color" />
                                    <Separator />
                                    <FormField control={form.control} name="landingPage.heroSubtitle" render={({ field }) => ( <FormItem><FormLabel className="text-xs">Hero Subtitle</FormLabel><FormControl><Textarea {...field} rows={2} /></FormControl><FormMessage /></FormItem> )} />
                                    <ColorField name="landingPage.heroSubtitleColor" label="Hero Subtitle Color" />
                                    
                                    <Separator />
                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between">
                                            <FormLabel className="text-xs font-bold uppercase text-muted-foreground">Hero Section Image</FormLabel>
                                            <Button variant="outline" size="xs" className="h-7" asChild disabled={isUploadingHero}><label className="cursor-pointer">{isUploadingHero ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3 mr-1" />}Upload<input type="file" className="hidden" accept="image/*" onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0], 'hero')} /></label></Button>
                                        </div>
                                        <FormField control={form.control} name="landingPage.heroImageUrl" render={({ field }) => ( <FormItem><FormControl><Input {...field} className="text-xs h-8" /></FormControl><FormMessage /></FormItem> )} />
                                        <div className="space-y-2">
                                            <div className="flex justify-between items-center text-[10px] font-bold uppercase text-muted-foreground">
                                                <span>Hero Overlay Opacity</span>
                                                <span>{watch('landingPage.heroOverlayOpacity')}%</span>
                                            </div>
                                            <Slider 
                                                value={[watch('landingPage.heroOverlayOpacity')]} 
                                                onValueChange={(val) => setValue('landingPage.heroOverlayOpacity', val[0], { shouldDirty: true })} 
                                                max={100} 
                                                step={1} 
                                            />
                                        </div>
                                        
                                        <div className="grid grid-cols-2 gap-4 pt-2">
                                            <FormField control={form.control} name="landingPage.heroTextPosition" render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel className="text-[10px] font-bold uppercase text-muted-foreground">Text Position</FormLabel>
                                                    <Select onValueChange={field.onChange} value={field.value}>
                                                        <FormControl><SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger></FormControl>
                                                        <SelectContent>
                                                            <SelectItem value="inside">Inside Image (Overlay)</SelectItem>
                                                            <SelectItem value="below">Below Image</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </FormItem>
                                            )} />
                                            <FormField control={form.control} name="landingPage.heroLayout" render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel className="text-[10px] font-bold uppercase text-muted-foreground">Layout Alignment</FormLabel>
                                                    <Select onValueChange={field.onChange} value={field.value}>
                                                        <FormControl><SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger></FormControl>
                                                        <SelectContent>
                                                            <SelectItem value="centered">Centered</SelectItem>
                                                            <SelectItem value="split-left">Split Left</SelectItem>
                                                            <SelectItem value="split-right">Split Right</SelectItem>
                                                            <SelectItem value="background">Background Only</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </FormItem>
                                            )} />
                                        </div>
                                    </div>

                                    <Separator />
                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between">
                                            <FormLabel className="text-xs font-bold uppercase text-muted-foreground">Practice Logo</FormLabel>
                                            <Button variant="outline" size="xs" className="h-7" asChild disabled={isUploadingLogo}><label className="cursor-pointer">{isUploadingLogo ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3 mr-1" />}Upload<input type="file" className="hidden" accept="image/*" onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0], 'logo')} /></label></Button>
                                        </div>
                                        <FormField control={form.control} name="landingPage.logoUrl" render={({ field }) => ( <FormItem><FormControl><Input {...field} className="text-xs h-8" /></FormControl><FormMessage /></FormItem> )} />
                                        <div className="space-y-2">
                                            <div className="flex justify-between items-center text-[10px] font-bold uppercase text-muted-foreground">
                                                <span>Logo Height</span>
                                                <span>{watch('landingPage.logoHeight')}px</span>
                                            </div>
                                            <Slider 
                                                value={[watch('landingPage.logoHeight')]} 
                                                onValueChange={(val) => setValue('landingPage.logoHeight', val[0], { shouldDirty: true })} 
                                                min={20}
                                                max={120} 
                                                step={1} 
                                            />
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <FormField control={form.control} name="landingPage.showLogo" render={({ field }) => ( <FormItem className="flex items-center space-x-2 space-y-0"><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl><FormLabel className="text-[10px] font-bold text-muted-foreground uppercase">Show Logo</FormLabel></FormItem> )} />
                                            <FormField control={form.control} name="landingPage.hideHeaderBranding" render={({ field }) => ( <FormItem className="flex items-center space-x-2 space-y-0"><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl><FormLabel className="text-[10px] font-bold text-muted-foreground uppercase">Hide Title</FormLabel></FormItem> )} />
                                        </div>
                                    </div>
                                    <Separator />
                                    <FormField control={form.control} name="landingPage.aboutUs" render={({ field }) => ( <FormItem><FormLabel className="text-xs">About Us Paragraph</FormLabel><FormControl><Textarea {...field} rows={4} /></FormControl><FormMessage /></FormItem> )} />
                                </CardContent>
                            </Card>

                            <Card className="border-2">
                                <CardHeader className="bg-muted/30"><CardTitle className="text-sm flex items-center gap-2"><Palette className="h-4 w-4" /> Branding & Theme</CardTitle></CardHeader>
                                <CardContent className="space-y-6 pt-6">
                                    <FormField control={form.control} name="landingPage.themePreset" render={({ field }) => ( <FormItem><FormLabel className="text-xs">Theme Preset</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select a theme..." /></SelectTrigger></FormControl><SelectContent><SelectItem value="custom">Custom</SelectItem><SelectItem value="my_accountant">Master</SelectItem><SelectItem value="tech_blue">Light</SelectItem><SelectItem value="futuristic">Dark</SelectItem></SelectContent></Select><FormMessage /></FormItem> )} />
                                    <Separator className="my-2" />
                                    <div className="grid grid-cols-1 gap-6">
                                        <ColorField name="landingPage.primaryColor" label="Primary Brand Color" description="Used for icons and highlights." />
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                                            <ColorField name="landingPage.cardBackgroundColor" label="Card Background" />
                                            <ColorField name="landingPage.cardBorderColor" label="Card Border" />
                                        </div>
                                        <Separator className="my-2" />
                                        <div className="space-y-4">
                                            <div className="flex items-center gap-2 text-xs font-bold uppercase text-muted-foreground tracking-widest">
                                                <MousePointer2 className="h-3 w-3" /> Button Branding
                                            </div>
                                            <FormField
                                                control={form.control}
                                                name="landingPage.buttonStyle"
                                                render={({ field }) => (
                                                    <FormItem className="space-y-3">
                                                        <FormLabel className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Style Type</FormLabel>
                                                        <FormControl>
                                                            <RadioGroup
                                                                onValueChange={field.onChange}
                                                                defaultValue={field.value}
                                                                className="flex gap-4"
                                                            >
                                                                <div className="flex items-center space-x-2">
                                                                    <RadioGroupItem value="solid" id="r-solid" />
                                                                    <Label htmlFor="r-solid" className="text-xs font-bold cursor-pointer">Solid Fill</Label>
                                                                </div>
                                                                <div className="flex items-center space-x-2">
                                                                    <RadioGroupItem value="outline" id="r-outline" />
                                                                    <Label htmlFor="r-outline" className="text-xs font-bold cursor-pointer">Outline</Label>
                                                                </div>
                                                            </RadioGroup>
                                                        </FormControl>
                                                    </FormItem>
                                                )}
                                            />
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                <ColorField name="landingPage.buttonColor" label="Button Color" description="Fill or border color." />
                                                <ColorField name="landingPage.buttonTextColor" label="Button Text" />
                                            </div>
                                        </div>
                                        <Separator className="my-2" />
                                        <ColorField name="landingPage.backgroundColor" label="Page Background" />
                                        <ColorField name="landingPage.textColor" label="Default Text Color" />
                                    </div>
                                    <Separator />
                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between">
                                            <FormLabel className="text-xs font-bold uppercase text-muted-foreground">Services Section Hero Image</FormLabel>
                                            <Button variant="outline" size="xs" className="h-7" asChild disabled={isUploadingServicesHero}><label className="cursor-pointer">{isUploadingServicesHero ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3 mr-1" />}Upload<input type="file" className="hidden" accept="image/*" onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0], 'servicesHero')} /></label></Button>
                                        </div>
                                        <FormField control={form.control} name="landingPage.servicesHeroImageUrl" render={({ field }) => ( <FormItem><FormControl><Input {...field} className="text-xs h-8" /></FormControl><FormMessage /></FormItem> )} />
                                        <div className="space-y-2">
                                            <div className="flex justify-between items-center text-[10px] font-bold uppercase text-muted-foreground">
                                                <span>Services Hero Opacity</span>
                                                <span>{watch('landingPage.servicesHeroOverlayOpacity')}%</span>
                                            </div>
                                            <Slider 
                                                value={[watch('landingPage.servicesHeroOverlayOpacity')]} 
                                                onValueChange={(val) => setValue('landingPage.servicesHeroOverlayOpacity', val[0], { shouldDirty: true })} 
                                                max={100} 
                                                step={1} 
                                            />
                                        </div>
                                        
                                        <div className="space-y-4 pt-4 border-t border-dashed">
                                            <FormField control={form.control} name="landingPage.servicesHeroTitle" render={({ field }) => ( <FormItem><FormLabel className="text-xs">Services Title</FormLabel><FormControl><Input {...field} placeholder="e.g. Accounting & Tax Solutions" /></FormControl><FormMessage /></FormItem> )} />
                                            <FormField control={form.control} name="landingPage.servicesHeroSubtitle" render={({ field }) => ( <FormItem><FormLabel className="text-xs">Services Subtitle</FormLabel><FormControl><Textarea {...field} rows={2} placeholder="e.g. Comprehensive professional services for individuals and SMEs." /></FormControl><FormMessage /></FormItem> )} />
                                            <div className="grid grid-cols-2 gap-4">
                                                <FormField control={form.control} name="landingPage.servicesHeroTextPosition" render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel className="text-[10px] font-bold uppercase text-muted-foreground">Text Position</FormLabel>
                                                        <Select onValueChange={field.onChange} value={field.value}>
                                                            <FormControl><SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger></FormControl>
                                                            <SelectContent>
                                                                <SelectItem value="inside">Inside Image (Overlay)</SelectItem>
                                                                <SelectItem value="below">Below Image</SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                    </FormItem>
                                                )} />
                                                <FormField control={form.control} name="landingPage.servicesHeroLayout" render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel className="text-[10px] font-bold uppercase text-muted-foreground">Layout Alignment</FormLabel>
                                                        <Select onValueChange={field.onChange} value={field.value}>
                                                            <FormControl><SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger></FormControl>
                                                            <SelectContent>
                                                                <SelectItem value="centered">Centered</SelectItem>
                                                                <SelectItem value="split-left">Split Left</SelectItem>
                                                                <SelectItem value="split-right">Split Right</SelectItem>
                                                                <SelectItem value="background">Background Only</SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                    </FormItem>
                                                )} />
                                            </div>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>

                        <Card className="border-2">
                            <CardHeader className="bg-muted/30">
                                <CardTitle className="text-sm flex items-center gap-2"><Gavel className="h-4 w-4" /> Legal & Policies</CardTitle>
                                <CardDescription className="text-[10px]">Provide custom policy text for your white-label practice landing page.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-6 pt-6">
                                <FormField control={form.control} name="landingPage.refundPolicy" render={({ field }) => ( <FormItem><FormLabel className="text-xs">Refund Policy</FormLabel><FormControl><Textarea {...field} rows={4} placeholder="Detail your practice's refund conditions..." /></FormControl><FormMessage /></FormItem> )} />
                                <FormField control={form.control} name="landingPage.popiaPolicy" render={({ field }) => ( <FormItem><FormLabel className="text-xs">POPIA Compliance Policy</FormLabel><FormControl><Textarea {...field} rows={4} placeholder="Outline your data protection procedures..." /></FormControl><FormMessage /></FormItem> )} />
                                <FormField control={form.control} name="landingPage.termsAndConditions" render={({ field }) => ( <FormItem><FormLabel className="text-xs">Terms & Conditions</FormLabel><FormControl><Textarea {...field} rows={4} placeholder="General terms of service for your practice..." /></FormControl><FormMessage /></FormItem> )} />
                            </CardContent>
                        </Card>
                    </div>
                )}
            </div>

            <Separator />
            <Button type="submit" disabled={isSaving} className="w-full h-14 text-lg font-black shadow-xl">
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save All Practice Settings
            </Button>
        </form>
        </Form>
    </div>
  );
}
