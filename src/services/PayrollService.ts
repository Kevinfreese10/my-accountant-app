import { getFirestore, doc, getDoc, collection, addDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { User, Employee, Payslip, PayslipItem } from '@/lib/types';

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
   * SA Tax Year starts in March. March 2026 is the start of Tax Year 2027.
   */
  static getTaxConfig(period?: string) {
    if (period) {
      const parts = period.split(' ');
      const monthIdx = MONTHS.indexOf(parts[0]);
      const year = parseInt(parts[1]);
      
      if (monthIdx !== -1 && !isNaN(year)) {
        // March or later belongs to the NEXT year's tax season
        const taxYear = monthIdx >= 2 ? (year + 1).toString() : year.toString();
        return TAX_YEAR_CONFIGS[taxYear] || TAX_YEAR_CONFIGS['2026'];
      }
    }
    return TAX_YEAR_CONFIGS['2026'];
  }

  /**
   * Calculates monthly PAYE based on basic salary and period.
   */
  static calculatePaye(monthlyBasic: number, period?: string): number {
    const config = this.getTaxConfig(period);
    const annualGross = monthlyBasic * 12;
    let annualTax = 0;

    const bracket = [...config.brackets].reverse().find(b => annualGross > b.threshold);
    
    if (bracket) {
      annualTax = bracket.base + (annualGross - bracket.threshold) * bracket.rate;
    } else {
      annualTax = annualGross * config.brackets[0].rate;
    }

    const netAnnualTax = Math.max(0, annualTax - config.rebate);
    return parseFloat((netAnnualTax / 12).toFixed(2));
  }

  /**
   * Calculates monthly UIF (1% of gross, capped).
   */
  static calculateUif(monthlyBasic: number, period?: string): number {
    const config = this.getTaxConfig(period);
    const uif = monthlyBasic * 0.01;
    return parseFloat(Math.min(uif, config.uifLimit).toFixed(2));
  }

  /**
   * Calculates Gross from a desired Net amount using iterative approximation.
   */
  static calculateGrossFromNet(targetNet: number, period?: string): number {
    if (targetNet <= 0) return 0;
    
    let low = targetNet;
    let high = targetNet * 2;
    let mid = (low + high) / 2;
    let iterations = 0;
    
    while (iterations < 50) {
      const currentPaye = this.calculatePaye(mid, period);
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
   * Generates and saves a payslip for an employee using the new structured format.
   */
  static async generateInitialPayslip(clientId: string, employeeId: string, monthlyBasic: number) {
    try {
      const clientRef = doc(db, 'aiPayrollClients', clientId);
      const clientSnap = await getDoc(clientRef);
      if (!clientSnap.exists()) throw new Error("Client not found");
      const client = clientSnap.data() as User;
      const period = client.firstProcessingMonth;

      const employeeRef = doc(db, 'aiPayrollClients', clientId, 'employees', employeeId);
      const employeeSnap = await getDoc(employeeRef);
      if (!employeeSnap.exists()) throw new Error("Employee not found");
      const employee = employeeSnap.data() as Employee;

      // Handle gross-up if employee is on Net Salary agreement
      let effectiveGross = monthlyBasic;
      if (employee.isNetSalary) {
          effectiveGross = this.calculateGrossFromNet(monthlyBasic, period);
      }

      const paye = this.calculatePaye(effectiveGross, period);
      const uif = this.calculateUif(effectiveGross, period);
      const sdl = client.excludeSdl ? 0 : parseFloat((effectiveGross * 0.01).toFixed(2));

      const earnings: PayslipItem[] = [
          { label: 'Basic salary', amount: effectiveGross }
      ];

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

      const totalEarnings = earnings.reduce((sum, i) => sum + i.amount, 0);
      const totalDeductions = deductions.reduce((sum, i) => sum + i.amount, 0);

      const payslipData: Omit<Payslip, 'id'> = {
        employeeId,
        employeeName: `${employee.name} ${employee.surname}`,
        period: period || 'Current Period',
        date: Timestamp.now(),
        earnings,
        deductions,
        contributions,
        fringeBenefits: [],
        grossPay: totalEarnings,
        totalDeductions,
        netPay: parseFloat((totalEarnings - totalDeductions).toFixed(2)),
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
