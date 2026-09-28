'use client';

import React, { useState, useEffect } from 'react';
import { X, Save, AlertTriangle, ShieldCheck, Wrench, FileText, Shield } from 'lucide-react';
import type { ServiceTicket, AMCContract, WarrantyClaim, WarrantyClaimType, WarrantyClaimStatus } from '@/types/erp';
import { updateServiceTicket, updateAMCContract, updateWarrantyClaim } from '@/lib/actions/services';

/* ======================================================================= */
/* 1. EDIT SERVICE TICKET MODAL                                            */
/* ======================================================================= */
interface EditServiceTicketModalProps {
  isOpen: boolean;
  onClose: () => void;
  ticket: ServiceTicket | null;
  onSuccess: () => void;
}

export function EditServiceTicketModal({
  isOpen,
  onClose,
  ticket,
  onSuccess,
}: EditServiceTicketModalProps) {
  const [formData, setFormData] = useState({
    complaint_description: '',
    assigned_technician_name: '',
    priority: 'Medium' as ServiceTicket['priority'],
    status: 'Open' as ServiceTicket['status'],
    resolution_details: '',
  });

  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (ticket) {
      setFormData({
        complaint_description: ticket.complaint_description || '',
        assigned_technician_name: ticket.assigned_technician_name || '',
        priority: ticket.priority || 'Medium',
        status: ticket.status || 'Open',
        resolution_details: ticket.resolution_details || '',
      });
      setErrorMessage(null);
    }
  }, [ticket]);

  if (!isOpen || !ticket) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setErrorMessage(null);

    try {
      const res = await updateServiceTicket(ticket.id, {
        complaint_description: formData.complaint_description.trim(),
        assigned_technician_name: formData.assigned_technician_name.trim(),
        priority: formData.priority,
        status: formData.status,
        resolution_details: formData.resolution_details.trim(),
      });

      if (res.success) {
        onSuccess();
        onClose();
      } else {
        setErrorMessage(res.error || 'Failed to update service ticket');
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'An unexpected error occurred');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg p-6 space-y-4 text-xs">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <span>Edit Service Ticket</span>
              <span className="font-mono text-xs text-brand-700 bg-brand-50 px-2 py-0.5 rounded border border-brand-200">
                {ticket.ticket_number}
              </span>
            </h2>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Client: <strong>{ticket.customer_name}</strong> &bull; Equipment: <strong>{ticket.product_name || 'AV Asset'}</strong>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {errorMessage && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block font-semibold mb-1 text-slate-700">Assigned Technician</label>
              <input
                type="text"
                value={formData.assigned_technician_name}
                onChange={(e) => setFormData({ ...formData, assigned_technician_name: e.target.value })}
                placeholder="e.g. Nagaraju / Dheeraj"
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:ring-2 focus:ring-brand-500 outline-none"
              />
            </div>
            <div>
              <label className="block font-semibold mb-1 text-slate-700">Priority</label>
              <select
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: e.target.value as any })}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:ring-2 focus:ring-brand-500 outline-none bg-white font-medium"
              >
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
                <option value="Critical">Critical</option>
              </select>
            </div>
            <div>
              <label className="block font-semibold mb-1 text-slate-700">Status</label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:ring-2 focus:ring-brand-500 outline-none bg-white font-medium"
              >
                <option value="Open">Open</option>
                <option value="In Progress">In Progress</option>
                <option value="Resolved">Resolved</option>
                <option value="Closed">Closed</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block font-semibold mb-1 text-slate-700">Customer Complaint Description *</label>
            <textarea
              rows={3}
              required
              value={formData.complaint_description}
              onChange={(e) => setFormData({ ...formData, complaint_description: e.target.value })}
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:ring-2 focus:ring-brand-500 outline-none"
            />
          </div>

          <div>
            <label className="block font-semibold mb-1 text-slate-700">Resolution Details / Technician Notes</label>
            <textarea
              rows={2}
              value={formData.resolution_details}
              onChange={(e) => setFormData({ ...formData, resolution_details: e.target.value })}
              placeholder="Action taken to troubleshoot and rectify the issue..."
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:ring-2 focus:ring-brand-500 outline-none"
            />
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-brand-600 hover:bg-brand-700 rounded-lg transition shadow-xs disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{submitting ? 'Saving...' : 'Save Changes'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ======================================================================= */
/* 2. EDIT AMC CONTRACT MODAL                                              */
/* ======================================================================= */
interface EditAMCModalProps {
  isOpen: boolean;
  onClose: () => void;
  contract: AMCContract | null;
  onSuccess: () => void;
}

export function EditAMCModal({
  isOpen,
  onClose,
  contract,
  onSuccess,
}: EditAMCModalProps) {
  const [formData, setFormData] = useState({
    annual_visits_count: 4,
    sla_hours: 24,
    amc_type: 'COMPREHENSIVE' as 'COMPREHENSIVE' | 'NON_COMPREHENSIVE',
    is_active: true,
  });

  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (contract) {
      setFormData({
        annual_visits_count: contract.annual_visits_count ?? 4,
        sla_hours: contract.sla_hours ?? 24,
        amc_type: contract.amc_type || 'COMPREHENSIVE',
        is_active: contract.is_active ?? true,
      });
      setErrorMessage(null);
    }
  }, [contract]);

  if (!isOpen || !contract) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setErrorMessage(null);

    try {
      const res = await updateAMCContract(contract.id, {
        annual_visits_count: Number(formData.annual_visits_count),
        sla_hours: Number(formData.sla_hours),
        amc_type: formData.amc_type,
        is_active: formData.is_active,
      });

      if (res.success) {
        onSuccess();
        onClose();
      } else {
        setErrorMessage(res.error || 'Failed to update AMC contract');
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'An unexpected error occurred');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md p-6 space-y-4 text-xs">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <span>Edit AMC Contract</span>
              <span className="font-mono text-xs text-brand-700 bg-brand-50 px-2 py-0.5 rounded border border-brand-200">
                {contract.contract_number}
              </span>
            </h2>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Customer: <strong>{contract.customer_name}</strong> &bull; Value: <strong>₹{contract.contract_value.toLocaleString('en-IN')}</strong>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {errorMessage && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold mb-1 text-slate-700">Contract Type</label>
              <select
                value={formData.amc_type}
                onChange={(e) => setFormData({ ...formData, amc_type: e.target.value as any })}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:ring-2 focus:ring-brand-500 outline-none bg-white font-medium"
              >
                <option value="COMPREHENSIVE">Comprehensive (Parts + Labor)</option>
                <option value="NON_COMPREHENSIVE">Non-Comprehensive (Labor Only)</option>
              </select>
            </div>
            <div>
              <label className="block font-semibold mb-1 text-slate-700">Annual Visits / Year</label>
              <input
                type="number"
                min={1}
                max={52}
                value={formData.annual_visits_count}
                onChange={(e) => setFormData({ ...formData, annual_visits_count: Number(e.target.value) })}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:ring-2 focus:ring-brand-500 outline-none font-bold"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold mb-1 text-slate-700">SLA Response (Hours)</label>
              <input
                type="number"
                min={1}
                value={formData.sla_hours}
                onChange={(e) => setFormData({ ...formData, sla_hours: Number(e.target.value) })}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:ring-2 focus:ring-brand-500 outline-none"
              />
            </div>
            <div className="flex items-center pt-5">
              <label className="flex items-center gap-2 font-bold cursor-pointer text-slate-800">
                <input
                  type="checkbox"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  className="rounded text-brand-600 focus:ring-brand-500"
                />
                <span>Contract Active</span>
              </label>
            </div>
          </div>

          <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center gap-2 text-[11px] text-slate-500">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Financial billing amounts & validity terms are preserved.</span>
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-brand-600 hover:bg-brand-700 rounded-lg transition shadow-xs disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{submitting ? 'Saving...' : 'Save Changes'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ======================================================================= */
/* 3. EDIT WARRANTY CLAIM MODAL                                            */
/* ======================================================================= */
interface EditWarrantyClaimModalProps {
  isOpen: boolean;
  onClose: () => void;
  claim: WarrantyClaim | null;
  onSuccess: () => void;
}

export function EditWarrantyClaimModal({
  isOpen,
  onClose,
  claim,
  onSuccess,
}: EditWarrantyClaimModalProps) {
  const [formData, setFormData] = useState({
    serial_number: '',
    customer_name: '',
    product_name: '',
    issue_description: '',
    claim_type: 'REPAIR' as WarrantyClaimType,
    status: 'PENDING' as WarrantyClaimStatus,
  });

  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (claim) {
      setFormData({
        serial_number: claim.serial_number || '',
        customer_name: claim.customer_name || '',
        product_name: claim.product_name || '',
        issue_description: claim.issue_description || '',
        claim_type: claim.claim_type || 'REPAIR',
        status: claim.status || 'PENDING',
      });
      setErrorMessage(null);
    }
  }, [claim]);

  if (!isOpen || !claim) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setErrorMessage(null);

    try {
      const res = await updateWarrantyClaim(claim.id, {
        serial_number: formData.serial_number.trim(),
        customer_name: formData.customer_name.trim(),
        product_name: formData.product_name.trim(),
        issue_description: formData.issue_description.trim(),
        claim_type: formData.claim_type,
        status: formData.status,
      });

      if (res.success) {
        onSuccess();
        onClose();
      } else {
        setErrorMessage(res.error || 'Failed to update warranty claim');
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'An unexpected error occurred');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md p-6 space-y-4 text-xs">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <span>Edit Warranty Claim</span>
              <span className="font-mono text-xs text-brand-700 bg-brand-50 px-2 py-0.5 rounded border border-brand-200">
                {claim.claim_number}
              </span>
            </h2>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Serial: <strong>{claim.serial_number}</strong> &bull; Client: <strong>{claim.customer_name}</strong>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {errorMessage && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold mb-1 text-slate-700">Serial Number *</label>
              <input
                type="text"
                required
                value={formData.serial_number}
                onChange={(e) => setFormData({ ...formData, serial_number: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:ring-2 focus:ring-brand-500 outline-none font-mono"
              />
            </div>
            <div>
              <label className="block font-semibold mb-1 text-slate-700">Claim Type</label>
              <select
                value={formData.claim_type}
                onChange={(e) => setFormData({ ...formData, claim_type: e.target.value as any })}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:ring-2 focus:ring-brand-500 outline-none bg-white font-medium"
              >
                <option value="REPAIR">REPAIR</option>
                <option value="REPLACEMENT">REPLACEMENT</option>
                <option value="REFUND">REFUND</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold mb-1 text-slate-700">Product / Model</label>
              <input
                type="text"
                value={formData.product_name}
                onChange={(e) => setFormData({ ...formData, product_name: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:ring-2 focus:ring-brand-500 outline-none"
              />
            </div>
            <div>
              <label className="block font-semibold mb-1 text-slate-700">Status</label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:ring-2 focus:ring-brand-500 outline-none bg-white font-medium"
              >
                <option value="PENDING">PENDING</option>
                <option value="APPROVED">APPROVED</option>
                <option value="IN_REPAIR">IN_REPAIR</option>
                <option value="RESOLVED">RESOLVED</option>
                <option value="REJECTED">REJECTED</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block font-semibold mb-1 text-slate-700">Issue Description *</label>
            <textarea
              rows={3}
              required
              value={formData.issue_description}
              onChange={(e) => setFormData({ ...formData, issue_description: e.target.value })}
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:ring-2 focus:ring-brand-500 outline-none"
            />
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-brand-600 hover:bg-brand-700 rounded-lg transition shadow-xs disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{submitting ? 'Saving...' : 'Save Changes'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
