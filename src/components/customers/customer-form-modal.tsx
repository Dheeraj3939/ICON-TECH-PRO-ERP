'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  X,
  Building2,
  User,
  Landmark,
  Phone,
  Mail,
  MapPin,
  FileText,
  CreditCard,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Loader2,
  ShieldCheck,
  Plus,
  Trash2,
  Copy,
  Users,
  Eye,
} from 'lucide-react';
import { createCustomer, updateCustomer, getSalespeopleList, checkCustomerDuplicate } from '@/lib/actions/customers';
import { getCurrentSessionUser } from '@/lib/actions/users';
import { ENQUIRY_SOURCES, isCanonicalEnquirySource } from '@/lib/constants/customer-source';
import type { Customer, CustomerType, CustomerContact, CustomerShippingAddress } from '@/types/customer';

interface CustomerFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (customer: Customer) => void;
  editCustomer?: Customer | null;
}

export function CustomerFormModal({
  isOpen,
  onClose,
  onSuccess,
  editCustomer,
}: CustomerFormModalProps) {
  const router = useRouter();
  const [customerType, setCustomerType] = useState<CustomerType>('COMPANY');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [sameAsBilling, setSameAsBilling] = useState(true);
  const [salespeople, setSalespeople] = useState<Array<{ id: string; name: string; role: string }>>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);

  // Multiple Contacts Support
  const [additionalContacts, setAdditionalContacts] = useState<CustomerContact[]>([]);

  // Multiple Shipping Addresses Support
  const [shippingAddresses, setShippingAddresses] = useState<CustomerShippingAddress[]>([]);

  // Structured Internal Notes
  const [customerNotes, setCustomerNotes] = useState('');
  const [requirementSummary, setRequirementSummary] = useState('');
  const [importantInternalInfo, setImportantInternalInfo] = useState('');

  // Confirmation Modal State
  const [createdConfirmation, setCreatedConfirmation] = useState<Customer | null>(null);

  // Duplicate Warning State
  const [duplicateWarning, setDuplicateWarning] = useState<{
    matchedBy: string;
    customer: Customer;
  } | null>(null);

  // Form State
  const [companyName, setCompanyName] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [designation, setDesignation] = useState('');
  const [phone, setPhone] = useState('');
  const [alternatePhone, setAlternatePhone] = useState('');
  const [email, setEmail] = useState('');
  const [billingAddress, setBillingAddress] = useState('');
  const [shippingAddress, setShippingAddress] = useState('');
  const [city, setCity] = useState('Hyderabad');
  const [state, setState] = useState('Telangana');
  const [stateCode, setStateCode] = useState('36');
  const [pincode, setPincode] = useState('');
  const [gstin, setGstin] = useState('');
  const [pan, setPan] = useState('');
  const [creditLimit, setCreditLimit] = useState('0');
  const [enquirySource, setEnquirySource] = useState('Walk-in');
  const [salespersonId, setSalespersonId] = useState('');
  const [status, setStatus] = useState<'ACTIVE' | 'INACTIVE' | 'SUSPENDED'>('ACTIVE');
  const [notes, setNotes] = useState('');

  // Government & GeM specific fields
  const [departmentName, setDepartmentName] = useState('');
  const [tenderReference, setTenderReference] = useState('');
  const [gemOrderNumber, setGemOrderNumber] = useState('');
  const [gemSellerId, setGemSellerId] = useState('');
  const [emdAmount, setEmdAmount] = useState('0');
  const [nodalOfficer, setNodalOfficer] = useState('');
  const [paymentTermsDays, setPaymentTermsDays] = useState('30');

  // Load Current Session User & Salespeople
  useEffect(() => {
    getCurrentSessionUser().then((u) => {
      setCurrentUser(u);
      if (u?.id && !editCustomer) {
        setSalespersonId(u.id);
      }
    });

    getSalespeopleList().then((list) => {
      setSalespeople(list);
    });
  }, [editCustomer]);

  // Live Duplicate Detection (Phone, Email, GSTIN)
  useEffect(() => {
    const timer = setTimeout(async () => {
      const cleanPhone = phone.trim();
      const cleanEmail = email.trim();
      const cleanGstin = gstin.trim();

      if (cleanPhone.length >= 10 || (cleanEmail.includes('@') && cleanEmail.length > 5) || cleanGstin.length >= 10) {
        const res = await checkCustomerDuplicate({
          phone: cleanPhone.length >= 10 ? cleanPhone : undefined,
          email: cleanEmail.includes('@') ? cleanEmail : undefined,
          gstin: cleanGstin.length >= 10 ? cleanGstin : undefined,
          excludeId: editCustomer?.id,
        });

        if (res.isDuplicate && res.existingCustomer) {
          setDuplicateWarning({
            matchedBy: res.matchedBy || 'record',
            customer: res.existingCustomer,
          });
        } else {
          setDuplicateWarning(null);
        }
      } else {
        setDuplicateWarning(null);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [phone, email, gstin, editCustomer?.id]);

  // Pincode auto-populate City, State, State Code
  const handlePincodeChange = (pin: string) => {
    const cleaned = pin.replace(/\D/g, '').slice(0, 6);
    setPincode(cleaned);
    if (cleaned.length === 6) {
      const prefix = parseInt(cleaned.slice(0, 3), 10);
      if (prefix >= 500 && prefix <= 509) {
        setCity('Hyderabad');
        setState('Telangana');
        setStateCode('36');
      } else if (prefix >= 515 && prefix <= 535) {
        setCity('Vijayawada');
        setState('Andhra Pradesh');
        setStateCode('37');
      } else if (prefix >= 560 && prefix <= 590) {
        setCity('Bengaluru');
        setState('Karnataka');
        setStateCode('29');
      } else if (prefix >= 600 && prefix <= 643) {
        setCity('Chennai');
        setState('Tamil Nadu');
        setStateCode('33');
      } else if (prefix >= 400 && prefix <= 445) {
        setCity('Mumbai');
        setState('Maharashtra');
        setStateCode('27');
      } else if (prefix >= 110 && prefix <= 119) {
        setCity('New Delhi');
        setState('Delhi');
        setStateCode('07');
      }
    }
  };

  // Populate when editing
  useEffect(() => {
    if (editCustomer) {
      setCustomerType(editCustomer.customer_type);
      setCompanyName(editCustomer.company_name || '');
      setCustomerName(editCustomer.customer_name || '');
      setContactPerson(editCustomer.contact_person || '');
      setDesignation(editCustomer.designation || '');
      setPhone(editCustomer.phone || '');
      setAlternatePhone(editCustomer.alternate_phone || '');
      setEmail(editCustomer.email || '');
      setBillingAddress(editCustomer.billing_address || '');
      setShippingAddress(editCustomer.shipping_address || '');
      setCity(editCustomer.city || 'Hyderabad');
      setState(editCustomer.state || 'Telangana');
      setStateCode(editCustomer.state_code || '36');
      setPincode(editCustomer.pincode || '');
      setGstin(editCustomer.gstin || '');
      setPan(editCustomer.pan || '');
      setCreditLimit(editCustomer.credit_limit?.toString() || '0');
      setEnquirySource(editCustomer.enquiry_source || 'Walk-in');
      setSalespersonId(editCustomer.salesperson_id || '');
      setStatus(editCustomer.status || 'ACTIVE');
      setNotes(editCustomer.notes || '');
      setSameAsBilling(editCustomer.billing_address === editCustomer.shipping_address);
      setDepartmentName(editCustomer.department_name || '');
      setTenderReference(editCustomer.tender_reference || '');
      setGemOrderNumber(editCustomer.gem_order_number || '');
      setGemSellerId(editCustomer.gem_seller_id || '');
      setEmdAmount(editCustomer.emd_amount?.toString() || '0');
      setNodalOfficer(editCustomer.nodal_officer || '');
      setPaymentTermsDays(editCustomer.payment_terms_days?.toString() || '30');
      setAdditionalContacts(editCustomer.contacts && editCustomer.contacts.length > 1 ? editCustomer.contacts.slice(1) : []);
      setShippingAddresses(editCustomer.shipping_addresses || []);
      setCustomerNotes(editCustomer.internal_notes?.general_notes || editCustomer.notes || '');
      setRequirementSummary(editCustomer.internal_notes?.requirement_summary || '');
      setImportantInternalInfo(editCustomer.internal_notes?.internal_commercial_info || '');
    } else {
      resetForm();
    }
  }, [editCustomer, isOpen]);

  function resetForm() {
    setCustomerType('COMPANY');
    setCompanyName('');
    setCustomerName('');
    setContactPerson('');
    setDesignation('');
    setPhone('');
    setAlternatePhone('');
    setEmail('');
    setBillingAddress('');
    setShippingAddress('');
    setCity('Hyderabad');
    setState('Telangana');
    setStateCode('36');
    setPincode('');
    setGstin('');
    setPan('');
    setCreditLimit('0');
    setEnquirySource('Walk-in');
    setStatus('ACTIVE');
    setNotes('');
    setSameAsBilling(true);
    setErrorMsg(null);
    setDuplicateWarning(null);
    setDepartmentName('');
    setTenderReference('');
    setGemOrderNumber('');
    setGemSellerId('');
    setEmdAmount('0');
    setNodalOfficer('');
    setPaymentTermsDays('30');
    setAdditionalContacts([]);
    setShippingAddresses([]);
    setCustomerNotes('');
    setRequirementSummary('');
    setImportantInternalInfo('');
    setCreatedConfirmation(null);
  }

  if (!isOpen) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMsg(null);

    const isCompany = customerType === 'COMPANY';
    const isGovt = customerType === 'GOVERNMENT';
    const isIndividual = customerType === 'INDIVIDUAL';

    // Client-side quick validation
    if (isCompany && !companyName.trim()) {
      setErrorMsg('Company Name is required for B2B customers.');
      setIsSubmitting(false);
      return;
    }
    if (isGovt && !companyName.trim()) {
      setErrorMsg('Department / Agency Name is required for Government / GeM customers.');
      setIsSubmitting(false);
      return;
    }
    if (isCompany && !contactPerson.trim()) {
      setErrorMsg('Contact Person is required for B2B customers.');
      setIsSubmitting(false);
      return;
    }
    if (isCompany && !designation.trim()) {
      setErrorMsg('Designation is required for Company / B2B customers.');
      setIsSubmitting(false);
      return;
    }
    if (isCompany && (!email.trim() || !email.includes('@'))) {
      setErrorMsg('A valid Corporate Email Address is required for Company / B2B customers.');
      setIsSubmitting(false);
      return;
    }
    if (isGovt && !contactPerson.trim()) {
      setErrorMsg('Nodal Officer is required for Government / GeM customers.');
      setIsSubmitting(false);
      return;
    }
    if (isIndividual && !customerName.trim()) {
      setErrorMsg('Customer Name is required for Individual customers.');
      setIsSubmitting(false);
      return;
    }
    if (!phone.trim() || !/^[6-9]\d{9}$/.test(phone.trim())) {
      setErrorMsg('Please enter a valid 10-digit Indian mobile number (e.g. 9876543210).');
      setIsSubmitting(false);
      return;
    }
    if (gstin.trim() && !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(gstin.trim())) {
      setErrorMsg('Invalid GSTIN format. Example: 36AAACI0000A1Z5');
      setIsSubmitting(false);
      return;
    }
    if (pan.trim() && !/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(pan.trim())) {
      setErrorMsg('Invalid PAN format. Example: AAACI0000A');
      setIsSubmitting(false);
      return;
    }
    if (pincode.trim() && !/^[1-9][0-9]{5}$/.test(pincode.trim())) {
      setErrorMsg('Pincode must be a 6-digit Indian postal code.');
      setIsSubmitting(false);
      return;
    }

    const compiledNotes = [
      customerNotes.trim() ? `Customer Notes: ${customerNotes.trim()}` : '',
      requirementSummary.trim() ? `Requirement Summary: ${requirementSummary.trim()}` : '',
      importantInternalInfo.trim() ? `Internal Confidential: ${importantInternalInfo.trim()}` : '',
      notes.trim(),
    ].filter(Boolean).join('\n---\n');

    const payload: any = {
      customer_type: customerType,
      customer_name: (isCompany || isGovt) ? companyName.trim() : customerName.trim(),
      company_name: (isCompany || isGovt) ? companyName.trim() : undefined,
      department_name: isGovt ? (departmentName.trim() || companyName.trim()) : undefined,
      tender_reference: isGovt ? tenderReference.trim() || undefined : undefined,
      gem_order_number: isGovt ? gemOrderNumber.trim() || undefined : undefined,
      gem_seller_id: isGovt ? gemSellerId.trim() || undefined : undefined,
      emd_amount: isGovt ? parseFloat(emdAmount) || 0 : undefined,
      nodal_officer: isGovt ? (nodalOfficer.trim() || contactPerson.trim() || undefined) : undefined,
      payment_terms_days: isGovt ? parseInt(paymentTermsDays) || 30 : undefined,
      contact_person: (isCompany || isGovt) ? (contactPerson.trim() || nodalOfficer.trim() || undefined) : undefined,
      designation: (isCompany || isGovt) ? designation.trim() || undefined : undefined,
      phone: phone.trim(),
      alternate_phone: alternatePhone.trim() || undefined,
      email: email.trim() || undefined,
      billing_address: billingAddress.trim() || 'HITEC City, Hyderabad',
      shipping_address: sameAsBilling
        ? billingAddress.trim() || 'HITEC City, Hyderabad'
        : shippingAddress.trim() || undefined,
      city: city.trim(),
      state: state.trim(),
      state_code: stateCode.trim(),
      pincode: pincode.trim() || undefined,
      gstin: gstin.trim().toUpperCase() || undefined,
      pan: pan.trim().toUpperCase() || undefined,
      credit_limit: parseFloat(creditLimit) || 0,
      enquiry_source: enquirySource,
      salesperson_id: salespersonId || undefined,
      status: status,
      notes: compiledNotes || undefined,
      contacts: [
        {
          name: (isCompany || isGovt) ? (contactPerson.trim() || nodalOfficer.trim()) : customerName.trim(),
          designation: designation.trim() || undefined,
          phone: phone.trim(),
          email: email.trim() || undefined,
          is_primary: true,
        },
        ...additionalContacts,
      ],
      shipping_addresses: shippingAddresses.length > 0 ? shippingAddresses : [
        {
          label: 'Primary Delivery Address',
          address_line1: (sameAsBilling ? billingAddress.trim() : shippingAddress.trim()) || billingAddress.trim() || 'Hyderabad',
          city: city.trim(),
          state: state.trim(),
          pincode: pincode.trim(),
          is_default: true,
        },
      ],
      internal_notes: {
        general_notes: customerNotes.trim(),
        requirement_summary: requirementSummary.trim(),
        internal_commercial_info: importantInternalInfo.trim(),
      },
    };

    if (editCustomer) {
      const res = await updateCustomer(editCustomer.id, payload);
      setIsSubmitting(false);
      if (res.success && res.customer) {
        onSuccess(res.customer);
        onClose();
      } else {
        setErrorMsg(res.error || 'Failed to update customer');
      }
    } else {
      const res = await createCustomer(payload);
      setIsSubmitting(false);
      if (res.success && res.customer) {
        setCreatedConfirmation(res.customer);
      } else {
        setErrorMsg(res.error || 'Failed to create customer');
      }
    }
  }

  if (createdConfirmation) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in">
        <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in zoom-in-95">
          <div className="p-8 text-center bg-gradient-to-b from-emerald-50/50 to-white">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-sm border border-emerald-200">
              <CheckCircle2 className="w-9 h-9" />
            </div>
            <span className="inline-block px-3 py-1 bg-emerald-100 text-emerald-800 text-xs font-bold rounded-full uppercase tracking-wider mb-2">
              Customer Master Created
            </span>
            <h3 className="text-2xl font-black text-slate-900 tracking-tight mb-1">
              {createdConfirmation.company_name || createdConfirmation.customer_name}
            </h3>
            <p className="text-xs text-slate-500 mb-6">
              Assigned Unique Permanent ERP Identification Code
            </p>

            {/* Code Box */}
            <div className="bg-slate-900 text-white rounded-2xl p-4 mb-6 shadow-inner flex items-center justify-between">
              <div className="text-left">
                <div className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
                  ERP Customer ID
                </div>
                <div className="text-xl font-mono font-bold tracking-widest text-brand-400">
                  {createdConfirmation.customer_code}
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(createdConfirmation.customer_code);
                }}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition border border-slate-700"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>Copy</span>
              </button>
            </div>

            {/* Summary Details */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-left text-xs space-y-2 mb-6">
              <div className="flex justify-between text-slate-600">
                <span className="font-medium">Primary Contact:</span>
                <span className="font-semibold text-slate-800">
                  {createdConfirmation.contact_person || createdConfirmation.customer_name}
                </span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span className="font-medium">Phone:</span>
                <span className="font-mono text-slate-800">{createdConfirmation.phone}</span>
              </div>
              {createdConfirmation.email && (
                <div className="flex justify-between text-slate-600">
                  <span className="font-medium">Email:</span>
                  <span className="text-slate-800">{createdConfirmation.email}</span>
                </div>
              )}
              <div className="flex justify-between text-slate-600">
                <span className="font-medium">Type:</span>
                <span className="font-semibold text-slate-800">{createdConfirmation.customer_type}</span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  const customer = createdConfirmation;
                  setCreatedConfirmation(null);
                  onSuccess(customer);
                  onClose();
                  router.push(`/dashboard/customers/${customer.id}`);
                }}
                className="flex-1 py-3 px-4 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold shadow-md shadow-brand-500/20 flex items-center justify-center gap-2 transition"
              >
                <Eye className="w-4 h-4" />
                <span>View Customer 360</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  const customer = createdConfirmation;
                  setCreatedConfirmation(null);
                  onSuccess(customer);
                  onClose();
                }}
                className="py-3 px-5 rounded-xl border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-semibold transition"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
          <div>
            <div className="inline-flex items-center gap-2 text-xs font-semibold text-brand-600 uppercase tracking-wider mb-0.5">
              <ShieldCheck className="w-4 h-4" />
              <span>Customer Master Management</span>
            </div>
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">
              {editCustomer ? `Edit Customer (${editCustomer.customer_code})` : 'Create New Customer'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-2.5 text-xs text-rose-800 animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
              <span className="font-medium">{errorMsg}</span>
            </div>
          )}

          {/* Real-time Customer Duplicate Warning Banner */}
          {duplicateWarning && (
            <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-300 flex items-start gap-2.5 text-xs text-amber-900 animate-in fade-in">
              <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">Possible Duplicate Record Detected:</span> Matches existing customer{' '}
                <strong>{duplicateWarning.customer.customer_name}</strong> (ID:{' '}
                <span className="font-mono font-bold text-amber-950">{duplicateWarning.customer.customer_code}</span> &bull; Phone:{' '}
                {duplicateWarning.customer.phone} &bull; Matched by {duplicateWarning.matchedBy.toUpperCase()}).
              </div>
            </div>
          )}

          {/* Customer ID Notice */}
          <div className="p-3.5 rounded-xl bg-slate-100/90 border border-slate-200 flex items-center justify-between text-xs text-slate-700">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-900">Customer ID:</span>
              {editCustomer ? (
                <span className="px-2.5 py-0.5 rounded-md bg-brand-100 text-brand-800 font-mono font-bold text-xs">
                  {editCustomer.customer_code}
                </span>
              ) : (
                <span className="italic text-slate-500 font-mono">
                  Auto-assigned upon save (ICON26XXXX &bull; Annual Reset)
                </span>
              )}
            </div>
            <span className="text-[11px] text-slate-400 uppercase font-semibold">
              Non-Editable &bull; DB Trigger
            </span>
          </div>

          {/* Customer Type Toggle (Disabled if editing) */}
          {!editCustomer && (
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Customer Classification <span className="text-rose-500">*</span>
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 p-1.5 bg-slate-100 rounded-2xl border border-slate-200">
                <button
                  type="button"
                  onClick={() => setCustomerType('COMPANY')}
                  className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition ${
                    customerType === 'COMPANY'
                      ? 'bg-white text-brand-700 shadow-sm border border-slate-200'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Building2 className="w-4 h-4" />
                  <span>Company / B2B Account</span>
                </button>

                <button
                  type="button"
                  onClick={() => setCustomerType('INDIVIDUAL')}
                  className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition ${
                    customerType === 'INDIVIDUAL'
                      ? 'bg-white text-brand-700 shadow-sm border border-slate-200'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <User className="w-4 h-4" />
                  <span>Individual / B2C Client</span>
                </button>

                <button
                  type="button"
                  onClick={() => setCustomerType('GOVERNMENT')}
                  className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition ${
                    customerType === 'GOVERNMENT'
                      ? 'bg-white text-brand-700 shadow-sm border border-slate-200'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Landmark className="w-4 h-4" />
                  <span>Govt / GeM / PSU</span>
                </button>
              </div>
            </div>
          )}

          {/* Conditional Fields: Government vs Company vs Individual */}
          {customerType === 'GOVERNMENT' ? (
            <div className="space-y-4 pt-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Department / Agency / PSU Legal Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="e.g. Telangana State Technology Services (TSTS)"
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Nodal Officer / Contact Person <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={contactPerson}
                    onChange={(e) => setContactPerson(e.target.value)}
                    placeholder="e.g. Sri R. K. Varma, Joint Director"
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Department / Ministry Name
                  </label>
                  <input
                    type="text"
                    value={departmentName}
                    onChange={(e) => setDepartmentName(e.target.value)}
                    placeholder="e.g. IT, Electronics & Communications"
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Tender Reference / RFP Number
                  </label>
                  <input
                    type="text"
                    value={tenderReference}
                    onChange={(e) => setTenderReference(e.target.value)}
                    placeholder="e.g. TSTS/HW/2026/892"
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs text-slate-900 font-mono focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    GeM Contract / Order Number
                  </label>
                  <input
                    type="text"
                    value={gemOrderNumber}
                    onChange={(e) => setGemOrderNumber(e.target.value)}
                    placeholder="e.g. GEMC-511687729831"
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs text-slate-900 font-mono focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    GeM Seller ID
                  </label>
                  <input
                    type="text"
                    value={gemSellerId}
                    onChange={(e) => setGemSellerId(e.target.value)}
                    placeholder="e.g. ICON-GEM-HYD-99"
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs text-slate-900 font-mono focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    EMD / Security Deposit (₹)
                  </label>
                  <input
                    type="number"
                    value={emdAmount}
                    onChange={(e) => setEmdAmount(e.target.value)}
                    placeholder="0"
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Payment Terms (Days)
                  </label>
                  <input
                    type="number"
                    value={paymentTermsDays}
                    onChange={(e) => setPaymentTermsDays(e.target.value)}
                    placeholder="30"
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition"
                  />
                </div>
              </div>
            </div>
          ) : customerType === 'COMPANY' ? (
            <div className="space-y-4 pt-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Company Legal Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="e.g. Acme Tech Solutions Pvt Ltd"
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Contact Person <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={contactPerson}
                    onChange={(e) => setContactPerson(e.target.value)}
                    placeholder="e.g. Ramesh Chandra"
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Designation / Role <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={designation}
                    onChange={(e) => setDesignation(e.target.value)}
                    placeholder="e.g. Procurement Manager"
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition"
                    required
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4 pt-1">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Customer Full Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="e.g. Dr. Rajesh Reddy"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition"
                  required
                />
              </div>
            </div>
          )}

          {/* Contact Details */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Primary Mobile Number <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 text-xs">+91</span>
                <input
                  type="tel"
                  maxLength={10}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                  placeholder="9876543210"
                  className="w-full pl-10 pr-3.5 py-2 rounded-xl border border-slate-300 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Alternate Phone (Optional)
              </label>
              <input
                type="tel"
                maxLength={10}
                value={alternatePhone}
                onChange={(e) => setAlternatePhone(e.target.value.replace(/\D/g, ''))}
                placeholder="Optional contact"
                className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Corporate Email Address {customerType === 'COMPANY' && <span className="text-rose-500">*</span>}
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="billing@example.com"
                className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition"
                required={customerType === 'COMPANY'}
              />
            </div>
          </div>

          {/* Multiple Contacts Section */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-brand-600" />
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Additional Contacts ({additionalContacts.length})
                </h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setAdditionalContacts([
                    ...additionalContacts,
                    { name: '', designation: '', phone: '', email: '', is_primary: false },
                  ]);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-100 transition shadow-sm"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Contact</span>
              </button>
            </div>

            {additionalContacts.length === 0 ? (
              <p className="text-xs text-slate-500 italic">No additional contacts added. Click &ldquo;Add Contact&rdquo; to add site engineers, procurement leads, or accounts POCs.</p>
            ) : (
              <div className="space-y-3">
                {additionalContacts.map((contact, idx) => (
                  <div key={idx} className="p-3 bg-white border border-slate-200 rounded-xl space-y-2 relative">
                    <button
                      type="button"
                      onClick={() => {
                        setAdditionalContacts(additionalContacts.filter((_, i) => i !== idx));
                      }}
                      className="absolute top-2 right-2 p-1 text-slate-400 hover:text-rose-600 rounded-md transition"
                      title="Remove Contact"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 pr-6">
                      <div>
                        <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">Name</label>
                        <input
                          type="text"
                          value={contact.name}
                          onChange={(e) => {
                            const updated = [...additionalContacts];
                            updated[idx].name = e.target.value;
                            setAdditionalContacts(updated);
                          }}
                          placeholder="Contact Name"
                          className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs text-slate-900"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">Designation</label>
                        <input
                          type="text"
                          value={contact.designation || ''}
                          onChange={(e) => {
                            const updated = [...additionalContacts];
                            updated[idx].designation = e.target.value;
                            setAdditionalContacts(updated);
                          }}
                          placeholder="Role / Title"
                          className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs text-slate-900"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">Mobile</label>
                        <input
                          type="tel"
                          value={contact.phone}
                          onChange={(e) => {
                            const updated = [...additionalContacts];
                            updated[idx].phone = e.target.value.replace(/\D/g, '').slice(0, 10);
                            setAdditionalContacts(updated);
                          }}
                          placeholder="10-digit Mobile"
                          className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs text-slate-900"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">Email</label>
                        <input
                          type="email"
                          value={contact.email || ''}
                          onChange={(e) => {
                            const updated = [...additionalContacts];
                            updated[idx].email = e.target.value;
                            setAdditionalContacts(updated);
                          }}
                          placeholder="Email address"
                          className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs text-slate-900"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Tax & Commercial Compliance */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Tax & Credit Compliance
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  GSTIN (15-character)
                </label>
                <input
                  type="text"
                  maxLength={15}
                  value={gstin}
                  onChange={(e) => setGstin(e.target.value.toUpperCase())}
                  placeholder="36AAACI0000A1Z5"
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-mono uppercase text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  PAN (10-character)
                </label>
                <input
                  type="text"
                  maxLength={10}
                  value={pan}
                  onChange={(e) => setPan(e.target.value.toUpperCase())}
                  placeholder="AAACI0000A"
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-mono uppercase text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Credit Limit (₹ INR)
                </label>
                <input
                  type="number"
                  min={0}
                  value={creditLimit}
                  onChange={(e) => setCreditLimit(e.target.value)}
                  placeholder="0.00"
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
                />
              </div>
            </div>
          </div>

          {/* Address Information */}
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {(customerType === 'COMPANY' || customerType === 'GOVERNMENT') ? 'Billing / Official Address' : 'Residential / Site Address'}
              </label>
              <textarea
                rows={2}
                value={billingAddress}
                onChange={(e) => setBillingAddress(e.target.value)}
                placeholder="Flat/Office, Building, Street, Area"
                className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition"
              />
            </div>

            {(customerType === 'COMPANY' || customerType === 'GOVERNMENT') && (
              <div className="space-y-2">
                <label className="inline-flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-700">
                  <input
                    type="checkbox"
                    checked={sameAsBilling}
                    onChange={(e) => setSameAsBilling(e.target.checked)}
                    className="w-4 h-4 rounded text-brand-600 focus:ring-brand-500 border-slate-300"
                  />
                  <span>Shipping Address is same as Billing Address</span>
                </label>

                {!sameAsBilling && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Shipping / Dispatch Address
                    </label>
                    <textarea
                      rows={2}
                      value={shippingAddress}
                      onChange={(e) => setShippingAddress(e.target.value)}
                      placeholder="Warehouse, Delivery Site, or Alternate Branch"
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition"
                    />
                  </div>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">City</label>
                <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-xs text-slate-900"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">State</label>
                <input
                  type="text"
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-xs text-slate-900"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">State Code</label>
                <input
                  type="text"
                  maxLength={2}
                  value={stateCode}
                  onChange={(e) => setStateCode(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-xs text-slate-900 font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Pincode</label>
                <input
                  type="text"
                  maxLength={6}
                  value={pincode}
                  onChange={(e) => handlePincodeChange(e.target.value)}
                  placeholder="500081"
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-xs text-slate-900 font-mono"
                />
              </div>
            </div>
          </div>

          {/* Multiple Shipping Addresses Section */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-brand-600" />
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Additional Delivery / Site Addresses ({shippingAddresses.length})
                </h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShippingAddresses([
                    ...shippingAddresses,
                    {
                      label: `Site / Branch ${shippingAddresses.length + 1}`,
                      address_line1: '',
                      city: 'Hyderabad',
                      state: 'Telangana',
                      pincode: '',
                      is_default: false,
                    },
                  ]);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-100 transition shadow-sm"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Address</span>
              </button>
            </div>

            {shippingAddresses.length === 0 ? (
              <p className="text-xs text-slate-500 italic">No secondary shipping addresses added. Default shipping address will be used for delivery orders.</p>
            ) : (
              <div className="space-y-3">
                {shippingAddresses.map((addr, idx) => (
                  <div key={idx} className="p-3 bg-white border border-slate-200 rounded-xl space-y-2 relative">
                    <button
                      type="button"
                      onClick={() => {
                        setShippingAddresses(shippingAddresses.filter((_, i) => i !== idx));
                      }}
                      className="absolute top-2 right-2 p-1 text-slate-400 hover:text-rose-600 rounded-md transition"
                      title="Remove Address"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pr-6">
                      <div>
                        <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">Address Label</label>
                        <input
                          type="text"
                          value={addr.label}
                          onChange={(e) => {
                            const updated = [...shippingAddresses];
                            updated[idx].label = e.target.value;
                            setShippingAddresses(updated);
                          }}
                          placeholder="e.g. Warehouse 2 / Site HQ"
                          className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs text-slate-900"
                          required
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">Address Line</label>
                        <input
                          type="text"
                          value={addr.address_line1}
                          onChange={(e) => {
                            const updated = [...shippingAddresses];
                            updated[idx].address_line1 = e.target.value;
                            setShippingAddresses(updated);
                          }}
                          placeholder="Plot / Road / Area"
                          className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs text-slate-900"
                          required
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">City</label>
                        <input
                          type="text"
                          value={addr.city}
                          onChange={(e) => {
                            const updated = [...shippingAddresses];
                            updated[idx].city = e.target.value;
                            setShippingAddresses(updated);
                          }}
                          className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs text-slate-900"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">State</label>
                        <input
                          type="text"
                          value={addr.state}
                          onChange={(e) => {
                            const updated = [...shippingAddresses];
                            updated[idx].state = e.target.value;
                            setShippingAddresses(updated);
                          }}
                          className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs text-slate-900"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">Pincode</label>
                        <input
                          type="text"
                          maxLength={6}
                          value={addr.pincode}
                          onChange={(e) => {
                            const updated = [...shippingAddresses];
                            updated[idx].pincode = e.target.value.replace(/\D/g, '').slice(0, 6);
                            setShippingAddresses(updated);
                          }}
                          placeholder="500081"
                          className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs text-slate-900"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Operational Governance */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-slate-100">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Enquiry Source
              </label>
              <select
                value={enquirySource}
                onChange={(e) => setEnquirySource(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                {!isCanonicalEnquirySource(enquirySource) && Boolean(enquirySource) && (
                  <option value={enquirySource}>
                    {enquirySource} (Historical / Legacy)
                  </option>
                )}
                {ENQUIRY_SOURCES.map((source) => (
                  <option key={source} value={source}>
                    {source}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-slate-700">
                  Assigned Salesperson
                </label>
                {currentUser?.role === 'Sales Executive' && (
                  <span className="text-[10px] text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded font-medium border border-amber-200">
                    Locked to you
                  </span>
                )}
              </div>
              <select
                value={salespersonId}
                onChange={(e) => setSalespersonId(e.target.value)}
                disabled={currentUser?.role === 'Sales Executive'}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed"
              >
                {salespeople.map((sp) => (
                  <option key={sp.id} value={sp.id}>
                    {sp.name} ({sp.role})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Account Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as any)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                <option value="ACTIVE">ACTIVE</option>
                <option value="INACTIVE">INACTIVE</option>
                <option value="SUSPENDED">SUSPENDED</option>
              </select>
            </div>
          </div>

          {/* Internal Notes & Intelligence */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
              <FileText className="w-4 h-4 text-brand-600" />
              <span>Internal Intelligence & Requirements</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  1. Customer Background / Notes
                </label>
                <textarea
                  rows={3}
                  value={customerNotes}
                  onChange={(e) => setCustomerNotes(e.target.value)}
                  placeholder="Key relationship background, previous projects..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  2. Requirement Summary
                </label>
                <textarea
                  rows={3}
                  value={requirementSummary}
                  onChange={(e) => setRequirementSummary(e.target.value)}
                  placeholder="Products sought, AV specs, acoustic needs..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  3. Important Internal Info (Confidential)
                </label>
                <textarea
                  rows={3}
                  value={importantInternalInfo}
                  onChange={(e) => setImportantInternalInfo(e.target.value)}
                  placeholder="Payment habits, margin guidance, discount caps..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
                />
              </div>
            </div>
          </div>

          {/* Footer Buttons */}
          <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold shadow-md shadow-brand-500/20 flex items-center gap-2 transition disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Saving Record...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{editCustomer ? 'Save Changes' : 'Create Customer'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
