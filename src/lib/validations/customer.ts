import { z } from 'zod';

export const indianPhoneRegex = /^[6-9]\d{9}$/;
export const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
export const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
export const pincodeRegex = /^[1-9][0-9]{5}$/;

export const customerSchema = z.discriminatedUnion('customer_type', [
  // 1. Company (B2B) Customer Schema
  z.object({
    customer_type: z.literal('COMPANY'),
    company_name: z
      .string()
      .trim()
      .min(2, 'Company name must be at least 2 characters')
      .max(200, 'Company name too long'),
    contact_person: z
      .string()
      .trim()
      .min(2, 'Contact person name must be at least 2 characters')
      .max(120, 'Contact person name too long'),
    designation: z.string().trim().max(100).optional().or(z.literal('')),
    phone: z
      .string()
      .trim()
      .regex(indianPhoneRegex, 'Enter a valid 10-digit Indian mobile number (e.g. 9876543210)'),
    alternate_phone: z
      .string()
      .trim()
      .refine((val) => !val || indianPhoneRegex.test(val), {
        message: 'Alternate phone must be a valid 10-digit number',
      })
      .optional()
      .or(z.literal('')),
    email: z
      .string()
      .trim()
      .email('Enter a valid email address')
      .optional()
      .or(z.literal('')),
    billing_address: z
      .string()
      .trim()
      .min(5, 'Billing address must be at least 5 characters'),
    shipping_address: z.string().trim().optional().or(z.literal('')),
    city: z.string().trim().min(2, 'City is required').default('Hyderabad'),
    state: z.string().trim().min(2, 'State is required').default('Telangana'),
    state_code: z.string().trim().length(2, 'State code must be 2 digits').default('36'),
    pincode: z
      .string()
      .trim()
      .refine((val) => !val || pincodeRegex.test(val), {
        message: 'Pincode must be a 6-digit Indian PIN code',
      })
      .optional()
      .or(z.literal('')),
    gstin: z
      .string()
      .trim()
      .toUpperCase()
      .refine((val) => !val || gstinRegex.test(val), {
        message: 'Invalid GSTIN format (e.g. 36AAACI0000A1Z5)',
      })
      .optional()
      .or(z.literal('')),
    pan: z
      .string()
      .trim()
      .toUpperCase()
      .refine((val) => !val || panRegex.test(val), {
        message: 'Invalid PAN format (e.g. AAACI0000A)',
      })
      .optional()
      .or(z.literal('')),
    credit_limit: z.coerce.number().min(0).default(0),
    enquiry_source: z.string().trim().min(1, 'Source is required').default('Walk-in'),
    salesperson_id: z.string().uuid('Select a valid salesperson').optional().or(z.literal('')),
    status: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED']).default('ACTIVE'),
    notes: z.string().trim().optional().or(z.literal('')),
  }),

  // 2. Individual (B2C) Customer Schema
  z.object({
    customer_type: z.literal('INDIVIDUAL'),
    customer_name: z
      .string()
      .trim()
      .min(2, 'Customer name must be at least 2 characters')
      .max(150, 'Customer name too long'),
    phone: z
      .string()
      .trim()
      .regex(indianPhoneRegex, 'Enter a valid 10-digit Indian mobile number (e.g. 9876543210)'),
    alternate_phone: z
      .string()
      .trim()
      .refine((val) => !val || indianPhoneRegex.test(val), {
        message: 'Alternate phone must be a valid 10-digit number',
      })
      .optional()
      .or(z.literal('')),
    email: z
      .string()
      .trim()
      .email('Enter a valid email address')
      .optional()
      .or(z.literal('')),
    billing_address: z
      .string()
      .trim()
      .min(3, 'Residential / Site address is required'),
    shipping_address: z.string().trim().optional().or(z.literal('')),
    city: z.string().trim().min(2, 'City is required').default('Hyderabad'),
    state: z.string().trim().min(2, 'State is required').default('Telangana'),
    state_code: z.string().trim().length(2, 'State code must be 2 digits').default('36'),
    pincode: z
      .string()
      .trim()
      .refine((val) => !val || pincodeRegex.test(val), {
        message: 'Pincode must be a 6-digit Indian PIN code',
      })
      .optional()
      .or(z.literal('')),
    pan: z
      .string()
      .trim()
      .toUpperCase()
      .refine((val) => !val || panRegex.test(val), {
        message: 'Invalid PAN format (e.g. AAACI0000A)',
      })
      .optional()
      .or(z.literal('')),
    gstin: z
      .string()
      .trim()
      .toUpperCase()
      .refine((val) => !val || gstinRegex.test(val), {
        message: 'Invalid GSTIN format',
      })
      .optional()
      .or(z.literal('')),
    credit_limit: z.coerce.number().min(0).default(0),
    enquiry_source: z.string().trim().min(1, 'Source is required').default('Walk-in'),
    salesperson_id: z.string().optional().or(z.literal('')),
    status: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED']).default('ACTIVE'),
    notes: z.string().trim().optional().or(z.literal('')),
  }),

  // 3. Government / GeM / PSU Schema
  z.object({
    customer_type: z.literal('GOVERNMENT'),
    company_name: z
      .string()
      .trim()
      .min(2, 'Department / Organization name must be at least 2 characters')
      .max(200, 'Department name too long'),
    department_name: z.string().trim().max(200).optional().or(z.literal('')),
    contact_person: z
      .string()
      .trim()
      .min(2, 'Nodal officer / Contact person is required')
      .max(120),
    nodal_officer: z.string().trim().max(120).optional().or(z.literal('')),
    designation: z.string().trim().max(100).optional().or(z.literal('')),
    tender_reference: z.string().trim().max(100).optional().or(z.literal('')),
    gem_order_number: z.string().trim().max(100).optional().or(z.literal('')),
    gem_seller_id: z.string().trim().max(100).optional().or(z.literal('')),
    emd_amount: z.coerce.number().min(0).optional().default(0),
    payment_terms_days: z.coerce.number().min(0).optional().default(30),
    phone: z
      .string()
      .trim()
      .regex(indianPhoneRegex, 'Enter a valid 10-digit Indian mobile number (e.g. 9876543210)'),
    alternate_phone: z
      .string()
      .trim()
      .refine((val) => !val || indianPhoneRegex.test(val), {
        message: 'Alternate phone must be a valid 10-digit number',
      })
      .optional()
      .or(z.literal('')),
    email: z
      .string()
      .trim()
      .email('Enter a valid email address')
      .optional()
      .or(z.literal('')),
    billing_address: z
      .string()
      .trim()
      .min(5, 'Office address must be at least 5 characters'),
    shipping_address: z.string().trim().optional().or(z.literal('')),
    city: z.string().trim().min(2, 'City is required').default('Hyderabad'),
    state: z.string().trim().min(2, 'State is required').default('Telangana'),
    state_code: z.string().trim().length(2, 'State code must be 2 digits').default('36'),
    pincode: z
      .string()
      .trim()
      .refine((val) => !val || pincodeRegex.test(val), {
        message: 'Pincode must be a 6-digit Indian PIN code',
      })
      .optional()
      .or(z.literal('')),
    gstin: z
      .string()
      .trim()
      .toUpperCase()
      .refine((val) => !val || gstinRegex.test(val), {
        message: 'Invalid GSTIN format (e.g. 36AAACI0000A1Z5)',
      })
      .optional()
      .or(z.literal('')),
    pan: z
      .string()
      .trim()
      .toUpperCase()
      .refine((val) => !val || panRegex.test(val), {
        message: 'Invalid PAN format (e.g. AAACI0000A)',
      })
      .optional()
      .or(z.literal('')),
    credit_limit: z.coerce.number().min(0).default(0),
    enquiry_source: z.string().trim().min(1, 'Source is required').default('GeM Portal'),
    salesperson_id: z.string().optional().or(z.literal('')),
    status: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED']).default('ACTIVE'),
    notes: z.string().trim().optional().or(z.literal('')),
  }),
]);

export type CustomerFormValues = z.infer<typeof customerSchema>;
