'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Package, Plus, Search, Filter, AlertTriangle, CheckCircle2, Tag, Download, UploadCloud, Sparkles, FileText, Check, X, Pencil } from 'lucide-react';
import { getProducts, getProductCategories, createProduct, canViewProductCosts } from '@/lib/actions/products';
import { fetchProductSpecs, approveProductSpecs } from '@/lib/actions/spec-intelligence';
import { exportToCSV } from '@/lib/utils/export';
import type { Product } from '@/types/erp';
import EditProductModal from '@/components/modals/EditProductModal';

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [search, setSearch] = useState('');
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [canViewCost, setCanViewCost] = useState(false);

  // Spec Intelligence Modal State
  const [isSpecModalOpen, setIsSpecModalOpen] = useState(false);
  const [specTargetProduct, setSpecTargetProduct] = useState<Product | null>(null);
  const [specBrand, setSpecBrand] = useState('');
  const [specModel, setSpecModel] = useState('');
  const [specCategory, setSpecCategory] = useState('');
  const [isFetchingSpecs, setIsFetchingSpecs] = useState(false);
  const [specResult, setSpecResult] = useState<any | null>(null);

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [newProduct, setNewProduct] = useState({
    sku: '',
    name: '',
    category_name: 'Projector',
    brand_name: 'Epson',
    unit: 'Nos.',
    hsn_sac: '85286900',
    gst_rate: 18,
    purchase_price: 0,
    selling_price: 0,
    mrp: 0,
    target_margin_pct: 20,
    current_stock: 5,
    reorder_level: 2,
    is_serialized: true,
    is_service: false,
  });

  const loadData = async () => {
    const res = await getProducts({
      category: selectedCategory,
      search,
      lowStockOnly,
    });
    setProducts(res.products);
    const cats = await getProductCategories();
    setCategories(cats);
    const allowCost = await canViewProductCosts();
    setCanViewCost(allowCost);
  };

  useEffect(() => {
    loadData();
  }, [selectedCategory, search, lowStockOnly]);

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await createProduct({
      ...newProduct,
      purchase_price: Number(newProduct.purchase_price),
      selling_price: Number(newProduct.selling_price),
      mrp: Number(newProduct.mrp),
      current_stock: Number(newProduct.current_stock),
      reorder_level: Number(newProduct.reorder_level),
    });
    setIsAddModalOpen(false);
    loadData();
  };

  const handleExportCSV = () => {
    const exportColumns = [
      { key: 'sku', label: 'SKU' },
      { key: 'name', label: 'Product Name' },
      { key: 'category_name', label: 'Category' },
      { key: 'brand_name', label: 'Brand' },
      { key: 'hsn_sac', label: 'HSN/SAC' },
      ...(canViewCost ? [{ key: 'purchase_price', label: 'Purchase Cost (₹)' }] : []),
      { key: 'selling_price', label: 'Selling Price (₹)' },
      { key: 'mrp', label: 'MRP (₹)' },
      { key: 'current_stock', label: 'Current Stock' },
      { key: 'unit', label: 'Unit' },
      { key: 'reorder_level', label: 'Reorder Level' },
    ];
    exportToCSV('ICON_Product_Catalog', products, exportColumns);
  };

  const handleOpenSpecModal = (prod: Product) => {
    setSpecTargetProduct(prod);
    setSpecBrand(prod.brand_name || '');
    setSpecModel(prod.model_name || prod.name || '');
    setSpecCategory(prod.category_name || '');
    setSpecResult(null);
    setIsSpecModalOpen(true);
  };

  const handleFetchSpecs = async () => {
    if (!specBrand && !specModel) return;
    setIsFetchingSpecs(true);
    try {
      const res = await fetchProductSpecs(specBrand, specModel, specCategory);
      setSpecResult(res);
    } catch (err) {
      console.error('Fetch specs failed:', err);
    } finally {
      setIsFetchingSpecs(false);
    }
  };

  const handleApproveSpecs = async () => {
    if (!specTargetProduct || !specResult || !specResult.found) return;
    try {
      await approveProductSpecs(
        specTargetProduct.id,
        specResult.specs,
        specResult.source || 'Authentic Datasheet',
        'Managing Director'
      );
      setIsSpecModalOpen(false);
      loadData();
    } catch (err) {
      console.error('Approve specs failed:', err);
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Product Catalog</h1>
            <span className="px-2.5 py-0.5 rounded-full bg-brand-50 text-brand-700 border border-brand-200 text-xs font-bold">
              {products.length} Products Listed
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            22 Established categories across Audio-Visual, CCTV, Networking, Displays & IT Infrastructure
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Link
            href="/dashboard/import"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-100 bg-white text-slate-700 text-xs font-bold shadow-xs transition"
          >
            <UploadCloud className="w-4 h-4 text-brand-600" />
            <span>Import CSV</span>
          </Link>
          <button
            type="button"
            onClick={handleExportCSV}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-100 bg-white text-slate-700 text-xs font-bold shadow-xs transition"
          >
            <Download className="w-4 h-4 text-slate-500" />
            <span>Export CSV</span>
          </button>
          <button
            type="button"
            onClick={() => setIsAddModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold shadow-md shadow-brand-500/20 transition"
          >
            <Plus className="w-4 h-4" />
            <span>Add New Product</span>
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search SKU, Product name, Brand..."
            className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-3 py-2 border border-slate-200 rounded-xl outline-none bg-white font-medium text-slate-700 max-w-[200px]"
          >
            <option value="ALL">All 22 Categories</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          <button
            onClick={() => setLowStockOnly(!lowStockOnly)}
            className={`px-3 py-2 rounded-xl border text-xs font-bold transition flex items-center gap-1.5 ${
              lowStockOnly
                ? 'bg-rose-50 text-rose-700 border-rose-300'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
            <span>Low Stock Reorders</span>
          </button>
        </div>
      </div>

      {/* Products Table & Cards Container */}
      <div className="border border-slate-200 rounded-2xl bg-white shadow-sm overflow-hidden">
        {/* Desktop Table View - Fitted to available width without horizontal scrollbars */}
        <div className="hidden md:block w-full">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
              <tr>
                <th className="py-2.5 px-3 w-[18%]">SKU / HSN</th>
                <th className="py-2.5 px-3 w-[30%]">Product Name & Category</th>
                <th className="py-2.5 px-3 text-right w-[18%]">Pricing (₹)</th>
                <th className="py-2.5 px-3 text-center w-[12%]">Stock</th>
                <th className="py-2.5 px-3 text-center w-[10%]">Status</th>
                <th className="py-2.5 px-3 text-right w-[12%]">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {products.map((p) => {
                const isLow = p.current_stock <= p.reorder_level;
                return (
                  <tr key={p.id} className="hover:bg-slate-50/70 transition">
                    <td className="py-3 px-3 align-top font-mono font-bold text-slate-900">
                      <span>{p.sku}</span>
                      {p.hsn_sac && (
                        <span className="text-[10.5px] text-slate-400 font-normal block">
                          HSN: {p.hsn_sac}
                        </span>
                      )}
                    </td>

                    <td className="py-3 px-3 align-top">
                      <strong className="text-slate-900 font-bold block truncate">{p.name}</strong>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="px-1.5 py-0.2 rounded bg-slate-100 font-semibold text-slate-700 text-[9.5px]">
                          {p.category_name}
                        </span>
                        {p.brand_name && (
                          <span className="text-[10px] text-slate-500 font-medium truncate">
                            &bull; {p.brand_name}
                          </span>
                        )}
                        {p.model_name && (
                          <span className="text-[10px] text-slate-400 font-mono truncate">
                            ({p.model_name})
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="py-3 px-3 align-top text-right">
                      <div className="font-black text-slate-900 font-mono">
                        ₹{p.selling_price.toLocaleString('en-IN')}
                      </div>
                      {canViewCost && (
                        <div className="text-[10.5px] text-slate-400 mt-0.5">
                          Cost: ₹{(p.purchase_price || 0).toLocaleString('en-IN')}
                          <span className="text-emerald-600 font-bold ml-1">({p.target_margin_pct}%)</span>
                        </div>
                      )}
                    </td>

                    <td className="py-3 px-3 align-top text-center">
                      <span
                        className={`inline-flex items-center gap-1 font-bold ${
                          isLow ? 'text-rose-600' : 'text-slate-800'
                        }`}
                      >
                        {isLow && <AlertTriangle className="w-3 h-3 text-rose-500" />}
                        <span>{p.current_stock} {p.unit}</span>
                      </span>
                    </td>

                    <td className="py-3 px-3 align-top text-center">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[9.5px] font-bold inline-block ${
                          p.is_active ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        {p.is_active ? 'ACTIVE' : 'INACTIVE'}
                      </span>
                    </td>

                    <td className="py-3 px-3 align-top text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => setEditingProduct(p)}
                          className="p-1 rounded-md bg-amber-50 hover:bg-amber-100 text-amber-700 font-bold transition text-[11px] border border-amber-200"
                          title="Edit Product"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenSpecModal(p)}
                          className="px-2 py-1 rounded-md bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-[10.5px] border border-blue-200 transition"
                          title="View Specs"
                        >
                          Specs
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Mobile Responsive Cards View */}
        <div className="block md:hidden divide-y divide-slate-100 p-3 space-y-3">
          {products.map((p) => {
            const isLow = p.current_stock <= p.reorder_level;
            return (
              <div key={p.id} className="pt-3 first:pt-0 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-black text-slate-900">
                    {p.sku}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      p.is_active ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {p.is_active ? 'ACTIVE' : 'INACTIVE'}
                  </span>
                </div>

                <div>
                  <h4 className="font-bold text-slate-900 text-sm">{p.name}</h4>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <span className="px-1.5 py-0.5 rounded bg-slate-100 font-medium text-slate-700 text-[10px]">
                      {p.category_name}
                    </span>
                    {p.brand_name && <span>Brand: {p.brand_name}</span>}
                    {p.hsn_sac && <span className="font-mono">HSN: {p.hsn_sac}</span>}
                  </div>
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-xs">
                  <div>
                    <span className="text-[10px] text-slate-400 block uppercase font-semibold">Stock</span>
                    <span className={`font-bold ${isLow ? 'text-rose-600' : 'text-slate-800'}`}>
                      {p.current_stock} {p.unit}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-slate-400 block uppercase font-semibold">Selling Price</span>
                    <span className="font-mono font-black text-slate-900 text-sm">
                      ₹{p.selling_price.toLocaleString('en-IN')}
                    </span>
                  </div>
                </div>

                {/* Mobile Quick Action Buttons (min 44px touch targets) */}
                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setEditingProduct(p)}
                    className="flex-1 min-h-[44px] flex items-center justify-center gap-1 rounded-xl bg-amber-50 text-amber-700 border border-amber-200 text-xs font-bold"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    <span>Edit</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleOpenSpecModal(p)}
                    className="flex-1 min-h-[44px] flex items-center justify-center gap-1 rounded-xl bg-blue-50 text-blue-700 border border-blue-200 text-xs font-bold"
                  >
                    <span>Specs</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Add Product Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-xl p-6 space-y-4 text-xs">
            <h2 className="text-base font-bold text-slate-900">Add New Product to Catalog</h2>
            <form onSubmit={handleAddSubmit} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1">SKU Code *</label>
                  <input
                    type="text"
                    required
                    value={newProduct.sku}
                    onChange={(e) => setNewProduct({ ...newProduct, sku: e.target.value })}
                    placeholder="e.g. PROJ-EPS-02"
                    className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Category *</label>
                  <select
                    value={newProduct.category_name}
                    onChange={(e) => setNewProduct({ ...newProduct, category_name: e.target.value })}
                    className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg outline-none bg-white"
                  >
                    {categories.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold mb-1">Product Name *</label>
                <input
                  type="text"
                  required
                  value={newProduct.name}
                  onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
                  placeholder="e.g. Epson Home Cinema 4K Laser Projector"
                  className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg outline-none"
                />
              </div>

              <div className={`grid ${canViewCost ? 'grid-cols-3' : 'grid-cols-2'} gap-3`}>
                <div>
                  <label className="block font-semibold mb-1">Selling Rate (₹) *</label>
                  <input
                    type="number"
                    required
                    value={newProduct.selling_price}
                    onChange={(e) => setNewProduct({ ...newProduct, selling_price: Number(e.target.value) })}
                    className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg outline-none font-bold"
                  />
                </div>
                {canViewCost && (
                  <div>
                    <label className="block font-semibold mb-1">Purchase Cost (₹)</label>
                    <input
                      type="number"
                      value={newProduct.purchase_price}
                      onChange={(e) => setNewProduct({ ...newProduct, purchase_price: Number(e.target.value) })}
                      className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg outline-none"
                    />
                  </div>
                )}
                <div>
                  <label className="block font-semibold mb-1">Initial Stock</label>
                  <input
                    type="number"
                    value={newProduct.current_stock}
                    onChange={(e) => setNewProduct({ ...newProduct, current_stock: Number(e.target.value) })}
                    className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2.5 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 font-semibold text-slate-600 hover:text-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 font-semibold text-white bg-brand-600 hover:bg-brand-700 rounded-xl"
                >
                  Save Product
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Spec Intelligence Modal */}
      {isSpecModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg p-6 space-y-4 text-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-blue-600" />
                <h2 className="text-base font-black text-slate-900">
                  Product Technical Specifications
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setIsSpecModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-600">Brand:</span>
                <input
                  type="text"
                  value={specBrand}
                  onChange={(e) => setSpecBrand(e.target.value)}
                  placeholder="e.g. Epson"
                  className="px-2 py-1 text-xs border border-slate-300 rounded bg-white w-48 font-bold"
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-600">Model:</span>
                <input
                  type="text"
                  value={specModel}
                  onChange={(e) => setSpecModel(e.target.value)}
                  placeholder="e.g. EB-L260F"
                  className="px-2 py-1 text-xs border border-slate-300 rounded bg-white w-48 font-bold"
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-600">Category:</span>
                <span className="font-bold text-slate-800">{specCategory || 'Audio-Visual'}</span>
              </div>

              <button
                type="button"
                disabled={isFetchingSpecs || (!specBrand && !specModel)}
                onClick={handleFetchSpecs}
                className="w-full py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold rounded-xl flex items-center justify-center gap-2 transition"
              >
                {isFetchingSpecs ? (
                  <span>Searching authentic technical datasheets...</span>
                ) : (
                  <>
                    <Search className="w-3.5 h-3.5" />
                    <span>🔍 Fetch Specifications</span>
                  </>
                )}
              </button>
            </div>

            {/* Spec Results Card */}
            {specResult && (
              <div className="space-y-3 pt-2">
                {specResult.found ? (
                  <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-xl space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-emerald-800 flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        Authentic Datasheet Verified
                      </span>
                      <span className="text-[10px] text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded font-mono">
                        {specResult.source}
                      </span>
                    </div>

                    <div className="space-y-1 text-xs text-slate-800 bg-white p-3 rounded-lg border border-emerald-200/80">
                      {Object.entries(specResult.specs || {}).map(([k, v]) => (
                        <div key={k} className="flex justify-between py-0.5 border-b border-slate-100 last:border-none">
                          <span className="text-slate-500 font-medium capitalize">{k.replace(/_/g, ' ')}:</span>
                          <span className="font-bold text-slate-900">{String(v)}</span>
                        </div>
                      ))}
                    </div>

                    <button
                      type="button"
                      onClick={handleApproveSpecs}
                      className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl flex items-center justify-center gap-1.5 transition"
                    >
                      <Check className="w-4 h-4" />
                      Approve & Save to Product
                    </button>
                  </div>
                ) : (
                  <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl space-y-1.5 text-center">
                    <AlertTriangle className="w-5 h-5 text-amber-500 mx-auto" />
                    <p className="font-bold text-amber-900 text-xs">
                      {specResult.message || 'Not found — manual entry required'}
                    </p>
                    <p className="text-[11px] text-amber-700">
                      No hallucinated data allowed. Please enter verified specifications manually.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
      {/* Edit Product Modal */}
      <EditProductModal
        isOpen={!!editingProduct}
        onClose={() => setEditingProduct(null)}
        product={editingProduct}
        categories={categories}
        canViewCost={canViewCost}
        onSuccess={loadData}
      />
    </div>
  );
}
