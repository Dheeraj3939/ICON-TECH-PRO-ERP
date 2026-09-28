// ==============================================================================
// ICON TECH PRO ERP V8 — Phase I: Service / AMC & Warranty Tests
// Validates:
//   1. AMC Contract creation & renewal logic (date progression, status update)
//   2. AMC Maintenance visit scheduling & completion tracking
//   3. Warranty Claim creation & validation with serial number linking
//   4. Warranty Claim status progression lifecycle (PENDING -> APPROVED -> IN_REPAIR -> RESOLVED)
//   5. Service Ticket lifecycle progression (Open -> Assigned -> In Progress -> Waiting for Spares -> Resolved -> Closed)
//   6. Serial Warranty Status verification engine (Active vs Expired)
// ==============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';

// --- Pure Mock Engines Matching Phase I Action Layer ---

function renewAMCContractEngine(existingContract, termMonths = 12, newSeq = '0003') {
  if (!existingContract) {
    return { success: false, error: 'AMC Contract not found' };
  }

  const updatedOriginal = {
    ...existingContract,
    renewal_status: 'RENEWED',
  };

  const oldEnd = new Date(existingContract.end_date);
  const newStart = new Date(oldEnd);
  newStart.setDate(newStart.getDate() + 1);

  const newEnd = new Date(newStart);
  newEnd.setMonth(newEnd.getMonth() + termMonths);
  newEnd.setDate(newEnd.getDate() - 1);

  const newContract = {
    id: `AMC-NEW-${Date.now()}`,
    contract_number: `ICON/26-27/AMC-${newSeq}`,
    entity_code: existingContract.entity_code,
    customer_id: existingContract.customer_id,
    customer_name: existingContract.customer_name,
    start_date: newStart.toISOString().split('T')[0],
    end_date: newEnd.toISOString().split('T')[0],
    annual_visits_count: existingContract.annual_visits_count,
    contract_value: existingContract.contract_value,
    is_active: true,
    amc_type: existingContract.amc_type || 'COMPREHENSIVE',
    sla_hours: existingContract.sla_hours || 24,
    scheduled_visits_count: existingContract.annual_visits_count,
    completed_visits_count: 0,
    renewal_status: 'ACTIVE',
    created_at: new Date().toISOString(),
  };

  return { success: true, original: updatedOriginal, renewed: newContract };
}

function updateMaintenanceVisitEngine(contract, isCompleted = false) {
  if (!contract) return { success: false, error: 'Contract not found' };

  const updated = { ...contract };
  if (isCompleted) {
    updated.completed_visits_count = (updated.completed_visits_count || 0) + 1;
  } else {
    updated.scheduled_visits_count = (updated.scheduled_visits_count || 0) + 1;
  }
  return { success: true, data: updated };
}

function createWarrantyClaimEngine(payload, seq = '0002') {
  if (!payload.serial_number || !payload.customer_name || !payload.issue_description) {
    return { success: false, error: 'serial_number, customer_name, and issue_description are required' };
  }

  const claim = {
    id: `CLM-${Date.now()}`,
    claim_number: `ICON/26-27/CLM-${seq}`,
    serial_number: payload.serial_number.trim(),
    customer_name: payload.customer_name.trim(),
    product_name: payload.product_name || 'AV Hardware',
    claim_date: new Date().toISOString().split('T')[0],
    issue_description: payload.issue_description.trim(),
    claim_type: payload.claim_type || 'REPAIR',
    status: 'PENDING',
    created_at: new Date().toISOString(),
  };

  return { success: true, data: claim };
}

function updateWarrantyClaimStatusEngine(claim, newStatus, notes) {
  if (!claim) return { success: false, error: 'Claim not found' };

  const allowedTransitions = {
    PENDING: ['APPROVED', 'REJECTED'],
    APPROVED: ['IN_REPAIR', 'REJECTED'],
    IN_REPAIR: ['RESOLVED', 'REJECTED'],
    RESOLVED: [],
    REJECTED: [],
  };

  if (!allowedTransitions[claim.status]?.includes(newStatus)) {
    return {
      success: false,
      error: `Invalid status transition from ${claim.status} to ${newStatus}`,
    };
  }

  const updated = {
    ...claim,
    status: newStatus,
    resolution_notes: notes || claim.resolution_notes,
    resolved_at: newStatus === 'RESOLVED' ? new Date().toISOString() : undefined,
  };

  return { success: true, data: updated };
}

function updateServiceTicketStatusEngine(ticket, newStatus, details) {
  if (!ticket) return { success: false, error: 'Ticket not found' };

  const validStatuses = ['Open', 'Assigned', 'In Progress', 'Waiting for Spares', 'Resolved', 'Closed'];
  if (!validStatuses.includes(newStatus)) {
    return { success: false, error: `Invalid ticket status: ${newStatus}` };
  }

  const updated = {
    ...ticket,
    status: newStatus,
    resolution_details: details || ticket.resolution_details,
  };

  return { success: true, data: updated };
}

function checkWarrantyStatusEngine(serialRecord, referenceDateStr) {
  if (!serialRecord) {
    return { success: true, isWarrantyActive: false, status: 'NOT_FOUND' };
  }

  const isActive = Boolean(
    serialRecord.warranty_end_date && serialRecord.warranty_end_date >= referenceDateStr
  );

  return {
    success: true,
    serialNumber: serialRecord.serial_number,
    isWarrantyActive: isActive,
    status: isActive ? 'ACTIVE' : 'EXPIRED',
    warrantyEndDate: serialRecord.warranty_end_date,
    provider: serialRecord.warranty_provider,
    customerName: serialRecord.customer_name,
  };
}

// --- Test Suite ---

test('Phase I.1: AMC Contract renewal correctly extends dates and transitions original to RENEWED', () => {
  const original = {
    id: 'AMC260001',
    contract_number: 'AMC260001',
    entity_code: 'ICON_TECH_PRO',
    customer_id: 'CUST-001',
    customer_name: 'Sri Sai Hospitals',
    start_date: '2026-09-01',
    end_date: '2027-08-31',
    annual_visits_count: 4,
    contract_value: 36000,
    is_active: true,
    amc_type: 'COMPREHENSIVE',
    sla_hours: 12,
  };

  const res = renewAMCContractEngine(original, 12, '0003');
  assert.equal(res.success, true);
  assert.equal(res.original.renewal_status, 'RENEWED');

  const renewed = res.renewed;
  assert.equal(renewed.contract_number, 'ICON/26-27/AMC-0003');
  assert.equal(renewed.start_date, '2027-09-01');
  assert.equal(renewed.end_date, '2028-08-31');
  assert.equal(renewed.renewal_status, 'ACTIVE');
  assert.equal(renewed.completed_visits_count, 0);
  assert.equal(renewed.annual_visits_count, 4);
});

test('Phase I.2: AMC Maintenance visit tracking records scheduled and completed visits', () => {
  const contract = {
    id: 'AMC260002',
    scheduled_visits_count: 4,
    completed_visits_count: 1,
  };

  // Schedule an additional ad-hoc visit
  const schedRes = updateMaintenanceVisitEngine(contract, false);
  assert.equal(schedRes.success, true);
  assert.equal(schedRes.data.scheduled_visits_count, 5);
  assert.equal(schedRes.data.completed_visits_count, 1);

  // Complete a visit
  const compRes = updateMaintenanceVisitEngine(schedRes.data, true);
  assert.equal(compRes.success, true);
  assert.equal(compRes.data.completed_visits_count, 2);
  assert.equal(compRes.data.scheduled_visits_count, 5);
});

test('Phase I.3: Warranty Claim creation enforces serial number and mandatory fault description', () => {
  const invalidAttempt = createWarrantyClaimEngine({
    serial_number: '',
    customer_name: 'T-Hub',
    issue_description: 'Lamp failure',
  });
  assert.equal(invalidAttempt.success, false);
  assert.match(invalidAttempt.error, /required/);

  const validAttempt = createWarrantyClaimEngine({
    serial_number: 'EP-4K-980-SN4401',
    customer_name: 'T-Hub Foundation',
    product_name: 'Epson 4K Projector',
    issue_description: 'Color prism discoloration',
    claim_type: 'REPAIR',
  });
  assert.equal(validAttempt.success, true);
  assert.equal(validAttempt.data.status, 'PENDING');
  assert.equal(validAttempt.data.claim_number, 'ICON/26-27/CLM-0002');
});

test('Phase I.4: Warranty Claim status progression enforces state transitions and attaches resolution', () => {
  const claim = {
    id: 'CLM-001',
    status: 'PENDING',
  };

  // 1. PENDING -> APPROVED
  const appRes = updateWarrantyClaimStatusEngine(claim, 'APPROVED');
  assert.equal(appRes.success, true);
  assert.equal(appRes.data.status, 'APPROVED');

  // 2. APPROVED -> IN_REPAIR
  const repairRes = updateWarrantyClaimStatusEngine(appRes.data, 'IN_REPAIR');
  assert.equal(repairRes.success, true);
  assert.equal(repairRes.data.status, 'IN_REPAIR');

  // 3. IN_REPAIR -> RESOLVED
  const resolvedRes = updateWarrantyClaimStatusEngine(
    repairRes.data,
    'RESOLVED',
    'Replaced optical block under OEM warranty'
  );
  assert.equal(resolvedRes.success, true);
  assert.equal(resolvedRes.data.status, 'RESOLVED');
  assert.ok(resolvedRes.data.resolved_at);
  assert.match(resolvedRes.data.resolution_notes, /optical block/);

  // 4. Invalid transition from RESOLVED -> IN_REPAIR
  const invalidRes = updateWarrantyClaimStatusEngine(resolvedRes.data, 'IN_REPAIR');
  assert.equal(invalidRes.success, false);
  assert.match(invalidRes.error, /Invalid status transition/);
});

test('Phase I.5: Service Ticket lifecycle progresses from Open to Closed', () => {
  const ticket = {
    id: 'SRV-001',
    ticket_number: 'ICON/26-27/SRV-0001',
    status: 'Open',
  };

  const s1 = updateServiceTicketStatusEngine(ticket, 'Assigned');
  assert.equal(s1.data.status, 'Assigned');

  const s2 = updateServiceTicketStatusEngine(s1.data, 'In Progress');
  assert.equal(s2.data.status, 'In Progress');

  const s3 = updateServiceTicketStatusEngine(s2.data, 'Waiting for Spares');
  assert.equal(s3.data.status, 'Waiting for Spares');

  const s4 = updateServiceTicketStatusEngine(s3.data, 'Resolved', 'Replaced HDMI switch port');
  assert.equal(s4.data.status, 'Resolved');
  assert.equal(s4.data.resolution_details, 'Replaced HDMI switch port');

  const s5 = updateServiceTicketStatusEngine(s4.data, 'Closed');
  assert.equal(s5.data.status, 'Closed');
});

test('Phase I.6: Serial Warranty Status checker accurately validates active vs expired coverage', () => {
  const today = '2026-09-19';

  const activeSerial = {
    serial_number: 'EP-4K-980-SN4401',
    customer_name: 'T-Hub Foundation',
    warranty_provider: 'OEM',
    warranty_end_date: '2028-04-09',
  };

  const expiredSerial = {
    serial_number: 'OLD-MIC-SN001',
    customer_name: 'Legacy Customer',
    warranty_provider: 'DISTRIBUTOR',
    warranty_end_date: '2025-12-31',
  };

  const resActive = checkWarrantyStatusEngine(activeSerial, today);
  assert.equal(resActive.isWarrantyActive, true);
  assert.equal(resActive.status, 'ACTIVE');

  const resExpired = checkWarrantyStatusEngine(expiredSerial, today);
  assert.equal(resExpired.isWarrantyActive, false);
  assert.equal(resExpired.status, 'EXPIRED');

  const resNotFound = checkWarrantyStatusEngine(null, today);
  assert.equal(resNotFound.isWarrantyActive, false);
  assert.equal(resNotFound.status, 'NOT_FOUND');
});
