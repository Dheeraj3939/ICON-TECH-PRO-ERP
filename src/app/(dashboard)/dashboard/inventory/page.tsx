'use client';

import React, { useState, useEffect } from 'react';
import {
  Boxes,
  Package,
  AlertTriangle,
  CheckCircle2,
  Search,
  ArrowRight,
  Warehouse,
  ShieldCheck,
  Download,
  History,
  Sparkles,
  QrCode,
  ArrowUpRight,
  ArrowDownLeft,
  Clock,
  Layers,
} from 'lucide-react';
import { getProducts } from '@/lib/actions/products';
import {
  getStockMovements,
  traceSerialLifecycle,
  scanAndMoveSerial,
} from '@/lib/actions/inventory';
import { exportToCSV } from '@/lib/utils/export';
import type {
  Product,
  StockMovementRecord,
  SerialLifecycleTrace,
  SerialLedgerEntry,
} from '@/types/erp';

export default function InventoryPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [stockMovements, setStockMovements] = useState<StockMovementRecord[]>([]);
  const [activeTab, setActiveTab] = useState<'balances' | 'movements' | 'tracer'>('balances');

  // Serial Lifecycle Tracer states
  const [serialQuery, setSerialQuery] = useState('EP-4K-980-SN4401');
  const [activeTrace, setActiveTrace] = useState<SerialLifecycleTrace | null>(null);
  const [isTracing, setIsTracing] = useState(false);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    getProducts().then((res) => setProducts(res.products));
    getStockMovements().then((m) => setStockMovements(m));
    traceSerialLifecycle('EP-4K-980-SN4401').then((res) => {
      if (res.success && res.data) setActiveTrace(res.data);
    });
  }, []);

  const handleTraceSerial = async (serial?: string) => {
    const target = serial || serialQuery;
    if (!target) return;
    setIsTracing(true);
    try {
      const res = await traceSerialLifecycle(target);
      if (res.success && res.data) {
        setActiveTrace(res.data);
        setActionMessage({
          type: 'success',
          text: `Found lifecycle history for serial ${target} (${res.data.history.length} events).`,
        });
      } else {
        setActionMessage({
          type: 'error',
          text: res.error || `No records found for serial "${target}"`,
        });
      }
    } finally {
      setIsTracing(false);
    }
  };

  const handleQuickMove = async (
    action: SerialLedgerEntry['action'],
    newStatus: SerialLedgerEntry['new_status']
  ) => {
    if (!activeTrace) return;
    try {
      const res = await scanAndMoveSerial({
        serial_number: activeTrace.serial_number,
        product_name: activeTrace.product_name,
        action,
        new_status: newStatus,
        warehouse_code: 'WH-HYD-MAIN',
        notes: `Quick scan action via Inventory console: ${action}`,
      });

      if (res.success) {
        setActionMessage({
          type: 'success',
          text: `Serial ${activeTrace.serial_number} moved to status "${newStatus}".`,
        });
        await handleTraceSerial(activeTrace.serial_number);
        const updatedMovements = await getStockMovements();
        setStockMovements(updatedMovements);
      } else {
        setActionMessage({
          type: 'error',
          text: res.error || 'Failed to move serial',
        });
      }
    } catch (err) {
      setActionMessage({
        type: 'error',
        text: (err as Error).message || 'Unexpected error moving serial',
      });
    }
  };

  const sampleSerials = [
    { serial: 'EP-4K-980-SN4401', product: 'Epson Home Cinema 4K Laser Projector', warehouse: 'WH-HYD-MAIN', status: 'INSTALLED (T-Hub)' },
    { serial: 'EPS-2250-89102', product: 'Epson Business Projector 4500L', warehouse: 'WH-HYD-MAIN', status: 'AVAILABLE' },
    { serial: 'EPS-2250-89103', product: 'Epson Business Projector 4500L', warehouse: 'WH-HYD-MAIN', status: 'AVAILABLE' },
    { serial: 'EPS-2250-89104', product: 'Epson Business Projector 4500L', warehouse: 'WH-HYD-MAIN', status: 'RESERVED (Quote QT260003)' },
    { serial: 'ST2400-DEL-001', product: '2.4TB SAS HDD 12Gbps', warehouse: 'WH-HYD-MAIN', status: 'RESERVED (Order ORD260002)' },
    { serial: 'ST2400-DEL-002', product: '2.4TB SAS HDD 12Gbps', warehouse: 'WH-HYD-MAIN', status: 'RESERVED (Order ORD260002)' },
    { serial: 'CSCO-CBS350-01', product: '24-Port Gigabit Managed PoE+ Switch', warehouse: 'WH-HYD-MAIN', status: 'DISPATCHED (Order ORD260001)' },
    { serial: 'HIK-4K-CAM-081', product: '8MP 4K ColorVu IP Bullet Camera', warehouse: 'WH-HYD-MAIN', status: 'INSTALLED (Sri Sai Hospitals)' },
    { serial: 'DEN-AVR-X2800', product: 'Denon 7.2 AV Receiver Dolby Atmos', warehouse: 'WH-HYD-MAIN', status: 'AVAILABLE' },
    { serial: 'VIEW-IFP-75-01', product: 'ViewSonic 75" 4K Flat Panel', warehouse: 'WH-HYD-RENTAL', status: 'AVAILABLE (Demo Hub)' },
  ];

  const handleExportStockCSV = () => {
    exportToCSV('ICON_Inventory_Stock', products, [
      { key: 'sku', label: 'SKU' },
      { key: 'name', label: 'Product Name' },
      { key: 'category_name', label: 'Category' },
      { key: 'brand_name', label: 'Brand' },
      { key: 'current_stock', label: 'Stock On Hand' },
      { key: 'reorder_level', label: 'Reorder Level' },
      { key: 'unit', label: 'Unit' },
      { key: 'selling_price', label: 'Valuation Price (₹)' },
    ]);
  };

  const handleExportMovementsCSV = () => {
    exportToCSV('ICON_Stock_Movements', stockMovements, [
      { key: 'created_at', label: 'Timestamp' },
      { key: 'movement_type', label: 'Type' },
      { key: 'product_name', label: 'Product' },
      { key: 'quantity', label: 'Quantity' },
      { key: 'previous_stock', label: 'Previous Stock' },
      { key: 'new_stock', label: 'New Stock' },
      { key: 'reference_module', label: 'Module' },
      { key: 'reference_number', label: 'Reference' },
      { key: 'warehouse_code', label: 'Warehouse' },
      { key: 'created_by_name', label: 'Actor' },
    ]);
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">
              Inventory & Serial Number Tracking
            </h1>
            <span className="px-2.5 py-0.5 rounded-full bg-brand-50 text-brand-700 border border-brand-200 text-xs font-bold">
              Multi-Warehouse Live
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Real-time physical stock counts, immutable append-only movement ledger & unit-level serial traceability
          </p>
        </div>

        <div className="flex items-center gap-2">
          {activeTab === 'movements' ? (
            <button
              type="button"
              onClick={handleExportMovementsCSV}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-100 bg-white text-slate-700 text-xs font-bold shadow-xs transition"
            >
              <Download className="w-4 h-4 text-slate-500" />
              <span>Export Ledger CSV</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleExportStockCSV}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-100 bg-white text-slate-700 text-xs font-bold shadow-xs transition"
            >
              <Download className="w-4 h-4 text-slate-500" />
              <span>Export Stock CSV</span>
            </button>
          )}
        </div>
      </div>

      {actionMessage && (
        <div
          className={`p-3.5 rounded-xl border text-xs font-medium flex items-center gap-2 ${
            actionMessage.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-rose-50 text-rose-800 border-rose-200'
          }`}
        >
          {actionMessage.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
          )}
          <span>{actionMessage.text}</span>
        </div>
      )}

      {/* Tab Switcher */}
      <div className="flex items-center gap-1 p-1 bg-slate-200/70 rounded-xl text-xs font-bold w-fit">
        <button
          onClick={() => setActiveTab('balances')}
          className={`px-3.5 py-1.5 rounded-lg transition flex items-center gap-1.5 ${
            activeTab === 'balances'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>Stock Balances & Depots</span>
        </button>
        <button
          onClick={() => setActiveTab('movements')}
          className={`px-3.5 py-1.5 rounded-lg transition flex items-center gap-1.5 ${
            activeTab === 'movements'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <History className="w-3.5 h-3.5" />
          <span>Stock Movement Ledger ({stockMovements.length})</span>
        </button>
        <button
          onClick={() => setActiveTab('tracer')}
          className={`px-3.5 py-1.5 rounded-lg transition flex items-center gap-1.5 ${
            activeTab === 'tracer'
              ? 'bg-brand-600 text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <QrCode className="w-3.5 h-3.5 text-amber-300" />
          <span>Serial Lifecycle Tracer</span>
        </button>
      </div>

      {/* TAB 1: STOCK BALANCES & DEPOTS */}
      {activeTab === 'balances' && (
        <div className="space-y-6">
          {/* Warehouse Depots */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-sm flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center font-bold">
                  <Warehouse className="w-5 h-5" />
                </div>
                <div>
                  <strong className="text-sm text-slate-900 block font-bold">
                    WH-HYD-MAIN &bull; Central Depot (SR Nagar)
                  </strong>
                  <span className="text-xs text-slate-500">Ameer Estate, SR Nagar &bull; Primary Fulfillment Hub</span>
                </div>
              </div>
              <span className="px-2.5 py-1 rounded bg-emerald-50 text-emerald-700 font-bold text-xs border border-emerald-200">
                OPERATIONAL
              </span>
            </div>

            <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-sm flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
                  <Warehouse className="w-5 h-5" />
                </div>
                <div>
                  <strong className="text-sm text-slate-900 block font-bold">
                    WH-HYD-RENTAL &bull; ICON Demo & Rental Hub
                  </strong>
                  <span className="text-xs text-slate-500">Road No. 12, Banjara Hills &bull; Demo / Rental Inventory</span>
                </div>
              </div>
              <span className="px-2.5 py-1 rounded bg-amber-50 text-amber-700 font-bold text-xs border border-amber-200">
                ACTIVE
              </span>
            </div>
          </div>

          {/* Stock Balances Table */}
          <div className="border border-slate-200 rounded-2xl bg-white shadow-sm overflow-hidden space-y-0">
            <div className="p-4 border-b border-slate-200 bg-slate-50/70 flex justify-between items-center">
              <h2 className="text-sm font-bold text-slate-900">Stock Balances & Order Allocations</h2>
              <span className="text-xs text-slate-500 font-medium">Auto-calculated: Available = Physical - Reserved</span>
            </div>
            {/* Desktop Table View - Fitted to available width without horizontal scrollbars */}
            <div className="hidden md:block w-full">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3 w-[18%]">SKU Code</th>
                    <th className="py-2.5 px-3 w-[32%]">Item & Category</th>
                    <th className="py-2.5 px-3 text-center w-[26%]">Physical / Res / Avail</th>
                    <th className="py-2.5 px-3 text-right w-[24%]">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {products.map((p) => {
                    const reserved = p.sku === 'PROJ-BUS-01' ? 1 : p.sku === 'SRV-HDD-2.4T' ? 2 : p.sku === 'SRV-RAM-32G' ? 2 : 0;
                    const available = Math.max(0, p.current_stock - reserved);
                    const isLow = p.current_stock <= p.reorder_level;

                    return (
                      <tr key={p.id} className="hover:bg-slate-50/60 transition">
                        <td className="py-3 px-3 align-top font-mono font-bold text-slate-900">{p.sku}</td>
                        <td className="py-3 px-3 align-top">
                          <strong className="text-slate-900 font-bold block truncate">{p.name}</strong>
                          <span className="text-slate-400 text-[10.5px] block truncate">{p.category_name}</span>
                        </td>
                        <td className="py-3 px-3 align-top text-center">
                          <div className="font-bold text-slate-800">
                            <span>{p.current_stock}</span> / <span className="text-blue-600">{reserved}</span> / <span className="text-emerald-700 font-black">{available}</span> {p.unit}
                          </div>
                          <span className="text-[10px] text-slate-400 block">Reorder: {p.reorder_level}</span>
                        </td>
                        <td className="py-3 px-3 align-top text-right">
                          {isLow ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 text-[10px] font-bold">
                              <AlertTriangle className="w-3 h-3 text-rose-500" />
                              Reorder
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">
                              <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                              Healthy
                            </span>
                          )}
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
                const reserved = p.sku === 'PROJ-BUS-01' ? 1 : p.sku === 'SRV-HDD-2.4T' ? 2 : p.sku === 'SRV-RAM-32G' ? 2 : 0;
                const available = Math.max(0, p.current_stock - reserved);
                const isLow = p.current_stock <= p.reorder_level;

                return (
                  <div key={p.id} className="pt-3 first:pt-0 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-black text-slate-900">{p.sku}</span>
                      {isLow ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 text-[10px] font-bold">
                          <AlertTriangle className="w-3 h-3 text-rose-500" />
                          Reorder
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">
                          <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                          Healthy
                        </span>
                      )}
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900 text-sm">{p.name}</h4>
                      <p className="text-xs text-slate-400">{p.category_name}</p>
                    </div>
                    <div className="grid grid-cols-3 gap-2 p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-center text-xs">
                      <div>
                        <span className="text-[10px] text-slate-400 block font-semibold">Physical</span>
                        <span className="font-bold text-slate-800">{p.current_stock}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block font-semibold">Allocated</span>
                        <span className="font-bold text-blue-600">{reserved}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block font-semibold">Available</span>
                        <span className="font-black text-emerald-700">{available}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Serial Numbers Directory */}
          <div className="border border-slate-200 rounded-2xl bg-white shadow-sm overflow-hidden space-y-0">
            <div className="p-4 border-b border-slate-200 bg-slate-50/70 flex justify-between items-center">
              <h2 className="text-sm font-bold text-slate-900">Registered Serial Number Directory</h2>
              <span className="text-xs text-slate-500 font-medium">Click any serial to trace lifecycle</span>
            </div>
            {/* Desktop Table View - Fitted to available width without horizontal scrollbars */}
            <div className="hidden md:block w-full">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3 w-[25%]">Serial Number</th>
                    <th className="py-2.5 px-3 w-[35%]">Associated Product</th>
                    <th className="py-2.5 px-3 w-[20%]">Warehouse Depot</th>
                    <th className="py-2.5 px-3 text-right w-[20%]">Unit Lifecycle Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {sampleSerials.map((s, idx) => (
                    <tr
                      key={idx}
                      onClick={() => {
                        setSerialQuery(s.serial);
                        setActiveTab('tracer');
                        handleTraceSerial(s.serial);
                      }}
                      className="hover:bg-slate-50/80 cursor-pointer transition"
                    >
                      <td className="py-3 px-3 font-mono font-bold text-brand-700 hover:underline">
                        {s.serial}
                      </td>
                      <td className="py-3 px-3 font-medium text-slate-800 truncate">{s.product}</td>
                      <td className="py-3 px-3 font-medium text-slate-600">{s.warehouse}</td>
                      <td className="py-3 px-3 text-right">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold inline-block ${
                            s.status.includes('AVAILABLE')
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : s.status.includes('RESERVED')
                              ? 'bg-blue-50 text-blue-700 border border-blue-200'
                              : 'bg-purple-50 text-purple-700 border border-purple-200'
                          }`}
                        >
                          {s.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Responsive Cards View */}
            <div className="block md:hidden divide-y divide-slate-100 p-3 space-y-2">
              {sampleSerials.map((s, idx) => (
                <div
                  key={idx}
                  onClick={() => {
                    setSerialQuery(s.serial);
                    setActiveTab('tracer');
                    handleTraceSerial(s.serial);
                  }}
                  className="pt-2.5 first:pt-0 space-y-1.5 cursor-pointer"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold text-brand-700">{s.serial}</span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[9.5px] font-bold ${
                        s.status.includes('AVAILABLE')
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : s.status.includes('RESERVED')
                          ? 'bg-blue-50 text-blue-700 border border-blue-200'
                          : 'bg-purple-50 text-purple-700 border border-purple-200'
                      }`}
                    >
                      {s.status}
                    </span>
                  </div>
                  <h4 className="font-bold text-slate-900 text-xs">{s.product}</h4>
                  <p className="text-[11px] text-slate-500">Warehouse: {s.warehouse}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: IMMUTABLE STOCK MOVEMENT LEDGER */}
      {activeTab === 'movements' && (
        <div className="border border-slate-200 rounded-2xl bg-white shadow-sm overflow-hidden space-y-0">
          <div className="p-4 border-b border-slate-200 bg-slate-50/70 flex justify-between items-center">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Immutable Stock Movement Ledger</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Append-only financial & inventory journal with zero negative stock invariant
              </p>
            </div>
            <span className="px-2.5 py-0.5 rounded-full bg-brand-50 text-brand-700 border border-brand-200 text-xs font-bold">
              {stockMovements.length} Movements Recorded
            </span>
          </div>
          {/* Desktop Table View - Fitted to available width without horizontal scrollbars */}
          <div className="hidden md:block w-full">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3 w-[20%]">Timestamp / User</th>
                  <th className="py-2.5 px-3 w-[24%]">Type & Reference</th>
                  <th className="py-2.5 px-3 w-[32%]">Product & Depot</th>
                  <th className="py-2.5 px-3 text-right w-[24%]">Qty Change</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {stockMovements.map((sm) => {
                  const isInward = sm.movement_type === 'PURCHASE_RECEIPT' || sm.movement_type === 'RENTAL_RETURN';
                  return (
                    <tr key={sm.id} className="hover:bg-slate-50/60 transition">
                      <td className="py-3 px-3 align-top font-mono text-slate-500 text-[11px]">
                        <div>
                          {new Date(sm.created_at).toLocaleString('en-IN', {
                            dateStyle: 'short',
                            timeStyle: 'short',
                          })}
                        </div>
                        <span className="text-[10px] text-slate-400 font-sans">{sm.created_by_name}</span>
                      </td>
                      <td className="py-3 px-3 align-top">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9.5px] font-bold border ${
                            isInward
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                              : 'bg-purple-50 text-purple-700 border-purple-300'
                          }`}
                        >
                          {isInward ? (
                            <ArrowDownLeft className="w-3 h-3 text-emerald-600" />
                          ) : (
                            <ArrowUpRight className="w-3 h-3 text-purple-600" />
                          )}
                          <span>{sm.movement_type.replace('_', ' ')}</span>
                        </span>
                        <div className="font-mono text-[10.5px] text-brand-700 font-bold mt-1">
                          {sm.reference_module} &bull; {sm.reference_number}
                        </div>
                      </td>
                      <td className="py-3 px-3 align-top">
                        <strong className="font-bold text-slate-900 block truncate">{sm.product_name}</strong>
                        <span className="text-slate-500 text-[10.5px]">{sm.warehouse_code || 'WH-HYD-MAIN'}</span>
                      </td>
                      <td className="py-3 px-3 align-top text-right">
                        <div className="font-mono text-xs">
                          <strong className={isInward ? 'text-emerald-700' : 'text-purple-700'}>
                            {isInward ? `+${sm.quantity}` : `-${sm.quantity}`}
                          </strong>
                        </div>
                        <span className="text-[10.5px] text-slate-400 font-mono block">
                          {sm.previous_stock} &rarr; <strong>{sm.new_stock}</strong>
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Responsive Cards View */}
          <div className="block md:hidden divide-y divide-slate-100 p-3 space-y-2">
            {stockMovements.map((sm) => {
              const isInward = sm.movement_type === 'PURCHASE_RECEIPT' || sm.movement_type === 'RENTAL_RETURN';
              return (
                <div key={sm.id} className="pt-2.5 first:pt-0 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9.5px] font-bold border ${
                        isInward
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                          : 'bg-purple-50 text-purple-700 border-purple-300'
                      }`}
                    >
                      {sm.movement_type.replace('_', ' ')}
                    </span>
                    <strong className={`font-mono text-xs ${isInward ? 'text-emerald-700' : 'text-purple-700'}`}>
                      {isInward ? `+${sm.quantity}` : `-${sm.quantity}`}
                    </strong>
                  </div>
                  <h4 className="font-bold text-slate-900 text-xs">{sm.product_name}</h4>
                  <div className="flex items-center justify-between text-[11px] text-slate-500">
                    <span>{sm.warehouse_code || 'WH-HYD-MAIN'}</span>
                    <span>Stock: {sm.previous_stock} &rarr; {sm.new_stock}</span>
                  </div>
                  <div className="text-[10.5px] text-slate-400 font-mono">
                    Ref: {sm.reference_module} #{sm.reference_number}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 3: SERIAL LIFECYCLE TRACER & SCANNER */}
      {activeTab === 'tracer' && (
        <div className="space-y-6">
          {/* Scanner / Lookup Bar */}
          <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center gap-2">
              <QrCode className="w-5 h-5 text-brand-600" />
              <h2 className="text-sm font-bold text-slate-900">
                Unit Serial Scanner & Lifecycle Tracer
              </h2>
            </div>
            <p className="text-xs text-slate-500">
              Trace individual hardware units across the complete lifecycle: GRN Inward &rarr; SO Reservation &rarr; Dispatch &rarr; Installation &bull; Warranty
            </p>

            <div className="flex flex-wrap items-center gap-3">
              <div className="flex-1 min-w-[280px]">
                <input
                  type="text"
                  value={serialQuery}
                  onChange={(e) => setSerialQuery(e.target.value)}
                  placeholder="Scan or enter serial number (e.g. EP-4K-980-SN4401)..."
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-xs font-mono font-bold text-slate-900 bg-slate-50 focus:bg-white transition"
                />
              </div>
              <button
                type="button"
                disabled={isTracing}
                onClick={() => handleTraceSerial()}
                className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs shadow-sm transition disabled:opacity-50"
              >
                <Search className="w-3.5 h-3.5" />
                <span>{isTracing ? 'Searching...' : 'Trace Lifecycle'}</span>
              </button>
            </div>
          </div>

          {/* Active Serial Card & Timeline */}
          {activeTrace && (
            <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-base font-black text-brand-700">
                      {activeTrace.serial_number}
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold">
                      {activeTrace.current_status}
                    </span>
                  </div>
                  <h3 className="font-bold text-slate-900 text-sm mt-0.5">{activeTrace.product_name}</h3>
                  {activeTrace.installed_customer && (
                    <p className="text-xs text-slate-500 mt-0.5">
                      Installed at: <strong className="text-slate-800">{activeTrace.installed_customer}</strong>
                    </p>
                  )}
                </div>

                {/* Quick Unit Transition Actions */}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400 font-semibold">Quick Move:</span>
                  <button
                    type="button"
                    onClick={() => handleQuickMove('RESERVE', 'RESERVED')}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold transition"
                  >
                    Reserve
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickMove('DISPATCH', 'DISPATCHED')}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold transition"
                  >
                    Dispatch
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickMove('INSTALL', 'INSTALLED')}
                    className="px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold text-xs border border-emerald-200 transition"
                  >
                    Install
                  </button>
                </div>
              </div>

              {/* Lifecycle Events Timeline */}
              <div className="space-y-4">
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Unit Journey & Transition History ({activeTrace.history.length} events)
                </h4>

                <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
                  {activeTrace.history.map((event, idx) => (
                    <div key={event.id || idx} className="relative group">
                      <div className="absolute -left-6 top-1 w-5 h-5 rounded-full bg-brand-600 text-white flex items-center justify-center text-[10px] font-bold shadow-xs">
                        {idx + 1}
                      </div>
                      <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 group-hover:bg-slate-50 transition space-y-1.5 text-xs">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                          <div className="flex items-center gap-2">
                            <strong className="text-slate-900 font-bold text-xs">
                              {event.action.replace('_', ' ')}
                            </strong>
                            <span className="text-[10px] px-2 py-0.5 rounded bg-white text-slate-700 border border-slate-200 font-mono font-semibold">
                              {event.previous_status || 'INITIAL'} &rarr; {event.new_status}
                            </span>
                          </div>
                          <span className="text-slate-400 font-mono text-[11px]">
                            {new Date(event.created_at).toLocaleString('en-IN', {
                              dateStyle: 'medium',
                              timeStyle: 'short',
                            })}
                          </span>
                        </div>
                        {event.reference_module && event.reference_number && (
                          <div className="text-[11px] text-slate-600 font-medium">
                            Reference: <span className="font-mono text-brand-700 font-bold">{event.reference_module} {event.reference_number}</span>
                            {event.customer_name && <span> &bull; Customer: <strong>{event.customer_name}</strong></span>}
                          </div>
                        )}
                        {event.notes && (
                          <p className="text-[11px] text-slate-600 italic">
                            &quot;{event.notes}&quot;
                          </p>
                        )}
                        <div className="text-[10px] text-slate-400 pt-1 border-t border-slate-200/60">
                          Actor: {event.actor_name} &bull; Warehouse: {event.warehouse_code || 'WH-HYD-MAIN'}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
