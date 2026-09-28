'use client';

import React, { useState } from 'react';
import {
  FileText,
  Briefcase,
  Shield,
  Plus,
  Search,
  Download,
  X,
  CheckCircle2,
  Lock,
} from 'lucide-react';
import type {
  Employee,
  EmployeeDocument,
  OfferLetter,
  DocumentSensitivity,
} from '@/types/hr';
import {
  uploadEmployeeDocument,
  createOfferLetter,
  updateOfferLetterStatus,
} from '@/lib/actions/hr-documents';

interface DocumentsClientProps {
  initialDocuments: EmployeeDocument[];
  initialOffers: OfferLetter[];
  employees: Employee[];
  userRole: string;
  canManageOffers: boolean;
}

export function DocumentsClient({
  initialDocuments,
  initialOffers,
  employees,
  userRole,
  canManageOffers,
}: DocumentsClientProps) {
  const [activeTab, setActiveTab] = useState<'docs' | 'offers'>('docs');
  const [documents, setDocuments] = useState<EmployeeDocument[]>(initialDocuments);
  const [offers, setOffers] = useState<OfferLetter[]>(initialOffers);
  const [search, setSearch] = useState('');

  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isOfferModalOpen, setIsOfferModalOpen] = useState(false);

  const [uploadForm, setUploadForm] = useState({
    employee_id: employees[0]?.id || '',
    document_type: 'ID Proof' as EmployeeDocument['document_type'],
    document_name: '',
    file_url: '/documents/employees/sample.pdf',
    sensitivity: 'NORMAL' as DocumentSensitivity,
    notes: '',
  });

  const [offerForm, setOfferForm] = useState({
    candidate_name: '',
    offer_date: new Date().toISOString().split('T')[0],
    joining_date: new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0],
    designation: 'AV Installation Technician',
    department: 'Projects & Installations',
    work_location: 'Hyderabad Sites',
    annual_ctc: 360000,
  });

  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setMessage('');

    try {
      const res = await uploadEmployeeDocument(uploadForm);
      if (res.success && res.document) {
        setDocuments((prev) => [res.document!, ...prev]);
        setMessage('Document uploaded successfully!');
        setTimeout(() => {
          setIsUploadModalOpen(false);
          setMessage('');
        }, 1000);
      }
    } catch (err: any) {
      setMessage(`Error: ${err?.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleOfferSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setMessage('');

    try {
      const res = await createOfferLetter(offerForm);
      if (res.success && res.offerLetter) {
        setOffers((prev) => [res.offerLetter!, ...prev]);
        setMessage(`Offer letter ${res.offerLetter.offer_letter_number} created!`);
        setTimeout(() => {
          setIsOfferModalOpen(false);
          setMessage('');
        }, 1000);
      }
    } catch (err: any) {
      setMessage(`Error: ${err?.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleOfferStatus = async (offerId: string, status: OfferLetter['status']) => {
    try {
      const res = await updateOfferLetterStatus(offerId, status);
      if (res.success) {
        setOffers((prev) =>
          prev.map((o) =>
            o.id === offerId || o.offer_letter_number === offerId ? { ...o, status } : o
          )
        );
      }
    } catch (err: any) {
      alert(`Error updating offer status: ${err?.message}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Sub-Tab Navigation */}
      <div className="flex items-center justify-between border-b border-slate-200">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('docs')}
            className={`px-4 py-2.5 text-xs font-bold border-b-2 transition cursor-pointer ${
              activeTab === 'docs'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            Employee Documents Vault ({documents.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('offers')}
            className={`px-4 py-2.5 text-xs font-bold border-b-2 transition cursor-pointer ${
              activeTab === 'offers'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            Employment Offer Letters ({offers.length})
          </button>
        </div>

        <div className="mb-1.5 flex items-center gap-2">
          {activeTab === 'docs' ? (
            <button
              type="button"
              onClick={() => setIsUploadModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-xs transition cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Upload Document</span>
            </button>
          ) : (
            canManageOffers && (
              <button
                type="button"
                onClick={() => setIsOfferModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-xs transition cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Create Offer Letter</span>
              </button>
            )
          )}
        </div>
      </div>

      {/* TAB 1: DOCUMENTS VAULT */}
      {activeTab === 'docs' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {documents.map((doc) => (
              <div
                key={doc.id}
                className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        doc.sensitivity === 'FINANCIAL'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : doc.sensitivity === 'CONFIDENTIAL'
                          ? 'bg-purple-50 text-purple-700 border border-purple-200'
                          : 'bg-slate-100 text-slate-700 border border-slate-200'
                      }`}
                    >
                      {doc.sensitivity}
                    </span>
                    <span className="text-[11px] text-slate-400 font-mono">
                      {doc.uploaded_at.split('T')[0]}
                    </span>
                  </div>

                  <h4 className="text-sm font-bold text-slate-900 line-clamp-1">{doc.document_name}</h4>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {doc.document_type} &bull; {doc.employee_name || 'Staff'}
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                  <span className="text-slate-400 text-[11px]">By: {doc.uploaded_by}</span>
                  <a
                    href={doc.file_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-indigo-600 font-semibold hover:text-indigo-800"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>View File</span>
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 2: OFFER LETTERS */}
      {activeTab === 'offers' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {/* Desktop Zero-Scroll Table */}
        <div className="hidden md:block">
          <table className="w-full text-xs text-left table-fixed">
            <colgroup>
              <col className="w-[18%]" />
              <col className="w-[20%]" />
              <col className="w-[18%]" />
              <col className="w-[16%]" />
              <col className="w-[12%]" />
              <col className="w-[10%]" />
              <col className="w-[6%]" />
            </colgroup>
            <thead className="bg-slate-50 text-slate-700 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200">
              <tr>
                <th className="px-4 py-3">Offer Number</th>
                <th className="px-4 py-3">Candidate</th>
                <th className="px-4 py-3">Designation & Dept</th>
                <th className="px-4 py-3">Offered CTC</th>
                <th className="px-4 py-3">Joining Date</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {offers.map((off) => (
                <tr key={off.id} className="hover:bg-slate-50/50">
                  <td className="px-4 py-3 font-mono font-bold text-indigo-700 truncate">{off.offer_letter_number}</td>
                  <td className="px-4 py-3 font-bold text-slate-900 truncate">{off.candidate_name}</td>
                  <td className="px-4 py-3 text-slate-700 truncate">
                    {off.designation} &bull; {off.department}
                  </td>
                  <td className="px-4 py-3 font-mono font-bold text-slate-800">
                    ₹{off.annual_ctc.toLocaleString('en-IN')} / yr
                  </td>
                  <td className="px-4 py-3 text-slate-600 truncate">{off.joining_date}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                        off.status === 'Accepted'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : off.status === 'Issued'
                          ? 'bg-sky-50 text-sky-700 border border-sky-200'
                          : 'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}
                    >
                      {off.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {canManageOffers && (
                      <div className="flex items-center justify-end gap-1.5">
                        {off.status === 'Draft' && (
                          <button
                            type="button"
                            onClick={() => handleOfferStatus(off.id, 'Issued')}
                            className="px-2 py-0.5 text-[11px] font-semibold text-sky-700 bg-sky-50 rounded hover:bg-sky-100 cursor-pointer"
                          >
                            Issue
                          </button>
                        )}
                        {off.status === 'Issued' && (
                          <button
                            type="button"
                            onClick={() => handleOfferStatus(off.id, 'Accepted')}
                            className="px-2 py-0.5 text-[11px] font-bold text-emerald-700 bg-emerald-50 rounded hover:bg-emerald-100 cursor-pointer"
                          >
                            Accept
                          </button>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile Zero-Scroll Cards */}
        <div className="block md:hidden space-y-3 p-3">
          {offers.map((off) => (
            <div key={off.id} className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="font-bold text-slate-900 block text-xs">{off.candidate_name}</span>
                  <span className="font-mono text-[10px] text-indigo-700 font-bold">{off.offer_letter_number}</span>
                </div>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                    off.status === 'Accepted'
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : off.status === 'Issued'
                      ? 'bg-sky-50 text-sky-700 border border-sky-200'
                      : 'bg-amber-50 text-amber-700 border border-amber-200'
                  }`}
                >
                  {off.status}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="col-span-2">
                  <span className="text-[10px] text-slate-400 block">Designation & Department:</span>
                  <span className="font-medium text-slate-800">{off.designation} &bull; {off.department}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block">Offered CTC:</span>
                  <span className="font-mono font-bold text-slate-900">₹{off.annual_ctc.toLocaleString('en-IN')} / yr</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block">Joining Date:</span>
                  <span className="font-medium text-slate-700">{off.joining_date}</span>
                </div>
              </div>

              {canManageOffers && (off.status === 'Draft' || off.status === 'Issued') && (
                <div className="pt-2 border-t border-slate-200/70">
                  {off.status === 'Draft' && (
                    <button
                      type="button"
                      onClick={() => handleOfferStatus(off.id, 'Issued')}
                      className="w-full min-h-[44px] flex items-center justify-center rounded-lg bg-sky-600 text-white hover:bg-sky-700 text-xs font-bold transition"
                    >
                      Issue Offer Letter
                    </button>
                  )}
                  {off.status === 'Issued' && (
                    <button
                      type="button"
                      onClick={() => handleOfferStatus(off.id, 'Accepted')}
                      className="w-full min-h-[44px] flex items-center justify-center rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 text-xs font-bold transition"
                    >
                      Mark as Candidate Accepted
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
        </div>
      )}

      {/* Upload Document Modal */}
      {isUploadModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden p-6 space-y-4">
            <h3 className="text-sm font-bold text-slate-900">Upload Employee Document</h3>

            {message && (
              <div className="p-2.5 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-medium">
                {message}
              </div>
            )}

            <form onSubmit={handleUploadSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Select Employee</label>
                <select
                  value={uploadForm.employee_id}
                  onChange={(e) => setUploadForm({ ...uploadForm, employee_id: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg"
                >
                  {employees.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.full_name} ({e.employee_id})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Document Category</label>
                <select
                  value={uploadForm.document_type}
                  onChange={(e) =>
                    setUploadForm({
                      ...uploadForm,
                      document_type: e.target.value as EmployeeDocument['document_type'],
                    })
                  }
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg"
                >
                  <option value="ID Proof">ID Proof (Aadhaar/PAN)</option>
                  <option value="Appointment Letter">Appointment Letter</option>
                  <option value="Salary Revision Letter">Salary Revision Letter</option>
                  <option value="Qualification Certificate">Qualification Certificate</option>
                  <option value="Experience Certificate">Experience Certificate</option>
                  <option value="Bank Document">Bank Passbook / Cancelled Cheque</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Document Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Aadhaar Card Verification"
                  value={uploadForm.document_name}
                  onChange={(e) => setUploadForm({ ...uploadForm, document_name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Sensitivity Tier *</label>
                <select
                  value={uploadForm.sensitivity}
                  onChange={(e) =>
                    setUploadForm({
                      ...uploadForm,
                      sensitivity: e.target.value as DocumentSensitivity,
                    })
                  }
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-bold text-indigo-700"
                >
                  <option value="NORMAL">NORMAL (Basic identification)</option>
                  <option value="CONFIDENTIAL">CONFIDENTIAL (Employment agreements)</option>
                  <option value="FINANCIAL">FINANCIAL (Salary & compensation)</option>
                  <option value="RESTRICTED">RESTRICTED (Executive only)</option>
                </select>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsUploadModalOpen(false)}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-600 bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-xs"
                >
                  {submitting ? 'Uploading...' : 'Save Document'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Offer Letter Modal */}
      {isOfferModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden p-6 space-y-4">
            <h3 className="text-sm font-bold text-slate-900">Create Employment Offer Letter</h3>

            {message && (
              <div className="p-2.5 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-medium">
                {message}
              </div>
            )}

            <form onSubmit={handleOfferSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Candidate Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. S. Srinivas"
                  value={offerForm.candidate_name}
                  onChange={(e) => setOfferForm({ ...offerForm, candidate_name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Designation</label>
                  <input
                    type="text"
                    required
                    value={offerForm.designation}
                    onChange={(e) => setOfferForm({ ...offerForm, designation: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Annual CTC (₹)</label>
                  <input
                    type="number"
                    required
                    value={offerForm.annual_ctc}
                    onChange={(e) => setOfferForm({ ...offerForm, annual_ctc: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Offer Date</label>
                  <input
                    type="date"
                    value={offerForm.offer_date}
                    onChange={(e) => setOfferForm({ ...offerForm, offer_date: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Joining Date</label>
                  <input
                    type="date"
                    value={offerForm.joining_date}
                    onChange={(e) => setOfferForm({ ...offerForm, joining_date: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg"
                  />
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsOfferModalOpen(false)}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-600 bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-xs"
                >
                  {submitting ? 'Creating...' : 'Draft Offer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
