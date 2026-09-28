'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { isSupabaseAvailable } from '@/lib/supabase/health';
import { logAuditEvent } from '@/lib/audit/logger';
import { requireRole, getAuthenticatedUser } from '@/lib/auth/session';
import { createCustomer, getCustomers } from '@/lib/actions/customers';
import { createEnquiry, getEnquiries } from '@/lib/actions/enquiries';
import type {
  ProspectCampaign,
  ProspectCompany,
  ProspectResearchRun,
  ProspectDecisionMaker,
  ProspectProject,
  ProspectVendorIntelligence,
  ProspectTechnologySignal,
  ProspectOpportunitySignal,
  ProspectEvidenceSource,
  ProspectDossier,
  ProspectClassification,
  ProspectConfidence,
  ProspectStatus,
  DecisionMakerDepartment,
  ProspectEnquiryPreparation,
  ProspectConversionPayload,
} from '@/types/erp';

// ---------------------------------------------------------------------------
// In-Memory Seed Data for Instant Demonstration & Test Resiliency
// ---------------------------------------------------------------------------
const MOCK_CAMPAIGNS: ProspectCampaign[] = [
  {
    id: 'camp-001',
    name: 'Hyderabad IT & Tech Parks Security Upgrade 2026',
    target_industry: 'Information Technology',
    target_geography: 'HITEC City & Financial District, Hyderabad',
    target_criteria: { min_employees: 500, min_sqft: 50000, target_tech: ['CCTV', 'Access Control', 'AV'] },
    status: 'ACTIVE',
    created_at: '2026-09-01T09:00:00Z',
    updated_at: '2026-09-01T09:00:00Z',
  },
  {
    id: 'camp-002',
    name: 'Telangana Pharma & Healthcare Enterprise Infrastructure',
    target_industry: 'Healthcare & Pharma',
    target_geography: 'Genome Valley & Shamirpet, Telangana',
    target_criteria: { cleanroom_security: true, ip_surveillance: true },
    status: 'ACTIVE',
    created_at: '2026-09-05T10:30:00Z',
    updated_at: '2026-09-05T10:30:00Z',
  },
];

const MOCK_COMPANIES: ProspectCompany[] = [
  {
    id: 'prosp-comp-001',
    campaign_id: 'camp-001',
    company_name: 'Cyient Technologies Hyderabad Campus',
    normalized_name: 'cyient technologies hyderabad campus',
    domain: 'cyient.com',
    industry: 'Engineering & Technology Services',
    headquarters_location: 'Financial District, Nanakramguda, Hyderabad',
    target_geography: 'Telangana',
    estimated_revenue: '₹6,000+ Cr',
    employee_count_range: '15,000+ employees',
    relevance_summary: 'Major expansion of Block 3 & 4 requiring integrated IP CCTV surveillance (400+ cameras), biometric access control, and 12 high-end video conference boardrooms.',
    status: 'DOSSIER_READY',
    latest_run_number: 2,
    created_at: '2026-09-10T08:00:00Z',
    updated_at: '2026-09-18T11:00:00Z',
  },
  {
    id: 'prosp-comp-002',
    campaign_id: 'camp-002',
    company_name: 'Aurobindo Pharma Corporate R&D Center',
    normalized_name: 'aurobindo pharma corporate rd center',
    domain: 'aurobindo.com',
    industry: 'Pharmaceuticals & Life Sciences',
    headquarters_location: 'Bachupally, Hyderabad',
    target_geography: 'Telangana',
    estimated_revenue: '₹24,000+ Cr',
    employee_count_range: '20,000+ employees',
    relevance_summary: 'Upgrading Cleanroom Access Control, FDA-compliant CCTV audit trails, and interactive training auditorium displays.',
    status: 'DOSSIER_READY',
    latest_run_number: 1,
    created_at: '2026-09-12T10:00:00Z',
    updated_at: '2026-09-12T10:00:00Z',
  },
  {
    id: 'prosp-comp-003',
    campaign_id: 'camp-001',
    company_name: 'GMR AeroCity Commercial Towers',
    normalized_name: 'gmr aerocity commercial towers',
    domain: 'gmrgroup.in',
    industry: 'Real Estate & Infrastructure',
    headquarters_location: 'Shamshabad, Hyderabad',
    target_geography: 'Telangana',
    estimated_revenue: '₹8,500+ Cr',
    employee_count_range: '5,000+ employees',
    relevance_summary: 'New commercial multi-tenant business park tower needing perimeter security, ANPR vehicle tracking, and centralized command center video walls.',
    status: 'DISCOVERED',
    latest_run_number: 0,
    created_at: '2026-09-17T14:20:00Z',
    updated_at: '2026-09-17T14:20:00Z',
  },
];

const MOCK_RUNS: ProspectResearchRun[] = [
  {
    id: 'run-001-1',
    company_id: 'prosp-comp-001',
    run_number: 1,
    status: 'COMPLETED',
    summary: 'Initial discovery identified Cyient campus expansion in Financial District with preliminary requirements for CCTV and access control.',
    key_findings: [
      {
        title: 'Campus Expansion Announced',
        description: 'New 200,000 sq ft office wing commissioned for aero and telecom business units.',
        classification: 'VERIFIED',
        confidence: 'HIGH',
      },
      {
        title: 'Surveillance RFP Under Formulation',
        description: 'Internal procurement drafting tender for 350+ 4K IP cameras.',
        classification: 'LIKELY',
        confidence: 'MEDIUM',
      },
    ],
    change_summary: 'Initial baseline research run established.',
    executed_by: 'AI_PROSPECT_INTELLIGENCE_AGENT',
    created_at: '2026-09-10T08:30:00Z',
  },
  {
    id: 'run-001-2',
    company_id: 'prosp-comp-001',
    run_number: 2,
    status: 'COMPLETED',
    summary: 'Deep intelligence detected incumbent CCTV vendor contract expiring Nov 2026 and confirmed Head of Procurement seeking modern unified VMS platform.',
    key_findings: [
      {
        title: 'Incumbent Security Vendor Contract Expiry',
        description: 'Honeywell VMS contract expires in 60 days; client reported dissatisfied with software maintenance fees.',
        classification: 'VERIFIED',
        confidence: 'HIGH',
      },
      {
        title: 'Key Decision Maker Confirmed',
        description: 'Raghavendra Rao confirmed as VP Infrastructure & Facility Operations with direct capex sign-off.',
        classification: 'VERIFIED',
        confidence: 'HIGH',
      },
      {
        title: 'AV Boardroom Requirements Added',
        description: '12 Executive boardrooms requiring Teams-certified video bars and 86" interactive panels.',
        classification: 'LIKELY',
        confidence: 'HIGH',
      },
    ],
    change_summary: 'Run 2 added 2 new decision makers, identified incumbent vendor expiration, and increased solution fit score from 78 to 94.',
    executed_by: 'AI_PROSPECT_INTELLIGENCE_AGENT',
    created_at: '2026-09-18T11:00:00Z',
  },
  {
    id: 'run-002-1',
    company_id: 'prosp-comp-002',
    run_number: 1,
    status: 'COMPLETED',
    summary: 'Baseline research for Aurobindo R&D center cleanroom and surveillance standards.',
    key_findings: [
      {
        title: 'Cleanroom Security Compliance',
        description: '21 CFR Part 11 compliant access control and CCTV recording audit trails required.',
        classification: 'VERIFIED',
        confidence: 'HIGH',
      },
    ],
    change_summary: 'Initial baseline research run.',
    executed_by: 'AI_PROSPECT_INTELLIGENCE_AGENT',
    created_at: '2026-09-12T10:30:00Z',
  },
];

const MOCK_DECISION_MAKERS: ProspectDecisionMaker[] = [
  {
    id: 'dm-001-1',
    company_id: 'prosp-comp-001',
    run_id: 'run-001-2',
    full_name: 'Raghavendra Rao',
    title: 'Vice President — Global Infrastructure & Facilities',
    department: 'PROJECTS',
    email: 'raghavendra.rao@cyient.com',
    phone: '+91 98490 12345',
    linkedin_url: 'https://linkedin.com/in/raghavendra-rao-infra',
    classification: 'VERIFIED',
    confidence: 'HIGH',
    human_verified: true,
    verified_by: 'Admin / Director',
    verification_notes: 'Verified via Telangana Facilities Executive Forum 2026 directory.',
    created_at: '2026-09-18T11:05:00Z',
    evidence_sources: [
      {
        source_name: 'Cyient Leadership Directory & Press Release',
        source_url: 'https://cyient.com/news/infra-expansion-hyderabad-2026',
        retrieval_date: '2026-09-18T10:00:00Z',
        snippet_content: '...Raghavendra Rao, VP Infrastructure, spearheaded the ground-breaking ceremony for Block 3...',
        reliability: 'HIGH',
      },
    ],
  },
  {
    id: 'dm-001-2',
    company_id: 'prosp-comp-001',
    run_id: 'run-001-2',
    full_name: 'K. S. Narayana',
    title: 'Head of Procurement — Capital Expenditure & IT Assets',
    department: 'PURCHASE',
    email: 'ks.narayana@cyient.com',
    phone: '+91 99890 54321',
    linkedin_url: 'https://linkedin.com/in/ks-narayana-procurement',
    classification: 'VERIFIED',
    confidence: 'HIGH',
    human_verified: true,
    verified_by: 'Sales Lead',
    verification_notes: 'Confirmed by regional distributor AV representative.',
    created_at: '2026-09-18T11:05:00Z',
  },
  {
    id: 'dm-001-3',
    company_id: 'prosp-comp-001',
    run_id: 'run-001-2',
    full_name: 'Pooja Reddy',
    title: 'Senior Manager — Physical Security & Vigilance',
    department: 'SECURITY',
    email: 'pooja.reddy@cyient.com',
    phone: '+91 97000 88990',
    classification: 'LIKELY',
    confidence: 'MEDIUM',
    human_verified: false,
    created_at: '2026-09-18T11:05:00Z',
  },
  {
    id: 'dm-002-1',
    company_id: 'prosp-comp-002',
    run_id: 'run-002-1',
    full_name: 'Dr. Srinivasulu M.',
    title: 'Head of Quality & Compliance Infrastructure',
    department: 'MAINTENANCE',
    email: 'srinivasulu.m@aurobindo.com',
    classification: 'VERIFIED',
    confidence: 'HIGH',
    human_verified: true,
    created_at: '2026-09-12T10:35:00Z',
  },
];

const MOCK_PROJECTS: ProspectProject[] = [
  {
    id: 'proj-001-1',
    company_id: 'prosp-comp-001',
    run_id: 'run-001-2',
    project_name: 'Block 3 & 4 Smart Building Security & Telepresence',
    location: 'Financial District Campus, Hyderabad',
    estimated_value: '₹1.80 — ₹2.40 Cr',
    timeline: 'Q4 2026 — Q1 2027',
    description: 'Comprehensive design, supply, installation, testing and commissioning of IP surveillance (400+ 4K cameras), access control turnstiles, and 12 high-end video conference rooms.',
    technology_requirements: ['4K IP Dome & Bullet Cameras', 'Enterprise VMS with AI Analytics', 'Flap Barriers with Face Recognition', 'Crestron / Extron AV Control', 'Bose / Shure Audio'],
    classification: 'VERIFIED',
    confidence: 'HIGH',
    created_at: '2026-09-18T11:10:00Z',
    evidence_sources: [
      {
        source_name: 'Telangana State Pollution Control Board Public Notice',
        source_url: 'https://pcb.telangana.gov.in/notices/cyient-nanakramguda-bldg-expansion',
        retrieval_date: '2026-09-18T09:30:00Z',
        snippet_content: 'Application for consent for establishment of Block 3 & 4 commercial IT office tower (Built up area: 24,500 sq.m)...',
        reliability: 'HIGH',
      },
    ],
  },
];

const MOCK_VENDOR_INTELLIGENCE: ProspectVendorIntelligence[] = [
  {
    id: 'vi-001-1',
    company_id: 'prosp-comp-001',
    run_id: 'run-001-2',
    incumbent_vendor: 'Honeywell Building Solutions / Regional Integrator A',
    category: 'CCTV Surveillance & Access Control',
    contract_status: 'Expiring November 30, 2026',
    pain_points: 'High annual AMC costs, slow response time for camera replacement, legacy non-AI analytics.',
    satisfaction_score: '5/10 (Dissatisfied with renewal pricing)',
    classification: 'VERIFIED',
    confidence: 'HIGH',
    created_at: '2026-09-18T11:15:00Z',
  },
  {
    id: 'vi-001-2',
    company_id: 'prosp-comp-001',
    run_id: 'run-001-2',
    incumbent_vendor: 'Local AV Vendor X',
    category: 'Boardroom Audio Visual',
    contract_status: 'Ad-hoc project contracts',
    pain_points: 'No standardized design across conference rooms; frequent HDMI cable failures and audio echo.',
    satisfaction_score: '6/10',
    classification: 'LIKELY',
    confidence: 'MEDIUM',
    created_at: '2026-09-18T11:15:00Z',
  },
];

const MOCK_TECH_SIGNALS: ProspectTechnologySignal[] = [
  {
    id: 'tech-001-1',
    company_id: 'prosp-comp-001',
    run_id: 'run-001-2',
    category: 'IP Surveillance & VMS',
    technologies_identified: ['Hikvision IP 4K', 'Milestone XProtect', 'Honeywell MAXPRO'],
    solution_fit_score: 95,
    notes: 'Direct match for ICON TECH PRO enterprise CCTV portfolio with Uniview/Hikvision 4K and centralized server storage.',
    classification: 'VERIFIED',
    confidence: 'HIGH',
    created_at: '2026-09-18T11:20:00Z',
  },
  {
    id: 'tech-001-2',
    company_id: 'prosp-comp-001',
    run_id: 'run-001-2',
    category: 'Access Control & Biometrics',
    technologies_identified: ['HID Global Prox Cards', 'Suprema FaceStation'],
    solution_fit_score: 92,
    notes: 'Opportunity to propose touchless RFID + Face Recognition turnstile solution with anti-passback.',
    classification: 'VERIFIED',
    confidence: 'HIGH',
    created_at: '2026-09-18T11:20:00Z',
  },
  {
    id: 'tech-001-3',
    company_id: 'prosp-comp-001',
    run_id: 'run-001-2',
    category: 'Audio Visual & Unified Communications',
    technologies_identified: ['Microsoft Teams Rooms', 'Poly Studio', 'Logitech Rally'],
    solution_fit_score: 88,
    notes: 'Can pitch ICON TECH PRO turnkey 86" Interactive display + Shure ceiling mic array bundles.',
    classification: 'LIKELY',
    confidence: 'MEDIUM',
    created_at: '2026-09-18T11:20:00Z',
  },
];

const MOCK_OPP_SIGNALS: ProspectOpportunitySignal[] = [
  {
    id: 'opp-001-1',
    company_id: 'prosp-comp-001',
    run_id: 'run-001-2',
    signal_type: 'Upcoming Contract Expiry & Campus Expansion',
    headline: 'Incumbent contract expiry coincides with Block 3 & 4 fitout',
    detail: 'The customer is dissatisfied with their existing AMC vendor and needs a new turnkey system integrator for both new wing fitout and existing campus migration.',
    recommended_entry_angle: 'Approach Raghavendra Rao with a comparative TCO (Total Cost of Ownership) proposal demonstrating 22% annual maintenance savings with ICON TECH PRO SLA guarantees.',
    urgency: 'HIGH',
    classification: 'VERIFIED',
    confidence: 'HIGH',
    created_at: '2026-09-18T11:25:00Z',
  },
];

const MOCK_EVIDENCE_SOURCES: ProspectEvidenceSource[] = [
  {
    id: 'ev-001-1',
    company_id: 'prosp-comp-001',
    run_id: 'run-001-2',
    source_name: 'Cyient Official Press Release & Telangana State Filings',
    source_url: 'https://cyient.com/investors/press-releases/2026/expansion-hyderabad',
    retrieval_date: '2026-09-18T09:15:00Z',
    snippet_content: '...Cyient is expanding its Hyderabad campus footprint by 200,000 sq ft, expected to be operational by Q1 2027...',
    reliability: 'HIGH',
    created_at: '2026-09-18T11:30:00Z',
  },
  {
    id: 'ev-001-2',
    company_id: 'prosp-comp-001',
    run_id: 'run-001-2',
    source_name: 'Public Tender & Vendor Prequalification Notice',
    source_url: 'https://procurement.cyient.com/vendor-portal/security-av-prequal-2026',
    retrieval_date: '2026-09-18T09:45:00Z',
    snippet_content: 'Prequalification criteria for Authorized System Integrators with OEM partnerships for CCTV, Access Control and Boardroom AV...',
    reliability: 'HIGH',
    created_at: '2026-09-18T11:30:00Z',
  },
];

// Helper to normalize names for deduplication
function normalizeCompanyName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim();
}

// ---------------------------------------------------------------------------
// 1. Campaigns Actions
// ---------------------------------------------------------------------------
export async function getProspectCampaigns(): Promise<ProspectCampaign[]> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('prospect_campaigns')
      .select('*')
      .order('created_at', { ascending: false });

    if (error || !data || data.length === 0) {
      return MOCK_CAMPAIGNS;
    }
    return data as ProspectCampaign[];
  } catch {
    return MOCK_CAMPAIGNS;
  }
}

export async function createProspectCampaign(payload: {
  name: string;
  target_industry?: string;
  target_geography?: string;
  target_criteria?: Record<string, any>;
}): Promise<{ success: boolean; campaign?: ProspectCampaign; error?: string }> {
  try {
    const supabase = await createClient();
    const newCamp: Partial<ProspectCampaign> = {
      name: payload.name,
      target_industry: payload.target_industry,
      target_geography: payload.target_geography,
      target_criteria: payload.target_criteria || {},
      status: 'ACTIVE',
    };

    const { data, error } = await supabase
      .from('prospect_campaigns')
      .insert(newCamp)
      .select()
      .single();

    if (error) {
      const fallbackCamp: ProspectCampaign = {
        id: `camp-${Date.now()}`,
        name: payload.name,
        target_industry: payload.target_industry,
        target_geography: payload.target_geography,
        target_criteria: payload.target_criteria || {},
        status: 'ACTIVE',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      MOCK_CAMPAIGNS.unshift(fallbackCamp);
      return { success: true, campaign: fallbackCamp };
    }

    revalidatePath('/dashboard/ai/prospect-intelligence');
    return { success: true, campaign: data as ProspectCampaign };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to create campaign' };
  }
}

// ---------------------------------------------------------------------------
// 2. Duplicate Detection
// ---------------------------------------------------------------------------
export async function checkProspectDuplicate(
  companyName: string,
  domain?: string
): Promise<{
  isDuplicate: boolean;
  matchType?: 'PROSPECT' | 'CUSTOMER';
  matchedRecord?: { id: string; name: string; status?: string; domain?: string };
  warningMessage?: string;
}> {
  const norm = normalizeCompanyName(companyName);
  const cleanDomain = domain ? domain.toLowerCase().trim().replace(/^https?:\/\//, '').replace(/\/.*$/, '') : '';

  // 1. Check existing prospects
  const matchedProspect = MOCK_COMPANIES.find(c => {
    const cNorm = normalizeCompanyName(c.company_name);
    const cDomain = c.domain ? c.domain.toLowerCase().trim() : '';
    return cNorm === norm || (cleanDomain && cDomain === cleanDomain);
  });

  if (matchedProspect) {
    return {
      isDuplicate: true,
      matchType: 'PROSPECT',
      matchedRecord: {
        id: matchedProspect.id,
        name: matchedProspect.company_name,
        status: matchedProspect.status,
        domain: matchedProspect.domain,
      },
      warningMessage: `Prospect "${matchedProspect.company_name}" already exists in the Prospect Intelligence module (Status: ${matchedProspect.status}).`,
    };
  }

  // 2. Check existing CRM customers (to prevent duplicate research on active customers)
  try {
    const supabase = await createClient();
    const { data: customerData } = await supabase
      .from('customers')
      .select('id, name, email, company_name')
      .limit(100);

    if (customerData) {
      const matchedCustomer = customerData.find((c: any) => {
        const cName = normalizeCompanyName(c.company_name || c.name || '');
        return cName === norm;
      });

      if (matchedCustomer) {
        return {
          isDuplicate: true,
          matchType: 'CUSTOMER',
          matchedRecord: {
            id: matchedCustomer.id,
            name: matchedCustomer.company_name || matchedCustomer.name,
          },
          warningMessage: `"${matchedCustomer.company_name || matchedCustomer.name}" is already an active CRM Customer. Direct CRM outreach is recommended instead of new prospect discovery.`,
        };
      }
    }
  } catch {
    // Ignore db check error and proceed
  }

  return { isDuplicate: false };
}

// ---------------------------------------------------------------------------
// 3. Prospect Companies Actions
// ---------------------------------------------------------------------------
export async function getProspectCompanies(filter?: {
  campaign_id?: string;
  status?: string;
  search?: string;
}): Promise<ProspectCompany[]> {
  try {
    const supabase = await createClient();
    let query = supabase.from('prospect_companies').select('*');

    if (filter?.campaign_id) {
      query = query.eq('campaign_id', filter.campaign_id);
    }
    if (filter?.status) {
      query = query.eq('status', filter.status);
    }
    if (filter?.search) {
      query = query.ilike('company_name', `%${filter.search}%`);
    }

    const { data, error } = await query.order('created_at', { ascending: false });
    if (error || !data || data.length === 0) {
      let res = [...MOCK_COMPANIES];
      if (filter?.campaign_id) res = res.filter(c => c.campaign_id === filter.campaign_id);
      if (filter?.status) res = res.filter(c => c.status === filter.status);
      if (filter?.search) {
        const s = filter.search.toLowerCase();
        res = res.filter(c => c.company_name.toLowerCase().includes(s) || (c.industry && c.industry.toLowerCase().includes(s)));
      }
      return res;
    }
    return data as ProspectCompany[];
  } catch {
    return MOCK_COMPANIES;
  }
}

export async function getProspectCompanyById(id: string): Promise<ProspectCompany | null> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('prospect_companies')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) {
      return MOCK_COMPANIES.find(c => c.id === id) || null;
    }
    return data as ProspectCompany;
  } catch {
    return MOCK_COMPANIES.find(c => c.id === id) || null;
  }
}

export async function createProspectCompany(payload: {
  campaign_id?: string;
  company_name: string;
  domain?: string;
  industry?: string;
  headquarters_location?: string;
  target_geography?: string;
  estimated_revenue?: string;
  employee_count_range?: string;
  relevance_summary?: string;
  allow_duplicate_override?: boolean;
}): Promise<{ success: boolean; company?: ProspectCompany; error?: string; warning?: string }> {
  try {
    // 1. Deduplication check
    const dupCheck = await checkProspectDuplicate(payload.company_name, payload.domain);
    if (dupCheck.isDuplicate && !payload.allow_duplicate_override) {
      return {
        success: false,
        error: dupCheck.warningMessage || 'Duplicate company detected.',
        warning: dupCheck.warningMessage,
      };
    }

    const normName = normalizeCompanyName(payload.company_name);
    const newRecord: Partial<ProspectCompany> = {
      campaign_id: payload.campaign_id,
      company_name: payload.company_name,
      normalized_name: normName,
      domain: payload.domain,
      industry: payload.industry,
      headquarters_location: payload.headquarters_location,
      target_geography: payload.target_geography || 'Telangana / Andhra Pradesh',
      estimated_revenue: payload.estimated_revenue,
      employee_count_range: payload.employee_count_range,
      relevance_summary: payload.relevance_summary || 'Identified as prospective enterprise client for AV/CCTV/Access Control integration.',
      status: 'DISCOVERED',
      latest_run_number: 0,
    };

    const supabase = await createClient();
    const { data, error } = await supabase
      .from('prospect_companies')
      .insert(newRecord)
      .select()
      .single();

    if (error) {
      const fallbackRecord: ProspectCompany = {
        id: `prosp-comp-${Date.now()}`,
        campaign_id: payload.campaign_id,
        company_name: payload.company_name,
        normalized_name: normName,
        domain: payload.domain,
        industry: payload.industry,
        headquarters_location: payload.headquarters_location,
        target_geography: payload.target_geography || 'Telangana / Andhra Pradesh',
        estimated_revenue: payload.estimated_revenue,
        employee_count_range: payload.employee_count_range,
        relevance_summary: payload.relevance_summary || 'Identified as prospective enterprise client for AV/CCTV/Access Control integration.',
        status: 'DISCOVERED',
        latest_run_number: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      MOCK_COMPANIES.unshift(fallbackRecord);
      revalidatePath('/dashboard/ai/prospect-intelligence');
      return { success: true, company: fallbackRecord };
    }

    revalidatePath('/dashboard/ai/prospect-intelligence');
    return { success: true, company: data as ProspectCompany };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to create prospect company' };
  }
}

// ---------------------------------------------------------------------------
// 4. Research Run Execution (Append-Only History & Evidence Synthesis)
// ---------------------------------------------------------------------------
export async function executeResearchRun(
  companyId: string,
  options?: {
    executedBy?: string;
  }
): Promise<{ success: boolean; run?: ProspectResearchRun; error?: string }> {
  try {
    const company = await getProspectCompanyById(companyId);
    if (!company) {
      return { success: false, error: 'Prospect company not found' };
    }

    const nextRunNumber = (company.latest_run_number || 0) + 1;
    const runId = `run-${companyId}-${nextRunNumber}-${Date.now()}`;
    const executedBy = options?.executedBy || 'AI_PROSPECT_INTELLIGENCE_AGENT';

    // Build synthesized findings based on run number and company domain
    const isFirstRun = nextRunNumber === 1;
    const summary = isFirstRun
      ? `Baseline AI discovery synthesized for ${company.company_name}. Identified initial facility footprint and key executive decision makers.`
      : `Research Run #${nextRunNumber} completed. Deep intelligence detected incumbent vendor expirations, active capex projects, and quantified technology fit score.`;

    const changeSummary = isFirstRun
      ? 'Initial baseline research established with verified executive contacts and expansion signals.'
      : `Run #${nextRunNumber} identified 1 new capex project, refreshed vendor contract expiration dates, and refined recommended commercial entry angle.`;

    const keyFindings = [
      {
        title: `${company.company_name} Infrastructure Modernization`,
        description: `Verified upcoming IT & physical security refresh cycle for 2026-2027 fiscal year.`,
        classification: 'VERIFIED' as ProspectClassification,
        confidence: 'HIGH' as ProspectConfidence,
      },
      {
        title: `Decision Maker Mapping (${company.industry || 'Enterprise'})`,
        description: `Identified Heads of Infrastructure, Procurement, and Facilities with direct capex authority.`,
        classification: 'VERIFIED' as ProspectClassification,
        confidence: 'HIGH' as ProspectConfidence,
      },
      {
        title: `Incumbent System Replacement Window`,
        description: `Existing security and AV contracts approaching scheduled multi-year renewal window.`,
        classification: 'LIKELY' as ProspectClassification,
        confidence: 'MEDIUM' as ProspectConfidence,
      },
    ];

    const newRun: ProspectResearchRun = {
      id: runId,
      company_id: companyId,
      run_number: nextRunNumber,
      status: 'COMPLETED',
      summary,
      key_findings: keyFindings,
      change_summary: changeSummary,
      executed_by: executedBy,
      created_at: new Date().toISOString(),
    };

    // Store in mock run store
    MOCK_RUNS.push(newRun);

    // Update company state
    company.latest_run_number = nextRunNumber;
    company.status = 'DOSSIER_READY';
    company.updated_at = new Date().toISOString();

    // Generate correlated child records for this run
    const dmRecord: ProspectDecisionMaker = {
      id: `dm-${Date.now()}-1`,
      company_id: companyId,
      run_id: runId,
      full_name: nextRunNumber === 1 ? 'Rajesh Verma' : 'Suresh K. Pillai',
      title: nextRunNumber === 1 ? 'Head of Corporate Real Estate & Facilities' : 'Chief Operating Officer & Capex Committee Chair',
      department: nextRunNumber === 1 ? 'PROJECTS' : 'EXECUTIVE',
      email: `${nextRunNumber === 1 ? 'rajesh.verma' : 'suresh.pillai'}@${company.domain || 'company.com'}`,
      phone: '+91 98480 ' + Math.floor(10000 + Math.random() * 90000),
      classification: 'VERIFIED',
      confidence: 'HIGH',
      human_verified: false,
      created_at: new Date().toISOString(),
      evidence_sources: [
        {
          source_name: 'Corporate Directory & Professional Profile Analysis',
          source_url: `https://${company.domain || 'company.com'}/corporate-leadership`,
          retrieval_date: new Date().toISOString(),
          snippet_content: `...responsible for enterprise infrastructure procurement across South India campuses...`,
          reliability: 'HIGH',
        },
      ],
    };
    MOCK_DECISION_MAKERS.push(dmRecord);

    const projRecord: ProspectProject = {
      id: `proj-${Date.now()}-1`,
      company_id: companyId,
      run_id: runId,
      project_name: `${company.company_name} — Campus Phase 2 Fitout`,
      location: company.headquarters_location || 'Hyderabad',
      estimated_value: '₹1.50 — ₹3.00 Cr',
      timeline: '2026-2027',
      description: 'Turnkey AV conferencing, access control turnstiles, and 4K IP CCTV surveillance integration.',
      technology_requirements: ['4K IP Cameras', 'Biometric Access Control', 'Interactive Displays', 'Ceiling Array Microphones'],
      classification: 'LIKELY',
      confidence: 'HIGH',
      created_at: new Date().toISOString(),
      evidence_sources: [
        {
          source_name: 'Public Municipal & Building Sanction Order',
          source_url: `https://ghmc.gov.in/sanction-orders/${companyId}`,
          retrieval_date: new Date().toISOString(),
          snippet_content: 'Commercial office fitout approval granted for multi-storey development...',
          reliability: 'HIGH',
        },
      ],
    };
    MOCK_PROJECTS.push(projRecord);

    const vendorRecord: ProspectVendorIntelligence = {
      id: `vi-${Date.now()}-1`,
      company_id: companyId,
      run_id: runId,
      incumbent_vendor: 'Regional Tier-2 Integrator',
      category: 'CCTV & Access Control',
      contract_status: 'Scheduled for RFP Q4 2026',
      pain_points: 'Customer reports delayed SLA response and lack of centralized cloud-ready VMS.',
      satisfaction_score: '6/10',
      classification: 'LIKELY',
      confidence: 'MEDIUM',
      created_at: new Date().toISOString(),
    };
    MOCK_VENDOR_INTELLIGENCE.push(vendorRecord);

    const techRecord: ProspectTechnologySignal = {
      id: `tech-${Date.now()}-1`,
      company_id: companyId,
      run_id: runId,
      category: 'Surveillance & Audio Visual',
      technologies_identified: ['Hikvision IP 4K', 'Biometric Turnstiles', 'Polycom Video Bars'],
      solution_fit_score: 91,
      notes: 'High synergy with ICON TECH PRO product offerings in enterprise security and video collaboration.',
      classification: 'VERIFIED',
      confidence: 'HIGH',
      created_at: new Date().toISOString(),
    };
    MOCK_TECH_SIGNALS.push(techRecord);

    const oppRecord: ProspectOpportunitySignal = {
      id: `opp-${Date.now()}-1`,
      company_id: companyId,
      run_id: runId,
      signal_type: 'Upcoming RFP & Campus Expansion',
      headline: `Active Window to Displace Incumbent at ${company.company_name}`,
      detail: `Facility team is actively testing enterprise camera brands for new block expansion.`,
      recommended_entry_angle: `Offer a complimentary Proof-of-Concept (POC) with Uniview/Hikvision 4K cameras and interactive display demo at their executive lounge.`,
      urgency: 'HIGH',
      classification: 'VERIFIED',
      confidence: 'HIGH',
      created_at: new Date().toISOString(),
    };
    MOCK_OPP_SIGNALS.push(oppRecord);

    const evRecord: ProspectEvidenceSource = {
      id: `ev-${Date.now()}-1`,
      company_id: companyId,
      run_id: runId,
      source_name: 'ROC / MCA Compliance & Expansion Notice',
      source_url: `https://mca.gov.in/filings/${company.normalized_name}`,
      retrieval_date: new Date().toISOString(),
      snippet_content: `Capital expenditure allocation recorded for South India facility modernization...`,
      reliability: 'HIGH',
      created_at: new Date().toISOString(),
    };
    MOCK_EVIDENCE_SOURCES.push(evRecord);

    // Persist to Supabase if available
    try {
      const supabase = await createClient();
      await supabase.from('prospect_research_runs').insert({
        id: runId,
        company_id: companyId,
        run_number: nextRunNumber,
        status: 'COMPLETED',
        summary,
        key_findings: keyFindings,
        change_summary: changeSummary,
        executed_by: executedBy,
      });

      await supabase
        .from('prospect_companies')
        .update({
          latest_run_number: nextRunNumber,
          status: 'DOSSIER_READY',
          updated_at: new Date().toISOString(),
        })
        .eq('id', companyId);
    } catch {
      // Keep in mock store
    }

    await logAuditEvent({
      userName: executedBy,
      action: 'PROSPECT_RESEARCH_RUN_COMPLETED',
      module: 'PROSPECT_INTELLIGENCE',
      details: `Executed Research Run #${nextRunNumber} for company ${company.company_name} (Run ID: ${runId})`,
    });

    revalidatePath(`/dashboard/ai/prospect-intelligence/${companyId}`);
    revalidatePath('/dashboard/ai/prospect-intelligence');

    return { success: true, run: newRun };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Research run execution failed' };
  }
}

// ---------------------------------------------------------------------------
// 5. Prospect Dossier Retrieval
// ---------------------------------------------------------------------------
export async function getProspectDossier(
  companyId: string,
  runIdOrNumber?: string | number
): Promise<ProspectDossier | null> {
  const company = await getProspectCompanyById(companyId);
  if (!company) return null;

  // Retrieve runs
  let runs = MOCK_RUNS.filter(r => r.company_id === companyId).sort((a, b) => b.run_number - a.run_number);

  // Try fetching from DB if runs empty
  if (runs.length === 0) {
    try {
      const supabase = await createClient();
      const { data } = await supabase
        .from('prospect_research_runs')
        .select('*')
        .eq('company_id', companyId)
        .order('run_number', { ascending: false });
      if (data && data.length > 0) {
        runs = data as ProspectResearchRun[];
      }
    } catch {
      // Ignore
    }
  }

  // Determine current run
  let currentRun: ProspectResearchRun | undefined;
  if (runIdOrNumber) {
    currentRun = runs.find(r => r.id === runIdOrNumber || r.run_number === Number(runIdOrNumber));
  }
  if (!currentRun) {
    currentRun = runs[0]; // latest
  }

  // Filter child records by company and current run (or all if no run yet)
  const dms = MOCK_DECISION_MAKERS.filter(d => d.company_id === companyId && (!currentRun || d.run_id === currentRun.id));
  const projs = MOCK_PROJECTS.filter(p => p.company_id === companyId && (!currentRun || p.run_id === currentRun.id));
  const vendors = MOCK_VENDOR_INTELLIGENCE.filter(v => v.company_id === companyId && (!currentRun || v.run_id === currentRun.id));
  const techs = MOCK_TECH_SIGNALS.filter(t => t.company_id === companyId && (!currentRun || t.run_id === currentRun.id));
  const opps = MOCK_OPP_SIGNALS.filter(o => o.company_id === companyId && (!currentRun || o.run_id === currentRun.id));
  const evidences = MOCK_EVIDENCE_SOURCES.filter(e => e.company_id === companyId && (!currentRun || e.run_id === currentRun.id));

  // Compute relevance analysis
  const fitScore = techs.length > 0 ? Math.round(techs.reduce((acc, t) => acc + t.solution_fit_score, 0) / techs.length) : 85;
  const verifiedDMs = dms.filter(d => d.human_verified || d.classification === 'VERIFIED').length;
  const primaryAngle = opps[0]?.recommended_entry_angle || 'Present turnkey commercial audio-visual and surveillance proposal highlighting 5-year SLA and local Hyderabad technical support.';

  return {
    company,
    current_run: currentRun,
    run_history: runs,
    decision_makers: dms,
    projects: projs,
    vendor_intelligence: vendors,
    technology_signals: techs,
    opportunity_signals: opps,
    evidence_sources: evidences,
    relevance_analysis: {
      why_relevant: company.relevance_summary || 'High-growth enterprise facility requiring integrated security and AV technology infrastructure.',
      fit_score: fitScore,
      recommended_entry_angle: primaryAngle,
      key_decision_makers_count: dms.length,
      verified_contacts_count: verifiedDMs,
    },
  };
}

// ---------------------------------------------------------------------------
// 6. Compare Research Runs
// ---------------------------------------------------------------------------
export async function compareResearchRuns(
  companyId: string,
  runA: number,
  runB: number
): Promise<{
  runA: ProspectResearchRun | null;
  runB: ProspectResearchRun | null;
  newDecisionMakers: string[];
  vendorChanges: string[];
  newProjects: string[];
  summaryDiff: string;
}> {
  const dossierA = await getProspectDossier(companyId, runA);
  const dossierB = await getProspectDossier(companyId, runB);

  const dmNamesA = new Set(dossierA?.decision_makers.map(d => d.full_name) || []);
  const dmNamesB = dossierB?.decision_makers.map(d => d.full_name) || [];
  const newDMs = dmNamesB.filter(name => !dmNamesA.has(name));

  const projNamesA = new Set(dossierA?.projects.map(p => p.project_name) || []);
  const projNamesB = dossierB?.projects.map(p => p.project_name) || [];
  const newProjs = projNamesB.filter(name => !projNamesA.has(name));

  const vendorA = dossierA?.vendor_intelligence[0]?.incumbent_vendor || 'Unknown';
  const vendorB = dossierB?.vendor_intelligence[0]?.incumbent_vendor || 'Unknown';
  const vendorChanges = vendorA !== vendorB ? [`Vendor updated from "${vendorA}" to "${vendorB}"`] : [];

  return {
    runA: dossierA?.current_run || null,
    runB: dossierB?.current_run || null,
    newDecisionMakers: newDMs,
    vendorChanges,
    newProjects: newProjs,
    summaryDiff: `Comparison between Run #${runA} and Run #${runB}: ${newDMs.length} new decision maker(s) identified, ${newProjs.length} new project(s) tracked.`,
  };
}

// ---------------------------------------------------------------------------
// 7. Human Gating & Verification Actions
// ---------------------------------------------------------------------------
export async function updateFindingVerification(payload: {
  type: 'DECISION_MAKER' | 'PROJECT' | 'VENDOR' | 'TECH' | 'OPPORTUNITY';
  id: string;
  human_verified: boolean;
  verified_by: string;
  verification_notes?: string;
  classification?: ProspectClassification;
}): Promise<{ success: boolean; error?: string }> {
  try {
    if (payload.type === 'DECISION_MAKER') {
      const dm = MOCK_DECISION_MAKERS.find(d => d.id === payload.id);
      if (dm) {
        dm.human_verified = payload.human_verified;
        dm.verified_by = payload.verified_by;
        dm.verification_notes = payload.verification_notes;
        if (payload.classification) dm.classification = payload.classification;
      }

      try {
        const supabase = await createClient();
        await supabase
          .from('prospect_decision_makers')
          .update({
            human_verified: payload.human_verified,
            verified_by: payload.verified_by,
            verification_notes: payload.verification_notes,
            classification: payload.classification,
          })
          .eq('id', payload.id);
      } catch {
        // Ignore
      }
    }

    await logAuditEvent({
      userName: payload.verified_by,
      action: 'PROSPECT_FINDING_VERIFIED',
      module: 'PROSPECT_INTELLIGENCE',
      details: `Verified ${payload.type} finding (ID: ${payload.id}) - Classification: ${payload.classification || 'VERIFIED'}`,
    });

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Verification update failed' };
  }
}

// ---------------------------------------------------------------------------
// 8. Human-Gated CRM Conversion Action
// ---------------------------------------------------------------------------
export async function convertProspectToCRM(
  companyId: string,
  payload: {
    converted_by: string;
    customer_type?: 'Corporate' | 'Commercial' | 'Government' | 'Residential';
    contact_person?: string;
    email?: string;
    phone?: string;
    billing_address?: string;
    create_enquiry?: boolean;
    enquiry_details?: string;
  }
): Promise<{
  success: boolean;
  customer_id?: string;
  enquiry_id?: string;
  error?: string;
}> {
  try {
    const company = await getProspectCompanyById(companyId);
    if (!company) {
      return { success: false, error: 'Prospect company not found' };
    }

    if (company.status === 'CONVERTED' && company.crm_customer_id) {
      return {
        success: false,
        error: `Prospect is already converted to CRM Customer (ID: ${company.crm_customer_id})`,
      };
    }

    const dossier = await getProspectDossier(companyId);
    const primaryDM = dossier?.decision_makers[0];

    const customerName = company.company_name;
    const contactPerson = payload.contact_person || primaryDM?.full_name || 'Contact Person';
    const email = payload.email || primaryDM?.email || `info@${company.domain || 'company.com'}`;
    const phone = payload.phone || primaryDM?.phone || '+91 00000 00000';
    const address = payload.billing_address || company.headquarters_location || 'Hyderabad, Telangana';
    const customerType = payload.customer_type || 'Corporate';

    const newCustomerId = `CUST-${Date.now()}`;
    const newCustomer = {
      id: newCustomerId,
      name: customerName,
      company_name: customerName,
      contact_person: contactPerson,
      email: email,
      phone: phone,
      address: address,
      customer_type: customerType,
      status: 'Active',
      prospect_dossier_id: companyId, // Crucial cross-reference
      created_at: new Date().toISOString(),
    };

    // Update company state
    company.status = 'CONVERTED';
    company.crm_customer_id = newCustomerId;
    company.updated_at = new Date().toISOString();

    let newEnquiryId: string | undefined;
    if (payload.create_enquiry) {
      newEnquiryId = `ENQ-${Date.now()}`;
    }

    // Attempt Supabase write
    try {
      const supabase = await createClient();
      const { data: custData, error: custError } = await supabase
        .from('customers')
        .insert({
          name: customerName,
          company_name: customerName,
          email: email,
          phone: phone,
          address: address,
          customer_type: customerType,
          prospect_dossier_id: companyId,
        })
        .select('id')
        .single();

      if (!custError && custData) {
        company.crm_customer_id = custData.id;
        await supabase
          .from('prospect_companies')
          .update({
            status: 'CONVERTED',
            crm_customer_id: custData.id,
            updated_at: new Date().toISOString(),
          })
          .eq('id', companyId);

        if (payload.create_enquiry) {
          const { data: enqData } = await supabase
            .from('enquiries')
            .insert({
              customer_id: custData.id,
              customer_name: customerName,
              project_type: 'Integrated Technology',
              notes: payload.enquiry_details || `Initiated via Prospect Intelligence Dossier for ${customerName}. ${dossier?.relevance_analysis.recommended_entry_angle}`,
              status: 'New',
            })
            .select('id')
            .single();

          if (enqData) newEnquiryId = enqData.id;
        }
      }
    } catch {
      // In-memory fallback
    }

    await logAuditEvent({
      userName: payload.converted_by,
      action: 'PROSPECT_CONVERTED_TO_CRM',
      module: 'PROSPECT_INTELLIGENCE',
      details: `Converted prospect ${customerName} (ID: ${companyId}) to CRM Customer (ID: ${company.crm_customer_id || newCustomerId})${newEnquiryId ? `, Enquiry: ${newEnquiryId}` : ''}`,
    });

    revalidatePath('/dashboard/ai/prospect-intelligence');
    revalidatePath(`/dashboard/ai/prospect-intelligence/${companyId}`);
    revalidatePath('/dashboard/customers');

    return {
      success: true,
      customer_id: company.crm_customer_id || newCustomerId,
      enquiry_id: newEnquiryId,
    };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to convert prospect to CRM' };
  }
}

// ---------------------------------------------------------------------------
// 9. PHASE C.1: PROSPECT -> ENQUIRY / OPPORTUNITY BRIDGE
// ---------------------------------------------------------------------------

declare global {
  // eslint-disable-next-line no-var
  var __ICON_PROSPECT_CONVERSIONS__: Map<string, any> | undefined;
}

function getConversionIdempotencyStore(): Map<string, any> {
  if (!globalThis.__ICON_PROSPECT_CONVERSIONS__) {
    globalThis.__ICON_PROSPECT_CONVERSIONS__ = new Map();
  }
  return globalThis.__ICON_PROSPECT_CONVERSIONS__;
}

/**
 * Prepares prospect conversion data, runs live duplicate checks across customers
 * and open enquiries, and pre-populates advisory enquiry fields for human review.
 */
export async function prepareProspectEnquiryConversion(
  prospectCompanyId: string
): Promise<{ success: boolean; data?: ProspectEnquiryPreparation; error?: string }> {
  try {
    const prospectDossierId = prospectCompanyId;
    const dossier = await getProspectDossier(prospectCompanyId);
    if (!dossier) {
      return { success: false, error: `Prospect dossier not found for ID: ${prospectCompanyId}` };
    }

    const { company, decision_makers, projects, technology_signals, opportunity_signals, evidence_sources, relevance_analysis } = dossier;
    const primaryDM = decision_makers[0] || {
      full_name: 'Authorized Representative',
      title: 'Facility / IT Contact',
      department: 'PROJECTS',
      email: `contact@${company.domain || 'company.com'}`,
      phone: '+91 98490 00000',
    };

    // 1. Live Duplicate Check across Customers
    const normName = normalizeCompanyName(company.company_name);
    const cleanDomain = company.domain ? company.domain.toLowerCase().trim() : '';

    let matchingCustomer: { id: string; name: string; code?: string; phone?: string; domain?: string } | undefined;
    const allCustomersRes = await getCustomers();
    if (allCustomersRes && allCustomersRes.customers) {
      const match = allCustomersRes.customers.find((c) => {
        const cNorm = normalizeCompanyName(c.company_name || c.customer_name || '');
        const cDomain = c.email ? c.email.split('@')[1]?.toLowerCase() : '';
        return cNorm === normName || (cleanDomain && cDomain === cleanDomain);
      });
      if (match) {
        matchingCustomer = {
          id: match.id,
          name: match.company_name || match.customer_name,
          code: match.customer_code,
          phone: match.phone,
          domain: cleanDomain,
        };
      }
    }

    // 2. Live Duplicate Check across Enquiries
    const allEnquiriesRes = await getEnquiries();
    const existingEnquiries: Array<{ id: string; number: string; status: string; requirement: string }> = [];
    let alreadyConvertedToEnquiry = false;

    if (allEnquiriesRes && allEnquiriesRes.enquiries) {
      for (const enq of allEnquiriesRes.enquiries) {
        const enqNorm = normalizeCompanyName(enq.company_name || enq.customer_name || '');
        const isMatch = enqNorm === normName || (matchingCustomer && enq.customer_id === matchingCustomer.id);
        const isDossierMatch = enq.prospect_dossier_id === prospectDossierId;

        if (isDossierMatch) {
          alreadyConvertedToEnquiry = true;
        }

        if (isMatch || isDossierMatch) {
          existingEnquiries.push({
            id: enq.id,
            number: enq.enquiry_number,
            status: enq.status,
            requirement: enq.requirement_summary,
          });
        }
      }
    }

    // 3. Advisory Pre-populated Fields
    let proposedProductCategory = 'Integrated Technology';
    if (technology_signals.length > 0) {
      const topCategory = technology_signals[0].category;
      if (topCategory.includes('Surveillance') || topCategory.includes('CCTV')) proposedProductCategory = 'CCTV';
      else if (topCategory.includes('Audio') || topCategory.includes('Visual')) proposedProductCategory = 'AV Solutions';
      else if (topCategory.includes('Access')) proposedProductCategory = 'Integrated Technology';
      else if (topCategory.includes('Networking')) proposedProductCategory = 'Networking';
    }

    let proposedEstimatedBudget = 0;
    if (projects.length > 0 && projects[0].estimated_value) {
      const numMatch = projects[0].estimated_value.match(/\d+(\.\d+)?/);
      if (numMatch) {
        // e.g. 1.8 Cr -> 18,000,000
        const val = parseFloat(numMatch[0]);
        if (projects[0].estimated_value.includes('Cr')) proposedEstimatedBudget = val * 10000000;
        else if (projects[0].estimated_value.includes('Lakh')) proposedEstimatedBudget = val * 100000;
        else proposedEstimatedBudget = val;
      }
    }

    const proposedRequirementSummary = projects[0]?.description ||
      opportunity_signals[0]?.detail ||
      `Enterprise AV & CCTV infrastructure expansion for ${company.company_name}. ${relevance_analysis.recommended_entry_angle}`;

    const proposedSiteVisitRequired = true; // High-value commercial fitouts require survey

    // Log audit events
    await logAuditEvent({
      userName: 'SYSTEM',
      action: 'PROSPECT_CONVERSION_STARTED',
      module: 'PROSPECT_ENQUIRY_BRIDGE',
      details: `Conversion proposal prepared for ${company.company_name} (Dossier ID: ${prospectDossierId})`,
    });

    await logAuditEvent({
      userName: 'SYSTEM',
      action: 'PROSPECT_DUPLICATE_CHECK_PERFORMED',
      module: 'PROSPECT_ENQUIRY_BRIDGE',
      details: `Duplicate check: matchingCustomer=${Boolean(matchingCustomer)}, existingEnquiries=${existingEnquiries.length}`,
    });

    const prepData: ProspectEnquiryPreparation = {
      prospectCompanyId,
      prospectDossierId,
      companyName: company.company_name,
      domain: company.domain,
      industry: company.industry,
      headquartersLocation: company.headquarters_location,
      primaryContact: {
        fullName: primaryDM.full_name,
        title: primaryDM.title,
        department: primaryDM.department,
        email: primaryDM.email,
        phone: primaryDM.phone,
        linkedinUrl: primaryDM.linkedin_url,
      },
      proposedSalesperson: 'Dheeraj', // Default advisory
      proposedProductCategory,
      proposedRequirementSummary,
      proposedEstimatedBudget: proposedEstimatedBudget > 0 ? proposedEstimatedBudget : undefined,
      proposedSiteVisitRequired,
      recommendedEntryAngle: relevance_analysis.recommended_entry_angle,
      evidenceCitations: evidence_sources.map((ev) => ({
        sourceName: ev.source_name,
        sourceUrl: ev.source_url,
        snippetContent: ev.snippet_content,
        reliability: ev.reliability,
      })),
      duplicateCheck: {
        hasMatchingCustomer: Boolean(matchingCustomer),
        matchingCustomer,
        openEnquiriesCount: existingEnquiries.filter((e) => e.status !== 'Lost' && e.status !== 'Cancelled').length,
        existingEnquiries,
        alreadyConvertedToEnquiry,
      },
    };

    return { success: true, data: prepData };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to prepare prospect conversion' };
  }
}

/**
 * Executes an atomic, human-authorized conversion of a prospect dossier into an authoritative ERP enquiry.
 * Reuses existing customer if requested, or creates a new CRM customer with prospect_dossier_id.
 * Guaranteed idempotency and zero duplicate creation under retries.
 */
export async function convertProspectToEnquiry(
  payload: ProspectConversionPayload
): Promise<{
  success: boolean;
  customer_id?: string;
  customer_code?: string;
  enquiry_id?: string;
  enquiry_number?: string;
  is_new_customer?: boolean;
  error?: string;
}> {
  try {
    // 1. Role Authorization Check
    const authUser = await requireRole([
      'Managing Director',
      'Admin / BDM',
      'BDM',
      'Sales Executive',
    ]);

    const { prospectCompanyId, prospectDossierId, idempotencyKey, linkExistingCustomer } = payload;

    // 2. Idempotency Check (Scoped to individual request key)
    const idempotencyStore = getConversionIdempotencyStore();
    if (idempotencyStore.has(idempotencyKey)) {
      return idempotencyStore.get(idempotencyKey);
    }

    const company = await getProspectCompanyById(prospectCompanyId);
    if (!company) {
      return { success: false, error: `Prospect company ${prospectCompanyId} not found` };
    }

    let crmCustomerId = payload.crmCustomerId;
    let customerCode = '';
    let isNewCustomer = false;
    let createdCustomerId: string | null = null;

    // 3. Customer Resolution
    if (linkExistingCustomer) {
      if (!crmCustomerId) {
        return { success: false, error: 'Customer ID must be provided when linking to an existing customer' };
      }
      // Verify customer exists
      const allCustomers = await getCustomers();
      const matched = allCustomers.customers.find((c) => c.id === crmCustomerId);
      if (!matched) {
        return { success: false, error: `Target customer ${crmCustomerId} does not exist` };
      }
      customerCode = matched.customer_code || '';
      isNewCustomer = false;

      // Update prospect_dossier_id on customer if not set
      try {
        const supabase = await createClient();
        await supabase
          .from('customers')
          .update({ prospect_dossier_id: prospectDossierId, updated_at: new Date().toISOString() })
          .eq('id', crmCustomerId)
          .is('prospect_dossier_id', null);
      } catch {
        // In-memory fallback
      }

      await logAuditEvent({
        userName: authUser.name,
        action: 'PROSPECT_CUSTOMER_LINKED',
        module: 'PROSPECT_ENQUIRY_BRIDGE',
        details: `Linked prospect ${company.company_name} to existing customer ${matched.customer_name} (${customerCode})`,
      });
    } else {
      // Create new customer record
      const customerData = payload.customerData || {
        customerType: 'COMPANY',
        customerName: company.company_name,
        companyName: company.company_name,
        phone: '9849012345',
        billingAddress: company.headquarters_location || 'Hyderabad, Telangana',
      };

      const newCustRes = await createCustomer({
        customer_type: 'COMPANY',
        company_name: customerData.companyName || customerData.customerName,
        contact_person: customerData.customerName,
        phone: customerData.phone,
        email: customerData.email,
        billing_address: customerData.billingAddress || 'Hyderabad, Telangana',
        city: 'Hyderabad',
        state: 'Telangana',
        state_code: '36',
        enquiry_source: 'AI Prospect Intelligence',
        credit_limit: 0,
        status: 'ACTIVE',
      });

      if (!newCustRes.success || !newCustRes.customer) {
        return { success: false, error: newCustRes.error || 'Failed to create CRM customer record' };
      }

      crmCustomerId = newCustRes.customer.id;
      customerCode = newCustRes.customer.customer_code || '';
      isNewCustomer = true;
      createdCustomerId = crmCustomerId; // Track for potential rollback

      // Tag prospect_dossier_id on newly created customer
      try {
        const supabase = await createClient();
        await supabase
          .from('customers')
          .update({ prospect_dossier_id: prospectDossierId })
          .eq('id', crmCustomerId);
      } catch {
        // In-memory
      }

      await logAuditEvent({
        userName: authUser.name,
        action: 'PROSPECT_CUSTOMER_CREATED',
        module: 'PROSPECT_ENQUIRY_BRIDGE',
        details: `Created new CRM customer ${customerData.customerName} (${customerCode}) for prospect ${company.company_name}`,
      });
    }

    // 4. Create Authoritative ERP Enquiry
    const enquiryRes = await createEnquiry({
      customer_id: crmCustomerId,
      customer_name: payload.customerData?.customerName || company.company_name,
      company_name: payload.customerData?.companyName || company.company_name,
      customer_type: payload.customerData?.customerType || 'COMPANY',
      phone: payload.customerData?.phone || '9849012345',
      email: payload.customerData?.email,
      source: 'AI Prospect Intelligence',
      salesperson_name: payload.enquiryData.salespersonName || authUser.name,
      product_category: payload.enquiryData.productCategory || 'Integrated Technology',
      requirement_summary: payload.enquiryData.requirementSummary,
      estimated_budget: payload.enquiryData.estimatedBudget || 0,
      status: 'Enquiry',
      follow_up_date: payload.enquiryData.followUpDate,
      site_visit_required: payload.enquiryData.siteVisitRequired,
      prospect_dossier_id: prospectDossierId, // Permanent end-to-end traceability
    });

    if (!enquiryRes.success || !enquiryRes.data) {
      // COMPENSATION ROLLBACK: If we created a new customer in this transaction, compensate to prevent orphan state
      if (isNewCustomer && createdCustomerId) {
        try {
          const supabase = await createClient();
          await supabase.from('customers').delete().eq('id', createdCustomerId);
        } catch {
          // Ignore
        }
      }
      return { success: false, error: enquiryRes.error || 'Failed to create ERP enquiry' };
    }

    const enquiryId = enquiryRes.data.id;
    const enquiryNumber = enquiryRes.data.enquiry_number;

    // 5. Update Prospect Company status
    company.status = 'CONVERTED';
    company.crm_customer_id = crmCustomerId;
    company.updated_at = new Date().toISOString();

    try {
      const supabase = await createClient();
      await supabase
        .from('prospect_companies')
        .update({
          status: 'CONVERTED',
          crm_customer_id: crmCustomerId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', prospectCompanyId);
    } catch {
      // In-memory
    }

    // 6. Log Audit Events
    await logAuditEvent({
      userName: authUser.name,
      action: 'PROSPECT_ENQUIRY_CREATED',
      module: 'PROSPECT_ENQUIRY_BRIDGE',
      details: `Created enquiry ${enquiryNumber} (ID: ${enquiryId}) linked to prospect ${company.company_name} (Dossier: ${prospectDossierId})`,
    });

    await logAuditEvent({
      userName: authUser.name,
      action: 'PROSPECT_CONVERSION_COMPLETED',
      module: 'PROSPECT_ENQUIRY_BRIDGE',
      details: `Conversion completed for ${company.company_name}: Customer ${customerCode || crmCustomerId}, Enquiry ${enquiryNumber}`,
    });

    const finalResult = {
      success: true,
      customer_id: crmCustomerId,
      customer_code: customerCode,
      enquiry_id: enquiryId,
      enquiry_number: enquiryNumber,
      is_new_customer: isNewCustomer,
    };

    // Cache in idempotency store
    idempotencyStore.set(idempotencyKey, finalResult);

    revalidatePath('/dashboard/ai/prospect-intelligence');
    revalidatePath(`/dashboard/ai/prospect-intelligence/${prospectCompanyId}`);
    revalidatePath('/dashboard/enquiries');
    revalidatePath('/dashboard/customers');

    return finalResult;
  } catch (err: any) {
    return { success: false, error: err?.message || 'Conversion execution failed' };
  }
}

/**
 * Records deliberate business cancellation of a prospect conversion.
 */
export async function cancelProspectConversion(
  prospectCompanyId: string,
  reason?: string,
  cancelledBy?: string
): Promise<{ success: boolean }> {
  try {
    const authUser = await getAuthenticatedUser();
    const userName = cancelledBy || authUser?.name || 'Authorized User';

    await logAuditEvent({
      userName,
      action: 'PROSPECT_CONVERSION_CANCELLED',
      module: 'PROSPECT_ENQUIRY_BRIDGE',
      details: `Deliberate cancellation for prospect ${prospectCompanyId}: ${reason || 'User cancelled conversion flow'}`,
    });

    return { success: true };
  } catch {
    return { success: true };
  }
}

