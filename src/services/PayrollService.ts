
import { getFirestore, doc, getDoc, collection, addDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { User, Employee, Payslip } from '@/lib/types';

const db = getFirestore(firebaseApp);

/**
 * South African Tax Brackets 2024/2025
 */
const TAX_BRACKETS = [
  { threshold: 0, base: 0, rate: 0.18 },
  { threshold: 237100, base: 42678, rate: 0.26 },
  { threshold: 370500, base: 77362, rate: 0.31 },
  { threshold: 512800, base: 121475, rate: 0.36 },
  { threshold: 673000, base: 179147, rate: 0.39 },
  { threshold: 857900, base: 251258, rate: 0.41 },
  { threshold: 1817000, base: 644489, rate: 0.45 },
];

const PRIMARY_REBATE = 17235;
const UIF_LIMIT = 177.12;

export class PayrollService {
  /**
   * Calculates monthly PAYE based on basic salary.
   */
  static calculatePaye(monthlyBasic: number): number {
    const annualGross = monthlyBasic * 12;
    let annualTax = 0;

    // Find applicable bracket
    const bracket = [...TAX_BRACKETS].reverse().find(b => annualGross > b.threshold);
    
    if (bracket) {
      annualTax = bracket.base + (annualGross - bracket.threshold) * bracket.rate;
    } else {
      annualTax = annualGross * TAX_BRACKETS[0].rate;
    }

    // Apply rebate and divide by 12
    const netAnnualTax = Math.max(0, annualTax - PRIMARY_REBATE);
    return parseFloat((netAnnualTax / 12).toFixed(2));
  }

  /**
   * Calculates monthly UIF (1% of gross, capped).
   */
  static calculateUif(monthlyBasic: number): number {
    const uif = monthlyBasic * 0.01;
    return Math.min(uif, UIF_LIMIT);
  }

  /**
   * Generates and saves a payslip for an employee.
   */
  static async generateInitialPayslip(clientId: string, employeeId: string, monthlyBasic: number) {
    try {
      const clientRef = doc(db, 'aiPayrollClients', clientId);
      const clientSnap = await getDoc(clientRef);
      if (!clientSnap.exists()) throw new Error("Client not found");
      const client = clientSnap.data() as User;

      const employeeRef = doc(db, 'aiPayrollClients', clientId, 'employees', employeeId);
      const employeeSnap = await getDoc(employeeRef);
      if (!employeeSnap.exists()) throw new Error("Employee not found");
      const employee = employeeSnap.data() as Employee;

      const paye = this.calculatePaye(monthlyBasic);
      const uif = this.calculateUif(monthlyBasic);
      const sdl = client.excludeSdl ? 0 : parseFloat((monthlyBasic * 0.01).toFixed(2));

      const netPay = monthlyBasic - paye - uif;

      const payslipData: Omit<Payslip, 'id'> = {
        employeeId,
        employeeName: `${employee.name} ${employee.surname}`,
        period: client.firstProcessingMonth || 'Current Period',
        date: Timestamp.now(),
        earnings: {
          basic: monthlyBasic,
        },
        deductions: {
          paye,
          uif,
          sdl: sdl > 0 ? sdl : undefined,
        },
        netPay: parseFloat(netPay.toFixed(2)),
      };

      const payslipsRef = collection(db, 'aiPayrollClients', clientId, 'payslips');
      await addDoc(payslipsRef, {
        ...payslipData,
        createdAt: serverTimestamp(),
      });

      return { success: true };
    } catch (error) {
      console.error("Payslip generation failed:", error);
      throw error;
    }
  }
}
