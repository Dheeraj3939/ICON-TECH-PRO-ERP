/**
 * RFC 4180 Compliant CSV Parser & Template Utility
 * Handles quoted fields, embedded commas, newlines, and UTF-8 BOM.
 */

export function parseCSV(csvText: string): {
  headers: string[];
  rows: Record<string, string>[];
} {
  // Strip UTF-8 BOM if present
  const text = csvText.charCodeAt(0) === 0xfeff ? csvText.slice(1) : csvText;

  const lines: string[][] = [];
  let row: string[] = [];
  let inQuotes = false;
  let currentField = '';

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentField += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      row.push(currentField.trim());
      currentField = '';
    } else if ((char === '\r' || char === '\n') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') {
        i++;
      }
      row.push(currentField.trim());
      if (row.some((field) => field.length > 0)) {
        lines.push(row);
      }
      row = [];
      currentField = '';
    } else {
      currentField += char;
    }
  }

  if (currentField.length > 0 || row.length > 0) {
    row.push(currentField.trim());
    if (row.some((field) => field.length > 0)) {
      lines.push(row);
    }
  }

  if (lines.length === 0) return { headers: [], rows: [] };

  const rawHeaders = lines[0].map((h) => h.trim());
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i];
    const record: Record<string, string> = {};
    rawHeaders.forEach((header, index) => {
      record[header] = values[index] !== undefined ? values[index] : '';
    });
    rows.push(record);
  }

  return { headers: rawHeaders, rows };
}

export interface ImportTemplateConfig {
  id: string;
  name: string;
  description: string;
  filename: string;
  headers: { key: string; label: string; required: boolean; example: string }[];
  sampleRows: Record<string, string>[];
}

export const IMPORT_TEMPLATES: Record<string, ImportTemplateConfig> = {
  customers: {
    id: 'customers',
    name: 'Customer Master Directory',
    description: 'Bulk register corporate B2B and individual B2C clients with auto ICONYYXXXX generation',
    filename: 'icon_customers_import_template.csv',
    headers: [
      { key: 'customer_name', label: 'customer_name', required: true, example: 'Rajesh Kumar' },
      { key: 'company_name', label: 'company_name', required: false, example: 'Apex Logistics Solutions Pvt Ltd' },
      { key: 'customer_type', label: 'customer_type', required: true, example: 'COMPANY' },
      { key: 'phone', label: 'phone', required: true, example: '+91 98490 12345' },
      { key: 'email', label: 'email', required: false, example: 'rajesh@apexlogistics.in' },
      { key: 'gstin', label: 'gstin', required: false, example: '36AABCA1234F1Z5' },
      { key: 'pan', label: 'pan', required: false, example: 'AABCA1234F' },
      { key: 'city', label: 'city', required: true, example: 'Hyderabad' },
      { key: 'state', label: 'state', required: true, example: 'Telangana' },
      { key: 'pincode', label: 'pincode', required: false, example: '500038' },
      { key: 'address_line1', label: 'address_line1', required: false, example: 'Plot 42, Hitec City Phase 2' },
    ],
    sampleRows: [
      {
        customer_name: 'Dr. Srinivas Rao',
        company_name: 'Care Apollo Super Speciality',
        customer_type: 'COMPANY',
        phone: '+91 98490 55443',
        email: 'procurement@careapollo.in',
        gstin: '36AAACC9876E1Z2',
        pan: 'AAACC9876E',
        city: 'Hyderabad',
        state: 'Telangana',
        pincode: '500033',
        address_line1: 'Jubilee Hills Road No. 36',
      },
      {
        customer_name: 'Vikram Mehta',
        company_name: '',
        customer_type: 'INDIVIDUAL',
        phone: '+91 99890 11223',
        email: 'vikram.mehta@gmail.com',
        gstin: '',
        pan: '',
        city: 'Secunderabad',
        state: 'Telangana',
        pincode: '500003',
        address_line1: 'Villa 14, Rainbow Meadows',
      },
    ],
  },
  products: {
    id: 'products',
    name: 'Product Catalog & Pricing',
    description: 'Bulk upload equipment SKUs, HSN codes, purchase cost, selling price, and stock counts',
    filename: 'icon_products_import_template.csv',
    headers: [
      { key: 'sku', label: 'sku', required: true, example: 'PRJ-EPS-EB2250' },
      { key: 'name', label: 'name', required: true, example: 'Epson EB-2250U 5000-Lumen WUXGA Projector' },
      { key: 'category_name', label: 'category_name', required: true, example: 'Projector' },
      { key: 'brand_name', label: 'brand_name', required: true, example: 'Epson' },
      { key: 'hsn_sac', label: 'hsn_sac', required: true, example: '85286900' },
      { key: 'unit', label: 'unit', required: false, example: 'Nos.' },
      { key: 'purchase_price', label: 'purchase_price', required: true, example: '82000' },
      { key: 'selling_price', label: 'selling_price', required: true, example: '105000' },
      { key: 'mrp', label: 'mrp', required: true, example: '125000' },
      { key: 'current_stock', label: 'current_stock', required: true, example: '6' },
      { key: 'reorder_level', label: 'reorder_level', required: false, example: '2' },
    ],
    sampleRows: [
      {
        sku: 'IFP-VIEW-75-01',
        name: 'ViewSonic 75" 4K Interactive Flat Panel IFP7550',
        category_name: 'Interactive Flat Panel',
        brand_name: 'ViewSonic',
        hsn_sac: '85285200',
        unit: 'Nos.',
        purchase_price: '135000',
        selling_price: '165000',
        mrp: '190000',
        current_stock: '4',
        reorder_level: '2',
      },
      {
        sku: 'AUD-DEN-X2800',
        name: 'Denon AVR-X2800H 7.2 Ch 8K AV Receiver Dolby Atmos',
        category_name: 'Amplifier & Receiver',
        brand_name: 'Denon',
        hsn_sac: '85184000',
        unit: 'Nos.',
        purchase_price: '72000',
        selling_price: '89000',
        mrp: '99000',
        current_stock: '3',
        reorder_level: '1',
      },
    ],
  },
  suppliers: {
    id: 'suppliers',
    name: 'Suppliers & Vendors',
    description: 'Bulk register distributors, manufacturers, and component vendors with payment terms',
    filename: 'icon_suppliers_import_template.csv',
    headers: [
      { key: 'supplier_name', label: 'supplier_name', required: true, example: 'Redington India Ltd' },
      { key: 'contact_person', label: 'contact_person', required: true, example: 'Sunil Varma' },
      { key: 'phone', label: 'phone', required: true, example: '+91 98480 33445' },
      { key: 'email', label: 'email', required: false, example: 'sunil@redington.co.in' },
      { key: 'gstin', label: 'gstin', required: false, example: '36AAACR1234F1Z1' },
      { key: 'city', label: 'city', required: true, example: 'Secunderabad' },
      { key: 'payment_terms_days', label: 'payment_terms_days', required: false, example: '30' },
      { key: 'billing_address', label: 'billing_address', required: false, example: 'Parklane, Secunderabad' },
    ],
    sampleRows: [
      {
        supplier_name: 'Ingram Micro India Pvt Ltd',
        contact_person: 'Praveen Chary',
        phone: '+91 98491 88776',
        email: 'praveen@ingrammicro.com',
        gstin: '36AAACI5678K1Z9',
        city: 'Hyderabad',
        payment_terms_days: '45',
        billing_address: 'Cherlapally Industrial Area',
      },
    ],
  },
};
