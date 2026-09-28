'use client';

import Link from 'next/link';

import {
  Sparkles,
  X,
  Building2,
  User,
  Phone,
  Mail,
  MapPin,
  Calendar,
  CreditCard,
  FileSpreadsheet,
  FileText,
  ShoppingBag,
  Clock,
  Edit,
  ShieldCheck,
  CheckCircle2,
} from 'lucide-react';
import type { Customer } from '@/types/customer';

interface CustomerDetailDrawerProps {
  customer: Customer | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit: (customer: Customer) => void;
}

export function CustomerDetailDrawer({
  customer,
  isOpen,
  onClose,
  onEdit,
}: CustomerDetailDrawerProps) {
  if (!isOpen || !customer) return null;

  const isCompany = customer.customer_type === 'COMPANY';

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-950/40 backdrop-blur-sm animate-in fade-in">
      <div className="absolute inset-y-0 right-0 max-w-full flex sm:pl-10">
        <div className="w-full sm:w-screen max-w-md bg-white shadow-2xl border-l border-slate-200 flex flex-col">
          {/* Drawer Header */}
          <div className="p-6 bg-slate-900 text-white flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="px-2.5 py-1 rounded-lg bg-brand-500/20 border border-brand-400/40 text-brand-300 font-mono font-bold text-xs tracking-wider">
                  {customer.customer_code}
                </span>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase ${
                    customer.status === 'ACTIVE'
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                      : customer.status === 'SUSPENDED'
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                      : 'bg-slate-500/20 text-slate-300 border border-slate-500/40'
                  }`}
                >
                  {customer.status}
                </span>
              </div>
              <h2 className="text-lg font-bold text-white tracking-tight leading-snug">
                {isCompany ? customer.company_name : customer.customer_name}
              </h2>
              <p className="text-xs text-slate-400 flex items-center gap-1.5 mt-1">
                {isCompany ? (
                  <>
                    <Building2 className="w-3.5 h-3.5 text-brand-400" />
                    <span>Corporate B2B Account</span>
                  </>
                ) : (
                  <>
                    <User className="w-3.5 h-3.5 text-brand-400" />
                    <span>Individual B2C Client</span>
                  </>
                )}
              </p>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Drawer Content */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6 text-xs">
            {/* Quick Contact Box */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
              <h3 className="font-bold text-slate-900 uppercase tracking-wider text-[11px]">
                Primary Contact Information
              </h3>
              {isCompany && customer.contact_person && (
                <div className="flex items-center gap-2.5 text-slate-700">
                  <User className="w-4 h-4 text-slate-400 flex-shrink-0" />
                  <div>
                    <span className="font-semibold block">{customer.contact_person}</span>
                    {customer.designation && (
                      <span className="text-[11px] text-slate-500 block">{customer.designation}</span>
                    )}
                  </div>
                </div>
              )}

              <div className="flex items-center gap-2.5 text-slate-700">
                <Phone className="w-4 h-4 text-slate-400 flex-shrink-0" />
                <a
                  href={`tel:${customer.phone}`}
                  className="font-mono font-medium hover:text-brand-600 transition"
                >
                  +91 {customer.phone}
                </a>
                {customer.alternate_phone && (
                  <span className="text-slate-400 text-[11px]">
                    &bull; Alt: +91 {customer.alternate_phone}
                  </span>
                )}
              </div>

              {customer.email && (
                <div className="flex items-center gap-2.5 text-slate-700">
                  <Mail className="w-4 h-4 text-slate-400 flex-shrink-0" />
                  <a
                    href={`mailto:${customer.email}`}
                    className="hover:text-brand-600 transition truncate max-w-[280px]"
                  >
                    {customer.email}
                  </a>
                </div>
              )}
            </div>

            {/* Tax & Commercial Details */}
            <div className="space-y-3">
              <h3 className="font-bold text-slate-900 uppercase tracking-wider text-[11px]">
                Commercial & Tax Registration
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="text-slate-500 text-[10px] uppercase font-semibold block">GSTIN</span>
                  <span className="font-mono font-bold text-slate-800 text-xs block mt-0.5">
                    {customer.gstin || 'Not Provided'}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="text-slate-500 text-[10px] uppercase font-semibold block">PAN Number</span>
                  <span className="font-mono font-bold text-slate-800 text-xs block mt-0.5">
                    {customer.pan || 'Not Provided'}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 col-span-2">
                  <span className="text-slate-500 text-[10px] uppercase font-semibold block">Approved Credit Limit</span>
                  <span className="font-bold text-brand-700 text-sm block mt-0.5">
                    ₹ {customer.credit_limit ? customer.credit_limit.toLocaleString('en-IN') : '0.00'}
                  </span>
                </div>
              </div>
            </div>

            {/* Address Details */}
            <div className="space-y-3">
              <h3 className="font-bold text-slate-900 uppercase tracking-wider text-[11px]">
                Address Details
              </h3>
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                <div className="flex items-center gap-1.5 text-slate-500 font-semibold text-[11px]">
                  <MapPin className="w-3.5 h-3.5 text-brand-500" />
                  <span>{isCompany ? 'Billing Address' : 'Site / Residential Address'}</span>
                </div>
                <p className="text-slate-700 leading-relaxed pl-5">
                  {customer.billing_address || 'Not Provided'}
                </p>
                <p className="text-slate-500 pl-5 text-[11px]">
                  {customer.city}, {customer.state} ({customer.state_code}) - {customer.pincode || 'N/A'}
                </p>
              </div>

              {isCompany && customer.shipping_address && (
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                  <div className="flex items-center gap-1.5 text-slate-500 font-semibold text-[11px]">
                    <MapPin className="w-3.5 h-3.5 text-emerald-500" />
                    <span>Shipping / Delivery Address</span>
                  </div>
                  <p className="text-slate-700 leading-relaxed pl-5">
                    {customer.shipping_address}
                  </p>
                </div>
              )}
            </div>

            {/* ERP Governance & Sales Assignment */}
            <div className="p-4 rounded-2xl bg-brand-50/60 border border-brand-200/70 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-brand-900 font-bold uppercase tracking-wider text-[11px]">
                  Assigned Account Representative
                </span>
                <span className="px-2 py-0.5 rounded bg-brand-200/60 text-brand-800 text-[10px] font-semibold">
                  {customer.enquiry_source}
                </span>
              </div>
              <p className="text-brand-950 font-bold text-xs">
                {customer.salesperson?.full_name || 'Designated Sales Team'}
              </p>
              <p className="text-brand-800 text-[11px]">
                {customer.salesperson?.role?.role_name || 'Account Manager'} &bull; {customer.salesperson?.email || 'sales@icontechpro.in'}
              </p>
            </div>

            {/* 360° Operational History */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
              <h3 className="font-bold text-slate-900 uppercase tracking-wider text-[11px] flex items-center justify-between">
                <span>360° Transaction History</span>
                <span className="text-brand-600 font-semibold text-[10px]">Unified Records</span>
              </h3>
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <a
                  href="/dashboard/quotations"
                  className="p-2 rounded-xl bg-white border border-slate-200 hover:border-brand-300 font-medium text-slate-700 flex items-center justify-between transition"
                >
                  <span>Quotations</span>
                  <FileSpreadsheet className="w-3.5 h-3.5 text-brand-600" />
                </a>
                <a
                  href="/dashboard/sales-orders"
                  className="p-2 rounded-xl bg-white border border-slate-200 hover:border-brand-300 font-medium text-slate-700 flex items-center justify-between transition"
                >
                  <span>Sales Orders</span>
                  <ShoppingBag className="w-3.5 h-3.5 text-blue-600" />
                </a>
                <a
                  href="/dashboard/invoices"
                  className="p-2 rounded-xl bg-white border border-slate-200 hover:border-brand-300 font-medium text-slate-700 flex items-center justify-between transition"
                >
                  <span>Invoices</span>
                  <CreditCard className="w-3.5 h-3.5 text-emerald-600" />
                </a>
                <a
                  href="/dashboard/service"
                  className="p-2 rounded-xl bg-white border border-slate-200 hover:border-brand-300 font-medium text-slate-700 flex items-center justify-between transition"
                >
                  <span>Service / AMC</span>
                  <Clock className="w-3.5 h-3.5 text-amber-600" />
                </a>
              </div>
            </div>

            {/* Audit Logs Info */}
            <div className="pt-3 border-t border-slate-200 space-y-1 text-slate-400 text-[11px]">
              <p>
                Created on: {new Date(customer.created_at).toLocaleDateString('en-IN', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                })}
              </p>
              <p>
                Last Updated: {new Date(customer.updated_at).toLocaleDateString('en-IN', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                })}
              </p>
            </div>
          </div>

          {/* Drawer Footer Actions */}
          <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-3">
            <Link
              href={`/dashboard/customers/${customer.id}`}
              className="px-4 py-2.5 rounded-xl bg-brand-50 hover:bg-brand-100 text-brand-700 border border-brand-200 text-xs font-bold flex items-center gap-1.5 transition"
            >
              <Sparkles className="w-4 h-4 text-brand-600" />
              <span>Customer 360</span>
            </Link>
            <button
              onClick={() => onEdit(customer)}
              className="px-5 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold shadow-sm flex items-center gap-2 transition"
            >
              <Edit className="w-4 h-4" />
              <span>Edit Customer</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
