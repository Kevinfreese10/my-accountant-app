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
import { Loader2, BrainCircuit, Globe, Layout, Palette, ExternalLink, Sparkles } from 'lucide-react';
import { useState, useEffect } from 'react';
import { getFirestore, doc, updateDoc } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { Switch } from '../ui/switch';
import { Textarea } from '../ui/textarea';
import Link from 'next/link';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';

const db = getFirestore(firebaseApp);

const formSchema = z.object({
  companyName: z.string().min(2, 'Company name is required.'),
  name: z.string().min(2, 'Contact name is required.'),
  surname: z.string().min(2, 'Contact surname is required.'),
  email: z.string().email('Please enter a valid email.'),
  contactNumber: z.string().min(10, 'A valid contact number is required.'),
  geminiApiKey: z.string().optional(),
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
    primaryColor: z.string().regex(/^#[0-9A-F]{6}$/i, "Must be a valid hex color (e.g., #214392)"),
    secondaryColor: z.string().regex(/^#[0-9A-F]{6}$/i, "Must be a valid hex color").optional(),
    backgroundColor: z.string().regex(/^#[0-9A-F]{6}$/i, "Must be a valid hex color").optional(),
    textColor: z.string().regex(/^#[0-9A-F]{6}$/i, "Must be a valid hex color").optional(),
    cardBackgroundColor: z.string().regex(/^#[0-9A-F]{6}$/i, "Must be a valid hex color").optional(),
    cardBorderColor: z.string().regex(/^#[0-9A-F]{6}$/i, "Must be a valid hex color").optional(),
    logoUrl: z.string().url().optional().or(z.literal('')),
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
        primaryColor: '#a855f7',
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
        logoUrl: user?.landingPage?.logoUrl || '',
      }
    },
  });

  const { setValue, watch } = form;
  const themePreset = watch('landingPage.themePreset');

  // Logic to update color fields when theme preset changes
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

  // If any color field is changed manually while on a preset, switch to 'custom'
  const handleColorChange = (field: any, value: string) => {
      field.onChange(value);
      if (themePreset !== 'custom') {
          setValue('landingPage.themePreset', 'custom');
      }
  };

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
            landingPage: values.landingPage,
        };

        await updateDoc(userRef, updateData);
        updateUser({ ...user, ...updateData });
        
        toast({
            title: 'Profile Updated!',
            description: `Your company details and landing page settings have been saved.`,
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

  const landingPageEnabled = watch('landingPage.enabled');
  const landingPageSlug = watch('landingPage.slug');

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
                                    <Layout className="h-4 w-4" /> Content
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
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
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle className="text-sm flex items-center gap-2">
                                    <Palette className="h-4 w-4" /> Branding & Theme
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <FormField
                                    control={form.control}
                                    name="landingPage.themePreset"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-xs">Theme Preset</FormLabel>
                                            <Select onValueChange={field.onChange} value={field.value}>
                                                <FormControl><SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger></FormControl>
                                                <SelectContent>
                                                    <SelectItem value="custom">Custom</SelectItem>
                                                    <SelectItem value="my_accountant">My Accountant (Master)</SelectItem>
                                                    <SelectItem value="futuristic">Modern Midnight (Dark)</SelectItem>
                                                    <SelectItem value="tech_blue">Tech Professional (Light)</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </FormItem>
                                    )}
                                />
                                <Separator className="my-2" />
                                <div className="grid grid-cols-2 gap-4">
                                    <FormField
                                        control={form.control}
                                        name="landingPage.primaryColor"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel className="text-xs">Primary</FormLabel>
                                                <div className="flex gap-2">
                                                    <FormControl>
                                                        <Input 
                                                            {...field} 
                                                            className="h-8 text-xs" 
                                                            onChange={(e) => handleColorChange(field, e.target.value)}
                                                        />
                                                    </FormControl>
                                                    <div className="w-8 h-8 rounded border flex-shrink-0" style={{ backgroundColor: field.value }} />
                                                </div>
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="landingPage.secondaryColor"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel className="text-xs">Secondary</FormLabel>
                                                <div className="flex gap-2">
                                                    <FormControl>
                                                        <Input 
                                                            {...field} 
                                                            className="h-8 text-xs" 
                                                            onChange={(e) => handleColorChange(field, e.target.value)}
                                                        />
                                                    </FormControl>
                                                    <div className="w-8 h-8 rounded border flex-shrink-0" style={{ backgroundColor: field.value }} />
                                                </div>
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="landingPage.backgroundColor"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel className="text-xs">Page BG</FormLabel>
                                                <div className="flex gap-2">
                                                    <FormControl>
                                                        <Input 
                                                            {...field} 
                                                            className="h-8 text-xs" 
                                                            onChange={(e) => handleColorChange(field, e.target.value)}
                                                        />
                                                    </FormControl>
                                                    <div className="w-8 h-8 rounded border flex-shrink-0" style={{ backgroundColor: field.value }} />
                                                </div>
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="landingPage.textColor"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel className="text-xs">Text Color</FormLabel>
                                                <div className="flex gap-2">
                                                    <FormControl>
                                                        <Input 
                                                            {...field} 
                                                            className="h-8 text-xs" 
                                                            onChange={(e) => handleColorChange(field, e.target.value)}
                                                        />
                                                    </FormControl>
                                                    <div className="w-8 h-8 rounded border flex-shrink-0" style={{ backgroundColor: field.value }} />
                                                </div>
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="landingPage.cardBackgroundColor"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel className="text-xs">Card BG</FormLabel>
                                                <div className="flex gap-2">
                                                    <FormControl>
                                                        <Input 
                                                            {...field} 
                                                            className="h-8 text-xs" 
                                                            onChange={(e) => handleColorChange(field, e.target.value)}
                                                        />
                                                    </FormControl>
                                                    <div className="w-8 h-8 rounded border flex-shrink-0" style={{ backgroundColor: field.value }} />
                                                </div>
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="landingPage.cardBorderColor"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel className="text-xs">Card Border</FormLabel>
                                                <div className="flex gap-2">
                                                    <FormControl>
                                                        <Input 
                                                            {...field} 
                                                            className="h-8 text-xs" 
                                                            onChange={(e) => handleColorChange(field, e.target.value)}
                                                        />
                                                    </FormControl>
                                                    <div className="w-8 h-8 rounded border flex-shrink-0" style={{ backgroundColor: field.value }} />
                                                </div>
                                            </FormItem>
                                        )}
                                    />
                                </div>
                                <FormField
                                    control={form.control}
                                    name="landingPage.logoUrl"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-xs">Custom Logo URL</FormLabel>
                                            <FormControl><Input {...field} placeholder="https://..." /></FormControl>
                                            <FormDescription className="text-[10px]">Link to your company logo (PNG/SVG recommended).</FormDescription>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
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
