'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Users,
  Building2,
  User,
  Plus,
  Search,
  Filter,
  CheckCircle2,
  ChevronRight,
  Eye,
  Edit,
  ShieldCheck,
  RefreshCw,
  Sparkles,
  Download,
  UploadCloud,
  Phone,
  Mail,
} from 'lucide-react';
import { getCustomers, getSalespeopleList } from '@/lib/actions/customers';
import { CustomerFormModal } from '@/components/customers/customer-form-modal';
import { CustomerDetailDrawer } from '@/components/customers/customer-detail-drawer';
import { exportToCSV } from '@/lib/utils/export';
import type { Customer, CustomerType, CustomerStatus } from '@/types/customer';

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [counts, setCounts] = useState({ total: 0, companies: 0, individuals: 0, active: 0 });
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<CustomerType | 'ALL'>('ALL');
  const [statusFilter, setStatusFilter] = useState<CustomerStatus | 'ALL'>('ALL');
  const [salespersonFilter, setSalespersonFilter] = useState<string>('ALL');
  const [salespeople, setSalespeople] = useState<Array<{ id: string; name: string; role: string }>>([]);

  // Modal & Drawer State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editCustomer, setEditCustomer] = useState<Customer | null>(null);
  const [drawerCustomer, setDrawerCustomer] = useState<Customer | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [createdBanner, setCreatedBanner] = useState<string | null>(null);

  // Load Salespeople
  useEffect(() => {
    getSalespeopleList().then(setSalespeople);
  }, []);

  // Fetch Customers
  async function fetchList() {
    setLoading(true);
    const res = await getCustomers({
      search: search || undefined,
      customer_type: typeFilter,
      status: statusFilter,
      salesperson_id: salespersonFilter,
    });
    setCustomers(res.customers);
    setCounts(res.counts);
    setLoading(false);
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchList();
    }, 250);
    return () => clearTimeout(timer);
  }, [search, typeFilter, statusFilter, salespersonFilter]);

  function handleSuccess(saved: Customer) {
    fetchList();
    setCreatedBanner(`Customer successfully registered with Permanent ID: ${saved.customer_code}`);
    setTimeout(() => setCreatedBanner(null), 6000);
  }

  function handleOpenCreate() {
    setEditCustomer(null);
    setIsModalOpen(true);
  }

  function handleOpenEdit(cust: Customer) {
    setEditCustomer(cust);
    setIsModalOpen(true);
  }

  function handleOpenDetail(cust: Customer) {
    setDrawerCustomer(cust);
    setIsDrawerOpen(true);
  }

  function handleExportCSV() {
    exportToCSV('ICON_Customer_Master', customers, [
      { key: 'customer_code', label: 'Customer Code' },
      { key: 'customer_name', label: 'Customer Name' },
      { key: 'company_name', label: 'Company Name' },
      { key: 'customer_type', label: 'Type' },
      { key: 'phone', label: 'Phone' },
      { key: 'email', label: 'Email' },
      { key: 'city', label: 'City' },
      { key: 'state', label: 'State' },
      { key: 'gstin', label: 'GSTIN' },
      { key: 'status', label: 'Status' },
      {
        key: 'created_at',
        label: 'Registration Date',
        format: (v) => (v ? new Date(v).toLocaleDateString('en-IN') : ''),
      },
    ]);
  }

  return (
    <div className="w-full max-w-7xl mx-auto space-y-7 animate-in fade-in min-w-0">
      {/* Top Banner for Generated Customer ID */}
      {createdBanner && (
        <div className="p-4 rounded-2xl bg-emerald-500 text-white shadow-lg flex items-center justify-between animate-in slide-in-from-top duration-300">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
            <span className="font-bold text-sm">{createdBanner}</span>
          </div>
          <span className="text-xs px-2.5 py-1 rounded bg-white/20 uppercase font-bold tracking-wider">
            Annual Reset Active
          </span>
        </div>
      )}

      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="inline-flex items-center gap-2 text-xs font-semibold text-brand-600 uppercase tracking-wider mb-1">
            <ShieldCheck className="w-4 h-4" />
            <span>Enterprise Customer Master &bull; Atomic Annual Auto-ID</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Customer Master Directory
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Enterprise centralized customer records with immutable sequence generation (<code className="font-mono text-brand-700 bg-brand-50 px-1 py-0.5 rounded">ICONYYXXXX</code>).
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Link
            href="/dashboard/import"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-100 bg-white text-slate-700 text-xs font-semibold shadow-xs transition duration-150"
          >
            <UploadCloud className="w-4 h-4 text-brand-600" />
            <span>Import CSV</span>
          </Link>
          <button
            type="button"
            onClick={handleExportCSV}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-100 bg-white text-slate-700 text-xs font-semibold shadow-xs transition duration-150"
          >
            <Download className="w-4 h-4 text-slate-500" />
            <span>Export CSV</span>
          </button>
          <button
            type="button"
            onClick={handleOpenCreate}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold shadow-md shadow-brand-500/20 transition duration-150"
          >
            <Plus className="w-4 h-4" />
            <span>Add New Customer</span>
          </button>
        </div>
      </div>

      {/* 4 Metric KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
              Total Accounts
            </span>
            <Users className="w-4 h-4 text-slate-400" />
          </div>
          <p className="text-2xl font-bold text-slate-900">{counts.total}</p>
          <span className="text-[11px] text-slate-400 block">Registered in ERP</span>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-brand-700 uppercase tracking-wider">
              Corporate (B2B)
            </span>
            <Building2 className="w-4 h-4 text-brand-600" />
          </div>
          <p className="text-2xl font-bold text-brand-700">{counts.companies}</p>
          <span className="text-[11px] text-slate-400 block">GST Registered Entities</span>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-indigo-700 uppercase tracking-wider">
              Individual (B2C)
            </span>
            <User className="w-4 h-4 text-indigo-600" />
          </div>
          <p className="text-2xl font-bold text-indigo-700">{counts.individuals}</p>
          <span className="text-[11px] text-slate-400 block">Residential / Custom AV</span>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-emerald-700 uppercase tracking-wider">
              Active Status
            </span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-2xl font-bold text-emerald-700">{counts.active}</p>
          <span className="text-[11px] text-emerald-600 font-medium block">Commercial Operations</span>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-3">
        <div className="flex flex-col lg:flex-row items-center gap-3">
          {/* Search Input */}
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search Customer ID (ICON26...), Company, Name, Phone, Email, or City..."
              className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition"
            />
          </div>

          {/* Type Segment Filter Pills */}
          <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-100 rounded-xl border border-slate-200/80 w-full lg:w-auto">
            {(['ALL', 'COMPANY', 'INDIVIDUAL'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTypeFilter(t)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition ${
                  typeFilter === t
                    ? 'bg-white text-brand-700 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {t === 'ALL' ? 'All Types' : t === 'COMPANY' ? 'B2B Companies' : 'B2C Individuals'}
              </button>
            ))}
          </div>

          {/* Status Select */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            <option value="ALL">All Statuses</option>
            <option value="ACTIVE">Active Only</option>
            <option value="INACTIVE">Inactive</option>
            <option value="SUSPENDED">Suspended</option>
          </select>

          {/* Salesperson Select */}
          <select
            value={salespersonFilter}
            onChange={(e) => setSalespersonFilter(e.target.value)}
            className="px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            <option value="ALL">All Sales Reps</option>
            {salespeople.map((sp) => (
              <option key={sp.id} value={sp.id}>
                {sp.name}
              </option>
            ))}
          </select>

          {/* Clear Filters */}
          {(search || typeFilter !== 'ALL' || statusFilter !== 'ALL' || salespersonFilter !== 'ALL') && (
            <button
              onClick={() => {
                setSearch('');
                setTypeFilter('ALL');
                setStatusFilter('ALL');
                setSalespersonFilter('ALL');
              }}
              className="text-xs font-semibold text-rose-600 hover:text-rose-700 whitespace-nowrap px-2"
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* Customer Master Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 flex flex-col items-center justify-center space-y-3 text-slate-400">
            <RefreshCw className="w-6 h-6 animate-spin text-brand-600" />
            <span className="text-xs font-medium">Loading Customer Master Records...</span>
          </div>
        ) : customers.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 mx-auto">
              <Users className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-slate-800">No customer records found</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              No customers match your active search or filter criteria. Click below to add your first customer.
            </p>
            <button
              onClick={handleOpenCreate}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-brand-600 text-white text-xs font-semibold shadow-sm hover:bg-brand-700 transition"
            >
              <Plus className="w-4 h-4" />
              <span>Create Customer</span>
            </button>
          </div>
        ) : (
          <>
            {/* Desktop Table View - Fitted to available width without horizontal scrollbars */}
            <div className="hidden md:block w-full">
            <table className="w-full text-left text-xs text-slate-700 border-collapse">
              <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-500 uppercase tracking-wider text-[10px] font-bold">
                <tr>
                  <th className="py-2.5 px-3 w-[18%]">Customer ID / Type</th>
                  <th className="py-2.5 px-3 w-[26%]">Customer / Company Name</th>
                  <th className="py-2.5 px-3 w-[22%]">Contact & Phone</th>
                  <th className="py-2.5 px-3 w-[12%]">Location</th>
                  <th className="py-2.5 px-3 w-[12%]">Sales / Status</th>
                  <th className="py-2.5 px-3 text-right w-[10%]">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/70 font-normal">
                {customers.map((cust) => {
                  const isCompany = cust.customer_type === 'COMPANY';
                  return (
                    <tr
                      key={cust.id}
                      className="hover:bg-slate-50/80 transition group cursor-pointer"
                      onClick={() => handleOpenDetail(cust)}
                    >
                      {/* Customer ID Badge & Type */}
                      <td className="py-3 px-3 align-top font-mono font-bold text-brand-700">
                        <span className="px-2 py-0.5 rounded-md bg-brand-50 border border-brand-200/60 inline-block">
                          {cust.customer_code}
                        </span>
                        <div className="mt-1">
                          {isCompany ? (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded bg-blue-50 text-blue-700 border border-blue-200 font-semibold text-[9.5px]">
                              <Building2 className="w-3 h-3" />
                              <span>B2B</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded bg-purple-50 text-purple-700 border border-purple-200 font-semibold text-[9.5px]">
                              <User className="w-3 h-3" />
                              <span>B2C</span>
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Name & GST */}
                      <td className="py-3 px-3 align-top">
                        <div className="font-bold text-slate-900 group-hover:text-brand-600 transition truncate">
                          {isCompany ? cust.company_name : cust.customer_name}
                        </div>
                        {cust.gstin && (
                          <span className="text-[10px] font-mono text-slate-400 block truncate">
                            GST: {cust.gstin}
                          </span>
                        )}
                      </td>

                      {/* Contact Person & Phone */}
                      <td className="py-3 px-3 align-top">
                        <span className="text-slate-800 font-medium block truncate">
                          {isCompany ? cust.contact_person || '—' : cust.customer_name}
                        </span>
                        <span className="font-mono text-slate-600 text-[11px] block">
                          +91 {cust.phone}
                        </span>
                        {cust.email && (
                          <span className="text-slate-400 text-[10px] truncate block">
                            {cust.email}
                          </span>
                        )}
                      </td>

                      {/* Location */}
                      <td className="py-3 px-3 align-top">
                        <span className="text-slate-800 font-medium block truncate">{cust.city}</span>
                        <span className="text-slate-400 text-[10px] block truncate">{cust.state}</span>
                      </td>

                      {/* Salesperson & Status */}
                      <td className="py-3 px-3 align-top">
                        <span className="font-medium text-slate-800 block truncate">
                          {cust.salesperson?.full_name || 'Designated'}
                        </span>
                        <span
                          className={`mt-1 inline-block px-1.5 py-0.2 rounded-full text-[9px] font-bold uppercase tracking-wider ${
                            cust.status === 'ACTIVE'
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                              : cust.status === 'SUSPENDED'
                              ? 'bg-amber-100 text-amber-800 border border-amber-200'
                              : 'bg-slate-100 text-slate-600 border border-slate-200'
                          }`}
                        >
                          {cust.status}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-3 align-top text-right">
                        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => handleOpenDetail(cust)}
                            title="View Details"
                            className="p-1 rounded-md text-slate-400 hover:text-brand-600 hover:bg-brand-50 transition"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleOpenEdit(cust)}
                            title="Edit Customer"
                            className="p-1 rounded-md text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Responsive Cards View */}
          <div className="block md:hidden divide-y divide-slate-100 p-3 space-y-3">
            {customers.map((cust) => {
              const isCompany = cust.customer_type === 'COMPANY';
              return (
                <div
                  key={cust.id}
                  className="pt-3 first:pt-0 space-y-2 cursor-pointer"
                  onClick={() => handleOpenDetail(cust)}
                >
                  {/* Top: Customer Code + Status */}
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-black text-brand-700">
                      {cust.customer_code}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        cust.status === 'ACTIVE'
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                          : cust.status === 'SUSPENDED'
                          ? 'bg-amber-100 text-amber-800 border border-amber-200'
                          : 'bg-slate-100 text-slate-600 border border-slate-200'
                      }`}
                    >
                      {cust.status}
                    </span>
                  </div>

                  {/* Customer / Company Title */}
                  <div className="flex items-start gap-2">
                    <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600 font-bold shrink-0 mt-0.5">
                      {isCompany ? <Building2 className="w-3.5 h-3.5" /> : <User className="w-3.5 h-3.5" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <strong className="block text-sm font-bold text-slate-900 leading-snug truncate">
                        {cust.company_name || cust.customer_name}
                      </strong>
                      <span className="text-xs text-slate-500 block truncate">
                        Attn: {cust.customer_name} {cust.city && `&bull; ${cust.city}`}
                      </span>
                    </div>
                  </div>

                  {/* Contact Row & Actions */}
                  <div className="flex items-center justify-between gap-2 pt-1" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center gap-2">
                      <a
                        href={`tel:${cust.phone}`}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-mono font-medium transition"
                      >
                        <Phone className="w-3 h-3 text-slate-500" />
                        <span>{cust.phone}</span>
                      </a>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleOpenDetail(cust)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-brand-50 hover:bg-brand-100 text-brand-700 text-xs font-semibold transition cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>360</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(cust)}
                        className="p-1 rounded-lg text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition cursor-pointer"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
      </div>

      {/* Modals & Slide-overs */}
      <CustomerFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={handleSuccess}
        editCustomer={editCustomer}
      />

      <CustomerDetailDrawer
        customer={drawerCustomer}
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        onEdit={(c) => {
          setIsDrawerOpen(false);
          handleOpenEdit(c);
        }}
      />
    </div>
  );
}
