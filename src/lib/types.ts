export type DocumentUpload = {
  serviceId: string;
  requirementLabel: string;
  type: 'file' | 'text';
  fileUrl?: string;
  fileName?: string;
  textValue?: string;
  uploadedAt: any; // Firestore Timestamp
  status: 'pending' | 'approved' | 'rejected';
  rejectionReason?: string;
};

export type Service = {
  id: string;
  slug: string;
  title: string;
  description: string;
  longDescription: string;
  price: number;
  isPriceTbc?: boolean;
  resellerPrice?: number;
  imageUrl: string;
  imageHint: string;
  seoImageUrl?: string;
  seoImageLabel?: string;
  category: string;
  department?: 'Accounting and Tax' | 'Administration' | 'CAP';
  whatsIncluded: string[];
  turnaroundTime: string;
  clientRequirements: string[];
  informationToProvide: {
    label: string;
    type?: 'text' | 'pdf';
  }[];
  attachmentUrl?: string;
  metaTitle?: string;
  metaDescription?: string;
  metaKeywords?: string[];
  // Google Merchant Center & SEO Fields
  currency?: string;
  availability?: 'in_stock' | 'out_of_stock' | 'preorder';
  condition?: 'new' | 'refurbished' | 'used';
  brand?: string;
  product_type?: string;
  google_product_category?: string;
  returnPolicyCategory?: string;
  // Schema Overrides
  schemaType?: 'Product' | 'Service';
  enableAggregateRating?: boolean;
  aggregateRatingValue?: number;
  reviewCount?: number;
  priceValidUntilOverride?: string;
};

export type BlogPost = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  imageUrl: string;
  imageHint: string;
  author: string;
  date: string;
  metaTitle?: string;
  metaDescription?: string;
  metaKeywords?: string[];
  relatedProducts?: string[];
  seoImageUrl?: string;
  seoImageLabel?: string;
};

export type FAQ = {
  id:string;
  question: string;
  answer: string;
};

export type KnowledgeBaseItem = {
  id: string;
  question: string;
  answer: string;
}

export type CartItem = {
  service: Service;
  quantity: number;
};

export type OrderNote = {
  text: string;
  date: any;
  authorId: string;
  type?: 'note' | 'email';
  subject: string | null;
  attachments?: { name: string; url: string }[] | null;
  attachmentUrl?: string | null; // For legacy single attachments
  attachmentName?: string | null; // For legacy single attachments
};

export type ItnLog = {
  receivedAt: any;
  status: 'Success' | 'Failed';
  message: string;
  payload: { [key: string]: any };
};

export type OrderStatusHistoryEntry = {
  status: 'Pending Payment' | 'Processing' | 'Completed' | 'Cancelled' | 'Outsourced';
  changedAt: any; // Firestore Timestamp
  changedBy: string; // userId or 'system' or 'payfast_itn'
  changedByName: string; // user.name or 'System' or 'PayFast ITN'
  notes?: string;
};

export type Order = {
  id: string;
  userId?: string | null;
  resellerId?: string | null;
  customerName: string;
  customerEmail: string;
  customerPhone?: string | null;
  endCustomerName?: string | null; 
  endCustomerEmail?: string | null; 
  date: any;
  items: any[];
  total: number;
  discountCode: string | null;
  discountAmount: number | null;
  paymentMethod?: string;
  clientTotal?: number;
  status: 'Pending Payment' | 'Processing' | 'Completed' | 'Cancelled' | 'Outsourced';
  isOutsourced?: boolean;
  assignedTo?: string[] | null;
  department?: 'Accounting and Tax' | 'Administration' | 'CAP' | null;
  originalOrderId?: string | null;
  notes?: OrderNote[];
  documentUploads?: DocumentUpload[];
  itnHistory?: ItnLog[];
  statusHistory?: OrderStatusHistoryEntry[];
  source?: 'Client' | 'Staff' | 'Partner' | 'AI Accountant Signup' | 'Partner Landing Page' | 'Franchise';
  renewalForClientId?: string;
  documentContact?: 'partner' | 'client' | 'reseller';
};

export type Invoice = {
  id: string;
  customerId: string;
  invoiceDate: any; // Firestore Timestamp
  dueDate: any; // Firestore Timestamp
  lineItems: { 
    accountId: string;
    description: string; 
    quantity: number; 
    rate: number;
    vatType: string;
  }[];
  notes?: string;
  subtotal: number;
  vat: number;
  total: number;
  status: 'draft' | 'sent' | 'paid' | 'overdue' | 'final';
  createdAt: any;
};

export type SubscriptionData = {
    serviceLevel: 'free' | 'ai_addon' | 'monthly_non_vat' | 'monthly_vat';
    extraUsers: number;
    includeSubmissions: boolean;
    includePayslips: boolean;
    payslipCount: number;
    includeCatchUp: boolean;
    monthlyTotal: number;
    catchUpFee: number;
    subscriptionEndDate?: any; // Firestore Timestamp
    subscriptionStatus?: 'active' | 'lapsed';
    lastBillingDate?: any; // Firestore Timestamp for recurring deductions
};

export type SavedReport = {
  id: string;
  name: string;
  dateRange?: {
    from: string;
    to: string;
  } | null;
  comparativeDateRange?: {
    from: string;
    to: string;
  } | null;
};

export type PartnerLandingPageConfig = {
  enabled: boolean;
  slug: string;
  heroTitle: string;
  heroSubtitle: string;
  aboutUs: string;
  themePreset?: 'custom' | 'my_accountant' | 'futuristic' | 'tech_blue';
  primaryColor: string;
  secondaryColor?: string;
  backgroundColor?: string;
  textColor?: string;
  cardBackgroundColor?: string;
  cardBorderColor?: string;
  buttonColor?: string;
  buttonTextColor?: string;
  buttonStyle?: 'solid' | 'outline';
  showLogo?: boolean;
  hideHeaderBranding?: boolean;
  logoUrl?: string;
  logoHeight?: number;
  heroImageUrl?: string;
  heroOverlayOpacity?: number;
  heroLayout?: 'centered' | 'split-left' | 'split-right' | 'background';
  heroTextPosition?: 'inside' | 'below';
  refundPolicy?: string;
  popiaPolicy?: string;
  termsAndConditions?: string;
  heroTitleColor?: string;
  heroSubtitleColor?: string;
  showServicesHero?: boolean;
  servicesHeroImageUrl?: string;
  servicesHeroOverlayOpacity?: number;
  servicesHeroLayout?: 'centered' | 'split-left' | 'split-right' | 'background';
  servicesHeroTitle?: string;
  servicesHeroSubtitle?: string;
  servicesHeroTextPosition?: 'inside' | 'below';
  metaTitle?: string;
  metaDescription?: string;
};

export type FranchiseConfig = {
    areaSlug: string;
    areaName: string;
    royaltyPercentage: number;
    setupFeePaid: boolean;
};

export type User = {
  uid: string; // Firebase Authentication UID
  id: string; // Document ID
  name: string;
  surname?: string;
  email: string;
  role: 'client' | 'admin' | 'staff' | 'partner' | 'ai_accountant' | 'cap_staff' | 'cap_supervisor' | 'partner_staff' | 'franchisee';
  createdAt?: any;
  source?: 'AI Accountant' | 'Client Management' | 'Partner Management' | 'AI Payroll' | 'Franchise';
  clientSource?: 'admin' | 'partner' | 'ai_accountant' | 'ai_payroll';
  department?: 'Accounting and Tax' | 'Administration' | 'CAP' | string;
  departments?: string[]; 
  entityType?: 'Company' | 'Trust' | 'Individual';
  status?: 'Active' | 'Inactive' | 'Archived' | 'Pending Setup Payment';
  partnerId?: string; 
  companyName?: string;
  contactPerson?: string;
  contactEmail?: string;
  contactNumber?: string;
  creditBalance?: number;
  geminiApiKey?: string;
  address?: {
      street?: string;
      suburb?: string;
      city?: string;
      province?: string;
      zip?: string;
  },
  bankingDetails?: {
    bankName?: string;
    accountHolder?: string;
    accountNumber?: string;
    branchCode?: string;
  },
  smtpDetails?: {
    host?: string;
    port?: string;
    user?: string;
    pass?: string;
  },
  imapDetails?: {
    host?: string;
    port?: string;
    user?: string;
    pass?: string;
    secure?: boolean;
  },
  wantsOutsourcedWork?: boolean;
  cvUrl?: string;
  certificateUrl?: string;
  capableServices?: string[];
  yearEnd?: any;
  cipcDueDate?: any;
  preparesFinancials?: boolean;
  requiresManagementAccounts?: boolean;
  managementAccountsFrequency?: 'Monthly' | 'Quarterly' | 'Bi-Annually' | 'Annually';
  preparesManagementAccounts?: boolean;
  managementAccountsDay?: number;
  isVatRegistered?: boolean;
  vatNumber?: string | null;
  vatCategory?: 'A' | 'B' | 'C' | null;
  preparesPayroll?: boolean;
  payrollDay?: number;
  payrollDueDate?: any;
  submitsEmp201?: boolean;
  submitsEmp501?: boolean;
  submitsProvisionalTax?: boolean;
  submitsIncomeTax?: boolean;
  submitsAnnualReturns?: boolean;
  submitsBeneficialOwnership?: boolean;
  complianceDueDate?: string;
  sharedWith?: string[];
  enableInvoicing?: boolean;
  logoUrl?: string;
  nextInvoiceNumber?: number;
  archivedNotifications?: string[];
  emailSignature?: string;
  savedReports?: SavedReport[];
  landingPage?: PartnerLandingPageConfig;
  archivedNotificationsClient?: string[];
  monthlyRetainerFee?: number;
  registrationNumber?: string;
  payeReference?: string;
  firstProcessingMonth?: string;
  excludeSdl?: boolean;
  payrollFrequency?: 'Monthly' | 'Weekly' | 'Fortnightly';
  firstRunStartDate?: any;
  franchise?: FranchiseConfig;
  subscription?: SubscriptionData;
  allocationRules?: AllocationRule[];
  disableGlobalRules?: boolean;
  chartOfAccounts?: ChartOfAccount[];
  isBlankProfile?: boolean;
};

export type DiscountCode = {
  id: string; // The code itself
  percentage: number;
  status: 'active' | 'used';
  clientEmail: string;
  orderId?: string;
  createdAt: any;
  usedAt?: any;
};

export type TaskComment = {
  text: string;
  date: any;
  authorId: string;
};

export type Task = {
  id: string;
  title: string;
  description: string;
  assignedTo: string[];
  createdBy: string;
  createdAt: any;
  dueDate: any;
  priority: 'High' | 'Medium' | 'Low';
  status: 'To-Do' | 'In Progress' | 'Review' | 'Done';
  department?: string;
  recurrence?: 'None' | 'Daily' | 'Weekly' | 'Monthly' | 'Bi-Monthly' | 'Semi-Annually' | 'Annually';
  type?: string;
  orderId?: string;
  clientId?: string;
  clientSource?: 'admin' | 'partner' | 'ai_accountant' | 'system' | 'ai_payroll';
  partnerId?: string; 
  comments?: TaskComment[];
  tags?: string[];
  triggerField?: string;
  vatCategory?: 'A' | 'B' | 'C';
  dueMonthOffset: number;
  dueDay: number;
};

export type DemoLead = {
  id: string;
  name: string;
  surname: string;
  email: string;
  cell: string;
  createdAt: any;
};

import { z } from 'zod';

export const FindStoryNameInputSchema = z.object({
  commissionNumber: z.string().describe('The commission number to search for.'),
  knowledgeBase: z.string().describe('A block of text containing mappings of commission numbers to story names. Each entry is typically on a new line, e.g., "CM-123\tMy Story Name".'),
});
export type FindStoryNameInput = z.infer<typeof FindStoryNameInputSchema>;

export const FindStoryNameOutputSchema = z.object({
  storyName: z.string().optional().describe('The corresponding story name found in the knowledge base. Returns nothing if no match is found.'),
});
export type FindStoryNameOutput = z.infer<typeof FindStoryNameOutputSchema>;

export interface ExtractedInvoice {
  supplier: string;
  invoiceNumber: string;
  date: string;
  invoiceTotal: number;
}

export interface ClientCustomer {
  id: string;
  name: string;
  vatNumber?: string;
  contactPerson?: string;
  email?: string;
  cellNumber?: string;
  address?: string;
  street?: string;
  suburb?: string;
  city?: string;
  country?: string;
  zip?: string;
}

export interface Supplier {
  id: string;
  name: string;
  vatNumber?: string;
  email?: string;
  contactNumber?: string;
}

export interface Employee {
  id?: string;
  name: string;
  surname: string;
  employeeCode: string;
  idNumber: string;
  bankingDetails?: {
    bankName?: string;
    accountHolder?: string;
    accountNumber?: string;
    branchCode?: string;
    accountType?: string;
  };
  address?: {
    street?: string;
    suburb?: string;
    city?: string;
    province?: string;
    zip?: string;
  };
  payType: 'Salary' | 'Hourly';
  hourlyRate?: number;
  isNetSalary?: boolean;
  initials?: string;
  cellNumber?: string;
  email?: string;
  jobTitle?: string;
  department?: string;
  joinDate?: any;
  taxNumber?: string;
  basicSalary?: number;
  status?: string;
}

export interface PayslipItem {
  label: string;
  amount: number;
  isStatutory?: boolean;
}

export interface Payslip {
  id?: string;
  employeeId?: string;
  period?: string;
  earnings: PayslipItem[];
  deductions: PayslipItem[];
  contributions: PayslipItem[];
  fringeBenefits: PayslipItem[];
  grossPay: number;
  netPay: number;
  hoursWorked?: number;
  frequency?: string;
  status?: string;
  employeeName?: string;
  date?: any;
  totalDeductions?: number;
}

export interface AllocationRule {
  id: string;
  pattern: string;
  accountId: string;
  vatType: string;
  descriptionOverride?: string;
  description?: string;
  keywords?: string[] | string;
  priority?: number;
  accountType?: string;
}

export interface ChartOfAccount {
  id: string;
  code?: string;
  name?: string;
  type?: string;
  category?: string;
  accountNumber: string;
  description: string;
  section: 'Income Statement' | 'Balance Sheet' | string;
}

export type VatType = 
  | 'standard_rated_sales'
  | 'zero_rated_sales'
  | 'exempt_sales'
  | 'standard_rated_purchases'
  | 'capital_goods_purchases'
  | 'zero_rated_purchases'
  | 'exempt_purchases'
  | 'no_vat';

export interface ImportedTransaction {
  id: string;
  date: any;
  description: string;
  amount: number;
  reference?: string;
  merchantKey?: string;
  isExpense?: boolean;
  cleanDescription?: string;
  vatType?: string;
  vatAmount?: number;
  netAmount?: number;
  allocatedTo?: { value: string; type: 'account' | 'supplier' | 'customer' };
  status?: string;
  smartAllocationResult?: SmartAllocationResult;
  clientComment?: string;
  allocationSource?: string;
  ruleId?: string;
  matchedRuleId?: string;
  matchedKeyword?: string;
  bankAccountId?: string;
  auditFiles?: { name: string; url: string }[];
}

export interface AllocatedTransaction extends ImportedTransaction {
  accountId: string;
  vatType: string;
  vatAmount: number;
  netAmount: number;
  allocationSource: 'rule' | 'ai' | 'manual';
  confidence?: number;
  ruleId?: string;
}

export interface SmartAllocationResult {
  accountId: string;
  vatType: string;
  confidence: number;
  reasoning?: string;
  summary?: string;
  suggestedKeyword?: string;
  accountType?: string;
  ruleId?: string;
  matchedRuleId?: string;
  matchedKeyword?: string;
}
