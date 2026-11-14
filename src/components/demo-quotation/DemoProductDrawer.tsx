'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  Plus,
  Trash2,
  Sparkles,
  ShieldAlert,
  FileText,
  Layers,
  Image as ImageIcon,
  DollarSign,
  Tag,
  Check,
  Upload,
  ArrowUp,
  ArrowDown,
  Info,
} from 'lucide-react';
import type { DemoQuotationItem, DemoProductSpecification } from './demo-data';

interface DemoProductDrawerProps {
  isOpen: boolean;
  item: DemoQuotationItem | null;
  sectionOptions?: string[];
  availableSections?: string[];
  defaultSectionId?: string;
  onClose: () => void;
  onSave: (item: DemoQuotationItem) => void;
}

type TabKey = 'basic' | 'specs' | 'description' | 'highlights' | 'media' | 'pricing';

export function DemoProductDrawer({
  isOpen,
  item,
  sectionOptions,
  availableSections,
  defaultSectionId,
  onClose,
  onSave,
}: DemoProductDrawerProps) {
  const sections = availableSections || sectionOptions || ['GENERAL'];
  const [activeTab, setActiveTab] = useState<TabKey>('basic');

  // Form State
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [productName, setProductName] = useState('');
  const [category, setCategory] = useState('Home Theater');
  const [hsnSac, setHsnSac] = useState('85286900');
  const [unit, setUnit] = useState('Nos');
  const [quantity, setQuantity] = useState(1);
  const [unitPrice, setUnitPrice] = useState(0);
  const [gstRate, setGstRate] = useState(18);
  const [discount, setDiscount] = useState(0);
  const [sectionId, setSectionId] = useState('');
  const [isDynamic, setIsDynamic] = useState(false);
  const [warranty, setWarranty] = useState('2 Years Manufacturer Warranty');
  const [specifications, setSpecifications] = useState<DemoProductSpecification[]>([]);
  const [customerDescription, setCustomerDescription] = useState('');
  const [shortHighlights, setShortHighlights] = useState<string[]>([]);
  const [newHighlight, setNewHighlight] = useState('');
  const [purchaseCost, setPurchaseCost] = useState(0);
  const [supplierName, setSupplierName] = useState('');
  const [internalNotes, setInternalNotes] = useState('');

  // Sync state when item changes
  useEffect(() => {
    if (item) {
      setBrand(item.brand || '');
      setModel(item.model || '');
      setProductName(item.product_name || '');
      setCategory(item.category || 'Home Theater');
      setHsnSac(item.hsn_sac || '');
      setUnit(item.unit || 'Nos');
      setQuantity(item.quantity || 1);
      setUnitPrice(item.unit_price || 0);
      setGstRate(item.gst_rate ?? 18);
      setDiscount(item.discount || 0);
      setSectionId(item.section_id || defaultSectionId || sections[0] || 'GENERAL');
      setIsDynamic(!!item.is_dynamic);
      setWarranty(item.warranty || '2 Years Manufacturer Warranty');
      setSpecifications(item.specifications ? [...item.specifications] : []);
      setCustomerDescription(item.customer_description || '');
      setShortHighlights(item.short_highlights ? [...item.short_highlights] : []);
      setPurchaseCost(item.purchase_cost || 0);
      setSupplierName(item.supplier_name || '');
      setInternalNotes(item.internal_notes || '');
    } else {
      // Defaults for brand new product
      setBrand('');
      setModel('');
      setProductName('');
      setCategory('Projector');
      setHsnSac('');
      setUnit('Nos');
      setQuantity(1);
      setUnitPrice(0);
      setGstRate(18);
      setDiscount(0);
      setSectionId(defaultSectionId || sections[0] || 'GENERAL');
      setIsDynamic(true);
      setWarranty('2 Years Manufacturer Warranty');
      setSpecifications([
        { key: 'Resolution', value: '4K UHD (3840 × 2160)' },
        { key: 'Brightness', value: '3,200 ANSI Lumens' },
        { key: 'Light Source', value: 'Laser' },
      ]);
      setCustomerDescription('');
      setShortHighlights(['4K UHD Resolution', 'High Contrast Optics']);
      setPurchaseCost(0);
      setSupplierName('');
      setInternalNotes('');
    }
    setActiveTab('basic');
  }, [item, sections, defaultSectionId, isOpen]);

  if (!isOpen) return null;

  // Margin Calculations
  const marginAmt = unitPrice - purchaseCost;
  const marginPct = unitPrice > 0 ? (marginAmt / unitPrice) * 100 : 0;

  // Handlers for specifications
  const handleAddSpec = () => {
    setSpecifications([...specifications, { key: '', value: '' }]);
  };

  const handleUpdateSpec = (idx: number, field: 'key' | 'value', val: string) => {
    const updated = [...specifications];
    updated[idx][field] = val;
    setSpecifications(updated);
  };

  const handleDeleteSpec = (idx: number) => {
    setSpecifications(specifications.filter((_, i) => i !== idx));
  };

  const handleSimulateAiSpecs = () => {
    setSpecifications([
      { key: 'Projection Technology', value: 'DLP (0.65" ECD)' },
      { key: 'Native Resolution', value: '4K UHD (3840 × 2160)' },
      { key: 'Brightness', value: '3,200 ANSI Lumens' },
      { key: 'Light Source', value: 'Solid-State Laser Diode' },
      { key: 'Dynamic Contrast Ratio', value: '600,000:1' },
      { key: 'Color Gamut', value: '95% Rec.709 Coverage' },
      { key: 'Throw Ratio', value: '1.15 - 1.50 (100" @ 2.5m)' },
      { key: 'Zoom Ratio', value: '1.3x Optical Zoom' },
      { key: 'Lens Shift', value: 'Vertical +10%' },
      { key: 'Input Latency', value: '4ms (1080p@240Hz) / 16ms (4K@60Hz)' },
      { key: 'HDMI Interfaces', value: '2 × HDMI 2.0b (HDCP 2.2)' },
      { key: 'Audio Output', value: '1 × eARC / Optical SPDIF' },
    ]);
    if (!customerDescription) {
      setCustomerDescription(
        'Premium 4K UHD laser projector designed for high-performance home cinema and entertainment installations. Engineered with laser solid-state illumination, precision DLP optics, HDR10/HLG support, and ultra-low input latency for cinematic movies and responsive gaming.'
      );
    }
    if (shortHighlights.length === 0) {
      setShortHighlights([
        'True 4K UHD 8.3M Pixel Detail',
        '3,200 ANSI Lumens Laser Brightness',
        'HDR10 & HLG High Dynamic Range',
        '600,000:1 Dynamic Contrast Ratio',
        'Dual HDMI 2.0b with eARC',
      ]);
    }
  };

  // Handlers for short highlights
  const handleAddHighlight = () => {
    if (newHighlight.trim()) {
      setShortHighlights([...shortHighlights, newHighlight.trim()]);
      setNewHighlight('');
    }
  };

  const handleDeleteHighlight = (idx: number) => {
    setShortHighlights(shortHighlights.filter((_, i) => i !== idx));
  };

  const handleMoveHighlight = (idx: number, direction: 'up' | 'down') => {
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= shortHighlights.length) return;
    const updated = [...shortHighlights];
    const temp = updated[idx];
    updated[idx] = updated[targetIdx];
    updated[targetIdx] = temp;
    setShortHighlights(updated);
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!productName.trim()) {
      alert('Please enter a product name.');
      return;
    }

    const payload: DemoQuotationItem = {
      id: item?.id || `item-dynamic-${Date.now()}`,
      product_id: item?.product_id || (isDynamic ? undefined : `PRD-${Date.now()}`),
      brand: brand.trim() || 'Generic',
      model: model.trim() || 'Standard',
      product_name: productName.trim(),
      category: category.trim(),
      hsn_sac: hsnSac.trim(),
      unit: unit || 'Nos',
      quantity: Math.max(1, Number(quantity) || 1),
      unit_price: Math.max(0, Number(unitPrice) || 0),
      gst_rate: Number(gstRate) || 18,
      discount: Math.max(0, Number(discount) || 0),
      section_id: sectionId || sections[0] || 'GENERAL',
      is_dynamic: isDynamic,
      warranty: warranty.trim(),
      specifications: specifications.filter((s) => s.key.trim() && s.value.trim()),
      customer_description: customerDescription.trim(),
      short_highlights: shortHighlights.filter((h) => h.trim()),
      purchase_cost: Math.max(0, Number(purchaseCost) || 0),
      supplier_name: supplierName.trim(),
      internal_notes: internalNotes.trim(),
    };

    onSave(payload);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="absolute inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-2xl bg-white shadow-2xl flex flex-col border-l border-slate-200">
          {/* Header */}
          <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-800 border border-blue-200">
                  {item ? 'EDIT PRODUCT' : 'NEW PRODUCT WORKSPACE'}
                </span>
                {isDynamic && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-300">
                    Dynamic (Quotation Only)
                  </span>
                )}
              </div>
              <h2 className="text-base font-black text-slate-900 mt-1">
                {productName ? `${brand ? brand + ' ' : ''}${model ? model + ' — ' : ''}${productName}` : 'Add / Configure Line Item'}
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition cursor-pointer"
              data-testid="product-drawer-close-btn"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* 6 Tabs Navigation */}
          <div className="flex border-b border-slate-200 bg-white px-6 overflow-x-auto gap-1">
            <button
              type="button"
              onClick={() => setActiveTab('basic')}
              className={`py-3 px-3.5 text-xs font-bold border-b-2 flex items-center gap-1.5 transition cursor-pointer whitespace-nowrap ${
                activeTab === 'basic'
                  ? 'border-blue-600 text-blue-600 bg-blue-50/50'
                  : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
              }`}
            >
              <Layers className="w-4 h-4" />
              <span>1. Basic Details</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('specs')}
              className={`py-3 px-3.5 text-xs font-bold border-b-2 flex items-center gap-1.5 transition cursor-pointer whitespace-nowrap ${
                activeTab === 'specs'
                  ? 'border-blue-600 text-blue-600 bg-blue-50/50'
                  : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
              }`}
            >
              <Tag className="w-4 h-4" />
              <span>2. Specifications ({specifications.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('description')}
              className={`py-3 px-3.5 text-xs font-bold border-b-2 flex items-center gap-1.5 transition cursor-pointer whitespace-nowrap ${
                activeTab === 'description'
                  ? 'border-blue-600 text-blue-600 bg-blue-50/50'
                  : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>3. Customer Description</span>
              {customerDescription && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('highlights')}
              className={`py-3 px-3.5 text-xs font-bold border-b-2 flex items-center gap-1.5 transition cursor-pointer whitespace-nowrap ${
                activeTab === 'highlights'
                  ? 'border-blue-600 text-blue-600 bg-blue-50/50'
                  : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
              }`}
            >
              <Sparkles className="w-4 h-4" />
              <span>4. Short Highlights ({shortHighlights.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('media')}
              className={`py-3 px-3.5 text-xs font-bold border-b-2 flex items-center gap-1.5 transition cursor-pointer whitespace-nowrap ${
                activeTab === 'media'
                  ? 'border-blue-600 text-blue-600 bg-blue-50/50'
                  : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
              }`}
            >
              <ImageIcon className="w-4 h-4" />
              <span>5. Images & Docs</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('pricing')}
              className={`py-3 px-3.5 text-xs font-bold border-b-2 flex items-center gap-1.5 transition cursor-pointer whitespace-nowrap ${
                activeTab === 'pricing'
                  ? 'border-amber-600 text-amber-700 bg-amber-50/50'
                  : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
              }`}
            >
              <DollarSign className="w-4 h-4 text-amber-600" />
              <span>6. Internal Pricing</span>
            </button>
          </div>

          {/* Form Content */}
          <form onSubmit={handleFormSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* TAB 1: BASIC DETAILS */}
            {activeTab === 'basic' && (
              <div className="space-y-5 animate-in fade-in-50 duration-150">
                <div className="p-3.5 bg-blue-50/70 border border-blue-200 rounded-xl flex items-start gap-2.5 text-xs text-blue-900">
                  <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                  <div>
                    <strong>Core Commercial Attributes:</strong> Brand and Model form the primary customer-facing heading on the quotation (e.g. <code>BENQ – TK710</code>).
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Brand / Manufacturer *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. BenQ, Denon, Sony"
                      value={brand}
                      onChange={(e) => setBrand(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Model / Part Code *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. TK710, AVR-X3800H"
                      value={model}
                      onChange={(e) => setModel(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Product / Service Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. BenQ TK710 4K UHD Laser Projector"
                    value={productName}
                    onChange={(e) => setProductName(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Category</label>
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="Projector">Projector</option>
                      <option value="Home Theater">Home Theater</option>
                      <option value="AV Solution">AV Solution</option>
                      <option value="Speakers">Speakers</option>
                      <option value="Video Conferencing">Video Conferencing</option>
                      <option value="CCTV">CCTV</option>
                      <option value="Networking">Networking</option>
                      <option value="Installation">Installation / Service</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Target Section</label>
                    <select
                      value={sectionId}
                      onChange={(e) => setSectionId(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-semibold"
                    >
                      {sections.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Unit</label>
                    <select
                      value={unit}
                      onChange={(e) => setUnit(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="Nos">Nos</option>
                      <option value="Set">Set</option>
                      <option value="Pair">Pair</option>
                      <option value="Job">Job</option>
                      <option value="Mtr">Mtr</option>
                      <option value="Lot">Lot</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Quantity</label>
                    <input
                      type="number"
                      min="1"
                      value={quantity}
                      onChange={(e) => setQuantity(Math.max(1, Number(e.target.value) || 1))}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Unit Price (₹)</label>
                    <input
                      type="number"
                      min="0"
                      value={unitPrice}
                      onChange={(e) => setUnitPrice(Math.max(0, Number(e.target.value) || 0))}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">GST Rate</label>
                    <select
                      value={gstRate}
                      onChange={(e) => setGstRate(Number(e.target.value))}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value={18}>18%</option>
                      <option value={28}>28%</option>
                      <option value={12}>12%</option>
                      <option value={5}>5%</option>
                      <option value={0}>0% (Exempt)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Discount (₹)</label>
                    <input
                      type="number"
                      min="0"
                      value={discount}
                      onChange={(e) => setDiscount(Math.max(0, Number(e.target.value) || 0))}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-amber-700"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">HSN / SAC Code (Optional)</label>
                    <input
                      type="text"
                      placeholder="Optional (e.g. 85286900)"
                      value={hsnSac}
                      onChange={(e) => setHsnSac(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Warranty Term</label>
                    <input
                      type="text"
                      value={warranty}
                      onChange={(e) => setWarranty(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs"
                    />
                  </div>
                </div>

                {/* Dynamic Product Checkbox */}
                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                  <div className="space-y-0.5">
                    <span className="text-xs font-bold text-slate-900 block">
                      Save to Quotation Only (Dynamic Product)
                    </span>
                    <span className="text-[11px] text-slate-500 block">
                      Does not pollute the central Product Master. Ideal for custom distributor quotations.
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={isDynamic}
                    onChange={(e) => setIsDynamic(e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 cursor-pointer"
                  />
                </div>
              </div>
            )}

            {/* TAB 2: SPECIFICATIONS */}
            {activeTab === 'specs' && (
              <div className="space-y-5 animate-in fade-in-50 duration-150">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xs font-bold text-slate-900">
                      Technical Specifications Key-Value Table
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      Granular hardware specifications presented clearly to the customer.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleSimulateAiSpecs}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-bold rounded-xl transition cursor-pointer"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Import Specs with AI</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleAddSpec}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs transition cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Row</span>
                    </button>
                  </div>
                </div>

                <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[10px]">
                      <tr>
                        <th className="py-2.5 px-3 w-2/5">Specification Property</th>
                        <th className="py-2.5 px-3">Manufacturer Value</th>
                        <th className="py-2.5 px-2 w-10 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {specifications.length === 0 ? (
                        <tr>
                          <td colSpan={3} className="py-8 text-center text-slate-400 italic">
                            No specifications entered yet. Click "+ Add Row" or "Import Specs with AI".
                          </td>
                        </tr>
                      ) : (
                        specifications.map((spec, sIdx) => (
                          <tr key={sIdx} className="hover:bg-slate-50/60 transition">
                            <td className="py-1.5 px-3">
                              <input
                                type="text"
                                placeholder="e.g. Resolution"
                                value={spec.key}
                                onChange={(e) => handleUpdateSpec(sIdx, 'key', e.target.value)}
                                className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold text-slate-900 bg-white placeholder-slate-400 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                              />
                            </td>
                            <td className="py-1.5 px-3">
                              <input
                                type="text"
                                placeholder="e.g. 4K UHD (3840 × 2160)"
                                value={spec.value}
                                onChange={(e) => handleUpdateSpec(sIdx, 'value', e.target.value)}
                                className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold text-slate-900 bg-white placeholder-slate-400 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                              />
                            </td>
                            <td className="py-1.5 px-2 text-center">
                              <button
                                type="button"
                                onClick={() => handleDeleteSpec(sIdx)}
                                className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TAB 3: CUSTOMER DESCRIPTION */}
            {activeTab === 'description' && (
              <div className="space-y-4 animate-in fade-in-50 duration-150">
                <div className="p-4 bg-emerald-50/80 border border-emerald-200 rounded-xl flex items-start gap-3">
                  <Check className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                  <div className="text-xs text-emerald-950 space-y-1">
                    <span className="font-bold block uppercase tracking-wider text-[11px] text-emerald-800">
                      MANDATORY CUSTOMER-FACING DESCRIPTION
                    </span>
                    <p>
                      <strong>Will appear directly on the customer proposal:</strong> This descriptive explanation conveys the real-world value, room suitability, and purpose to the customer. It is NOT technical jargon.
                    </p>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-black uppercase tracking-wider text-slate-700">
                      Customer Description (Will appear in quotation) *
                    </label>
                    <span className="text-[11px] text-slate-400 font-mono">
                      {customerDescription.length} characters
                    </span>
                  </div>
                  <textarea
                    rows={7}
                    required
                    value={customerDescription}
                    onChange={(e) => setCustomerDescription(e.target.value)}
                    placeholder="Enter a polished, customer-friendly explanation of why this product is selected for their setup..."
                    className="w-full p-3.5 border border-slate-300 rounded-xl text-sm leading-relaxed text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                  />
                  <p className="text-[11px] text-slate-500 mt-1.5">
                    💡 <em>Example:</em> "Premium 4K UHD laser projector designed for immersive home-theater applications, delivering high brightness, HDR support and detailed cinematic visuals. Ideal for dedicated home theaters, media rooms and premium AV installations."
                  </p>
                </div>
              </div>
            )}

            {/* TAB 4: SHORT HIGHLIGHTS */}
            {activeTab === 'highlights' && (
              <div className="space-y-5 animate-in fade-in-50 duration-150">
                <div className="p-3.5 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-900">
                  <strong>Short Highlights:</strong> Fast-scan bullet chips that appear on the customer quotation immediately below the product title.
                </div>

                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newHighlight}
                    onChange={(e) => setNewHighlight(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddHighlight();
                      }
                    }}
                    placeholder="e.g. 3,200 ANSI Lumens, 4K UHD Detail..."
                    className="flex-1 px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleAddHighlight}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition cursor-pointer"
                  >
                    Add Highlight
                  </button>
                </div>

                <div className="space-y-2">
                  {shortHighlights.length === 0 ? (
                    <div className="p-8 text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-xl">
                      No highlights added. Type above to add quick marketing highlights.
                    </div>
                  ) : (
                    shortHighlights.map((hl, hIdx) => (
                      <div
                        key={hIdx}
                        className="flex items-center justify-between p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800"
                      >
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-blue-500" />
                          <span className="font-semibold">{hl}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            disabled={hIdx === 0}
                            onClick={() => handleMoveHighlight(hIdx, 'up')}
                            className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30 cursor-pointer"
                            title="Move Up"
                          >
                            <ArrowUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            disabled={hIdx === shortHighlights.length - 1}
                            onClick={() => handleMoveHighlight(hIdx, 'down')}
                            className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30 cursor-pointer"
                            title="Move Down"
                          >
                            <ArrowDown className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteHighlight(hIdx)}
                            className="p-1 text-slate-400 hover:text-rose-600 cursor-pointer"
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* TAB 5: IMAGES & DOCUMENTS */}
            {activeTab === 'media' && (
              <div className="space-y-5 animate-in fade-in-50 duration-150">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-2">
                    Primary Product Image
                  </label>
                  <div className="flex items-center gap-4 p-4 border border-slate-200 rounded-xl bg-slate-50">
                    <div className="w-20 h-20 bg-white border border-slate-200 rounded-lg flex items-center justify-center text-slate-300">
                      <ImageIcon className="w-10 h-10" />
                    </div>
                    <div className="space-y-2">
                      <button
                        type="button"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-300 text-xs font-bold rounded-lg hover:bg-slate-100 transition cursor-pointer"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        <span>Change Image</span>
                      </button>
                      <p className="text-[11px] text-slate-400">
                        Supports PNG, JPG, WebP up to 5MB.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="block text-xs font-bold text-slate-700">
                    Manufacturer Documents (Datasheet / Brochure)
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 bg-white border border-slate-200 rounded-xl flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-blue-600" />
                        <div>
                          <span className="font-bold block">Official Datasheet</span>
                          <span className="text-[10px] text-slate-400">PDF &bull; 1.4 MB</span>
                        </div>
                      </div>
                      <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                        Ready
                      </span>
                    </div>

                    <div className="p-3 bg-white border border-slate-200 rounded-xl flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-purple-600" />
                        <div>
                          <span className="font-bold block">Product Brochure</span>
                          <span className="text-[10px] text-slate-400">PDF &bull; 3.2 MB</span>
                        </div>
                      </div>
                      <span className="text-[10px] font-bold text-purple-600 bg-purple-50 px-2 py-0.5 rounded">
                        Ready
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 6: INTERNAL PRICING (CONFIDENTIAL) */}
            {activeTab === 'pricing' && (
              <div className="space-y-5 animate-in fade-in-50 duration-150">
                <div className="p-4 bg-amber-50 border border-amber-300 rounded-xl flex items-start gap-3">
                  <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <div className="text-xs text-amber-950 space-y-1">
                    <span className="font-bold uppercase tracking-wider block text-amber-900">
                      Confidential Commercial Data &bull; Strictly Internal
                    </span>
                    <p>
                      This internal pricing information (purchase cost, distributor margin, supplier name) is strictly visible to authorized personnel only. <strong>It will NEVER be rendered on the customer quotation, customer preview, or exported PDF.</strong>
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Distributor / Purchase Cost (₹)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={purchaseCost}
                      onChange={(e) => setPurchaseCost(Math.max(0, Number(e.target.value) || 0))}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm font-mono focus:ring-2 focus:ring-amber-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Supplier / Authorized Distributor
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. BenQ India, Sound United"
                      value={supplierName}
                      onChange={(e) => setSupplierName(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs"
                    />
                  </div>
                </div>

                {/* Real-Time Margin Card */}
                <div className="p-4 bg-slate-900 text-white rounded-xl grid grid-cols-3 gap-3 text-center">
                  <div>
                    <span className="text-[10px] text-slate-400 block uppercase font-bold">Selling Price</span>
                    <span className="text-sm font-mono font-black">₹{unitPrice.toLocaleString('en-IN')}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block uppercase font-bold">Gross Margin</span>
                    <span className={`text-sm font-mono font-black ${marginAmt >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      ₹{marginAmt.toLocaleString('en-IN')}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block uppercase font-bold">Margin %</span>
                    <span className={`text-sm font-mono font-black ${marginPct >= 15 ? 'text-emerald-400' : marginPct > 0 ? 'text-amber-400' : 'text-rose-400'}`}>
                      {marginPct.toFixed(1)}%
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Internal Sales Notes</label>
                  <textarea
                    rows={3}
                    value={internalNotes}
                    onChange={(e) => setInternalNotes(e.target.value)}
                    placeholder="Add supplier price validity, payment terms from distributor, or delivery depot notes..."
                    className="w-full p-2.5 border border-slate-300 rounded-xl text-xs"
                  />
                </div>
              </div>
            )}

            {/* Bottom Actions */}
            <div className="pt-4 border-t border-slate-200 flex items-center justify-between sticky bottom-0 bg-white py-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 border border-slate-300 rounded-xl hover:bg-slate-100 transition cursor-pointer"
                data-testid="product-drawer-cancel-btn"
              >
                Cancel
              </button>

              <button
                type="submit"
                className="inline-flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-md shadow-blue-600/20 transition active:scale-95 cursor-pointer"
                data-testid="product-drawer-save-btn"
              >
                <Check className="w-4 h-4" />
                <span>Save to Quotation</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
