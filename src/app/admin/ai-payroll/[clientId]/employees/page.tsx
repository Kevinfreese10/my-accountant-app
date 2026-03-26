'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlusCircle, Search, Loader2, MoreHorizontal, Edit, Trash2, User as UserIcon, ReceiptText, Calculator, FileUp } from 'lucide-react';
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { getFirestore, collection, query, orderBy, doc, setDoc, onSnapshot, deleteDoc, serverTimestamp, getDoc, where, limit, getDocs } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { Employee, Payslip, User } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import EmployeeForm from '@/components/admin/EmployeeForm';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { format } from 'date-fns';
import { generateEmployeePayslipAction, syncEmployeeSalaryToActivePayslipAction } from '@/app/actions';
import PayslipEditor from '@/components/admin/PayslipEditor';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError, type SecurityRuleContext } from '@/firebase/errors';
import EmployeeImportDialog from '@/components/admin/EmployeeImportDialog';

const db = getFirestore(firebaseApp);

export default function EmployeesPage() {
  const params = useParams();
  const clientId = params.clientId as string;
  const { toast } = useToast();
  
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [client, setClient] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Payslip editing states
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingPayslip, setEditingPayslip] = useState<Payslip | null>(null);
  const [payslipEmployee, setPayslipEmployee] = useState<Employee | null>(null);
  const [isFetchingPayslip, setIsFetchingPayslip] = useState(false);

  useEffect(() => {
    if (!clientId) return;

    // Fetch client details
    getDoc(doc(db, 'aiPayrollClients', clientId)).then(snap => {
        if (snap.exists()) setClient({ id: snap.id, ...snap.data() } as User);
    });

    const employeesRef = collection(db, 'aiPayrollClients', clientId, 'employees');
    const q = query(employeesRef, orderBy('surname'), orderBy('name'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedEmployees = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Employee));
      setEmployees(fetchedEmployees);
      setIsLoading(false);
    }, async (error) => {
      const permissionError = new FirestorePermissionError({
        path: employeesRef.path,
        operation: 'list',
      } satisfies SecurityRuleContext);
      errorEmitter.emit('permission-error', permissionError);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [clientId, toast]);

  const handleFormSubmit = async (values: any) => {
    if (!clientId) return;
    setIsSaving(true);

    const employeeRef = selectedEmployee?.id 
      ? doc(db, 'aiPayrollClients', clientId, 'employees', selectedEmployee.id)
      : doc(collection(db, 'aiPayrollClients', clientId, 'employees'));

    const employeeData = {
      ...values,
      status: 'Active',
      updatedAt: serverTimestamp(),
      ...(selectedEmployee?.id ? {} : { createdAt: serverTimestamp() })
    };

    setDoc(employeeRef, employeeData, { merge: true })
      .then(async () => {
        if (selectedEmployee?.id) {
          // SYNC SALARY TO PAYSLIP IF CHANGED
          if (selectedEmployee.basicSalary !== values.basicSalary) {
              await syncEmployeeSalaryToActivePayslipAction({
                  clientId,
                  employeeId: selectedEmployee.id,
                  newSalary: values.basicSalary,
                  isNetSalary: values.isNetSalary
              });
              toast({ title: 'Record Updated', description: 'Employee details and active payslip have been synchronized.' });
          } else {
              toast({ title: 'Employee Updated' });
          }
        } else {
          // NEW EMPLOYEE: AUTOMATIC PAYSLIP GENERATION
          await generateEmployeePayslipAction({
              clientId,
              employeeId: employeeRef.id,
              basicSalary: values.basicSalary
          });

          toast({ 
              title: 'Employee Added', 
              description: 'Draft payslip has been created.' 
          });
        }
        setIsFormOpen(false);
        setSelectedEmployee(null);
        setIsSaving(false);
      })
      .catch(async (error) => {
        const permissionError = new FirestorePermissionError({
          path: employeeRef.path,
          operation: selectedEmployee?.id ? 'update' : 'create',
          requestResourceData: employeeData,
        } satisfies SecurityRuleContext);
        errorEmitter.emit('permission-error', permissionError);
        setIsSaving(false);
      });
  };

  const handleEditPayslip = async (employee: Employee) => {
      setIsFetchingPayslip(true);
      setPayslipEmployee(employee);
      
      try {
          const payslipsRef = collection(db, 'aiPayrollClients', clientId, 'payslips');
          const q = query(
              payslipsRef, 
              where('employeeId', '==', employee.id), 
              where('period', '==', client?.firstProcessingMonth),
              limit(1)
          );
          
          const snap = await getDocs(q);
          if (!snap.empty) {
              const data = snap.docs[0].data();
              setEditingPayslip({ id: snap.docs[0].id, ...data } as Payslip);
              setIsEditorOpen(true);
          } else {
              // Automatically generate a draft if missing, ensuring the payslip shows even with no prior figures
              const res = await generateEmployeePayslipAction({
                  clientId,
                  employeeId: employee.id,
                  basicSalary: employee.payType === 'Hourly' ? (employee.hourlyRate || 0) : (employee.basicSalary || 0)
              });
              
              if (res.success && res.id) {
                  const newSnap = await getDoc(doc(db, 'aiPayrollClients', clientId, 'payslips', res.id));
                  if (newSnap.exists()) {
                      setEditingPayslip({ id: newSnap.id, ...newSnap.data() } as Payslip);
                      setIsEditorOpen(true);
                  }
              } else {
                  toast({ title: "Draft Creation Failed", description: "Could not create a draft payslip for this period.", variant: "destructive" });
              }
          }
      } catch (error) {
          console.error("Error fetching payslip:", error);
          toast({ title: "Error", description: "Failed to open payslip editor.", variant: "destructive" });
      } finally {
          setIsFetchingPayslip(false);
      }
  };

  const handleDeleteEmployee = async (employeeId: string) => {
    const employeeRef = doc(db, 'aiPayrollClients', clientId, 'employees', employeeId);
    deleteDoc(employeeRef)
      .then(() => {
        toast({ title: 'Employee Removed', variant: 'destructive' });
      })
      .catch(async (error) => {
        const permissionError = new FirestorePermissionError({
          path: employeeRef.path,
          operation: 'delete',
        } satisfies SecurityRuleContext);
        errorEmitter.emit('permission-error', permissionError);
      });
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
          <h2 className="text-xl font-bold text-slate-900">Employee Management</h2>
          <p className="text-sm text-muted-foreground font-medium">Manage your workforce and compensation details.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setIsImportOpen(true)} className="font-bold border-primary/20 text-primary">
            <FileUp className="mr-2 h-4 w-4" /> Import CSV
          </Button>
          <Dialog open={isFormOpen} onOpenChange={(open) => { setIsFormOpen(open); if (!open) setSelectedEmployee(null); }}>
            <DialogTrigger asChild>
              <Button onClick={() => setSelectedEmployee(null)} className="font-bold">
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
      </div>

      <EmployeeImportDialog 
        open={isImportOpen} 
        onOpenChange={setIsImportOpen} 
        clientId={clientId} 
      />

      <Dialog open={isEditorOpen} onOpenChange={setIsEditorOpen}>
          <DialogContent className="sm:max-w-6xl p-0 overflow-hidden bg-[#F5F5F5]">
              <DialogHeader className="p-6 bg-white border-b">
                  <div className="flex justify-between items-center">
                      <div>
                        <DialogTitle className="flex items-center gap-2"><Calculator className="h-5 w-5 text-primary" /> Interactive Payslip Editor</DialogTitle>
                        <DialogDescription>Current processing month: <strong>{client?.firstProcessingMonth}</strong></DialogDescription>
                      </div>
                      <Badge variant="outline" className="bg-muted border-none uppercase font-black text-[9px] tracking-widest px-3">Confidential Data</Badge>
                  </div>
              </DialogHeader>
              <div className="p-8">
                {editingPayslip && payslipEmployee && client && (
                    <PayslipEditor 
                        payslip={editingPayslip} 
                        employee={payslipEmployee} 
                        client={client} 
                        onSave={() => setIsEditorOpen(false)}
                    />
                )}
              </div>
          </DialogContent>
      </Dialog>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="relative flex-grow">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Search staff..." 
                className="pl-8 max-w-sm h-10" 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="animate-spin text-primary" /></div>
          ) : filteredEmployees.length === 0 ? (
            <div className="h-60 flex flex-col items-center justify-center border-2 border-dashed rounded-lg text-muted-foreground text-center p-8 mx-6 mb-6">
              <UserIcon className="h-12 w-12 opacity-20 mb-4" />
              <p className="font-semibold text-slate-900">No employees found.</p>
              <p className="text-sm">Start by adding your first staff member.</p>
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
                        <div className="flex items-center gap-2">
                            <span className="text-slate-900 font-bold">{emp.surname}, {emp.name}</span>
                            <Badge variant="outline" className="text-[9px] font-mono">{emp.employeeCode}</Badge>
                        </div>
                        <span className="text-[10px] text-muted-foreground">Joined: {emp.joinDate?.toDate ? format(emp.joinDate.toDate(), 'dd MMM yyyy') : 'N/A'}</span>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-slate-600">{emp.idNumber}</TableCell>
                    <TableCell className="text-xs font-medium text-slate-700">{emp.jobTitle}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[9px] uppercase font-black tracking-tighter bg-muted/50">{emp.department}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={emp.status === 'Active' ? 'success' : 'secondary'} className="text-[10px] uppercase font-bold px-2 py-0">
                        {emp.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-primary"
                            onClick={() => handleEditPayslip(emp)}
                            disabled={isFetchingPayslip && payslipEmployee?.id === emp.id}
                        >
                            {isFetchingPayslip && payslipEmployee?.id === emp.id ? <Loader2 className="h-4 w-4 animate-spin"/> : <ReceiptText className="h-4 w-4" />}
                        </Button>
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
                            <DropdownMenuItem onClick={() => handleEditPayslip(emp)}>
                                <Calculator className="mr-2 h-4 w-4" /> Edit Current Payslip
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
                                    This will permanently remove {emp.name} {emp.surname} from the payroll records.
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
                      </div>
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
