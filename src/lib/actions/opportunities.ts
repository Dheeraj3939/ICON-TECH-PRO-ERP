'use server';

import { requireRole } from '@/lib/auth/session';
import { logAuditEvent } from '@/lib/audit/logger';
import { getCustomers } from '@/lib/actions/customers';
import { getInvoices } from '@/lib/actions/billing';
import { getEnquiries } from '@/lib/actions/enquiries';
import { getProspectDossier } from '@/lib/actions/prospect-intelligence';
import type { CustomerOpportunity, EnquirySalesBrief } from '@/types/erp';

declare global {
  // eslint-disable-next-line no-var
  var __ICON_CUSTOMER_OPPORTUNITIES__: CustomerOpportunity[] | undefined;
  // eslint-disable-next-line no-var
  var __ICON_ENQUIRY_SALES_BRIEFS__: EnquirySalesBrief[] | undefined;
}

const INITIAL_OPPORTUNITIES: CustomerOpportunity[] = [
  {
    id: 'OPP-001',
    customer_id: 'CUST0001',
    customer_name: 'T-Hub Foundation',
    opportunity_type: 'AMC_RENEWAL',
    title: 'Annual Comprehensive AMC for 12 Boardroom Interactive Panels',
    pitch_summary: 'OEM 1-year warranty expiring in 45 days. Pitch Comprehensive Gold AMC with quarterly PM visits and 4-hour SLA.',
    estimated_value: 180000,
    confidence_score: 85,
    supporting_records: [
      { type: 'INVOICE', id: 'INV-260001', name: 'ICON/26-27/INV-0001' },
      { type: 'HARDWARE', id: 'HW-01', name: '75-inch ViewSonic 4K IFP (Qty: 12)' },
    ],
    status: 'NEW',
    created_at: '2026-04-09T10:00:00.000Z',
  },
  {
    id: 'OPP-002',
    customer_id: 'CUST0002',
    customer_name: 'Tech Mahindra SEZ Unit',
    opportunity_type: 'CROSS_SELL',
    title: 'PTZ Video Conference Cameras & Ceiling Microphones Bundle',
    pitch_summary: 'Customer recently outfitted executive suites with 85-inch IFPs. Pitch 4K USB PTZ optical zoom cameras with Shure boundary mics.',
    estimated_value: 340000,
    confidence_score: 75,
    supporting_records: [
      { type: 'INVOICE', id: 'INV-260002', name: 'ICON/26-27/INV-0002' },
    ],
    status: 'CONTACTED',
    created_at: '2026-04-09T11:00:00.000Z',
  },
];

function getOppStore(): CustomerOpportunity[] {
  if (!globalThis.__ICON_CUSTOMER_OPPORTUNITIES__) {
    globalThis.__ICON_CUSTOMER_OPPORTUNITIES__ = [...INITIAL_OPPORTUNITIES];
  }
  return globalThis.__ICON_CUSTOMER_OPPORTUNITIES__;
}

/**
 * Automatically scans installed hardware, purchase history, and warranties
 * to uncover actionable cross-sell, upgrade, and AMC renewal opportunities.
 */
export async function scanCustomerOpportunities(): Promise<{
  success: boolean;
  data?: {
    opportunities: CustomerOpportunity[];
    total_pipeline_value: number;
  };
  error?: string;
}> {
  try {
    const authUser = await requireRole(['Managing Director', 'Admin / BDM', 'BDM', 'Sales Executive']);
    const store = getOppStore();
    const { customers } = await getCustomers();
    const { invoices } = await getInvoices();

    // Auto-detect opportunities from customer buying frequency
    for (const cust of customers) {
      const custInvoices = invoices.filter((i) => i.customer_id === cust.id || i.customer_name.toLowerCase() === cust.customer_name.toLowerCase());
      
      if (custInvoices.length > 0) {
        const hasAmcOpp = store.some((o) => o.customer_id === cust.id && o.opportunity_type === 'AMC_RENEWAL');
        if (!hasAmcOpp) {
          const totalSpend = custInvoices.reduce((s, i) => s + i.grand_total, 0);
          const estAmc = Math.round(totalSpend * 0.1); // ~10% standard AMC
          store.push({
            id: `OPP-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            customer_id: cust.id,
            customer_name: cust.customer_name,
            opportunity_type: 'AMC_RENEWAL',
            title: `Annual Maintenance Contract (AMC) for ${cust.customer_name}`,
            pitch_summary: `Customer has cumulative technology deployment of ₹${totalSpend.toLocaleString('en-IN')}. Pitch preventative maintenance and uptime SLA.`,
            estimated_value: estAmc,
            confidence_score: 70,
            supporting_records: custInvoices.map((i) => ({ type: 'INVOICE', id: i.id, name: i.invoice_number })),
            status: 'NEW',
            created_at: new Date().toISOString(),
          });
        }
      }
    }

    const totalValue = store
      .filter((o) => o.status !== 'DISMISSED')
      .reduce((s, o) => s + o.estimated_value, 0);

    await logAuditEvent({
      userName: authUser.name,
      action: 'SCAN_CUSTOMER_OPPORTUNITIES',
      module: 'OPPORTUNITY_ENGINE',
      details: `Discovered ${store.length} revenue expansion opportunities (Total potential: ₹${totalValue.toLocaleString('en-IN')})`,
    });

    return { success: true, data: { opportunities: store, total_pipeline_value: totalValue } };
  } catch (err) {
    return { success: false, error: (err as Error).message || 'Failed to scan customer opportunities' };
  }
}

/**
 * Fetch customer opportunities.
 */
export async function getCustomerOpportunities(customerId?: string): Promise<{
  success: boolean;
  data?: CustomerOpportunity[];
  error?: string;
}> {
  try {
    const store = getOppStore();
    let filtered = [...store];

    if (customerId) {
      filtered = filtered.filter((o) => o.customer_id === customerId);
    }

    return { success: true, data: filtered };
  } catch (err) {
    return { success: false, error: (err as Error).message || 'Failed to get customer opportunities' };
  }
}

/**
 * Update opportunity status.
 */
export async function updateOpportunityStatus(
  id: string,
  status: CustomerOpportunity['status']
): Promise<{ success: boolean; data?: CustomerOpportunity; error?: string }> {
  try {
    const authUser = await requireRole(['Managing Director', 'Admin / BDM', 'BDM', 'Sales Executive']);
    const store = getOppStore();
    const opp = store.find((o) => o.id === id);

    if (!opp) {
      return { success: false, error: 'Opportunity not found.' };
    }

    opp.status = status;

    await logAuditEvent({
      userName: authUser.name,
      action: 'UPDATE_OPPORTUNITY_STATUS',
      module: 'OPPORTUNITY_ENGINE',
      details: `Updated opportunity ${opp.title} status to ${status}`,
    });

    return { success: true, data: opp };
  } catch (err) {
    return { success: false, error: (err as Error).message || 'Failed to update opportunity status' };
  }
}

function getSalesBriefStore(): EnquirySalesBrief[] {
  if (!globalThis.__ICON_ENQUIRY_SALES_BRIEFS__) {
    globalThis.__ICON_ENQUIRY_SALES_BRIEFS__ = [];
  }
  return globalThis.__ICON_ENQUIRY_SALES_BRIEFS__;
}

/**
 * Retrieves the existing AI Sales Brief for an Enquiry.
 */
export async function getEnquirySalesBrief(
  enquiryId: string
): Promise<{ success: boolean; data?: EnquirySalesBrief; error?: string }> {
  try {
    await requireRole(['Managing Director', 'Admin / BDM', 'BDM', 'Sales Executive']);
    const store = getSalesBriefStore();
    const existing = store.find((b) => b.enquiry_id === enquiryId);
    if (existing) {
      return { success: true, data: existing };
    }
    // If not found in store, generate on the fly
    return await generateEnquirySalesBrief(enquiryId);
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to get sales brief' };
  }
}

/**
 * Generates an advisory AI Sales Brief and Opportunity Intelligence for an Enquiry.
 * Synthesizes customer history, prospect research signals, requirement scope,
 * competitor presence, and follow-up guidance.
 */
export async function generateEnquirySalesBrief(
  enquiryId: string,
  forceRefresh: boolean = false
): Promise<{ success: boolean; data?: EnquirySalesBrief; error?: string }> {
  try {
    const authUser = await requireRole(['Managing Director', 'Admin / BDM', 'BDM', 'Sales Executive']);
    const store = getSalesBriefStore();

    if (!forceRefresh) {
      const existing = store.find((b) => b.enquiry_id === enquiryId);
      if (existing) {
        return { success: true, data: existing };
      }
    }

    // 1. Fetch Enquiry
    const { enquiries } = await getEnquiries();
    const enquiry = enquiries.find((e) => e.id === enquiryId || e.enquiry_number === enquiryId);
    if (!enquiry) {
      return { success: false, error: `Enquiry with identifier '${enquiryId}' not found.` };
    }

    // 2. Fetch Customer Context
    const { customers } = await getCustomers();
    const customer = customers.find(
      (c) => c.id === enquiry.customer_id || c.customer_name.toLowerCase() === enquiry.customer_name.toLowerCase()
    );

    const { invoices } = await getInvoices();
    const customerInvoices = customer
      ? invoices.filter((i) => i.customer_id === customer.id || i.customer_name.toLowerCase() === customer.customer_name.toLowerCase())
      : [];
    const historicalRevenue = customerInvoices.reduce((sum, inv) => sum + (inv.grand_total || 0), 0);

    let relationshipType: 'NEW' | 'EXISTING' | 'REPEAT' | 'HIGH_VALUE' = 'NEW';
    if (historicalRevenue > 500000) {
      relationshipType = 'HIGH_VALUE';
    } else if (customerInvoices.length > 1) {
      relationshipType = 'REPEAT';
    } else if (customer) {
      relationshipType = 'EXISTING';
    }

    // 3. Fetch Prospect Dossier Intelligence (if linked)
    let prospectDossier: any = null;
    if (enquiry.prospect_dossier_id) {
      try {
        const dossierRes = await getProspectDossier(enquiry.prospect_dossier_id);
        if (dossierRes) {
          prospectDossier = dossierRes;
        }
      } catch (err) {
        console.warn('Could not fetch linked prospect dossier for sales brief:', err);
      }
    }

    // 4. Requirement Analysis
    const reqText = (enquiry.requirement_summary || '').toLowerCase();
    const category = enquiry.product_category || 'General AV';
    const estimatedBudget = Number(enquiry.estimated_budget) || 0;

    let scopeComplexity: 'LOW' | 'MEDIUM' | 'HIGH' | 'ENTERPRISE' = 'MEDIUM';
    if (estimatedBudget > 1000000 || reqText.includes('auditorium') || reqText.includes('enterprise') || reqText.includes('multiple rooms')) {
      scopeComplexity = 'ENTERPRISE';
    } else if (estimatedBudget > 300000 || reqText.includes('boardroom') || reqText.includes('video wall')) {
      scopeComplexity = 'HIGH';
    } else if (estimatedBudget < 75000 && !reqText.includes('commercial')) {
      scopeComplexity = 'LOW';
    }

    const keySpecs: string[] = [];
    if (reqText.includes('4k') || reqText.includes('uhd')) keySpecs.push('4K UHD Ultra-High Resolution Display');
    if (reqText.includes('interactive') || reqText.includes('touch') || reqText.includes('panel')) keySpecs.push('Multi-touch Interactive Surface with Annotation');
    if (reqText.includes('ptz') || reqText.includes('camera')) keySpecs.push('Optical Zoom PTZ Auto-Tracking Camera');
    if (reqText.includes('mic') || reqText.includes('audio') || reqText.includes('speaker')) keySpecs.push('Integrated Acoustic Beamforming Microphone Array');
    if (reqText.includes('hvac') || reqText.includes('cooling')) keySpecs.push('High-Efficiency Precision HVAC Climate Control');
    if (keySpecs.length === 0) {
      keySpecs.push(`${category} Standard Commercial Grade Deployment`);
    }

    const techStack: string[] = [];
    if (category.toLowerCase().includes('display') || category.toLowerCase().includes('panel') || reqText.includes('panel')) {
      techStack.push('Commercial Interactive Flat Panel (IFP)', 'Wireless Screen Sharing Dongles', 'Wall-Mount Heavy-Duty Bracket');
    } else if (category.toLowerCase().includes('conference') || category.toLowerCase().includes('boardroom')) {
      techStack.push('USB 3.0 PTZ Conference Cam', 'DSP Audio Processor', 'Ceiling Array Microphones');
    } else {
      techStack.push('Commercial Hardware Controller', 'Structured Low-Voltage Cabling', 'Surge-Protected Power Distribution');
    }

    let budgetRealism: 'REALISTIC' | 'UNDER_BUDGETED' | 'PREMIUM' | 'UNSPECIFIED' = 'REALISTIC';
    if (estimatedBudget === 0) {
      budgetRealism = 'UNSPECIFIED';
    } else if (estimatedBudget < 50000 && (scopeComplexity === 'HIGH' || scopeComplexity === 'ENTERPRISE')) {
      budgetRealism = 'UNDER_BUDGETED';
    } else if (estimatedBudget > 1500000) {
      budgetRealism = 'PREMIUM';
    }

    // 5. Health Score Calculation (0-100)
    let healthScore = 50;
    if (estimatedBudget > 0) healthScore += 15;
    if (enquiry.requirement_summary && enquiry.requirement_summary.length > 30) healthScore += 10;
    if (enquiry.site_visit_required || enquiry.status === 'Site Visit Scheduled') healthScore += 10;
    if (enquiry.follow_up_date) healthScore += 5;
    if (relationshipType === 'HIGH_VALUE' || relationshipType === 'REPEAT') healthScore += 10;
    if (prospectDossier?.relevance_analysis?.fit_score) {
      healthScore += Math.round((prospectDossier.relevance_analysis.fit_score / 100) * 10);
    }
    healthScore = Math.min(100, Math.max(10, healthScore));

    const healthStatus: 'STRONG' | 'MODERATE' | 'AT_RISK' | 'CRITICAL' =
      healthScore >= 75 ? 'STRONG' : healthScore >= 55 ? 'MODERATE' : healthScore >= 35 ? 'AT_RISK' : 'CRITICAL';

    // 6. Buying Signals
    const buyingSignals: EnquirySalesBrief['buying_signals'] = [];
    if (enquiry.site_visit_required) {
      buyingSignals.push({
        signal: 'Site Measurement Requested',
        strength: 'HIGH',
        evidence: 'Client explicitly flagged site inspection requirement during enquiry intake.',
      });
    }
    if (estimatedBudget > 0) {
      buyingSignals.push({
        signal: 'Allocated Capital Budget',
        strength: 'HIGH',
        evidence: `Estimated procurement budget of ₹${estimatedBudget.toLocaleString('en-IN')} specified.`,
      });
    }
    if (prospectDossier?.opportunity_signals?.length > 0) {
      const topSignal = prospectDossier.opportunity_signals[0];
      buyingSignals.push({
        signal: topSignal.signal_type || 'Market Expansion Signal',
        strength: 'HIGH',
        evidence: topSignal.details || 'Active facility expansion or vendor refresh identified in prospect intelligence.',
      });
    }
    if (buyingSignals.length === 0) {
      buyingSignals.push({
        signal: 'Active Inbound Inquiry',
        strength: 'MEDIUM',
        evidence: `Direct presales enquiry received via ${enquiry.source || 'Direct channel'}.`,
      });
    }

    // 7. Decision-Maker Context
    let primaryContact = enquiry.customer_name;
    let designation = 'Presales Contact / Procurement Lead';
    let dept = 'Operations / IT';
    let influence: 'HIGH' | 'MEDIUM' | 'LOW' = 'MEDIUM';
    let recommendedEngagement = 'Schedule discovery call to confirm decision-making hierarchy and purchase approval committee.';

    if (prospectDossier?.decision_makers?.length > 0) {
      const dm = prospectDossier.decision_makers.find((d: any) => d.classification === 'VERIFIED') || prospectDossier.decision_makers[0];
      primaryContact = dm.full_name;
      designation = dm.job_title;
      dept = dm.department;
      influence = dm.influence_level === 'HIGH' ? 'HIGH' : 'MEDIUM';
      recommendedEngagement = `Engage ${dm.full_name} (${dm.job_title}) with an architectural solution brief focused on turnkey reliability and OEM warranty SLAs.`;
    }

    // 8. Project Signals
    const projectSignals: EnquirySalesBrief['project_signals'] = [];
    if (prospectDossier?.projects?.length > 0) {
      prospectDossier.projects.forEach((p: any) => {
        projectSignals.push({
          project_type: p.project_name,
          timeline: p.timeline || 'Q3-Q4 2026',
          estimated_scale: p.estimated_budget,
          site_readiness: 'Facility under interior fit-out / low-voltage conduit phase',
        });
      });
    } else {
      projectSignals.push({
        project_type: `${category} Turnkey Upgrade`,
        timeline: enquiry.follow_up_date ? `Targeting closure by ${enquiry.follow_up_date}` : 'Within 30-45 days',
        estimated_scale: estimatedBudget > 0 ? `₹${estimatedBudget.toLocaleString('en-IN')}` : 'To be scoped during site visit',
        site_readiness: enquiry.site_visit_required ? 'Site inspection required to verify conduit & civil readiness' : 'Standard room layout',
      });
    }

    // 9. Vendor & Competition Intelligence
    let incumbentVendor = 'Unspecified Local Reseller / Direct OEM';
    let displacementAngle = 'Differentiate via local Hyderabad OEM-certified field support, 4-hour replacement SLA, and turnkey civil installation.';
    let pricingPressure: 'LOW' | 'MEDIUM' | 'HIGH' = 'MEDIUM';
    let competitors: string[] = ['Local System Integrators', 'Regional AV Resellers'];

    if (prospectDossier?.vendor_intelligence?.length > 0) {
      const vi = prospectDossier.vendor_intelligence[0];
      incumbentVendor = vi.incumbent_vendor || incumbentVendor;
      if (vi.displacement_angle) displacementAngle = vi.displacement_angle;
      if (vi.contract_status?.toLowerCase().includes('expir')) {
        displacementAngle += ` Contract expiration (${vi.contract_end_date || 'Upcoming'}) presents immediate displacement window.`;
      }
      pricingPressure = 'HIGH';
      competitors = [incumbentVendor, 'National AV Distributors'];
    }

    // 10. Opportunity Risks
    const opportunityRisks: EnquirySalesBrief['opportunity_risks'] = [];
    if (budgetRealism === 'UNSPECIFIED') {
      opportunityRisks.push({
        risk: 'Unspecified Commercial Budget',
        severity: 'MEDIUM',
        mitigation: 'Present Good-Better-Best solution options during initial discovery to anchor customer expectations.',
      });
    } else if (budgetRealism === 'UNDER_BUDGETED') {
      opportunityRisks.push({
        risk: 'Budget Disconnect for Scope Complexity',
        severity: 'HIGH',
        mitigation: 'Highlight lifecycle total cost of ownership (TCO) and offer phased implementation.',
      });
    }
    if (!enquiry.follow_up_date) {
      opportunityRisks.push({
        risk: 'Missing Next Contact Date',
        severity: 'MEDIUM',
        mitigation: 'Lock in a concrete follow-up date and agenda immediately after initial contact.',
      });
    }
    if (opportunityRisks.length === 0) {
      opportunityRisks.push({
        risk: 'Standard Competitive Evaluation',
        severity: 'LOW',
        mitigation: 'Accelerate turnaround of quotation and provide customer site visit references.',
      });
    }

    // 11. Missing Information
    const missingInformation: EnquirySalesBrief['missing_information'] = [];
    if (!enquiry.phone || enquiry.phone.length < 10) {
      missingInformation.push({
        item: 'Direct Phone Number',
        impact: 'BLOCKING',
        suggested_question: 'Could you confirm the best mobile or direct extension to reach your site engineering lead?',
      });
    }
    if (enquiry.site_visit_required) {
      missingInformation.push({
        item: 'Site Physical Dimensions & Conduit Availability',
        impact: 'IMPORTANT',
        suggested_question: 'What are the room length x width dimensions, and are floor raceways/ceiling conduit already in place?',
      });
    }
    missingInformation.push({
      item: 'Decision Timeline & Target Go-Live Date',
      impact: 'IMPORTANT',
      suggested_question: 'By what date do you require complete hardware commissioning and handover for operational use?',
    });

    // 12. Recommended Next Actions
    const recommendedNextActions: EnquirySalesBrief['recommended_next_actions'] = [];
    if (enquiry.site_visit_required) {
      recommendedNextActions.push({
        action: 'Dispatch Presales Engineer for Site Inspection & Room Measurement',
        priority: 'IMMEDIATE',
        due_in_days: 2,
        target_outcome: 'Obtain precise room dimensions, ambient lighting LUX levels, and cable run distances.',
      });
    } else {
      recommendedNextActions.push({
        action: 'Conduct Technical Discovery Call with Client Lead',
        priority: 'IMMEDIATE',
        due_in_days: 1,
        target_outcome: 'Validate bill of quantities (BOQ) expectations and confirm decision maker attendance.',
      });
    }
    recommendedNextActions.push({
      action: 'Prepare Preliminary Solution Architecture & Bill of Materials',
      priority: 'HIGH',
      due_in_days: 3,
      target_outcome: 'Generate draft quotation bundle with distributor pricing verification.',
    });

    // 13. Follow-up Intelligence
    const followUpIntelligence: EnquirySalesBrief['follow_up_intelligence'] = {
      recommended_follow_up_date: enquiry.follow_up_date || new Date(Date.now() + 86400000 * 2).toISOString().split('T')[0],
      recommended_channel: enquiry.site_visit_required ? 'SITE_VISIT' : 'CALL',
      suggested_opening_script: `Hello ${primaryContact.split(' ')[0]}, this is ${authUser.name} from ICON TECH PRO. I am reviewing your requirement for ${category} and wanted to confirm the technical specifications before we finalize the solution architecture.`,
      key_value_hook: displacementAngle,
    };

    const brief: EnquirySalesBrief = {
      id: `BRF-${enquiry.id}-${Date.now()}`,
      enquiry_id: enquiry.id,
      customer_id: enquiry.customer_id,
      prospect_dossier_id: enquiry.prospect_dossier_id,
      health_score: healthScore,
      health_status: healthStatus,
      requirement_analysis: {
        core_need: `${category} commercial solution for ${enquiry.company_name || enquiry.customer_name}`,
        scope_complexity: scopeComplexity,
        key_specifications: keySpecs,
        inferred_technology_stack: techStack,
        budget_realism: budgetRealism,
      },
      customer_context: {
        company_or_individual: enquiry.company_name ? 'Corporate Enterprise' : 'Individual / Small Business',
        relationship_type: relationshipType,
        historical_revenue: historicalRevenue,
        active_installations_count: customerInvoices.length,
        credit_standing: relationshipType === 'HIGH_VALUE' ? 'EXCELLENT' : 'STANDARD',
      },
      buying_signals: buyingSignals,
      decision_maker_context: {
        primary_contact_name: primaryContact,
        role_or_designation: designation,
        department: dept,
        influence_level: influence,
        recommended_engagement: recommendedEngagement,
      },
      project_signals: projectSignals,
      vendor_intelligence: {
        incumbent_vendor: incumbentVendor,
        competitors: competitors,
        displacement_angle: displacementAngle,
        pricing_pressure: pricingPressure,
      },
      opportunity_risks: opportunityRisks,
      missing_information: missingInformation,
      recommended_next_actions: recommendedNextActions,
      follow_up_intelligence: followUpIntelligence,
      generated_by: `AI Sales Intelligence (${authUser.name})`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // Save to store (replace existing if present)
    const existingIndex = store.findIndex((b) => b.enquiry_id === enquiry.id);
    if (existingIndex >= 0) {
      store[existingIndex] = brief;
    } else {
      store.push(brief);
    }

    await logAuditEvent({
      userName: authUser.name,
      action: 'GENERATE_ENQUIRY_SALES_BRIEF',
      module: 'OPPORTUNITY_ENGINE',
      details: `Generated AI Sales Brief for Enquiry ${enquiry.enquiry_number} (Health: ${healthScore}% - ${healthStatus})`,
    });

    return { success: true, data: brief };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to generate enquiry sales brief' };
  }
}

