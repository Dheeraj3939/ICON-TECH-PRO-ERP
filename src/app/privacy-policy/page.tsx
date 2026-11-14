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
  title: 'Privacy Policy | ICON TECH PRO ERP',
  description: 'Official Privacy Policy for the ICON TECH PRO ERP platform, detailing information collection, Google API User Data Policy compliance, role-based access, and enterprise data protection.',
};

const INTRO_BLOCKS = [{"type":"text","text":"ICON TECH PRO (\"ICON TECH PRO\", \"we\", \"us\", or \"our\") operates the ICON TECH PRO ERP platform (\"ERP\", \"Platform\", or \"Service\")."},{"type":"text","text":"This Privacy Policy explains how ICON TECH PRO collects, uses, stores, protects, and shares information when authorized users access or use the ICON TECH PRO ERP."},{"type":"text","text":"The ERP is a business management platform used for ICON TECH PRO's internal and authorized business operations, including customer management, enquiries, quotations, sales, procurement, invoicing, business communications, employee access management, reporting, and related business processes."},{"type":"text","text":"By using the ERP, you acknowledge the practices described in this Privacy Policy."}];
const SECTIONS = [{"number":1,"title":"WHO WE ARE","blocks":[{"type":"text","text":"ICON TECH PRO"},{"type":"text","text":"Ameer Estate, 503 A Block,"},{"type":"text","text":"Sanjeeva Reddy Nagar,"},{"type":"text","text":"Hyderabad, Telangana – 500038, India."},{"type":"text","text":"Website: https://icontechpro.in"},{"type":"text","text":"The ICON TECH PRO ERP is operated for authorized business users of ICON TECH PRO."},{"type":"text","text":"For privacy-related questions or requests, contact:"},{"type":"text","text":"Email: vineet@icontechpro.in"}]},{"number":2,"title":"SCOPE OF THIS PRIVACY POLICY","blocks":[{"type":"text","text":"This Privacy Policy applies to information processed through the ICON TECH PRO ERP and its authorized integrations."},{"type":"text","text":"It applies to information relating to:"},{"type":"bullets","items":["ICON TECH PRO employees and authorized ERP users;","customers and prospective customers;","suppliers and business partners;","business contacts;","quotations, orders, invoices and payments;","business communications processed through authorized integrations; and","information required to operate, secure, audit and maintain the ERP."]},{"type":"text","text":"This Privacy Policy does not replace the privacy policies of third-party services such as Google, Zoho, Cloudflare, Supabase or other third-party services. Those services may process information under their own terms and privacy policies."}]},{"number":3,"title":"INFORMATION WE COLLECT AND PROCESS","blocks":[{"type":"text","text":"Depending on how the ERP is used, we may process the following categories of information."},{"type":"text","text":"3.1 Employee and User Information"},{"type":"text","text":"For authorized ERP users, we may process:"},{"type":"bullets","items":["name;","designation;","ERP Login Email;","corporate email address, where applicable;","telephone or contact information;","employee or user identifier;","assigned role and permissions;","account status;","authentication and security information;","login and session information;","audit and activity records."]},{"type":"text","text":"Passwords are not stored in plaintext. Authentication credentials are protected using password hashing and security controls appropriate to the ERP architecture."},{"type":"text","text":"3.2 Customer and Business Contact Information"},{"type":"text","text":"The ERP may contain information provided by ICON TECH PRO employees during normal business operations, including:"},{"type":"bullets","items":["customer name;","company name;","contact person's name;","designation;","telephone number;","email address;","business address;","GST or other business identification information where applicable;","enquiry information;","quotation information;","order information;","invoice and payment information;","project information;","communication history; and","other information reasonably required for business operations."]},{"type":"text","text":"3.3 Supplier and Procurement Information"},{"type":"text","text":"The ERP may process supplier and distributor information, including:"},{"type":"bullets","items":["supplier name;","company information;","contact details;","pricing information;","quotation and procurement information;","purchase information;","payment and accounting-related information;","communication records; and","other information required for procurement operations."]}]},{"number":4,"title":"GMAIL AND GOOGLE USER DATA","blocks":[{"type":"text","text":"The ERP may provide an optional Gmail integration for authorized employees who connect their Google/Gmail account to the ERP."},{"type":"text","text":"The Gmail integration is used only after the authorized user grants permission through Google's OAuth authorization process."},{"type":"text","text":"Depending on the permissions granted to the application, the ERP may access Google user data including:"},{"type":"bullets","items":["the authorized Google account identity;","Gmail messages;","email metadata;","email content where required for the enabled mailbox functionality;","message recipients and senders;","message timestamps and related metadata;","attachments associated with messages where required by the enabled functionality; and","OAuth authorization information required to maintain the authorized connection."]},{"type":"text","text":"The exact Google data accessed is limited by the Google OAuth scopes approved for the application."}]},{"number":5,"title":"HOW GMAIL DATA IS USED","blocks":[{"type":"text","text":"Gmail data accessed by the ERP is used only to provide authorized business email functionality within the ERP."},{"type":"text","text":"Examples include:"},{"type":"bullets","items":["displaying authorized mailbox messages;","reading business correspondence;","composing and sending business emails;","replying to business emails;","supporting employee mailbox workflows;","associating relevant business communications with authorized ERP workflows; and","maintaining the authorized Gmail integration."]},{"type":"text","text":"Google user data is NOT used for advertising, behavioral advertising, selling user information, or unrelated commercial purposes."},{"type":"text","text":"Google user data is NOT used to train or improve generalized artificial-intelligence or machine-learning models."},{"type":"text","text":"The ERP does not use Gmail data for purposes unrelated to the user-facing Gmail functionality for which the user granted authorization."}]},{"number":6,"title":"GOOGLE API SERVICES USER DATA AND LIMITED USE","blocks":[{"type":"text","text":"ICON TECH PRO's use of Google user data obtained through Google APIs is intended to comply with the Google API Services User Data Policy, including the applicable Limited Use requirements."},{"type":"text","text":"Google user data is accessed only to provide or improve user-facing functionality that is clearly available within the ICON TECH PRO ERP and for purposes disclosed in this Privacy Policy."},{"type":"text","text":"Google user data is not sold."},{"type":"text","text":"Google user data is not used for advertising."},{"type":"text","text":"Google user data is not transferred to third parties except where such transfer is necessary to provide the authorized functionality, required by law, or otherwise permitted under Google's applicable policies and the user's authorization."},{"type":"text","text":"Where a third-party service is required to provide an authorized ERP feature, access is limited to the information necessary for that feature and is subject to applicable security and contractual controls."}]},{"number":7,"title":"ZOHO INTEGRATIONS","blocks":[{"type":"text","text":"The ERP may integrate with Zoho services, including Zoho CRM and Zoho Mail, for authorized business operations."},{"type":"text","text":"Depending on the enabled integration, information may be exchanged with Zoho to:"},{"type":"bullets","items":["synchronize authorized customer or prospect information;","manage authorized business email functionality;","synchronize employee mailbox information;","support CRM workflows;","maintain business records; and","provide other explicitly enabled ERP functionality."]},{"type":"text","text":"Zoho access is controlled through authorized integration credentials and ERP permissions."},{"type":"text","text":"Where an employee is offboarded or their access is disabled, the ERP may disconnect or disable the associated integration while retaining business records where retention is required for legitimate business, accounting, audit, security, or legal purposes."}]},{"number":8,"title":"HOW WE USE INFORMATION","blocks":[{"type":"text","text":"Information processed by the ERP may be used for:"},{"type":"bullets","items":["managing customers and prospects;","handling enquiries and leads;","preparing and managing quotations;","managing sales and orders;","procurement and supplier management;","invoicing and payment administration;","employee account management;","business communication;","CRM synchronization;","reporting and business analysis;","audit and accountability;","security and fraud prevention;","troubleshooting and system maintenance;","compliance with legal obligations; and","operating and improving the ERP's user-facing business functionality."]},{"type":"text","text":"We do not use personal information for purposes incompatible with the purposes described in this Privacy Policy without appropriate notice or authorization where required."}]},{"number":9,"title":"INFORMATION SHARING","blocks":[{"type":"text","text":"ICON TECH PRO may share or provide access to information only where reasonably necessary for legitimate business, operational, technical, security, or legal purposes."},{"type":"text","text":"Information may be accessible to:"},{"type":"bullets","items":["authorized ICON TECH PRO employees based on their assigned permissions;","ICON TECH PRO administrators where required for administration and security;","authorized service providers supporting ERP infrastructure;","authorized integration providers such as Google and Zoho;","professional advisers where reasonably necessary; and","government, regulatory, law-enforcement, or judicial authorities where legally required."]},{"type":"text","text":"ICON TECH PRO does not sell personal information."}]},{"number":10,"title":"ROLE-BASED ACCESS","blocks":[{"type":"text","text":"The ERP uses role-based access controls to limit access to information according to an employee's responsibilities."},{"type":"text","text":"Different employees may have different access to:"},{"type":"bullets","items":["customers;","quotations;","sales;","invoices;","payments;","procurement;","reports;","business email;","CRM integrations; and","administrative functions."]},{"type":"text","text":"Access to another employee's mailbox or restricted business information is not automatically granted merely because a person is an ERP user."}]},{"number":11,"title":"GMAIL MAILBOX ISOLATION","blocks":[{"type":"text","text":"Where multiple employees connect Gmail or other supported business mailboxes, access is designed to remain associated with the authorized employee and the permissions assigned to that employee."},{"type":"text","text":"An employee is not entitled to access another employee's mailbox merely because both employees use the ERP."},{"type":"text","text":"Administrative access to mailbox-related functions is restricted according to the ERP's access-control policies."}]},{"number":12,"title":"SECURITY","blocks":[{"type":"text","text":"ICON TECH PRO uses reasonable technical and organizational safeguards intended to protect information processed through the ERP."},{"type":"text","text":"Security measures may include:"},{"type":"bullets","items":["password hashing;","encrypted integration credentials and tokens;","role-based authorization;","authenticated sessions;","access controls;","audit logging;","secure OAuth authorization;","session invalidation;","account disabling and offboarding controls;","database access controls;","protection against unauthorized mailbox access; and","security monitoring and testing."]},{"type":"text","text":"No internet-connected system can be guaranteed to be completely secure. Accordingly, ICON TECH PRO cannot guarantee absolute security of information."}]},{"number":13,"title":"AUTHENTICATION AND PASSWORD SECURITY","blocks":[{"type":"text","text":"ERP passwords are processed using secure password hashing rather than plaintext storage."},{"type":"text","text":"ICON TECH PRO personnel will not normally ask users to provide their ERP password."},{"type":"text","text":"Users are responsible for protecting their authentication credentials and must not knowingly share their passwords or authentication tokens with other persons."}]},{"number":14,"title":"ACCOUNT RECOVERY","blocks":[{"type":"text","text":"The ERP may provide password recovery functionality."},{"type":"text","text":"Password recovery uses controlled, time-limited, single-use security tokens and appropriate security controls."},{"type":"text","text":"The ERP is designed to avoid revealing whether a particular email address belongs to an active account through password-reset request responses."}]},{"number":15,"title":"AUDIT LOGS AND SECURITY RECORDS","blocks":[{"type":"text","text":"The ERP may maintain audit records relating to important business and security activities."},{"type":"text","text":"These records may include:"},{"type":"bullets","items":["account changes;","permission changes;","login and security events;","quotation and financial workflow events;","integration events;","mailbox authorization events;","administrative actions; and","other events necessary for accountability and security."]},{"type":"text","text":"Audit records may be retained for legitimate business, security, compliance and legal purposes."}]},{"number":16,"title":"DATA RETENTION","blocks":[{"type":"text","text":"ICON TECH PRO retains information for as long as reasonably necessary for the purposes described in this Privacy Policy."},{"type":"text","text":"Retention periods may vary depending on the type of information and applicable requirements."},{"type":"text","text":"Business, accounting, tax, financial, contractual, audit and legal records may need to be retained for longer periods."},{"type":"text","text":"When information is no longer reasonably required and there is no legal or legitimate business requirement to retain it, ICON TECH PRO may delete, anonymize, or otherwise dispose of it using appropriate procedures."}]},{"number":17,"title":"EMPLOYEE OFFBOARDING","blocks":[{"type":"text","text":"When an employee leaves ICON TECH PRO or their ERP access is otherwise terminated, appropriate security measures may include:"},{"type":"bullets","items":["disabling the ERP account;","revoking active sessions;","disabling integration access;","disconnecting associated mailbox access;","stopping applicable synchronization processes;","preserving required business records; and","reassignment of relevant business responsibilities."]},{"type":"text","text":"Termination of an employee's access does not automatically require deletion of business records that ICON TECH PRO is required or reasonably entitled to retain."}]},{"number":18,"title":"DATA ACCURACY","blocks":[{"type":"text","text":"ICON TECH PRO may rely on authorized employees and business users to enter and maintain accurate business information."},{"type":"text","text":"Users should correct inaccurate information through the appropriate ERP process or contact an administrator where necessary."}]},{"number":19,"title":"THIRD-PARTY SERVICES","blocks":[{"type":"text","text":"The ERP may depend on third-party infrastructure and services, including, where enabled:"},{"type":"bullets","items":["Google APIs and Gmail;","Zoho services;","Supabase;","Cloudflare; and","other infrastructure, hosting, security, communication, or integration providers."]},{"type":"text","text":"These providers may process information as necessary to provide their services."},{"type":"text","text":"Their respective terms and privacy policies may also apply."}]},{"number":20,"title":"COOKIES AND SESSION TECHNOLOGIES","blocks":[{"type":"text","text":"The ERP may use cookies, session tokens, and similar technologies that are necessary to:"},{"type":"bullets","items":["authenticate users;","maintain secure sessions;","preserve application state;","protect the ERP from unauthorized access; and","provide core application functionality."]},{"type":"text","text":"The ERP does not use authentication cookies for advertising purposes."}]},{"number":21,"title":"CHILDREN'S PRIVACY","blocks":[{"type":"text","text":"The ICON TECH PRO ERP is a business application intended for authorized business users."},{"type":"text","text":"It is not directed toward children and is not intended for use by children."}]},{"number":22,"title":"DATA REQUESTS AND PRIVACY QUESTIONS","blocks":[{"type":"text","text":"For questions regarding personal information processed through the ERP, users may contact:"},{"type":"text","text":"ICON TECH PRO"},{"type":"text","text":"Ameer Estate, 503 A Block,"},{"type":"text","text":"Sanjeeva Reddy Nagar,"},{"type":"text","text":"Hyderabad, Telangana – 500038, India."},{"type":"text","text":"Email: vineet@icontechpro.in"},{"type":"text","text":"We will consider privacy requests in accordance with applicable law and our legitimate business, security, accounting, contractual, and legal requirements."}]},{"number":23,"title":"CHANGES TO THIS PRIVACY POLICY","blocks":[{"type":"text","text":"ICON TECH PRO may update this Privacy Policy when our ERP functionality, integrations, data practices, legal obligations, or security practices change."},{"type":"text","text":"The updated version will be published on the applicable Privacy Policy webpage with a revised \"Last Updated\" date."},{"type":"text","text":"Where required, users will receive appropriate notice of material changes."}]},{"number":24,"title":"GOOGLE USER DATA COMPLIANCE","blocks":[{"type":"text","text":"ICON TECH PRO is committed to handling Google user data in accordance with the applicable Google API Services User Data Policy and Limited Use requirements."},{"type":"text","text":"Google user data accessed through the ERP is used only for the user-facing functionality described in this Privacy Policy and the applicable Google authorization flow."},{"type":"text","text":"ICON TECH PRO does not sell Google user data or use Google user data for advertising."}]}];

export default function PrivacyPolicyPage() {
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
            <Link href="/privacy-policy" className="hover:text-white transition text-brand-400 font-bold">Privacy Policy</Link>
            <Link href="/terms-of-service" className="hover:text-white transition ">Terms of Service</Link>
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
          <span className="text-slate-200 font-semibold">Privacy Policy</span>
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
            Privacy Policy
          </h1>
          <p className="text-sm sm:text-base text-slate-300 max-w-3xl leading-relaxed">
            Official Privacy Policy for the ICON TECH PRO ERP platform, detailing information collection, Google API User Data Policy compliance, role-based access, and enterprise data protection.
          </p>

          <div className="mt-6 pt-6 border-t border-slate-800/80 flex flex-wrap items-center gap-4 text-xs">
            <Link
              href="/terms-of-service"
              className="inline-flex items-center gap-1.5 text-brand-400 hover:text-brand-300 font-semibold"
            >
              <FileText className="w-4 h-4" />
              <span>View Terms of Service</span>
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
