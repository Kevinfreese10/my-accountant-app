'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { Loader2, FileText, Sparkles, AlertTriangle, CheckCircle2, ArrowRight, Download, Mail, Info } from 'lucide-react';
import { checkCV, CVAnalysisOutput } from '@/ai/flows/check-cv-flow';
import { Progress } from '@/components/ui/progress';
import { saveCvLead } from '@/app/actions';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { getFirestore, collection, getDocs, query, where } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import TrustIndexWidget from '@/components/shared/TrustIndexWidget';
import Link from 'next/link';
import { Service } from '@/lib/types';

const storage = getStorage(firebaseApp);
const db = getFirestore(firebaseApp);

const formSchema = z.object({
  cvFile: z.custom<FileList>().refine((files) => files && files.length > 0, 'A CV file is required (PDF).'),
  targetRole: z.string().min(2, 'Please enter a target role.'),
  jobDescription: z.string().optional(),
  email: z.string().email('Please enter a valid email.').optional().or(z.literal('')),
  consentStorage: z.boolean().default(false),
});

export default function CVCheckerPage() {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<CVAnalysisOutput | null>(null);
  const [relatedServices, setRelatedServices] = useState<Service[]>([]);
  const { toast } = useToast();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      targetRole: '',
      jobDescription: '',
      email: '',
      consentStorage: false,
    },
  });

  useEffect(() => {
    const fetchRelated = async () => {
        try {
            const q = query(
                collection(db, 'services'),
                where('title', 'in', [
                    'Individual Income Tax Return (ITR12) Simple',
                    'Complex Individual Income Tax Return (ITR12) Filing',
                    'Income Tax Return for Sole Proprietors (ITR12)'
                ])
            );
            const snap = await getDocs(q);
            setRelatedServices(snap.docs.map(d => ({ id: d.id, ...d.data() } as Service)));
        } catch (e) {
            console.error("Failed to fetch related products:", e);
        }
    };
    fetchRelated();
  }, []);

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    const file = values.cvFile[0];
    if (!file) return;

    setIsAnalyzing(true);
    setResult(null);
    toast({ title: 'AI Analysis Started', description: 'Reading your CV and matching against benchmarks...' });

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = async () => {
      const dataUrl = reader.result as string;
      try {
        const analysis = await checkCV({
          cvBase64: dataUrl,
          targetRole: values.targetRole,
          jobDescription: values.jobDescription,
        });

        setResult(analysis);

        // Lead capture logic
        if (values.email || values.consentStorage) {
          let cvUrl = '';
          if (values.consentStorage) {
            const fileRef = ref(storage, `cv-leads/${Date.now()}-${file.name}`);
            await uploadBytes(fileRef, file);
            cvUrl = await getDownloadURL(fileRef);
          }

          await saveCvLead({
            email: values.email,
            role: values.targetRole,
            score: analysis.scores.overallScore,
            analysis: analysis,
            cvUrl: cvUrl || undefined,
          });
        }

        toast({ title: 'Analysis Complete!', description: 'Your CV has been scored and improved.' });
      } catch (error) {
        console.error('CV Check error:', error);
        toast({ title: 'AI Error', description: 'Failed to analyze your CV. Please try a different file.', variant: 'destructive' });
      } finally {
        setIsAnalyzing(false);
      }
    };
  };

  const ScoreCard = ({ label, score, rationale }: { label: string, score: number, rationale: string }) => (
    <div className="space-y-2">
      <div className="flex justify-between items-center">
        <span className="text-sm font-bold uppercase tracking-wider text-muted-foreground">{label}</span>
        <Badge variant={score > 70 ? 'success' : score > 40 ? 'warning' : 'destructive'} className="font-mono">
          {score}/100
        </Badge>
      </div>
      <Progress value={score} className="h-2" />
      <p className="text-xs text-muted-foreground leading-relaxed italic">{rationale}</p>
    </div>
  );

  return (
    <div className="container mx-auto px-4 py-12 max-w-5xl space-y-12">
      <section className="text-center space-y-4">
        <h1 className="text-4xl font-extrabold tracking-tight md:text-6xl text-foreground">
          Free AI <span className="text-gradient">#CV-Checker</span>
        </h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          Get an instant ATS compatibility score and professional achievement-based rewrites in seconds.
        </p>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Form Column */}
        <div className="lg:col-span-5">
          <Card className="border-2 shadow-lg">
            <CardHeader>
              <CardTitle>CV Details</CardTitle>
              <CardDescription>Upload your PDF and tell us what role you're after.</CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  <FormField
                    control={form.control}
                    name="cvFile"
                    render={({ field: { onChange, value, ...rest } }) => (
                      <FormItem>
                        <FormLabel>CV (PDF format)</FormLabel>
                        <FormControl>
                          <Input
                            type="file"
                            accept=".pdf"
                            onChange={(e) => onChange(e.target.files)}
                            {...rest}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="targetRole"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Target Job Title</FormLabel>
                        <FormControl><Input placeholder="e.g. Senior Accountant" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="jobDescription"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Job Description (Optional)</FormLabel>
                        <FormControl><Textarea placeholder="Paste the JD here for a deeper role-fit analysis..." rows={4} {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Separator />

                  <div className="space-y-4">
                    <FormField
                      control={form.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email (Optional)</FormLabel>
                          <FormControl><Input placeholder="To receive the full report + free template" {...field} /></FormControl>
                          <FormDescription className="text-[10px]">We'll send you the improved bullets and professional summary.</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="consentStorage"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-3 bg-muted/30">
                          <FormControl>
                            <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                          </FormControl>
                          <div className="space-y-1 leading-none">
                            <FormLabel className="text-xs">
                              Save my CV for review and future matching opportunities.
                            </FormLabel>
                          </div>
                        </FormItem>
                      )}
                    />
                  </div>

                  <Button type="submit" className="w-full h-12 font-bold text-lg" disabled={isAnalyzing}>
                    {isAnalyzing ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Sparkles className="mr-2 h-5 w-5" />}
                    {isAnalyzing ? 'Analyzing CV...' : 'Check My CV Now'}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        </div>

        {/* Results Column */}
        <div className="lg:col-span-7">
          {isAnalyzing ? (
            <div className="h-[600px] flex flex-col items-center justify-center text-center space-y-6 border-2 border-dashed rounded-xl bg-muted/5 p-8">
              <Loader2 className="h-16 w-16 animate-spin text-primary opacity-20" />
              <div className="space-y-2">
                <p className="text-2xl font-bold text-foreground">AI Recruiter is at work...</p>
                <div className="flex flex-col gap-1 text-sm text-muted-foreground animate-pulse">
                  <span>Reading document hierarchy...</span>
                  <span>Extracting key achievements...</span>
                  <span>Benchmarking against target role...</span>
                </div>
              </div>
            </div>
          ) : result ? (
            <div className="space-y-6 animate-in fade-in zoom-in-95 duration-500">
              <Card className="border-primary bg-primary/5 overflow-hidden">
                <CardHeader className="bg-primary/10 flex flex-row justify-between items-center py-4">
                  <div>
                    <CardTitle className="text-primary font-black text-2xl uppercase italic">Analysis Report</CardTitle>
                    <CardDescription className="text-slate-900 font-bold">Results for {form.getValues('targetRole')}</CardDescription>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-black uppercase text-primary tracking-widest">Overall Score</p>
                    <p className="text-5xl font-black text-primary">{result.scores.overallScore}%</p>
                  </div>
                </CardHeader>
                <CardContent className="p-6 space-y-8">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <ScoreCard label="ATS Readiness" score={result.scores.atsReadiness} rationale={result.rationales.atsReadiness} />
                    <ScoreCard label="Impact & Achievements" score={result.scores.impactAndAchievements} rationale={result.rationales.impactAndAchievements} />
                    <ScoreCard label="Structure & Readability" score={result.scores.structureAndReadability} rationale={result.rationales.structureAndReadability} />
                    <ScoreCard label="Role Fit" score={result.scores.roleFit} rationale={result.rationales.roleFit} />
                  </div>

                  <Separator />

                  <div className="space-y-4">
                    <h3 className="font-bold flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-warning" /> Missing & Required Info</h3>
                    <div className="flex flex-wrap gap-2">
                      {result.missingInformation.map((info, i) => (
                        <Badge key={i} variant="outline" className="bg-white text-destructive border-destructive/20">{info}</Badge>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h3 className="font-bold flex items-center gap-2"><Sparkles className="h-5 w-5 text-primary" /> AI-Improved Professional Summary</h3>
                    <div className="bg-white p-4 rounded-lg border italic text-sm leading-relaxed text-muted-foreground">
                      "{result.improvedSummary}"
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h3 className="font-bold flex items-center gap-2"><CheckCircle2 className="h-5 w-5 text-green-600" /> Achievement-Based Rewrites</h3>
                    <div className="space-y-3">
                      {result.bulletPointRewrites.map((rewrite, i) => (
                        <div key={i} className="p-3 border rounded-lg bg-background text-xs space-y-2">
                          <p className="text-muted-foreground line-through">Original: {rewrite.original}</p>
                          <p className="font-bold text-green-700">Improved: {rewrite.improved}</p>
                          <p className="text-[10px] text-muted-foreground italic">Reason: {rewrite.reason}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="bg-primary/5 border-t justify-center py-4">
                  <p className="text-xs text-muted-foreground font-medium italic text-center px-8">
                    Tip: Use achievement-based bullets to increase your interview calls by up to 40%.
                  </p>
                </CardFooter>
              </Card>
            </div>
          ) : (
            <div className="h-[600px] flex flex-col items-center justify-center text-center space-y-6 border-2 border-dashed rounded-xl bg-muted/5 p-8">
              <div className="h-24 w-24 rounded-full bg-primary/10 flex items-center justify-center">
                <FileText className="h-12 w-12 text-primary opacity-40" />
              </div>
              <div className="space-y-2">
                <p className="text-xl font-bold text-muted-foreground">Ready to analyze</p>
                <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                  Upload your CV and enter your target role to see your ATS score and expert improvement tips.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      <Separator />

      <section className="space-y-8">
        <div className="text-center">
          <h2 className="text-3xl font-bold">Trusted by SA Professionals</h2>
        </div>
        <TrustIndexWidget />
      </section>

      {relatedServices.length > 0 && (
        <section className="space-y-8 pt-12 border-t">
            <div className="text-center">
                <h2 className="text-3xl font-bold">Maximize Your Tax Returns</h2>
                <p className="text-muted-foreground mt-2">Professional tax services for individuals and sole proprietors.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {relatedServices.map(service => (
                    <Card key={service.id} className="flex flex-col group hover:shadow-xl transition-all duration-300 border">
                        <CardHeader>
                            <CardTitle className="text-xl font-bold leading-tight group-hover:text-primary transition-colors">{service.title}</CardTitle>
                            <div className="pt-2">
                                {service.isPriceTbc ? (
                                    <span className="text-lg font-bold opacity-50 block">Price on Request</span>
                                ) : (
                                    <span className="text-xl font-bold text-primary block">
                                        {new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' }).format(service.price)}
                                    </span>
                                )}
                            </div>
                        </CardHeader>
                        <CardContent className="flex-grow">
                            <p className="text-sm text-muted-foreground line-clamp-3">{service.description}</p>
                        </CardContent>
                        <CardFooter>
                            <Button asChild variant="outline" className="w-full border-primary text-primary font-semibold">
                                <Link href={`/products/${service.slug}`}>
                                    View Details <ArrowRight className="ml-2 h-4 w-4" />
                                </Link>
                            </Button>
                        </CardFooter>
                    </Card>
                ))}
            </div>
        </section>
      )}
    </div>
  );
}
