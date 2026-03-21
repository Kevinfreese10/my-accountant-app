'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlusCircle, Search, Loader2, MoreHorizontal, Edit, Trash2, User as UserIcon } from 'lucide-react';
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { getFirestore, collection, addDoc, getDocs, query, orderBy, doc, setDoc, onSnapshot, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { Employee } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import EmployeeForm from '@/components/admin/EmployeeForm';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';

const db = getFirestore(firebaseApp);

export default function EmployeesPage() {
  const params = useParams();
  const clientId = params.clientId as string;
  const { toast } = useToast();
  
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (!clientId) return;

    const employeesRef = collection(db, 'aiPayrollClients', clientId, 'employees');
    const q = query(employeesRef, orderBy('surname'), orderBy('name'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedEmployees = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Employee));
      setEmployees(fetchedEmployees);
      setIsLoading(false);
    }, (error) => {
      console.error("Error fetching employees:", error);
      toast({ title: "Error", description: "Could not load employee data.", variant: "destructive" });
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [clientId, toast]);

  const handleFormSubmit = async (values: any) => {
    if (!clientId) return;
    setIsSaving(true);

    try {
      const employeesRef = collection(db, 'aiPayrollClients', clientId, 'employees');
      
      const employeeData = {
        ...values,
        status: 'Active',
        updatedAt: serverTimestamp(),
      };

      if (selectedEmployee?.id) {
        await setDoc(doc(db, 'aiPayrollClients', clientId, 'employees', selectedEmployee.id), employeeData, { merge: true });
        toast({ title: 'Employee Updated' });
      } else {
        await addDoc(employeesRef, {
          ...employeeData,
          createdAt: serverTimestamp(),
        });
        toast({ title: 'Employee Added' });
      }

      setIsFormOpen(false);
      setSelectedEmployee(null);
    } catch (error: any) {
      console.error("Error saving employee:", error);
      toast({ 
        title: 'Error', 
        description: error.message || 'Failed to save employee details.', 
        variant: 'destructive' 
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteEmployee = async (employeeId: string) => {
    try {
      await deleteDoc(doc(db, 'aiPayrollClients', clientId, 'employees', employeeId));
      toast({ title: 'Employee Removed', variant: 'destructive' });
    } catch (error) {
      console.error("Error deleting employee:", error);
      toast({ title: 'Delete Failed', variant: 'destructive' });
    }
  };

  const filteredEmployees = employees.filter(emp => 
    `${emp.name} ${emp.surname}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
    emp.idNumber.includes(searchTerm) ||
    emp.jobTitle.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold">Employees</h2>
          <p className="text-sm text-muted-foreground">Manage your workforce and compensation details.</p>
        </div>
        <Dialog open={isFormOpen} onOpenChange={(open) => { setIsFormOpen(open); if (!open) setSelectedEmployee(null); }}>
          <DialogTrigger asChild>
            <Button onClick={() => setSelectedEmployee(null)}>
              <PlusCircle className="mr-2 h-4 w-4" /> Add Employee
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>{selectedEmployee ? 'Edit Employee' : 'Add New Employee'}</DialogTitle>
              <DialogDescription>
                Enter the employee's personal and payroll details to register them in the system.
              </DialogDescription>
            </DialogHeader>
            <EmployeeForm 
              employee={selectedEmployee}
              onSubmit={handleFormSubmit}
              onCancel={() => setIsFormOpen(false)}
              isLoading={isSaving}
            />
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="relative flex-grow">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Search by name, ID, or title..." 
                className="pl-8 max-w-sm" 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="animate-spin text-primary" /></div>
          ) : filteredEmployees.length === 0 ? (
            <div className="h-60 flex flex-col items-center justify-center border-2 border-dashed rounded-lg text-muted-foreground text-center p-8">
              <UserIcon className="h-12 w-12 opacity-20 mb-4" />
              <p className="font-semibold">No employees found.</p>
              <p className="text-sm">Start by adding your first staff member to this company.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>ID Number</TableHead>
                  <TableHead>Job Title</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEmployees.map((emp) => (
                  <TableRow key={emp.id}>
                    <TableCell className="font-medium">
                      <div className="flex flex-col">
                        <span>{emp.surname}, {emp.name}</span>
                        <span className="text-[10px] text-muted-foreground">Joined: {emp.joinDate?.toDate ? format(emp.joinDate.toDate(), 'dd MMM yyyy') : 'N/A'}</span>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{emp.idNumber}</TableCell>
                    <TableCell>{emp.jobTitle}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px] uppercase font-bold">{emp.department}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={emp.status === 'Active' ? 'success' : 'secondary'} className="text-[10px] uppercase font-bold">
                        {emp.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Actions</DropdownMenuLabel>
                          <DropdownMenuItem onClick={() => { setSelectedEmployee(emp); setIsFormOpen(true); }}>
                            <Edit className="mr-2 h-4 w-4" /> Edit Details
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <DropdownMenuItem className="text-destructive" onSelect={(e) => e.preventDefault()}>
                                <Trash2 className="mr-2 h-4 w-4" /> Remove Employee
                              </DropdownMenuItem>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This will permanently remove {emp.name} {emp.surname} from the payroll records. This action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDeleteEmployee(emp.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                  Confirm Removal
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </DropdownMenuContent>
                      </DropdownMenu>
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

import { DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
