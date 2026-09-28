import crypto from 'crypto';
import type { CustomerFormData } from '@/types/customer';
import type { EnquiryFormValues } from '@/lib/validations/erp';
import type { ZohoLead, ZohoContact, ZohoAccount, ZohoDeal } from '@/types/zoho';

/**
 * Normalizes email address for consistent duplicate matching.
 */
export function normalizeEmail(email?: string | null): string | null {
  if (!email || typeof email !== 'string') return null;
  const cleaned = email.trim().toLowerCase();
  return cleaned.includes('@') ? cleaned : null;
}

/**
 * Normalizes phone numbers (strips whitespace, dashes, parens, handles Indian +91 prefix).
 */
export function normalizePhone(phone?: string | null): string | null {
  if (!phone || typeof phone !== 'string') return null;
  const digitsOnly = phone.replace(/[^0-9]/g, '');
  if (!digitsOnly) return null;

  // If 12 digits starting with 91, extract the 10-digit number
  if (digitsOnly.length === 12 && digitsOnly.startsWith('91')) {
    return digitsOnly.slice(2);
  }

  // If 11 digits starting with 0, extract the 10-digit number
  if (digitsOnly.length === 11 && digitsOnly.startsWith('0')) {
    return digitsOnly.slice(1);
  }

  return digitsOnly;
}

/**
 * Computes deterministic SHA-256 hash of external payload for change detection.
 */
export function computePayloadHash(data: any): string {
  const json = JSON.stringify(data || {});
  return crypto.createHash('sha256').update(json).digest('hex');
}

/**
 * Maps a Zoho CRM Lead record to ERP CustomerFormData.
 */
export function mapZohoLeadToErpCustomer(lead: ZohoLead): Partial<CustomerFormData> {
  const hasCompany = Boolean(lead.Company && lead.Company.trim().length > 0 && lead.Company.trim() !== 'Individual');
  const fullName = [lead.First_Name, lead.Last_Name].filter(Boolean).join(' ').trim() || 'Valued Customer';
  const companyName = hasCompany ? lead.Company!.trim() : null;
  const primaryPhone = lead.Phone || lead.Mobile || '9999999999';

  return {
    customer_type: hasCompany ? 'COMPANY' : 'INDIVIDUAL',
    customer_name: hasCompany ? (companyName || fullName) : fullName,
    company_name: companyName || undefined,
    contact_person: hasCompany ? fullName : undefined,
    designation: lead.Designation || undefined,
    email: normalizeEmail(lead.Email) || undefined,
    phone: primaryPhone,
    alternate_phone: lead.Mobile && lead.Phone ? lead.Mobile : undefined,
    billing_address: lead.Street || undefined,
    shipping_address: lead.Street || undefined,
    city: lead.City || 'Hyderabad',
    state: lead.State || 'Telangana',
    state_code: '36',
    pincode: lead.Zip_Code || undefined,
    enquiry_source: mapLeadSource(lead.Lead_Source),
    status: 'ACTIVE',
    notes: `[Zoho CRM Lead ID: ${lead.id}] ${lead.Description || ''}`.trim(),
  };
}

/**
 * Maps a Zoho CRM Lead record to ERP EnquiryFormValues.
 */
export function mapZohoLeadToErpEnquiry(
  lead: ZohoLead,
  erpCustomerId: string
): Partial<EnquiryFormValues> {
  const fullName = [lead.First_Name, lead.Last_Name].filter(Boolean).join(' ').trim() || 'Valued Customer';
  const hasCompany = Boolean(lead.Company && lead.Company.trim().length > 0 && lead.Company.trim() !== 'Individual');

  return {
    customer_id: erpCustomerId,
    customer_name: hasCompany ? (lead.Company || fullName) : fullName,
    company_name: hasCompany ? lead.Company || undefined : undefined,
    customer_type: hasCompany ? 'COMPANY' : 'INDIVIDUAL',
    phone: lead.Phone || lead.Mobile || '9999999999',
    email: normalizeEmail(lead.Email) || undefined,
    source: mapLeadSource(lead.Lead_Source),
    salesperson_name: lead.Owner?.name || 'Managing Director',
    product_category: mapIndustryToProductCategory(lead.Industry),
    requirement_summary: `[Zoho Lead #${lead.id}] Status: ${lead.Lead_Status || 'Open'}. ${lead.Description || 'CRM Inbound Lead'}`.trim(),
    estimated_budget: 0,
    status: 'Enquiry',
    site_visit_required: false,
  };
}

/**
 * Maps a Zoho CRM Contact record to ERP CustomerFormData.
 */
export function mapZohoContactToErpCustomer(contact: ZohoContact): Partial<CustomerFormData> {
  const accountName = contact.Account_Name?.name?.trim();
  const hasCompany = Boolean(accountName && accountName.length > 0);
  const fullName = [contact.First_Name, contact.Last_Name].filter(Boolean).join(' ').trim() || 'Valued Contact';
  const primaryPhone = contact.Phone || contact.Mobile || '9999999999';

  return {
    customer_type: hasCompany ? 'COMPANY' : 'INDIVIDUAL',
    customer_name: hasCompany ? accountName! : fullName,
    company_name: hasCompany ? accountName : undefined,
    contact_person: hasCompany ? fullName : undefined,
    designation: contact.Title || undefined,
    email: normalizeEmail(contact.Email) || undefined,
    phone: primaryPhone,
    alternate_phone: contact.Mobile && contact.Phone ? contact.Mobile : undefined,
    billing_address: contact.Mailing_Street || undefined,
    shipping_address: contact.Mailing_Street || undefined,
    city: contact.Mailing_City || 'Hyderabad',
    state: contact.Mailing_State || 'Telangana',
    state_code: '36',
    pincode: contact.Mailing_Zip || undefined,
    enquiry_source: 'OTHER',
    status: 'ACTIVE',
    notes: `[Zoho CRM Contact ID: ${contact.id}] Department: ${contact.Department || 'N/A'}. ${contact.Description || ''}`.trim(),
  };
}

/**
 * Maps a Zoho CRM Account record to ERP CustomerFormData.
 */
export function mapZohoAccountToErpCustomer(account: ZohoAccount): Partial<CustomerFormData> {
  const companyName = account.Account_Name.trim();
  const primaryPhone = account.Phone || '9999999999';

  return {
    customer_type: 'COMPANY',
    customer_name: companyName,
    company_name: companyName,
    phone: primaryPhone,
    billing_address: account.Billing_Street || undefined,
    shipping_address: account.Shipping_Street || account.Billing_Street || undefined,
    city: account.Billing_City || 'Hyderabad',
    state: account.Billing_State || 'Telangana',
    state_code: '36',
    pincode: account.Billing_Code || undefined,
    enquiry_source: 'OTHER',
    status: 'ACTIVE',
    notes: `[Zoho CRM Account ID: ${account.id}] Industry: ${account.Industry || 'Commercial'}. Website: ${account.Website || 'N/A'}. ${account.Description || ''}`.trim(),
  };
}

/**
 * Normalizes Zoho CRM Lead Source string into ERP enquiry_source enum.
 */
export function mapLeadSource(source?: string | null): string {
  if (!source) return 'Direct';
  const s = source.toLowerCase();
  if (s.includes('web') || s.includes('online')) return 'Website';
  if (s.includes('refer') || s.includes('word of mouth')) return 'Reference';
  if (s.includes('call') || s.includes('phone') || s.includes('tele')) return 'Phone';
  if (s.includes('walk')) return 'Walk-in';
  return 'Direct';
}

/**
 * Maps Zoho industry or lead notes to standard ERP product category.
 */
export function mapIndustryToProductCategory(industry?: string | null): string {
  if (!industry) return 'Security Systems';
  const ind = industry.toLowerCase();
  if (ind.includes('cctv') || ind.includes('surveillance') || ind.includes('camera')) return 'CCTV Surveillance';
  if (ind.includes('access') || ind.includes('biometric') || ind.includes('door')) return 'Access Control';
  if (ind.includes('fire') || ind.includes('alarm') || ind.includes('smoke')) return 'Fire Alarm Systems';
  if (ind.includes('solar') || ind.includes('energy') || ind.includes('power')) return 'Solar & Power Backup';
  if (ind.includes('network') || ind.includes('it') || ind.includes('server')) return 'Networking & Structured Cabling';
  return 'Security Systems';
}
