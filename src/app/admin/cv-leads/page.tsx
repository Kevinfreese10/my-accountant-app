'use client';

import { useState, useEffect } from 'react';
import { getFirestore, collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { CVLead } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Download, Loader2, Search, FileText, ExternalLink, Mail } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { format } from 'date-fns';

const db = getFirestore(firebaseApp);

export default function CVLeadsPage() {
  const [leads, setLeads] = useState<CVLead[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const q = query(collection(db, 'cvLeads'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedLeads = snapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id,
      } as CVLead));
      setLeads(fetchedLeads);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const filteredLeads = leads.filter(lead => 
    lead.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    lead.role.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatDate = (timestamp: any) => {
    if (!timestamp) return 'N/A';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return format(date, 'dd MMM yyyy, HH:mm');
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">CV Checker Leads</h1>
          <p className="text-muted-foreground">Manage and review candidates who used the AI CV Checker.</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
            <div>
              <CardTitle>Candidates</CardTitle>
              <CardDescription>A list of individuals seeking role-fit analysis.</CardDescription>
            </div>
            <div className="relative w-full max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by email or role..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Candidate Email</TableHead>
                  <TableHead>Target Role</TableHead>
                  <TableHead className="text-center">Score</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLeads.length > 0 ? (
                  filteredLeads.map((lead) => (
                    <TableRow key={lead.id}>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatDate(lead.createdAt)}
                      </TableCell>
                      <TableCell className="font-medium">
                        {lead.email ? (
                          <div className="flex items-center gap-2">
                            <Mail className="h-3 w-3 opacity-50" />
                            {lead.email}
                          </div>
                        ) : (
                          <span className="text-muted-foreground italic">Anonymous</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="font-semibold uppercase tracking-tighter text-[10px]">
                          {lead.role}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge className={cn(
                          "font-mono",
                          lead.score > 70 ? "bg-green-600" : lead.score > 40 ? "bg-yellow-500" : "bg-destructive"
                        )}>
                          {lead.score}%
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          {lead.cvUrl ? (
                            <Button size="sm" variant="outline" className="h-8" asChild>
                              <a href={lead.cvUrl} target="_blank" rel="noopener noreferrer">
                                <Download className="h-3 w-3 mr-2" />
                                Download CV
                              </a>
                            </Button>
                          ) : (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button size="sm" variant="ghost" disabled className="h-8 opacity-50 cursor-not-allowed">
                                    <FileText className="h-3 w-3 mr-2" />
                                    No File Saved
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p className="text-xs">User did not consent to CV storage.</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                      No leads found matching your criteria.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
