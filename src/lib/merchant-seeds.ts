/**
 * Standard SA Merchant Seeds for Global Intelligence.
 * 
 * Each seed contains:
 * - canonicalName: The preferred display name.
 * - pattern: A regex pattern to match cleaned descriptions.
 * - defaultAccountId: Suggested GL account (can be overridden).
 * - defaultVatType: Standard SA VAT logic.
 */

export type MerchantSeed = {
    canonicalName: string;
    pattern: RegExp;
    categoryHint: 'TELCO' | 'RETAIL' | 'FUEL' | 'MARKETPLACE' | 'GOV' | 'FEES' | 'CASH';
};

export const merchantSeeds: MerchantSeed[] = [
    // TELCOS
    { canonicalName: 'VODACOM', pattern: /\b(VODACOM|VODA)\b/i, categoryHint: 'TELCO' },
    { canonicalName: 'MTN', pattern: /\bMTN\b/i, categoryHint: 'TELCO' },
    { canonicalName: 'TELKOM', pattern: /\bTELKOM\b/i, categoryHint: 'TELCO' },
    { canonicalName: 'RAIN', pattern: /\bRAIN\b/i, categoryHint: 'TELCO' },
    { canonicalName: 'CELL C', pattern: /\bCELL\s*C\b/i, categoryHint: 'TELCO' },

    // RETAIL / GROCERIES
    { canonicalName: 'PICK N PAY', pattern: /\b(PNP|PICK\s*N\s*PAY)\b/i, categoryHint: 'RETAIL' },
    { canonicalName: 'CHECKERS', pattern: /\bCHECKERS\b/i, categoryHint: 'RETAIL' },
    { canonicalName: 'SHOPRITE', pattern: /\bSHOPRITE\b/i, categoryHint: 'RETAIL' },
    { canonicalName: 'SPAR', pattern: /\bSPAR\b/i, categoryHint: 'RETAIL' },
    { canonicalName: 'WOOLWORTHS', pattern: /\b(WWS|WOOLWORTHS)\b/i, categoryHint: 'RETAIL' },
    { canonicalName: 'CLICKS', pattern: /\bCLICKS\b/i, categoryHint: 'RETAIL' },
    { canonicalName: 'DIS-CHEM', pattern: /\bDIS-CHEM\b/i, categoryHint: 'RETAIL' },

    // FUEL
    { canonicalName: 'SHELL', pattern: /\bSHELL\b/i, categoryHint: 'FUEL' },
    { canonicalName: 'ENGEN', pattern: /\bENGEN\b/i, categoryHint: 'FUEL' },
    { canonicalName: 'BP', pattern: /\bBP\b/i, categoryHint: 'FUEL' },
    { canonicalName: 'TOTALENERGIES', pattern: /\bTOTAL\b/i, categoryHint: 'FUEL' },
    { canonicalName: 'SASOL', pattern: /\bSASOL\b/i, categoryHint: 'FUEL' },

    // MARKETPLACES
    { canonicalName: 'TAKEALOT', pattern: /\b(TAKEALOT|TAKE\s*A\s*LOT)\b/i, categoryHint: 'MARKETPLACE' },
    { canonicalName: 'UBER', pattern: /\bUBER\b/i, categoryHint: 'MARKETPLACE' },
    { canonicalName: 'MR D FOOD', pattern: /\b(MR\s*D|MRD)\b/i, categoryHint: 'MARKETPLACE' },
    { canonicalName: 'BOLT', pattern: /\bBOLT\b/i, categoryHint: 'MARKETPLACE' },

    // GOVERNMENT
    { canonicalName: 'SARS', pattern: /\bSARS\b/i, categoryHint: 'GOV' },
    { canonicalName: 'CIPC', pattern: /\bCIPC\b/i, categoryHint: 'GOV' },
    { canonicalName: 'DEPARTMENT OF LABOUR', pattern: /\bDEPT\s*OF\s*LABOUR\b/i, categoryHint: 'GOV' },
    { canonicalName: 'E-HOMEAFFAIRS', pattern: /\bE-HOMEAFFAIRS\b/i, categoryHint: 'GOV' },

    // BANKING / FEES
    { canonicalName: 'BANK FEES', pattern: /\b(FEE|CHARGES|SERVICE\s*FEE|MONTHLY\s*FEE|ACCOUNT\s*FEE|ADMIN\s*FEE|TRANSACTION\s*FEE)\b/i, categoryHint: 'FEES' },
    { canonicalName: 'CASH WITHDRAWAL', pattern: /\b(CASH\s*WITHDRAWAL|ATM|AUTOBANK|SASWITCH)\b/i, categoryHint: 'CASH' },
];
