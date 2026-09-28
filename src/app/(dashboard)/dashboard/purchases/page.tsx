'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Truck,
  Plus,
  Building2,
  Phone,
  Mail,
  CheckCircle2,
  Clock,
  Package,
  Layers,
  FileText,
  AlertCircle,
  ExternalLink,
  MapPin,
  Send,
  Download,
  Award,
  Sparkles,
  TrendingUp,
  ShieldCheck,
  Scale,
  Pencil,
} from 'lucide-react';
import EditPurchaseOrderModal from '@/components/modals/EditPurchaseOrderModal';
import {
  getSuppliers,
  getPurchaseOrders,
  getUnfulfilledOrderItems,
  createPurchaseOrder,
  receivePurchaseOrder,
  compareSupplierQuotes,
  getSupplierPerformance,
  updatePurchaseOrderStatus,
} from '@/lib/actions/procurement';
import { getOrders } from '@/lib/actions/orders';
import { INITIAL_PRODUCTS } from '@/lib/constants/erp-data';
import { exportToCSV } from '@/lib/utils/export';
import type {
  Supplier,
  PurchaseOrder,
  DeliveryType,
  SalesOrder,
  SupplierQuoteComparisonItem,
  SupplierPerformanceSummary,
} from '@/types/erp';

interface UnfulfilledItem {
  order_id: string;
  order_number: string;
  customer_name: string;
  item_id?: string;
  product_id?: string | null;
  sku?: string | null;
  product_name: string;
  quantity: number;
  reserved_quantity: number;
  procurement_required_qty: number;
  procurement_status: string;
}

function PurchasesContent() {
  const searchParams = useSearchParams();
  const soParam = searchParams?.get('so');
  const [filteredSo, setFilteredSo] = useState<string | null>(soParam || null);

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [pos, setPos] = useState<PurchaseOrder[]>([]);
  const [backorders, setBackorders] = useState<UnfulfilledItem[]>([]);
  const [editingPo, setEditingPo] = useState<PurchaseOrder | null>(null);
  const [salesOrders, setSalesOrders] = useState<SalesOrder[]>([]);
  const [activeTab, setActiveTab] = useState<'orders' | 'backorders' | 'suppliers' | 'intelligence'>('orders');

  // Supplier Intelligence & Quote Comparison States
  const [supplierPerformance, setSupplierPerformance] = useState<SupplierPerformanceSummary[]>([]);
  const [comparisonProductName, setComparisonProductName] = useState('Epson Home Cinema 4K Laser Projector');
  const [comparisonQty, setComparisonQty] = useState(2);
  const [quoteComparisonData, setQuoteComparisonData] = useState<{
    product_name: string;
    quantity: number;
    quotes: SupplierQuoteComparisonItem[];
    recommended_quote?: SupplierQuoteComparisonItem;
  } | null>(null);
  const [isComparingQuotes, setIsComparingQuotes] = useState(false);

  const displayedBackorders = filteredSo
    ? backorders.filter((bo) => bo.order_number === filteredSo || bo.order_id === filteredSo)
    : backorders;

  // Modal states
  const [isPoModalOpen, setIsPoModalOpen] = useState(false);
  const [selectedItemsForPo, setSelectedItemsForPo] = useState<UnfulfilledItem[]>([]);
  const [poSupplierId, setPoSupplierId] = useState('');
  const [deliveryType, setDeliveryType] = useState<DeliveryType>('OFFICE_RECEIPT');
  const [consigneeName, setConsigneeName] = useState('');
  const [consigneeAddress, setConsigneeAddress] = useState('');
  const [consigneeContact, setConsigneeContact] = useState('');
  const [consigneePhone, setConsigneePhone] = useState('');

  // Receiving / POD modal states
  const [isReceiveModalOpen, setIsReceiveModalOpen] = useState(false);
  const [activePoToReceive, setActivePoToReceive] = useState<PurchaseOrder | null>(null);
  const [distributorInvoiceNo, setDistributorInvoiceNo] = useState('');
  const [courierTransporter, setCourierTransporter] = useState('');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [podRef, setPodRef] = useState('');
  const [vendorChallanNo, setVendorChallanNo] = useState('');

  const [loading, setLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadAll = async () => {
    const [sList, poList, boList, ordersRes, perfRes] = await Promise.all([
      getSuppliers(),
      getPurchaseOrders(),
      getUnfulfilledOrderItems(),
      getOrders(),
      getSupplierPerformance(),
    ]);
    setSuppliers(sList);
    setPos(poList);
    setBackorders(boList);
    if (ordersRes && ordersRes.orders) {
      setSalesOrders(ordersRes.orders);
    }
    if (perfRes && perfRes.success && perfRes.data) {
      setSupplierPerformance(perfRes.data);
    }
  };

  const handleCompareQuotes = async (prodName?: string, qty?: number) => {
    const targetProduct = prodName || comparisonProductName;
    const targetQty = qty || comparisonQty;
    if (!targetProduct) return;

    setIsComparingQuotes(true);
    try {
      const res = await compareSupplierQuotes({
        product_id_or_name: targetProduct,
        quantity: targetQty,
      });
      if (res.success && res.data) {
        setQuoteComparisonData(res.data);
        setActionMessage({
          type: 'success',
          text: `Compared ${res.data.quotes.length} supplier quotes for "${targetProduct}".`,
        });
      } else {
        setActionMessage({
          type: 'error',
          text: res.error || 'Failed to compare supplier quotes',
        });
      }
    } finally {
      setIsComparingQuotes(false);
    }
  };

  const handleUpdateStatus = async (poId: string, newStatus: PurchaseOrder['status']) => {
    try {
      setLoading(true);
      const res = await updatePurchaseOrderStatus(poId, newStatus);
      if (res.success) {
        setActionMessage({
          type: 'success',
          text: `PO status updated to ${newStatus}.`,
        });
        await loadAll();
      } else {
        setActionMessage({
          type: 'error',
          text: res.error || 'Failed to update PO status',
        });
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  useEffect(() => {
    if (soParam) {
      setActiveTab('backorders');
      setFilteredSo(soParam);
    }
  }, [soParam]);

  const openPoModal = (items: UnfulfilledItem[]) => {
    setSelectedItemsForPo(items);

    // Auto-match preferred supplier from catalog
    let matchedSupplierId = suppliers.length > 0 ? suppliers[0].id : '';
    if (items.length > 0 && items[0].sku) {
      const catalogProd = INITIAL_PRODUCTS.find((p) => p.sku === items[0].sku);
      if (catalogProd && catalogProd.supplier_name) {
        const prodSupplier = catalogProd.supplier_name.toLowerCase();
        const sup = suppliers.find(
          (s) => s.supplier_name.toLowerCase() === prodSupplier
        );
        if (sup) {
          matchedSupplierId = sup.id;
        }
      }
    }
    setPoSupplierId(matchedSupplierId);

    // Pre-populate consignee from the matched Sales Order
    if (items.length > 0) {
      const matchedOrder = salesOrders.find(
        (o) => o.id === items[0].order_id || o.order_number === items[0].order_number
      );
      if (matchedOrder) {
        setConsigneeName(matchedOrder.company_name || matchedOrder.customer_name);
        setConsigneeAddress(
          matchedOrder.shipping_address ||
            (matchedOrder as any).billing_address ||
            '7-1-62/A, Flat No-503, Ameer Estate, SR Nagar, Hyderabad, Telangana, 500038'
        );
        setConsigneeContact(matchedOrder.customer_name || '');
        setConsigneePhone((matchedOrder as any).phone || '');
      } else {
        setConsigneeName(items[0].customer_name);
        setConsigneeAddress('7-1-62/A, Flat No-503, Ameer Estate, SR Nagar, Hyderabad, Telangana, 500038');
        setConsigneeContact(items[0].customer_name);
        setConsigneePhone('');
      }
    }
    setIsPoModalOpen(true);
  };

  const handleCreatePoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItemsForPo.length) return;

    try {
      setLoading(true);
      setActionMessage(null);
      const supplier = suppliers.find((s) => s.id === poSupplierId) || suppliers[0];

      const poItems = selectedItemsForPo.map((it) => ({
        product_id: it.product_id || undefined,
        product_name: it.product_name,
        quantity: it.procurement_required_qty,
        unit_cost: 10000, // standard baseline or editable
        gst_rate: 18,
        sales_order_id: it.order_id,
        sales_order_item_id: it.item_id,
        customer_name: it.customer_name,
        order_number: it.order_number,
      }));

      const res = await createPurchaseOrder({
        supplier_id: supplier?.id,
        supplier_name: supplier?.supplier_name || 'Authorized Distributor',
        supplier_contact: supplier?.phone,
        sales_order_id: selectedItemsForPo[0]?.order_id,
        sales_order_number: selectedItemsForPo[0]?.order_number,
        delivery_type: deliveryType,
        consignee_name: deliveryType === 'DIRECT_CUSTOMER_DROPSHIP' ? consigneeName : undefined,
        consignee_address: deliveryType === 'DIRECT_CUSTOMER_DROPSHIP' ? consigneeAddress : undefined,
        consignee_contact: deliveryType === 'DIRECT_CUSTOMER_DROPSHIP' ? consigneeContact : undefined,
        consignee_phone: deliveryType === 'DIRECT_CUSTOMER_DROPSHIP' ? consigneePhone : undefined,
        items: poItems,
      });

      if (res.success && res.data) {
        setActionMessage({
          type: 'success',
          text: `Purchase Order ${res.data.po_number} created successfully (${deliveryType === 'DIRECT_CUSTOMER_DROPSHIP' ? 'Drop-Ship' : 'Office Receipt'})!`,
        });
        setIsPoModalOpen(false);
        setActiveTab('orders');
        await loadAll();
      } else {
        setActionMessage({
          type: 'error',
          text: res.error || 'Failed to create PO',
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const openReceiveModal = (po: PurchaseOrder) => {
    setActivePoToReceive(po);
    setDistributorInvoiceNo('');
    setCourierTransporter('');
    setTrackingNumber('');
    setPodRef('');
    setVendorChallanNo('');
    setIsReceiveModalOpen(true);
  };

  const handleReceivePoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activePoToReceive) return;

    try {
      setLoading(true);
      setActionMessage(null);
      const isDropShip = activePoToReceive.delivery_type === 'DIRECT_CUSTOMER_DROPSHIP';

      const receivedItems = activePoToReceive.items.map((i) => ({
        product_name: i.product_name,
        received_quantity: i.quantity - (i.received_quantity || 0),
      }));

      const res = await receivePurchaseOrder(activePoToReceive.id, {
        receivedItems,
        isDropShip,
        distributor_invoice_number: distributorInvoiceNo,
        courier_transporter: courierTransporter,
        tracking_number: trackingNumber,
        proof_of_delivery_ref: podRef || 'POD-CONFIRMED',
      });

      if (res.success) {
        setActionMessage({
          type: 'success',
          text: isDropShip
            ? `Drop-ship delivery confirmed! Customer Sales Order updated directly with zero office inventory inflation.`
            : `Material receipt processed! Office inventory incremented and GRN recorded.`,
        });
        setIsReceiveModalOpen(false);
        await loadAll();
      } else {
        setActionMessage({
          type: 'error',
          text: res.error || 'Failed to receive PO',
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleExportCSV = () => {
    exportToCSV('ICON_Purchase_Orders', pos, [
      { key: 'po_number', label: 'PO #' },
      { key: 'supplier_name', label: 'Supplier' },
      { key: 'order_date', label: 'Order Date' },
      { key: 'delivery_type', label: 'Delivery Mode' },
      { key: 'consignee_name', label: 'Consignee' },
      { key: 'total_amount', label: 'Total Amount (₹)' },
      { key: 'status', label: 'Status' },
      { key: 'created_by_name', label: 'Issued By' },
    ]);
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">
              Procurement & Vendor Directory
            </h1>
            <span className="px-2.5 py-0.5 rounded-full bg-brand-50 text-brand-700 border border-brand-200 text-xs font-bold">
              {pos.length} Purchase Orders
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Reseller lean procurement: backorder-driven PO generation, distributor drop-shipping & office receipt GRNs
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={handleExportCSV}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-100 bg-white text-slate-700 text-xs font-bold shadow-xs transition"
          >
            <Download className="w-4 h-4 text-slate-500" />
            <span>Export CSV</span>
          </button>
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
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          )}
          <span>{actionMessage.text}</span>
        </div>
      )}

      {/* Tab Switcher */}
      <div className="flex items-center gap-1 p-1 bg-slate-200/70 rounded-xl text-xs font-bold w-fit">
        <button
          onClick={() => setActiveTab('orders')}
          className={`px-3.5 py-1.5 rounded-lg transition ${
            activeTab === 'orders'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Purchase Orders ({pos.length})
        </button>
        <button
          onClick={() => setActiveTab('backorders')}
          className={`px-3.5 py-1.5 rounded-lg transition flex items-center gap-1.5 ${
            activeTab === 'backorders'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <span>Backorder Requisitions</span>
          {backorders.length > 0 && (
            <span className="px-1.5 py-0.2 rounded-full bg-amber-100 text-amber-800 text-[10px]">
              {backorders.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('suppliers')}
          className={`px-3.5 py-1.5 rounded-lg transition ${
            activeTab === 'suppliers'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Distributor Directory ({suppliers.length})
        </button>
        <button
          onClick={() => {
            setActiveTab('intelligence');
            if (!quoteComparisonData) {
              handleCompareQuotes();
            }
          }}
          className={`px-3.5 py-1.5 rounded-lg transition flex items-center gap-1.5 ${
            activeTab === 'intelligence'
              ? 'bg-slate-800 text-white shadow-sm'
              : 'text-slate-500 hover:text-slate-800'
          }`}
          title="Historical supplier analytics (Optional - sourcing remains human)"
        >
          <Sparkles className="w-3.5 h-3.5 text-slate-400" />
          <span>Supplier Analytics (Optional)</span>
        </button>
      </div>

      {/* TAB 1: PURCHASE ORDERS */}
      {activeTab === 'orders' && (
        <div className="border border-slate-200 rounded-2xl bg-white shadow-sm overflow-hidden">
          {/* Desktop Table View - Fitted to available width without horizontal scrollbars */}
          <div className="hidden md:block w-full">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                <tr>
                  <th className="py-2.5 px-3 w-[20%]">PO Number / Date</th>
                  <th className="py-2.5 px-3 w-[28%]">Supplier / Mode</th>
                  <th className="py-2.5 px-3 w-[20%]">Items Requisitioned</th>
                  <th className="py-2.5 px-3 text-right w-[16%]">PO Total (₹)</th>
                  <th className="py-2.5 px-3 text-right w-[16%]">Status & Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {pos.map((po) => {
                  const isDropShip = po.delivery_type === 'DIRECT_CUSTOMER_DROPSHIP';
                  const isReceived = po.status === 'Received';

                  return (
                    <tr key={po.id} className="hover:bg-slate-50/70 transition">
                      <td className="py-3 px-3 align-top font-bold text-slate-900">
                        <span className="font-mono text-brand-700 font-black block">{po.po_number}</span>
                        {po.sales_order_number && (
                          <span className="text-[10px] text-slate-400 block font-normal">
                            SO: {po.sales_order_number}
                          </span>
                        )}
                        <span className="text-[11px] text-slate-500 font-normal block mt-0.5">
                          {po.order_date}
                        </span>
                      </td>

                      <td className="py-3 px-3 align-top">
                        <strong className="text-slate-900 font-bold block truncate">{po.supplier_name}</strong>
                        {po.supplier_contact && (
                          <span className="text-slate-400 text-[10.5px] block truncate">{po.supplier_contact}</span>
                        )}
                        <div className="mt-1">
                          {isDropShip ? (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
                              <Send className="w-3 h-3 text-purple-600" />
                              <span>Direct Drop-Ship</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                              <Building2 className="w-3 h-3 text-blue-600" />
                              <span>Office Receipt</span>
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="py-3 px-3 align-top">
                        <div className="space-y-0.5">
                          {po.items.slice(0, 2).map((it, idx) => (
                            <div key={idx} className="text-slate-700 truncate text-[11px]">
                              <span className="font-bold">{it.quantity}x</span> {it.product_name}
                            </div>
                          ))}
                          {po.items.length > 2 && (
                            <span className="text-[10px] text-slate-400 block font-mono">
                              +{po.items.length - 2} more items
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="py-3 px-3 align-top text-right font-black text-slate-900 font-mono text-sm">
                        ₹{Math.round(po.total_amount).toLocaleString('en-IN')}
                      </td>

                      <td className="py-3 px-3 align-top text-right space-y-1">
                        <div>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[9.5px] font-bold border inline-block ${
                              isReceived
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                                : 'bg-amber-50 text-amber-700 border-amber-300'
                            }`}
                          >
                            {po.status}
                          </span>
                        </div>

                        {!isReceived && (
                          <div className="flex items-center justify-end gap-1 pt-1">
                            <button
                              type="button"
                              onClick={() => setEditingPo(po)}
                              className="p-1 rounded-md bg-amber-50 hover:bg-amber-100 text-amber-700 font-bold transition text-[11px] border border-amber-200 shadow-2xs"
                              title="Edit PO Details"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => openReceiveModal(po)}
                              className="px-2 py-1 rounded-md bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold transition text-[10.5px] border border-emerald-200"
                            >
                              <span>{isDropShip ? 'POD' : 'GRN'}</span>
                            </button>
                          </div>
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
            {pos.map((po) => {
              const isDropShip = po.delivery_type === 'DIRECT_CUSTOMER_DROPSHIP';
              const isReceived = po.status === 'Received';
              return (
                <div key={po.id} className="pt-3 first:pt-0 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-mono text-xs font-black text-brand-700">{po.po_number}</span>
                      {po.sales_order_number && (
                        <span className="text-[10px] text-slate-400 block font-normal">SO: {po.sales_order_number}</span>
                      )}
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                        isReceived ? 'bg-emerald-50 text-emerald-700 border-emerald-300' : 'bg-amber-50 text-amber-700 border-amber-300'
                      }`}
                    >
                      {po.status}
                    </span>
                  </div>

                  <div>
                    <h4 className="font-bold text-slate-900 text-sm">{po.supplier_name}</h4>
                    <div className="mt-1 space-y-0.5 text-xs text-slate-600">
                      {po.items.map((it, idx) => (
                        <div key={idx} className="truncate">
                          <span className="font-bold">{it.quantity}x</span> {it.product_name}
                        </div>
                      ))}
                    </div>
                    <div className="flex items-center gap-2 mt-1.5 text-xs text-slate-500">
                      <span>Date: {po.order_date}</span>
                      <span>&bull;</span>
                      <span>{isDropShip ? 'Direct Drop-Ship' : 'Office Receipt'}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-xs">
                    <span className="text-slate-500 font-medium">PO Total</span>
                    <span className="font-mono font-black text-slate-900 text-sm">
                      ₹{Math.round(po.total_amount).toLocaleString('en-IN')}
                    </span>
                  </div>

                  {!isReceived && (
                    <div className="flex items-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setEditingPo(po)}
                        className="flex-1 min-h-[44px] flex items-center justify-center gap-1 rounded-xl bg-amber-50 text-amber-700 border border-amber-200 text-xs font-bold"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                        <span>Edit</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => openReceiveModal(po)}
                        className="flex-1 min-h-[44px] flex items-center justify-center gap-1 rounded-xl bg-emerald-600 text-white text-xs font-bold shadow-xs"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>{isDropShip ? 'Log Drop-Ship POD' : 'Receive GRN'}</span>
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 2: BACKORDERS / PROCUREMENT REQUISITIONS */}
      {activeTab === 'backorders' && (
        <div className="space-y-4">
          {filteredSo && (
            <div className="flex items-center justify-between p-3.5 rounded-xl bg-brand-50 border border-brand-200 text-xs text-brand-900 shadow-2xs">
              <div className="flex items-center gap-2">
                <span className="font-bold">Filtered for Sales Order:</span>
                <span className="font-mono font-bold bg-white px-2.5 py-1 rounded-md border border-brand-300 text-brand-700">
                  {filteredSo}
                </span>
                <span className="text-slate-500 text-[11px]">
                  Showing {displayedBackorders.length} items requiring procurement
                </span>
              </div>
              <button
                type="button"
                onClick={() => setFilteredSo(null)}
                className="px-2.5 py-1 rounded-lg bg-brand-100 hover:bg-brand-200 font-bold text-brand-800 transition"
              >
                Clear Filter
              </button>
            </div>
          )}

          <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200 text-xs text-amber-800 flex items-start gap-2.5">
            <Clock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <strong className="block font-bold">Reseller Just-In-Time Procurement Desk</strong>
              <span>
                These items are required for confirmed customer Sales Orders where office inventory was insufficient. Generate a Purchase Order to procure from distributors (either to Office or direct drop-ship to customer).
              </span>
            </div>
          </div>

          {displayedBackorders.length > 0 ? (
            <div className="border border-slate-200 rounded-2xl bg-white shadow-sm overflow-hidden">
              <div className="p-3.5 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-bold text-slate-700">
                  {displayedBackorders.length} Items Awaiting Distributor Procurement
                </span>
                <button
                  type="button"
                  onClick={() => openPoModal(displayedBackorders)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold shadow-xs transition"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Consolidate All into PO</span>
                </button>
              </div>

              {/* Zero-Scroll Desktop Table */}
              <div className="hidden md:block w-full">
                <table className="w-full text-left text-xs border-collapse table-fixed">
                  <colgroup>
                    <col className="w-[26%]" />
                    <col className="w-[32%]" />
                    <col className="w-[18%]" />
                    <col className="w-[12%]" />
                    <col className="w-[12%]" />
                  </colgroup>
                  <thead className="bg-slate-50/50 border-b border-slate-200 text-slate-600 font-bold">
                    <tr>
                      <th className="py-2.5 px-3">Sales Order & Customer</th>
                      <th className="py-2.5 px-3">Product Required</th>
                      <th className="py-2.5 px-3 text-center">Quantities</th>
                      <th className="py-2.5 px-3 text-center">Status</th>
                      <th className="py-2.5 px-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {displayedBackorders.map((bo, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/70 transition">
                        <td className="py-3 px-3">
                          <div className="font-mono font-bold text-brand-700">{bo.order_number}</div>
                          <div className="text-slate-900 font-semibold truncate text-[11px] mt-0.5">{bo.customer_name}</div>
                        </td>
                        <td className="py-3 px-3">
                          <strong className="text-slate-900 block truncate">{bo.product_name}</strong>
                          {bo.sku && <span className="text-[10px] text-slate-400 font-mono">{bo.sku}</span>}
                        </td>
                        <td className="py-3 px-3 text-center">
                          <div className="text-[11px] text-slate-600">
                            Ordered: <span className="font-bold text-slate-900">{bo.quantity}</span> | Res: <span className="font-bold text-emerald-700">{bo.reserved_quantity}</span>
                          </div>
                          <div className="text-xs font-black text-amber-700 mt-0.5">
                            To Procure: {bo.procurement_required_qty}
                          </div>
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                            {bo.procurement_status}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right">
                          <button
                            type="button"
                            onClick={() => openPoModal([bo])}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-brand-50 hover:bg-brand-100 text-brand-700 font-bold transition text-xs"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Raise PO</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Backorder Cards */}
              <div className="block md:hidden divide-y divide-slate-100">
                {displayedBackorders.map((bo, idx) => (
                  <div key={idx} className="p-4 space-y-3 bg-white">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="font-mono font-bold text-xs text-brand-700">{bo.order_number}</span>
                        <h4 className="font-bold text-slate-900 text-sm mt-0.5">{bo.customer_name}</h4>
                      </div>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 shrink-0">
                        {bo.procurement_status}
                      </span>
                    </div>

                    <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-xs">
                      <strong className="block text-slate-900">{bo.product_name}</strong>
                      {bo.sku && <span className="text-[10px] text-slate-400 font-mono">{bo.sku}</span>}
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-center text-xs">
                      <div className="p-2 rounded-lg bg-slate-50 border border-slate-100">
                        <span className="block text-[10px] text-slate-500 font-medium">Ordered</span>
                        <span className="font-bold text-slate-800">{bo.quantity}</span>
                      </div>
                      <div className="p-2 rounded-lg bg-emerald-50 border border-emerald-100">
                        <span className="block text-[10px] text-emerald-600 font-medium">Reserved</span>
                        <span className="font-bold text-emerald-800">{bo.reserved_quantity}</span>
                      </div>
                      <div className="p-2 rounded-lg bg-amber-50 border border-amber-100">
                        <span className="block text-[10px] text-amber-600 font-medium">To Procure</span>
                        <span className="font-black text-amber-800">{bo.procurement_required_qty}</span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => openPoModal([bo])}
                      className="w-full min-h-[44px] flex items-center justify-center gap-1.5 rounded-xl bg-brand-600 text-white font-bold text-xs shadow-xs"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Raise Purchase Order</span>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="p-8 text-center bg-white rounded-2xl border border-slate-200 text-xs text-slate-500">
              <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
              <strong className="block font-bold text-slate-800 text-sm">Zero Backorders Pending!</strong>
              <span>All confirmed sales order items are currently covered by office stock reservations.</span>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: SUPPLIERS DIRECTORY */}
      {activeTab === 'suppliers' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {suppliers.map((s) => (
            <div
              key={s.id}
              className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-3 hover:border-slate-300 transition text-xs"
            >
              <div className="flex items-center justify-between">
                <span className="px-2 py-0.5 rounded bg-slate-100 font-bold text-slate-700 text-[11px]">
                  {s.supplier_code}
                </span>
                <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-bold text-[10px]">
                  ACTIVE
                </span>
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-sm">{s.supplier_name}</h3>
                <p className="text-slate-500 text-[11px] mt-0.5">Contact: {s.contact_person}</p>
              </div>
              <div className="space-y-1 text-slate-600 border-t border-slate-100 pt-2">
                <div className="flex items-center gap-2">
                  <Phone className="w-3 h-3 text-slate-400" />
                  <span>{s.phone}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Mail className="w-3 h-3 text-slate-400" />
                  <span>{s.email}</span>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="w-3 h-3 text-slate-400" />
                  <span>{s.city}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* TAB 4: AI QUOTES & SUPPLIER SCORECARDS */}
      {activeTab === 'intelligence' && (
        <div className="space-y-6">
          {/* Section 1: AI Supplier Quote Comparison */}
          <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <Scale className="w-4 h-4 text-brand-600" />
                  <h2 className="text-sm font-bold text-slate-900">
                    AI Supplier Quote Comparison Engine
                  </h2>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Benchmark supplier offers, transparent GST calculations, lead times, and recommendation scores
                </p>
              </div>

              {/* Quick Select from Backorders */}
              {backorders.length > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-slate-500 font-semibold">Backorders:</span>
                  <select
                    onChange={(e) => {
                      const bo = backorders.find((b) => b.product_name === e.target.value);
                      if (bo) {
                        setComparisonProductName(bo.product_name);
                        setComparisonQty(bo.procurement_required_qty);
                        handleCompareQuotes(bo.product_name, bo.procurement_required_qty);
                      }
                    }}
                    className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-800 font-medium"
                  >
                    <option value="">Select Backorder Item...</option>
                    {backorders.map((bo, idx) => (
                      <option key={idx} value={bo.product_name}>
                        {bo.product_name} ({bo.procurement_required_qty} req)
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Product & Qty Selector Form */}
            <div className="flex flex-wrap items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200/80 text-xs">
              <div className="flex-1 min-w-[240px]">
                <label className="block text-[11px] font-bold text-slate-600 mb-1">Product Name / SKU</label>
                <input
                  type="text"
                  value={comparisonProductName}
                  onChange={(e) => setComparisonProductName(e.target.value)}
                  placeholder="Enter product name..."
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-medium text-slate-900 bg-white"
                />
              </div>
              <div className="w-24">
                <label className="block text-[11px] font-bold text-slate-600 mb-1">Quantity</label>
                <input
                  type="number"
                  min={1}
                  value={comparisonQty}
                  onChange={(e) => setComparisonQty(Math.max(1, Number(e.target.value) || 1))}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-bold text-slate-900 bg-white"
                />
              </div>
              <div className="self-end">
                <button
                  type="button"
                  disabled={isComparingQuotes}
                  onClick={() => handleCompareQuotes()}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs shadow-sm transition disabled:opacity-50"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                  <span>{isComparingQuotes ? 'Comparing...' : 'Compare Quotes'}</span>
                </button>
              </div>
            </div>

            {/* Comparison Quotes Table */}
            {quoteComparisonData && quoteComparisonData.quotes.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-700">
                    Supplier Quotes for: <span className="text-brand-700 font-extrabold">{quoteComparisonData.product_name}</span> ({quoteComparisonData.quantity} Units)
                  </span>
                  {quoteComparisonData.recommended_quote && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-bold">
                      <Award className="w-3.5 h-3.5 text-emerald-600" />
                      Top Recommended: {quoteComparisonData.recommended_quote.supplier_name}
                    </span>
                  )}
                </div>

                {/* Desktop Zero-Scroll Comparison Table */}
                <div className="hidden md:block w-full border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-left text-xs border-collapse table-fixed">
                    <colgroup>
                      <col className="w-[30%]" />
                      <col className="w-[30%]" />
                      <col className="w-[22%]" />
                      <col className="w-[18%]" />
                    </colgroup>
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                      <tr>
                        <th className="py-2.5 px-3">Supplier & Terms</th>
                        <th className="py-2.5 px-3">Pricing & GST Breakdown</th>
                        <th className="py-2.5 px-3 text-center">Score & Badges</th>
                        <th className="py-2.5 px-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {quoteComparisonData.quotes.map((q, idx) => (
                        <tr
                          key={idx}
                          className={`hover:bg-slate-50 transition ${
                            q.is_recommended ? 'bg-emerald-50/40 font-semibold' : ''
                          }`}
                        >
                          <td className="py-3 px-3">
                            <strong className="text-slate-900 block truncate">{q.supplier_name}</strong>
                            <div className="flex flex-wrap items-center gap-1.5 mt-1 text-[11px] text-slate-500">
                              <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 font-semibold">
                                {q.lead_time_days}d lead
                              </span>
                              <span>&bull;</span>
                              <span>{q.payment_terms_days}d credit</span>
                            </div>
                            <div className="text-[10px] text-slate-400 mt-0.5">{q.availability_status}</div>
                          </td>
                          <td className="py-3 px-3">
                            <div className="font-mono font-bold text-slate-900 text-sm">
                              ₹{q.total_cost.toLocaleString('en-IN')}
                            </div>
                            <div className="text-[11px] text-slate-500 mt-0.5">
                              Unit: ₹{q.unit_cost.toLocaleString('en-IN')} &bull; Tax: ₹{q.taxable_amount.toLocaleString('en-IN')} + GST: ₹{q.gst_amount.toLocaleString('en-IN')}
                            </div>
                          </td>
                          <td className="py-3 px-3 text-center">
                            <div className="flex flex-col items-center gap-1">
                              <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full bg-brand-50 text-brand-700 font-black text-xs">
                                Score: {q.score}
                              </span>
                              <div className="flex flex-wrap items-center justify-center gap-1">
                                {q.is_recommended && (
                                  <span className="px-1.5 py-0.2 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                                    Recommended
                                  </span>
                                )}
                                {q.is_best_price && (
                                  <span className="px-1.5 py-0.2 rounded-full bg-blue-100 text-blue-800 text-[10px] font-bold">
                                    Lowest Price
                                  </span>
                                )}
                                {q.is_fastest && (
                                  <span className="px-1.5 py-0.2 rounded-full bg-purple-100 text-purple-800 text-[10px] font-bold">
                                    Fastest
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-3 text-right">
                            <button
                              type="button"
                              onClick={() => {
                                setPoSupplierId(q.supplier_id);
                                setSelectedItemsForPo([
                                  {
                                    order_id: 'MANUAL',
                                    order_number: 'MANUAL-PO',
                                    customer_name: 'Direct Stock / Customer',
                                    product_name: q.product_name,
                                    quantity: q.quantity,
                                    reserved_quantity: 0,
                                    procurement_required_qty: q.quantity,
                                    procurement_status: 'PO_REQUIRED',
                                  },
                                ]);
                                setIsPoModalOpen(true);
                              }}
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-brand-50 hover:bg-brand-100 text-brand-700 font-bold transition text-xs"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              <span>Select Quote</span>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Comparison Cards */}
                <div className="block md:hidden space-y-3">
                  {quoteComparisonData.quotes.map((q, idx) => (
                    <div
                      key={idx}
                      className={`p-4 rounded-xl border border-slate-200 bg-white space-y-3 ${
                        q.is_recommended ? 'ring-2 ring-emerald-500 bg-emerald-50/20' : ''
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <strong className="text-slate-900 block font-bold text-sm">{q.supplier_name}</strong>
                          <span className="text-[11px] text-slate-500">{q.availability_status}</span>
                        </div>
                        <span className="px-2 py-0.5 rounded-full bg-brand-50 text-brand-700 font-black text-xs">
                          {q.score} pts
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-1">
                        {q.is_recommended && (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                            Recommended
                          </span>
                        )}
                        {q.is_best_price && (
                          <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 text-[10px] font-bold">
                            Lowest Price
                          </span>
                        )}
                        {q.is_fastest && (
                          <span className="px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 text-[10px] font-bold">
                            Fastest
                          </span>
                        )}
                      </div>

                      <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between text-xs">
                        <span className="text-slate-500 font-medium">Total Cost (incl. GST)</span>
                        <span className="font-mono font-black text-slate-900 text-sm">
                          ₹{q.total_cost.toLocaleString('en-IN')}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-600">
                        <div className="p-2 rounded-lg bg-slate-50">
                          <span className="block text-slate-400 text-[10px]">Lead Time</span>
                          <span className="font-bold text-slate-800">{q.lead_time_days} days</span>
                        </div>
                        <div className="p-2 rounded-lg bg-slate-50">
                          <span className="block text-slate-400 text-[10px]">Payment Terms</span>
                          <span className="font-bold text-slate-800">{q.payment_terms_days} days</span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setPoSupplierId(q.supplier_id);
                          setSelectedItemsForPo([
                            {
                              order_id: 'MANUAL',
                              order_number: 'MANUAL-PO',
                              customer_name: 'Direct Stock / Customer',
                              product_name: q.product_name,
                              quantity: q.quantity,
                              reserved_quantity: 0,
                              procurement_required_qty: q.quantity,
                              procurement_status: 'PO_REQUIRED',
                            },
                          ]);
                          setIsPoModalOpen(true);
                        }}
                        className="w-full min-h-[44px] flex items-center justify-center gap-1.5 rounded-xl bg-brand-600 text-white font-bold text-xs shadow-xs"
                      >
                        <Plus className="w-4 h-4" />
                        <span>Select This Quote</span>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Section 2: Supplier Performance Scorecards */}
          <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-emerald-600" />
                  <h2 className="text-sm font-bold text-slate-900">
                    Supplier Performance Scorecards & Vendor Tiering
                  </h2>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Continuous evaluation based on on-time delivery rates, quality compliance, and total spend
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {supplierPerformance.map((sp) => {
                const isPreferred = sp.tier === 'TIER_1_PREFERRED';
                const isStandard = sp.tier === 'TIER_2_STANDARD';
                const isWatchlist = sp.tier === 'TIER_3_WATCHLIST';

                return (
                  <div
                    key={sp.supplier_id}
                    className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 hover:border-slate-300 transition space-y-3 text-xs"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="font-bold text-slate-900 text-sm">{sp.supplier_name}</h3>
                        <span className="text-[11px] text-slate-500">Spend: ₹{sp.total_spend.toLocaleString('en-IN')}</span>
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                          isPreferred
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                            : isStandard
                            ? 'bg-blue-50 text-blue-700 border-blue-300'
                            : isWatchlist
                            ? 'bg-amber-50 text-amber-700 border-amber-300'
                            : 'bg-rose-50 text-rose-700 border-rose-300'
                        }`}
                      >
                        {sp.tier.replace('TIER_', 'Tier ').replace('_', ' ')}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 py-2 border-y border-slate-200/80 text-center">
                      <div>
                        <span className="text-[10px] text-slate-500 block">Rating</span>
                        <strong className="text-slate-900 text-sm font-black">{sp.overall_rating}/100</strong>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 block">On-Time</span>
                        <strong className="text-emerald-700 text-sm font-black">{sp.on_time_delivery_rate}%</strong>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 block">POs Fulfilled</span>
                        <strong className="text-slate-900 text-sm font-black">
                          {sp.fulfilled_pos}/{sp.total_pos}
                        </strong>
                      </div>
                    </div>

                    <p className="text-[11px] text-slate-600 italic">
                      &quot;{sp.recommendation}&quot;
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* MODAL: CREATE PURCHASE ORDER */}
      {isPoModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-xl max-h-[90vh] overflow-y-auto p-6 space-y-5 text-xs">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Generate Purchase Order
                </h3>
                <p className="text-slate-500 text-[11px] mt-0.5">
                  Procure backordered items from authorized distributor
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsPoModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 font-bold text-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreatePoSubmit} className="space-y-4">
              {/* Selected Items Summary */}
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80 space-y-1.5">
                <span className="font-bold text-slate-700 block">Items to Procure:</span>
                {selectedItemsForPo.map((it, idx) => (
                  <div key={idx} className="flex justify-between text-[11px] text-slate-600">
                    <span>
                      {it.procurement_required_qty}x {it.product_name}
                    </span>
                    <span className="font-mono text-slate-500">Ref: {it.order_number}</span>
                  </div>
                ))}
              </div>

              {/* Distributor Selection */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">Select Distributor / Supplier *</label>
                <select
                  value={poSupplierId}
                  onChange={(e) => setPoSupplierId(e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none bg-white font-medium text-slate-800"
                >
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.supplier_name} ({s.city})
                    </option>
                  ))}
                </select>
              </div>

              {/* Delivery Mode: Office Receipt vs Drop-Ship */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">Delivery Destination Mode *</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setDeliveryType('OFFICE_RECEIPT')}
                    className={`p-3 rounded-xl border text-left transition ${
                      deliveryType === 'OFFICE_RECEIPT'
                        ? 'border-brand-500 bg-brand-50/50 text-brand-900 ring-2 ring-brand-500/20'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    <Building2 className="w-4 h-4 text-brand-600 mb-1" />
                    <strong className="block text-xs font-bold">Office Receipt</strong>
                    <span className="text-[10px] text-slate-500">Deliver to Hyderabad office, generate GRN upon arrival</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setDeliveryType('DIRECT_CUSTOMER_DROPSHIP')}
                    className={`p-3 rounded-xl border text-left transition ${
                      deliveryType === 'DIRECT_CUSTOMER_DROPSHIP'
                        ? 'border-purple-500 bg-purple-50/50 text-purple-900 ring-2 ring-purple-500/20'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    <Send className="w-4 h-4 text-purple-600 mb-1" />
                    <strong className="block text-xs font-bold">Direct Customer Drop-Ship</strong>
                    <span className="text-[10px] text-slate-500">Deliver directly from distributor to customer site</span>
                  </button>
                </div>
              </div>

              {/* Drop-Ship Consignee Fields */}
              {deliveryType === 'DIRECT_CUSTOMER_DROPSHIP' && (
                <div className="p-3.5 rounded-xl bg-purple-50/50 border border-purple-200 space-y-3">
                  <strong className="text-purple-900 font-bold block text-xs">Customer Consignee Details</strong>
                  <div>
                    <label className="block text-slate-600 text-[11px] mb-0.5">Consignee Customer / Company Name</label>
                    <input
                      type="text"
                      required
                      value={consigneeName}
                      onChange={(e) => setConsigneeName(e.target.value)}
                      className="w-full px-3 py-1.5 border border-slate-200 rounded-lg outline-none bg-white text-slate-800"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 text-[11px] mb-0.5">Customer Delivery Site Address</label>
                    <input
                      type="text"
                      required
                      value={consigneeAddress}
                      onChange={(e) => setConsigneeAddress(e.target.value)}
                      className="w-full px-3 py-1.5 border border-slate-200 rounded-lg outline-none bg-white text-slate-800"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-slate-600 text-[11px] mb-0.5">Contact Person</label>
                      <input
                        type="text"
                        value={consigneeContact}
                        onChange={(e) => setConsigneeContact(e.target.value)}
                        placeholder="Site Contact"
                        className="w-full px-3 py-1.5 border border-slate-200 rounded-lg outline-none bg-white text-slate-800"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-600 text-[11px] mb-0.5">Contact Phone</label>
                      <input
                        type="text"
                        value={consigneePhone}
                        onChange={(e) => setConsigneePhone(e.target.value)}
                        placeholder="+91..."
                        className="w-full px-3 py-1.5 border border-slate-200 rounded-lg outline-none bg-white text-slate-800"
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2.5 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setIsPoModalOpen(false)}
                  className="px-4 py-2 font-semibold text-slate-600 hover:text-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2 font-semibold text-white bg-brand-600 hover:bg-brand-700 rounded-xl transition shadow-xs disabled:opacity-50"
                >
                  {loading ? 'Issuing...' : 'Issue Purchase Order'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: RECEIVE PO / LOG DROP-SHIP POD */}
      {isReceiveModalOpen && activePoToReceive && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 space-y-5 text-xs">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  {activePoToReceive.delivery_type === 'DIRECT_CUSTOMER_DROPSHIP'
                    ? 'Confirm Drop-Ship Delivery (POD)'
                    : 'Process Office Goods Receipt (GRN)'}
                </h3>
                <p className="text-slate-500 text-[11px] mt-0.5">PO Ref: {activePoToReceive.po_number}</p>
              </div>
              <button
                type="button"
                onClick={() => setIsReceiveModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 font-bold text-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleReceivePoSubmit} className="space-y-4">
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80 space-y-1">
                <span className="font-bold text-slate-700 block">Receiving Items:</span>
                {activePoToReceive.items.map((i, idx) => (
                  <div key={idx} className="flex justify-between text-slate-600 text-[11px]">
                    <span>{i.product_name}</span>
                    <span className="font-bold">{i.quantity} units</span>
                  </div>
                ))}
              </div>

              {activePoToReceive.delivery_type === 'DIRECT_CUSTOMER_DROPSHIP' ? (
                <>
                  <div className="p-3 bg-purple-50 text-purple-900 rounded-xl border border-purple-200 text-[11px]">
                    <strong>Direct Drop-Ship Delivery:</strong> This will fulfill the customer Sales Order directly and record proof of delivery without incrementing office stock.
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Distributor Tax Invoice #</label>
                    <input
                      type="text"
                      value={distributorInvoiceNo}
                      onChange={(e) => setDistributorInvoiceNo(e.target.value)}
                      placeholder="e.g. RED/INV/2026/8941"
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Courier / Transporter</label>
                      <input
                        type="text"
                        value={courierTransporter}
                        onChange={(e) => setCourierTransporter(e.target.value)}
                        placeholder="e.g. VRL Logistics, Blue Dart"
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Docket / Tracking #</label>
                      <input
                        type="text"
                        value={trackingNumber}
                        onChange={(e) => setTrackingNumber(e.target.value)}
                        placeholder="e.g. TRK-8899214"
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Proof of Delivery (POD) Ref / Customer Sign</label>
                    <input
                      type="text"
                      value={podRef}
                      onChange={(e) => setPodRef(e.target.value)}
                      placeholder="e.g. Signed LR #4459 or Gate Entry #12"
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none"
                    />
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Distributor Delivery Challan / Invoice #</label>
                    <input
                      type="text"
                      value={vendorChallanNo}
                      onChange={(e) => setVendorChallanNo(e.target.value)}
                      placeholder="e.g. DC-99882"
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none"
                    />
                  </div>
                </>
              )}

              <div className="flex justify-end gap-2.5 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setIsReceiveModalOpen(false)}
                  className="px-4 py-2 font-semibold text-slate-600 hover:text-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2 font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition shadow-xs disabled:opacity-50"
                >
                  {loading ? 'Confirming...' : 'Confirm Receipt'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Edit Purchase Order Modal */}
      <EditPurchaseOrderModal
        isOpen={!!editingPo}
        onClose={() => setEditingPo(null)}
        po={editingPo}
        onSuccess={loadAll}
      />
    </div>
  );
}

export default function PurchasesPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-xs text-slate-500">Loading Purchases & Procurement...</div>}>
      <PurchasesContent />
    </Suspense>
  );
}
