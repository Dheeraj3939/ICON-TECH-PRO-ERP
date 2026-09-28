'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { isSupabaseAvailable } from '@/lib/supabase/health';
import { requireRole } from '@/lib/auth/session';
import { logAuditEvent } from '@/lib/audit/logger';
import type {
  TallySyncItem,
  TallyEntityType,
  TallySyncStatus,
  TallyLedgerMapping,
} from '@/types/erp';

declare global {
  // eslint-disable-next-line no-var
  var __ICON_TALLY_QUEUE__: TallySyncItem[] | undefined;
  // eslint-disable-next-line no-var
  var __ICON_TALLY_MAPPINGS__: TallyLedgerMapping[] | undefined;
}

const INITIAL_MAPPINGS: TallyLedgerMapping[] = [
  {
    erp_id: 'CUST0001',
    erp_name: 'T-Hub Foundation',
    entity_type: 'CUSTOMER',
    tally_ledger_name: 'T-Hub Foundation (Sundry Debtors)',
    tally_group: 'Sundry Debtors',
    is_verified: true,
  },
  {
    erp_id: 'CUST0002',
    erp_name: 'Tech Mahindra SEZ Unit',
    entity_type: 'CUSTOMER',
    tally_ledger_name: 'Tech Mahindra Ltd (SEZ Debtors)',
    tally_group: 'Sundry Debtors',
    is_verified: true,
  },
  {
    erp_id: 'SUP001',
    erp_name: 'Hyderabad AV Tech Distributors',
    entity_type: 'SUPPLIER',
    tally_ledger_name: 'Hyderabad AV Tech (Sundry Creditors)',
    tally_group: 'Sundry Creditors',
    is_verified: true,
  },
  {
    erp_id: 'TAX-CGST-9',
    erp_name: 'CGST 9%',
    entity_type: 'TAX',
    tally_ledger_name: 'Output CGST 9%',
    tally_group: 'Duties & Taxes',
    is_verified: true,
  },
  {
    erp_id: 'TAX-SGST-9',
    erp_name: 'SGST 9%',
    entity_type: 'TAX',
    tally_ledger_name: 'Output SGST 9%',
    tally_group: 'Duties & Taxes',
    is_verified: true,
  },
  {
    erp_id: 'TAX-IGST-18',
    erp_name: 'IGST 18%',
    entity_type: 'TAX',
    tally_ledger_name: 'Output IGST 18%',
    tally_group: 'Duties & Taxes',
    is_verified: true,
  },
  {
    erp_id: 'BANK-HDFC',
    erp_name: 'HDFC Bank Current Account',
    entity_type: 'BANK',
    tally_ledger_name: 'HDFC Bank A/c 50200012345678',
    tally_group: 'Bank Accounts',
    is_verified: true,
  },
];

const INITIAL_QUEUE: TallySyncItem[] = [
  {
    id: 'TSYNC-001',
    entity_type: 'SALES_INVOICE',
    entity_id: 'INV-260001',
    entity_number: 'ICON/26-27/INV-0001',
    tally_voucher_type: 'Sales',
    payload_summary: 'Sales Voucher for T-Hub Foundation - ₹94,400 (CGST+SGST)',
    status: 'SUCCESS',
    retry_count: 0,
    max_retries: 3,
    tally_guid: 'tally-guid-984210-2026',
    tally_alter_id: 1042,
    synced_at: '2026-04-10T11:00:00.000Z',
    reconciled_at: '2026-04-10T11:05:00.000Z',
    created_at: '2026-04-10T10:45:00.000Z',
  },
  {
    id: 'TSYNC-002',
    entity_type: 'PAYMENT',
    entity_id: 'PAY-260001',
    entity_number: 'RCPT-260001',
    tally_voucher_type: 'Receipt',
    payload_summary: 'Bank Receipt from T-Hub Foundation - ₹94,400 via NEFT',
    status: 'SUCCESS',
    retry_count: 0,
    max_retries: 3,
    tally_guid: 'tally-guid-984211-2026',
    tally_alter_id: 1043,
    synced_at: '2026-04-12T14:30:00.000Z',
    reconciled_at: '2026-04-12T14:32:00.000Z',
    created_at: '2026-04-12T14:15:00.000Z',
  },
  {
    id: 'TSYNC-003',
    entity_type: 'SALES_INVOICE',
    entity_id: 'INV-260002',
    entity_number: 'ICON/26-27/INV-0002',
    tally_voucher_type: 'Sales',
    payload_summary: 'Sales Voucher for Tech Mahindra SEZ - ₹1,48,000 (LUT Zero-rated)',
    status: 'PENDING',
    retry_count: 0,
    max_retries: 3,
    created_at: '2026-04-13T09:00:00.000Z',
  },
];

function getInternalQueueStore(): TallySyncItem[] {
  if (!globalThis.__ICON_TALLY_QUEUE__) {
    globalThis.__ICON_TALLY_QUEUE__ = [...INITIAL_QUEUE];
  }
  return globalThis.__ICON_TALLY_QUEUE__;
}

function getInternalMappingsStore(): TallyLedgerMapping[] {
  if (!globalThis.__ICON_TALLY_MAPPINGS__) {
    globalThis.__ICON_TALLY_MAPPINGS__ = [...INITIAL_MAPPINGS];
  }
  return globalThis.__ICON_TALLY_MAPPINGS__;
}

export async function getTallySyncQueue(filters?: {
  status?: TallySyncStatus;
  entity_type?: TallyEntityType;
}): Promise<{ queue: TallySyncItem[]; total: number }> {
  const store = getInternalQueueStore();

  let filtered = [...store];
  if (filters?.status) {
    filtered = filtered.filter((i) => i.status === filters.status);
  }
  if (filters?.entity_type) {
    filtered = filtered.filter((i) => i.entity_type === filters.entity_type);
  }

  return { queue: filtered, total: filtered.length };
}

export async function getTallyLedgerMappings(): Promise<TallyLedgerMapping[]> {
  return getInternalMappingsStore();
}

/**
 * Stage an item into the Tally sync queue.
 * Idempotent: does not create duplicate entries if pending.
 */
export async function queueTallySync(payload: {
  entity_type: TallyEntityType;
  entity_id: string;
  entity_number: string;
  tally_voucher_type: string;
  payload_summary: string;
}): Promise<{ success: boolean; data?: TallySyncItem; error?: string }> {
  try {
    const authUser = await requireRole(['Managing Director', 'Admin / BDM', 'Accounts']);
    const store = getInternalQueueStore();

    // Idempotency Check: Don't enqueue duplicate pending syncs for the same entity
    const existing = store.find(
      (i) => i.entity_id === payload.entity_id && (i.status === 'PENDING' || i.status === 'PROCESSING')
    );
    if (existing) {
      return { success: true, data: existing };
    }

    const newItem: TallySyncItem = {
      id: `TSYNC-${Date.now()}`,
      entity_type: payload.entity_type,
      entity_id: payload.entity_id,
      entity_number: payload.entity_number,
      tally_voucher_type: payload.tally_voucher_type,
      payload_summary: payload.payload_summary,
      status: 'PENDING',
      retry_count: 0,
      max_retries: 3,
      created_at: new Date().toISOString(),
    };

    store.unshift(newItem);

    await logAuditEvent({
      userName: authUser.name,
      action: 'QUEUE_TALLY_SYNC',
      module: 'INTEGRATIONS',
      details: `Enqueued ${payload.entity_type} ${payload.entity_number} for Tally voucher sync (${newItem.id})`,
    });

    revalidatePath('/dashboard/tally');
    return { success: true, data: newItem };
  } catch (err) {
    return { success: false, error: (err as Error).message || 'Failed to queue Tally sync' };
  }
}

/**
 * Generate standard TallyPrime XML Voucher conforming to Tally XML Interface
 */
export async function generateTallyVoucherXml(item: TallySyncItem): Promise<string> {
  return `<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Import Data</TALLYREQUEST>
  </HEADER>
  <BODY>
    <IMPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>Vouchers</REPORTNAME>
        <STATICVARIABLES>
          <SVCURRENTCOMPANY>ICON TECH PRO</SVCURRENTCOMPANY>
        </STATICVARIABLES>
      </REQUESTDESC>
      <REQUESTDATA>
        <TALLYMESSAGE xmlns:UDF="TallyUDF">
          <VOUCHER VCHTYPE="${item.tally_voucher_type}" ACTION="Create">
            <DATE>${new Date(item.created_at).toISOString().slice(0, 10).replace(/-/g, '')}</DATE>
            <VOUCHERNUMBER>${item.entity_number}</VOUCHERNUMBER>
            <NARRATION>Auto-generated from ICON TECH PRO ERP (Ref: ${item.id}) - ${item.payload_summary}</NARRATION>
            <!-- Ledger Entries Generated Dynamically by Tally Windows Bridge -->
          </VOUCHER>
        </TALLYMESSAGE>
      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>`;
}

/**
 * Reconcile a Tally synced item with external Tally GUID
 */
export async function reconcileTallyItem(
  id: string,
  tally_guid: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const authUser = await requireRole(['Managing Director', 'Admin / BDM', 'Accounts']);
    const store = getInternalQueueStore();

    const found = store.find((i) => i.id === id);
    if (!found) {
      return { success: false, error: 'Sync item not found' };
    }

    found.status = 'RECONCILED';
    found.tally_guid = tally_guid;
    found.reconciled_at = new Date().toISOString();

    await logAuditEvent({
      userName: authUser.name,
      action: 'RECONCILE_TALLY_ITEM',
      module: 'INTEGRATIONS',
      details: `Reconciled Tally item ${found.entity_number} with GUID ${tally_guid}`,
    });

    revalidatePath('/dashboard/tally');
    return { success: true };
  } catch (err) {
    return { success: false, error: (err as Error).message || 'Failed to reconcile Tally item' };
  }
}

/**
 * Retry failed Tally sync item
 */
export async function retryTallySyncItem(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    const authUser = await requireRole(['Managing Director', 'Admin / BDM', 'Accounts']);
    const store = getInternalQueueStore();

    const found = store.find((i) => i.id === id);
    if (!found) {
      return { success: false, error: 'Sync item not found' };
    }

    found.status = 'PENDING';
    found.error_message = undefined;
    found.retry_count = 0;

    await logAuditEvent({
      userName: authUser.name,
      action: 'RETRY_TALLY_SYNC',
      module: 'INTEGRATIONS',
      details: `Reset Tally sync queue item ${id} for retry`,
    });

    revalidatePath('/dashboard/tally');
    return { success: true };
  } catch (err) {
    return { success: false, error: (err as Error).message || 'Failed to retry Tally sync' };
  }
}

/**
 * Tally Integration Diagnostics & Statistics
 */
export async function getTallyIntegrationSummary(): Promise<{
  bridgeStatus: 'UNCONFIGURED' | 'LOCAL_BRIDGE_PENDING' | 'CONNECTED';
  totalQueued: number;
  totalSynced: number;
  totalFailed: number;
  totalReconciled: number;
  lastSyncTime?: string;
}> {
  const store = getInternalQueueStore();
  const synced = store.filter((i) => i.status === 'SUCCESS').length;
  const pending = store.filter((i) => i.status === 'PENDING' || i.status === 'PROCESSING').length;
  const failed = store.filter((i) => i.status === 'FAILED').length;
  const reconciled = store.filter((i) => i.status === 'RECONCILED').length;

  return {
    bridgeStatus: 'LOCAL_BRIDGE_PENDING',
    totalQueued: pending,
    totalSynced: synced,
    totalFailed: failed,
    totalReconciled: reconciled,
    lastSyncTime: store[0]?.synced_at || undefined,
  };
}

/**
 * Modern TallyPrime 7+ JSON Integration Payload Generator
 * Conforms to TallyPrime native HTTP JSON/JSONEx specification.
 */
export async function generateTallyJsonPayload(
  entityType: string,
  entityData?: any
): Promise<Record<string, any>> {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');

  switch (entityType) {
    case 'CUSTOMER':
      return {
        HEADER: {
          TALLYREQUEST: 'Import Data',
          TYPE: 'Data',
          ID: 'All Masters',
          VERSION: 'TallyPrime 7.0',
        },
        BODY: {
          DESC: {
            STATICVARIABLES: {
              SVCURRENTCOMPANY: 'ICON TECH PRO',
            },
          },
          DATA: {
            TALLYMESSAGE: {
              LEDGER: {
                NAME: entityData?.customer_name || 'Swan Technologies Pvt Ltd',
                PARENT: 'Sundry Debtors',
                ISBILLWISEON: 'Yes',
                STATENAME: 'Telangana',
                COUNTRYNAME: 'India',
                PARTYGSTIN: entityData?.gstin || '36AAACS1429B1Z8',
                LEDGERPHONE: entityData?.phone || '8099909921',
                EMAIL: entityData?.email || 'purchase@swantech.in',
                OPENINGBALANCE: 0,
              },
            },
          },
        },
      };

    case 'SUPPLIER':
      return {
        HEADER: {
          TALLYREQUEST: 'Import Data',
          TYPE: 'Data',
          ID: 'All Masters',
          VERSION: 'TallyPrime 7.0',
        },
        BODY: {
          DESC: {
            STATICVARIABLES: {
              SVCURRENTCOMPANY: 'ICON TECH PRO',
            },
          },
          DATA: {
            TALLYMESSAGE: {
              LEDGER: {
                NAME: entityData?.supplier_name || 'Hyderabad AV Tech Distributors',
                PARENT: 'Sundry Creditors',
                ISBILLWISEON: 'Yes',
                STATENAME: 'Telangana',
                COUNTRYNAME: 'India',
                PARTYGSTIN: entityData?.gstin || '36AABCH1234F1Z1',
                OPENINGBALANCE: 0,
              },
            },
          },
        },
      };

    case 'PRODUCT':
      return {
        HEADER: {
          TALLYREQUEST: 'Import Data',
          TYPE: 'Data',
          ID: 'All Masters',
          VERSION: 'TallyPrime 7.0',
        },
        BODY: {
          DESC: {
            STATICVARIABLES: {
              SVCURRENTCOMPANY: 'ICON TECH PRO',
            },
          },
          DATA: {
            TALLYMESSAGE: {
              STOCKITEM: {
                NAME: entityData?.product_name || 'Optoma 4K UHD High-Lumen Laser Projector',
                PARENT: 'Primary',
                BASEUNITS: 'Nos.',
                HSNCODE: entityData?.hsn_sac || '85286200',
                GSTDETAILS: {
                  TAXABILITY: 'Taxable',
                  GSTRATE: 18,
                },
                STANDARDCOST: entityData?.purchase_price || 95000,
                STANDARDSELLINGPRICE: entityData?.selling_price || 120000,
              },
            },
          },
        },
      };

    case 'SALES_INVOICE':
      return {
        HEADER: {
          TALLYREQUEST: 'Import Data',
          TYPE: 'Data',
          ID: 'Vouchers',
          VERSION: 'TallyPrime 7.0',
        },
        BODY: {
          DESC: {
            STATICVARIABLES: {
              SVCURRENTCOMPANY: 'ICON TECH PRO',
            },
          },
          DATA: {
            TALLYMESSAGE: {
              VOUCHER: {
                DATE: dateStr,
                VOUCHERTYPENAME: 'Sales',
                VOUCHERNUMBER: entityData?.invoice_number || 'ICON/26-27/INV-0099',
                PARTYLEDGERNAME: entityData?.customer_name || 'Swan Technologies Pvt Ltd',
                PERSISTEDVIEW: 'Invoice View',
                ISINVOICE: 'Yes',
                ALLLEDGERENTRIES_LIST: [
                  {
                    LEDGERNAME: entityData?.customer_name || 'Swan Technologies Pvt Ltd',
                    ISDEEMEDPOSITIVE: 'Yes',
                    AMOUNT: -156940,
                    BILLALLOCATIONS_LIST: [
                      {
                        NAME: entityData?.invoice_number || 'ICON/26-27/INV-0099',
                        BILLTYPE: 'New Ref',
                        AMOUNT: -156940,
                      },
                    ],
                  },
                  {
                    LEDGERNAME: 'Sales - Audio Visual Equipment',
                    ISDEEMEDPOSITIVE: 'No',
                    AMOUNT: 133000,
                  },
                  {
                    LEDGERNAME: 'Output CGST 9%',
                    ISDEEMEDPOSITIVE: 'No',
                    AMOUNT: 11970,
                  },
                  {
                    LEDGERNAME: 'Output SGST 9%',
                    ISDEEMEDPOSITIVE: 'No',
                    AMOUNT: 11970,
                  },
                ],
              },
            },
          },
        },
      };

    case 'PURCHASE_INVOICE':
      return {
        HEADER: {
          TALLYREQUEST: 'Import Data',
          TYPE: 'Data',
          ID: 'Vouchers',
          VERSION: 'TallyPrime 7.0',
        },
        BODY: {
          DESC: {
            STATICVARIABLES: {
              SVCURRENTCOMPANY: 'ICON TECH PRO',
            },
          },
          DATA: {
            TALLYMESSAGE: {
              VOUCHER: {
                DATE: dateStr,
                VOUCHERTYPENAME: 'Purchase',
                VOUCHERNUMBER: entityData?.bill_number || 'PI-260099',
                PARTYLEDGERNAME: entityData?.supplier_name || 'Hyderabad AV Tech Distributors',
                ISINVOICE: 'Yes',
                ALLLEDGERENTRIES_LIST: [
                  {
                    LEDGERNAME: entityData?.supplier_name || 'Hyderabad AV Tech Distributors',
                    ISDEEMEDPOSITIVE: 'No',
                    AMOUNT: 112100,
                  },
                  {
                    LEDGERNAME: 'Purchase - AV Hardware',
                    ISDEEMEDPOSITIVE: 'Yes',
                    AMOUNT: -95000,
                  },
                  {
                    LEDGERNAME: 'Input CGST 9%',
                    ISDEEMEDPOSITIVE: 'Yes',
                    AMOUNT: -8550,
                  },
                  {
                    LEDGERNAME: 'Input SGST 9%',
                    ISDEEMEDPOSITIVE: 'Yes',
                    AMOUNT: -8550,
                  },
                ],
              },
            },
          },
        },
      };

    case 'PAYMENT':
      return {
        HEADER: {
          TALLYREQUEST: 'Import Data',
          TYPE: 'Data',
          ID: 'Vouchers',
          VERSION: 'TallyPrime 7.0',
        },
        BODY: {
          DESC: {
            STATICVARIABLES: {
              SVCURRENTCOMPANY: 'ICON TECH PRO',
            },
          },
          DATA: {
            TALLYMESSAGE: {
              VOUCHER: {
                DATE: dateStr,
                VOUCHERTYPENAME: 'Receipt',
                VOUCHERNUMBER: entityData?.payment_number || 'RCPT-260099',
                PARTYLEDGERNAME: entityData?.customer_name || 'Swan Technologies Pvt Ltd',
                ALLLEDGERENTRIES_LIST: [
                  {
                    LEDGERNAME: 'HDFC Bank Current Account',
                    ISDEEMEDPOSITIVE: 'Yes',
                    AMOUNT: -156940,
                  },
                  {
                    LEDGERNAME: entityData?.customer_name || 'Swan Technologies Pvt Ltd',
                    ISDEEMEDPOSITIVE: 'No',
                    AMOUNT: 156940,
                    BILLALLOCATIONS_LIST: [
                      {
                        NAME: entityData?.invoice_number || 'ICON/26-27/INV-0099',
                        BILLTYPE: 'Agst Ref',
                        AMOUNT: 156940,
                      },
                    ],
                  },
                ],
              },
            },
          },
        },
      };

    case 'CREDIT_NOTE':
      return {
        HEADER: {
          TALLYREQUEST: 'Import Data',
          TYPE: 'Data',
          ID: 'Vouchers',
          VERSION: 'TallyPrime 7.0',
        },
        BODY: {
          DESC: {
            STATICVARIABLES: {
              SVCURRENTCOMPANY: 'ICON TECH PRO',
            },
          },
          DATA: {
            TALLYMESSAGE: {
              VOUCHER: {
                DATE: dateStr,
                VOUCHERTYPENAME: 'Credit Note',
                VOUCHERNUMBER: entityData?.note_number || 'CN-260001',
                PARTYLEDGERNAME: entityData?.customer_name || 'Swan Technologies Pvt Ltd',
                ALLLEDGERENTRIES_LIST: [
                  {
                    LEDGERNAME: entityData?.customer_name || 'Swan Technologies Pvt Ltd',
                    ISDEEMEDPOSITIVE: 'No',
                    AMOUNT: 11800,
                  },
                  {
                    LEDGERNAME: 'Sales Returns & Rebates',
                    ISDEEMEDPOSITIVE: 'Yes',
                    AMOUNT: -10000,
                  },
                  {
                    LEDGERNAME: 'Output CGST 9%',
                    ISDEEMEDPOSITIVE: 'Yes',
                    AMOUNT: -900,
                  },
                  {
                    LEDGERNAME: 'Output SGST 9%',
                    ISDEEMEDPOSITIVE: 'Yes',
                    AMOUNT: -900,
                  },
                ],
              },
            },
          },
        },
      };

    case 'DEBIT_NOTE':
      return {
        HEADER: {
          TALLYREQUEST: 'Import Data',
          TYPE: 'Data',
          ID: 'Vouchers',
          VERSION: 'TallyPrime 7.0',
        },
        BODY: {
          DESC: {
            STATICVARIABLES: {
              SVCURRENTCOMPANY: 'ICON TECH PRO',
            },
          },
          DATA: {
            TALLYMESSAGE: {
              VOUCHER: {
                DATE: dateStr,
                VOUCHERTYPENAME: 'Debit Note',
                VOUCHERNUMBER: entityData?.note_number || 'DN-260001',
                PARTYLEDGERNAME: entityData?.supplier_name || 'Hyderabad AV Tech Distributors',
                ALLLEDGERENTRIES_LIST: [
                  {
                    LEDGERNAME: entityData?.supplier_name || 'Hyderabad AV Tech Distributors',
                    ISDEEMEDPOSITIVE: 'Yes',
                    AMOUNT: -5900,
                  },
                  {
                    LEDGERNAME: 'Purchase Returns / Price Difference',
                    ISDEEMEDPOSITIVE: 'No',
                    AMOUNT: 5000,
                  },
                  {
                    LEDGERNAME: 'Input CGST 9%',
                    ISDEEMEDPOSITIVE: 'No',
                    AMOUNT: 450,
                  },
                  {
                    LEDGERNAME: 'Input SGST 9%',
                    ISDEEMEDPOSITIVE: 'No',
                    AMOUNT: 450,
                  },
                ],
              },
            },
          },
        },
      };

    default:
      return {
        HEADER: { TALLYREQUEST: 'Import Data', VERSION: 'TallyPrime 7.0' },
        BODY: { MESSAGE: 'Generic TallyPrime JSON Object' },
      };
  }
}

/**
 * Diagnostic check for TallyPrime Bridge Connection.
 * Non-destructive and safe; returns honest connection status.
 */
export async function checkTallyBridgeConnection(endpoint: string = 'http://localhost:9000'): Promise<{
  connected: boolean;
  status: 'CONNECTED' | 'TALLY BRIDGE NOT CONNECTED';
  endpoint: string;
  latency_ms?: number;
  message: string;
}> {
  const start = Date.now();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 1200);

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ TALLYREQUEST: 'Status' }),
      signal: controller.signal,
    }).catch(() => null);

    clearTimeout(timeout);

    if (res && res.ok) {
      return {
        connected: true,
        status: 'CONNECTED',
        endpoint,
        latency_ms: Date.now() - start,
        message: 'TallyPrime HTTP server connected and responding on ' + endpoint,
      };
    }
  } catch {}

  return {
    connected: false,
    status: 'TALLY BRIDGE NOT CONNECTED',
    endpoint,
    latency_ms: Date.now() - start,
    message: 'TallyPrime HTTP server is not reachable on ' + endpoint + '. Ensure TallyPrime is open and HTTP Server is enabled in F12 > Advanced Configuration.',
  };
}
