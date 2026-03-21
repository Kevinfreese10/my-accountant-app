'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Employee } from '@/lib/types';
import { Loader2, User, Briefcase, Landmark, Calendar as CalendarIcon, Save } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';

const formSchema = z.object({
  name: z.string().min(2, 'Name is required.'),
  surname: z.string().min(2, 'Surname is required.'),
  idNumber: z.string().min(13, 'A valid 13-digit ID number is required.').max(13),
  jobTitle: z.string().min(2, 'Job title is required.'),
  department: z.string().min(2, 'Department is required.'),
  joinDate: z.date({ required_error: 'Join date is required.' }),
  taxNumber: z.string().optional(),
  basicSalary: z.preprocess(val => Number(val), z.number().min(0, 'Salary must be a positive number.')),
  paymentFrequency: z.enum(['Monthly', 'Weekly', 'Bi-Weekly']).default('Monthly'),
  bankingDetails: z.object({
    bankName: z.string().min(2, 'Bank name is required.'),
    accountNumber: z.string().min(5, 'Account number is required.'),
    accountType: z.string().min(2, 'Account type is required.'),
    branchCode: z.string().min(6, 'Branch code is required.'),
  }),
});

type EmployeeFormValues = z.infer<typeof formSchema>;

export default function EmployeeForm({
  employee,
  onSubmit,
  onCancel,
  isLoading
}: {
  employee: Partial<Employee> | null;
  onSubmit: (values: EmployeeFormValues) => void;
  onCancel: () => void;
  isLoading: boolean;
}) {
  const form = useForm<EmployeeFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: employee?.name || '',
      surname: employee?.surname || '',
      idNumber: employee?.idNumber || '',
      jobTitle: employee?.jobTitle || '',
      department: employee?.department || '',
      joinDate: employee?.joinDate ? (employee.joinDate.toDate ? employee.joinDate.toDate() : new Date(employee.joinDate)) : new Date(),
      taxNumber: employee?.taxNumber || '',
      basicSalary: employee?.basicSalary || 0,
      paymentFrequency: employee?.paymentFrequency || 'Monthly',
      bankingDetails: {
        bankName: employee?.bankingDetails?.bankName || '',
        accountNumber: employee?.bankingDetails?.accountNumber || '',
        accountType: employee?.bankingDetails?.accountType || 'Savings',
        branchCode: employee?.bankingDetails?.branchCode || '',
      },
    },
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 max-h-[70vh] overflow-y-auto p-1 pr-4">
        {/* Personal Details */}
        <section className="space-y-4">
          <div className="flex items-center gap-2 text-primary font-bold uppercase text-xs tracking-widest">
            <User className="h-4 w-4" /> Personal Details
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField control={form.control} name="name" render={({ field }) => ( <FormItem><FormLabel>First Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
            <FormField control={form.control} name="surname" render={({ field }) => ( <FormItem><FormLabel>Surname</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
          </div>
          <FormField control={form.control} name="idNumber" render={({ field }) => ( <FormItem><FormLabel>ID Number</FormLabel><FormControl><Input placeholder="8801015000081" {...field} /></FormControl><FormMessage /></FormItem> )} />
        </section>

        <Separator />

        {/* Employment Details */}
        <section className="space-y-4">
          <div className="flex items-center gap-2 text-primary font-bold uppercase text-xs tracking-widest">
            <Briefcase className="h-4 w-4" /> Employment & Compensation
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField control={form.control} name="jobTitle" render={({ field }) => ( <FormItem><FormLabel>Job Title</FormLabel><FormControl><Input placeholder="e.g. Sales Manager" {...field} /></FormControl><FormMessage /></FormItem> )} />
            <FormField control={form.control} name="department" render={({ field }) => ( <FormItem><FormLabel>Department</FormLabel><FormControl><Input placeholder="e.g. Operations" {...field} /></FormControl><FormMessage /></FormItem> )} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="joinDate"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Join Date</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button variant={"outline"} className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
                          {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                          <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus />
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField control={form.control} name="paymentFrequency" render={({ field }) => (
              <FormItem>
                <FormLabel>Payment Frequency</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                  <SelectContent>
                    <SelectItem value="Monthly">Monthly</SelectItem>
                    <SelectItem value="Weekly">Weekly</SelectItem>
                    <SelectItem value="Bi-Weekly">Bi-Weekly</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField control={form.control} name="basicSalary" render={({ field }) => ( <FormItem><FormLabel>Basic Salary (Gross)</FormLabel><FormControl><Input type="number" step="0.01" {...field} /></FormControl><FormMessage /></FormItem> )} />
            <FormField control={form.control} name="taxNumber" render={({ field }) => ( <FormItem><FormLabel>Income Tax Number</FormLabel><FormControl><Input placeholder="Optional" {...field} /></FormControl><FormMessage /></FormItem> )} />
          </div>
        </section>

        <Separator />

        {/* Banking Details */}
        <section className="space-y-4">
          <div className="flex items-center gap-2 text-primary font-bold uppercase text-xs tracking-widest">
            <Landmark className="h-4 w-4" /> Banking Details
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField control={form.control} name="bankingDetails.bankName" render={({ field }) => ( <FormItem><FormLabel>Bank Name</FormLabel><FormControl><Input placeholder="e.g. FNB" {...field} /></FormControl><FormMessage /></FormItem> )} />
            <FormField control={form.control} name="bankingDetails.accountType" render={({ field }) => (
              <FormItem>
                <FormLabel>Account Type</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                  <SelectContent>
                    <SelectItem value="Savings">Savings</SelectItem>
                    <SelectItem value="Cheque">Cheque / Current</SelectItem>
                    <SelectItem value="Transmission">Transmission</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField control={form.control} name="bankingDetails.accountNumber" render={({ field }) => ( <FormItem><FormLabel>Account Number</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
            <FormField control={form.control} name="bankingDetails.branchCode" render={({ field }) => ( <FormItem><FormLabel>Branch Code</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
          </div>
        </section>

        <div className="flex justify-end gap-2 pt-4 sticky bottom-0 bg-background pb-2 border-t">
          <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>
          <Button type="submit" disabled={isLoading}>
            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Save Employee
          </Button>
        </div>
      </form>
    </Form>
  );
}
