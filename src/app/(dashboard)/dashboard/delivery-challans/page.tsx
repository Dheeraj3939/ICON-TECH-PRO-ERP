'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Truck,
  Plus,
  Search,
  Printer,
  Upload,
  Download,
  Clock,
  CheckCircle2,
  XCircle,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  PackageCheck,
} from 'lucide-react';
import { getDeliveryChallans, updateDeliveryChallanStatus, cancelDeliveryChallan } from '@/lib/actions/delivery-challans';
import { PrintDeliveryChallanModal } from '@/components/modals/PrintDeliveryChallanModal';
import { NewDeliveryChallanModal } from '@/components/modals/NewDeliveryChallanModal';
import { UploadSignedDocumentModal } from '@/components/modals/UploadSignedDocumentModal';
import { exportToCSV } from '@/lib/utils/export';
import { getCurrentSessionUser } from '@/lib/actions/users';
import { canExportCSV } from '@/lib/permissions/registry';
import type { DeliveryChallan, DeliveryChallanStatus } from '@/types/delivery-challan';
import type { AuthenticatedUser } from '@/lib/auth/session';

export default function DeliveryChallansPage() {
  const [currentUser, setCurrentUser] = useState<AuthenticatedUser | null>(null);
  const [challans, setChallans] = useState<DeliveryChallan[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [purposeFilter, setPurposeFilter] = useState('ALL');
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  // Modals
  const [selectedPrintChallan, setSelectedPrintChallan] = useState<DeliveryChallan | null>(null);
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [uploadDocTarget, setUploadDocTarget] = useState<DeliveryChallan | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await getDeliveryChallans({
        status: statusFilter,
        purpose: purposeFilter !== 'ALL' ? purposeFilter : undefined,
        search,
      });
      setChallans(res.challans);
    } catch (err) {
      console.error('Failed to load delivery challans:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    getCurrentSessionUser().then(setCurrentUser);
  }, []);

  useEffect(() => {
    loadData();
  }, [statusFilter, purposeFilter, search]);

  const deliveredCount = challans.filter((c) => c.status === 'Delivered/Acknowledged').length;
  const inTransitCount = challans.filter((c) => c.status === 'Sent' || c.status === 'Issued').length;
  const demoCount = challans.filter((c) => c.purpose === 'Demo / Testing').length;

  const totalPages = Math.ceil(challans.length / pageSize) || 1;
  const paginatedChallans = challans.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const handleMarkDelivered = async (dc: DeliveryChallan) => {
    const receiver = window.prompt(`Enter receiver / facility in-charge name for ${dc.challan_number}:`, dc.customer_name);
    if (!receiver || !receiver.trim()) return;

    const notes = window.prompt('Enter acknowledgement notes (e.g. Serial numbers verified, gate pass stamped):', 'Delivered in good condition');
    const res = await updateDeliveryChallanStatus(dc.id, 'Delivered/Acknowledged', {
      receiver_name: receiver.trim(),
      receiver_acknowledgement: notes || undefined,
    });

    if (res.success) {
      loadData();
    } else {
      alert(res.error || 'Failed to update delivery status');
    }
  };

  const handleCancel = async (dc: DeliveryChallan) => {
    const reason = window.prompt(`Enter mandatory cancellation reason for ${dc.challan_number}:`);
    if (!reason || !reason.trim()) return;

    const res = await cancelDeliveryChallan(dc.id, reason.trim());
    if (res.success) {
      loadData();
    } else {
      alert(res.error || 'Failed to cancel delivery challan');
    }
  };

  const handleExportCSV = () => {
    const rows = challans.map((c) => ({
      challan_number: c.challan_number,
      date: c.challan_date,
      customer: c.customer_name,
      company: c.company_name || '',
      gstin: c.gstin || '',
      purpose: c.purpose,
      ref_type: c.reference_type || '',
      ref_number: c.reference_number || '',
      transporter: c.transporter_name || '',
      vehicle_no: c.vehicle_number || '',
      eway_bill: c.eway_bill_number || '',
      items_count: c.items.length,
      status: c.status,
      receiver: c.receiver_name || '',
    }));
    const columns = [
      { key: 'challan_no', label: 'Challan Number' },
      { key: 'date', label: 'Date' },
      { key: 'customer', label: 'Customer' },
      { key: 'company', label: 'Company' },
      { key: 'gstin', label: 'GSTIN' },
      { key: 'purpose', label: 'Purpose' },
      { key: 'ref_type', label: 'Ref Type' },
      { key: 'ref_number', label: 'Ref Number' },
      { key: 'transporter', label: 'Transporter' },
      { key: 'vehicle_no', label: 'Vehicle Number' },
      { key: 'eway_bill', label: 'E-Way Bill' },
      { key: 'items_count', label: 'Items Count' },
      { key: 'status', label: 'Status' },
      { key: 'receiver', label: 'Receiver' },
    ];
    exportToCSV(`Delivery_Challans_${new Date().toISOString().split('T')[0]}`, rows, columns);
  };

  const getStatusBadge = (status: DeliveryChallanStatus) => {
    switch (status) {
      case 'Delivered/Acknowledged':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3 h-3" />
            Delivered & POD
          </span>
        );
      case 'Issued':
      case 'Sent':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
            <Clock className="w-3 h-3" />
            {status}
          </span>
        );
      case 'Cancelled':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
            <XCircle className="w-3 h-3" />
            Cancelled
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-300">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Top Banner & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <Truck className="w-6 h-6 text-slate-800" />
              Delivery Challans
            </h1>
            <span className="px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-slate-100 text-slate-800 border border-slate-300">
              Rule 55 CGST
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Official goods movement dispatch documents for demo, orders, site installation, and job work &bull; <strong className="text-amber-800 font-semibold">Not a Tax Invoice</strong>
          </p>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          {currentUser && canExportCSV(currentUser.role) && (
            <button
              type="button"
              onClick={handleExportCSV}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-xl shadow-sm transition active:scale-95"
            >
              <Download className="w-4 h-4 text-slate-500" />
              Export CSV
            </button>
          )}

          <button
            type="button"
            onClick={() => setIsNewModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-xl shadow-md transition active:scale-95"
          >
            <Plus className="w-4 h-4" />
            Issue Delivery Challan
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Total Challans</span>
          <div className="text-xl font-extrabold text-slate-900 mt-1">{challans.length}</div>
          <span className="text-[10px] text-slate-400">Total Goods Dispatches</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Delivered & Signed POD</span>
          <div className="text-xl font-extrabold text-emerald-700 mt-1">{deliveredCount}</div>
          <span className="text-[10px] text-slate-400">Acknowledged Consignments</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Active In-Transit</span>
          <div className="text-xl font-extrabold text-blue-700 mt-1">{inTransitCount}</div>
          <span className="text-[10px] text-slate-400">Out for Site Delivery</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Demo & Testing Movements</span>
          <div className="text-xl font-extrabold text-purple-700 mt-1">{demoCount}</div>
          <span className="text-[10px] text-slate-400">Client Evaluation Units</span>
        </div>
      </div>

      {/* Search and Filters Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by challan number, customer, vehicle no, ref..."
            className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0 text-xs">
          <span className="font-semibold text-slate-500 text-[11px] shrink-0">Purpose:</span>
          {['ALL', 'Supply against Order', 'Demo / Testing', 'Site Installation'].map((pur) => (
            <button
              key={pur}
              type="button"
              onClick={() => setPurposeFilter(pur)}
              className={`px-2.5 py-1 rounded-lg font-medium whitespace-nowrap transition ${
                purposeFilter === pur
                  ? 'bg-slate-900 text-white font-bold'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {pur}
            </button>
          ))}
        </div>
      </div>

      {/* Table Container */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-700 text-[11px]">
                <th className="py-3 px-4 font-bold">Challan No</th>
                <th className="py-3 px-3 font-bold">Date</th>
                <th className="py-3 px-4 font-bold">Consignee & Destination</th>
                <th className="py-3 px-3 font-bold">Movement Purpose</th>
                <th className="py-3 px-3 font-bold">Logistics / Vehicle</th>
                <th className="py-3 px-3 font-bold text-center">Status</th>
                <th className="py-3 px-4 font-bold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    Loading delivery challans...
                  </td>
                </tr>
              ) : paginatedChallans.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-slate-400">
                    <Truck className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    No delivery challans recorded. Click "Issue Delivery Challan" to generate one.
                  </td>
                </tr>
              ) : (
                paginatedChallans.map((dc) => (
                  <tr key={dc.id} className="hover:bg-slate-50/70 transition">
                    <td className="py-3 px-4">
                      <div className="font-mono font-bold text-slate-900">{dc.challan_number}</div>
                      {dc.reference_number && (
                        <div className="text-[10px] text-slate-500 font-mono">
                          Ref: {dc.reference_number}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-3">
                      <div className="text-slate-800 font-medium">{dc.challan_date}</div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-900">{dc.customer_name}</div>
                      {dc.company_name && (
                        <div className="text-[11px] text-slate-500">{dc.company_name}</div>
                      )}
                      <div className="text-[10px] text-slate-400 truncate max-w-xs">{dc.delivery_address}</div>
                    </td>
                    <td className="py-3 px-3">
                      <span className="inline-block px-2 py-0.5 bg-slate-100 text-slate-700 font-semibold rounded text-[10px]">
                        {dc.purpose}
                      </span>
                      <div className="text-[10px] text-slate-500 mt-0.5">{dc.items.length} Product Line(s)</div>
                    </td>
                    <td className="py-3 px-3">
                      <div className="text-slate-800">{dc.transporter_name || 'Direct Vehicle'}</div>
                      {dc.vehicle_number && (
                        <div className="text-[10px] font-mono font-bold text-brand-700">{dc.vehicle_number}</div>
                      )}
                    </td>
                    <td className="py-3 px-3 text-center">{getStatusBadge(dc.status)}</td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => setSelectedPrintChallan(dc)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-lg transition"
                          title="Print / Save Two-Copy Delivery Challan"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          <span>Print</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setUploadDocTarget(dc)}
                          className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition"
                          title="Archive Signed / Stamped POD Scan"
                        >
                          <Upload className="w-3.5 h-3.5" />
                        </button>

                        {dc.status !== 'Delivered/Acknowledged' && dc.status !== 'Cancelled' && (
                          <button
                            type="button"
                            onClick={() => handleMarkDelivered(dc)}
                            className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition"
                            title="Mark Consignment Delivered & Acknowledged"
                          >
                            <PackageCheck className="w-3.5 h-3.5" />
                            <span>POD</span>
                          </button>
                        )}

                        {dc.status !== 'Cancelled' && (
                          <button
                            type="button"
                            onClick={() => handleCancel(dc)}
                            className="p-1 text-slate-400 hover:text-rose-600 rounded transition"
                            title="Cancel Challan"
                          >
                            <XCircle className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {challans.length > 0 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 bg-slate-50 text-xs">
            <span className="text-slate-500">
              Showing {(currentPage - 1) * pageSize + 1} to {Math.min(currentPage * pageSize, challans.length)} of{' '}
              {challans.length} challans
            </span>

            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="p-1.5 border border-slate-300 rounded-lg bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-40 transition"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="font-bold text-slate-700">
                {currentPage} / {totalPages}
              </span>
              <button
                type="button"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="p-1.5 border border-slate-300 rounded-lg bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-40 transition"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      <PrintDeliveryChallanModal
        challan={selectedPrintChallan}
        isOpen={Boolean(selectedPrintChallan)}
        onClose={() => setSelectedPrintChallan(null)}
      />

      <NewDeliveryChallanModal
        isOpen={isNewModalOpen}
        onClose={() => setIsNewModalOpen(false)}
        onSuccess={(created) => {
          loadData();
          setSelectedPrintChallan(created);
        }}
      />

      {uploadDocTarget && (
        <UploadSignedDocumentModal
          isOpen={Boolean(uploadDocTarget)}
          onClose={() => setUploadDocTarget(null)}
          onSuccess={() => {
            loadData();
            alert('Acknowledged delivery scan successfully archived!');
          }}
          defaultDocument={{
            document_type: 'DELIVERY_CHALLAN',
            document_number: uploadDocTarget.challan_number,
            customer_id: uploadDocTarget.customer_id,
            customer_name: uploadDocTarget.customer_name,
            company_name: uploadDocTarget.company_name,
            related_transaction_number: uploadDocTarget.reference_number,
          }}
        />
      )}
    </div>
  );
}
