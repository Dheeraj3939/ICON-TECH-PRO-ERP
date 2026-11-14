'use client';

import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Sparkles,
  X,
  Search,
  CheckCircle2,
  Cpu,
  ArrowRight,
  Plus,
  Trash2,
  ShieldCheck,
  AlertCircle,
  HelpCircle,
} from 'lucide-react';
import {
  AI_RESEARCH_PRESETS,
  DemoProductSpecification,
  DemoQuotationItem,
} from './demo-data';

interface DemoAIResearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddItem: (item: DemoQuotationItem) => void;
  currentSectionId?: string;
}

export function DemoAIResearchModal({
  isOpen,
  onClose,
  onAddItem,
  currentSectionId = 'PRODUCTS & SERVICES',
}: DemoAIResearchModalProps) {
  const [brandInput, setBrandInput] = useState('');
  const [modelInput, setModelInput] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [researchStep, setResearchStep] = useState<string>('');
  const [researchedItem, setResearchedItem] = useState<{
    brand: string;
    model: string;
    product_name: string;
    category: string;
    hsn_sac: string;
    unit_price: number;
    purchase_cost: number;
    supplier_name: string;
    specifications: DemoProductSpecification[];
    customer_description: string;
    short_highlights: string[];
  } | null>(null);

  if (!isOpen) return null;

  function loadPreset(key: string) {
    const preset = AI_RESEARCH_PRESETS[key];
    if (preset) {
      setBrandInput(preset.brand);
      setModelInput(preset.model);
    }
  }

  async function handleStartResearch(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (!brandInput.trim() || !modelInput.trim()) return;

    setIsSearching(true);
    setResearchedItem(null);

    // Multi-stage realistic simulation
    setResearchStep('Connecting to AI Product Intelligence...');
    await new Promise((r) => setTimeout(r, 400));

    setResearchStep(`Analyzing manufacturer datasheet for ${brandInput} ${modelInput}...`);
    await new Promise((r) => setTimeout(r, 600));

    setResearchStep('Extracting verified technical specifications...');
    await new Promise((r) => setTimeout(r, 500));

    setResearchStep('Synthesizing customer-facing proposal description & highlights...');
    await new Promise((r) => setTimeout(r, 500));

    // Check if matching preset exists
    const query = `${brandInput}-${modelInput}`.toLowerCase().replace(/[^a-z0-9]/g, '');
    let matchedData = null;

    for (const [k, v] of Object.entries(AI_RESEARCH_PRESETS)) {
      const normalizedK = k.replace(/[^a-z0-9]/g, '');
      if (
        query.includes(normalizedK) ||
        normalizedK.includes(query) ||
        v.model.toLowerCase().includes(modelInput.toLowerCase())
      ) {
        matchedData = v;
        break;
      }
    }

    if (!matchedData) {
      // Generate dynamic realistic specifications
      matchedData = {
        brand: brandInput.trim(),
        model: modelInput.trim(),
        product_name: `${brandInput.trim()} ${modelInput.trim()} Professional AV System`,
        category: 'Audio Visual',
        hsn_sac: '85285200',
        unit_price: 95000,
        purchase_cost: 72000,
        supplier_name: `${brandInput.trim()} India Distribution Channel`,
        specifications: [
          { key: 'Technology', value: 'High Performance Professional Grade' },
          { key: 'Resolution / Capacity', value: 'Ultra HD Standard Reference' },
          { key: 'Connectivity', value: 'HDMI 2.1, RS-232, IP Control' },
          { key: 'Compliance', value: 'BIS / CE / RoHS Certified' },
        ],
        customer_description: `Professional-grade ${brandInput} ${modelInput} engineered for high-reliability commercial and residential integration, offering precision performance, robust interconnectivity, and turnkey compatibility with modern AV automation protocols.`,
        short_highlights: [
          'High Reliability Architecture',
          'Professional Integration Ready',
          'IP & RS-232 Control',
          'Full Manufacturer Warranty',
        ],
      };
    }

    setResearchedItem(JSON.parse(JSON.stringify(matchedData)));
    setIsSearching(false);
    setResearchStep('');
  }

  function handleSpecChange(index: number, key: string, value: string) {
    if (!researchedItem) return;
    const next = [...researchedItem.specifications];
    next[index] = { key, value };
    setResearchedItem({ ...researchedItem, specifications: next });
  }

  function handleAddSpecRow() {
    if (!researchedItem) return;
    setResearchedItem({
      ...researchedItem,
      specifications: [...researchedItem.specifications, { key: '', value: '' }],
    });
  }

  function handleDeleteSpecRow(index: number) {
    if (!researchedItem) return;
    setResearchedItem({
      ...researchedItem,
      specifications: researchedItem.specifications.filter((_, i) => i !== index),
    });
  }

  function handleCommitItem() {
    if (!researchedItem) return;

    const newItem: DemoQuotationItem = {
      id: `item-ai-${Date.now()}`,
      brand: researchedItem.brand,
      model: researchedItem.model,
      product_name: researchedItem.product_name,
      category: researchedItem.category,
      hsn_sac: researchedItem.hsn_sac,
      unit: 'Nos',
      quantity: 1,
      unit_price: researchedItem.unit_price,
      gst_rate: 18,
      discount: 0,
      section_id: currentSectionId,
      is_dynamic: true,
      warranty: '2 Years Manufacturer Warranty',
      specifications: researchedItem.specifications.filter((s) => s.key && s.value),
      customer_description: researchedItem.customer_description,
      short_highlights: researchedItem.short_highlights,
      purchase_cost: researchedItem.purchase_cost,
      supplier_name: researchedItem.supplier_name,
      internal_notes: 'Synthesized via AI Product Research Agent and approved by estimator.',
    };

    onAddItem(newItem);
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4 animate-in fade-in"
      role="dialog"
      aria-modal="true"
      data-testid="ai-research-modal"
    >
      <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center text-white shadow-md">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                AI Product Research Agent
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  Instant Specs & Highlights
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Researches technical datasheets, specifications, and synthesizes customer-facing proposal copy.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-6 overflow-y-auto flex-1 text-slate-200">
          {/* Query Inputs */}
          <form onSubmit={handleStartResearch} className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Brand Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. BenQ, Denon, Poly, SVS, Polk Audio"
                  value={brandInput}
                  onChange={(e) => setBrandInput(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3.5 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Model Number / Keyword
                </label>
                <input
                  type="text"
                  placeholder="e.g. TK710, AVR-X3800H, Studio X50, SB-3000"
                  value={modelInput}
                  onChange={(e) => setModelInput(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3.5 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                  required
                />
              </div>
            </div>

            {/* Quick Presets */}
            <div className="flex items-center gap-2 pt-1 text-xs">
              <span className="text-slate-400 font-medium">Quick Demo Presets:</span>
              <button
                type="button"
                onClick={() => loadPreset('benq-tk710')}
                className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-indigo-300 border border-slate-700 text-xs font-medium transition"
              >
                BenQ TK710
              </button>
              <button
                type="button"
                onClick={() => loadPreset('denon-x3800h')}
                className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-indigo-300 border border-slate-700 text-xs font-medium transition"
              >
                Denon AVR-X3800H
              </button>
              <button
                type="button"
                onClick={() => loadPreset('poly-studio-x50')}
                className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-indigo-300 border border-slate-700 text-xs font-medium transition"
              >
                Poly Studio X50
              </button>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={isSearching || !brandInput.trim() || !modelInput.trim()}
                className="w-full py-2.5 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium text-sm flex items-center justify-center gap-2 shadow-lg transition"
                data-testid="ai-research-submit-btn"
              >
                {isSearching ? (
                  <>
                    <Cpu className="w-4 h-4 animate-spin text-indigo-200" />
                    <span>{researchStep || 'Researching...'}</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Run AI Technical Research</span>
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Research Results / Human Review Gate */}
          {researchedItem && (
            <div className="space-y-5 pt-4 border-t border-slate-800 animate-in fade-in" data-testid="ai-research-results">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  Mandatory Human Review Gate — Verify & Edit Before Adding
                </span>
                <span className="text-[11px] text-slate-400">
                  Target Section: <span className="font-semibold text-slate-200">{currentSectionId}</span>
                </span>
              </div>

              {/* Basic Identified Info */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-slate-800/80 p-3.5 rounded-lg border border-slate-700">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block">Brand</span>
                  <span className="text-xs font-bold text-white">{researchedItem.brand}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block">Model</span>
                  <span className="text-xs font-bold text-white">{researchedItem.model}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block">Selling Price (₹)</span>
                  <input
                    type="number"
                    value={researchedItem.unit_price}
                    onChange={(e) =>
                      setResearchedItem({
                        ...researchedItem,
                        unit_price: Number(e.target.value) || 0,
                      })
                    }
                    className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-0.5 text-xs text-white font-mono"
                  />
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block">HSN/SAC</span>
                  <input
                    type="text"
                    value={researchedItem.hsn_sac}
                    onChange={(e) =>
                      setResearchedItem({
                        ...researchedItem,
                        hsn_sac: e.target.value,
                      })
                    }
                    className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-0.5 text-xs text-white font-mono"
                  />
                </div>
              </div>

              {/* Customer Description (Mandatory) */}
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1 flex items-center justify-between">
                  <span>Mandatory Customer Description (Will appear in Quotation)</span>
                  <span className="text-[10px] text-indigo-400 font-normal">AI Synthesized • Client Facing</span>
                </label>
                <textarea
                  rows={3}
                  value={researchedItem.customer_description}
                  onChange={(e) =>
                    setResearchedItem({
                      ...researchedItem,
                      customer_description: e.target.value,
                    })
                  }
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-3 text-xs text-slate-100 focus:outline-none focus:border-indigo-500 leading-relaxed"
                />
              </div>

              {/* Key Specifications (Editable Table) */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                    Extracted Specifications ({researchedItem.specifications.length} keys)
                  </label>
                  <button
                    type="button"
                    onClick={handleAddSpecRow}
                    className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-medium"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Key
                  </button>
                </div>
                <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
                  {researchedItem.specifications.map((spec, sIdx) => (
                    <div key={sIdx} className="flex items-center gap-2">
                      <input
                        type="text"
                        placeholder="Feature / Key"
                        value={spec.key}
                        onChange={(e) => handleSpecChange(sIdx, e.target.value, spec.value)}
                        className="w-1/3 bg-slate-800 border border-slate-700 rounded px-2.5 py-1 text-xs text-slate-200"
                      />
                      <input
                        type="text"
                        placeholder="Value"
                        value={spec.value}
                        onChange={(e) => handleSpecChange(sIdx, spec.key, e.target.value)}
                        className="flex-1 bg-slate-800 border border-slate-700 rounded px-2.5 py-1 text-xs text-slate-200 font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => handleDeleteSpecRow(sIdx)}
                        className="p-1 text-slate-500 hover:text-rose-400"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Internal Confidential Cost Preview (Estimator Eyes Only) */}
              <div className="bg-amber-950/30 border border-amber-800/40 rounded-lg p-3 text-xs flex items-center justify-between text-amber-200">
                <div className="space-y-0.5">
                  <span className="font-bold flex items-center gap-1 text-[11px] uppercase tracking-wide">
                    <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
                    Internal Purchase Cost (Estimator Confidential)
                  </span>
                  <p className="text-[11px] text-amber-300/80">
                    Est. Purchase: <span className="font-mono font-bold">₹{researchedItem.purchase_cost.toLocaleString('en-IN')}</span> | Supplier: {researchedItem.supplier_name}
                  </p>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded bg-amber-900/60 text-amber-300 font-semibold border border-amber-700/50">
                  Hidden from Client
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-3.5 bg-slate-950 border-t border-slate-800 flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition"
          >
            Cancel
          </button>

          {researchedItem && (
            <button
              onClick={handleCommitItem}
              className="px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-2 shadow-lg transition"
              data-testid="ai-research-add-to-quote-btn"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Add Verified Product to Quotation</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
