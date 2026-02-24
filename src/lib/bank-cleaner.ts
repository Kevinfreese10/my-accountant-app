/**
 * @fileOverview South African Bank Statement Description Cleaning Engine.
 * Implements regex-first deterministic cleaning and 2-stage grouping.
 */

import { merchantSeeds } from './merchant-seeds';

const CLEANING_VERSION = 'za_banks_v1.0';

const STOPWORDS = new Set([
    'PTY', 'LTD', 'CC', 'INC', 'CO', 'SA', 'RSA', 'SOUTH', 'AFRICA',
    'THE', 'AND', 'OF', 'FOR', 'ON', 'IN', 'AT', 'WITH', 'BY', 'AN', 'A',
    'ONLINE', 'PAYMENT', 'TRANSFER', 'ACCOUNT', 'EFT', 'MOBILE', 'APP',
    'BANKING', 'PURCHASE', 'CREDIT', 'DEBIT', 'CARD'
]);

export class BankCleaner {
    /**
     * Stage 1: Convert messy bank strings to clean display strings.
     */
    static clean(description: string): { clean: string; channel: string } {
        if (!description) return { clean: 'UNKNOWN', channel: 'UNKNOWN' };

        let str = description.toUpperCase();
        let channel = 'UNKNOWN';

        // A. Punctuation noise removal
        str = str.replace(/[_|]+/g, ' ');
        str = str.replace(/[•·]+/g, ' ');
        str = str.replace(/\s*[-–—]\s*/g, ' ');

        // B. Reference blob removal (5+ digits)
        str = str.replace(/(?<!\d)\d{5,}(?!\d)/g, ' ');

        // C. DateTime removal
        str = str.replace(/\b\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\b/g, ' '); // ISO
        str = str.replace(/\b\d{1,2}:\d{2}(?::\d{2})?\b/g, ' '); // Time
        str = str.replace(/\b\d{1,2}H\d{2}\b/g, ' '); // SA Style Time
        str = str.replace(/\b\d{4}-\d{2}-\d{2}\b/g, ' '); // YYYY-MM-DD
        str = str.replace(/\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b/g, ' '); // DD/MM/YYYY

        // D. Card fragments
        str = str.replace(/\b\d{4}[*Xx]{2,}\d{2,4}\b/g, ' ');
        str = str.replace(/\b(CARD|CRD)\s*\d{2,4}\b/g, ' ');

        // E. Channel & Direction detection + removal
        if (/\b(INTERNET|IB|ONLINE|APP|EFT|ELECTRONIC)\b/i.test(str)) channel = 'EFT';
        if (/\b(POS|CARD\s*PURCHASE|VISA|MASTERCARD)\b/i.test(str)) channel = 'CARD';

        const channelRegex = /\b(INTERNET\s*BANKING|IB|ONLINE\s*BANKING|MOBILE\s*BANKING|APP|EFT|ELECTRONIC\s*FUNDS\s*TRANSFER|IMMEDIATE\s*PAYMENT|REAL\s*TIME\s*CLEARING|RTC|PAY\s*AND\s*CLEAR)\b/g;
        str = str.replace(channelRegex, ' ');

        const directionRegex = /\b(PAYMENT\s*TO|PAY\s*TO|PAID\s*TO|TRANSFER\s*TO|XFER\s*TO|TRF\s*TO|PAYMENT\s*FROM|RECEIVED\s*FROM|TRANSFER\s*FROM|XFER\s*FROM|TRF\s*FROM)\b/g;
        str = str.replace(directionRegex, ' ');

        // F. Specific SA Service Mapping
        if (/\bINSTANT\s*MONEY\b/i.test(str)) return { clean: 'INSTANT MONEY', channel: 'EFT' };
        if (/\bE\s*WALLET\b/i.test(str)) return { clean: 'EWALLET', channel: 'EFT' };
        if (/\bCASH\s*SEND\b/i.test(str)) return { clean: 'CASH SEND', channel: 'EFT' };
        if (/\bPAY\s*SHAP\b|\bPAYSHAP\b/i.test(str)) return { clean: 'PAYSHAP', channel: 'EFT' };

        // G. Fees & Cash Withdrawals
        if (/\b(FEE(S)?|BANK\s*CHARGES?|SERVICE\s*FEE|MONTHLY\s*FEE|ACCOUNT\s*FEE|ADMIN\s*FEE|TRANSACTION\s*FEE)\b/i.test(str)) {
            return { clean: 'BANK FEES', channel: 'FEE' };
        }
        if (/\b(ATM|AUTOBANK|CASH\s*WITHDRAWAL|SASWITCH)\b/i.test(str)) {
            return { clean: 'CASH WITHDRAWAL', channel: 'ATM' };
        }

        // H. Clutter words
        str = str.replace(/\b(REF|REFERENCE|REFF|DESC|DESCRIPTION|TRN|TRAN|TXN|TRANS|TRANSACTION|AUTH|AUTHCODE|TRACE)\b/g, ' ');

        // I. Person names cleaning (Initials)
        str = str.replace(/^\b[A-Z]\b\s+/g, '');

        // J. Final cleanup
        str = str.replace(/\s+/g, ' ').trim();
        str = str.replace(/^[\s\W]+|[\s\W]+$/g, '');

        return {
            clean: str || description.trim() || 'UNKNOWN',
            channel
        };
    }

    /**
     * Recipe for merchantKey: Aggressive normalization for exact match.
     */
    static generateMerchantKey(cleanDescription: string): string {
        return cleanDescription
            .toUpperCase()
            .replace(/&/g, 'AND')
            .replace(/[^A-Z0-9 ]+/g, ' ') // Remove all non-alphanumeric
            .split(' ')
            .filter(token => token.length > 2 && !STOPWORDS.has(token))
            .slice(0, 5) // Keep first 5 tokens
            .join(' ')
            .trim();
    }

    /**
     * Recipe for merchantKey2: Fallback (keepers numbers and more tokens).
     */
    static generateMerchantKey2(cleanDescription: string): string {
        return cleanDescription
            .toUpperCase()
            .split(' ')
            .filter(token => token.length > 1)
            .slice(0, 8)
            .join(' ')
            .trim();
    }

    /**
     * Similarity scorer using Jaccard Token overlap.
     */
    static getSimilarity(s1: string, s2: string): number {
        const t1 = new Set(s1.split(' '));
        const t2 = new Set(s2.split(' '));
        const intersection = new Set([...t1].filter(x => t2.has(x)));
        const union = new Set([...t1, ...t2]);
        return intersection.size / union.size;
    }

    /**
     * Main pipeline task: Process a raw description.
     */
    static process(raw: string) {
        const { clean, channel } = this.clean(raw);
        const key1 = this.generateMerchantKey(clean);
        const key2 = this.generateMerchantKey2(clean);

        // Try to match seeds
        let matchedSeed = merchantSeeds.find(seed => seed.pattern.test(clean));

        return {
            rawDescription: raw,
            cleanDescription: matchedSeed ? matchedSeed.canonicalName : clean,
            merchantKey: key1,
            merchantKey2: key2,
            paymentChannel: channel as any,
            cleaningVersion: CLEANING_VERSION,
            categoryHint: matchedSeed?.categoryHint
        };
    }
}
