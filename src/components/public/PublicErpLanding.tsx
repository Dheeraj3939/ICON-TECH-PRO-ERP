import React from 'react';
import Link from 'next/link';
import {
  ShieldCheck,
  FileSpreadsheet,
  Building2,
  Lock,
  Mail,
  Truck,
  Receipt,
  ArrowRight,
  ExternalLink,
  MapPin,
  CheckCircle2,
  FileText,
  Layers,
  Sparkles,
} from 'lucide-react';

interface PublicErpLandingProps {
  user?: {
    name: string;
    role: string;
    email: string;
  } | null;
}

export function PublicErpLanding({ user }: PublicErpLandingProps = {}) {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 selection:bg-brand-500 selection:text-white flex flex-col font-sans">
      {/* Navigation Header */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-slate-900/80 border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 group">
            <img
              src="/logo-dark.png"
              alt="ICON TECH PRO"
              className="h-10 sm:h-12 w-auto object-contain transition group-hover:opacity-90"
            />
            <div className="flex flex-col">
              <span className="text-base sm:text-lg font-black tracking-tight text-white flex items-center gap-2">
                ICON TECH PRO <span className="text-xs px-2 py-0.5 rounded-md bg-brand-500/15 text-brand-400 border border-brand-500/30 font-bold">ERP</span>
              </span>
              <span className="text-[11px] text-slate-400 font-medium">
                Enterprise Operations Platform
              </span>
            </div>
          </Link>

          <nav className="hidden md:flex items-center gap-6 text-xs font-semibold text-slate-300">
            <Link href="#overview" className="hover:text-white transition">Overview</Link>
            <Link href="#capabilities" className="hover:text-white transition">Capabilities</Link>
            <Link href="#integrations" className="hover:text-white transition">Integrations</Link>
            <Link href="#company" className="hover:text-white transition">Company</Link>
            <Link href="/about" className="hover:text-white transition">About</Link>
            <Link href="/privacy-policy" className="hover:text-white transition">Privacy Policy</Link>
            <Link href="/terms-of-service" className="hover:text-white transition">Terms of Service</Link>
          </nav>

          <div className="flex items-center gap-3">
            {user ? (
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg shadow-emerald-600/30 transition transform hover:-translate-y-0.5 cursor-pointer"
              >
                <span>Go to Dashboard</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            ) : (
              <Link
                href="/login"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-bold text-xs shadow-lg shadow-brand-600/30 transition transform hover:-translate-y-0.5 cursor-pointer"
              >
                <span>Employee Sign In</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden py-20 sm:py-28 border-b border-slate-800 bg-radial-[at_top_center] from-slate-900 via-slate-950 to-slate-950">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-brand-500/10 border border-brand-500/20 text-brand-300 text-xs font-semibold mb-6">
            <Sparkles className="w-3.5 h-3.5 text-brand-400" />
            <span>ICON TECH PRO ERP V9.2 • Production Platform</span>
          </div>

          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black text-white tracking-tight max-w-4xl mx-auto leading-tight sm:leading-tight">
            Integrated Commercial Operations & Enterprise Management
          </h1>

          <p className="mt-6 text-sm sm:text-base lg:text-lg text-slate-300 max-w-3xl mx-auto leading-relaxed">
            Business management platform for ICON TECH PRO covering customer management, enquiries, quotations, sales, procurement, invoicing, business communication, CRM integration and related business operations.
          </p>

          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            {user ? (
              <Link
                href="/dashboard"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm shadow-xl shadow-emerald-600/30 transition transform hover:-translate-y-0.5"
              >
                <span>Go to Dashboard</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            ) : (
              <Link
                href="/login"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-bold text-sm shadow-xl shadow-brand-600/30 transition transform hover:-translate-y-0.5"
              >
                <span>Sign In to ERP Portal</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            )}
            <Link
              href="/privacy-policy"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold text-sm transition"
            >
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Review Privacy Policy</span>
            </Link>
            <Link
              href="/terms-of-service"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold text-sm transition"
            >
              <FileText className="w-4 h-4 text-blue-400" />
              <span>Terms of Service</span>
            </Link>
          </div>
        </div>
      </section>

      {/* Capabilities Section */}
      <section id="capabilities" className="py-20 sm:py-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-xs font-bold text-brand-400 uppercase tracking-widest">Platform Scope</h2>
          <p className="mt-2 text-2xl sm:text-3xl font-black text-white tracking-tight">
            Designed for Unified Commercial Workflows
          </p>
          <p className="mt-3 text-xs sm:text-sm text-slate-400">
            A comprehensive operational architecture built to support verified business processes across the full customer, product, and financial lifecycle.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Card 1 */}
          <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 hover:border-slate-700 transition">
            <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center mb-5">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-white mb-2">Quotations & CPQ Intelligence</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Automated proposal generation, dynamic multi-tier pricing, spec intelligence, and multi-format commercial proposals with automated tax computation.
            </p>
          </div>

          {/* Card 2 */}
          <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 hover:border-slate-700 transition">
            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mb-5">
              <Building2 className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-white mb-2">Customer & Enquiry Management</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              End-to-end prospect tracking, commercial lead qualification, client enquiry histories, site-visit scheduling, and customer master directories.
            </p>
          </div>

          {/* Card 3 */}
          <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 hover:border-slate-700 transition">
            <div className="w-12 h-12 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center mb-5">
              <Receipt className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-white mb-2">Invoicing & Financial Compliance</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              GST-compliant tax invoicing, purchase tracking, payment receipts, accounts reconciliation, and automated financial audit logging.
            </p>
          </div>

          {/* Card 4 */}
          <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 hover:border-slate-700 transition">
            <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mb-5">
              <Truck className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-white mb-2">Procurement & Sourcing</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Approved vendor directories, distributor purchase orders, equipment dispatch verification, and material inventory management.
            </p>
          </div>

          {/* Card 5 */}
          <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 hover:border-slate-700 transition">
            <div className="w-12 h-12 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mb-5">
              <Mail className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-white mb-2">Business Communications</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Integrated Google Gmail API and Zoho Mail connectivity, ensuring authorized correspondence is securely routed with strict role-based access controls.
            </p>
          </div>

          {/* Card 6 */}
          <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 hover:border-slate-700 transition">
            <div className="w-12 h-12 rounded-xl bg-teal-500/10 border border-teal-500/20 text-teal-400 flex items-center justify-center mb-5">
              <Lock className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-white mb-2">Enterprise Security & RBAC</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Database-first PBKDF2-SHA512 password cryptography, cryptographic action tokens, session invalidation, and immutable audit trails.
            </p>
          </div>
        </div>
      </section>

      {/* Integrations & Google Limited Use Section */}
      <section id="integrations" className="py-16 sm:py-20 bg-slate-900/40 border-y border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto text-center mb-12">
            <h2 className="text-xs font-bold text-brand-400 uppercase tracking-widest">Authorized Integrations</h2>
            <p className="mt-2 text-2xl font-black text-white tracking-tight">
              Google API Services & Third-Party Compliance
            </p>
            <p className="mt-3 text-xs sm:text-sm text-slate-400">
              ICON TECH PRO ERP integrates with Google Workspace (Gmail) and Zoho Corporation services strictly under authorized, user-granted permissions.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-400 flex items-center justify-center">
                  <Mail className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Google Gmail Integration</h3>
                  <span className="text-[11px] text-slate-400">Google API Services User Data Policy Compliance</span>
                </div>
              </div>
              <ul className="space-y-2 text-xs text-slate-300">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>Accessed strictly for user-facing business email viewing and composition within ERP.</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>Google user data is NOT used for advertising or shared with third-party brokers.</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>Google user data is NOT used to train generalized artificial intelligence models.</span>
                </li>
              </ul>
            </div>

            <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center">
                  <Layers className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Zoho CRM & Mail Suite</h3>
                  <span className="text-[11px] text-slate-400">India Data Center (zoho.in) Organization Access</span>
                </div>
              </div>
              <ul className="space-y-2 text-xs text-slate-300">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>Bi-directional customer, lead, and contact synchronization.</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>Dynamic per-employee mailbox routing based on corporate email identity.</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>Server-side encrypted tokens with automatic background renewal.</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Company Information Section */}
      <section id="company" className="py-16 sm:py-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="p-8 sm:p-12 rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
            <div>
              <div className="inline-flex items-center gap-2 text-xs font-bold text-brand-400 uppercase tracking-widest mb-2">
                <Building2 className="w-4 h-4" />
                <span>Operating Entity</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                ICON TECH PRO
              </h2>
              <p className="mt-3 text-xs sm:text-sm text-slate-300 leading-relaxed">
                ICON TECH PRO is a unified commercial technology solutions specialist headquartered in Hyderabad, Telangana, delivering comprehensive enterprise audiovisual, IT infrastructure, surveillance, and office automation solutions across India.
              </p>

              <div className="mt-6 space-y-3 text-xs text-slate-300">
                <div className="flex items-start gap-3">
                  <MapPin className="w-4 h-4 text-brand-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold text-white">Registered Corporate Office:</span>
                    <p className="text-slate-400">
                      Ameer Estate, 503 A Block,<br />
                      Sanjeeva Reddy Nagar,<br />
                      Hyderabad, Telangana – 500038, India.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Mail className="w-4 h-4 text-brand-400 shrink-0" />
                  <div>
                    <span className="font-semibold text-white">Privacy & Legal Contact: </span>
                    <a href="mailto:vineet@icontechpro.in" className="text-brand-400 hover:underline">
                      vineet@icontechpro.in
                    </a>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <ExternalLink className="w-4 h-4 text-brand-400 shrink-0" />
                  <div>
                    <span className="font-semibold text-white">Corporate Website: </span>
                    <a href="https://icontechpro.in" target="_blank" rel="noopener noreferrer" className="text-brand-400 hover:underline">
                      https://icontechpro.in
                    </a>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-6 rounded-2xl bg-slate-950/60 border border-slate-800/80 flex flex-col justify-between h-full space-y-6">
              <div>
                <h3 className="text-sm font-bold text-white mb-2">Authorized Access Only</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Access to this application is restricted to authorized employees, contractors, and affiliates of ICON TECH PRO. All interactions, authentications, and modifications are subject to enterprise monitoring and audit logging.
                </p>
              </div>

              <div className="pt-4 border-t border-slate-800 flex flex-wrap gap-4">
                <Link
                  href="/privacy-policy"
                  className="text-xs font-bold text-brand-400 hover:text-brand-300 flex items-center gap-1.5"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>Privacy Policy</span>
                </Link>
                <Link
                  href="/terms-of-service"
                  className="text-xs font-bold text-brand-400 hover:text-brand-300 flex items-center gap-1.5"
                >
                  <FileText className="w-4 h-4" />
                  <span>Terms of Service</span>
                </Link>
                <Link
                  href="/login"
                  className="text-xs font-bold text-slate-300 hover:text-white flex items-center gap-1.5"
                >
                  <Lock className="w-4 h-4" />
                  <span>Authorized Sign In</span>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-auto py-10 bg-slate-950 border-t border-slate-900 text-slate-500 text-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span>© {new Date().getFullYear()} ICON TECH PRO. All rights reserved.</span>
          </div>

          <div className="flex items-center gap-6">
            <Link href="/privacy-policy" className="hover:text-slate-300 transition">Privacy Policy</Link>
            <Link href="/terms-of-service" className="hover:text-slate-300 transition">Terms of Service</Link>
            <Link href="/about" className="hover:text-slate-300 transition">About</Link>
            <Link href="/login" className="hover:text-slate-300 transition">Sign In</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
