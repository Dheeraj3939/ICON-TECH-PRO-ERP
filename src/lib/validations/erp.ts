import { z } from 'zod';

export const enquiryFormSchema = z.object({
  customer_id: z.string().min(1, 'Customer is required'),
  customer_name: z.string().min(1, 'Customer name is required'),
  company_name: z.string().optional(),
  customer_type: z.enum(['COMPANY', 'INDIVIDUAL', 'GOVERNMENT']).default('COMPANY'),
  phone: z.string().min(10, 'Valid 10-digit phone number is required'),
  email: z.string().email('Invalid email address').optional().or(z.literal('')),
  source: z.string().min(1, 'Source is required').default('Direct'),
  salesperson_name: z.string().min(1, 'Salesperson is required'),
  product_category: z.string().min(1, 'Product category is required'),
  requirement_summary: z.string().min(5, 'Please provide requirement details'),
  estimated_budget: z.coerce.number().min(0).default(0),
  status: z.string().optional().default('Enquiry'),
  follow_up_date: z.string().optional(),
  site_visit_required: z.boolean().default(false),
  prospect_dossier_id: z.string().optional(),
});

export type EnquiryFormValues = z.infer<typeof enquiryFormSchema>;

export const quotationItemSchema = z.object({
  id: z.string().optional(),
  product_id: z.string().nullable().optional(),
  sku: z.string().nullable().optional(),
  product_name: z.string().min(1, 'Product or solution specification is required'),
  category: z.string().optional(),
  unit: z.string().default('Nos.'),
  quantity: z.coerce.number().min(0.001, 'Quantity must be greater than 0'),
  purchase_price: z.coerce.number().min(0).default(0),
  selling_price: z.coerce.number().min(0, 'Selling rate is required'),
  discount_pct: z.coerce.number().min(0).max(100).default(0),
  discount_amount: z.coerce.number().min(0).default(0),
  gst_rate: z.coerce.number().default(18),
  hsn_sac: z.string().default('8471'),
  total_amount: z.coerce.number().min(0),
  is_custom: z.boolean().optional(),
  section_name: z.string().optional(),
});

export const quotationFormSchema = z.object({
  quotation_number: z.string().optional(),
  customer_id: z.string().min(1, 'Customer selection is required'),
  customer_name: z.string().min(1, 'Customer name is required'),
  company_name: z.string().optional(),
  customer_type: z.enum(['COMPANY', 'INDIVIDUAL', 'GOVERNMENT']).default('COMPANY'),
  phone: z.string().min(10, 'Phone is required'),
  email: z.string().email().optional().or(z.literal('')),
  address: z.string().optional(),
  salesperson_name: z.string().min(1, 'Salesperson is required'),
  quotation_date: z.string().default(new Date().toISOString().split('T')[0]),
  validity_days: z.coerce.number().min(1).default(15),
  place_of_supply: z.string().default('36-TELANGANA'),
  dispatch_from: z.string().optional(),
  items: z.array(quotationItemSchema).min(1, 'Add at least one product item'),
  payment_terms: z.string().optional(),
  delivery_terms: z.string().optional(),
  terms_conditions: z.array(z.string()).optional(),
  include_signature: z.boolean().default(true),
  notes: z.string().optional(),
  quotation_format: z.enum(['STANDARD', 'DETAILED_PROJECT']).optional(),
  project_sections: z.array(z.any()).optional(),
});

export type QuotationFormValues = z.infer<typeof quotationFormSchema>;

export const productFormSchema = z.object({
  sku: z.string().min(2, 'SKU code is required'),
  name: z.string().min(3, 'Product name is required'),
  category_name: z.string().min(1, 'Category is required'),
  brand_name: z.string().optional(),
  model_name: z.string().optional(),
  unit: z.string().default('Nos.'),
  hsn_sac: z.string().min(4, 'HSN/SAC code is required').default('85286900'),
  gst_rate: z.coerce.number().min(0).default(18),
  purchase_price: z.coerce.number().min(0).default(0),
  selling_price: z.coerce.number().min(0, 'Selling price is required'),
  mrp: z.coerce.number().min(0).default(0),
  target_margin_pct: z.coerce.number().min(0).default(20),
  current_stock: z.coerce.number().min(0).default(0),
  reorder_level: z.coerce.number().min(0).default(2),
  is_serialized: z.boolean().default(true),
  is_service: z.boolean().default(false),
  supplier_name: z.string().optional(),
  purchase_depot: z.string().optional(),
});

export type ProductFormValues = z.infer<typeof productFormSchema>;

export const paymentRecordSchema = z.object({
  invoice_id: z.string().min(1, 'Invoice reference is required'),
  invoice_number: z.string().min(1, 'Invoice number is required'),
  customer_name: z.string().min(1, 'Customer name is required'),
  company_name: z.string().optional(),
  amount: z.coerce.number().positive('Payment amount must be greater than zero'),
  mode: z.enum([
    'Bank Transfer',
    'UPI',
    'Cheque',
    'Cash',
    'NEFT_RTGS',
    'IMPS',
    'Card',
    'Other',
    'BANK_TRANSFER',
    'CASH',
    'CHEQUE',
    'CARD',
    'OTHER',
  ]).default('Bank Transfer'),
  reference_number: z.string().min(3, 'UTR or Cheque reference number is required'),
  bank_name: z.string().optional(),
  payment_date: z.string().default(new Date().toISOString().split('T')[0]),
  notes: z.string().optional(),
  recorded_by_name: z.string().min(1, 'Recorded by is required'),
});

export type PaymentRecordValues = z.infer<typeof paymentRecordSchema>;
