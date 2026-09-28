'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { isSupabaseAvailable } from '@/lib/supabase/health';
import { INITIAL_SERVICE_TICKETS, INITIAL_RENTALS } from '@/lib/constants/erp-data';
import { requireRole } from '@/lib/auth/session';
import { logAuditEvent } from '@/lib/audit/logger';
import {
  getIndianFinancialYear,
  getNextServiceTicketNumber,
  getNextAMCContractNumber,
  getNextRentalAgreementNumber,
} from '@/lib/utils/sequence';
import type {
  ServiceTicket,
  EquipmentRental,
  AMCContract,
  WarrantyClaim,
  WarrantyClaimType,
  WarrantyClaimStatus,
  OrganizationEntity,
} from '@/types/erp';

const INITIAL_AMC_CONTRACTS: AMCContract[] = [
  {
    id: 'AMC260001',
    contract_number: 'AMC260001',
    entity_code: 'ICON_TECH_PRO',
    customer_id: 'ICON260006',
    customer_name: 'Sri Sai Hospitals & Diagnostic Center',
    start_date: '2026-09-01',
    end_date: '2027-08-31',
    annual_visits_count: 4,
    contract_value: 36000,
    is_active: true,
    amc_type: 'COMPREHENSIVE',
    sla_hours: 12,
    scheduled_visits_count: 4,
    completed_visits_count: 0,
    renewal_status: 'ACTIVE',
    created_at: '2026-08-30T10:00:00Z',
  },
  {
    id: 'AMC260002',
    contract_number: 'AMC260002',
    entity_code: 'ICON_TECH_PRO',
    customer_id: 'ICON260007',
    customer_name: 'Cyber Heights Commercial Complex',
    start_date: '2026-09-01',
    end_date: '2027-08-31',
    annual_visits_count: 6,
    contract_value: 72000,
    is_active: true,
    amc_type: 'NON_COMPREHENSIVE',
    sla_hours: 24,
    scheduled_visits_count: 6,
    completed_visits_count: 1,
    renewal_status: 'ACTIVE',
    created_at: '2026-08-25T14:00:00Z',
  },
];

// Shared in-memory store across requests in this Node process
declare global {
  // eslint-disable-next-line no-var
  var __ICON_SERVICE_TICKETS__: ServiceTicket[] | undefined;
  // eslint-disable-next-line no-var
  var __ICON_RENTALS__: EquipmentRental[] | undefined;
  // eslint-disable-next-line no-var
  var __ICON_AMC_CONTRACTS__: AMCContract[] | undefined;
  // eslint-disable-next-line no-var
  var __ICON_WARRANTY_CLAIMS__: WarrantyClaim[] | undefined;
}

function getServiceTicketsStore(): ServiceTicket[] {
  if (!globalThis.__ICON_SERVICE_TICKETS__) {
    globalThis.__ICON_SERVICE_TICKETS__ = [...INITIAL_SERVICE_TICKETS];
  }
  return globalThis.__ICON_SERVICE_TICKETS__;
}

function getAMCContractsStore(): AMCContract[] {
  if (!globalThis.__ICON_AMC_CONTRACTS__) {
    globalThis.__ICON_AMC_CONTRACTS__ = [...INITIAL_AMC_CONTRACTS];
  }
  return globalThis.__ICON_AMC_CONTRACTS__;
}

function getWarrantyClaimsStore(): WarrantyClaim[] {
  if (!globalThis.__ICON_WARRANTY_CLAIMS__) {
    globalThis.__ICON_WARRANTY_CLAIMS__ = [
      {
        id: 'CLM-001',
        claim_number: 'ICON/26-27/CLM-0001',
        serial_number: 'EP-4K-980-SN4401',
        customer_name: 'T-Hub Foundation',
        product_name: 'Epson Home Cinema 4K Laser Projector',
        claim_date: '2026-09-15',
        issue_description: 'Intermittent optical flicker during presentation startup',
        claim_type: 'ON_SITE_SERVICE',
        status: 'IN_REPAIR',
        created_at: '2026-09-15T10:00:00Z',
      },
    ];
  }
  return globalThis.__ICON_WARRANTY_CLAIMS__;
}

function getRentalsStore(): EquipmentRental[] {
  if (!globalThis.__ICON_RENTALS__) {
    globalThis.__ICON_RENTALS__ = [...INITIAL_RENTALS];
  }
  return globalThis.__ICON_RENTALS__;
}

export async function getServiceTickets(): Promise<ServiceTicket[]> {
  const store = getServiceTicketsStore();

  const isOnline = await isSupabaseAvailable();
  if (isOnline) {
    try {
      const supabase = await createClient();
      const { data, error } = await supabase.from('service_tickets').select('*').order('created_at', { ascending: false });
      if (!error && data && data.length > 0) {
        return data as ServiceTicket[];
      }
    } catch (err) {
      console.warn('Supabase service_tickets query failed, using store:', err);
    }
  }

  return store;
}

export async function createServiceTicket(payload: {
  customer_name: string;
  product_name?: string;
  serial_number?: string;
  complaint_description: string;
  priority?: 'Low' | 'Medium' | 'High' | 'Critical';
  assigned_technician_name?: string;
  entity_code?: OrganizationEntity;
  organization_id?: string;
}): Promise<{ success: boolean; data?: ServiceTicket; error?: string }> {
  try {
    const authUser = await requireRole(['Managing Director', 'Admin / BDM', 'BDM', 'Sales Executive']);

    const store = getServiceTicketsStore();
    const entity: OrganizationEntity = 'ICON_TECH_PRO';
    const ticketNumber = await getNextServiceTicketNumber();

    const ticket: ServiceTicket = {
      id: `SRV-${Date.now()}`,
      ticket_number: ticketNumber,
      entity_code: 'ICON_TECH_PRO',
      customer_id: 'CUST-GENERIC',
      customer_name: payload.customer_name,
      product_name: payload.product_name,
      serial_number: payload.serial_number,
      complaint_description: payload.complaint_description,
      priority: payload.priority || 'Medium',
      assigned_technician_name: payload.assigned_technician_name || 'Nagaraju',
      status: 'Open',
      service_charge: 0,
      created_at: new Date().toISOString(),
    };

    store.unshift(ticket);

    await logAuditEvent({
      userName: authUser.name,
      action: 'CREATE_SERVICE_TICKET',
      module: 'SERVICE',
      details: `Created service ticket ${ticketNumber} for ${payload.customer_name}`,
    });

    revalidatePath('/dashboard/service');
    revalidatePath('/dashboard');
    return { success: true, data: ticket };
  } catch (err) {
    return { success: false, error: (err as Error).message || 'Failed to create service ticket' };
  }
}

export async function getAMCContracts(): Promise<AMCContract[]> {
  const store = getAMCContractsStore();
  const isOnline = await isSupabaseAvailable();
  if (isOnline) {
    try {
      const supabase = await createClient();
      const { data, error } = await supabase.from('amc_contracts').select('*').order('created_at', { ascending: false });
      if (!error && data && data.length > 0) {
        return data as AMCContract[];
      }
    } catch (err) {
      console.warn('Supabase amc_contracts query failed, using store:', err);
    }
  }
  return store;
}

/**
 * Retrieve AMC Contracts expiring within specified days.
 */
export async function getExpiringAMCs(withinDays: number = 30): Promise<AMCContract[]> {
  const contracts = await getAMCContracts();
  const now = new Date();
  const limit = new Date();
  limit.setDate(now.getDate() + withinDays);

  return contracts.filter((c) => {
    if (!c.end_date || !c.is_active) return false;
    const end = new Date(c.end_date);
    return end >= now && end <= limit;
  });
}

/**
 * Renew an AMC Contract for an additional term.
 */
export async function renewAMCContract(
  contractId: string,
  termMonths: number = 12
): Promise<{ success: boolean; data?: AMCContract; error?: string }> {
  try {
    const authUser = await requireRole(['Managing Director', 'Admin / BDM', 'Sales Executive']);
    const store = getAMCContractsStore();
    const existing = store.find((c) => c.id === contractId || c.contract_number === contractId);
    if (!existing) {
      return { success: false, error: 'AMC Contract not found' };
    }

    existing.renewal_status = 'RENEWED';

    const oldEnd = new Date(existing.end_date);
    const newStart = new Date(oldEnd);
    newStart.setDate(newStart.getDate() + 1);

    const newEnd = new Date(newStart);
    newEnd.setMonth(newEnd.getMonth() + termMonths);
    newEnd.setDate(newEnd.getDate() - 1);

    const fy = getIndianFinancialYear();
    const seq = (store.length + 1).toString().padStart(4, '0');
    const newContractNumber = `ICON/${fy}/AMC-${seq}`;

    const newContract: AMCContract = {
      id: `AMC-${Date.now()}`,
      contract_number: newContractNumber,
      entity_code: existing.entity_code,
      customer_id: existing.customer_id,
      customer_name: existing.customer_name,
      start_date: newStart.toISOString().split('T')[0],
      end_date: newEnd.toISOString().split('T')[0],
      annual_visits_count: existing.annual_visits_count,
      contract_value: existing.contract_value,
      is_active: true,
      amc_type: existing.amc_type || 'COMPREHENSIVE',
      sla_hours: existing.sla_hours || 24,
      scheduled_visits_count: existing.annual_visits_count,
      completed_visits_count: 0,
      renewal_status: 'ACTIVE',
      created_at: new Date().toISOString(),
    };

    store.unshift(newContract);

    if (await isSupabaseAvailable()) {
      try {
        const admin = createAdminClient();
        await admin
          .from('amc_contracts')
          .update({ renewal_status: 'RENEWED' })
          .or(`id.eq.${existing.id},contract_number.eq.${existing.contract_number}`);

        await admin.from('amc_contracts').insert([
          {
            contract_number: newContractNumber,
            entity_code: newContract.entity_code,
            customer_name: newContract.customer_name,
            start_date: newContract.start_date,
            end_date: newContract.end_date,
            annual_visits_count: newContract.annual_visits_count,
            contract_value: newContract.contract_value,
            is_active: true,
            amc_type: newContract.amc_type,
            sla_hours: newContract.sla_hours,
            scheduled_visits_count: newContract.scheduled_visits_count,
            completed_visits_count: 0,
            renewal_status: 'ACTIVE',
          },
        ]);
      } catch (err) {
        console.warn('Supabase renewAMCContract fallback:', err);
      }
    }

    await logAuditEvent({
      userName: authUser.name,
      action: 'RENEW_AMC_CONTRACT',
      module: 'SERVICE',
      details: `Renewed AMC Contract ${existing.contract_number} -> ${newContractNumber} for ${existing.customer_name}`,
    });

    revalidatePath('/dashboard/service');
    revalidatePath('/dashboard');
    return { success: true, data: newContract };
  } catch (err) {
    return { success: false, error: (err as Error).message || 'Failed to renew AMC contract' };
  }
}

/**
 * Schedule or update maintenance visits on an AMC Contract.
 */
export async function scheduleMaintenanceVisit(
  contractId: string,
  options?: { isCompleted?: boolean }
): Promise<{ success: boolean; data?: AMCContract; error?: string }> {
  try {
    const authUser = await requireRole(['Managing Director', 'Admin / BDM', 'Sales Executive', 'Office Assistant']);
    const store = getAMCContractsStore();
    const contract = store.find((c) => c.id === contractId || c.contract_number === contractId);
    if (!contract) {
      return { success: false, error: 'AMC Contract not found' };
    }

    if (options?.isCompleted) {
      contract.completed_visits_count = (contract.completed_visits_count || 0) + 1;
    } else {
      contract.scheduled_visits_count = (contract.scheduled_visits_count || 0) + 1;
    }

    if (await isSupabaseAvailable()) {
      try {
        const admin = createAdminClient();
        await admin
          .from('amc_contracts')
          .update({
            scheduled_visits_count: contract.scheduled_visits_count,
            completed_visits_count: contract.completed_visits_count,
          })
          .or(`id.eq.${contract.id},contract_number.eq.${contract.contract_number}`);
      } catch (err) {
        console.warn('Supabase scheduleMaintenanceVisit fallback:', err);
      }
    }

    await logAuditEvent({
      userName: authUser.name,
      action: 'SCHEDULE_AMC_VISIT',
      module: 'SERVICE',
      details: `Updated visit counts for ${contract.contract_number}: Scheduled=${contract.scheduled_visits_count}, Completed=${contract.completed_visits_count}`,
    });

    revalidatePath('/dashboard/service');
    return { success: true, data: contract };
  } catch (err) {
    return { success: false, error: (err as Error).message || 'Failed to schedule AMC visit' };
  }
}

/**
 * Update status & resolution details of a Service Ticket.
 */
export async function updateServiceTicketStatus(
  ticketId: string,
  status: ServiceTicket['status'],
  resolutionDetails?: string
): Promise<{ success: boolean; data?: ServiceTicket; error?: string }> {
  try {
    const authUser = await requireRole(['Managing Director', 'Admin / BDM', 'Sales Executive', 'Office Assistant']);
    const store = getServiceTicketsStore();
    const ticket = store.find((t) => t.id === ticketId || t.ticket_number === ticketId);
    if (!ticket) {
      return { success: false, error: 'Service ticket not found' };
    }

    ticket.status = status;
    if (resolutionDetails) {
      ticket.resolution_details = resolutionDetails;
    }

    if (await isSupabaseAvailable()) {
      try {
        const admin = createAdminClient();
        await admin
          .from('service_tickets')
          .update({
            status,
            resolution_details: ticket.resolution_details,
          })
          .or(`id.eq.${ticket.id},ticket_number.eq.${ticket.ticket_number}`);
      } catch (err) {
        console.warn('Supabase updateServiceTicketStatus fallback:', err);
      }
    }

    await logAuditEvent({
      userName: authUser.name,
      action: 'UPDATE_SERVICE_TICKET_STATUS',
      module: 'SERVICE',
      details: `Updated ticket ${ticket.ticket_number} status to ${status}`,
    });

    revalidatePath('/dashboard/service');
    revalidatePath('/dashboard');
    return { success: true, data: ticket };
  } catch (err) {
    return { success: false, error: (err as Error).message || 'Failed to update service ticket' };
  }
}

/**
 * Retrieve all Warranty Claims.
 */
export async function getWarrantyClaims(): Promise<WarrantyClaim[]> {
  const store = getWarrantyClaimsStore();
  const isOnline = await isSupabaseAvailable();
  if (isOnline) {
    try {
      const supabase = await createClient();
      const { data, error } = await supabase.from('warranty_claims').select('*').order('created_at', { ascending: false });
      if (!error && data && data.length > 0) {
        return data as WarrantyClaim[];
      }
    } catch (err) {
      console.warn('Supabase warranty_claims query failed, using store:', err);
    }
  }
  return store;
}

/**
 * Create a new Warranty Claim.
 */
export async function createWarrantyClaim(payload: {
  serial_number: string;
  customer_name: string;
  product_name?: string;
  issue_description: string;
  claim_type?: WarrantyClaimType;
}): Promise<{ success: boolean; data?: WarrantyClaim; error?: string }> {
  try {
    const authUser = await requireRole(['Managing Director', 'Admin / BDM', 'Sales Executive', 'Office Assistant']);
    if (!payload.serial_number || !payload.customer_name || !payload.issue_description) {
      return { success: false, error: 'serial_number, customer_name, and issue_description are required' };
    }

    const store = getWarrantyClaimsStore();
    const fy = getIndianFinancialYear();
    const seq = (store.length + 1).toString().padStart(4, '0');
    const claimNumber = `ICON/${fy}/CLM-${seq}`;

    const claim: WarrantyClaim = {
      id: `CLM-${Date.now()}`,
      claim_number: claimNumber,
      serial_number: payload.serial_number.trim(),
      customer_name: payload.customer_name.trim(),
      product_name: payload.product_name,
      claim_date: new Date().toISOString().split('T')[0],
      issue_description: payload.issue_description.trim(),
      claim_type: payload.claim_type || 'REPAIR',
      status: 'PENDING',
      created_at: new Date().toISOString(),
    };

    store.unshift(claim);

    if (await isSupabaseAvailable()) {
      try {
        const admin = createAdminClient();
        await admin.from('warranty_claims').insert([
          {
            claim_number: claim.claim_number,
            serial_number: claim.serial_number,
            customer_name: claim.customer_name,
            product_name: claim.product_name || null,
            claim_date: claim.claim_date,
            issue_description: claim.issue_description,
            claim_type: claim.claim_type,
            status: claim.status,
          },
        ]);
      } catch (err) {
        console.warn('Supabase createWarrantyClaim fallback:', err);
      }
    }

    await logAuditEvent({
      userName: authUser.name,
      action: 'CREATE_WARRANTY_CLAIM',
      module: 'SERVICE',
      details: `Created warranty claim ${claimNumber} for serial ${payload.serial_number}`,
    });

    revalidatePath('/dashboard/service');
    revalidatePath('/dashboard');
    return { success: true, data: claim };
  } catch (err) {
    return { success: false, error: (err as Error).message || 'Failed to create warranty claim' };
  }
}

/**
 * Update status of a Warranty Claim.
 */
export async function updateWarrantyClaimStatus(
  claimId: string,
  status: WarrantyClaimStatus,
  resolutionNotes?: string
): Promise<{ success: boolean; data?: WarrantyClaim; error?: string }> {
  try {
    const authUser = await requireRole(['Managing Director', 'Admin / BDM', 'Sales Executive']);
    const store = getWarrantyClaimsStore();
    const claim = store.find((c) => c.id === claimId || c.claim_number === claimId);
    if (!claim) {
      return { success: false, error: 'Warranty claim not found' };
    }

    claim.status = status;
    if (resolutionNotes) {
      claim.resolution_notes = resolutionNotes;
    }
    if (status === 'RESOLVED') {
      claim.resolved_at = new Date().toISOString();
    }

    if (await isSupabaseAvailable()) {
      try {
        const admin = createAdminClient();
        await admin
          .from('warranty_claims')
          .update({
            status,
            resolution_notes: claim.resolution_notes || null,
            resolved_at: claim.resolved_at || null,
          })
          .or(`id.eq.${claim.id},claim_number.eq.${claim.claim_number}`);
      } catch (err) {
        console.warn('Supabase updateWarrantyClaimStatus fallback:', err);
      }
    }

    await logAuditEvent({
      userName: authUser.name,
      action: 'UPDATE_WARRANTY_CLAIM_STATUS',
      module: 'SERVICE',
      details: `Updated claim ${claim.claim_number} status to ${status}`,
    });

    revalidatePath('/dashboard/service');
    revalidatePath('/dashboard');
    return { success: true, data: claim };
  } catch (err) {
    return { success: false, error: (err as Error).message || 'Failed to update warranty claim' };
  }
}

/**
 * Check Warranty Status for a serial number.
 */
export async function checkWarrantyStatus(serialNumber: string): Promise<{
  success: boolean;
  serialNumber: string;
  isWarrantyActive: boolean;
  status: 'ACTIVE' | 'EXPIRED' | 'NOT_FOUND';
  warrantyEndDate?: string;
  provider?: string;
  customerName?: string;
}> {
  try {
    const isOnline = await isSupabaseAvailable();
    if (isOnline) {
      try {
        const supabase = await createClient();
        const { data } = await supabase
          .from('serial_records')
          .select('*')
          .eq('serial_number', serialNumber)
          .maybeSingle();

        if (data) {
          const todayStr = new Date().toISOString().split('T')[0];
          const isActive = Boolean(data.warranty_end_date && data.warranty_end_date >= todayStr);
          return {
            success: true,
            serialNumber,
            isWarrantyActive: isActive,
            status: isActive ? 'ACTIVE' : 'EXPIRED',
            warrantyEndDate: data.warranty_end_date,
            provider: data.warranty_provider,
            customerName: data.customer_name,
          };
        }
      } catch (err) {
        console.warn('Supabase checkWarrantyStatus fallback:', err);
      }
    }

    // Check in-memory store
    const serialsStore = globalThis.__ICON_SERIAL_RECORDS__ || [];
    const record = serialsStore.find(
      (s) => s.serial_number.toLowerCase() === serialNumber.toLowerCase()
    );

    if (record) {
      const todayStr = new Date().toISOString().split('T')[0];
      const isActive = Boolean(record.warranty_end_date && record.warranty_end_date >= todayStr);
      return {
        success: true,
        serialNumber,
        isWarrantyActive: isActive,
        status: isActive ? 'ACTIVE' : 'EXPIRED',
        warrantyEndDate: record.warranty_end_date,
        provider: record.warranty_provider,
        customerName: record.customer_name,
      };
    }

    return {
      success: true,
      serialNumber,
      isWarrantyActive: false,
      status: 'NOT_FOUND',
    };
  } catch (err) {
    return {
      success: false,
      serialNumber,
      isWarrantyActive: false,
      status: 'NOT_FOUND',
    };
  }
}

export async function getRentals(): Promise<EquipmentRental[]> {
  return getRentalsStore();
}

export async function createRentalAgreement(payload: {
  customer_name: string;
  product_name: string;
  serial_number?: string;
  start_date: string;
  end_date: string;
  security_deposit: number;
  rental_fee: number;
}): Promise<{ success: boolean; data?: EquipmentRental; error?: string }> {
  try {
    const authUser = await requireRole(['Managing Director', 'Admin / BDM']);

    const store = getRentalsStore();
    const fy = getIndianFinancialYear();
    const seq = (store.length + 1).toString().padStart(4, '0');
    const rentalNumber = `ICON/${fy}/RNT-${seq}`;

    const rental: EquipmentRental = {
      id: `RNT-${Date.now()}`,
      rental_number: rentalNumber,
      entity_code: 'ICON_TECH_PRO',
      customer_id: 'CUST-GENERIC',
      customer_name: payload.customer_name,
      product_name: payload.product_name,
      serial_number: payload.serial_number,
      start_date: payload.start_date,
      end_date: payload.end_date,
      security_deposit: payload.security_deposit,
      rental_fee: payload.rental_fee,
      status: 'Active',
      created_at: new Date().toISOString(),
    };

    store.unshift(rental);

    await logAuditEvent({
      userName: authUser.name,
      action: 'CREATE_RENTAL_AGREEMENT',
      module: 'RENTAL',
      details: `Created rental agreement ${rentalNumber} for ${payload.customer_name}`,
    });

    revalidatePath('/dashboard/service');
    revalidatePath('/dashboard/rental');
    revalidatePath('/dashboard');
    return { success: true, data: rental };
  } catch (err) {
    return { success: false, error: (err as Error).message || 'Failed to create rental agreement' };
  }
}

/**
 * Safely update Service Ticket details (complaint, assigned technician, priority, resolution notes).
 */
export async function updateServiceTicket(
  ticketId: string,
  values: Partial<{
    complaint_description: string;
    assigned_technician_name: string;
    priority: ServiceTicket['priority'];
    status: ServiceTicket['status'];
    resolution_details: string;
    scheduled_date: string;
  }>
): Promise<{ success: boolean; data?: ServiceTicket; error?: string }> {
  try {
    const authUser = await requireRole(['Managing Director', 'Admin / BDM', 'Sales Executive', 'Office Assistant']);
    const store = getServiceTicketsStore();
    const ticket = store.find((t) => t.id === ticketId || t.ticket_number === ticketId);

    if (!ticket) {
      return { success: false, error: 'Service ticket not found' };
    }

    if (values.complaint_description !== undefined) ticket.complaint_description = values.complaint_description;
    if (values.assigned_technician_name !== undefined) ticket.assigned_technician_name = values.assigned_technician_name;
    if (values.priority !== undefined) ticket.priority = values.priority;
    if (values.status !== undefined) ticket.status = values.status;
    if (values.resolution_details !== undefined) ticket.resolution_details = values.resolution_details;

    if (await isSupabaseAvailable()) {
      try {
        const admin = createAdminClient();
        await admin
          .from('service_tickets')
          .update({
            complaint_description: ticket.complaint_description,
            assigned_technician_name: ticket.assigned_technician_name || null,
            priority: ticket.priority,
            status: ticket.status,
            resolution_details: ticket.resolution_details || null,
          })
          .or(`id.eq.${ticket.id},ticket_number.eq.${ticket.ticket_number}`);
      } catch (err) {
        console.warn('Supabase updateServiceTicket fallback:', err);
      }
    }

    await logAuditEvent({
      userName: authUser.name,
      action: 'UPDATE_SERVICE_TICKET',
      module: 'SERVICE',
      details: `Updated service ticket ${ticket.ticket_number} (Tech: ${ticket.assigned_technician_name || 'Unassigned'}, Status: ${ticket.status})`,
    });

    revalidatePath('/dashboard/service');
    revalidatePath('/dashboard');
    return { success: true, data: ticket };
  } catch (err) {
    return { success: false, error: (err as Error).message || 'Failed to update service ticket' };
  }
}

/**
 * Safely update AMC Contract operational details (SLA hours, visit counts, notes).
 */
export async function updateAMCContract(
  contractId: string,
  values: Partial<{
    annual_visits_count: number;
    sla_hours: number;
    amc_type: 'COMPREHENSIVE' | 'NON_COMPREHENSIVE';
    is_active: boolean;
  }>
): Promise<{ success: boolean; data?: AMCContract; error?: string }> {
  try {
    const authUser = await requireRole(['Managing Director', 'Admin / BDM', 'Sales Executive']);
    const store = getAMCContractsStore();
    const contract = store.find((c) => c.id === contractId || c.contract_number === contractId);

    if (!contract) {
      return { success: false, error: 'AMC Contract not found' };
    }

    if (values.annual_visits_count !== undefined) contract.annual_visits_count = Number(values.annual_visits_count) || 0;
    if (values.sla_hours !== undefined) contract.sla_hours = Number(values.sla_hours) || 0;
    if (values.amc_type !== undefined) contract.amc_type = values.amc_type;
    if (values.is_active !== undefined) contract.is_active = values.is_active;

    if (await isSupabaseAvailable()) {
      try {
        const admin = createAdminClient();
        await admin
          .from('amc_contracts')
          .update({
            annual_visits_count: contract.annual_visits_count,
            sla_hours: contract.sla_hours,
            amc_type: contract.amc_type,
            is_active: contract.is_active,
          })
          .or(`id.eq.${contract.id},contract_number.eq.${contract.contract_number}`);
      } catch (err) {
        console.warn('Supabase updateAMCContract fallback:', err);
      }
    }

    await logAuditEvent({
      userName: authUser.name,
      action: 'UPDATE_AMC_CONTRACT',
      module: 'SERVICE',
      details: `Updated AMC contract ${contract.contract_number} for ${contract.customer_name}`,
    });

    revalidatePath('/dashboard/service');
    revalidatePath('/dashboard');
    return { success: true, data: contract };
  } catch (err) {
    return { success: false, error: (err as Error).message || 'Failed to update AMC contract' };
  }
}

/**
 * Safely update Warranty Claim details (serial number, issue description, claim type).
 */
export async function updateWarrantyClaim(
  claimId: string,
  values: Partial<{
    serial_number: string;
    customer_name: string;
    product_name: string;
    issue_description: string;
    claim_type: WarrantyClaimType;
    status: WarrantyClaimStatus;
  }>
): Promise<{ success: boolean; data?: WarrantyClaim; error?: string }> {
  try {
    const authUser = await requireRole(['Managing Director', 'Admin / BDM', 'Sales Executive', 'Office Assistant']);
    const store = getWarrantyClaimsStore();
    const claim = store.find((c) => c.id === claimId || c.claim_number === claimId);

    if (!claim) {
      return { success: false, error: 'Warranty Claim not found' };
    }

    if (values.serial_number !== undefined) claim.serial_number = values.serial_number.trim();
    if (values.customer_name !== undefined) claim.customer_name = values.customer_name.trim();
    if (values.product_name !== undefined) claim.product_name = values.product_name;
    if (values.issue_description !== undefined) claim.issue_description = values.issue_description.trim();
    if (values.claim_type !== undefined) claim.claim_type = values.claim_type;
    if (values.status !== undefined) claim.status = values.status;

    if (await isSupabaseAvailable()) {
      try {
        const admin = createAdminClient();
        await admin
          .from('warranty_claims')
          .update({
            serial_number: claim.serial_number,
            customer_name: claim.customer_name,
            product_name: claim.product_name || null,
            issue_description: claim.issue_description,
            claim_type: claim.claim_type,
            status: claim.status,
          })
          .or(`id.eq.${claim.id},claim_number.eq.${claim.claim_number}`);
      } catch (err) {
        console.warn('Supabase updateWarrantyClaim fallback:', err);
      }
    }

    await logAuditEvent({
      userName: authUser.name,
      action: 'UPDATE_WARRANTY_CLAIM',
      module: 'SERVICE',
      details: `Updated warranty claim ${claim.claim_number} (Serial: ${claim.serial_number}, Status: ${claim.status})`,
    });

    revalidatePath('/dashboard/service');
    revalidatePath('/dashboard');
    return { success: true, data: claim };
  } catch (err) {
    return { success: false, error: (err as Error).message || 'Failed to update warranty claim' };
  }
}

