'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { QuotationFormWorkspace } from '@/components/quotations/QuotationFormWorkspace';
import { getEnquiries } from '@/lib/actions/enquiries';
import { getCustomers } from '@/lib/actions/customers';

function NewQuotationContent() {
  const searchParams = useSearchParams();
  const enquiryId = searchParams?.get('enquiry_id');
  const customerId = searchParams?.get('customer_id');

  const [initialCustomer, setInitialCustomer] = useState<any>(undefined);
  const [enquiryContext, setEnquiryContext] = useState<any>(undefined);
  const [loading, setLoading] = useState(Boolean(enquiryId || customerId));

  useEffect(() => {
    let isMounted = true;

    async function loadContext() {
      if (enquiryId) {
        try {
          const res = await getEnquiries();
          if (res?.enquiries) {
            const enq = res.enquiries.find(
              (e) => e.id === enquiryId || e.enquiry_number === enquiryId
            );
            if (enq && isMounted) {
              setInitialCustomer({
                id: enq.customer_id,
                name: enq.customer_name,
                company: enq.company_name,
                phone: enq.phone,
                email: enq.email,
                customer_type: enq.customer_type,
              });
              setEnquiryContext({
                enquiry_id: enq.id,
                enquiry_number: enq.enquiry_number,
                product_category: enq.product_category,
                requirement_summary: enq.requirement_summary,
                estimated_budget: enq.estimated_budget,
                site_visit: (enq as any).site_visit,
              });
            }
          }
        } catch (err) {
          console.error('Failed to load enquiry context:', err);
        }
      } else if (customerId) {
        try {
          const res = await getCustomers();
          if (res?.customers) {
            const cust = res.customers.find((c) => c.id === customerId);
            if (cust && isMounted) {
              setInitialCustomer({
                id: cust.id,
                customer_code: cust.customer_code,
                name: cust.customer_name,
                company: cust.company_name,
                phone: cust.phone,
                email: cust.email,
                address: cust.billing_address || `${cust.city || ''}, ${cust.state || ''}`,
                customer_type: cust.customer_type,
              });
            }
          }
        } catch (err) {
          console.error('Failed to load customer context:', err);
        }
      }

      if (isMounted) setLoading(false);
    }

    loadContext();

    return () => {
      isMounted = false;
    };
  }, [enquiryId, customerId]);

  if (loading) {
    return (
      <div className="p-12 text-center text-xs text-slate-500">
        Loading quotation workspace...
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto py-2">
      <QuotationFormWorkspace
        initialCustomer={initialCustomer}
        enquiryContext={enquiryContext}
      />
    </div>
  );
}

export default function NewQuotationPage() {
  return (
    <Suspense
      fallback={
        <div className="p-12 text-center text-xs text-slate-500">
          Loading workspace...
        </div>
      }
    >
      <NewQuotationContent />
    </Suspense>
  );
}
