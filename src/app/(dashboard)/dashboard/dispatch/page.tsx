'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Send, Truck, FileText, CheckCircle2, Clock, MapPin, Wrench, ArrowRight } from 'lucide-react';
import { getDispatches } from '@/lib/actions/operations';
import type { Dispatch } from '@/types/erp';

export default function DispatchPage() {
  const [dispatches, setDispatches] = useState<Dispatch[]>([]);

  useEffect(() => {
    getDispatches().then(setDispatches);
  }, []);

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">
              Dispatch & Delivery Challans
            </h1>
            <span className="px-2.5 py-0.5 rounded-full bg-brand-50 text-brand-700 border border-brand-200 text-xs font-bold">
              {dispatches.length} Delivery Challans
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Goods delivery challan generation (DC-26-XXXX), transporter tracking, and E-Way Bill references
          </p>
        </div>
      </div>

      {/* Dispatches Zero-Scroll Register */}
      <div className="border border-slate-200 rounded-2xl bg-white shadow-sm overflow-hidden">
        {/* Desktop Zero-Scroll Table */}
        <div className="hidden md:block w-full">
          <table className="w-full text-left text-xs border-collapse table-fixed">
            <colgroup>
              <col className="w-[22%]" />
              <col className="w-[28%]" />
              <col className="w-[22%]" />
              <col className="w-[12%]" />
              <col className="w-[16%]" />
            </colgroup>
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
              <tr>
                <th className="py-2.5 px-3">Challan & Order Ref</th>
                <th className="py-2.5 px-3">Customer & Destination</th>
                <th className="py-2.5 px-3">Logistics & E-Way Bill</th>
                <th className="py-2.5 px-3 text-center">Status</th>
                <th className="py-2.5 px-3 text-right">Workflow Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {dispatches.map((d) => (
                <tr key={d.id} className="hover:bg-slate-50/70 transition">
                  <td className="py-3 px-3">
                    <div className="font-mono font-bold text-slate-900">{d.delivery_challan_number}</div>
                    <div className="flex items-center gap-1.5 mt-0.5 text-[11px]">
                      <span className="font-semibold text-brand-700">{d.order_number || '—'}</span>
                      <span className="text-slate-400">&bull;</span>
                      <span className="font-mono text-slate-500 text-[10px]">{d.dispatch_number}</span>
                    </div>
                  </td>
                  <td className="py-3 px-3">
                    <div className="font-bold text-slate-900 truncate">{d.customer_name}</div>
                    <div className="text-slate-500 text-[11px] truncate mt-0.5">{d.shipping_address}</div>
                  </td>
                  <td className="py-3 px-3">
                    <div className="text-slate-800 font-medium truncate">{d.transporter_name}</div>
                    <div className="flex items-center gap-1.5 mt-0.5 text-[10px]">
                      {d.vehicle_number && <span className="font-mono text-slate-500">{d.vehicle_number}</span>}
                      {d.eway_bill_number && (
                        <span className="text-slate-400">E-Way: {d.eway_bill_number}</span>
                      )}
                    </div>
                  </td>
                  <td className="py-3 px-3 text-center">
                    <span className="inline-block px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 font-bold text-[10px] border border-blue-200">
                      {d.status}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-right">
                    <Link
                      href={`/dashboard/installations?customer_name=${encodeURIComponent(d.customer_name)}&challan=${encodeURIComponent(d.delivery_challan_number)}&order_ref=${encodeURIComponent(d.order_number || '')}`}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold text-xs border border-emerald-200 transition"
                    >
                      <Wrench className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Installation</span>
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile Challan Cards */}
        <div className="block md:hidden divide-y divide-slate-100">
          {dispatches.map((d) => (
            <div key={d.id} className="p-4 space-y-3 bg-white">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="font-mono font-bold text-xs text-brand-700">{d.delivery_challan_number}</span>
                  <h4 className="font-bold text-slate-900 text-sm mt-0.5">{d.customer_name}</h4>
                </div>
                <span className="px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 font-bold text-[10px] border border-blue-200 shrink-0">
                  {d.status}
                </span>
              </div>

              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-xs space-y-1">
                <div className="flex items-center justify-between text-slate-500 text-[11px]">
                  <span>Order: <strong className="text-brand-700 font-mono">{d.order_number || '—'}</strong></span>
                  <span className="font-mono text-[10px]">{d.dispatch_number}</span>
                </div>
                <p className="text-slate-600 line-clamp-2">{d.shipping_address}</p>
                <div className="flex items-center justify-between text-slate-600 pt-1 border-t border-slate-200/60 text-[11px]">
                  <span>{d.transporter_name} ({d.vehicle_number || 'N/A'})</span>
                  {d.eway_bill_number && <span className="font-mono text-[10px]">E-Way: {d.eway_bill_number}</span>}
                </div>
              </div>

              <Link
                href={`/dashboard/installations?customer_name=${encodeURIComponent(d.customer_name)}&challan=${encodeURIComponent(d.delivery_challan_number)}&order_ref=${encodeURIComponent(d.order_number || '')}`}
                className="w-full min-h-[44px] flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 text-white font-bold text-xs shadow-xs"
              >
                <Wrench className="w-4 h-4" />
                <span>Schedule Installation</span>
              </Link>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
