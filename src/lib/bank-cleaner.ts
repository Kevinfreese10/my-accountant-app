/**
 * @fileOverview South African Bank Statement Description Cleaning Engine.
 * Implements regex-first deterministic cleaning and similarity scoring.
 */

const CLEANING_VERSION = 'za_banks_v1.2';

const STOPWORDS = new Set([
    'PTY', 'LTD', 'CC', 'INC', 'CO', 'SA', 'RSA', 'SOUTH', 'AFRICA',
    'THE', 'AND', 'OF', 'FOR', 'ON', 'IN', 'AT', 'WITH', 'BY', 'AN', 'A',
    'ONLINE', 'PAYMENT', 'TRANSFER', 'ACCOUNT', 'EFT', 'MOBILE', 'APP',
    'BANKING', 'PURCHASE', 'CREDIT', 'DEBIT', 'CARD', 'PURCH'
]);

const SIMILARITY_STOPWORDS = new Set([
    'EFT', 'IB', 'IBNK', 'ONLINE', 'MOB', 'MOBILE', 'APP', 'INTRN', 'INTERNET',
    'PMNT', 'PYMNT', 'PYMT', 'PMT', 'PAI', 'PAID', 'RCVD', 'RECV', 'RCV',
    'PURCH', 'PURCHASE', 'POS', 'CARD', 'CRD', 'VISA', 'MASTERCARD', 'DEBIT', 'CREDIT',
    'TRF', 'XFER', 'TRANSF', 'TRANSFER', 'PAY', 'PAYMENT', 'TO', 'FROM',
    'REF', 'REFERENCE', 'INV', 'INVOICE', 'DOC', 'AUTH', 'AUTHCD', 'TRACE', 'TRN', 'TXN',
    'MAGTAPE', 'MAGSTRIPE', 'MAG-STRIPE', 'CHIP', 'CONTACTLESS', 'TAP',
    'ATM', 'AUTOBANK', 'CASH', 'WITHDRAW', 'WDL', 'DEP', 'DEPOSIT',
    'PTY', 'LTD', 'INC', 'CC', 'LLC', 'SOC', 'SA', 'SOUTHAFRICA'
]);

const GENERIC_FIRST_TOKENS = new Set([
    'THE', 'PAYMENT', 'TRANSFER', 'ONLINE', 'MOBILE', 'POS', 'CARD', 'STORE', 'SHOP', 'BUFFALO'
]);

export class BankCleaner {
    /**
     * Stage 1: Convert messy bank strings to clean display strings.
     */
    static clean(description: string): { clean: string; channel: string } {
        if (!description) return { clean: 'UNKNOWN', channel: 'UNKNOWN' };

        let str = description.toUpperCase();
        let channel = 'UNKNOWN';

        str = str.replace(/[_|]+/g, ' ');
        str = str.replace(/[•·]+/g, ' ');
        str = str.replace(/\s*[-–—]\s*/g, ' ');
        str = str.replace(/(?<!\d)\d{5,}(?!\d)/g, ' ');
        str = str.replace(/\b\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\b/g, ' ');
        str = str.replace(/\b\d{1,2}:\d{2}(?::\d{2})?\b/g, ' ');
        str = str.replace(/\b\d{1,2}H\d{2}\b/g, ' ');
        str = str.replace(/\b\d{4}-\d{2}-\d{2}\b/g, ' ');
        str = str.replace(/\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b/g, ' ');
        str = str.replace(/\b\d{4,6}[*Xx]{2,}\d{2,4}\b/g, ' ');
        str = str.replace(/\b(CARD|CRD)\s*\d{2,4}\b/g, ' ');

        if (/\b(INTERNET|IB|ONLINE|APP|EFT|ELECTRONIC)\b/i.test(str)) channel = 'EFT';
        if (/\b(POS|CARD\s*PURCHASE|VISA|MASTERCARD)\b/i.test(str)) channel = 'CARD';

        const channelRegex = /\b(INTERNET\s*BANKING|IB|ONLINE\s*BANKING|MOBILE\s*BANKING|APP|EFT|ELECTRONIC\s*FUNDS\s*TRANSFER|IMMEDIATE\s*PAYMENT|REAL\s*TIME\s*CLEARING|RTC|PAY\s*AND\s*CLEAR)\b/g;
        str = str.replace(channelRegex, ' ');

        const directionRegex = /\b(PAYMENT\s*TO|PAY\s*TO|PAID\s*TO|TRANSFER\s*TO|XFER\s*TO|TRF\s*TO|PAYMENT\s*FROM|RECEIVED\s*FROM|TRANSFER\s*FROM|XFER\s*FROM|TRF\s*FROM)\b/g;
        str = str.replace(directionRegex, ' ');

        if (/\bINSTANT\s*MONEY\b/i.test(str)) return { clean: 'INSTANT MONEY', channel: 'EFT' };
        if (/\bE\s*WALLET\b/i.test(str)) return { clean: 'EWALLET', channel: 'EFT' };
        if (/\bCASH\s*SEND\b/i.test(str)) return { clean: 'CASH SEND', channel: 'EFT' };
        if (/\bPAY\s*SHAP\b|\bPAYSHAP\b/i.test(str)) return { clean: 'PAYSHAP', channel: 'EFT' };

        if (/\b(FEE(S)?|BANK\s*CHARGES?|SERVICE\s*FEE|MONTHLY\s*FEE|ACCOUNT\s*FEE|ADMIN\s*FEE|TRANSACTION\s*FEE)\b/i.test(str)) {
            return { clean: 'BANK FEES', channel: 'FEE' };
        }
        if (/\b(ATM|AUTOBANK|CASH\s*WITHDRAWAL|SASWITCH)\b/i.test(str)) {
            return { clean: 'CASH WITHDRAWAL', channel: 'ATM' };
        }

        str = str.replace(/\b(REF|REFERENCE|REFF|DESC|DESCRIPTION|TRN|TRAN|TXN|TRANS|TRANSACTION|AUTH|AUTHCODE|TRACE|PURCH|PURCHASE)\b/g, ' ');
        str = str.replace(/^\b[A-Z]\b\s+/g, '');
        str = str.replace(/\s+/g, ' ').trim();
        str = str.replace(/^[\s\W]+|[\s\W]+$/g, '');

        return {
            clean: str || description.trim() || 'UNKNOWN',
            channel
        };
    }

    static generateMerchantKey(cleanDescription: string): string {
        return cleanDescription
            .toUpperCase()
            .replace(/&/g, 'AND')
            .replace(/[^A-Z0-9 ]+/g, ' ')
            .split(' ')
            .filter(token => token.length >= 2 && !STOPWORDS.has(token))
            .slice(0, 5)
            .join(' ')
            .trim();
    }

    static process(raw: string) {
        const { clean, channel } = this.clean(raw);
        const key1 = this.generateMerchantKey(clean);
        return {
            rawDescription: raw,
            cleanDescription: clean,
            merchantKey: key1,
            paymentChannel: channel as any,
            cleaningVersion: CLEANING_VERSION,
        };
    }

    /**
     * Normalizes a string specifically for similarity comparison.
     */
    static getSimilarityKey(description: string): string {
        return description.toUpperCase()
            .split(/\s+/)
            .filter(t => t.length > 1 && !SIMILARITY_STOPWORDS.has(t))
            .join(' ');
    }

    static calculateJaccard(s1: string, s2: string): number {
        const set1 = new Set(s1.split(' '));
        const set2 = new Set(s2.split(' '));
        const intersection = new Set([...set1].filter(x => set2.has(x)));
        const union = new Set([...set1, ...set2]);
        if (union.size === 0) return 0;
        return intersection.size / union.size;
    }

    static calculateLevenshtein(s1: string, s2: string): number {
        const len1 = s1.length;
        const len2 = s2.length;
        if (len1 === 0) return 0;
        if (len2 === 0) return 0;
        
        const matrix = Array.from({ length: len1 + 1 }, () => Array(len2 + 1).fill(0));
        for (let i = 0; i <= len1; i++) matrix[i][0] = i;
        for (let j = 0; j <= len2; j++) matrix[0][j] = j;
        for (let i = 1; i <= len1; i++) {
            for (let j = 1; j <= len2; j++) {
                const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
                matrix[i][j] = Math.min(matrix[i - 1][j] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j - 1] + cost);
            }
        }
        return 1 - (matrix[len1][len2] / Math.max(len1, len2));
    }

    static getSimilarity(s1: string, s2: string): { score: number; reason: string } {
        const key1 = this.getSimilarityKey(s1);
        const key2 = this.getSimilarityKey(s2);
        
        if (!key1 || !key2) return { score: 0, reason: 'Empty keys' };

        const jaccard = this.calculateJaccard(key1, key2);
        const levenshtein = this.calculateLevenshtein(key1, key2);
        const score = (0.7 * jaccard) + (0.3 * levenshtein);

        const firstToken1 = key1.split(' ')[0];
        const firstToken2 = key2.split(' ')[0];
        const firstTokenMatch = firstToken1 === firstToken2;

        let reason = `Token overlap: ${Math.round(jaccard * 100)}%`;
        if (firstTokenMatch) reason += " + First word match";

        // Collision Risk Check
        if (GENERIC_FIRST_TOKENS.has(firstToken1) && score < 0.98) {
            return { score: score * 0.5, reason: 'Generic token collision risk' };
        }

        return { score, reason };
    }
}
