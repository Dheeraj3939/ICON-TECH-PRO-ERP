'use client';

import React, { useState, useEffect } from 'react';
import { X, Save, AlertTriangle, Calendar, User, MapPin } from 'lucide-react';
import type { SiteVisitDetails } from '@/types/erp';
import { updateSiteVisit } from '@/lib/actions/operations';

interface EditSiteVisitModalProps {
  isOpen: boolean;
  onClose: () => void;
  visit: SiteVisitDetails | null;
  onSuccess: () => void;
}

export default function EditSiteVisitModal({
  isOpen,
  onClose,
  visit,
  onSuccess,
}: EditSiteVisitModalProps) {
  const [formData, setFormData] = useState({
    scheduledDate: '',
    assignedTechnician: '',
    roomType: 'Home Theater',
    measurements: '',
    siteAddress: '',
    notes: '',
    status: 'SCHEDULED' as 'SCHEDULED' | 'COMPLETED' | 'CANCELLED',
  });

  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (visit) {
      setFormData({
        scheduledDate: visit.scheduledDate || new Date().toISOString().split('T')[0],
        assignedTechnician: visit.assignedTechnician || '',
        roomType: visit.roomType || 'Home Theater',
        measurements: visit.measurements || '',
        siteAddress: visit.siteAddress || '',
        notes: visit.notes || '',
        status: (visit.status as any) || 'SCHEDULED',
      });
      setErrorMessage(null);
    }
  }, [visit]);

  if (!isOpen || !visit) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setErrorMessage(null);

    try {
      const visitId = visit.id || visit.visitNumber || '';
      const res = await updateSiteVisit({
        visitId,
        scheduledDate: formData.scheduledDate,
        assignedTechnician: formData.assignedTechnician.trim(),
        roomType: formData.roomType,
        measurements: formData.measurements.trim(),
        siteAddress: formData.siteAddress.trim(),
        notes: formData.notes.trim(),
        status: formData.status as any,
      });

      if (res.success) {
        onSuccess();
        onClose();
      } else {
        setErrorMessage(res.error || 'Failed to update site visit');
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
              <span>Edit Site Survey Schedule</span>
              <span className="font-mono text-xs text-brand-700 bg-brand-50 px-2 py-0.5 rounded border border-brand-200">
                {visit.visitNumber || visit.id}
              </span>
            </h2>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Update scheduled date, assigned technician, room dimensions & survey notes
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
          <div>
            <label className="block font-semibold mb-1 text-slate-700">Site Address *</label>
            <input
              type="text"
              required
              value={formData.siteAddress}
              onChange={(e) => setFormData({ ...formData, siteAddress: e.target.value })}
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:ring-2 focus:ring-brand-500 outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold mb-1 text-slate-700">Scheduled Date *</label>
              <input
                type="date"
                required
                value={formData.scheduledDate}
                onChange={(e) => setFormData({ ...formData, scheduledDate: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:ring-2 focus:ring-brand-500 outline-none"
              />
            </div>
            <div>
              <label className="block font-semibold mb-1 text-slate-700">Assigned Technician *</label>
              <input
                type="text"
                required
                value={formData.assignedTechnician}
                onChange={(e) => setFormData({ ...formData, assignedTechnician: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:ring-2 focus:ring-brand-500 outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold mb-1 text-slate-700">Room / Space Type</label>
              <select
                value={formData.roomType}
                onChange={(e) => setFormData({ ...formData, roomType: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:ring-2 focus:ring-brand-500 outline-none bg-white font-medium"
              >
                <option value="Home Theater">Home Theater</option>
                <option value="Boardroom">Boardroom</option>
                <option value="Conference Room">Conference Room</option>
                <option value="Classroom">Classroom</option>
                <option value="Auditorium">Auditorium</option>
                <option value="Living Room AV">Living Room AV</option>
                <option value="Commercial / Residential Hall">Commercial / Residential Hall</option>
              </select>
            </div>
            <div>
              <label className="block font-semibold mb-1 text-slate-700">Status</label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:ring-2 focus:ring-brand-500 outline-none bg-white font-medium"
              >
                <option value="SCHEDULED">SCHEDULED</option>
                <option value="COMPLETED">COMPLETED</option>
                <option value="CANCELLED">CANCELLED</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block font-semibold mb-1 text-slate-700">Room Measurements (L x W x H)</label>
            <input
              type="text"
              value={formData.measurements}
              onChange={(e) => setFormData({ ...formData, measurements: e.target.value })}
              placeholder="e.g. 24ft L x 18ft W x 11ft H"
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:ring-2 focus:ring-brand-500 outline-none"
            />
          </div>

          <div>
            <label className="block font-semibold mb-1 text-slate-700">Survey Notes / Instructions</label>
            <textarea
              rows={3}
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Special customer requests or site constraints..."
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
