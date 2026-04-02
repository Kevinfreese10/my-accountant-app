'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Employee } from '@/lib/types';
import { Loader2, User, Briefcase, Landmark, Calendar as CalendarIcon, Save, MapPin, Phone, Mail, Hash, BadgeDollarSign, Clock } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';
import { Switch } from '../ui/switch';
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';
import { Label } from '../ui/label';

const formSchema = z.object({
  employeeCode: z.string().min(1, 'Employee code is required.'),
  initials: z.string().min(1, 'Initials are required.'),
  name: z.string().min(2, 'First name is required.'),
  surname: z.string().min(2, 'Surname is required.'),
  idNumber: z.string().min(13, 'A valid 13-digit RSA ID number is required.').max(13),
  address: z.object({
    street: z.string().min(1, 'Street address is required.'),
    suburb: z.string().optional(),
    city: z.string().min(1, 'City is required.'),
    province: z.string().optional(),
    zip: z.string().optional(),
  }),
  cellNumber: z.string().min(10, 'A valid cell number is required.'),
  email: z.string().email('A valid email address is required.'),
  joinDate: z.date({ required_error: 'Join date is required.' }),
  taxNumber: z.string().optional(),
  payType: z.enum(['Salary', 'Hourly']).default('Salary'),
  basicSalary: z.preprocess(val => Number(val), z.number().min(0, 'Salary must be a positive number.')),
  hourlyRate: z.preprocess(val => Number(val), z.number().min(0, 'Rate must be a positive number.')),
  isNetSalary: z.boolean().default(false),
  paymentFrequency: z.enum(['Monthly', 'Weekly', 'Fortnightly']).default('Monthly'),
  bankingDetails: z.object({
    bankName: z.string().min(2, 'Bank name is required.'),
    accountNumber: z.string().min(5, 'Account number is required.'),
    accountType: z.string().min(2, 'Account type is required.'),
    branchCode: z.string().min(6, 'Branch code is required.'),
  }),
  jobTitle: z.string().optional(),
  department: z.string().optional(),
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
      employeeCode: employee?.employeeCode || '',
      initials: employee?.initials || '',
      name: employee?.name || '',
      surname: employee?.surname || '',
      idNumber: employee?.idNumber || '',
      address: {
        street: employee?.address?.street || '',
        suburb: employee?.address?.suburb || '',
        city: employee?.address?.city || '',
        province: employee?.address?.province || '',
        zip: employee?.address?.zip || '',
      },
      cellNumber: employee?.cellNumber || '',
      email: employee?.email || '',
      jobTitle: employee?.jobTitle || '',
      department: employee?.department || '',
      joinDate: employee?.joinDate ? (employee.joinDate.toDate ? employee.joinDate.toDate() : new Date(employee.joinDate)) : new Date(),
      taxNumber: employee?.taxNumber || '',
      payType: employee?.payType || 'Salary',
      basicSalary: employee?.basicSalary || 0,
      hourlyRate: employee?.hourlyRate || 0,
      isNetSalary: employee?.isNetSalary || false,
      paymentFrequency: employee?.paymentFrequency || 'Monthly',
      bankingDetails: {
        bankName: employee?.bankingDetails?.bankName || '',
        accountNumber: employee?.bankingDetails?.accountNumber || '',
        accountType: employee?.bankingDetails?.accountType || 'Savings',
        branchCode: employee?.bankingDetails?.branchCode || '',
      },
    },
  });

  const payType = form.watch('payType');

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 max-h-[75vh] overflow-y-auto p-1 pr-4">
        {/* Identity & Basic Info */}
        <section className="space-y-4">
          <div className="flex items-center gap-2 text-primary font-bold uppercase text-xs tracking-widest">
            <User className="h-4 w-4" /> Identity & Basic Information
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField control={form.control} name="employeeCode" render={({ field }) => ( <FormItem><FormLabel>Employee Code</FormLabel><FormControl><Input placeholder="e.g. EMP001" {...field} /></FormControl><FormMessage /></FormItem> )} />
            <FormField control={form.control} name="initials" render={({ field }) => ( <FormItem><FormLabel>Initials</FormLabel><FormControl><Input placeholder="e.g. J.D." {...field} /></FormControl><FormMessage /></FormItem> )} />
            <FormField control={form.control} name="name" render={({ field }) => ( <FormItem><FormLabel>First Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
            <FormField control={form.control} name="surname" render={({ field }) => ( <FormItem><FormLabel>Surname</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
          </div>
          <FormField control={form.control} name="idNumber" render={({ field }) => ( <FormItem><FormLabel>RSA ID Number</FormLabel><FormControl><Input placeholder="8801015000081" {...field} /></FormControl><FormMessage /></FormItem> )} />
        </section>

        <Separator />

        {/* Contact & Address */}
        <section className="space-y-4">
          <div className="flex items-center gap-2 text-primary font-bold uppercase text-xs tracking-widest">
            <MapPin className="h-4 w-4" /> Contact & Address
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField control={form.control} name="cellNumber" render={({ field }) => ( <FormItem><FormLabel>Cell Number</FormLabel><FormControl><Input placeholder="082 123 4567" {...field} /></FormControl><FormMessage /></FormItem> )} />
            <FormField control={form.control} name="email" render={({ field }) => ( <FormItem><FormLabel>Email Address</FormLabel><FormControl><Input type="email" placeholder="john@example.com" {...field} /></FormControl><FormMessage /></FormItem> )} />
          </div>
          <div className="space-y-4 pt-2">
            <FormField control={form.control} name="address.street" render={({ field }) => ( <FormItem><FormLabel className="text-xs">Street Address</FormLabel><FormControl><Input {...field} /></FormControl></FormItem> )} />
            <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="address.suburb" render={({ field }) => ( <FormItem><FormLabel className="text-xs">Suburb</FormLabel><FormControl><Input {...field} /></FormControl></FormItem> )} />
                <FormField control={form.control} name="address.city" render={({ field }) => ( <FormItem><FormLabel className="text-xs">City</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                <FormField control={form.control} name="address.province" render={({ field }) => ( <FormItem><FormLabel className="text-xs">Province</FormLabel><FormControl><Input {...field} /></FormControl></FormItem> )} />
                <FormField control={form.control} name="address.zip" render={({ field }) => ( <FormItem><FormLabel className="text-xs">ZIP / Postal Code</FormLabel><FormControl><Input {...field} /></FormControl></FormItem> )} />
            </div>
          </div>
        </section>

        <Separator />

        {/* Employment & Tax */}
        <section className="space-y-4">
          <div className="flex items-center gap-2 text-primary font-bold uppercase text-xs tracking-widest">
            <Briefcase className="h-4 w-4" /> Employment & Tax
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="joinDate"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>This employee started working on</FormLabel>
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
            <FormField control={form.control} name="taxNumber" render={({ field }) => ( <FormItem><FormLabel>Income Tax Number</FormLabel><FormControl><Input placeholder="Optional" {...field} /></FormControl><FormMessage /></FormItem> )} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField control={form.control} name="jobTitle" render={({ field }) => ( <FormItem><FormLabel className="text-xs">Job Title (Optional)</FormLabel><FormControl><Input placeholder="e.g. Senior Assistant" {...field} /></FormControl></FormItem> )} />
            <FormField control={form.control} name="department" render={({ field }) => ( <FormItem><FormLabel className="text-xs">Department (Optional)</FormLabel><FormControl><Input placeholder="e.g. Compliance" {...field} /></FormControl></FormItem> )} />
          </div>
        </section>

        <Separator />

        {/* Compensation */}
        <section className="space-y-4">
          <div className="flex items-center gap-2 text-primary font-bold uppercase text-xs tracking-widest">
            <Landmark className="h-4 w-4" /> Compensation
          </div>

          <FormField
            control={form.control}
            name="payType"
            render={({ field }) => (
                <FormItem className="space-y-3">
                    <FormLabel>Payment Structure</FormLabel>
                    <FormControl>
                        <RadioGroup
                            onValueChange={field.onChange}
                            defaultValue={field.value}
                            className="flex gap-4"
                        >
                            <div className="flex items-center space-x-2">
                                <RadioGroupItem value="Salary" id="pay-salary" />
                                <Label htmlFor="pay-salary" className="font-medium cursor-pointer">Fixed Salary</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                                <RadioGroupItem value="Hourly" id="pay-hourly" />
                                <Label htmlFor="pay-hourly" className="font-medium cursor-pointer">Hourly Rated</Label>
                            </div>
                        </RadioGroup>
                    </FormControl>
                </FormItem>
            )}
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
            {payType === 'Salary' ? (
                <FormField control={form.control} name="basicSalary" render={({ field }) => ( 
                    <FormItem>
                        <FormLabel>Monthly Basic Salary</FormLabel>
                        <FormControl><Input type="number" step="0.01" {...field} /></FormControl>
                        <FormMessage />
                    </FormItem> 
                )} />
            ) : (
                <FormField control={form.control} name="hourlyRate" render={({ field }) => ( 
                    <FormItem>
                        <FormLabel>Rate Per Hour (R)</FormLabel>
                        <FormControl><Input type="number" step="0.01" {...field} /></FormControl>
                        <FormMessage />
                    </FormItem> 
                )} />
            )}

            <FormField control={form.control} name="isNetSalary" render={({ field }) => (
                <FormItem className={cn(
                    "flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm h-10",
                    payType === 'Hourly' && "opacity-50 pointer-events-none"
                )}>
                    <div className="space-y-0.5">
                        <FormLabel className="text-xs font-bold">Gross-up Net Salary?</FormLabel>
                    </div>
                    <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} disabled={payType === 'Hourly'} />
                    </FormControl>
                </FormItem>
            )} />
          </div>

          <FormField control={form.control} name="paymentFrequency" render={({ field }) => (
            <FormItem>
              <FormLabel>Payment Frequency</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value || 'Monthly'}>
                <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                <SelectContent>
                  <SelectItem value="Monthly">Monthly</SelectItem>
                  <SelectItem value="Fortnightly">Fortnightly</SelectItem>
                  <SelectItem value="Weekly">Weekly</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )} />
        </section>

        <Separator />

        {/* Banking Details */}
        <section className="space-y-4">
          <div className="flex items-center gap-2 text-primary font-bold uppercase text-xs tracking-widest">
            <Hash className="h-4 w-4" /> Banking Details
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
            {employee?.id ? 'Update Employee' : 'Confirm & Save'}
          </Button>
        </div>
      </form>
    </Form>
  );
}
