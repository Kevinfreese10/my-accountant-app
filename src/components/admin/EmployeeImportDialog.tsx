'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Download, Upload, CheckCircle2, AlertCircle, FileSpreadsheet } from 'lucide-react';
import { getFirestore, collection, query, where, getDocs, doc, setDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { Employee } from '@/lib/types';
import Papa from 'papaparse';
import { parse } from 'date-fns';
import { generateEmployeePayslipAction } from '@/app/actions';

const db = getFirestore(firebaseApp);

export default function EmployeeImportDialog({
    open,
    onOpenChange,
    clientId
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    clientId: string;
}) {
    const [isImporting, setIsImporting] = useState(false);
    const { toast } = useToast();

    const handleDownloadTemplate = () => {
        const headers = [
            'Code', 'Initials', 'First Name', 'Surname', 'ID Number', 'Email', 'Phone', 
            'Job Title', 'Department', 'Join Date (YYYY-MM-DD)', 'Tax Number', 
            'Pay Type (Salary/Hourly)', 'Basic Salary', 'Hourly Rate', 
            'Frequency (Monthly/Fortnightly/Weekly)', 'Bank', 'Acc Number', 'Acc Type', 'Branch', 
            'Street', 'Suburb', 'City', 'Zip'
        ];
        
        const exampleRow = [
            'EMP001', 'JD', 'John', 'Doe', '8801015000081', 'john@example.com', '0821234567',
            'Sales Manager', 'Sales', '2024-03-01', '1234567890',
            'Salary', '25000', '0',
            'Monthly', 'FNB', '62000000000', 'Savings', '250655',
            '123 Main Street', 'Sandton', 'Johannesburg', '2196'
        ];

        const csvContent = Papa.unparse([headers, exampleRow]);
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.setAttribute('download', 'employee_import_template.csv');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !clientId) return;

        setIsImporting(true);
        toast({ title: "Importing...", description: "Parsing file and updating records." });

        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: async (results) => {
                try {
                    const rows = results.data as any[];
                    let createCount = 0;
                    let updateCount = 0;

                    // Fetch existing employees to match by code
                    const empRef = collection(db, 'aiPayrollClients', clientId, 'employees');
                    const empSnap = await getDocs(empRef);
                    const existingMap = new Map<string, string>(); // code -> docId
                    empSnap.docs.forEach(d => {
                        const data = d.data();
                        if (data.employeeCode) existingMap.set(data.employeeCode, d.id);
                    });

                    for (const row of rows) {
                        const code = row['Code']?.trim();
                        if (!code) continue;

                        const existingId = existingMap.get(code);
                        const targetRef = existingId 
                            ? doc(db, 'aiPayrollClients', clientId, 'employees', existingId)
                            : doc(collection(db, 'aiPayrollClients', clientId, 'employees'));

                        const joinDateStr = row['Join Date (YYYY-MM-DD)'] || format(new Date(), 'yyyy-MM-dd');
                        const joinDate = Timestamp.fromDate(new Date(joinDateStr));

                        const employeeData: any = {
                            employeeCode: code,
                            initials: row['Initials'] || '',
                            name: row['First Name'] || '',
                            surname: row['Surname'] || '',
                            idNumber: row['ID Number'] || '',
                            email: row['Email'] || '',
                            cellNumber: row['Phone'] || '',
                            jobTitle: row['Job Title'] || '',
                            department: row['Department'] || '',
                            joinDate: joinDate,
                            taxNumber: row['Tax Number'] || '',
                            payType: row['Pay Type (Salary/Hourly)'] === 'Hourly' ? 'Hourly' : 'Salary',
                            basicSalary: parseFloat(String(row['Basic Salary'] || '0').replace(/[^\d.]/g, '')) || 0,
                            hourlyRate: parseFloat(String(row['Hourly Rate'] || '0').replace(/[^\d.]/g, '')) || 0,
                            paymentFrequency: row['Frequency (Monthly/Fortnightly/Weekly)'] || 'Monthly',
                            bankingDetails: {
                                bankName: row['Bank'] || '',
                                accountNumber: row['Acc Number'] || '',
                                accountType: row['Acc Type'] || 'Savings',
                                branchCode: row['Branch'] || '',
                            },
                            address: {
                                street: row['Street'] || '',
                                suburb: row['Suburb'] || '',
                                city: row['City'] || '',
                                zip: row['Zip'] || '',
                            },
                            status: 'Active',
                            updatedAt: serverTimestamp(),
                        };

                        if (!existingId) {
                            employeeData.createdAt = serverTimestamp();
                            createCount++;
                        } else {
                            updateCount++;
                        }

                        await setDoc(targetRef, employeeData, { merge: true });

                        // If new employee, generate initial payslip
                        if (!existingId) {
                            const baseValue = employeeData.payType === 'Hourly' ? employeeData.hourlyRate : employeeData.basicSalary;
                            await generateEmployeePayslipAction({
                                clientId,
                                employeeId: targetRef.id,
                                basicSalary: baseValue
                            });
                        }
                    }

                    toast({ 
                        title: "Import Successful", 
                        description: `Created ${createCount} and updated ${updateCount} employees.` 
                    });
                    onOpenChange(false);
                } catch (error) {
                    console.error("Import failed:", error);
                    toast({ title: "Import Failed", description: "Please check your file format.", variant: "destructive" });
                } finally {
                    setIsImporting(false);
                }
            }
        });
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <FileSpreadsheet className="h-5 w-5 text-primary" />
                        Bulk Employee Import
                    </DialogTitle>
                    <DialogDescription>
                        Upload a CSV file to create or update employee records. Matching is based on the <strong>Employee Code</strong>.
                    </DialogDescription>
                </DialogHeader>
                <div className="py-6 space-y-6">
                    <div className="space-y-4">
                        <Label>1. Download the Template</Label>
                        <Button variant="outline" className="w-full justify-start gap-3 h-12" onClick={handleDownloadTemplate}>
                            <Download className="h-4 w-4 text-primary" />
                            <div className="text-left">
                                <p className="text-sm font-bold">Download Example CSV</p>
                                <p className="text-[10px] text-muted-foreground">Ensure your file matches these headers exactly.</p>
                            </div>
                        </Button>
                    </div>

                    <Separator />

                    <div className="space-y-4">
                        <Label>2. Upload Your File</Label>
                        <div className="relative">
                            <Input 
                                type="file" 
                                accept=".csv" 
                                onChange={handleFileChange}
                                disabled={isImporting}
                                className="h-12 pt-3"
                            />
                            {isImporting && (
                                <div className="absolute inset-0 bg-background/80 flex items-center justify-center rounded-md">
                                    <Loader2 className="h-5 w-5 animate-spin text-primary mr-2" />
                                    <span className="text-xs font-bold">Processing...</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
                <DialogFooter className="bg-muted/30 p-4 -mx-6 -mb-6 border-t">
                    <Button variant="ghost" onClick={() => onOpenChange(false)} className="w-full">Close</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
