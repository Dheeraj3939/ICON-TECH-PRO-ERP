/**
 * Canonical Enquiry / Customer Source definitions for ICON TECH PRO ERP V9.2.
 * Strictly 7 controlled options.
 */

export const ENQUIRY_SOURCES = [
  'Just Dial',
  'India Mart',
  'Google ADS',
  'Existing Customers',
  'Referrals',
  'Website',
  'Walk-in',
] as const;

export type EnquirySource = (typeof ENQUIRY_SOURCES)[number];

/**
 * Check whether a value is one of the 7 canonical enquiry sources.
 */
export function isCanonicalEnquirySource(value?: string | null): value is EnquirySource {
  if (!value) return false;
  return (ENQUIRY_SOURCES as readonly string[]).includes(value);
}

/**
 * Normalize or map legacy source values to canonical equivalents where appropriate,
 * while preserving the original string if required for historical audits.
 */
export function normalizeLegacySource(source?: string | null): string {
  if (!source) return 'Walk-in';
  if (isCanonicalEnquirySource(source)) return source;

  const lower = source.trim().toLowerCase();
  if (lower.includes('just dial') || lower.includes('justdial')) return 'Just Dial';
  if (lower.includes('indiamart') || lower.includes('india mart')) return 'India Mart';
  if (lower.includes('google') || lower.includes('ads') || lower.includes('adwords')) return 'Google ADS';
  if (lower.includes('existing')) return 'Existing Customers';
  if (lower.includes('referral') || lower.includes('reference') || lower.includes('architect')) return 'Referrals';
  if (lower.includes('website') || lower.includes('web') || lower.includes('online')) return 'Website';
  if (lower.includes('walk') || lower.includes('direct') || lower.includes('cold call') || lower.includes('phone')) return 'Walk-in';

  // Return original historical string if not matched
  return source;
}
