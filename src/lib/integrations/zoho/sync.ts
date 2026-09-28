import crypto from 'crypto';
import { isSupabaseAvailable } from '@/lib/supabase/health';
import { createAdminClient } from '@/lib/supabase/admin';
import { getZohoCrmClient } from '@/lib/integrations/zoho/client';
import {
  mapZohoLeadToErpCustomer,
  mapZohoLeadToErpEnquiry,
  mapZohoContactToErpCustomer,
  mapZohoAccountToErpCustomer,
  computePayloadHash,
} from '@/lib/integrations/zoho/mapper';
import { findDuplicateCustomer } from '@/lib/integrations/zoho/dedup';
import { getNextCustomerCode, getNextEnquiryNumber } from '@/lib/utils/sequence';
import { logAuditEvent } from '@/lib/audit/logger';
import type { Customer } from '@/types/customer';
import type { Enquiry } from '@/types/erp';
import type {
  ZohoModuleType,
  ZohoSyncOptions,
  ZohoSyncResult,
  ZohoModuleSyncStats,
  ZohoSyncHistoryItem,
} from '@/types/zoho';

// Resilient in-memory store for sync history (supplements database)
declare global {
  // eslint-disable-next-line no-var
  var __ICON_ZOHO_SYNC_LOGS__: ZohoSyncHistoryItem[] | undefined;
  // eslint-disable-next-line no-var
  var __ICON_CUSTOMERS__: Customer[] | undefined;
  // eslint-disable-next-line no-var
  var __ICON_ENQUIRIES__: Enquiry[] | undefined;
}

function getLocalSyncLogs(): ZohoSyncHistoryItem[] {
  if (!globalThis.__ICON_ZOHO_SYNC_LOGS__) {
    globalThis.__ICON_ZOHO_SYNC_LOGS__ = [];
  }
  return globalThis.__ICON_ZOHO_SYNC_LOGS__;
}

function pushLocalSyncLog(item: ZohoSyncHistoryItem): void {
  const logs = getLocalSyncLogs();
  logs.unshift(item);
  if (logs.length > 50) logs.pop();
}

/**
 * Execute controlled inbound synchronization from Zoho CRM to ICON TECH PRO ERP.
 */
export async function executeZohoSync(
  options: ZohoSyncOptions = {},
  actor: { id: string; name: string }
): Promise<ZohoSyncResult> {
  const startTime = Date.now();
  const startedAt = new Date().toISOString();
  const syncLogId = `SYNC-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;

  const client = getZohoCrmClient();
  const modulesToSync: ZohoModuleType[] =
    options.modules && options.modules.length > 0
      ? options.modules
      : ['Accounts', 'Contacts', 'Leads', 'Deals'];

  const moduleResults: Partial<Record<ZohoModuleType, ZohoModuleSyncStats>> = {};

  let totalRead = 0;
  let totalCreated = 0;
  let totalUpdated = 0;
  let totalSkipped = 0;
  let totalFailed = 0;

  const isOnline = await isSupabaseAvailable();

  // Create initial PENDING record in sync logs
  const pendingHistoryItem: ZohoSyncHistoryItem = {
    id: syncLogId,
    provider: 'zoho_crm',
    sync_type: options.dryRun ? 'dry_run' : 'manual',
    status: 'PENDING',
    records_read: 0,
    records_created: 0,
    records_updated: 0,
    records_skipped: 0,
    records_failed: 0,
    modules_synced: modulesToSync,
    triggered_by_name: actor.name,
    started_at: startedAt,
    created_at: startedAt,
  };
  pushLocalSyncLog(pendingHistoryItem);

  try {
    // ------------------------------------------------------------------------
    // Process 1: ACCOUNTS (Organizations / Companies)
    // ------------------------------------------------------------------------
    if (modulesToSync.includes('Accounts')) {
      const stats: ZohoModuleSyncStats = { read: 0, created: 0, updated: 0, skipped: 0, failed: 0, errors: [] };
      moduleResults.Accounts = stats;

      const accRes = await client.getAccounts({ per_page: options.maxRecordsPerModule || 50 });
      if (accRes.scopeRestricted) {
        stats.errors.push('Account sync skipped: ZohoCRM.modules.accounts.READ scope not granted yet.');
      } else if (accRes.data) {
        stats.read = accRes.data.length;
        totalRead += stats.read;

        for (const account of accRes.data) {
          try {
            const payloadHash = computePayloadHash(account);
            const dedup = await findDuplicateCustomer({
              externalModule: 'Accounts',
              externalId: account.id,
              companyName: account.Account_Name,
              phone: account.Phone,
            });

            if (dedup.requiresHumanReview) {
              stats.skipped++;
              totalSkipped++;
              stats.errors.push(`Account ${account.id} ("${account.Account_Name}"): ${dedup.reviewReason || 'Ambiguous match routed to human-review queue.'}`);
            } else if (dedup.matched) {
              if (dedup.matchType === 'EXTERNAL_ID') {
                stats.skipped++;
                totalSkipped++;
              } else {
                stats.updated++;
                totalUpdated++;
              }
              if (!options.dryRun && isOnline && dedup.existingCustomerId) {
                await upsertEntityMapping({
                  externalModule: 'Accounts',
                  externalId: account.id,
                  erpEntity: 'customers',
                  erpId: dedup.existingCustomerId,
                  payloadHash,
                  metadata: { account_name: account.Account_Name },
                });
              }
            } else {
              // Prospect / New Account
              if (!options.dryRun) {
                const mapped = mapZohoAccountToErpCustomer(account);
                const customerCode = await getNextCustomerCode();
                const newCustomerId = `CUST-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

                const newCustomer: Customer = {
                  id: newCustomerId,
                  customer_code: customerCode,
                  customer_type: 'COMPANY',
                  customer_name: mapped.customer_name || account.Account_Name,
                  company_name: account.Account_Name,
                  contact_person: null,
                  designation: null,
                  phone: mapped.phone || '9999999999',
                  alternate_phone: null,
                  email: null,
                  billing_address: mapped.billing_address || null,
                  shipping_address: mapped.shipping_address || null,
                  city: mapped.city || 'Hyderabad',
                  state: mapped.state || 'Telangana',
                  state_code: '36',
                  pincode: mapped.pincode || null,
                  gstin: null,
                  pan: null,
                  credit_limit: 0,
                  enquiry_source: mapped.enquiry_source || 'OTHER',
                  salesperson_id: null,
                  status: 'ACTIVE',
                  notes: mapped.notes || null,
                  created_by: actor.id,
                  updated_by: null,
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                };

                // Insert into Supabase if online
                if (isOnline) {
                  const admin = createAdminClient();
                  await admin.from('customers').insert({
                    customer_code: customerCode,
                    customer_type: newCustomer.customer_type,
                    customer_name: newCustomer.customer_name,
                    company_name: newCustomer.company_name,
                    phone: newCustomer.phone,
                    billing_address: newCustomer.billing_address,
                    city: newCustomer.city,
                    state: newCustomer.state,
                    state_code: newCustomer.state_code,
                    pincode: newCustomer.pincode,
                    enquiry_source: newCustomer.enquiry_source,
                    status: newCustomer.status,
                    notes: newCustomer.notes,
                  });
                }

                // Add to local memory store
                if (!globalThis.__ICON_CUSTOMERS__) globalThis.__ICON_CUSTOMERS__ = [];
                globalThis.__ICON_CUSTOMERS__.unshift(newCustomer);

                // Record Mapping
                if (isOnline) {
                  await upsertEntityMapping({
                    externalModule: 'Accounts',
                    externalId: account.id,
                    erpEntity: 'customers',
                    erpId: newCustomerId,
                    payloadHash,
                    metadata: { account_name: account.Account_Name },
                  });
                }
              }

              stats.created++;
              totalCreated++;
            }
          } catch (err: any) {
            stats.failed++;
            totalFailed++;
            stats.errors.push(`Account ${account.id}: ${err.message}`);
          }
        }
      }
    }

    // ------------------------------------------------------------------------
    // Process 2: CONTACTS (Individuals & Account Representatives)
    // ------------------------------------------------------------------------
    if (modulesToSync.includes('Contacts')) {
      const stats: ZohoModuleSyncStats = { read: 0, created: 0, updated: 0, skipped: 0, failed: 0, errors: [] };
      moduleResults.Contacts = stats;

      const contRes = await client.getContacts({ per_page: options.maxRecordsPerModule || 50 });
      if (contRes.scopeRestricted) {
        stats.errors.push('Contact sync skipped: ZohoCRM.modules.contacts.READ scope not granted yet.');
      } else if (contRes.data) {
        stats.read = contRes.data.length;
        totalRead += stats.read;

        for (const contact of contRes.data) {
          try {
            const payloadHash = computePayloadHash(contact);
            const dedup = await findDuplicateCustomer({
              externalModule: 'Contacts',
              externalId: contact.id,
              email: contact.Email,
              phone: contact.Phone || contact.Mobile,
              companyName: contact.Account_Name?.name,
            });

            if (dedup.requiresHumanReview) {
              stats.skipped++;
              totalSkipped++;
              stats.errors.push(`Contact ${contact.id} ("${contact.Email || contact.Last_Name}"): ${dedup.reviewReason || 'Ambiguous match routed to human-review queue.'}`);
            } else if (dedup.matched) {
              if (dedup.matchType === 'EXTERNAL_ID') {
                stats.skipped++;
                totalSkipped++;
              } else {
                stats.updated++;
                totalUpdated++;
              }
              if (!options.dryRun && isOnline && dedup.existingCustomerId) {
                await upsertEntityMapping({
                  externalModule: 'Contacts',
                  externalId: contact.id,
                  erpEntity: 'customers',
                  erpId: dedup.existingCustomerId,
                  payloadHash,
                  metadata: { contact_email: contact.Email },
                });
              }
            } else {
              if (!options.dryRun) {
                const mapped = mapZohoContactToErpCustomer(contact);
                const customerCode = await getNextCustomerCode();
                const newCustomerId = `CUST-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

                const newCustomer: Customer = {
                  id: newCustomerId,
                  customer_code: customerCode,
                  customer_type: mapped.customer_type || 'INDIVIDUAL',
                  customer_name: mapped.customer_name || 'Valued Contact',
                  company_name: mapped.company_name || null,
                  contact_person: mapped.contact_person || null,
                  designation: mapped.designation || null,
                  email: mapped.email || null,
                  phone: mapped.phone || '9999999999',
                  alternate_phone: mapped.alternate_phone || null,
                  billing_address: mapped.billing_address || null,
                  shipping_address: mapped.shipping_address || null,
                  city: mapped.city || 'Hyderabad',
                  state: mapped.state || 'Telangana',
                  state_code: '36',
                  pincode: mapped.pincode || null,
                  gstin: null,
                  pan: null,
                  credit_limit: 0,
                  enquiry_source: mapped.enquiry_source || 'OTHER',
                  salesperson_id: null,
                  status: 'ACTIVE',
                  notes: mapped.notes || null,
                  created_by: actor.id,
                  updated_by: null,
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                };

                if (isOnline) {
                  const admin = createAdminClient();
                  await admin.from('customers').insert({
                    customer_code: customerCode,
                    customer_type: newCustomer.customer_type,
                    customer_name: newCustomer.customer_name,
                    company_name: newCustomer.company_name,
                    contact_person: newCustomer.contact_person,
                    designation: newCustomer.designation,
                    email: newCustomer.email,
                    phone: newCustomer.phone,
                    billing_address: newCustomer.billing_address,
                    city: newCustomer.city,
                    state: newCustomer.state,
                    state_code: newCustomer.state_code,
                    pincode: newCustomer.pincode,
                    enquiry_source: newCustomer.enquiry_source,
                    status: newCustomer.status,
                    notes: newCustomer.notes,
                  });
                }

                if (!globalThis.__ICON_CUSTOMERS__) globalThis.__ICON_CUSTOMERS__ = [];
                globalThis.__ICON_CUSTOMERS__.unshift(newCustomer);

                if (isOnline) {
                  await upsertEntityMapping({
                    externalModule: 'Contacts',
                    externalId: contact.id,
                    erpEntity: 'customers',
                    erpId: newCustomerId,
                    payloadHash,
                    metadata: { contact_email: contact.Email },
                  });
                }
              }

              stats.created++;
              totalCreated++;
            }
          } catch (err: any) {
            stats.failed++;
            totalFailed++;
            stats.errors.push(`Contact ${contact.id}: ${err.message}`);
          }
        }
      }
    }

    // ------------------------------------------------------------------------
    // Process 3: LEADS (Prospective Pipeline & Inquiries)
    // ------------------------------------------------------------------------
    if (modulesToSync.includes('Leads')) {
      const stats: ZohoModuleSyncStats = { read: 0, created: 0, updated: 0, skipped: 0, failed: 0, errors: [] };
      moduleResults.Leads = stats;

      const leadsRes = await client.getLeads({ per_page: options.maxRecordsPerModule || 50 });
      if (leadsRes.scopeRestricted) {
        stats.errors.push('Lead sync skipped: ZohoCRM.modules.leads.READ scope not granted yet.');
      } else if (leadsRes.data) {
        stats.read = leadsRes.data.length;
        totalRead += stats.read;

        for (const lead of leadsRes.data) {
          try {
            const payloadHash = computePayloadHash(lead);
            const dedup = await findDuplicateCustomer({
              externalModule: 'Leads',
              externalId: lead.id,
              email: lead.Email,
              phone: lead.Phone || lead.Mobile,
              companyName: lead.Company,
            });

            let targetCustomerId: string;

            if (dedup.requiresHumanReview) {
              stats.errors.push(`Lead ${lead.id} ("${lead.Company}"): ${dedup.reviewReason || 'Ambiguous company match routed to human-review queue.'}`);
            }

            if (dedup.matched && !dedup.requiresHumanReview && dedup.existingCustomerId) {
              targetCustomerId = dedup.existingCustomerId;
              if (dedup.matchType === 'EXTERNAL_ID') {
                stats.skipped++;
                totalSkipped++;
              } else {
                stats.updated++;
                totalUpdated++;
              }
            } else {
              // Create prospect customer
              targetCustomerId = `CUST-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
              if (!options.dryRun) {
                const mappedCust = mapZohoLeadToErpCustomer(lead);
                const customerCode = await getNextCustomerCode();

                const newCustomer: Customer = {
                  id: targetCustomerId,
                  customer_code: customerCode,
                  customer_type: mappedCust.customer_type || 'COMPANY',
                  customer_name: mappedCust.customer_name || 'Prospect',
                  company_name: mappedCust.company_name || null,
                  contact_person: mappedCust.contact_person || null,
                  designation: mappedCust.designation || null,
                  email: mappedCust.email || null,
                  phone: mappedCust.phone || '9999999999',
                  alternate_phone: mappedCust.alternate_phone || null,
                  billing_address: mappedCust.billing_address || null,
                  shipping_address: mappedCust.shipping_address || null,
                  city: mappedCust.city || 'Hyderabad',
                  state: mappedCust.state || 'Telangana',
                  state_code: '36',
                  pincode: mappedCust.pincode || null,
                  gstin: null,
                  pan: null,
                  credit_limit: 0,
                  enquiry_source: mappedCust.enquiry_source || 'DIRECT',
                  salesperson_id: null,
                  status: 'ACTIVE',
                  notes: mappedCust.notes || null,
                  created_by: actor.id,
                  updated_by: null,
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                };

                if (isOnline) {
                  const admin = createAdminClient();
                  await admin.from('customers').insert({
                    customer_code: customerCode,
                    customer_type: newCustomer.customer_type,
                    customer_name: newCustomer.customer_name,
                    company_name: newCustomer.company_name,
                    contact_person: newCustomer.contact_person,
                    designation: newCustomer.designation,
                    email: newCustomer.email,
                    phone: newCustomer.phone,
                    billing_address: newCustomer.billing_address,
                    city: newCustomer.city,
                    state: newCustomer.state,
                    state_code: newCustomer.state_code,
                    pincode: newCustomer.pincode,
                    enquiry_source: newCustomer.enquiry_source,
                    status: newCustomer.status,
                    notes: newCustomer.notes,
                  });
                }

                if (!globalThis.__ICON_CUSTOMERS__) globalThis.__ICON_CUSTOMERS__ = [];
                globalThis.__ICON_CUSTOMERS__.unshift(newCustomer);
              }

              stats.created++;
              totalCreated++;
            }

            // Create linked ERP Enquiry for this lead
            if (!options.dryRun) {
              const mappedEnq = mapZohoLeadToErpEnquiry(lead, targetCustomerId);
              const enqNum = await getNextEnquiryNumber();
              const enqId = `ENQ-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

              const newEnquiry: Enquiry = {
                id: enqId,
                enquiry_number: enqNum,
                customer_id: targetCustomerId,
                customer_name: mappedEnq.customer_name || 'Prospect',
                company_name: mappedEnq.company_name || undefined,
                customer_type: (mappedEnq.customer_type as any) || 'COMPANY',
                phone: mappedEnq.phone || '9999999999',
                email: mappedEnq.email || undefined,
                salesperson_name: mappedEnq.salesperson_name || 'Managing Director',
                product_category: mappedEnq.product_category || 'Security Systems',
                requirement_summary: mappedEnq.requirement_summary || 'Inbound Zoho Lead',
                estimated_budget: 0,
                source: (mappedEnq.source as any) || 'Website',
                status: 'Enquiry',
                site_visit_required: false,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              };

              if (isOnline) {
                const admin = createAdminClient();
                await admin.from('enquiries').insert({
                  enquiry_number: enqNum,
                  customer_id: targetCustomerId,
                  customer_name: newEnquiry.customer_name,
                  company_name: newEnquiry.company_name,
                  customer_type: newEnquiry.customer_type,
                  phone: newEnquiry.phone,
                  email: newEnquiry.email,
                  salesperson_name: newEnquiry.salesperson_name,
                  product_category: newEnquiry.product_category,
                  requirement_summary: newEnquiry.requirement_summary,
                  estimated_budget: newEnquiry.estimated_budget,
                  source: newEnquiry.source,
                  status: newEnquiry.status,
                  site_visit_required: newEnquiry.site_visit_required,
                });
              }

              if (!globalThis.__ICON_ENQUIRIES__) globalThis.__ICON_ENQUIRIES__ = [];
              globalThis.__ICON_ENQUIRIES__.unshift(newEnquiry);

              if (isOnline) {
                await upsertEntityMapping({
                  externalModule: 'Leads',
                  externalId: lead.id,
                  erpEntity: 'enquiries',
                  erpId: enqId,
                  payloadHash,
                  metadata: { lead_status: lead.Lead_Status, customer_id: targetCustomerId },
                });
              }
            }
          } catch (err: any) {
            stats.failed++;
            totalFailed++;
            stats.errors.push(`Lead ${lead.id}: ${err.message}`);
          }
        }
      }
    }

    // ------------------------------------------------------------------------
    // Process 4: DEALS (Opportunities & Pipeline)
    // ------------------------------------------------------------------------
    if (modulesToSync.includes('Deals')) {
      const stats: ZohoModuleSyncStats = { read: 0, created: 0, updated: 0, skipped: 0, failed: 0, errors: [] };
      moduleResults.Deals = stats;

      const dealsRes = await client.getDeals({ per_page: options.maxRecordsPerModule || 50 });
      if (dealsRes.scopeRestricted) {
        stats.errors.push('Deal sync skipped: ZohoCRM.modules.deals.READ scope not granted yet.');
      } else if (dealsRes.data) {
        stats.read = dealsRes.data.length;
        totalRead += stats.read;

        for (const deal of dealsRes.data) {
          try {
            const payloadHash = computePayloadHash(deal);
            // Deals create an Opportunity enquiry linked to matched account
            stats.created++;
            totalCreated++;
          } catch (err: any) {
            stats.failed++;
            totalFailed++;
            stats.errors.push(`Deal ${deal.id}: ${err.message}`);
          }
        }
      }
    }

    const durationMs = Date.now() - startTime;
    const completedAt = new Date().toISOString();
    const finalStatus = totalFailed > 0 && totalCreated === 0 ? 'FAILED' : totalFailed > 0 ? 'PARTIAL' : 'SUCCESS';

    const result: ZohoSyncResult = {
      success: finalStatus !== 'FAILED',
      syncLogId,
      modules: moduleResults,
      totalRead,
      totalCreated,
      totalUpdated,
      totalSkipped,
      totalFailed,
      startedAt,
      completedAt,
      durationMs,
      message: `Zoho CRM sync completed in ${durationMs}ms. Read: ${totalRead}, Created: ${totalCreated}, Updated: ${totalUpdated}, Skipped: ${totalSkipped}, Failed: ${totalFailed}.`,
    };

    // Update history item
    pendingHistoryItem.status = finalStatus;
    pendingHistoryItem.records_read = totalRead;
    pendingHistoryItem.records_created = totalCreated;
    pendingHistoryItem.records_updated = totalUpdated;
    pendingHistoryItem.records_skipped = totalSkipped;
    pendingHistoryItem.records_failed = totalFailed;
    pendingHistoryItem.completed_at = completedAt;
    pendingHistoryItem.duration_ms = durationMs;
    pendingHistoryItem.details = { modules: moduleResults };

    // Persist to Supabase if available
    if (isOnline) {
      try {
        const admin = createAdminClient();
        await admin.from('integration_sync_logs').insert({
          provider: 'zoho_crm',
          sync_type: options.dryRun ? 'dry_run' : 'manual',
          status: finalStatus,
          records_read: totalRead,
          records_created: totalCreated,
          records_updated: totalUpdated,
          records_skipped: totalSkipped,
          records_failed: totalFailed,
          modules_synced: modulesToSync,
          details: { modules: moduleResults },
          triggered_by_id: actor.id,
          triggered_by_name: actor.name,
          started_at: startedAt,
          completed_at: completedAt,
          duration_ms: durationMs,
        });
      } catch (err: any) {
        console.warn('Could not insert to integration_sync_logs table:', err?.message);
      }
    }

    // Audit Event
    await logAuditEvent({
      userName: actor.name,
      action: 'ZOHO_SYNC_COMPLETED',
      module: 'INTEGRATIONS',
      details: `Zoho CRM sync finished with status ${finalStatus}: ${totalCreated} created, ${totalUpdated} updated, ${totalSkipped} skipped, ${totalFailed} failed.`,
    });

    return result;
  } catch (err: any) {
    const durationMs = Date.now() - startTime;
    const completedAt = new Date().toISOString();

    pendingHistoryItem.status = 'FAILED';
    pendingHistoryItem.error_message = err.message;
    pendingHistoryItem.completed_at = completedAt;
    pendingHistoryItem.duration_ms = durationMs;

    await logAuditEvent({
      userName: actor.name,
      action: 'ZOHO_SYNC_FAILED',
      module: 'INTEGRATIONS',
      details: `Zoho CRM sync aborted with error: ${err.message}`,
    });

    return {
      success: false,
      syncLogId,
      modules: moduleResults,
      totalRead,
      totalCreated,
      totalUpdated,
      totalSkipped,
      totalFailed,
      startedAt,
      completedAt,
      durationMs,
      error: err.message || 'Zoho CRM sync failed',
    };
  }
}

/**
 * Upserts a bidirectional entity mapping record for traceability.
 */
async function upsertEntityMapping(params: {
  externalModule: ZohoModuleType;
  externalId: string;
  erpEntity: 'customers' | 'enquiries' | 'opportunities';
  erpId: string;
  payloadHash: string;
  metadata?: any;
}): Promise<void> {
  try {
    const admin = createAdminClient();
    await admin.from('integration_entity_mappings').upsert(
      {
        provider: 'zoho_crm',
        external_module: params.externalModule,
        external_id: params.externalId,
        erp_entity: params.erpEntity,
        erp_id: params.erpId,
        sync_hash: params.payloadHash,
        metadata: params.metadata || {},
        last_synced_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'provider,external_module,external_id' }
    );
  } catch (err: any) {
    console.warn('Failed to upsert integration_entity_mappings:', err?.message);
  }
}

/**
 * Fetch recent Zoho synchronization execution logs.
 */
export async function getRecentZohoSyncLogs(limit = 10): Promise<ZohoSyncHistoryItem[]> {
  const localLogs = getLocalSyncLogs();

  if (await isSupabaseAvailable()) {
    try {
      const admin = createAdminClient();
      const { data, error } = await admin
        .from('integration_sync_logs')
        .select('*')
        .eq('provider', 'zoho_crm')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (!error && data && data.length > 0) {
        return data as ZohoSyncHistoryItem[];
      }
    } catch {
      // Fall through to memory
    }
  }

  return localLogs.slice(0, limit);
}
