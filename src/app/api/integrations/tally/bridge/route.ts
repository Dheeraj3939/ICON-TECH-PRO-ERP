import crypto from 'crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { logAuditEvent } from '@/lib/audit/logger';

function verifyBridgeSecret(request: NextRequest): { ok: boolean; status: number; error?: string } {
  const configuredSecret = process.env.TALLY_BRIDGE_SECRET?.trim();
  if (!configuredSecret || configuredSecret.length < 16) {
    return {
      ok: false,
      status: 503,
      error: 'TALLY_BRIDGE_SECRET is not configured on the ERP server.',
    };
  }

  const authHeader = request.headers.get('authorization') || '';
  const bearerToken = authHeader.toLowerCase().startsWith('bearer ')
    ? authHeader.slice(7).trim()
    : '';
  const headerToken = request.headers.get('x-tally-bridge-secret')?.trim() || '';
  const provided = bearerToken || headerToken;

  if (!provided) {
    return { ok: false, status: 401, error: 'Missing bridge authentication secret' };
  }

  const a = Buffer.from(provided, 'utf8');
  const b = Buffer.from(configuredSecret, 'utf8');
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return { ok: false, status: 401, error: 'Invalid bridge authentication secret' };
  }

  return { ok: true, status: 200 };
}

async function recordHeartbeat(
  admin: ReturnType<typeof createAdminClient>,
  payload: {
    hostname?: string;
    endpoint?: string;
    activeCompany?: string;
    tallyVersion?: string;
    lastAlterId?: number;
    ledgersCount?: number;
    vouchersCount?: number;
  }
) {
  const now = new Date().toISOString();

  // Fetch current setting to avoid clobbering telemetries on heartbeat probes
  const { data: existing } = await admin
    .from('system_settings')
    .select('setting_value')
    .eq('setting_key', 'tally_bridge_heartbeat')
    .maybeSingle();

  const prev = (existing?.setting_value || {}) as Record<string, any>;

  await admin.from('system_settings').upsert(
    {
      setting_key: 'tally_bridge_heartbeat',
      setting_value: {
        lastSeenAt: now,
        hostname: payload.hostname || prev.hostname || 'Office-Tally-Workstation',
        endpoint: payload.endpoint || prev.endpoint || 'http://localhost:9000',
        activeCompany: payload.activeCompany || prev.activeCompany || 'ICON TECH PRO - 2026-27',
        tallyVersion: payload.tallyVersion || prev.tallyVersion || 'TallyPrime 7.2',
        lastAlterId: payload.lastAlterId !== undefined ? payload.lastAlterId : prev.lastAlterId || 0,
        ledgersCount: payload.ledgersCount !== undefined ? payload.ledgersCount : prev.ledgersCount || 0,
        vouchersCount: payload.vouchersCount !== undefined ? payload.vouchersCount : prev.vouchersCount || 0,
      },
      description: 'Latest heartbeat and sync telemetry from Office Windows TallyPrime Bridge Agent',
      updated_at: now,
    },
    { onConflict: 'setting_key' }
  );
}

/**
 * GET /api/integrations/tally/bridge
 * Heartbeat probe and telemetry endpoint called by scripts/tally-bridge-agent.mjs.
 */
export async function GET(request: NextRequest) {
  const auth = verifyBridgeSecret(request);
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
  }

  try {
    const admin = createAdminClient();
    const params = request.nextUrl.searchParams;

    const [hbRes, compRes] = await Promise.all([
      admin
        .from('system_settings')
        .select('setting_value')
        .eq('setting_key', 'tally_bridge_heartbeat')
        .maybeSingle(),
      admin
        .from('tally_company_profiles')
        .select('name')
        .eq('is_active', true)
        .limit(1)
        .maybeSingle(),
    ]);

    const hbVal = (hbRes.data?.setting_value || {}) as Record<string, any>;
    const activeCompany = params.get('company') || compRes.data?.name || hbVal.activeCompany || 'ICON TECH PRO - 2026-27';

    await recordHeartbeat(admin, {
      hostname: params.get('hostname') || undefined,
      endpoint: params.get('endpoint') || undefined,
      activeCompany,
      tallyVersion: params.get('version') || undefined,
    });

    return NextResponse.json({
      ok: true,
      serverTime: new Date().toISOString(),
      activeCompany,
      knownLastAlterId: Number(hbVal.lastAlterId || 0),
    });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || 'Bridge GET failed' }, { status: 500 });
  }
}

/**
 * POST /api/integrations/tally/bridge
 * Inbound Ingestion Endpoint for TallyPrime 7.2.
 * Strictly One-Way (Tally -> ERP).
 * Receives exported companies, ledgers, and incremental vouchers from the Office Agent.
 */
export async function POST(request: NextRequest) {
  const auth = verifyBridgeSecret(request);
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
  }

  try {
    const admin = createAdminClient();
    const body = await request.json().catch(() => ({}));
    const now = new Date().toISOString();

    const hostname = body.hostname || 'Office-Tally-Workstation';
    const endpoint = body.endpoint || 'http://localhost:9000';
    const activeCompany = body.activeCompany || 'ICON TECH PRO - 2026-27';
    const tallyVersion = body.tallyVersion || 'TallyPrime 7.2';
    const lastAlterId = Number(body.lastAlterId || 0);

    // Fast return for lightweight heartbeats
    if (body.heartbeatOnly) {
      await recordHeartbeat(admin, {
        hostname,
        endpoint,
        activeCompany,
        tallyVersion,
        lastAlterId,
      });

      // Check if server administrator requested full re-sync
      const { data: resyncRow } = await admin
        .from('system_settings')
        .select('setting_value')
        .eq('setting_key', 'tally_force_resync')
        .maybeSingle();

      const shouldReset = Boolean((resyncRow?.setting_value as any)?.force_resync);
      if (shouldReset) {
        await admin
          .from('system_settings')
          .update({ setting_value: { force_resync: false, requested_at: now, cleared_at: now } })
          .eq('setting_key', 'tally_force_resync');
      }

      return NextResponse.json({
        ok: true,
        serverTime: now,
        activeCompany,
        lastAlterId,
        resetAlterId: shouldReset ? 0 : undefined,
      });
    }

    const companies = Array.isArray(body.companies) ? body.companies : [];
    const ledgers = Array.isArray(body.ledgers) ? body.ledgers : [];
    const vouchers = Array.isArray(body.vouchers) ? body.vouchers : [];

    // 1. Process Tally Companies
    if (companies.length > 0) {
      for (const comp of companies) {
        if (!comp?.name) continue;
        const compId = comp.name.replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 50);
        await admin.from('tally_company_profiles').upsert(
          {
            id: compId,
            name: comp.name,
            financial_year: comp.name.includes('2026') ? '2026-2027' : comp.name.includes('2025') ? '2025-2026' : '2024-2025',
            is_active: Boolean(comp.is_active),
            is_read_only: !Boolean(comp.is_active),
            books_from: comp.books_from || '2026-04-01',
            books_to: '2027-03-31',
            tally_guid: comp.tally_guid || null,
            updated_at: now,
          },
          { onConflict: 'id' }
        );
      }
    }

    // 2. High-Performance Bulk Processing of Tally Ledgers
    let processedLedgers = 0;
    if (ledgers.length > 0) {
      // Pre-fetch ERP customers for matching
      const { data: erpCustomers } = await admin
        .from('customers')
        .select('id, customer_name, company_name, gstin');

      // Pre-fetch existing ledger mappings in ONE query
      const ledgerNames = ledgers.map((l: any) => l.name).filter(Boolean);
      const { data: existingMaps } = await admin
        .from('tally_ledger_mappings')
        .select('id, tally_ledger_name')
        .in('tally_ledger_name', ledgerNames);

      const existingMapByName = new Map<string, string>();
      for (const m of existingMaps || []) {
        if (m.tally_ledger_name) existingMapByName.set(m.tally_ledger_name, m.id);
      }

      const toInsertMappings: any[] = [];
      const toUpdateMappings: { id: string; values: any }[] = [];
      const customerMatches: any[] = [];

      for (const ledger of ledgers) {
        if (!ledger?.name) continue;
        const parentLower = (ledger.parent || '').toLowerCase();
        let entityType: 'CUSTOMER' | 'SUPPLIER' | 'BANK' | 'TAX' | 'GENERAL' = 'GENERAL';
        if (parentLower.includes('debtor')) entityType = 'CUSTOMER';
        else if (parentLower.includes('creditor')) entityType = 'SUPPLIER';
        else if (parentLower.includes('bank') || parentLower.includes('cash')) entityType = 'BANK';
        else if (parentLower.includes('tax') || parentLower.includes('dut')) entityType = 'TAX';

        // Match with ERP customer if Sundry Debtor
        let matchedCustomer: { id: string; name: string; gstin?: string } | null = null;
        let matchConfidence = 0;
        let matchMethod = 'PROPOSED_UNLINKED';

        if (entityType === 'CUSTOMER' && Array.isArray(erpCustomers)) {
          // Exact GSTIN match
          if (ledger.gstin && ledger.gstin.trim().length >= 15) {
            const byGstin = erpCustomers.find(
              (c) => (c.gstin || '').trim().toUpperCase() === ledger.gstin.trim().toUpperCase()
            );
            if (byGstin) {
              matchedCustomer = {
                id: byGstin.id,
                name: byGstin.company_name || byGstin.customer_name,
                gstin: byGstin.gstin,
              };
              matchConfidence = 100;
              matchMethod = 'EXACT_GSTIN';
            }
          }

          // Exact or Fuzzy Name match
          if (!matchedCustomer) {
            const cleanLedgerName = ledger.name.toLowerCase().replace(/\s*\(sundry debtors\)/i, '').trim();
            const byName = erpCustomers.find((c) => {
              const comp = (c.company_name || '').toLowerCase().trim();
              const cust = (c.customer_name || '').toLowerCase().trim();
              return (
                comp === cleanLedgerName ||
                cust === cleanLedgerName ||
                comp.includes(cleanLedgerName) ||
                cleanLedgerName.includes(comp)
              );
            });
            if (byName) {
              matchedCustomer = {
                id: byName.id,
                name: byName.company_name || byName.customer_name,
                gstin: byName.gstin,
              };
              matchConfidence = 90;
              matchMethod = 'LEGAL_NAME_MATCH';
            }
          }
        }

        // Auto-create in ERP Customer Master if not found
        if (entityType === 'CUSTOMER' && !matchedCustomer) {
          const codeSuffix = Date.now().toString().slice(-4) + Math.floor(Math.random() * 100).toString().padStart(2, '0');
          const cleanName = ledger.name.replace(/\s*\(sundry debtors\)/i, '').trim();
          const { data: newCust } = await admin
            .from('customers')
            .insert({
              customer_code: `ICON${codeSuffix}`,
              customer_type: 'COMPANY',
              customer_name: cleanName,
              company_name: cleanName,
              gstin: ledger.gstin || null,
              state: ledger.state || 'Telangana',
              phone: ledger.phone || '9999999999',
              email: ledger.email || null,
              enquiry_source: 'Tally Prime Master',
              status: 'ACTIVE',
            })
            .select('id, customer_name, company_name, gstin')
            .maybeSingle();

          if (newCust) {
            matchedCustomer = {
              id: newCust.id,
              name: newCust.company_name || newCust.customer_name,
              gstin: newCust.gstin,
            };
            matchConfidence = 100;
            matchMethod = 'TALLY_AUTO_IMPORT';
          }
        }

        const existingId = existingMapByName.get(ledger.name);
        if (existingId) {
          toUpdateMappings.push({
            id: existingId,
            values: {
              erp_id: matchedCustomer?.id || ledger.name,
              erp_name: matchedCustomer?.name || ledger.name,
              entity_type: entityType,
              tally_group: ledger.parent || 'General',
              is_verified: Boolean(matchedCustomer),
              updated_at: now,
            },
          });
        } else {
          toInsertMappings.push({
            erp_id: matchedCustomer?.id || ledger.name,
            erp_name: matchedCustomer?.name || ledger.name,
            entity_type: entityType,
            tally_ledger_name: ledger.name,
            tally_group: ledger.parent || 'General',
            is_verified: Boolean(matchedCustomer),
          });
        }

        // Customer Ledger Matching Queue
        if (entityType === 'CUSTOMER') {
          const matchId = `MATCH_${ledger.name.replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 40)}`;
          customerMatches.push({
            id: matchId,
            erp_customer_id: matchedCustomer?.id || 'UNLINKED',
            erp_customer_name: matchedCustomer?.name || ledger.name,
            erp_gstin: matchedCustomer?.gstin || ledger.gstin || null,
            tally_ledger_name: ledger.name,
            tally_parent_group: ledger.parent || 'Sundry Debtors',
            match_confidence_pct: matchConfidence,
            match_method: matchMethod,
            verification_status: matchedCustomer ? 'VERIFIED_EXACT' : 'PENDING_REVIEW',
            reconciled_by: matchedCustomer ? 'Tally Inbound Auto-Bridge' : null,
            reconciled_at: matchedCustomer ? now : null,
          });
        }

        processedLedgers += 1;
      }

      // Execute bulk DB operations
      if (toInsertMappings.length > 0) {
        await admin.from('tally_ledger_mappings').insert(toInsertMappings);
      }
      if (toUpdateMappings.length > 0) {
        // Parallel batch updates in groups of 20
        for (let i = 0; i < toUpdateMappings.length; i += 20) {
          const slice = toUpdateMappings.slice(i, i + 20);
          await Promise.all(
            slice.map((u) => admin.from('tally_ledger_mappings').update(u.values).eq('id', u.id))
          );
        }
      }
      if (customerMatches.length > 0) {
        await admin
          .from('tally_customer_ledger_matches')
          .upsert(customerMatches, { onConflict: 'id' });
      }
    }

    // 3. High-Performance Processing of Tally Incremental Vouchers
    let processedVouchers = 0;
    if (vouchers.length > 0) {
      // Pre-fetch existing invoices for all vouchers in this chunk
      const vchNumbers = vouchers.map((v: any) => v.voucherNumber).filter(Boolean);
      const { data: existingInvs } = await admin
        .from('invoices')
        .select('id, invoice_number, grand_total, paid_amount, invoice_date, customer_id, customer_name, company_name')
        .in('invoice_number', vchNumbers);

      const existingInvByNumber = new Map<string, any>();
      for (const inv of existingInvs || []) {
        if (inv.invoice_number) existingInvByNumber.set(inv.invoice_number, inv);
      }

      // Pre-fetch existing referenced invoices for receipts
      const refNumbers: string[] = [];
      for (const v of vouchers) {
        for (const entry of v.ledgerEntries || []) {
          for (const alloc of entry.billAllocations || []) {
            if (alloc.name) refNumbers.push(alloc.name);
          }
        }
      }
      const { data: refInvs } = refNumbers.length > 0
        ? await admin
            .from('invoices')
            .select('id, invoice_number, grand_total, paid_amount, customer_id, customer_name, company_name')
            .in('invoice_number', refNumbers)
        : { data: [] };

      const refInvByNumber = new Map<string, any>();
      for (const inv of refInvs || []) {
        if (inv.invoice_number) refInvByNumber.set(inv.invoice_number, inv);
      }

      for (const voucher of vouchers) {
        if (!voucher?.voucherNumber) continue;
        const vchType = (voucher.voucherType || '').toLowerCase();
        const isReceipt = vchType === 'receipt' || vchType.includes('receipt');
        const isSales =
          !isReceipt &&
          (vchType === 'sales' ||
            vchType.includes('sales') ||
            vchType.includes('icon') ||
            vchType.includes('tax invoice') ||
            vchType.includes('invoice') ||
            vchType.includes('sale'));

        // 3A. Sales Invoices generated in Tally
        if (isSales) {
          const existingInv = existingInvByNumber.get(voucher.voucherNumber);

          if (existingInv) {
            // Already in ERP, record reconciliation match
            await admin.from('tally_reconciliations').insert({
              entity_type: 'INVOICE',
              erp_id: existingInv.id,
              erp_number: existingInv.invoice_number,
              erp_amount: existingInv.grand_total,
              erp_date: existingInv.invoice_date,
              tally_guid: voucher.guid || null,
              tally_voucher_number: voucher.voucherNumber,
              tally_amount: voucher.amount,
              tally_date: voucher.date || existingInv.invoice_date,
              recon_status: Math.abs(Number(existingInv.grand_total) - voucher.amount) < 1 ? 'MATCHED' : 'VALUE_MISMATCH',
              difference_amount: Number(existingInv.grand_total) - voucher.amount,
              notes: `Sales voucher confirmed from Tally (${voucher.narration || 'No narration'})`,
              last_checked_at: now,
            });
          } else {
            // Invoice created in Tally first; find or auto-create Customer in ERP
            const cleanParty = (voucher.partyName || '').replace(/[,%()]/g, ' ').trim();
            let customerMatch: any = null;
            if (cleanParty) {
              const { data: matched } = await admin
                .from('customers')
                .select('id, customer_name, company_name, gstin')
                .or(`company_name.ilike.%${cleanParty}%,customer_name.ilike.%${cleanParty}%`)
                .limit(1)
                .maybeSingle();
              customerMatch = matched;
            }

            if (!customerMatch && voucher.partyName) {
              const codeNum = Date.now().toString().slice(-4) + Math.floor(Math.random() * 100);
              const { data: newCust } = await admin
                .from('customers')
                .insert({
                  customer_code: `CUST${codeNum}`,
                  customer_type: 'COMPANY',
                  customer_name: voucher.partyName,
                  company_name: voucher.partyName,
                  gstin: voucher.partyGstin || null,
                  enquiry_source: 'Tally Prime Master',
                  status: 'ACTIVE',
                })
                .select('id, customer_name, company_name, gstin')
                .maybeSingle();
              customerMatch = newCust;
            }

            if (customerMatch) {
              const subtotal = Math.round((voucher.amount / 1.18) * 100) / 100;
              const gst = Math.round((voucher.amount - subtotal) * 100) / 100;
              const { data: createdInv } = await admin
                .from('invoices')
                .insert({
                  invoice_number: voucher.voucherNumber,
                  invoice_type: 'TAX_INVOICE',
                  entity_code: 'ICON_TECH_PRO',
                  customer_id: customerMatch.id,
                  customer_name: customerMatch.customer_name,
                  company_name: customerMatch.company_name,
                  gstin: voucher.partyGstin || customerMatch.gstin || '',
                  invoice_date: voucher.date || now.slice(0, 10),
                  due_date: voucher.date || now.slice(0, 10),
                  subtotal,
                  cgst_amount: gst / 2,
                  sgst_amount: gst / 2,
                  igst_amount: 0,
                  gst_amount: gst,
                  grand_total: voucher.amount,
                  paid_amount: 0,
                  status: 'Unpaid',
                  created_by_name: 'Tally Inbound Sync',
                })
                .select('id')
                .single();

              if (createdInv) {
                await admin.from('invoice_items').insert({
                  invoice_id: createdInv.id,
                  description: voucher.narration || `Sales Invoice from Tally (${voucher.voucherType || 'Tax Invoice'} #${voucher.voucherNumber})`,
                  hsn_code: '85286900',
                  quantity: 1,
                  unit: 'Nos.',
                  rate: subtotal,
                  gst_rate: 18.0,
                  gst_amount: gst,
                  total_amount: voucher.amount,
                });

                await admin.from('tally_reconciliations').insert({
                  entity_type: 'INVOICE',
                  erp_id: createdInv.id,
                  erp_number: voucher.voucherNumber,
                  erp_amount: voucher.amount,
                  erp_date: voucher.date || now.slice(0, 10),
                  tally_guid: voucher.guid || null,
                  tally_voucher_number: voucher.voucherNumber,
                  tally_amount: voucher.amount,
                  tally_date: voucher.date || now.slice(0, 10),
                  recon_status: 'MATCHED',
                  difference_amount: 0,
                  notes: `Auto-ingested Tally sales invoice (${voucher.voucherType})`,
                  last_checked_at: now,
                });
              }
            }
          }
          processedVouchers += 1;
        }

        // 3B. Customer Bank Receipts (Crucial for Automatic Settlement & Outstanding Clearance!)
        else if (vchType === 'receipt') {
          const ledgerEntries = Array.isArray(voucher.ledgerEntries) ? voucher.ledgerEntries : [];
          let hasSettledBill = false;

          for (const entry of ledgerEntries) {
            const billAllocations = Array.isArray(entry.billAllocations) ? entry.billAllocations : [];
            for (const alloc of billAllocations) {
              const billType = (alloc.billType || '').toLowerCase();
              if (billType.includes('agst') || billType.includes('ref')) {
                // Find matching invoice from pre-fetched map
                const matchedInv = refInvByNumber.get(alloc.name);

                if (matchedInv) {
                  hasSettledBill = true;
                  const payAmount = Number(alloc.amount || voucher.amount);

                  // 1. Record Payment in payments table
                  await admin.from('payments').upsert(
                    {
                      payment_number: voucher.voucherNumber,
                      invoice_id: matchedInv.id,
                      invoice_number: matchedInv.invoice_number,
                      customer_id: matchedInv.customer_id,
                      customer_name: matchedInv.customer_name,
                      company_name: matchedInv.company_name,
                      payment_date: voucher.date || now.slice(0, 10),
                      amount: payAmount,
                      mode: 'Bank Transfer',
                      reference_number: voucher.reference || voucher.narration || voucher.voucherNumber,
                      bank_name: entry.ledgerName || 'Bank Account',
                      recorded_by_name: 'Tally Inbound Sync',
                      notes: `Auto-settled from Tally Receipt ${voucher.voucherNumber} (${alloc.billType})`,
                    },
                    { onConflict: 'payment_number' }
                  );

                  // 2. Update Invoice Paid Amount and Status
                  const currentPaid = Number(matchedInv.paid_amount || 0);
                  const updatedPaid = currentPaid + payAmount;
                  const updatedStatus = updatedPaid >= Number(matchedInv.grand_total) ? 'Paid' : 'Partially Paid';

                  await admin
                    .from('invoices')
                    .update({
                      paid_amount: updatedPaid,
                      status: updatedStatus,
                    })
                    .eq('id', matchedInv.id);

                  // 3. Mark in Tally Reconciliations
                  await admin.from('tally_reconciliations').insert({
                    entity_type: 'PAYMENT',
                    erp_id: matchedInv.id,
                    erp_number: matchedInv.invoice_number,
                    erp_amount: matchedInv.grand_total,
                    erp_date: voucher.date || now.slice(0, 10),
                    tally_guid: voucher.guid || null,
                    tally_voucher_number: voucher.voucherNumber,
                    tally_amount: payAmount,
                    tally_date: voucher.date || now.slice(0, 10),
                    recon_status: 'MATCHED',
                    difference_amount: 0,
                    notes: `Receipt allocated to Invoice ${matchedInv.invoice_number}`,
                    last_checked_at: now,
                  });
                }
              }
            }
          }

          // If payment was not allocated to a specific invoice, register in unallocated receipts
          if (!hasSettledBill) {
            const bankLedger = ledgerEntries.find((e: any) => !e.isDeemedPositive)?.ledgerName || 'Bank Account';
            await admin.from('tally_unallocated_receipts').upsert(
              {
                id: voucher.guid || `RCPT_${voucher.voucherNumber}`,
                receipt_voucher_no: voucher.voucherNumber,
                receipt_date: voucher.date || now.slice(0, 10),
                bank_account_ledger: bankLedger,
                customer_name: voucher.partyName || 'Customer',
                customer_gstin: voucher.partyGstin || null,
                receipt_total_amount: voucher.amount,
                unallocated_balance: voucher.amount,
                tally_reference_type: 'On Account',
                suggested_invoices: [],
                updated_at: now,
              },
              { onConflict: 'id' }
            );
          }

          // In addition, register directly in payments table for Customer 360 & Ledger View
          let payCustId: string | null = null;
          let payCustName = voucher.partyName || 'Customer';
          if (voucher.partyName) {
            const { data: cMatch } = await admin
              .from('customers')
              .select('id, customer_name, company_name')
              .or(`company_name.ilike.%${voucher.partyName}%,customer_name.ilike.%${voucher.partyName}%`)
              .limit(1)
              .maybeSingle();
            if (cMatch) {
              payCustId = cMatch.id;
              payCustName = cMatch.company_name || cMatch.customer_name;
            }
          }

          const payNumber = `RCPT-${voucher.voucherNumber}-${(voucher.guid || Date.now().toString()).slice(-6)}`;
          await admin.from('payments').upsert(
            {
              payment_number: payNumber,
              customer_id: payCustId,
              customer_name: payCustName,
              company_name: payCustName,
              payment_date: voucher.date || now.slice(0, 10),
              amount: voucher.amount,
              mode: 'Bank Transfer',
              bank_name: (ledgerEntries[0] as any)?.ledgerName || 'Bank Account',
              reference_number: voucher.reference || `Tally Receipt #${voucher.voucherNumber}`,
              recorded_by_name: 'Tally Inbound Sync',
              notes: `Tally Inbound Receipt #${voucher.voucherNumber} (${voucher.narration || ''})`,
            },
            { onConflict: 'payment_number' }
          );

          processedVouchers += 1;
        }

        // 3C. Purchases, Supplier Payments, Debit/Credit Notes
        else {
          await admin.from('tally_reconciliations').insert({
            entity_type: vchType.includes('purchase') ? 'PURCHASE_INVOICE' : 'PAYMENT',
            erp_id: voucher.guid || `VCH_${voucher.voucherNumber}`,
            erp_number: voucher.voucherNumber,
            erp_amount: voucher.amount,
            erp_date: voucher.date || now.slice(0, 10),
            tally_guid: voucher.guid || null,
            tally_voucher_number: voucher.voucherNumber,
            tally_amount: voucher.amount,
            tally_date: voucher.date || now.slice(0, 10),
            recon_status: 'MATCHED',
            notes: `${voucher.voucherType} voucher from TallyPrime`,
            last_checked_at: now,
          });
          processedVouchers += 1;
        }
      }
    }

    // 4. Record Heartbeat & Telemetry
    await recordHeartbeat(admin, {
      hostname,
      endpoint,
      activeCompany,
      tallyVersion,
      lastAlterId,
      ledgersCount: processedLedgers,
      vouchersCount: processedVouchers,
    });

    // 5. Enterprise Non-Repudiation Audit Log
    if (processedLedgers > 0 || processedVouchers > 0) {
      await logAuditEvent({
        userName: `Tally Inbound Bridge (${hostname})`,
        action: 'TALLY_INBOUND_SYNC',
        module: 'INTEGRATIONS',
        details: `One-way sync completed: Ingested ${processedLedgers} ledgers and ${processedVouchers} vouchers from ${activeCompany} (AlterID: ${lastAlterId})`,
      });
    }

    return NextResponse.json({
      ok: true,
      serverTime: now,
      activeCompany,
      processedLedgers,
      processedVouchers,
      lastAlterId,
    });
  } catch (err: any) {
    console.error('[TallyBridge] Inbound ingestion error:', err);
    return NextResponse.json(
      { ok: false, error: err?.message || 'Bridge Ingestion POST failed' },
      { status: 500 }
    );
  }
}
