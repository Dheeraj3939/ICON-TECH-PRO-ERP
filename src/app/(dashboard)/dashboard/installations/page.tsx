'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  Wrench,
  Calendar,
  User,
  CheckCircle2,
  Clock,
  Plus,
  AlertCircle,
  FileCheck,
  CheckSquare,
  Square,
  ChevronRight,
  MapPin,
  Phone,
  ShieldCheck,
  ClipboardList,
} from 'lucide-react';
import {
  getInstallations,
  createInstallation,
  updateInstallationJobCard,
  completeInstallationHandover,
} from '@/lib/actions/operations';
import type { Installation } from '@/types/erp';

function InstallationsContent() {
  const searchParams = useSearchParams();
  const custParam = searchParams?.get('customer_name');
  const challanParam = searchParams?.get('challan');
  const orderParam = searchParams?.get('order_ref');

  const [installations, setInstallations] = useState<Installation[]>([]);
  const [selectedJobCard, setSelectedJobCard] = useState<Installation | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // New installation state
  const [newIns, setNewIns] = useState({
    customer_name: '',
    customer_id: 'CUST-HYD-01',
    order_number: '',
    lead_technician_name: 'Praveen (Lead AV Engineer)',
    scheduled_date: new Date().toISOString().split('T')[0],
    site_address: 'Banjara Hills Site, Hyderabad, Telangana',
    site_contact_person: '',
    site_contact_phone: '',
    remarks: '',
  });

  useEffect(() => {
    if (custParam || challanParam || orderParam) {
      setNewIns((prev) => ({
        ...prev,
        customer_name: custParam || prev.customer_name,
        order_number: orderParam || prev.order_number,
        remarks: challanParam ? `Scheduled from Delivery Challan: ${challanParam}` : prev.remarks,
      }));
      setIsCreateModalOpen(true);
    }
  }, [custParam, challanParam, orderParam]);

  // Handover state
  const [customerSignoffBy, setCustomerSignoffBy] = useState('');
  const [handoverNotes, setHandoverNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadData = async () => {
    const list = await getInstallations();
    setInstallations(list);
    // If a job card is currently open, refresh its data in place
    if (selectedJobCard) {
      const updated = list.find((i) => i.id === selectedJobCard.id);
      if (updated) setSelectedJobCard(updated);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      setActionMessage(null);
      const res = await createInstallation({
        ...newIns,
        installed_products: [
          { product_name: 'Epson 4K Laser Projector', sku: 'EP-4K-980', quantity: 1 },
          { product_name: 'Motorized Projection Screen 120"', sku: 'SCR-120-MOT', quantity: 1 },
        ],
      });

      if (res.success && res.data) {
        setActionMessage({
          type: 'success',
          text: `Installation Job Card ${res.data.installation_number} created successfully!`,
        });
        setIsCreateModalOpen(false);
        await loadData();
      } else {
        setActionMessage({
          type: 'error',
          text: res.error || 'Failed to create installation',
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleToggleChecklist = async (checkId: string) => {
    if (!selectedJobCard || !selectedJobCard.checklist) return;

    const newChecklist = selectedJobCard.checklist.map((item) =>
      item.id === checkId ? { ...item, completed: !item.completed } : item
    );

    const allDone = newChecklist.every((item) => item.completed);
    const newStatus = allDone ? 'COMPLETED' : 'IN_PROGRESS';

    // Optimistic update
    setSelectedJobCard({
      ...selectedJobCard,
      checklist: newChecklist,
      status: newStatus as any,
    });

    await updateInstallationJobCard(selectedJobCard.id, {
      checklist: newChecklist,
      status: newStatus,
    });

    await loadData();
  };

  const handleCompleteHandover = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedJobCard || !customerSignoffBy.trim()) return;

    try {
      setLoading(true);
      setActionMessage(null);
      const res = await completeInstallationHandover(selectedJobCard.id, {
        customer_signoff_by: customerSignoffBy.trim(),
        customer_signoff_date: new Date().toISOString().split('T')[0],
        handover_notes: handoverNotes || 'System tested, accepted, and operational handover certificate signed.',
      });

      if (res.success) {
        setActionMessage({
          type: 'success',
          text: `Customer sign-off & handover recorded for ${selectedJobCard.installation_number}!`,
        });
        await loadData();
      } else {
        setActionMessage({
          type: 'error',
          text: res.error || 'Failed to complete handover',
        });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">
              Project Installations & Commissioning
            </h1>
            <span className="px-2.5 py-0.5 rounded-full bg-brand-50 text-brand-700 border border-brand-200 text-xs font-bold">
              {installations.length} Active Job Cards
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Reseller systems integration: job card tracking, technical execution checklist, and formal customer handover sign-off
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsCreateModalOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold shadow-xs transition"
        >
          <Plus className="w-4 h-4" />
          <span>New Installation Job Card</span>
        </button>
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

      {/* Installations Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {installations.map((ins) => {
          const completedTasks = ins.checklist?.filter((c) => c.completed).length || 0;
          const totalTasks = ins.checklist?.length || 5;
          const isDone = ins.handover_status === 'HANDED_OVER' || ins.status === 'COMPLETED';

          return (
            <div
              key={ins.id}
              onClick={() => {
                setSelectedJobCard(ins);
                setCustomerSignoffBy(ins.customer_signoff_by || '');
                setHandoverNotes(ins.handover_notes || '');
              }}
              className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-3.5 hover:border-brand-300 hover:shadow-md transition text-xs cursor-pointer group"
            >
              <div className="flex items-center justify-between">
                <span className="px-2 py-0.5 rounded bg-slate-100 font-mono font-bold text-slate-800">
                  {ins.installation_number}
                </span>
                <span
                  className={`px-2.5 py-0.5 rounded-full font-bold text-[10px] border ${
                    isDone
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : ins.status === 'IN_PROGRESS'
                      ? 'bg-blue-50 text-blue-700 border-blue-200'
                      : 'bg-amber-50 text-amber-700 border-amber-200'
                  }`}
                >
                  {ins.handover_status === 'HANDED_OVER' ? 'HANDED OVER' : ins.status}
                </span>
              </div>

              <div>
                <h3 className="font-bold text-slate-900 text-sm group-hover:text-brand-700 transition">
                  {ins.customer_name}
                </h3>
                {ins.order_number && (
                  <span className="text-slate-500 font-medium text-[11px]">
                    Sales Order: <span className="font-mono text-brand-600 font-bold">{ins.order_number}</span>
                  </span>
                )}
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1.5 text-slate-600">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-slate-400" />
                    <span>Lead Tech:</span>
                  </span>
                  <strong className="text-slate-800 font-semibold">{ins.lead_technician_name}</strong>
                </div>

                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    <span>Scheduled:</span>
                  </span>
                  <strong className="text-slate-800">{ins.scheduled_date}</strong>
                </div>

                {/* Checklist Progress */}
                <div className="pt-1">
                  <div className="flex justify-between text-[11px] mb-1">
                    <span className="font-medium text-slate-600">Checklist Tasks:</span>
                    <span className="font-bold text-slate-900">
                      {completedTasks}/{totalTasks}
                    </span>
                  </div>
                  <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                    <div
                      className="bg-brand-600 h-full transition-all duration-300"
                      style={{ width: `${(completedTasks / totalTasks) * 100}%` }}
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between text-brand-600 font-bold text-[11px] pt-1">
                <span>Manage Job Card</span>
                <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition" />
              </div>

              {isDone && (
                <div
                  onClick={(e) => e.stopPropagation()}
                  className="pt-2 border-t border-slate-100 flex items-center justify-between"
                >
                  <span className="text-[10px] text-emerald-700 font-bold">Post-Handover</span>
                  <Link
                    href={`/dashboard/service?action=new_amc&customer_name=${encodeURIComponent(ins.customer_name)}&installation_ref=${encodeURIComponent(ins.installation_number)}`}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold text-[11px] border border-emerald-200 transition"
                  >
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Create AMC Proposal</span>
                  </Link>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* MODAL: INTERACTIVE JOB CARD & HANDOVER */}
      {selectedJobCard && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 space-y-5 text-xs">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-black text-brand-700 text-sm">
                    {selectedJobCard.installation_number}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded-full font-bold text-[10px] border ${
                      selectedJobCard.handover_status === 'HANDED_OVER'
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-blue-50 text-blue-700 border-blue-200'
                    }`}
                  >
                    {selectedJobCard.handover_status === 'HANDED_OVER' ? 'COMPLETED & HANDED OVER' : selectedJobCard.status}
                  </span>
                </div>
                <h3 className="text-base font-bold text-slate-900 mt-1">
                  {selectedJobCard.customer_name}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedJobCard(null)}
                className="text-slate-400 hover:text-slate-600 font-bold text-lg"
              >
                ✕
              </button>
            </div>

            {/* Site & Tech Info */}
            <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
              <div>
                <span className="text-slate-500 block text-[11px]">Site Address:</span>
                <strong className="text-slate-800">{selectedJobCard.site_address || 'Hyderabad, Telangana'}</strong>
              </div>
              <div>
                <span className="text-slate-500 block text-[11px]">Lead Technician:</span>
                <strong className="text-slate-800">{selectedJobCard.lead_technician_name}</strong>
              </div>
            </div>

            {/* Equipment Installed */}
            <div className="space-y-2">
              <span className="font-bold text-slate-800 text-xs block">Equipment to Commission:</span>
              <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
                {(selectedJobCard.installed_products || [
                  { product_name: 'Epson 4K Laser Projector', sku: 'EP-4K-980', quantity: 1 },
                  { product_name: 'Motorized Projection Screen 120"', sku: 'SCR-120-MOT', quantity: 1 },
                ]).map((p, idx) => (
                  <div key={idx} className="p-2.5 flex items-center justify-between bg-white text-[11px]">
                    <span className="font-medium text-slate-800">{p.product_name}</span>
                    <span className="text-slate-500">{p.quantity} Unit(s)</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Interactive Checklist */}
            <div className="space-y-2">
              <span className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                <ClipboardList className="w-4 h-4 text-brand-600" />
                <span>Installation & Calibration Checklist (Click to Toggle):</span>
              </span>

              <div className="space-y-1.5">
                {(selectedJobCard.checklist || []).map((c) => (
                  <div
                    key={c.id}
                    onClick={() => handleToggleChecklist(c.id)}
                    className={`p-2.5 rounded-xl border flex items-center gap-3 cursor-pointer transition ${
                      c.completed
                        ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {c.completed ? (
                      <CheckSquare className="w-4 h-4 text-emerald-600 shrink-0" />
                    ) : (
                      <Square className="w-4 h-4 text-slate-400 shrink-0" />
                    )}
                    <span className={`text-xs ${c.completed ? 'font-semibold line-through text-emerald-800' : ''}`}>
                      {c.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Customer Handover Section */}
            <div className="border-t pt-4 space-y-3">
              <span className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>Customer Acceptance & Handover Sign-off:</span>
              </span>

              {selectedJobCard.handover_status === 'HANDED_OVER' ? (
                <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 space-y-1 text-[11px]">
                  <div className="flex items-center gap-1.5 font-bold text-emerald-800">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Project Handover Completed & Accepted!</span>
                  </div>
                  <p className="text-emerald-700">
                    Accepted by: <strong>{selectedJobCard.customer_signoff_by}</strong> on {selectedJobCard.customer_signoff_date}
                  </p>
                  {selectedJobCard.handover_notes && (
                    <p className="text-emerald-600 italic mt-1">
                      &ldquo;{selectedJobCard.handover_notes}&rdquo;
                    </p>
                  )}
                </div>
              ) : (
                <form onSubmit={handleCompleteHandover} className="space-y-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">Customer Representative Name *</label>
                    <input
                      type="text"
                      required
                      value={customerSignoffBy}
                      onChange={(e) => setCustomerSignoffBy(e.target.value)}
                      placeholder="e.g. Ramesh Kumar (IT Lead / Site Admin)"
                      className="w-full px-3 py-1.5 border border-slate-200 rounded-lg outline-none bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 font-bold mb-1">Handover Notes / Sign-off Certificate Ref</label>
                    <input
                      type="text"
                      value={handoverNotes}
                      onChange={(e) => setHandoverNotes(e.target.value)}
                      placeholder="e.g. Handover certificate signed. All AV equipment calibrated and tested."
                      className="w-full px-3 py-1.5 border border-slate-200 rounded-lg outline-none bg-white"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading || !customerSignoffBy.trim()}
                    className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition shadow-xs disabled:opacity-50"
                  >
                    {loading ? 'Processing Sign-off...' : 'Confirm Handover & Customer Sign-off'}
                  </button>
                </form>
              )}
            </div>

            <div className="flex justify-end items-center gap-2 pt-2 border-t">
              {(selectedJobCard.handover_status === 'HANDED_OVER' || selectedJobCard.status === 'COMPLETED') && (
                <Link
                  href={`/dashboard/service?action=new_amc&customer_name=${encodeURIComponent(selectedJobCard.customer_name)}&installation_ref=${encodeURIComponent(selectedJobCard.installation_number)}`}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition shadow-xs flex items-center gap-1.5"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>Create AMC Proposal</span>
                </Link>
              )}
              <button
                type="button"
                onClick={() => setSelectedJobCard(null)}
                className="px-4 py-2 font-semibold text-slate-600 hover:text-slate-800"
              >
                Close Job Card
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: CREATE INSTALLATION */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 space-y-5 text-xs">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-base font-bold text-slate-900">
                Schedule New Project Installation
              </h3>
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 font-bold text-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="space-y-4">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Customer / Client Name *</label>
                <input
                  type="text"
                  required
                  value={newIns.customer_name}
                  onChange={(e) => setNewIns({ ...newIns, customer_name: e.target.value })}
                  placeholder="e.g. T-Hub Foundation"
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Sales Order Ref</label>
                  <input
                    type="text"
                    value={newIns.order_number}
                    onChange={(e) => setNewIns({ ...newIns, order_number: e.target.value })}
                    placeholder="e.g. ORD260001"
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Scheduled Date *</label>
                  <input
                    type="date"
                    required
                    value={newIns.scheduled_date}
                    onChange={(e) => setNewIns({ ...newIns, scheduled_date: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Lead Technician *</label>
                <input
                  type="text"
                  required
                  value={newIns.lead_technician_name}
                  onChange={(e) => setNewIns({ ...newIns, lead_technician_name: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Installation Site Address</label>
                <input
                  type="text"
                  value={newIns.site_address}
                  onChange={(e) => setNewIns({ ...newIns, site_address: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Site Contact Person</label>
                  <input
                    type="text"
                    value={newIns.site_contact_person}
                    onChange={(e) => setNewIns({ ...newIns, site_contact_person: e.target.value })}
                    placeholder="Site Admin"
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Contact Phone</label>
                  <input
                    type="text"
                    value={newIns.site_contact_phone}
                    onChange={(e) => setNewIns({ ...newIns, site_contact_phone: e.target.value })}
                    placeholder="+91..."
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2.5 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 font-semibold text-slate-600 hover:text-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2 font-semibold text-white bg-brand-600 hover:bg-brand-700 rounded-xl transition shadow-xs disabled:opacity-50"
                >
                  {loading ? 'Creating...' : 'Schedule Installation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default function InstallationsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-xs text-slate-500">Loading Installation Operations...</div>}>
      <InstallationsContent />
    </Suspense>
  );
}
