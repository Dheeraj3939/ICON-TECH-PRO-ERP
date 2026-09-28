'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Building2,
  User,
  Phone,
  Mail,
  MapPin,
  Calendar,
  Clock,
  Plus,
  Trash2,
  Copy,
  Printer,
  FileText,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  ShieldAlert,
  ShieldCheck,
  Search,
  RefreshCw,
  ArrowLeft,
  Download,
  Info,
  Layers,
  Wrench,
  Lock,
  Eye,
} from 'lucide-react';
import { getCustomers } from '@/lib/actions/customers';
import { getProducts } from '@/lib/actions/products';
import { createQuotation, updateQuotation } from '@/lib/actions/quotations';
import { getCurrentSessionUser } from '@/lib/actions/users';
import { INITIAL_PRODUCTS, DISCOUNT_APPROVAL_RULES } from '@/lib/constants/erp-data';
import { roundTo2Decimals } from '@/lib/pricing/pricing-engine';
import { CustomerFormModal } from '@/components/customers/customer-form-modal';
import { PrintQuotationModal } from '@/components/modals/PrintQuotationModal';
import type { QuotationItem, Product, Quotation } from '@/types/erp';
import type { Customer } from '@/types/customer';
import type { AuthenticatedUser } from '@/lib/auth/session';

interface QuotationFormWorkspaceProps {
  initialCustomer?: {
    id?: string;
    customer_code?: string;
    name: string;
    company?: string;
    phone: string;
    email?: string;
    address?: string;
    customer_type?: 'COMPANY' | 'INDIVIDUAL' | 'GOVERNMENT';
  };
  enquiryContext?: {
    enquiry_id?: string;
    enquiry_number?: string;
    product_category?: string;
    requirement_summary?: string;
    estimated_budget?: number;
    notes?: string;
    site_visit?: any;
  };
  editingQuotation?: Quotation | null;
  onSuccessRedirect?: string;
  isModal?: boolean;
  onCloseModal?: () => void;
}

export function QuotationFormWorkspace({
  initialCustomer,
  enquiryContext,
  editingQuotation,
  onSuccessRedirect = '/dashboard/quotations',
  isModal = false,
  onCloseModal,
}: QuotationFormWorkspaceProps) {
  const router = useRouter();

  // Quote Number Generation
  const generateNewQuoteNumber = () => {
    const randomFour = Math.floor(1000 + Math.random() * 9000);
    return `QT/2026-27/${randomFour}`;
  };

  const [quotationNumber, setQuotationNumber] = useState(
    editingQuotation?.quotation_number || generateNewQuoteNumber()
  );

  // Authenticated user & permissions
  const [currentUser, setCurrentUser] = useState<AuthenticatedUser | null>(null);
  const userRole = currentUser?.role || 'Sales Executive';
  const isManagementOrAdmin =
    userRole === 'Managing Director' ||
    userRole === 'Admin / BDM' ||
    userRole === 'BDM';

  // Customer State
  const [customersList, setCustomersList] = useState<Customer[]>([]);
  const [customerSearch, setCustomerSearch] = useState('');
  const [isCustomerDropdownOpen, setIsCustomerDropdownOpen] = useState(false);
  const [isNewCustomerModalOpen, setIsNewCustomerModalOpen] = useState(false);

  const [selectedCustomerId, setSelectedCustomerId] = useState<string>(
    editingQuotation?.customer_id || initialCustomer?.id || ''
  );
  const [customerCode, setCustomerCode] = useState<string>(
    initialCustomer?.customer_code || ''
  );
  const [customerName, setCustomerName] = useState(
    editingQuotation?.customer_name || initialCustomer?.name || ''
  );
  const [companyName, setCompanyName] = useState(
    editingQuotation?.company_name || initialCustomer?.company || ''
  );
  const [customerType, setCustomerType] = useState<'COMPANY' | 'INDIVIDUAL' | 'GOVERNMENT'>(
    (editingQuotation?.customer_type || initialCustomer?.customer_type as any) || 'COMPANY'
  );
  const [phone, setPhone] = useState(
    editingQuotation?.phone || initialCustomer?.phone || ''
  );
  const [email, setEmail] = useState(
    editingQuotation?.email || initialCustomer?.email || ''
  );
  const [address, setAddress] = useState(
    editingQuotation?.address || initialCustomer?.address || 'Hyderabad, TELANGANA'
  );
  const [placeOfSupply, setPlaceOfSupply] = useState(
    editingQuotation?.place_of_supply || '36-TELANGANA'
  );
  const [dispatchFrom, setDispatchFrom] = useState(
    editingQuotation?.dispatch_from ||
      '7-1-62/A, FLAT NO-503, 5TH FLOOR, AMEER ESTATE, SR NAGAR, Hyderabad, TELANGANA, 500038'
  );

  // Proposal Meta
  const [quotationDate, setQuotationDate] = useState(
    editingQuotation?.quotation_date || new Date().toISOString().split('T')[0]
  );
  const [validityDays, setValidityDays] = useState(editingQuotation?.validity_days || 7);
  const [salespersonName, setSalespersonName] = useState(
    editingQuotation?.salesperson_name || 'Borra Narsimulu'
  );

  // Pricing Mode Toggle: Before GST vs Including GST
  const [pricingMode, setPricingMode] = useState<'EXCLUSIVE' | 'INCLUSIVE'>('EXCLUSIVE');

  // Products Catalog
  const [catalogProducts, setCatalogProducts] = useState<Product[]>(INITIAL_PRODUCTS);
  const [selectedCatalogSku, setSelectedCatalogSku] = useState('');

  // Line items state
  const [items, setItems] = useState<QuotationItem[]>(() => {
    if (editingQuotation?.items && editingQuotation.items.length > 0) {
      return editingQuotation.items;
    }
    if (enquiryContext?.product_category || enquiryContext?.requirement_summary) {
      const cat = enquiryContext.product_category || 'AV & Commercial';
      const budget = enquiryContext.estimated_budget || 0;
      return [
        {
          product_name: enquiryContext.requirement_summary
            ? `${cat}: ${enquiryContext.requirement_summary}`
            : `[${cat} Requirement] Turnkey Commercial Setup`,
          sku: `REQ-${cat.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4) || 'GEN'}-01`,
          category: cat,
          unit: 'Nos.',
          quantity: 1,
          purchase_price: 0,
          selling_price: budget > 0 ? budget : 0,
          discount_pct: 0,
          discount_amount: 0,
          gst_rate: 18,
          hsn_sac: '8471',
          total_amount: Number(((budget > 0 ? budget : 0) * 1.18).toFixed(2)),
          is_custom: true,
        },
      ];
    }
    return [];
  });

  // Terms & Conditions
  const [paymentTerms, setPaymentTerms] = useState(
    editingQuotation?.payment_terms || '100% Advance Payment'
  );
  const [deliveryTerms, setDeliveryTerms] = useState(
    editingQuotation?.delivery_terms || 'Immediately / 2-3 Working Days'
  );
  const [warrantyTerms, setWarrantyTerms] = useState('1 Year Manufacturer Warranty');
  const [installationTerms, setInstallationTerms] = useState(
    'Inclusive of Installation, Mounting & Testing'
  );
  const [specialNotes, setSpecialNotes] = useState(
    editingQuotation?.notes || 'TRANSPORTATION AND INSTALLATION CHARGES INCLUSIVE'
  );
  const [includeSignature, setIncludeSignature] = useState(
    editingQuotation?.include_signature ?? true
  );

  // Overall Quotation Discount
  const [overallDiscountAmount, setOverallDiscountAmount] = useState(0);

  // Internal Pricing Collapsible Section
  const [showInternalPricing, setShowInternalPricing] = useState(false);

  // Preview Modal
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  // Submission State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Load Session User, Customers & Products
  useEffect(() => {
    getCurrentSessionUser().then((user) => {
      if (user) {
        setCurrentUser(user);
        if (!editingQuotation?.salesperson_name) {
          setSalespersonName(user.name);
        }
      }
    });

    getCustomers().then((res) => {
      if (res && res.customers) {
        setCustomersList(res.customers);
      }
    });

    getProducts().then((res) => {
      if (res && res.products && res.products.length > 0) {
        setCatalogProducts(res.products);
      }
    });
  }, [editingQuotation]);

  // Filtered customer list for search
  const filteredCustomers = useMemo(() => {
    if (!customerSearch.trim()) return customersList.slice(0, 10);
    const q = customerSearch.toLowerCase().trim();
    return customersList.filter(
      (c) =>
        c.customer_name?.toLowerCase().includes(q) ||
        c.company_name?.toLowerCase().includes(q) ||
        c.phone?.includes(q) ||
        c.gstin?.toLowerCase().includes(q)
    );
  }, [customersList, customerSearch]);

  const handleSelectCustomer = (c: Customer) => {
    setSelectedCustomerId(c.id);
    setCustomerCode(c.customer_code);
    setCustomerName(c.customer_name);
    setCompanyName(c.company_name || '');
    setCustomerType(c.customer_type);
    setPhone(c.phone);
    setEmail(c.email || '');
    setAddress(c.billing_address || `${c.city || ''}, ${c.state || ''}`.trim());
    if (c.gstin) {
      const stateCode = c.gstin.slice(0, 2);
      if (stateCode === '36') {
        setPlaceOfSupply('36-TELANGANA');
      } else {
        setPlaceOfSupply(`${stateCode}-OTHER`);
      }
    }
    setIsCustomerDropdownOpen(false);
    setCustomerSearch('');
  };

  // Add Item from Library
  const handleAddFromCatalog = (sku: string) => {
    const prod = catalogProducts.find((p) => p.sku === sku);
    if (!prod) return;

    const rate = prod.selling_price || 0;
    const gst = prod.gst_rate ?? 18;
    const qty = 1;
    const taxable = rate * qty;
    const total = taxable * (1 + gst / 100);

    setItems((prev) => [
      ...prev,
      {
        product_name: prod.name,
        sku: prod.sku,
        category: prod.category_name,
        unit: prod.unit || 'Nos.',
        quantity: qty,
        purchase_price: prod.purchase_price || 0,
        selling_price: rate,
        discount_pct: 0,
        discount_amount: 0,
        gst_rate: gst,
        hsn_sac: prod.hsn_sac || '8471',
        total_amount: roundTo2Decimals(total),
        is_custom: false,
      },
    ]);
  };

  // Add Custom Item (Does NOT need to exist in catalog)
  const handleAddCustomItem = () => {
    setItems((prev) => [
      ...prev,
      {
        product_name: '',
        sku: '',
        category: 'Custom Equipment',
        unit: 'Nos.',
        quantity: 1,
        purchase_price: 0,
        selling_price: 0,
        discount_pct: 0,
        discount_amount: 0,
        gst_rate: 18,
        hsn_sac: '8471',
        total_amount: 0,
        is_custom: true,
      },
    ]);
  };

  // Add Site Installation / Service Line
  const handleAddServiceLine = () => {
    setItems((prev) => [
      ...prev,
      {
        product_name: 'Site Installation, Cabling, Bracket Mounting & Testing',
        sku: 'SRV-INSTALL',
        category: 'Services',
        unit: 'Set',
        quantity: 1,
        purchase_price: 5000,
        selling_price: 12000,
        discount_pct: 0,
        discount_amount: 0,
        gst_rate: 18,
        hsn_sac: '998719',
        total_amount: roundTo2Decimals(12000 * 1.18),
        is_custom: true,
      },
    ]);
  };

  // Duplicate an item
  const handleDuplicateItem = (idx: number) => {
    const it = items[idx];
    if (!it) return;
    setItems((prev) => [
      ...prev.slice(0, idx + 1),
      { ...it },
      ...prev.slice(idx + 1),
    ]);
  };

  // Remove an item
  const handleRemoveItem = (idx: number) => {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  };

  // Update item field with Pricing Mode Awareness
  const handleItemChange = (idx: number, field: keyof QuotationItem, val: any) => {
    const updated = [...items];
    const it = { ...updated[idx], [field]: val };

    const qty = Math.max(0, Number(it.quantity) || 0);
    const gstRate = Number(it.gst_rate ?? 18);
    let enteredRate = Math.max(0, Number(it.selling_price) || 0);
    const purchaseCost = Math.max(0, Number(it.purchase_price) || 0);

    // If pricingMode is INCLUSIVE, selling_price represents the inclusive rate
    let lineTaxable = 0;
    let lineTotal = 0;

    if (pricingMode === 'INCLUSIVE') {
      const lineInclusiveGross = enteredRate * qty;
      const discPct = Math.min(100, Math.max(0, Number(it.discount_pct) || 0));
      const discAmt = (lineInclusiveGross * discPct) / 100;
      lineTotal = roundTo2Decimals(Math.max(0, lineInclusiveGross - discAmt));
      lineTaxable = gstRate > 0 ? roundTo2Decimals(lineTotal / (1 + gstRate / 100)) : lineTotal;
      it.discount_amount = roundTo2Decimals(discAmt);
    } else {
      const lineGross = enteredRate * qty;
      const discPct = Math.min(100, Math.max(0, Number(it.discount_pct) || 0));
      const discAmt = (lineGross * discPct) / 100;
      lineTaxable = roundTo2Decimals(Math.max(0, lineGross - discAmt));
      const lineGst = (lineTaxable * gstRate) / 100;
      lineTotal = roundTo2Decimals(lineTaxable + lineGst);
      it.discount_amount = roundTo2Decimals(discAmt);
    }

    it.quantity = qty;
    it.total_amount = lineTotal;
    updated[idx] = it;
    setItems(updated);
  };

  // Financial aggregates
  const isTelangana = placeOfSupply.startsWith('36');

  const { subtotal, totalLineDiscounts, taxableAmount, totalTax, cgstAmount, sgstAmount, igstAmount, grandTotal, totalPurchaseCost, estimatedProfit, marginPct } = useMemo(() => {
    let sub = 0;
    let lineDisc = 0;
    let taxAmt = 0;
    let taxTotal = 0;
    let costTotal = 0;

    for (const it of items) {
      const qty = Number(it.quantity) || 0;
      const rate = Number(it.selling_price) || 0;
      const gstRate = Number(it.gst_rate ?? 18);
      const cost = Number(it.purchase_price) || 0;
      costTotal += cost * qty;

      if (pricingMode === 'INCLUSIVE') {
        const lineGross = rate * qty;
        sub += lineGross;
        const disc = Number(it.discount_amount) || 0;
        lineDisc += disc;
        const netLine = Math.max(0, lineGross - disc);
        const lineTaxable = gstRate > 0 ? netLine / (1 + gstRate / 100) : netLine;
        taxAmt += lineTaxable;
        taxTotal += (netLine - lineTaxable);
      } else {
        const lineGross = rate * qty;
        sub += lineGross;
        const disc = Number(it.discount_amount) || 0;
        lineDisc += disc;
        const lineTaxable = Math.max(0, lineGross - disc);
        taxAmt += lineTaxable;
        taxTotal += (lineTaxable * gstRate) / 100;
      }
    }

    const netTaxable = Math.max(0, taxAmt - overallDiscountAmount);
    const finalGrand = roundTo2Decimals(netTaxable + taxTotal);
    const cgst = isTelangana ? roundTo2Decimals(taxTotal / 2) : 0;
    const sgst = isTelangana ? roundTo2Decimals(taxTotal / 2) : 0;
    const igst = isTelangana ? 0 : roundTo2Decimals(taxTotal);
    const profit = roundTo2Decimals(netTaxable - costTotal);
    const margin = netTaxable > 0 ? roundTo2Decimals((profit / netTaxable) * 100) : 0;

    return {
      subtotal: roundTo2Decimals(sub),
      totalLineDiscounts: roundTo2Decimals(lineDisc),
      taxableAmount: roundTo2Decimals(netTaxable),
      totalTax: roundTo2Decimals(taxTotal),
      cgstAmount: cgst,
      sgstAmount: sgst,
      igstAmount: igst,
      grandTotal: finalGrand,
      totalPurchaseCost: roundTo2Decimals(costTotal),
      estimatedProfit: profit,
      marginPct: margin,
    };
  }, [items, pricingMode, overallDiscountAmount, isTelangana]);

  // Discount Governance
  const effectiveDiscountPct = subtotal > 0 ? ((totalLineDiscounts + overallDiscountAmount) / subtotal) * 100 : 0;
  const discountRule = DISCOUNT_APPROVAL_RULES.find((r) => r.role === userRole) || {
    role: userRole,
    maxDiscountPct: 5,
    requiresApprovalFrom: 'BDM',
  };
  const isDiscountApprovalRequired = effectiveDiscountPct > discountRule.maxDiscountPct;

  // Build Terms List
  const computedTerms = useMemo(() => [
    `Payment Terms: ${paymentTerms}`,
    `Delivery: ${deliveryTerms}`,
    `Validity: ${validityDays} Days`,
    `Warranty: ${warrantyTerms}`,
    `Installation: ${installationTerms}`,
    `Taxes: ${pricingMode === 'INCLUSIVE' ? 'GST Inclusive' : 'GST 18% as applicable'}`,
    specialNotes,
  ].filter(Boolean), [paymentTerms, deliveryTerms, validityDays, warrantyTerms, installationTerms, pricingMode, specialNotes]);

  // Build current quotation snapshot for Preview
  const currentQuotationSnapshot: Quotation = useMemo(() => ({
    id: editingQuotation?.id || 'new-quotation-preview',
    quotation_number: quotationNumber,
    revision_number: editingQuotation ? (editingQuotation.revision_number || 1) + 1 : 1,
    entity_code: 'ICON_TECH_PRO',
    customer_id: selectedCustomerId || 'CUST-TEMP',
    customer_name: customerName || 'Valued Customer',
    company_name: companyName || '',
    customer_type: customerType,
    phone: phone || '',
    email: email || '',
    address: address || '',
    salesperson_name: salespersonName,
    quotation_date: quotationDate,
    validity_days: validityDays,
    place_of_supply: placeOfSupply,
    dispatch_from: dispatchFrom,
    items,
    subtotal,
    total_discount: totalLineDiscounts + overallDiscountAmount,
    taxable_amount: taxableAmount,
    cgst_amount: cgstAmount,
    sgst_amount: sgstAmount,
    igst_amount: igstAmount,
    grand_total: grandTotal,
    total_cost: totalPurchaseCost,
    margin_pct: marginPct,
    payment_terms: paymentTerms,
    delivery_terms: deliveryTerms,
    terms_conditions: computedTerms,
    include_signature: includeSignature,
    status: (editingQuotation?.status as any) || 'Draft',
    notes: specialNotes,
    created_at: editingQuotation?.created_at || new Date().toISOString(),
  }), [
    editingQuotation,
    quotationNumber,
    selectedCustomerId,
    customerName,
    companyName,
    customerType,
    phone,
    email,
    address,
    salespersonName,
    quotationDate,
    validityDays,
    placeOfSupply,
    dispatchFrom,
    items,
    subtotal,
    totalLineDiscounts,
    overallDiscountAmount,
    taxableAmount,
    cgstAmount,
    sgstAmount,
    igstAmount,
    grandTotal,
    totalPurchaseCost,
    marginPct,
    paymentTerms,
    deliveryTerms,
    computedTerms,
    includeSignature,
    specialNotes,
  ]);

  // Form Submit Handler
  const handleSave = async (statusOverride?: 'Draft' | 'Sent') => {
    if (!customerName.trim() || !phone.trim()) {
      setErrorMessage('Please select or enter the Customer Name and Contact Phone.');
      return;
    }
    if (items.length === 0) {
      setErrorMessage('Please add at least one line item to the quotation.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const payloadData = {
        quotation_number: quotationNumber.trim(),
        customer_id: selectedCustomerId || 'CUST-QUOTE',
        customer_name: customerName.trim(),
        company_name: companyName.trim() || undefined,
        customer_type: customerType,
        phone: phone.trim(),
        email: email.trim() || undefined,
        address: address.trim() || undefined,
        place_of_supply: placeOfSupply,
        dispatch_from: dispatchFrom,
        salesperson_name: salespersonName,
        quotation_date: quotationDate,
        validity_days: validityDays,
        items,
        payment_terms: paymentTerms,
        delivery_terms: deliveryTerms,
        terms_conditions: computedTerms,
        include_signature: includeSignature,
        notes: specialNotes,
        status: statusOverride || (editingQuotation ? editingQuotation.status : 'Draft'),
      };

      const res = editingQuotation
        ? await updateQuotation(editingQuotation.id, payloadData, userRole)
        : await createQuotation(payloadData, userRole);

      if (res.success) {
        if (isModal && onCloseModal) {
          onCloseModal();
        } else {
          router.push(onSuccessRedirect);
        }
      } else {
        setErrorMessage(res.error || 'Failed to save quotation. Please try again.');
      }
    } catch (err: any) {
      console.error('Save quotation error:', err);
      setErrorMessage(err?.message || 'An unexpected error occurred while saving.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header / Console */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/quotations"
            className="p-2 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition"
            title="Back to Quotations"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                {editingQuotation ? 'Edit Quotation' : 'New Quotation'}
              </h1>
              {editingQuotation && (
                <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 border border-amber-300 text-xs font-bold font-mono">
                  Rev {(editingQuotation.revision_number || 1) + 1}
                </span>
              )}
              <span className="px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 text-xs font-bold">
                {editingQuotation?.status || 'Draft'}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Create a clean, GST-compliant customer quotation.
            </p>
          </div>
        </div>

        {/* Header Metadata Chips */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl text-xs">
            <span className="font-bold text-slate-500">Quote #:</span>
            <input
              type="text"
              value={quotationNumber}
              onChange={(e) => setQuotationNumber(e.target.value)}
              className="font-mono font-bold text-blue-700 bg-transparent outline-none w-28"
            />
            <button
              type="button"
              onClick={() => setQuotationNumber(generateNewQuoteNumber())}
              className="text-slate-400 hover:text-slate-700 transition"
              title="Generate new number"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl text-xs">
            <span className="font-bold text-slate-500">Date:</span>
            <input
              type="date"
              value={quotationDate}
              onChange={(e) => setQuotationDate(e.target.value)}
              className="font-medium text-slate-800 bg-transparent outline-none"
            />
          </div>

          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl text-xs">
            <span className="font-bold text-slate-500">Salesperson:</span>
            <span className="font-bold text-slate-800">{salespersonName}</span>
          </div>
        </div>
      </div>

      {/* Submission Error Banner */}
      {errorMessage && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-300 text-rose-800 text-xs font-medium flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Main Two-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Form Sections (8 Cols) */}
        <div className="lg:col-span-8 space-y-6">
          {/* =========================================================================
              STEP 1: CUSTOMER
             ========================================================================= */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="flex items-center justify-center w-6 h-6 rounded-lg bg-blue-100 text-blue-700 text-xs font-black">
                  1
                </span>
                <h2 className="text-sm font-black text-slate-900 uppercase tracking-wider">
                  Customer
                </h2>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsNewCustomerModalOpen(true)}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-blue-50 text-blue-700 hover:bg-blue-100 text-xs font-bold transition"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ New Customer</span>
                </button>
              </div>
            </div>

            {/* Linked Enquiry reference if present */}
            {enquiryContext?.enquiry_number && (
              <div className="p-3 rounded-xl bg-amber-50/80 border border-amber-200 text-xs flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-amber-900">Linked Enquiry:</span>
                  <Link
                    href="/dashboard/enquiries"
                    className="font-mono font-bold text-blue-700 hover:underline"
                  >
                    {enquiryContext.enquiry_number}
                  </Link>
                  {enquiryContext.requirement_summary && (
                    <span className="text-slate-600 truncate max-w-sm">
                      &bull; {enquiryContext.requirement_summary}
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Customer Search Box */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="text"
                value={customerSearch}
                onFocus={() => setIsCustomerDropdownOpen(true)}
                onChange={(e) => {
                  setCustomerSearch(e.target.value);
                  setIsCustomerDropdownOpen(true);
                }}
                placeholder="Search customer by name, company, phone or GSTIN..."
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 outline-none text-xs focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-slate-50/50"
              />

              {/* Customer Search Dropdown */}
              {isCustomerDropdownOpen && (
                <div className="absolute z-30 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl max-h-60 overflow-y-auto divide-y divide-slate-100">
                  {filteredCustomers.length === 0 ? (
                    <div className="p-4 text-center text-xs text-slate-500">
                      No matching customer found.{' '}
                      <button
                        type="button"
                        onClick={() => {
                          setIsCustomerDropdownOpen(false);
                          setIsNewCustomerModalOpen(true);
                        }}
                        className="text-blue-600 font-bold hover:underline"
                      >
                        Create new customer
                      </button>
                    </div>
                  ) : (
                    filteredCustomers.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => handleSelectCustomer(c)}
                        className="w-full text-left p-3 hover:bg-blue-50/70 transition flex items-center justify-between text-xs"
                      >
                        <div>
                          <strong className="block font-bold text-slate-900">
                            {c.company_name || c.customer_name}
                          </strong>
                          <span className="text-slate-500 text-[11px]">
                            {c.customer_name} &bull; {c.phone} {c.gstin && `&bull; GSTIN: ${c.gstin}`}
                          </span>
                        </div>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                          {c.customer_type}
                        </span>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* Selected Customer Card */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Company Name
                  </label>
                  <input
                    type="text"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="Company / Institution"
                    className="w-full mt-1 p-2 bg-white rounded-lg border border-slate-200 font-bold text-slate-900 outline-none"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Contact Person *
                  </label>
                  <input
                    type="text"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="Contact Person Name"
                    className="w-full mt-1 p-2 bg-white rounded-lg border border-slate-200 font-semibold text-slate-900 outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Phone *
                  </label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="10-digit mobile number"
                    className="w-full mt-1 p-2 bg-white rounded-lg border border-slate-200 font-mono text-slate-900 outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Email
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@company.com"
                    className="w-full mt-1 p-2 bg-white rounded-lg border border-slate-200 text-slate-800 outline-none"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Place of Supply (State)
                  </label>
                  <select
                    value={placeOfSupply}
                    onChange={(e) => setPlaceOfSupply(e.target.value)}
                    className="w-full mt-1 p-2 bg-white rounded-lg border border-slate-200 font-semibold text-slate-800 outline-none"
                  >
                    <option value="36-TELANGANA">36 - TELANGANA (CGST + SGST)</option>
                    <option value="37-ANDHRA PRADESH">37 - ANDHRA PRADESH (IGST)</option>
                    <option value="29-KARNATAKA">29 - KARNATAKA (IGST)</option>
                    <option value="33-TAMIL NADU">33 - TAMIL NADU (IGST)</option>
                    <option value="27-MAHARASHTRA">27 - MAHARASHTRA (IGST)</option>
                    <option value="07-DELHI">07 - DELHI (IGST)</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Customer Type
                  </label>
                  <select
                    value={customerType}
                    onChange={(e) => setCustomerType(e.target.value as any)}
                    className="w-full mt-1 p-2 bg-white rounded-lg border border-slate-200 font-semibold text-slate-800 outline-none"
                  >
                    <option value="COMPANY">Commercial Company</option>
                    <option value="INDIVIDUAL">Individual Client</option>
                    <option value="GOVERNMENT">Government / PSU</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Billing & Delivery Address
                </label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Office / Site Address"
                  className="w-full mt-1 p-2 bg-white rounded-lg border border-slate-200 text-slate-800 outline-none"
                />
              </div>
            </div>
          </div>

          {/* =========================================================================
              STEP 2: PRODUCTS / SERVICES
             ========================================================================= */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="flex items-center justify-center w-6 h-6 rounded-lg bg-blue-100 text-blue-700 text-xs font-black">
                  2
                </span>
                <h2 className="text-sm font-black text-slate-900 uppercase tracking-wider">
                  Products / Services
                </h2>
                <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-xs font-bold">
                  {items.length} {items.length === 1 ? 'Item' : 'Items'}
                </span>
              </div>

              {/* Pricing Mode Toggle: Before GST vs Including GST */}
              <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl text-xs">
                <span className="text-[11px] font-bold text-slate-500 pl-2">Price Mode:</span>
                <button
                  type="button"
                  onClick={() => setPricingMode('EXCLUSIVE')}
                  className={`px-3 py-1 rounded-lg font-bold text-xs transition ${
                    pricingMode === 'EXCLUSIVE'
                      ? 'bg-white text-blue-700 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Before GST
                </button>
                <button
                  type="button"
                  onClick={() => setPricingMode('INCLUSIVE')}
                  className={`px-3 py-1 rounded-lg font-bold text-xs transition ${
                    pricingMode === 'INCLUSIVE'
                      ? 'bg-white text-blue-700 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Including GST
                </button>
              </div>
            </div>

            <p className="text-[11px] text-slate-500">
              {pricingMode === 'INCLUSIVE'
                ? '💡 Including GST mode active: Enter the all-inclusive agreed price. Base taxable and GST are calculated automatically.'
                : '💡 Before GST mode active: Enter the standard unit price before tax. GST is applied on top.'}
            </p>

            {/* Quick Add Buttons */}
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={handleAddCustomItem}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs transition"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Add Custom Item</span>
              </button>

              <button
                type="button"
                onClick={handleAddServiceLine}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition"
              >
                <Wrench className="w-3.5 h-3.5 text-blue-600" />
                <span>+ Add Installation Service</span>
              </button>

              {/* Add from Catalog Dropdown */}
              <div className="flex items-center gap-1.5 ml-auto">
                <select
                  value={selectedCatalogSku}
                  onChange={(e) => {
                    setSelectedCatalogSku(e.target.value);
                    if (e.target.value) {
                      handleAddFromCatalog(e.target.value);
                      setSelectedCatalogSku('');
                    }
                  }}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 outline-none"
                >
                  <option value="">Select from Product Master...</option>
                  {catalogProducts.map((p) => (
                    <option key={p.sku} value={p.sku}>
                      {p.name} (₹{p.selling_price.toLocaleString('en-IN')})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Line Items Table */}
            {items.length === 0 ? (
              <div className="p-8 text-center border-2 border-dashed border-slate-200 rounded-xl space-y-2">
                <Layers className="w-8 h-8 text-slate-300 mx-auto" />
                <p className="text-xs font-bold text-slate-700">No items in quotation yet</p>
                <p className="text-xs text-slate-400">
                  Click "+ Add Custom Item" to type any product or select one from the catalog above.
                </p>
              </div>
            ) : (
              <>
                {/* Desktop Zero-Scroll Table View */}
                <div className="hidden md:block border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-left text-xs border-collapse table-fixed">
                    <colgroup>
                      <col className="w-[4%]" />
                      <col className="w-[34%]" />
                      <col className="w-[8%]" />
                      <col className="w-[10%]" />
                      <col className="w-[16%]" />
                      <col className="w-[10%]" />
                      <col className="w-[12%]" />
                      <col className="w-[6%]" />
                    </colgroup>
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                      <tr>
                        <th className="py-2.5 px-2 text-center">#</th>
                        <th className="py-2.5 px-3">Product / Service & Details</th>
                        <th className="py-2.5 px-2 text-center">Qty</th>
                        <th className="py-2.5 px-2">Unit</th>
                        <th className="py-2.5 px-2 text-right">
                          {pricingMode === 'INCLUSIVE' ? 'Price (Inc)' : 'Price (Ex)'}
                        </th>
                        <th className="py-2.5 px-2 text-center">GST %</th>
                        <th className="py-2.5 px-2 text-right">Amount</th>
                        <th className="py-2.5 px-2 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {items.map((it, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/60 align-top">
                          <td className="p-2 text-slate-400 font-mono text-center pt-3.5">{idx + 1}</td>
                          <td className="p-2.5 space-y-1.5">
                            <div>
                              <input
                                type="text"
                                value={it.product_name}
                                onChange={(e) => handleItemChange(idx, 'product_name', e.target.value)}
                                placeholder="Product / Service Name *"
                                className="w-full font-bold text-slate-900 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-blue-500 placeholder:text-slate-400"
                              />
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <input
                                type="text"
                                value={it.category || ''}
                                onChange={(e) => handleItemChange(idx, 'category', e.target.value)}
                                placeholder="Brand (e.g. Samsung)"
                                className="w-full text-slate-700 bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs outline-none placeholder:text-slate-400"
                              />
                              <input
                                type="text"
                                value={it.sku || ''}
                                onChange={(e) => handleItemChange(idx, 'sku', e.target.value)}
                                placeholder="Model / SKU"
                                className="w-full font-mono text-slate-700 bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs outline-none placeholder:text-slate-400"
                              />
                            </div>
                            <div>
                              <input
                                type="text"
                                value={it.internal_remarks || ''}
                                onChange={(e) => handleItemChange(idx, 'internal_remarks', e.target.value)}
                                placeholder="Description / Scope Details..."
                                className="w-full text-[11px] text-slate-600 bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs outline-none placeholder:text-slate-400"
                              />
                            </div>
                          </td>
                          <td className="p-2 pt-3">
                            <input
                              type="number"
                              min="1"
                              value={it.quantity}
                              onChange={(e) => handleItemChange(idx, 'quantity', e.target.value)}
                              className="w-full text-center p-1.5 rounded-lg border border-slate-200 font-bold text-slate-900 outline-none"
                            />
                          </td>
                          <td className="p-2 pt-3">
                            <select
                              value={it.unit || 'Nos.'}
                              onChange={(e) => handleItemChange(idx, 'unit', e.target.value)}
                              className="w-full p-1.5 rounded-lg border border-slate-200 text-slate-700 outline-none bg-white text-xs"
                            >
                              <option value="Nos.">Nos.</option>
                              <option value="Set">Set</option>
                              <option value="Meter">Meter</option>
                              <option value="Lot">Lot</option>
                              <option value="Months">Months</option>
                            </select>
                          </td>
                          <td className="p-2 pt-3">
                            <input
                              type="number"
                              min="0"
                              value={it.selling_price || ''}
                              onChange={(e) => handleItemChange(idx, 'selling_price', e.target.value)}
                              placeholder="0"
                              className="w-full text-right p-1.5 rounded-lg border border-slate-200 font-mono font-bold text-slate-900 outline-none text-xs focus:ring-1 focus:ring-blue-500"
                            />
                          </td>
                          <td className="p-2 pt-3 text-center">
                            <select
                              value={it.gst_rate ?? 18}
                              onChange={(e) => handleItemChange(idx, 'gst_rate', Number(e.target.value))}
                              className="w-full p-1.5 rounded-lg border border-slate-200 text-slate-700 outline-none bg-white text-xs"
                            >
                              <option value="0">0%</option>
                              <option value="5">5%</option>
                              <option value="12">12%</option>
                              <option value="18">18%</option>
                              <option value="28">28%</option>
                            </select>
                          </td>
                          <td className="p-2 pt-4 text-right font-black font-mono text-slate-900 text-xs">
                            ₹{it.total_amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          <td className="p-2 pt-3 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                type="button"
                                onClick={() => handleDuplicateItem(idx)}
                                className="p-1.5 rounded text-slate-400 hover:text-blue-600 hover:bg-slate-100 transition"
                                title="Duplicate row"
                              >
                                <Copy className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRemoveItem(idx)}
                                className="p-1.5 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                                title="Remove item"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Zero-Scroll Stacked Cards View */}
                <div className="block md:hidden space-y-3">
                  {items.map((it, idx) => (
                    <div key={idx} className="p-3.5 bg-white border border-slate-200 rounded-xl shadow-xs space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs text-slate-500 uppercase">Item #{idx + 1}</span>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleDuplicateItem(idx)}
                            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-slate-400 hover:text-blue-600 hover:bg-slate-100 transition"
                            title="Duplicate row"
                          >
                            <Copy className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(idx)}
                            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                            title="Remove item"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      <div>
                        <label className="text-[11px] font-bold text-slate-600 mb-1 block">Product / Service Name *</label>
                        <input
                          type="text"
                          value={it.product_name}
                          onChange={(e) => handleItemChange(idx, 'product_name', e.target.value)}
                          placeholder="Product / Service Name"
                          className="w-full font-bold text-slate-900 bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-blue-500"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[11px] font-medium text-slate-500 mb-1 block">Brand</label>
                          <input
                            type="text"
                            value={it.category || ''}
                            onChange={(e) => handleItemChange(idx, 'category', e.target.value)}
                            placeholder="Brand"
                            className="w-full text-slate-700 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs outline-none"
                          />
                        </div>
                        <div>
                          <label className="text-[11px] font-medium text-slate-500 mb-1 block">Model / SKU</label>
                          <input
                            type="text"
                            value={it.sku || ''}
                            onChange={(e) => handleItemChange(idx, 'sku', e.target.value)}
                            placeholder="Model / SKU"
                            className="w-full font-mono text-slate-700 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs outline-none"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="text-[11px] font-medium text-slate-500 mb-1 block">Description</label>
                        <input
                          type="text"
                          value={it.internal_remarks || ''}
                          onChange={(e) => handleItemChange(idx, 'internal_remarks', e.target.value)}
                          placeholder="Scope / Remarks"
                          className="w-full text-slate-600 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs outline-none"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-100">
                        <div>
                          <label className="text-[11px] font-medium text-slate-500 mb-1 block">Quantity</label>
                          <input
                            type="number"
                            min="1"
                            value={it.quantity}
                            onChange={(e) => handleItemChange(idx, 'quantity', e.target.value)}
                            className="w-full p-2 text-center rounded-lg border border-slate-200 font-bold text-slate-900 text-xs"
                          />
                        </div>
                        <div>
                          <label className="text-[11px] font-medium text-slate-500 mb-1 block">Unit</label>
                          <select
                            value={it.unit || 'Nos.'}
                            onChange={(e) => handleItemChange(idx, 'unit', e.target.value)}
                            className="w-full p-2 rounded-lg border border-slate-200 text-slate-700 bg-white text-xs"
                          >
                            <option value="Nos.">Nos.</option>
                            <option value="Set">Set</option>
                            <option value="Meter">Meter</option>
                            <option value="Lot">Lot</option>
                            <option value="Months">Months</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-[11px] font-medium text-slate-500 mb-1 block">
                            {pricingMode === 'INCLUSIVE' ? 'Rate (Inc GST)' : 'Rate (Ex GST)'}
                          </label>
                          <input
                            type="number"
                            min="0"
                            value={it.selling_price || ''}
                            onChange={(e) => handleItemChange(idx, 'selling_price', e.target.value)}
                            placeholder="0"
                            className="w-full text-right p-2 rounded-lg border border-slate-200 font-mono font-bold text-slate-900 text-xs"
                          />
                        </div>
                        <div>
                          <label className="text-[11px] font-medium text-slate-500 mb-1 block">GST Rate</label>
                          <select
                            value={it.gst_rate ?? 18}
                            onChange={(e) => handleItemChange(idx, 'gst_rate', Number(e.target.value))}
                            className="w-full p-2 rounded-lg border border-slate-200 text-slate-700 bg-white text-xs"
                          >
                            <option value="0">0%</option>
                            <option value="5">5%</option>
                            <option value="12">12%</option>
                            <option value="18">18%</option>
                            <option value="28">28%</option>
                          </select>
                        </div>
                      </div>

                      <div className="flex items-center justify-between p-2.5 bg-slate-50 rounded-lg">
                        <span className="text-xs font-bold text-slate-600">Line Amount:</span>
                        <span className="font-mono font-black text-slate-900 text-sm">
                          ₹{it.total_amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* =========================================================================
              STEP 3: TERMS & CONDITIONS
             ========================================================================= */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-xs space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              <span className="flex items-center justify-center w-6 h-6 rounded-lg bg-blue-100 text-blue-700 text-xs font-black">
                3
              </span>
              <h2 className="text-sm font-black text-slate-900 uppercase tracking-wider">
                Terms & Conditions
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs">
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Payment Terms
                </label>
                <select
                  value={paymentTerms}
                  onChange={(e) => setPaymentTerms(e.target.value)}
                  className="w-full mt-1 p-2 bg-white rounded-lg border border-slate-200 font-semibold text-slate-800 outline-none"
                >
                  <option value="100% Advance Payment">100% Advance Payment</option>
                  <option value="50% Advance, 50% on Delivery">50% Advance, 50% on Delivery</option>
                  <option value="30 Days Net Credit">30 Days Net Credit</option>
                  <option value="15 Days Net Credit">15 Days Net Credit</option>
                  <option value="Against Proforma Invoice">Against Proforma Invoice</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Delivery Timeline
                </label>
                <select
                  value={deliveryTerms}
                  onChange={(e) => setDeliveryTerms(e.target.value)}
                  className="w-full mt-1 p-2 bg-white rounded-lg border border-slate-200 font-semibold text-slate-800 outline-none"
                >
                  <option value="Immediately / 2-3 Working Days">Immediately / 2-3 Working Days</option>
                  <option value="Within 7 Working Days">Within 7 Working Days</option>
                  <option value="2-3 Weeks Subject to Sourcing">2-3 Weeks Subject to Sourcing</option>
                  <option value="As per Project Schedule">As per Project Schedule</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Quotation Validity
                </label>
                <select
                  value={validityDays}
                  onChange={(e) => setValidityDays(Number(e.target.value))}
                  className="w-full mt-1 p-2 bg-white rounded-lg border border-slate-200 font-semibold text-slate-800 outline-none"
                >
                  <option value={7}>7 Days from Quote Date</option>
                  <option value={15}>15 Days from Quote Date</option>
                  <option value={30}>30 Days from Quote Date</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Warranty Coverage
                </label>
                <input
                  type="text"
                  value={warrantyTerms}
                  onChange={(e) => setWarrantyTerms(e.target.value)}
                  className="w-full mt-1 p-2 bg-white rounded-lg border border-slate-200 text-slate-800 outline-none"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Installation & Scope
                </label>
                <input
                  type="text"
                  value={installationTerms}
                  onChange={(e) => setInstallationTerms(e.target.value)}
                  className="w-full mt-1 p-2 bg-white rounded-lg border border-slate-200 text-slate-800 outline-none"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Official Digital Stamp
                </label>
                <label className="flex items-center gap-2 mt-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeSignature}
                    onChange={(e) => setIncludeSignature(e.target.checked)}
                    className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-xs font-semibold text-slate-700">Include Authorized Signatory</span>
                </label>
              </div>
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Commercial Notes & Scope Summary
              </label>
              <textarea
                rows={2}
                value={specialNotes}
                onChange={(e) => setSpecialNotes(e.target.value)}
                placeholder="Notes to print on proposal..."
                className="w-full mt-1 p-2.5 bg-white rounded-lg border border-slate-200 text-xs text-slate-800 outline-none"
              />
            </div>
          </div>

          {/* =========================================================================
              COLLAPSIBLE STEP 4: INTERNAL PRICING & SOURCING (MANAGEMENT CONFIDENTIAL)
             ========================================================================= */}
          {isManagementOrAdmin && (
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 shadow-xs">
              <button
                type="button"
                onClick={() => setShowInternalPricing(!showInternalPricing)}
                className="w-full flex items-center justify-between text-left text-xs font-bold text-slate-700"
              >
                <div className="flex items-center gap-2">
                  <Lock className="w-4 h-4 text-amber-600" />
                  <span className="uppercase tracking-wider">Internal Pricing & Sourcing (Confidential)</span>
                  <span className="text-[10px] text-slate-400 font-normal">
                    (Visible only to MD & BDM • Never shown to customer)
                  </span>
                </div>
                {showInternalPricing ? (
                  <ChevronUp className="w-4 h-4 text-slate-400" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-slate-400" />
                )}
              </button>

              {showInternalPricing && (
                <div className="mt-4 pt-4 border-t border-slate-200 grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                  <div className="p-3 bg-white rounded-xl border border-slate-200">
                    <span className="text-[10px] font-bold text-slate-400 block uppercase">
                      Total Purchase Cost
                    </span>
                    <span className="text-base font-black text-slate-900 font-mono mt-1 block">
                      ₹{Math.round(totalPurchaseCost).toLocaleString('en-IN')}
                    </span>
                  </div>

                  <div className="p-3 bg-white rounded-xl border border-slate-200">
                    <span className="text-[10px] font-bold text-slate-400 block uppercase">
                      Quoted Taxable Value
                    </span>
                    <span className="text-base font-black text-slate-900 font-mono mt-1 block">
                      ₹{Math.round(taxableAmount).toLocaleString('en-IN')}
                    </span>
                  </div>

                  <div className="p-3 bg-white rounded-xl border border-slate-200">
                    <span className="text-[10px] font-bold text-slate-400 block uppercase">
                      Estimated Profit
                    </span>
                    <span
                      className={`text-base font-black font-mono mt-1 block ${
                        estimatedProfit >= 0 ? 'text-emerald-700' : 'text-rose-600'
                      }`}
                    >
                      ₹{Math.round(estimatedProfit).toLocaleString('en-IN')}
                    </span>
                  </div>

                  <div className="p-3 bg-white rounded-xl border border-slate-200">
                    <span className="text-[10px] font-bold text-slate-400 block uppercase">
                      Profit Margin %
                    </span>
                    <span
                      className={`text-base font-black font-mono mt-1 block ${
                        marginPct >= 15 ? 'text-emerald-700' : 'text-amber-600'
                      }`}
                    >
                      {marginPct}%
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Column: Sticky Quotation Summary & Actions (4 Cols) */}
        <div className="lg:col-span-4 space-y-4 lg:sticky lg:top-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-500 border-b border-slate-100 pb-2">
              Quotation Summary
            </h3>

            <div className="space-y-2.5 text-xs">
              <div className="flex items-center justify-between text-slate-600">
                <span>Subtotal ({items.length} items):</span>
                <span className="font-bold font-mono text-slate-900">
                  ₹{Math.round(subtotal).toLocaleString('en-IN')}
                </span>
              </div>

              {totalLineDiscounts > 0 && (
                <div className="flex items-center justify-between text-emerald-700">
                  <span>Line Item Discounts:</span>
                  <span className="font-bold font-mono">
                    -₹{Math.round(totalLineDiscounts).toLocaleString('en-IN')}
                  </span>
                </div>
              )}

              {/* Discount */}
              <div className="flex items-center justify-between pt-1">
                <span className="text-slate-600">Discount:</span>
                <div className="flex items-center gap-1 w-28">
                  <span className="text-slate-400">₹</span>
                  <input
                    type="number"
                    min="0"
                    value={overallDiscountAmount || ''}
                    onChange={(e) => setOverallDiscountAmount(Number(e.target.value) || 0)}
                    placeholder="0"
                    className="w-full text-right p-1 rounded border border-slate-200 font-mono text-xs outline-none"
                  />
                </div>
              </div>

              {/* Discount Governance Notice */}
              {isDiscountApprovalRequired && (
                <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-300 text-amber-800 text-[11px] font-semibold flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>
                    Discount exceeds {discountRule.maxDiscountPct}%. Requires approval from{' '}
                    {discountRule.requiresApprovalFrom}.
                  </span>
                </div>
              )}

              <div className="flex items-center justify-between border-t border-slate-100 pt-2 text-slate-700 font-semibold">
                <span>Taxable Amount:</span>
                <span className="font-mono text-slate-900 font-bold">
                  ₹{taxableAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>

              {/* GST Split */}
              <div className="space-y-1 pt-1 text-[11px] text-slate-500">
                {isTelangana ? (
                  <>
                    <div className="flex items-center justify-between">
                      <span>CGST (9%):</span>
                      <span className="font-mono">₹{cgstAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>SGST (9%):</span>
                      <span className="font-mono">₹{sgstAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                  </>
                ) : (
                  <div className="flex items-center justify-between">
                    <span>IGST (18%):</span>
                    <span className="font-mono">₹{igstAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                )}
                <div className="flex items-center justify-between font-semibold text-slate-700">
                  <span>GST Total:</span>
                  <span className="font-mono">₹{totalTax.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
              </div>

              {/* Dominant Grand Total */}
              <div className="border-t-2 border-slate-900 pt-3">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block">
                  Grand Total (Incl. GST)
                </span>
                <span className="text-2xl sm:text-3xl font-black text-slate-900 font-mono tracking-tight block mt-0.5">
                  ₹{grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
                <span className="text-[10px] text-slate-500 font-medium block mt-1">
                  Indian Rupees (INR) &bull; {pricingMode === 'INCLUSIVE' ? '18% GST Included' : 'GST Applied'}
                </span>
              </div>
            </div>

            {/* Actions Console */}
            <div className="space-y-2 pt-2">
              {/* Primary 1: SAVE QUOTATION */}
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => handleSave('Sent')}
                className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold shadow-md shadow-blue-600/20 transition flex items-center justify-center gap-2 cursor-pointer uppercase tracking-wider"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>
                  {isSubmitting ? 'Saving...' : editingQuotation ? 'SAVE REVISION' : 'SAVE QUOTATION'}
                </span>
              </button>

              {/* Primary 2: PREVIEW */}
              <button
                type="button"
                onClick={() => setIsPreviewOpen(true)}
                className="w-full py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer uppercase tracking-wider"
              >
                <Printer className="w-4 h-4 text-blue-600" />
                <span>PREVIEW</span>
              </button>

              {/* Primary 3: SEND TO CUSTOMER */}
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => {
                  handleSave('Sent');
                  setIsPreviewOpen(true);
                }}
                className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold shadow-sm transition flex items-center justify-center gap-2 cursor-pointer uppercase tracking-wider"
              >
                <Mail className="w-4 h-4" />
                <span>SEND TO CUSTOMER</span>
              </button>

              {/* Secondary Actions */}
              <div className="flex items-center gap-2 pt-1 border-t border-slate-100">
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => handleSave('Draft')}
                  className="flex-1 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-semibold transition cursor-pointer"
                >
                  Save as Draft
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (isModal && onCloseModal) {
                      onCloseModal();
                    } else {
                      router.push('/dashboard/quotations');
                    }
                  }}
                  className="px-4 py-2 rounded-xl text-slate-500 hover:text-slate-700 hover:bg-slate-100 text-xs font-semibold transition cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Customer Creation Modal */}
      <CustomerFormModal
        isOpen={isNewCustomerModalOpen}
        onClose={() => setIsNewCustomerModalOpen(false)}
        onSuccess={() => {
          getCustomers().then((res) => {
            if (res && res.customers) {
              setCustomersList(res.customers);
              if (res.customers.length > 0) {
                handleSelectCustomer(res.customers[0]);
              }
            }
          });
          setIsNewCustomerModalOpen(false);
        }}
      />

      {/* Customer-Facing Preview & PDF Modal */}
      <PrintQuotationModal
        quotation={currentQuotationSnapshot}
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
      />
    </div>
  );
}
