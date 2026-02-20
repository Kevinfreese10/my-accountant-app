
'use client';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { MoreHorizontal, Users, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { User } from '@/lib/types';
import { getFirestore, collection, getDocs, doc, deleteDoc, query, where } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';

const db = getFirestore(firebaseApp);

export default function AdminPartnersPage() {
  const [partners, setPartners] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const fetchPartners = async () => {
    setIsLoading(true);
    try {
        const q = query(collection(db, "users"), where('role', '==', 'partner'));
        const querySnapshot = await getDocs(q);
        const fetchedPartners = querySnapshot.docs.map(doc => ({ ...doc.data(), uid: doc.id } as User));
        setPartners(fetchedPartners);
    } catch (error) {
        console.error("Error fetching partners:", error);
        toast({ title: 'Error', description: 'Could not fetch partners from the database.', variant: 'destructive'});
    } finally {
        setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPartners();
  }, []);

  const handleDelete = async (partnerId: string) => {
    try {
        await deleteDoc(doc(db, "users", partnerId));
        fetchPartners();
        toast({
            title: 'Partner Deleted',
            description: 'The partner has been removed from Firestore.',
            variant: 'destructive',
        });
    } catch (error) {
        console.error("Error deleting partner:", error);
        toast({ title: 'Error', description: 'Could not delete partner.', variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Manage Partners</h1>
         <Button asChild>
            <Link href="/partner-signup">
                Add New Partner
            </Link>
        </Button>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>All Partners</CardTitle>
          <CardDescription>View and manage all approved partner accounts.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
             <div className="flex justify-center items-center h-64">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Company Name</TableHead>
                <TableHead>Contact Person</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {partners.map(partner => (
                <TableRow key={partner.uid}>
                  <TableCell className="font-medium">{partner.companyName}</TableCell>
                  <TableCell>{partner.contactPerson}</TableCell>
                  <TableCell>{partner.email}</TableCell>
                  <TableCell>{partner.contactNumber}</TableCell>
                  <TableCell>
                      <Badge variant={partner.status === 'Active' ? 'success' : 'secondary'}>
                          {partner.status}
                      </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <AlertDialog>
                        <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                            <span className="sr-only">Open menu</span>
                            <MoreHorizontal className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuItem disabled>Edit</DropdownMenuItem>
                            <DropdownMenuSeparator />
                             <AlertDialogTrigger asChild>
                                <DropdownMenuItem className="text-destructive">
                                    Delete
                                </DropdownMenuItem>
                            </AlertDialogTrigger>
                        </DropdownMenuContent>
                        </DropdownMenu>
                         <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                <AlertDialogDescription>
                                This action cannot be undone. This will permanently delete the partner account for:
                                <span className="font-semibold"> {partner.companyName}</span>. This only removes them from Firestore.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <Accordion type="single" collapsible>
                                    <AccordionItem value="delete-warning">
                                        <AccordionTrigger className="text-destructive">Advanced Warning</AccordionTrigger>
                                        <AccordionContent>
                                            Deleting this user profile does not remove their account from Firebase Authentication. You must manually remove them from the Firebase Console if you wish to prevent future logins.
                                        </AccordionContent>
                                    </AccordionItem>
                                </Accordion>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDelete(partner.uid)}>
                                    Continue
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
