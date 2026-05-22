/**
 * PayFast Integration Helper Configuration
 * Centralizes all PayFast environment variable access to ensure that credentials
 * (merchant ID and merchant key) are always aligned with the process URL,
 * avoiding a bad request (400) from mismatched sandbox/production keys.
 */

export const PAYFAST_PRODUCTION_URL = 'https://www.payfast.co.za/eng/process';
export const PAYFAST_SANDBOX_URL = 'https://sandbox.payfast.co.za/eng/process';

export const PAYFAST_PRODUCTION_MERCHANT_ID = '10042278';
export const PAYFAST_PRODUCTION_MERCHANT_KEY = 'qqci9vis4sszy';

export const PAYFAST_SANDBOX_MERCHANT_ID = '23836312';
export const PAYFAST_SANDBOX_MERCHANT_KEY = 'h4fkhz6ouoksx';

/**
 * Resolves the correct PayFast process URL, merchant ID, and merchant key.
 * If the process URL is set to production (www.payfast.co.za), we use production credentials by default.
 * If the process URL is sandbox, we use sandbox credentials.
 * This guarantees consistency even if build-time environment variables are missing.
 */
export function getPayFastConfig() {
    // 1. Determine process URL
    const processUrl = process.env.NEXT_PUBLIC_PAYFAST_PROCESS_URL || PAYFAST_PRODUCTION_URL;
    const isProduction = processUrl.includes('www.payfast.co.za');

    // 2. Resolve credentials with safe fallbacks matching the active environment URL
    const merchantId = process.env.NEXT_PUBLIC_PAYFAST_MERCHANT_ID || 
        (isProduction ? PAYFAST_PRODUCTION_MERCHANT_ID : PAYFAST_SANDBOX_MERCHANT_ID);
        
    const merchantKey = process.env.NEXT_PUBLIC_PAYFAST_MERCHANT_KEY || 
        (isProduction ? PAYFAST_PRODUCTION_MERCHANT_KEY : PAYFAST_SANDBOX_MERCHANT_KEY);

    return {
        processUrl,
        merchantId,
        merchantKey,
        isProduction
    };
}
