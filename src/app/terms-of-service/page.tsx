import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import {
  Shield,
  FileText,
  Lock,
  ArrowLeft,
  ArrowRight,
  Building2,
  Mail,
  ExternalLink,
  Calendar,
  CheckCircle2,
} from 'lucide-react';

export const metadata: Metadata = {
  title: 'Terms of Service | ICON TECH PRO ERP',
  description: 'Terms governing authorized access to and commercial use of the ICON TECH PRO ERP platform operated by ICON TECH PRO.',
};

const INTRO_BLOCKS = [{"type":"text","text":"These Terms of Service (\"Terms\") govern access to and use of the ICON TECH PRO ERP (\"ERP\", \"Platform\", or \"Service\") operated by ICON TECH PRO (\"ICON TECH PRO\", \"we\", \"us\", or \"our\")."},{"type":"text","text":"By accessing or using the ERP, an authorized user agrees to comply with these Terms."},{"type":"text","text":"If you do not agree with these Terms, you should not access or use the ERP."}];
const SECTIONS = [{"number":1,"title":"ABOUT THE ERP","blocks":[{"type":"text","text":"ICON TECH PRO ERP is a business management platform operated for authorized ICON TECH PRO personnel and other expressly authorized users."},{"type":"text","text":"The ERP may provide functionality including:"},{"type":"bullets","items":["customer and prospect management;","enquiry and lead management;","quotations;","sales and order management;","procurement and supplier management;","invoicing;","payment and financial workflow management;","business email integration;","CRM integration;","reporting;","employee and access management;","audit and security functions; and","other business-management functionality introduced by ICON TECH PRO."]},{"type":"text","text":"The available functionality may change over time."}]},{"number":2,"title":"AUTHORIZED USERS","blocks":[{"type":"text","text":"Access to the ERP is restricted to persons authorized by ICON TECH PRO."},{"type":"text","text":"There is no general public self-registration for the ERP."},{"type":"text","text":"ICON TECH PRO may create, approve, modify, suspend, or terminate user access according to its internal policies."},{"type":"text","text":"Users must access the ERP only through their assigned account."}]},{"number":3,"title":"USER ACCOUNTS","blocks":[{"type":"text","text":"Each user is responsible for maintaining the confidentiality of their authentication credentials."},{"type":"text","text":"Users must:"},{"type":"bullets","items":["use only their own account;","keep their password confidential;","not share passwords or authentication tokens;","not permit unauthorized persons to use their account;","immediately report suspected unauthorized access;","provide accurate information when required for account administration; and","follow ICON TECH PRO security instructions."]},{"type":"text","text":"Users must not attempt to obtain another employee's credentials."}]},{"number":4,"title":"EMPLOYEE ROLES AND PERMISSIONS","blocks":[{"type":"text","text":"The ERP may assign different roles and permissions to users according to their responsibilities."},{"type":"text","text":"Examples include administrative, sales, accounts, management, and other authorized roles."},{"type":"text","text":"A user's access to information and functionality is determined by their assigned permissions."},{"type":"text","text":"Users must not attempt to bypass, disable, circumvent, or manipulate access controls."}]},{"number":5,"title":"ACCEPTABLE USE","blocks":[{"type":"text","text":"Users may use the ERP only for legitimate business purposes authorized by ICON TECH PRO."},{"type":"text","text":"Users must not:"},{"type":"bullets","items":["1. attempt to gain unauthorized access to the ERP or its infrastructure;","2. access another user's restricted information without authorization;","3. access another employee's mailbox without authorization;","4. share confidential business information without authorization;","5. upload malicious software or harmful content;","6. interfere with ERP availability or security;","7. attempt to bypass authentication or authorization controls;","8. reverse engineer or unlawfully copy protected ERP software or functionality;","9. use the ERP to conduct unlawful activities;","10. knowingly enter fraudulent or misleading information;","11. use the ERP to harass, threaten, or abuse another person; or","12. perform any activity that may compromise the security or integrity of the ERP."]}]},{"number":6,"title":"BUSINESS DATA","blocks":[{"type":"text","text":"The ERP may contain confidential business information belonging to ICON TECH PRO, its customers, suppliers, employees, and business partners."},{"type":"text","text":"Users must treat such information as confidential and use it only for authorized business purposes."},{"type":"text","text":"Users must not export, copy, disclose, or distribute confidential ERP information unless authorized to do so."}]},{"number":7,"title":"CUSTOMER AND SUPPLIER INFORMATION","blocks":[{"type":"text","text":"Users who enter customer, prospect, supplier, or business-contact information into the ERP are responsible for ensuring that such information is entered and used for legitimate business purposes."},{"type":"text","text":"Users must follow applicable ICON TECH PRO policies concerning confidentiality and handling of business information."}]},{"number":8,"title":"QUOTATIONS, PRICING AND COMMERCIAL INFORMATION","blocks":[{"type":"text","text":"The ERP may contain commercially sensitive information including:"},{"type":"bullets","items":["distributor pricing;","purchase costs;","margins;","discounts;","quotations;","customer-specific pricing;","supplier information;","payment information; and","commercial negotiations."]},{"type":"text","text":"Users must not disclose internal pricing, margins, supplier costs, or other restricted commercial information to unauthorized persons."}]},{"number":9,"title":"GMAIL INTEGRATION","blocks":[{"type":"text","text":"The ERP may provide an optional Gmail integration."},{"type":"text","text":"A user may connect a Gmail account only if they are authorized to use that account for the relevant business purpose."},{"type":"text","text":"The Gmail integration may allow the ERP to perform authorized mailbox functions based on the Google OAuth permissions granted by the user."},{"type":"text","text":"Users must not connect another person's Google account without authorization."},{"type":"text","text":"Users may disconnect an authorized Google account where the ERP provides such functionality."},{"type":"text","text":"Google services are also subject to Google's applicable terms and policies."}]},{"number":10,"title":"ZOHO INTEGRATION","blocks":[{"type":"text","text":"The ERP may integrate with Zoho services, including Zoho CRM and Zoho Mail."},{"type":"text","text":"Access to Zoho functionality is subject to:"},{"type":"bullets","items":["ERP permissions;","the employee's authorized business role;","the applicable Zoho authorization;","the configuration of the relevant integration; and","applicable Zoho terms and policies."]},{"type":"text","text":"Users must not attempt to access another employee's Zoho mailbox or restricted CRM information without authorization."}]},{"number":11,"title":"THIRD-PARTY SERVICES","blocks":[{"type":"text","text":"The ERP may depend on third-party services, including Google, Zoho, Supabase, Cloudflare, hosting providers, communication providers, and other service providers."},{"type":"text","text":"Third-party services may experience outages, limitations, changes, or interruptions outside ICON TECH PRO's direct control."},{"type":"text","text":"Use of third-party services may also be subject to those providers' own terms and policies."}]},{"number":12,"title":"SECURITY","blocks":[{"type":"text","text":"ICON TECH PRO maintains security controls intended to protect the ERP and information processed through it."},{"type":"text","text":"However, no software, network, internet service, or electronic storage system can be guaranteed to be completely secure."},{"type":"text","text":"Users must cooperate with reasonable security requirements and must promptly report suspected security incidents."}]},{"number":13,"title":"AVAILABILITY AND MAINTENANCE","blocks":[{"type":"text","text":"ICON TECH PRO will make reasonable efforts to keep the ERP available for authorized business use."},{"type":"text","text":"However, availability may be affected by:"},{"type":"bullets","items":["scheduled maintenance;","emergency maintenance;","infrastructure failures;","internet connectivity;","third-party service outages;","security incidents;","software updates;","hardware failures; or","circumstances outside ICON TECH PRO's reasonable control."]},{"type":"text","text":"ICON TECH PRO does not guarantee uninterrupted or error-free availability."}]},{"number":14,"title":"ACCOUNT SUSPENSION OR TERMINATION","blocks":[{"type":"text","text":"ICON TECH PRO may suspend, restrict, or terminate an account where reasonably necessary, including when:"},{"type":"bullets","items":["employment or authorization ends;","a user violates these Terms;","unauthorized access is suspected;","an account is compromised;","security requires immediate action;","the account is inactive or no longer required; or","continued access creates a material business, legal, or security risk."]},{"type":"text","text":"Where appropriate, active sessions and connected integrations may also be revoked."}]},{"number":15,"title":"BUSINESS RECORDS AFTER ACCOUNT TERMINATION","blocks":[{"type":"text","text":"Termination of a user's account does not automatically delete business records created or handled by that user."},{"type":"text","text":"ICON TECH PRO may retain business records where necessary for:"},{"type":"bullets","items":["accounting;","taxation;","audit;","legal compliance;","contractual obligations;","customer service;","business continuity;","security; or","legitimate business purposes."]}]},{"number":16,"title":"INTELLECTUAL PROPERTY","blocks":[{"type":"text","text":"The ICON TECH PRO ERP, including its software, interface, workflows, documentation, branding, design, logos, and related materials, may contain intellectual property belonging to ICON TECH PRO or its respective licensors."},{"type":"text","text":"Except where expressly permitted, users may not:"},{"type":"bullets","items":["copy;","reproduce;","modify;","distribute;","sell;","sublicense;","reverse engineer; or","commercially exploit"]},{"type":"text","text":"the ERP or its protected components."},{"type":"text","text":"Nothing in these Terms transfers ownership of ICON TECH PRO intellectual property to an ERP user."}]},{"number":17,"title":"USER-PROVIDED INFORMATION","blocks":[{"type":"text","text":"Users remain responsible for information they enter, upload, or submit through the ERP."},{"type":"text","text":"Users must ensure that they have appropriate authorization to enter or process information belonging to customers, suppliers, employees, or other persons."},{"type":"text","text":"ICON TECH PRO may process such information as necessary to provide the ERP and conduct legitimate business operations."}]},{"number":18,"title":"AI-ASSISTED FEATURES","blocks":[{"type":"text","text":"The ERP may include AI-assisted functionality for certain business workflows, including research, product information, quotation assistance, CRM intelligence, reporting, or other authorized business purposes."},{"type":"text","text":"AI-assisted results may require human review and approval."},{"type":"text","text":"Users remain responsible for reviewing important business information before relying on AI-assisted results for customer-facing, commercial, financial, procurement, or other material decisions."},{"type":"text","text":"AI-assisted functionality does not transfer ownership of ICON TECH PRO business information to the AI system or provider beyond the processing necessary for the authorized feature."},{"type":"text","text":"Google user data accessed through Gmail is not used by ICON TECH PRO to train or improve generalized AI models."}]},{"number":19,"title":"FINANCIAL AND COMMERCIAL DECISIONS","blocks":[{"type":"text","text":"The ERP is a business management and record-keeping platform."},{"type":"text","text":"Users are responsible for reviewing quotations, prices, discounts, taxes, invoices, payments, purchase information, and other commercial information before finalizing transactions."},{"type":"text","text":"The ERP does not replace professional accounting, taxation, legal, or financial advice."}]},{"number":20,"title":"NO GUARANTEE OF ERROR-FREE INFORMATION","blocks":[{"type":"text","text":"ICON TECH PRO makes reasonable efforts to maintain accurate ERP information and reliable functionality."},{"type":"text","text":"However, information may occasionally contain errors, omissions, outdated information, supplier changes, integration errors, or user-entered inaccuracies."},{"type":"text","text":"Users should verify material information before relying on it for important business decisions."}]},{"number":21,"title":"CONFIDENTIALITY","blocks":[{"type":"text","text":"Users may have access to confidential ICON TECH PRO information through the ERP."},{"type":"text","text":"Users must maintain the confidentiality of such information and must not disclose it to unauthorized persons."},{"type":"text","text":"This obligation continues after a user's ERP access is terminated to the extent permitted or required by applicable law and any applicable employment or confidentiality obligations."}]},{"number":22,"title":"PRIVACY","blocks":[{"type":"text","text":"Use of the ERP is also governed by the ICON TECH PRO ERP Privacy Policy."},{"type":"text","text":"The Privacy Policy explains how ICON TECH PRO processes personal information and Google user data."},{"type":"text","text":"The Privacy Policy is available at the official Privacy Policy webpage associated with the ERP."}]},{"number":23,"title":"CHANGES TO THE ERP","blocks":[{"type":"text","text":"ICON TECH PRO may modify, improve, add, remove, or discontinue ERP functionality from time to time."},{"type":"text","text":"Changes may be required for:"},{"type":"bullets","items":["security;","legal compliance;","business requirements;","technology updates;","third-party integration changes;","performance improvements; or","product development."]}]},{"number":24,"title":"CHANGES TO THESE TERMS","blocks":[{"type":"text","text":"ICON TECH PRO may update these Terms when necessary."},{"type":"text","text":"The latest version will be published on the applicable Terms of Service webpage with an updated \"Last Updated\" date."},{"type":"text","text":"Continued use of the ERP after an applicable update may constitute acceptance of the updated Terms to the extent permitted by applicable law."}]},{"number":25,"title":"LIMITATION OF LIABILITY","blocks":[{"type":"text","text":"To the maximum extent permitted by applicable law, ICON TECH PRO will not be responsible for indirect, incidental, special, consequential, or unforeseeable losses arising from use of or inability to use the ERP."},{"type":"text","text":"Nothing in these Terms is intended to exclude or limit liability that cannot lawfully be excluded or limited under applicable law."},{"type":"text","text":"Nothing in these Terms limits rights or remedies that users may have under mandatory applicable law."}]},{"number":26,"title":"FORCE MAJEURE","blocks":[{"type":"text","text":"ICON TECH PRO will not be responsible for delays or failures caused by circumstances beyond its reasonable control, including:"},{"type":"bullets","items":["natural disasters;","internet or telecommunications failures;","power failures;","infrastructure failures;","cyber incidents;","third-party service outages;","governmental actions;","regulatory changes;","war;","civil unrest; or","other events beyond reasonable control."]}]},{"number":27,"title":"GOVERNING LAW","blocks":[{"type":"text","text":"These Terms shall be governed by the applicable laws of India."},{"type":"text","text":"Subject to applicable law, disputes relating to these Terms or the use of the ERP shall be subject to the appropriate courts having jurisdiction in Hyderabad, Telangana, India."},{"type":"text","text":"This clause does not exclude any mandatory rights or remedies available under applicable law."}]},{"number":28,"title":"CONTACT","blocks":[{"type":"text","text":"For questions regarding these Terms or the ICON TECH PRO ERP, contact:"},{"type":"text","text":"ICON TECH PRO"},{"type":"text","text":"Ameer Estate, 503 A Block,"},{"type":"text","text":"Sanjeeva Reddy Nagar,"},{"type":"text","text":"Hyderabad, Telangana – 500038, India."},{"type":"text","text":"Email: vineet@icontechpro.in"}]}];

export default function TermsOfServicePage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-brand-500 selection:text-white">
      {/* Top Header */}
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
            <Link href="/" className="hover:text-white transition">Home</Link>
            <Link href="/about" className="hover:text-white transition">About ERP</Link>
            <Link href="/privacy-policy" className="hover:text-white transition ">Privacy Policy</Link>
            <Link href="/terms-of-service" className="hover:text-white transition text-brand-400 font-bold">Terms of Service</Link>
          </nav>

          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-bold text-xs shadow-lg shadow-brand-600/30 transition transform hover:-translate-y-0.5"
            >
              <span>Employee Sign In</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-xs text-slate-400 mb-6">
          <Link href="/" className="hover:text-white transition">Home</Link>
          <span>/</span>
          <span className="text-slate-200 font-semibold">Terms of Service</span>
        </div>

        {/* Hero Header */}
        <div className="p-8 sm:p-10 rounded-3xl bg-radial-[at_top_left] from-slate-900 to-slate-950 border border-slate-800 shadow-2xl mb-12">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-500/10 border border-brand-500/20 text-brand-300 text-xs font-semibold">
              <Shield className="w-3.5 h-3.5 text-brand-400" />
              <span>Official Enterprise Legal Notice</span>
            </div>
            <div className="flex items-center gap-3 text-xs text-slate-400">
              <span className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5" /> Effective: 8 October 2026
              </span>
              <span>&bull;</span>
              <span>Last Updated: 8 October 2026</span>
            </div>
          </div>

          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight mb-4">
            Terms of Service
          </h1>
          <p className="text-sm sm:text-base text-slate-300 max-w-3xl leading-relaxed">
            Terms governing authorized access to and commercial use of the ICON TECH PRO ERP platform operated by ICON TECH PRO.
          </p>

          <div className="mt-6 pt-6 border-t border-slate-800/80 flex flex-wrap items-center gap-4 text-xs">
            <Link
              href="/privacy-policy"
              className="inline-flex items-center gap-1.5 text-brand-400 hover:text-brand-300 font-semibold"
            >
              <FileText className="w-4 h-4" />
              <span>View Privacy Policy</span>
            </Link>
            <span className="text-slate-600">&bull;</span>
            <Link
              href="/login"
              className="inline-flex items-center gap-1.5 text-slate-300 hover:text-white font-semibold"
            >
              <Lock className="w-4 h-4" />
              <span>Access Employee Login</span>
            </Link>
          </div>
        </div>

        {/* Intro Blocks */}
        {INTRO_BLOCKS.length > 0 && (
          <div className="mb-12 space-y-4 p-6 sm:p-8 rounded-2xl bg-slate-900/60 border border-slate-800/80 text-sm sm:text-base text-slate-300 leading-relaxed">
            {INTRO_BLOCKS.map((block: any, idx: number) => {
              if (block.type === 'bullets') {
                return (
                  <ul key={idx} className="list-disc pl-6 space-y-2 text-slate-300">
                    {block.items.map((item: string, bIdx: number) => (
                      <li key={bIdx}>{item}</li>
                    ))}
                  </ul>
                );
              }
              return <p key={idx}>{block.text}</p>;
            })}
          </div>
        )}

        {/* Sections Content */}
        <div className="space-y-10">
          {SECTIONS.map((sec: any) => (
            <section
              key={sec.number}
              id={`section-${sec.number}`}
              className="p-6 sm:p-8 rounded-2xl bg-slate-900/50 border border-slate-800/80 scroll-mt-28 hover:border-slate-700/80 transition"
            >
              <div className="flex items-center gap-3 mb-4">
                <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-brand-500/15 border border-brand-500/30 text-brand-400 text-xs font-mono font-bold">
                  {sec.number}
                </span>
                <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight">
                  {sec.title}
                </h2>
              </div>

              <div className="space-y-4 text-sm sm:text-base text-slate-300 leading-relaxed pl-0 sm:pl-11">
                {sec.blocks.map((block: any, bIdx: number) => {
                  if (block.type === 'bullets') {
                    return (
                      <ul key={bIdx} className="list-disc pl-6 space-y-2 text-slate-300">
                        {block.items.map((item: string, iIdx: number) => (
                          <li key={iIdx}>{item}</li>
                        ))}
                      </ul>
                    );
                  }
                  return <p key={bIdx}>{block.text}</p>;
                })}
              </div>
            </section>
          ))}
        </div>

        {/* Contact Info Footer Card */}
        <div className="mt-16 p-8 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl">
          <h3 className="text-base font-bold text-white mb-2 flex items-center gap-2">
            <Building2 className="w-5 h-5 text-brand-400" />
            <span>Corporate Contact & Entity Details</span>
          </h3>
          <p className="text-xs text-slate-400 mb-4">
            For legal inquiries, data protection requests, or terms-related questions:
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-slate-300">
            <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800">
              <span className="font-semibold text-white block mb-1">ICON TECH PRO</span>
              <p>Ameer Estate, 503 A Block, Sanjeeva Reddy Nagar,</p>
              <p>Hyderabad, Telangana – 500038, India.</p>
            </div>
            <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 flex flex-col justify-center gap-2">
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-brand-400" />
                <span>Contact Email: </span>
                <a href="mailto:vineet@icontechpro.in" className="text-brand-400 hover:underline font-mono">vineet@icontechpro.in</a>
              </div>
              <div className="flex items-center gap-2">
                <ExternalLink className="w-4 h-4 text-brand-400" />
                <span>Official Website: </span>
                <a href="https://icontechpro.in" target="_blank" rel="noopener noreferrer" className="text-brand-400 hover:underline">https://icontechpro.in</a>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="mt-auto py-10 bg-slate-950 border-t border-slate-900 text-slate-500 text-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span>© {new Date().getFullYear()} ICON TECH PRO. All rights reserved.</span>
          </div>

          <div className="flex items-center gap-6">
            <Link href="/" className="hover:text-slate-300 transition">Home</Link>
            <Link href="/about" className="hover:text-slate-300 transition">About</Link>
            <Link href="/privacy-policy" className="hover:text-slate-300 transition">Privacy Policy</Link>
            <Link href="/terms-of-service" className="hover:text-slate-300 transition">Terms of Service</Link>
            <Link href="/login" className="hover:text-slate-300 transition">Sign In</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
