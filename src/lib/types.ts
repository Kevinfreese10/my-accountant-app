export type VatType =
  // Output Tax
  | 'standard_rated_sales'
  | 'zero_rated_sales'
  | 'exempt_sales'
  // Input Tax
  | 'standard_rated_purchases'
  | 'capital_goods_purchases'
  | 'zero_rated_purchases'
  | 'exempt_purchases'
  | 'no_vat';

export type ChartOfAccount = {
  id: string;
  accountNumber: string;
  description: string;
  section: 'Income Statement' | 'Balance Sheet';
};

export type AllocationRule = {
  id:string;
  type: 'hard' | 'soft';
  description: string; // Used for soft rules, or as a note for hard rules
  keywords: string[]; // Only for hard rules
  accountId: string;
  vatType: VatType;
  scope?: 'client' | 'global';
  priority?: number;
};

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
  // Google Merchant Center Fields
  currency?: string;
  availability?: 'in_stock' | 'out_of_stock' | 'preorder';
  condition?: 'new' | 'refurbished' | 'used';
  brand?: string;
  product_type?: string;
  google_product_category?: string;
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
  attachments: { name: string; url: string }[] | null;
  attachmentUrl?: string | null; // For legacy single attachments
  attachmentName?: string | null; // For legacy single attachments
};

export type ItnLog = {
  receivedAt: any;
  status: 'Success' | 'Failed';
  message: string;
  payload: { [key: string]: any };
};

export type Order = {
  id: string;
  userId?: string | null;
  resellerId?: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  endCustomerName?: string; // Added for partner's client
  endCustomerEmail?: string; // Added for partner's client
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
  source?: 'Client' | 'Staff' | 'Partner' | 'AI Accountant Signup' | 'Partner Landing Page';
  renewalForClientId?: string;
  documentContact?: 'partner' | 'client';
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
};

export type User = {
  uid: string; // Firebase Authentication UID
  id: string; // Document ID
  name: string;
  surname?: string;
  email: string;
  role: 'client' | 'admin' | 'staff' | 'partner' | 'ai_accountant' | 'cap_staff' | 'cap_supervisor' | 'partner_staff';
  createdAt?: any;
  source?: 'AI Accountant' | 'Client Management' | 'Partner Management' | 'AI Payroll';
  clientSource?: 'admin' | 'partner' | 'ai_accountant' | 'ai_payroll';
  department?: 'Accounting and Tax' | 'Administration' | 'CAP' | string;
  departments?: string[]; // Practice custom departments
  entityType?: 'Company' | 'Trust' | 'Individual';
  status?: 'Active' | 'Inactive' | 'Archived' | 'Pending Setup Payment';
  partnerId?: string; // Links staff or clients to a partner
  // Partner specific fields or contact person for AI Accountant
  companyName?: string;
  contactPerson?: string;
  contactEmail?: string;
  contactNumber?: string;
  creditBalance?: number;
  geminiApiKey?: string; // BYOK for Gemini
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
  // Client specific fields for task automation & AI Accountant
  yearEnd?: any;
  cipcDueDate?: any;
  preparesFinancials?: boolean;
  requiresManagementAccounts?: boolean;
  managementAccountsFrequency?: 'Monthly' | 'Quarterly' | 'Bi-Annually' | 'Annually';
  preparesManagementAccounts?: boolean;
  managementAccountsDay?: number;
  isVatRegistered?: boolean;
  vatNumber?: string;
  vatCategory?: 'A' | 'B' | 'C';
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
  chartOfAccounts?: ChartOfAccount[];
  allocationRules?: AllocationRule[];
  hasNumeraProfile?: boolean;
  subscription?: SubscriptionData;
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
  // Payroll specific fields
  registrationNumber?: string;
  payeReference?: string;
  firstProcessingMonth?: string;
  excludeSdl?: boolean;
};

export type ClientCustomer = {
    id: string;
    name: string;
    contactPerson?: string;
    email?: string;
    cellNumber?: string;
    address?: string;
    street?: string;
    suburb?: string;
    city?: string;
    country?: string;
    zip?: string;
    vatNumber?: string;
}

export type Supplier = {
  id: string;
  name: string;
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
  recurrence?: 'None' | 'Daily' | 'Weekly' | 'Monthly' | 'Bi-Monthly' | 'Semi-Annually' | 'Annually';
  type?: string;
  orderId?: string;
  clientId?: string;
  clientSource?: 'admin' | 'partner' | 'ai_accountant' | 'system' | 'ai_payroll';
  partnerId?: string; // Tracks which partner practice this task belongs to
  comments?: TaskComment[];
  tags?: string[];
  triggerField?: string;
  vatCategory?: 'A' | 'B' | 'C';
  dueMonthOffset: number;
  dueDay: number;
};

export type SmartAllocationResult = {
  ruleId?: string;
  accountId: string;
  vatType: VatType;
  confidence: number;
  summary?: string;
  suggestedKeyword?: string;
  matchedKeyword?: string;
};

export type ImportedTransaction = {
    id: string;
    clientId: string;
    date: string;
    reference: string;
    description: string;
    rawDescription: string;
    cleanDescription: string;
    clientComment?: string;
    merchantKey?: string;
    merchantKey2?: string;
    cleaningVersion?: string;
    paymentChannel?: "CARD" | "EFT" | "DEBIT_ORDER" | "ATM" | "TRANSFER" | "UNKNOWN";
    confidence?: 'HIGH' | 'MEDIUM' | 'LOW';
    confidenceScore?: number;
    amount: number;
    isExpense: boolean;
    bankAccountId: string;
    status: 'new' | 'allocated' | 'review' | 'reviewed' | 'ai_processing' | 'ai_review';
    allocatedTo?: { 
        value: string;
        type: 'account' | 'customer' | 'supplier';
    };
    vatType?: VatType;
    allocationSource?: 'rule' | 'manual' | 'ai' | 'history' | 'global_db';
    matchType?: 'exact' | 'alias' | 'fuzzy' | 'manual';
    matchedOn?: string;
    matchedRuleId?: string;
    matchedRuleDescription?: string;
    matchedKeyword?: string;
    auditFiles?: { name: string; url: string; }[];
    smartAllocationResult?: SmartAllocationResult;
};

export type AllocatedTransaction = {
    id: string;
    clientId: string;
    date: string;
    reference: string;
    description: string;
    amount: number;
    isExpense: boolean;
    bankAccountId: string;
    allocatedTo: {
        value: string;
        type: 'account' | 'customer' | 'supplier';
    };
    vatType: VatType;
    vatAmount: number;
    status: 'allocated';
    allocatedAt: any; // Using `any` for Firestore Timestamp compatibility
    extractedSupplier?: string;
    auditFiles?: { name: string; url: string; }[];
    allocationSource?: 'rule' | 'manual' | 'ai' | 'history' | 'global_db';
    matchedRuleId?: string;
    matchedRuleDescription?: string;
    matchedKeyword?: string;
};

export type ExtractedInvoice = {
  id: string;
  supplier: string;
  invoiceNumber: string;
  date: string;
  lineItems: { 
    description: string; 
    exclusiveAmount: number; 
    vatAmount: number; 
    accountId?: string;
    paye?: boolean;
  }[];
  invoiceTotal: number;
  status: 'pending_review' | 'approved' | 'approved_for_payment' | 'rejected' | 'batched_for_payment' | 'duplicate';
  fileName: string;
  fileUrl: string;
  createdAt: any;
  uploadedBy: string;
  expenseType?: 'CAP' | 'S38';
  commissionNumber?: string;
  storyName?: string;
  rejectionReason?: string;
  paymentBatch?: 'this_week' | 'month_end';
  sourceEmailUid?: number;
  proofOfPaymentUrl?: string;
};

export type AIAllocationJob = {
    id: string;
    clientId: string;
    status: 'running' | 'completed' | 'stopped' | 'failed';
    total: number;
    processed: number;
    createdAt: any;
    completedAt?: any;
    error?: string;
}

export type ProcessedEmail = {
  id: string; // Hash of messageId
  uid: number; // IMAP UID
  messageId: string;
  mailbox: string;
  date: any; // Firestore Timestamp
  from: { name: string; address: string };
  to: { name: string; address: string }[];
  subject: string;
  snippet: string;
  text: string;
  html: string;
  status: 'new' | 'processed' | 'archived';
  ownerId: string;
  attachments?: {
    filename: string;
    contentType: string;
    size: number;
    dataUrl: string;
  }[];
  // AI-generated fields
  aiSummary?: string;
  aiCategory?: 'Account issues' | 'Tax preparation' | 'Service inquiry' | 'Document upload' | 'Spam/Promo' | 'Other';
  aiPriority?: 'High' | 'Medium' | 'Low';
  aiSuggestedAction?: 'create_task' | 'draft_reply' | 'archive' | 'none';
  aiTask?: {
    title: string;
    description: string;
  };
  aiDraftReply?: string | null;
  taskCreated?: boolean;
  replySent?: boolean;
};

export type CVLead = {
  id: string;
  email?: string;
  name?: string;
  role: string;
  score: number;
  analysis: any;
  cvUrl?: string;
  createdAt: any;
};

export type DemoLead = {
  id: string;
  name: string;
  surname: string;
  email: string;
  cell: string;
  createdAt: any;
};

export type Employee = {
  id: string;
  employeeCode: string;
  initials: string;
  name: string; // First Name
  surname: string;
  idNumber: string; // RSA ID Number
  address: {
    street?: string;
    suburb?: string;
    city?: string;
    province?: string;
    zip?: string;
  };
  cellNumber: string;
  email: string;
  jobTitle: string;
  department: string;
  joinDate: any; // Started working on (Timestamp)
  taxNumber: string; // Income Tax Number
  basicSalary: number;
  paymentFrequency: 'Monthly' | 'Weekly' | 'Bi-Weekly';
  bankingDetails: {
    bankName: string;
    accountNumber: string;
    accountType: string;
    branchCode: string;
  };
  status: 'Active' | 'Inactive';
};

export type Payslip = {
  id: string;
  employeeId: string;
  employeeName: string;
  period: string; // e.g. "February 2024"
  date: any; // Timestamp
  earnings: {
    basic: number;
    overtime?: number;
    bonus?: number;
    allowances?: number;
  };
  deductions: {
    paye: number;
    uif: number;
    sdl?: number;
    pension?: number;
    medicalAid?: number;
  };
  netPay: number;
};

export type LeaveRequest = {
  id: string;
  employeeId: string;
  type: 'Annual' | 'Sick' | 'Family Responsibility' | 'Maternity' | 'Unpaid';
  startDate: any;
  endDate: any;
  status: 'Pending' | 'Approved' | 'Rejected';
  reason?: string;
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
