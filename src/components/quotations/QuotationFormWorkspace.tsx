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
  ExternalLink,
  Sparkles,
  ArrowUp,
  ArrowDown,
  SlidersHorizontal,
  Check,
  X,
} from 'lucide-react';
import { getCustomers } from '@/lib/actions/customers';
import { getProducts } from '@/lib/actions/products';
import { createQuotation, updateQuotation } from '@/lib/actions/quotations';
import { getCurrentSessionUser } from '@/lib/actions/users';
import { INITIAL_PRODUCTS, DISCOUNT_APPROVAL_RULES } from '@/lib/constants/erp-data';
import { roundTo2Decimals } from '@/lib/pricing/pricing-engine';
import {
  detectQuotationFormat,
  QUOTATION_FORMAT_REGISTRY,
  FormatDetectionResult,
} from '@/lib/ai/quotation-format-detector';
import { CustomerFormModal } from '@/components/customers/customer-form-modal';
import { PrintQuotationModal } from '@/components/modals/PrintQuotationModal';
import { SpecIntelligenceLookupModal } from '@/components/modals/SpecIntelligenceLookupModal';
import { getTechnicalEvaluations } from '@/lib/actions/technical-evaluations';
import type { TechnicalEvaluation } from '@/types/technical-evaluation';
import type { QuotationItem, Product, Quotation, QuotationFormatType, QuotationStatus } from '@/types/erp';
import type { Customer } from '@/types/customer';
import type { AuthenticatedUser } from '@/lib/auth/session';

export const BANK_ACCOUNTS = [
  {
    key: 'IDBI',
    label: 'IDBI Bank (A/c: ...0161)',
    bank_name: 'IDBI Bank',
    account_holder: 'ICON TECH PRO',
    account_number: '0426653800000161',
    ifsc_code: 'IBKL0000426',
    branch: 'BANDRI COMPLEX, HYDERABAD',
  },
  {
    key: 'HDFC',
    label: 'HDFC Bank (A/c: ...8192)',
    bank_name: 'HDFC Bank',
    account_holder: 'ICON TECH PRO',
    account_number: '50200055248192',
    ifsc_code: 'HDFC0000045',
    branch: 'SR NAGAR, HYDERABAD',
  },
];

export const APPROVED_FORMAT_OPTIONS: {
  key: QuotationFormatType;
  label: string;
  description: string;
}[] = [
  { key: 'STANDARD', label: 'STANDARD', description: 'Single-table itemized commercial quote' },
  { key: 'HOME_THEATER', label: 'HOME THEATER', description: 'Srikanth Atmos Cinema BOQ (5 sections)' },
  { key: 'CONFERENCE_ROOM', label: 'CONFERENCE ROOM', description: 'Boardroom VC & collaboration package' },
  { key: 'CCTV', label: 'CCTV', description: 'Surveillance cameras, NVR & storage' },
  { key: 'NETWORKING', label: 'NETWORKING', description: 'Enterprise switching, Wi-Fi & racks' },
  { key: 'AV_SOLUTION', label: 'AV SOLUTION', description: 'Commercial Audio-Visual distribution' },
  { key: 'AMC_SERVICE', label: 'AMC / SERVICE', description: 'Annual Maintenance Contract & SLA' },
  { key: 'CUSTOM_PROJECT', label: 'CUSTOM / MIXED', description: 'Multi-zone hybrid turnkey project' },
];

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

  // Quote Number Generation: Defaults to atomic sequential on save
  const [quotationNumber, setQuotationNumber] = useState(
    editingQuotation?.quotation_number || '(Auto-generated on Save)'
  );

  // Spec Intelligence CPQ Lookup Modal State
  const [isSpecModalOpen, setIsSpecModalOpen] = useState(false);

  // Persisted quotation reference for dispatch preview
  const [persistedQuotation, setPersistedQuotation] = useState<Quotation | null>(editingQuotation || null);

  // Bank Selection State
  const [selectedBankKey, setSelectedBankKey] = useState<string>(() => {
    if (editingQuotation?.bank_details?.bank_name?.toLowerCase().includes('hdfc')) {
      return 'HDFC';
    }
    return 'IDBI';
  });

  const selectedBank = useMemo(() => {
    return BANK_ACCOUNTS.find((b) => b.key === selectedBankKey) || BANK_ACCOUNTS[0];
  }, [selectedBankKey]);

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
  const [pricingMode, setPricingMode] = useState<'EXCLUSIVE' | 'INCLUSIVE'>(
    editingQuotation?.is_gst_inclusive || (editingQuotation as any)?.pricing_mode === 'INCLUSIVE' ? 'INCLUSIVE' : 'EXCLUSIVE'
  );

  // Products Catalog
  const [catalogProducts, setCatalogProducts] = useState<Product[]>(INITIAL_PRODUCTS);
  const [selectedCatalogSku, setSelectedCatalogSku] = useState('');

  // Quotation Format & AI Detection
  const [quotationFormat, setQuotationFormat] = useState<QuotationFormatType>(
    editingQuotation?.quotation_format || 'STANDARD'
  );
  const [formatConfiguration, setFormatConfiguration] = useState<string>(
    editingQuotation?.format_configuration || ''
  );
  const [detectedFormatInfo, setDetectedFormatInfo] = useState<FormatDetectionResult | null>(null);
  const [isFormatSuggestionDismissed, setIsFormatSuggestionDismissed] = useState(false);
  const [activeSectionId, setActiveSectionId] = useState<string>('ALL');

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

  // Technical Evaluation Integration (Optional Capability)
  const [linkedEvaluations, setLinkedEvaluations] = useState<TechnicalEvaluation[]>([]);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [selectedImportEvaluation, setSelectedImportEvaluation] = useState<TechnicalEvaluation | null>(null);
  const [selectedItemIdsToImport, setSelectedItemIdsToImport] = useState<Record<string, boolean>>({});
  const [importNotice, setImportNotice] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    getTechnicalEvaluations().then((res) => {
      if (!isMounted) return;
      const evals = res.evaluations || [];
      const matched = evals.filter((e) => {
        if (selectedCustomerId && e.customer_id === selectedCustomerId) return true;
        if (customerName && e.customer_name?.toLowerCase().includes(customerName.toLowerCase().trim())) return true;
        if (companyName && e.company_name?.toLowerCase().includes(companyName.toLowerCase().trim())) return true;
        if (enquiryContext?.enquiry_id && (e.enquiry_id === enquiryContext.enquiry_id || e.enquiry_number === enquiryContext.enquiry_id)) return true;
        if (enquiryContext?.enquiry_number && (e.enquiry_number === enquiryContext.enquiry_number || e.enquiry_id === enquiryContext.enquiry_number)) return true;
        return false;
      });
      setLinkedEvaluations(matched);
      if (matched.length > 0 && !selectedImportEvaluation) {
        setSelectedImportEvaluation(matched[0]);
        const initialSelections: Record<string, boolean> = {};
        matched[0].recommended_items.forEach((item) => {
          initialSelections[item.id] = true;
        });
        setSelectedItemIdsToImport(initialSelections);
      }
    });
    return () => {
      isMounted = false;
    };
  }, [selectedCustomerId, customerName, companyName, enquiryContext, selectedImportEvaluation]);

  const handleConfirmImportEquipment = () => {
    if (!selectedImportEvaluation) return;
    const itemsToImport = selectedImportEvaluation.recommended_items.filter(
      (item) => selectedItemIdsToImport[item.id]
    );
    if (itemsToImport.length === 0) return;

    const newQuotationItems: QuotationItem[] = itemsToImport.map((item) => ({
      product_name: `${item.brand} ${item.model}: ${item.specifications}`.trim(),
      sku: `TE-${(item.brand || 'GEN').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4)}-${(item.model || 'MOD').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6)}`,
      brand: item.brand,
      category: selectedImportEvaluation.project_category || 'AV & Commercial',
      unit: item.unit || 'Nos.',
      quantity: item.quantity || 1,
      purchase_price: 0, // Confidential purchase cost strictly omitted
      selling_price: item.estimated_unit_price || 0,
      discount_pct: 0,
      discount_amount: 0,
      gst_rate: item.gst_rate || 18,
      hsn_sac: item.hsn_sac || '8471',
      total_amount: Number(
        ((item.estimated_unit_price || 0) * (item.quantity || 1) * (1 + (item.gst_rate || 18) / 100)).toFixed(2)
      ),
      is_custom: true,
    }));

    setItems((prev) => [...prev, ...newQuotationItems]);
    setIsImportModalOpen(false);
    setImportNotice(
      `Successfully imported ${newQuotationItems.length} recommended items from Technical Evaluation ${selectedImportEvaluation.evaluation_number}.`
    );
  };

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

  // AI Auto-Detection Effect
  useEffect(() => {
    const contextText = [
      enquiryContext?.requirement_summary,
      enquiryContext?.product_category,
      enquiryContext?.notes,
      specialNotes,
    ]
      .filter(Boolean)
      .join(' ');

    if (contextText.trim().length >= 4) {
      const detection = detectQuotationFormat(contextText);
      setDetectedFormatInfo(detection);
      if (detection.configuration && !formatConfiguration) {
        setFormatConfiguration(detection.configuration);
      }
    }
  }, [enquiryContext, specialNotes]);

  // Card helpers
  const handleMoveItem = (idx: number, direction: 'UP' | 'DOWN') => {
    if (direction === 'UP' && idx === 0) return;
    if (direction === 'DOWN' && idx === items.length - 1) return;
    const targetIdx = direction === 'UP' ? idx - 1 : idx + 1;
    const updated = [...items];
    const temp = updated[idx];
    updated[idx] = updated[targetIdx];
    updated[targetIdx] = temp;
    setItems(updated);
  };

  const handleToggleExpand = (idx: number) => {
    setItems((prev) =>
      prev.map((it, i) => (i === idx ? { ...it, is_expanded: !it.is_expanded } : it))
    );
  };

  const handleApplySuggestedFormat = () => {
    if (!detectedFormatInfo) return;
    setQuotationFormat(detectedFormatInfo.format);
    if (detectedFormatInfo.configuration) {
      setFormatConfiguration(detectedFormatInfo.configuration);
    }
    setIsFormatSuggestionDismissed(true);

    // If items exist and format has sections, partition items if not already assigned
    const defaultSecs = QUOTATION_FORMAT_REGISTRY[detectedFormatInfo.format]?.defaultSections || [];
    if (defaultSecs.length > 0) {
      setItems((prev) =>
        prev.map((it, idx) => ({
          ...it,
          section_id: it.section_id || defaultSecs[Math.min(idx, defaultSecs.length - 1)],
        }))
      );
    }
  };

  const handleFormatSwitch = (newFmt: QuotationFormatType) => {
    setQuotationFormat(newFmt);
    const registryKey = (newFmt === 'CCTV' ? 'CCTV' : newFmt === 'AV_SOLUTION' ? 'AV_SOLUTION' : newFmt) as QuotationFormatType;
    const defaultSecs = QUOTATION_FORMAT_REGISTRY[registryKey]?.defaultSections || [];
    if (defaultSecs.length > 0 && items.length > 0) {
      setItems((prev) =>
        prev.map((it, idx) => ({
          ...it,
          section_id: it.section_id || defaultSecs[Math.min(idx, defaultSecs.length - 1)],
        }))
      );
    }
  };

  const handleLoadStandardITItems = () => {
    setQuotationFormat('STANDARD');
    setItems([
      {
        product_name: 'Dell Latitude 3440 Commercial Laptop',
        brand: 'Dell',
        model: 'Latitude 3440',
        category: 'Computing',
        sku: 'DEL-LAT-3440',
        hsn_sac: '84713010',
        unit: 'Nos.',
        quantity: 5,
        purchase_price: 45000,
        selling_price: 54500,
        discount_pct: 0,
        discount_amount: 0,
        gst_rate: 18,
        total_amount: roundTo2Decimals(5 * 54500 * 1.18),
        specs: 'Intel Core i5-1335U (13th Gen) | 16GB DDR4 RAM | 512GB PCIe NVMe SSD | 14.0" FHD Antiglare Display | Windows 11 Pro 64-bit | 3-Year Onsite ProSupport Warranty',
        description: 'Commercial enterprise business laptop engineered for executive productivity, robust corporate security, and dependable day-long mobility with manufacturer onsite warranty.',
        section_id: 'COMMERCIAL PRODUCTS',
      },
      {
        product_name: 'Canon imageCLASS MF3010 Multifunction Laser Printer',
        brand: 'Canon',
        model: 'imageCLASS MF3010',
        category: 'Printers',
        sku: 'CAN-MF3010',
        hsn_sac: '84433100',
        unit: 'Nos.',
        quantity: 2,
        purchase_price: 13500,
        selling_price: 16800,
        discount_pct: 0,
        discount_amount: 0,
        gst_rate: 18,
        total_amount: roundTo2Decimals(2 * 16800 * 1.18),
        specs: 'Monochrome Laser Print, Scan, Copy | 18 ppm Print Speed | 600 × 600 dpi Resolution | 7.8 sec First Printout | 150-Sheet Paper Tray | USB 2.0 High Speed Interface',
        description: 'Compact high-efficiency commercial multifunction laser printer engineered for fast, reliable document handling, sharp text output, and dependable enterprise productivity.',
        section_id: 'COMMERCIAL PRODUCTS',
      },
      {
        product_name: 'Turnkey On-Site Deployment & Operator Handover',
        brand: 'ICON TECH PRO',
        model: 'SRV-INSTALL-COMM',
        category: 'Services',
        sku: 'SRV-INSTALL-01',
        hsn_sac: '998713',
        unit: 'Job',
        quantity: 1,
        purchase_price: 2500,
        selling_price: 5000,
        discount_pct: 0,
        discount_amount: 0,
        gst_rate: 18,
        total_amount: roundTo2Decimals(5000 * 1.18),
        specs: 'On-site unboxing, driver deployment, network printing setup, operating system user profile handover, and verification.',
        description: 'Professional on-site hardware deployment, driver configuration, and verified handover by certified ICON TECH PRO field technicians.',
        section_id: 'SERVICES & IMPLEMENTATION',
      },
    ]);
  };

  const handleLoadHomeTheaterItems = () => {
    setQuotationFormat('HOME_THEATER');
    setItems([
      {
        product_name: 'BenQ TK710 4K UHD HDR Laser Home Cinema Projector',
        brand: 'BenQ',
        model: 'TK710',
        category: 'Display / Projector',
        sku: 'BNQ-TK710-4K',
        hsn_sac: '85286200',
        unit: 'Nos.',
        quantity: 1,
        purchase_price: 115000,
        selling_price: 145000,
        discount_pct: 0,
        discount_amount: 0,
        gst_rate: 18,
        total_amount: roundTo2Decimals(145000 * 1.18),
        specs: 'True 4K UHD (3840×2160) Resolution | 3,200 ANSI Lumens Laser Light Source | 600,000:1 Dynamic Contrast Ratio | HDR10 / HLG Support | 1.15-1.50 Throw Ratio | Vertical Lens Shift | 2× HDMI 2.0b | 20,000 Hours Laser Life',
        description: 'High-brightness 4K UHD laser home cinema projector engineered for vibrant cinematic viewing, expansive HDR contrast, and exceptional detail even in ambient-lit media rooms.',
        section_id: 'VIDEO PROJECTOR',
      },
      {
        product_name: 'Grandview 135" Motorized Tab-Tensioned 4K Acoustic Projection Screen',
        brand: 'Grandview',
        model: 'Cyber Series 135"',
        category: 'Display / Projector',
        sku: 'GDV-135-TAB',
        hsn_sac: '85286200',
        unit: 'Nos.',
        quantity: 1,
        purchase_price: 68000,
        selling_price: 88000,
        discount_pct: 0,
        discount_amount: 0,
        gst_rate: 18,
        total_amount: roundTo2Decimals(88000 * 1.18),
        specs: '135-Inch Diagonal (16:9 Aspect Ratio) | 4K Acoustically Transparent Micro-Perforated Fabric | 1.1 Gain Matte White | Tab-Tensioning System for Flat Surface | RF/IR Remote + 12V Trigger Control',
        description: 'Premium tab-tensioned motorized acoustic projection screen engineered for flawless optical flatness and transparent audio pass-through from in-wall speakers.',
        section_id: 'AVR / PROTECTION / SCREEN',
      },
      {
        product_name: 'Denon AVC-X3800H 9.4-Channel 8K AV Receiver (Dolby Atmos)',
        brand: 'Denon',
        model: 'AVC-X3800H',
        category: 'Audio & Amplification',
        sku: 'DEN-AVCX3800H',
        hsn_sac: '85182200',
        unit: 'Nos.',
        quantity: 1,
        purchase_price: 125000,
        selling_price: 155000,
        discount_pct: 0,
        discount_amount: 0,
        gst_rate: 18,
        total_amount: roundTo2Decimals(155000 * 1.18),
        specs: '9.4 Channel Discrete Power Amplification | 105W per Channel (8 ohms, 20Hz-20kHz) | Dolby Atmos, DTS:X, IMAX Enhanced, Auro-3D | 8K/60Hz & 4K/120Hz Passthrough | Audyssey MultEQ XT32 Room Calibration | Dirac Live Ready',
        description: 'Audiophile-grade 9.4 channel 8K AV amplifier with four independent subwoofer outputs and advanced acoustic room correction for reference cinema performance.',
        section_id: 'AVR / PROTECTION / SCREEN',
      },
      {
        product_name: 'Klipsch Reference Premiere 7.2 Home Cinema Speaker Package',
        brand: 'Klipsch',
        model: 'RP-8000F II 7.2 System',
        category: 'Audio & Speakers',
        sku: 'KLP-RP72-SYS',
        hsn_sac: '85182200',
        unit: 'Set',
        quantity: 1,
        purchase_price: 240000,
        selling_price: 310000,
        discount_pct: 0,
        discount_amount: 0,
        gst_rate: 18,
        total_amount: roundTo2Decimals(310000 * 1.18),
        specs: 'Pair RP-8000F II Floorstanding Towers | RP-504C II Center Channel | 4× RP-502S II Surround Dipoles | Dual Klipsch SPL-120 12" 600W Powered Subwoofers | Tractrix Horn Titanium Tweeters',
        description: 'Flagship dynamic reference cinema speaker system delivering visceral impact, pinpoint dialogue clarity, and deep tactile low-frequency extension.',
        section_id: 'HOME THEATER ROOM / CONFIGURATION',
      },
      {
        product_name: 'Turnkey Acoustic Calibration, Custom Concealment & System Handover',
        brand: 'ICON TECH PRO',
        model: 'SRV-HT-INTEGRATE',
        category: 'Services',
        sku: 'SRV-HT-INTEG',
        hsn_sac: '998713',
        unit: 'Job',
        quantity: 1,
        purchase_price: 18000,
        selling_price: 35000,
        discount_pct: 0,
        discount_amount: 0,
        gst_rate: 18,
        total_amount: roundTo2Decimals(35000 * 1.18),
        specs: 'Concealed in-wall OFC speaker cabling, ceiling projector bracket alignment, microphone-based DSP acoustic calibration, source switching verification, and certified handover sign-off.',
        description: 'Turnkey on-site home cinema acoustic measurement, speaker angle calibration, video geometry alignment, and comprehensive client system orientation by senior AV engineers.',
        section_id: 'INSTALLATION / DESIGN / TRANSPORT / COMMISSIONING',
      },
    ]);
  };

  const [includeSignature, setIncludeSignature] = useState(
    editingQuotation?.include_signature ?? true
  );

  // Editable Terms & Conditions state (supporting inline additions, edits, and deletions)
  const [customTerms, setCustomTerms] = useState<string[]>(() => {
    if (editingQuotation?.terms_conditions && editingQuotation.terms_conditions.length > 0) {
      return editingQuotation.terms_conditions;
    }
    return [
      'Payment Terms: 100% Advance Payment',
      'Delivery: Immediately / 2-3 Working Days',
      'Validity: 7 Days from Quote Date',
      'Warranty: 1 Year Manufacturer Warranty',
      'Installation: Inclusive of Installation, Mounting & Testing',
      'Taxes: GST 18% as applicable',
      'TRANSPORTATION AND INSTALLATION CHARGES INCLUSIVE',
    ];
  });

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

  // Debounced server-side customer search across all 3,000+ Tally customers
  useEffect(() => {
    if (!customerSearch.trim()) return;
    const timer = setTimeout(async () => {
      try {
        const res = await getCustomers({ search: customerSearch.trim() });
        if (res && res.customers) {
          setCustomersList((prev) => {
            const map = new Map<string, Customer>();
            for (const c of res.customers) map.set(c.id, c);
            for (const c of prev) if (!map.has(c.id)) map.set(c.id, c);
            return Array.from(map.values());
          });
        }
      } catch (err) {
        console.error('Customer lookup error:', err);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [customerSearch]);

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
  const computedTerms = useMemo(() => {
    const list = customTerms.map((t) => t.trim()).filter(Boolean);
    return list.length > 0
      ? list
      : [
          `Payment Terms: ${paymentTerms}`,
          `Delivery: ${deliveryTerms}`,
          `Validity: ${validityDays} Days`,
          `Warranty: ${warrantyTerms}`,
          `Installation: ${installationTerms}`,
          `Taxes: ${pricingMode === 'INCLUSIVE' ? 'GST Inclusive' : 'GST 18% as applicable'}`,
          specialNotes,
        ].filter(Boolean);
  }, [customTerms, paymentTerms, deliveryTerms, validityDays, warrantyTerms, installationTerms, pricingMode, specialNotes]);

  // Build current quotation snapshot for Preview
  const currentQuotationSnapshot: Quotation = useMemo(() => ({
    id: persistedQuotation?.id || editingQuotation?.id || 'new-quotation-preview',
    quotation_number: persistedQuotation?.quotation_number || quotationNumber,
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
    quotation_format: quotationFormat,
    format_configuration: formatConfiguration,
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
    bank_details: {
      bank_name: selectedBank.bank_name,
      account_holder: selectedBank.account_holder,
      account_number: selectedBank.account_number,
      ifsc_code: selectedBank.ifsc_code,
      branch: selectedBank.branch,
    },
    include_signature: includeSignature,
    status: (persistedQuotation?.status || editingQuotation?.status || 'Draft') as any,
    notes: specialNotes,
    created_at: editingQuotation?.created_at || new Date().toISOString(),
  }), [
    persistedQuotation,
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
    quotationFormat,
    formatConfiguration,
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
    selectedBank,
    includeSignature,
    specialNotes,
  ]);

  // Preview Click Handler: Validates quotation data before opening PrintQuotationModal
  const handlePreviewClick = () => {
    if (!customerName.trim()) {
      setErrorMessage('Please enter or select a Customer Name before previewing.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    if (items.length === 0) {
      setErrorMessage('Please add at least one line item to the quotation before previewing.');
      return;
    }
    setErrorMessage(null);
    setIsPreviewOpen(true);
  };

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
      const targetStatus = statusOverride || (editingQuotation ? editingQuotation.status : 'Draft');
      const payloadData = {
        quotation_number: quotationNumber.includes('Auto') ? undefined : quotationNumber.trim(),
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
        quotation_format: quotationFormat,
        format_configuration: formatConfiguration,
        is_gst_inclusive: pricingMode === 'INCLUSIVE',
        pricing_mode: pricingMode,
        items,
        payment_terms: paymentTerms,
        delivery_terms: deliveryTerms,
        terms_conditions: computedTerms,
        bank_details: {
          bank_name: selectedBank.bank_name,
          account_holder: selectedBank.account_holder,
          account_number: selectedBank.account_number,
          ifsc_code: selectedBank.ifsc_code,
          branch: selectedBank.branch,
        },
        include_signature: includeSignature,
        notes: specialNotes,
        status: targetStatus,
      };

      const res = editingQuotation
        ? await updateQuotation(editingQuotation.id, payloadData, userRole)
        : await createQuotation(payloadData, userRole);

      if (res.success) {
        if (res.data) {
          setQuotationNumber(res.data.quotation_number);
          setPersistedQuotation(res.data);
        }
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

  // Send to Customer Handler: validates, saves with status 'Sent', and opens customer dispatch preview without destroying page
  const handleSendToCustomer = async () => {
    if (!customerName.trim() || !phone.trim()) {
      setErrorMessage('Please select or enter the Customer Name and Contact Phone before sending.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    if (items.length === 0) {
      setErrorMessage('Please add at least one line item to the quotation before sending.');
      return;
    }

    if (isDiscountApprovalRequired) {
      setErrorMessage(`Discount exceeds ${discountRule.maxDiscountPct}%. Requires approval from ${discountRule.requiresApprovalFrom} before dispatch.`);
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const payloadData = {
        quotation_number: quotationNumber.includes('Auto') ? undefined : quotationNumber.trim(),
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
        quotation_format: quotationFormat,
        format_configuration: formatConfiguration,
        is_gst_inclusive: pricingMode === 'INCLUSIVE',
        pricing_mode: pricingMode,
        items,
        payment_terms: paymentTerms,
        delivery_terms: deliveryTerms,
        terms_conditions: computedTerms,
        bank_details: {
          bank_name: selectedBank.bank_name,
          account_holder: selectedBank.account_holder,
          account_number: selectedBank.account_number,
          ifsc_code: selectedBank.ifsc_code,
          branch: selectedBank.branch,
        },
        include_signature: includeSignature,
        notes: specialNotes,
        status: 'Sent' as QuotationStatus,
      };

      const res = editingQuotation
        ? await updateQuotation(editingQuotation.id, payloadData, userRole)
        : await createQuotation(payloadData, userRole);

      if (res.success && res.data) {
        setQuotationNumber(res.data.quotation_number);
        setPersistedQuotation(res.data);
        setIsPreviewOpen(true);
      } else {
        setErrorMessage(res.error || 'Failed to save quotation for customer dispatch.');
      }
    } catch (err: any) {
      console.error('Send to customer error:', err);
      setErrorMessage(err?.message || 'An unexpected error occurred while preparing dispatch.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 pb-28">
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
              className="font-mono font-bold text-blue-700 bg-transparent outline-none w-44"
              placeholder="(Auto-generated on Save)"
            />
            <button
              type="button"
              onClick={() => setQuotationNumber('(Auto-generated on Save)')}
              className="text-slate-400 hover:text-slate-700 transition"
              title="Reset to Auto-generated sequence"
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

            {/* Technical Evaluation Integration (Optional Presales Baseline) */}
            {linkedEvaluations.length > 0 && (
              <div className="p-3.5 rounded-xl bg-purple-50/90 border border-purple-200/90 text-xs space-y-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="p-1.5 rounded-lg bg-purple-600 text-white flex-shrink-0">
                      <Wrench className="w-3.5 h-3.5" />
                    </span>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-purple-950">Technical Evaluation Available:</span>
                        <span className="font-mono font-black text-purple-900">
                          {linkedEvaluations[0].evaluation_number}
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-200/80 text-purple-900 border border-purple-300">
                          {linkedEvaluations[0].status}
                        </span>
                      </div>
                      <p className="text-[11px] text-purple-800 mt-0.5">
                        {linkedEvaluations[0].project_category} &bull; {linkedEvaluations[0].recommended_items.length} engineering recommended items
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedImportEvaluation(linkedEvaluations[0]);
                      const selections: Record<string, boolean> = {};
                      linkedEvaluations[0].recommended_items.forEach((it) => {
                        selections[it.id] = true;
                      });
                      setSelectedItemIdsToImport(selections);
                      setIsImportModalOpen(true);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs shadow-xs transition shrink-0"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Review & Import Equipment ({linkedEvaluations[0].recommended_items.length})
                  </button>
                </div>
              </div>
            )}

            {importNotice && (
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  <span>{importNotice}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setImportNotice(null)}
                  className="text-slate-400 hover:text-slate-600 ml-2"
                >
                  <X className="w-4 h-4" />
                </button>
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

              {/* Proposal Subject & Validity Details */}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 pt-2 border-t border-slate-100">
                <div className="sm:col-span-6">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Reference / Proposal Subject
                  </label>
                  <input
                    type="text"
                    value={specialNotes}
                    onChange={(e) => setSpecialNotes(e.target.value)}
                    placeholder="e.g. Supply & Setup of 4K Cinema / Turnkey Office AV"
                    className="w-full mt-1 p-2 bg-white rounded-lg border border-slate-200 text-slate-800 font-medium outline-none text-xs"
                  />
                </div>

                <div className="sm:col-span-3">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Validity (Days)
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={validityDays}
                    onChange={(e) => setValidityDays(Number(e.target.value) || 7)}
                    className="w-full mt-1 p-2 bg-white rounded-lg border border-slate-200 text-slate-800 font-mono outline-none text-xs"
                  />
                </div>

                <div className="sm:col-span-3">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Salesperson
                  </label>
                  <input
                    type="text"
                    value={salespersonName}
                    onChange={(e) => setSalespersonName(e.target.value)}
                    className="w-full mt-1 p-2 bg-slate-50 rounded-lg border border-slate-200 text-slate-800 font-bold outline-none text-xs"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* =========================================================================
              SECTION 2: QUOTATION FORMAT
             ========================================================================= */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="flex items-center justify-center w-6 h-6 rounded-lg bg-indigo-100 text-indigo-700 text-xs font-black">
                  2
                </span>
                <h2 className="text-sm font-black text-slate-900 uppercase tracking-wider">
                  Quotation Format
                </h2>
              </div>
              <span className="text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2.5 py-0.5 rounded-full">
                {QUOTATION_FORMAT_REGISTRY[quotationFormat]?.label || quotationFormat}
              </span>
            </div>

            {/* AI Quotation Format Suggestion Banner */}
            {detectedFormatInfo && !isFormatSuggestionDismissed && detectedFormatInfo.format !== quotationFormat && (
              <div className="p-3.5 rounded-xl bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 text-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
                <div className="flex items-start gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0 mt-0.5">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">
                        AI Format Suggestion
                      </span>
                      <strong className="text-xs sm:text-sm font-black text-slate-900">
                        {detectedFormatInfo.formatLabel}
                      </strong>
                      {detectedFormatInfo.configuration && (
                        <span className="text-xs font-mono font-bold text-indigo-700 bg-white px-2 py-0.5 rounded border border-indigo-200">
                          {detectedFormatInfo.configuration}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-600 mt-1">
                      {detectedFormatInfo.explanation}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                  <button
                    type="button"
                    onClick={handleApplySuggestedFormat}
                    className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-xs transition cursor-pointer"
                  >
                    Apply Suggested Format
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsFormatSuggestionDismissed(true)}
                    className="px-2.5 py-1.5 rounded-lg text-slate-500 hover:text-slate-800 text-xs font-semibold hover:bg-slate-200/60 transition cursor-pointer"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            )}

            {/* 8 Approved Format Selector Cards Grid */}
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider block">
                  QUOTATION FORMAT SELECTOR (8 APPROVED PRESETS)
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500 font-medium">Quick Presets:</span>
                  <button
                    type="button"
                    onClick={handleLoadStandardITItems}
                    className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 shadow-2xs transition cursor-pointer"
                    title="Load standard IT products (Dell Laptop, Canon Printer, Onsite Deployment)"
                  >
                    Load IT Preset
                  </button>
                  <button
                    type="button"
                    onClick={handleLoadHomeTheaterItems}
                    className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 shadow-2xs transition cursor-pointer"
                    title="Load Srikanth Home Theater project items"
                  >
                    Load HT Preset
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5" data-testid="format-selector-tabs">
                {APPROVED_FORMAT_OPTIONS.map((f) => {
                  const isActive =
                    quotationFormat === f.key ||
                    (f.key === 'CCTV' && quotationFormat === 'CCTV_SURVEILLANCE') ||
                    (f.key === 'AV_SOLUTION' && (quotationFormat === 'AV' || quotationFormat === 'AV_PROJECTOR')) ||
                    (f.key === 'CUSTOM_PROJECT' && quotationFormat === 'CUSTOM_MIXED');

                  return (
                    <button
                      key={f.key}
                      type="button"
                      onClick={() => handleFormatSwitch(f.key)}
                      className={`p-3 rounded-xl text-xs text-left transition flex flex-col justify-between border cursor-pointer ${
                        isActive
                          ? 'bg-blue-600 text-white font-bold border-blue-600 shadow-sm ring-2 ring-blue-500/20'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 hover:border-slate-300 font-medium shadow-2xs'
                      }`}
                      data-testid={`format-tab-${f.key}`}
                    >
                      <div className="flex items-center justify-between w-full">
                        <span className="tracking-tight">{f.label}</span>
                        {isActive && <Check className="w-4 h-4 text-white shrink-0" />}
                      </div>
                      <span className={`text-[10px] mt-1.5 line-clamp-1 ${isActive ? 'text-blue-100' : 'text-slate-500'}`}>
                        {f.description}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Active Format Description & Telemetry */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                <div className="flex items-center gap-2">
                  <SlidersHorizontal className="w-4 h-4 text-slate-500 shrink-0" />
                  <span className="font-bold text-slate-700">Active Engine:</span>
                  <span className="font-black text-blue-700 font-mono">
                    {QUOTATION_FORMAT_REGISTRY[quotationFormat]?.label || quotationFormat}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 italic">
                  {QUOTATION_FORMAT_REGISTRY[quotationFormat]?.description || 'Commercial quote format'}
                </p>
              </div>
            </div>

            {/* Project Section Navigation Tabs (When Project Format is Selected) */}
            {quotationFormat !== 'STANDARD' && QUOTATION_FORMAT_REGISTRY[quotationFormat]?.defaultSections && (
              <div className="flex items-center gap-1.5 flex-wrap pt-1 pb-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mr-1">
                  Active Sections:
                </span>
                <button
                  type="button"
                  onClick={() => setActiveSectionId('ALL')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                    activeSectionId === 'ALL'
                      ? 'bg-blue-600 text-white shadow-2xs'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                  }`}
                >
                  All Items ({items.length})
                </button>
                {QUOTATION_FORMAT_REGISTRY[quotationFormat].defaultSections.map((secName, sIdx) => {
                  const count = items.filter((it) => it.section_id === secName).length;
                  return (
                    <button
                      key={sIdx}
                      type="button"
                      onClick={() => setActiveSectionId(secName)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                        activeSectionId === secName
                          ? 'bg-blue-600 text-white shadow-2xs'
                          : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                      }`}
                    >
                      <span className="truncate max-w-[200px]">{secName}</span>
                      <span
                        className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                          activeSectionId === secName ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
                        }`}
                      >
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* =========================================================================
              SECTION 3: PRODUCTS / SERVICES
             ========================================================================= */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="flex items-center justify-center w-6 h-6 rounded-lg bg-blue-100 text-blue-700 text-xs font-black">
                  3
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
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs transition cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Add Custom Item</span>
              </button>

              <button
                type="button"
                onClick={() => setIsSpecModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 text-indigo-700 text-xs font-bold transition shadow-xs cursor-pointer"
              >
                <Search className="w-3.5 h-3.5 text-indigo-600" />
                <span>🔍 Spec Intelligence (Brand → Model)</span>
              </button>

              <button
                type="button"
                onClick={handleAddServiceLine}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition cursor-pointer"
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

            {/* Line Items Container: Quotation Line Cards */}
            {items.length === 0 ? (
              <div className="p-8 text-center border-2 border-dashed border-slate-200 rounded-xl space-y-2">
                <Layers className="w-8 h-8 text-slate-300 mx-auto" />
                <p className="text-xs font-bold text-slate-700">No items in quotation yet</p>
                <p className="text-xs text-slate-400">
                  Click "+ Add Custom Item" to type any product, search using Spec Intelligence, or select from the master catalog above.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {items.map((it, idx) => ({ it, idx }))
                  .filter(({ it }) => activeSectionId === 'ALL' || it.section_id === activeSectionId)
                  .map(({ it, idx }) => (
                    <div
                      key={idx}
                      className={`rounded-2xl border transition-all duration-200 shadow-2xs overflow-hidden ${
                        it.is_expanded
                          ? 'bg-blue-50/20 border-blue-400 ring-2 ring-blue-500/20'
                          : 'bg-white border-slate-200 hover:border-slate-300 hover:shadow-xs'
                      }`}
                    >
                      {/* Card Top Header Bar */}
                      <div className="p-3.5 bg-slate-50/80 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                        <div className="flex items-center gap-2.5 min-w-0 flex-1 flex-wrap">
                          <span className="w-7 h-7 rounded-lg bg-slate-900 text-white font-mono font-bold text-xs flex items-center justify-center shrink-0">
                            #{idx + 1}
                          </span>

                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-black text-slate-900 text-xs sm:text-sm tracking-tight uppercase">
                                {(it.brand || it.category) && (it.model || it.sku)
                                  ? `${(it.brand || it.category || '').toUpperCase()} – ${(it.model || it.sku || '').toUpperCase()}`
                                  : (it.product_name || 'Item Name')}
                              </span>

                              {it.verification_status === 'EXACT_MODEL_VERIFIED' ? (
                                <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold flex items-center gap-1">
                                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                  ✓ Verified • Official Source
                                </span>
                              ) : it.verification_status === 'MULTI_SOURCE_VERIFIED' ? (
                                <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 text-[10px] font-bold">
                                  Multi-Source Verified
                                </span>
                              ) : null}

                              {(it.datasheet_url || it.spec_source_url) && (
                                <a
                                  href={it.datasheet_url || it.spec_source_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-blue-600 hover:text-blue-800 text-[10px] font-bold inline-flex items-center gap-0.5"
                                  title="View Official Datasheet"
                                >
                                  <ExternalLink className="w-3 h-3" />
                                  <span>Datasheet</span>
                                </a>
                              )}

                              {it.section_id && quotationFormat !== 'STANDARD' && (
                                <span className="px-2 py-0.5 rounded-md bg-purple-100 text-purple-800 font-bold text-[9px] uppercase">
                                  {it.section_id}
                                </span>
                              )}
                            </div>
                            {(it.description || it.internal_remarks) && (
                              <p className="text-[11px] text-slate-500 truncate max-w-md mt-0.5">
                                {it.description || it.internal_remarks}
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Card Header Action Controls */}
                        <div className="flex items-center gap-1 self-end sm:self-center shrink-0">
                          <button
                            type="button"
                            disabled={idx === 0}
                            onClick={() => handleMoveItem(idx, 'UP')}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 disabled:opacity-30 transition cursor-pointer"
                            title="Move item up"
                          >
                            <ArrowUp className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            disabled={idx === items.length - 1}
                            onClick={() => handleMoveItem(idx, 'DOWN')}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 disabled:opacity-30 transition cursor-pointer"
                            title="Move item down"
                          >
                            <ArrowDown className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDuplicateItem(idx)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition cursor-pointer"
                            title="Duplicate line item"
                          >
                            <Copy className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(idx)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                            title="Remove line item"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>

                          <button
                            type="button"
                            onClick={() => handleToggleExpand(idx)}
                            className={`ml-1 px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1 transition cursor-pointer ${
                              it.is_expanded
                                ? 'bg-blue-600 text-white shadow-2xs'
                                : 'bg-white border border-slate-200 hover:border-blue-400 text-slate-700 hover:text-blue-700'
                            }`}
                          >
                            <span>{it.is_expanded ? 'Done' : 'Edit Product'}</span>
                            {it.is_expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </div>

                      {/* Commercial Row — High Visibility Controls */}
                      <div className="p-3.5 grid grid-cols-2 sm:grid-cols-12 gap-3 items-center">
                        {/* Quantity Stepper */}
                        <div className="col-span-1 sm:col-span-3">
                          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                            Quantity
                          </label>
                          <div className="flex items-center border border-slate-200 rounded-xl overflow-hidden bg-white shadow-2xs">
                            <button
                              type="button"
                              onClick={() => handleItemChange(idx, 'quantity', Math.max(1, (Number(it.quantity) || 1) - 1))}
                              className="w-9 h-9 flex items-center justify-center bg-slate-100 hover:bg-slate-200 text-slate-700 font-black text-sm select-none cursor-pointer transition"
                            >
                              -
                            </button>
                            <input
                              type="number"
                              min="1"
                              value={it.quantity}
                              onChange={(e) => handleItemChange(idx, 'quantity', Math.max(1, Number(e.target.value) || 1))}
                              className="w-12 text-center py-1.5 font-black text-slate-900 outline-none text-xs sm:text-sm font-mono"
                            />
                            <button
                              type="button"
                              onClick={() => handleItemChange(idx, 'quantity', (Number(it.quantity) || 0) + 1)}
                              className="w-9 h-9 flex items-center justify-center bg-slate-100 hover:bg-slate-200 text-slate-700 font-black text-sm select-none cursor-pointer transition"
                            >
                              +
                            </button>
                          </div>
                        </div>

                        {/* Unit */}
                        <div className="col-span-1 sm:col-span-2">
                          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                            Unit
                          </label>
                          <select
                            value={it.unit || 'Nos.'}
                            onChange={(e) => handleItemChange(idx, 'unit', e.target.value)}
                            className="w-full p-2 bg-white rounded-xl border border-slate-200 text-slate-800 font-semibold outline-none text-xs"
                          >
                            <option value="Nos.">Nos.</option>
                            <option value="Set">Set</option>
                            <option value="Pair">Pair</option>
                            <option value="Box">Box</option>
                            <option value="Pack">Pack</option>
                            <option value="Meter">Meter</option>
                            <option value="Feet">Feet</option>
                            <option value="Hour">Hour</option>
                            <option value="Day">Day</option>
                            <option value="Job">Job</option>
                            <option value="Lot">Lot</option>
                            <option value="Months">Months</option>
                          </select>
                        </div>

                        {/* Financial Rate */}
                        <div className="col-span-1 sm:col-span-3">
                          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                            {pricingMode === 'INCLUSIVE' ? 'Selling Price (Incl. GST)' : 'Selling Price (Excl. GST)'}
                          </label>
                          <div className="relative">
                            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 font-bold text-slate-400 text-xs">₹</span>
                            <input
                              type="number"
                              min="0"
                              value={it.selling_price || ''}
                              onChange={(e) => handleItemChange(idx, 'selling_price', e.target.value)}
                              placeholder="0.00"
                              className="w-full pl-6 pr-2.5 py-1.5 bg-white rounded-xl border border-slate-200 font-mono font-black text-slate-900 text-xs sm:text-sm outline-none focus:border-blue-500 shadow-2xs"
                            />
                          </div>
                        </div>

                        {/* GST % */}
                        <div className="col-span-1 sm:col-span-2">
                          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                            GST Rate
                          </label>
                          <select
                            value={it.gst_rate ?? 18}
                            onChange={(e) => handleItemChange(idx, 'gst_rate', Number(e.target.value))}
                            className="w-full p-2 bg-white rounded-xl border border-slate-200 font-semibold text-slate-800 outline-none text-xs"
                          >
                            <option value="18">18% (Standard)</option>
                            <option value="28">28% (Luxury / Projector)</option>
                            <option value="12">12% (IT Peripherals)</option>
                            <option value="5">5% (Special)</option>
                            <option value="0">0% (Nil / Excluded)</option>
                          </select>
                        </div>

                        {/* Line Total Amount */}
                        <div className="col-span-2 sm:col-span-2 text-right">
                          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                            Line Amount
                          </span>
                          <span className="font-mono font-black text-slate-950 text-sm sm:text-base">
                            ₹{it.total_amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        </div>
                      </div>

                      {/* Collapsed State Summary Preview */}
                      {!it.is_expanded && (it.specs || it.description || it.product_name) && (
                        <div className="px-3.5 pb-3 pt-0 text-[11px] space-y-1">
                          {it.specs && (
                            <div className="font-mono text-slate-700 bg-slate-50 p-2 rounded-lg border border-slate-100 text-[11px] flex items-start gap-1">
                              <span className="font-bold text-slate-900 shrink-0">Specs:</span>
                              <span className="truncate">{it.specs}</span>
                            </div>
                          )}
                          {it.description && (
                            <p className="text-slate-600 line-clamp-1 pl-1">
                              <span className="font-medium text-slate-800">Description:</span> {it.description}
                            </p>
                          )}
                        </div>
                      )}

                      {/* Expanded State Snapshot Edit Panel */}
                      {it.is_expanded && (
                        <div className="p-4 bg-slate-50/90 border-t border-slate-200 space-y-3">
                          {/* Snapshot Guarantee Notice */}
                          <div className="p-2.5 rounded-lg bg-blue-50 border border-blue-200 text-blue-900 text-[11px] flex items-center gap-2 font-medium">
                            <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0" />
                            <span>
                              <strong>Quotation Line Snapshot:</strong> Changes made here modify this quotation item only. The master product library is never overwritten.
                            </span>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                            <div className="sm:col-span-3">
                              <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wider block mb-1">
                                Brand
                              </label>
                              <input
                                type="text"
                                value={it.brand || ''}
                                onChange={(e) => handleItemChange(idx, 'brand', e.target.value)}
                                placeholder="Brand (e.g. BenQ)"
                                className="w-full p-2 bg-white rounded-lg border border-slate-200 font-bold text-slate-900 outline-none focus:border-blue-500 text-xs"
                              />
                            </div>

                            <div className="sm:col-span-3">
                              <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wider block mb-1">
                                Model
                              </label>
                              <input
                                type="text"
                                value={it.model || ''}
                                onChange={(e) => handleItemChange(idx, 'model', e.target.value)}
                                placeholder="Model (e.g. TK710)"
                                className="w-full p-2 bg-white rounded-lg border border-slate-200 font-mono font-bold text-slate-900 outline-none focus:border-blue-500 text-xs"
                              />
                            </div>

                            <div className="sm:col-span-6">
                              <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wider block mb-1">
                                Product Title *
                              </label>
                              <input
                                type="text"
                                value={it.product_name}
                                onChange={(e) => handleItemChange(idx, 'product_name', e.target.value)}
                                placeholder="Product / Service Title"
                                className="w-full p-2 bg-white rounded-lg border border-slate-200 font-bold text-slate-900 outline-none focus:border-blue-500 text-xs"
                              />
                            </div>
                          </div>

                          {/* Key Specifications Scope */}
                          <div>
                            <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wider block mb-1">
                              Key Specifications (e.g. 4K UHD, 3,200 Lumens, Laser...)
                            </label>
                            <textarea
                              rows={2}
                              value={it.specs || ''}
                              onChange={(e) => handleItemChange(idx, 'specs', e.target.value)}
                              placeholder="Key Specifications: 4K UHD, 3,200 ANSI Lumens, Laser Engine..."
                              className="w-full p-2 bg-white rounded-lg border border-slate-200 font-mono text-[11px] text-slate-900 outline-none focus:border-blue-500"
                            />
                          </div>

                          {/* Customer Description */}
                          <div>
                            <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wider block mb-1">
                              Description: Short, customer-friendly purpose & value...
                            </label>
                            <textarea
                              rows={2}
                              value={it.description || ''}
                              onChange={(e) => handleItemChange(idx, 'description', e.target.value)}
                              placeholder="Description: Short, customer-friendly purpose & value..."
                              className="w-full p-2 bg-white rounded-lg border border-slate-200 text-[11px] text-slate-800 outline-none focus:border-blue-500"
                            />
                          </div>

                          {/* Section Assignment & Datasheet URL */}
                          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                            {quotationFormat !== 'STANDARD' && (
                              <div className="sm:col-span-6">
                                <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wider block mb-1">
                                  Project Section
                                </label>
                                <select
                                  value={it.section_id || ''}
                                  onChange={(e) => handleItemChange(idx, 'section_id', e.target.value)}
                                  className="w-full p-2 bg-white rounded-lg border border-slate-200 font-bold text-slate-800 outline-none text-xs"
                                >
                                  <option value="">(Select Section)</option>
                                  {QUOTATION_FORMAT_REGISTRY[quotationFormat]?.defaultSections.map((secName, sIdx) => (
                                    <option key={sIdx} value={secName}>
                                      {secName}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            )}

                            <div className={quotationFormat !== 'STANDARD' ? 'sm:col-span-6' : 'sm:col-span-12'}>
                              <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wider block mb-1">
                                Datasheet URL
                              </label>
                              <div className="flex items-center gap-1.5">
                                <input
                                  type="text"
                                  value={it.datasheet_url || it.spec_source_url || ''}
                                  onChange={(e) => {
                                    handleItemChange(idx, 'datasheet_url', e.target.value);
                                    handleItemChange(idx, 'spec_source_url', e.target.value);
                                  }}
                                  placeholder="https://..."
                                  className="w-full p-2 bg-white rounded-lg border border-slate-200 font-mono text-[11px] text-slate-700 outline-none"
                                />
                                {(it.datasheet_url || it.spec_source_url) && (
                                  <a
                                    href={it.datasheet_url || it.spec_source_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="px-2.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-[10px] shrink-0 flex items-center gap-1 transition"
                                  >
                                    <ExternalLink className="w-3 h-3" />
                                  </a>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Management Confidential Cost & Distributor */}
                          {isManagementOrAdmin && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-xl bg-amber-50/70 border border-amber-200">
                              <div>
                                <label className="text-[10px] font-bold text-amber-800 uppercase tracking-wider block mb-1">
                                  Purchase Cost ₹ (Confidential)
                                </label>
                                <input
                                  type="number"
                                  min="0"
                                  value={it.purchase_price || ''}
                                  onChange={(e) => handleItemChange(idx, 'purchase_price', Math.max(0, Number(e.target.value) || 0))}
                                  placeholder="0.00"
                                  className="w-full p-2 bg-white rounded-lg border border-amber-300 font-mono text-xs font-bold text-slate-900 outline-none"
                                />
                              </div>
                              <div>
                                <label className="text-[10px] font-bold text-amber-800 uppercase tracking-wider block mb-1">
                                  Distributor / Sourcing Channel
                                </label>
                                <input
                                  type="text"
                                  value={it.supplier_reference || ''}
                                  onChange={(e) => handleItemChange(idx, 'supplier_reference', e.target.value)}
                                  placeholder="e.g. Redington, Savex, Ingram"
                                  className="w-full p-2 bg-white rounded-lg border border-amber-300 text-xs font-semibold text-slate-800 outline-none"
                                />
                              </div>
                            </div>
                          )}

                          <div className="flex justify-end pt-1">
                            <button
                              type="button"
                              onClick={() => handleToggleExpand(idx)}
                              className="px-4 py-1.5 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-xs transition cursor-pointer"
                            >
                              Done Editing ▲
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
              </div>
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

              {/* Bank Details Selector */}
              <div className="sm:col-span-3 pt-1 border-t border-slate-100">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Bank Account for Customer Remittance
                </label>
                <select
                  value={selectedBankKey}
                  onChange={(e) => setSelectedBankKey(e.target.value)}
                  className="w-full mt-1 p-2 bg-white rounded-lg border border-slate-200 font-semibold text-slate-800 outline-none focus:border-blue-500"
                >
                  {BANK_ACCOUNTS.map((b) => (
                    <option key={b.key} value={b.key}>
                      {b.bank_name} • A/c: {b.account_number} ({b.ifsc_code} - {b.branch})
                    </option>
                  ))}
                </select>
                <span className="text-[10px] text-slate-500 mt-1 block">
                  Chosen bank details will be printed on customer proposal for NEFT / RTGS / Cheque.
                </span>
              </div>
            </div>

            {/* Editable List of Terms & Conditions */}
            <div className="space-y-2 pt-3 border-t border-slate-100">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                  Proposal Terms & Conditions (Customer-Facing & Printable)
                </label>
                <button
                  type="button"
                  onClick={() => setCustomTerms((prev) => [...prev, ''])}
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 hover:text-blue-700 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ Add Term</span>
                </button>
              </div>

              <div className="space-y-2">
                {customTerms.map((term, tIdx) => (
                  <div key={tIdx} className="flex items-center gap-2">
                    <span className="text-slate-400 font-mono text-[11px] w-5 text-right shrink-0">
                      {tIdx + 1}.
                    </span>
                    <input
                      type="text"
                      value={term}
                      onChange={(e) => {
                        const updated = [...customTerms];
                        updated[tIdx] = e.target.value;
                        setCustomTerms(updated);
                      }}
                      placeholder="Enter term or condition..."
                      className="flex-1 p-2 bg-white rounded-lg border border-slate-200 text-xs text-slate-800 outline-none focus:border-blue-500"
                    />
                    <button
                      type="button"
                      onClick={() => setCustomTerms((prev) => prev.filter((_, i) => i !== tIdx))}
                      className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                      title="Delete term"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
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

            {/* Actions Indicator */}
            <div className="pt-2 text-center text-[11px] text-slate-400 font-medium border-t border-slate-100">
              Quotation actions available in persistent action dock &darr;
            </div>
          </div>
        </div>
      </div>

      {/* =========================================================================
          SECTION 5: PERSISTENT BOTTOM ACTION BAR
         ========================================================================= */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200/80 shadow-[0_-4px_20px_rgba(0,0,0,0.06)] px-4 py-3 sm:px-6">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          {/* Left: Quick Status / Grand Total Summary */}
          <div className="flex items-center gap-4 text-xs w-full sm:w-auto justify-between sm:justify-start">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-slate-500 font-medium">Grand Total:</span>
              <span className="text-base font-black text-slate-900 font-mono">
                ₹{grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
            <span className="text-slate-400 hidden sm:inline">&bull;</span>
            <span className="text-slate-500 hidden sm:inline">
              {items.length} {items.length === 1 ? 'item' : 'items'}
            </span>
          </div>

          {/* Right: Action Buttons Hierarchy */}
          <div className="flex items-center gap-2 w-full sm:w-auto justify-end flex-wrap sm:flex-nowrap">
            {/* Cancel (Subtle / Destructive) */}
            <button
              type="button"
              onClick={() => {
                if (isModal && onCloseModal) {
                  onCloseModal();
                } else {
                  router.push('/dashboard/quotations');
                }
              }}
              className="px-3.5 py-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 text-xs font-semibold transition cursor-pointer"
            >
              Cancel
            </button>

            {/* Save as Draft (Secondary Outline) */}
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => handleSave('Draft')}
              className="px-4 py-2 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-bold transition disabled:opacity-50 cursor-pointer"
            >
              Save as Draft
            </button>

            {/* PREVIEW (Prominent Outline / Blue) */}
            <button
              type="button"
              onClick={handlePreviewClick}
              className="px-4 py-2 rounded-xl border-2 border-blue-600 hover:bg-blue-50 text-blue-700 text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <Printer className="w-4 h-4 text-blue-600" />
              <span>PREVIEW</span>
            </button>

            {/* SAVE QUOTATION (Primary Accent) */}
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => handleSave()}
              className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold shadow-md shadow-blue-600/20 transition flex items-center gap-1.5 cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{isSubmitting ? 'Saving...' : editingQuotation ? 'SAVE REVISION' : 'SAVE QUOTATION'}</span>
            </button>

            {/* SEND TO CUSTOMER (Primary Green Highlight) */}
            <button
              type="button"
              disabled={isSubmitting}
              onClick={handleSendToCustomer}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold shadow-md shadow-emerald-600/20 transition flex items-center gap-1.5 cursor-pointer"
            >
              <Mail className="w-4 h-4" />
              <span>SEND TO CUSTOMER</span>
            </button>
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
        onClose={() => {
          setIsPreviewOpen(false);
          if (persistedQuotation && persistedQuotation.status === 'Sent') {
            if (isModal && onCloseModal) {
              onCloseModal();
            } else {
              router.push(`/dashboard/quotations/${persistedQuotation.id}`);
            }
          }
        }}
      />

      {/* Spec Intelligence CPQ Lookup Modal */}
      <SpecIntelligenceLookupModal
        isOpen={isSpecModalOpen}
        onClose={() => setIsSpecModalOpen(false)}
        onInsertItem={(item) => setItems((prev) => [...prev, item])}
        pricingMode={pricingMode}
      />

      {/* Technical Evaluation Equipment Review & Import Modal */}
      {isImportModalOpen && selectedImportEvaluation && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full border border-slate-200 text-xs overflow-hidden flex flex-col max-h-[85vh]">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-purple-50/60">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-purple-600 text-white flex items-center justify-center">
                  <Wrench className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-black text-slate-900 text-sm">
                    Import Recommended Equipment from Technical Evaluation
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    {selectedImportEvaluation.evaluation_number} &bull; {selectedImportEvaluation.project_category}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsImportModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 bg-amber-50/70 border-b border-amber-100 text-[11px] text-amber-800 flex items-center gap-2">
              <Lock className="w-4 h-4 text-amber-700 shrink-0" />
              <span>
                <strong>Confidentiality Guarantee:</strong> Internal engineering remarks, supplier purchase costs and margin targets are strictly excluded from quotation line items.
              </span>
            </div>

            <div className="p-4 overflow-y-auto flex-1 space-y-3">
              <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                <span>Select Items to Import ({Object.values(selectedItemIdsToImport).filter(Boolean).length} selected):</span>
                <button
                  type="button"
                  onClick={() => {
                    const allSelected = selectedImportEvaluation.recommended_items.every((it) => selectedItemIdsToImport[it.id]);
                    const updated: Record<string, boolean> = {};
                    selectedImportEvaluation.recommended_items.forEach((it) => {
                      updated[it.id] = !allSelected;
                    });
                    setSelectedItemIdsToImport(updated);
                  }}
                  className="text-brand-600 hover:underline"
                >
                  Toggle All
                </button>
              </div>

              <div className="border border-slate-200 rounded-xl divide-y divide-slate-100 overflow-hidden">
                {selectedImportEvaluation.recommended_items.map((item) => (
                  <label
                    key={item.id}
                    className="p-3 flex items-start gap-3 hover:bg-slate-50 cursor-pointer transition"
                  >
                    <input
                      type="checkbox"
                      checked={Boolean(selectedItemIdsToImport[item.id])}
                      onChange={(e) =>
                        setSelectedItemIdsToImport({
                          ...selectedItemIdsToImport,
                          [item.id]: e.target.checked,
                        })
                      }
                      className="mt-0.5 rounded text-purple-600"
                    />
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <strong className="text-slate-900 text-xs">
                          {item.brand} {item.model}
                        </strong>
                        <span className="font-mono font-bold text-slate-900">
                          ₹ {(item.estimated_unit_price || 0).toLocaleString('en-IN')}
                        </span>
                      </div>
                      <p className="text-slate-500 text-[11px] mt-0.5">{item.specifications}</p>
                      <div className="flex items-center gap-3 text-[10px] text-slate-400 mt-1">
                        <span>Quantity: {item.quantity} {item.unit || 'Nos.'}</span>
                        <span>GST: {item.gst_rate || 18}%</span>
                        {item.hsn_sac && <span>HSN: {item.hsn_sac}</span>}
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div className="p-4 border-t border-slate-100 flex items-center justify-end gap-2 bg-slate-50">
              <button
                type="button"
                onClick={() => setIsImportModalOpen(false)}
                className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-200/60 font-bold text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmImportEquipment}
                disabled={Object.values(selectedItemIdsToImport).filter(Boolean).length === 0}
                className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-bold text-xs transition shadow-xs"
              >
                Confirm Import ({Object.values(selectedItemIdsToImport).filter(Boolean).length} Items)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
