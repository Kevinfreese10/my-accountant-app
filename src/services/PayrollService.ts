import { getFirestore, doc, getDoc, collection, addDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { User, Employee, Payslip, PayslipItem } from '@/lib/types';
import { format, addDays, isValid, parse } from 'date-fns';

const db = getFirestore(firebaseApp);

/**
 * South African Tax Year Configurations
 */
const TAX_YEAR_CONFIGS: Record<string, { rebate: number; uifLimit: number; brackets: { threshold: number; base: number; rate: number }[] }> = {
  '2026': {
    rebate: 17235,
    uifLimit: 177.12, // Monthly cap (1% of R17,712)
    brackets: [
      { threshold: 0, base: 0, rate: 0.18 },
      { threshold: 237100, base: 42678, rate: 0.26 },
      { threshold: 370500, base: 77362, rate: 0.31 },
      { threshold: 512800, base: 121475, rate: 0.36 },
      { threshold: 673000, base: 179147, rate: 0.39 },
      { threshold: 857900, base: 251258, rate: 0.41 },
      { threshold: 1817000, base: 644489, rate: 0.45 },
    ],
  },
  '2027': {
    rebate: 18010,
    uifLimit: 177.12, 
    brackets: [
      { threshold: 0, base: 0, rate: 0.18 },
      { threshold: 247750, base: 44595, rate: 0.26 },
      { threshold: 387150, base: 80839, rate: 0.31 },
      { threshold: 535850, base: 126936, rate: 0.36 },
      { threshold: 703300, base: 187218, rate: 0.39 },
      { threshold: 896500, base: 262566, rate: 0.41 },
      { threshold: 1898750, base: 673488, rate: 0.45 },
    ],
  }
};

const MONTHS = [ "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December" ];

export class PayrollService {
  /**
   * Helper to convert frequency string to numeric multiplier.
   */
  static getFrequencyMultiplier(freq?: string): number {
    if (freq === 'Fortnightly') return 26;
    return 12;
  }

  /**
   * Identifies the tax year based on the period string (e.g. "March 2026" or "06/03/2026")
   */
  static getTaxConfig(period?: string) {
    if (!period) return TAX_YEAR_CONFIGS['2026'];
    
    let monthIdx = -1;
    let year = 2026;

    // Try parsing as "Month Year" (Monthly)
    const monthYearParts = period.split(' ');
    if (monthYearParts.length >= 2) {
      monthIdx = MONTHS.indexOf(monthYearParts[0]);
      year = parseInt(monthYearParts[1]);
    } else {
      // Try parsing as DD/MM/YYYY (Fortnightly)
      const dateParts = period.split('/');
      if (dateParts.length === 3) {
        monthIdx = parseInt(dateParts[1]) - 1;
        year = parseInt(dateParts[2]);
      }
    }
    
    if (monthIdx !== -1 && !isNaN(year)) {
      // South African tax year runs from March to Feb.
      const taxYear = monthIdx >= 2 ? (year + 1).toString() : year.toString();
      return TAX_YEAR_CONFIGS[taxYear] || TAX_YEAR_CONFIGS['2026'];
    }

    return TAX_YEAR_CONFIGS['2026'];
  }

  /**
   * Parses a period label like "March 2026" or "06/03/2026" into a Date object.
   */
  static getPeriodDate(period?: string): Date {
    if (!period) return new Date();
    
    // Check if it's a date string (DD/MM/YYYY)
    if (period.includes('/')) {
        const parsed = parse(period, 'dd/MM/yyyy', new Date());
        return isValid(parsed) ? parsed : new Date();
    }

    const base = period.split(' - ')[0];
    const parts = base.split(' ');
    if (parts.length < 2) return new Date();
    const monthName = parts[0];
    const year = parseInt(parts[1]);
    const monthIdx = MONTHS.indexOf(monthName);
    return new Date(year, monthIdx !== -1 ? monthIdx : 0, 1);
  }

  /**
   * Calculates PAYE based on earnings.
   */
  static calculatePaye(periodEarnings: number, period?: string, frequency: number = 12): number {
    const config = this.getTaxConfig(period);
    const annualGross = periodEarnings * frequency;
    let annualTax = 0;

    const bracket = [...config.brackets].reverse().find(b => annualGross > b.threshold);
    
    if (bracket) {
      annualTax = bracket.base + (annualGross - bracket.threshold) * bracket.rate;
    } else {
      annualTax = annualGross * config.brackets[0].rate;
    }

    const netAnnualTax = Math.max(0, annualTax - config.rebate);
    return parseFloat((netAnnualTax / frequency).toFixed(2));
  }

  /**
   * Calculates UIF (1% of gross, capped).
   */
  static calculateUif(periodEarnings: number, period?: string, frequency: number = 12): number {
    const config = this.getTaxConfig(period);
    const uifRaw = periodEarnings * 0.01;
    const effectiveLimit = (config.uifLimit * 12) / frequency;
    return parseFloat(Math.min(uifRaw, effectiveLimit).toFixed(2));
  }

  /**
   * Calculates Gross from a desired Net amount using iterative approximation.
   */
  static calculateGrossFromNet(targetNet: number, period?: string, frequency: number = 12): number {
    if (targetNet <= 0) return 0;
    
    let low = targetNet;
    let high = targetNet * 2.5; // Slightly higher margin for fortnightly
    let mid = (low + high) / 2;
    let iterations = 0;
    
    while (iterations < 50) {
      const currentPaye = this.calculatePaye(mid, period, frequency);
      const currentUif = this.calculateUif(mid, period, frequency);
      const currentNet = mid - currentPaye - currentUif;
      
      if (Math.abs(currentNet - targetNet) < 0.01) break;
      
      if (currentNet < targetNet) {
        low = mid;
      } else {
        high = mid;
      }
      mid = (low + high) / 2;
      iterations++;
    }
    return parseFloat(mid.toFixed(2));
  }

  /**
   * Helper to build earnings list based on hours and rates.
   */
  static calculateEarningsList(employee: Employee, baseValue: number, basePeriod: string, frequency: number, hours?: {
      normal?: number;
      publicHoliday?: number;
      overtime15?: number;
      overtime20?: number;
      standbyAllowance?: number;
  }): PayslipItem[] {
      const earnings: PayslipItem[] = [];
      const hourlyRate = employee.hourlyRate || 0;

      if (employee.payType === 'Hourly') {
          const defaultHours = frequency === 26 ? 80 : 160;
          const normalHours = hours?.normal ?? defaultHours;
          earnings.push({ label: 'Normal Hours pay', amount: parseFloat((hourlyRate * normalHours).toFixed(2)) });
      } else {
          let periodAmount = baseValue;
          if (frequency === 26) {
              // Convert monthly salary to fortnightly (Salary * 12 / 26)
              periodAmount = (baseValue * 12) / 26;
          }

          if (employee.isNetSalary) {
              periodAmount = this.calculateGrossFromNet(periodAmount, basePeriod, frequency);
          }
          
          earnings.push({ label: frequency === 26 ? 'Fortnightly salary' : 'Basic salary', amount: parseFloat(periodAmount.toFixed(2)) });
      }

      if (hours) {
          if (hours.publicHoliday && hours.publicHoliday > 0) {
              earnings.push({ label: 'Public Holidays (2x)', amount: parseFloat((hourlyRate * 2 * hours.publicHoliday).toFixed(2)) });
          }
          if (hours.overtime15 && hours.overtime15 > 0) {
              earnings.push({ label: 'Overtime (1.5x)', amount: parseFloat((hourlyRate * 1.5 * hours.overtime15).toFixed(2)) });
          }
          if (hours.overtime20 && hours.overtime20 > 0) {
              earnings.push({ label: 'Overtime (2x)', amount: parseFloat((hourlyRate * 2 * hours.overtime20).toFixed(2)) });
          }
          if (hours.standbyAllowance && hours.standbyAllowance > 0) {
              earnings.push({ label: 'Standby Allowance', amount: hours.standbyAllowance });
          }
      }

      return earnings;
  }

  static getInitialDeductions(gross: number, period: string, frequency: number): PayslipItem[] {
      return [
          { label: 'Tax', amount: this.calculatePaye(gross, period, frequency), isStatutory: true },
          { label: 'Unemployment insurance fund', amount: this.calculateUif(gross, period, frequency), isStatutory: true }
      ];
  }

  static getInitialContributions(gross: number, period: string, frequency: number, excludeSdl: boolean): PayslipItem[] {
      const uif = this.calculateUif(gross, period, frequency);
      const contribs = [
          { label: 'Unemployment insurance fund', amount: uif, isStatutory: true }
      ];
      if (!excludeSdl) {
          contribs.push({ label: 'Skills development levy', amount: parseFloat((gross * 0.01).toFixed(2)), isStatutory: true });
      }
      return contribs;
  }

  /**
   * Generates and saves a payslip for an employee.
   */
  static async generateInitialPayslip(clientId: string, employeeId: string, baseValue: number, hours?: any) {
    try {
      const clientRef = doc(db, 'aiPayrollClients', clientId);
      const clientSnap = await getDoc(clientRef);
      if (!clientSnap.exists()) throw new Error("Client not found");
      const clientData = clientSnap.data() as User;
      
      const frequency = clientData.payrollFrequency === 'Fortnightly' ? 26 : 12;
      
      let periodLabel = '';
      if (frequency === 26) {
          const startDate = clientData.firstRunStartDate ? (clientData.firstRunStartDate.toDate ? clientData.firstRunStartDate.toDate() : new Date(clientData.firstRunStartDate)) : new Date();
          periodLabel = format(startDate, 'dd/MM/yyyy');
      } else {
          periodLabel = clientData.firstProcessingMonth || format(new Date(), 'MMMM yyyy');
      }

      const employeeRef = doc(db, 'aiPayrollClients', clientId, 'employees', employeeId);
      const employeeSnap = await getDoc(employeeRef);
      if (!employeeSnap.exists()) throw new Error("Employee not found");
      const employee = employeeSnap.data() as Employee;

      const earnings = this.calculateEarningsList(employee, baseValue, periodLabel, frequency, hours);
      const gross = earnings.reduce((sum, i) => sum + i.amount, 0);

      const deductions = this.getInitialDeductions(gross, periodLabel, frequency);
      const contributions = this.getInitialContributions(gross, periodLabel, frequency, !!clientData.excludeSdl);

      const totalDeductions = deductions.reduce((sum, item) => sum + item.amount, 0);

      const payslipData: any = {
        employeeId,
        employeeName: `${employee.name} ${employee.surname}`,
        period: periodLabel,
        date: Timestamp.now(),
        earnings,
        deductions,
        contributions,
        fringeBenefits: [],
        grossPay: gross,
        totalDeductions,
        netPay: parseFloat((gross - totalDeductions).toFixed(2)),
        frequency: clientData.payrollFrequency || 'Monthly',
        status: 'draft'
      };

      if (hours?.normal !== undefined) {
          payslipData.hoursWorked = hours.normal;
      }

      const payslipsRef = collection(db, 'aiPayrollClients', clientId, 'payslips');
      const docRef = await addDoc(payslipsRef, {
        ...payslipData,
        createdAt: serverTimestamp(),
      });

      return { success: true, id: docRef.id };
    } catch (error) {
      console.error("Payslip generation failed:", error);
      throw error;
    }
  }
}
