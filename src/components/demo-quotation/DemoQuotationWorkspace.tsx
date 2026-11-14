'use client';

import React, { useState, useMemo } from 'react';
import {
  ArrowLeft,
  Save,
  Printer,
  Eye,
  Plus,
  Sparkles,
  Trash2,
  Copy,
  ChevronDown,
  Sliders,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  Building,
  User,
  Phone,
  Mail,
  MapPin,
  Calendar,
  Layers,
  Wrench,
  Search,
  ExternalLink,
  ShieldAlert,
  RotateCcw,
  Check,
} from 'lucide-react';
import {
  DemoCustomer,
  DemoQuotationItem,
  DemoSection,
  DEMO_CUSTOMERS,
  DEMO_PRESET_ITEMS,
  DEMO_STANDARD_COMMERCIAL_ITEMS,
  FORMAT_OPTIONS,
  FORMAT_SECTIONS,
  QuotationFormatKey,
  DEFAULT_TERMS_CONDITIONS,
  numberToIndianWords,
} from './demo-data';
import { DemoProductDrawer } from './DemoProductDrawer';
import { DemoCustomerPreviewModal } from './DemoCustomerPreviewModal';
import { DemoAIResearchModal } from './DemoAIResearchModal';

// Auto-Detection Classifier for customer requirements
function classifyRequirement(query: string): {
  format: QuotationFormatKey;
  confidence: number;
  reason: string;
} {
  const q = query.toLowerCase().trim();

  const isCCTV =
    q.includes('cctv') ||
    q.includes('surveillance') ||
    q.includes('nvr') ||
    q.includes('security camera') ||
    (q.includes('camera') && !q.includes('ptz') && !q.includes('conference'));
  const isNet =
    q.includes('network') ||
    q.includes('switch') ||
    q.includes('wifi') ||
    q.includes('access point') ||
    q.includes('router') ||
    q.includes('cat6');
  const isConf =
    q.includes('conference') ||
    q.includes('boardroom') ||
    q.includes('meeting room') ||
    q.includes('video conferencing') ||
    q.includes('teams room') ||
    q.includes('zoom room');
  const isHT =
    q.includes('home theater') ||
    q.includes('home cinema') ||
    q.includes('atmos') ||
    q.includes('7.2') ||
    q.includes('5.1') ||
    q.includes('9.4') ||
    q.includes('cinema');
  const isStandard =
    q.includes('laptop') ||
    q.includes('printer') ||
    q.includes('desktop') ||
    q.includes('workstation') ||
    q.includes('standard commercial') ||
    q.includes('it equipment') ||
    (q.includes('dell') && !q.includes('server'));
  const isAMC =
    q.includes('amc') ||
    q.includes('maintenance') ||
    q.includes('annual maintenance') ||
    q.includes('service contract');

  // Count distinct domains for Custom / Mixed
  const domainCount = [isCCTV, isNet, isConf, isHT, isStandard].filter(Boolean).length;
  if (domainCount >= 2 || q.includes('mixed') || q.includes('custom') || q.includes('+')) {
    return {
      format: 'CUSTOM_MIXED',
      confidence: 96,
      reason: 'Multi-domain architecture detected across security, networking, and AV systems.',
    };
  }

  if (isAMC) {
    return {
      format: 'AMC_SERVICE',
      confidence: 98,
      reason: 'Preventive maintenance, service level agreement & SLA support contract.',
    };
  }

  if (isHT) {
    return {
      format: 'HOME_THEATER',
      confidence: 99,
      reason: 'Dedicated home cinema surround acoustics, projection & multi-channel processing.',
    };
  }

  if (isConf) {
    return {
      format: 'CONFERENCE_ROOM',
      confidence: 98,
      reason: 'Corporate video collaboration, beamforming microphones & display setup.',
    };
  }

  if (isCCTV) {
    return {
      format: 'CCTV',
      confidence: 99,
      reason: 'Surveillance IP cameras, NVR storage & security monitoring infrastructure.',
    };
  }

  if (isNet) {
    return {
      format: 'NETWORKING',
      confidence: 97,
      reason: 'Enterprise structured cabling, managed switches & wireless distribution.',
    };
  }

  if (isStandard) {
    return {
      format: 'STANDARD',
      confidence: 99,
      reason: 'Standard commercial IT equipment, computing workstations & peripherals.',
    };
  }

  if (q.includes('av') || q.includes('audio') || q.includes('sound')) {
    return {
      format: 'AV_SOLUTION',
      confidence: 94,
      reason: 'Professional audio-visual distribution and presentation engineering.',
    };
  }

  return {
    format: 'STANDARD',
    confidence: 85,
    reason: 'Standard commercial quotation recommended for general IT equipment.',
  };
}

export function DemoQuotationWorkspace() {
  // Quotation Metadata
  const [quotationNumber, setQuotationNumber] = useState('ITP-QTN-2026-00116');
  const [quotationDate, setQuotationDate] = useState('2026-10-05');
  const [validUntil, setValidUntil] = useState('2026-10-20');
  const [salesperson, setSalesperson] = useState('Dheeraj Sharma (Sales Director)');
  const [projectReference, setProjectReference] = useState('ABC-HT-2026-V1');
  const [status, setStatus] = useState<'Draft' | 'Sent' | 'Approved'>('Draft');

  // Selected Customer
  const [customer, setCustomer] = useState<DemoCustomer>(DEMO_CUSTOMERS[0]);
  const [isCustomerDropdownOpen, setIsCustomerDropdownOpen] = useState(false);

  // Requirement & Format
  const [clientRequirement, setClientRequirement] = useState(
    'High-end 7.2.4 Dolby Atmos home cinema with 4K laser projector, 135-inch acoustically transparent screen, reference floorstanding speakers, dual subwoofers, and acoustic room calibration in Banjara Hills villa'
  );
  const [currentFormat, setCurrentFormat] = useState<QuotationFormatKey>('HOME_THEATER');
  const [customSections, setCustomSections] = useState<string[]>([]);
  const [isDetectingFormat, setIsDetectingFormat] = useState(false);
  const [formatDetectedMessage, setFormatDetectedMessage] = useState<{
    format: QuotationFormatKey;
    confidence: number;
    reason: string;
  } | null>(null);

  // Search Bar / Instant Requirement Filter
  const [searchFilterQuery, setSearchFilterQuery] = useState('');

  // Canonical Line Items (Synced with Drawer & Preview)
  const [items, setItems] = useState<DemoQuotationItem[]>(DEMO_PRESET_ITEMS);

  // Pricing Mode
  const [pricingMode, setPricingMode] = useState<'tax_exclusive' | 'tax_inclusive'>('tax_exclusive');
  const [overallDiscountPercent, setOverallDiscountPercent] = useState<number>(0);

  // Terms & Notes
  const [terms, setTerms] = useState<string[]>(DEFAULT_TERMS_CONDITIONS);
  const [clientNotes, setClientNotes] = useState(
    'Comprehensive turnkey AV integration engineered to professional reference acoustics, high-resolution visual standards, and certified warranty handover.'
  );

  // Modals & Drawer State
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<DemoQuotationItem | null>(null);
  const [targetSectionForNewItem, setTargetSectionForNewItem] = useState<string>('DISPLAY / PROJECTOR');
  const [previewOpen, setPreviewOpen] = useState(false);
  const [aiResearchOpen, setAiResearchOpen] = useState(false);
  const [saveToast, setSaveToast] = useState(false);

  // Combined Sections: Standard preset sections + custom sections + any section present in items
  // Guarantees ZERO items are ever lost or hidden when switching formats!
  const activeSections = useMemo(() => {
    const preset = FORMAT_SECTIONS[currentFormat] || FORMAT_SECTIONS.STANDARD;
    const combined = [...preset];
    customSections.forEach((s) => {
      if (!combined.includes(s)) combined.push(s);
    });
    // Ensure existing item sections remain visible in project views
    items.forEach((it) => {
      if (it.section_id && !combined.includes(it.section_id)) {
        combined.push(it.section_id);
      }
    });
    return combined;
  }, [currentFormat, customSections, items]);

  // Handle format switch (strictly non-destructive: zero products, specs or descriptions deleted)
  function handleFormatSwitch(newFormat: QuotationFormatKey) {
    setCurrentFormat(newFormat);
  }

  // AI Detect Format
  function handleAIDetectFormat() {
    const result = classifyRequirement(clientRequirement);
    setCurrentFormat(result.format);
    setFormatDetectedMessage(result);
  }

  // Search Bar / Quick Format Auto-Switch
  function handleSearchRequirementChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    setSearchFilterQuery(val);
    if (val.trim().length >= 3) {
      const match = classifyRequirement(val);
      setCurrentFormat(match.format);
      setFormatDetectedMessage(match);
    }
  }

  // Load Preset Workflows (for UAT Test A vs Test B)
  function handleLoadStandardITItems() {
    setItems(DEMO_STANDARD_COMMERCIAL_ITEMS);
    setCurrentFormat('STANDARD');
    setClientRequirement('Standard commercial IT procurement: Dell Latitude laptops, HP LaserJet wireless printers, and Epson classroom projectors with manufacturer warranty.');
    setProjectReference('IT-CORP-PROC-2026');
    setFormatDetectedMessage({
      format: 'STANDARD',
      confidence: 99,
      reason: 'Standard commercial IT equipment, computing workstations & peripherals.',
    });
  }

  function handleLoadHomeTheaterItems() {
    setItems(DEMO_PRESET_ITEMS);
    setCurrentFormat('HOME_THEATER');
    setClientRequirement('High-end 7.2.4 Dolby Atmos home cinema with 4K laser projector, 135-inch acoustically transparent screen, reference floorstanding speakers, dual subwoofers, and acoustic room calibration in Banjara Hills villa');
    setProjectReference('ABC-HT-2026-V1');
    setFormatDetectedMessage({
      format: 'HOME_THEATER',
      confidence: 99,
      reason: 'Dedicated home cinema surround acoustics, projection & multi-channel processing.',
    });
  }

  // Financial Calculations
  const calculations = useMemo(() => {
    const rawSubtotal = items.reduce((acc, it) => {
      const lineTotal = it.quantity * it.unit_price - (it.discount || 0);
      return acc + Math.max(0, lineTotal);
    }, 0);

    const discountAmount = Math.round((rawSubtotal * overallDiscountPercent) / 100);
    const taxableSubtotal = Math.max(0, rawSubtotal - discountAmount);

    const isIntraState = !customer.state || customer.state.toLowerCase().includes('telangana');
    const standardGSTRate = 18;
    const totalGst = Math.round((taxableSubtotal * standardGSTRate) / 100);
    const cgst = isIntraState ? Math.round(totalGst / 2) : 0;
    const sgst = isIntraState ? Math.round(totalGst / 2) : 0;
    const igst = !isIntraState ? totalGst : 0;
    const grandTotal = taxableSubtotal + totalGst;
    const amountInWords = numberToIndianWords(grandTotal);

    // Internal Estimator Metrics (Confidential)
    const totalPurchaseCost = items.reduce((acc, it) => {
      return acc + (it.purchase_cost || 0) * it.quantity;
    }, 0);
    const grossMarginAmount = taxableSubtotal - totalPurchaseCost;
    const grossMarginPercent = taxableSubtotal > 0 ? (grossMarginAmount / taxableSubtotal) * 100 : 0;

    return {
      rawSubtotal,
      discountAmount,
      taxableSubtotal,
      cgst,
      sgst,
      igst,
      totalGst,
      grandTotal,
      amountInWords,
      totalPurchaseCost,
      grossMarginAmount,
      grossMarginPercent,
    };
  }, [items, overallDiscountPercent, customer.state]);

  // Drawer handlers
  function handleOpenCreateItem(sectionTitle?: string) {
    setEditingItem(null);
    setTargetSectionForNewItem(sectionTitle || activeSections[0] || 'PRODUCTS & SERVICES');
    setDrawerOpen(true);
  }

  function handleOpenEditItem(item: DemoQuotationItem) {
    setEditingItem(item);
    setDrawerOpen(true);
  }

  function handleSaveItemFromDrawer(savedItem: DemoQuotationItem) {
    setItems((prev) => {
      const index = prev.findIndex((i) => i.id === savedItem.id);
      if (index >= 0) {
        const next = [...prev];
        next[index] = savedItem;
        return next;
      } else {
        return [...prev, savedItem];
      }
    });
  }

  function handleDeleteItem(id: string) {
    setItems((prev) => prev.filter((i) => i.id !== id));
  }

  function handleDuplicateItem(item: DemoQuotationItem) {
    const duplicated: DemoQuotationItem = {
      ...JSON.parse(JSON.stringify(item)),
      id: `item-${Date.now()}`,
      product_name: `${item.product_name} (Copy)`,
    };
    setItems((prev) => [...prev, duplicated]);
  }

  function handleAddSection() {
    const title = prompt('Enter new section title:');
    if (title && title.trim()) {
      setCustomSections((prev) => [...prev, title.trim().toUpperCase()]);
    }
  }

  function handleAddServicePreset() {
    const newService: DemoQuotationItem = {
      id: `srv-${Date.now()}`,
      brand: 'ICON TECH PRO',
      model: 'SRV-ON-SITE',
      product_name: 'Turnkey On-Site System Installation & Integration',
      category: 'Service',
      hsn_sac: '9987',
      unit: 'Job',
      quantity: 1,
      unit_price: 25000,
      gst_rate: 18,
      discount: 0,
      section_id: activeSections[activeSections.length - 1] || 'SERVICES',
      is_dynamic: true,
      warranty: '1 Year Workmanship',
      specifications: [
        { key: 'Scope', value: 'Complete Rack Dressing, Cable Concealment & Termination' },
        { key: 'Testing', value: 'Audio DSP Phase Alignment & 4K HDMI Bitrate Verification' },
      ],
      customer_description: 'Certified on-site AV cabling, custom bracket mounting, audio calibration, and client handover by authorized ICON TECH PRO engineering specialists.',
      short_highlights: [
        'Certified AV Engineers',
        'Clean Concealed Wiring',
        'Comprehensive Testing',
      ],
      purchase_cost: 10000,
      supplier_name: 'Internal AV Services Team',
      internal_notes: 'Standard service job for AV projects.',
    };
    setItems((prev) => [...prev, newService]);
  }

  function handleQuickSave() {
    setSaveToast(true);
    setTimeout(() => setSaveToast(false), 3000);
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans selection:bg-blue-600 selection:text-white pb-16">
      {/* Top Floating Demo Banner */}
      <div className="bg-blue-50 border-b border-blue-200/80 px-6 py-2 text-xs flex items-center justify-between text-blue-950 font-medium">
        <div className="flex items-center gap-2">
          <span className="font-bold text-blue-700">DEMO WORKSPACE:</span>
          <span className="text-slate-700">
            Light Professional ICON TECH PRO Quotation Workspace (Zero Production Footprint)
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="font-mono text-xs text-blue-800 bg-white px-2 py-0.5 rounded border border-blue-200">
            /demo/quotations/create
          </span>
          <span className="text-[11px] bg-emerald-100 text-emerald-800 border border-emerald-300 px-2.5 py-0.5 rounded-full font-bold">
            Live Preview Ready
          </span>
        </div>
      </div>

      {/* Main Top Header Bar (Clean White) */}
      <header className="flex-none bg-white border-b border-slate-200 px-6 py-3.5 flex items-center justify-between sticky top-0 z-30 shadow-xs">
        <div className="flex items-center gap-4">
          <a
            href="/dashboard"
            className="p-2 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition cursor-pointer"
            title="Return to Dashboard"
          >
            <ArrowLeft className="w-5 h-5" />
          </a>

          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-lg font-bold text-slate-900 tracking-tight">
                Create Quotation
              </h1>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-300 font-semibold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                {status}
              </span>
              <span className="text-xs text-slate-600 font-mono font-medium px-2 py-0.5 bg-slate-100 rounded border border-slate-200">
                {quotationNumber}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Interactive quotation builder with dual formats (Standard Commercial &amp; Project / Solution)
            </p>
          </div>
        </div>

        {/* Right Header Action Buttons */}
        <div className="flex items-center gap-3">
          {saveToast && (
            <span className="text-xs text-emerald-700 font-medium flex items-center gap-1 bg-emerald-50 px-2.5 py-1 rounded border border-emerald-200 animate-in fade-in">
              <CheckCircle2 className="w-3.5 h-3.5" /> Draft Saved
            </span>
          )}

          <button
            type="button"
            onClick={handleQuickSave}
            className="px-4 py-2 rounded-lg bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-1.5 border border-slate-300 shadow-xs transition cursor-pointer"
            title="Save quotation draft"
          >
            <Save className="w-4 h-4 text-slate-500" />
            <span>Save as Draft</span>
          </button>

          <button
            type="button"
            onClick={() => setPreviewOpen(true)}
            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-2 shadow-xs transition cursor-pointer"
            title="Open customer-facing A4 preview"
            data-testid="open-preview-btn"
          >
            <Eye className="w-4 h-4" />
            <span>Customer Preview</span>
          </button>

          <button
            type="button"
            onClick={() => setPreviewOpen(true)}
            className="px-4 py-2 rounded-lg bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-1.5 border border-slate-300 shadow-xs transition cursor-pointer"
            title="Save and trigger print dialog"
          >
            <Printer className="w-4 h-4 text-slate-500" />
            <span>{'Save & Print'}</span>
          </button>
        </div>
      </header>

      {/* Main Workspace Body */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 space-y-6">
        {/* Section 1: Customer Info & Quotation Details */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Customer Selection Card (2 cols) */}
          <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Building className="w-4 h-4 text-blue-600" />
                <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  {'Customer & Billing Information'}
                </h2>
              </div>
              <span className="text-xs text-blue-700 font-mono font-semibold bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                {customer.customer_code}
              </span>
            </div>

            {/* Customer Search / Selector */}
            <div className="relative">
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                Select Customer Account
              </label>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsCustomerDropdownOpen(!isCustomerDropdownOpen)}
                  className="w-full bg-white border border-slate-300 hover:border-blue-500 rounded-lg px-3.5 py-2.5 text-left text-sm text-slate-900 flex items-center justify-between transition shadow-xs cursor-pointer"
                  data-testid="customer-select-btn"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900">
                      {customer.company_name}
                    </span>
                    <span className="text-xs text-slate-500">
                      ({customer.contact_person})
                    </span>
                  </div>
                  <ChevronDown className="w-4 h-4 text-slate-400" />
                </button>

                {isCustomerDropdownOpen && (
                  <div className="absolute left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-xl z-40 max-h-60 overflow-y-auto">
                    {DEMO_CUSTOMERS.map((cust) => (
                      <div
                        key={cust.id}
                        onClick={() => {
                          setCustomer(cust);
                          setIsCustomerDropdownOpen(false);
                        }}
                        className={`p-3 border-b border-slate-100 hover:bg-blue-50/50 cursor-pointer transition ${
                          customer.id === cust.id ? 'bg-blue-50 border-l-4 border-blue-600' : ''
                        }`}
                      >
                        <div className="flex justify-between">
                          <span className="text-xs font-bold text-slate-900">
                            {cust.company_name}
                          </span>
                          <span className="text-[10px] font-mono font-semibold text-blue-700">
                            {cust.customer_code}
                          </span>
                        </div>
                        <div className="text-xs text-slate-600 flex items-center gap-2 mt-0.5">
                          <span>{cust.contact_person}</span>
                          <span>•</span>
                          <span>{cust.city}</span>
                          <span>•</span>
                          <span className="font-mono text-slate-500">{cust.gstin}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Active Customer Details Display */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 bg-slate-50 p-3.5 rounded-lg border border-slate-200 text-xs">
              <div>
                <span className="text-[10px] text-slate-500 uppercase font-bold block">Contact Person</span>
                <span className="font-semibold text-slate-900">{customer.contact_person}</span>
                <span className="text-[11px] text-slate-500 block">{customer.designation}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 uppercase font-bold block">Phone / Mobile</span>
                <span className="font-mono font-medium text-slate-800">{customer.phone}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 uppercase font-bold block">Email Address</span>
                <span className="text-slate-800">{customer.email}</span>
              </div>
              <div className="col-span-2">
                <span className="text-[10px] text-slate-500 uppercase font-bold block">Billing Address</span>
                <span className="text-slate-700">
                  {customer.billing_address}, {customer.city}, {customer.state} - {customer.pincode}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 uppercase font-bold block">GSTIN</span>
                <span className="font-mono font-bold text-blue-700">{customer.gstin}</span>
              </div>
            </div>
          </div>

          {/* Quotation Info Card (1 col) */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
              <Calendar className="w-4 h-4 text-blue-600" />
              <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Quotation Details
              </h2>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-[10px] font-bold text-slate-700 uppercase tracking-wider block mb-1">
                  Quotation Number
                </label>
                <input
                  type="text"
                  value={quotationNumber}
                  onChange={(e) => setQuotationNumber(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 font-mono font-medium text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-bold text-slate-700 uppercase tracking-wider block mb-1">
                    Date
                  </label>
                  <input
                    type="date"
                    value={quotationDate}
                    onChange={(e) => setQuotationDate(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-700 uppercase tracking-wider block mb-1">
                    Valid Until
                  </label>
                  <input
                    type="date"
                    value={validUntil}
                    onChange={(e) => setValidUntil(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-700 uppercase tracking-wider block mb-1">
                  Salesperson / Prepared By
                </label>
                <input
                  type="text"
                  value={salesperson}
                  onChange={(e) => setSalesperson(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-700 uppercase tracking-wider block mb-1">
                  Project Reference / Site
                </label>
                <input
                  type="text"
                  value={projectReference}
                  onChange={(e) => setProjectReference(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Section 2: Customer Requirement & AI Format Auto-Detection */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-blue-600" />
                {'Customer Requirement & AI Format Detection'}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Describe customer scope to auto-classify presentation formats (Home Theater, Conference, CCTV, Networking, Standard IT)
              </p>
            </div>

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={handleAIDetectFormat}
                disabled={isDetectingFormat}
                className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition cursor-pointer"
                data-testid="ai-detect-format-btn"
              >
                <Sparkles className={`w-3.5 h-3.5 ${isDetectingFormat ? 'animate-spin' : ''}`} />
                <span>{'AI Detect Format'}</span>
              </button>
            </div>
          </div>

          {/* Large Requirement Text Area */}
          <textarea
            rows={2}
            value={clientRequirement}
            onChange={(e) => {
              setClientRequirement(e.target.value);
              // Live auto-classify recommendation
              if (e.target.value.trim().length >= 5) {
                const match = classifyRequirement(e.target.value);
                setFormatDetectedMessage(match);
              }
            }}
            placeholder="Describe what the customer needs... (e.g. 7.2.4 Dolby Atmos cinema, 32 camera surveillance, conference room for 20 people, Dell laptop and printer)"
            className="w-full bg-white border border-slate-300 rounded-lg p-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 leading-relaxed shadow-xs"
            data-testid="customer-requirement-textarea"
          />

          {/* Quick Search Bar / Format Switcher */}
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs">
            <Search className="w-4 h-4 text-slate-400 shrink-0" />
            <input
              type="text"
              value={searchFilterQuery}
              onChange={handleSearchRequirementChange}
              placeholder="Search keyword to auto-switch format (e.g. 'Home theater 7.2.1', 'Conference Room', 'CCTV', 'Networking', 'Dell laptop')..."
              className="w-full bg-transparent border-none text-slate-800 placeholder-slate-400 focus:outline-none text-xs"
            />
          </div>

          {/* Detected Format Status Card */}
          <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-lg flex flex-col md:flex-row md:items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-700">Detected Format:</span>
              <span className="font-black text-blue-800 uppercase px-2 py-0.5 rounded bg-blue-100 border border-blue-300 tracking-wide" data-testid="detected-format-badge">
                {currentFormat.replace('_', ' ')}
              </span>
              {formatDetectedMessage && (
                <span className="text-slate-600 font-medium">
                  • {formatDetectedMessage.reason} (Confidence: {formatDetectedMessage.confidence}%)
                </span>
              )}
            </div>
            <span className="text-[11px] text-slate-500 italic">
              AI recommendation only. Human can override format below anytime.
            </span>
          </div>

          {/* 8 Format Selector Cards */}
          <div>
            <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider block mb-2">
              QUOTATION FORMAT SELECTOR (8 PRESETS AVAILABLE)
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2" data-testid="format-selector-tabs">
              {FORMAT_OPTIONS.map((f) => {
                const isActive = currentFormat === f.key;
                return (
                  <button
                    key={f.key}
                    type="button"
                    onClick={() => handleFormatSwitch(f.key)}
                    className={`p-2.5 rounded-lg text-xs text-left transition flex items-center justify-between border cursor-pointer ${
                      isActive
                        ? 'bg-blue-600 text-white font-bold border-blue-600 shadow-sm'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 hover:border-slate-300 font-medium'
                    }`}
                    data-testid={`format-tab-${f.key}`}
                  >
                    <span>{f.label}</span>
                    {isActive && <Check className="w-4 h-4 text-white" />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Section 3: Products & Services Workspace */}
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs space-y-0">
          {/* Table Action Header */}
          <div className="px-6 py-4 bg-slate-50/80 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-blue-600" />
              <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                {currentFormat === 'STANDARD'
                  ? `Standard Commercial Products (${items.length} Line Items)`
                  : `Project / Solution Line Items (${items.length} Items across ${activeSections.length} Sections)`}
              </h2>
            </div>

            {/* Quick Actions */}
            <div className="flex items-center gap-2">
              {/* Presets switcher for UAT demonstration */}
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleLoadStandardITItems}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border shadow-xs transition cursor-pointer ${
                    currentFormat === 'STANDARD'
                      ? 'bg-blue-50 text-blue-700 border-blue-300'
                      : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                  }`}
                  data-testid="load-standard-preset-btn"
                  title="Load standard IT products (Dell Laptop, HP Printer, Epson Projector)"
                >
                  Load IT Preset
                </button>
                <button
                  type="button"
                  onClick={handleLoadHomeTheaterItems}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border shadow-xs transition cursor-pointer ${
                    currentFormat === 'HOME_THEATER'
                      ? 'bg-blue-50 text-blue-700 border-blue-300'
                      : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                  }`}
                  data-testid="load-ht-preset-btn"
                  title="Load Home Theater turnkey project items"
                >
                  Load HT Preset
                </button>
              </div>

              <button
                type="button"
                onClick={handleAddSection}
                className="px-3 py-1.5 rounded-lg bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold border border-slate-300 shadow-xs transition cursor-pointer"
              >
                + Add Section
              </button>

              <button
                type="button"
                onClick={handleAddServicePreset}
                className="px-3 py-1.5 rounded-lg bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold border border-slate-300 shadow-xs transition cursor-pointer"
              >
                + Add Service
              </button>

              <button
                type="button"
                onClick={() => setAiResearchOpen(true)}
                className="px-3.5 py-1.5 rounded-lg bg-white hover:bg-blue-50 text-blue-700 text-xs font-bold border border-blue-300 flex items-center gap-1.5 shadow-xs transition cursor-pointer"
                data-testid="open-ai-research-btn"
              >
                <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                <span>AI Research Agent</span>
              </button>

              <button
                type="button"
                onClick={() => handleOpenCreateItem(activeSections[0])}
                className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition cursor-pointer"
                data-testid="add-product-btn"
              >
                <Plus className="w-4 h-4" />
                <span>+ Add Product</span>
              </button>
            </div>
          </div>

          {/* VIEW PRESENTATION 1: STANDARD COMMERCIAL TABLE */}
          {currentFormat === 'STANDARD' ? (
            <div className="p-4 overflow-x-auto">
              <table className="w-full text-left text-xs border border-slate-200 rounded-lg overflow-hidden">
                <thead className="bg-slate-100 text-slate-700 font-bold uppercase text-[11px] border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3 w-10 text-center">S.No</th>
                    <th className="py-2.5 px-3">Product / Description</th>
                    <th className="py-2.5 px-3 w-24 text-center">HSN/SAC</th>
                    <th className="py-2.5 px-3 w-16 text-center">Qty</th>
                    <th className="py-2.5 px-3 w-16 text-center">Unit</th>
                    <th className="py-2.5 px-3 w-24 text-right">Unit Rate (₹)</th>
                    <th className="py-2.5 px-3 w-20 text-right">Discount</th>
                    <th className="py-2.5 px-3 w-16 text-center">GST</th>
                    <th className="py-2.5 px-3 w-28 text-right">Amount (₹)</th>
                    <th className="py-2.5 px-3 w-24 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {items.map((item, idx) => {
                    const lineTotal = Math.max(0, item.quantity * item.unit_price - (item.discount || 0));
                    return (
                      <tr
                        key={item.id}
                        className="hover:bg-slate-50 transition"
                        data-testid="workspace-item-row"
                      >
                        <td className="py-3 px-3 text-center text-slate-500 font-mono">
                          {idx + 1}
                        </td>
                        <td className="py-3 px-3">
                          <div className="space-y-0.5">
                            <span className="font-bold text-slate-900 text-sm">
                              {item.brand ? `${item.brand} ` : ''}
                              {item.model ? `– ${item.model}` : ''}
                            </span>
                            <p className="text-xs text-slate-700 font-medium">
                              {item.product_name}
                            </p>
                            {item.customer_description && (
                              <p className="text-[11px] text-slate-500 line-clamp-1 italic">
                                &ldquo;{item.customer_description}&rdquo;
                              </p>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-3 text-center font-mono text-slate-700">
                          {item.hsn_sac || ''}
                        </td>
                        <td className="py-3 px-3 text-center font-semibold text-slate-900">
                          {item.quantity}
                        </td>
                        <td className="py-3 px-3 text-center text-slate-600">
                          {item.unit || 'Nos'}
                        </td>
                        <td className="py-3 px-3 text-right font-mono text-slate-900">
                          ₹{item.unit_price.toLocaleString('en-IN')}
                        </td>
                        <td className="py-3 px-3 text-right font-mono text-rose-600 font-medium">
                          {item.discount > 0 ? `-₹${item.discount.toLocaleString('en-IN')}` : '—'}
                        </td>
                        <td className="py-3 px-3 text-center font-mono text-slate-700">
                          {item.gst_rate}%
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-bold text-slate-900">
                          ₹{lineTotal.toLocaleString('en-IN')}
                        </td>
                        <td className="py-3 px-3 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleOpenEditItem(item)}
                              className="p-1 rounded bg-slate-100 hover:bg-blue-600 text-slate-600 hover:text-white transition cursor-pointer"
                              title="Edit Product"
                              data-testid="edit-item-btn"
                            >
                              <Sliders className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDuplicateItem(item)}
                              className="p-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-600 transition cursor-pointer"
                              title="Duplicate Item"
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteItem(item.id)}
                              className="p-1 rounded bg-slate-100 hover:bg-rose-100 text-slate-600 hover:text-rose-700 transition cursor-pointer"
                              title="Delete Item"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            /* VIEW PRESENTATION 2: PROJECT / SOLUTION SECTIONED CARDS */
            <div className="p-4 space-y-6">
              {activeSections.map((secTitle, sIdx) => {
                const secItems = items.filter((it) => it.section_id === secTitle);

                return (
                  <div
                    key={`sec-block-${sIdx}`}
                    className="border border-slate-200 rounded-lg overflow-hidden bg-white shadow-xs"
                    data-testid="workspace-section-block"
                  >
                    {/* Section Title Bar */}
                    <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-blue-600" />
                        <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                          {secTitle}
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-200 text-slate-700 font-mono font-semibold">
                          {secItems.length} items
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleOpenCreateItem(secTitle)}
                        className="text-xs text-blue-700 hover:text-blue-900 font-semibold flex items-center gap-1 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" /> Add to {secTitle}
                      </button>
                    </div>

                    {/* Items Table for this section */}
                    {secItems.length === 0 ? (
                      <div className="p-4 text-center text-xs text-slate-500 italic bg-white">
                        No items in this section yet. Click &quot;Add to {secTitle}&quot; to populate.
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                          <thead>
                            <tr className="border-b border-slate-200 bg-slate-50/50 text-[10px] uppercase font-bold text-slate-600 tracking-wider">
                              <th className="py-2.5 px-3 w-10 text-center">#</th>
                              <th className="py-2.5 px-3">Product / Technical Specification Details</th>
                              <th className="py-2.5 px-3 w-20 text-center">HSN/SAC</th>
                              <th className="py-2.5 px-3 w-16 text-center">Qty</th>
                              <th className="py-2.5 px-3 w-24 text-right">Unit Price (₹)</th>
                              <th className="py-2.5 px-3 w-16 text-center">GST</th>
                              <th className="py-2.5 px-3 w-28 text-right">Total (₹)</th>
                              <th className="py-2.5 px-3 w-24 text-center">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 bg-white">
                            {secItems.map((item, itemIdx) => {
                              const lineTotal = Math.max(0, item.quantity * item.unit_price - (item.discount || 0));
                              return (
                                <tr
                                  key={item.id}
                                  className="hover:bg-slate-50/80 transition group"
                                  data-testid="workspace-item-row"
                                >
                                  <td className="py-3 px-3 text-center text-slate-500 font-mono">
                                    {itemIdx + 1}
                                  </td>

                                  {/* Product details & technical tags */}
                                  <td className="py-3 px-3">
                                    <div className="space-y-1">
                                      <div className="flex items-center gap-2">
                                        <span className="font-bold text-slate-900 text-sm">
                                          {item.brand ? `${item.brand} ` : ''}
                                          {item.model ? `– ${item.model}` : ''}
                                        </span>
                                        {item.is_dynamic && (
                                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 font-semibold border border-amber-300">
                                            Dynamic
                                          </span>
                                        )}
                                      </div>
                                      <p className="text-slate-800 font-medium">
                                        {item.product_name}
                                      </p>

                                      {/* Snippet of customer description */}
                                      {item.customer_description && (
                                        <p className="text-[11px] text-slate-600 line-clamp-1 italic">
                                          &ldquo;{item.customer_description}&rdquo;
                                        </p>
                                      )}

                                      {/* Highlight specs pill count */}
                                      <div className="flex items-center gap-2 pt-1 text-[10px] text-slate-600">
                                        <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-800 font-semibold border border-blue-200">
                                          {item.specifications?.length || 0} Specs
                                        </span>
                                        <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-800 font-semibold border border-emerald-200">
                                          {item.short_highlights?.length || 0} Highlights
                                        </span>
                                        {item.warranty && (
                                          <span className="text-slate-600">
                                            Warranty: {item.warranty}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  </td>

                                  <td className="py-3 px-3 text-center font-mono text-slate-700">
                                    {item.hsn_sac || ''}
                                  </td>

                                  <td className="py-3 px-3 text-center font-semibold text-slate-900">
                                    {item.quantity} {item.unit || 'Nos'}
                                  </td>

                                  <td className="py-3 px-3 text-right font-mono text-slate-900">
                                    ₹{item.unit_price.toLocaleString('en-IN')}
                                    {item.discount > 0 && (
                                      <span className="block text-[10px] text-rose-600 font-medium">
                                        -₹{item.discount.toLocaleString('en-IN')}
                                      </span>
                                    )}
                                  </td>

                                  <td className="py-3 px-3 text-center font-mono text-slate-700">
                                    {item.gst_rate}%
                                  </td>

                                  <td className="py-3 px-3 text-right font-mono font-bold text-slate-900">
                                    ₹{lineTotal.toLocaleString('en-IN')}
                                  </td>

                                  {/* Action Buttons */}
                                  <td className="py-3 px-3 text-center">
                                    <div className="flex items-center justify-center gap-1.5">
                                      <button
                                        type="button"
                                        onClick={() => handleOpenEditItem(item)}
                                        className="p-1 rounded bg-slate-100 hover:bg-blue-600 text-slate-600 hover:text-white transition cursor-pointer"
                                        title="Edit Product (6-Tab Drawer)"
                                        data-testid="edit-item-btn"
                                      >
                                        <Sliders className="w-3.5 h-3.5" />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleDuplicateItem(item)}
                                        className="p-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-600 transition cursor-pointer"
                                        title="Duplicate Item"
                                      >
                                        <Copy className="w-3.5 h-3.5" />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleDeleteItem(item.id)}
                                        className="p-1 rounded bg-slate-100 hover:bg-rose-100 text-slate-600 hover:text-rose-700 transition cursor-pointer"
                                        title="Delete Item"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Section 4: Commercial Financial Summary & Terms */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Terms & Notes (Left) */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Terms &amp; Conditions &amp; Project Scope Notes
            </h3>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-[10px] font-bold text-slate-700 uppercase tracking-wider block mb-1">
                  Client Proposal Scope Note
                </label>
                <textarea
                  rows={2}
                  value={clientNotes}
                  onChange={(e) => setClientNotes(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg p-2.5 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-700 uppercase tracking-wider block mb-1">
                  Standard Commercial Terms (7 Points)
                </label>
                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  {terms.map((t, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <span className="text-slate-500 font-mono text-[11px] font-semibold">{idx + 1}.</span>
                      <input
                        type="text"
                        value={t}
                        onChange={(e) => {
                          const updated = [...terms];
                          updated[idx] = e.target.value;
                          setTerms(updated);
                        }}
                        className="flex-1 bg-white border border-slate-200 rounded px-2 py-1 text-xs text-slate-800 focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Pricing & GST Totals Engine (Right) */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Commercial Financial Summary
              </h3>
              <div className="flex items-center gap-1.5 bg-slate-100 rounded-lg p-0.5 text-[11px] font-semibold">
                <button
                  type="button"
                  onClick={() => setPricingMode('tax_exclusive')}
                  className={`px-2.5 py-1 rounded transition cursor-pointer ${
                    pricingMode === 'tax_exclusive'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Tax Exclusive
                </button>
                <button
                  type="button"
                  onClick={() => setPricingMode('tax_inclusive')}
                  className={`px-2.5 py-1 rounded transition cursor-pointer ${
                    pricingMode === 'tax_inclusive'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Tax Inclusive
                </button>
              </div>
            </div>

            {/* Calculations Breakdown */}
            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-100 text-slate-700">
                <span>Subtotal (Base Value):</span>
                <span className="font-mono font-semibold text-slate-900">
                  ₹{calculations.rawSubtotal.toLocaleString('en-IN')}
                </span>
              </div>

              {/* Overall Discount Input */}
              <div className="flex items-center justify-between py-1 border-b border-slate-100 text-slate-700">
                <div className="flex items-center gap-2">
                  <span>Overall Discount:</span>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={overallDiscountPercent}
                      onChange={(e) => setOverallDiscountPercent(Number(e.target.value) || 0)}
                      className="w-14 bg-white border border-slate-300 rounded px-1.5 py-0.5 text-xs text-right font-mono text-slate-900"
                    />
                    <span className="text-slate-500">%</span>
                  </div>
                </div>
                <span className="font-mono text-rose-600 font-semibold">
                  {calculations.discountAmount > 0
                    ? `-₹${calculations.discountAmount.toLocaleString('en-IN')}`
                    : '₹0'}
                </span>
              </div>

              {/* Taxable Subtotal */}
              <div className="flex justify-between py-1 border-b border-slate-100 text-slate-700">
                <span>Taxable Value:</span>
                <span className="font-mono font-semibold text-slate-900">
                  ₹{calculations.taxableSubtotal.toLocaleString('en-IN')}
                </span>
              </div>

              {/* GST Breakdown */}
              {calculations.cgst > 0 && (
                <div className="flex justify-between py-1 text-slate-700">
                  <span>CGST (9%):</span>
                  <span className="font-mono text-slate-800">
                    ₹{calculations.cgst.toLocaleString('en-IN')}
                  </span>
                </div>
              )}
              {calculations.sgst > 0 && (
                <div className="flex justify-between py-1 text-slate-700">
                  <span>SGST (9%):</span>
                  <span className="font-mono text-slate-800">
                    ₹{calculations.sgst.toLocaleString('en-IN')}
                  </span>
                </div>
              )}
              {calculations.igst > 0 && (
                <div className="flex justify-between py-1 text-slate-700">
                  <span>IGST (18%):</span>
                  <span className="font-mono text-slate-800">
                    ₹{calculations.igst.toLocaleString('en-IN')}
                  </span>
                </div>
              )}

              {/* Grand Total */}
              <div className="pt-2 border-t-2 border-blue-900 flex justify-between items-baseline">
                <span className="text-sm font-bold text-blue-950 uppercase tracking-wider">
                  Grand Total (INR):
                </span>
                <span
                  className="text-2xl font-black text-blue-900 font-mono"
                  data-testid="workspace-grand-total"
                >
                  ₹{calculations.grandTotal.toLocaleString('en-IN')}
                </span>
              </div>

              {/* Amount in words */}
              <div className="p-2.5 bg-blue-50/60 rounded-lg border border-blue-200 text-xs italic text-blue-950 font-medium">
                {calculations.amountInWords}
              </div>

              {/* Internal Confidential Profitability (Strictly Internal to Sales) */}
              <div className="pt-3 border-t border-slate-200 mt-2">
                <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1">
                  <span className="flex items-center gap-1 font-semibold text-amber-700">
                    <ShieldAlert className="w-3.5 h-3.5" /> Confidential Internal Margin
                  </span>
                  <span className="font-mono font-bold text-slate-700">
                    Cost: ₹{calculations.totalPurchaseCost.toLocaleString('en-IN')}
                  </span>
                </div>
                <div className="flex justify-between text-xs font-semibold">
                  <span className="text-slate-600">Gross Profit Margin:</span>
                  <span className="font-mono text-emerald-700">
                    ₹{calculations.grossMarginAmount.toLocaleString('en-IN')} ({calculations.grossMarginPercent.toFixed(1)}%)
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* 6-Tab Product Drawer */}
      <DemoProductDrawer
        isOpen={drawerOpen}
        item={editingItem}
        availableSections={activeSections}
        defaultSectionId={targetSectionForNewItem}
        onClose={() => setDrawerOpen(false)}
        onSave={handleSaveItemFromDrawer}
      />

      {/* High-Fidelity Customer Preview Modal */}
      <DemoCustomerPreviewModal
        isOpen={previewOpen}
        onClose={() => setPreviewOpen(false)}
        quotationNumber={quotationNumber}
        quotationDate={quotationDate}
        validUntil={validUntil}
        customer={customer}
        format={currentFormat}
        sections={activeSections}
        items={items}
        pricingMode={pricingMode}
        salesperson={salesperson}
        projectReference={projectReference}
        terms={terms}
        clientNotes={clientNotes}
      />

      {/* AI Research Agent Modal */}
      <DemoAIResearchModal
        isOpen={aiResearchOpen}
        onClose={() => setAiResearchOpen(false)}
        onAddItem={(researchedItem: DemoQuotationItem) => {
          handleSaveItemFromDrawer(researchedItem);
          setAiResearchOpen(false);
        }}
      />
    </div>
  );
}
