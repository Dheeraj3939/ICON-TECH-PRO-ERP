'use client';

import React, { useState, useEffect } from 'react';
import { Repeat, Plus, Calendar, Clock, CheckCircle2 } from 'lucide-react';
import { getRentals, createRentalAgreement } from '@/lib/actions/services';
import type { EquipmentRental } from '@/types/erp';

export default function RentalPage() {
  const [rentals, setRentals] = useState<EquipmentRental[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const [newRental, setNewRental] = useState({
    customer_name: '',
    product_name: 'Epson 4500 Lumens Full HD Projector + Tripod Screen',
    serial_number: 'EPS-PROJ-DEMO-02',
    start_date: new Date().toISOString().split('T')[0],
    end_date: new Date(Date.now() + 3 * 86400000).toISOString().split('T')[0],
    security_deposit: 15000,
    rental_fee: 4500,
  });

  const loadData = async () => {
    const res = await getRentals();
    setRentals(res);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await createRentalAgreement({
      ...newRental,
      security_deposit: Number(newRental.security_deposit),
      rental_fee: Number(newRental.rental_fee),
    });
    setIsModalOpen(false);
    loadData();
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">
              Equipment Rental Operations
            </h1>
            <span className="px-2.5 py-0.5 rounded-full bg-brand-50 text-brand-700 border border-brand-200 text-xs font-bold">
              ICON Rental Solutions
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Short-term and monthly rental fleet for corporate events, seminars, projectors, audio gear, and screens
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold shadow-md shadow-brand-500/20 transition self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>New Rental Agreement</span>
        </button>
      </div>

      {/* Rentals Zero-Scroll Register */}
      <div className="border border-slate-200 rounded-2xl bg-white shadow-sm overflow-hidden">
        {/* Desktop Zero-Scroll Table */}
        <div className="hidden md:block w-full">
          <table className="w-full text-left text-xs border-collapse table-fixed">
            <colgroup>
              <col className="w-[26%]" />
              <col className="w-[30%]" />
              <col className="w-[24%]" />
              <col className="w-[20%]" />
            </colgroup>
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
              <tr>
                <th className="py-2.5 px-3">Agreement & Customer</th>
                <th className="py-2.5 px-3">Rented Equipment</th>
                <th className="py-2.5 px-3">Duration & Deposit</th>
                <th className="py-2.5 px-3 text-right">Rental Fee & Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {rentals.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50/70 transition">
                  <td className="py-3 px-3">
                    <div className="font-mono font-bold text-slate-900">{r.rental_number}</div>
                    <div className="font-semibold text-slate-800 truncate text-[11px] mt-0.5">{r.customer_name}</div>
                  </td>
                  <td className="py-3 px-3">
                    <div className="font-medium text-slate-800 truncate">{r.product_name}</div>
                    {r.serial_number && (
                      <span className="font-mono text-slate-400 text-[10px] block truncate">
                        Unit S/N: {r.serial_number}
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-3">
                    <div className="text-slate-700 font-medium">
                      {r.start_date} to {r.end_date}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      Deposit: ₹{r.security_deposit.toLocaleString('en-IN')}
                    </div>
                  </td>
                  <td className="py-3 px-3 text-right">
                    <div className="font-black text-slate-900 text-sm">
                      ₹{r.rental_fee.toLocaleString('en-IN')}
                    </div>
                    <span className="inline-block mt-1 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">
                      {r.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile Rental Cards */}
        <div className="block md:hidden divide-y divide-slate-100">
          {rentals.map((r) => (
            <div key={r.id} className="p-4 space-y-3 bg-white">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="font-mono font-bold text-xs text-brand-700">{r.rental_number}</span>
                  <h4 className="font-bold text-slate-900 text-sm mt-0.5">{r.customer_name}</h4>
                </div>
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold shrink-0">
                  {r.status}
                </span>
              </div>

              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-xs">
                <div className="font-semibold text-slate-800">{r.product_name}</div>
                {r.serial_number && (
                  <div className="font-mono text-slate-400 text-[10px] mt-0.5">Unit S/N: {r.serial_number}</div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2 rounded-lg bg-slate-50">
                  <span className="block text-slate-400 text-[10px]">Duration</span>
                  <span className="font-medium text-slate-700 text-[11px]">{r.start_date} to {r.end_date}</span>
                </div>
                <div className="p-2 rounded-lg bg-slate-50">
                  <span className="block text-slate-400 text-[10px]">Security Deposit</span>
                  <span className="font-bold text-slate-800">₹{r.security_deposit.toLocaleString('en-IN')}</span>
                </div>
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-xl bg-brand-50/50 border border-brand-100 text-xs">
                <span className="text-slate-600 font-medium">Rental Fee</span>
                <span className="font-mono font-black text-slate-900 text-sm">
                  ₹{r.rental_fee.toLocaleString('en-IN')}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md p-6 space-y-4 text-xs">
            <h2 className="text-base font-bold text-slate-900">Issue Rental Agreement</h2>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="block font-semibold mb-1">Customer / Organization *</label>
                <input
                  type="text"
                  required
                  value={newRental.customer_name}
                  onChange={(e) => setNewRental({ ...newRental, customer_name: e.target.value })}
                  placeholder="e.g. Hyderabad Event Tech Pvt Ltd"
                  className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">Equipment Description *</label>
                <input
                  type="text"
                  required
                  value={newRental.product_name}
                  onChange={(e) => setNewRental({ ...newRental, product_name: e.target.value })}
                  className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block font-semibold mb-1">Start Date</label>
                  <input
                    type="date"
                    value={newRental.start_date}
                    onChange={(e) => setNewRental({ ...newRental, start_date: e.target.value })}
                    className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Return Date</label>
                  <input
                    type="date"
                    value={newRental.end_date}
                    onChange={(e) => setNewRental({ ...newRental, end_date: e.target.value })}
                    className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block font-semibold mb-1">Security Deposit (₹)</label>
                  <input
                    type="number"
                    value={newRental.security_deposit}
                    onChange={(e) => setNewRental({ ...newRental, security_deposit: Number(e.target.value) })}
                    className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg outline-none font-bold"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Rental Fee (₹)</label>
                  <input
                    type="number"
                    value={newRental.rental_fee}
                    onChange={(e) => setNewRental({ ...newRental, rental_fee: Number(e.target.value) })}
                    className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg outline-none font-bold text-brand-700"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 font-semibold text-slate-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 font-semibold text-white bg-brand-600 hover:bg-brand-700 rounded-xl"
                >
                  Create Rental
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
