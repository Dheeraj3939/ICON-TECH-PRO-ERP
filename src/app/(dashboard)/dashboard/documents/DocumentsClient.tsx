'use client';

import { useState, useTransition } from 'react';
import {
  FileText,
  Upload,
  Search,
  Shield,
  Clock,
  Tag,
  Download,
  AlertTriangle,
  Folder,
  CheckCircle,
  FileCheck,
  Plus,
} from 'lucide-react';
import { uploadDocument } from '@/lib/actions/documents';
import type { EnterpriseDocument, DocumentCategory, DocumentSensitivity } from '@/types/documents';

interface Props {
  initialDocs: EnterpriseDocument[];
  currentUserRole: string;
  currentUserName: string;
}

const CATEGORIES: { id: string; label: string }[] = [
  { id: 'ALL', label: 'All Documents' },
  { id: 'COMMERCIAL', label: 'Commercial & Quotes' },
  { id: 'LEGAL_CONTRACT', label: 'Contracts & Agreements' },
  { id: 'TAX_COMPLIANCE', label: 'Tax & Compliance' },
  { id: 'SERVICE_AMC', label: 'Service & AMC' },
  { id: 'TECHNICAL', label: 'Technical & Drawings' },
  { id: 'HR_EMPLOYEE', label: 'HR Documents' },
];

export function DocumentsClient({ initialDocs, currentUserRole, currentUserName }: Props) {
  const [docs, setDocs] = useState<EnterpriseDocument[]>(initialDocs);
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Filtered documents
  const filtered = docs.filter((d) => {
    if (selectedCategory !== 'ALL' && d.category !== selectedCategory) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = d.title.toLowerCase().includes(q);
      const matchNum = d.document_number.toLowerCase().includes(q);
      const matchFile = d.file_name.toLowerCase().includes(q);
      const matchEntity = d.entity_name ? d.entity_name.toLowerCase().includes(q) : false;
      const matchTags = d.tags.some((t) => t.toLowerCase().includes(q));
      if (!matchTitle && !matchNum && !matchFile && !matchEntity && !matchTags) {
        return false;
      }
    }
    return true;
  });

  const canUploadRestricted = ['Managing Director', 'Admin / BDM'].includes(currentUserRole);
  const canUploadConfidential = ['Managing Director', 'Admin / BDM', 'Accounts'].includes(currentUserRole);

  async function handleUploadSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setUploadError(null);
    const form = e.currentTarget;
    const formData = new FormData(form);

    const title = formData.get('title') as string;
    const category = formData.get('category') as DocumentCategory;
    const sensitivity = (formData.get('sensitivity') as DocumentSensitivity) || 'NORMAL';
    const expiry_date = (formData.get('expiry_date') as string) || undefined;
    const entity_name = (formData.get('entity_name') as string) || undefined;
    const tagsStr = (formData.get('tags') as string) || '';
    const tags = tagsStr.split(',').map((t) => t.trim()).filter(Boolean);

    startTransition(async () => {
      const res = await uploadDocument({
        title,
        category,
        sensitivity,
        expiry_date,
        entity_name,
        file_url: `/docs/${title.toLowerCase().replace(/[^a-z0-9]/g, '_')}.pdf`,
        file_name: `${title.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`,
        file_size_bytes: 450000,
        tags,
      });

      if (res.success && res.data) {
        setDocs((prev) => [res.data!, ...prev]);
        setIsUploadModalOpen(false);
        form.reset();
      } else {
        setUploadError(res.error || 'Failed to upload document');
      }
    });
  }

  return (
    <div className="space-y-6">
      {/* Search and Action Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by title, doc number, tags, or customer..."
            className="w-full pl-10 pr-4 py-2 bg-slate-900/80 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>

        <button
          onClick={() => setIsUploadModalOpen(true)}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white text-sm font-semibold rounded-xl shadow-lg shadow-brand-600/20 transition"
        >
          <Plus className="w-4 h-4" />
          <span>Upload Document</span>
        </button>
      </div>

      {/* Category Pills */}
      <div className="flex flex-wrap items-center gap-2 pb-2">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setSelectedCategory(cat.id)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition border ${
              selectedCategory === cat.id
                ? 'bg-brand-500 text-white border-brand-400 shadow-sm'
                : 'bg-slate-900/60 text-slate-300 border-slate-700/80 hover:bg-slate-800'
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Documents Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((doc) => {
          const isExpiringSoon =
            doc.expiry_date &&
            new Date(doc.expiry_date) > new Date() &&
            new Date(doc.expiry_date).getTime() - Date.now() < 60 * 24 * 60 * 60 * 1000;
          const isExpired = doc.expiry_date && new Date(doc.expiry_date) < new Date();

          return (
            <div
              key={doc.id}
              className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 hover:border-slate-700 flex flex-col justify-between transition group"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="p-2.5 rounded-xl bg-brand-500/10 border border-brand-500/20 text-brand-400">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap justify-end">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                        doc.sensitivity === 'RESTRICTED'
                          ? 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                          : doc.sensitivity === 'CONFIDENTIAL'
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                          : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                      }`}
                    >
                      {doc.sensitivity}
                    </span>
                    <span className="text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                      v{doc.version}
                    </span>
                  </div>
                </div>

                <div>
                  <div className="text-xs font-mono text-slate-400">{doc.document_number}</div>
                  <h3 className="text-sm font-semibold text-white group-hover:text-brand-300 transition line-clamp-2 mt-0.5">
                    {doc.title}
                  </h3>
                </div>

                {doc.entity_name && (
                  <div className="flex items-center gap-1.5 text-xs text-slate-400">
                    <Folder className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                    <span className="truncate">{doc.entity_name}</span>
                  </div>
                )}

                {doc.expiry_date && (
                  <div
                    className={`flex items-center gap-1.5 text-xs font-medium ${
                      isExpired
                        ? 'text-rose-400'
                        : isExpiringSoon
                        ? 'text-amber-400'
                        : 'text-slate-400'
                    }`}
                  >
                    {isExpired ? (
                      <AlertTriangle className="w-3.5 h-3.5" />
                    ) : (
                      <Clock className="w-3.5 h-3.5" />
                    )}
                    <span>
                      {isExpired ? 'Expired: ' : isExpiringSoon ? 'Expiring soon: ' : 'Valid until: '}
                      {doc.expiry_date}
                    </span>
                  </div>
                )}

                {doc.tags && doc.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 pt-1">
                    {doc.tags.map((tag) => (
                      <span
                        key={tag}
                        className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800/80 text-slate-400 border border-slate-700/60"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="pt-4 mt-4 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
                <span className="truncate">By {doc.uploaded_by_name}</span>
                <a
                  href={doc.file_url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-brand-400 hover:text-brand-300 font-medium"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>View</span>
                </a>
              </div>
            </div>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="p-12 text-center rounded-2xl bg-slate-900/30 border border-slate-800">
          <FileCheck className="w-10 h-10 text-slate-500 mx-auto mb-3" />
          <p className="text-sm font-semibold text-slate-300">No documents found matching criteria</p>
          <p className="text-xs text-slate-500 mt-1">Try resetting search query or category filter.</p>
        </div>
      )}

      {/* Upload Modal */}
      {isUploadModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="w-full max-w-lg p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Upload className="w-5 h-5 text-brand-400" />
                Upload to Document Center
              </h2>
              <button
                onClick={() => setIsUploadModalOpen(false)}
                className="text-slate-400 hover:text-white text-sm"
              >
                ✕
              </button>
            </div>

            {uploadError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
                {uploadError}
              </div>
            )}

            <form onSubmit={handleUploadSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Document Title *
                </label>
                <input
                  name="title"
                  required
                  placeholder="e.g. Master Service Agreement 2026-27"
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Category *
                  </label>
                  <select
                    name="category"
                    required
                    className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                  >
                    <option value="COMMERCIAL">Commercial & Quotes</option>
                    <option value="LEGAL_CONTRACT">Contracts & Agreements</option>
                    <option value="TAX_COMPLIANCE">Tax & Compliance</option>
                    <option value="SERVICE_AMC">Service & AMC</option>
                    <option value="TECHNICAL">Technical & Drawings</option>
                    <option value="HR_EMPLOYEE">HR Documents</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Sensitivity Gate *
                  </label>
                  <select
                    name="sensitivity"
                    defaultValue="NORMAL"
                    className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                  >
                    <option value="NORMAL">NORMAL (All staff)</option>
                    {canUploadConfidential && (
                      <option value="CONFIDENTIAL">CONFIDENTIAL (MD, Admin, Accounts)</option>
                    )}
                    {canUploadRestricted && (
                      <option value="RESTRICTED">RESTRICTED (MD & Admin only)</option>
                    )}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Linked Entity / Customer
                  </label>
                  <input
                    name="entity_name"
                    placeholder="e.g. Cyient Technologies"
                    className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Expiry Date (Optional)
                  </label>
                  <input
                    name="expiry_date"
                    type="date"
                    className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Tags (Comma separated)
                </label>
                <input
                  name="tags"
                  placeholder="e.g. Contract, AV, Hyderabad"
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsUploadModalOpen(false)}
                  className="px-4 py-2 text-sm text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white text-sm font-semibold rounded-xl disabled:opacity-50"
                >
                  {isPending ? 'Saving...' : 'Save Document'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
