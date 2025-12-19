
'use client';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { ReactNode } from 'react';

interface HolidayClosureDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  trigger: ReactNode;
}

export default function HolidayClosureDialog({ open, onOpenChange, onConfirm, trigger }: HolidayClosureDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      {trigger}
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Festive Season Closure Notice</AlertDialogTitle>
          <AlertDialogDescription>
            Please note that our offices are closed for the festive season. We will reopen and begin processing all new orders on <strong>5 January 2025</strong>.
            <br /><br />
            You can still complete your purchase to secure your order, and we will attend to it as a priority when we return.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>
            I Understand, Proceed
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
