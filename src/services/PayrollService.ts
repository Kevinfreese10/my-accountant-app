import { getFirestore, doc, getDoc, collection, addDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { User, Employee, Payslip, PayslipItem } from '@/lib/types';
import { format } from 'date-fns';

const db = getFirestore(firebaseApp);

/**
 * South African Tax Year Configurations
 */
const TAX_YEAR_CONFIGS: Record<string, { rebate: number; uifLimit: number; brackets: { threshold: number; base: number; rate: number }[] }> = {
  '2026': {
    rebate: 17235,
    uifLimit: 177.12,
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
    rebate: 18010, // Projected adjustment
    uifLimit: 185.00, // Projected adjustment
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
   * Identifies the tax year based on the period string (e.g. "March 2026")
   */
  static getTaxConfig(period?: string) {
    if (period) {
      const parts = period.split(' ');
      const monthIdx = MONTHS.indexOf(parts[0]);
      const year = parseInt(parts[1]);
      
      if (monthIdx !== -1 && !isNaN(year)) {
        const taxYear = monthIdx >= 2 ? (year + 1).toString() : year.toString();
        return TAX_YEAR_CONFIGS[taxYear] || TAX_YEAR_CONFIGS['2026'];
      }
    }
    return TAX_YEAR_CONFIGS['2026'];
  }

  /**
   * Calculates PAYE based on earnings and frequency.
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
  static calculateUif(periodEarnings: number, period?: string): number {
    const config = this.getTaxConfig(period);
    const uif = periodEarnings * 0.01;
    return parseFloat(Math.min(uif, config.uifLimit).toFixed(2));
  }

  /**
   * Calculates Gross from a desired Net amount using iterative approximation.
   */
  static calculateGrossFromNet(targetNet: number, period?: string, frequency: number = 12): number {
    if (targetNet <= 0) return 0;
    
    let low = targetNet;
    let high = targetNet * 2;
    let mid = (low + high) / 2;
    let iterations = 0;
    
    while (iterations < 50) {
      const currentPaye = this.calculatePaye(mid, period, frequency);
      const currentUif = this.calculateUif(mid, period);
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

      // 1. Primary Pay
      if (employee.payType === 'Hourly') {
          const normalHours = hours?.normal ?? 80;
          earnings.push({ label: 'Normal Hours pay', amount: parseFloat((hourlyRate * normalHours).toFixed(2)) });
      } else {
          let gross = baseValue;
          if (employee.isNetSalary) {
              gross = this.calculateGrossFromNet(baseValue, basePeriod, frequency);
          }
          earnings.push({ label: 'Basic salary', amount: gross });
      }

      // 2. Variable Pay (Additional Hours)
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

  /**
   * Generates and saves a payslip for an employee.
   */
  static async generateInitialPayslip(clientId: string, employeeId: string, baseValue: number, runNumber: number = 1, hours?: any) {
    try {
      const clientRef = doc(db, 'aiPayrollClients', clientId);
      const clientSnap = await getDoc(clientRef);
      if (!clientSnap.exists()) throw new Error("Client not found");
      const clientData = clientSnap.data() as User;
      const basePeriod = clientData.firstProcessingMonth || format(new Date(), 'MMMM yyyy');
      
      const frequencyLabel = clientData.payrollFrequency || 'Monthly';
      const frequency = frequencyLabel === 'Monthly' ? 12 : frequencyLabel === 'Fortnightly' ? 26 : 52;
      
      const periodLabel = frequencyLabel === 'Fortnightly' 
        ? `${basePeriod} - Run ${runNumber}` 
        : basePeriod;

      const employeeRef = doc(db, 'aiPayrollClients', clientId, 'employees', employeeId);
      const employeeSnap = await getDoc(employeeRef);
      if (!employeeSnap.exists()) throw new Error("Employee not found");
      const employee = employeeSnap.data() as Employee;

      const earnings = this.calculateEarningsList(employee, baseValue, basePeriod, frequency, hours);
      const gross = earnings.reduce((sum, i) => sum + i.amount, 0);

      const paye = this.calculatePaye(gross, basePeriod, frequency);
      const uif = this.calculateUif(gross, basePeriod);
      const sdl = clientData.excludeSdl ? 0 : parseFloat((gross * 0.01).toFixed(2));

      const deductions: PayslipItem[] = [
          { label: 'Tax', amount: paye, isStatutory: true },
          { label: 'Unemployment insurance fund', amount: uif, isStatutory: true }
      ];

      const contributions: PayslipItem[] = [
          { label: 'Unemployment insurance fund', amount: uif, isStatutory: true }
      ];

      if (sdl > 0) {
          contributions.push({ label: 'Skills development levy', amount: sdl, isStatutory: true });
      }

      const totalDeductions = deductions.reduce((sum, i) => sum + i.amount, 0);

      const payslipData: Omit<Payslip, 'id'> = {
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
        hoursWorked: hours?.normal,
        runNumber: frequencyLabel === 'Fortnightly' ? (runNumber as 1 | 2) : undefined,
        frequency: frequencyLabel
      };

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
