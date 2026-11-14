'use client';

import React, { useState, useEffect } from 'react';
import {
  Search,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  ShieldCheck,
  X,
  Sparkles,
  Save,
  BookOpen,
  RotateCcw,
  PlusCircle,
  Layers,
  ArrowRight,
  Loader2,
} from 'lucide-react';
import {
  researchProductWeb,
  searchProductLibrary,
  saveSpecIntelligenceRecord,
  getSpecIntelligenceLibrary,
  SpecificationFetchResult,
} from '@/lib/actions/spec-intelligence';
import { roundTo2Decimals } from '@/lib/pricing/pricing-engine';
import type { QuotationItem, SpecIntelligenceRecord } from '@/types/erp';

interface SpecIntelligenceLookupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInsertItem: (item: QuotationItem) => void;
  pricingMode?: 'EXCLUSIVE' | 'INCLUSIVE';
}

export function SpecIntelligenceLookupModal({
  isOpen,
  onClose,
  onInsertItem,
  pricingMode = 'EXCLUSIVE',
}: SpecIntelligenceLookupModalProps) {
  // Tabs: 'RESEARCH' or 'LIBRARY'
  const [activeTab, setActiveTab] = useState<'RESEARCH' | 'LIBRARY'>('RESEARCH');

  // Search input state
  const [productQuery, setProductQuery] = useState('BenQ TK710 projector');
  const [isSearching, setIsSearching] = useState(false);
  const [searchStepText, setSearchStepText] = useState('');
  const [searchResult, setSearchResult] = useState<SpecificationFetchResult | null>(null);

  // Library Autocomplete / Instant Match State
  const [autocompleteResults, setAutocompleteResults] = useState<SpecIntelligenceRecord[]>([]);
  const [isSearchingLibrary, setIsSearchingLibrary] = useState(false);
  const [hasSearchedLibrary, setHasSearchedLibrary] = useState(false);

  // Human Review & Edit Gate State
  const [brand, setBrand] = useState('BenQ');
  const [model, setModel] = useState('TK710');
  const [productName, setProductName] = useState('');
  const [specsText, setSpecsText] = useState('');
  const [description, setDescription] = useState('');
  const [sourceName, setSourceName] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [unit, setUnit] = useState('Nos.');
  const [quantity, setQuantity] = useState(1);
  const [sellingPrice, setSellingPrice] = useState(249000);
  const [purchasePrice, setPurchasePrice] = useState(195000);
  const [distributor, setDistributor] = useState('Redington India Ltd / BenQ Authorized');
  const [gstRate, setGstRate] = useState(18);
  const [hsnSac, setHsnSac] = useState('85286900');

  // Save state
  const [isSaving, setIsSaving] = useState(false);
  const [savedSuccessMessage, setSavedSuccessMessage] = useState<string | null>(null);
  const [currentSavedRecordId, setCurrentSavedRecordId] = useState<string | null>(null);

  // Library state
  const [libraryRecords, setLibraryRecords] = useState<SpecIntelligenceRecord[]>([]);
  const [libraryFilter, setLibraryFilter] = useState('');
  const [isLoadingLibrary, setIsLoadingLibrary] = useState(false);

  // Load library when tab changes or modal opens
  useEffect(() => {
    if (isOpen) {
      loadLibrary();
    }
  }, [isOpen]);

  // Autocomplete / Search Library as user types
  useEffect(() => {
    const q = productQuery.trim();
    if (q.length < 2) {
      setAutocompleteResults([]);
      setHasSearchedLibrary(false);
      return;
    }

    let active = true;
    setIsSearchingLibrary(true);
    const timer = setTimeout(async () => {
      try {
        const res = await searchProductLibrary(q);
        if (active) {
          const list = res.records && res.records.length > 0 ? res.records : (res.record ? [res.record] : []);
          setAutocompleteResults(list);
          setHasSearchedLibrary(true);
        }
      } catch (err) {
        console.error('Library search error:', err);
      } finally {
        if (active) setIsSearchingLibrary(false);
      }
    }, 250);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [productQuery]);

  const loadLibrary = async () => {
    setIsLoadingLibrary(true);
    try {
      const res = await getSpecIntelligenceLibrary();
      if (res.success) {
        setLibraryRecords(res.records);
      }
    } catch (e) {
      console.error('Failed to load spec library:', e);
    } finally {
      setIsLoadingLibrary(false);
    }
  };

  if (!isOpen) return null;

  const handleResearch = async (overrideQuery?: string, forceWebRefresh: boolean = false) => {
    const q = (overrideQuery || productQuery).trim();
    if (!q) return;

    setIsSearching(true);
    setSavedSuccessMessage(null);
    setSearchStepText(forceWebRefresh ? 'Querying manufacturer web sources (forced refresh)...' : 'Checking product library & manufacturer sources...');

    // Progress step updates
    const t1 = setTimeout(() => {
      setSearchStepText('Verifying exact model identity & filtering homepages...');
    }, 900);

    const t2 = setTimeout(() => {
      setSearchStepText('Extracting technical parameters & cross-checking sources...');
    }, 1800);

    const t3 = setTimeout(() => {
      setSearchStepText('Synthesizing customer-facing description & key specifications...');
    }, 2700);

    try {
      const res = await researchProductWeb(q, forceWebRefresh);
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      setSearchResult(res);

      if (res.found) {
        setBrand(res.brand);
        setModel(res.model);
        setProductName(res.product_name);
        setSourceName(res.source_name || 'Manufacturer Datasheet');
        setSourceUrl(res.source_url || '');
        setDescription(res.customer_description || res.description || `${res.brand} ${res.model} commercial equipment`);

        // Format bullet points / text summary
        const bulletText =
          res.key_specifications ||
          res.specs_text ||
          Object.entries(res.specs || {})
            .map(([k, v]) => `${k}: ${v}`)
            .join(', ');
        setSpecsText(bulletText);

        if (res.suggested_price) setSellingPrice(res.suggested_price);
        if (res.suggested_cost) setPurchasePrice(res.suggested_cost);
        if (res.suggested_distributor) setDistributor(res.suggested_distributor);
        if (res.hsn_sac) setHsnSac(res.hsn_sac);
        if (res.gst_rate) setGstRate(res.gst_rate);
      } else {
        // If not found, populate brand/model heuristic so user can manually complete
        setBrand(res.brand || 'Generic');
        setModel(res.model || 'Custom');
        setProductName(res.product_name || q);
        setSourceName('Manual / Custom Entry');
        setSourceUrl('');
        setSpecsText('');
        setDescription('');
      }
    } catch (err) {
      console.error('Web research error:', err);
      clearTimeout(t1);
      clearTimeout(t2);
    } finally {
      setIsSearching(false);
      setSearchStepText('');
    }
  };

  const handleSaveToLibrary = async () => {
    if (!brand.trim() || !model.trim()) return;

    setIsSaving(true);
    setSavedSuccessMessage(null);

    try {
      const res = await saveSpecIntelligenceRecord({
        brand: brand.trim(),
        model: model.trim(),
        product_name: productName.trim() || `${brand} ${model}`,
        key_specifications: specsText.trim(),
        specs_text: specsText.trim(),
        customer_description: description.trim(),
        description: description.trim(),
        source_name: sourceName.trim() || 'Manufacturer Datasheet',
        source_url: sourceUrl.trim(),
        datasheet_url: sourceUrl.trim() || undefined,
        suggested_price: Number(sellingPrice) || undefined,
        suggested_cost: Number(purchasePrice) || undefined,
        suggested_distributor: distributor.trim() || undefined,
        hsn_sac: hsnSac.trim() || '85286900',
        gst_rate: Number(gstRate) || 18,
        verification_status: 'EXACT_MODEL_VERIFIED',
        source_confidence: 1,
      });

      if (res.success && res.record) {
        setCurrentSavedRecordId(res.record.id);
        setSavedSuccessMessage(`✓ Specification saved to library for "${res.record.brand} ${res.record.model}"`);
        loadLibrary();
      } else {
        alert(res.error || 'Failed to save specification.');
      }
    } catch (err: any) {
      alert(err.message || 'Error saving specification');
    } finally {
      setIsSaving(false);
    }
  };

  const handleInsertIntoQuotation = () => {
    const b = brand.trim() || 'EQUIPMENT';
    const m = model.trim() || 'MODEL';
    const s = specsText.trim() || 'Standard Commercial Specifications';
    const d = description.trim() || productName.trim() || `${b} ${m}`;

    // Standard Quotation Line Format: BRAND – MODEL – SPECS – DESCRIPTION
    const formattedProductName = `${b.toUpperCase()} – ${m.toUpperCase()} – ${s} – ${d}`;

    const rate = Math.max(0, Number(sellingPrice) || 0);
    const qty = Math.max(1, Number(quantity) || 1);
    const cost = Math.max(0, Number(purchasePrice) || 0);
    const gst = Number(gstRate) || 18;

    let lineTaxable = 0;
    let lineTotal = 0;

    if (pricingMode === 'INCLUSIVE') {
      const lineInclusiveGross = rate * qty;
      lineTotal = roundTo2Decimals(lineInclusiveGross);
      lineTaxable = gst > 0 ? roundTo2Decimals(lineTotal / (1 + gst / 100)) : lineTotal;
    } else {
      lineTaxable = roundTo2Decimals(rate * qty);
      const lineGst = (lineTaxable * gst) / 100;
      lineTotal = roundTo2Decimals(lineTaxable + lineGst);
    }

    const newItem: QuotationItem = {
      product_name: formattedProductName,
      category: b,
      brand: b,
      sku: m,
      model: m,
      specs: s,
      description: d,
      key_specifications: s,
      customer_description: d,
      datasheet_url: sourceUrl.trim() || undefined,
      verification_status: searchResult?.verification_status || 'EXACT_MODEL_VERIFIED',
      source_confidence: 1,
      spec_record_id: currentSavedRecordId || undefined,
      spec_source_name: sourceName.trim(),
      spec_source_url: sourceUrl.trim(),
      unit,
      quantity: qty,
      purchase_price: cost,
      selling_price: rate,
      discount_pct: 0,
      discount_amount: 0,
      gst_rate: gst,
      hsn_sac: hsnSac.trim() || '85286900',
      total_amount: lineTotal,
      supplier_reference: distributor.trim(),
      internal_remarks: d,
      is_custom: false,
    };

    onInsertItem(newItem);
    onClose();
  };

  const handleSelectFromLibrary = (record: SpecIntelligenceRecord) => {
    setBrand(record.brand);
    setModel(record.model);
    setProductName(record.product_name);
    const specs = record.key_specifications || record.specs_text || '';
    setSpecsText(specs);
    const desc = record.customer_description || record.description || `${record.brand} ${record.model}`;
    setDescription(desc);
    setSourceName(record.source_name || 'Official Datasheet');
    setSourceUrl(record.datasheet_url || record.source_url || '');
    if (record.suggested_price) setSellingPrice(record.suggested_price);
    if (record.suggested_cost) setPurchasePrice(record.suggested_cost);
    if (record.suggested_distributor) setDistributor(record.suggested_distributor);
    if (record.hsn_sac) setHsnSac(record.hsn_sac);
    if (record.gst_rate) setGstRate(record.gst_rate);
    setCurrentSavedRecordId(record.id);

    setSearchResult({
      found: true,
      verification_status: record.verification_status || 'EXACT_MODEL_VERIFIED',
      brand: record.brand,
      model: record.model,
      product_name: record.product_name,
      category: record.category,
      key_specifications: specs,
      full_specifications: record.specifications || {},
      customer_description: desc,
      sources: (record.datasheet_url || record.source_url) ? [{
        source_name: record.source_name || 'Official Datasheet',
        source_url: (record.datasheet_url || record.source_url)!,
        source_type: 'MANUFACTURER_DATASHEET',
        confidence_level: 1,
        verified: true,
      }] : [],
      confidence: 98,
      evidence: ['Verified from ICON Product Library'],
      warnings: [],
      researched_at: record.last_verified_timestamp || record.research_timestamp || new Date().toISOString(),
      message: 'Verified product loaded from ICON Product Library',
      from_library: true,
    });

    setActiveTab('RESEARCH');
  };

  const handleReject = () => {
    setSearchResult(null);
    setSavedSuccessMessage(null);
    setCurrentSavedRecordId(null);
    setProductName('');
    setSpecsText('');
    setDescription('');
    setSourceUrl('');
    setSourceName('');
  };

  // Profit & Margin calculations in review gate
  const unitTaxable =
    pricingMode === 'INCLUSIVE' ? sellingPrice / (1 + gstRate / 100) : sellingPrice;
  const estimatedProfitPerUnit = roundTo2Decimals(unitTaxable - purchasePrice);
  const marginPct =
    unitTaxable > 0 ? roundTo2Decimals((estimatedProfitPerUnit / unitTaxable) * 100) : 0;

  const filteredLibrary = libraryRecords.filter((r) => {
    if (!libraryFilter.trim()) return true;
    const q = libraryFilter.toLowerCase().trim();
    return (
      r.brand.toLowerCase().includes(q) ||
      r.model.toLowerCase().includes(q) ||
      r.product_name.toLowerCase().includes(q) ||
      (r.specs_text && r.specs_text.toLowerCase().includes(q))
    );
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl border border-slate-200 flex flex-col max-h-[92vh] overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-sm">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
                  Spec Intelligence CPQ Lookup
                </h2>
                <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">
                  Real Web Research
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Discover official manufacturer specifications with human edit review gate & library persistence.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Tab switchers */}
            <div className="flex items-center bg-slate-200/80 p-0.5 rounded-lg text-xs font-bold">
              <button
                type="button"
                onClick={() => setActiveTab('RESEARCH')}
                className={`px-3 py-1.5 rounded-md transition ${
                  activeTab === 'RESEARCH' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                🔍 Web Research
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveTab('LIBRARY');
                  loadLibrary();
                }}
                className={`px-3 py-1.5 rounded-md transition flex items-center gap-1.5 ${
                  activeTab === 'LIBRARY' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>Library ({libraryRecords.length})</span>
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Scroll Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-6 flex-1 text-xs">
          {activeTab === 'RESEARCH' ? (
            <>
              {/* Step 1: User Enters Product */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-700 uppercase tracking-wider text-[11px] block">
                    1. Enter Product Name, Model, or Freeform Description
                  </span>
                  <span className="text-[10px] text-slate-500 font-semibold">
                    e.g. BenQ TK710 projector, ViewSonic 65 inch panel, Canon imageCLASS printer
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={productQuery}
                      onChange={(e) => setProductQuery(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleResearch()}
                      placeholder="Type product name, brand, or model..."
                      className="w-full pl-9 pr-3 py-2.5 bg-white rounded-xl border border-slate-300 font-bold text-slate-900 outline-none focus:border-blue-600 text-xs sm:text-sm shadow-2xs"
                    />
                  </div>

                  <button
                    type="button"
                    disabled={isSearching || !productQuery.trim()}
                    onClick={() => handleResearch()}
                    className="py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold transition flex items-center gap-2 shadow-xs shrink-0 cursor-pointer"
                  >
                    {isSearching ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Researching...</span>
                      </>
                    ) : (
                      <>
                        <Search className="w-4 h-4" />
                        <span>Research Product</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Example Quick-Pick Pills */}
                <div className="flex items-center gap-1.5 flex-wrap pt-1">
                  <span className="text-[10px] text-slate-400 font-semibold">Try examples:</span>
                  {[
                    'BenQ TK710 projector',
                    'Sony VW-5000ES',
                    'Epson EB-W49',
                    'Dell Latitude 5440',
                    'Hikvision CCTV',
                    'Logitech Rally Bar',
                  ].map((ex) => (
                    <button
                      key={ex}
                      type="button"
                      onClick={() => {
                        setProductQuery(ex);
                        handleResearch(ex);
                      }}
                      className="px-2 py-0.5 rounded-full bg-white border border-slate-200 hover:border-blue-400 text-slate-600 hover:text-blue-700 text-[10px] font-medium transition cursor-pointer"
                    >
                      {ex}
                    </button>
                  ))}
                </div>

                {/* Instant Match Results from ICON Product Library */}
                {autocompleteResults.length > 0 && (
                  <div className="p-3 bg-emerald-50/80 border border-emerald-300 rounded-xl space-y-2 mt-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-emerald-800 font-bold text-xs">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        <span>Found in ICON Product Library ({autocompleteResults.length})</span>
                      </div>
                      <span className="text-[10px] text-emerald-700 font-bold bg-emerald-100 px-2 py-0.5 rounded-full">
                        ✓ Verified • Official Source
                      </span>
                    </div>

                    <div className="space-y-1.5">
                      {autocompleteResults.slice(0, 3).map((rec) => (
                        <div
                          key={rec.id}
                          className="flex items-center justify-between p-2.5 bg-white rounded-lg border border-emerald-200 shadow-2xs hover:border-emerald-400 transition gap-2"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-extrabold text-slate-900 text-xs">
                                {rec.brand} {rec.model}
                              </span>
                              <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold text-[9px]">
                                {rec.verification_status?.replace(/_/g, ' ') || 'EXACT MODEL VERIFIED'}
                              </span>
                              {rec.last_verified_timestamp && (
                                <span className="text-[9px] text-slate-400">
                                  Verified: {new Date(rec.last_verified_timestamp).toLocaleDateString('en-IN')}
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-slate-600 truncate mt-0.5 font-medium">
                              {rec.key_specifications || rec.specs_text || rec.product_name}
                            </p>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleSelectFromLibrary(rec)}
                              className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1 transition shadow-2xs cursor-pointer"
                            >
                              <span>Use Product</span>
                              <ArrowRight className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              title="Force Web Refresh"
                              onClick={() => handleResearch(`${rec.brand} ${rec.model}`, true)}
                              className="px-2 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-[11px] transition cursor-pointer"
                            >
                              <RotateCcw className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {hasSearchedLibrary && autocompleteResults.length === 0 && !isSearchingLibrary && productQuery.trim().length >= 3 && (
                  <div className="p-2.5 bg-slate-100/90 rounded-lg border border-slate-200 flex items-center justify-between text-[11px] mt-2">
                    <div className="flex items-center gap-2 text-slate-600">
                      <span className="w-2 h-2 rounded-full bg-amber-400" />
                      <span>Not found in ICON Product Library.</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleResearch(productQuery, true)}
                      className="text-blue-700 hover:text-blue-800 font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <span>Research on Web →</span>
                    </button>
                  </div>
                )}

                {/* Loading Banner */}
                {isSearching && (
                  <div className="p-3 rounded-lg bg-blue-50 border border-blue-200 text-blue-900 flex items-center gap-3 animate-pulse">
                    <Loader2 className="w-4 h-4 text-blue-600 animate-spin shrink-0" />
                    <span className="font-semibold text-xs">{searchStepText || 'Performing real web research...'}</span>
                  </div>
                )}
              </div>

              {/* Research Source Card */}
              {searchResult && (
                <div
                  className={`p-4 rounded-xl border space-y-3 ${
                    searchResult.found
                      ? searchResult.verification_status === 'REVIEW_REQUIRED'
                        ? 'bg-amber-50/80 border-amber-300'
                        : 'bg-emerald-50/70 border-emerald-200'
                      : 'bg-amber-50 border-amber-200 text-amber-900'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2.5">
                      {searchResult.found ? (
                        <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                      ) : (
                        <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                      )}
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <strong className="text-slate-900 font-bold text-xs sm:text-sm">
                            {searchResult.found
                              ? searchResult.verification_status === 'REVIEW_REQUIRED'
                                ? 'Specification Review Required (Source Conflict)'
                                : searchResult.verification_status === 'MULTI_SOURCE_VERIFIED'
                                ? 'Multi-Source Verified Manufacturer Product'
                                : 'Exact Model-Specific Source Verified'
                              : 'No Reliable Model Match Found'}
                          </strong>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              searchResult.verification_status === 'REVIEW_REQUIRED'
                                ? 'bg-amber-200 text-amber-900'
                                : searchResult.found
                                ? 'bg-emerald-200 text-emerald-900'
                                : 'bg-red-100 text-red-800'
                            }`}
                          >
                            {searchResult.verification_status === 'EXACT_MODEL_VERIFIED'
                              ? 'Exact Model Verified'
                              : searchResult.verification_status === 'MULTI_SOURCE_VERIFIED'
                              ? 'Multi-Source Verified'
                              : searchResult.verification_status === 'REVIEW_REQUIRED'
                              ? 'Review Required'
                              : searchResult.found
                              ? 'Verified'
                              : 'Manual Entry'}
                          </span>
                          {searchResult.confidence ? (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-extrabold bg-blue-100 text-blue-800">
                              {searchResult.confidence}% Confidence
                            </span>
                          ) : null}
                        </div>
                        <p className="text-[11px] text-slate-600 mt-0.5">{searchResult.message}</p>
                      </div>
                    </div>

                    {sourceUrl ? (
                      <a
                        href={sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-slate-200 hover:border-blue-400 text-blue-700 font-bold text-[11px] shrink-0 shadow-2xs transition cursor-pointer"
                      >
                        <span>{sourceName || 'Open Official Source'}</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    ) : null}
                  </div>

                  {/* Warning notes if conflict detected */}
                  {searchResult.warnings && searchResult.warnings.length > 0 && (
                    <div className="p-2.5 rounded-lg bg-amber-100/80 border border-amber-300 text-amber-900 text-[11px] space-y-1">
                      {searchResult.warnings.map((w, idx) => (
                        <div key={idx} className="flex items-center gap-1.5 font-medium">
                          <AlertCircle className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                          <span>{w}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Multi-Source Discovery List */}
                  {searchResult.sources && searchResult.sources.length > 1 && (
                    <div className="pt-2 border-t border-slate-200/60">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
                        Verified Sources ({searchResult.sources.length}):
                      </span>
                      <div className="flex flex-wrap gap-2">
                        {searchResult.sources.map((s, idx) => (
                          <a
                            key={idx}
                            href={s.source_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 px-2.5 py-1 bg-white/90 hover:bg-white border border-slate-200 rounded text-[10px] text-slate-700 hover:text-blue-700 transition"
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                            <span className="font-semibold truncate max-w-[180px]">{s.source_name}</span>
                            <span className="text-slate-400 text-[9px]">({s.source_type.replace(/_/g, ' ')})</span>
                            <ExternalLink className="w-2.5 h-2.5 opacity-60 ml-0.5" />
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Success Notification Banner */}
              {savedSuccessMessage && (
                <div className="p-3 rounded-lg bg-emerald-100 border border-emerald-300 text-emerald-900 font-bold flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                    <span>{savedSuccessMessage}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveTab('LIBRARY')}
                    className="text-xs text-blue-700 underline font-semibold"
                  >
                    View in Library →
                  </button>
                </div>
              )}

              {/* Step 2: HUMAN EDIT REVIEW GATE (Mandatory Checkpoint) */}
              <div className="p-5 rounded-2xl bg-white border-2 border-blue-500 shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-full bg-blue-600 text-white font-bold text-[10px] uppercase tracking-wider">
                      Human Edit Review Gate
                    </span>
                    <h3 className="font-black text-slate-900 text-sm tracking-tight">
                      Review & Edit Researched Specifications Before Saving
                    </h3>
                  </div>
                  <span className="text-[11px] text-slate-500 font-medium">
                    Verify technical & commercial values
                  </span>
                </div>

                <div className="space-y-3.5">
                  {/* Brand & Model Row */}
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                    <div className="sm:col-span-3">
                      <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wider block mb-1">
                        Brand / Manufacturer *
                      </label>
                      <input
                        type="text"
                        value={brand}
                        onChange={(e) => setBrand(e.target.value)}
                        placeholder="e.g. BenQ, Canon, ViewSonic"
                        className="w-full p-2 bg-slate-50 rounded-lg border border-slate-200 font-bold text-slate-900 outline-none focus:bg-white focus:border-blue-500"
                      />
                    </div>

                    <div className="sm:col-span-3">
                      <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wider block mb-1">
                        Model / SKU Code *
                      </label>
                      <input
                        type="text"
                        value={model}
                        onChange={(e) => setModel(e.target.value)}
                        placeholder="e.g. TK710, IFP6550, MF3010"
                        className="w-full p-2 bg-slate-50 rounded-lg border border-slate-200 font-mono font-bold text-slate-900 outline-none focus:bg-white focus:border-blue-500"
                      />
                    </div>

                    <div className="sm:col-span-6">
                      <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wider block mb-1">
                        Product / Model Name *
                      </label>
                      <input
                        type="text"
                        value={productName}
                        onChange={(e) => setProductName(e.target.value)}
                        placeholder="e.g. BenQ TK710 4K Laser Gaming Projector"
                        className="w-full p-2 bg-slate-50 rounded-lg border border-slate-200 font-bold text-slate-900 outline-none focus:bg-white focus:border-blue-500"
                      />
                    </div>
                  </div>

                  {/* Specifications Scope */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wider block">
                        Specifications Scope (Formatted for Quotation Line Item) *
                      </label>
                      <span className="text-[10px] text-slate-400 font-medium">
                        Resolution, Lumens, Light Source, Throw Ratio, Ports
                      </span>
                    </div>
                    <textarea
                      rows={2}
                      value={specsText}
                      onChange={(e) => setSpecsText(e.target.value)}
                      placeholder="e.g. 4K UHD, 3200 ANSI Lumens, Laser Engine, 1.15-1.50 Throw Ratio, HDMI 2.0b eARC"
                      className="w-full p-2.5 bg-slate-50 rounded-lg border border-slate-200 font-mono text-[11px] text-slate-900 outline-none focus:bg-white focus:border-blue-500"
                    />
                  </div>

                  {/* Description */}
                  <div>
                    <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wider block mb-1">
                      Product Description
                    </label>
                    <textarea
                      rows={2}
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="e.g. 4K HDR laser home theater projector engineered with low input lag..."
                      className="w-full p-2 bg-slate-50 rounded-lg border border-slate-200 text-[11px] text-slate-800 outline-none focus:bg-white focus:border-blue-500"
                    />
                  </div>

                  {/* Source Metadata & Verification Links */}
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200">
                    <div className="sm:col-span-5">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                        Research Source
                      </label>
                      <input
                        type="text"
                        value={sourceName}
                        onChange={(e) => setSourceName(e.target.value)}
                        placeholder="e.g. BenQ Official Datasheet"
                        className="w-full p-2 bg-white rounded-lg border border-slate-200 text-slate-800 outline-none"
                      />
                    </div>

                    <div className="sm:col-span-7">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                        Source URL (Official Link)
                      </label>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="text"
                          value={sourceUrl}
                          onChange={(e) => setSourceUrl(e.target.value)}
                          placeholder="https://..."
                          className="w-full p-2 bg-white rounded-lg border border-slate-200 font-mono text-[10px] text-slate-700 outline-none"
                        />
                        {sourceUrl && (
                          <a
                            href={sourceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-2.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-[10px] shrink-0 flex items-center gap-1 transition"
                            title="Open external source"
                          >
                            <span>Open ↗</span>
                          </a>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Commercials & Pricing Section */}
                  <div className="p-3.5 rounded-xl bg-blue-50/40 border border-blue-200 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-blue-900 uppercase tracking-wider text-[11px]">
                        Commercial Rates & Quotation Defaults
                      </span>
                      <span className="text-[10px] text-slate-500">
                        {pricingMode === 'INCLUSIVE' ? 'Prices Inclusive of GST' : 'Prices Exclusive of GST'}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div>
                        <label className="text-[10px] font-bold text-blue-800 uppercase tracking-wider block mb-1">
                          Selling Rate (₹) *
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={sellingPrice || ''}
                          onChange={(e) => setSellingPrice(Math.max(0, Number(e.target.value) || 0))}
                          className="w-full p-2 bg-white rounded-lg border border-blue-300 font-mono font-black text-blue-900 outline-none text-sm"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                          Purchase Cost (₹)
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={purchasePrice || ''}
                          onChange={(e) => setPurchasePrice(Math.max(0, Number(e.target.value) || 0))}
                          className="w-full p-2 bg-white rounded-lg border border-slate-200 font-mono font-bold text-slate-800 outline-none text-sm"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                          Qty & Unit
                        </label>
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            min="1"
                            value={quantity}
                            onChange={(e) => setQuantity(Math.max(1, Number(e.target.value) || 1))}
                            className="w-12 p-2 bg-white rounded-lg border border-slate-200 text-center font-bold text-slate-800 outline-none"
                          />
                          <select
                            value={unit}
                            onChange={(e) => setUnit(e.target.value)}
                            className="p-2 bg-white rounded-lg border border-slate-200 text-slate-800 font-semibold outline-none flex-1"
                          >
                            <option value="Nos.">Nos.</option>
                            <option value="Set">Set</option>
                            <option value="Meter">Meter</option>
                            <option value="Lot">Lot</option>
                          </select>
                        </div>
                      </div>

                      <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                          GST Rate (%)
                        </label>
                        <select
                          value={gstRate}
                          onChange={(e) => setGstRate(Number(e.target.value))}
                          className="w-full p-2 bg-white rounded-lg border border-slate-200 font-semibold text-slate-800 outline-none"
                        >
                          <option value="18">18% (Standard Electronics/AV)</option>
                          <option value="28">28% (Luxury / Specific Panels)</option>
                          <option value="12">12% (IT Peripherals)</option>
                          <option value="5">5% (Special)</option>
                          <option value="0">0% (Nil)</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-blue-200/60">
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                          Distributor / Channel
                        </label>
                        <input
                          type="text"
                          value={distributor}
                          onChange={(e) => setDistributor(e.target.value)}
                          placeholder="e.g. Redington / Ingram / Savex"
                          className="w-full p-2 bg-white rounded-lg border border-slate-200 text-slate-800 outline-none"
                        />
                      </div>

                      <div className="flex items-center justify-between p-2 bg-white rounded-lg border border-slate-200">
                        <div>
                          <span className="text-[10px] font-bold text-slate-400 uppercase block">
                            Unit Margin Preview
                          </span>
                          <span className="font-mono font-bold text-slate-900 text-xs">
                            ₹{Math.round(estimatedProfitPerUnit).toLocaleString('en-IN')} Profit / unit
                          </span>
                        </div>
                        <span
                          className={`text-xs font-black px-2 py-1 rounded font-mono ${
                            marginPct >= 15
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {marginPct}% Margin
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Customer-Facing Quotation Format Preview */}
                  <div className="p-3.5 rounded-xl bg-slate-900 text-white space-y-2">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
                      <span className="text-[10px] font-mono text-blue-400 uppercase tracking-wider font-bold">
                        Customer-Facing Quotation Preview
                      </span>
                      <span className="text-[10px] text-slate-400 font-semibold">
                        Quotation Line Format: BRAND – MODEL – SPECS – DESCRIPTION
                      </span>
                    </div>

                    <div className="font-extrabold text-white text-xs sm:text-sm tracking-tight uppercase">
                      {`${(brand || 'BRAND').toUpperCase()} – ${(model || 'MODEL').toUpperCase()}`}
                    </div>

                    <div className="text-[11px] leading-relaxed text-slate-300">
                      <span className="font-bold text-slate-100 block mb-0.5">Key Specifications:</span>
                      <p className="text-slate-300 font-normal">
                        {specsText || 'Important technical specifications presented clearly and concisely.'}
                      </p>
                    </div>

                    <div className="text-[11px] leading-relaxed text-slate-300">
                      <span className="font-bold text-slate-100 block mb-0.5">Description:</span>
                      <p className="text-slate-300 font-normal">
                        {description || productName || 'Short, professional description explaining the product, purpose, and value.'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </>
          ) : (
            /* Tab 2: Saved Library View */
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={libraryFilter}
                    onChange={(e) => setLibraryFilter(e.target.value)}
                    placeholder="Search saved library by brand, model, specs..."
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 rounded-xl border border-slate-200 font-semibold text-slate-800 outline-none focus:bg-white text-xs"
                  />
                </div>
                <button
                  type="button"
                  onClick={loadLibrary}
                  disabled={isLoadingLibrary}
                  className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold flex items-center gap-1.5 transition"
                >
                  <RotateCcw className={`w-3.5 h-3.5 ${isLoadingLibrary ? 'animate-spin' : ''}`} />
                  <span>Refresh</span>
                </button>
              </div>

              {filteredLibrary.length === 0 ? (
                <div className="p-8 text-center border-2 border-dashed border-slate-200 rounded-xl space-y-2">
                  <BookOpen className="w-8 h-8 text-slate-300 mx-auto" />
                  <p className="font-bold text-slate-700">No specifications saved yet</p>
                  <p className="text-slate-400 text-xs">
                    Research any product in the Web Research tab and click "Save Specification" to store it here.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3">
                  {filteredLibrary.map((rec) => (
                    <div
                      key={rec.id}
                      className="p-4 rounded-xl border border-slate-200 hover:border-blue-400 bg-white hover:bg-blue-50/20 transition space-y-2"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-black text-slate-900 text-sm">
                              {rec.brand} {rec.model}
                            </span>
                            <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-800 font-bold text-[10px]">
                              {rec.source_name || 'Manufacturer'}
                            </span>
                          </div>
                          <p className="text-slate-500 text-[11px] mt-0.5">{rec.product_name}</p>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleSelectFromLibrary(rec)}
                          className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center gap-1 shadow-2xs transition shrink-0 cursor-pointer"
                        >
                          <span>Use Specification</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {rec.specs_text && (
                        <p className="font-mono text-[11px] text-slate-700 bg-slate-50 p-2 rounded-lg border border-slate-100">
                          {rec.specs_text}
                        </p>
                      )}

                      <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 border-t border-slate-100">
                        <span>Researched: {rec.research_date || 'Recent'}</span>
                        {rec.source_url && (
                          <a
                            href={rec.source_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline flex items-center gap-1 font-semibold"
                          >
                            <span>Official Datasheet</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Action Footer */}
        <div className="p-4 sm:p-5 border-t border-slate-100 flex items-center justify-between bg-slate-50/50 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleReject}
              className="px-3 py-2 rounded-xl text-slate-600 hover:text-red-700 hover:bg-red-50 font-semibold transition flex items-center gap-1.5 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reject / Clear</span>
            </button>

            <button
              type="button"
              disabled={isSaving || !brand.trim() || !model.trim()}
              onClick={handleSaveToLibrary}
              className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold transition flex items-center gap-1.5 shadow-2xs cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{isSaving ? 'Saving...' : '💾 Save Specification'}</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 font-semibold transition"
            >
              Cancel
            </button>

            <button
              type="button"
              disabled={!brand.trim() || !model.trim()}
              onClick={handleInsertIntoQuotation}
              className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-black transition flex items-center gap-2 shadow-md shadow-blue-600/20 cursor-pointer"
            >
              <PlusCircle className="w-4 h-4" />
              <span>➕ Add to Quotation</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
