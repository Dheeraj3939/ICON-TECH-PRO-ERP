'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  ShoppingBag,
  Search,
  CreditCard,
  Send,
  CheckCircle2,
  Clock,
  Truck,
  Download,
  ChevronDown,
  ChevronUp,
  Package,
  AlertCircle,
  ShieldAlert,
  ArrowRight,
  ExternalLink,
  Wrench,
  Pencil,
} from 'lucide-react';
import { getOrders, updateOrderStatus } from '@/lib/actions/orders';
import { createInvoiceFromOrder } from '@/lib/actions/billing';
import { createDeliveryChallan } from '@/lib/actions/operations';
import { exportToCSV } from '@/lib/utils/export';
import type { SalesOrder } from '@/types/erp';
import EditSalesOrderModal from '@/components/modals/EditSalesOrderModal';

export default function SalesOrdersPage() {
  const [orders, setOrders] = useState<SalesOrder[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [editingOrder, setEditingOrder] = useState<SalesOrder | null>(null);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadData = async () => {
    const res = await getOrders({ status: statusFilter, search });
    setOrders(res.orders);
  };

  useEffect(() => {
    loadData();
  }, [statusFilter, search]);

  const toggleExpand = (orderId: string) => {
    setExpandedOrderId((prev) => (prev === orderId ? null : orderId));
  };

  const handleCreateInvoice = async (orderId: string) => {
    try {
      setLoadingAction(`inv-${orderId}`);
      setActionMessage(null);
      const res = await createInvoiceFromOrder(orderId);
      if (res.success && res.data) {
        setActionMessage({
          type: 'success',
          text: `Tax Invoice ${res.data.invoice_number} created successfully!`,
        });
        await loadData();
      } else {
        setActionMessage({
          type: 'error',
          text: res.error || 'Failed to create invoice',
        });
      }
    } finally {
      setLoadingAction(null);
    }
  };

  const handleDispatch = async (order: SalesOrder) => {
    try {
      setLoadingAction(`dsp-${order.id}`);
      setActionMessage(null);
      const res = await createDeliveryChallan({
        order_number: order.order_number,
        customer_name: order.company_name || order.customer_name,
        shipping_address: order.shipping_address || 'Hyderabad Site, Telangana',
        dispatched_by_name: 'Operations Team',
      });
      if (res.success) {
        await updateOrderStatus(order.id, {
          dispatch_status: 'Dispatched',
          courier_tracking: 'Direct Vehicle Handover HYD',
        });
        setActionMessage({
          type: 'success',
          text: `Delivery Challan ${res.data?.delivery_challan_number || ''} issued & dispatched!`,
        });
        await loadData();
      } else {
        setActionMessage({
          type: 'error',
          text: res.error || 'Failed to dispatch order',
        });
      }
    } finally {
      setLoadingAction(null);
    }
  };

  const handleExportCSV = () => {
    exportToCSV('ICON_Sales_Orders', orders, [
      { key: 'order_number', label: 'Order #' },
      { key: 'quotation_id', label: 'Quotation Ref' },
      { key: 'customer_name', label: 'Customer Name' },
      { key: 'company_name', label: 'Company Name' },
      { key: 'order_date', label: 'Order Date' },
      { key: 'total_amount', label: 'Total Value (₹)' },
      { key: 'place_of_supply', label: 'Place of Supply' },
      { key: 'material_status', label: 'Material Status' },
      { key: 'dispatch_status', label: 'Dispatch Status' },
      { key: 'status', label: 'Order Status' },
      { key: 'invoice_id', label: 'Invoice Ref' },
      { key: 'courier_tracking', label: 'Tracking' },
    ]);
  };

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6 min-w-0">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">
              Confirmed Sales Orders
            </h1>
            <span className="px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 text-xs font-bold">
              {orders.length} Confirmed Orders
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Reseller order fulfillment: office inventory reservations, backorder tracking, drop-ship fulfillment & tax invoicing
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Link
            href="/dashboard/purchases"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-brand-200 bg-brand-50 hover:bg-brand-100 text-brand-800 text-xs font-bold shadow-xs transition"
          >
            <Truck className="w-4 h-4 text-brand-600" />
            <span>Procurement Hub</span>
          </Link>

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

      {/* Filter Bar */}
      <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search Order #, Customer, Company..."
            className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <span className="text-slate-500 font-medium">Filter Status:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-slate-200 rounded-xl outline-none bg-white font-medium text-slate-700"
          >
            <option value="ALL">All Statuses</option>
            <option value="Confirmed">Confirmed</option>
            <option value="Processing">Processing</option>
            <option value="Partially Fulfilled">Partially Fulfilled</option>
            <option value="Fulfilled">Fulfilled</option>
          </select>
        </div>
      </div>

      {/* Table */}
      {/* Table & Cards Container */}
      <div className="border border-slate-200 rounded-2xl bg-white shadow-sm overflow-hidden">
        {/* Desktop Table View - Fitted to available width without horizontal scrollbars */}
        <div className="hidden md:block w-full">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
              <tr>
                <th className="py-2.5 px-3 w-8"></th>
                <th className="py-2.5 px-3 w-[20%]">Order # / Date</th>
                <th className="py-2.5 px-3 w-[26%]">Customer / Supply</th>
                <th className="py-2.5 px-3 text-right w-[16%]">Order Value</th>
                <th className="py-2.5 px-3 text-center w-[20%]">Stock & Status</th>
                <th className="py-2.5 px-3 text-right w-[18%]">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {orders.map((o) => {
                const isExpanded = expandedOrderId === o.id;
                const poRequiredCount = o.items?.reduce(
                  (sum, it) => sum + (it.procurement_required_qty || 0),
                  0
                ) || 0;
                const totalItemsCount = o.items?.reduce((sum, it) => sum + it.quantity, 0) || 0;

                return (
                  <React.Fragment key={o.id}>
                    <tr
                      className={`hover:bg-slate-50/80 transition cursor-pointer ${
                        isExpanded ? 'bg-slate-50/60' : ''
                      }`}
                      onClick={() => toggleExpand(o.id)}
                    >
                      <td className="p-3 text-center text-slate-400">
                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4 text-brand-600" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-slate-400" />
                        )}
                      </td>

                      <td className="py-3 px-3 align-top font-bold text-slate-900">
                        <span className="font-mono text-brand-700 font-black">{o.order_number}</span>
                        {o.quotation_number && (
                          <span className="text-[10px] text-slate-400 block font-normal">
                            Quote: {o.quotation_number}
                          </span>
                        )}
                        <span className="text-[11px] text-slate-500 font-normal block mt-0.5">
                          {o.order_date}
                        </span>
                      </td>

                      <td className="py-3 px-3 align-top">
                        <strong className="text-slate-900 font-bold block truncate">
                          {o.company_name || o.customer_name}
                        </strong>
                        <span className="text-slate-500 text-[11px] block truncate">Rep: {o.salesperson_name}</span>
                        <span className="text-slate-400 text-[10px] block truncate">Supply: {o.place_of_supply || '36 - Telangana'}</span>
                      </td>

                      <td className="py-3 px-3 align-top text-right font-black text-slate-900 text-sm font-mono">
                        ₹{Math.round(o.total_amount).toLocaleString('en-IN')}
                      </td>

                      <td className="py-3 px-3 align-top text-center space-y-1">
                        <div>
                          {poRequiredCount > 0 ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9.5px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                              <Clock className="w-3 h-3 text-amber-500" />
                              <span>Backorder: {poRequiredCount}</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9.5px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                              <span>In Stock</span>
                            </span>
                          )}
                        </div>
                        <div>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[9.5px] font-bold border inline-block ${
                              o.dispatch_status === 'Installed & Handed Over'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                                : o.dispatch_status === 'Dispatched'
                                ? 'bg-blue-50 text-blue-700 border-blue-300'
                                : 'bg-slate-100 text-slate-600 border-slate-200'
                            }`}
                          >
                            {o.dispatch_status}
                          </span>
                        </div>
                      </td>

                      <td
                        className="py-3 px-3 align-top text-right"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center justify-end gap-1">
                          {o.dispatch_status === 'Not Dispatched' && !o.invoice_id && (
                            <button
                              type="button"
                              onClick={() => setEditingOrder(o)}
                              className="p-1 rounded-md bg-amber-50 hover:bg-amber-100 text-amber-700 font-bold transition text-[11px] border border-amber-200 shadow-2xs"
                              title="Edit Sales Order Details"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {!o.invoice_id ? (
                            <button
                              onClick={() => handleCreateInvoice(o.id)}
                              disabled={loadingAction === `inv-${o.id}`}
                              className="px-2 py-1 rounded-md bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold transition text-[10.5px] border border-emerald-200 disabled:opacity-50"
                            >
                              <span>{loadingAction === `inv-${o.id}` ? '...' : 'Invoice'}</span>
                            </button>
                          ) : (
                            <span className="text-[10px] font-mono font-bold text-emerald-700 bg-emerald-50/60 px-1.5 py-0.5 rounded border border-emerald-200 truncate max-w-[90px] inline-block">
                              {o.invoice_id}
                            </span>
                          )}

                          {o.dispatch_status === 'Not Dispatched' && (
                            <button
                              onClick={() => handleDispatch(o)}
                              disabled={loadingAction === `dsp-${o.id}`}
                              className="px-2 py-1 rounded-md bg-brand-50 hover:bg-brand-100 text-brand-700 font-bold transition text-[10.5px] border border-brand-200 disabled:opacity-50"
                            >
                              <span>{loadingAction === `dsp-${o.id}` ? '...' : 'Dispatch'}</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>

                    {/* Expandable Line Item Procurement Breakdown */}
                    {isExpanded && (
                      <tr className="bg-slate-50/90 border-b border-slate-200">
                        <td colSpan={6} className="p-3 sm:p-4">
                          <div className="bg-white rounded-xl border border-slate-200 p-3 sm:p-4 space-y-3 shadow-xs">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                              <div>
                                <h4 className="font-bold text-slate-900 text-xs flex items-center gap-2">
                                  <Package className="w-4 h-4 text-brand-600" />
                                  <span>Order Line Items ({totalItemsCount} units)</span>
                                </h4>
                              </div>

                              {poRequiredCount > 0 && (
                                <Link
                                  href={`/dashboard/purchases?so=${o.order_number}`}
                                  className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 rounded-lg text-xs font-bold transition w-fit"
                                >
                                  <Truck className="w-3.5 h-3.5 text-amber-600" />
                                  <span>Raise PO for Backorders</span>
                                  <ArrowRight className="w-3 h-3 text-amber-600" />
                                </Link>
                              )}
                            </div>

                            <div className="w-full">
                              <div className="divide-y divide-slate-100">
                                {(o.items || []).map((it, idx) => (
                                  <div key={idx} className="py-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                                    <div className="min-w-0 flex-1">
                                      <p className="font-bold text-slate-900 truncate">{it.product_name}</p>
                                      <p className="text-[11px] text-slate-500 font-mono">
                                        Qty: {it.quantity} &bull; Rate: ₹{it.selling_price.toLocaleString('en-IN')} &bull; Total: ₹{it.total_amount.toLocaleString('en-IN')}
                                      </p>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                      <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                        Stock: {it.reserved_quantity || 0}
                                      </span>
                                      {it.procurement_required_qty ? (
                                        <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                          PO Req: {it.procurement_required_qty}
                                        </span>
                                      ) : null}
                                      <span className="text-[10px] px-2 py-0.5 rounded font-mono bg-slate-100 text-slate-700">
                                        {it.procurement_status || 'IN_STOCK'}
                                      </span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>

                            <div className="flex flex-wrap items-center justify-between gap-3 text-[11px] text-slate-500 pt-2 border-t border-slate-100">
                              <div>
                                <span className="font-medium text-slate-700">Delivery Address: </span>
                                <span>{o.shipping_address || 'Hyderabad Site, Telangana'}</span>
                              </div>
                              <div className="flex items-center gap-3">
                                <Link
                                  href="/dashboard/installations"
                                  className="text-brand-600 font-semibold hover:underline flex items-center gap-1"
                                >
                                  <Wrench className="w-3 h-3" />
                                  <span>View Project Installations</span>
                                </Link>
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Mobile Responsive Cards View */}
        <div className="block md:hidden divide-y divide-slate-100 p-3 space-y-3">
          {orders.length === 0 ? (
            <p className="text-center text-slate-400 py-6 text-xs">No orders found.</p>
          ) : (
            orders.map((o) => {
              const poRequiredCount = o.items?.reduce(
                (sum, it) => sum + (it.procurement_required_qty || 0),
                0
              ) || 0;
              return (
                <div key={o.id} className="pt-3 first:pt-0 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-mono text-xs font-black text-brand-700">
                        {o.order_number}
                      </span>
                      {o.quotation_number && (
                        <span className="text-[10px] text-slate-400 block font-normal">
                          Quote: {o.quotation_number}
                        </span>
                      )}
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                        o.dispatch_status === 'Installed & Handed Over'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                          : o.dispatch_status === 'Dispatched'
                          ? 'bg-blue-50 text-blue-700 border-blue-300'
                          : 'bg-slate-100 text-slate-600 border-slate-200'
                      }`}
                    >
                      {o.dispatch_status}
                    </span>
                  </div>

                  <div>
                    <h4 className="font-bold text-slate-900 text-sm">
                      {o.company_name || o.customer_name}
                    </h4>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600">
                      <span><strong>Date:</strong> {o.order_date}</span>
                      <span><strong>Rep:</strong> {o.salesperson_name}</span>
                      <span><strong>Supply:</strong> {o.place_of_supply || '36 - Telangana'}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50/80 border border-slate-100 text-xs">
                    <div>
                      <span className="text-[10px] font-semibold text-slate-400 block uppercase">
                        Stock Readiness
                      </span>
                      {poRequiredCount > 0 ? (
                        <span className="text-amber-700 font-bold text-xs">
                          Backorder ({poRequiredCount} items)
                        </span>
                      ) : (
                        <span className="text-emerald-700 font-bold text-xs">
                          100% In Stock
                        </span>
                      )}
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] font-semibold text-slate-400 block uppercase">
                        Order Value
                      </span>
                      <span className="font-mono font-black text-slate-950 text-sm">
                        ₹{Math.round(o.total_amount).toLocaleString('en-IN')}
                      </span>
                    </div>
                  </div>

                  {/* Mobile Quick Action Buttons (min 44px touch targets) */}
                  <div className="flex items-center gap-2 pt-1">
                    {o.dispatch_status === 'Not Dispatched' && !o.invoice_id && (
                      <button
                        type="button"
                        onClick={() => setEditingOrder(o)}
                        className="flex-1 min-h-[44px] flex items-center justify-center gap-1 rounded-xl bg-amber-50 text-amber-700 border border-amber-200 text-xs font-bold"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                        <span>Edit</span>
                      </button>
                    )}
                    {!o.invoice_id ? (
                      <button
                        type="button"
                        onClick={() => handleCreateInvoice(o.id)}
                        disabled={loadingAction === `inv-${o.id}`}
                        className="flex-1 min-h-[44px] flex items-center justify-center gap-1 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold disabled:opacity-50"
                      >
                        <CreditCard className="w-3.5 h-3.5" />
                        <span>{loadingAction === `inv-${o.id}` ? 'Raising...' : 'Invoice'}</span>
                      </button>
                    ) : (
                      <span className="flex-1 min-h-[44px] flex items-center justify-center text-xs font-mono font-bold text-emerald-700 bg-emerald-50/60 rounded-xl border border-emerald-200">
                        {o.invoice_id}
                      </span>
                    )}
                    {o.dispatch_status === 'Not Dispatched' && (
                      <button
                        type="button"
                        onClick={() => handleDispatch(o)}
                        disabled={loadingAction === `dsp-${o.id}`}
                        className="flex-1 min-h-[44px] flex items-center justify-center gap-1 rounded-xl bg-blue-600 text-white text-xs font-bold disabled:opacity-50 shadow-xs"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>Dispatch</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
      {/* Edit Sales Order Modal */}
      <EditSalesOrderModal
        isOpen={!!editingOrder}
        onClose={() => setEditingOrder(null)}
        order={editingOrder}
        onSuccess={loadData}
      />
    </div>
  );
}
